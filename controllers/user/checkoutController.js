const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Order = require("../../models/orderSchema");
const Address = require('../../models/addressSchema');
const Coupon = require("../../models/couponSchema");
const User = require("../../models/userSchema");
const Razorpay = require('razorpay');

const getCheckoutPage = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/login?redirect=/checkout');
    }

    const userId = req.session.user._id;
    const cart = await Cart.findOne({ userId }).populate('items.productId');
    const addresses = await Address.find({ userId: userId }).sort({ createdAt: -1 });

    if (!cart || cart.items.length === 0) {
      return res.redirect('/cart');
    }

    const cartItems = cart.items.map(item => ({
      name: item.productId.name,
      quantity: item.quantity,
      salesPrice: item.productId.salesPrice,
      subtotal: item.quantity * item.productId.salesPrice,
    }));

    const subtotal = cartItems.reduce((acc, item) => acc + item.subtotal, 0);

    let discount = 0;
    let grandTotal = subtotal;
    let coupon = null;

    if (req.session.coupon) {
      coupon = req.session.coupon;
      discount = coupon.discountAmount || 0;
      grandTotal = subtotal - discount;
    }

    const selectedAddressId = req.session.selectedAddressId || null;

      const currentDate = new Date();
    const allCoupons = await Coupon.find({
      status: 'Active',
      expiryDate: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    const availableCoupons = allCoupons.filter(coupon => {
      const usedEntry = coupon.usedBy.find(u => u.userId.toString() === userId.toString());
      const usedCount = usedEntry ? usedEntry.usedCount : 0;
      return usedCount < coupon.usageLimit;
    });

    res.render("checkout", {
      user: req.session.user,
      cartItems,
      subtotal: subtotal.toLocaleString('en-IN'),
      discount: discount.toLocaleString('en-IN'),
      grandTotal: grandTotal.toLocaleString('en-IN'),
      addresses,
      razorpayKey: process.env.RAZORPAY_KEY_ID,
      coupon,
      error: null,
      selectedAddressId,
      availableCoupons,
    });
  } catch (error) {
    console.error("Checkout page error:", error);
    res.status(500).render("checkout", {
      user: req.session.user || null,
      cartItems: [],
      subtotal: '0',
      discount: '0',
      grandTotal: '0',
      addresses: [],
      coupon: null,
      error: "Unable to load checkout page",
      selectedAddressId: null,
      availableCoupons: []
    });
  }
};

const selectAddress = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: "Please log in to select an address" });
    }

    const { addressId } = req.body;
    const userId = req.session.user._id;

    if (!addressId) {
      return res.status(400).json({ success: false, message: "Address ID is required" });
    }

    const address = await Address.findOne({ _id: addressId, userId });
    if (!address) {
      return res.status(404).json({ success: false, message: "Address not found or does not belong to user" });
    }

    req.session.selectedAddressId = addressId.toString();
    res.json({ success: true, selectedAddressId: addressId });
  } catch (error) {
    console.error("Select address error:", error);
    res.status(500).json({ success: false, message: "Failed to select address" });
  }
};

const applyCoupon = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.json({ success: false, message: "Please log in to apply a coupon" });
    }

    const { code } = req.body;
    const userId = req.session.user._id;

    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart || cart.items.length === 0) {
      return res.json({ success: false, message: "Cart is empty" });
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (!coupon) {
      return res.json({ success: false, message: "Invalid coupon code" });
    }

    if (coupon.status !== 'Active' || coupon.expiryDate < new Date()) {
      return res.json({ success: false, message: "Coupon is expired or inactive" });
    }

    const userCoupon = coupon.usedBy.find(u => u.userId.toString() === userId.toString());
    if (userCoupon && userCoupon.usedCount >= coupon.usageLimit) {
      return res.json({ success: false, message: "Coupon usage limit reached" });
    }

    if (req.session.coupon && req.session.coupon.code === coupon.code) {
      return res.json({ success: false, message: "Coupon already applied" });
    }

    const subtotal = cart.items.reduce((total, item) => total + (item.quantity * item.productId.salesPrice), 0);
    const discountAmount = (subtotal * coupon.discount) / 100;
    const grandTotal = subtotal - discountAmount;

    req.session.coupon = {
      code: coupon.code,
      discount: coupon.discount,
      discountAmount
    };

    res.json({
      success: true,
      subtotal: subtotal.toLocaleString('en-IN'),
      discount: discountAmount.toLocaleString('en-IN'),
      grandTotal: grandTotal.toLocaleString('en-IN'),
      coupon: { code: coupon.code, discount: coupon.discount }
    });
  } catch (error) {
    console.error("Apply coupon error:", error);
    res.json({ success: false, message: "Server error" });
  }
};

