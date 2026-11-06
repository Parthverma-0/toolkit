const {
  Cohort, Program, Enrollment, CohortApplication, FundingTransaction, FinancialRecord, StartupMetric,
  Achievement, Event, EventRegistration, EmailCampaign, ComplianceDocument, User,
} = require('../models');
const ApiError = require('../utils/ApiError');
const f = require('../utils/format');
const { fyRange } = require('../utils/financialYear');
const { revenueByStartup, sectorSplit } = require('./incubatorDashboard.service');
const { COMPLIANCE_DOC_TYPES } = require('../utils/constants');

// Each builder returns a renderer "document" (see reportRenderer.service).

const inRange = (field, { from, to }) => ({ [field]: { $gte: from, $lte: to } });

const uniqueIds = (ids) => [...new Map(ids.map((i) => [String(i), i])).values()];

const countBy = (items, key) => items.reduce((acc, it) => {
  const k = typeof key === 'function' ? key(it) : it[key];
  acc[k] = (acc[k] || 0) + 1;
  return acc;
}, {});

const sumFunding = async (match) => {
  const rows = await FundingTransaction.aggregate([{ $match: match }, { $group: { _id: '$type', total: { $sum: '$amount' } } }]);
  const by = Object.fromEntries(rows.map((r) => [r._id, r.total]));
  return { raised: by.ic_fund_raised || 0, distributed: by.ic_fund_distributed || 0, external: by.external_funding || 0 };
};

const sumFinancial = async (match) => {
  const rows = await FinancialRecord.aggregate([
    { $match: match },
    { $group: { _id: { entryType: '$entryType', category: '$category' }, total: { $sum: '$amount' } } },
  ]);
  const income = rows.filter((r) => r._id.entryType === 'income').map((r) => [r._id.category, r.total]);
  const expense = rows.filter((r) => r._id.entryType === 'expense').map((r) => [r._id.category, r.total]);
  const total = (list) => list.reduce((s, [, v]) => s + v, 0);
  return {
    income, expense, totalIncome: total(income), totalExpense: total(expense),
  };
};

const incubatorMeta = (inc) => [
  ['Incubator', inc.name],
  ['Type', f.label(inc.type)],
  ['Host institution', inc.hostInstitution],
  ['Established', inc.establishedYear],
  ['Address', [inc.address?.line1, inc.address?.city, inc.address?.state, inc.address?.pincode].filter(Boolean).join(', ')],
  ['Contact', [inc.email, inc.phone].filter(Boolean).join(' | ')],
];

const achievementsTable = (achievements) => ({
  columns: ['Startup', 'Type', 'Title', 'Date', 'Verified'],
  rows: achievements.map((a) => [a.startup?.name, f.label(a.type), a.title, f.date(a.date), a.isVerified ? 'Yes' : 'No']),
});

