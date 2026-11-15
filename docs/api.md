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

`paymentMethod` defaults to `CASH_ON_DELIVERY`. Checkout requires a signed-in customer. For `ABA_KHQR` or `BAKONG_ESCROW`, the backend requests a dynamic KHQR from the configured gateway using the server-calculated order total and order number. Payment status can be polled through `/payments/aba/:orderNumber/status`; the app does not custody those payments in a smart contract. Keep `BAKONG_ACCOUNT_ID`, `BAKONG_MERCHANT_NAME`, and `KHQR_API_BASE_URL` in backend environment variables only. Confirm the provider's terms before using it for live payments.

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
| POST | `/escrow/:orderNumber/dispute` | Report an issue for own order (`{ "reason": "..." }`) |
| GET | `/users/wallet` | Read own demo balance and latest 50 ledger entries |
| GET / POST | `/users/addresses` | List / save delivery addresses |
| PATCH | `/users/profile` | Update name and phone |

Cart item requests use `{ "productId": "...", "quantity": 2 }`; quantity updates use `{ "quantity": 2 }`.

Every customer starts with a USD demo balance of `0.00`. An administrator can credit or debit it with a required reason; adjustments are recorded with the administrator and resulting balance. For `DEMO_WALLET` checkout, the server atomically deducts the order total and records an `ORDER_HOLD` ledger entry. The escrow state remains held until that customer confirms delivery. This is demo credit only: no real funds are held or paid out. Admin-approved disputes can credit the demo balance back.

## Administrator

All routes require an authenticated user whose role is `ADMIN`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/admin/dashboard` | Sales totals, customers, products, recent orders |
| GET | `/admin/orders` | Browse orders |
| PATCH | `/admin/orders/:id/status` | Update status, e.g. `{ "status": "SHIPPED" }` |
| GET | `/admin/escrows` | Browse database-tracked holds and status counts |
| POST | `/admin/escrows/:orderNumber/dispatch` | Record dispatch and inspection window (`{ "inspectionDays": 3 }`) |
| POST | `/admin/escrows/:orderNumber/resolve` | Resolve a dispute in the demo ledger; wallet refunds are credited (`{ "resolution": "RELEASE_TO_SELLER" | "REFUND_TO_BUYER", "notes": "..." }`) |
| GET | `/admin/customers` | Browse customer accounts |
| GET | `/admin/customers/:id/wallet` | Read a customer's demo balance and activity history |
| POST | `/admin/customers/:id/wallet-adjustments` | Credit/debit demo balance with a required note; body: `{ "direction": "CREDIT" | "DEBIT", "amount": 25.50, "note": "..." }` |
| POST / PUT / DELETE | `/admin/products` and `/admin/products/:id` | Create, update, or archive products |
| POST / PUT / DELETE | `/admin/categories` and `/admin/categories/:id` | Create, update, or delete an unused category |
| POST / DELETE | `/admin/products/:id/images` and `/admin/products/:id/images/:imageId` | Upload (multipart field `image`) or remove a product image |

Product create/update accepts `slug`, `sku`, `nameEn`, `nameKm`, `descriptionEn`, `descriptionKm`, `price`, `stock`, `categoryId`, optional `imageUrl`, and optional feature/active flags. Uploaded images are signature-checked, limited to 5 MB, and stored under `backend/uploads/products`; set `PUBLIC_API_URL` to the externally reachable API base. Replace local disk storage with private object storage/CDN for multi-instance production deployments.