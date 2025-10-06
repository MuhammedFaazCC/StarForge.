const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const Wishlist = require('../../models/wishlistSchema');


const viewCart = async (req, res) => {
  const userId = req.session.user._id;
  const cart = await Cart.findOne({ userId:userId }).populate('items.productId');
  
  res.render('cart', { cart, user: req.session.user });
};

const addToCart = async (req, res) => {
  try {
    const productId = req.params.id;
    const userId = req.session.user._id;
    const quantity = parseInt(req.body.quantity) || 1;
    const source = req.body.source;
    
    if (!req.session || !req.session.user || !req.session.user._id) {
      return res.status(401).json({ success: false, message: 'User not logged in' });
    }

    const product = await Product.findById(productId).populate('category');
    
    if (!product || !product.isListed || !product.category?.isActive) {
      return res.status(400).json({ success: false, message: 'Product not available' });
    }
    
    if (product.stock === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'This product is currently out of stock',
        outOfStock: true 
      });
    }

    let cart = await Cart.findOne({ userId: userId });

    if (!cart) {
      cart = new Cart({ userId: userId, items: [] });
    }

    const itemIndex = cart.items.findIndex(item => 
      item.productId && item.productId.toString() === productId.toString()
    );

    if (itemIndex !== -1) {
      const newTotal = cart.items[itemIndex].quantity + quantity;

      if (newTotal > 5) {
        return res.status(400).json({ 
          success: false, 
          message: 'You can only add up to 5 units of this product to your cart'
        });
      }

      if (newTotal > product.stock) {
        return res.status(400).json({ 
          success: false, 
          message: 'Cannot exceed available stock quantity',
          outOfStock: true 
        });
      }

      cart.items[itemIndex].quantity = newTotal;

    } else {
      if (quantity > 5) {
        return res.status(400).json({ 
          success: false, 
          message: 'You can only add up to 5 units of this product to your cart'
        });
      }

      if (quantity > product.stock) {
        return res.status(400).json({ 
          success: false, 
          message: 'Not enough stock available',
          outOfStock: true 
        });
      }

      cart.items.push({ productId: productId, quantity: quantity });
    }

    if (source === 'wishlist') {
      await Wishlist.updateOne(
        { userId: userId },
        { $pull: { items: { productId: productId } } }
      );
    }

    await cart.save();
    // compute updated counts
    const updatedCart = await Cart.findOne({ userId });
    const cartCount = updatedCart && updatedCart.items ? updatedCart.items.length : 0;
    let wishlistCount;
    if (source === 'wishlist') {
      const updatedWishlist = await Wishlist.findOne({ userId });
      wishlistCount = updatedWishlist && updatedWishlist.items ? updatedWishlist.items.length : 0;
    }

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({ success: true, message: 'Product added to cart successfully', cartCount, ...(typeof wishlistCount !== 'undefined' ? { wishlistCount } : {}) });
    }
    
    res.redirect('/cart');
  } catch (error) {
    console.error('Error in addToCart:', error);
    
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
    
    res.status(500).send('Internal server error');
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
    const maxAllowed = Math.min(5, item.productId.stock); // Limit to 5 or stock, whichever is lower

    // Validate quantity limits
    if (newQty < 1) {
      return res.status(400).json({ 
        success: false, 
        error: 'Minimum quantity is 1' 
      });
    }

    if (newQty > maxAllowed) {
      const limitReason = item.productId.stock < 5 ? 'available stock' : 'maximum limit (5)';
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
    const itemSubtotal = item.quantity * item.productId.salesPrice;
    const cartTotal = updatedCart.items.reduce((sum, cartItem) => {
      const price = Number(cartItem.productId?.salesPrice) || 0;
      const qty = Number(cartItem.quantity) || 0;
      return sum + (price * qty);
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
    const {  id: cartItemId  } = req.params;
    console.log(req.params)
    await Cart.updateOne(
      { userId: req.session.user._id },
      { $pull: { items: { _id: cartItemId } } }
    );
    // compute updated cart count
    const updatedCart = await Cart.findOne({ userId: req.session.user._id });
    const cartCount = updatedCart && updatedCart.items ? updatedCart.items.length : 0;
    res.json({ success: true, cartCount });
  } catch (error) {
    console.error('Error in removeFromCart:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  viewCart,
  addToCart,
  updateCartQuantity,
  removeFromCart,
};
