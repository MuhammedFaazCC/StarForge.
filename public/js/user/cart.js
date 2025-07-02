async function updateCartQuantity(cartItemId, change) {
  try {
    const res = await fetch(`/cart/update/${cartItemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ change })
    });

    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new Error('Invalid server response — check if route exists');
    }

    if (res.ok && data.success) {
      location.reload();
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Update Failed',
        text: data.error || 'Could not update quantity.',
      });
    }
  } catch (err) {
    console.error('Update error:', err);
    Swal.fire({
      icon: 'error',
      title: 'Something Went Wrong',
      text: err.message || 'Try again later.',
    });
  }
}

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