// ---------------- Project application (program proposal to a funding agency) ----------------
const projectApplication = async ({ incubator, program }) => {
  const id = incubator._id;
  const [startupStatus, completedCohorts, funding, achievements, members] = await Promise.all([
    Enrollment.aggregate([{ $match: { incubator: id } }, { $group: { _id: '$status', s: { $addToSet: '$startup' } } }]),
    Cohort.countDocuments({ incubator: id, status: 'completed' }),
    sumFunding({ incubator: id }),
    Achievement.find({ incubator: id }).select('type'),
    User.find({ _id: { $in: incubator.members } }).select('name incubatorRole'),
  ]);
  const byStatus = Object.fromEntries(startupStatus.map((r) => [r._id, r.s.length]));
  const allStartups = new Set(startupStatus.flatMap((r) => r.s.map(String))).size;
  const achievementCounts = countBy(achievements, 'type');

  return {
    title: 'Project Application',
    subtitle: `${program.name}${program.fundingAgency ? ` - submitted to ${program.fundingAgency}` : ''}`,
    meta: incubatorMeta(incubator),
    sections: [
      { heading: 'About the Incubator', paragraphs: [incubator.about || 'Not provided'] },
      {
        heading: 'Proposed Program',
        kv: [
          ['Program', program.name],
          ['Type', f.label(program.type)],
          ['Duration', program.durationMonths ? `${program.durationMonths} months` : '-'],
          ['Focus sectors', program.sectors.map(f.label).join(', ')],
          ['Benefits to startups', program.benefits.join('; ')],
          ['Funding support', program.fundingSupport?.available ? `Up to ${f.inr(program.fundingSupport.maxAmount)}` : 'No'],
          ['Funding agency', program.fundingAgency],
          ['Description', program.description],
        ],
      },
      {
        heading: 'Track Record',
        kv: [
          ['Startups incubated (total)', allStartups],
          ['Currently incubated', byStatus.active || 0],
          ['Graduated', byStatus.graduated || 0],
          ['Cohorts completed', completedCohorts],
          ['Funds raised by IC', f.inr(funding.raised)],
          ['Funds distributed to startups', f.inr(funding.distributed)],
          ['External funding raised by startups', f.inr(funding.external)],
          ['Patents / trademarks', (achievementCounts.patent || 0) + (achievementCounts.trademark || 0)],
          ['Awards', achievementCounts.award || 0],
        ],
      },
      {
        heading: 'Infrastructure & Facilities',
        table: {
          columns: ['Facility', 'Type', 'Available', 'Description'],
          rows: incubator.accessibilities.map((a) => [a.name, f.label(a.type), a.isAvailable ? 'Yes' : 'No', a.description]),
        },
      },
      {
        heading: 'Services Offered',
        table: { columns: ['Service', 'Paid', 'Description'], rows: incubator.services.map((s) => [s.name, s.isPaid ? 'Yes' : 'No', s.description]) },
      },
      { heading: 'Team', table: { columns: ['Name', 'Role'], rows: members.map((m) => [m.name, f.label(m.incubatorRole)]) } },
      { heading: 'Declaration', paragraphs: ['We certify that the information furnished above is true to the best of our knowledge.'], signatures: ['Incubator Head', 'Date & Seal'] },
    ],
  };
};

// ---------------- Project completion (a program / funded project) ----------------
const projectCompletion = async ({ incubator, program, from, to }) => {
  const id = incubator._id;
  const cohorts = await Cohort.find({ incubator: id, program: program._id }).sort({ startDate: 1 });
  const enrollments = await Enrollment.find({ incubator: id, program: program._id }).populate('startup', 'name sector').populate('cohort', 'name');
  const startupIds = uniqueIds(enrollments.map((e) => e.startup._id));

  const period = { from: from || program.createdAt, to: to || new Date() };
  const [funding, finance, distributedByStartup, externalForStartups, revenue, achievements] = await Promise.all([
    sumFunding({ incubator: id, program: program._id, ...inRange('date', period) }),
    sumFinancial({ incubator: id, program: program._id, ...inRange('date', period) }),
    FundingTransaction.aggregate([
      { $match: { incubator: id, type: 'ic_fund_distributed', startup: { $in: startupIds } } },
      { $group: { _id: '$startup', total: { $sum: '$amount' } } },
    ]),
    sumFunding({ incubator: id, startup: { $in: startupIds }, type: 'external_funding' }),
    revenueByStartup(startupIds, period),
    Achievement.find({ startup: { $in: startupIds }, ...inRange('date', period) }).populate('startup', 'name'),
  ]);
  const distributed = Object.fromEntries(distributedByStartup.map((r) => [String(r._id), r.total]));
  const received = funding.raised + finance.income.filter(([c]) => c === 'grant_received').reduce((s, [, v]) => s + v, 0);

  return {
    title: 'Project Completion Report',
    subtitle: `${program.name} | ${f.date(period.from)} - ${f.date(period.to)}`,
    meta: incubatorMeta(incubator),
    sections: [
      {
        heading: 'Project Details',
        kv: [['Program', program.name], ['Type', f.label(program.type)], ['Funding agency', program.fundingAgency], ['Duration', program.durationMonths ? `${program.durationMonths} months` : '-']],
      },
      {
        heading: 'Cohorts Conducted',
        table: {
          columns: ['Cohort', 'Start', 'End', 'Status', 'Enrolled', 'Graduated'],
          rows: cohorts.map((c) => {
            const es = enrollments.filter((e) => e.cohort._id.equals(c._id));
            return [c.name, f.date(c.startDate), f.date(c.endDate), f.label(c.status), es.length, es.filter((e) => e.status === 'graduated').length];
          }),
        },
      },
      {
        heading: 'Startups Supported',
        table: {
          columns: ['Startup', 'Sector', 'Cohort', 'Status', 'Funds Distributed'],
          rows: enrollments.map((e) => [e.startup.name, f.label(e.startup.sector), e.cohort.name, f.label(e.status), f.inr(distributed[String(e.startup._id)] || 0)]),
        },
      },
      {
        heading: 'Financial Summary',
        kv: [
          ['Funds received', f.inr(received)],
          ['Funds distributed to startups', f.inr(funding.distributed)],
          ['Other project expenditure', f.inr(finance.totalExpense)],
          ['Unspent balance', f.inr(received - funding.distributed - finance.totalExpense)],
        ],
      },
      {
        heading: 'Key Results',
        kv: [
          ['Startups supported', startupIds.length],
          ['Graduated', enrollments.filter((e) => e.status === 'graduated').length],
          ['External funding raised by these startups', f.inr(externalForStartups.external)],
          ['Combined startup revenue in period', f.inr(revenue.reduce((s, r) => s + r.totalRevenue, 0))],
          ['Achievements', achievements.length],
        ],
      },
      {
        heading: 'Outcome Mapping',
        table: {
          columns: ['Cohort', 'Outcome', 'Indicator', 'Target', 'Unit'],
          rows: cohorts.flatMap((c) => c.outcomeMapping.map((o) => [c.name, o.outcome, o.indicator, o.target, o.unit])),
        },
      },
      { heading: 'Achievements', table: achievementsTable(achievements) },
      { heading: 'Certification', paragraphs: ['Certified that the project has been completed as per the sanctioned objectives.'], signatures: ['Incubator Head', 'Finance Officer', 'Date & Seal'] },
    ],
  };
};

