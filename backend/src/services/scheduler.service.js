const { runDueCampaigns } = require('./campaign.service');

// Lightweight in-process scheduler (no extra infra). Campaign claims are atomic,
// so running several server instances is safe: each due campaign is sent once.
// Disable with SCHEDULER=off (e.g. when a separate worker runs it).
const JOBS = [
  { name: 'scheduled-campaigns', everyMs: 60 * 1000, run: runDueCampaigns },
];

const start = () => {
  if (process.env.SCHEDULER === 'off') return () => {};
  const timers = JOBS.map((job) => {
    let running = false;
    const tick = async () => {
      if (running) return; // previous run still sending
      running = true;
      try {
        const results = await job.run();
        if (results?.length) console.log(`[scheduler] ${job.name}: ${results.length} processed`);
      } catch (err) {
        console.error(`[scheduler] ${job.name} failed: ${err.message}`);
      } finally {
        running = false;
      }
    };
    const timer = setInterval(tick, job.everyMs);
    timer.unref();
    tick();
    return timer;
  });
  return () => timers.forEach(clearInterval);
};

module.exports = { start };
