function togglePassword() {
    const input = document.getElementById('password');
    const icon = document.querySelector('.toggle-password i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

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