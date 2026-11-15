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

## 🚀 Complete Setup Guide for Fresh Clones

Follow these steps right after cloning the repository (`git clone ...`) to get the backend, frontend, database, and demo accounts completely functional.

---

### Step 1: Start MySQL in XAMPP & Create Database
1. Open the **XAMPP Control Panel** (or Laragon / MariaDB) and click **Start** next to **Apache** and **MySQL**.
2. Note your MySQL port in the XAMPP Control Panel:
   - Typically **3306** (default) or **3307** (if port 3306 was already occupied).
3. Open your browser and navigate to **phpMyAdmin**: [http://localhost/phpmyadmin](http://localhost/phpmyadmin).
4. In the left sidebar, click **New**.
5. Set the database name to: `online_shop_db`
6. Set collation to: `utf8mb4_unicode_ci` and click **Create**.

---

### Step 2: Configure Environment Files (`.env`)
Environment files are git-ignored for security and must be created from their `.env.example` templates.

#### 2.1 Backend `.env`
In your terminal:
```powershell
# PowerShell:
Copy-Item backend/.env.example backend/.env

# Or Bash / Git Bash:
cp backend/.env.example backend/.env
```

Open `backend/.env` in your editor and verify your `DATABASE_URL`:
- **If your MySQL is on port 3306 (default):**
  ```env
  DATABASE_URL="mysql://root:@localhost:3306/online_shop_db"
  ```
- **If your MySQL is on port 3307:**
  ```env
  DATABASE_URL="mysql://root:@localhost:3307/online_shop_db"
  ```
> ⚠️ **Important:** The protocol MUST be `mysql://`. Do not use `postgresql://` and ensure there are no duplicate `DATABASE_URL=` strings. If your MySQL `root` user has a password, format it like `mysql://root:yourpassword@localhost:3306/online_shop_db`.

#### 2.2 Frontend `.env`
```powershell
# PowerShell:
Copy-Item frontend/.env.example frontend/.env

# Or Bash / Git Bash:
cp frontend/.env.example frontend/.env
```
Ensure it points to the local backend API:
```env
VITE_API_URL=http://localhost:4000/api
```

---

### Step 3: Backend Setup (Install, Migrate & Seed)
Open a terminal in the root folder:

```powershell
# 1. Navigate to backend directory
cd backend

# 2. Install backend dependencies
npm install

# 3. Generate Prisma client types (creates models & enums in node_modules)
npm run db:generate

# 4. Push schema to database (creates User, Product, Session tables in MySQL)
npx prisma db push

# 5. REQUIRED: Seed demo categories, products, customer, and admin accounts
npm run seed

# 6. Start the API server
npm run dev
```

The backend server is now running at **[http://localhost:4000](http://localhost:4000)**.

> 🔴 **CRITICAL:** **Do not skip `npx prisma db push` and `npm run seed`!**
> If you start the app without pushing and seeding:
> - The database will be completely empty (`User: 0`, `Product: 0`).
> - Attempting to log in will fail with `Database request failed` or `Internal server error` because no tables or accounts exist yet.

---

### Step 4: Frontend Setup & Run
Open a **second terminal** window:

```powershell
# 1. Navigate to frontend directory
cd frontend

# 2. Install frontend dependencies
npm install

# 3. Start the Vite dev server
npm run dev
```

Open **[http://localhost:5173](http://localhost:5173)** in your browser!

---

### Step 5: Verify Login & Demo Accounts

You can log in using either the form or the **1-Click Demo Login** buttons:

| Account Role | Email | Password | Access / Capabilities |
| :--- | :--- | :--- | :--- |
| **Customer** | `customer@example.com` | `Customer12345!` | Browse catalog, add to cart, checkout, view order history |
| **Administrator** | `admin@example.com` | `Admin12345!` | Access Market Desk at `/admin`, manage catalog, orders, escrow |

---

### 🛠️ Troubleshooting Common Issues

| Error / Symptom | Root Cause | Solution |
| :--- | :--- | :--- |
| `Can't reach database server at localhost:3306` | MySQL is not started in XAMPP, or running on port 3307 instead of 3306. | Open XAMPP Control Panel and start MySQL. Check the port shown (e.g. 3306 or 3307), then update `DATABASE_URL` in `backend/.env` to match. |
| `Database request failed` on login | MySQL tables have not been created yet. | Run `cd backend` and execute `npx prisma db push`. |
| `Internal server error` on login | Database tables exist but are empty (`User: 0`). | Run `cd backend` and execute `npm run seed`. |
| `Request failed with status code 429` | Rate limit triggered after rapid failed login attempts. | Stop the backend server (`Ctrl + C`) in your terminal and restart it (`npm run dev`). This immediately resets the in-memory rate limit counter. |
| `SyntaxError: ... does not provide an export named 'WalletTransactionType'` | Prisma Client was not regenerated after schema changes. | Run `cd backend` followed by `npx prisma generate` (or `npm run db:generate`). |
| `No command registered for push / studio` | An experimental Prisma 8 RC CLI was installed. | Make sure `package.json` specifies `"prisma": "^6.7.0"`, then run `npm install prisma@^6.7.0 --save-dev` in `backend/`. |

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