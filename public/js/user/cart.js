async function updateCartQuantity(cartItemId, change) {
  try {
    const res = await fetch(`/cart/update/${cartItemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ change })
    });

    const data = await res.json();
    if (data.success) {
      location.reload();
    } else {
      alert(data.error || 'Update failed');
    }
  } catch (err) {
    console.error('Update error:', err);
    alert('Something went wrong');      
  }
}

async function removeFromCart(cartItemId) {
  if (!confirm('Remove this item from cart?')) return;
  try {
    const res = await fetch(`/cart/remove/${cartItemId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      location.reload();
    } else {
      alert(data.error || 'Remove failed');
    }
  } catch (err) {
    console.error('Remove error:', err);
    alert('Something went wrong');
  }
}
