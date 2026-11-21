const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');

const oid = (id) => new mongoose.Types.ObjectId(id);

// Sellers only see their own data; admins may optionally filter by ?seller=
const sellerScope = (req) => {
  if (req.user.role === 'seller') return oid(req.user.id);
  return req.query.seller ? oid(req.query.seller) : null;
};
const dateMatch = (q) => {
  if (!q.from && !q.to) return {};
  const c = {};
  if (q.from) c.$gte = q.from;
  if (q.to) c.$lte = q.to;
  return { createdAt: c };
};

/**
 * AGGREGATION 1 - Sales summary: revenue, order count and average order value
 * grouped by day or month (cancelled orders excluded), plus overall totals.
 */
exports.salesSummary = asyncHandler(async (req, res) => {
  const seller = sellerScope(req);
  const match = { status: { $ne: 'cancelled' }, ...dateMatch(req.query) };
  if (seller) match.seller = seller;
  const fmt = req.query.groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';

  const [result] = await Order.aggregate([
    { $match: match },
    {
      $facet: {
        timeline: [
          { $group: { _id: { $dateToString: { format: fmt, date: '$createdAt' } }, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
          { $project: { _id: 0, period: '$_id', revenue: { $round: ['$revenue', 2] }, orders: 1 } },
          { $sort: { period: 1 } },
        ],
        totals: [
          { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 }, avgOrderValue: { $avg: '$totalAmount' } } },
          { $project: { _id: 0, orders: 1, revenue: { $round: ['$revenue', 2] }, avgOrderValue: { $round: ['$avgOrderValue', 2] } } },
        ],
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }, { $project: { _id: 0, status: '$_id', count: 1 } }],
      },
    },
  ]);
  ok(res, {
    totals: result.totals[0] || { orders: 0, revenue: 0, avgOrderValue: 0 },
    timeline: result.timeline,
    byStatus: result.byStatus,
  });
});

/**
 * AGGREGATION 2 - Best-selling products: unwind order items, group by product,
 * sum units and revenue, sort and join product details with $lookup.
 */
exports.bestSellers = asyncHandler(async (req, res) => {
  const seller = sellerScope(req);
  const match = { status: { $ne: 'cancelled' }, ...dateMatch(req.query) };
  if (seller) match.seller = seller;

  const data = await Order.aggregate([
    { $match: match },
    { $unwind: '$items' },
    { $group: { _id: '$items.product', name: { $first: '$items.name' }, unitsSold: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
    { $sort: { unitsSold: -1, revenue: -1 } },
    { $limit: req.query.limit || 10 },
    { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    { $project: { _id: 0, productId: '$_id', name: 1, unitsSold: 1, revenue: { $round: ['$revenue', 2] }, currentStock: '$product.stock', currentPrice: '$product.price' } },
  ]);
  ok(res, data);
});

/**
 * AGGREGATION 3 - Inventory summary per category: product count, total units,
 * stock value and number of low-stock products.
 */
exports.inventorySummary = asyncHandler(async (req, res) => {
  const seller = sellerScope(req);
  const match = { isActive: true };
  if (seller) match.seller = seller;

  const data = await Product.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$category',
        products: { $sum: 1 },
        totalUnits: { $sum: '$stock' },
        stockValue: { $sum: { $multiply: ['$price', '$stock'] } },
        lowStockCount: { $sum: { $cond: [{ $lte: ['$stock', '$lowStockThreshold'] }, 1, 0] } },
        outOfStock: { $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] } },
      },
    },
    { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    { $project: { _id: 0, categoryId: '$_id', category: { $ifNull: ['$category.name', 'Uncategorised'] }, products: 1, totalUnits: 1, stockValue: { $round: ['$stockValue', 2] }, lowStockCount: 1, outOfStock: 1 } },
    { $sort: { stockValue: -1 } },
  ]);
  const totals = data.reduce((t, r) => ({
    products: t.products + r.products, totalUnits: t.totalUnits + r.totalUnits,
    stockValue: Math.round((t.stockValue + r.stockValue) * 100) / 100, lowStockCount: t.lowStockCount + r.lowStockCount,
  }), { products: 0, totalUnits: 0, stockValue: 0, lowStockCount: 0 });
  ok(res, { totals, byCategory: data });
});
