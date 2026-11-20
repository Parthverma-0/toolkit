const O = require('../utils/investorOptions');

// How well a startup fits an investor's preferences, 0-100.
// Weights follow the spec: sector, stage, ticket size, location, business model.
//  - the investor left a dimension empty  -> full credit (no preference)
//  - the startup has not shared the data   -> half credit (unknown)
//  - otherwise full credit on a match, none on a miss (ticket size also has a "close" half credit)
const WEIGHTS = {
  sector: 30, stage: 25, ticket: 20, location: 15, model: 10,
};

const lower = (v) => String(v || '').trim().toLowerCase();

const sectorMatches = (investorSectors, startupSector) => {
  if (!startupSector) return null;
  return investorSectors.some((s) => {
    const mapped = O.SECTOR_TO_STARTUP[s];
    if (mapped) return mapped.includes(startupSector);
    // custom sector text: compare with the startup sector's name ("ai_ml" ~ "ai ml")
    return lower(s).replace(/[^a-z0-9]/g, '') === startupSector.replace(/[^a-z0-9]/g, '');
  });
};

const stageMatches = (investorStages, startupStage) => {
  if (!startupStage) return null;
  return investorStages.some((s) => (O.STAGE_TO_STARTUP[s] || []).includes(startupStage));
};

// Returns 1 (inside a range), 0.5 (within 2x of one) or 0
const ticketFit = (profile, ask) => {
  const ranges = (profile.ticketSizes || []).map((id) => O.TICKET_SIZES[id]).filter(Boolean);
  const custom = profile.customTicket;
  if (custom && (custom.min != null || custom.max != null)) ranges.push({ min: custom.min ?? 0, max: custom.max ?? null });
  return ranges.reduce((best, { min, max }) => {
    if (ask >= min && (max == null || ask <= max)) return 1;
    if (ask >= min / 2 && (max == null || ask <= max * 2)) return Math.max(best, 0.5);
    return best;
  }, 0);
};

const locationMatches = (investorLocations, address = {}) => {
  const country = lower(address.country || 'India');
  const place = `${lower(address.city)} ${lower(address.state)}`;
  if (!place.trim() && !address.country) return null;
  return investorLocations.some((loc) => {
    if (loc === 'across_india') return country === 'india';
    if (loc === 'international') return country !== 'india';
    const keywords = O.GEOGRAPHY_KEYWORDS[loc];
    if (keywords) return keywords.some((k) => place.includes(k));
    return lower(loc) && place.includes(lower(loc)); // custom place
  });
};

// `ask` is only passed when the founder lets investors see the funding requirement
const scoreMatch = (profile, startup, { ask } = {}) => {
  const reasons = [];
  let score = 0;

  const add = (key, fit, reason) => {
    score += WEIGHTS[key] * fit;
    if (fit === 1 && reason) reasons.push(reason);
  };

  // sector
  if (!profile.sectors?.length) add('sector', 1);
  else {
    const m = sectorMatches(profile.sectors, startup.sector);
    add('sector', m === null ? 0.5 : Number(m), 'Sector');
  }

  // stage
  if (!profile.stages?.length) add('stage', 1);
  else {
    const m = stageMatches(profile.stages, startup.stage);
    add('stage', m === null ? 0.5 : Number(m), 'Stage');
  }

  // ticket size
  const hasTicket = profile.ticketSizes?.some((t) => t !== 'flexible' && O.TICKET_SIZES[t])
    || profile.customTicket?.min != null || profile.customTicket?.max != null;
  if (!hasTicket || profile.ticketSizes?.includes('flexible')) add('ticket', 1);
  else if (!ask) add('ticket', 0.5);
  else add('ticket', ticketFit(profile, ask), 'Ticket size');

  // location
  if (!profile.locations?.length) add('location', 1);
  else {
    const m = locationMatches(profile.locations, startup.address);
    add('location', m === null ? 0.5 : Number(m), 'Location');
  }

  // business model
  if (!profile.businessModels?.length) add('model', 1);
  else add('model', startup.businessModel ? Number(profile.businessModels.includes(startup.businessModel)) : 0.5, 'Business model');

  return { score: Math.round(score), reasons };
};

module.exports = { scoreMatch, WEIGHTS };
