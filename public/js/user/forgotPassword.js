document.addEventListener('DOMContentLoaded', () => {
    const emailInput = document.querySelector('input[name="email"]');

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
});