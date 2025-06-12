document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.querySelector('.navbar .fa-bars');
  const sidebar = document.querySelector('.sidebar');

  if (!hamburger || !sidebar) {
    console.error('Hamburger menu or sidebar not found in the DOM');
    return;
  }

  hamburger.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    const isOpen = sidebar.classList.contains('open');
    sidebar.setAttribute('aria-hidden', !isOpen);
  });
});

document.querySelectorAll('.add-to-cart-btn').forEach(button => {
  button.addEventListener('click', function (e) {
    e.preventDefault();
    const productId = this.getAttribute('data-product-id');

    fetch(`/cart/add/${productId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 1, source: 'wishlist' })
    })
      .then(res => {
        if (res.redirected) {
          window.location.href = res.url;
        }
      });
  });
});