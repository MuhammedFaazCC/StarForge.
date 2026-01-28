document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('signupForm');
    const formError = document.getElementById('formError');
    const fieldErrors = {
        fullName: document.getElementById('fullNameError'),
        email: document.getElementById('emailError'),
        mobile: document.getElementById('mobileError'),
        password: document.getElementById('passwordError'),
        confirmPassword: document.getElementById('confirmPasswordError'),
        referralCode: document.getElementById('referralCodeError')
    };

    function clearErrors() {
        if (formError) { formError.style.display = 'none'; formError.textContent = ''; }
        Object.values(fieldErrors).forEach(el => { if (el) {el.textContent = '';} });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearErrors();

            const formData = new FormData(form);
            const payload = Object.fromEntries(formData.entries());

            try {
                const res = await fetch(form.action, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if (data.success) {
                    window.location.href = data.redirect || '/login';
                    return;
                }

                // Show field-specific error or top-level error
                if (data.field && fieldErrors[data.field]) {
                    fieldErrors[data.field].textContent = data.message || 'Invalid input';
                    const field = document.querySelector(`[name="${data.field}"]`);
                    if (field) {field.focus();}
                } else if (formError) {
                    formError.textContent = data.message || 'Registration failed';
                    formError.style.display = 'block';
                }
            } catch {
                if (formError) {
                    formError.textContent = 'Server error, try again later';
                    formError.style.display = 'block';
                }
            }
        });
    }

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