const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Product name is required'], trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    price: { type: Number, required: [true, 'Price is required'], min: [0.01, 'Price must be greater than 0'] },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    stock: { type: Number, required: true, min: [0, 'Stock cannot be negative'], default: 0, validate: Number.isInteger },
    lowStockThreshold: { type: Number, min: 0, default: 5 },
    images: [{ type: String }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ---- Indexes ----
// 1. Full-text search on name/description (weighted)
productSchema.index({ name: 'text', description: 'text' }, { weights: { name: 5, description: 1 }, name: 'product_text_idx' });
// 2. Compound index for category browsing + price sorting/filtering
productSchema.index({ category: 1, price: 1 });
// 3. Seller dashboard / ownership queries
productSchema.index({ seller: 1, isActive: 1 });
// 4. Low-stock lookups
productSchema.index({ stock: 1 });

productSchema.virtual('isLowStock').get(function () {
  return this.stock <= this.lowStockThreshold;
});
productSchema.set('toJSON', { virtuals: true, transform: (_d, r) => { delete r.id; delete r.__v; return r; } });

module.exports = mongoose.model('Product', productSchema);
