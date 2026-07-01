const express = require('express');
const { body, validationResult } = require('express-validator');
const Admin = require('../models/Admin');

const router = express.Router();

// POST /api/setup/super-admin  { setupKey, name, email, password }
// Only works if no super_admin exists yet AND the setupKey matches env var.
router.post(
  '/super-admin',
  [
    body('setupKey').notEmpty(),
    body('name').trim().notEmpty(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ success: false, message: errors.array()[0].msg });

      if (req.body.setupKey !== process.env.SUPER_ADMIN_SETUP_KEY) {
        return res.status(403).json({ success: false, message: 'Invalid setup key.' });
      }

      const existingSuperAdmin = await Admin.findOne({ role: 'super_admin' });
      if (existingSuperAdmin) {
        return res.status(409).json({ success: false, message: 'A super admin already exists. Setup is locked.' });
      }

      const admin = await Admin.create({
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        role: 'super_admin',
        status: 'active',
      });

      res.status(201).json({
        success: true,
        message: 'Super admin created. You can now log in.',
        admin: { id: admin._id, email: admin.email },
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
