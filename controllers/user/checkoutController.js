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
    
    const addresses = await Address.find({ userId: userId }).sort({ isDefault: -1, createdAt: -1 });
    
    const userWithWallet = await User.findById(userId);
    const walletBalance = userWithWallet?.wallet?.balance || 0;

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

    let selectedAddressId = req.session.selectedAddressId || null;
    
    if (!selectedAddressId && addresses.length > 0) {
      const defaultAddress = addresses.find(addr => addr.isDefault === true);
      if (defaultAddress) {
        selectedAddressId = defaultAddress._id.toString();
        req.session.selectedAddressId = selectedAddressId;
      }
    }
    
    if (selectedAddressId) {
      const addressExists = addresses.find(addr => addr._id.toString() === selectedAddressId);
      if (!addressExists) {
        selectedAddressId = null;
        req.session.selectedAddressId = null;
        
        const defaultAddress = addresses.find(addr => addr.isDefault === true);
        if (defaultAddress) {
          selectedAddressId = defaultAddress._id.toString();
          req.session.selectedAddressId = selectedAddressId;
        }
      }
    }

    const allCoupons = await Coupon.find({
      status: 'Active',
      expiryDate: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    const availableCoupons = allCoupons.filter(coupon => {
      const usedEntry = coupon.usedBy.find(u => u.userId.toString() === userId.toString());
      const usedCount = usedEntry ? usedEntry.usedCount : 0;
      return usedCount < coupon.usageLimit;
    });

    let errorMessage = null;
    const errorParam = req.query.error;
    if (errorParam) {
      switch (errorParam) {
        case 'payment_failed':
          errorMessage = 'Payment failed. Please try again.';
          break;
        case 'order_mismatch':
          errorMessage = 'Order verification failed. Please try again.';
          break;
        case 'signature_verification_failed':
          errorMessage = 'Payment verification failed. Please contact support.';
          break;
        case 'insufficient_stock':
          errorMessage = 'Some items in your cart are out of stock. Please update your cart.';
          break;
        case 'order_processing_failed':
          errorMessage = 'Order processing failed. Please try again.';
          break;
        default:
          errorMessage = 'An error occurred. Please try again.';
      }
    }

    res.render("checkout", {
      user: { ...req.session.user, walletBalance },
      cartItems,
      subtotal: subtotal.toLocaleString('en-IN'),
      discount: discount.toLocaleString('en-IN'),
      grandTotal: grandTotal.toLocaleString('en-IN'),
      addresses,
      razorpayKey: process.env.RAZORPAY_KEY_ID,
      coupon,
      error: errorMessage,
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
    
    if (coupon.minimumAmount && subtotal < coupon.minimumAmount) {
      return res.json({ 
        success: false, 
        message: `Minimum order amount of ₹${coupon.minimumAmount.toLocaleString('en-IN')} required for this coupon. Current cart total: ₹${subtotal.toLocaleString('en-IN')}` 
      });
    }

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
      coupon: { code: coupon.code, discount: coupon.discount },
      message: `Coupon "${coupon.code}" applied successfully! You saved ₹${discountAmount.toLocaleString('en-IN')}`
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

    if (paymentMethod === 'Wallet') {
      const user = await User.findById(userId);
      if (!user || (user.wallet?.balance || 0) < totalAmount) {
        return res.status(400).json({ error: "Insufficient wallet balance" });
      }
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

    if (paymentMethod === 'Wallet') {
      const walletController = require('./walletController');
      await walletController.updateWallet(userId, totalAmount, `Order payment - Order #${newOrder._id}`, "Debit");
    }

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

    req.session.lastOrder = {
      orderId: newOrder._id,
      paymentMethod: paymentMethod,
      totalAmount: totalAmount
    };
    res.json({ success: true, redirect: '/order/placed' });
    
  } catch (error) {
    console.error("Checkout error:", error);
    res.status(500).json({ error: `Checkout failed: ${error.message}` });
  }
};

const codSuccess = (req, res) => {
  try {
    console.log(!req.session.user);
    if (!req.session.user) {
      return res.redirect('/login?redirect=/order/placed');
    }
    console.log("here")
    const lastOrder = req.session.lastOrder;
    
    if (!lastOrder) {
      return res.redirect('/cart');
    }

    req.session.lastOrder = null;

    res.render("orderPlaced", {
      user: req.session.user,
      paymentId: lastOrder.paymentMethod === 'COD' ? 'COD' : lastOrder.paymentMethod === 'Wallet' ? 'Wallet Payment' : 'N/A',
      orderId: lastOrder.orderId,
    });
  } catch (error) {
    console.error("COD Success page error:", error);
    res.status(500).redirect('/cart');
  }
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

    const { payment_id, order_id, signature } = req.query;
    const userId = req.session.user._id;

    const retryOrder = req.session.retryOrder;
    const pending = req.session.pendingOrder;

    if (!payment_id || !order_id) {
      console.error("Missing payment_id or order_id");
      return res.redirect("/checkout?error=payment_failed");
    }

    if (retryOrder && retryOrder.razorpayOrderId === order_id) {
      if (signature) {
        const crypto = require('crypto');
        const expectedSignature = crypto
          .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
          .update(order_id + '|' + payment_id)
          .digest('hex');
        
        if (expectedSignature !== signature) {
          console.error("Retry payment signature verification failed");
          return res.redirect(`/payment/failure?error=signature_verification_failed&orderId=${order_id}`);
        }
      }

      const originalOrder = await Order.findById(retryOrder.originalOrderId);
      if (originalOrder) {
        originalOrder.status = "Processing";
        originalOrder.paymentId = payment_id;
        originalOrder.razorpayOrderId = order_id;
        await originalOrder.save();

        for (const item of originalOrder.items) {
          await Product.updateOne({ _id: item.productId }, { $inc: { stock: -item.quantity } });
        }

        req.session.retryOrder = null;

        return res.render("orderPlaced", {
          user: req.session.user,
          paymentId: payment_id,
          orderId: originalOrder._id,
        });
      }
    }

    if (!pending) {
      console.error("Missing session.pendingOrder");
      return res.redirect("/checkout?error=payment_failed");
    }

    if (pending.razorpayOrderId !== order_id) {
      console.error("Order ID mismatch:", pending.razorpayOrderId, order_id);
      return res.redirect("/checkout?error=order_mismatch");
    }

    if (signature) {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(order_id + '|' + payment_id)
        .digest('hex');
      
      if (expectedSignature !== signature) {
        console.error("Payment signature verification failed");
        return res.redirect(`/payment/failure?error=signature_verification_failed&orderId=${order_id}`);
      }
    }

    const cart = await Cart.findOne({ _id: pending.cartId, userId }).populate('items.productId');
    if (!cart || cart.items.length === 0) {
      console.error("Cart is empty or not found");
      return res.redirect("/cart");
    }

    const selectedAddress = await Address.findById(pending.addressId);
    if (!selectedAddress || selectedAddress.userId.toString() !== userId.toString()) {
      return res.redirect("/checkout");
    }

    for (const item of cart.items) {
      if (item.productId.stock < item.quantity) {
        console.error(`Insufficient stock for ${item.productId.name}`);
        return res.redirect("/checkout?error=insufficient_stock");
      }
    }

    let totalAmount = cart.items.reduce((total, item) => total + item.quantity * item.productId.salesPrice, 0);
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
      paymentMethod: 'Online',
      totalAmount,
      coupon: couponData,
      status: "Processing",
      createdAt: new Date(),
      offeredPrice: totalAmount,
      paymentId: payment_id,
    });

    await newOrder.save();

    for (const item of cart.items) {
      await Product.updateOne({ _id: item.productId._id }, { $inc: { stock: -item.quantity } });
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

    await Cart.deleteOne({ _id: cart._id });
    req.session.coupon = null;
    req.session.pendingOrder = null;
    req.session.selectedAddressId = null;

    return res.render("orderPlaced", {
      user: req.session.user,
      paymentId: payment_id,
      orderId: newOrder._id,
    });

  } catch (error) {
    console.error("Order success error:", error);
    return res.redirect("/checkout?error=order_processing_failed");
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

const orderFailure = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/login?redirect=/order/failure');
    }

    const { error, order_id } = req.query;
    let errorMessage = "Payment failed. Please try again.";
    let failedOrderId = null;

    switch (error) {
      case 'signature_verification_failed':
        errorMessage = "Payment verification failed. Please contact support if this persists.";
        break;
      case 'payment_failed':
        errorMessage = "Payment was not completed successfully.";
        break;
      case 'order_mismatch':
        errorMessage = "Order verification failed. Please try again.";
        break;
      case 'insufficient_stock':
        errorMessage = "Some items are out of stock. Please update your cart.";
        break;
      default:
        errorMessage = "Payment failed. Please try again.";
    }

    if (order_id) {
      const pending = req.session.pendingOrder;
      if (pending && pending.razorpayOrderId === order_id) {
        const userId = req.session.user._id;
        const cart = await Cart.findOne({ _id: pending.cartId, userId }).populate('items.productId');
        const selectedAddress = await Address.findById(pending.addressId);

        if (cart && selectedAddress) {
          let totalAmount = cart.items.reduce((total, item) => total + item.quantity * item.productId.salesPrice, 0);
          let couponData = null;
          if (req.session.coupon) {
            const discountAmount = req.session.coupon.discountAmount || 0;
            totalAmount -= discountAmount;
            couponData = {
              code: req.session.coupon.code,
              discountAmount: discountAmount,
            };
          }

          const existingOrder = await Order.findOne({ 
            userId, 
            paymentMethod: 'Online',
            status: 'Payment Failed',
            totalAmount,
            createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) } // Within last 10 minutes
          });

          if (!existingOrder) {
            const failedOrder = new Order({
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
              coupon: couponData,
              status: "Payment Failed",
              createdAt: new Date(),
              offeredPrice: totalAmount,
              razorpayOrderId: order_id,
              failureReason: errorMessage
            });

            await failedOrder.save();
            failedOrderId = failedOrder._id;
          } else {
            failedOrderId = existingOrder._id;
          }
        }
      }
    }

    res.render("orderFailure", {
      user: req.session.user,
      error: errorMessage,
      orderId: failedOrderId,
      canRetry: failedOrderId ? true : false
    });
  } catch (error) {
    console.error("Order failure page error:", error);
    res.status(500).render('orderFailure', {
      user: req.session.user || null,
      error: 'Unable to load failure page. Please try again later.',
      orderId: null,
      canRetry: false
    });
  }
};

