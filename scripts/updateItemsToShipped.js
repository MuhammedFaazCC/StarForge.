const mongoose = require('mongoose');
const Order = require('../models/orderSchema');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/StarForge', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function updateItemsToShipped() {
  try {
    console.log('Connecting to database...');
    
    // Find orders that are not cancelled and have items
    const orders = await Order.find({
      status: { $nin: ['Cancelled', 'Delivered'] },
      'items.0': { $exists: true }
    }).limit(5); // Limit to 5 orders for testing

    console.log(`Found ${orders.length} orders to update`);

    for (const order of orders) {
      console.log(`\nUpdating order ${order._id}:`);
      
      const finalItemStatuses = ['Delivered', 'Returned', 'Cancelled'];
      // Update only non-final items to simulate progression
      for (let i = 0; i < order.items.length; i++) {
        const item = order.items[i];
        if (finalItemStatuses.includes(item.status)) {
          console.log(`  - Item ${i + 1}: ${item.name} skipped (final: ${item.status})`);
          continue;
        }

        if (i % 2 === 0) { // Update every other non-final item to "Shipped"
          item.status = 'Shipped';
          console.log(`  - Item ${i + 1}: ${item.name} -> Shipped`);
        } else { // Update the rest to "Out for Delivery"
          item.status = 'Out for Delivery';
          console.log(`  - Item ${i + 1}: ${item.name} -> Out for Delivery`);
        }
      }
      
      await order.save();
      console.log(`  ✓ Order ${order._id} updated successfully`);
    }

    console.log('\nAll orders updated successfully!');
    console.log('You can now test the "Mark as Delivered" functionality in the admin panel.');
    
  } catch (error) {
    console.error('Error updating orders:', error);
  } finally {
    mongoose.connection.close();
    console.log('Database connection closed.');
  }
}

updateItemsToShipped();