document.addEventListener('DOMContentLoaded', () => {
  initializeWishlistHandlers();
});

function initializeWishlistHandlers() {
  document.querySelectorAll('.move-to-cart-btn').forEach(button => {
    button.addEventListener('click', handleMoveToCart);
  });

  document.querySelectorAll('.remove-from-wishlist-btn').forEach(button => {
    button.addEventListener('click', handleRemoveFromWishlist);
  });

  document.querySelectorAll('.wishlist-icon-btn').forEach(button => {
    button.addEventListener('click', handleWishlistIconClick);
  });
}

async function handleMoveToCart(e) {
  e.preventDefault();
  
  const button = e.currentTarget;
  const productId = button.getAttribute('data-product-id');
  const productName = button.getAttribute('data-product-name');
  
  if (!productId) {
    console.error('Product ID not found');
    return;
  }

  const originalContent = button.innerHTML;
  button.disabled = true;
  button.classList.add('loading');
  button.innerHTML = '<i class="bi bi-arrow-repeat"></i> Moving...';

  try {
    const response = await fetch(`/cart/add/${productId}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        quantity: 1,
        source: 'wishlist'
      })
    });

    const data = await response.json();

    if (response.status === 401 || data.redirect) {
      window.location.href = data.redirect || '/login';
      return;
    }

    if (data.success) {
      await Swal.fire({
        icon: 'success',
        title: 'Moved to Cart!',
        text: `${productName} has been moved to your cart`,
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });

      const productCard = button.closest('.col');
      if (productCard) {
        productCard.querySelector('.product-card').classList.add('removing');
        setTimeout(() => {
          productCard.remove();
          updateWishlistCount();
          checkEmptyWishlist();
        }, 300);
      }
      if (window.updateNavbarCounts) {
        window.updateNavbarCounts({ cartCount: data.cartCount, wishlistCount: data.wishlistCount });
      }
    } else {
      let errorTitle = 'Error';
      let errorText = data.message || 'Failed to move product to cart';
      
      if (data.outOfStock) {
        errorTitle = 'Out of Stock';
        errorText = data.message || 'This product is currently not available';
      }

      await Swal.fire({
        icon: 'error',
        title: errorTitle,
        text: errorText,
        confirmButtonText: 'OK'
      });
    }
  } catch (error) {
    console.error('Error moving to cart:', error);
    await Swal.fire({
      icon: 'error',
      title: 'Network Error',
      text: 'Something went wrong. Please check your connection and try again.',
      confirmButtonText: 'OK'
    });
  } finally {
    button.disabled = false;
    button.classList.remove('loading');
    button.innerHTML = originalContent;
  }
}

async function handleRemoveFromWishlist(e) {
  e.preventDefault();
  
  const button = e.currentTarget;
  const productId = button.getAttribute('data-product-id');
  const productName = button.getAttribute('data-product-name');
  
  if (!productId) {
    console.error('Product ID not found');
    return;
  }

  const result = await Swal.fire({
    title: 'Remove from Wishlist?',
    text: `Are you sure you want to remove "${productName}" from your wishlist?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Yes, Remove',
    cancelButtonText: 'Cancel',
    confirmButtonColor: '#dc3545',
    cancelButtonColor: '#6c757d',
    reverseButtons: true
  });

  if (!result.isConfirmed) {
    return;
  }

  const originalContent = button.innerHTML;
  button.disabled = true;
  button.classList.add('loading');
  button.innerHTML = '<i class="bi bi-arrow-repeat"></i> Removing...';

  try {
    const response = await fetch('/wishlist/remove', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        productId: productId
      })
    });

    if (response.ok) {
      const data = await response.json();
      await Swal.fire({
        icon: 'success',
        title: 'Removed!',
        text: `${productName} has been removed from your wishlist`,
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });

      const productCard = button.closest('.col');
      if (productCard) {
        productCard.querySelector('.product-card').classList.add('removing');
        setTimeout(() => {
          productCard.remove();
          updateWishlistCount();
          checkEmptyWishlist();
        }, 300);
      }
      if (window.updateNavbarCounts && typeof data.wishlistCount !== 'undefined') {
        window.updateNavbarCounts({ wishlistCount: data.wishlistCount });
      }
    } else {
      throw new Error('Failed to remove from wishlist');
    }
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    await Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to remove item from wishlist. Please try again.',
      confirmButtonText: 'OK'
    });
  } finally {
    button.disabled = false;
    button.classList.remove('loading');
    button.innerHTML = originalContent;
  }
}

async function handleWishlistIconClick(e) {
  e.preventDefault();
  
  const button = e.currentTarget;
  const productId = button.getAttribute('data-product-id');
  
  if (!productId) {
    console.error('Product ID not found');
    return;
  }

  const productCard = button.closest('.product-card');
  const productName = productCard.querySelector('.product-name').textContent;
  
  const result = await Swal.fire({
    title: 'Remove from Wishlist?',
    text: `Are you sure you want to remove "${productName}" from your wishlist?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Yes, Remove',
    cancelButtonText: 'Cancel',
    confirmButtonColor: '#dc3545',
    cancelButtonColor: '#6c757d',
    reverseButtons: true
  });

  if (!result.isConfirmed) {
    return;
  }

  try {
    const response = await fetch('/wishlist/remove', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        productId: productId
      })
    });

    if (response.ok) {
      await Swal.fire({
        icon: 'success',
        title: 'Removed!',
        text: `${productName} has been removed from your wishlist`,
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });

      const productCardContainer = button.closest('.col');
      if (productCardContainer) {
        productCardContainer.querySelector('.product-card').classList.add('removing');
        setTimeout(() => {
          productCardContainer.remove();
          updateWishlistCount();
          checkEmptyWishlist();
        }, 300);
      }
      if (window.updateNavbarCounts && typeof data.wishlistCount !== 'undefined') {
        window.updateNavbarCounts({ wishlistCount: data.wishlistCount });
      }
    } else {
      throw new Error('Failed to remove from wishlist');
    }
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    await Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to remove item from wishlist. Please try again.',
      confirmButtonText: 'OK'
    });
  }
}

function updateWishlistCount() {
  const remainingItems = document.querySelectorAll('.product-card:not(.removing)').length;
  const countBadge = document.querySelector('.badge.bg-primary');
  
  if (countBadge) {
    if (remainingItems > 0) {
      countBadge.textContent = `${remainingItems} item${remainingItems !== 1 ? 's' : ''}`;
    } else {
      countBadge.remove();
    }
  }

  const navbarBadge = document.getElementById('wishlistCount');
  if (navbarBadge) {
    navbarBadge.textContent = String(remainingItems);
  }
}

function checkEmptyWishlist() {
  const remainingItems = document.querySelectorAll('.product-card:not(.removing)').length;
  
  if (remainingItems === 0) {
    setTimeout(() => {
      const wishlistContainer = document.querySelector('.wishlist-container');
      if (wishlistContainer) {
        wishlistContainer.innerHTML = `
          <div class="empty-wishlist text-center py-5">
            <div class="empty-wishlist-icon mb-4">
              <i class="bi bi-heart display-1 text-muted"></i>
            </div>
            <h3 class="text-muted mb-3">Your wishlist is empty</h3>
            <p class="text-muted mb-4">Save items you love to your wishlist and shop them later!</p>
            <a href="/products" class="btn btn-primary btn-lg">
              <i class="bi bi-shop"></i> Continue Shopping
            </a>
          </div>
        `;
      }
    }, 400);
  }
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
  }
});