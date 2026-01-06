const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Order = require("../../models/orderSchema");
const Counter = require("../../models/counterSchema");
const Address = require('../../models/addressSchema');
const Coupon = require("../../models/couponSchema");
const User = require("../../models/userSchema");
const Razorpay = require('razorpay');


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

async function cleanInvalidCartItems(userId) {
  const cart = await Cart.findOne({ userId }).populate('items.productId');
  if (!cart) return null;

  const invalidIds = cart.items
    .filter(i => !i.productId || !i.productId.isListed)
    .map(i => i._id);

  if (invalidIds.length > 0) {
    await Cart.updateOne(
      { userId },
      { $pull: { items: { _id: { $in: invalidIds } } } }
    );
  }

  return await Cart.findOne({ userId }).populate('items.productId');
}

function calculateDiscount(subtotal, coupon) {
  if (!coupon) return 0;

  if (coupon.minimumAmount && subtotal < coupon.minimumAmount) return 0;

  let eligible = subtotal;
  if (coupon.orderMaxAmount > 0) eligible = Math.min(subtotal, coupon.orderMaxAmount);

  const raw = (eligible * coupon.discount) / 100;
  return coupon.maxAmount > 0 ? Math.min(raw, coupon.maxAmount) : raw;
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

// function buildOrderObject({ userId, cart, address, paymentMethod, totalAmount, couponData, status, razorpayOrderId = null, failureReason = null }) {
//   return new Order({
//     userId,
//     items: cart.items.map(item => ({
//       productId: item.productId._id,
//       name: item.productId.name,
//       quantity: item.quantity,
//       salesPrice: item.productId.salesPrice,
//     })),
//     address: formatAddress(address),
//     paymentMethod,
//     totalAmount,
//     coupon: couponData,
//     status,
//     createdAt: new Date(),
//     offeredPrice: totalAmount,
//     razorpayOrderId,
//     failureReason
//   });
// }

// function formatAddress(address) {
//   return `${address.name}, ${address.address}, ${address.city}, ${address.district}, ${address.state} - ${address.pinCode}`;
// }

// function getPaymentErrorMessage(errorCode) {
//   switch (errorCode) {
//     case 'signature_verification_failed':
//       return "Payment verification failed. Please contact support if this persists.";
//     case 'payment_failed':
//       return "Payment was not completed successfully.";
//     case 'payment_cancelled':
//       return "Payment was cancelled. You can retry the payment or choose a different method.";
//     case 'order_mismatch':
//       return "Order verification failed. Please try again.";
//     case 'insufficient_stock':
//       return "Some items in your cart are out of stock. Please update your cart.";
//     case 'network_error':
//       return "Network error occurred during payment. Please check your connection and try again.";
//     default:
//       return "Oops! Something went wrong with your payment. Please try again.";
//   }
// }


const getCheckoutPage = async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/login?redirect=/checkout');

    let cart = await cleanInvalidCartItems(req.session.user._id);
    if (!cart || cart.items.length === 0) return res.redirect('/cart');

    const userId = req.session.user._id;
    const addresses = await Address.find({ userId }).sort({ isDefault: -1 });
    const userWallet = await User.findById(userId);
    const walletBalance = userWallet?.wallet?.balance || 0;

    const cartItems = cart.items.map(i => ({
      name: i.productId.name,
      quantity: i.quantity,
      salesPrice: i.productId.salesPrice,
      subtotal: i.quantity * i.productId.salesPrice
    }));

    const subtotal = cartItems.reduce((s, i) => s + i.subtotal, 0);

    let discount = 0;
    let appliedCoupon = null;
    let grandTotal = subtotal;

    if (req.session.coupon) {
      const c = await Coupon.findOne({ code: req.session.coupon.code });
      if (c) {
        discount = calculateDiscount(subtotal, c);
        appliedCoupon = { code: c.code, discountAmount: discount };
      }
      grandTotal = subtotal - discount;
    }

    const coupons = await Coupon.find({
      status: "Active",
      expiryDate: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    const availableCoupons = coupons.filter(c => {
      const entry = c.usedBy.find(u => u.userId.toString() === userId.toString());
      return !entry || entry.usedCount < c.usageLimit;
    });

    res.render("checkout", {
      user: { ...req.session.user, walletBalance },
      cartItems,
      subtotal,
      discount,
      grandTotal,
      addresses,
      razorpayKey: process.env.RAZORPAY_KEY_ID,
      coupon: appliedCoupon,
      error: null,
      selectedAddressId: null,
      availableCoupons
    });
  } catch {
    res.status(500).render("checkout", {
      user: req.session.user || null,
      cartItems: [],
      subtotal: 0,
      discount: 0,
      grandTotal: 0,
      addresses: [],
      coupon: null,
      error: "Unable to load",
      selectedAddressId: null,
      availableCoupons: []
    });
  }
};

const postCheckoutPage = async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ error: "Login required" });

    const userId = req.session.user._id;
    let cart = await cleanInvalidCartItems(userId);
    if (!cart || cart.items.length === 0) return res.status(400).json({ error: "Cart empty" });

    const { addressId, paymentMethod } = req.body;
    if (!addressId) return res.status(400).json({ error: "Select address" });
    if (!['COD', 'Online', 'Wallet'].includes(paymentMethod)) {
      return res.status(400).json({ error: "Invalid payment" });
    }

    const address = await Address.findById(addressId);
    if (!address || address.userId.toString() !== userId.toString()) {
      return res.status(400).json({ error: "Invalid address" });
    }

    for (const item of cart.items) {
      if (item.productId.stock < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${item.productId.name}` });
      }
    }

    let totalAmount = cart.items.reduce((s, i) => s + i.quantity * i.productId.salesPrice, 0);
    let couponData = null;

    if (req.session.coupon) {
      const c = await Coupon.findOne({ code: req.session.coupon.code });
      if (c) {
        const discountAmount = calculateDiscount(
          cart.items.reduce((s, i) => s + i.quantity * i.productId.salesPrice, 0),
          c
        );
        totalAmount -= discountAmount;
        couponData = { code: c.code, discountAmount };
      }
    }

    if (paymentMethod === 'COD' && totalAmount > 1000) {
      return res.status(400).json({ error: "COD allowed only ≤ 1000" });
    }

    if (paymentMethod === 'Wallet') {
      const user = await User.findById(userId);
      if ((user.wallet?.balance || 0) < totalAmount) {
        return res.status(400).json({ error: "Insufficient wallet balance" });
      }
    }

    const counter = await Counter.findOneAndUpdate(
      { name: "order" },
      { $inc: { value: 1 } },
      { new: true, upsert: true }
    );

    const orderId = `ORD-${new Date().getFullYear()}-${String(counter.value).padStart(6, "0")}`;

    const order = new Order({
      orderId,
      userId,
      items: cart.items.map(i => ({
        productId: i.productId._id,
        name: i.productId.name,
        quantity: i.quantity,
        salesPrice: i.productId.salesPrice
      })),
      address: `${address.name}, ${address.address}, ${address.city}, ${address.district}, ${address.state} - ${address.pinCode}`,
      paymentMethod,
      totalAmount,
      coupon: couponData,
      status: "Processing",
      createdAt: new Date(),
      offeredPrice: totalAmount
    });

    await order.save();

    if (paymentMethod === 'Wallet') {
      const walletController = require('./walletController');
      await walletController.updateWallet(userId, totalAmount, `Order payment - #${order._id}`, "Debit");
    }

    for (const i of cart.items) {
      await Product.updateOne({ _id: i.productId._id }, { $inc: { stock: -i.quantity } });
    }

    if (couponData) {
      const dbCoupon = await Coupon.findOne({ code: couponData.code });
      if (dbCoupon) {
        const entry = dbCoupon.usedBy.find(u => u.userId.toString() === userId.toString());
        if (entry) entry.usedCount += 1;
        else dbCoupon.usedBy.push({ userId, usedCount: 1 });
        await dbCoupon.save();
      }
    }

    await Cart.deleteOne({ userId });

    req.session.coupon = null;
    req.session.selectedAddressId = null;
    req.session.lastOrder = {
      orderId: orderId,
      paymentMethod,
      totalAmount
    };

    res.json({ success: true, redirect: '/order/placed' });
  } catch (err) {
    res.status(500).json({ error: "Checkout failed" });
  }
};

const codSuccess = (req, res) => {
  try {
    console.log(!req.session.user);
    if (!req.session.user) {
      return res.redirect('/login?redirect=/order/placed');
    }
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
    if (!addressId) {
      return res.status(400).json({ success: false, error: "Address is required" });
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
      const dbCoupon = await Coupon.findOne({ code: req.session.coupon.code });
      if (dbCoupon) {
        const discountAmount = calculateDiscount(
          cart.items.reduce((t, i) => t + (i.quantity * i.productId.salesPrice), 0),
          dbCoupon
        );

        totalAmount -= discountAmount;

        couponData = {
          code: dbCoupon.code,
          discountAmount
        };
      }
    }

    const pendingOrder = new Order({
      orderId,
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
      amount: Math.round(totalAmount * 100),
      currency: "INR",
      receipt: "receipt_order_" + Date.now(),
    };

    const razorpayOrder = await razorpayInstance.orders.create(options);

    // Update the order with Razorpay order ID
    pendingOrder.razorpayOrderId = razorpayOrder.id;
    await pendingOrder.save();

    req.session.pendingOrder = {
      razorpayOrderId: razorpayOrder.id,
      amount: totalAmount,
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
              orderId,
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
