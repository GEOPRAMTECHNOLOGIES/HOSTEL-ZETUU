const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/** Generates a 6-digit numeric OTP and its sha256 hash (the hash is what's stored). */
const generateOtp = () => {
  const code = String(crypto.randomInt(100000, 999999));
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  return { code, codeHash };
};

const hashCode = (code) => crypto.createHash('sha256').update(String(code)).digest('hex');

/** Issues a signed JWT for an admin session. */
const signAdminToken = (admin) =>
  jwt.sign({ id: admin._id, role: admin.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

/** Issues a signed JWT for a student session (used after OTP verification). */
const signStudentToken = (student) =>
  jwt.sign({ id: student._id, type: 'student' }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

const randomPassword = (len = 10) => crypto.randomBytes(len).toString('base64').slice(0, len);

module.exports = { generateOtp, hashCode, signAdminToken, signStudentToken, cookieOptions, randomPassword };
