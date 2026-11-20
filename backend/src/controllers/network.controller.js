const {
  User, Startup, Founder, InvestorProfile, NetworkConnection, ConnectionMessage, Notification, ProfileReport,
} = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getPagination, paginationMeta } = require('../utils/pagination');
const { notify } = require('../services/notification.service');
const {
  serializeConnection, serializeInvestorSummary, serializePublicProfile, serializeStartupSummary, primaryFounderOf,
} = require('../services/investorSerializer');

// Connections between registered investors and founders, the conversation inside an accepted
// connection, notifications, and founders browsing investors. Every route here is used by both
// roles; `side` ('investor' | 'startup') is the caller's role and decides the direction.

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const other = (side) => (side === 'investor' ? 'startup' : 'investor');
const sideOf = (req) => req.user.role;

const connectionLink = (toSide) => (toSide === 'investor' ? '/investor/connections' : '/startup/investors?tab=requests');
const messageLink = (toSide) => (toSide === 'investor' ? '/investor/messages' : '/startup/investors?tab=messages');

// A connection the caller is part of, or 404 (never reveal other people's connections)
const findMyConnection = async (req) => {
  const side = sideOf(req);
  const conn = await NetworkConnection.findById(req.params.id);
  const mine = conn && (side === 'investor'
    ? conn.investor.equals(req.user._id)
    : req.startup && conn.startup.equals(req.startup._id));
  if (!mine) throw ApiError.notFound('Connection not found');
  return conn;
};

// Names/photos for the other party of each connection, keyed by connection id
const counterparts = async (conns, side) => {
  if (side === 'investor') {
    const startups = await Startup.find({ _id: { $in: conns.map((c) => c.startup) } });
    const founders = await Founder.find({ startup: { $in: startups.map((s) => s._id) } }).sort({ isPrimary: -1 });
    return Object.fromEntries(conns.map((c) => {
      const startup = startups.find((s) => s._id.equals(c.startup));
      const mine = founders.filter((f) => f.startup.equals(c.startup));
      return [String(c._id), startup ? serializeStartupSummary(startup, primaryFounderOf(mine)) : null];
    }));
  }
  const [profiles, users] = await Promise.all([
    InvestorProfile.find({ user: { $in: conns.map((c) => c.investor) } }),
    User.find({ _id: { $in: conns.map((c) => c.investor) } }).select('name avatar'),
  ]);
  return Object.fromEntries(conns.map((c) => {
    const profile = profiles.find((p) => p.user.equals(c.investor));
    const user = users.find((u) => u._id.equals(c.investor));
    return [String(c._id), profile && user ? serializeInvestorSummary(profile, user) : null];
  }));
};

const unreadCount = async (conn, side) => {
  if (conn.status !== 'accepted' || !conn.lastMessageAt || conn.lastMessageBy === side) return 0;
  const readAt = conn.lastReadAt?.[side];
  if (readAt && conn.lastMessageAt <= readAt) return 0;
  return ConnectionMessage.countDocuments({
    connection: conn._id, senderRole: other(side), ...(readAt && { createdAt: { $gt: readAt } }),
  });
};

const presentConnections = async (conns, side) => {
  const people = await counterparts(conns, side);
  const unread = await Promise.all(conns.map((c) => unreadCount(c, side)));
  return conns.map((c, i) => serializeConnection(c, side, people[String(c._id)], unread[i]));
};

// ---------- connections ----------

// GET /api/network/connections?box=all|sent|received&status=
const listConnections = asyncHandler(async (req, res) => {
  const side = sideOf(req);
  const filter = side === 'investor' ? { investor: req.user._id } : { startup: req.startup._id };
  if (req.query.box === 'sent') filter.initiatedBy = side;
  if (req.query.box === 'received') filter.initiatedBy = other(side);
  if (req.query.status) filter.status = req.query.status;
  const conns = await NetworkConnection.find(filter).sort({ updatedAt: -1 }).limit(200);
  res.json({ success: true, data: await presentConnections(conns, side) });
});

