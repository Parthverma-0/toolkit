const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { FinancialRecord, Grant, Program } = require('../models');
const ApiError = require('../utils/ApiError');
const f = require('../utils/format');
const { fyRange } = require('../utils/financialYear');
const { renderPdf } = require('./reportRenderer.service');
const { folderPath, storeLocalFile } = require('./storage.service');

// Grants an incubator can book money against: its own grants plus external
// (government / corporate / foundation) grants it received, which have no incubator.
const usableGrantFilter = (incubatorId) => ({
  $or: [{ incubator: incubatorId }, { providerType: { $ne: 'incubator' } }],
});

// Generates utilization certificates and expenditure reports from FinancialRecords,
// scoped to the whole incubator or to one grant / program.

const loadScope = async (incubator, { grant, program }) => {
  const scope = { incubator: incubator._id };
  let label = 'All schemes';
  if (grant) {
    const g = await Grant.findOne({ _id: grant, ...usableGrantFilter(incubator._id) });
    if (!g) throw ApiError.badRequest('Grant not found');
    scope.grant = g._id;
    label = `${g.title} (${g.provider})`;
  }
  if (program) {
    const p = await Program.findOne({ _id: program, incubator: incubator._id });
    if (!p) throw ApiError.badRequest('Program not found in your incubator');
    scope.program = p._id;
    label = `${p.name}${p.fundingAgency ? ` - ${p.fundingAgency}` : ''}`;
  }
  return { scope, label };
};

const totals = async (match) => {
  const rows = await FinancialRecord.aggregate([{ $match: match }, { $group: { _id: '$entryType', total: { $sum: '$amount' } } }]);
  const by = Object.fromEntries(rows.map((r) => [r._id, r.total]));
  return { income: by.income || 0, expense: by.expense || 0 };
};

const expenseByCategory = (match) => FinancialRecord.aggregate([
  { $match: { ...match, entryType: 'expense' } },
  { $group: { _id: '$category', total: { $sum: '$amount' }, entries: { $sum: 1 } } },
  { $sort: { total: -1 } },
]);

const utilizationCertificate = async (incubator, { financialYear, grant, program, amountSanctioned }) => {
  const { scope, label } = await loadScope(incubator, { grant, program });
  const { from, to } = fyRange(financialYear);
  const [before, during, categories] = await Promise.all([
    totals({ ...scope, date: { $lt: from } }),
    totals({ ...scope, date: { $gte: from, $lte: to } }),
    expenseByCategory({ ...scope, date: { $gte: from, $lte: to } }),
  ]);
  const opening = before.income - before.expense;
  const available = opening + during.income;
  const unspent = available - during.expense;

  const doc = {
    title: 'Utilization Certificate',
    subtitle: `Financial Year ${financialYear}`,
    meta: [['Incubator', incubator.name], ['Scheme / Grant', label], ['Amount sanctioned', f.inr(amountSanctioned)]],
    sections: [
      {
        heading: 'Statement of Funds',
        kv: [
          ['Opening balance (unspent from previous years)', f.inr(opening)],
          ['Funds received during the year', f.inr(during.income)],
          ['Total funds available', f.inr(available)],
          ['Funds utilized during the year', f.inr(during.expense)],
          ['Unspent balance carried forward', f.inr(unspent)],
        ],
      },
      {
        heading: 'Utilization by Head',
        table: { columns: ['Head of expenditure', 'Entries', 'Amount'], rows: categories.map((c) => [f.label(c._id), c.entries, f.inr(c.total)]) },
      },
      {
        heading: 'Certificate',
        paragraphs: [
          `Certified that out of ${f.inr(available)} available during the financial year ${financialYear} for ${label}, `
          + `a sum of ${f.inr(during.expense)} has been utilized for the purpose for which it was sanctioned, and that the balance `
          + `of ${f.inr(unspent)} remains unutilized at the end of the year.`,
          'Certified further that the conditions on which the funds were sanctioned have been duly fulfilled and that the expenditure '
          + 'has been incurred as per the applicable guidelines.',
        ],
        signatures: ['Incubator Head', 'Chartered Accountant / Finance Officer', 'Date & Seal'],
      },
    ],
  };
  return { doc, amountUtilized: during.expense };
};

const expenditureReport = async (incubator, { financialYear, grant, program }) => {
  const { scope, label } = await loadScope(incubator, { grant, program });
  const { from, to } = fyRange(financialYear);
  const match = { ...scope, entryType: 'expense', date: { $gte: from, $lte: to } };
  const [items, categories] = await Promise.all([
    FinancialRecord.find(match).sort({ date: 1 }).populate('startup', 'name'),
    expenseByCategory(match),
  ]);
  const total = categories.reduce((s, c) => s + c.total, 0);

  const doc = {
    title: 'Expenditure Report',
    subtitle: `Financial Year ${financialYear}`,
    meta: [['Incubator', incubator.name], ['Scheme / Grant', label], ['Total expenditure', f.inr(total)]],
    sections: [
      {
        heading: 'Summary by Head',
        table: { columns: ['Head', 'Entries', 'Amount', 'Share'], rows: categories.map((c) => [f.label(c._id), c.entries, f.inr(c.total), f.pct(c.total, total)]) },
      },
      {
        heading: 'Line Items',
        table: {
          columns: ['Date', 'Head', 'Description', 'Startup', 'Ref. no.', 'Amount'],
          rows: items.map((r) => [f.date(r.date), f.label(r.category), r.description, r.startup?.name, r.referenceNo, f.inr(r.amount)]),
        },
      },
      { heading: 'Authorisation', signatures: ['Prepared by', 'Verified by (Finance)', 'Approved by (Incubator Head)'] },
    ],
  };
  return { doc, amountUtilized: total };
};

const GENERATORS = { utilization_certificate: utilizationCertificate, expenditure_report: expenditureReport };

// Renders the PDF into uploads/compliance (then Cloudinary if enabled) and returns its URL
const savePdf = (doc) => new Promise((resolve, reject) => {
  const dir = folderPath('compliance');
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.pdf`);
  const out = fs.createWriteStream(filePath);
  renderPdf(doc).pipe(out);
  out.on('finish', () => storeLocalFile(filePath, { folder: 'compliance', mimetype: 'application/pdf' }).then(resolve, reject));
  out.on('error', reject);
});

const generate = async (docType, incubator, params) => {
  const { doc, amountUtilized } = await GENERATORS[docType](incubator, params);
  const fileUrl = await savePdf(doc);
  return { doc, fileUrl, amountUtilized };
};

module.exports = { generate, usableGrantFilter, GENERATED_TYPES: Object.keys(GENERATORS) };
