# REST API

Base URL: `http://localhost:4000/api`. JSON responses use `{ "success": true, "data": ... }`; errors use `{ "success": false, "error": { "message": ... } }`. Session cookies are HttpOnly and sent with `credentials: include`.

## Public

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness check |
| GET | `/products?page=1&pageSize=12&search=lamp&category=home-living&minPrice=5&maxPrice=80&sort=price-asc` | Search and paginate active products |
| GET | `/products/:id` | Read a product by ID or slug |
| GET | `/categories` | List bilingual categories |
| POST | `/auth/register` | Create account and set session cookie |
| POST | `/auth/login` | Sign in and set session cookie |
| POST | `/auth/logout` | Clear session cookie |

Example checkout:

```json
{
  "customerName": "Sokha Chan",
  "customerEmail": "sokha@example.com",
  "customerPhone": "+855 12 345 678",
  "addressLine": "12 Street 240",
  "city": "Phnom Penh",
  "province": "Phnom Penh",
  "paymentMethod": "ABA_KHQR",
  "items": [{ "productId": "mekong-rattan-lamp", "quantity": 1 }]
}
```

`paymentMethod` defaults to `CASH_ON_DELIVERY`. Checkout requires a signed-in customer. For `ABA_KHQR` or `BAKONG_ESCROW`, the backend requests a dynamic KHQR from the configured gateway's `GET /api/v1/khqr/generate` endpoint using query parameters for the server-calculated amount and order number. Payment status can be polled through `/payments/aba/:orderNumber/status`; the app does not custody those payments in a smart contract. Keep `BAKONG_ACCOUNT_ID`, `BAKONG_MERCHANT_NAME`, and `KHQR_API_BASE_URL` in backend environment variables only. Confirm the provider's terms before using it for live payments.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/payments/aba/:orderNumber/khqr` | Retry KHQR generation for a pending order; requires `{ "customerPhone": "..." }` |
| POST | `/payments/aba/:orderNumber/status` | Check payment status; requires `{ "customerPhone": "..." }` |

## Signed-In Customer

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/auth/me` | Current session |
| GET / POST | `/cart` / `/cart/items` | Read cart / add item |
| PATCH / DELETE | `/cart/items/:id` | Update quantity / remove item |
| POST | `/orders` | Place an order (requires a signed-in account) |
| GET | `/orders` | Order history including escrow status |
| GET | `/orders/:orderNumber` | Order tracking and items |
| GET | `/escrow/:orderNumber` | Read the signed-in customer's own hold status (administrators may inspect any order) |
| POST | `/escrow/:orderNumber/release` | Confirm delivery for own order; records a status change only |
| POST | `/escrow/:orderNumber/dispute` | Request cancellation/return for own paid escrow order using multipart fields `reason` and optional repeated `evidence` files; routes the case to store response and Super Admin final review |
| GET | `/escrow/:orderNumber/evidence/:evidenceId` | Read a case attachment; available only to the order owner and administrators |
| GET | `/users/wallet` | Read own store balance, latest 50 ledger entries, and any pending KHQR top-up |
| POST | `/users/wallet/topups` | Create a KHQR top-up for `{ "amount": 25.50 }`; amount must be positive, at most USD 1,000,000, and have no fractional cents |
| POST | `/users/wallet/topups/:topUpId/status` | Check KHQR status; a verified payment credits the wallet once |
| GET / POST | `/users/addresses` | List / save delivery addresses |
| PATCH | `/users/profile` | Update name and phone |

Cart item requests use `{ "productId": "...", "quantity": 2 }`; quantity updates use `{ "quantity": 2 }`.

