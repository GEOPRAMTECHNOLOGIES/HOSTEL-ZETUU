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
  'REPLACE_WITH_A_LONG_RANDOM_SECRET',
  'REPLACE_WITH_A_DIFFERENT_LONG_RANDOM_SECRET',
  'REPLACE_WITH_A_ONE_TIME_SETUP_SECRET',
  // older placeholder wording, kept for safety
  'change_this_to_a_long_random_string',
  'change_this_too',
  'change_this_one_time_setup_key',
]);

function looksLikePlaceholder(value) {
  if (!value) return false;
  const v = value.toLowerCase();
  return (
    v.includes('yourdomain.com') ||
    v.includes('your_') ||
    v.includes('replace_with') ||
    v.includes('<user>') ||
    v.includes('<password>') ||
    v.includes('<cluster>')
  );
}

function validateMpesaAccountType() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) return;

  const accountType = (process.env.MPESA_ACCOUNT_TYPE || 'paybill').toLowerCase();
  if (!['paybill', 'till'].includes(accountType)) {
    console.error(`\n[STARTUP FAILED] MPESA_ACCOUNT_TYPE must be "paybill" or "till" (got "${process.env.MPESA_ACCOUNT_TYPE}").\n`);
    process.exit(1);
  }
  if (accountType === 'till' && !process.env.MPESA_TILL_NUMBER) {
    console.error('\n[STARTUP FAILED] MPESA_ACCOUNT_TYPE=till requires MPESA_TILL_NUMBER (your Buy Goods till number, e.g. 123456).\n');
    process.exit(1);
  }
  if (accountType === 'till' && looksLikePlaceholder(process.env.MPESA_TILL_NUMBER)) {
    console.error('\n[STARTUP FAILED] MPESA_TILL_NUMBER still looks like an unedited placeholder.\n');
    process.exit(1);
  }
}

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

  if (isProd) {
    const untouched = [...REQUIRED_ALWAYS, ...REQUIRED_PRODUCTION].filter((key) => looksLikePlaceholder(process.env[key]));
    if (untouched.length) {
      console.error('\n[STARTUP FAILED] These variables still look like unedited placeholders from .env.example:');
      untouched.forEach((key) => console.error(`   - ${key} = ${process.env[key]}`));
      console.error('\nThis usually means .env was copied from .env.example without being filled in. Fix these before deploying.\n');
      process.exit(1);
    }
  }

  if (isProd && process.env.MPESA_ENV !== 'production') {
    console.warn('[WARN] NODE_ENV=production but MPESA_ENV is not "production" — M-Pesa is still hitting the sandbox.');
  }

  if (isProd && process.env.MPESA_CALLBACK_URL && !process.env.MPESA_CALLBACK_URL.startsWith('https://')) {
    console.error('[STARTUP FAILED] MPESA_CALLBACK_URL must be HTTPS in production (Safaricom requires it).');
    process.exit(1);
  }

  validateMpesaAccountType();
}

module.exports = validateEnv;
