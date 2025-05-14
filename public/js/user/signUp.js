function togglePassword(fieldId) {
    const input = document.getElementById(fieldId);
    const icon = document.querySelector(`#${fieldId}-toggle i`);
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
    const mobileInput = document.querySelector('input[name="mobile"]');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password');

    if (emailInput) {
        emailInput.addEventListener('input', () => {
            const emailPattern = /^\S+@\S+\.\S+$/;
            if (!emailPattern.test(emailInput.value)) {
                emailInput.style.border = '1px solid #ff4444';
            } else {
                emailInput.style.border = '1px solid #ddd';
            }
        });
    }

    if (mobileInput) {
        mobileInput.addEventListener('input', () => {
            const mobilePattern = /^[0-9]{10}$/;
            if (!mobilePattern.test(mobileInput.value)) {
                mobileInput.style.border = '1px solid #ff4444';
            } else {
                mobileInput.style.border = '1px solid #ddd';
            }
        });
    }

    if (passwordInput && confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', () => {
            if (confirmPasswordInput.value !== passwordInput.value) {
                confirmPasswordInput.style.border = '1px solid #ff4444';
            } else {
                confirmPasswordInput.style.border = '1px solid #ddd';
            }
        });
    }
});