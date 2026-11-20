const {
  Startup, Founder, Incubator, InvestorProfile, InvestorShortlist, NetworkConnection, Notification,
} = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { pick } = require('../utils/object');
const { getPagination, paginationMeta } = require('../utils/pagination');
const { toPublicUrl, removeFile } = require('../services/storage.service');
const { sendPrivateFile } = require('../services/privateFile.service');
const { clearAuthCookies } = require('../services/token.service');
const { scoreMatch } = require('../services/investorMatch.service');
const { serializeOwnProfile, serializeStartupForInvestor } = require('../services/investorSerializer');

// Everything a person with the "investor" role does for themselves: profile, verification
// documents, discovering startups, shortlist, dashboard and settings. Connections, messages and
// notifications are shared with founders and live in network.controller.js.

const MAX_DOCUMENTS = 10;
const GOOD_MATCH = 60; // "matches your preferences" threshold
const RECOMMENDED_MIN = 50;

const PROFILE_FIELDS = [
  'contactEmail', 'designation', 'linkedin', 'location', 'country',
  'investorType', 'category', 'organisationName', 'organisationWebsite', 'organisationLinkedin', 'yearEstablished', 'headOffice',
  'sectors', 'stages', 'ticketSizes', 'customTicket', 'locations', 'businessModels', 'revenuePreferences', 'approaches', 'frequency', 'equityRanges',
  'professionalBackground', 'yearsOfExperience', 'previousInvestments', 'portfolio', 'expertise',
  'mentorshipAvailable', 'strategicSupport', 'networkingSupport', 'bio',
];

// ---------- helpers ----------

const profileIncomplete = () => ApiError.forbidden('Complete your investor profile to continue').withCode('PROFILE_INCOMPLETE');

// Investors reach the dashboard right after signing up. Browsing works without a profile (an
// unsaved blank one stands in); actions need the submitted profile and answer 403 PROFILE_INCOMPLETE,
// which makes the frontend open the "complete your profile" popup.
const browseProfile = async (req) => (await InvestorProfile.findOne({ user: req.user._id })) || new InvestorProfile({ user: req.user._id });

const loadProfile = async (req) => {
  const profile = await InvestorProfile.findOne({ user: req.user._id });
  if (!profile?.submittedAt) throw profileIncomplete();
  return profile;
};

// Mandatory fields from the spec. Returned as [{ field, message }] so the form can mark them.
const missingFields = (profile, user) => {
  const missing = [];
  const need = (ok, field, message) => { if (!ok) missing.push({ field, message }); };
  need(user.name?.trim(), 'fullName', 'Enter your full name');
  need(user.phone, 'phone', 'Enter your mobile number');
  need(profile.contactEmail || user.email, 'contactEmail', 'Enter your email address');
  need(profile.designation, 'designation', 'Enter your designation');
  need(profile.location, 'location', 'Enter your city');
  need(profile.country, 'country', 'Enter your country');
  need(profile.investorType, 'investorType', 'Choose an investor type');
  need(profile.category, 'category', 'Choose an investor category');
  if (profile.category === 'organisation') need(profile.organisationName, 'organisationName', 'Enter your organisation or firm name');
  need(profile.sectors?.length, 'sectors', 'Pick at least one sector');
  need(profile.stages?.length, 'stages', 'Pick at least one investment stage');
  const hasTicket = profile.ticketSizes?.length || profile.customTicket?.min != null || profile.customTicket?.max != null;
  need(hasTicket, 'ticketSizes', 'Choose a ticket size or enter a custom amount');
  need(profile.locations?.length, 'locations', 'Pick at least one location');
  return missing;
};

const listedFilter = () => ({ isProfileComplete: true, 'investorVisibility.listed': { $ne: false } });

const groupBy = (items, keyOf) => items.reduce((acc, item) => {
  const key = String(keyOf(item));
  (acc[key] ||= []).push(item);
  return acc;
}, {});

