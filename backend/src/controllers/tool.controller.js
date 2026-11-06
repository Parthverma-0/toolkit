const ApiError = require('../utils/ApiError');
const TOOLS = require('../config/tools');

// GET /api/tools
const listTools = (req, res) => res.json({ success: true, data: TOOLS });

// GET /api/tools/:type
const getTool = (req, res, next) => {
  const tool = TOOLS.find((t) => t.type === req.params.type);
  if (!tool) return next(ApiError.notFound('Tool not found'));
  res.json({ success: true, data: tool });
};

module.exports = { listTools, getTool };
