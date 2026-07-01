# Hosteli Zetu

Multi-tenant university hostel booking platform for Kenya — students browse verified hostels, see live room availability, and reserve a room with an M-Pesa STK push booking fee. Hostel landlords get their own dashboard; a platform super admin approves listings and oversees everything.

## Stack

- **Backend:** Node.js, Express, MongoDB (Mongoose)
- **Auth:** JWT (httpOnly cookie + Bearer), bcrypt password hashing, account lockout
- **Payments:** M-Pesa Daraja API (STK Push / Lipa Na M-Pesa Online)
- **Email:** Nodemailer (OTP codes, booking confirmations, admin invites)
- **Frontend:** Vanilla HTML / CSS / JS (no build step) — served as static files by Express
- **Security:** helmet, express-rate-limit, express-mongo-sanitize, hpp, input validation, JWT session invalidation on password change, tenant-ownership enforcement middleware

## 1. Install

```bash
npm install
cp .env.example .env
```

Fill in `.env` with your real values (MongoDB URI, JWT secret, SMTP creds, Daraja API keys).

## 2. Run locally

```bash
# make sure MongoDB is running, e.g.:
# mongod --dbpath ./data

npm run dev      # nodemon, auto-reload
# or
npm start
```

The app serves both the API (`/api/...`) and the frontend (`/`) on the same port (default `5000`).

## 3. Create the first Super Admin

Set `SUPER_ADMIN_SETUP_KEY` in `.env` to a long random secret, then call the one-time setup endpoint:

```bash
curl -X POST http://localhost:5000/api/setup/super-admin \
  -H "Content-Type: application/json" \
  -d '{
    "setupKey": "YOUR_SUPER_ADMIN_SETUP_KEY",
    "name": "Platform Owner",
    "email": "owner@hostelizetu.com",
    "password": "a-very-strong-password"
  }'
```

This route locks itself automatically once a super_admin already exists, so it's safe to leave the route in production. Rotate/remove `SUPER_ADMIN_SETUP_KEY` afterwards if you want extra safety.

Then log in at `/superadmin-login.html`.

## 4. M-Pesa (Daraja) setup

1. Create a Safaricom Daraja app at https://developer.safaricom.co.ke and get your Consumer Key/Secret.
2. For sandbox testing use shortcode `174379` and the sandbox passkey from the Daraja docs.
3. Set `MPESA_CALLBACK_URL` to a **publicly reachable** HTTPS URL pointing at `/api/mpesa/callback` (use ngrok in development: `ngrok http 5000`, then set the callback to `https://<id>.ngrok.io/api/mpesa/callback`).
4. Switch `MPESA_ENV=production` and use your live shortcode/passkey when going live.

## 5. Folder structure

```
hosteli-zetu/
├── server.js                # Express app entrypoint
├── config/db.js             # MongoDB connection
├── models/                  # Admin, Hostel, Room, Booking, Student, misc (Review/Otp/DeviceVerification/Payment)
├── middleware/               # auth, rate limiters, error handler
├── routes/                  # auth, public, bookings, mpesa-callback, admin, superadmin, setup
├── utils/                   # email.js, mpesa.js, helpers.js
└── public/                  # static frontend
    ├── index.html            # homepage: hero, search, featured hostels
    ├── hostel.html            # hostel detail: gallery, rooms, reviews
    ├── room.html              # room detail + OTP + M-Pesa booking flow
    ├── track.html             # booking reference lookup
    ├── admin-login.html       # shared login (routes by role)
    ├── admin-dashboard.html   # tenant admin dashboard (hostels/rooms/bookings/reviews)
    ├── superadmin-login.html
    ├── superadmin-dashboard.html  # platform-wide analytics + approvals + admin management
    └── css/js                # design system, dashboard styles, page scripts
```

## 6. Roles

| Role | Access |
|---|---|
| **Student** | No password account — verified per-session via email OTP; device stays trusted for 7 days |
| **tenant_admin** | Manages only the hostel(s) they own/are assigned to manage |
| **super_admin** | Full platform access: approve/suspend hostels, create tenant admins, moderate reviews, view platform-wide analytics |

New hostels created by a `tenant_admin` start in `pending_review` and only appear publicly once a `super_admin` approves them from **Approvals** in the super admin dashboard.

## 7. Deploying

Any Node host works (Render, Railway, Fly.io, a VPS with PM2 + nginx, etc.):

1. Push this project to your host / git remote.
2. Set all variables from `.env.example` in the host's environment settings.
3. Point MongoDB at a managed cluster (e.g. MongoDB Atlas) via `MONGO_URI`.
4. Set `MPESA_CALLBACK_URL` to your real deployed domain.
5. Build/start command: `npm install && npm start`.
6. Put the app behind HTTPS (required by Safaricom for the callback URL).

## 8. Security notes

- Passwords hashed with bcrypt (cost 12); failed logins lock the account for 15 minutes after 5 attempts.
- JWT sessions are invalidated the moment a password changes.
- All admin routes enforce tenant ownership — a `tenant_admin` cannot read or modify another landlord's hostel, rooms, bookings, or reviews.
- Rate limiting on login, OTP requests, and M-Pesa initiation to prevent abuse.
- `express-mongo-sanitize` + `hpp` guard against NoSQL injection and parameter pollution.
- M-Pesa callback always responds `200` immediately (per Safaricom's requirement) and verifies the payment server-side before marking a booking confirmed — the client never marks its own payment as successful.