// Cards for a page of startups: founders, incubator, this investor's shortlist / connection, match score
const decorateStartups = async (startups, profile, userId, { detail = false } = {}) => {
  if (!startups.length) return [];
  const ids = startups.map((s) => s._id);
  const incubatorIds = [...new Set(startups.map((s) => s.incubator).filter(Boolean).map(String))];
  const [founders, shortlist, connections, incubators] = await Promise.all([
    Founder.find({ startup: { $in: ids } }).sort({ isPrimary: -1 }),
    InvestorShortlist.find({ investor: userId, startup: { $in: ids } }).select('startup'),
    NetworkConnection.find({ investor: userId, startup: { $in: ids } }).select('startup status initiatedBy'),
    incubatorIds.length ? Incubator.find({ _id: { $in: incubatorIds } }).select('name') : [],
  ]);
  const foundersBy = groupBy(founders, (f) => f.startup);
  const shortlisted = new Set(shortlist.map((s) => String(s.startup)));
  const connBy = Object.fromEntries(connections.map((c) => [String(c.startup), c]));
  const incubatorBy = Object.fromEntries(incubators.map((i) => [String(i._id), i]));

  const matching = Boolean(profile.submittedAt); // no preferences yet = nothing to match against
  return startups.map((s) => {
    const conn = connBy[String(s._id)];
    const visibleAsk = s.investorVisibility?.showFundingAsk !== false ? s.fundingAsk : undefined;
    return serializeStartupForInvestor(s, {
      founders: foundersBy[String(s._id)] || [],
      incubator: incubatorBy[String(s.incubator)],
      shortlisted: shortlisted.has(String(s._id)),
      connection: conn ? { id: conn._id, status: conn.status, initiatedBy: conn.initiatedBy } : null,
      match: matching ? scoreMatch(profile, s, { ask: visibleAsk }) : null,
      detail,
      connected: conn?.status === 'accepted',
    });
  });
};

