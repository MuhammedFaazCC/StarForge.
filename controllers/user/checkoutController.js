const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Order = require("../../models/orderSchema");
const Address = require('../../models/addressSchema');
const User = require("../../models/userSchema");


const getCheckoutPage = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const cart = await Cart.findOne({ userId }).populate('items.productId');
    const addresses = await Address.find({ userId: userId }).sort({ createdAt: -1 });

    if (!cart || cart.items.length === 0) {
      return res.redirect('/cart');
    }

    const cartItems = cart.items.map(item => ({
      product: item.productId,
      quantity: item.quantity,
      subtotal: item.quantity * item.productId.price,
    }));

    const total = cartItems.reduce((acc, item) => acc + item.subtotal, 0);

    res.render("checkout", { user: req.session.user, cartItems, total, addresses });

  } catch (error) {
    console.error("Checkout page error:", error);
    res.status(500).send("Server error");
  }
};

const postCheckoutPage = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { selectedAddressId, paymentMethod } = req.body;

    if (!selectedAddressId) {
      return res.status(400).json({ error: "Please select a shipping address" });
    }

    if (!paymentMethod) {
      return res.status(400).json({ error: "Please select a payment method" });
    }

    const cart = await Cart.findOne({ userId }).populate('items.productId');

    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }

    const selectedAddress = await Address.findById(selectedAddressId);
    if (!selectedAddress) {
      return res.status(400).json({ error: "Invalid address selected" });
    }

    for (const item of cart.items) {
      if (item.productId.stock < item.quantity) {
        return res.status(400).json({ 
          error: `Insufficient stock for ${item.productId.name}. Available: ${item.productId.stock}, Requested: ${item.quantity}` 
        });
      }
    }

    const orderItems = cart.items.map(item => ({
      productId: item.productId._id,
      name: item.productId.name,
      price: item.productId.price,
      quantity: item.quantity,
    }));

    const totalAmount = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const newOrder = new Order({
      userId,
      items: orderItems,
      address: {
        fullName: selectedAddress.fullName,
        address: selectedAddress.address,
        city: selectedAddress.city,
        district: selectedAddress.district,
        state: selectedAddress.state,
        pinCode: selectedAddress.pinCode,
        email: selectedAddress.email
      },
      paymentMethod,
      totalAmount,
      status: "Processing",
      createdAt: new Date(),
    });

    await newOrder.save();

    for (const item of cart.items) {
      await Product.updateOne(
        { _id: item.productId._id },
        { $inc: { stock: -item.quantity } }
      );
    }

    await Cart.deleteOne({ userId });

    res.redirect("/orders/confirmation");

  } catch (error) {
    console.error("Checkout error:", error);
    res.status(500).send("Checkout failed");
  }
};

module.exports = {
    getCheckoutPage,
    postCheckoutPage,
};