const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const bookingSchema = new mongoose.Schema(
  {
    bookingRef: { type: String, unique: true, default: () => `HZ-${uuidv4().split('-')[0].toUpperCase()}` },

    hostel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel', required: true, index: true },
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },

    studentSnapshot: {
      name: String,
      email: String,
      phone: String,
      university: String,
      admissionNo: String,
    },

    moveInDate: { type: Date, required: true },
    durationMonths: { type: Number, default: 1, min: 1 },

    roomPriceSnapshot: { type: Number, required: true },
    bookingFee: { type: Number, required: true }, // reservation fee paid via M-Pesa
    totalDue: { type: Number },

    status: {
      type: String,
      enum: ['pending_payment', 'confirmed', 'cancelled', 'expired', 'completed'],
      default: 'pending_payment',
      index: true,
    },

    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid', 'failed', 'refunded'],
      default: 'unpaid',
      index: true,
    },

    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },

    notes: { type: String },
    cancelReason: { type: String },
    expiresAt: { type: Date }, // hold expires if unpaid

    confirmedAt: { type: Date },
    cancelledAt: { type: Date },
  },
  { timestamps: true }
);

bookingSchema.index({ status: 1, paymentStatus: 1 });
bookingSchema.index({ hostel: 1, createdAt: -1 });

module.exports = mongoose.model('Booking', bookingSchema);