// Query -> Mongo filter for the discovery page. Hidden details (revenue, funding) are never
// filterable, otherwise a filter could reveal what a founder chose not to share.
const discoverFilter = (query) => {
  const filter = listedFilter();
  const and = [];
  if (query.q) {
    const rx = new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    and.push({ $or: [{ name: rx }, { tagline: rx }, { problemStatement: rx }, { solution: rx }] });
  }
  if (query.sector?.length) filter.sector = { $in: query.sector };
  if (query.stage?.length) filter.stage = { $in: query.stage };
  if (query.businessModel?.length) filter.businessModel = { $in: query.businessModel };
  if (query.revenueStatus?.length) {
    filter.revenueStatus = { $in: query.revenueStatus };
    filter['investorVisibility.showRevenue'] = true;
  }
  if (query.fundingStatus?.length) {
    filter.fundingStatus = { $in: query.fundingStatus };
    filter['investorVisibility.showFundingAsk'] = { $ne: false };
  }
  if (query.fundingMin != null || query.fundingMax != null) {
    filter.fundingAsk = {
      ...(query.fundingMin != null && { $gte: query.fundingMin }),
      ...(query.fundingMax != null && { $lte: query.fundingMax }),
    };
    filter['investorVisibility.showFundingAsk'] = { $ne: false };
  }
  if (query.location) {
    const rx = new RegExp(query.location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    and.push({ $or: [{ 'address.city': rx }, { 'address.state': rx }] });
  }
  if (query.incubated === true) filter.incubator = { $exists: true, $ne: null };
  if (query.incubated === false) and.push({ $or: [{ incubator: { $exists: false } }, { incubator: null }] });
  if (query.ageMin != null || query.ageMax != null) {
    const yearsAgo = (y) => new Date(Date.now() - y * 365.25 * 86400000);
    filter.foundedOn = {
      ...(query.ageMin != null && { $lte: yearsAgo(query.ageMin) }),
      ...(query.ageMax != null && { $gte: yearsAgo(query.ageMax) }),
    };
  }
  if (and.length) filter.$and = and;
  return filter;
};

// ---------- profile ----------

// GET /api/investor-portal/me/profile
const getMyProfile = asyncHandler(async (req, res) => {
  const profile = await InvestorProfile.findOne({ user: req.user._id });
  res.json({ success: true, data: profile ? serializeOwnProfile(profile, req.user) : null });
});

// PUT /api/investor-portal/me/profile  (multipart, optional `photo` + `organisationLogo`)
// Creates or updates. The mandatory fields are checked on the merged result, so the onboarding
// form can send everything at once and later edits can send only what changed.
const upsertMyProfile = asyncHandler(async (req, res) => {
  const profile = (await InvestorProfile.findOne({ user: req.user._id })) || new InvestorProfile({ user: req.user._id });
  const oldPhoto = profile.photo;
  const oldLogo = profile.organisationLogo;

  const updates = pick(req.body, PROFILE_FIELDS);
  profile.set(updates);
  if (updates.customTicket && updates.customTicket.min == null && updates.customTicket.max == null) profile.customTicket = undefined;
  const photo = req.files?.photo?.[0];
  const logo = req.files?.organisationLogo?.[0];
  if (photo) profile.photo = toPublicUrl(photo);
  if (logo) profile.organisationLogo = toPublicUrl(logo);
  if (!profile.contactEmail) profile.contactEmail = req.user.email;

  if (req.body.fullName) req.user.name = req.body.fullName;
  if (req.body.phone) {
    if (req.body.phone !== req.user.phone) req.user.isPhoneVerified = false;
    req.user.phone = req.body.phone;
  }

  const missing = missingFields(profile, req.user);
  if (missing.length) throw ApiError.badRequest('Complete the required fields', missing);

  const firstSubmit = !profile.submittedAt;
  if (firstSubmit) {
    profile.submittedAt = new Date();
    profile.verification = { status: 'pending' };
  }
  await Promise.all([profile.save(), req.user.save()]);

  if (photo && oldPhoto) await removeFile(oldPhoto);
  if (logo && oldLogo) await removeFile(oldLogo);
  res.status(firstSubmit ? 201 : 200).json({ success: true, data: serializeOwnProfile(profile, req.user) });
});

// PATCH /api/investor-portal/me/settings  { visibility?, showTicketSize?, notificationPrefs? }
const updateSettings = asyncHandler(async (req, res) => {
  const profile = await loadProfile(req);
  const { visibility, showTicketSize, notificationPrefs } = req.body;
  if (visibility !== undefined) profile.visibility = visibility;
  if (showTicketSize !== undefined) profile.showTicketSize = showTicketSize;
  if (notificationPrefs) Object.entries(notificationPrefs).forEach(([k, v]) => profile.set(`notificationPrefs.${k}`, v));
  await profile.save();
  res.json({ success: true, data: serializeOwnProfile(profile, req.user) });
});

// POST /api/investor-portal/me/resubmit  (after a rejection / "more information required")
const resubmit = asyncHandler(async (req, res) => {
  const profile = await loadProfile(req);
  if (!['rejected', 'info_required'].includes(profile.verification.status)) {
    throw ApiError.badRequest('Your profile is not waiting for changes');
  }
  profile.verification.status = 'pending';
  profile.verification.reviewedAt = undefined;
  await profile.save();
  res.json({ success: true, data: serializeOwnProfile(profile, req.user) });
});

// POST /api/investor-portal/me/deactivate  { confirm: true }
// The account is closed (hidden from founders, sign-in disabled until the next Google sign-in).
const deactivate = asyncHandler(async (req, res) => {
  req.user.status = 'deactivated';
  await req.user.save();
  clearAuthCookies(res);
  res.json({ success: true, message: 'Your account has been deactivated. Sign in again any time to reactivate it.' });
});

// ---------- documents (private) ----------

// POST /api/investor-portal/me/documents  (multipart: `file`, type, name?)
const addDocument = asyncHandler(async (req, res) => {
  const profile = await loadProfile(req);
  const file = req.files?.file?.[0];
  if (!file) throw ApiError.badRequest('Choose a file to upload');
  if (profile.documents.length >= MAX_DOCUMENTS) throw ApiError.badRequest(`You can upload up to ${MAX_DOCUMENTS} documents`);

  profile.documents.push({
    type: req.body.type,
    name: req.body.name || file.originalname,
    url: toPublicUrl(file),
    mimetype: file.mimetype,
    size: file.size,
  });
  await profile.save();
  res.status(201).json({ success: true, data: serializeOwnProfile(profile, req.user).documents });
});

// DELETE /api/investor-portal/me/documents/:docId
const removeDocument = asyncHandler(async (req, res) => {
  const profile = await loadProfile(req);
  const doc = profile.documents.id(req.params.docId);
  if (!doc) throw ApiError.notFound('Document not found');
  const { url } = doc;
  doc.deleteOne();
  await profile.save();
  await removeFile(url);
  res.json({ success: true, data: serializeOwnProfile(profile, req.user).documents });
});

// GET /api/investor-portal/me/documents/:docId/file  (opens the file; owner only)
const openDocument = asyncHandler(async (req, res) => {
  const profile = await loadProfile(req);
  const doc = profile.documents.id(req.params.docId);
  if (!doc) throw ApiError.notFound('Document not found');
  sendPrivateFile(res, doc);
});

// ---------- discovery ----------

// GET /api/investor-portal/startups?q=&sector=a,b&stage=&businessModel=&revenueStatus=&fundingStatus=&location=
//   &incubated=&fundingMin=&fundingMax=&ageMin=&ageMax=&sort=newest|match&page=&limit=
const discoverStartups = asyncHandler(async (req, res) => {
  const profile = await browseProfile(req);
  const pagination = getPagination(req.query, { defaultLimit: 12, maxLimit: 48 });
  const filter = discoverFilter(req.query);

  if (req.query.sort === 'match' && profile.submittedAt) {
    // Scoring happens in memory, so rank a bounded pool of the newest startups
    const pool = await Startup.find(filter).sort({ createdAt: -1 }).limit(500);
    const cards = await decorateStartups(pool, profile, req.user._id);
    cards.sort((a, b) => b.match.score - a.match.score);
    return res.json({
      success: true,
      data: cards.slice(pagination.skip, pagination.skip + pagination.limit),
      pagination: paginationMeta(pagination, cards.length),
    });
  }

  const [items, total] = await Promise.all([
    Startup.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit),
    Startup.countDocuments(filter),
  ]);
  res.json({
    success: true,
    data: await decorateStartups(items, profile, req.user._id),
    pagination: paginationMeta(pagination, total),
  });
});

