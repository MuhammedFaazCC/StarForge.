function selectAddress(addressId) {
  const selectedCard = document.querySelector(`[data-address-id="${addressId}"]`);
  const hiddenInput = document.getElementById('selectedAddressId');
  const errorElement = document.getElementById('addressError');
  const radioButton = document.querySelector(`input[value="${addressId}"]`);
  
  document.querySelectorAll('.info-card').forEach(card => {
    card.classList.remove('selected');
  });
  
  if (selectedCard) {
    selectedCard.classList.add('selected');
  }
  
  if (radioButton) {
    radioButton.checked = true;
  }
  
  if (hiddenInput) {
    hiddenInput.value = addressId;
  }
  
  if (errorElement) {
    errorElement.style.display = 'none';
  }

  fetch('/address/select', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ addressId })
  })
    .then(response => response.json())
    .then(data => {
      if (!data.success) {
        console.error('Failed to select address:', data.message);
        alert(data.message || 'Failed to select address. Please try again.');
        
        if (selectedCard) {
          selectedCard.classList.remove('selected');
        }
        if (radioButton) {
          radioButton.checked = false;
        }
        if (hiddenInput) {
          hiddenInput.value = '';
        }
      }
    })
    .catch(error => {
      console.error('Error selecting address:', error);
      alert('Failed to select address. Please try again.');
      
      if (selectedCard) {
        selectedCard.classList.remove('selected');
      }
      if (radioButton) {
        radioButton.checked = false;
      }
      if (hiddenInput) {
        hiddenInput.value = '';
      }
    });
}

function openModal(addressId = '') {
  const modal = document.getElementById('addressModal');
  const form = document.getElementById('addressForm');
  
  if (modal && form) {
    modal.classList.add('show');
    form.action = addressId ? `/address/edit/${addressId}` : '/address/add';
    
    if (addressId) {
      fetch(`/address/${addressId}`)
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            form.querySelector('#name').value = data.address.name;
            form.querySelector('#address').value = data.address.address;
            form.querySelector('#district').value = data.address.district;
            form.querySelector('#state').value = data.address.state;
            form.querySelector('#city').value = data.address.city;
            form.querySelector('#pinCode').value = data.address.pinCode;
          } else {
            alert(data.message || 'Failed to load address details.');
          }
        })
        .catch(error => {
          console.error('Error fetching address:', error);
          alert('Failed to load address details. Please try again.');
        });
    } else {
      form.reset();
    }
  }
}

