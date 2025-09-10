const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Order = require("../../models/orderSchema");
const Address = require('../../models/addressSchema');
const Coupon = require("../../models/couponSchema");
const User = require("../../models/userSchema");
const Razorpay = require('razorpay');


// -------------------- Helpers -------------------- //

async function validateStock(items) {
  for (const item of items) {
    const product = await Product.findById(item.productId);
    if (!product || product.stock < item.quantity) {
      return {
        valid: false,
        message: `Insufficient stock for ${item.productId?.name || "Unknown product"}`,
      };
    }
  }
  return { valid: true };
}

async function updateCouponUsage(userId, couponCode) {
  if (!couponCode) return;
  const coupon = await Coupon.findOne({ code: couponCode });
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

function buildOrderObject({ userId, cart, address, paymentMethod, totalAmount, couponData, status, razorpayOrderId = null, failureReason = null }) {
  return new Order({
    userId,
    items: cart.items.map(item => ({
      productId: item.productId._id,
      name: item.productId.name,
      quantity: item.quantity,
      salesPrice: item.productId.salesPrice,
    })),
    address: formatAddress(address),
    paymentMethod,
    totalAmount,
    coupon: couponData,
    status,
    createdAt: new Date(),
    offeredPrice: totalAmount,
    razorpayOrderId,
    failureReason
  });
}

function formatAddress(address) {
  return `${address.name}, ${address.address}, ${address.city}, ${address.district}, ${address.state} - ${address.pinCode}`;
}

function getPaymentErrorMessage(errorCode) {
  switch (errorCode) {
    case 'signature_verification_failed':
      return "Payment verification failed. Please contact support if this persists.";
    case 'payment_failed':
      return "Payment was not completed successfully.";
    case 'payment_cancelled':
      return "Payment was cancelled. You can retry the payment or choose a different method.";
    case 'order_mismatch':
      return "Order verification failed. Please try again.";
    case 'insufficient_stock':
      return "Some items in your cart are out of stock. Please update your cart.";
    case 'network_error':
      return "Network error occurred during payment. Please check your connection and try again.";
    default:
      return "Oops! Something went wrong with your payment. Please try again.";
  }
}


// -------------------- Controllers -------------------- //

const getCheckoutPage = async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/login?redirect=/checkout');

    const userId = req.session.user._id;
    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart || cart.items.length === 0) return res.redirect('/cart');

    const addresses = await Address.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
    const userWithWallet = await User.findById(userId);
    const walletBalance = userWithWallet?.wallet?.balance || 0;

    const cartItems = cart.items.map(item => ({
      name: item.productId.name,
      quantity: item.quantity,
      salesPrice: item.productId.salesPrice,
      subtotal: item.quantity * item.productId.salesPrice,
    }));

    const subtotal = cartItems.reduce((acc, item) => acc + item.subtotal, 0);

    let discount = 0, grandTotal = subtotal, coupon = null;
    if (req.session.coupon) {
      coupon = req.session.coupon;
      discount = coupon.discountAmount || 0;
      grandTotal = subtotal - discount;
    }

    // handle address selection
    let selectedAddressId = req.session.selectedAddressId || null;
    if (!selectedAddressId && addresses.length > 0) {
      const defaultAddress = addresses.find(addr => addr.isDefault === true);
      if (defaultAddress) {
        selectedAddressId = defaultAddress._id.toString();
        req.session.selectedAddressId = selectedAddressId;
      }
    } else if (selectedAddressId) {
      const addressExists = addresses.find(addr => addr._id.toString() === selectedAddressId);
      if (!addressExists) req.session.selectedAddressId = null;
    }

    // coupons
    const allCoupons = await Coupon.find({
      status: 'Active',
      expiryDate: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    const availableCoupons = allCoupons.filter(coupon => {
      const usedEntry = coupon.usedBy.find(u => u.userId.toString() === userId.toString());
      const usedCount = usedEntry ? usedEntry.usedCount : 0;
      return usedCount < coupon.usageLimit;
    });

const errorMessage = req.query.error 
  ? getPaymentErrorMessage(req.query.error) 
  : null;

    res.render("checkout", {
      user: { ...req.session.user, walletBalance },
      cartItems,
      subtotal,
      discount,
      grandTotal,
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
      subtotal: 0,
      discount: 0,
      grandTotal: 0,
      addresses: [],
      coupon: null,
      error: "Unable to load checkout page",
      selectedAddressId: null,
      availableCoupons: []
    });
  }
};

