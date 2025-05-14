const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true,
        minlength: [2, 'Full name must be at least 2 characters'],
        maxlength: [50, 'Full name cannot exceed 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address']
    },
    mobile: {
        type: String,
        required: [true, 'Mobile number is required'],
        unique: true,
        trim: true,
        match: [/^[0-9]{10}$/, 'Mobile number must be 10 digits']
    },
    password: {
        type: String,
        required: [function() { return !this.googleId; }, 'Password is required unless signing up with Google'],
        minlength: [6, 'Password must be at least 6 characters']
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true
    },
    referralCode: {
        type: String,
        unique: true,
        sparse: true
    },
    referralPoints: {
        type: Number,
        default: 0
    },
    role: {
        type: String,
        enum: ['admin', 'customer'],
        default: 'customer'
    },
    isActive: {
        type: Boolean,
        default: true
    },
}, {
    timestamps: true
});

module.exports = mongoose.model('User', userSchema);