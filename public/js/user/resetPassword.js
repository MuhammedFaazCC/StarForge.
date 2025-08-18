document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form');
    const password = document.getElementById('password');
    const confirmPassword = document.getElementById('confirmPassword');

    form.addEventListener('submit', (e) => {
        if (password.value !== confirmPassword.value) {
            e.preventDefault();
            Swal.fire({
              icon: 'error',
              title: 'Password Mismatch',
              text: 'Passwords do not match',
              confirmButtonText: 'OK',
              confirmButtonColor: '#d33'
            });
        }
    });
});
