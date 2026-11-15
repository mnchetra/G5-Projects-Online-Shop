# Mekong Market

A modern bilingual English–Khmer e-commerce platform for Cambodian-made goods. Built with a Vue 3/Vite storefront and an Express REST API backed by MySQL and Prisma. Escrow and the demo wallet are database simulations; they do not custody or transfer real funds.

---

## Key Features

1. **Member-Only Purchase Flow & In-Page Checkout Gate:**
   - Guest visitors can freely browse, search, filter, and add items to their bag.
   - Ordering requires an account (`POST /api/orders` enforces authentication).
   - In-page **Step 1 (Login / Register)** at `/checkout` ensures guests don't lose their cart items and can sign in, register, or use 1-click demo access immediately before entering delivery details in **Step 2**.
   - Dedicated Auth UI at `/login` and `/register` with benefits showcase and password reveal.

2. **Database-Tracked Order Holds (Demo):**
   - The app records payment, shipment, buyer confirmation, dispute, and refund statuses in MySQL.
   - Buyer confirmation marks an order hold as released; it does not call or pay a smart contract.
   - The status tracker at `/escrow/:orderNumber` is available only to the order owner and administrators.
   - Admin Escrow Desk supports dispatch and dispute status management.

3. **Multi-Payment Support:**
   - **Demo Wallet** (admin-adjustable credits and transaction history; no real money)
   - **Bakong KHQR** (dynamic QR payment generation; this app does not custody funds)
   - **Cash on Delivery (COD)**

4. **Bilingual Localization (English & Khmer):**
   - Instant toggle between English and ភាសាខ្មែរ across all catalog views, checkout, account, and admin desks.

5. **MySQL Database on XAMPP phpMyAdmin:**
   - Fully relational schema managed via Prisma ORM on port `3307` (`online_shop_db`).

---

## Architecture

```text
frontend/                             Vue 3 + TypeScript + Vite
  src/components/                     Storefront, Admin Desk, and Escrow Desk
  src/views/                          Home, Catalog, Product, Cart, Checkout, Auth, Escrow, Admin
  src/stores/                         Pinia cart store and cookie-backed auth store
  src/router/                         Vue Router with auth & admin route guards
  src/i18n/                           English (en.json) & Khmer (km.json) translations
  src/services/                       Axios API client with error handling
backend/                              Express + TypeScript REST API
  contracts/                          Solidity smart contract (BakongEscrow.sol)
  src/controllers/                    Auth, catalog, order, escrow, payment handlers
  src/services/                       Catalog, order, payment, and database escrow status services
  src/routes/                         Public, customer, escrow, and admin API routes
  src/middleware/                     Auth (requireAuth, requireAdmin), rate limiting, Zod validation
  src/validators/                     Zod request schemas
  prisma/schema.prisma                MySQL data model (including wallet balances and transaction history)
  prisma/migrations/                  Database migrations
  prisma/seed.ts                      Bilingual categories, products, customer & admin seed data
docs/api.md                           REST endpoint reference and escrow request examples
```

---

## Requirements

- **Node.js:** 20+ and npm
- **Database:** MySQL on XAMPP (`http://localhost/phpmyadmin`) or MariaDB on port `3306`

---

## Quick Start (Run Locally)

### 1. Database Setup
1. Start **Apache** and **MySQL** in your **XAMPP Control Panel**.
2. Open **phpMyAdmin** (`http://localhost/phpmyadmin`) and create a database named `online_shop_db`.
3. Check `backend/.env`:
   ```env
   DATABASE_URL="mysql://root:@localhost:3306/online_shop_db"
   PORT=4000
   FRONTEND_ORIGIN="http://localhost:5173"
   ```

### 2. Backend API Setup
```powershell
# Install dependencies
npm --prefix backend install

# Generate Prisma client & run migrations
npm --prefix backend run db:generate
npm --prefix backend run db:deploy

# Seed demo categories, products, customer, and admin
npm --prefix backend run seed

# Start API server (port 4000)
npm --prefix backend run dev
```

### 3. Frontend Storefront Setup
In a second terminal:
```powershell
# Install dependencies
npm --prefix frontend install

# Start development server (port 5173)
npm --prefix frontend run dev
```

Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## Ready-to-Use Demo Accounts

| Role | Email | Password | Access |
| :--- | :--- | :--- | :--- |
| **Customer** | `customer@example.com` | `Customer12345!` | Shop, cart, in-page checkout, order history |
| **Administrator** | `admin@example.com` | `Admin12345!` | Market Desk (`/admin`), product catalog, orders, escrow arbitration |

> *Tip: You can also use the **1-Click Demo Login** buttons on the login page and checkout gate for instant evaluation.*

---

## Testing & Quality Assurance

```powershell
# Run backend tests (the escrow lifecycle suite writes orders; use an isolated test database)
npm --prefix backend test

# Run frontend tests (5 unit tests)
npm --prefix frontend test

# Verify production builds
npm --prefix backend run build
npm --prefix frontend run build
```

---

## Security & Reliability

- **Authentication & Sessions:** Passwords hashed with bcrypt; HTTP-only SameSite=Lax session cookies storing cryptographic SHA-256 tokens.
- **Order Protection:** Guests cannot place orders (`requireAuth` guard). Price recalculation and inventory decrements execute inside serializable database transactions.
- **Demo Wallet:** Admin credit/debit adjustments and checkout holds are recorded in an append-only transaction history. Balances are not cash, deposits, or withdrawable funds. Demo-wallet orders remain marked as held until the buyer confirms delivery; approved refunds restore the demo balance.
- **Escrow Status:** Shipment, confirmation, and dispute state changes are database-only. The Solidity source is not deployed or called by the backend, so this is not real smart-contract protection or payout.
- **Application Security:** Helmet security headers, credentialed CORS, Zod schema validation, API rate limiting, and parameterized Prisma queries prevent SQL injection and brute-force attacks.

See [docs/api.md](docs/api.md) for REST API endpoints and demo-wallet behavior.