// Cart functionality with AJAX updates
document.addEventListener('DOMContentLoaded', function() {
  // Add event listeners to quantity buttons
  const qtyButtons = document.querySelectorAll('.qty-btn');
  qtyButtons.forEach(button => {
    button.addEventListener('click', handleQuantityChange);
  });
});

async function handleQuantityChange(event) {
  const button = event.target;
  const itemId = button.dataset.itemId;
  const change = parseInt(button.dataset.change);
  const cartItem = button.closest('.cart-item');
  const quantityInput = cartItem.querySelector('.quantity-input');
  const loadingSpinner = cartItem.querySelector('.loading-spinner');
  const increaseBtn = cartItem.querySelector('.increase-btn');
  const decreaseBtn = cartItem.querySelector('.decrease-btn');
  const itemSubtotalElement = cartItem.querySelector('.item-subtotal');

  // Show loading state
  showLoadingState(cartItem, true);
  
  try {
    const response = await fetch(`/cart/update/${itemId}`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ change })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // Update the UI with new values
      updateCartUI(cartItem, data.data);
      
      // Show success feedback
      showToast('Quantity updated successfully', 'success');
    } else {
      // Show error message
      await Swal.fire({
        icon: 'error',
        title: 'Update Failed',
        text: data.error || 'Could not update quantity.',
        timer: 3000,
        showConfirmButton: false
      });
    }
  } catch (error) {
    console.error('Update error:', error);
    await Swal.fire({
      icon: 'error',
      title: 'Something Went Wrong',
      text: 'Network error. Please try again later.',
      timer: 3000,
      showConfirmButton: false
    });
  } finally {
    // Hide loading state
    showLoadingState(cartItem, false);
  }
}

function updateCartUI(cartItem, data) {
  const quantityInput = cartItem.querySelector('.quantity-input');
  const itemSubtotalElement = cartItem.querySelector('.item-subtotal');
  const increaseBtn = cartItem.querySelector('.increase-btn');
  const decreaseBtn = cartItem.querySelector('.decrease-btn');
  
  // Update quantity display
  quantityInput.value = data.newQuantity;
  
  // Update item subtotal
  itemSubtotalElement.textContent = data.itemSubtotal;
  
  // Update cart totals
  document.getElementById('total-items').textContent = data.totalItems;
  document.getElementById('cart-total').textContent = data.cartTotal;
  
  // Update button states
  updateButtonStates(cartItem, data.newQuantity, data.maxAllowed);
}

function updateButtonStates(cartItem, currentQuantity, maxAllowed) {
  const increaseBtn = cartItem.querySelector('.increase-btn');
  const decreaseBtn = cartItem.querySelector('.decrease-btn');
  
  // Update decrease button
  if (currentQuantity <= 1) {
    decreaseBtn.disabled = true;
    decreaseBtn.title = 'Minimum quantity reached';
  } else {
    decreaseBtn.disabled = false;
    decreaseBtn.title = '';
  }
  
  // Update increase button
  if (currentQuantity >= maxAllowed) {
    increaseBtn.disabled = true;
    const limitReason = maxAllowed < 5 ? 'Stock limit reached' : 'Maximum limit (5) reached';
    increaseBtn.title = limitReason;
  } else {
    increaseBtn.disabled = false;
    increaseBtn.title = '';
  }
}

function showLoadingState(cartItem, isLoading) {
  const loadingSpinner = cartItem.querySelector('.loading-spinner');
  const qtyButtons = cartItem.querySelectorAll('.qty-btn');
  
  if (isLoading) {
    // Show spinner and disable buttons
    if (loadingSpinner) loadingSpinner.style.display = 'inline-block';
    qtyButtons.forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = '0.6';
    });
  } else {
    // Hide spinner and re-enable buttons based on their state
    if (loadingSpinner) loadingSpinner.style.display = 'none';
    qtyButtons.forEach(btn => {
      btn.style.opacity = '1';
      // Don't automatically enable - let updateButtonStates handle this
    });
  }
}

function showToast(message, type = 'success') {
  // Create a simple toast notification
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#28a745' : '#dc3545'};
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    z-index: 10000;
    font-size: 14px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    transform: translateX(100%);
    transition: transform 0.3s ease;
  `;
  
  document.body.appendChild(toast);
  
  // Animate in
  setTimeout(() => {
    toast.style.transform = 'translateX(0)';
  }, 100);
  
  // Remove after 3 seconds
  setTimeout(() => {
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

// Legacy function for remove functionality (keeping existing implementation)
function removeFromCart(cartItemId) {
  Swal.fire({
    title: 'Are you sure?',
    text: 'Do you want to remove this item from the cart?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Yes, remove it!'
  }).then((result) => {
    if (result.isConfirmed) {
      fetch(`/cart/remove/${cartItemId}`, { method: 'DELETE' })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            // Update navbar cart count instantly if helper exists
            if (window.updateNavbarCounts && typeof data.cartCount !== 'undefined') {
              window.updateNavbarCounts({ cartCount: data.cartCount });
            }
            Swal.fire('Removed!', 'Item has been removed from cart.', 'success')
              .then(() => window.location.reload());
          } else {
            Swal.fire('Error', data.error || 'Remove failed.', 'error');
          }
        })
        .catch((err) => {
          console.error('Remove error:', err);
          Swal.fire('Error', 'Something went wrong. Please try again later.', 'error');
        });
    }
  });
}

// Legacy function for backward compatibility (now using new implementation)
async function updateCartQuantity(cartItemId, change) {
  // Find the button that corresponds to this action
  const cartItem = document.querySelector(`[data-item-id="${cartItemId}"]`);
  if (!cartItem) {
    console.error('Cart item not found');
    return;
  }
  
  const button = cartItem.querySelector(`[data-change="${change}"]`);
  if (button) {
    // Trigger the new event handler
    await handleQuantityChange({ target: button });
  }
}