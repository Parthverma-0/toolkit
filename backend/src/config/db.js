const mongoose = require('mongoose');

// One shared connection promise: the long-running server awaits it once at boot, and
// serverless invocations (Vercel) reuse it across warm requests instead of reconnecting.
let connecting = null;

const connectDB = () => {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection);
  connecting ??= mongoose
    .connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000, maxPoolSize: 10 })
    .then((conn) => {
      console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
      return conn.connection;
    })
    .finally(() => { connecting = null; }); // a failed attempt is retried by the next caller
  return connecting;
};

module.exports = connectDB;
