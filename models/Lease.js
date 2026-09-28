const mongoose = require('mongoose');

const leaseSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  hostel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel', required: true, index: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  monthlyRent: { type: Number, required: true, min: 0 },
  deposit: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['active', 'ended', 'terminated'], default: 'active', index: true },
  notes: { type: String, trim: true },
}, { timestamps: true });

leaseSchema.index({ hostel: 1, status: 1 });
leaseSchema.index({ student: 1, status: 1 });

module.exports = mongoose.model('Lease', leaseSchema);
