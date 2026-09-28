/**
 * Local / Docker / PM2 entrypoint.
 * Vercel does NOT use this file — it uses api/index.js instead,
 * since Vercel runs serverless functions, not a long-lived process.
 */
const mongoose = require('mongoose');
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;
let server;

connectDB().then(() => {
  server = app.listen(PORT, () => {
    console.log(`\n  Hosteli Zetu server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]\n`);
  });
});

function gracefulShutdown(signal) {
  console.log(`\n[SHUTDOWN] ${signal} received. Closing server...`);
  if (!server) return process.exit(0);

  server.close(async () => {
    console.log('[SHUTDOWN] HTTP server closed.');
    try {
      await mongoose.connection.close(false);
      console.log('[SHUTDOWN] MongoDB connection closed.');
    } catch (err) {
      console.error('[SHUTDOWN] Error closing MongoDB connection:', err.message);
    }
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[SHUTDOWN] Forced exit after 10s timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (err) => {
  console.error('[UNHANDLED REJECTION]', err.message);
});
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err.message);
  console.error(err.stack);
  process.exit(1);
});
