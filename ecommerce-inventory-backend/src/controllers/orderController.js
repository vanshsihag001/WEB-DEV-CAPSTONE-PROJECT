const crypto = require('crypto');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Order = require('../models/Order');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const events = require('../utils/events');
const { ok, created } = require('../utils/response');
const { getPagination, buildMeta } = require('../utils/pagination');

const { TRANSITIONS } = Order;
const round2 = (n) => Math.round(n * 100) / 100;
const genOrderNumber = () => `ORD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

// Compensating action: give reserved stock back
const releaseStock = (reserved) =>
  Product.bulkWrite(reserved.map((r) => ({ updateOne: { filter: { _id: r.product }, update: { $inc: { stock: r.quantity } } } })));

/**
 * CHECKOUT
 * 1. Load cart and re-validate every product (active, enough stock) on the server.
 * 2. Reserve stock with an ATOMIC conditional update per item:
 *      findOneAndUpdate({ _id, stock: { $gte: qty } }, { $inc: { stock: -qty } })
 *    The condition and decrement happen in a single MongoDB operation, so two customers
 *    buying the last unit cannot both succeed and stock can never go negative.
 * 3. If any item fails, stock reserved so far is released (rollback) and 409 is returned.
 * 4. Create one order per seller, using prices from the DB (price snapshot), clear the cart, emit events.
 */
exports.checkout = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart || cart.items.length === 0) throw ApiError.badRequest('Your cart is empty');

  const reserved = []; // { product, quantity, doc }
  try {
    for (const item of cart.items) {
      const updated = await Product.findOneAndUpdate(
        { _id: item.product, isActive: true, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { new: true }
      );
      if (!updated) {
        const p = await Product.findById(item.product).select('name stock isActive');
        const reason = !p || !p.isActive ? 'is no longer available' : `has only ${p.stock} unit(s) left`;
        throw ApiError.conflict(`${p ? p.name : 'A product'} ${reason}`, [{ product: item.product, requested: item.quantity }]);
      }
      reserved.push({ product: item.product, quantity: item.quantity, doc: updated });
    }

    // group by seller -> one order per seller
    const bySeller = new Map();
    for (const r of reserved) {
      const key = r.doc.seller.toString();
      if (!bySeller.has(key)) bySeller.set(key, []);
      bySeller.get(key).push({ product: r.product, name: r.doc.name, price: r.doc.price, quantity: r.quantity });
    }
    const checkoutId = crypto.randomUUID();
    const docs = [...bySeller.entries()].map(([seller, items]) => ({
      orderNumber: genOrderNumber(),
      checkoutId,
      customer: req.user._id,
      seller,
      items,
      totalAmount: round2(items.reduce((s, i) => s + i.price * i.quantity, 0)),
      shippingAddress: req.body.shippingAddress,
      payment: { method: 'SIMULATED', status: 'paid', simulated: true },
      status: 'pending',
      statusHistory: [{ status: 'pending', changedBy: req.user._id }],
    }));
    const orders = await Order.insertMany(docs);

    cart.items = [];
    await cart.save();

    orders.forEach((order) => events.emit('order.placed', { order }));
    reserved.forEach((r) => { if (r.doc.stock <= r.doc.lowStockThreshold) events.emit('stock.low', { product: r.doc }); });

    created(res, {
      checkoutId,
      grandTotal: round2(orders.reduce((s, o) => s + o.totalAmount, 0)),
      payment: { method: 'SIMULATED', note: 'No real payment was processed (academic simulation)' },
      orders,
    }, 'Order placed successfully');
  } catch (err) {
    if (reserved.length) await releaseStock(reserved).catch((e) => console.error('Stock rollback failed', e));
    throw err;
  }
});

// Role-scoped listing: customer -> own, seller -> assigned, admin -> all
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.user.role === 'customer') filter.customer = req.user._id;
  if (req.user.role === 'seller') filter.seller = req.user._id;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = req.query.from;
    if (req.query.to) filter.createdAt.$lte = req.query.to;
  }
  const [items, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)
      .populate('customer', 'name email').populate('seller', 'name'),
    Order.countDocuments(filter),
  ]);
  ok(res, items, undefined, buildMeta(page, limit, total));
});

const loadAuthorizedOrder = async (req) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw ApiError.notFound('Order not found');
  const u = req.user;
  const allowed = u.role === 'admin' ||
    (u.role === 'customer' && order.customer.equals(u._id)) ||
    (u.role === 'seller' && order.seller.equals(u._id));
  // 404 instead of 403 for customers so order IDs of others are not confirmed to exist
  if (!allowed) throw (u.role === 'customer' ? ApiError.notFound('Order not found') : ApiError.forbidden());
  return order;
};

exports.get = asyncHandler(async (req, res) => {
  const order = await loadAuthorizedOrder(req);
  await order.populate([{ path: 'customer', select: 'name email' }, { path: 'seller', select: 'name' }]);
  ok(res, order);
});

/**
 * UPDATE STATUS (state machine)
 *   pending -> confirmed | cancelled ; confirmed -> shipped | cancelled ; shipped -> delivered
 * Customers may only cancel (pending/confirmed). Sellers/admins drive the fulfilment flow.
 * The transition is applied with a conditional update on the *current* status, so a double
 * cancel can never restore stock twice.
 */
exports.updateStatus = asyncHandler(async (req, res) => {
  const order = await loadAuthorizedOrder(req);
  const target = req.body.status;
  const current = order.status;

  if (req.user.role === 'customer' && target !== 'cancelled') {
    throw ApiError.forbidden('Customers can only cancel their orders');
  }
  if (!TRANSITIONS[current].includes(target)) {
    throw ApiError.conflict(`Invalid status transition: ${current} -> ${target}`, { allowed: TRANSITIONS[current] });
  }

  const set = { status: target };
  if (target === 'cancelled') set['payment.status'] = 'refunded'; // simulated refund
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: current },
    { $set: set, $push: { statusHistory: { status: target, changedBy: req.user._id, at: new Date() } } },
    { new: true }
  );
  if (!updated) throw ApiError.conflict('Order was modified by another request. Please retry');

  if (target === 'cancelled') await releaseStock(updated.items); // restore inventory
  events.emit('order.statusChanged', { order: updated, previousStatus: current, actorId: req.user.id });
  ok(res, updated, `Order ${target}`);
});
