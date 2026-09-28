const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const transactionSchema = new mongoose.Schema({
  transactionRef: { type: String, unique: true, default: () => `HZ-TX-${uuidv4().split('-')[0].toUpperCase()}` },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', index: true },
  hostel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel', required: true, index: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  type: { type: String, enum: ['booking_fee', 'rent', 'deposit', 'utility', 'other'], default: 'booking_fee', index: true },
  direction: { type: String, enum: ['credit', 'debit'], default: 'credit' },
  amount: { type: Number, required: true, min: 0 },
  method: { type: String, enum: ['mpesa', 'cash', 'bank', 'other'], default: 'mpesa' },
  status: { type: String, enum: ['pending', 'completed', 'failed', 'reversed'], default: 'completed', index: true },
  mpesaReceiptNumber: { type: String, index: true },
  description: { type: String, trim: true },
  metadata: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

transactionSchema.index({ hostel: 1, createdAt: -1 });
transactionSchema.index({ student: 1, createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
