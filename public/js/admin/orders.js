document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.status-select').forEach(select => {
    select.addEventListener('change', async function () {
      const orderId = this.getAttribute('data-order-id');
      const newStatus = this.value;

      const confirmed = confirm(`Change order ${orderId} status to "${newStatus}"?`);
      if (!confirmed) return;

      try {
        const res = await fetch(`/admin/orders/${orderId}/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: newStatus })
        });

        const data = await res.json();
        if (data.success) {
          alert('Order status updated successfully.');
        } else {
          alert('Failed to update order status.');
        }
      } catch (err) {
        console.error(err);
        alert('An error occurred.');
      }
    });
  });
});