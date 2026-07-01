/**
 * Express app definition — no app.listen() here.
 * Shared by:
 *   - server.js   (local dev / Docker / PM2: calls app.listen)
 *   - api/index.js (Vercel serverless: wraps this app as a handler)
 */
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
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
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

// Required for correct client IPs / secure cookies / rate limiting behind a reverse proxy (Vercel, nginx, Render, Railway, etc.)
app.set('trust proxy', 1);

app.use(
  cors({
    origin: process.env.CLIENT_URL || true,
    credentials: true,
  })
);

app.use(compression());
app.use(morgan(isProd ? 'combined' : 'dev', {
  skip: (req) => req.path === '/api/health',
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET));

app.use(mongoSanitize());
app.use(hpp());

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

module.exports = app;
