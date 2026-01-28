document.addEventListener('DOMContentLoaded', () => {
    const emailInput = document.querySelector('input[name="email"]');
    emailInput.addEventListener('input', () => {
        const emailPattern = /^\S+@\S+\.\S+$/;
        if (!emailPattern.test(emailInput.value)) {
            emailInput.style.border = '1px solid #ff4444';
        } else {
            emailInput.style.border = '1px solid #ddd';
        }
    });
});

if (performance.navigation.type === 2) {
    location.reload(true);
  }