const mongoose = require('mongoose');
const {
  Cohort, Enrollment, FundingTransaction, Startup, StartupMetric, FunnelEvent,
} = require('../models');
const { FUNNEL_STAGES } = require('../utils/constants');

const dateRange = (field, { from, to }) => (from || to
  ? { [field]: { ...(from && { $gte: from }), ...(to && { $lte: to }) } }
  : {});

// Startups the incubator has onboarded. scope: 'active' (currently incubated) or 'all' (incl. alumni)
const incubatedStartupIds = async (incubatorId, { scope = 'active', cohort } = {}) => {
  const filter = { incubator: incubatorId };
  if (scope === 'active') filter.status = 'active';
  if (cohort) filter.cohort = cohort;
  return Enrollment.distinct('startup', filter);
};

const sumByType = async (incubatorId, range) => {
  const rows = await FundingTransaction.aggregate([
    { $match: { incubator: incubatorId, ...dateRange('date', range) } },
    { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  const byType = Object.fromEntries(rows.map((r) => [r._id, { total: r.total, count: r.count }]));
  const get = (t) => byType[t] || { total: 0, count: 0 };
  return {
    fundRaised: get('ic_fund_raised'),
    fundDistributed: get('ic_fund_distributed'),
    externalFunding: get('external_funding'),
    availableBalance: get('ic_fund_raised').total - get('ic_fund_distributed').total,
  };
};

const sectorSplit = async (startupIds) => {
  const rows = await Startup.aggregate([
    { $match: { _id: { $in: startupIds } } },
    { $group: { _id: '$sector', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  return rows.map((r) => ({ sector: r._id, count: r.count }));
};

// Revenue per startup over the period (default: last 12 months) + their latest month
const revenueByStartup = async (startupIds, { from, to } = {}) => {
  const end = to || new Date();
  const start = from || new Date(end.getFullYear() - 1, end.getMonth() + 1, 1);
  const key = (d) => d.getFullYear() * 100 + d.getMonth() + 1;
  const periodKey = { $add: [{ $multiply: ['$period.year', 100] }, '$period.month'] };

  return StartupMetric.aggregate([
    { $match: { startup: { $in: startupIds } } },
    { $match: { $expr: { $and: [{ $gte: [periodKey, key(start)] }, { $lte: [periodKey, key(end)] }] } } },
    { $sort: { 'period.year': -1, 'period.month': -1 } },
    {
      $group: {
        _id: '$startup',
        totalRevenue: { $sum: '$revenue' },
        latestMonthRevenue: { $first: '$revenue' },
        latestPeriod: { $first: '$period' },
        monthsReported: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: 'startups', localField: '_id', foreignField: '_id', as: 'startup', pipeline: [{ $project: { name: 1, logo: 1, sector: 1 } }],
      },
    },
    { $unwind: '$startup' },
    { $sort: { totalRevenue: -1 } },
    {
      $project: {
        _id: 0, startup: 1, totalRevenue: 1, latestMonthRevenue: 1, latestPeriod: 1, monthsReported: 1,
      },
    },
  ]);
};

// Counts distinct people per stage; conversion is relative to the previous stage
const funnel = async (incubatorId, { from, to, cohort, source } = {}) => {
  const match = { incubator: incubatorId, ...dateRange('createdAt', { from, to }) };
  if (cohort) match.cohort = new mongoose.Types.ObjectId(String(cohort)); // aggregate() doesn't cast
  if (source) match.source = source;

  const [stageRows, sourceRows] = await Promise.all([
    FunnelEvent.aggregate([
      { $match: match },
      // anonymous views have no user: count each event once via sessionId / _id
      { $group: { _id: { stage: '$stage', who: { $ifNull: ['$user', { $ifNull: ['$sessionId', '$_id'] }] } } } },
      { $group: { _id: '$_id.stage', count: { $sum: 1 } } },
    ]),
    FunnelEvent.aggregate([
      { $match: match },
      { $group: { _id: { stage: '$stage', source: '$source' }, users: { $addToSet: '$user' } } },
      { $project: { _id: 0, stage: '$_id.stage', source: '$_id.source', count: { $size: '$users' } } },
    ]),
  ]);

  const counts = Object.fromEntries(stageRows.map((r) => [r._id, r.count]));
  const top = counts[FUNNEL_STAGES[0]] || 0;
  const stages = FUNNEL_STAGES.map((stage, i) => {
    const count = counts[stage] || 0;
    const prev = i === 0 ? null : counts[FUNNEL_STAGES[i - 1]] || 0;
    return {
      stage,
      count,
      conversionFromPrevious: prev ? Math.round((count / prev) * 1000) / 10 : null,
      conversionFromTop: top ? Math.round((count / top) * 1000) / 10 : null,
    };
  });

  const bySource = {};
  sourceRows.forEach(({ stage, source: src, count }) => {
    bySource[src || 'unknown'] = bySource[src || 'unknown'] || {};
    bySource[src || 'unknown'][stage] = count;
  });
  return { stages, bySource };
};

const getSummary = async (incubatorId, { scope, from, to }) => {
  const startupIds = await incubatedStartupIds(incubatorId, { scope });
  const [cohortRows, enrollmentRows, funding, sectors, revenue] = await Promise.all([
    Cohort.aggregate([{ $match: { incubator: incubatorId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Enrollment.aggregate([
      { $match: { incubator: incubatorId } },
      { $group: { _id: '$status', startups: { $addToSet: '$startup' } } },
      { $project: { count: { $size: '$startups' } } },
    ]),
    sumByType(incubatorId, { from, to }),
    sectorSplit(startupIds),
    revenueByStartup(startupIds, { from, to }),
  ]);

  const cohortsByStatus = Object.fromEntries(cohortRows.map((r) => [r._id, r.count]));
  const startupsByStatus = Object.fromEntries(enrollmentRows.map((r) => [r._id, r.count]));
  const totalStartups = (await incubatedStartupIds(incubatorId, { scope: 'all' })).length;

  return {
    cohorts: { total: Object.values(cohortsByStatus).reduce((a, b) => a + b, 0), byStatus: cohortsByStatus },
    startups: { total: totalStartups, active: startupsByStatus.active || 0, byStatus: startupsByStatus },
    funding,
    sectorBifurcation: sectors,
    revenue: {
      total: revenue.reduce((sum, r) => sum + r.totalRevenue, 0),
      byStartup: revenue,
    },
  };
};

module.exports = {
  incubatedStartupIds, getSummary, funnel, revenueByStartup, sectorSplit, sumByType,
};
