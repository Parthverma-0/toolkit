const { FunnelEvent } = require('../models');

// Records that a user reached a funnel stage for an incubator.
// Idempotent per (incubator, stage, user) so retries never double count.
// Never throws: analytics must not break the main request.
const track = async ({ incubator, stage, user, startup, cohort, source, campaign, event }) => {
  if (!incubator) return;
  try {
    const data = { startup, cohort, source, campaign, event };
    Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);

    if (!user) {
      await FunnelEvent.create({ incubator, stage, ...data });
      return;
    }
    await FunnelEvent.updateOne(
      { incubator, stage, user },
      { $setOnInsert: { incubator, stage, user, ...data } },
      { upsert: true },
    );
  } catch (err) {
    console.error(`Funnel tracking failed (${stage}): ${err.message}`);
  }
};

// Uses the signup attribution saved on the user
const trackForUser = (user, stage, extra = {}) => track({
  incubator: user.acquisition?.incubator,
  source: user.acquisition?.source,
  campaign: user.acquisition?.campaign,
  event: user.acquisition?.event,
  user: user._id,
  stage,
  ...extra,
});

module.exports = { track, trackForUser };
