const Return = require("../../models/returnSchema");
const Order = require("../../models/orderSchema");

const requestReturnItem = async (req, res) => {
  try {
    const { orderId, productId } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ 
        success: false, 
        message: "Please provide a detailed reason for return (minimum 10 characters)" 
      });
    }

    const order = await Order.findOne({ _id: orderId, userId: userId }).populate('items.productId');
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: "Order not found" 
      });
    }

    const item = order.items.find(i => i.productId._id.toString() === productId);
    if (!item || item.status !== 'Delivered') {
      return res.status(400).json({ 
        success: false, 
        message: "Item not eligible for return" 
      });
    }

    const RETURN_DAYS_LIMIT = 7;
    const deliveryDate = item.deliveredAt || order.deliveredAt;
    if (!deliveryDate) {
      return res.status(400).json({ 
        success: false, 
        message: "Delivery date not found for this item" 
      });
    }

    const daysSinceDelivery = Math.floor((new Date() - new Date(deliveryDate)) / (1000 * 60 * 60 * 24));
    if (daysSinceDelivery > RETURN_DAYS_LIMIT) {
      return res.status(400).json({ 
        success: false, 
        message: `Return period has expired. Items can only be returned within ${RETURN_DAYS_LIMIT} days of delivery.` 
      });
    }

    if (item.status === 'Return Requested') {
      return res.status(400).json({ 
        success: false, 
        message: "Return request already submitted for this item" 
      });
    }

    item.status = 'Return Requested';
    item.returnReason = reason.trim();
    item.returnRequestedAt = new Date();

    await order.save();
    
    res.json({ 
      success: true, 
      message: "Return request submitted for item successfully. We will review your request and get back to you soon." 
    });

  } catch (error) {
    console.error("Error processing item return request:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error. Please try again later." 
    });
  }
};

const requestReturn = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const orderId = req.params.id;
    const { reason } = req.body;

    const order = await Order.findOne({ _id: orderId, userId: userId });
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.status !== "Delivered") {
      return res.status(400).json({ error: "Only delivered orders can be returned" });
    }

    if (order.totalAmount == null || isNaN(order.totalAmount)) {
      return res.status(400).json({ error: "Order total is invalid" });
    }

    const existingReturn = await Return.findOne({ orderId });
    if (existingReturn) {
      return res.status(400).json({ error: "Return request already submitted" });
    }

    await Return.create({
      orderId,
      userId,
      reason,
      status: "Pending",
      requestedAt: new Date(),
    });

    order.status = "Return Requested";
    await order.save();

    res.json({ message: "Return request submitted successfully" });
  } catch (error) {
    console.error("Error requesting return:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const approveReturn = async (req, res) => {
  try {
    const { returnId } = req.params;
    const { status } = req.body;

    const returnRequest = await Return.findById(returnId).populate("orderId");
    if (!returnRequest) {
      return res.status(404).json({ error: "Return request not found" });
    }

    const order = returnRequest.orderId;
    if (!order) {
      return res.status(404).json({ error: "Associated order not found" });
    }

    if (!order.total) {
      return res.status(400).json({ error: "Order total is invalid" });
    }

    returnRequest.status = status;
    returnRequest.updatedAt = new Date();
    await returnRequest.save();

    if (status === "Approved") {
      order.status = "Returned";
      await order.save();

      await refundToWallet(order, "Refund for returned order");

    } else if (status === "Rejected") {
      order.status = "Delivered";
      await order.save();
    }

    res.json({ message: `Return request ${status.toLowerCase()} successfully` });
  } catch (error) {
    console.error("Error processing return:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
    requestReturnItem,
    requestReturn,
    approveReturn
}