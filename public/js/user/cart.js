async function updateCartQuantity(cartItemId, change) {
  try {
    const res = await fetch(`/user/cart/update/${cartItemId}`, {
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

 function removeFromCart(cartItemId) {
  if (!confirm('Remove this item from cart?')) return;
  console.log(cartItemId,"id")
  try {
     fetch(`/cart/remove/${cartItemId}`, { method: 'DELETE' })
    .then((response)=>response.json())
    .then((data)=>{
      if(data.success){
        window.location.reload()
      }else{
        alert(data.error || 'Remove failed');
      }
    })
    

    
  } catch (err) {
    console.error('Remove error:', err);
    alert('Something went wrong');
  }
}
