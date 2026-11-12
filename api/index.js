// Vercel serverless entry: the whole Express backend runs as this one function.
// vercel.json rewrites /api/* here; everything else is the built frontend (frontend/dist).
// Local development does not use this file - run backend/server.js + the Vite dev server.
const app = require('../backend/src/app');
const connectDB = require('../backend/src/config/db');

module.exports = async (req, res) => {
  try {
    await connectDB(); // reused while the function instance stays warm
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: false, message: 'The database is unavailable. Please try again shortly.' }));
  }
  return app(req, res);
};
