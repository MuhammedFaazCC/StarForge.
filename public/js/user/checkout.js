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

function showCouponMessage(message, isError = false) {
  const messageElement = document.getElementById('couponMessage');
  if (messageElement) {
    messageElement.textContent = message;
    messageElement.style.display = 'block';
    messageElement.style.backgroundColor = isError ? '#ffe6e6' : '#e6ffe6';
    messageElement.style.color = isError ? '#d32f2f' : '#2e7d32';
    messageElement.style.border = `1px solid ${isError ? '#ff9999' : '#99ff99'}`;
    
    // Auto-hide success messages after 3 seconds
    if (!isError) {
      setTimeout(() => {
        messageElement.style.display = 'none';
      }, 3000);
    }
  }
}

function hideCouponMessage() {
  const messageElement = document.getElementById('couponMessage');
  if (messageElement) {
    messageElement.style.display = 'none';
  }
}

function updateOrderSummary(data) {
  // Update the amounts in the table
  const subtotalElement = document.getElementById('subtotalAmount');
  const discountElement = document.getElementById('discountAmount');
  const grandTotalElement = document.getElementById('grandTotalAmount');
  
  if (subtotalElement && data.subtotal) {
    subtotalElement.textContent = `₹${data.subtotal}`;
  }
  if (discountElement && data.discount !== undefined) {
    discountElement.textContent = `₹${data.discount}`;
  }
  if (grandTotalElement && data.grandTotal) {
    grandTotalElement.innerHTML = `<strong>₹${data.grandTotal}</strong>`;
  }
}

function showAppliedCoupon(couponData) {
  const appliedSection = document.getElementById('appliedCouponSection');
  const inputSection = document.getElementById('couponInputSection');
  const appliedText = document.getElementById('appliedCouponText');
  const appliedCouponCode = document.getElementById('appliedCouponCode');
  
  if (appliedSection && inputSection && appliedText) {
    appliedText.innerHTML = `Applied Coupon: ${couponData.code} (${couponData.discount}% off) <button id="removeCouponBtn" class="btn-secondary">Remove</button>`;
    appliedSection.style.display = 'block';
    inputSection.style.display = 'none';
    
    if (appliedCouponCode) {
      appliedCouponCode.value = couponData.code;
    }
    
    // Re-attach remove coupon listener
    addRemoveCouponListener();
  }
}

function showCouponInput() {
  const appliedSection = document.getElementById('appliedCouponSection');
  const inputSection = document.getElementById('couponInputSection');
  const couponCodeInput = document.getElementById('couponCode');
  const appliedCouponCode = document.getElementById('appliedCouponCode');
  
  if (appliedSection && inputSection) {
    appliedSection.style.display = 'none';
    inputSection.style.display = 'block';
    
    if (couponCodeInput) {
      couponCodeInput.value = '';
    }
    
    if (appliedCouponCode) {
      appliedCouponCode.value = '';
    }
  }
}

function applyCoupon(couponCode) {
  const applyCouponBtn = document.getElementById('applyCouponBtn');
  
  if (!couponCode.trim()) {
    showCouponMessage('Please enter a coupon code', true);
    return;
  }

  // Disable button and show loading state
  applyCouponBtn.disabled = true;
  applyCouponBtn.innerHTML = '<span>Applying...</span>';
  hideCouponMessage();
  
  // Also disable coupon buttons in available coupons list
  document.querySelectorAll('.btn-apply-coupon').forEach(btn => {
    btn.disabled = true;
  });

  fetch('/checkout/apply-coupon', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: couponCode })
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Update the order summary
        updateOrderSummary(data);
        
        // Show applied coupon section
        showAppliedCoupon(data.coupon);
        
        // Show success message
        showCouponMessage(`Coupon "${data.coupon.code}" applied successfully! You saved ₹${data.discount}`, false);
        
        // Hide available coupons section
        const availableCouponsSection = document.getElementById('availableCouponsSection');
        if (availableCouponsSection) {
          availableCouponsSection.style.display = 'none';
        }
        
        // Update toggle button text
        const toggleBtn = document.getElementById('toggleCouponListBtn');
        if (toggleBtn) {
          toggleBtn.textContent = 'View Available Coupons';
        }
      } else {
        showCouponMessage(data.message || 'Failed to apply coupon', true);
      }
    })
    .catch(error => {
      console.error('Error applying coupon:', error);
      showCouponMessage('Failed to apply coupon. Please try again.', true);
    })
    .finally(() => {
      // Re-enable buttons
      applyCouponBtn.disabled = false;
      applyCouponBtn.textContent = 'Apply';
      
      // Re-enable coupon buttons in available coupons list
      document.querySelectorAll('.btn-apply-coupon').forEach(btn => {
        btn.disabled = false;
      });
    });
}

