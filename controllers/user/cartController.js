const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const Wishlist = require('../../models/wishlistSchema');


const viewCart = async (req, res) => {
  const userId = req.session.user._id;
  const cart = await Cart.findOne({ userId: req.session.user._id }).populate('items.productId');
  res.render('cart', { cart });
};

const addToCart = async (req, res) => {
  try {
    const productId = req.params.id;
    const userId = req.session.user._id;
    const quantity = parseInt(req.body.quantity) || 1;
    const source = req.body.source;
    if (!req.session || !req.session.user || !req.session.user._id) {
      return res.status(401).json({ message: 'User not logged in' });
    }

    const product = await Product.findById(productId).populate('category');

    if (!product || !product.isListed || !product.category?.isActive || product.stock === 0) {
      return res.status(400).send('Product not available');
    }

    let cart = await Cart.findOne({ userId: userId });

    if (!cart) {
      cart = new Cart({ userId: userId, items: [] });
    }

    const itemIndex = cart.items.findIndex(item => item.productId && item.productId.toString() === productId.toString());

    if (itemIndex !== -1) {
      if (cart.items[itemIndex].quantity + quantity <= product.stock) {
        cart.items[itemIndex].quantity += quantity;
      } else {
        return res.status(400).json({ error: 'Cannot exceed stock quantity' });
      }
    } else {
      if (quantity > product.stock) {
        return res.status(400).json({ error: 'Not enough stock' });
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
    res.redirect('/cart');
  } catch (error) {
    console.error('Error in addToCart:', error);
    res.status(500).send('Internal server error');
  }
};




const updateCartQuantity = async (req, res) => {
  try {
    const { id: cartItemId } = req.params;
    console.log('cart item',cartItemId)
    const { change } = req.body;

    const cart = await Cart.findOne({ userId: req.session.user._id }).populate('items.productId');
;
    const item = cart.items.id(cartItemId);

    if (!item) return res.status(404).json({ error: 'Item not found' });

    const newQty = item.quantity + change;
    if (newQty < 1 || newQty > item.productId.stock) {
      return res.status(400).json({ error: 'Invalid quantity' });
    }

    item.quantity = newQty;
    await cart.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Error in updateCartQuantity:', error); 
    res.status(500).json({ error: 'Internal server error' });
  }
};

const removeFromCart = async (req, res) => {
  try {
    const {  id: cartItemId  } = req.params;
    await Cart.updateOne(
      { userId: req.session.user._id },
      { $pull: { items: { _id: cartItemId } } }
    );
    res.json({ success: true });
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
