
    function togglePassword(fieldId) {
      const field = document.getElementById(fieldId);
      const toggle = field.nextElementSibling.querySelector('i');
      
      if (field.type === 'password') {
        field.type = 'text';
        toggle.classList.remove('fa-eye');
        toggle.classList.add('fa-eye-slash');
      } else {
        field.type = 'password';
        toggle.classList.remove('fa-eye-slash');
        toggle.classList.add('fa-eye');
      }
    }

    function checkPasswordStrength(password) {
      let score = 0;
      const requirements = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /\d/.test(password),
        special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
      };

      Object.keys(requirements).forEach(req => {
        const element = document.getElementById(`req-${req}`);
        const icon = element.querySelector('i');
        
        if (requirements[req]) {
          element.classList.add('met');
          icon.classList.remove('fa-times');
          icon.classList.add('fa-check');
          score++;
        } else {
          element.classList.remove('met');
          icon.classList.remove('fa-check');
          icon.classList.add('fa-times');
        }
      });

      const strengthElement = document.getElementById('passwordStrength');
      const strengthText = strengthElement.querySelector('.strength-text');
      
      strengthElement.className = 'password-strength show';
      
      if (score < 3) {
        strengthElement.classList.add('strength-weak');
        strengthText.textContent = 'Weak password';
      } else if (score < 5) {
        strengthElement.classList.add('strength-medium');
        strengthText.textContent = 'Medium password';
      } else {
        strengthElement.classList.add('strength-strong');
        strengthText.textContent = 'Strong password';
      }

      return score >= 4;
    }

    document.addEventListener('DOMContentLoaded', function() {
      const newPasswordField = document.getElementById('newPassword');
      const confirmPasswordField = document.getElementById('confirmPassword');
      const currentPasswordField = document.getElementById('currentPassword');
      const requirementsElement = document.getElementById('passwordRequirements');
      const form = document.getElementById('changePasswordForm');
      const submitBtn = document.getElementById('submitBtn');

      newPasswordField.addEventListener('focus', function() {
        requirementsElement.classList.add('show');
      });

      newPasswordField.addEventListener('blur', function() {
        if (!this.value) {
          requirementsElement.classList.remove('show');
          document.getElementById('passwordStrength').classList.remove('show');
        }
      });

      newPasswordField.addEventListener('input', function() {
        const password = this.value;
        const messageElement = document.getElementById('newPasswordMessage');
        
        if (password) {
          const isStrong = checkPasswordStrength(password);
          
          if (isStrong) {
            this.classList.remove('is-invalid');
            this.classList.add('is-valid');
            messageElement.className = 'validation-message success';
            messageElement.innerHTML = '<i class="fas fa-check"></i> Password meets requirements';
          } else {
            this.classList.remove('is-valid');
            this.classList.add('is-invalid');
            messageElement.className = 'validation-message error';
            messageElement.innerHTML = '<i class="fas fa-times"></i> Password does not meet all requirements';
          }
        } else {
          this.classList.remove('is-valid', 'is-invalid');
          messageElement.textContent = '';
        }

        if (confirmPasswordField.value) {
          validateConfirmPassword();
        }
      });

      function validateConfirmPassword() {
        const password = newPasswordField.value;
        const confirmPassword = confirmPasswordField.value;
        const messageElement = document.getElementById('confirmPasswordMessage');

        if (confirmPassword) {
          if (password === confirmPassword) {
            confirmPasswordField.classList.remove('is-invalid');
            confirmPasswordField.classList.add('is-valid');
            messageElement.className = 'validation-message success';
            messageElement.innerHTML = '<i class="fas fa-check"></i> Passwords match';
          } else {
            confirmPasswordField.classList.remove('is-valid');
            confirmPasswordField.classList.add('is-invalid');
            messageElement.className = 'validation-message error';
            messageElement.innerHTML = '<i class="fas fa-times"></i> Passwords do not match';
          }
        } else {
          confirmPasswordField.classList.remove('is-valid', 'is-invalid');
          messageElement.textContent = '';
        }
      }

      confirmPasswordField.addEventListener('input', validateConfirmPassword);

      form.addEventListener('submit', function(e) {
        e.preventDefault();

        const currentPassword = currentPasswordField.value;
        const newPassword = newPasswordField.value;
        const confirmPassword = confirmPasswordField.value;

        let isValid = true;

        if (!currentPassword) {
          currentPasswordField.classList.add('is-invalid');
          document.getElementById('currentPasswordMessage').className = 'validation-message error';
          document.getElementById('currentPasswordMessage').innerHTML = '<i class="fas fa-times"></i> Current password is required';
          isValid = false;
        }

        if (!checkPasswordStrength(newPassword)) {
          isValid = false;
        }

        if (newPassword !== confirmPassword) {
          isValid = false;
        }

        if (currentPassword === newPassword) {
          newPasswordField.classList.add('is-invalid');
          document.getElementById('newPasswordMessage').className = 'validation-message error';
          document.getElementById('newPasswordMessage').innerHTML = '<i class="fas fa-times"></i> New password must be different from current password';
          isValid = false;
        }

        if (isValid) {
          submitBtn.classList.add('loading');
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Changing Password...';

          this.submit();
        }
      });
    });

    function closeAlert(alertId) {
      const alert = document.getElementById(alertId);
      if (alert) {
        alert.style.opacity = '0';
        alert.style.transform = 'translateY(-10px)';
        setTimeout(() => {
          alert.remove();
        }, 300);
      }
    }

    document.addEventListener('DOMContentLoaded', function() {
      const alerts = document.querySelectorAll('.alert');
      alerts.forEach(alert => {
        setTimeout(() => {
          if (alert.parentNode) {
            closeAlert(alert.id);
          }
        }, 5000);
      });
    });
  