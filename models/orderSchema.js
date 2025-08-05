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
        enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled','Placed', 'Return Requested', 'Returned', 'Return Declined', 'Payment Failed'],
        default: 'Processing'
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
        salesPrice: Number,
        status: {
            type: String,
            enum: ['Ordered', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Return Requested', 'Returned', 'Return Declined'],
            default: 'Ordered'
        },
        deliveredAt: {
            type: Date,
            default: null
        },
        cancelledAt: {
            type: Date,
            default: null
        },
        cancellationReason: {
            type: String,
            default: null
        },
        returnReason: {
            type: String,
            default: null
        },
        returnRequestedAt: {
            type: Date,
            default: null
        }
    }
    ],

    deliveredAt: Date,
    createdAt: Date,
    paymentId: {
        type: String,
        default: null
    },
    razorpayOrderId: {
        type: String,
        default: null
    },
    failureReason: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Order', orderSchema);