const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Hostel = require('../models/Hostel');

/**
 * Verifies the JWT (from cookie or Authorization header), loads the admin,
 * and attaches it to req.admin. Blocks suspended/locked accounts.
 */
const protectAdmin = async (req, res, next) => {
  try {
    let token;
    if (req.cookies && req.cookies.hz_token) {
      token = req.cookies.hz_token;
    } else if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authenticated. Please log in.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.id);

    if (!admin) {
      return res.status(401).json({ success: false, message: 'Account no longer exists.' });
    }
    if (admin.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Account is not active. Contact platform support.' });
    }
    if (admin.isLocked) {
      return res.status(423).json({ success: false, message: 'Account temporarily locked due to failed logins.' });
    }
    // Invalidate tokens issued before a password change
    if (admin.passwordChangedAt) {
      const changedTimestamp = Math.floor(admin.passwordChangedAt.getTime() / 1000);
      if (decoded.iat < changedTimestamp) {
        return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
      }
    }

    req.admin = admin;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired session.' });
  }
};

/** Restrict route to one or more roles, e.g. requireRole('super_admin') */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.admin || !roles.includes(req.admin.role)) {
    return res.status(403).json({ success: false, message: 'You do not have permission to do this.' });
  }
  next();
};

/**
 * Ensures a tenant_admin can only act on hostels they own/manage.
 * super_admin bypasses this check.
 * Expects :hostelId or :id (hostel) route param, or req.body.hostel.
 */
const enforceTenantOwnership = async (req, res, next) => {
  try {
    if (req.admin.role === 'super_admin') return next();

    const hostelId = req.params.hostelId || req.params.id || req.body.hostel;
    if (!hostelId) {
      return res.status(400).json({ success: false, message: 'Hostel reference is required.' });
    }

    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found.' });
    }

    const isOwner = hostel.owner.toString() === req.admin._id.toString();
    const isManager = hostel.managers.some((m) => m.toString() === req.admin._id.toString());

    if (!isOwner && !isManager) {
      return res.status(403).json({ success: false, message: 'You do not manage this hostel.' });
    }

    req.hostel = hostel;
    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Authorization check failed.' });
  }
};

module.exports = { protectAdmin, requireRole, enforceTenantOwnership };
