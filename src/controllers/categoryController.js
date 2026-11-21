const Category = require('../models/Category');
const Product = require('../models/Product');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');

exports.list = asyncHandler(async (_req, res) => ok(res, await Category.find().sort({ name: 1 })));

exports.get = asyncHandler(async (req, res) => {
  const c = await Category.findById(req.params.id);
  if (!c) throw ApiError.notFound('Category not found');
  ok(res, c);
});

exports.create = asyncHandler(async (req, res) => created(res, await Category.create(req.body), 'Category created'));

exports.update = asyncHandler(async (req, res) => {
  const c = await Category.findById(req.params.id);
  if (!c) throw ApiError.notFound('Category not found');
  Object.assign(c, req.body);
  await c.save();
  ok(res, c, 'Category updated');
});

exports.remove = asyncHandler(async (req, res) => {
  if (await Product.exists({ category: req.params.id })) {
    throw ApiError.conflict('Cannot delete a category that still has products');
  }
  const c = await Category.findByIdAndDelete(req.params.id);
  if (!c) throw ApiError.notFound('Category not found');
  ok(res, undefined, 'Category deleted');
});
