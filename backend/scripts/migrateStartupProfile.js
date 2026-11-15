// One-time migration for the optional startup profile (2026-11):
// 1. dpiitNumber ("DIPP123456") -> dippNumber ("123456"); values that aren't 6 digits are dropped
// 2. syncs Startup indexes: drops the old non-sparse unique cin_1 / dpiitNumber_1 indexes and
//    builds sparse ones, so many startups can exist without a CIN or DIPP number.
// Safe to run more than once. Usage: npm run db:migrate
require('dotenv').config();
const mongoose = require('mongoose');
const { Startup } = require('../src/models');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const col = Startup.collection;

  const legacy = await col.find({ dpiitNumber: { $exists: true } }).project({ dpiitNumber: 1 }).toArray();
  for (const doc of legacy) {
    const digits = String(doc.dpiitNumber).replace(/\s+/g, '').replace(/^DIPP/i, '');
    const update = /^\d{6}$/.test(digits)
      ? { $set: { dippNumber: digits }, $unset: { dpiitNumber: '' } }
      : { $unset: { dpiitNumber: '' } };
    await col.updateOne({ _id: doc._id }, update);
  }
  console.log(`Converted ${legacy.length} DPIIT number(s) to DIPP number(s)`);

  const dropped = await Startup.syncIndexes();
  console.log('Dropped indexes:', dropped.length ? dropped.join(', ') : 'none');
  console.log('Indexes now:', (await col.indexes()).map((i) => `${i.name}${i.unique ? ' (unique' : ''}${i.sparse ? ', sparse)' : i.unique ? ')' : ''}`).join(', '));

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