// ---------------- Year end (financial year) ----------------
const yearEnd = async ({ incubator, financialYear }) => {
  const id = incubator._id;
  const period = fyRange(financialYear);
  const [cohorts, onboarded, exits, activeAtEnd, funding, finance, events, achievements] = await Promise.all([
    Cohort.find({ incubator: id, startDate: { $lte: period.to }, endDate: { $gte: period.from } }).select('name status startDate endDate'),
    Enrollment.find({ incubator: id, ...inRange('onboardedAt', period) }).populate('startup', 'name sector'),
    Enrollment.find({ incubator: id, ...inRange('exit.date', period) }).select('status'),
    Enrollment.distinct('startup', { incubator: id, onboardedAt: { $lte: period.to }, $or: [{ 'exit.date': null }, { 'exit.date': { $gt: period.to } }] }),
    sumFunding({ incubator: id, ...inRange('date', period) }),
    sumFinancial({ incubator: id, financialYear }),
    Event.find({ incubator: id, status: { $in: ['published', 'completed'] }, ...inRange('startsAt', period) }).select('type'),
    Achievement.find({ incubator: id, ...inRange('date', period) }).populate('startup', 'name'),
  ]);
  const onboardedIds = uniqueIds(onboarded.map((e) => e.startup._id));
  const [revenue, sectors] = await Promise.all([revenueByStartup(activeAtEnd, period), sectorSplit(onboardedIds)]);
  const exitCounts = countBy(exits, 'status');

  return {
    title: 'Annual (Year End) Report',
    subtitle: `Financial Year ${financialYear}`,
    meta: incubatorMeta(incubator),
    sections: [
      {
        heading: 'Overview',
        kv: [
          ['Cohorts run during the year', cohorts.length],
          ['Cohorts started', cohorts.filter((c) => c.startDate >= period.from).length],
          ['Cohorts completed', cohorts.filter((c) => c.status === 'completed' && c.endDate <= period.to).length],
          ['Startups onboarded', onboardedIds.length],
          ['Startups graduated', exitCounts.graduated || 0],
          ['Startups exited / dropped', (exitCounts.exited || 0) + (exitCounts.dropped || 0)],
          ['Startups under incubation at year end', activeAtEnd.length],
          ['Events conducted', events.length],
          ['Achievements', achievements.length],
        ],
      },
      {
        heading: 'Funding',
        kv: [['Funds raised by IC', f.inr(funding.raised)], ['Funds distributed to startups', f.inr(funding.distributed)], ['External funding raised by startups', f.inr(funding.external)]],
      },
      { heading: 'Income', table: { columns: ['Category', 'Amount'], rows: [...finance.income.map(([c, v]) => [f.label(c), f.inr(v)]), ['Total', f.inr(finance.totalIncome)]] } },
      { heading: 'Expenditure', table: { columns: ['Category', 'Amount'], rows: [...finance.expense.map(([c, v]) => [f.label(c), f.inr(v)]), ['Total', f.inr(finance.totalExpense)]] } },
      { heading: 'Net Position', kv: [['Income - Expenditure', f.inr(finance.totalIncome - finance.totalExpense)]] },
      { heading: 'Startup Revenue', table: { columns: ['Startup', 'Sector', 'Revenue in FY', 'Months reported'], rows: revenue.map((r) => [r.startup.name, f.label(r.startup.sector), f.inr(r.totalRevenue), r.monthsReported]) } },
      { heading: 'Sector Bifurcation (onboarded)', table: { columns: ['Sector', 'Startups'], rows: sectors.map((s) => [f.label(s.sector), s.count]) } },
      { heading: 'Events by Type', table: { columns: ['Type', 'Count'], rows: Object.entries(countBy(events, 'type')).map(([t, c]) => [f.label(t), c]) } },
      { heading: 'Achievements', table: achievementsTable(achievements) },
    ],
  };
};

