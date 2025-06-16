function selectAddress(addressId) {
  const previousSelected = document.querySelector('.info-card.selected');
  const selectedCard = document.querySelector(`[data-address-id="${addressId}"]`);
  const hiddenInput = document.getElementById('selectedAddressId');
  const errorElement = document.getElementById('addressError');

    if (previousSelected) {
    previousSelected.classList.remove('selected');
  }
  if (selectedCard) {
    selectedCard.classList.add('selected');
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
        if (previousSelected) {
          previousSelected.classList.add('selected');
        }
        if (hiddenInput) {
          hiddenInput.value = previousSelected ? previousSelected.dataset.addressId : '';
        }
      }
    })
    .catch(error => {
      console.error('Error selecting address:', error);
      alert('Failed to select address. Please try again.');
      if (selectedCard) {
        selectedCard.classList.remove('selected');
      }
      if (previousSelected) {
        previousSelected.classList.add('selected');
      }
      if (hiddenInput) {
        hiddenInput.value = previousSelected ? previousSelected.dataset.addressId : '';
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

  document.querySelectorAll('[data-select-address]').forEach(button => {
    button.addEventListener('click', () => {
      const addressId = button.dataset.selectAddress;
      selectAddress(addressId);
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

  document.querySelectorAll('[data-close-modal]').forEach(button => {
    button.addEventListener('click', closeModal);
  });

  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    
    const selectedAddressId = document.getElementById('selectedAddressId').value;
    const paymentMethod = paymentMethodSelect.value;
    const hasAddresses = document.querySelectorAll('.info-card').length > 0;

    if (hasAddresses && !selectedAddressId) {
      const errorElement = document.getElementById('addressError');
      if (errorElement) {
        errorElement.style.display = 'block';
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return false;
    }

    if (!paymentMethod) {
      alert('Please select a payment method.');
      return false;
    }

    form.querySelector('input[name="paymentMethod"]').value = paymentMethod;

    if (paymentMethod === 'Online') {
      const totalAmountElement = document.querySelector('.sales-table tr:last-child td:last-child');
      if (!totalAmountElement) {
        alert('Unable to process payment. Please refresh and try again.');
        return false;
      }

      const totalAmount = parseFloat(
        totalAmountElement.textContent.replace('₹', '').replace(/,/g, '')
      );

      if (isNaN(totalAmount) || totalAmount <= 0) {
        alert('Invalid total amount. Please refresh and try again.');
        return false;
      }

      try {
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = 'Processing...';
        }

        const response = await fetch('/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            amount: totalAmount, 
            addressId: selectedAddressId 
          })
        });

        const data = await response.json();
        
        if (!data.success) {
          alert(data.error || 'Failed to initiate payment');
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Place Order';
          }
          return;
        }

        if (typeof Razorpay === 'undefined') {
          alert('Payment system is not loaded. Please refresh the page and try again.');
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Place Order';
          }
          return;
        }

        const options = {
          key: data.order.key_id || window.RAZORPAY_KEY,
          amount: data.order.amount,
          currency: data.order.currency,
          order_id: data.order.id,
          handler: function (response) {
            window.location.href = `/order/success?payment_id=${response.razorpay_payment_id}&order_id=${data.order.id}`;
          },
          prefill: {
            name: window.USER_NAME || 'Customer',
            email: window.USER_EMAIL || ''
          },
          theme: { 
            color: "#28a745" 
          },
          modal: {
            ondismiss: function() {
              if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Place Order';
              }
            }
          }
        };

        const rzp = new Razorpay(options);
        rzp.open();
        
      } catch (err) {
        console.error('Razorpay error:', err);
        alert('Payment initiation failed. Please try again.');
        
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Place Order';
        }
      }

      return false;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Processing...';
    }
    
    form.submit();
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

  // function updatePriceBreakdown(data) {
  //   const breakdownTable = document.querySelector('.sales-table');
  //   if (breakdownTable) {
  //     breakdownTable.innerHTML = `
  //       <tr>
  //         <td>Subtotal</td>
  //         <td>₹${data.subtotal}</td>
  //       </tr>
  //       <tr>
  //         <td>Discount</td>
  //         <td>₹${data.discount}</td>
  //       </tr>
  //       <tr>
  //         <td><strong>Grand Total</strong></td>
  //         <td><strong>₹${data.grandTotal}</strong></td>
  //       </tr>
  //     `;
  //   }
  // }

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