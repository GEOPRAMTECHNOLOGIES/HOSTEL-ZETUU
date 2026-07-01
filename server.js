require('dotenv').config();
const path = require('path');
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');

const validateEnv = require('./config/validateEnv');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiters');

validateEnv();

const app = express();
const isProd = process.env.NODE_ENV === 'production';

/* --------------------------------- Security --------------------------------- */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Frontend is vanilla JS served from /public — no inline scripts are used,
        // but inline styles are used sparingly in a few components.
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'], // hostel/room photos are hosted externally (Cloudinary etc.)
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
        upgradeInsecureRequests: isProd ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Required for correct client IPs / secure cookies / rate limiting behind a reverse proxy (nginx, Render, Railway, etc.)
app.set('trust proxy', 1);

app.use(
  cors({
    origin: process.env.CLIENT_URL || true,
    credentials: true,
  })
);

app.use(compression());
app.use(morgan(isProd ? 'combined' : 'dev', {
  skip: (req) => req.path === '/api/health', // don't spam logs with health checks
}));

// M-Pesa sends JSON callbacks too, so a single JSON parser covers everything.
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET));

app.use(mongoSanitize()); // strips $ and . from req.body/query/params to prevent NoSQL injection
app.use(hpp()); // prevents HTTP parameter pollution

app.use('/api', apiLimiter);

/* ---------------------------------- Routes ----------------------------------- */
app.use('/api/setup', require('./routes/setup'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/public', require('./routes/public'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/mpesa', require('./routes/mpesa-callback'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/superadmin', require('./routes/superadmin'));

app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState; // 1 = connected
  res.status(dbState === 1 ? 200 : 503).json({
    success: dbState === 1,
    status: dbState === 1 ? 'ok' : 'degraded',
    db: ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] || 'unknown',
    uptimeSeconds: Math.round(process.uptime()),
    time: new Date().toISOString(),
  });
});

/* ------------------------------- Static frontend ------------------------------ */
app.use(
  express.static(path.join(__dirname, 'public'), {
    maxAge: isProd ? '1d' : 0,
    setHeaders: (res, filePath) => {
      // HTML must always revalidate so deploys show up immediately; hashed/static assets can cache longer.
      if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    },
  })
);

app.get('*', (req, res, next) => {
  if (req.originalUrl.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use('/api', notFound);
app.use(errorHandler);

/* -------------------------------- Boot / shutdown ------------------------------ */
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

  // Force-exit if graceful shutdown hangs (e.g. a stuck request)
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
  // An uncaught exception leaves the process in an undefined state — exit and let
  // the process manager (PM2/Docker/systemd) restart it cleanly.
  process.exit(1);
});
