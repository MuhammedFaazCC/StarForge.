const mongoose = require('mongoose');
const Order = require('../models/orderSchema');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/StarForge');

async function testItemDelivery() {
  try {
    console.log('Testing item delivery functionality...\n');
    
    // Find an order with items in "Shipped" or "Out for Delivery" status
    const order = await Order.findOne({
      'items.status': { $in: ['Shipped', 'Out for Delivery'] }
    });

    if (!order) {
      console.log('No orders found with items in Shipped or Out for Delivery status');
      return;
    }

    console.log(`Found order: ${order._id}`);
    console.log('Items status:');
    
    order.items.forEach((item, index) => {
      const status = item.status || 'Ordered';
      console.log(`  ${index + 1}. ${item.name} - Status: ${status}`);
      
      if (status === 'Shipped' || status === 'Out for Delivery') {
        console.log(`     This item can be marked as delivered!`);
        console.log(`     Item ID: ${item._id}`);
        console.log(`     API endpoint: POST /admin/orders/${order._id}/items/${item._id}/status`);
        console.log(`     Payload: { "status": "Delivered" }`);
      }
    });

    console.log('\nTo test the functionality:');
    console.log('1. Go to http://localhost:8080/admin');
    console.log('2. Navigate to Orders');
    console.log(`3. Click "View" on order ${order._id}`);
    console.log('4. Look for "Mark as Delivered" buttons next to eligible items');
    console.log('5. Click the button to test the functionality');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

testItemDelivery();