document.addEventListener('DOMContentLoaded', () => {
    const otpInput = document.getElementById('otp');

    if (otpInput) {
        otpInput.addEventListener('input', () => {
            const otpPattern = /^[0-9]{0,6}$/;
            if (!otpPattern.test(otpInput.value)) {
                otpInput.style.border = '1px solid #ff4444';
                otpInput.value = otpInput.value.slice(0, 6).replace(/[^0-9]/g, '');
            } else {
                otpInput.style.border = '1px solid #ddd';
            }
        });
    }
});