// POST /api/network/connections  { startupId | investorId, message? }
// Investors send startupId ("Connect with Founder"); founders send investorId (an InvestorProfile id).
const createConnection = asyncHandler(async (req, res) => {
  const side = sideOf(req);
  const { message } = req.body;
  let investorUser; let startup; let targetName; let myName;

  if (side === 'investor') {
    const mine = await InvestorProfile.findOne({ user: req.user._id }).select('verification submittedAt');
    if (!mine?.submittedAt) throw ApiError.forbidden('Complete your investor profile to continue').withCode('PROFILE_INCOMPLETE');
    if (mine.verification.status !== 'verified') {
      throw ApiError.forbidden('Our team has to verify your profile before you can connect with founders.').withCode('NOT_VERIFIED');
    }
    startup = await Startup.findOne({
      _id: req.body.startupId, isProfileComplete: true, 'investorVisibility.listed': { $ne: false },
    });
    if (!startup) throw ApiError.notFound('Startup not found');
    investorUser = req.user._id;
    targetName = startup.name;
    myName = req.user.name;
  } else {
    const profile = await InvestorProfile.findOne({
      _id: req.body.investorId, submittedAt: { $exists: true }, 'verification.status': 'verified', visibility: { $ne: 'private' },
    });
    const user = profile && await User.findOne({ _id: profile.user, status: 'active' });
    if (!user) throw ApiError.notFound('Investor not found');
    startup = req.startup;
    investorUser = user._id;
    targetName = user.name;
    myName = startup.name;
  }

  const existing = await NetworkConnection.findOne({ investor: investorUser, startup: startup._id });
  const stamp = { status: 'pending', by: side, at: new Date() };
  let conn;
  if (existing) {
    if (existing.status === 'accepted') throw ApiError.conflict(`You are already connected with ${targetName}`);
    if (existing.status === 'pending') {
      throw ApiError.conflict(existing.initiatedBy === side
        ? `You have already sent a request to ${targetName}`
        : `${targetName} has already sent you a request. Accept it from your requests.`).withCode('REQUEST_EXISTS');
    }
    // declined / withdrawn earlier: start again
    existing.set({
      initiatedBy: side, message, status: 'pending', respondedAt: undefined,
    });
    existing.history.push(stamp);
    conn = await existing.save();
  } else {
    conn = await NetworkConnection.create({
      investor: investorUser,
      startup: startup._id,
      founder: startup.owner,
      initiatedBy: side,
      message,
      history: [stamp],
    });
  }

  await notify(side === 'investor' ? startup.owner : investorUser, {
    type: 'connection_request',
    title: `New connection request from ${myName}`,
    body: message?.slice(0, 200),
    link: connectionLink(other(side)),
  });
  const [data] = await presentConnections([conn], side);
  res.status(201).json({ success: true, data });
});

// PATCH /api/network/connections/:id  { action: accept | decline | withdraw }
const respondToConnection = asyncHandler(async (req, res) => {
  const side = sideOf(req);
  const conn = await findMyConnection(req);
  const { action } = req.body;
  if (conn.status !== 'pending') throw ApiError.badRequest(`This request is already ${conn.status}`);

  const iStarted = conn.initiatedBy === side;
  if (action === 'withdraw' && !iStarted) throw ApiError.forbidden('Only the person who sent the request can withdraw it');
  if (action !== 'withdraw' && iStarted) throw ApiError.forbidden('You cannot respond to your own request');

  conn.status = { accept: 'accepted', decline: 'declined', withdraw: 'withdrawn' }[action];
  conn.respondedAt = new Date();
  conn.history.push({ status: conn.status, by: side, at: conn.respondedAt });
  await conn.save();

  if (action !== 'withdraw') {
    const myName = side === 'investor' ? req.user.name : req.startup.name;
    await notify(side === 'investor' ? conn.founder : conn.investor, {
      type: action === 'accept' ? 'connection_accepted' : 'connection_declined',
      title: action === 'accept' ? `${myName} accepted your connection request` : `${myName} declined your connection request`,
      body: action === 'accept' ? 'You can now message each other.' : undefined,
      link: action === 'accept' ? messageLink(other(side)) : connectionLink(other(side)),
    });
  }
  const [data] = await presentConnections([conn], side);
  res.json({ success: true, data });
});

