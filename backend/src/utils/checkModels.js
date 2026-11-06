// Sanity check: loads every model and builds its indexes against MONGO_URI.
// Run with: npm run db:check
require('dotenv').config();
const mongoose = require('mongoose');
const models = require('../models');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  for (const [name, model] of Object.entries(models)) {
    await model.syncIndexes();
    console.log(`ok  ${name.padEnd(20)} -> ${model.collection.collectionName}`);
  }
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
