const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const events = require('../utils/events');
const { ok, created } = require('../utils/response');
const { getPagination, buildMeta } = require('../utils/pagination');

const SORTS = {
  newest: { createdAt: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  name: { name: 1 },
};

// Seller may only touch own products; admin may touch any
const assertOwnership = (product, user) => {
  if (user.role !== 'admin' && product.seller.toString() !== user.id) {
    throw ApiError.forbidden('You can only modify your own products');
  }
};
const checkLowStock = (product) => {
  if (product.stock <= product.lowStockThreshold) events.emit('stock.low', { product });
};

// Public: search, filter, sort, paginate
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { q, category, seller, minPrice, maxPrice, inStock, sort } = req.query;
  const filter = { isActive: true };
  if (q) filter.$text = { $search: q };
  if (category) filter.category = category;
  if (seller) filter.seller = seller;
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price.$gte = minPrice;
    if (maxPrice !== undefined) filter.price.$lte = maxPrice;
  }
  if (inStock) filter.stock = { $gt: 0 };

  let query = Product.find(filter);
  if (q && (sort === 'relevance' || !sort)) {
    query = query.select({ score: { $meta: 'textScore' } }).sort({ score: { $meta: 'textScore' } });
  } else {
    query = query.sort(SORTS[sort] || SORTS.newest);
  }
  const [items, total] = await Promise.all([
    query.skip(skip).limit(limit).populate('category', 'name slug').populate('seller', 'name'),
    Product.countDocuments(filter),
  ]);
  ok(res, items, undefined, buildMeta(page, limit, total));
});

exports.get = asyncHandler(async (req, res) => {
  const p = await Product.findOne({ _id: req.params.id, isActive: true })
    .populate('category', 'name slug').populate('seller', 'name');
  if (!p) throw ApiError.notFound('Product not found');
  ok(res, p);
});

// Seller/admin: own inventory (includes inactive)
exports.mine = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = req.user.role === 'admin' ? {} : { seller: req.user._id };
  const [items, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('category', 'name'),
    Product.countDocuments(filter),
  ]);
  ok(res, items, undefined, buildMeta(page, limit, total));
});

// Low-stock alerts list (stock <= lowStockThreshold)
exports.lowStock = asyncHandler(async (req, res) => {
  const match = { isActive: true, $expr: { $lte: ['$stock', '$lowStockThreshold'] } };
  if (req.user.role === 'seller') match.seller = req.user._id;
  ok(res, await Product.find(match).sort({ stock: 1 }).populate('category', 'name'));
});

exports.create = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  if (!(await Category.exists({ _id: data.category }))) throw ApiError.badRequest('Category does not exist');
  if (req.user.role === 'seller') {
    data.seller = req.user._id; // sellers can never create for someone else
  } else if (data.seller) {
    const s = await User.findOne({ _id: data.seller, role: { $in: ['seller', 'admin'] } });
    if (!s) throw ApiError.badRequest('Seller does not exist');
  } else {
    data.seller = req.user._id;
  }
  const product = await Product.create(data);
  checkLowStock(product);
  created(res, product, 'Product created');
});

exports.update = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound('Product not found');
  assertOwnership(product, req.user);
  if (req.body.category && !(await Category.exists({ _id: req.body.category }))) {
    throw ApiError.badRequest('Category does not exist');
  }
  Object.assign(product, req.body);
  await product.save();
  checkLowStock(product);
  ok(res, product, 'Product updated');
});

// Soft delete: keeps historical orders consistent
exports.remove = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound('Product not found');
  assertOwnership(product, req.user);
  product.isActive = false;
  await product.save();
  ok(res, undefined, 'Product removed from catalogue');
});

// Atomic restock / manual adjustment. The filter guarantees stock never drops below zero.
exports.adjustStock = asyncHandler(async (req, res) => {
  const { delta } = req.body;
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound('Product not found');
  assertOwnership(product, req.user);
  const filter = { _id: product._id };
  if (delta < 0) filter.stock = { $gte: -delta };
  const updated = await Product.findOneAndUpdate(filter, { $inc: { stock: delta } }, { new: true });
  if (!updated) throw ApiError.conflict('Insufficient stock for this adjustment');
  checkLowStock(updated);
  ok(res, updated, 'Stock updated');
});
