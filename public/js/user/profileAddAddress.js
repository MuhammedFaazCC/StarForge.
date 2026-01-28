
    function validateForm() {

      const validators = {
        name: v => /^[A-Za-z .]{2,100}$/.test(v),
        phone: v => /^[6-9][0-9]{9}$/.test(v),
        address: v => /^[A-Za-z0-9 ,./\-]{10,200}$/.test(v),
        pinCode: v => /^[1-9][0-9]{5}$/.test(v),
        city: v => /^[A-Za-z ]{2,50}$/.test(v),
        district: v => /^[A-Za-z ]{2,50}$/.test(v),
        state: v => /^[A-Za-z ]{2,50}$/.test(v)
      };

      let isValid = true;
      const form = document.getElementById('addAddressForm');
      const requiredFields = form.querySelectorAll('[required]');

      requiredFields.forEach(field => {
        const value = field.value.trim();

        field.classList.remove('is-invalid', 'is-valid');
        const feedback = field.nextElementSibling;
        if (feedback && feedback.classList.contains('invalid-feedback')) {
          feedback.textContent = '';
        }

        if (!value) {
          showFieldError(field, 'This field is required');
          isValid = false;
        } else if (field.name === 'name' && value.length < 2) {
          showFieldError(field, 'Name must be at least 2 characters long');
          isValid = false;
        } else if (field.name === 'address' && value.length < 10) {
          showFieldError(field, 'Please enter a complete address');
          isValid = false;
        } else if (field.name === 'pinCode' && !/^[0-9]{6}$/.test(value)) {
          showFieldError(field, 'Please enter a valid 6-digit pincode');
          isValid = false;
        } else if (field.name === 'phone' && !/^[0-9]{10}$/.test(value)) {
          showFieldError(field, 'Please enter a valid 10-digit mobile number');
          isValid = false;
        } else {
          showFieldSuccess(field);
        }
      });

      const phoneField = document.getElementById('phone');
      const phoneValue = phoneField.value.trim();
      if (phoneValue && !/^[0-9]{10}$/.test(phoneValue)) {
        showFieldError(phoneField, 'Please enter a valid 10-digit mobile number');
        isValid = false;
      } else if (phoneValue) {
        showFieldSuccess(phoneField);
      }

      return isValid;
    }

    function showFieldError(field, message) {
      field.classList.add('is-invalid');
      field.classList.remove('is-valid');
      const feedback = field.nextElementSibling;
      if (feedback && feedback.classList.contains('invalid-feedback')) {
        feedback.textContent = message;
      }
    }

    function showFieldSuccess(field) {
      field.classList.add('is-valid');
      field.classList.remove('is-invalid');
      const feedback = field.nextElementSibling;
      if (feedback && feedback.classList.contains('invalid-feedback')) {
        feedback.textContent = '';
      }
    }

    function setButtonLoading(loading = true) {
      const submitBtn = document.getElementById('submitBtn');
      if (loading) {
        submitBtn.classList.add('btn-loading');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Saving...</span>';
      } else {
        submitBtn.classList.remove('btn-loading');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Address';
      }
    }

    document.getElementById('addAddressForm').addEventListener('submit', function(e) {
      e.preventDefault();

      if (!validateForm()) {
        return;
      }

      setButtonLoading(true);
      this.submit();
    });

    document.addEventListener('DOMContentLoaded', function() {
      const form = document.getElementById('addAddressForm');
      const inputs = form.querySelectorAll('input, textarea');

      inputs.forEach(input => {
        input.addEventListener('blur', function() {
          if (this.hasAttribute('required') || this.value.trim()) {
            validateSingleField(this);
          }
        });

        input.addEventListener('input', function() {
          if (this.classList.contains('is-invalid')) {
            validateSingleField(this);
          }
        });
      });
    });

    function validateSingleField(field) {
      const value = field.value.trim();
      field.classList.remove('is-invalid', 'is-valid');

      const feedback = field.nextElementSibling;
      if (feedback && feedback.classList.contains('invalid-feedback')) {
        feedback.textContent = '';
      }

      if (field.hasAttribute('required') && !value) {
        showFieldError(field, 'This field is required');
        return false;
      }

      if (field.name === 'phone' && value && !/^[0-9]{10}$/.test(value)) {
        showFieldError(field, 'Please enter a valid 10-digit mobile number');
        return false;
      }

      if (field.name === 'pinCode' && value && !/^[0-9]{6}$/.test(value)) {
        showFieldError(field, 'Please enter a valid 6-digit pincode');
        return false;
      }

      if (field.name === 'name' && value && value.length < 2) {
        showFieldError(field, 'Name must be at least 2 characters long');
        return false;
      }

      if (field.name === 'address' && value && value.length < 10) {
        showFieldError(field, 'Please enter a complete address');
        return false;
      }

      if (value) {
        showFieldSuccess(field);
      }

      return true;
    }
  