function closeModal() {
  const modal = document.getElementById('addressModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('checkoutForm');
  const submitButton = document.querySelector('.checkout-btn');
  const paymentMethodSelect = document.getElementById('paymentMethod');
  const selectedAddressInput = document.getElementById('selectedAddressId');

  const preSelectedAddress = document.querySelector('.info-card.selected');
  if (preSelectedAddress) {
    const addressId = preSelectedAddress.dataset.addressId;
    if (addressId && selectedAddressInput) {
      selectedAddressInput.value = addressId;
      const radioButton = document.querySelector(`input[value="${addressId}"]`);
      if (radioButton) {
        radioButton.checked = true;
      }
    }
  }

  document.querySelectorAll('.address-radio').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        const addressId = e.target.value;
        selectAddress(addressId);
      }
    });
  });

  document.querySelectorAll('.info-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-edit-address]') || e.target.closest('.address-radio')) {
        return;
      }
      const addressId = card.dataset.addressId;
      if (addressId) {
        selectAddress(addressId);
      }
    });
  });

  document.querySelectorAll('[data-add-address]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });
  });

  document.querySelectorAll('[data-edit-address]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const addressId = link.dataset.editAddress;
      openModal(addressId);
    });
  });

  const toggleBtn = document.getElementById('toggleCouponListBtn');
  const couponSection = document.getElementById('availableCouponsSection');
  if (toggleBtn && couponSection) {
    toggleBtn.addEventListener('click', () => {
      const visible = couponSection.style.display === 'block';
      couponSection.style.display = visible ? 'none' : 'block';
      toggleBtn.textContent = visible ? 'View Available Coupons' : 'Hide Coupons';
    });
  }

  document.querySelectorAll('.btn-apply-coupon').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.dataset.couponCode;
      const input = document.getElementById('couponCode');
      if (input) {
        input.value = code;
        document.getElementById('applyCouponBtn').click();
      }
    });
  });

  document.querySelectorAll('[data-close-modal]').forEach(button => {
    button.addEventListener('click', closeModal);
  });

  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const selectedAddressId = selectedAddressInput.value;
    const paymentMethod = paymentMethodSelect.value;
    const hasAddresses = document.querySelectorAll('.info-card').length > 0;

    if (hasAddresses && !selectedAddressId) {
      const errorElement = document.getElementById('addressError');
      if (errorElement) {
        errorElement.style.display = 'block';
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    if (!paymentMethod) {
      alert('Please select a payment method.');
      return;
    }

    form.querySelector('input[name="paymentMethod"]').value = paymentMethod;

    if (paymentMethod === 'Online') {
      const totalAmountElement = document.querySelector('.sales-table tr:last-child td:last-child');
      if (!totalAmountElement) {
        alert('Unable to process payment. Please refresh and try again.');
        return;
      }

      const totalAmount = parseFloat(totalAmountElement.textContent.replace('₹', '').replace(/,/g, ''));

      if (isNaN(totalAmount) || totalAmount <= 0) {
        alert('Invalid total amount. Please refresh and try again.');
        return;
      }

      try {
        submitButton.disabled = true;
        submitButton.textContent = 'Processing...';

        const response = await fetch('/create-order', { 
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ amount: totalAmount, addressId: selectedAddressId }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          alert(data.error || 'Failed to initiate payment');
          submitButton.disabled = false;
          submitButton.textContent = 'Place Order';
          return;
        }

        if (typeof Razorpay === 'undefined') {
          alert('Payment system is not loaded. Please refresh the page and try again.');
          submitButton.disabled = false;
          submitButton.textContent = 'Place Order';
          return;
        }

        const options = {
          key: window.RAZORPAY_KEY || data.order.key_id,
          amount: data.order.amount,
          currency: data.order.currency,
          order_id: data.order.id,
          handler: function (response) {
            window.location.href = `/order/success?payment_id=${response.razorpay_payment_id}&order_id=${response.razorpay_order_id}`;
          },
          prefill: {
            name: window.USER_NAME || 'Customer',
            email: window.USER_EMAIL || '',
          },
          theme: { color: '#28a745' },
          modal: {
            ondismiss: function () {
              submitButton.disabled = false;
              submitButton.textContent = 'Place Order';
            },
            escape: true,
            backdropclose: false
          },
        };

        const rzp = new Razorpay(options);
        rzp.open();
      } catch (err) {
        console.error('Razorpay fetch error:', err);
        alert('Payment initiation failed. Please try again.');
        submitButton.disabled = false;
        submitButton.textContent = 'Place Order';
      }
    } else {
      try {
        submitButton.disabled = true;
        submitButton.textContent = 'Processing...';

        const response = await fetch('/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            addressId: selectedAddressId,
            paymentMethod,
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          window.location.href = data.redirect;
        } else {
          alert(data.error || 'Failed to place order. Please try again.');
          submitButton.disabled = false;
          submitButton.textContent = 'Place Order';
        }
      } catch (err) {
        alert('Failed to place order. Please try again.');
        submitButton.disabled = false;
        submitButton.textContent = 'Place Order';
      }
    }
  });

  const applyCouponBtn = document.getElementById('applyCouponBtn');
  if (applyCouponBtn) {
    applyCouponBtn.addEventListener('click', async () => {
      const couponCode = document.getElementById('couponCode').value.trim();
      if (!couponCode) {
        alert('Please enter a coupon code');
        return;
      }

      applyCouponBtn.disabled = true;
      applyCouponBtn.textContent = 'Applying...';

      try {
        const response = await fetch('/checkout/apply-coupon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: couponCode })
        });
        const data = await response.json();

        if (data.success) {
          const couponSection = document.querySelector('.order-summary div:nth-child(2)');
          if (couponSection) {
            const existingCouponInfo = couponSection.querySelector('p');
            if (existingCouponInfo) {
              existingCouponInfo.remove();
            }
            
            couponSection.innerHTML += `
              <p>Applied Coupon: ${data.coupon.code} (${data.coupon.discount}% off)
                <button id="removeCouponBtn" class="btn-secondary">Remove</button>
              </p>`;
          }
          
          location.reload();
          document.getElementById('couponCode').value = '';
          addRemoveCouponListener();
          
        } else {
          alert(data.message || 'Failed to apply coupon');
        }
      } catch (error) {
        console.error('Error applying coupon:', error);
        alert('Failed to apply coupon. Please try again.');
      } finally {
        applyCouponBtn.disabled = false;
        applyCouponBtn.textContent = 'Apply Coupon';
      }
    });
  }

  function addRemoveCouponListener() {
    const removeBtn = document.getElementById('removeCouponBtn');
    if (removeBtn) {
      removeBtn.addEventListener('click', async () => {
        removeBtn.disabled = true;
        removeBtn.textContent = 'Removing...';

        try {
          const response = await fetch('/checkout/remove-coupon', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          const data = await response.json();

          if (data.success) {
            location.reload();
          } else {
            alert(data.message || 'Failed to remove coupon');
            removeBtn.disabled = false;
            removeBtn.textContent = 'Remove';
          }
        } catch (error) {
          console.error('Error removing coupon:', error);
          alert('Failed to remove coupon. Please try again.');
          removeBtn.disabled = false;
          removeBtn.textContent = 'Remove';
        }
      });
    }
  }

  addRemoveCouponListener();

  const addressForm = document.getElementById('addressForm');
  if (addressForm) {
    addressForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(addressForm);
      const action = addressForm.action;

      try {
        const response = await fetch(action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.fromEntries(formData))
        });

        const data = await response.json();
        if (data.success) {
          window.location.reload();
        } else {
          alert(data.message || 'Failed to save address');
        }
      } catch (error) {
        console.error('Error saving address:', error);
        alert('Failed to save address. Please try again.');
      }
    });
  }

  document.addEventListener('click', function(event) {
    const modal = document.getElementById('addressModal');
    if (modal && event.target === modal) {
      closeModal();
    }
  });
});