function togglePassword() {
  const passwordInput = document.getElementById("password");
  const toggleText = document.querySelector(".toggle-password");
  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    toggleText.textContent = "Hide";
  } else {
    passwordInput.type = "password";
    toggleText.textContent = "Show";
  }
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function showError(message) {
  const existingError = document.querySelector('.js-error-message');
  if (existingError) {
    existingError.remove();
  }

  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message js-error-message';
  errorDiv.textContent = message;

  const title = document.querySelector('h1');
  title.parentNode.insertBefore(errorDiv, title.nextSibling);

  setTimeout(() => {
    if (errorDiv.parentNode) {
      errorDiv.remove();
    }
  }, 5000);
}

function clearErrors() {
  const errorElements = document.querySelectorAll('.js-error-message');
  errorElements.forEach(error => error.remove());
}

function validateForm(event) {
  event.preventDefault();
  
  clearErrors();
  
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  
  if (!email) {
    showError('Email is required');
    emailInput.focus();
    return false;
  }
  
  if (!validateEmail(email)) {
    showError('Please enter a valid email address');
    emailInput.focus();
    return false;
  }
  
  if (!password) {
    showError('Password is required');
    passwordInput.focus();
    return false;
  }
  
  if (password.length < 6) {
    showError('Password must be at least 6 characters long');
    passwordInput.focus();
    return false;
  }
  
  document.querySelector('form').submit();
  return true;
}

function addInputValidation() {
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  
  emailInput.addEventListener('blur', function() {
    const email = this.value.trim();
    if (email && !validateEmail(email)) {
      this.style.borderColor = '#ff4444';
      this.style.backgroundColor = '#fff5f5';
    } else {
      this.style.borderColor = '#ccc';
      this.style.backgroundColor = '#fff';
    }
  });
  
  passwordInput.addEventListener('blur', function() {
    const password = this.value.trim();
    if (password && password.length < 6) {
      this.style.borderColor = '#ff4444';
      this.style.backgroundColor = '#fff5f5';
    } else {
      this.style.borderColor = '#ccc';
      this.style.backgroundColor = '#fff';
    }
  });
  
  [emailInput, passwordInput].forEach(input => {
    input.addEventListener('focus', function() {
      this.style.borderColor = '#007bff';
      this.style.backgroundColor = '#fff';
    });
  });
}

document.addEventListener('DOMContentLoaded', function() {
  const form = document.querySelector('form');
  if (form) form.addEventListener('submit', validateForm);

  addInputValidation();

  const serverError = document.querySelector('.error-message:not(.js-error-message)');

  if (serverError) {
    const text = serverError.textContent.trim();

    if (!text) {
      serverError.remove();
      return;
    }

    setTimeout(() => {
      serverError.style.opacity = '0';
      setTimeout(() => {
        if (serverError.parentNode) {
          serverError.remove();
        }
      }, 300);
    }, 5000);
  }
});