const removeCoupon = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.json({ success: false, message: "Please log in to remove a coupon" });
    }

    const userId = req.session.user._id;
    const cart = await Cart.findOne({ userId }).populate('items.productId');
    
    if (!cart || cart.items.length === 0) {
      return res.json({ success: false, message: "Cart is empty" });
    }

    req.session.coupon = null;
    const subtotal = cart.items.reduce((total, item) => total + (item.quantity * item.productId.salesPrice), 0);

    res.json({
      success: true,
      subtotal: subtotal.toLocaleString('en-IN'),
      discount: '0',
      grandTotal: subtotal.toLocaleString('en-IN')
    });
  } catch (error) {
    console.error("Remove coupon error:", error);
    res.json({ success: false, message: "Server error" });
  }
};

const postCheckoutPage = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ error: "Please log in to place an order" });
    }

    const userId = req.session.user._id;
    const { addressId, paymentMethod } = req.body;

    if (!addressId) {
      return res.status(400).json({ error: "Please select a shipping address" });
    }

    if (!paymentMethod || !['COD', 'Online', 'Wallet'].includes(paymentMethod)) {
      return res.status(400).json({ error: "Invalid payment method selected" });
    }

    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    const selectedAddress = await Address.findById(addressId);
    if (!selectedAddress || selectedAddress.userId.toString() !== userId.toString()) {
      return res.status(400).json({ error: "Invalid address selected" });
    }

    for (const item of cart.items) {
      if (!item.productId) {
        return res.status(400).json({ error: `Invalid product in cart: ${item._id}` });
      }
      if (item.productId.stock < item.quantity) {
        return res.status(400).json({
          error: `Insufficient stock for ${item.productId.name}. Available: ${item.productId.stock}, Requested: ${item.quantity}`,
        });
      }
    }

    let totalAmount = cart.items.reduce((total, item) => total + (item.quantity * item.productId.salesPrice), 0);
    let couponData = null;
    if (req.session.coupon) {
      const discountAmount = req.session.coupon.discountAmount || 0;
      totalAmount -= discountAmount;
      couponData = {
        code: req.session.coupon.code,
        discountAmount: discountAmount,
      };
    }

    const newOrder = new Order({
      userId,
      items: cart.items.map(item => ({
        productId: item.productId._id,
        name: item.productId.name,
        quantity: item.quantity,
        salesPrice: item.productId.salesPrice,
      })),
      address: `${selectedAddress.name}, ${selectedAddress.address}, ${selectedAddress.city}, ${selectedAddress.district}, ${selectedAddress.state} - ${selectedAddress.pinCode}`,
      paymentMethod,
      totalAmount,
      coupon: couponData,
      status: "Processing",
      createdAt: new Date(),
      offeredPrice: totalAmount,
    });

    await newOrder.save();

    for (const item of cart.items) {
      await Product.updateOne(
        { _id: item.productId._id },
        { $inc: { stock: -item.quantity } }
      );
    }

    if (req.session.coupon) {
      const coupon = await Coupon.findOne({ code: req.session.coupon.code });
      if (coupon) {
        const userCouponIndex = coupon.usedBy.findIndex(u => u.userId.toString() === userId.toString());
        if (userCouponIndex !== -1) {
          coupon.usedBy[userCouponIndex].usedCount += 1;
        } else {
          coupon.usedBy.push({ userId, usedCount: 1 });
        }
        await coupon.save();
      }
    }

    await Cart.deleteOne({ userId });
    req.session.coupon = null;
    req.session.selectedAddressId = null;

    res.json({ success: true, redirect: '/order/success' });
  } catch (error) {
    console.error("Checkout error:", error);
    res.status(500).json({ error: `Checkout failed: ${error.message}` });
  }
};

const codSuccess = (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login?redirect=/order/placed');
  }

  res.render('orderPlaced', {
    user: req.session.user,
    paymentId: 'COD',
    orderId: 'COD_' + Date.now(),
  });
};


const postRazorpay = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, error: "Please log in to initiate payment" });
    }

    const { amount, addressId } = req.body;

    if (!amount || !addressId) {
      return res.status(400).json({ success: false, error: "Amount and address are required" });
    }

    const userId = req.session.user._id;
    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, error: "Cart is empty" });
    }

    const selectedAddress = await Address.findById(addressId);
    if (!selectedAddress || selectedAddress.userId.toString() !== userId.toString()) {
      return res.status(400).json({ success: false, error: "Invalid address selected" });
    }

    for (const item of cart.items) {
      if (item.productId.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          error: `Insufficient stock for ${item.productId.name}. Available: ${item.productId.stock}, Requested: ${item.quantity}`,
        });
      }
    }

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

    req.session.pendingOrder = {
      razorpayOrderId: order.id,
      amount: amount,
      addressId: addressId,
      cartId: cart._id,
    };
    req.session.selectedAddressId = addressId.toString();

    res.json({ success: true, order });
  } catch (error) {
    console.error("Razorpay Order Error:", error);
    res.status(500).json({ success: false, error: "Order creation failed" });
  }
};

