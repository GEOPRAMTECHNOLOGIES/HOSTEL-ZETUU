/**
 * Vercel serverless entrypoint.
 *
 * Key differences from server.js:
 *  - No app.listen() — Vercel calls this as a request handler.
 *  - The Mongo connection is cached across invocations (a serverless
 *    function's module scope persists between "warm" calls), so we don't
 *    reconnect on every single request.
 *  - On a DB failure we respond 503 instead of calling process.exit(1).
 *    process.exit() inside a serverless function kills the whole
 *    invocation and is what produced the crash-loop 500s in the logs.
 */
const mongoose = require('mongoose');
const app = require('../app');

let cachedConnPromise = null;

function connect() {
  if (mongoose.connection.readyState === 1) return Promise.resolve();
  if (!cachedConnPromise) {
    mongoose.set('strictQuery', true);
    cachedConnPromise = mongoose
      .connect(process.env.MONGO_URI, {
        maxPoolSize: 10, // lower than the Docker/PM2 default — serverless runs many concurrent function instances
        serverSelectionTimeoutMS: 8000,
        socketTimeoutMS: 45000,
      })
      .catch((err) => {
        cachedConnPromise = null; // allow retry on next request instead of staying broken forever
        throw err;
      });
  }
  return cachedConnPromise;
}

module.exports = async (req, res) => {
  try {
    await connect();
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
    res.status(503).json({
      success: false,
      message: 'Database connection failed. Check MONGO_URI in your Vercel environment variables.',
    });
    return;
  }
  return app(req, res);
};
