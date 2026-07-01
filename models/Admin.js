const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema(
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
    phone: { type: String, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },

    role: {
      type: String,
      enum: ['super_admin', 'tenant_admin'],
      default: 'tenant_admin',
    },

    // For tenant_admin: which hostel(s) they manage. Empty for super_admin.
    hostels: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Hostel' }],

    status: {
      type: String,
      enum: ['active', 'suspended', 'pending'],
      default: 'pending',
    },

    avatar: { type: String, default: '' },

    // ---- Security hardening ----
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    lastLoginAt: { type: Date },
    lastLoginIp: { type: String },
    passwordChangedAt: { type: Date },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date },
    twoFactorEnabled: { type: Boolean, default: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

adminSchema.index({ role: 1, status: 1 });

adminSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  if (!this.isNew) this.passwordChangedAt = Date.now() - 1000;
  next();
});

adminSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

adminSchema.methods.registerFailedLogin = async function () {
  const MAX_ATTEMPTS = 5;
  const LOCK_TIME = 15 * 60 * 1000; // 15 minutes

  this.loginAttempts += 1;
  if (this.loginAttempts >= MAX_ATTEMPTS && !this.isLocked) {
    this.lockUntil = Date.now() + LOCK_TIME;
  }
  await this.save({ validateBeforeSave: false });
};

adminSchema.methods.registerSuccessfulLogin = async function (ip) {
  this.loginAttempts = 0;
  this.lockUntil = undefined;
  this.lastLoginAt = new Date();
  this.lastLoginIp = ip;
  await this.save({ validateBeforeSave: false });
};

module.exports = mongoose.model('Admin', adminSchema);
