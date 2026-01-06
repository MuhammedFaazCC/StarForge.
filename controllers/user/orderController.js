const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Coupon = require("../../models/couponSchema");
const mongoose = require('mongoose');

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

const getUserOrders = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const q = (req.query.q || '').trim();

    // Build base filter
    const baseFilter = {
      userId: userId,
      totalAmount: { $exists: true, $ne: null },
      status: { $nin: ['Pending Payment', 'Payment Failed'] }
    };

    // Build search filter
    let filter = { ...baseFilter };
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const orClauses = [
        { status: regex },
        { 'items.status': regex },
        { 'items.name': regex },
      ];
      // If q looks like a valid ObjectId, include direct match
      if (mongoose.Types.ObjectId.isValid(q)) {
        orClauses.push({ _id: new mongoose.Types.ObjectId(q) });
      }
      filter = { ...baseFilter, $or: orClauses };
    }

    const totalOrders = await Order.countDocuments(filter);

    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'items.productId',
        select: 'name brand images price salePrice offer mainImage',
        options: { strictPopulate: false }
      });

    orders.forEach(order => {
      order.items.forEach(item => {
        // Set default status if missing
        if (!item.status) {
          console.warn(`Missing status for item in order ${order._id}`);
          item.status = 'Unknown';
        }
        
        // Handle deleted products - keep the item but mark productId as null if deleted
        if (!item.productId) {
          console.warn(`Product deleted for item in order ${order._id}, using fallback name`);
        }
      });
    });

    const cartCount = await getCartCount(userId);

    const viewData = {
      user: req.session.user,
      currentPage: "orders",
      orders,
      cartCount,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalOrders: totalOrders,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page + 1,
        prevPage: page - 1
      },
      searchQuery: q,
      searchQueryEncoded: encodeURIComponent(q)
    };

    if (req.query.ajax === '1') {
      return res.render("user/partials/ordersList", viewData);
    }

    res.render("profileOrders", viewData);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).render("errorPage", {
      statusCode: 500,
      error: "Unable to load orders at the moment",
      user: req.session.user || null
    });
  }
};

const viewOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.session.user._id;
    
    const order = await Order.findOne({ _id: orderId, userId })
      .populate('items.productId')
      .lean();

    if (!order) {
      return res.status(500).render("errorPage", {
        statusCode: 500,
        error: "Order not found",
        user: req.session.user || null,
      });
    }

    console.log(`Order ${orderId} status: ${order.status}`);
    order.items.forEach((item, index) => {
      console.log(`Item ${index}: ${item.productId?.name || 'Unknown'} - Status: ${item.status || 'Ordered'}`);
    });

    const discountAmount = order?.coupon?.discountAmount || 0;
    
    const totalSales = order.items.reduce((sum, item) => {
      return sum + item.salesPrice * item.quantity;
    }, 0);

    const itemsWithAdjustedPrice = order.items.map(item => {
      const itemTotal = item.salesPrice * item.quantity;
      const shareOfDiscount = (itemTotal / totalSales) * discountAmount;
      const adjustedTotal = itemTotal - shareOfDiscount;
      const adjustedUnitPrice = adjustedTotal / item.quantity;

      return {
        ...item,
        adjustedUnitPrice: adjustedUnitPrice
      };
    });

    const modifiedOrder = {
      ...order,
      items: itemsWithAdjustedPrice
    };

    res.render("userOrderDetails", {
      user: req.session.user,
      order: modifiedOrder
    });

  } catch (err) {
    console.error("Error loading order details:", err);
    res.status(500).render("errorPage", {
      statusCode: 500,
      error: "Unable to load order details",
      user: req.session.user || null,
    });
  }
};

const returnOrder = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const orderId = req.params.id;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ 
        success: false, 
        message: "Please provide a detailed reason for return (minimum 10 characters)" 
      });
    }

    const order = await Order.findOne({ _id: orderId, userId: userId });
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: "Order not found or you don't have permission to return this order" 
      });
    }

    if (order.status !== 'Delivered') {
      return res.status(400).json({ 
        success: false, 
        message: `Only delivered orders can be returned. Current status: ${order.status}` 
      });
    }

    const existingReturn = await Return.findOne({ orderId });
    if (existingReturn) {
      return res.status(400).json({ 
        success: false, 
        message: "Return request has already been submitted for this order" 
      });
    }

    await Return.create({
      orderId,
      userId,
      reason: reason.trim(),
      status: "Pending",
      requestedAt: new Date(),
    });

    order.status = "Return Requested";
    await order.save();

    res.json({ 
      success: true, 
      message: "Return request submitted successfully. We will review your request and get back to you soon." 
    });

  } catch (error) {
    console.error("Error processing return request:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error. Please try again later." 
    });
  }
};

