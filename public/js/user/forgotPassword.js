document.addEventListener('DOMContentLoaded', () => {
    const emailInput = document.querySelector('input[name="email"]');
    const feedback = document.getElementById('email-feedback');

    if (emailInput) {
        emailInput.addEventListener('input', () => {
            const emailPattern = /^\S+@\S+\.\S+$/;
            if (!emailPattern.test(emailInput.value)) {
                emailInput.classList.add('invalid');
                feedback.textContent = "Please enter a valid email address";
                feedback.style.display = 'block';
            } else {
                emailInput.classList.remove('invalid');
                feedback.textContent = "";
                feedback.style.display = 'none';
            }
        });
    }
});
