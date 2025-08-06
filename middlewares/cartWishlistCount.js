const Cart = require('../models/cartSchema');
const Wishlist = require('../models/wishlistSchema');

const cartWishlistCount = async (req, res, next) => {
    try {
        // Initialize counts to 0
        res.locals.cartCount = 0;
        res.locals.wishlistCount = 0;

        // Only calculate counts if user is logged in
        if (req.session.user && req.session.user._id) {
            const userId = req.session.user._id;

            // Get cart count (number of distinct products)
            const cart = await Cart.findOne({ userId }).populate('items.productId');
            if (cart && cart.items) {
                res.locals.cartCount = cart.items.length;
            }

            // Get wishlist count (number of distinct products)
            const wishlist = await Wishlist.findOne({ userId }).populate('items.productId');
            if (wishlist && wishlist.items) {
                res.locals.wishlistCount = wishlist.items.length;
            }
        }

        next();
    } catch (error) {
        console.error('Error calculating cart/wishlist counts:', error);
        // Set default values on error
        res.locals.cartCount = 0;
        res.locals.wishlistCount = 0;
        next();
    }
};

module.exports = cartWishlistCount;