// ---------- messages ----------

// GET /api/network/connections/:id/messages
const listMessages = asyncHandler(async (req, res) => {
  const side = sideOf(req);
  const conn = await findMyConnection(req);
  if (conn.status !== 'accepted') throw ApiError.forbidden('Messaging opens once the request is accepted');
  const messages = await ConnectionMessage.find({ connection: conn._id }).sort({ createdAt: -1 }).limit(200);
  messages.reverse();

  conn.set(`lastReadAt.${side}`, new Date());
  await conn.save();
  res.json({
    success: true,
    data: messages.map((m) => ({
      id: m._id, body: m.body, createdAt: m.createdAt, mine: m.senderRole === side,
    })),
  });
});

// POST /api/network/connections/:id/messages  { body }
const sendMessage = asyncHandler(async (req, res) => {
  const side = sideOf(req);
  const conn = await findMyConnection(req);
  if (conn.status !== 'accepted') throw ApiError.forbidden('Messaging opens once the request is accepted');

  const message = await ConnectionMessage.create({
    connection: conn._id, sender: req.user._id, senderRole: side, body: req.body.body,
  });
  conn.set({
    lastMessageAt: message.createdAt,
    lastMessagePreview: message.body.slice(0, 120),
    lastMessageBy: side,
    [`lastReadAt.${side}`]: message.createdAt,
  });
  await conn.save();

  // One unread "new message" notification per conversation, not one per message
  const recipient = side === 'investor' ? conn.founder : conn.investor;
  const link = messageLink(other(side));
  const senderName = side === 'investor' ? req.user.name : req.startup.name;
  const pending = await Notification.findOne({
    user: recipient, type: 'message', link, readAt: { $exists: false },
  });
  if (pending) {
    pending.set({ title: `New message from ${senderName}`, body: message.body.slice(0, 200), createdAt: new Date() });
    await pending.save();
  } else {
    await notify(recipient, {
      type: 'message', title: `New message from ${senderName}`, body: message.body.slice(0, 200), link,
    });
  }
  res.status(201).json({
    success: true,
    data: {
      id: message._id, body: message.body, createdAt: message.createdAt, mine: true,
    },
  });
});

// ---------- notifications (any signed-in user) ----------

// GET /api/network/notifications?unread=true&limit=30
const listNotifications = asyncHandler(async (req, res) => {
  const filter = { user: req.user._id };
  if (req.query.unread) filter.readAt = { $exists: false };
  const [items, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).limit(req.query.limit || 30),
    Notification.countDocuments({ user: req.user._id, readAt: { $exists: false } }),
  ]);
  res.json({ success: true, data: items, unread });
});

// POST /api/network/notifications/read  { ids? }  (no ids = mark everything read)
const markNotificationsRead = asyncHandler(async (req, res) => {
  const filter = { user: req.user._id, readAt: { $exists: false } };
  if (req.body.ids?.length) filter._id = { $in: req.body.ids };
  await Notification.updateMany(filter, { $set: { readAt: new Date() } });
  res.json({ success: true, unread: await Notification.countDocuments({ user: req.user._id, readAt: { $exists: false } }) });
});

// ---------- founders browsing registered investors ----------

const discoverableFilter = async () => ({
  submittedAt: { $exists: true },
  'verification.status': 'verified',
  visibility: { $in: ['public', 'limited'] },
  user: { $in: await User.find({ role: 'investor', status: 'active' }).distinct('_id') },
});

