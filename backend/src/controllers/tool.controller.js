const { ToolSubmission } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { listPublic, findTool, publicTool } = require('../config/tools');
const gemini = require('../services/gemini.service');
const { generateReport } = require('../services/toolReport.service');

const LIMITS = { text: 300, textarea: 3000 };

// GET /api/tools
const listTools = (req, res) => res.json({ success: true, data: listPublic() });

const toolOr404 = (type) => {
  const tool = findTool(type);
  if (!tool) throw ApiError.notFound('Tool not found');
  return tool;
};

// GET /api/tools/:type  (includes the form fields)
const getTool = (req, res) => res.json({ success: true, data: publicTool(toolOr404(req.params.type)) });

// Keep only the tool's own fields, trimmed and length-checked; enforce required ones
function readInputs(tool, body, file) {
  const input = {};
  const errors = [];
  tool.fields.forEach((f) => {
    if (f.type === 'file') {
      if (f.required && !file) errors.push({ field: f.name, message: `${f.label} is required` });
      return;
    }
    const value = String(body[f.name] ?? '').trim();
    if (!value) {
      if (f.required) errors.push({ field: f.name, message: `${f.label} is required` });
      return;
    }
    if (f.type === 'select' && !f.options.includes(value)) {
      errors.push({ field: f.name, message: `Choose a valid option for ${f.label}` });
      return;
    }
    const max = LIMITS[f.type] ?? LIMITS.text;
    if (value.length > max) {
      errors.push({ field: f.name, message: `${f.label} must be at most ${max} characters` });
      return;
    }
    input[f.name] = value;
  });
  if (errors.length) throw ApiError.badRequest('Please check the highlighted fields', errors);
  return input;
}

const listItem = (s) => ({
  _id: s._id, toolType: s.toolType, title: s.title, subtitle: s.output?.subtitle, status: s.status, createdAt: s.createdAt,
});

// GET /api/tools/:type/reports  - this startup's earlier reports for one tool
const listReports = asyncHandler(async (req, res) => {
  toolOr404(req.params.type);
  const rows = await ToolSubmission.find({ startup: req.startup._id, toolType: req.params.type, status: 'completed' })
    .sort({ createdAt: -1 }).limit(50).select('toolType title status createdAt output.subtitle').lean();
  res.json({ success: true, data: rows.map(listItem) });
});

// POST /api/tools/:type/reports  - generate a new report (multipart when the tool takes a file)
const createReport = asyncHandler(async (req, res) => {
  const tool = toolOr404(req.params.type);
  const file = req.file;
  const input = readInputs(tool, req.body, file);
  if (!gemini.isConfigured()) throw gemini.notConfigured();

  const output = await generateReport({ tool, startup: req.startup, input, file });
  const submission = await ToolSubmission.create({
    startup: req.startup._id,
    user: req.user._id,
    toolType: tool.type,
    title: output.title,
    input,
    attachments: file ? [{ name: file.originalname }] : [],
    output: { ...output, generatedAt: new Date() },
    status: 'completed',
  });
  res.status(201).json({ success: true, data: submission });
});

const ownReport = async (req) => {
  const submission = await ToolSubmission.findOne({ _id: req.params.id, startup: req.startup._id });
  if (!submission) throw ApiError.notFound('Report not found');
  return submission;
};

// GET /api/tools/reports/:id
const getReport = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await ownReport(req) });
});

// DELETE /api/tools/reports/:id
const deleteReport = asyncHandler(async (req, res) => {
  const submission = await ownReport(req);
  await submission.deleteOne();
  res.json({ success: true, data: { _id: submission._id } });
});

module.exports = { listTools, getTool, listReports, createReport, getReport, deleteReport };
