const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  discount: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  expiryDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['Active', 'Expired', 'Inactive'],
    default: 'Active'
  },
  usageLimit: {
    type: Number,
    default: 1 
  },
  minimumAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  maxAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  usedBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    usedCount: {
      type: Number,
      default: 0
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  deactivatedAt: {
    type: Date
  }
});

module.exports = mongoose.model('Coupon', couponSchema);