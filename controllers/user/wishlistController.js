// const path = require("path");
// const fs = require("fs");
const Wishlist = require("../../models/wishlistSchema");
const Cart = require("../../models/cartSchema");

const getCartCount = async (userId) => {
  try {
    if (!userId) return 0;
    const cart = await Cart.findOne({ userId });
    return cart ? cart.items.length : 0;
  } catch (error) {
    console.error("Error getting cart count:", error);
    return 0;
  }
};

const wishlistPage = async (req, res) => {
  try {
    const user = res.locals.userData;
    const wishlist = await Wishlist.findOne({ userId: user._id }).populate({
      path: 'items.productId',
      populate: { path: 'category', select: 'name isActive offer' }
    });

    let wishlistItems = [];
    if (wishlist && wishlist.items) {
      wishlistItems = wishlist.items
        .filter(item => item.productId && item.productId.isListed && !item.productId.isDeleted)
        .map(item => {
          const product = item.productId;
          const productOffer = product.offer || 0;
          const categoryOffer = product.category?.offer || 0;
          const bestOffer = Math.max(productOffer, categoryOffer);
          let finalPrice = product.price;
          if (bestOffer > 0) finalPrice = product.price - (product.price * bestOffer / 100);
          if (product.salesPrice && product.salesPrice < finalPrice) finalPrice = product.salesPrice;
          return {
            ...product.toObject(),
            offer: productOffer,
            categoryOffer,
            bestOffer,
            finalPrice: Math.round(finalPrice * 100) / 100,
            hasOffer: bestOffer > 0
          };
        });
    }

    const cartCount = await getCartCount(user._id);
    return res.render("wishlist", {
      user,
      currentPage: "wishlist",
      wishlistItems,
      wishlistCount: wishlistItems.length,
      cartCount
    });
  } catch (error) {
    console.error("Wishlist load error:", error);
    return res.status(500).send("Server error");
  }
};

const addToWishlist = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.json({ redirect: '/login' });
    }

    const userId = req.session.user._id;
    const productId = req.params.id;

    let wishlist = await Wishlist.findOne({ userId });
    let added = false;

    if (!wishlist) {
      wishlist = new Wishlist({ userId, items: [{ productId }] });
      added = true;
    } else {
      const index = wishlist.items.findIndex(item => item.productId.toString() === productId);
      if (index > -1) {
        wishlist.items.splice(index, 1);
        added = false;
      } else {
        wishlist.items.push({ productId });
        added = true;
      }
    }

    await wishlist.save();
    const wishlistCount = (wishlist.items || []).length;
    return res.json({ success: true, added, message: added ? 'Added to wishlist' : 'Removed from wishlist', wishlistCount });
  } catch (error) {
    console.error('Add to wishlist error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const removeFromWishlist = async (req, res) => {
  const userId = req.session.user?._id;
  const productId = req.body.productId;
  try {
    await Wishlist.updateOne(
      { userId },
      { $pull: { items: { productId } } }
    );
    // compute updated count
    const updated = await Wishlist.findOne({ userId });
    const wishlistCount = updated && updated.items ? updated.items.length : 0;
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({ success: true, message: 'Item removed from wishlist successfully', wishlistCount });
    }
    return res.redirect('/wishlist');
  } catch (error) {
    console.error('Remove from wishlist error:', error);
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.status(500).json({ success: false, message: 'Failed to remove item from wishlist' });
    }
    return res.status(500).redirect('/wishlist');
  }
};
module.exports = {
    wishlistPage,
    addToWishlist,
    removeFromWishlist
}