require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');

const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiters');

const app = express();

connectDB();

/* --------------------------------- Security --------------------------------- */
app.use(
  helmet({
    contentSecurityPolicy: false, // relax for inline frontend scripts; tighten if serving via CDN-only assets
    crossOriginEmbedderPolicy: false,
  })
);
app.set('trust proxy', 1);

app.use(
  cors({
    origin: process.env.CLIENT_URL || true,
    credentials: true,
  })
);

app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// IMPORTANT: the M-Pesa callback route needs the raw JSON body too, express.json() is fine since Safaricom sends JSON.
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
  res.json({ success: true, status: 'ok', time: new Date().toISOString() });
});

/* ------------------------------- Static frontend ------------------------------ */
app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res, next) => {
  if (req.originalUrl.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use('/api', notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n  Hosteli Zetu server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]\n`);
});

process.on('unhandledRejection', (err) => {
  console.error('[UNHANDLED REJECTION]', err.message);
});
