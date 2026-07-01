const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email address'],
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      match: [/^(\+254|0)[17]\d{8}$/, 'Enter a valid Kenyan phone number'],
    },
    university: { type: String, trim: true },
    admissionNo: { type: String, trim: true },

    isVerified: { type: Boolean, default: false }, // email verified via OTP at least once
    status: { type: String, enum: ['active', 'blocked'], default: 'active' },

    savedRooms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Room' }],
    bookingsCount: { type: Number, default: 0 },

    lastSeenAt: { type: Date },
  },
  { timestamps: true }
);

studentSchema.index({ phone: 1 });

module.exports = mongoose.model('Student', studentSchema);
