const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Order = require("../../models/orderSchema");
const Address = require('../../models/addressSchema');
const User = require("../../models/userSchema");
const Razorpay = require('razorpay');
const { login } = require("./userController");


const getCheckoutPage = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const cart = await Cart.findOne({ userId }).populate('items.productId');
    const addresses = await Address.find({ userId: userId }).sort({ createdAt: -1 });
    const addressId = req.params.addressId;
    const address = await Address.findOne({ _id: addressId });

    if (!cart || cart.items.length === 0) {
      return res.redirect('/cart');
    }

    const cartItems = cart.items.map(item => ({
      product: item.productId,
      quantity: item.quantity,
      subtotal: item.quantity * item.productId.salesPrice,
    }));

    const total = cartItems.reduce((acc, item) => acc + item.subtotal, 0);

    res.render("checkout", { user: req.session.user, cartItems, total, addresses, address, razorpayKey: process.env.RAZORPAY_KEY_ID });

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
    let totalAmount = 0;
for (const item of cart.items) {
  const price = item.productId.salesPrice || 0;
  const quantity = item.quantity || 0;
  totalAmount += price * quantity;
}

    console.log(totalAmount,'total amount');
    const newOrder = new Order({
      userId,
      items: cart.items.map(item => ({
        productId: item.productId._id,
        name: item.productId.name,
        quantity: item.quantity,
        salesPrice: item.productId.salesPrice
      })),

      address: `${selectedAddress.fullName}, ${selectedAddress.address}, ${selectedAddress.city}, ${selectedAddress.district}, ${selectedAddress.state}, ${selectedAddress.pinCode}, ${selectedAddress.email}`,
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
    res.render("orderPlaced");

  } catch (error) {
    console.error("Checkout error:", error);
    res.status(500).send("Checkout failed");
  }
};

const postRazorpay = async (req, res) => {
  try {
    const { amount } = req.body;

    const razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const options = {
  amount: Math.round(amount * 100),
  currency: "INR",
  receipt: "receipt_order_" + Date.now(),
};


    const order = await razorpayInstance.orders.create(options);
    res.json({ success: true, order });
  } catch (error) {
    console.error("Razorpay Order Error:", error);
    res.status(500).json({ success: false, error: "Order creation failed" });
  }
};


const orderSuccess = async (req, res) => {
  try {
    const { payment_id, order_id } = req.query;
    const user = req.session.user;

    console.log("Payment Success:", payment_id, order_id);

    const cart = await Cart.findOne({ userId: user._id }).populate('items.productId');
const selectedAddress = await Address.findOne({ userId: user._id }).sort({ createdAt: -1 });

if (!cart || cart.items.length === 0 || !selectedAddress) {
  return res.redirect("/cart");
}

const cartItems = cart.items.map(item => ({
  product: item.productId,
  quantity: item.quantity,
  subtotal: item.quantity * item.productId.salesPrice,
}));

const totalAmount = cartItems.reduce((acc, item) => acc + item.subtotal, 0);

const newOrder = new Order({
  userId: user._id,
  items: cart.items.map(item => ({
    productId: item.productId._id,
    name: item.productId.name,
    quantity: item.quantity,
    salesPrice: item.productId.salesPrice
  })),

  address: `${selectedAddress.address}, ${selectedAddress.city}, ${selectedAddress.state}, ${selectedAddress.pinCode}`,
  paymentMethod: 'Online',
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

await Cart.deleteOne({ userId: user._id });

res.render("orderPlaced", {
  user,
  paymentId: payment_id,
  orderId: order_id
});


  } catch (error) {
    console.error("Order success error:", error);
    res.status(500).send("Something went wrong while showing order success.");
  }
};


module.exports = {
    getCheckoutPage,
    postCheckoutPage,
    postRazorpay,
    orderSuccess,
};