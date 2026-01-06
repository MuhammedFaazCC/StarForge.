const Order = require("../../models/orderSchema");
const { handleItemCancellationWithCoupon } = require("../../util/couponRefundHandler");

const cancelSingleItem = async (req, res) => {
  try {
    console.log("=== CANCEL SINGLE ITEM START ===");
    const { orderId, productId } = req.params;
    const userId = req.session.user._id;

    console.log(`Cancel item request - Order: ${orderId}, Product: ${productId}, User: ${userId}`);

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(productId)) {
      console.error(`Invalid ObjectId format - Order: ${orderId}, Product: ${productId}`);
      return res.status(400).json({ success: false, error: "Invalid order or product ID format" });
    }

    const order = await Order.findOne({ _id: orderId, userId: userId }).populate('items.productId');
    if (!order) {
      console.error(`Order not found: ${orderId} for user: ${userId}`);
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    console.log(`Order found: ${order._id}, Status: ${order.status}, Items count: ${order.items.length}`);

    const itemIndex = order.items.findIndex(i => {
      if (!i.productId) {
        console.warn(`Item with null productId found in order ${orderId}`);
        return false;
      }
      return i.productId._id.toString() === productId;
    });

    if (itemIndex === -1) {
      console.error(`Item not found in order: ${productId} in order: ${orderId}`);
      return res.status(404).json({ success: false, error: "Item not found in order" });
    }

    const item = order.items[itemIndex];
    console.log(`Item found: ${item.productId.name}, Current Status: ${item.status || 'Ordered'}`);
    
    const cancellableStatuses = ['Placed', 'Ordered', 'Processing', 'Shipped'];
    const currentStatus = item.status || 'Placed';
    
    if (!cancellableStatuses.includes(currentStatus)) {
      console.error(`Item cannot be cancelled, current status: ${currentStatus}`);
      return res.status(400).json({ 
        success: false, 
        error: `Item cannot be cancelled. Current status: ${currentStatus}` 
      });
    }

    // Coupon-aware cancellation and refund
    const itemsToCancel = [{
      productId: item.productId._id,
      name: item.productId.name,
      salesPrice: item.salesPrice,
      quantity: item.quantity
    }];

    const couponResult = await handleItemCancellationWithCoupon(order, itemsToCancel, userId, {
      refundReason: `Refund for cancelled item: ${item.productId.name} from order #${order._id}`,
      cancellationReason: 'User requested cancellation'
    });

    // Verify saved state
    const verifyOrder = await Order.findById(orderId);
    const verifyItem = verifyOrder.items.find(i => i.productId.toString() === productId);
    console.log(`Verification - Item status: ${verifyItem?.status}, Order status: ${verifyOrder.status}`);

    let message = "Item cancelled successfully";
    if (order.paymentMethod !== 'COD' && couponResult.totalRefundAmount > 0) {
      message += ". Refund has been processed to your wallet";
    }

    res.json({ 
      success: true, 
      message,
      refundAmount: (order.paymentMethod !== 'COD') ? couponResult.totalRefundAmount : 0,
      newOrderTotal: couponResult.newOrderTotal,
      orderFullyCancelled: !!couponResult.orderFullyCancelled,
      itemStatus: verifyItem?.status,
      orderStatus: verifyOrder.status,
      couponRemoved: !!couponResult.couponRemoved
    });

  } catch (error) {
    console.error("=== ERROR IN CANCEL SINGLE ITEM ===");
    console.error("Error cancelling item:", error);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Stack trace:", error.stack);
    console.error("=== END ERROR LOG ===");
    
    res.status(500).json({ 
      success: false, 
      error: "Internal server error. Please try again later.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const cancelOrderNew = async (req, res) => {
  try {
    console.log("=== CANCEL ORDER START ===");
    const userId = req.session.user._id;
    const orderId = req.params.id;

    console.log(`Cancel order request - Order: ${orderId}, User: ${userId}`);

    const order = await Order.findOne({ _id: orderId, userId: userId }).populate('items.productId');
    if (!order) {
      console.error(`Order not found: ${orderId} for user: ${userId}`);
      return res.status(404).json({ 
        success: false, 
        message: "Order not found or you don't have permission to cancel this order" 
      });
    }

    const blockedItemStatuses = ['Delivered', 'Returned', 'Return Requested'];

    const hasBlockedItem = order.items.some(item =>
      blockedItemStatuses.includes(item.status)
    );

    if (hasBlockedItem) {
      return res.status(400).json({
        success: false,
        message:
          'Order cannot be cancelled because one or more items are delivered or under return process'
      });
    }

    const validCancelStatuses = ['Pending', 'Placed', 'Processing'];
    if (!validCancelStatuses.includes(order.status)) {
      console.error(`Order cannot be cancelled, current status: ${order.status}`);
      return res.status(400).json({ 
        success: false, 
        message: `Order cannot be cancelled. Current status: ${order.status}` 
      });
    }

    console.log(`Order found: ${order._id}, Status: ${order.status}, Items count: ${order.items.length}`);

    // Get items that can be cancelled
    const itemsToCancel = order.items.filter(item => (item.status || 'Ordered') !== 'Cancelled').map(i => ({
      productId: i.productId._id,
      name: i.productId.name,
      salesPrice: i.salesPrice,
      quantity: i.quantity
    }));

    if (itemsToCancel.length === 0) {
      console.error(`No items available for cancellation in order: ${orderId}`);
      return res.status(400).json({ 
        success: false, 
        message: "No items available for cancellation" 
      });
    }

    console.log(`Processing full order cancellation for ${itemsToCancel.length} items`);

    // Coupon-aware full cancellation
    const couponResult = await handleItemCancellationWithCoupon(order, itemsToCancel, userId, {
      refundReason: `Refund for cancelled order #${order._id}`,
      cancellationReason: 'Full order cancellation'
    });

    // Verify
    const verifyOrder = await Order.findById(orderId);
    console.log(`Verification - Order status: ${verifyOrder.status}`);

    let message = "Order cancelled successfully";
    if (order.paymentMethod !== 'COD' && couponResult.totalRefundAmount > 0) {
      message += ". Refund has been processed to your wallet";
    }

    res.json({ 
      success: true, 
      message,
      refundAmount: (order.paymentMethod !== 'COD') ? couponResult.totalRefundAmount : 0,
      orderFullyCancelled: !!couponResult.orderFullyCancelled,
      orderStatus: verifyOrder.status,
      cancelledItemsCount: itemsToCancel.length,
      newOrderTotal: couponResult.newOrderTotal,
      couponRemoved: !!couponResult.couponRemoved
    });

  } catch (error) {
    console.error("=== ERROR IN CANCEL ORDER ===");
    console.error("Error cancelling order:", error);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Stack trace:", error.stack);
    console.error("=== END ERROR LOG ===");
    
    res.status(500).json({ 
      success: false, 
      message: "Internal server error. Please try again later." 
    });
  }
};

module.exports = {
    cancelSingleItem,
    cancelOrderNew
}