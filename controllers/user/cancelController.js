const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");

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

    // Simple direct cancellation without complex coupon logic for now
    console.log("Updating item status directly...");
    
    // Update the item status
    item.status = 'Cancelled';
    item.cancelledAt = new Date();
    item.cancellationReason = 'User requested cancellation';
    
    // Calculate refund amount
    const refundAmount = item.salesPrice * item.quantity;
    
    // Check if all items will be cancelled
    const otherActiveItems = order.items.filter(i => 
      i.productId._id.toString() !== productId && 
      (i.status || 'Ordered') !== 'Cancelled'
    );
    
    const willBeFullyCancelled = otherActiveItems.length === 0;
    
    if (willBeFullyCancelled) {
      console.log("All items will be cancelled, updating order status...");
      order.status = 'Cancelled';
    }
    
    // Update order total
    order.totalAmount = order.totalAmount - refundAmount;
    
    console.log("Saving order...");
    await order.save();
    
    // Process wallet refund if needed
    if (order.paymentMethod === 'Online' || order.paymentMethod === 'Wallet') {
      try {
        console.log(`Processing wallet refund of ₹${refundAmount}`);
        const { updateWallet } = require("./walletController");
        await updateWallet(
          userId, 
          refundAmount, 
          `Refund for cancelled item: ${item.productId.name} from order #${order._id}`, 
          "Credit"
        );
        console.log("Wallet refund processed successfully");
      } catch (refundError) {
        console.error("Wallet refund failed:", refundError);
        // Continue even if refund fails
      }
    }
    
    // Restore product stock
    try {
      console.log(`Restoring stock for product ${item.productId._id}: +${item.quantity}`);
      await Product.updateOne(
        { _id: item.productId._id },
        { $inc: { stock: item.quantity } }
      );
      console.log("Stock restored successfully");
    } catch (stockError) {
      console.error("Stock restoration failed:", stockError);
      // Continue even if stock restoration fails
    }
    
    // Verify the changes were saved
    const verifyOrder = await Order.findById(orderId);
    const verifyItem = verifyOrder.items.find(i => i.productId.toString() === productId);
    
    console.log(`Verification - Item status: ${verifyItem.status}, Order status: ${verifyOrder.status}`);
    
    if (verifyItem.status !== 'Cancelled') {
      console.error("Verification failed - item status not updated");
      return res.status(500).json({ 
        success: false, 
        error: "Status update failed. Please try again." 
      });
    }

    let message = "Item cancelled successfully";
    if (order.paymentMethod !== 'COD') {
      message += ". Refund has been processed to your wallet";
    }
    
    if (willBeFullyCancelled) {
      message += ". Order has been fully cancelled";
    }

    console.log("=== CANCEL SINGLE ITEM SUCCESS ===");

    res.json({ 
      success: true, 
      message: message,
      refundAmount: (order.paymentMethod !== 'COD') ? refundAmount : 0,
      newOrderTotal: order.totalAmount,
      orderFullyCancelled: willBeFullyCancelled,
      itemStatus: 'Cancelled',
      orderStatus: verifyOrder.status
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
    const itemsToCancel = order.items.filter(item => (item.status || 'Ordered') !== 'Cancelled');

    if (itemsToCancel.length === 0) {
      console.error(`No items available for cancellation in order: ${orderId}`);
      return res.status(400).json({ 
        success: false, 
        message: "No items available for cancellation" 
      });
    }

    console.log(`Processing full order cancellation for ${itemsToCancel.length} items`);

    // Calculate total refund amount
    let totalRefundAmount = 0;
    
    // Update all item statuses to cancelled
    for (const item of itemsToCancel) {
      item.status = 'Cancelled';
      item.cancelledAt = new Date();
      item.cancellationReason = 'Full order cancellation';
      totalRefundAmount += item.salesPrice * item.quantity;
      
      // Restore product stock
      try {
        await Product.updateOne(
          { _id: item.productId._id },
          { $inc: { stock: item.quantity } }
        );
        console.log(`Stock restored for product ${item.productId._id}: +${item.quantity}`);
      } catch (stockError) {
        console.error(`Stock restoration failed for product ${item.productId._id}:`, stockError);
      }
    }
    
    // Update order status
    order.status = 'Cancelled';
    order.totalAmount = 0; // Set to 0 since everything is cancelled
    
    console.log("Saving order with cancelled status...");
    await order.save();
    
    // Process wallet refund if needed
    if (order.paymentMethod === 'Online' || order.paymentMethod === 'Wallet') {
      try {
        console.log(`Processing wallet refund of ₹${totalRefundAmount}`);
        const { updateWallet } = require("./walletController");
        await updateWallet(
          userId, 
          totalRefundAmount, 
          `Refund for cancelled order #${order._id}`, 
          "Credit"
        );
        console.log("Wallet refund processed successfully");
      } catch (refundError) {
        console.error("Wallet refund failed:", refundError);
        // Continue even if refund fails
      }
    }
    
    // Verify the changes were saved
    const verifyOrder = await Order.findById(orderId);
    console.log(`Verification - Order status: ${verifyOrder.status}`);
    
    if (verifyOrder.status !== 'Cancelled') {
      console.error("Verification failed - order status not updated");
      return res.status(500).json({ 
        success: false, 
        message: "Order status update failed. Please try again." 
      });
    }

    let message = "Order cancelled successfully";
    if (order.paymentMethod !== 'COD') {
      message += ". Refund has been processed to your wallet";
    }

    console.log("=== CANCEL ORDER SUCCESS ===");

    res.json({ 
      success: true, 
      message: message,
      refundAmount: (order.paymentMethod !== 'COD') ? totalRefundAmount : 0,
      orderFullyCancelled: true,
      orderStatus: 'Cancelled',
      cancelledItemsCount: itemsToCancel.length
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