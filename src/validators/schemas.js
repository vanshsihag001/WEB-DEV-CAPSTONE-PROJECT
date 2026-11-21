const Joi = require('joi');

const objectId = Joi.string().hex().length(24);
const page = { page: Joi.number().integer().min(1), limit: Joi.number().integer().min(1).max(100) };

exports.register = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().min(8).max(72).pattern(/[A-Za-z]/).pattern(/\d/).required()
    .messages({ 'string.pattern.base': 'password must contain at least one letter and one number' }),
  role: Joi.string().valid('customer', 'seller').default('customer'), // admin cannot self-register
  phone: Joi.string().trim().max(20),
});
exports.login = Joi.object({ email: Joi.string().trim().lowercase().email().required(), password: Joi.string().required() });
exports.refresh = Joi.object({ refreshToken: Joi.string().required() });

exports.updateMe = Joi.object({
  name: Joi.string().trim().min(2).max(80),
  phone: Joi.string().trim().max(20),
  password: Joi.string().min(8).max(72).pattern(/[A-Za-z]/).pattern(/\d/),
}).min(1);
exports.adminUpdateUser = Joi.object({
  role: Joi.string().valid('customer', 'seller', 'admin'),
  isActive: Joi.boolean(),
}).min(1);
exports.userList = Joi.object({ ...page, role: Joi.string().valid('customer', 'seller', 'admin'), q: Joi.string().trim().max(60) });

exports.category = Joi.object({ name: Joi.string().trim().max(60).required(), description: Joi.string().trim().max(300).allow('') });
exports.categoryUpdate = Joi.object({ name: Joi.string().trim().max(60), description: Joi.string().trim().max(300).allow('') }).min(1);

exports.productCreate = Joi.object({
  name: Joi.string().trim().max(150).required(),
  description: Joi.string().trim().max(2000).allow(''),
  price: Joi.number().positive().precision(2).required(),
  category: objectId.required(),
  stock: Joi.number().integer().min(0).required(),
  lowStockThreshold: Joi.number().integer().min(0),
  images: Joi.array().items(Joi.string().uri()).max(8),
  seller: objectId, // admin only
});
exports.productUpdate = Joi.object({
  name: Joi.string().trim().max(150),
  description: Joi.string().trim().max(2000).allow(''),
  price: Joi.number().positive().precision(2),
  category: objectId,
  stock: Joi.number().integer().min(0),
  lowStockThreshold: Joi.number().integer().min(0),
  images: Joi.array().items(Joi.string().uri()).max(8),
  isActive: Joi.boolean(),
}).min(1);
exports.stockAdjust = Joi.object({ delta: Joi.number().integer().invalid(0).required() });
exports.productList = Joi.object({
  ...page,
  q: Joi.string().trim().max(100),
  category: objectId,
  seller: objectId,
  minPrice: Joi.number().min(0),
  maxPrice: Joi.number().min(0),
  inStock: Joi.boolean(),
  sort: Joi.string().valid('newest', 'price_asc', 'price_desc', 'name', 'relevance'),
});

exports.cartAdd = Joi.object({ productId: objectId.required(), quantity: Joi.number().integer().min(1).max(100).default(1) });
exports.cartUpdate = Joi.object({ quantity: Joi.number().integer().min(1).max(100).required() });

exports.checkout = Joi.object({
  shippingAddress: Joi.object({
    fullName: Joi.string().trim().max(80).required(),
    phone: Joi.string().trim().pattern(/^[0-9+\-\s]{7,15}$/).required(),
    line1: Joi.string().trim().max(150).required(),
    line2: Joi.string().trim().max(150).allow(''),
    city: Joi.string().trim().max(60).required(),
    state: Joi.string().trim().max(60).required(),
    postalCode: Joi.string().trim().max(12).required(),
    country: Joi.string().trim().max(60).default('India'),
  }).required(),
});
exports.orderStatus = Joi.object({ status: Joi.string().valid('confirmed', 'shipped', 'delivered', 'cancelled').required() });
exports.orderList = Joi.object({
  ...page,
  status: Joi.string().valid('pending', 'confirmed', 'shipped', 'delivered', 'cancelled'),
  from: Joi.date().iso(), to: Joi.date().iso(),
});

exports.reportQuery = Joi.object({
  from: Joi.date().iso(), to: Joi.date().iso(),
  seller: objectId, // admin only
  limit: Joi.number().integer().min(1).max(50).default(10),
  groupBy: Joi.string().valid('day', 'month').default('day'),
});
