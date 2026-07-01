const express = require('express');
const Hostel = require('../models/Hostel');
const Room = require('../models/Room');
const { Review } = require('../models/misc');

const router = express.Router();

// GET /api/public/hostels  — list/search published hostels
router.get('/hostels', async (req, res, next) => {
  try {
    const { q, university, gender, minPrice, maxPrice, amenities, sort, page = 1, limit = 12 } = req.query;

    const filter = { status: 'published' };
    if (university) filter.university = new RegExp(university, 'i');
    if (gender) filter.gender = gender;
    if (amenities) {
      const list = amenities.split(',').map((a) => a.trim());
      filter.amenities = { $all: list };
    }
    if (q) filter.$text = { $search: q };

    let sortStage = { featured: -1, ratingAvg: -1, createdAt: -1 };
    if (sort === 'newest') sortStage = { createdAt: -1 };
    if (sort === 'rating') sortStage = { ratingAvg: -1 };

    const skip = (Number(page) - 1) * Number(limit);

    let hostels = await Hostel.find(filter)
      .sort(sortStage)
      .skip(skip)
      .limit(Number(limit))
      .select('-managers -paybillNumber -suspensionReason')
      .lean();

    // Optional price filtering via room aggregation (cheapest room per hostel)
    if (minPrice || maxPrice) {
      const priceFilter = {};
      if (minPrice) priceFilter.$gte = Number(minPrice);
      if (maxPrice) priceFilter.$lte = Number(maxPrice);

      const ids = hostels.map((h) => h._id);
      const matchingHostelIds = await Room.distinct('hostel', {
        hostel: { $in: ids },
        price: priceFilter,
        isActive: true,
      });
      const matchSet = new Set(matchingHostelIds.map(String));
      hostels = hostels.filter((h) => matchSet.has(String(h._id)));
    }

    const total = await Hostel.countDocuments(filter);

    res.json({ success: true, count: hostels.length, total, page: Number(page), hostels });
  } catch (err) {
    next(err);
  }
});

// GET /api/public/hostels/featured
router.get('/hostels/featured', async (req, res, next) => {
  try {
    const hostels = await Hostel.find({ status: 'published', featured: true })
      .sort({ ratingAvg: -1 })
      .limit(8)
      .select('name slug tagline university location coverImage ratingAvg ratingCount availableRooms gender');
    res.json({ success: true, hostels });
  } catch (err) {
    next(err);
  }
});

// GET /api/public/universities — distinct list for search filters
router.get('/universities', async (req, res, next) => {
  try {
    const list = await Hostel.distinct('university', { status: 'published' });
    res.json({ success: true, universities: list.sort() });
  } catch (err) {
    next(err);
  }
});

// GET /api/public/hostels/:slug
router.get('/hostels/:slug', async (req, res, next) => {
  try {
    const hostel = await Hostel.findOne({ slug: req.params.slug, status: 'published' }).select(
      '-managers -paybillNumber -suspensionReason'
    );
    if (!hostel) return res.status(404).json({ success: false, message: 'Hostel not found.' });

    Hostel.updateOne({ _id: hostel._id }, { $inc: { viewCount: 1 } }).catch(() => {});

    const rooms = await Room.find({ hostel: hostel._id, isActive: true }).sort({ price: 1 });
    const reviews = await Review.find({ hostel: hostel._id, status: 'approved' })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('student', 'name university');

    res.json({ success: true, hostel, rooms, reviews });
  } catch (err) {
    next(err);
  }
});

// GET /api/public/rooms/:id
router.get('/rooms/:id', async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id).populate(
      'hostel',
      'name slug university location amenities contact gender coverImage status bookingFeeAmount'
    );
    if (!room || room.hostel?.status !== 'published') {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    Room.updateOne({ _id: room._id }, { $inc: { viewCount: 1 } }).catch(() => {});

    const reviews = await Review.find({ room: room._id, status: 'approved' })
      .sort({ createdAt: -1 })
      .populate('student', 'name university');

    res.json({ success: true, room, reviews });
  } catch (err) {
    next(err);
  }
});

// GET /api/public/stats — light platform stats for homepage
router.get('/stats', async (req, res, next) => {
  try {
    const [hostelCount, roomCount, availableRoomCount] = await Promise.all([
      Hostel.countDocuments({ status: 'published' }),
      Room.countDocuments({ isActive: true }),
      Room.countDocuments({ status: 'available', isActive: true }),
    ]);
    res.json({ success: true, stats: { hostelCount, roomCount, availableRoomCount } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
