const { StartupMetric } = require('../models');

const VALUE_FIELDS = ['revenue', 'expenses', 'customers', 'employees'];

// One document per startup per month; re-submitting a month updates it
const upsertMonthlyMetric = async ({
  startupId, cohortId, month, year, values, custom, userId,
}) => {
  const $set = { recordedBy: userId };
  VALUE_FIELDS.forEach((f) => { if (values[f] !== undefined) $set[f] = values[f]; });
  if (cohortId) $set.cohort = cohortId;
  Object.entries(custom || {}).forEach(([k, v]) => { $set[`custom.${k}`] = v; });

  return StartupMetric.findOneAndUpdate(
    { startup: startupId, 'period.month': month, 'period.year': year },
    { $set, $setOnInsert: { startup: startupId, period: { month, year } } },
    { new: true, upsert: true, runValidators: true },
  );
};

const listMetrics = (startupId, { from, to } = {}) => {
  const filter = { startup: startupId };
  const key = (y, m) => y * 100 + m;
  const and = [];
  if (from) and.push({ $gte: [{ $add: [{ $multiply: ['$period.year', 100] }, '$period.month'] }, key(from.year, from.month)] });
  if (to) and.push({ $lte: [{ $add: [{ $multiply: ['$period.year', 100] }, '$period.month'] }, key(to.year, to.month)] });
  if (and.length) filter.$expr = { $and: and };
  return StartupMetric.find(filter).sort({ 'period.year': 1, 'period.month': 1 });
};

module.exports = { upsertMonthlyMetric, listMetrics };