// ---------------- Cohort end ----------------
const STANDARD_METRICS = ['revenue', 'expenses', 'customers', 'employees'];

const cohortEnd = async ({ incubator, cohort }) => {
  await cohort.populate('program', 'name');
  const [applications, enrollments, events, achievements] = await Promise.all([
    CohortApplication.find({ cohort: cohort._id }).select('status'),
    Enrollment.find({ cohort: cohort._id }).populate('startup', 'name sector'),
    Event.countDocuments({ cohort: cohort._id, status: { $in: ['published', 'completed'] } }),
    Achievement.find({ cohort: cohort._id }).populate('startup', 'name'),
  ]);
  const startupIds = enrollments.map((e) => e.startup._id);
  const distributedRows = await FundingTransaction.aggregate([
    { $match: { incubator: incubator._id, type: 'ic_fund_distributed', startup: { $in: startupIds } } },
    { $group: { _id: '$startup', total: { $sum: '$amount' } } },
  ]);
  const distributed = Object.fromEntries(distributedRows.map((r) => [String(r._id), r.total]));

  // Growth metric actuals: sum of each startup's latest reported value within the cohort period
  const latest = await StartupMetric.aggregate([
    { $match: { startup: { $in: startupIds } } },
    { $addFields: { at: { $dateFromParts: { year: '$period.year', month: '$period.month' } } } },
    { $match: { at: { $gte: cohort.startDate, $lte: cohort.endDate } } },
    { $sort: { at: -1 } },
    { $group: { _id: '$startup', doc: { $first: '$$ROOT' } } },
  ]);
  const actual = (name) => latest.reduce((sum, { doc }) => {
    const v = STANDARD_METRICS.includes(name) ? doc[name] : doc.custom?.[name];
    return sum + (Number(v) || 0);
  }, 0);

  const appCounts = countBy(applications, 'status');
  const enrCounts = countBy(enrollments, 'status');
  const allMilestones = enrollments.flatMap((e) => e.milestones);

  return {
    title: 'Cohort End Report',
    subtitle: `${cohort.name} | ${f.date(cohort.startDate)} - ${f.date(cohort.endDate)}`,
    meta: incubatorMeta(incubator),
    sections: [
      {
        heading: 'Cohort',
        kv: [
          ['Program', cohort.program?.name],
          ['Status', f.label(cohort.status)],
          ['Objective', cohort.objective],
          ['Target startups', cohort.targetStartups?.count],
          ['Target sectors', (cohort.targetStartups?.sectors || []).map(f.label).join(', ') || 'All'],
          ['Target stages', (cohort.targetStartups?.stages || []).map(f.label).join(', ') || 'All'],
        ],
      },
      {
        heading: 'Selection',
        kv: [['Applications received', applications.length], ['Shortlisted', appCounts.shortlisted || 0], ['Accepted', appCounts.accepted || 0], ['Rejected', appCounts.rejected || 0]],
      },
      {
        heading: 'Outcome',
        kv: [
          ['Enrolled', enrollments.length],
          ['Graduated', enrCounts.graduated || 0],
          ['Exited (terminated)', enrCounts.exited || 0],
          ['Dropped (voluntary)', enrCounts.dropped || 0],
          ['Still active', enrCounts.active || 0],
          ['Milestone completion', f.pct(allMilestones.filter((m) => m.status === 'completed').length, allMilestones.length)],
          ['Agreements signed', `${enrollments.filter((e) => e.agreement.isSigned).length} / ${enrollments.length}`],
          ['Cohort events', events],
          ['Funds distributed', f.inr(Object.values(distributed).reduce((a, b) => a + b, 0))],
        ],
      },
      {
        heading: 'Startups',
        table: {
          columns: ['Startup', 'Sector', 'Status', 'Milestones', 'Agreement', 'Exit', 'Funds'],
          rows: enrollments.map((e) => [
            e.startup.name,
            f.label(e.startup.sector),
            f.label(e.status),
            `${e.milestones.filter((m) => m.status === 'completed').length}/${e.milestones.length}`,
            e.agreement.isSigned ? 'Signed' : 'Pending',
            e.exit?.type ? `${f.label(e.exit.type)} (${f.date(e.exit.date)})` : '-',
            f.inr(distributed[String(e.startup._id)] || 0),
          ]),
        },
      },
      { heading: 'Outcome Mapping', table: { columns: ['Outcome', 'Indicator', 'Target', 'Unit'], rows: cohort.outcomeMapping.map((o) => [o.outcome, o.indicator, o.target, o.unit]) } },
      {
        heading: 'Growth Metrics',
        table: {
          columns: ['Metric', 'Target', 'Actual (latest, all startups)', 'Unit'],
          rows: cohort.growthMetrics.map((m) => [m.name, m.target, actual(m.name), m.unit]),
        },
      },
      { heading: 'Achievements', table: achievementsTable(achievements) },
    ],
  };
};