Every customer starts with a USD wallet balance of `0.00`. A customer can create a dynamic KHQR top-up; the balance is credited only after the configured provider confirms payment. Pending QR codes expire after 15 minutes. A wallet top-up and its ledger credit are committed atomically and can only be credited once. KHQR creation is limited to two requests per minute, and payment status is checked every 30 seconds. Wallet balances are store credit for purchases here and are not withdrawable. For `DEMO_WALLET` checkout, the server atomically deducts the order total and records an `ORDER_HOLD` ledger entry. Delivery and dispute states are database-tracked; refunds credit the wallet balance and do not initiate a separate bank transfer. Keep `BAKONG_ACCOUNT_ID`, `BAKONG_MERCHANT_NAME`, and `KHQR_API_BASE_URL` in backend environment variables only, and confirm the provider's terms before using live payments.

## Administrator

All administrator routes require an authenticated `ADMIN` or `SUPER_ADMIN`. Administrator-account management is restricted to `SUPER_ADMIN`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/admin/dashboard` | Sales totals, customers, products, recent orders |
| GET | `/admin/accounts` | List administrator accounts (`SUPER_ADMIN` only) |
| POST | `/admin/accounts` | Create an `ADMIN` account (`{ "name": "...", "email": "...", "password": "..." }`; `SUPER_ADMIN` only, password must be 10-128 characters) |
| GET | `/admin/orders` | Browse orders |
| PATCH | `/admin/orders/:id/status` | Update status, e.g. `{ "status": "SHIPPED" }` |
| GET | `/admin/escrows` | Browse database-tracked holds and status counts |
| POST | `/admin/escrows/:orderNumber/dispatch` | Record dispatch and inspection window (`{ "inspectionDays": 3 }`) |
| POST | `/admin/escrows/:orderNumber/respond` | Submit or update the store's response on a disputed order using multipart fields `response` and optional repeated `evidence` files; keeps the order disputed |
| POST | `/admin/escrows/:orderNumber/resolve` | Final ruling (`SUPER_ADMIN` only) after a store response exists; multipart fields `resolution`, `notes`, optional `restockItems`, and repeated `evidence` files |
| GET | `/admin/customers` | Browse customer accounts |
| GET | `/admin/customers/:id/wallet` | Read a customer's store balance and activity history |
| POST | `/admin/customers/:id/wallet-adjustments` | Manually adjust store balance with a required audit note; body: `{ "direction": "CREDIT" | "DEBIT", "amount": 25.50, "note": "..." }` |
| POST / PUT / DELETE | `/admin/products` and `/admin/products/:id` | Create, update, or archive products |
| POST / PUT / DELETE | `/admin/categories` and `/admin/categories/:id` | Create, update, or delete an unused category |
| POST / DELETE | `/admin/products/:id/images` and `/admin/products/:id/images/:imageId` | Upload (multipart field `image`) or remove a product image |

Product create/update accepts `slug`, `sku`, `nameEn`, `nameKm`, `descriptionEn`, `descriptionKm`, `price`, `stock`, `categoryId`, optional `imageUrl`, and optional feature/active flags. Uploaded images are signature-checked, limited to 5 MB, and stored under `backend/uploads/products`; set `PUBLIC_API_URL` to the externally reachable API base. Replace local disk storage with private object storage/CDN for multi-instance production deployments.

Dispute evidence supports JPEG, PNG, WebP, GIF, MP4, WebM, and MOV files (up to 3 files per step, 10 MB each). File signatures are checked server-side. Evidence is stored outside the public `/uploads` directory in `backend/private_uploads/escrow-evidence` by default; `ESCROW_EVIDENCE_DIRECTORY` can override the storage path. The migration `202611220005_escrow_evidence` adds evidence metadata and uploader/stage records. Back up the private evidence directory together with the database, and use private object storage for multi-instance production deployments.

Disputes stay in `DISPUTED` status while the customer report and store response are reviewed. Customers attach evidence with their report, an `ADMIN` can attach evidence with the store response, and only a `SUPER_ADMIN` can attach evidence with the final release/refund ruling. All case participants with authorized access can view the attachments. Refunded items are not returned to inventory unless the Super Admin explicitly marks them as returned, inspected, and sellable. These escrow records are database-tracked only: KHQR/bank payments are not held or refunded automatically, so any real bank refund must be processed separately.