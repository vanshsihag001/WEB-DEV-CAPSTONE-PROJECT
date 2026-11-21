# E-Commerce and Inventory Management System (Backend)

Capstone Project 4 - Node.js, Express.js, MongoDB, Mongoose, JWT, bcrypt, EventEmitter, Socket.IO.

A REST API where **customers** browse products, keep a cart and place orders; **sellers** manage their own
products, stock and orders; **admins** manage users, categories and see platform-wide orders and reports.
Payments are **simulated** (no real gateway, no card data - every order is marked `payment.simulated = true`).

## Features
- JWT auth with **access + refresh tokens** (refresh rotation, hashed refresh tokens in DB, reuse detection, logout)
- **bcrypt** password hashing, **RBAC** (`customer`, `seller`, `admin`), protected routes
- Product & category CRUD, search / filter / sort / pagination, soft delete
- Cart with server-side prices and totals
- Checkout that splits one cart into **one order per seller**, with price snapshots
- **Atomic stock reservation** (no overselling, stock never negative) + automatic rollback + stock restore on cancel
- Order **status state machine** with role rules
- **3 aggregation pipelines**: sales summary, best sellers, inventory summary
- **EventEmitter** event bus + **Socket.IO** real-time notifications
- Joi validation, centralized error handler, request logging, helmet, CORS, rate-limited auth routes

## Prerequisites
Node.js 18+, MongoDB 6+ running locally (or a MongoDB Atlas URI).

## Setup
```bash
npm install
cp .env.example .env        # then edit secrets / MONGO_URI
npm run seed                # sample users, categories, products////
npm run dev                 # or: npm start   -> http://localhost:5000
```
`.env` is git-ignored. Never commit it.

### Environment variables
| Variable | Description | Default |
|---|---|---|
| PORT | Server port | 5000 |
| MONGO_URI | MongoDB connection string | mongodb://127.0.0.1:27017/ecommerce_inventory |
| JWT_ACCESS_SECRET | Secret for access tokens (required) | - |
| JWT_REFRESH_SECRET | Secret for refresh tokens (required) | - |
| JWT_ACCESS_EXPIRES | Access token lifetime | 15m |
| JWT_REFRESH_EXPIRES | Refresh token lifetime | 7d |
| BCRYPT_SALT_ROUNDS | bcrypt cost | 10 |
| CLIENT_ORIGIN | CORS / Socket.IO origin | * |

### Seed accounts (password for all: `Password123`)
| Role | Email |
|---|---|
| admin | admin@shop.com |
| seller | seller1@shop.com (electronics, home), seller2@shop.com (fashion, books) |
| customer | customer1@shop.com, customer2@shop.com |

`npm run seed:destroy` removes all data.

## Project structure (MVC)
```
src/
  config/        env.js, db.js
  models/        User, Category, Product, Cart, Order        (Mongoose schemas + indexes)
  controllers/   auth, user, category, product, cart, order, report   (business logic)
  routes/        one router per resource                      (URL -> middleware -> controller)
  middleware/    auth (protect/restrictTo), validate, errorHandler, logger
  validators/    schemas.js                                   (Joi schemas)
  listeners/     notificationListeners.js                     (EventEmitter -> Socket.IO)
  utils/         ApiError, asyncHandler, response, pagination, tokens, events, socket
  app.js         Express app          server.js  HTTP + Socket.IO bootstrap
scripts/         seed.js, generatePostman.js
postman/         Ecommerce_API.postman_collection.json
```
Request flow: **Route -> Middleware (auth, RBAC, validation) -> Controller -> Model -> MongoDB -> JSON response**.

## Response format
```json
{ "success": true, "message": "optional", "data": {}, "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 } }
{ "success": false, "message": "Validation failed", "errors": [ { "field": "price", "message": "price must be a positive number" } ] }
```

## API documentation
Auth column: `-` public, `Bearer` any logged-in user, otherwise the allowed roles. Header: `Authorization: Bearer <accessToken>`.

