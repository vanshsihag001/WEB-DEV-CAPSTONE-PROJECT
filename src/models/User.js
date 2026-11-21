const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { saltRounds } = require('../config/env');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, minlength: 2, maxlength: 80 },
    email: {
      type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email address'],
    },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ['customer', 'seller', 'admin'], default: 'customer', index: true },
    phone: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    // Hashed refresh tokens (never the raw token)
    refreshTokens: {
      type: [{ tokenHash: String, expiresAt: Date, _id: false }],
      select: false, default: [],
    },
  },
  { timestamps: true }
);

// Hash password with bcrypt whenever it is set/changed
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, saltRounds);
  next();
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => { delete ret.password; delete ret.refreshTokens; delete ret.__v; return ret; },
});

module.exports = mongoose.model('User', userSchema);
