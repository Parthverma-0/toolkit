// Vercel entry point for the "backend" service (see /vercel.json): the whole API runs as
// one function. Local development does not use this file - `npm run dev` runs server.js,
// which also starts the in-process scheduler.
const express = require('express');
const app = require('./src/app');
const connectDB = require('./src/config/db');

const server = express();

// The connection is reused while the function instance stays warm
server.use((req, res, next) => {
  connectDB().then(() => next(), (err) => {
    console.error(`MongoDB connection error: ${err.message}`);
    res.status(503).json({ success: false, message: 'The database is unavailable. Please try again shortly.' });
  });
});
server.use(app);

module.exports = server;
