const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const Wishlist = require('../../models/wishlistSchema');


const viewCart = async (req, res) => {
  const userId = req.session.user._id;
  const cart = await Cart.findOne({ userId: userId }).populate('items.productId');

  if (req.session.coupon) {
    req.session.coupon = null;
  }

  res.render('cart', { cart, user: req.session.user });
};

const addToCart = async (req, res) => {
  try {
    // AUTH CHECK FIRST — BEFORE ANY ACCESS
    if (!req.session || !req.session.user || !req.session.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User not logged in'
      });
    }

    const productId = req.params.id;
    const userId = req.session.user._id;
    const quantity = parseInt(req.body.quantity) || 1;
    const source = req.body.source;
    const variantId = req.body.variantId || null;

    const product = await Product.findById(productId).populate('category');

    if (!product || !product.isListed || !product.category?.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Product not available'
      });
    }

    let stockToCheck = product.stock;
    if (product.hasVariants) {
      if (!variantId) {
        return res.status(400).json({
          success: false,
          message: 'Please select a variant'
        });
      }
      const variant = product.variants.id(variantId);
      if (!variant || !variant.isListed) {
        return res.status(404).json({
          success: false,
          message: 'Variant unavailable'
        });
      }
      stockToCheck = variant.stock;
    }

    if (stockToCheck === 0) {
      return res.status(400).json({
        success: false,
        message: 'This product or variant is currently out of stock',
        outOfStock: true
      });
    }

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const itemIndex = cart.items.findIndex(
      item => item.productId.toString() === productId &&
        (item.variantId ? item.variantId.toString() : null) === (variantId ? variantId.toString() : null)
    );

    if (itemIndex !== -1) {
      const newTotal = cart.items[itemIndex].quantity + quantity;

      if (newTotal > 5) {
        return res.status(400).json({
          success: false,
          message: 'You can only add up to 5 units of this product'
        });
      }

      if (newTotal > stockToCheck) {
        return res.status(400).json({
          success: false,
          message: 'Cannot exceed available stock',
          outOfStock: true
        });
      }

      cart.items[itemIndex].quantity = newTotal;
    } else {
      if (quantity > 5) {
        return res.status(400).json({
          success: false,
          message: 'You can only add up to 5 units of this product'
        });
      }

      if (quantity > stockToCheck) {
        return res.status(400).json({
          success: false,
          message: 'Not enough stock available',
          outOfStock: true
        });
      }

      cart.items.push({ productId, variantId, quantity });
    }

    if (source === 'wishlist') {
      await Wishlist.updateOne(
        { userId },
        { $pull: { items: { productId } } }
      );
    }

    await cart.save();

    const cartCount = cart.items.length;

    return res.json({
      success: true,
      message: 'Product added to cart successfully',
      cartCount
    });

  } catch (error) {
    console.error('Error in addToCart:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const updateCartQuantity = async (req, res) => {
  try {
    const { id: cartItemId } = req.params;
    const { change } = req.body;

    const cart = await Cart.findOne({ userId: req.session.user._id }).populate('items.productId');

    if (!cart) {
      return res.status(404).json({ success: false, error: 'Cart not found' });
    }

    const item = cart.items.id(cartItemId);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found in cart' });
    }

    const newQty = item.quantity + change;

    let productOrVariantStock = item.productId.stock;
    if (item.productId.hasVariants && item.variantId) {
      const variant = item.productId.variants.id(item.variantId);
      if (variant) {productOrVariantStock = variant.stock;}
    }

    const maxAllowed = Math.min(5, productOrVariantStock);

    // Validate quantity limits
    if (newQty < 1) {
      return res.status(400).json({
        success: false,
        error: 'Minimum quantity is 1'
      });
    }

    if (newQty > maxAllowed) {
      const limitReason = productOrVariantStock < 5 ? 'available stock' : 'maximum limit (5)';
      return res.status(400).json({
        success: false,
        error: `Cannot exceed ${limitReason}. Maximum allowed: ${maxAllowed}`
      });
    }

    // Update quantity
    item.quantity = newQty;
    await cart.save();

    // Calculate updated totals
    const updatedCart = await Cart.findOne({ userId: req.session.user._id }).populate('items.productId');

    let itemPrice = item.productId.salesPrice || item.productId.price || 0;
    if (item.productId.hasVariants && item.variantId) {
      const v = item.productId.variants.id(item.variantId);
      if (v) {itemPrice = v.salesPrice || v.price;}
    }
    const itemSubtotal = item.quantity * itemPrice;

    const cartTotal = updatedCart.items.reduce((sum, cartItem) => {
      let price = cartItem.productId?.salesPrice || cartItem.productId?.price || 0;
      if (cartItem.productId?.hasVariants && cartItem.variantId) {
        const v = cartItem.productId.variants.id(cartItem.variantId);
        if (v) {price = v.salesPrice || v.price;}
      }
      return sum + (price * cartItem.quantity);
    }, 0);
    const totalItems = updatedCart.items.reduce((sum, cartItem) => sum + cartItem.quantity, 0);

    return res.json({
      success: true,
      data: {
        itemSubtotal: itemSubtotal.toFixed(2),
        cartTotal: cartTotal.toFixed(2),
        totalItems: totalItems,
        newQuantity: newQty,
        maxAllowed: maxAllowed
      }
    });

  } catch (error) {
    console.error('Error in updateCartQuantity:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

const removeFromCart = async (req, res) => {
  try {
    const { id: cartItemId } = req.params;

    await Cart.updateOne(
      { userId: req.session.user._id },
      { $pull: { items: { _id: cartItemId } } }
    );

    const updatedCart = await Cart
      .findOne({ userId: req.session.user._id })
      .populate('items.productId');

    const totalItems = updatedCart.items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    const cartTotal = updatedCart.items.reduce((sum, item) => {
      let price = item.productId?.salesPrice || item.productId?.price || 0;
      if (item.productId?.hasVariants && item.variantId) {
        const v = item.productId.variants.id(item.variantId);
        if (v) {price = v.salesPrice || v.price;}
      }
      return sum + (price * item.quantity);
    }, 0);

    return res.json({
      success: true,
      totalItems,
      cartTotal: cartTotal.toFixed(2)
    });

  } catch (error) {
    console.error('Error in removeFromCart:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

module.exports = {
  viewCart,
  addToCart,
  updateCartQuantity,
  removeFromCart,
};
