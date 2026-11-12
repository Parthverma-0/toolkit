// Local / long-running entry point. On Vercel the app is served by ./index.js instead.
require('dotenv').config();
const config = require('./src/config');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const scheduler = require('./src/services/scheduler.service');

connectDB()
  .then(() => {
    app.listen(config.port, () => console.log(`Server running on port ${config.port}`));
    scheduler.start();
  })
  .catch((err) => {
    console.error(`MongoDB connection error: ${err.message}`);
    process.exit(1);
  });
