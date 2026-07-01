const express = require('express');
const { body, validationResult } = require('express-validator');
const Admin = require('../models/Admin');
const Hostel = require('../models/Hostel');
const { signAdminToken, cookieOptions } = require('../utils/helpers');
const { protectAdmin } = require('../middleware/auth');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiters');
const { sendAdminRegistrationReceivedEmail } = require('../utils/email');

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

// POST /api/auth/register — public self-service signup for hostel admins.
// Collects the admin's own profile details plus their hostel's full details
// in one submission. Both the admin account and the hostel are created in a
// "pending" state and only go live once a super admin reviews and approves
// them (see PUT /api/superadmin/admins/:id/status and
// PUT /api/superadmin/hostels/:id/approve).
router.post(
  '/register',
  registerLimiter,
  [
    // --- admin / owner profile ---
    body('name').trim().notEmpty().withMessage('Your full name is required'),
    body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
    body('phone').trim().notEmpty().withMessage('Your phone number is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),

    // --- hostel basics ---
    body('hostel.name').trim().notEmpty().withMessage('Hostel name is required'),
    body('hostel.university').trim().notEmpty().withMessage('University served is required'),
    body('hostel.gender').isIn(['mixed', 'male', 'female']).withMessage('Select who the hostel is for'),

    // --- hostel location ---
    body('hostel.location.address').trim().notEmpty().withMessage('Hostel address is required'),

    // --- hostel contact ---
    body('hostel.contact.phone').trim().notEmpty().withMessage('A hostel contact phone number is required'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, email, phone, password, hostel: hostelInput } = req.body;

      const existingAdmin = await Admin.findOne({ email });
      if (existingAdmin) {
        return res.status(409).json({ success: false, message: 'An account with this email already exists. Try logging in instead.' });
      }

      // Admin account starts "pending" — cannot log in until a super admin
      // reviews and activates it.
      const admin = await Admin.create({
        name,
        email,
        phone,
        password,
        role: 'tenant_admin',
        status: 'pending',
      });

      try {
        const hostel = await Hostel.create({
          name: hostelInput?.name,
          tagline: hostelInput?.tagline,
          description: hostelInput?.description,
          university: hostelInput?.university,
          gender: hostelInput?.gender,
          location: {
            address: hostelInput?.location?.address,
            area: hostelInput?.location?.area,
            city: hostelInput?.location?.city,
            county: hostelInput?.location?.county,
            distanceFromCampus: hostelInput?.location?.distanceFromCampus,
          },
          amenities: Array.isArray(hostelInput?.amenities) ? hostelInput.amenities : [],
          rules: Array.isArray(hostelInput?.rules) ? hostelInput.rules : [],
          checkInTime: hostelInput?.checkInTime,
          contact: {
            phone: hostelInput?.contact?.phone,
            whatsapp: hostelInput?.contact?.whatsapp,
            email: hostelInput?.contact?.email || email,
          },
          owner: admin._id,
          status: 'pending_review',
        });

        admin.hostels.push(hostel._id);
        await admin.save({ validateBeforeSave: false });

        sendAdminRegistrationReceivedEmail(admin.email, admin.name, hostel.name).catch((e) =>
          console.error('[EMAIL] registration received failed:', e.message)
        );

        res.status(201).json({
          success: true,
          message: "Registration received! We'll review your hostel and email you once it's approved.",
          admin: { id: admin._id, name: admin.name, email: admin.email },
          hostel: { id: hostel._id, name: hostel.name },
        });
      } catch (hostelErr) {
        // Roll back the admin account if hostel creation failed, so we don't
        // leave an orphaned pending admin with no hostel attached.
        await Admin.findByIdAndDelete(admin._id);
        throw hostelErr;
      }
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
