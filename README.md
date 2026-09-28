# HOSTELI ZETU — Fluent Secure Workspace

A new role-aware hostel operations platform for Kenya. The public interface exposes only a sign-in/workspace experience; management capabilities are resolved server-side after authentication.

## Core modules
- Role-aware resident, reception, manager, accountant, owner and platform workspaces
- Hostel / room / bed operational model
- Invoices and payment intents
- Verified-payment ledger model
- Automated receipt architecture
- Registered-email notifications
- Trust & security center
- Audit events
- Microsoft Fluent-inspired responsive UI with Safaricom green

## Security model
The UI does not contain a public management link. This is not relied on as a security boundary: every protected API operation is authenticated and role-checked server-side. Property-scoped records should always be queried with the authenticated user's hostel scope.

## Environment
Use the existing Vercel project variables. The source contains no production secret values. Important variables include MONGO_URI, CLIENT_URL, JWT_SECRET, JWT_EXPIRES_IN, COOKIE_SECRET, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM and all MPESA_* variables.

## Run
npm install
npm start

For Vercel, api/index.js is the serverless entrypoint.
