const express = require('express');
const { body, validationResult } = require('express-validator');
const Admin = require('../models/Admin');
const Hostel = require('../models/Hostel');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const Student = require('../models/Student');
const { Payment, Review } = require('../models/misc');
const { protectAdmin, requireRole } = require('../middleware/auth');
const { randomPassword } = require('../utils/helpers');
const { sendAdminWelcomeEmail } = require('../utils/email');

const router = express.Router();
router.use(protectAdmin, requireRole('super_admin'));

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, message: errors.array()[0].msg });
  next();
};

/* --------------------------- Platform-wide dashboard --------------------------- */

// GET /api/superadmin/dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const [
      hostelCount,
      publishedCount,
      pendingCount,
      suspendedCount,
      roomCount,
      availableRoomCount,
      adminCount,
      studentCount,
      revenueAgg,
      monthlyBookings,
      recentBookings,
      topHostels,
      pendingHostels,
    ] = await Promise.all([
      Hostel.countDocuments(),
      Hostel.countDocuments({ status: 'published' }),
      Hostel.countDocuments({ status: 'pending_review' }),
      Hostel.countDocuments({ status: 'suspended' }),
      Room.countDocuments(),
      Room.countDocuments({ status: 'available' }),
      Admin.countDocuments({ role: 'tenant_admin' }),
      Student.countDocuments(),
      Payment.aggregate([{ $match: { status: 'success' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Booking.aggregate([
        { $match: { createdAt: { $gte: new Date(new Date().setDate(1)) } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Booking.find().sort({ createdAt: -1 }).limit(10).populate('hostel', 'name').populate('room', 'title'),
      Hostel.find({ status: 'published' }).sort({ ratingAvg: -1, viewCount: -1 }).limit(6).select('name university ratingAvg ratingCount totalRooms availableRooms coverImage viewCount'),
      Hostel.find({ status: 'pending_review' }).sort({ createdAt: -1 }).populate('owner', 'name email phone'),
    ]);

    // 6-month revenue trend for charting
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    const revenueTrend = await Payment.aggregate([
      { $match: { status: 'success', createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    res.json({
      success: true,
      stats: {
        hostelCount,
        publishedCount,
        pendingCount,
        suspendedCount,
        roomCount,
        availableRoomCount,
        adminCount,
        studentCount,
        totalRevenue: revenueAgg[0]?.total || 0,
      },
      monthlyBookings,
      recentBookings,
      topHostels,
      pendingHostels,
      revenueTrend,
    });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------- Hostel oversight ------------------------------ */

// GET /api/superadmin/hostels — all hostels, any status, with owner info
router.get('/hostels', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.q) filter.name = new RegExp(req.query.q, 'i');

    const hostels = await Hostel.find(filter)
      .sort({ createdAt: -1 })
      .populate('owner', 'name email phone status');
    res.json({ success: true, count: hostels.length, hostels });
  } catch (err) {
    next(err);
  }
});

// PUT /api/superadmin/hostels/:id/approve
router.put('/hostels/:id/approve', async (req, res, next) => {
  try {
    const hostel = await Hostel.findByIdAndUpdate(
      req.params.id,
      { status: 'published', verified: true },
      { new: true }
    );
    if (!hostel) return res.status(404).json({ success: false, message: 'Hostel not found.' });
    res.json({ success: true, hostel, message: 'Hostel approved and published.' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/superadmin/hostels/:id/suspend
router.put('/hostels/:id/suspend', [body('reason').optional().trim()], validate, async (req, res, next) => {
  try {
    const hostel = await Hostel.findByIdAndUpdate(
      req.params.id,
      { status: 'suspended', suspensionReason: req.body.reason || 'Policy violation' },
      { new: true }
    );
    if (!hostel) return res.status(404).json({ success: false, message: 'Hostel not found.' });
    res.json({ success: true, hostel, message: 'Hostel suspended.' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/superadmin/hostels/:id/feature
router.put('/hostels/:id/feature', async (req, res, next) => {
  try {
    const hostel = await Hostel.findById(req.params.id);
    if (!hostel) return res.status(404).json({ success: false, message: 'Hostel not found.' });
    hostel.featured = !hostel.featured;
    await hostel.save();
    res.json({ success: true, hostel });
  } catch (err) {
    next(err);
  }
});

/* ----------------------------- Tenant admin management --------------------------- */

// GET /api/superadmin/admins
router.get('/admins', async (req, res, next) => {
  try {
    const admins = await Admin.find({ role: 'tenant_admin' }).populate('hostels', 'name status').sort({ createdAt: -1 });
    res.json({ success: true, admins });
  } catch (err) {
    next(err);
  }
});

// POST /api/superadmin/admins — create a new tenant admin (hostel manager) account
router.post(
  '/admins',
  [body('name').trim().notEmpty(), body('email').isEmail().normalizeEmail(), body('phone').trim().notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const existing = await Admin.findOne({ email: req.body.email });
      if (existing) return res.status(409).json({ success: false, message: 'An account with this email already exists.' });

      const tempPassword = randomPassword(12);
      const admin = await Admin.create({
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        password: tempPassword,
        role: 'tenant_admin',
        status: 'active',
        createdBy: req.admin._id,
      });

      sendAdminWelcomeEmail(admin.email, admin.name, tempPassword).catch((e) =>
        console.error('[EMAIL] admin welcome failed:', e.message)
      );

      res.status(201).json({
        success: true,
        message: 'Tenant admin created. Login credentials sent via email.',
        admin: { id: admin._id, name: admin.name, email: admin.email },
      });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/superadmin/admins/:id/status — activate / suspend a tenant admin
router.put('/admins/:id/status', [body('status').isIn(['active', 'suspended', 'pending'])], validate, async (req, res, next) => {
  try {
    const admin = await Admin.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found.' });
    res.json({ success: true, admin });
  } catch (err) {
    next(err);
  }
});

/* ---------------------------------- Reviews moderation --------------------------- */

// GET /api/superadmin/reviews/pending
router.get('/reviews/pending', async (req, res, next) => {
  try {
    const reviews = await Review.find({ status: 'pending' })
      .populate('hostel', 'name')
      .populate('student', 'name university')
      .sort({ createdAt: -1 });
    res.json({ success: true, reviews });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
