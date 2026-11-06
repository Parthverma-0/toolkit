const mongoose = require('mongoose');
const { Enrollment, FundingTransaction, Achievement } = require('../models');

// aggregate() doesn't cast strings to ObjectId like find() does
const oid = (v) => new mongoose.Types.ObjectId(String(v));

// "Startup database" for an incubator: every startup it has onboarded,
// filterable by cohort, program, onboarding date, funding support and achievements.
const searchStartups = async (incubatorId, filters, { skip, limit }) => {
  const {
    cohort, program, status, onboardedFrom, onboardedTo, fundingType, achievementType, sector, stage, q,
  } = filters;

  const match = { incubator: incubatorId };
  if (cohort) match.cohort = oid(cohort);
  if (program) match.program = oid(program);
  if (status) match.status = status;
  if (onboardedFrom || onboardedTo) {
    match.onboardedAt = { ...(onboardedFrom && { $gte: onboardedFrom }), ...(onboardedTo && { $lte: onboardedTo }) };
  }

  // Funding / achievement filters narrow the startup set first
  const startupSets = [];
  if (fundingType) {
    startupSets.push(await FundingTransaction.distinct('startup', {
      incubator: incubatorId, startup: { $ne: null }, ...(fundingType !== 'any' && { type: fundingType }),
    }));
  }
  if (achievementType) {
    startupSets.push(await Achievement.distinct('startup', achievementType === 'any' ? {} : { type: achievementType }));
  }
  if (startupSets.length) {
    const [first, ...rest] = startupSets.map((ids) => ids.map(String));
    const intersection = first.filter((id) => rest.every((set) => set.includes(id)));
    match.startup = { $in: intersection.map(oid) };
  }

  const startupMatch = {};
  if (sector) startupMatch['startup.sector'] = sector;
  if (stage) startupMatch['startup.stage'] = stage;
  if (q) startupMatch['startup.name'] = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };

  const [result] = await Enrollment.aggregate([
    { $match: match },
    { $sort: { onboardedAt: -1 } },
    // A startup may have several enrollments (cohorts) with this incubator
    {
      $group: {
        _id: '$startup',
        latestEnrollment: { $first: { _id: '$_id', cohort: '$cohort', program: '$program', status: '$status', onboardedAt: '$onboardedAt' } },
        cohorts: { $push: '$cohort' },
        firstOnboardedAt: { $min: '$onboardedAt' },
      },
    },
    {
      $lookup: {
        from: 'startups',
        localField: '_id',
        foreignField: '_id',
        as: 'startup',
        pipeline: [{ $project: { name: 1, logo: 1, sector: 1, stage: 1, startupEmail: 1, website: 1 } }],
      },
    },
    { $unwind: '$startup' },
    { $match: startupMatch },
    { $lookup: { from: 'cohorts', localField: 'latestEnrollment.cohort', foreignField: '_id', as: 'cohort', pipeline: [{ $project: { name: 1 } }] } },
    { $lookup: { from: 'programs', localField: 'latestEnrollment.program', foreignField: '_id', as: 'program', pipeline: [{ $project: { name: 1 } }] } },
    {
      $lookup: {
        from: 'fundingtransactions',
        let: { sid: '$_id' },
        as: 'funding',
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ['$startup', '$$sid'] }, { $eq: ['$incubator', incubatorId] }] } } },
          { $group: { _id: '$type', total: { $sum: '$amount' } } },
        ],
      },
    },
    { $lookup: { from: 'achievements', localField: '_id', foreignField: 'startup', as: 'achievements', pipeline: [{ $count: 'n' }] } },
    {
      $project: {
        _id: 0,
        startup: 1,
        latestEnrollment: 1,
        cohort: { $first: '$cohort' },
        program: { $first: '$program' },
        cohortCount: { $size: '$cohorts' },
        firstOnboardedAt: 1,
        funding: { $arrayToObject: { $map: { input: '$funding', in: { k: '$$this._id', v: '$$this.total' } } } },
        achievements: { $ifNull: [{ $first: '$achievements.n' }, 0] },
      },
    },
    { $sort: { firstOnboardedAt: -1 } },
    { $facet: { items: [{ $skip: skip }, { $limit: limit }], total: [{ $count: 'n' }] } },
  ]);

  return { items: result.items, total: result.total[0]?.n || 0 };
};

module.exports = { searchStartups };
