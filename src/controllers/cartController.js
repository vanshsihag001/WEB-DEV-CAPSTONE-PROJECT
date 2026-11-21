const Cart = require('../models/Cart');
const Product = require('../models/Product');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');

const round2 = (n) => Math.round(n * 100) / 100;

// Builds the cart view with server-side prices/totals and availability warnings
const buildCartView = async (userId) => {
  const cart = await Cart.findOne({ user: userId }).populate('items.product', 'name price stock isActive seller');
  if (!cart) return { items: [], totalItems: 0, totalAmount: 0, issues: [] };
  const items = []; const issues = [];
  for (const it of cart.items) {
    const p = it.product;
    if (!p) { issues.push('A product in your cart no longer exists'); continue; }
    const available = p.isActive && p.stock >= it.quantity;
    if (!p.isActive) issues.push(`${p.name} is no longer available`);
    else if (p.stock < it.quantity) issues.push(`Only ${p.stock} of ${p.name} in stock`);
    items.push({
      product: p._id, name: p.name, price: p.price, quantity: it.quantity,
      subtotal: round2(p.price * it.quantity), available,
    });
  }
  return {
    items,
    totalItems: items.reduce((s, i) => s + i.quantity, 0),
    totalAmount: round2(items.reduce((s, i) => s + i.subtotal, 0)),
    issues,
  };
};

exports.getCart = asyncHandler(async (req, res) => ok(res, await buildCartView(req.user._id)));

exports.addItem = asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body;
  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) throw ApiError.notFound('Product not found');
  if (product.seller.equals(req.user._id)) throw ApiError.badRequest('You cannot buy your own product');

  const cart = (await Cart.findOne({ user: req.user._id })) || new Cart({ user: req.user._id, items: [] });
  const existing = cart.items.find((i) => i.product.equals(product._id));
  const newQty = (existing ? existing.quantity : 0) + quantity;
  if (newQty > 100) throw ApiError.badRequest('Maximum 100 units per item');
  if (newQty > product.stock) throw ApiError.conflict(`Only ${product.stock} unit(s) available`);
  if (existing) existing.quantity = newQty; else cart.items.push({ product: product._id, quantity });
  await cart.save();
  ok(res, await buildCartView(req.user._id), 'Item added to cart');
});

exports.updateItem = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  const cart = await Cart.findOne({ user: req.user._id });
  const item = cart && cart.items.find((i) => i.product.toString() === req.params.productId);
  if (!item) throw ApiError.notFound('Item not in cart');
  const product = await Product.findOne({ _id: req.params.productId, isActive: true });
  if (!product) throw ApiError.notFound('Product is no longer available');
  if (quantity > product.stock) throw ApiError.conflict(`Only ${product.stock} unit(s) available`);
  item.quantity = quantity;
  await cart.save();
  ok(res, await buildCartView(req.user._id), 'Cart updated');
});

exports.removeItem = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  const before = cart ? cart.items.length : 0;
  if (!cart || !before) throw ApiError.notFound('Item not in cart');
  cart.items = cart.items.filter((i) => i.product.toString() !== req.params.productId);
  if (cart.items.length === before) throw ApiError.notFound('Item not in cart');
  await cart.save();
  ok(res, await buildCartView(req.user._id), 'Item removed');
});

exports.clear = asyncHandler(async (req, res) => {
  await Cart.findOneAndUpdate({ user: req.user._id }, { $set: { items: [] } });
  ok(res, await buildCartView(req.user._id), 'Cart cleared');
});

exports.buildCartView = buildCartView;
