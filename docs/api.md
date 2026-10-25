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
| POST | `/orders` | Guest or signed-in checkout (`CASH_ON_DELIVERY` or `ABA_KHQR`) |

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

`paymentMethod` is optional and defaults to `CASH_ON_DELIVERY`. For `ABA_KHQR`, the backend requests a dynamic KHQR from the configured gateway using the server-calculated order total and order number. The response includes the QR image and payment reference. Payment status is polled through the local `/payments/aba/:orderNumber/status` endpoint, which verifies the order number and customer phone before checking the provider. Keep `BAKONG_ACCOUNT_ID`, `BAKONG_MERCHANT_NAME`, and `KHQR_API_BASE_URL` in backend environment variables only. The configured provider describes itself as an independent, unofficial integration platform; confirm its pricing and production terms before using it for live payments.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/payments/aba/:orderNumber/khqr` | Retry KHQR generation for a pending order; requires `{ "customerPhone": "..." }` |
| POST | `/payments/aba/:orderNumber/status` | Check payment status; requires `{ "customerPhone": "..." }` |
| GET | `/escrow/:orderNumber` | Public smart contract escrow status, addresses, and transaction hashes |
| POST | `/escrow/:orderNumber/release` | Buyer confirms delivery & triggers smart contract release to seller |
| POST | `/escrow/:orderNumber/dispute` | Buyer raises formal escrow dispute (`{ "reason": "...", "customerPhone": "..." }`) |

## Signed-In Customer

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/auth/me` | Current session |
| GET / POST | `/cart` / `/cart/items` | Read cart / add item |
| PATCH / DELETE | `/cart/items/:id` | Update quantity / remove item |
| GET | `/orders` | Order history including escrow status |
| GET | `/orders/:orderNumber` | Order tracking and items |
| GET / POST | `/users/addresses` | List / save delivery addresses |
| PATCH | `/users/profile` | Update name and phone |

Cart item requests use `{ "productId": "...", "quantity": 2 }`; quantity updates use `{ "quantity": 2 }`.

## Administrator

All routes require an authenticated user whose role is `ADMIN`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/admin/dashboard` | Sales totals, customers, products, recent orders |
| GET | `/admin/orders` | Browse orders |
| PATCH | `/admin/orders/:id/status` | Update status, e.g. `{ "status": "SHIPPED" }` |
| GET | `/admin/escrows` | Browse and filter all smart contract escrow agreements and stats |
| POST | `/admin/escrows/:orderNumber/dispatch` | Seller dispatches order and starts inspection countdown (`{ "inspectionDays": 3 }`) |
| POST | `/admin/escrows/:orderNumber/resolve` | Arbitrate dispute (`{ "resolution": "RELEASE_TO_SELLER" | "REFUND_TO_BUYER", "notes": "..." }`) |
| GET | `/admin/customers` | Browse customer accounts |
| POST / PUT / DELETE | `/admin/products` and `/admin/products/:id` | Create, update, or archive products |
| POST / PUT / DELETE | `/admin/categories` and `/admin/categories/:id` | Create, update, or delete an unused category |
| POST / DELETE | `/admin/products/:id/images` and `/admin/products/:id/images/:imageId` | Upload (multipart field `image`) or remove a product image |

Product create/update accepts `slug`, `sku`, `nameEn`, `nameKm`, `descriptionEn`, `descriptionKm`, `price`, `stock`, `categoryId`, optional `imageUrl`, and optional feature/active flags. Uploaded images are signature-checked, limited to 5 MB, and stored under `backend/uploads/products`; set `PUBLIC_API_URL` to the externally reachable API base. Replace local disk storage with private object storage/CDN for multi-instance production deployments.