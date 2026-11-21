/* Generates postman/Ecommerce_API.postman_collection.json  ->  npm run postman */
const fs = require('fs');
const path = require('path');

const hdr = (tokenVar) => [{ key: 'Content-Type', value: 'application/json' }, ...(tokenVar ? [{ key: 'Authorization', value: `Bearer {{${tokenVar}}}` }] : [])];
const addr = { fullName: 'Asha Customer', phone: '9876543210', line1: '12 MG Road', city: 'Pune', state: 'Maharashtra', postalCode: '411001', country: 'India' };

const req = (name, method, url, { token, body, expect, save, pre } = {}) => {
  const exec = [`pm.test('Status is ${expect}', () => pm.response.to.have.status(${expect}));`];
  if (save) exec.push('const j = pm.response.json();', ...save);
  return {
    name,
    event: [
      ...(pre ? [{ listen: 'prerequest', script: { type: 'text/javascript', exec: pre } }] : []),
      { listen: 'test', script: { type: 'text/javascript', exec } },
    ],
    request: {
      method, header: hdr(token),
      url: { raw: `{{baseUrl}}${url}`, host: ['{{baseUrl}}'], path: url.split('?')[0].split('/').filter(Boolean), query: url.includes('?') ? url.split('?')[1].split('&').map((p) => ({ key: p.split('=')[0], value: p.split('=')[1] })) : undefined },
      ...(body ? { body: { mode: 'raw', raw: JSON.stringify(body, null, 2) } } : {}),
    },
  };
};
const login = (name, email, tokenVar, refreshVar) => req(name, 'POST', '/api/auth/login', {
  body: { email, password: 'Password123' }, expect: 200,
  save: [`pm.collectionVariables.set('${tokenVar}', j.data.accessToken);`, ...(refreshVar ? [`pm.collectionVariables.set('${refreshVar}', j.data.refreshToken);`] : [])],
});
const folder = (name, item) => ({ name, item });

