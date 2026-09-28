# Hosteli Zetu — secure accommodation operating system

A fresh replacement application built around a single authenticated workspace. There is no public admin link, no visible admin route in navigation, and role-specific capabilities are returned only after authentication.

## Design
- Microsoft Fluent 2-inspired layout and interaction patterns
- Segoe UI system typography
- Safaricom/M-Pesa green used as the primary action color
- Responsive desktop/mobile workspace
- No admin/superadmin links in the public UI

## Security model
- HTTP-only signed session cookie
- Short-lived JWT access session
- Central role middleware
- Organization scoping
- Helmet CSP with `frame-ancestors: none`
- Rate limiting
- Mongo sanitization + HPP
- Auditable actions
- Payment idempotency indexes for M-Pesa receipt and checkout request IDs
- Financial payments are not treated as verified merely because a staff member enters a receipt number

## Environment
Use the existing Vercel environment variables. Copy `.env.example` only for documentation. Do not commit real secret values.

## First platform account
The bootstrap endpoint is intentionally not linked anywhere and returns 404 unless the request includes the configured `SUPER_ADMIN_SETUP_KEY`. After first initialization, bootstrap is permanently disabled.

## Run
`npm install && npm start`
