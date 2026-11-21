const mongoose = require('mongoose');

const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

// Allowed order status transitions (state machine)
const TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true, required: true },
    checkoutId: { type: String, index: true }, // groups the per-seller orders created by one checkout
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [
      {
        _id: false,
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        name: { type: String, required: true },       // snapshot
        price: { type: Number, required: true },      // price snapshot at purchase time
        quantity: { type: Number, required: true, min: 1 },
      },
    ],
    totalAmount: { type: Number, required: true, min: 0 },
    shippingAddress: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      line1: { type: String, required: true },
      line2: String,
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true, default: 'India' },
    },
    payment: {
      method: { type: String, default: 'SIMULATED' },
      status: { type: String, enum: ['paid', 'refunded'], default: 'paid' },
      simulated: { type: Boolean, default: true }, // clearly marked: no real payment gateway
    },
    status: { type: String, enum: STATUSES, default: 'pending' },
    statusHistory: [
      { _id: false, status: String, changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, at: { type: Date, default: Date.now } },
    ],
  },
  { timestamps: true }
);

// ---- Indexes ----
orderSchema.index({ customer: 1, createdAt: -1 }); // customer order history
orderSchema.index({ seller: 1, status: 1, createdAt: -1 }); // seller order queue
orderSchema.index({ status: 1, createdAt: -1 }); // admin/report queries

orderSchema.set('toJSON', { transform: (_d, r) => { delete r.__v; return r; } });

module.exports = mongoose.model('Order', orderSchema);
module.exports.STATUSES = STATUSES;
module.exports.TRANSITIONS = TRANSITIONS;
