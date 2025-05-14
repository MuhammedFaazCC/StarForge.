const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User is required']
    },
    street: {
        type: String,
        required: [true, 'Street is required'],
        trim: true,
        maxlength: [100, 'Street cannot exceed 100 characters']
    },
    city: {
        type: String,
        required: [true, 'City is required'],
        trim: true,
        maxlength: [50, 'City cannot exceed 50 characters']
    },
    state: {
        type: String,
        required: [true, 'State is required'],
        trim: true,
        maxlength: [50, 'State cannot exceed 50 characters']
    },
    postalCode: {
        type: String,
        required: [true, 'Postal code is required'],
        trim: true,
        match: [/^\d{5}(-\d{4})?$/, 'Please use a valid postal code']
    },
    country: {
        type: String,
        required: [true, 'Country is required'],
        trim: true,
        maxlength: [50, 'Country cannot exceed 50 characters']
    },
    isDefault: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Address', addressSchema);