// ---------------- Activity report (date range) ----------------
const activityReport = async ({ incubator, from, to }) => {
  const id = incubator._id;
  const period = { from, to };
  const [events, applications, onboarded, exits, campaigns, achievements, funding] = await Promise.all([
    Event.find({ incubator: id, status: { $in: ['published', 'completed'] }, ...inRange('startsAt', period) }).sort({ startsAt: 1 }),
    CohortApplication.countDocuments({ incubator: id, ...inRange('createdAt', period) }),
    Enrollment.find({ incubator: id, ...inRange('onboardedAt', period) }).populate('startup', 'name sector').populate('cohort', 'name'),
    Enrollment.countDocuments({ incubator: id, ...inRange('exit.date', period) }),
    EmailCampaign.find({ incubator: id, status: 'sent', ...inRange('sentAt', period) }).select('name sentAt stats'),
    Achievement.countDocuments({ incubator: id, ...inRange('date', period) }),
    sumFunding({ incubator: id, ...inRange('date', period) }),
  ]);
  const regRows = await EventRegistration.aggregate([
    { $match: { event: { $in: events.map((e) => e._id) }, status: { $ne: 'cancelled' } } },
    { $group: { _id: { event: '$event', status: '$status' }, n: { $sum: 1 } } },
  ]);
  const regs = (eventId, status) => regRows.filter((r) => r._id.event.equals(eventId) && (!status || r._id.status === status)).reduce((s, r) => s + r.n, 0);

  return {
    title: 'Activity Report',
    subtitle: `${f.date(from)} - ${f.date(to)}`,
    meta: incubatorMeta(incubator),
    sections: [
      {
        heading: 'Summary',
        kv: [
          ['Events conducted', events.length],
          ['Event registrations', events.reduce((s, e) => s + regs(e._id), 0)],
          ['Event attendance', events.reduce((s, e) => s + regs(e._id, 'attended'), 0)],
          ['Cohort applications received', applications],
          ['Startups onboarded', onboarded.length],
          ['Startup exits', exits],
          ['Email campaigns sent', campaigns.length],
          ['Achievements recorded', achievements],
          ['Funds distributed', f.inr(funding.distributed)],
        ],
      },
      {
        heading: 'Events',
        table: {
          columns: ['Event', 'Type', 'Date', 'Mode', 'Registered', 'Attended'],
          rows: events.map((e) => [e.title, f.label(e.type), f.date(e.startsAt), f.label(e.mode), regs(e._id), regs(e._id, 'attended')]),
        },
      },
      {
        heading: 'Startups Onboarded',
        table: { columns: ['Startup', 'Sector', 'Cohort', 'Onboarded'], rows: onboarded.map((e) => [e.startup.name, f.label(e.startup.sector), e.cohort?.name, f.date(e.onboardedAt)]) },
      },
      {
        heading: 'Email Campaigns',
        table: { columns: ['Campaign', 'Sent', 'Recipients', 'Delivered'], rows: campaigns.map((c) => [c.name, f.date(c.sentAt), c.stats.recipients, c.stats.delivered]) },
      },
    ],
  };
};

