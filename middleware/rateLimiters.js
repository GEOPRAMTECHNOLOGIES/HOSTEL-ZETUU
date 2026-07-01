const rateLimit = require('express-rate-limit');

const makeLimiter = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message },
  });

// Strict limiter for login attempts — protects against credential stuffing
const loginLimiter = makeLimiter(15 * 60 * 1000, 8, 'Too many login attempts. Try again in 15 minutes.');

// OTP requests — prevents email/SMS bombing
const otpLimiter = makeLimiter(10 * 60 * 1000, 5, 'Too many verification codes requested. Try again shortly.');

// M-Pesa STK push — prevents abuse of paid payment initiation
const mpesaLimiter = makeLimiter(5 * 60 * 1000, 6, 'Too many payment attempts. Please wait a few minutes.');

// General API limiter
const apiLimiter = makeLimiter(15 * 60 * 1000, 300, 'Too many requests. Please slow down.');

module.exports = { loginLimiter, otpLimiter, mpesaLimiter, apiLimiter };
