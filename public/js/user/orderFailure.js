
    async function retryPayment(orderId) {
      const retryBtn = document.getElementById('retryBtn');
      const loading = document.getElementById('loading');
      
      try {
        retryBtn.disabled = true;
        retryBtn.textContent = 'Processing...';
        loading.style.display = 'block';

        const response = await fetch(`/order/retry/${orderId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to create retry payment');
        }

        if (typeof Razorpay === 'undefined') {
          throw new Error('Payment system is not loaded. Please refresh the page and try again.');
        }

        const options = {
          key: data.key,
          amount: data.order.amount,
          currency: data.order.currency,
          name: 'StarForge',
          description: `Retry Payment for Order #${orderId}`,
          order_id: data.order.id,
          handler: function (response) {
            window.location.href = `/order/success?payment_id=${response.razorpay_payment_id}&order_id=${response.razorpay_order_id}&signature=${response.razorpay_signature}`;
          },
          modal: {
            ondismiss: function() {
              retryBtn.disabled = false;
              retryBtn.innerHTML = 'Retry Payment';
              loading.style.display = 'none';
            }
          },
          theme: {
            color: '#28a745'
          }
        };

        const rzp = new Razorpay(options);
        rzp.open();

        loading.style.display = 'none';

      } catch (error) {
        console.error('Retry payment error:', error);
        
        retryBtn.disabled = false;
        retryBtn.innerHTML = 'Retry Payment';
        loading.style.display = 'none';

        await Swal.fire({
          title: 'Retry Failed',
          text: error.message || 'Unable to retry payment. Please try again later.',
          icon: 'error',
          confirmButtonColor: '#dc3545'
        });
      }
    }

    document.addEventListener('DOMContentLoaded', function() {
      const retryBtn = document.getElementById('retryBtn');
      if (retryBtn) {
        retryBtn.focus();
      }
    });
  