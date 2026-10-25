# Mekong Market

A modern bilingual English–Khmer e-commerce platform for Cambodian-made goods. Built with a Vue 3/Vite storefront, an Express REST API backed by MySQL (XAMPP phpMyAdmin) & Prisma, and a **Bakong Smart Contract Escrow Service** for safe, dispute-protected online payments.

---

## Key Features

1. **Member-Only Purchase Flow & In-Page Checkout Gate:**
   - Guest visitors can freely browse, search, filter, and add items to their bag.
   - Ordering requires an account (`POST /api/orders` enforces authentication).
   - In-page **Step 1 (Login / Register)** at `/checkout` ensures guests don't lose their cart items and can sign in, register, or use 1-click demo access immediately before entering delivery details in **Step 2**.
   - Dedicated Auth UI at `/login` and `/register` with benefits showcase and password reveal.

2. **Bakong Smart Escrow Payment Service (Smart Contract):**
   - Implemented via Ethereum/EVM-compatible smart contract ([BakongEscrow.sol](backend/contracts/BakongEscrow.sol)).
   - **Protection:** Funds are locked in a smart contract vault via Bakong KHQR until the buyer inspects and confirms delivery.
   - **Escrow Lifecycle:** `INITIATED` ➜ `LOCKED` ➜ `DISPATCHED` ➜ `RELEASED` (or `DISPUTED` ➜ `REFUNDED`).
   - Dedicated interactive on-chain tracker at `/escrow/:orderNumber`.
   - Admin Escrow Desk for arbitrating disputes and monitoring vault balances.

3. **Multi-Payment Support:**
   - **Bakong Smart Escrow** (Smart contract on-chain protection)
   - **Bakong KHQR** (Dynamic QR payment generation)
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
  src/services/                       Catalog, order, payment, and smart contract escrow service
  src/routes/                         Public, customer, escrow, and admin API routes
  src/middleware/                     Auth (requireAuth, requireAdmin), rate limiting, Zod validation
  src/validators/                     Zod request schemas
  prisma/schema.prisma                MySQL data model (User, Order, EscrowRecord, Product, Category)
  prisma/migrations/                  Database migrations
  prisma/seed.ts                      Bilingual categories, products, customer & admin seed data
docs/api.md                           REST endpoint reference and escrow request examples
```

---

## Requirements

- **Node.js:** 20+ and npm
- **Database:** MySQL on XAMPP (`http://localhost/phpmyadmin`) or MariaDB on port `3307` (or `3306`)

---

## Quick Start (Run Locally)

### 1. Database Setup
1. Start **Apache** and **MySQL** in your **XAMPP Control Panel**.
2. Open **phpMyAdmin** (`http://localhost/phpmyadmin`) and create a database named `online_shop_db`.
3. Check `backend/.env`:
   ```env
   DATABASE_URL="mysql://root:@localhost:3307/online_shop_db"
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
# Run backend test suite (16 tests including escrow lifecycle)
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
- **Smart Contract Escrow:** On-chain escrow vault balances, buyer inspection deadlines, and multi-signature arbitration ensure fraud-free transactions.
- **Application Security:** Helmet security headers, credentialed CORS, Zod schema validation, API rate limiting, and parameterized Prisma queries prevent SQL injection and brute-force attacks.

See [docs/api.md](docs/api.md) for REST API endpoints and escrow contract reference.