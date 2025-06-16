const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    orderDate: {
        type: Date,
        default: Date.now
    },
    totalAmount: {
        type: Number,
        required: true
    },
    coupon: {
        code: {
        type: String,
        default: null
        },
        discountAmount: {
        type: Number,
        default: 0
        }
    },
    offeredPrice: {
  type: Number,
  required: true,
},

    status: {
        type: String,
        enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['Online','COD','Wallet'],
        required: true
    },
    address: {
        type: String,
        required: true
    },
    items: [
    {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
        },
        name: String,
        quantity: Number,
        salesPrice: Number
    }
    ],

    deliveredAt: Date,
    createdAt: Date
}, {
    timestamps: true
});

module.exports = mongoose.model('Order', orderSchema);