function removeCoupon() {
  const removeBtn = document.getElementById('removeCouponBtn');
  
  if (removeBtn) {
    removeBtn.disabled = true;
    removeBtn.textContent = 'Removing...';
  }
  
  hideCouponMessage();

  fetch('/checkout/remove-coupon', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Update the order summary
        updateOrderSummary(data);
        
        // Show coupon input section
        showCouponInput();
        
        // Show success message
        showCouponMessage('Coupon removed successfully', false);
      } else {
        showCouponMessage(data.message || 'Failed to remove coupon', true);
        
        // Re-enable button if failed
        if (removeBtn) {
          removeBtn.disabled = false;
          removeBtn.textContent = 'Remove';
        }
      }
    })
    .catch(error => {
      console.error('Error removing coupon:', error);
      showCouponMessage('Failed to remove coupon. Please try again.', true);
      
      // Re-enable button if failed
      if (removeBtn) {
        removeBtn.disabled = false;
        removeBtn.textContent = 'Remove';
      }
    });
}

function addRemoveCouponListener() {
  const removeBtn = document.getElementById('removeCouponBtn');
  if (removeBtn) {
    // Remove existing listeners to prevent duplicates
    removeBtn.replaceWith(removeBtn.cloneNode(true));
    const newRemoveBtn = document.getElementById('removeCouponBtn');
    
    newRemoveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      removeCoupon();
    });
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

  // Toggle coupon list
  const toggleBtn = document.getElementById('toggleCouponListBtn');
  const couponSection = document.getElementById('availableCouponsSection');
  if (toggleBtn && couponSection) {
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const visible = couponSection.style.display === 'block';
      couponSection.style.display = visible ? 'none' : 'block';
      toggleBtn.textContent = visible ? 'View Available Coupons' : 'Hide Coupons';
    });
  }

  // Apply coupon from available coupons list
  document.querySelectorAll('.btn-apply-coupon').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const code = btn.dataset.couponCode;
      applyCoupon(code);
    });
  });

  // Apply coupon button
  const applyCouponBtn = document.getElementById('applyCouponBtn');
  if (applyCouponBtn) {
    applyCouponBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const couponCode = document.getElementById('couponCode').value.trim();
      applyCoupon(couponCode);
    });
  }

  // Apply coupon on Enter key press
  const couponCodeInput = document.getElementById('couponCode');
  if (couponCodeInput) {
    couponCodeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const couponCode = couponCodeInput.value.trim();
        applyCoupon(couponCode);
      }
    });
  }

  // Initial remove coupon listener
  addRemoveCouponListener();

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
      const totalAmountElement = document.getElementById('grandTotalAmount');
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
            // Payment successful - redirect to success page
            if (response.razorpay_signature) {
              window.location.href = `/order/success?payment_id=${response.razorpay_payment_id}&order_id=${response.razorpay_order_id}&signature=${response.razorpay_signature}`;
            } else {
              window.location.href = `/order/success?payment_id=${response.razorpay_payment_id}&order_id=${response.razorpay_order_id}`;
            }
          },
          prefill: {
            name: window.USER_NAME || 'Customer',
            email: window.USER_EMAIL || '',
          },
          theme: { color: '#28a745' },
          modal: {
            ondismiss: function () {
              // Payment was cancelled or failed - redirect to failure page
              console.log('Payment modal dismissed - payment cancelled or failed');
              window.location.href = `/payment/failure?error=payment_cancelled&orderId=${data.order.id}`;
            },
            escape: true,
            backdropclose: false
          },
        };

        const rzp = new Razorpay(options);
        
        // Handle payment errors
        rzp.on('payment.failed', function (response) {
          console.error('Payment failed:', response.error);
          window.location.href = `/payment/failure?error=payment_failed&orderId=${data.order.id}&referenceId=${response.error.metadata?.payment_id || ''}`;
        });

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