### Auth
| Method | Endpoint | Auth | Body | Notes |
|---|---|---|---|---|
| POST | /api/auth/register | - | name, email, password (8+, letter+number), role (`customer`\|`seller`), phone? | 201; 400 validation; 409 duplicate email |
| POST | /api/auth/login | - | email, password | 200 `{ user, accessToken, refreshToken }`; 401 invalid |
| POST | /api/auth/refresh | - | refreshToken | Rotates: old token becomes invalid; reuse revokes all sessions |
| POST | /api/auth/logout | - | refreshToken | Invalidates that refresh token |

### Users
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/users/me | Bearer | Own profile |
| PATCH | /api/users/me | Bearer | Update name, phone, password |
| GET | /api/users?role=&q=&page=&limit= | admin | List users |
| GET | /api/users/:id | admin | Get user |
| PATCH | /api/users/:id | admin | Change `role` / `isActive` |
| DELETE | /api/users/:id | admin | Deactivate user |

### Categories
| Method | Endpoint | Auth |
|---|---|---|
| GET | /api/categories, /api/categories/:id | - |
| POST | /api/categories | admin |
| PATCH / DELETE | /api/categories/:id | admin (delete blocked if products exist) |

### Products
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/products | - | Query: `q` (text search), `category`, `seller`, `minPrice`, `maxPrice`, `inStock`, `sort` (`newest`,`price_asc`,`price_desc`,`name`,`relevance`), `page`, `limit` |
| GET | /api/products/:id | - | Product detail |
| GET | /api/products/mine | seller, admin | Own inventory (admin: all) |
| GET | /api/products/low-stock | seller, admin | Products with `stock <= lowStockThreshold` |
| POST | /api/products | seller, admin | name, description, price, category, stock, lowStockThreshold?, images? |
| PATCH | /api/products/:id | owner seller, admin | Partial update |
| PATCH | /api/products/:id/stock | owner seller, admin | `{ "delta": 10 }` atomic restock / adjustment (never below 0) |
| DELETE | /api/products/:id | owner seller, admin | Soft delete (`isActive=false`) |

### Cart (customer only)
| Method | Endpoint | Body |
|---|---|---|
| GET | /api/cart | - (server-calculated prices, totals, availability `issues`) |
| POST | /api/cart/items | productId, quantity |
| PATCH | /api/cart/items/:productId | quantity |
| DELETE | /api/cart/items/:productId | - |
| DELETE | /api/cart | - |

### Orders
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /api/orders/checkout | customer | Body `{ shippingAddress: { fullName, phone, line1, line2?, city, state, postalCode, country } }`. 201 with orders (one per seller); 400 empty cart; 409 stock problem |
| GET | /api/orders?status=&from=&to=&page=&limit= | Bearer | customer: own, seller: assigned, admin: all |
| GET | /api/orders/:id | owner customer / owning seller / admin | 404 for other customers' orders |
| PATCH | /api/orders/:id/status | customer (cancel only), seller, admin | `{ "status": "confirmed" \| "shipped" \| "delivered" \| "cancelled" }` |

**Status rules:** `pending -> confirmed | cancelled`, `confirmed -> shipped | cancelled`, `shipped -> delivered`.
`delivered` and `cancelled` are final. Invalid transition = 409. Cancelling restores stock and marks the simulated payment `refunded`.

### Reports (seller = own data, admin = all, optional `?seller=`)
| Endpoint | Query | Aggregation |
|---|---|---|
| GET /api/reports/sales | from, to, groupBy=`day`\|`month` | `$match` + `$facet` + `$group` + `$dateToString`: revenue/orders/avg order value over time |
| GET /api/reports/best-sellers | from, to, limit | `$unwind` items + `$group` + `$sort` + `$lookup` products |
| GET /api/reports/inventory | - | `$group` by category (units, stock value, low-stock count) + `$lookup` categories |

