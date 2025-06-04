const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  brand: {
    type: String,
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  offer: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  salesPrice: {
    type: Number,
    min: 0,
  },
  description: {
    type: String,
    trim: true,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
  },
  sizes: {
    type: [String],
    default: [],
  },
  rimMaterial: {
    type: String,
    trim: true,
  },
  finish: {
    type: String,
    trim: true,
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
  },
   color: {
    type: String,
    trim: true,
    default: ''
  },
  mainImage: {
    type: String,
    default: '',
  },
  additionalImages: {
    type: [String],
    default: [],
  },
  isListed: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Product', productSchema);