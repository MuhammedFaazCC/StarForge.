const updateItemStatus = async (req, res) => {
  const { status } = req.body;
  const { orderId, itemId } = req.params;

  try {
    // Validate status
    const validStatuses = ['Placed', 'Ordered', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Return Requested', 'Returned', 'Return Declined'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const item = order.items.id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const currentStatus = item.status || 'Placed';

    // Define valid status transitions
    const statusTransitions = {
      'Placed': ['Ordered', 'Processing', 'Shipped', 'Cancelled'],
      'Ordered': ['Processing', 'Shipped', 'Cancelled'],
      'Processing': ['Shipped', 'Cancelled'],
      'Shipped': ['Out for Delivery', 'Delivered', 'Cancelled'],
      'Out for Delivery': ['Delivered', 'Cancelled'],
      'Delivered': [], // Final status
      'Cancelled': [], // Final status
      'Return Requested': ['Returned', 'Return Declined'],
      'Returned': [], // Final status
      'Return Declined': []
    };

    // Validate status transition
    if (currentStatus === status) {
      return res.status(400).json({ success: false, message: 'Item is already in this status' });
    }

    // Check if current status allows transitions
    if (!statusTransitions[currentStatus]) {
      return res.status(400).json({ success: false, message: 'Invalid current status' });
    }

    // Allow cancellation from any non-final status
    const finalStatuses = ['Delivered', 'Cancelled', 'Returned'];
    if (status === 'Cancelled' && !finalStatuses.includes(currentStatus)) {
      // Allow cancellation
    } else if (!statusTransitions[currentStatus].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot change status from "${currentStatus}" to "${status}"` 
      });
    }

    // Update the item status
    item.status = status;
    
    // Set appropriate timestamps
    const now = new Date();
    switch (status) {
      case 'Delivered':
        item.deliveredAt = now;
        break;
      case 'Cancelled':
        item.cancelledAt = now;
        break;
      case 'Return Requested':
        item.returnRequestedAt = now;
        break;
    }

    await order.save();

    // Log the status change for audit purposes
    console.log(`Item status updated: Order ${orderId}, Item ${itemId}, ${currentStatus} -> ${status}`);

    res.json({ 
      success: true, 
      message: `Item status updated from "${currentStatus}" to "${status}" successfully`,
      newStatus: status,
      timestamp: now
    });
  } catch (error) {
    console.error('Item status update failed:', error);
    res.status(500).json({ success: false, message: 'Failed to update item status' });
  }
};

module.exports = { updateItemStatus };