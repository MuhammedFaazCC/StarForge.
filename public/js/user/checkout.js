document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('checkoutForm');
  const submitButton = document.querySelector('.checkout-btn');

  if (!form) return;

  form.addEventListener('submit', async function (e) {
    const selectedAddressId = document.getElementById('selectedAddressId').value;
    const paymentMethod = document.querySelector('select[name="paymentMethod"]').value;
    const hasAddresses = document.querySelectorAll('.info-card').length > 0;

    if (hasAddresses && !selectedAddressId) {
      e.preventDefault();
      const errorElement = document.getElementById('addressError');
      if (errorElement) {
        errorElement.style.display = 'block';
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return false;
    }

    if (!paymentMethod) {
      e.preventDefault();
      alert('Please select a payment method.');
      return false;
    }

    if (paymentMethod === 'online') {
      e.preventDefault();

      const totalAmount = parseFloat(
        document.querySelector('.total').textContent.replace('Total: ', '')
      );

      try {
        const response = await fetch('/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: totalAmount })
        });

        const data = await response.json();
        if (!data.success) return alert('Failed to initiate payment');

        const options = {
          key: RAZORPAY_KEY,
          amount: data.order.amount,
          currency: data.order.currency,
          order_id: data.order.id,
          handler: function (response) {
            window.location.href = `/order/success?payment_id=${response.razorpay_payment_id}&order_id=${data.order.id}`;
          },
          prefill: {
            name: USER_NAME,
            email: USER_EMAIL
          },
          theme: { color: "#28a745" }
        };

        const rzp = new Razorpay(options);
        rzp.open();
      } catch (err) {
        console.error('Razorpay error:', err);
        alert('Payment initiation failed');
      }

      return false;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Processing...';
    }
  });
});

function selectAddress(addressId) {
  document.getElementById('selectedAddressId').value = addressId;

  document.querySelectorAll('.info-card').forEach(card => {
    card.classList.remove('selected');
  });

  const selectedCard = document.querySelector(`[data-address-id="${addressId}"]`);
  if (selectedCard) {
    selectedCard.classList.add('selected');
  }

  const errorElement = document.getElementById('addressError');
  if (errorElement) {
    errorElement.style.display = 'none';
  }
}