// ---------------- Internal compliance (financial year) ----------------
const internalCompliance = async ({ incubator, financialYear }) => {
  const id = incubator._id;
  const now = new Date();
  const [active, docs, records] = await Promise.all([
    Enrollment.find({ incubator: id, status: 'active' }).populate('startup', 'name').populate('cohort', 'name'),
    ComplianceDocument.find({ incubator: id, financialYear }).select('docType title status'),
    FinancialRecord.find({ incubator: id, financialYear }).select('entryType amount attachments'),
  ]);
  const unsigned = active.filter((e) => !e.agreement.isSigned);
  const overdue = active.flatMap((e) => e.milestones
    .filter((m) => m.dueDate && m.dueDate < now && m.status !== 'completed')
    .map((m) => [e.startup.name, e.cohort?.name, m.title, f.date(m.dueDate), f.label(m.status)]));
  const docCounts = countBy(docs, 'docType');
  const missingDocTypes = COMPLIANCE_DOC_TYPES.filter((t) => !docCounts[t]);
  const noAttachment = records.filter((r) => !r.attachments.length).length;

  return {
    title: 'Internal Compliance Report',
    subtitle: `Financial Year ${financialYear}`,
    meta: incubatorMeta(incubator),
    sections: [
      {
        heading: 'Compliance Checklist',
        kv: [
          ['Agreements signed (active startups)', `${active.length - unsigned.length} / ${active.length}`],
          ['Overdue milestones', overdue.length],
          ['Compliance documents on file', docs.length],
          ['Missing document types', missingDocTypes.map(f.label).join(', ') || 'None'],
          ['Financial entries this FY', records.length],
          ['Entries without supporting documents', noAttachment],
          ['Policies documented', incubator.policies.length || 'None - add policies to your profile'],
          ['Seats used', `${incubator.members.length} / ${incubator.seatLimit}`],
        ],
      },
      { heading: 'Unsigned Agreements', table: { columns: ['Startup', 'Cohort', 'Onboarded'], rows: unsigned.map((e) => [e.startup.name, e.cohort?.name, f.date(e.onboardedAt)]) } },
      { heading: 'Overdue Milestones', table: { columns: ['Startup', 'Cohort', 'Milestone', 'Due', 'Status'], rows: overdue } },
      { heading: 'Compliance Documents', table: { columns: ['Type', 'Title', 'Status'], rows: docs.map((d) => [f.label(d.docType), d.title, f.label(d.status)]) } },
      { heading: 'Policies', table: { columns: ['Policy', 'Document'], rows: incubator.policies.map((p) => [p.title, p.documentUrl ? 'Attached' : 'Not attached']) } },
    ],
  };
};

// ---------------- Dispatcher ----------------
const BUILDERS = {
  project_application: { build: projectApplication, needs: ['program'] },
  project_completion: { build: projectCompletion, needs: ['program'] },
  year_end: { build: yearEnd, needs: ['financialYear'] },
  cohort_end: { build: cohortEnd, needs: ['cohort'] },
  activity_report: { build: activityReport, needs: ['from', 'to'] },
  internal_compliance: { build: internalCompliance, needs: ['financialYear'] },
};

// params: { cohort?, program?, from?, to?, financialYear? } (ids for cohort / program)
const buildReport = async (type, incubator, params) => {
  const { build, needs } = BUILDERS[type];
  const missing = needs.filter((n) => !params[n]);
  if (missing.length) throw ApiError.badRequest(`${f.label(type)} report needs: ${missing.join(', ')}`);

  const ctx = { incubator, ...params };
  if (params.cohort) {
    ctx.cohort = await Cohort.findOne({ _id: params.cohort, incubator: incubator._id });
    if (!ctx.cohort) throw ApiError.badRequest('Cohort not found in your incubator');
  }
  if (params.program) {
    ctx.program = await Program.findOne({ _id: params.program, incubator: incubator._id });
    if (!ctx.program) throw ApiError.badRequest('Program not found in your incubator');
  }
  if (params.financialYear && !params.from) Object.assign(ctx, fyRange(params.financialYear));
  return build(ctx);
};

module.exports = { buildReport, BUILDERS, sumFinancial };
