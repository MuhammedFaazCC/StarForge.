const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const wishlistSchema = new Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
      }
    }
  ]
}, { timestamps: true });

module.exports = model('Wishlist', wishlistSchema);