const paymentFailure = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/login?redirect=/payment/failure');
    }

    const { error, orderId, referenceId } = req.query;
    let errorMessage = "Oops! Something went wrong with your payment. Please try again or choose a different method.";
    let failedOrderId = orderId || null;

    // Customize error message based on error type
    switch (error) {
      case 'signature_verification_failed':
        errorMessage = "Payment verification failed. Please contact support if this persists.";
        break;
      case 'payment_failed':
        errorMessage = "Payment was not completed successfully. Please try again.";
        break;
      case 'payment_cancelled':
        errorMessage = "Payment was cancelled. You can retry the payment or choose a different method.";
        break;
      case 'order_mismatch':
        errorMessage = "Order verification failed. Please try again.";
        break;
      case 'insufficient_stock':
        errorMessage = "Some items in your cart are out of stock. Please update your cart.";
        break;
      case 'network_error':
        errorMessage = "Network error occurred during payment. Please check your connection and try again.";
        break;
      default:
        errorMessage = "Oops! Something went wrong with your payment. Please try again or choose a different method.";
    }

    const userId = req.session.user._id;
    let canRetry = true; // Default to true for better UX

    console.log("Payment failure debug:", {
      orderId: failedOrderId,
      hasSession: !!req.session.pendingOrder,
      userId: userId
    });

    // If no orderId is provided, try to create a failed order from pending session data
    if (!failedOrderId && req.session.pendingOrder) {
      const pending = req.session.pendingOrder;
      const cart = await Cart.findOne({ _id: pending.cartId, userId }).populate('items.productId');
      const selectedAddress = await Address.findById(pending.addressId);

      if (cart && selectedAddress) {
        let totalAmount = cart.items.reduce((total, item) => total + item.quantity * item.productId.salesPrice, 0);
        let couponData = null;
        if (req.session.coupon) {
          const discountAmount = req.session.coupon.discountAmount || 0;
          totalAmount -= discountAmount;
          couponData = {
            code: req.session.coupon.code,
            discountAmount: discountAmount,
          };
        }

        // Check if a similar failed order already exists
        const existingOrder = await Order.findOne({ 
          userId, 
          paymentMethod: 'Online',
          status: 'Payment Failed',
          totalAmount,
          createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) } // Within last 10 minutes
        });

        if (!existingOrder) {
          const failedOrder = new Order({
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
            coupon: couponData,
            status: "Payment Failed",
            createdAt: new Date(),
            offeredPrice: totalAmount,
            razorpayOrderId: pending.razorpayOrderId,
            failureReason: errorMessage
          });

          await failedOrder.save();
          failedOrderId = failedOrder._id;
          console.log("Created failed order:", failedOrderId);
        } else {
          failedOrderId = existingOrder._id;
          console.log("Using existing failed order:", failedOrderId);
        }
      }
    }

    // Check if retry is possible for existing orders
    if (failedOrderId && !failedOrderId.toString().startsWith('temp_')) {
      const order = await Order.findOne({ 
        _id: failedOrderId, 
        userId: userId,
        status: 'Payment Failed'
      });
      
      if (order) {
        const orderAge = Date.now() - order.createdAt.getTime();
        canRetry = orderAge <= 24 * 60 * 60 * 1000; // 24 hours
        console.log("Order age check:", { orderAge, canRetry });
      }
    }

    // If still no order found, create a temporary one for retry
    if (!failedOrderId) {
      if (req.session.pendingOrder) {
        failedOrderId = 'temp_' + Date.now();
        canRetry = true;
        console.log("Created temporary order ID:", failedOrderId);
      } else {
        // No session data, check if user has any recent failed orders
        const recentFailedOrder = await Order.findOne({
          userId: userId,
          status: 'Payment Failed',
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Within 24 hours
        }).sort({ createdAt: -1 });

        if (recentFailedOrder) {
          failedOrderId = recentFailedOrder._id;
          canRetry = true;
          console.log("Found recent failed order:", failedOrderId);
        }
      }
    }

    console.log("Final values:", { failedOrderId, canRetry });

    res.render("paymentFailure", {
      user: req.session.user,
      error: errorMessage,
      orderId: failedOrderId,
      referenceId: referenceId || null,
      canRetry: canRetry
    });
  } catch (error) {
    console.error("Payment failure page error:", error);
    res.status(500).render('paymentFailure', {
      user: req.session.user || null,
      error: 'Unable to load payment failure page. Please try again later.',
      orderId: null,
      referenceId: null,
      canRetry: true // Enable retry even on error
    });
  }
};

