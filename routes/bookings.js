const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const Student = require('../models/Student');
const Room = require('../models/Room');
const Hostel = require('../models/Hostel');
const Booking = require('../models/Booking');
const { Otp, DeviceVerification, Payment } = require('../models/misc');
const { generateOtp, hashCode, signStudentToken } = require('../utils/helpers');
const { sendOtpEmail } = require('../utils/email');
const { initiateStkPush } = require('../utils/mpesa');
const { otpLimiter, mpesaLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, message: errors.array()[0].msg });
  next();
};

/** Optional auth — attaches req.student if a valid student token is present. */
const optionalStudentAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.cookies?.hz_student_token;
    if (!token) return next();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type === 'student') {
      req.student = await Student.findById(decoded.id);
    }
  } catch (e) {
    /* ignore invalid token, proceed unauthenticated */
  }
  next();
};

/* --------------------------- OTP: request & verify --------------------------- */

// POST /api/bookings/otp/request  { email, name, phone, university, deviceFingerprint }
router.post(
  '/otp/request',
  otpLimiter,
  [
    body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('phone')
      .matches(/^(\+254|0)[17]\d{8}$/)
      .withMessage('Enter a valid Kenyan phone number'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { email, name, phone, university, admissionNo, deviceFingerprint } = req.body;

      // If this device was verified within the last 7 days for this email, skip OTP
      let student = await Student.findOne({ email });
      if (student && deviceFingerprint) {
        const existingDevice = await DeviceVerification.findOne({
          student: student._id,
          deviceFingerprint,
          expiresAt: { $gt: new Date() },
        });
        if (existingDevice) {
          const token = signStudentToken(student);
          return res.json({ success: true, skipOtp: true, token, student: publicStudent(student) });
        }
      }

      const { code, codeHash } = generateOtp();
      await Otp.create({
        email,
        codeHash,
        purpose: 'booking_verify',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        ip: req.ip,
      });

      // Upsert student record so booking flow has their details ready
      if (!student) {
        student = await Student.create({ name, email, phone, university, admissionNo });
      } else {
        student.name = name || student.name;
        student.phone = phone || student.phone;
        student.university = university || student.university;
        await student.save();
      }

      await sendOtpEmail(email, code, 'booking_verify');

      res.json({ success: true, skipOtp: false, message: 'Verification code sent to your email.' });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/bookings/otp/verify  { email, code, deviceFingerprint, deviceLabel }
router.post(
  '/otp/verify',
  otpLimiter,
  [body('email').isEmail().normalizeEmail(), body('code').isLength({ min: 6, max: 6 })],
  validate,
  async (req, res, next) => {
    try {
      const { email, code, deviceFingerprint, deviceLabel } = req.body;

      const otpDoc = await Otp.findOne({ email, purpose: 'booking_verify', consumed: false }).sort({ createdAt: -1 });
      if (!otpDoc) return res.status(400).json({ success: false, message: 'Code expired or not found. Request a new one.' });

      if (otpDoc.attempts >= otpDoc.maxAttempts) {
        return res.status(429).json({ success: false, message: 'Too many incorrect attempts. Request a new code.' });
      }

      if (otpDoc.codeHash !== hashCode(code)) {
        otpDoc.attempts += 1;
        await otpDoc.save();
        return res.status(400).json({ success: false, message: 'Incorrect code.' });
      }

      otpDoc.consumed = true;
      await otpDoc.save();

      const student = await Student.findOneAndUpdate(
        { email },
        { isVerified: true, lastSeenAt: new Date() },
        { new: true }
      );
      if (!student) return res.status(404).json({ success: false, message: 'Student record not found.' });

      if (deviceFingerprint) {
        await DeviceVerification.findOneAndUpdate(
          { student: student._id, deviceFingerprint },
          {
            deviceLabel,
            ip: req.ip,
            verifiedAt: new Date(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
          { upsert: true }
        );
      }

      const token = signStudentToken(student);
      res.json({ success: true, token, student: publicStudent(student) });
    } catch (err) {
      next(err);
    }
  }
);

function publicStudent(s) {
  return { id: s._id, name: s.name, email: s.email, phone: s.phone, university: s.university, isVerified: s.isVerified };
}

/* -------------------------------- Create booking ------------------------------- */

// POST /api/bookings  — creates a pending booking + initiates M-Pesa STK push
router.post(
  '/',
  mpesaLimiter,
  optionalStudentAuth,
  [
    body('roomId').notEmpty(),
    body('email').isEmail().normalizeEmail(),
    body('phone').matches(/^(\+254|0)[17]\d{8}$/),
    body('moveInDate').isISO8601().toDate(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { roomId, email, phone, moveInDate, durationMonths = 1, name, university, admissionNo } = req.body;

      const student =
        req.student || (await Student.findOne({ email }));
      if (!student || !student.isVerified) {
        return res.status(403).json({ success: false, message: 'Please verify your email before booking.' });
      }

      const room = await Room.findById(roomId).populate('hostel');
      if (!room || room.status !== 'available' || room.hostel?.status !== 'published') {
        return res.status(400).json({ success: false, message: 'This room is no longer available.' });
      }

      const bookingFee = room.hostel.bookingFeeAmount || 500;

      const booking = await Booking.create({
        hostel: room.hostel._id,
        room: room._id,
        student: student._id,
        studentSnapshot: { name: name || student.name, email, phone, university: university || student.university, admissionNo },
        moveInDate,
        durationMonths,
        roomPriceSnapshot: room.price,
        bookingFee,
        totalDue: room.price * durationMonths,
        status: 'pending_payment',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min hold
      });

      // Reserve the room optimistically
      room.status = 'booked';
      await room.save();

      const payment = await Payment.create({
        booking: booking._id,
        student: student._id,
        hostel: room.hostel._id,
        amount: bookingFee,
        phone,
        status: 'initiated',
      });

      try {
        const stk = await initiateStkPush({
          phone,
          amount: bookingFee,
          accountReference: booking.bookingRef,
          description: `${room.hostel.name} booking`,
        });

        payment.merchantRequestId = stk.MerchantRequestID;
        payment.checkoutRequestId = stk.CheckoutRequestID;
        payment.status = 'pending';
        await payment.save();

        booking.payment = payment._id;
        await booking.save();

        res.status(201).json({
          success: true,
          message: 'Enter your M-Pesa PIN on your phone to complete the booking fee payment.',
          bookingRef: booking.bookingRef,
          checkoutRequestId: stk.CheckoutRequestID,
        });
      } catch (stkErr) {
        payment.status = 'failed';
        payment.resultDesc = stkErr.message;
        await payment.save();
        room.status = 'available';
        await room.save();
        return res.status(502).json({ success: false, message: 'Could not initiate M-Pesa payment. Please try again.' });
      }
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/bookings/track/:ref — public booking status lookup
router.get('/track/:ref', async (req, res, next) => {
  try {
    const booking = await Booking.findOne({ bookingRef: req.params.ref })
      .populate('hostel', 'name location contact')
      .populate('room', 'title type price')
      .populate('payment', 'status mpesaReceiptNumber amount');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
    res.json({ success: true, booking });
  } catch (err) {
    next(err);
  }
});

// GET /api/bookings/status/:checkoutRequestId — frontend polls this after STK push
router.get('/status/:checkoutRequestId', async (req, res, next) => {
  try {
    const payment = await Payment.findOne({ checkoutRequestId: req.params.checkoutRequestId });
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found.' });
    res.json({ success: true, status: payment.status, resultDesc: payment.resultDesc });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