const postCheckoutPage = async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ error: "Please log in to place an order" });

    const userId = req.session.user._id;
    const { addressId, paymentMethod } = req.body;
    if (!addressId) return res.status(400).json({ error: "Please select a shipping address" });
    if (!['COD', 'Online', 'Wallet'].includes(paymentMethod)) {
      return res.status(400).json({ error: "Invalid payment method selected" });
    }

    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart || cart.items.length === 0) return res.status(400).json({ error: "Cart is empty" });

    const selectedAddress = await Address.findById(addressId);
    if (!selectedAddress || selectedAddress.userId.toString() !== userId.toString()) {
      return res.status(400).json({ error: "Invalid address selected" });
    }

    const stockValidation = await validateStock(cart.items);
    if (!stockValidation.valid) return res.status(400).json({ error: stockValidation.message });

    let totalAmount = cart.items.reduce((total, item) => total + (item.quantity * item.productId.salesPrice), 0);
    let couponData = null;
    if (req.session.coupon) {
      const discountAmount = req.session.coupon.discountAmount || 0;
      totalAmount -= discountAmount;
      couponData = { code: req.session.coupon.code, discountAmount };
    }

    if (paymentMethod === 'Wallet') {
      const user = await User.findById(userId);
      if (!user || (user.wallet?.balance || 0) < totalAmount) {
        return res.status(400).json({ error: "Insufficient wallet balance" });
      }
    }

    const newOrder = buildOrderObject({
      userId,
      cart,
      address: selectedAddress,
      paymentMethod,
      totalAmount,
      couponData,
      status: "Processing"
    });
    await newOrder.save();

    if (paymentMethod === 'Wallet') {
      const walletController = require('./walletController');
      await walletController.updateWallet(userId, totalAmount, `Order payment - Order #${newOrder._id}`, "Debit");
    }

    for (const item of cart.items) {
      await Product.updateOne({ _id: item.productId._id }, { $inc: { stock: -item.quantity } });
    }

    if (couponData) await updateCouponUsage(userId, couponData.code);

    await Cart.deleteOne({ userId });
    req.session.coupon = null;
    req.session.selectedAddressId = null;
    req.session.lastOrder = {
      orderId: newOrder._id,
      paymentMethod,
      totalAmount
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

    // Calculate total amount with coupon discount
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

    // Create order with "Pending Payment" status BEFORE initiating payment
    const pendingOrder = new Order({
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
      status: "Pending Payment",
      createdAt: new Date(),
      offeredPrice: totalAmount,
    });

    await pendingOrder.save();

    const razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const options = {
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: "receipt_order_" + Date.now(),
    };

    const razorpayOrder = await razorpayInstance.orders.create(options);

    // Update the order with Razorpay order ID
    pendingOrder.razorpayOrderId = razorpayOrder.id;
    await pendingOrder.save();

    req.session.pendingOrder = {
      razorpayOrderId: razorpayOrder.id,
      amount: amount,
      addressId: addressId,
      cartId: cart._id,
      dbOrderId: pendingOrder._id,
    };
    req.session.selectedAddressId = addressId.toString();

    res.json({ success: true, order: razorpayOrder });
  } catch (error) {
    console.error("Razorpay Order Error:", error);
    res.status(500).json({ success: false, error: "Order creation failed" });
  }
};

const paymentFailure = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/login?redirect=/payment/failure');
    }

    const { error, orderId, referenceId } = req.query;
    let errorMessage = "Oops! Something went wrong with your payment. Please try again or choose a different method.";
    let failedOrderId = null;

    const isRazorpayOrderId = orderId && orderId.startsWith('order_');

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
    let canRetry = true;

    console.log("Payment failure debug:", {
      orderId: failedOrderId,
      hasSession: !!req.session.pendingOrder,
      userId: userId
    });

    if (!failedOrderId) {
      if (req.session.pendingOrder) {
        const pending = req.session.pendingOrder;
        
        // Try to find existing order by Razorpay order ID
        let existingOrder = await Order.findOne({ 
          razorpayOrderId: pending.razorpayOrderId,
          userId: userId
        });

        if (existingOrder) {
          // Update existing order to failed status
          existingOrder.status = "Payment Failed";
          existingOrder.failureReason = errorMessage;
          await existingOrder.save();
          failedOrderId = existingOrder._id;
        } else {
          // Create new failed order from session data
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
          }
        }
      } else {
        // No session data, check if user has any recent failed orders
        const recentFailedOrder = await Order.findOne({
          userId: userId,
          status: 'Payment Failed',
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }).sort({ createdAt: -1 });

        if (recentFailedOrder) {
          failedOrderId = recentFailedOrder._id;
          console.log("Found recent failed order:", failedOrderId);
        }
      }
    }

    // Check if retry is possible for the order
    if (failedOrderId) {
      const order = await Order.findOne({ 
        _id: failedOrderId, 
        userId: userId,
        status: 'Payment Failed'
      });
      
      if (order) {
        const orderAge = Date.now() - order.createdAt.getTime();
        canRetry = orderAge <= 24 * 60 * 60 * 1000;
        console.log("Order age check:", { orderAge, canRetry });
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
      canRetry: true
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

    // Find the failed order in the database
    const order = await Order.findOne({ 
      _id: orderId, 
      userId, 
      status: 'Payment Failed' 
    });

    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found or cannot be retried" });
    }

    // Check if retry period hasn't expired (24 hours)
    const orderAge = Date.now() - order.createdAt.getTime();
    if (orderAge > 24 * 60 * 60 * 1000) {
      return res.status(400).json({ success: false, error: "Order retry period has expired" });
    }

    // Check stock availability for all items
    for (const item of order.items) {
      const product = await Product.findById(item.productId);
      if (!product || product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          error: `Insufficient stock for ${item.name}. Available: ${product ? product.stock : 0}, Required: ${item.quantity}`,
        });
      }
    }

    const razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const options = {
      amount: Math.round(order.totalAmount * 100),
      currency: "INR",
      receipt: "retry_order_" + Date.now(),
    };

    const razorpayOrder = await razorpayInstance.orders.create(options);

    // Update the existing order with new Razorpay order ID
    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    // Store retry session data for verification
    req.session.retryOrder = {
      originalOrderId: orderId,
      razorpayOrderId: razorpayOrder.id,
      amount: order.totalAmount
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

 
module.exports = {
  getCheckoutPage,
  postCheckoutPage,
  codSuccess,
  postRazorpay,
  paymentFailure,
  retryPayment
};
