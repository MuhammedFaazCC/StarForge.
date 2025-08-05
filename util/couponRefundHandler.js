const Coupon = require("../models/couponSchema");
const Product = require("../models/productSchema");
const { updateWallet } = require("../controllers/user/walletController");

const handleCouponInvalidationAndRefund = async (order, itemsToCancel, userId) => {
  try {
    const result = {
      totalRefundAmount: 0,
      couponRemoved: false,
      couponRecalculated: false,
      newOrderTotal: 0,
      itemRefunds: [],
      errors: []
    };

    const currentOrderSubtotal = order.items.reduce((sum, orderItem) => {
      if (orderItem.status !== 'Cancelled') {
        return sum + (orderItem.salesPrice * orderItem.quantity);
      }
      return sum;
    }, 0);

    const cancelledItemsTotal = itemsToCancel.reduce((sum, item) => {
      return sum + (item.salesPrice * item.quantity);
    }, 0);

    const newOrderSubtotal = currentOrderSubtotal - cancelledItemsTotal;

    if (order.coupon && order.coupon.code && order.coupon.discountAmount > 0) {
      const coupon = await Coupon.findOne({ code: order.coupon.code });
      
      if (coupon) {
        if (newOrderSubtotal < coupon.minimumAmount) {
          result.couponRemoved = true;
          
          for (const item of itemsToCancel) {
            const itemTotal = item.salesPrice * item.quantity;
            result.itemRefunds.push({
              productId: item.productId,
              productName: item.name,
              refundAmount: itemTotal,
              reason: 'Full refund - coupon invalidated'
            });
            result.totalRefundAmount += itemTotal;
          }
          
          order.coupon.code = null;
          order.coupon.discountAmount = 0;
          
          result.newOrderTotal = newOrderSubtotal;
          
          console.log(`Coupon ${coupon.code} invalidated: New subtotal ${newOrderSubtotal} below minimum ${coupon.minimumAmount}`);
          
        } else {
          result.couponRecalculated = true;
          
          const newCouponDiscount = Math.min(
            (newOrderSubtotal * coupon.discount) / 100,
            coupon.maxDiscount || Number.MAX_VALUE
          );
          
          for (const item of itemsToCancel) {
            const itemTotal = item.salesPrice * item.quantity;
            const itemShareOfOriginalDiscount = (itemTotal / currentOrderSubtotal) * order.coupon.discountAmount;
            const itemRefundAmount = itemTotal - itemShareOfOriginalDiscount;
            
            result.itemRefunds.push({
              productId: item.productId,
              productName: item.name,
              refundAmount: itemRefundAmount,
              originalAmount: itemTotal,
              discountDeducted: itemShareOfOriginalDiscount,
              reason: 'Refund minus proportional coupon discount'
            });
            result.totalRefundAmount += itemRefundAmount;
          }
          
          order.coupon.discountAmount = newCouponDiscount;
          result.newOrderTotal = newOrderSubtotal - newCouponDiscount;
          
          console.log(`Coupon ${coupon.code} recalculated: New discount ${newCouponDiscount} for subtotal ${newOrderSubtotal}`);
        }
      } else {
        console.warn(`Coupon ${order.coupon.code} not found in database`);
        
        for (const item of itemsToCancel) {
          const itemTotal = item.salesPrice * item.quantity;
          const itemShareOfDiscount = (itemTotal / currentOrderSubtotal) * order.coupon.discountAmount;
          const itemRefundAmount = itemTotal - itemShareOfDiscount;
          
          result.itemRefunds.push({
            productId: item.productId,
            productName: item.name,
            refundAmount: itemRefundAmount,
            originalAmount: itemTotal,
            discountDeducted: itemShareOfDiscount,
            reason: 'Refund minus proportional discount (coupon not found in DB)'
          });
          result.totalRefundAmount += itemRefundAmount;
        }
        
        const remainingCouponDiscount = order.coupon.discountAmount - 
          (cancelledItemsTotal / currentOrderSubtotal) * order.coupon.discountAmount;
        order.coupon.discountAmount = remainingCouponDiscount;
        result.newOrderTotal = newOrderSubtotal - remainingCouponDiscount;
        result.couponRecalculated = true;
      }
    } else {
      for (const item of itemsToCancel) {
        const itemTotal = item.salesPrice * item.quantity;
        result.itemRefunds.push({
          productId: item.productId,
          productName: item.name,
          refundAmount: itemTotal,
          reason: 'Full refund - no coupon applied'
        });
        result.totalRefundAmount += itemTotal;
      }
      result.newOrderTotal = newOrderSubtotal;
    }

    order.totalAmount = result.newOrderTotal;

    return result;

  } catch (error) {
    console.error("Error in handleCouponInvalidationAndRefund:", error);
    throw error;
  }
};

