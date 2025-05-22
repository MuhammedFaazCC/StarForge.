// Password toggle functionality
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

// Form validation functions
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function showError(message) {
  // Remove existing error messages
  const existingError = document.querySelector('.js-error-message');
  if (existingError) {
    existingError.remove();
  }

  // Create new error message element
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message js-error-message';
  errorDiv.textContent = message;

  // Insert error message after the h1 title
  const title = document.querySelector('h1');
  title.parentNode.insertBefore(errorDiv, title.nextSibling);

  // Auto-hide error after 5 seconds
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
  event.preventDefault(); // Prevent default form submission
  
  // Clear any existing JS errors
  clearErrors();
  
  // Get form elements
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  
  // Get values and trim whitespace
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  
  // Validation checks
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
  
  // If all validations pass, submit the form
  document.querySelector('form').submit();
  return true;
}

// Add real-time validation feedback
function addInputValidation() {
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  
  // Email input validation
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
  
  // Password input validation
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
  
  // Clear validation styling on focus
  [emailInput, passwordInput].forEach(input => {
    input.addEventListener('focus', function() {
      this.style.borderColor = '#007bff';
      this.style.backgroundColor = '#fff';
    });
  });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Get the form element
  const form = document.querySelector('form');
  
  // Add form submission validation
  if (form) {
    form.addEventListener('submit', validateForm);
  }
  
  // Add real-time input validation
  addInputValidation();
  
  // Auto-hide server-side error messages after 5 seconds
  const serverError = document.querySelector('.error-message:not(.js-error-message)');
  if (serverError) {
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