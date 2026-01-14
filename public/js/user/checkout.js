function selectAddress(addressId) {
  const selectedCard = document.querySelector(`[data-address-id="${addressId}"]`);
  const hiddenInput = document.getElementById('selectedAddressId');
  const errorElement = document.getElementById('addressSelectError');
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
        Swal.fire({
          icon: 'error',
          title: 'Address Selection Failed',
          text: data.message || 'Failed to select address. Please try again.',
          confirmButtonText: 'OK',
          confirmButtonColor: '#d33'
        });
        
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
      Swal.fire({
        icon: 'error',
        title: 'Address Selection Error',
        text: 'Failed to select address. Please try again.',
        confirmButtonText: 'OK',
        confirmButtonColor: '#d33'
      });
      
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
            form.querySelector('#phone').value = data.address.phone || '';
            form.querySelector('#address').value = data.address.address;
            form.querySelector('#district').value = data.address.district;
            form.querySelector('#state').value = data.address.state;
            form.querySelector('#city').value = data.address.city;
            form.querySelector('#pinCode').value = data.address.pinCode;
          } else {
            Swal.fire({
              icon: 'error',
              title: 'Address Load Failed',
              text: data.message || 'Failed to load address details.',
              confirmButtonText: 'OK',
              confirmButtonColor: '#d33'
            });
          }
        })
        .catch(error => {
          console.error('Error fetching address:', error);
          Swal.fire({
            icon: 'error',
            title: 'Address Load Error',
            text: 'Failed to load address details. Please try again.',
            confirmButtonText: 'OK',
            confirmButtonColor: '#d33'
          });
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
    resetAddressForm();
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

  // Enforce COD availability rule after summary updates
  enforceCODRule();
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

// Enforce COD rule based on current grand total
function enforceCODRule() {
  const paymentMethodSelect = document.getElementById('paymentMethod');
  if (!paymentMethodSelect) return;

  const codOption = paymentMethodSelect.querySelector('option[value="COD"]');
  const grandTotalElement = document.getElementById('grandTotalAmount');
  let total = 0;
  if (grandTotalElement) {
    const text = grandTotalElement.textContent || '';
    total = parseFloat(text.replace('₹', '').replace(/,/g, '')) || 0;
  } else {
    const initial = paymentMethodSelect.getAttribute('data-initial-grandtotal');
    total = parseFloat(initial) || 0;
  }

  const shouldDisableCOD = total > 1000;

  if (codOption) {
    const wasDisabled = codOption.disabled;
    codOption.disabled = shouldDisableCOD;

    // If COD was selected and becomes invalid, reset selection and warn
    if (shouldDisableCOD && paymentMethodSelect.value === 'COD') {
      paymentMethodSelect.value = '';
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'info',
          title: 'COD Not Available',
          text: 'Cash on Delivery is available only for orders up to ₹1,000. Please choose another payment method.',
          confirmButtonText: 'OK',
          confirmButtonColor: '#0d6efd'
        });
      }
    }
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
      resetAddressForm();
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
      resetAddressForm();

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

  // Enforce COD rule on initial load
  enforceCODRule();

  document.querySelectorAll('[data-close-modal]').forEach(button => {
    button.addEventListener('click', closeModal);
  });

  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const selectedAddressId = selectedAddressInput.value;
    const paymentMethod = paymentMethodSelect.value;

    const action = form.action;
    console.log(form.action);

    const hasAddresses = document.querySelectorAll('.info-card').length > 0;

    if (hasAddresses && !selectedAddressId) {
      const errorElement = document.getElementById('addressSelectError');
      if (errorElement) {
        errorElement.style.display = 'block';
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    if (!paymentMethod) {
      Swal.fire({
        icon: 'warning',
        title: 'Payment Method Required',
        text: 'Please select a payment method.',
        confirmButtonText: 'OK',
        confirmButtonColor: '#ffc107'
      });
      return;
    }

    form.querySelector('input[name="paymentMethod"]').value = paymentMethod;

    if (paymentMethod === 'Online') {
      const totalAmountElement = document.getElementById('grandTotalAmount');
      if (!totalAmountElement) {
        Swal.fire({
          icon: 'error',
          title: 'Payment Processing Error',
          text: 'Unable to process payment. Please refresh and try again.',
          confirmButtonText: 'OK',
          confirmButtonColor: '#d33'
        });
        return;
      }

      const totalAmount = parseFloat(totalAmountElement.textContent.replace('₹', '').replace(/,/g, ''));

      if (isNaN(totalAmount) || totalAmount <= 0) {
        Swal.fire({
          icon: 'error',
          title: 'Invalid Amount',
          text: 'Invalid total amount. Please refresh and try again.',
          confirmButtonText: 'OK',
          confirmButtonColor: '#d33'
        });
        return;
      }

      try {
        submitButton.disabled = true;
        submitButton.textContent = 'Processing...';

        // For online payments, create Razorpay order first
        const response = await fetch('/checkout/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({addressId: selectedAddressId, paymentMethod: paymentMethod})

        });

        const data = await response.json();

        if (!response.ok || !data.success || !data.order) {
          Swal.fire({
            icon: 'error',
            title: 'Payment Initiation Failed',
            text: data.error || 'Failed to initiate payment',
            confirmButtonText: 'OK',
            confirmButtonColor: '#d33'
          });
          submitButton.disabled = false;
          submitButton.textContent = 'Place Order';
          return;
        }

        if (typeof Razorpay === 'undefined') {
          Swal.fire({
            icon: 'error',
            title: 'System Error',
            text: 'Payment system is not loaded. Please refresh the page and try again.',
            confirmButtonText: 'OK',
            confirmButtonColor: '#d33'
          });
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
        Swal.fire({
          icon: 'error',
          title: 'Payment Initiation Failed',
          text: 'Payment initiation failed. Please try again.',
          confirmButtonText: 'OK',
          confirmButtonColor: '#d33'
        });
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
          Swal.fire({
            icon: 'error',
            title: 'Order Failed',
            text: data.error || 'Failed to place order. Please try again.',
            confirmButtonText: 'OK',
            confirmButtonColor: '#d33'
          });
          submitButton.disabled = false;
          submitButton.textContent = 'Place Order';
        }
      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: 'Order Error',
          text: 'Failed to place order. Please try again.',
          confirmButtonText: 'OK',
          confirmButtonColor: '#d33'
        });
        submitButton.disabled = false;
        submitButton.textContent = 'Place Order';
      }
    }
  });

  // Address Form Validation System
  const addressForm = document.getElementById('addressForm');
  if (addressForm) {
    const submitButton = addressForm.querySelector('button[type="submit"]');

    function resetAddressForm() {
        // Reset tracking
        hasAttemptedSubmit = false;
        for (const key in fieldTouched) {
            fieldTouched[key] = false;
        }

        // Clear errors and classes
        Object.keys(validationRules).forEach(fieldName => {
            const field = document.getElementById(fieldName);
            const errorElement = document.getElementById(fieldName + "Error");

            if (field) {
                field.classList.remove("error");
                field.classList.remove("valid");
            }

            if (errorElement) {
                errorElement.textContent = "";
            }
        });
    }

    let hasAttemptedSubmit = false;
    const fieldTouched = {};
    
    // Validation rules
    const validationRules = {
      name: {
        required: true,
        minLength: 2,
        pattern: /^[a-zA-Z\s]+$/,
        message: 'Name must contain only letters and spaces (minimum 2 characters)'
      },
      phone: {
        required: true,
        pattern: /^[6-9]\d{9}$/,
        message: 'Phone number must be 10 digits starting with 6, 7, 8, or 9'
      },
      address: {
        required: true,
        minLength: 10,
        message: 'Address must be at least 10 characters long'
      },
      district: {
        required: true,
        minLength: 2,
        pattern: /^[a-zA-Z\s]+$/,
        message: 'District must contain only letters and spaces (minimum 2 characters)'
      },
      state: {
        required: true,
        minLength: 2,
        pattern: /^[a-zA-Z\s]+$/,
        message: 'State must contain only letters and spaces (minimum 2 characters)'
      },
      city: {
        required: true,
        minLength: 2,
        pattern: /^[a-zA-Z\s]+$/,
        message: 'City must contain only letters and spaces (minimum 2 characters)'
      },
      pinCode: {
        required: true,
        pattern: /^[1-9][0-9]{5}$/,
        message: 'Pin code must be 6 digits and cannot start with 0'
      }
    };

    // Validate individual field
    function validateField(fieldName, value) {
      const rules = validationRules[fieldName];
      if (!rules) return { isValid: true, message: '' };

      // Check required
      if (rules.required && (!value || value.trim() === '')) {
        return { isValid: false, message: `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required` };
      }

      // Check minimum length
      if (rules.minLength && value.trim().length < rules.minLength) {
        return { isValid: false, message: rules.message };
      }

      // Check pattern
      if (rules.pattern && !rules.pattern.test(value.trim())) {
        return { isValid: false, message: rules.message };
      }

      return { isValid: true, message: '' };
    }

    // Display error message
    function showError(fieldName, message) {
      const field = document.getElementById(fieldName);
      const errorElement = document.getElementById(fieldName + 'Error');
      
      if (field) {
        field.classList.add('error');
        field.classList.remove('valid');
      }
      
      if (errorElement) {
        errorElement.textContent = message;
      }
    }

    // Clear error message
    function clearError(fieldName) {
      const field = document.getElementById(fieldName);
      const errorElement = document.getElementById(fieldName + 'Error');
      
      if (field) {
        field.classList.remove('error');
        field.classList.add('valid');
      }
      
      if (errorElement) {
        errorElement.textContent = '';
      }
    }

    // Validate all fields
    function validateAllFields() {
      let isFormValid = true;
      const formData = new FormData(addressForm);

      for (const [fieldName] of formData.entries()) {
        const value = formData.get(fieldName);
        const validation = validateField(fieldName, value);

        const shouldShowError = hasAttemptedSubmit || fieldTouched[fieldName];

        if (!validation.isValid) {
          if (shouldShowError) showError(fieldName, validation.message);
          isFormValid = false;
        } else {
          if (shouldShowError) clearError(fieldName);
        }
      }

      return isFormValid;
    }

    // Add real-time validation to all form fields
    Object.keys(validationRules).forEach(fieldName => {
      const field = document.getElementById(fieldName);
      if (field) {
        // Validate on blur
        field.addEventListener('blur', () => {
          fieldTouched[fieldName] = true; // enable validation for this field only

          const validation = validateField(fieldName, field.value);
          if (!validation.isValid) {
            showError(fieldName, validation.message);
          } else {
            clearError(fieldName);
          }
        });

        // Clear errors on input
        field.addEventListener('input', () => {
          if (!fieldTouched[fieldName] && !hasAttemptedSubmit) return;

          const validation = validateField(fieldName, field.value);
          if (validation.isValid) {
            clearError(fieldName);
          }
        });
      }
    });

    // Handle form submission
    addressForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      hasAttemptedSubmit = true;
      
      // Validate all fields before submission
      if (!validateAllFields()) {
        return;
      }

      const formData = new FormData(addressForm);

      if (addressForm.dataset.addressId) {
        formData.append("_id", addressForm.dataset.addressId);
      }

      const action = addressForm.action;

      const submitBtn = e.target.querySelector('button[type="submit"]');
      
      // Disable submit button and show loading state
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
      }

      try {
        // Build payload from form fields
        const payload = {
          name: formData.get('name')?.trim() || '',
          phone: formData.get('phone')?.trim() || '',
          address: formData.get('address')?.trim() || '',
          district: formData.get('district')?.trim() || '',
          state: formData.get('state')?.trim() || '',
          city: formData.get('city')?.trim() || '',
          pinCode: formData.get('pinCode')?.trim() || ''
        };

        const response = await fetch(action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
          const data = await response.json();
          if (data.success) {
            window.location.reload();
            return;
          }

          if (data.errors && typeof data.errors === 'object') {
            Object.keys(data.errors).forEach(fieldName => {
              showError(fieldName, data.errors[fieldName]);
            });
          } else {
            Swal.fire({
              icon: 'error',
              title: 'Address Save Failed',
              text: data.message || 'Failed to save address',
              confirmButtonText: 'OK',
              confirmButtonColor: '#d33'
            });
          }
        } else {
          // Non-JSON response (likely a redirect from server). Treat as success.
          if (response.ok || response.redirected) {
            window.location.reload();
            return;
          }

          // Fallback error if not ok
          Swal.fire({
            icon: 'error',
            title: 'Address Save Failed',
            text: 'Failed to save address. Please try again.',
            confirmButtonText: 'OK',
            confirmButtonColor: '#d33'
          });
        }
      } catch (error) {
        console.error('Error saving address:', error);
        Swal.fire({
          icon: 'error',
          title: 'Address Save Error',
          text: 'Failed to save address. Please try again.',
          confirmButtonText: 'OK',
          confirmButtonColor: '#d33'
        });
      } finally {
        // Re-enable submit button
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Save Changes';
        }
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