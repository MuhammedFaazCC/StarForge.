const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  type: {
    type: String,
    enum: ['product', 'category', 'referral'],
    required: true
  },
  discountPercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  applicableTo: [{
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'applicableToModel'
  }],
  applicableToModel: {
    type: String,
    enum: ['Product', 'Category'],
    required: function() {
      return this.type === 'product' || this.type === 'category';
    }
  },
  startDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true,
    validate: {
      validator: function(value) {
        return value > this.startDate;
      },
      message: 'End date must be after start date'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  usageLimit: {
    type: Number,
    default: null // null means unlimited
  },
  usedCount: {
    type: Number,
    default: 0
  },
  minimumAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for better query performance
offerSchema.index({ type: 1, isActive: 1, startDate: 1, endDate: 1 });
offerSchema.index({ applicableTo: 1 });

// Virtual to check if offer is currently valid
offerSchema.virtual('isCurrentlyValid').get(function() {
  const now = new Date();
  return this.isActive && 
         this.startDate <= now && 
         this.endDate >= now &&
         (this.usageLimit === null || this.usedCount < this.usageLimit);
});

// Method to check if offer can be applied
offerSchema.methods.canBeApplied = function(amount = 0) {
  return this.isCurrentlyValid && amount >= this.minimumAmount;
};

module.exports = mongoose.model('Offer', offerSchema);