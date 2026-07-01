const express = require('express');
const { body, validationResult } = require('express-validator');
const Admin = require('../models/Admin');
const { signAdminToken, cookieOptions } = require('../utils/helpers');
const { protectAdmin } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }
  next();
};

// POST /api/auth/login  (super_admin or tenant_admin)
router.post(
  '/login',
  loginLimiter,
  [
    body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password required'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const admin = await Admin.findOne({ email }).select('+password').populate('hostels', 'name slug status');

      if (!admin) {
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }

      if (admin.isLocked) {
        const mins = Math.ceil((admin.lockUntil - Date.now()) / 60000);
        return res.status(423).json({
          success: false,
          message: `Account locked due to repeated failed logins. Try again in ${mins} minute(s).`,
        });
      }

      if (admin.status === 'suspended') {
        return res.status(403).json({ success: false, message: 'Your account has been suspended. Contact platform support.' });
      }
      if (admin.status === 'pending') {
        return res.status(403).json({ success: false, message: 'Your account is pending activation.' });
      }

      const isMatch = await admin.comparePassword(password);
      if (!isMatch) {
        await admin.registerFailedLogin();
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }

      await admin.registerSuccessfulLogin(req.ip);

      const token = signAdminToken(admin);
      res.cookie('hz_token', token, cookieOptions());

      res.json({
        success: true,
        message: 'Logged in successfully.',
        token,
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          avatar: admin.avatar,
          hostels: admin.hostels,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('hz_token');
  res.json({ success: true, message: 'Logged out.' });
});

// GET /api/auth/me
router.get('/me', protectAdmin, async (req, res) => {
  const admin = req.admin;
  res.json({
    success: true,
    admin: {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      avatar: admin.avatar,
      hostels: admin.hostels,
      lastLoginAt: admin.lastLoginAt,
    },
  });
});

// PUT /api/auth/change-password
router.put(
  '/change-password',
  protectAdmin,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const admin = await Admin.findById(req.admin._id).select('+password');
      const ok = await admin.comparePassword(req.body.currentPassword);
      if (!ok) return res.status(400).json({ success: false, message: 'Current password is incorrect.' });

      admin.password = req.body.newPassword;
      await admin.save();
      res.clearCookie('hz_token');
      res.json({ success: true, message: 'Password updated. Please log in again.' });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
