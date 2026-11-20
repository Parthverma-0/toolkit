const {
  User, InvestorProfile, InvestorShortlist, NetworkConnection, ConnectionMessage, ProfileReport,
} = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getPagination, paginationMeta } = require('../utils/pagination');
const { notify, announceToInvestors } = require('../services/notification.service');
const { sendPrivateFile } = require('../services/privateFile.service');
const { serializeOwnProfile } = require('../services/investorSerializer');

// Admin management of registered investors (users with role "investor"): verification,
// moderation, distribution stats, exports, connection monitoring and reported profiles.

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const loadProfile = async (id) => {
  const profile = await InvestorProfile.findById(id);
  const user = profile && await User.findById(profile.user);
  if (!user) throw ApiError.notFound('Investor not found');
  return { profile, user };
};

// Query -> profile filter shared by the list and the CSV export
const listFilter = async (query) => {
  const filter = { submittedAt: { $exists: true } };
  if (query.status) filter['verification.status'] = query.status;
  if (query.type) filter.investorType = query.type;
  if (query.category) filter.category = query.category;
  if (query.sector) filter.sectors = query.sector;
  if (query.featured !== undefined) filter.isFeatured = query.featured;
  if (query.q) {
    const rx = new RegExp(escapeRegex(query.q), 'i');
    const userIds = await User.find({ role: 'investor', $or: [{ name: rx }, { email: rx }] }).distinct('_id');
    filter.$or = [{ user: { $in: userIds } }, { organisationName: rx }, { location: rx }];
  }
  return filter;
};

const summary = (profile, user) => ({
  id: profile._id,
  userId: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  photo: profile.photo || user.avatar,
  designation: profile.designation,
  organisationName: profile.organisationName,
  investorType: profile.investorType,
  category: profile.category,
  location: profile.location,
  country: profile.country,
  sectors: profile.sectors,
  verification: profile.verification,
  documentCount: profile.documents.length,
  isFeatured: profile.isFeatured,
  accountStatus: user.status,
  submittedAt: profile.submittedAt,
  lastLoginAt: user.lastLoginAt,
});

// GET /api/admin/investor-network/stats
const getStats = asyncHandler(async (req, res) => {
  const submitted = { submittedAt: { $exists: true } };
  const distribution = (field, unwind) => InvestorProfile.aggregate([
    { $match: submitted },
    ...(unwind ? [{ $unwind: `$${field}` }] : []),
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 15 },
  ]);
  const toMap = (rows) => rows.filter((r) => r._id).map((r) => ({ id: r._id, count: r.count }));

  const [total, byStatus, byCategory, byType, bySector, byLocation, connections, accepted, openReports, featured, onboarding] = await Promise.all([
    InvestorProfile.countDocuments(submitted),
    distribution('verification.status'),
    distribution('category'),
    distribution('investorType'),
    distribution('sectors', true),
    distribution('location'),
    NetworkConnection.countDocuments(),
    NetworkConnection.countDocuments({ status: 'accepted' }),
    ProfileReport.countDocuments({ status: 'open' }),
    InvestorProfile.countDocuments({ ...submitted, isFeatured: true }),
    User.countDocuments({ role: 'investor', status: { $ne: 'deactivated' } }),
  ]);
  const statusCounts = Object.fromEntries(toMap(byStatus).map((r) => [r.id, r.count]));

  res.json({
    success: true,
    data: {
      totalInvestors: total,
      registeredAccounts: onboarding, // includes people who have not finished their profile yet
      verified: statusCounts.verified || 0,
      pending: statusCounts.pending || 0,
      rejected: statusCounts.rejected || 0,
      infoRequired: statusCounts.info_required || 0,
      featured,
      totalConnections: connections,
      acceptedConnections: accepted,
      openReports,
      categories: toMap(byCategory),
      types: toMap(byType),
      sectors: toMap(bySector),
      locations: toMap(byLocation),
    },
  });
});

