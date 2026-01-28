/* eslint-disable no-undef */
const requestReturn = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    const orderId = req.params.id;
    const { reason } = req.body;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Login required" });
    }

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Please provide a detailed reason (minimum 10 characters)",
      });
    }

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (order.status !== "Delivered") {
      return res.status(400).json({
        success: false,
        message: "Only fully delivered orders can be returned",
      });
    }

    const existingReturn = await Return.findOne({ orderId });
    if (existingReturn) {
      return res.status(400).json({
        success: false,
        message: "Return request already submitted",
      });
    }

    await Return.create({
      orderId,
      userId,
      reason: reason.trim(),
      status: "Pending",
      requestedAt: new Date(),
    });

    order.status = "Return Requested";
    order.items.forEach((item) => {
      if (item.status !== "Cancelled") {
        item.status = "Return Requested";
      }
    });

    // REQUIRED to bypass schema crash
    order.orderId = order.orderId || order._id.toString();

    await order.save();

    return res.json({
      success: true,
      message: "Return request submitted successfully",
    });
  } catch (error) {
    console.error("Return full order error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};



document.addEventListener("DOMContentLoaded", () => {
  // Cancel full order
  document.querySelectorAll(".cancel-order-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const orderId = button.dataset.orderId;
      await cancelOrder(orderId);
    });
  });

  // Return full order
  document.querySelectorAll(".return-order-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const orderId = button.dataset.orderId;
      await requestReturn(orderId);
    });
  });

  // Cancel single item
  document.querySelectorAll(".cancel-item-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const orderId = button.dataset.orderId;
      const productId = button.dataset.productId;
      await cancelItem(orderId, productId);
    });
  });

  // Return single item
  document.querySelectorAll(".return-item-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const orderId = button.dataset.orderId;
      const productId = button.dataset.productId;
      await returnItem(orderId, productId);
    });
  });
});

async function returnItem(orderId, productId) {
  try {
    const { value: reason } = await Swal.fire({
      title: "Return Item",
      input: "textarea",
      inputLabel: "Reason for return (minimum 10 characters)",
      inputPlaceholder: "Describe the issue...",
      showCancelButton: true,
      confirmButtonText: "Submit",
      preConfirm: (value) => {
        if (!value || value.trim().length < 10) {
          Swal.showValidationMessage("Please provide at least 10 characters");
        }
        return value;
      }
    });

    if (!reason) {return;}

    const res = await fetch(`/returnItem/${orderId}/${productId}`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ reason })
    });

    const data = await res.json();

    if (!data.success) {throw new Error(data.message || "Return request failed");}

    Swal.fire("Success", data.message || "Return requested", "success")
      .then(() => location.reload());

  } catch (err) {
    Swal.fire("Error", err.message || "Something went wrong", "error");
  }
}

async function cancelItem(orderId, productId) {
  try {
    const confirm = await Swal.fire({
      title: "Cancel Item?",
      text: "Are you sure you want to cancel this item?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Cancel",
    });

    if (!confirm.isConfirmed) {return;}

    const res = await fetch(`/cancelItem/${orderId}/${productId}`, {
      method: "POST"
    });

    const data = await res.json();

    if (!data.success) {throw new Error(data.message || "Cancel failed");}

    Swal.fire("Cancelled", data.message || "Item cancelled", "success")
      .then(() => location.reload());

  } catch (err) {
    Swal.fire("Error", err.message || "Something went wrong", "error");
  }
}