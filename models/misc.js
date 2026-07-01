const mongoose = require('mongoose');

/* ---------------------------------- Review ---------------------------------- */
const reviewSchema = new mongoose.Schema(
  {
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel', required: true, index: true },
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }, // proof of stay

    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000 },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    moderationNote: { type: String },
  },
  { timestamps: true }
);
reviewSchema.index({ hostel: 1, status: 1 });

/* ----------------------------------- OTP ------------------------------------ */
const otpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    codeHash: { type: String, required: true }, // store hashed, never plain
    purpose: {
      type: String,
      enum: ['login_verify', 'booking_verify', 'password_reset'],
      default: 'login_verify',
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }, // TTL index
    consumed: { type: Boolean, default: false },
    ip: { type: String },
  },
  { timestamps: true }
);

/* ----------------------------- DeviceVerification ---------------------------- */
const deviceVerificationSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    deviceFingerprint: { type: String, required: true, index: true },
    deviceLabel: { type: String }, // e.g. "Chrome on Windows"
    ip: { type: String },
    verifiedAt: { type: Date, default: Date.now },
    // Weekly re-verification: this token is valid for 7 days from verifiedAt
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true }
);
deviceVerificationSchema.index({ student: 1, deviceFingerprint: 1 }, { unique: true });

/* ---------------------------------- Payment ---------------------------------- */
const paymentSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel', required: true },

    amount: { type: Number, required: true },
    phone: { type: String, required: true },

    method: { type: String, enum: ['mpesa'], default: 'mpesa' },

    // M-Pesa STK push tracking fields
    merchantRequestId: { type: String },
    checkoutRequestId: { type: String, index: true },
    mpesaReceiptNumber: { type: String, index: true },
    transactionDate: { type: String },

    status: {
      type: String,
      enum: ['initiated', 'pending', 'success', 'failed', 'cancelled', 'timeout'],
      default: 'initiated',
      index: true,
    },
    resultCode: { type: String },
    resultDesc: { type: String },

    rawCallback: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);
paymentSchema.index({ status: 1, createdAt: -1 });

module.exports = {
  Review: mongoose.model('Review', reviewSchema),
  Otp: mongoose.model('Otp', otpSchema),
  DeviceVerification: mongoose.model('DeviceVerification', deviceVerificationSchema),
  Payment: mongoose.model('Payment', paymentSchema),
};
