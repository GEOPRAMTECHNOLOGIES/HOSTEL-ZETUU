# Deploying to Vercel — Quick Checklist

This app now has a proper Vercel serverless entrypoint (`api/index.js` +
`vercel.json`), separate from the Docker/PM2 entrypoint (`server.js`).
That structural mismatch was part of why deploys were crash-looping —
`server.js` called `process.exit(1)` on any DB error, which kills a
serverless function invocation outright. That's fixed now.

## 1. Set environment variables in Vercel
Project → **Settings → Environment Variables** → add every key from
`.env` (do NOT upload the `.env` file itself — Vercel ignores it anyway
per `.vercelignore`). At minimum:

- `MONGO_URI` — your real Atlas connection string (URL-encode special
  characters in the password)
- `JWT_SECRET`, `COOKIE_SECRET`, `SUPER_ADMIN_SETUP_KEY` — already
  generated for you in `.env`, copy them over
- `CLIENT_URL` — your production URL, e.g. `https://hostel-zetuu.vercel.app`
- SMTP_* and MPESA_* — your real provider/Daraja credentials

Apply to **Production, Preview, and Development** environments.

## 2. MongoDB Atlas network access
Atlas → **Network Access** → allow `0.0.0.0/0` (Vercel functions use
dynamic IPs, so a fixed IP allowlist won't work).

## 3. Deploy
```
vercel --prod
```
or push to the branch connected to your Vercel project.

## 4. Verify
Visit `/api/health` on your deployed URL — it should return
`{"success":true,"status":"ok","db":"connected", ...}`.
If it returns 503, the message will tell you it's a `MONGO_URI` problem
specifically (not a code crash).