// GET /api/admin/investor-network/investors?status=&type=&category=&sector=&featured=&q=
const listInvestors = asyncHandler(async (req, res) => {
  const pagination = getPagination(req.query, { defaultLimit: 25, maxLimit: 100 });
  const filter = await listFilter(req.query);
  const [profiles, total] = await Promise.all([
    InvestorProfile.find(filter).sort({ 'verification.status': 1, submittedAt: -1 }).skip(pagination.skip).limit(pagination.limit),
    InvestorProfile.countDocuments(filter),
  ]);
  const users = await User.find({ _id: { $in: profiles.map((p) => p.user) } });
  res.json({
    success: true,
    data: profiles.map((p) => summary(p, users.find((u) => u._id.equals(p.user)))).filter((s) => s.name),
    pagination: paginationMeta(pagination, total),
  });
});

// GET /api/admin/investor-network/investors/:id  (full profile + documents list + activity)
const getInvestor = asyncHandler(async (req, res) => {
  const { profile, user } = await loadProfile(req.params.id);
  const [sent, received, accepted, shortlisted, messages, openReports, recent] = await Promise.all([
    NetworkConnection.countDocuments({ investor: user._id, initiatedBy: 'investor' }),
    NetworkConnection.countDocuments({ investor: user._id, initiatedBy: 'startup' }),
    NetworkConnection.countDocuments({ investor: user._id, status: 'accepted' }),
    InvestorShortlist.countDocuments({ investor: user._id }),
    ConnectionMessage.countDocuments({ sender: user._id }),
    ProfileReport.countDocuments({ investor: profile._id, status: 'open' }),
    NetworkConnection.find({ investor: user._id }).sort({ updatedAt: -1 }).limit(10).populate('startup', 'name'),
  ]);
  res.json({
    success: true,
    data: {
      ...serializeOwnProfile(profile, user),
      userId: user._id,
      lastLoginAt: user.lastLoginAt,
      registeredAt: user.createdAt,
      activity: {
        requestsSent: sent, requestsReceived: received, accepted, shortlisted, messagesSent: messages, openReports,
      },
      recentConnections: recent.map((c) => ({
        id: c._id, startup: c.startup?.name, status: c.status, initiatedBy: c.initiatedBy, createdAt: c.createdAt,
      })),
    },
  });
});

// PATCH /api/admin/investor-network/investors/:id/verification  { status, note? }
const setVerification = asyncHandler(async (req, res) => {
  const { profile, user } = await loadProfile(req.params.id);
  const { status, note } = req.body;
  profile.verification = {
    status, note: note || undefined, reviewedBy: req.user._id, reviewedAt: new Date(),
  };
  await profile.save();

  const messages = {
    verified: ['Your investor profile is verified', 'You can now connect with founders.'],
    rejected: ['Your investor profile was not approved', note],
    info_required: ['More information is needed to verify your profile', note],
  };
  if (messages[status]) {
    await notify(user._id, {
      type: 'verification', title: messages[status][0], body: messages[status][1], link: '/investor/settings?tab=verification',
    });
  }
  res.json({ success: true, data: summary(profile, user) });
});

// PATCH /api/admin/investor-network/investors/:id/feature  { isFeatured }
const setFeatured = asyncHandler(async (req, res) => {
  const { profile, user } = await loadProfile(req.params.id);
  profile.isFeatured = req.body.isFeatured;
  await profile.save();
  res.json({ success: true, data: summary(profile, user) });
});

// GET /api/admin/investor-network/investors/:id/documents/:docId/file
const openDocument = asyncHandler(async (req, res) => {
  const { profile } = await loadProfile(req.params.id);
  const doc = profile.documents.id(req.params.docId);
  if (!doc) throw ApiError.notFound('Document not found');
  sendPrivateFile(res, doc);
});