const retryPayment = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, error: "Please log in to retry payment" });
    }

    const orderId = req.params.orderId;
    const userId = req.session.user._id;
    let order = null;
    let totalAmount = 0;

    // Check if it's a temporary order ID or a real order
    if (orderId.startsWith('temp_')) {
      // Handle temporary order - use session data
      if (!req.session.pendingOrder) {
        return res.status(400).json({ success: false, error: "No pending order found. Please try placing the order again." });
      }

      const pending = req.session.pendingOrder;
      const cart = await Cart.findOne({ _id: pending.cartId, userId }).populate('items.productId');
      
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ success: false, error: "Cart is empty. Please add items to cart first." });
      }

      // Check stock availability
      for (const item of cart.items) {
        if (item.productId.stock < item.quantity) {
          return res.status(400).json({
            success: false,
            error: `Insufficient stock for ${item.productId.name}. Available: ${item.productId.stock}, Required: ${item.quantity}`,
          });
        }
      }

      totalAmount = cart.items.reduce((total, item) => total + item.quantity * item.productId.salesPrice, 0);
      if (req.session.coupon) {
        totalAmount -= req.session.coupon.discountAmount || 0;
      }
    } else {
      // Handle real order ID
      order = await Order.findOne({ 
        _id: orderId, 
        userId, 
        status: 'Payment Failed' 
      }).populate('items.productId');

      if (!order) {
        return res.status(404).json({ success: false, error: "Order not found or cannot be retried" });
      }

      const orderAge = Date.now() - order.createdAt.getTime();
      if (orderAge > 24 * 60 * 60 * 1000) {
        return res.status(400).json({ success: false, error: "Order retry period has expired" });
      }

      // Check stock availability for real order
      for (const item of order.items) {
        const product = await Product.findById(item.productId._id);
        if (!product || product.stock < item.quantity) {
          return res.status(400).json({
            success: false,
            error: `Insufficient stock for ${item.name}. Available: ${product ? product.stock : 0}, Required: ${item.quantity}`,
          });
        }
      }

      totalAmount = order.totalAmount;
    }

    const razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const options = {
      amount: Math.round(totalAmount * 100),
      currency: "INR",
      receipt: "retry_order_" + Date.now(),
    };

    const razorpayOrder = await razorpayInstance.orders.create(options);

    req.session.retryOrder = {
      originalOrderId: orderId.startsWith('temp_') ? null : orderId,
      razorpayOrderId: razorpayOrder.id,
      amount: totalAmount,
      isTemporary: orderId.startsWith('temp_')
    };

    res.json({ 
      success: true, 
      order: razorpayOrder,
      key: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error("Retry payment error:", error);
    res.status(500).json({ success: false, error: "Failed to create retry payment" });
  }
};

