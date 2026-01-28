const Coupon = require("../models/couponSchema");
const Product = require("../models/productSchema");
const { updateWallet } = require("../controllers/user/walletController");

// Normalize a productId that may be an ObjectId or a populated document
const normalizeProductId = (pid) => {
  if (!pid) {return null;}
  if (pid._id) {return pid._id.toString();}
  try { return pid.toString(); } catch { return null; }
};

const handleCouponInvalidationAndRefund = async (order, itemsToCancel) => {
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
      // Only include active (non-cancelled, non-returned) items in the subtotal
      if (orderItem.status !== 'Cancelled' && orderItem.status !== 'Returned') {
        return sum + (orderItem.salesPrice * orderItem.quantity);
      }
      return sum;
    }, 0);

    const cancelledItemsTotal = itemsToCancel.reduce((sum, item) => {
      return sum + (item.salesPrice * item.quantity);
    }, 0);

    const newOrderSubtotal = currentOrderSubtotal - cancelledItemsTotal;

    if (order.coupon && (order.coupon.discountAmount > 0 || order.coupon.code)) {
      // Derive effective original discount if not stored
      let effectiveOriginalDiscount = order.coupon.discountAmount || 0;
      if (effectiveOriginalDiscount <= 0 && order.coupon.code) {
        const derived = Math.max(0, (currentOrderSubtotal) - (order.totalAmount ?? currentOrderSubtotal));
        effectiveOriginalDiscount = derived;
        console.log("Derived original discount since discountAmount was 0:", derived);
      }
      console.log("Coupon present on order. code:", order.coupon.code, "storedDiscount:", order.coupon.discountAmount, "effectiveDiscount:", effectiveOriginalDiscount);
      const coupon = order.coupon.code ? await Coupon.findOne({ code: order.coupon.code }) : null;
      
      if (coupon) {
        if (newOrderSubtotal < coupon.minimumAmount) {
          // Coupon becomes invalid after removing these items
          result.couponRemoved = true;

          const originalDiscount = order.coupon.discountAmount || 0;
          const returnedTotal = cancelledItemsTotal;
          // Discount share originally applied to returned items
          const returnedShareOfDiscount = (returnedTotal / currentOrderSubtotal) * originalDiscount;
          // Extra discount that remained on items that are kept (needs clawback)
          const remainingItemsExtraDiscount = Math.max(0, originalDiscount - returnedShareOfDiscount);

          // Total refund should be sum(returned totals) - originalDiscount
          const totalRefund = Math.max(0, returnedTotal - originalDiscount);

          // Distribute refund per item proportionally by itemTotal
          let distributedRefund = 0;
          const lastIndex = itemsToCancel.length - 1;
          itemsToCancel.forEach((item, idx) => {
            const itemTotal = item.salesPrice * item.quantity;
            // After-coupon base refund for this item before clawback
            const itemShareOfOriginalDiscount = (itemTotal / currentOrderSubtotal) * originalDiscount;
            const itemAfterCoupon = itemTotal - itemShareOfOriginalDiscount;
            // Allocate clawback portion by itemTotal weight
            const itemClawbackShare = (returnedTotal > 0)
              ? remainingItemsExtraDiscount * (itemTotal / returnedTotal)
              : 0;
            // Proportional refund for this item
            let itemRefund = Math.max(0, itemAfterCoupon - itemClawbackShare);

            // Adjust last item to fix rounding drift so sums match totalRefund exactly
            if (idx === lastIndex) {
              itemRefund = Math.max(0, totalRefund - distributedRefund);
            } else {
              distributedRefund += itemRefund;
            }

            result.itemRefunds.push({
              productId: item.productId,
              productName: item.name,
              refundAmount: itemRefund,
              originalAmount: itemTotal,
              originalDiscountApplied: itemShareOfOriginalDiscount,
              extraDiscountClawback: itemClawbackShare,
              reason: 'Coupon invalidated: refund adjusted by clawing back extra discount from remaining items'
            });
            result.totalRefundAmount += itemRefund;
          });

          // Remove coupon entirely and set new order total to the undiscounted remaining subtotal
          order.coupon.code = null;
          order.coupon.discountAmount = 0;
          result.newOrderTotal = newOrderSubtotal;

          console.log(`Coupon ${coupon.code} invalidated: subtotal ${newOrderSubtotal} < minimum ${coupon.minimumAmount}. Total refund adjusted = ${result.totalRefundAmount}`);

        } else {
          result.couponRecalculated = true;
          
          let eligibleAmount = newOrderSubtotal;
          if (coupon.orderMaxAmount && coupon.orderMaxAmount > 0) {
            eligibleAmount = Math.min(newOrderSubtotal, coupon.orderMaxAmount);
          }
          const recalculated = (eligibleAmount * coupon.discount) / 100;
          const newCouponDiscount = (coupon.maxAmount && coupon.maxAmount > 0)
            ? Math.min(recalculated, coupon.maxAmount)
            : recalculated;
          
          for (const item of itemsToCancel) {
            const itemTotal = item.salesPrice * item.quantity;
            const itemShareOfOriginalDiscount = (itemTotal / currentOrderSubtotal) * effectiveOriginalDiscount;
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
      } else if (order.coupon.code) {
        console.warn(`Coupon ${order.coupon.code} not found in database`);
        
        for (const item of itemsToCancel) {
          const itemTotal = item.salesPrice * item.quantity;
          const itemShareOfDiscount = (itemTotal / currentOrderSubtotal) * effectiveOriginalDiscount;
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
        
        const remainingCouponDiscount = effectiveOriginalDiscount - 
          (cancelledItemsTotal / currentOrderSubtotal) * effectiveOriginalDiscount;
        order.coupon.discountAmount = remainingCouponDiscount;
        result.newOrderTotal = newOrderSubtotal - remainingCouponDiscount;
        result.couponRecalculated = true;
      } else {
        // No coupon doc and no code, but discountAmount exists on order: do proportional distribution without DB lookup
        console.log("Coupon code missing, but discountAmount present. Applying proportional refund without DB lookup.");
        for (const item of itemsToCancel) {
          const itemTotal = item.salesPrice * item.quantity;
          const itemShareOfDiscount = (itemTotal / currentOrderSubtotal) * effectiveOriginalDiscount;
          const itemRefundAmount = itemTotal - itemShareOfDiscount;
          result.itemRefunds.push({
            productId: item.productId,
            productName: item.name,
            refundAmount: itemRefundAmount,
            originalAmount: itemTotal,
            discountDeducted: itemShareOfDiscount,
            reason: 'Refund minus proportional discount (no coupon code)'
          });
          result.totalRefundAmount += itemRefundAmount;
        }
        const remainingCouponDiscount = effectiveOriginalDiscount - 
          (cancelledItemsTotal / currentOrderSubtotal) * effectiveOriginalDiscount;
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

// Handles returns with coupon-aware proportional refunding and minimum spend invalidation
const handleItemReturnWithCoupon = async (order, itemsToReturn, userId, options = {}) => {
  try {
    console.log(`Starting return process for order ${order._id}, items:`, itemsToReturn.map(i => i.productId));

    // Compute new totals and proportional refund amounts
    const couponResult = await handleCouponInvalidationAndRefund(order, itemsToReturn, userId);

    // Update item statuses to Returned
    let itemsUpdated = 0;
    for (const itemToReturn of itemsToReturn) {
      const targetId = itemToReturn.productId?.toString();
      const orderItem = order.items.find(item => normalizeProductId(item.productId) === targetId);
      if (orderItem) {
        console.log(`Updating item ${orderItem.productId} status from ${orderItem.status || 'Ordered'} to Returned`);
        orderItem.status = 'Returned';
        orderItem.returnApprovedAt = new Date();
        if (options.returnReason) {
          orderItem.returnReason = options.returnReason;
        }
        itemsUpdated++;
      } else {
        console.error(`Item not found in order: ${itemToReturn.productId}`);
        couponResult.errors.push({
          type: 'item_not_found',
          error: `Item ${itemToReturn.productId} not found in order`
        });
      }
    }

    console.log(`Updated ${itemsUpdated} items to Returned status`);

    // Restore product stock for returned items
    const stockErrors = await restoreProductStock(itemsToReturn);
    if (stockErrors.length > 0) {
      console.error("Stock restoration errors (return):", stockErrors);
      couponResult.errors.push(...stockErrors);
    }

    // Process wallet refund (online/wallet payments)
    if (couponResult.totalRefundAmount > 0) {
      try {
        console.log(`Processing wallet refund of ₹${couponResult.totalRefundAmount} for user ${userId} (return)`);
        await processRefundToWallet(
          order,
          couponResult.totalRefundAmount,
          userId,
          options.refundReason || `Refund for returned items from order #${order._id}`
        );
        couponResult.refundProcessed = true;
        console.log(`Wallet refund processed successfully (return)`);
      } catch (refundError) {
        console.error("Refund processing failed (return):", refundError);
        couponResult.errors.push({
          type: 'refund',
          error: refundError.message
        });
        couponResult.refundProcessed = false;
      }
    }

    // If all non-cancelled items are now Returned, update order status
    const fullyReturned = areAllItemsReturned(order);
    if (fullyReturned) {
      console.log(`All items returned, updating order ${order._id} status to Returned`);
      order.status = 'Returned';
      couponResult.orderFullyReturned = true;
    }

    console.log(`Saving order ${order._id} with updated return statuses`);
    // Ensure Mongoose recognizes nested array modifications
    order.markModified('items');
    await order.save();

    console.log(`Order saved successfully for order ${order._id} (return flow)`);
    const postSaveReturned = order.items.filter(i => i.status === 'Returned').map(i => normalizeProductId(i.productId));
    console.log(`Post-save returned items for order ${order._id}:`, postSaveReturned);

    return couponResult;
  } catch (error) {
    console.error("Error in handleItemReturnWithCoupon:", error);
    console.error("Stack trace:", error.stack);
    console.error("Order ID:", order._id);
    console.error("Items to return:", itemsToReturn);
    console.error("User ID:", userId);
    console.error("Options:", options);
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

// For returns flow: check whether all non-cancelled items are returned
const areAllItemsReturned = (order) => {
  const activeOrReturned = order.items.filter(item => item.status !== 'Cancelled');
  // If every non-cancelled item is Returned, consider order fully returned
  return activeOrReturned.every(item => item.status === 'Returned');
};

const handleItemCancellationWithCoupon = async (order, itemsToCancel, userId, options = {}) => {
  try {
    console.log(`Starting cancellation process for order ${order._id}, items:`, itemsToCancel.map(i => i.productId));
    
    const couponResult = await handleCouponInvalidationAndRefund(order, itemsToCancel, userId);
    
    // Update item statuses
    let itemsUpdated = 0;
    for (const itemToCancel of itemsToCancel) {
      const targetId = itemToCancel.productId?.toString();
      const orderItem = order.items.find(item => normalizeProductId(item.productId) === targetId);
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
    // Ensure Mongoose recognizes nested array modifications
    order.markModified('items');
    await order.save();
    
    console.log(`Order saved successfully for order ${order._id}`);
    const postSaveCancelled = order.items.filter(i => i.status === 'Cancelled').map(i => normalizeProductId(i.productId));
    console.log(`Post-save cancelled items for order ${order._id}:`, postSaveCancelled);
    
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
  areAllItemsReturned,
  handleItemCancellationWithCoupon,
  handleItemReturnWithCoupon
};