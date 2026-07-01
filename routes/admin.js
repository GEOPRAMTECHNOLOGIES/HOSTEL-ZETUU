const express = require('express');
const { body, validationResult } = require('express-validator');
const Hostel = require('../models/Hostel');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const { Review } = require('../models/misc');
const { protectAdmin, requireRole, enforceTenantOwnership } = require('../middleware/auth');

const router = express.Router();
router.use(protectAdmin, requireRole('tenant_admin', 'super_admin'));

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, message: errors.array()[0].msg });
  next();
};

const myHostelFilter = (req) =>
  req.admin.role === 'super_admin' ? {} : { $or: [{ owner: req.admin._id }, { managers: req.admin._id }] };

/* --------------------------------- Dashboard --------------------------------- */

// GET /api/admin/dashboard — summary stats for this tenant's hostel(s)
router.get('/dashboard', async (req, res, next) => {
  try {
    const hostels = await Hostel.find(myHostelFilter(req)).select('_id name status totalRooms availableRooms ratingAvg');
    const hostelIds = hostels.map((h) => h._id);

    const [roomCount, availableRooms, bookingsThisMonth, revenueAgg, pendingReviews, recentBookings] = await Promise.all([
      Room.countDocuments({ hostel: { $in: hostelIds } }),
      Room.countDocuments({ hostel: { $in: hostelIds }, status: 'available' }),
      Booking.countDocuments({
        hostel: { $in: hostelIds },
        createdAt: { $gte: new Date(new Date().setDate(1)) },
      }),
      Booking.aggregate([
        { $match: { hostel: { $in: hostelIds }, paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$bookingFee' } } },
      ]),
      Review.countDocuments({ hostel: { $in: hostelIds }, status: 'pending' }),
      Booking.find({ hostel: { $in: hostelIds } })
        .sort({ createdAt: -1 })
        .limit(8)
        .populate('room', 'title type')
        .populate('hostel', 'name'),
    ]);

    res.json({
      success: true,
      stats: {
        hostelCount: hostels.length,
        roomCount,
        availableRooms,
        bookingsThisMonth,
        totalRevenue: revenueAgg[0]?.total || 0,
        pendingReviews,
      },
      hostels,
      recentBookings,
    });
  } catch (err) {
    next(err);
  }
});

/* ---------------------------------- Hostels ----------------------------------- */

// GET /api/admin/hostels — list of hostels this admin manages
router.get('/hostels', async (req, res, next) => {
  try {
    const hostels = await Hostel.find(myHostelFilter(req)).sort({ createdAt: -1 });
    res.json({ success: true, hostels });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/hostels — create a new hostel listing
router.post(
  '/hostels',
  [
    body('name').trim().notEmpty(),
    body('university').trim().notEmpty(),
    body('location.address').trim().notEmpty(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const hostel = await Hostel.create({
        ...req.body,
        owner: req.admin._id,
        status: 'pending_review', // requires super_admin approval before going live
      });
      await req.admin.updateOne({ $addToSet: { hostels: hostel._id } });
      res.status(201).json({ success: true, hostel, message: 'Hostel submitted for review.' });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/admin/hostels/:id
router.put('/hostels/:id', enforceTenantOwnership, async (req, res, next) => {
  try {
    const blockedFields = ['owner', 'status', 'verified', 'featured', 'ratingAvg', 'ratingCount'];
    blockedFields.forEach((f) => delete req.body[f]);

    const hostel = await Hostel.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json({ success: true, hostel });
  } catch (err) {
    next(err);
  }
});

/* ----------------------------------- Rooms ------------------------------------ */

// GET /api/admin/hostels/:hostelId/rooms
router.get('/hostels/:hostelId/rooms', enforceTenantOwnership, async (req, res, next) => {
  try {
    const rooms = await Room.find({ hostel: req.params.hostelId }).sort({ createdAt: -1 });
    res.json({ success: true, rooms });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/hostels/:hostelId/rooms
router.post(
  '/hostels/:hostelId/rooms',
  enforceTenantOwnership,
  [body('title').trim().notEmpty(), body('type').notEmpty(), body('price').isNumeric()],
  validate,
  async (req, res, next) => {
    try {
      const room = await Room.create({ ...req.body, hostel: req.params.hostelId });
      await Hostel.findByIdAndUpdate(req.params.hostelId, {
        $inc: { totalRooms: 1, availableRooms: room.status === 'available' ? 1 : 0 },
      });
      res.status(201).json({ success: true, room });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/admin/rooms/:id
router.put('/rooms/:id', async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id).populate('hostel');
    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });

    const isOwner = room.hostel.owner.toString() === req.admin._id.toString();
    const isManager = room.hostel.managers.some((m) => m.toString() === req.admin._id.toString());
    if (req.admin.role !== 'super_admin' && !isOwner && !isManager) {
      return res.status(403).json({ success: false, message: 'You do not manage this room.' });
    }

    const wasAvailable = room.status === 'available';
    Object.assign(room, req.body);
    await room.save();

    if (wasAvailable !== (room.status === 'available')) {
      await Hostel.findByIdAndUpdate(room.hostel._id, {
        $inc: { availableRooms: room.status === 'available' ? 1 : -1 },
      });
    }

    res.json({ success: true, room });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/rooms/:id
router.delete('/rooms/:id', async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id).populate('hostel');
    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });

    const isOwner = room.hostel.owner.toString() === req.admin._id.toString();
    if (req.admin.role !== 'super_admin' && !isOwner) {
      return res.status(403).json({ success: false, message: 'Only the hostel owner can delete rooms.' });
    }

    await room.deleteOne();
    await Hostel.findByIdAndUpdate(room.hostel._id, {
      $inc: { totalRooms: -1, availableRooms: room.status === 'available' ? -1 : 0 },
    });
    res.json({ success: true, message: 'Room deleted.' });
  } catch (err) {
    next(err);
  }
});

/* --------------------------------- Bookings ------------------------------------ */

// GET /api/admin/bookings
router.get('/bookings', async (req, res, next) => {
  try {
    const hostels = await Hostel.find(myHostelFilter(req)).select('_id');
    const filter = { hostel: { $in: hostels.map((h) => h._id) } };
    if (req.query.status) filter.status = req.query.status;

    const bookings = await Booking.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('room', 'title type')
      .populate('hostel', 'name')
      .populate('payment', 'status mpesaReceiptNumber');
    res.json({ success: true, bookings });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/bookings/:id/status
router.put('/bookings/:id/status', async (req, res, next) => {
  try {
    const { status, cancelReason } = req.body;
    const booking = await Booking.findById(req.params.id).populate('hostel');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    const isOwner = booking.hostel.owner.toString() === req.admin._id.toString();
    if (req.admin.role !== 'super_admin' && !isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    booking.status = status;
    if (status === 'cancelled') {
      booking.cancelReason = cancelReason;
      booking.cancelledAt = new Date();
      await Room.findByIdAndUpdate(booking.room, { status: 'available' });
    }
    await booking.save();
    res.json({ success: true, booking });
  } catch (err) {
    next(err);
  }
});

/* ---------------------------------- Reviews ------------------------------------ */

// GET /api/admin/reviews
router.get('/reviews', async (req, res, next) => {
  try {
    const hostels = await Hostel.find(myHostelFilter(req)).select('_id');
    const filter = { hostel: { $in: hostels.map((h) => h._id) } };
    if (req.query.status) filter.status = req.query.status;

    const reviews = await Review.find(filter)
      .sort({ createdAt: -1 })
      .populate('student', 'name university')
      .populate('room', 'title');
    res.json({ success: true, reviews });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/reviews/:id/moderate
router.put('/reviews/:id/moderate', async (req, res, next) => {
  try {
    const { status, moderationNote } = req.body; // 'approved' | 'rejected'
    const review = await Review.findById(req.params.id).populate('hostel');
    if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });

    const isOwner = review.hostel.owner.toString() === req.admin._id.toString();
    if (req.admin.role !== 'super_admin' && !isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    review.status = status;
    review.moderationNote = moderationNote;
    review.moderatedBy = req.admin._id;
    await review.save();

    if (status === 'approved') {
      const agg = await Review.aggregate([
        { $match: { hostel: review.hostel._id, status: 'approved' } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
      ]);
      if (agg[0]) {
        await Hostel.findByIdAndUpdate(review.hostel._id, {
          ratingAvg: Math.round(agg[0].avg * 10) / 10,
          ratingCount: agg[0].count,
        });
      }
    }

    res.json({ success: true, review });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