### Common status codes
200 OK, 201 Created, 400 validation / bad id, 401 missing/invalid/expired token, 403 role not allowed or not owner,
404 not found, 409 conflict (duplicate, insufficient stock, invalid transition), 429 rate limit, 500 server error.

## Database design
| Collection | Key fields | Relationships | Indexes |
|---|---|---|---|
| users | name, email, password (hash), role, isActive, refreshTokens[{tokenHash, expiresAt}] | - | `email` unique, `role` |
| categories | name, slug, description | - | `name` unique, `slug` unique |
| products | name, description, price, stock, lowStockThreshold, isActive | category -> categories, seller -> users | text(`name`,`description`), `{category, price}`, `{seller, isActive}`, `{stock}` |
| carts | items[{product, quantity}] | user -> users (1:1), product -> products | `user` unique |
| orders | orderNumber, checkoutId, items[{product, name, price, quantity}], totalAmount, shippingAddress, payment{method, status, simulated}, status, statusHistory[] | customer -> users, seller -> users, product -> products | `{customer, createdAt}`, `{seller, status, createdAt}`, `{status, createdAt}`, `orderNumber` unique |

Design decisions: products are **referenced** (price/stock live in one place); order items **embed a snapshot**
(name, price) so history stays correct when products change; cart stores no prices.

## Preventing overselling
Checkout reserves each item with a single atomic operation:
```js
Product.findOneAndUpdate({ _id, isActive: true, stock: { $gte: qty } }, { $inc: { stock: -qty } }, { new: true })
```
The check and the decrement happen together inside MongoDB, so two customers racing for the last unit cannot
both win. If any item fails, previously reserved items are returned (compensating rollback) and nothing is ordered.
Cancellation applies a conditional status update first, so a double-cancel can't restore stock twice.
(Multi-document transactions would also work but need a replica set; this design runs on a standalone MongoDB.)

## EventEmitter and Socket.IO
**EventEmitter** (`src/utils/events.js`) decouples business logic from side effects. Controllers emit; listeners react.
| Event | Emitted when | Listener action |
|---|---|---|
| `order.placed` | checkout creates an order | notify seller, customer, admins |
| `order.statusChanged` | order status changes | notify customer and seller |
| `stock.low` | stock falls to/below threshold (checkout, update, adjustment) | notify seller and admins |

**Socket.IO** connects with the access token:
```js
const socket = io('http://localhost:5000', { auth: { token: accessToken } });
socket.on('order:new', console.log);
```
Unauthenticated or invalid-token connections are rejected. Each socket joins rooms `user:<id>` and `role:<role>`.

| Server -> client event | Receiver | Payload |
|---|---|---|
| `connected` | the socket | `{ userId, role }` |
| `order:placed` | customer | `{ message, orderId, orderNumber, totalAmount, itemCount, status }` |
| `order:new` | seller (and admins) | same as above |
| `order:status` | customer + seller | `{ orderId, orderNumber, previousStatus, status, message }` |
| `stock:low` | seller + admins | `{ productId, name, stock, threshold, message }` |

## Testing with Postman
1. `npm run seed`, then `npm run dev`.
2. Import `postman/Ecommerce_API.postman_collection.json` (regenerate with `npm run postman`).
3. Run the collection with the Collection Runner **in folder order** (tokens/IDs are stored in collection variables).
4. After a full run, run `npm run seed` again to reset data before re-running.

Covered: valid requests, validation failures, invalid ids, 404, missing token (401), wrong role (403), duplicate email (409),
ownership violations, insufficient stock, invalid status transitions, sold-out item, report access rules.

To watch real-time events, connect a Socket.IO client as `seller1@shop.com` and run the checkout request as a customer.

## Security notes
bcrypt hashing; short-lived access tokens; refresh tokens stored only as SHA-256 hashes and rotated; generic login errors;
role + ownership checks enforced in the backend; Joi `stripUnknown` blocks mass-assignment; helmet; rate-limited auth routes;
secrets only in `.env`.
Made By Vansh Sihag , Roll Number: 2501730387
