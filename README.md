# Hosteli Zetu

Multi-tenant university hostel booking platform for Kenya — students browse verified hostels, see live room availability, and reserve a room with an M-Pesa STK push booking fee. Hostel landlords get their own dashboard; a platform super admin approves listings and oversees everything.

**This package is configured for production by default.** `npm start` runs with `NODE_ENV=production` regardless of what's in your shell, `.env.example` ships with production defaults (`NODE_ENV=production`, `MPESA_ENV=production`), and the app refuses to boot in production if any required secret is missing or still a placeholder (see `config/validateEnv.js`). Docker and PM2 configs are included for real deployment — see **Section 9** below.

## Stack

- **Backend:** Node.js, Express, MongoDB (Mongoose)
- **Auth:** JWT (httpOnly cookie + Bearer), bcrypt password hashing, account lockout
- **Payments:** M-Pesa Daraja API (STK Push / Lipa Na M-Pesa Online)
- **Email:** Nodemailer (OTP codes, booking confirmations, admin invites)
- **Frontend:** Vanilla HTML / CSS / JS (no build step) — served as static files by Express
- **Security:** helmet (strict CSP), express-rate-limit, express-mongo-sanitize, hpp, input validation, JWT session invalidation on password change, tenant-ownership enforcement middleware, boot-time env validation, graceful shutdown

## 1. Install & configure for production

```bash
npm ci                   # installs exactly what's in package-lock.json
cp .env.example .env
```

Open `.env` and replace **every** placeholder with real values — your MongoDB Atlas URI, freshly generated secrets, real SMTP credentials, and your **live** M-Pesa Daraja shortcode/passkey. The app will not start until you do (see the validation checklist in Section 9).

```bash
npm start                 # NODE_ENV=production is forced by this script
```

The app serves both the API (`/api/...`) and the frontend (`/`) on the same port (default `5000`). For real deployment, use Docker or PM2 behind nginx/TLS — see Section 9.

## 2. Running locally in development mode

Production mode expects real Mongo/SMTP/M-Pesa credentials, which you may not have while developing. To run against a local Mongo instance with relaxed validation:

```bash
# make sure MongoDB is running locally, e.g.:
# mongod --dbpath ./data

npm run dev       # forces NODE_ENV=development, nodemon auto-reload
```

In development mode, only `MONGO_URI`, `JWT_SECRET`, `COOKIE_SECRET`, and `SUPER_ADMIN_SETUP_KEY` are required — email/M-Pesa/production checks are skipped so you can build without live credentials.


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

Hosteli Zetu supports **both** M-Pesa account types — pick the one that matches what you actually have:

| | Till Number (Buy Goods) | Paybill |
|---|---|---|
| Typical for | Individuals, small businesses | Larger/registered organizations |
| Customer enters | Till Number only | Paybill number + Account Number |
| Set in `.env` | `MPESA_ACCOUNT_TYPE=till` | `MPESA_ACCOUNT_TYPE=paybill` |

### Getting a Till Number

If you don't have one yet: open the **M-PESA app → Lipa na M-Pesa → Buy Goods and Services → Become a Merchant** (or visit any Safaricom shop / dial `*234#`) to apply for a **Buy Goods Till Number**. Approval is usually same-day for individuals. Once approved, Safaricom gives you:
- Your **Till Number** — the number customers see and pay to → put this in `MPESA_TILL_NUMBER`
- An **API/Shortcode** for Lipa Na M-Pesa Online — for most individual Till accounts this is the *same number* as your Till Number, so `MPESA_SHORTCODE` and `MPESA_TILL_NUMBER` will usually match. Safaricom will tell you explicitly if they issue you a different one.

### Registering with Daraja (needed either way)

1. Create a Safaricom Daraja app at **https://developer.safaricom.co.ke** and get your `MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET`.
2. For **sandbox testing** before going live, use the test shortcode `174379` and the sandbox passkey published on the Daraja docs test-credentials page — set `MPESA_ENV=sandbox` and `MPESA_ACCOUNT_TYPE=paybill` for this, regardless of your real account type (the sandbox only simulates Paybill).
3. Set `MPESA_CALLBACK_URL` to a **publicly reachable HTTPS URL** pointing at `/api/mpesa/callback` (use ngrok while developing: `ngrok http 5000`, then set the callback to `https://<id>.ngrok-free.app/api/mpesa/callback`).
4. To go live: apply for **Go-Live** on the Daraja portal using your real Till/Paybill number, get your live `MPESA_PASSKEY` from Safaricom, then switch `MPESA_ENV=production` with your real shortcode/till number and a real HTTPS callback URL on your deployed domain.

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

