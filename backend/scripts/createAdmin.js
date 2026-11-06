// Creates a platform admin. Admins can't sign up from the app.
// Usage: npm run admin:create -- admin@example.com "Full Name"
// The account stays 'invited' until that Google account first signs in on /login.
require('dotenv').config();
const mongoose = require('mongoose');
const { User } = require('../src/models');

const [email, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(' ').trim();

(async () => {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Usage: npm run admin:create -- <email> "<name>"');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing && existing.role !== 'admin') {
    console.error(`${email} is already registered as ${existing.role}; one email can only have one role.`);
    process.exit(1);
  }
  if (existing) {
    console.log(`${email} is already an admin (status: ${existing.status})`);
  } else {
    await User.create({ email, name: name || email.split('@')[0], role: 'admin', status: 'invited' });
    console.log(`Admin ${email} created. Sign in with Google on /login to activate it.`);
  }
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
