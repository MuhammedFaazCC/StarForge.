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

    if (!reason) return;

    const res = await fetch(`/returnItem/${orderId}/${productId}`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ reason })
    });

    const data = await res.json();

    if (!data.success) throw new Error(data.message || "Return request failed");

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

    if (!confirm.isConfirmed) return;

    const res = await fetch(`/cancelItem/${orderId}/${productId}`, {
      method: "POST"
    });

    const data = await res.json();

    if (!data.success) throw new Error(data.message || "Cancel failed");

    Swal.fire("Cancelled", data.message || "Item cancelled", "success")
      .then(() => location.reload());

  } catch (err) {
    Swal.fire("Error", err.message || "Something went wrong", "error");
  }
}