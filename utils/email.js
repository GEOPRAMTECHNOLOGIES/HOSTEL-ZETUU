const nodemailer = require('nodemailer');

let transporter;
const getTransporter = () => {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
};

const baseWrapper = (title, bodyHtml) => `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:540px;margin:0 auto;background:#FAF6F0;padding:0;">
    <div style="background:#1B4332;padding:24px 28px;">
      <h1 style="color:#E8A33D;font-size:20px;margin:0;letter-spacing:0.5px;">HOSTELI ZETU</h1>
      <p style="color:#fff;opacity:.8;margin:4px 0 0;font-size:12px;">Your hostel, sorted.</p>
    </div>
    <div style="padding:28px;background:#fff;">
      <h2 style="color:#22272B;font-size:18px;margin-top:0;">${title}</h2>
      ${bodyHtml}
    </div>
    <div style="padding:16px 28px;color:#8a8a8a;font-size:11px;">
      © ${new Date().getFullYear()} Hosteli Zetu. This is an automated message — please do not reply.
    </div>
  </div>
`;

const sendOtpEmail = async (toEmail, code, purpose = 'login_verify') => {
  const purposeLabel = {
    login_verify: 'Verify this device',
    booking_verify: 'Confirm your booking',
    password_reset: 'Reset your password',
  }[purpose] || 'Verify your identity';

  const html = baseWrapper(
    purposeLabel,
    `
      <p style="color:#444;font-size:14px;">Use the code below. It expires in 10 minutes.</p>
      <div style="background:#FAF6F0;border:1px dashed #E8A33D;border-radius:8px;text-align:center;padding:18px;margin:18px 0;">
        <span style="font-size:32px;letter-spacing:8px;font-weight:700;color:#1B4332;">${code}</span>
      </div>
      <p style="color:#888;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
    `
  );

  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to: toEmail,
    subject: `${code} is your Hosteli Zetu verification code`,
    html,
  });
};

const sendBookingConfirmationEmail = async (toEmail, booking) => {
  const html = baseWrapper(
    'Booking confirmed 🎉',
    `
      <p style="color:#444;font-size:14px;">Your room reservation has been confirmed. Details below:</p>
      <table style="width:100%;font-size:13px;color:#333;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#888;">Booking Ref</td><td style="text-align:right;font-weight:700;">${booking.bookingRef}</td></tr>
        <tr><td style="padding:6px 0;color:#888;">Hostel</td><td style="text-align:right;">${booking.hostelName}</td></tr>
        <tr><td style="padding:6px 0;color:#888;">Room</td><td style="text-align:right;">${booking.roomTitle}</td></tr>
        <tr><td style="padding:6px 0;color:#888;">Move-in date</td><td style="text-align:right;">${new Date(booking.moveInDate).toDateString()}</td></tr>
        <tr><td style="padding:6px 0;color:#888;">Booking fee paid</td><td style="text-align:right;">KES ${booking.bookingFee}</td></tr>
        <tr><td style="padding:6px 0;color:#888;">M-Pesa Receipt</td><td style="text-align:right;">${booking.mpesaReceipt || '—'}</td></tr>
      </table>
      <p style="color:#444;font-size:13px;margin-top:18px;">Keep your booking reference handy — you'll need it to track or manage your booking.</p>
    `
  );

  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to: toEmail,
    subject: `Booking confirmed — ${booking.bookingRef}`,
    html,
  });
};

const sendAdminWelcomeEmail = async (toEmail, name, tempPassword) => {
  const html = baseWrapper(
    `Welcome to Hosteli Zetu, ${name}`,
    `
      <p style="color:#444;font-size:14px;">An account has been created for you to manage your hostel listing.</p>
      <p style="color:#444;font-size:13px;">Email: <strong>${toEmail}</strong><br/>Temporary password: <strong>${tempPassword}</strong></p>
      <p style="color:#888;font-size:12px;">Please log in and change your password immediately.</p>
    `
  );
  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to: toEmail,
    subject: 'Your Hosteli Zetu admin account',
    html,
  });
};

const sendAdminRegistrationReceivedEmail = async (toEmail, name, hostelName) => {
  const html = baseWrapper(
    `Thanks for registering, ${name}`,
    `
      <p style="color:#444;font-size:14px;">We've received your hostel registration for <strong>${hostelName}</strong>.</p>
      <p style="color:#444;font-size:13px;">Our team reviews every new listing before it goes live. You'll get an email as soon as your account and hostel are approved — usually within 1-2 business days.</p>
      <p style="color:#888;font-size:12px;">You don't need to do anything else right now.</p>
    `
  );
  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to: toEmail,
    subject: 'We got your Hosteli Zetu registration',
    html,
  });
};

const sendAdminApprovedEmail = async (toEmail, name) => {
  const html = baseWrapper(
    `You're approved, ${name} 🎉`,
    `
      <p style="color:#444;font-size:14px;">Your Hosteli Zetu admin account has been activated. You can now log in and finish setting up your hostel and rooms.</p>
      <p style="color:#888;font-size:12px;">Log in with the email and password you registered with.</p>
    `
  );
  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to: toEmail,
    subject: 'Your Hosteli Zetu account is approved',
    html,
  });
};

module.exports = {
  sendOtpEmail,
  sendBookingConfirmationEmail,
  sendAdminWelcomeEmail,
  sendAdminRegistrationReceivedEmail,
  sendAdminApprovedEmail,
};
