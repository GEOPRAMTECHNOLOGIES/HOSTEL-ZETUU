const axios = require('axios');

const BASE_URL =
  process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

let cachedToken = null;
let tokenExpiry = 0;

/** Fetches (and caches) an OAuth access token from Safaricom Daraja API. */
const getAccessToken = async () => {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const auth = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString('base64');

  const { data } = await axios.get(
    `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } }
  );

  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (Number(data.expires_in) - 60) * 1000; // refresh 1 min early
  return cachedToken;
};

const timestampNow = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(
    d.getMinutes()
  )}${pad(d.getSeconds())}`;
};

const normalizePhone = (phone) => {
  let p = phone.replace(/\s+/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('0')) p = `254${p.slice(1)}`;
  if (p.startsWith('7') || p.startsWith('1')) p = `254${p}`;
  return p;
};

/**
 * Initiates an STK push (Lipa Na M-Pesa Online) for a booking fee.
 *
 * Supports both M-Pesa account types via MPESA_ACCOUNT_TYPE:
 *   - 'paybill' (default): TransactionType = CustomerPayBillOnline, PartyB = MPESA_SHORTCODE.
 *     AccountReference shows up on your paybill statement.
 *   - 'till': TransactionType = CustomerBuyGoodsOnline, PartyB = MPESA_TILL_NUMBER
 *     (the customer-facing Till/Buy Goods number). MPESA_SHORTCODE is still used for
 *     the OAuth password — Safaricom sometimes issues a separate API shortcode for a
 *     Till at registration; if yours is the same as the Till number, just set both
 *     env vars to that same value.
 *
 * Returns Safaricom's response containing CheckoutRequestID for tracking.
 */
const initiateStkPush = async ({ phone, amount, accountReference, description }) => {
  const token = await getAccessToken();
  const timestamp = timestampNow();
  const password = Buffer.from(
    `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
  ).toString('base64');

  const isTill = (process.env.MPESA_ACCOUNT_TYPE || 'paybill').toLowerCase() === 'till';
  const partyB = isTill ? (process.env.MPESA_TILL_NUMBER || process.env.MPESA_SHORTCODE) : process.env.MPESA_SHORTCODE;

  const payload = {
    BusinessShortCode: process.env.MPESA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: isTill ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline',
    Amount: Math.round(amount),
    PartyA: normalizePhone(phone),
    PartyB: partyB,
    PhoneNumber: normalizePhone(phone),
    CallBackURL: process.env.MPESA_CALLBACK_URL,
    AccountReference: accountReference.slice(0, 12),
    TransactionDesc: (description || 'Hosteli Zetu booking').slice(0, 13),
  };

  const { data } = await axios.post(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return data; // { MerchantRequestID, CheckoutRequestID, ResponseCode, ... }
};

/** Queries the status of a previously-initiated STK push. */
const queryStkStatus = async (checkoutRequestId) => {
  const token = await getAccessToken();
  const timestamp = timestampNow();
  const password = Buffer.from(
    `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
  ).toString('base64');

  const { data } = await axios.post(
    `${BASE_URL}/mpesa/stkpushquery/v1/query`,
    {
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  return data;
};

module.exports = { initiateStkPush, queryStkStatus, normalizePhone };
