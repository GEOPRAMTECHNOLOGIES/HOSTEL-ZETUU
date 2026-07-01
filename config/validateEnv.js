/**
 * Validates required environment variables at boot. Fails fast with a clear
 * message instead of limping along and failing confusingly later (e.g. a
 * silent JWT_SECRET=undefined, or M-Pesa calls 401-ing in production).
 */
const REQUIRED_ALWAYS = ['MONGO_URI', 'JWT_SECRET', 'COOKIE_SECRET', 'SUPER_ADMIN_SETUP_KEY'];

const REQUIRED_PRODUCTION = [
  'CLIENT_URL',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
  'EMAIL_FROM',
  'MPESA_CONSUMER_KEY',
  'MPESA_CONSUMER_SECRET',
  'MPESA_SHORTCODE',
  'MPESA_PASSKEY',
  'MPESA_CALLBACK_URL',
];

const WEAK_DEFAULTS = new Set([
  'change_this_to_a_long_random_string',
  'change_this_too',
  'change_this_one_time_setup_key',
]);

function validateEnv() {
  const isProd = process.env.NODE_ENV === 'production';
  const required = isProd ? [...REQUIRED_ALWAYS, ...REQUIRED_PRODUCTION] : REQUIRED_ALWAYS;

  const missing = required.filter((key) => !process.env[key] || process.env[key].trim() === '');
  const weak = REQUIRED_ALWAYS.filter((key) => WEAK_DEFAULTS.has(process.env[key]));

  if (missing.length) {
    console.error('\n[STARTUP FAILED] Missing required environment variables:');
    missing.forEach((key) => console.error(`   - ${key}`));
    console.error('\nCopy .env.example to .env and fill these in before starting the server.\n');
    process.exit(1);
  }

  if (isProd && weak.length) {
    console.error('\n[STARTUP FAILED] These secrets are still set to placeholder values from .env.example:');
    weak.forEach((key) => console.error(`   - ${key}`));
    console.error('\nGenerate real random secrets before running in production, e.g.:');
    console.error('   node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\n');
    process.exit(1);
  }

  if (isProd && process.env.MPESA_ENV !== 'production') {
    console.warn('[WARN] NODE_ENV=production but MPESA_ENV is not "production" — M-Pesa is still hitting the sandbox.');
  }

  if (isProd && process.env.MPESA_CALLBACK_URL && !process.env.MPESA_CALLBACK_URL.startsWith('https://')) {
    console.error('[STARTUP FAILED] MPESA_CALLBACK_URL must be HTTPS in production (Safaricom requires it).');
    process.exit(1);
  }
}

module.exports = validateEnv;
