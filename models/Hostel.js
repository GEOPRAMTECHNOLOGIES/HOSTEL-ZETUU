const mongoose = require('mongoose');

const hostelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    tagline: { type: String, trim: true, maxlength: 140 },
    description: { type: String, trim: true },

    university: { type: String, required: true, trim: true, index: true },
    location: {
      address: { type: String, required: true },
      area: { type: String, trim: true }, // e.g. "Kikuyu, near Main Gate"
      city: { type: String, default: 'Nairobi' },
      county: { type: String, trim: true },
      lat: Number,
      lng: Number,
      distanceFromCampus: { type: String }, // e.g. "5 min walk"
    },

    gender: {
      type: String,
      enum: ['mixed', 'male', 'female'],
      default: 'mixed',
    },

    amenities: [{ type: String, trim: true }], // WiFi, CCTV, Borehole water, Study room...
    coverImage: { type: String, default: '' },
    gallery: [{ url: String, caption: String }],
    introVideo: { type: String, default: '' },

    contact: {
      phone: String,
      whatsapp: String,
      email: String,
    },

    rules: [{ type: String, trim: true }],
    checkInTime: { type: String, default: '12:00 PM' },

    // Multi-tenancy: each hostel belongs to one tenant admin (owner/manager)
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
    managers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }],

    status: {
      type: String,
      enum: ['draft', 'pending_review', 'published', 'suspended'],
      default: 'draft',
      index: true,
    },
    suspensionReason: { type: String },

    featured: { type: Boolean, default: false },
    verified: { type: Boolean, default: false },

    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },

    totalRooms: { type: Number, default: 0 },
    availableRooms: { type: Number, default: 0 },

    viewCount: { type: Number, default: 0 },

    paybillNumber: { type: String, trim: true }, // landlord's own till/paybill if applicable
    bookingFeeAmount: { type: Number, default: 500 }, // KES reservation fee
  },
  { timestamps: true }
);

hostelSchema.index({ name: 'text', university: 'text', 'location.area': 'text' });
hostelSchema.index({ status: 1, university: 1 });

hostelSchema.pre('validate', function (next) {
  if (this.name && !this.slug) {
    this.slug =
      this.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') +
      '-' +
      Math.random().toString(36).slice(2, 7);
  }
  next();
});

module.exports = mongoose.model('Hostel', hostelSchema);
