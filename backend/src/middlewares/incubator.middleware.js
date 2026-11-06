const { Incubator } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// Attaches req.incubator for an incubator user holding one of its seats
// (use after protect + authorize('incubator'))
const requireIncubator = asyncHandler(async (req, res, next) => {
  if (!req.user.incubator) throw ApiError.notFound('Register your incubator first');

  const incubator = await Incubator.findById(req.user.incubator);
  if (!incubator) throw ApiError.notFound('Incubator not found');
  if (!incubator.members.some((id) => id.equals(req.user._id))) {
    throw ApiError.forbidden('You no longer hold a seat in this incubator');
  }
  if (incubator.status === 'suspended') throw ApiError.forbidden('This incubator has been suspended');

  req.incubator = incubator;
  next();
});

// Seat management and core settings are head-only
const requireIncubatorHead = (req, res, next) => {
  if (req.user.incubatorRole !== 'head') return next(ApiError.forbidden('Only the incubator head can do this'));
  next();
};

module.exports = { requireIncubator, requireIncubatorHead };
