const mongoose = require('mongoose');
const Order = require('../models/orderSchema');
const User = require('../models/userSchema');
const Product = require('../models/productSchema');
const { handleItemCancellationWithCoupon } = require('../util/couponRefundHandler');

// Test script to verify order cancellation functionality
async function testCancellation() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/starforge', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB for testing');

    // Create a test order
    const testOrder = new Order({
      userId: new mongoose.Types.ObjectId(),
      totalAmount: 1000,
      status: 'Processing',
      paymentMethod: 'Online',
      address: 'Test Address',
      offeredPrice: 1000,
      items: [
        {
          productId: new mongoose.Types.ObjectId(),
          name: 'Test Product 1',
          quantity: 2,
          salesPrice: 300,
          status: 'Ordered'
        },
        {
          productId: new mongoose.Types.ObjectId(),
          name: 'Test Product 2',
          quantity: 1,
          salesPrice: 400,
          status: 'Ordered'
        }
      ]
    });

    await testOrder.save();
    console.log('Test order created:', testOrder._id);

    // Test single item cancellation
    const itemsToCancel = [{
      productId: testOrder.items[0].productId,
      name: testOrder.items[0].name,
      salesPrice: testOrder.items[0].salesPrice,
      quantity: testOrder.items[0].quantity
    }];

    console.log('Testing single item cancellation...');
    
    const result = await handleItemCancellationWithCoupon(
      testOrder,
      itemsToCancel,
      testOrder.userId,
      {
        cancellationReason: 'Test cancellation',
        refundReason: 'Test refund'
      }
    );

    console.log('Cancellation result:', {
      totalRefundAmount: result.totalRefundAmount,
      orderFullyCancelled: result.orderFullyCancelled,
      errors: result.errors
    });

    // Verify the order was updated
    const updatedOrder = await Order.findById(testOrder._id);
    console.log('Updated order status:', updatedOrder.status);
    console.log('Item statuses:', updatedOrder.items.map(item => ({
      name: item.name,
      status: item.status,
      cancelledAt: item.cancelledAt,
      cancellationReason: item.cancellationReason
    })));

    // Test full order cancellation
    console.log('\nTesting full order cancellation...');
    
    const remainingItems = updatedOrder.items.filter(item => item.status !== 'Cancelled');
    const remainingItemsToCancel = remainingItems.map(item => ({
      productId: item.productId,
      name: item.name,
      salesPrice: item.salesPrice,
      quantity: item.quantity
    }));

    if (remainingItemsToCancel.length > 0) {
      const fullCancelResult = await handleItemCancellationWithCoupon(
        updatedOrder,
        remainingItemsToCancel,
        updatedOrder.userId,
        {
          cancellationReason: 'Full order test cancellation',
          refundReason: 'Full order test refund'
        }
      );

      console.log('Full cancellation result:', {
        totalRefundAmount: fullCancelResult.totalRefundAmount,
        orderFullyCancelled: fullCancelResult.orderFullyCancelled,
        errors: fullCancelResult.errors
      });

      // Verify final state
      const finalOrder = await Order.findById(testOrder._id);
      console.log('Final order status:', finalOrder.status);
      console.log('Final item statuses:', finalOrder.items.map(item => ({
        name: item.name,
        status: item.status,
        cancelledAt: item.cancelledAt,
        cancellationReason: item.cancellationReason
      })));
    }

    // Clean up test data
    await Order.findByIdAndDelete(testOrder._id);
    console.log('\nTest completed successfully - test data cleaned up');

  } catch (error) {
    console.error('Test failed:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testCancellation();
}

module.exports = { testCancellation };