const orderSuccess = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/login?redirect=/order/success');
    }

    const { payment_id, order_id, signature } = req.query;
    const userId = req.session.user._id;

    if (!payment_id || !order_id) {
      console.error("Missing payment_id or order_id");
      return res.redirect("/checkout?error=payment_failed");
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

    const order = await Order.findOne({ 
      razorpayOrderId: order_id,
      userId: userId,
      $or: [
        { status: "Pending Payment" },
        { status: "Payment Failed" }
      ]
    });

    if (!order) {
      console.error("Order not found for Razorpay order ID:", order_id);
      return res.redirect("/checkout?error=order_mismatch");
    }

    // Check stock availability before finalizing
    for (const item of order.items) {
      const product = await Product.findById(item.productId);
      if (!product || product.stock < item.quantity) {
        console.error(`Insufficient stock for ${item.name}`);
        return res.redirect("/checkout?error=insufficient_stock");
      }
    }

    // Update order status to Processing and add payment details
    order.status = "Processing";
    order.paymentId = payment_id;
    await order.save();

    for (const item of order.items) {
      await Product.updateOne({ _id: item.productId }, { $inc: { stock: -item.quantity } });
    }

    // Always remove purchased items from the user's cart as a safeguard
    try {
      const purchasedProductIds = order.items.map(it => it.productId);
      await Cart.updateOne(
        { userId: userId },
        { $pull: { items: { productId: { $in: purchasedProductIds } } } }
      );

      const maybeCart = await Cart.findOne({ userId: userId });
      if (maybeCart && (!maybeCart.items || maybeCart.items.length === 0)) {
        await Cart.deleteOne({ _id: maybeCart._id });
      }

      // Fallback: ensure removal via application-side filtering
      const cartCheck = await Cart.findOne({ userId: userId });
      if (cartCheck && cartCheck.items && cartCheck.items.length > 0) {
        const purchasedSet = new Set(purchasedProductIds.map(id => id?.toString()));
        const beforeLen = cartCheck.items.length;
        cartCheck.items = cartCheck.items.filter(it => !purchasedSet.has(it.productId?.toString()));
        if (cartCheck.items.length !== beforeLen) {
          if (cartCheck.items.length === 0) {
            await Cart.deleteOne({ _id: cartCheck._id });
          } else {
            await cartCheck.save();
          }
        }
      }
    } catch (removeErr) {
      console.error("Post-payment cart cleanup failed:", removeErr);
    }

    // Update coupon usage if applicable
    if (order.coupon && order.coupon.code) {
      const coupon = await Coupon.findOne({ code: order.coupon.code });
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

    const retryOrder = req.session.retryOrder;
    if (!retryOrder || !retryOrder.originalOrderId) {
      const pending = req.session.pendingOrder;
      if (pending && pending.cartId) {
        await Cart.deleteOne({ _id: pending.cartId });
      }
      req.session.coupon = null;
    } else {
      try {
        // For retry flow, remove the purchased items from the user's cart
        const purchasedProductIds = order.items.map(it => it.productId);
        await Cart.updateOne(
          { userId: userId },
          { $pull: { items: { productId: { $in: purchasedProductIds } } } }
        );

        // Clean up empty cart if no items remain
        const updatedCart = await Cart.findOne({ userId: userId });
        if (updatedCart && (!updatedCart.items || updatedCart.items.length === 0)) {
          await Cart.deleteOne({ _id: updatedCart._id });
        }
      } catch (e) {
        console.error("Failed to remove purchased items from cart after retry:", e);
      }
    }

    // Clean up session data
    req.session.pendingOrder = null;
    req.session.retryOrder = null;
    req.session.selectedAddressId = null;

    return res.render("orderPlaced", {
      user: req.session.user,
      paymentId: payment_id,
      orderId: order._id,
    });

  } catch (error) {
    console.error("Order success error:", error);
    return res.redirect("/checkout?error=order_processing_failed");
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

    const userId = req.session.user._id;

    if (order_id) {
      let existingOrder = await Order.findOne({ 
        razorpayOrderId: order_id,
        userId: userId
      });

      if (existingOrder) {
        existingOrder.status = "Payment Failed";
        existingOrder.failureReason = errorMessage;
        await existingOrder.save();
        failedOrderId = existingOrder._id;
      } else {
        const pending = req.session.pendingOrder;
        if (pending && pending.razorpayOrderId === order_id) {
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
              razorpayOrderId: order_id,
              failureReason: errorMessage
            });

            await failedOrder.save();
            failedOrderId = failedOrder._id;
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
    getUserOrders,
    viewOrderDetails,
    returnOrder,
    orderSuccess,
    orderFailure,
    viewFailedOrder
};