// GET /api/network/investors?q=&type=&category=&sector=&stage=&ticket=&location=&featured=
const listInvestors = asyncHandler(async (req, res) => {
  const {
    q, type, category, sector, stage, ticket, location, featured,
  } = req.query;
  const pagination = getPagination(req.query, { defaultLimit: 12, maxLimit: 48 });
  const filter = await discoverableFilter();
  if (type) filter.investorType = type;
  if (category) filter.category = category;
  if (sector) filter.sectors = sector;
  if (stage) filter.stages = stage;
  if (ticket) filter.ticketSizes = { $in: [ticket, 'flexible'] };
  if (location) filter.locations = { $in: [location, 'across_india'] };
  if (featured) filter.isFeatured = true;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    const userIds = await User.find({ role: 'investor', name: rx }).distinct('_id');
    filter.$or = [{ user: { $in: userIds } }, { organisationName: rx }];
  }

  const [profiles, total] = await Promise.all([
    InvestorProfile.find(filter).sort({ isFeatured: -1, submittedAt: -1 }).skip(pagination.skip).limit(pagination.limit),
    InvestorProfile.countDocuments(filter),
  ]);
  const [users, conns] = await Promise.all([
    User.find({ _id: { $in: profiles.map((p) => p.user) } }).select('name avatar'),
    req.startup
      ? NetworkConnection.find({ startup: req.startup._id, investor: { $in: profiles.map((p) => p.user) } }).select('investor status initiatedBy')
      : [],
  ]);
  const data = profiles.map((p) => {
    const user = users.find((u) => u._id.equals(p.user));
    const conn = conns.find((c) => c.investor.equals(p.user));
    return {
      ...serializePublicProfile(p, user, { connected: conn?.status === 'accepted' }),
      connection: conn ? { id: conn._id, status: conn.status, initiatedBy: conn.initiatedBy } : null,
    };
  });
  res.json({ success: true, data, pagination: paginationMeta(pagination, total) });
});

// GET /api/network/investors/:id  (id = InvestorProfile id)
const getInvestor = asyncHandler(async (req, res) => {
  const profile = await InvestorProfile.findById(req.params.id);
  const user = profile && await User.findOne({ _id: profile.user, status: 'active' });
  const conn = profile && req.startup
    ? await NetworkConnection.findOne({ startup: req.startup._id, investor: profile.user })
    : null;
  const listed = profile?.submittedAt && profile.verification.status === 'verified' && profile.visibility !== 'private';
  // A private profile stays reachable for founders who are already connected
  if (!user || !(listed || conn?.status === 'accepted')) throw ApiError.notFound('Investor not found');

  res.json({
    success: true,
    data: {
      ...serializePublicProfile(profile, user, { connected: conn?.status === 'accepted' }),
      connection: conn ? { id: conn._id, status: conn.status, initiatedBy: conn.initiatedBy } : null,
    },
  });
});

// POST /api/network/investors/:id/report  { reason, details? }
const reportInvestor = asyncHandler(async (req, res) => {
  const profile = await InvestorProfile.findById(req.params.id).select('_id');
  if (!profile) throw ApiError.notFound('Investor not found');
  if (await ProfileReport.exists({ investor: profile._id, reportedBy: req.user._id, status: 'open' })) {
    throw ApiError.conflict('You have already reported this profile. Our team is reviewing it.');
  }
  await ProfileReport.create({
    investor: profile._id, reportedBy: req.user._id, reason: req.body.reason, details: req.body.details,
  });
  res.status(201).json({ success: true, message: 'Thanks, our team will review this profile.' });
});

module.exports = {
  listConnections,
  createConnection,
  respondToConnection,
  listMessages,
  sendMessage,
  listNotifications,
  markNotificationsRead,
  listInvestors,
  getInvestor,
  reportInvestor,
};
