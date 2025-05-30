function selectAddress(addressId) {
  document.getElementById('selectedAddressId').value = addressId;

  document.querySelectorAll('.info-card').forEach(card => {
    card.classList.remove('selected');
  });

  const selectedCard = document.querySelector(`[data-address-id="${addressId}"]`);
  if (selectedCard) {
    selectedCard.classList.add('selected');
  }

  const errorElement = document.getElementById('addressError');
  if (errorElement) {
    errorElement.style.display = 'none';
  }
}

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

function closeModal() {
  const modal = document.getElementById('editAddressModal');
  modal.classList.remove('show');
  modal.classList.add('hidden');
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.visibility = 'visible';
  toast.style.opacity = '1';

  setTimeout(() => {
    toast.style.visibility = 'hidden';
    toast.style.opacity = '0';
  }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
  const editBtn = document.querySelector('.edit-address-btn');
  editBtn.addEventListener('click', () => {
    const modal = document.getElementById('editAddressModal');
    modal.classList.remove('hidden');
    modal.classList.add('show');
  });

  const urlParams = new URLSearchParams(window.location.search);
  const msg = urlParams.get('msg');
  if (msg) {
    showToast(msg);
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});

document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('checkoutForm');
  
  if (form) {
    form.addEventListener('submit', function(e) {
      const selectedAddressId = document.getElementById('selectedAddressId').value;
      const paymentMethod = document.querySelector('select[name="paymentMethod"]').value;
      
      const hasAddresses = document.querySelectorAll('.info-card').length > 0;
      if (hasAddresses && !selectedAddressId) {
        e.preventDefault();
        const errorElement = document.getElementById('addressError');
        if (errorElement) {
          errorElement.style.display = 'block';
          errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return false;
      }
      
      if (!paymentMethod) {
        e.preventDefault();
        alert('Please select a payment method.');
        return false;
      }
      
      const submitButton = document.querySelector('.checkout-btn');
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Processing...';
      }
    });
  }
});