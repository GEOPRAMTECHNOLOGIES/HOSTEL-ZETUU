const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel', required: true, index: true },

    roomNumber: { type: String, trim: true },
    type: {
      type: String,
      enum: ['single', 'double', 'bedsitter', 'one_bedroom', 'shared_4', 'shared_6', 'studio'],
      required: true,
    },
    title: { type: String, required: true, trim: true }, // "Single Room - Wing B"

    price: { type: Number, required: true, min: 0 }, // per month, KES
    deposit: { type: Number, default: 0 },

    capacity: { type: Number, default: 1, min: 1 },
    floor: { type: String },

    amenities: [{ type: String, trim: true }], // ensuite, balcony, study desk...
    images: [{ url: String, caption: String }],
    video: { type: String, default: '' },

    status: {
      type: String,
      enum: ['available', 'booked', 'occupied', 'maintenance', 'unlisted'],
      default: 'available',
      index: true,
    },

    availableFrom: { type: Date, default: Date.now },

    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

roomSchema.index({ hostel: 1, status: 1, isActive: 1 });
roomSchema.index({ price: 1 });

module.exports = mongoose.model('Room', roomSchema);
