# Mekong Market

A bilingual English–Khmer shopping platform for Cambodian-made goods. The workspace contains a Vue 3/Vite storefront and admin dashboard, plus an Express REST API backed by PostgreSQL and Prisma.

## Architecture

```text
frontend/                         Vue 3 + TypeScript + Vite + Tailwind
  src/components/                 Shared storefront and admin components
  src/views/                      Home, catalog, detail, cart, checkout, account, admin
  src/stores/                     Persistent cart and cookie-backed account state (Pinia)
  src/router/                     Vue Router and administrator route guard
  src/i18n/                       English and Khmer UI translations
  src/services/                   API client
backend/                          Express + TypeScript REST API
  src/controllers/                HTTP handlers
  src/services/                   Auth, catalog, checkout, payment boundary
  src/routes/                     Public, customer, and admin API routes
  src/middleware/                 Auth, role checks, validation, errors
  src/validators/                 Zod request schemas
  prisma/schema.prisma            PostgreSQL data model
  prisma/migrations/              Initial database migration
  prisma/seed.ts                  Bilingual categories/products and optional admin
docs/api.md                       Endpoint reference and request examples
```

## Requirements

- Node.js 20 or newer and npm
- PostgreSQL 15 or newer

## Run Locally

1. Create a PostgreSQL database named `mekong_market` (or set a different connection URL).
2. Copy `backend/.env.example` to `backend/.env`; set `DATABASE_URL` and the frontend origin. Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` to create an administrator during seeding.
3. Copy `frontend/.env.example` to `frontend/.env` if the API is not at its default `http://localhost:4000/api` URL.
4. Install and initialize the API:

   ```powershell
   npm --prefix backend install
   npm --prefix backend run db:generate
   npm --prefix backend run db:deploy
   npm --prefix backend run db:seed
   npm --prefix backend run dev
   ```

5. In a second terminal, install and start the storefront:

   ```powershell
   npm --prefix frontend install
   npm --prefix frontend run dev
   ```

Open `http://localhost:5173`. API health is available at `http://localhost:4000/api/health`. The bundled bilingual catalog renders before the database is configured; checkout, accounts, and admin functions require the API and PostgreSQL.

The seeded admin can sign in at `/account` using the values configured in `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`, then open the admin desk. Do not use sample credentials in a deployed environment.

## Tests and Builds

```powershell
npm --prefix backend test
npm --prefix backend run build
npm --prefix frontend test
npm --prefix frontend run build
```

## Security and Operations

- Passwords use bcrypt; random, opaque session tokens are held in HttpOnly, SameSite=Lax cookies. Only SHA-256 token hashes are stored in PostgreSQL, and logout revokes the server-side session.
- Set `COOKIE_SECURE=true` behind HTTPS in production. Set an exact `FRONTEND_ORIGIN`; never use wildcard origins with credentials.
- Session tokens use cryptographic randomness; only SHA-256 hashes are stored. Expired sessions are removed when encountered or during a new sign-in.
- Helmet, credentialed CORS, request-size limits, API rate limiting, Zod validation, role checks, and Prisma parameterized queries are enabled.
- Checkout re-reads current product prices and decrements stock inside a serializable database transaction. Card data is not collected or stored. A payment-provider boundary is ready for future integration.
- Uploaded product images are signature-checked and stored locally under `backend/uploads/products`. For multi-instance production, connect the admin image flow to private object storage/CDN and validate allowed remote image hosts.
- Review dependency audit output and pin/update dependencies as part of deployment. Add HTTPS, database backups, monitoring, and a secret manager before launch.

See [docs/api.md](docs/api.md) for REST endpoints and examples.