## 7. Quick deploy notes (any Node host)

Any Node host works (Render, Railway, Fly.io, a VPS with PM2 + nginx, etc.):

1. Push this project to your host / git remote.
2. Set all variables from `.env.example` in the host's environment settings.
3. Point MongoDB at a managed cluster (e.g. MongoDB Atlas) via `MONGO_URI`.
4. Set `MPESA_CALLBACK_URL` to your real deployed domain.
5. Build/start command: `npm ci && npm start`.
6. Put the app behind HTTPS (required by Safaricom for the callback URL).

## 8. Security notes

- Passwords hashed with bcrypt (cost 12); failed logins lock the account for 15 minutes after 5 attempts.
- JWT sessions are invalidated the moment a password changes.
- All admin routes enforce tenant ownership — a `tenant_admin` cannot read or modify another landlord's hostel, rooms, bookings, or reviews.
- Rate limiting on login, OTP requests, and M-Pesa initiation to prevent abuse.
- `express-mongo-sanitize` + `hpp` guard against NoSQL injection and parameter pollution.
- M-Pesa callback always responds `200` immediately (per Safaricom's requirement) and verifies the payment server-side before marking a booking confirmed — the client never marks its own payment as successful.
- On boot, `config/validateEnv.js` fails fast if required secrets are missing, or still set to the `.env.example` placeholder values, when `NODE_ENV=production`.

## 9. Production deployment (detailed)

### Generate real secrets

Never ship with the placeholder values from `.env.example`. Generate strong ones:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Run that three times for `JWT_SECRET`, `COOKIE_SECRET`, and `SUPER_ADMIN_SETUP_KEY`.

### Option A — Docker (recommended)

```bash
cp .env.example .env   # fill in real production values, including MPESA_ENV=production
docker compose up -d --build
```

This runs the app plus a MongoDB container with a persistent volume, restart policies, and health checks. Put the app behind a TLS-terminating reverse proxy (see `deploy/nginx.conf.example`) or your platform's managed load balancer.

For a managed Mongo cluster instead of the bundled container (recommended for real production traffic), just remove the `mongo` service from `docker-compose.yml` and set `MONGO_URI` in `.env` to your MongoDB Atlas connection string.

### Option B — PM2 on a VPS

```bash
npm ci --omit=dev
cp .env.example .env   # fill in production values
npm install -g pm2
mkdir -p logs
npm run pm2:start      # runs in cluster mode across CPU cores, auto-restarts on crash
pm2 save
pm2 startup            # follow the printed instructions to start PM2 on server boot
```

Put nginx in front of it using `deploy/nginx.conf.example` as a starting point (fill in your domain and TLS cert paths — `certbot --nginx` handles issuance/renewal on Ubuntu/Debian).

### Option C — Render / Railway / Fly.io

1. Push this repo to GitHub.
2. Create a new Web Service pointing at it. Build command: `npm ci`. Start command: `npm start`.
3. Add every variable from `.env.example` in the platform's environment settings, with real production values.
4. Point `MONGO_URI` at MongoDB Atlas (these platforms don't run stateful databases well themselves).
5. Once deployed, set `MPESA_CALLBACK_URL` to `https://<your-app>.onrender.com/api/mpesa/callback` (or your custom domain) and update it in your Safaricom Daraja app config too.

### Production checklist

- [ ] `NODE_ENV=production` set in the environment
- [ ] All secrets regenerated (not the `.env.example` placeholders) — the app refuses to boot otherwise
- [ ] `MONGO_URI` points at a real, backed-up database (Atlas or a self-managed replica set)
- [ ] `MPESA_ENV=production` with your live shortcode/passkey, and `MPESA_CALLBACK_URL` is a real HTTPS URL
- [ ] `MPESA_ACCOUNT_TYPE` matches what you actually have (`till` for Buy Goods, `paybill` otherwise), and `MPESA_TILL_NUMBER` is set if using Till
- [ ] SMTP credentials are for a real mailbox (not a personal Gmail password — use an app password or a transactional provider)
- [ ] TLS/HTTPS is terminated in front of the app (nginx, or your platform's built-in TLS)
- [ ] `/api/health` is wired into your host's or process manager's health checks
- [ ] First super admin created via `/api/setup/super-admin`, then treat `SUPER_ADMIN_SETUP_KEY` as compromised-if-leaked and rotate it
- [ ] Regular MongoDB backups configured (Atlas does this automatically on paid tiers)