const viewFailedOrder = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/login');
    }

    const orderId = req.params.id;
    const userId = req.session.user._id;

    const order = await Order.findOne({ 
      _id: orderId, 
      userId 
    }).populate('items.productId');

    if (!order) {
      return res.status(404).render("errorPage", {
        statusCode: 404,
        error: "Order not found",
        user: req.session.user,
      });
    }

    const discountAmount = order?.coupon?.discountAmount || 0;
    const totalSales = order.items.reduce((sum, item) => {
      return sum + item.salesPrice * item.quantity;
    }, 0);

    const itemsWithAdjustedPrice = order.items.map(item => {
      const itemTotal = item.salesPrice * item.quantity;
      const shareOfDiscount = totalSales > 0 ? (itemTotal / totalSales) * discountAmount : 0;
      const adjustedTotal = itemTotal - shareOfDiscount;
      const adjustedUnitPrice = adjustedTotal / item.quantity;

      return {
        ...item.toObject(),
        adjustedUnitPrice: adjustedUnitPrice
      };
    });

    const modifiedOrder = {
      ...order.toObject(),
      items: itemsWithAdjustedPrice
    };

    res.render("userOrderDetails", {
      user: req.session.user,
      order: modifiedOrder
    });

  } catch (error) {
    console.error("Error loading failed order details:", error);
    res.status(500).render("errorPage", {
      statusCode: 500,
      error: "Unable to load order details",
      user: req.session.user,
    });
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
  orderFailure,
  paymentFailure,
  retryPayment,
  viewFailedOrder,
  addAddress,
  editAddress,
  getAddress,
  selectAddress
};