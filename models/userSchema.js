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
        default: undefined,
    },
    profileImage: {
        type: String,
        default: null
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
    referralToken: {
        type: String,
        unique: true,
        sparse: true
    },
    referralPoints: {
        type: Number,
        default: 0
    },
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    referralRewards: [{
        couponCode: String,
        issuedAt: {
            type: Date,
            default: Date.now
        },
        isUsed: {
            type: Boolean,
            default: false
        }
    }],
    role: {
        type: String,
        enum: ['admin', 'customer'],
        default: 'customer'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isBlocked: {
        type: Boolean,
        default: false
    },

    wallet: {
    balance: {
      type: Number,
      default: 0
    },
    transactions: [
      {
        amount: Number,
        type: {
          type: String,
          enum: ['credit', 'debit']
        },
        description: String,
        date: {
          type: Date,
          default: Date.now
        }
      }
    ]
  }
}, {
    timestamps: true
}); 


userSchema.methods.isUserBlocked = function() {
    return this.isBlocked;
};

// Ensure mobile is unique only when present (non-null, exists)
// Use sparse unique index so only documents that actually have a mobile value are indexed.
// IMPORTANT: Ensure code never saves mobile: null; leave it undefined when absent.
userSchema.index(
  { mobile: 1 },
  { unique: true, sparse: true, name: 'mobile_1' }
);

module.exports = mongoose.model('User', userSchema);