const processRefundToWallet = async (order, refundAmount, userId, reason) => {
  try {
    const eligiblePaymentMethods = ['Online', 'Wallet'];
    
    if (!eligiblePaymentMethods.includes(order.paymentMethod)) {
      console.log(`No wallet refund needed for payment method: ${order.paymentMethod}`);
      return true;
    }

    if (refundAmount <= 0) {
      console.log("No refund amount to process");
      return true;
    }

    await updateWallet(userId, refundAmount, reason, "Credit");
    console.log(`Wallet refund processed: ₹${refundAmount} for user ${userId}`);
    return true;

  } catch (error) {
    console.error("Error processing wallet refund:", error);
    throw error;
  }
};

const restoreProductStock = async (itemsToCancel) => {
  const errors = [];
  
  for (const item of itemsToCancel) {
    try {
      await Product.updateOne(
        { _id: item.productId },
        { $inc: { stock: item.quantity } }
      );
      console.log(`Stock restored for product ${item.productId}: +${item.quantity}`);
    } catch (error) {
      console.error(`Error restoring stock for product ${item.productId}:`, error);
      errors.push({
        productId: item.productId,
        error: error.message
      });
    }
  }
  
  return errors;
};

const areAllItemsCancelled = (order) => {
  const activeItems = order.items.filter(item => item.status !== 'Cancelled');
  return activeItems.length === 0;
};

const handleItemCancellationWithCoupon = async (order, itemsToCancel, userId, options = {}) => {
  try {
    console.log(`Starting cancellation process for order ${order._id}, items:`, itemsToCancel.map(i => i.productId));
    
    const couponResult = await handleCouponInvalidationAndRefund(order, itemsToCancel, userId);
    
    // Update item statuses
    let itemsUpdated = 0;
    for (const itemToCancel of itemsToCancel) {
      const orderItem = order.items.find(item => 
        item.productId.toString() === itemToCancel.productId.toString()
      );
      if (orderItem) {
        console.log(`Updating item ${orderItem.productId} status from ${orderItem.status || 'Ordered'} to Cancelled`);
        orderItem.status = 'Cancelled';
        orderItem.cancelledAt = new Date();
        if (options.cancellationReason) {
          orderItem.cancellationReason = options.cancellationReason;
        }
        itemsUpdated++;
      } else {
        console.error(`Item not found in order: ${itemToCancel.productId}`);
        couponResult.errors.push({
          type: 'item_not_found',
          error: `Item ${itemToCancel.productId} not found in order`
        });
      }
    }
    
    console.log(`Updated ${itemsUpdated} items to Cancelled status`);
    
    // Restore product stock
    const stockErrors = await restoreProductStock(itemsToCancel);
    if (stockErrors.length > 0) {
      console.error("Stock restoration errors:", stockErrors);
      couponResult.errors.push(...stockErrors);
    }
    
    // Process wallet refund if needed
    if (couponResult.totalRefundAmount > 0) {
      try {
        console.log(`Processing wallet refund of ₹${couponResult.totalRefundAmount} for user ${userId}`);
        await processRefundToWallet(
          order, 
          couponResult.totalRefundAmount, 
          userId, 
          options.refundReason || `Refund for cancelled items from order #${order._id}`
        );
        couponResult.refundProcessed = true;
        console.log(`Wallet refund processed successfully`);
      } catch (refundError) {
        console.error("Refund processing failed:", refundError);
        couponResult.errors.push({
          type: 'refund',
          error: refundError.message
        });
        couponResult.refundProcessed = false;
        // Continue with status update even if refund fails
      }
    }
    
    // Check if all items are cancelled and update order status
    const allItemsCancelled = areAllItemsCancelled(order);
    if (allItemsCancelled) {
      console.log(`All items cancelled, updating order ${order._id} status to Cancelled`);
      order.status = 'Cancelled';
      couponResult.orderFullyCancelled = true;
    }
    
    // Save the order with updated statuses
    console.log(`Saving order ${order._id} with updated statuses`);
    await order.save();
    
    console.log(`Order saved successfully for order ${order._id}`);
    
    return couponResult;
    
  } catch (error) {
    console.error("Error in handleItemCancellationWithCoupon:", error);
    console.error("Stack trace:", error.stack);
    
    // Add detailed error logging
    console.error("Order ID:", order._id);
    console.error("Items to cancel:", itemsToCancel);
    console.error("User ID:", userId);
    console.error("Options:", options);
    
    throw error;
  }
};

module.exports = {
  handleCouponInvalidationAndRefund,
  processRefundToWallet,
  restoreProductStock,
  areAllItemsCancelled,
  handleItemCancellationWithCoupon
};