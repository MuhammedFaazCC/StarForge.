const Return = require("../../models/returnSchema");
const Order = require("../../models/orderSchema");
const { handleItemReturnWithCoupon, areAllItemsReturned } = require("../../util/couponRefundHandler");

const getReturnRequestsPage = async (req, res) => {
  try {
    const { page = 1, search = '', sort = 'desc' } = req.query;
    const limit = 10;
    
    const orderQuery = { 
      $or: [
        { status: 'Return Requested' },
        { 'items.status': 'Return Requested' }
      ]
    };

    if (search) {
      const users = await User.find({ 
        $or: [
          { fullName: new RegExp(search, 'i') },
          { email: new RegExp(search, 'i') }
        ]
      }).select('_id');
      orderQuery.userId = { $in: users.map(u => u._id) };
    }

    const orders = await Order.find(orderQuery)
      .populate('userId')
      .populate('items.productId')
      .sort({ createdAt: sort === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const ordersWithReturns = await Promise.all(
      orders.map(async (order) => {
        const returnRequest = await Return.findOne({ orderId: order._id });
        
        const itemReturns = order.items.filter(item => item.status === 'Return Requested');
        
        return {
          ...order.toObject(),
          returnReason: returnRequest?.reason || 'No reason provided',
          returnRequestedAt: returnRequest?.requestedAt || order.updatedAt,
          hasFullOrderReturn: order.status === 'Return Requested',
          hasItemReturns: itemReturns.length > 0,
          itemReturns: itemReturns
        };
      })
    );

    const totalOrders = await Order.countDocuments(orderQuery);
    const totalPages = Math.ceil(totalOrders / limit);

    res.render('adminReturns', {
      orders: ordersWithReturns,
      currentPage: parseInt(page),
      totalPages,
      search,
      sort
    });
  } catch (error) {
    console.error("Error loading return requests:", error);
    res.status(500).send("Server Error");
  }
};

const acceptReturnRequest = async (req, res) => {
  try {
    const orderId = req.params.id;

    const order = await Order.findById(orderId).populate({
      path: 'items.productId',
      select: 'name brand mainImage price salePrice offer',
      options: { strictPopulate: false }
    });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.status !== "Return Requested") {
      return res.status(400).json({ success: false, message: "Order is not in return requested status" });
    }

    // Build itemsToReturn as all items that are not cancelled/returned
    const itemsToReturn = order.items
      .filter(i => (i.status !== 'Cancelled' && i.status !== 'Returned'))
      .map(i => ({
        productId: (i.productId && i.productId._id) ? i.productId._id : i.productId,
        name: i.productId?.name || i.name,
        salesPrice: i.salesPrice,
        quantity: i.quantity
      }));

    const couponResult = await handleItemReturnWithCoupon(order, itemsToReturn, order.userId, {
      refundReason: `Refund for returned order #${order._id}`
    });

    await Return.findOneAndUpdate(
      { orderId },
      { status: "Approved", updatedAt: new Date() }
    );

    res.json({ 
      success: true, 
      message: "Return request accepted successfully" + 
        (order.paymentMethod !== 'COD' ? ". Refund has been processed to customer's wallet." : "") +
        ". Product stock has been restored.",
      refundAmount: couponResult.totalRefundAmount,
      couponRemoved: !!couponResult.couponRemoved,
      newOrderTotal: couponResult.newOrderTotal
    });
  } catch (error) {
    console.error("Error accepting return request:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const declineReturnRequest = async (req, res) => {
  try {
    const orderId = req.params.id;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.status !== "Return Requested") {
      return res.status(400).json({ success: false, message: "Order is not in return requested status" });
    }

    order.status = "Return Declined";
    await order.save();

    await Return.findOneAndUpdate(
      { orderId },
      { status: "Rejected", updatedAt: new Date() }
    );

    res.json({ 
      success: true, 
      message: "Return request declined successfully" 
    });

  } catch (error) {
    console.error("Error declining return request:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const acceptItemReturnRequest = async (req, res) => {
  try {
    const { orderId, productId } = req.params;

    const order = await Order.findById(orderId).populate({
      path: 'items.productId',
      select: 'name brand mainImage price salePrice offer',
      options: { strictPopulate: false }
    });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const item = order.items.find(i => i.productId && i.productId._id.toString() === productId);
    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found in order" });
    }

    if (item.status !== "Return Requested") {
      return res.status(400).json({ success: false, message: "Item is not in return requested status" });
    }

    const itemsToReturn = [{
      productId: item.productId._id,
      name: item.productId.name,
      salesPrice: item.salesPrice,
      quantity: item.quantity
    }];

    const couponResult = await handleItemReturnWithCoupon(order, itemsToReturn, order.userId, {
      refundReason: `Refund for returned item ${item.productId.name} from order #${order._id}`
    });

    res.json({ 
      success: true, 
      message: "Item return request accepted successfully" + 
        (order.paymentMethod !== 'COD' ? ". Refund has been processed to customer's wallet." : "") +
        ". Product stock has been restored.",
      refundAmount: couponResult.totalRefundAmount,
      couponRemoved: !!couponResult.couponRemoved,
      newOrderTotal: couponResult.newOrderTotal
    });
  } catch (error) {
    console.error("Error accepting item return request:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const declineItemReturnRequest = async (req, res) => {
  try {
    const { orderId, productId } = req.params;

    const order = await Order.findById(orderId).populate({
      path: 'items.productId',
      select: 'name brand mainImage price salePrice offer',
      options: { strictPopulate: false }
    });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const item = order.items.find(i => i.productId && i.productId._id.toString() === productId);
    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found in order" });
    }

    if (item.status !== "Return Requested") {
      return res.status(400).json({ success: false, message: "Item is not in return requested status" });
    }

    item.status = "Return Declined";
    item.returnDeclinedAt = new Date();
    await order.save();

    res.json({ 
      success: true, 
      message: "Item return request declined successfully" 
    });

  } catch (error) {
    console.error("Error declining item return request:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
    getReturnRequestsPage,
    acceptReturnRequest,
    declineReturnRequest,
    acceptItemReturnRequest,
    declineItemReturnRequest
}