// GET /api/investor-portal/startups/recommended?minScore=50
const recommendedStartups = asyncHandler(async (req, res) => {
  const profile = await browseProfile(req);
  if (!profile.submittedAt) return res.json({ success: true, data: [], pagination: paginationMeta(getPagination(req.query), 0) });
  const pagination = getPagination(req.query, { defaultLimit: 12, maxLimit: 48 });
  const minScore = req.query.minScore ?? RECOMMENDED_MIN;
  const pool = await Startup.find(listedFilter()).sort({ createdAt: -1 }).limit(500);
  const cards = (await decorateStartups(pool, profile, req.user._id))
    .filter((c) => c.match.score >= minScore)
    .sort((a, b) => b.match.score - a.match.score);
  res.json({
    success: true,
    data: cards.slice(pagination.skip, pagination.skip + pagination.limit),
    pagination: paginationMeta(pagination, cards.length),
  });
});

// GET /api/investor-portal/startups/:startupId
const getStartup = asyncHandler(async (req, res) => {
  const profile = await browseProfile(req);
  const startup = await Startup.findOne({ _id: req.params.startupId, ...listedFilter() });
  if (!startup) throw ApiError.notFound('Startup not found');
  const [card] = await decorateStartups([startup], profile, req.user._id, { detail: true });
  const note = await InvestorShortlist.findOne({ investor: req.user._id, startup: startup._id }).select('note');
  res.json({ success: true, data: { ...card, note: note?.note || '' } });
});

