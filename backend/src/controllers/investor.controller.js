const { Investor, InvestorConnection } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { pick, applyUpdates } = require('../utils/object');
const { getPagination, paginationMeta } = require('../utils/pagination');

const FIELDS = ['name', 'firm', 'type', 'logo', 'about', 'sectors', 'stages', 'ticketSize', 'location', 'email', 'website', 'linkedin', 'portfolio', 'isActive'];
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Investors added by any member of the same incubator can be managed by that incubator
const findManagedInvestor = async (req) => {
  const investor = await Investor.findById(req.params.id);
  if (!investor) throw ApiError.notFound('Investor not found');
  if (!req.incubator.members.some((m) => m.equals(investor.addedBy))) {
    throw ApiError.forbidden('Only the incubator that added this investor can change it');
  }
  return investor;
};

// =============== Directory ===============

// GET /api/investors?sector=&stage=&type=&amount=&q=
const listInvestors = asyncHandler(async (req, res) => {
  const {
    sector, stage, type, amount, q,
  } = req.query;
  const pagination = getPagination(req.query);
  const filter = { isActive: true };
  if (sector) filter.sectors = sector;
  if (stage) filter.stages = stage;
  if (type) filter.type = type;
  if (amount !== undefined) {
    filter.$and = [
      { $or: [{ 'ticketSize.min': null }, { 'ticketSize.min': { $lte: amount } }] },
      { $or: [{ 'ticketSize.max': null }, { 'ticketSize.max': { $gte: amount } }] },
    ];
  }
  if (q) filter.$or = [{ name: { $regex: escapeRegex(q), $options: 'i' } }, { firm: { $regex: escapeRegex(q), $options: 'i' } }];

  const [items, total] = await Promise.all([
    Investor.find(filter).select('-addedBy').sort({ name: 1 }).skip(pagination.skip).limit(pagination.limit),
    Investor.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, pagination: paginationMeta(pagination, total) });
});

// GET /api/investors/:id  (startups also see their connection with this investor)
const getInvestor = asyncHandler(async (req, res) => {
  const investor = await Investor.findById(req.params.id).select('-addedBy');
  if (!investor) throw ApiError.notFound('Investor not found');
  const myConnection = req.user.role === 'startup' && req.user.startup
    ? await InvestorConnection.findOne({ investor: investor._id, startup: req.user.startup }).select('status createdAt')
    : null;
  res.json({ success: true, data: { ...investor.toObject(), myConnection } });
});

// POST /api/investors  (incubator)
const createInvestor = asyncHandler(async (req, res) => {
  const investor = await Investor.create({ ...pick(req.body, FIELDS), addedBy: req.user._id });
  res.status(201).json({ success: true, data: investor });
});

// PATCH /api/investors/:id  (incubator that added it)
const updateInvestor = asyncHandler(async (req, res) => {
  const investor = await findManagedInvestor(req);
  applyUpdates(investor, pick(req.body, FIELDS), ['ticketSize']);
  if (investor.ticketSize?.min > investor.ticketSize?.max) throw ApiError.badRequest('ticketSize.min cannot be greater than ticketSize.max');
  await investor.save();
  res.json({ success: true, data: investor });
});

// DELETE /api/investors/:id  (hidden instead of deleted once startups have connected)
const deleteInvestor = asyncHandler(async (req, res) => {
  const investor = await findManagedInvestor(req);
  if (await InvestorConnection.exists({ investor: investor._id })) {
    investor.isActive = false;
    await investor.save();
    return res.json({ success: true, message: 'Investor has connections, so it was deactivated instead of deleted' });
  }
  await investor.deleteOne();
  res.json({ success: true, message: 'Investor deleted' });
});

// =============== Startup connections (after requireCompleteProfile) ===============

// POST /api/investors/:id/connect  { message?, pitchDeckUrl?, amountSought? }
const connect = asyncHandler(async (req, res) => {
  const investor = await Investor.findOne({ _id: req.params.id, isActive: true });
  if (!investor) throw ApiError.notFound('Investor not found');
  if (await InvestorConnection.exists({ startup: req.startup._id, investor: investor._id })) {
    throw ApiError.conflict('You have already reached out to this investor');
  }

  const connection = await InvestorConnection.create({
    startup: req.startup._id,
    investor: investor._id,
    requestedBy: req.user._id,
    ...pick(req.body, ['message', 'pitchDeckUrl', 'amountSought']),
  });
  res.status(201).json({ success: true, data: connection });
});

// GET /api/investors/connections?status=
const listMyConnections = asyncHandler(async (req, res) => {
  const filter = { startup: req.startup._id };
  if (req.query.status) filter.status = req.query.status;
  const connections = await InvestorConnection.find(filter)
    .populate('investor', 'name firm type logo')
    .sort({ updatedAt: -1 });
  res.json({ success: true, data: connections });
});

// PATCH /api/investors/connections/:connectionId  { status?, notes? }  (startup tracks its own pipeline)
const updateConnection = asyncHandler(async (req, res) => {
  const connection = await InvestorConnection.findOne({ _id: req.params.connectionId, startup: req.startup._id });
  if (!connection) throw ApiError.notFound('Connection not found');
  connection.set(pick(req.body, ['status', 'notes']));
  await connection.save();
  res.json({ success: true, data: connection });
});

// DELETE /api/investors/connections/:connectionId  (withdraw, only before the investor engaged)
const withdrawConnection = asyncHandler(async (req, res) => {
  const connection = await InvestorConnection.findOne({ _id: req.params.connectionId, startup: req.startup._id });
  if (!connection) throw ApiError.notFound('Connection not found');
  if (connection.status !== 'requested') throw ApiError.badRequest('Only pending requests can be withdrawn; set status instead');
  await connection.deleteOne();
  res.json({ success: true, message: 'Request withdrawn' });
});

module.exports = {
  listInvestors,
  getInvestor,
  createInvestor,
  updateInvestor,
  deleteInvestor,
  connect,
  listMyConnections,
  updateConnection,
  withdrawConnection,
};