const orderSuccess = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/login?redirect=/order/success');
    }

    const { payment_id, order_id } = req.query;
    const userId = req.session.user._id;

    console.log('Order Success Query:', { payment_id, order_id }); // Debug

    if (!payment_id || !order_id || !req.session.pendingOrder) {
      console.error('Missing payment_id, order_id, or pendingOrder'); // Debug
      return res.redirect("/cart");
    }

    const { razorpayOrderId, amount, addressId, cartId } = req.session.pendingOrder;

    if (razorpayOrderId !== order_id) {
      console.error('Order ID mismatch:', { razorpayOrderId, order_id }); // Debug
      return res.redirect("/cart");
    }

    const cart = await Cart.findOne({ _id: cartId, userId }).populate('items.productId');
    if (!cart || cart.items.length === 0) {
      console.error('Cart not found or empty:', cartId); // Debug
      return res.redirect("/cart");
    }

    const selectedAddress = await Address.findById(addressId);
    if (!selectedAddress || selectedAddress.userId.toString() !== userId.toString()) {
      console.error('Invalid address:', addressId); // Debug
      return res.redirect("/checkout");
    }

    let totalAmount = cart.items.reduce((total, item) => total + (item.quantity * item.productId.salesPrice), 0);
    if (req.session.coupon) {
      totalAmount -= req.session.coupon.discountAmount || 0;
    }
    if (Math.round(totalAmount * 100) !== Math.round(amount * 100)) {
      console.error("Amount mismatch:", { totalAmount, providedAmount: amount }); // Debug
      return res.redirect("/checkout");
    }

    const newOrder = new Order({
      userId,
      items: cart.items.map(item => ({
        productId: item.productId._id,
        name: item.productId.name,
        quantity: item.quantity,
        salesPrice: item.productId.salesPrice,
      })),
      address: `${selectedAddress.name}, ${selectedAddress.address}, ${selectedAddress.city}, ${selectedAddress.district}, ${selectedAddress.state} - ${selectedAddress.pinCode}`,
      paymentMethod: 'Online',
      totalAmount,
      coupon: req.session.coupon ? {
        code: req.session.coupon.code,
        discountAmount: req.session.coupon.discountAmount || 0,
      } : null,
      status: "Processing",
      createdAt: new Date(),
      offeredPrice: totalAmount,
    });

    await newOrder.save();
    console.log('Order created:', newOrder._id); // Debug

    for (const item of cart.items) {
      await Product.updateOne(
        { _id: item.productId._id },
        { $inc: { stock: -item.quantity } }
      );
    }

    if (req.session.coupon) {
      const coupon = await Coupon.findOne({ code: req.session.coupon.code });
      if (coupon) {
        const userCouponIndex = coupon.usedBy.findIndex(u => u.userId.toString() === userId.toString());
        if (userCouponIndex !== -1) {
          coupon.usedBy[userCouponIndex].usedCount += 1;
        } else {
          coupon.usedBy.push({ userId, usedCount: 1 });
        }
        await coupon.save();
      }
    }

    await Cart.deleteOne({ _id: cartId, userId });
    req.session.coupon = null;
    req.session.pendingOrder = null;
    req.session.selectedAddressId = null;

    console.log('Order success, rendering orderPlaced'); // Debug
    res.render("orderPlaced", {
      user: req.session.user,
      paymentId: payment_id,
      orderId: order_id,
    });
  } catch (error) {
    console.error("Order success error:", error);
    res.status(500).render('error', { message: `Order processing failed: ${error.message}` });
  }
};

const addAddress = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: "Please log in to add an address" });
    }

    const userId = req.session.user._id;
    const { name, address, district, state, city, pinCode } = req.body;

    if (!name || !address || !district || !state || !city || !pinCode) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const newAddress = new Address({
      userId,
      name,
      address,
      district,
      state,
      city,
      pinCode
    });

    await newAddress.save();
    res.json({ success: true });
  } catch (error) {
    console.error("Add address error:", error);
    res.status(500).json({ success: false, message: "Failed to add address" });
  }
};

const editAddress = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: "Please log in to edit an address" });
    }

    const userId = req.session.user._id;
    const addressId = req.params.id;
    const { name, address, district, state, city, pinCode } = req.body;

    if (!name || !address || !district || !state || !city || !pinCode) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const updatedAddress = await Address.findOneAndUpdate(
      { _id: addressId, userId },
      { name, address, district, state, city, pinCode },
      { new: true }
    );

    if (!updatedAddress) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Edit address error:", error);
    res.status(500).json({ success: false, message: "Failed to update address" });
  }
};

const getAddress = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: "Please log in to view address details" });
    }

    const address = await Address.findById(req.params.id);
    if (!address) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }
    res.json({ success: true, address });
  } catch (error) {
    console.error("Get address error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  getCheckoutPage,
  applyCoupon,
  removeCoupon,
  postCheckoutPage,
  codSuccess,
  postRazorpay,
  orderSuccess,
  addAddress,
  editAddress,
  getAddress,
  selectAddress
};