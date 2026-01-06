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
