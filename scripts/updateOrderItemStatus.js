const mongoose = require('mongoose');
const Order = require('../models/orderSchema');
require('dotenv').config();

async function updateOrderItemStatus() {
  try {
    const uri = process.env.MONGODB_URI || process.env['MONGODB URI'] || 'mongodb://localhost:27017/StarForge';
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const orders = await Order.find({
      'items.status': { $exists: false }
    });

    console.log(`Found ${orders.length} orders to update`);

    let updatedCount = 0;

    for (const order of orders) {
      let needsUpdate = false;
      
      order.items.forEach(item => {
        if (!item.status) {
          if (order.status === 'Delivered') {
            item.status = 'Delivered';
          } else if (order.status === 'Cancelled') {
            item.status = 'Cancelled';
          } else if (order.status === 'Return Requested') {
            item.status = 'Return Requested';
          } else if (order.status === 'Returned') {
            item.status = 'Returned';
          } else {
            item.status = 'Ordered';
          }
          needsUpdate = true;
        }
      });

      if (needsUpdate) {
        await order.save();
        updatedCount++;
        console.log(`Updated order ${order._id}`);
      }
    }

    console.log(`Successfully updated ${updatedCount} orders`);
    
  } catch (error) {
    console.error('Error updating orders:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

updateOrderItemStatus();