const collection = {
  info: { name: 'E-Commerce & Inventory API', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    description: 'Run `npm run seed` first, then run folders in order (Collection Runner). Covers positive, validation, 404, 401, 403 and business-rule cases.' },
  variable: ['baseUrl', 'adminToken', 'sellerToken', 'seller2Token', 'customerToken', 'customer2Token', 'refreshToken', 'categoryId', 'productId', 'limitedProductId', 'otherSellerProductId', 'orderId']
    .map((k) => ({ key: k, value: k === 'baseUrl' ? 'http://localhost:5000' : '' })),
  item: [
    folder('1. Auth', [
      req('Register customer (valid)', 'POST', '/api/auth/register', { body: { name: 'Test User', email: `test{{$timestamp}}@mail.com`, password: 'Secret123', role: 'customer' }, expect: 201,
        pre: [], save: [] }),
      req('Register - validation failure', 'POST', '/api/auth/register', { body: { name: 'A', email: 'not-an-email', password: '123' }, expect: 400 }),
      req('Register - duplicate email (409)', 'POST', '/api/auth/register', { body: { name: 'Dup User', email: 'customer1@shop.com', password: 'Secret123' }, expect: 409 }),
      req('Register - cannot self-assign admin role (ignored/400)', 'POST', '/api/auth/register', { body: { name: 'Hacker', email: 'h@mail.com', password: 'Secret123', role: 'admin' }, expect: 400 }),
      login('Login admin', 'admin@shop.com', 'adminToken'),
      login('Login seller 1', 'seller1@shop.com', 'sellerToken', 'refreshToken'),
      login('Login seller 2', 'seller2@shop.com', 'seller2Token'),
      login('Login customer 1', 'customer1@shop.com', 'customerToken'),
      login('Login customer 2', 'customer2@shop.com', 'customer2Token'),
      req('Login - wrong password (401)', 'POST', '/api/auth/login', { body: { email: 'customer1@shop.com', password: 'WrongPass1' }, expect: 401 }),
      req('Refresh token (rotation)', 'POST', '/api/auth/refresh', { body: { refreshToken: '{{refreshToken}}' }, expect: 200,
        save: ["pm.collectionVariables.set('sellerToken', j.data.accessToken);", "pm.collectionVariables.set('refreshToken', j.data.refreshToken);"] }),
      req('Refresh with invalid token (401)', 'POST', '/api/auth/refresh', { body: { refreshToken: 'invalid.token.value' }, expect: 401 }),
      req('Get my profile', 'GET', '/api/users/me', { token: 'customerToken', expect: 200 }),
      req('Profile without token (401)', 'GET', '/api/users/me', { expect: 401 }),
      req('Update my profile', 'PATCH', '/api/users/me', { token: 'customerToken', body: { name: 'Asha Customer' }, expect: 200 }),
    ]),
    folder('2. Categories & Products', [
      req('List categories (public)', 'GET', '/api/categories', { expect: 200, save: ["pm.collectionVariables.set('categoryId', j.data[0]._id);"] }),
      req('Create category as customer (403)', 'POST', '/api/categories', { token: 'customerToken', body: { name: 'Toys' }, expect: 403 }),
      req('Create category as admin', 'POST', '/api/categories', { token: 'adminToken', body: { name: `Toys {{$timestamp}}`, description: 'Toys & games' }, expect: 201 }),
      req('Create category - validation failure', 'POST', '/api/categories', { token: 'adminToken', body: { description: 'no name' }, expect: 400 }),
      req('List products (search+filter+sort+page)', 'GET', '/api/products?q=headphones&minPrice=100&sort=price_asc&page=1&limit=5', { expect: 200 }),
      req('List products (all)', 'GET', '/api/products?limit=20', { expect: 200,
        save: ["const byName = (n) => j.data.find(p => p.name === n);",
          "pm.collectionVariables.set('productId', byName('Wireless Bluetooth Headphones')._id);",
          "pm.collectionVariables.set('limitedProductId', byName('Limited Edition Smartwatch')._id);",
          "pm.collectionVariables.set('otherSellerProductId', byName('Cotton T-Shirt')._id);"] }),
      req('Get product', 'GET', '/api/products/{{productId}}', { expect: 200 }),
      req('Get product - invalid id (400)', 'GET', '/api/products/abc', { expect: 400 }),
      req('Get product - not found (404)', 'GET', '/api/products/64b000000000000000000000', { expect: 404 }),
      req('Create product as seller', 'POST', '/api/products', { token: 'sellerToken', body: { name: 'Test Gadget', description: 'created via postman', price: 999, category: '{{categoryId}}', stock: 10 }, expect: 201 }),
      req('Create product - validation (negative price)', 'POST', '/api/products', { token: 'sellerToken', body: { name: 'Bad', price: -5, category: '{{categoryId}}', stock: 1 }, expect: 400 }),
      req('Create product as customer (403)', 'POST', '/api/products', { token: 'customerToken', body: { name: 'X', price: 5, category: '{{categoryId}}', stock: 1 }, expect: 403 }),
      req("Update another seller's product (403)", 'PATCH', '/api/products/{{otherSellerProductId}}', { token: 'sellerToken', body: { price: 1 }, expect: 403 }),
      req('Update own product', 'PATCH', '/api/products/{{productId}}', { token: 'sellerToken', body: { price: 2599 }, expect: 200 }),
      req('Restock own product (+5)', 'PATCH', '/api/products/{{productId}}/stock', { token: 'sellerToken', body: { delta: 5 }, expect: 200 }),
      req('Reduce stock below zero (409)', 'PATCH', '/api/products/{{productId}}/stock', { token: 'sellerToken', body: { delta: -100000 }, expect: 409 }),
      req('Low-stock alerts (seller)', 'GET', '/api/products/low-stock', { token: 'sellerToken', expect: 200 }),
    ]),
    folder('3. Cart', [
      req('Cart as seller (403)', 'GET', '/api/cart', { token: 'sellerToken', expect: 403 }),
      req('Clear cart', 'DELETE', '/api/cart', { token: 'customerToken', expect: 200 }),
      req('Add item', 'POST', '/api/cart/items', { token: 'customerToken', body: { productId: '{{productId}}', quantity: 2 }, expect: 200 }),
      req('Add item from 2nd seller', 'POST', '/api/cart/items', { token: 'customerToken', body: { productId: '{{otherSellerProductId}}', quantity: 3 }, expect: 200 }),
      req('Add item - quantity exceeds stock (409)', 'POST', '/api/cart/items', { token: 'customerToken', body: { productId: '{{limitedProductId}}', quantity: 50 }, expect: 409 }),
      req('Add item - validation failure', 'POST', '/api/cart/items', { token: 'customerToken', body: { productId: 'abc', quantity: 0 }, expect: 400 }),
      req('Update quantity', 'PATCH', '/api/cart/items/{{productId}}', { token: 'customerToken', body: { quantity: 3 }, expect: 200 }),
      req('Remove item not in cart (404)', 'DELETE', '/api/cart/items/64b000000000000000000000', { token: 'customerToken', expect: 404 }),
      req('View cart (server-calculated totals)', 'GET', '/api/cart', { token: 'customerToken', expect: 200 }),
    ]),
    folder('4. Orders & Inventory', [
      req('Checkout - validation failure (no address)', 'POST', '/api/orders/checkout', { token: 'customerToken', body: {}, expect: 400 }),
      req('Checkout (splits per seller, reserves stock)', 'POST', '/api/orders/checkout', { token: 'customerToken', body: { shippingAddress: addr }, expect: 201,
        save: ["pm.collectionVariables.set('orderId', j.data.orders.find(o => o.items.some(i => i.name.includes('Headphones')))._id);"] }),
      req('Checkout again with empty cart (400)', 'POST', '/api/orders/checkout', { token: 'customerToken', body: { shippingAddress: addr }, expect: 400 }),
      req('My orders', 'GET', '/api/orders?page=1&limit=10', { token: 'customerToken', expect: 200 }),
      req('Get order (owner)', 'GET', '/api/orders/{{orderId}}', { token: 'customerToken', expect: 200 }),
      req("Get another customer's order (404)", 'GET', '/api/orders/{{orderId}}', { token: 'customer2Token', expect: 404 }),
      req('Get order without token (401)', 'GET', '/api/orders/{{orderId}}', { expect: 401 }),
      req('Customer tries to ship (403)', 'PATCH', '/api/orders/{{orderId}}/status', { token: 'customerToken', body: { status: 'shipped' }, expect: 403 }),
      req('Wrong seller updates status (403)', 'PATCH', '/api/orders/{{orderId}}/status', { token: 'seller2Token', body: { status: 'confirmed' }, expect: 403 }),
      req('Seller skips a step pending->shipped (409)', 'PATCH', '/api/orders/{{orderId}}/status', { token: 'sellerToken', body: { status: 'shipped' }, expect: 409 }),
      req('Seller confirms', 'PATCH', '/api/orders/{{orderId}}/status', { token: 'sellerToken', body: { status: 'confirmed' }, expect: 200 }),
      req('Seller ships', 'PATCH', '/api/orders/{{orderId}}/status', { token: 'sellerToken', body: { status: 'shipped' }, expect: 200 }),
      req('Cancel after shipping (409)', 'PATCH', '/api/orders/{{orderId}}/status', { token: 'customerToken', body: { status: 'cancelled' }, expect: 409 }),
      req('Seller delivers', 'PATCH', '/api/orders/{{orderId}}/status', { token: 'sellerToken', body: { status: 'delivered' }, expect: 200 }),
      req('Invalid status value (400)', 'PATCH', '/api/orders/{{orderId}}/status', { token: 'sellerToken', body: { status: 'teleported' }, expect: 400 }),
      req('Seller order queue', 'GET', '/api/orders?status=delivered', { token: 'sellerToken', expect: 200 }),
      req('Overselling guard: add all remaining stock of limited item', 'POST', '/api/cart/items', { token: 'customerToken', body: { productId: '{{limitedProductId}}', quantity: 3 }, expect: 200 }),
      req('Checkout limited item', 'POST', '/api/orders/checkout', { token: 'customerToken', body: { shippingAddress: addr }, expect: 201 }),
      req('2nd customer cannot buy sold-out item (409)', 'POST', '/api/cart/items', { token: 'customer2Token', body: { productId: '{{limitedProductId}}', quantity: 1 }, expect: 409 }),
    ]),
    folder('5. Reports (aggregation)', [
      req('Sales summary (admin)', 'GET', '/api/reports/sales?groupBy=day', { token: 'adminToken', expect: 200 }),
      req('Sales summary (seller - own data)', 'GET', '/api/reports/sales?groupBy=month', { token: 'sellerToken', expect: 200 }),
      req('Best sellers', 'GET', '/api/reports/best-sellers?limit=5', { token: 'adminToken', expect: 200 }),
      req('Inventory summary', 'GET', '/api/reports/inventory', { token: 'sellerToken', expect: 200 }),
      req('Reports as customer (403)', 'GET', '/api/reports/sales', { token: 'customerToken', expect: 403 }),
      req('Reports without token (401)', 'GET', '/api/reports/sales', { expect: 401 }),
      req('Reports - invalid date (400)', 'GET', '/api/reports/sales?from=notadate', { token: 'adminToken', expect: 400 }),
    ]),
    folder('6. Admin', [
      req('List users (admin)', 'GET', '/api/users?role=seller', { token: 'adminToken', expect: 200 }),
      req('List users as seller (403)', 'GET', '/api/users', { token: 'sellerToken', expect: 403 }),
      req('Logout (revoke refresh token)', 'POST', '/api/auth/logout', { body: { refreshToken: '{{refreshToken}}' }, expect: 200 }),
    ]),
  ],
};

const out = path.join(__dirname, '..', 'postman', 'Ecommerce_API.postman_collection.json');
fs.writeFileSync(out, JSON.stringify(collection, null, 2));
console.log('Written', out);
