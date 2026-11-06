const { Program, Cohort } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { pick, applyUpdates } = require('../utils/object');

// All routes run after requireIncubator, so programs are scoped to req.incubator
const FIELDS = ['name', 'type', 'description', 'durationMonths', 'sectors', 'benefits', 'fundingSupport', 'fundingAgency', 'status'];

const findProgram = async (req) => {
  const program = await Program.findOne({ _id: req.params.id, incubator: req.incubator._id });
  if (!program) throw ApiError.notFound('Program not found');
  return program;
};

// GET /api/incubators/me/programs?status=
const listPrograms = asyncHandler(async (req, res) => {
  const filter = { incubator: req.incubator._id };
  if (req.query.status) filter.status = req.query.status;
  const programs = await Program.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, data: programs });
});

// GET /api/incubators/me/programs/:id
const getProgram = asyncHandler(async (req, res) => {
  const program = await findProgram(req);
  const cohorts = await Cohort.find({ program: program._id }).select('name status startDate endDate').sort({ startDate: -1 });
  res.json({ success: true, data: { ...program.toObject(), cohorts } });
});

// POST /api/incubators/me/programs
const createProgram = asyncHandler(async (req, res) => {
  const program = await Program.create({ ...pick(req.body, FIELDS), incubator: req.incubator._id });
  res.status(201).json({ success: true, data: program });
});

// PATCH /api/incubators/me/programs/:id
const updateProgram = asyncHandler(async (req, res) => {
  const program = await findProgram(req);
  applyUpdates(program, pick(req.body, FIELDS), ['fundingSupport']);
  await program.save();
  res.json({ success: true, data: program });
});

// DELETE /api/incubators/me/programs/:id  (blocked once cohorts use it; set status inactive instead)
const deleteProgram = asyncHandler(async (req, res) => {
  const program = await findProgram(req);
  if (await Cohort.exists({ program: program._id })) {
    throw ApiError.conflict('This program has cohorts. Mark it inactive instead of deleting.');
  }
  await program.deleteOne();
  res.json({ success: true, message: 'Program deleted' });
});

module.exports = {
  listPrograms, getProgram, createProgram, updateProgram, deleteProgram,
};