// GET /api/admin/investor-network/export  (same filters as the list; CSV, admins only)
const csvCell = (value) => {
  const text = Array.isArray(value) ? value.join('; ') : String(value ?? '');
  // Leading = + - @ can be executed as a formula by spreadsheet apps
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

const exportInvestors = asyncHandler(async (req, res) => {
  const filter = await listFilter(req.query);
  const profiles = await InvestorProfile.find(filter).sort({ submittedAt: -1 }).limit(5000);
  const users = await User.find({ _id: { $in: profiles.map((p) => p.user) } });

  const columns = [
    ['Name', (p, u) => u.name], ['Email', (p, u) => u.email], ['Mobile', (p, u) => u.phone],
    ['Designation', (p) => p.designation], ['Investor type', (p) => p.investorType], ['Category', (p) => p.category],
    ['Organisation', (p) => p.organisationName], ['City', (p) => p.location], ['Country', (p) => p.country],
    ['Sectors', (p) => p.sectors], ['Stages', (p) => p.stages], ['Ticket sizes', (p) => p.ticketSizes],
    ['Verification', (p) => p.verification.status], ['Featured', (p) => (p.isFeatured ? 'yes' : 'no')],
    ['Account status', (p, u) => u.status], ['Submitted', (p) => p.submittedAt?.toISOString().slice(0, 10)],
    ['Last login', (p, u) => u.lastLoginAt?.toISOString().slice(0, 10)],
  ];
  const lines = [columns.map(([h]) => csvCell(h)).join(',')];
  profiles.forEach((p) => {
    const user = users.find((u) => u._id.equals(p.user));
    if (user) lines.push(columns.map(([, get]) => csvCell(get(p, user))).join(','));
  });

  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="investors-${new Date().toISOString().slice(0, 10)}.csv"`,
  });
  res.send(`﻿${lines.join('\r\n')}`);
});

// GET /api/admin/investor-network/connections?status=  (all investor-founder connections)
const listConnections = asyncHandler(async (req, res) => {
  const pagination = getPagination(req.query, { defaultLimit: 25, maxLimit: 100 });
  const filter = req.query.status ? { status: req.query.status } : {};
  const [conns, total] = await Promise.all([
    NetworkConnection.find(filter).sort({ updatedAt: -1 }).skip(pagination.skip).limit(pagination.limit)
      .populate('investor', 'name email').populate('startup', 'name'),
    NetworkConnection.countDocuments(filter),
  ]);
  res.json({
    success: true,
    data: conns.map((c) => ({
      id: c._id,
      investor: c.investor && { id: c.investor._id, name: c.investor.name, email: c.investor.email },
      startup: c.startup && { id: c.startup._id, name: c.startup.name },
      initiatedBy: c.initiatedBy,
      status: c.status,
      createdAt: c.createdAt,
      respondedAt: c.respondedAt,
      lastMessageAt: c.lastMessageAt,
    })),
    pagination: paginationMeta(pagination, total),
  });
});

// GET /api/admin/investor-network/reports?status=open
const listReports = asyncHandler(async (req, res) => {
  const filter = { status: req.query.status || 'open' };
  const reports = await ProfileReport.find(filter).sort({ createdAt: -1 }).limit(200)
    .populate('reportedBy', 'name email').populate({ path: 'investor', select: 'user organisationName' });
  const users = await User.find({ _id: { $in: reports.map((r) => r.investor?.user).filter(Boolean) } }).select('name email');
  res.json({
    success: true,
    data: reports.map((r) => {
      const investorUser = users.find((u) => r.investor && u._id.equals(r.investor.user));
      return {
        id: r._id,
        investorId: r.investor?._id,
        investorName: investorUser?.name,
        organisationName: r.investor?.organisationName,
        reportedBy: r.reportedBy && { name: r.reportedBy.name, email: r.reportedBy.email },
        reason: r.reason,
        details: r.details,
        status: r.status,
        resolution: r.resolution,
        createdAt: r.createdAt,
      };
    }),
  });
});

// PATCH /api/admin/investor-network/reports/:id  { status: resolved | dismissed, resolution? }
const resolveReport = asyncHandler(async (req, res) => {
  const report = await ProfileReport.findById(req.params.id);
  if (!report) throw ApiError.notFound('Report not found');
  report.set({
    status: req.body.status, resolution: req.body.resolution, resolvedBy: req.user._id, resolvedAt: new Date(),
  });
  await report.save();
  res.json({ success: true, data: report });
});

// POST /api/admin/investor-network/announcements  { title, body? }
const announce = asyncHandler(async (req, res) => {
  const count = await announceToInvestors({ title: req.body.title, body: req.body.body, link: '/investor/notifications' });
  res.status(201).json({ success: true, message: `Sent to ${count} investors`, data: { recipients: count } });
});

module.exports = {
  getStats,
  listInvestors,
  getInvestor,
  setVerification,
  setFeatured,
  openDocument,
  exportInvestors,
  listConnections,
  listReports,
  resolveReport,
  announce,
};
