const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Student = require('../models/Student');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');
const Lease = require('../models/Lease');
const { TrustToken } = require('../models/misc');
const { sendOtpEmail } = require('../utils/email');
const { generateOtp, hashCode, signStudentToken } = require('../utils/helpers');
const { Otp } = require('../models/misc');

const router = express.Router();

async function studentAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.cookies?.hz_student_token;
    const trusted = req.headers['x-trusted-device'];
    let student;
    if (!token && trusted) {
      const tokenHash = crypto.createHash('sha256').update(String(trusted)).digest('hex');
      const trust = await TrustToken.findOne({ ownerType:'student', tokenHash, expiresAt:{ $gt:new Date() } });
      if (!trust) return res.status(401).json({ success:false, message:'Trusted device expired. Please verify again.' });
      student = await Student.findById(trust.ownerId);
    } else {
      if (!token) return res.status(401).json({ success: false, message: 'Student login required.' });
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.type !== 'student') return res.status(401).json({ success: false, message: 'Invalid student session.' });
      student = await Student.findById(decoded.id);
    }
    if (!student || student.status !== 'active') return res.status(401).json({ success: false, message: 'Student account unavailable.' });
    req.student = student;
    next();
  } catch (_) { return res.status(401).json({ success: false, message: 'Session expired.' }); }
}

router.get('/student', studentAuth, async (req, res, next) => {
  try {
    const [bookings, transactions, leases] = await Promise.all([
      Booking.find({ student: req.student._id }).sort({ createdAt: -1 }).limit(50).populate('hostel', 'name location').populate('room', 'title type price').populate('payment', 'status mpesaReceiptNumber amount'),
      Transaction.find({ student: req.student._id }).sort({ createdAt: -1 }).limit(100).populate('hostel', 'name').populate('room', 'title'),
      Lease.find({ student: req.student._id }).sort({ createdAt: -1 }).populate('hostel', 'name').populate('room', 'title price'),
    ]);
    const paid = transactions.filter(t => t.status === 'completed' && t.direction === 'credit').reduce((a,t) => a + t.amount, 0);
    res.json({ success: true, student: { id:req.student._id, name:req.student.name, email:req.student.email, phone:req.student.phone, university:req.student.university, admissionNo:req.student.admissionNo, isVerified:req.student.isVerified }, stats:{ totalPaid:paid, bookings:bookings.length, activeLeases:leases.filter(l=>l.status==='active').length }, bookings, transactions, leases });
  } catch (err) { next(err); }
});

router.post('/student/trust/request', studentAuth, async (req, res, next) => {
  try {
    const email = req.student.email;
    const { code, codeHash } = generateOtp();
    await Otp.create({ email, codeHash, purpose: 'trust_device', expiresAt: new Date(Date.now()+10*60*1000), ip:req.ip });
    await sendOtpEmail(email, code, 'login_verify');
    res.json({ success:true, message:'A trust verification code was sent to your registered email.' });
  } catch (err) { next(err); }
});

router.post('/student/trust/verify', studentAuth, async (req, res, next) => {
  try {
    const { code, fingerprint, label } = req.body;
    if (!code || !fingerprint) return res.status(400).json({success:false,message:'Verification code and device fingerprint are required.'});
    const otp = await Otp.findOne({ email:req.student.email, purpose:'trust_device', consumed:false }).sort({createdAt:-1});
    if (!otp || otp.expiresAt < new Date()) return res.status(400).json({success:false,message:'Code expired. Request a new code.'});
    if (otp.codeHash !== hashCode(code)) return res.status(400).json({success:false,message:'Incorrect code.'});
    otp.consumed = true; await otp.save();
    const raw = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
    await TrustToken.create({ ownerType:'student', ownerId:req.student._id, fingerprint, label:label||'Trusted device', tokenHash, expiresAt:new Date(Date.now()+30*24*60*60*1000) });
    res.json({success:true, token:raw, expiresInDays:30, message:'Device trusted for 30 days.'});
  } catch (err) { next(err); }
});

module.exports = router;