// ---------- shortlist ----------

// GET /api/investor-portal/shortlist
const listShortlist = asyncHandler(async (req, res) => {
  const profile = await browseProfile(req);
  const entries = await InvestorShortlist.find({ investor: req.user._id }).sort({ createdAt: -1 });
  const startups = await Startup.find({ _id: { $in: entries.map((e) => e.startup) } });
  const cards = await decorateStartups(startups, profile, req.user._id);
  const cardBy = Object.fromEntries(cards.map((c) => [String(c.id), c]));
  const data = entries
    .filter((e) => cardBy[String(e.startup)]) // startups that were deleted drop out
    .map((e) => ({ ...cardBy[String(e.startup)], note: e.note || '', savedAt: e.createdAt }));
  res.json({ success: true, data });
});

// PUT /api/investor-portal/shortlist/:startupId  { note? }  (add, or update the private note)
const saveToShortlist = asyncHandler(async (req, res) => {
  await loadProfile(req);
  if (!(await Startup.exists({ _id: req.params.startupId, ...listedFilter() }))) throw ApiError.notFound('Startup not found');
  const update = { investor: req.user._id, startup: req.params.startupId };
  if (req.body.note !== undefined) update.note = req.body.note;
  const entry = await InvestorShortlist.findOneAndUpdate(
    { investor: req.user._id, startup: req.params.startupId },
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  res.json({ success: true, data: { startup: entry.startup, note: entry.note || '', savedAt: entry.createdAt } });
});

// DELETE /api/investor-portal/shortlist/:startupId
const removeFromShortlist = asyncHandler(async (req, res) => {
  await InvestorShortlist.deleteOne({ investor: req.user._id, startup: req.params.startupId });
  res.json({ success: true, message: 'Removed from shortlist' });
});

// ---------- dashboard ----------

// GET /api/investor-portal/dashboard
const getDashboard = asyncHandler(async (req, res) => {
  const profile = await browseProfile(req);

  const me = req.user._id;
  const [totalStartups, sent, received, shortlisted, activeConversations, unread, notifications, pool] = await Promise.all([
    Startup.countDocuments(listedFilter()),
    NetworkConnection.countDocuments({ investor: me, initiatedBy: 'investor', status: 'pending' }),
    NetworkConnection.countDocuments({ investor: me, initiatedBy: 'startup', status: 'pending' }),
    InvestorShortlist.countDocuments({ investor: me }),
    NetworkConnection.countDocuments({ investor: me, status: 'accepted', lastMessageAt: { $exists: true } }),
    Notification.countDocuments({ user: me, readAt: { $exists: false } }),
    Notification.find({ user: me }).sort({ createdAt: -1 }).limit(6),
    Startup.find(listedFilter()).sort({ createdAt: -1 }).limit(300),
  ]);

  const cards = await decorateStartups(pool, profile, me);
  const recentCutoff = Date.now() - 14 * 86400000;
  const matching = cards.filter((c) => c.match && c.match.score >= GOOD_MATCH);
  const newMatching = pool.filter((s, i) => s.createdAt.getTime() >= recentCutoff && cards[i].match?.score >= GOOD_MATCH).length;

  res.json({
    success: true,
    data: {
      verification: profile.submittedAt ? profile.verification : null,
      cards: {
        totalStartups, newMatching, requestsSent: sent, requestsReceived: received, shortlisted, activeConversations,
      },
      matchingTotal: matching.length,
      recommended: [...matching].sort((a, b) => b.match.score - a.match.score).slice(0, 3),
      notifications,
      unreadNotifications: unread,
    },
  });
});


module.exports = {
  getMyProfile,
  upsertMyProfile,
  updateSettings,
  resubmit,
  deactivate,
  addDocument,
  removeDocument,
  openDocument,
  discoverStartups,
  recommendedStartups,
  getStartup,
  listShortlist,
  saveToShortlist,
  removeFromShortlist,
  getDashboard,
};
