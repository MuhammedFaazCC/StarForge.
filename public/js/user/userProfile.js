
    
    
    function showFieldError(field, message) {
      field.classList.add('is-invalid');
      const feedback = field.nextElementSibling;
      if (feedback && feedback.classList.contains('invalid-feedback')) {
        feedback.textContent = message;
      }
    }
    
    function isValidEmail(email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    }
    
    function isValidMobile(mobile) {
      const mobileRegex = /^[0-9]{10}$/;
      return mobileRegex.test(mobile);
    }

    function openEditProfileModal() {
      resetEditProfileModal();
      document.getElementById('editProfileModal').classList.add('active');
      document.body.classList.add('modal-open');
    }

    function closeEditProfileModal() {
      document.getElementById('editProfileModal').classList.remove('active');
      document.body.classList.remove('modal-open');
    }

    function openImageUploadModal() {
      document.getElementById('imageUploadModal').classList.add('active');
      document.body.classList.add('modal-open');
    }

    function closeImageUploadModal() {
      document.getElementById('imageUploadModal').classList.remove('active');
      document.body.classList.remove('modal-open');
    }

    function removeProfileImage() {
      if (confirm('Are you sure you want to remove your profile picture?')) {
        fetch('/profile/remove-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            showToast('Profile picture removed successfully!', 'success');
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          } else {
            showToast(data.message || 'Failed to remove profile picture', 'error');
          }
        })
        .catch(error => {
          console.error('Error:', error);
          showToast('An error occurred while removing profile picture', 'error');
        });
      }
    }

    function validateEditProfileForm(form) {
      let valid = true;

      const nameInput = form.querySelector('input[name="name"]');
      const emailInput = form.querySelector('input[name="email"]');
      const mobileInput = form.querySelector('input[name="mobile"]');

      clearField(nameInput);
      clearField(emailInput);
      clearField(mobileInput);

      // ===== Full Name =====
      const name = nameInput.value.trim();
      const nameRegex = /^[A-Za-z\s'-]+$/;

      if (!name) {
        setError(nameInput, 'Full name is required');
        valid = false;
      } else if (name.length < 2 || name.length > 50) {
        setError(nameInput, 'Name must be 2–50 characters');
        valid = false;
      } else if (!nameRegex.test(name)) {
        setError(nameInput, 'Only letters, spaces, hyphens and apostrophes allowed');
        valid = false;
      } else if (!/[A-Za-z]/.test(name)) {
        setError(nameInput, 'Name must contain letters');
        valid = false;
      } else if (/([\-'])\1{2,}/.test(name)) {
        setError(nameInput, 'Repeated symbols are not allowed');
        valid = false;
      } else if (/^[-']|[-']$/.test(name)) {
        setError(nameInput, 'Name cannot start or end with symbols');
        valid = false;
      } else {
        setValid(nameInput);
      }

      // ===== Email =====
      const email = emailInput.value.trim().toLowerCase();

      if (!email) {
        setError(emailInput, 'Email is required');
        valid = false;
      } else if (!isValidEmail(email)) {
        setError(emailInput, 'Invalid email format');
        valid = false;
      } else {
        emailInput.value = email;
        setValid(emailInput);
      }

      // ===== Mobile =====
      const mobile = mobileInput.value.trim();

      if (mobile) {
        if (!/^[6-9]\d{9}$/.test(mobile)) {
          setError(mobileInput, 'Enter a valid 10-digit mobile number');
          valid = false;
        } else {
          setValid(mobileInput);
        }
      }

      return valid;
    }

    function resetEditProfileModal() {
      const modal = document.getElementById('editProfileModal');
      const form = document.getElementById('editProfileForm');

      if (!form) return;

      // Reset form values to original values rendered by EJS
      form.reset();

      // Clear validation states
      form.querySelectorAll('.is-valid, .is-invalid').forEach(el => {
        el.classList.remove('is-valid', 'is-invalid');
      });

      // Clear error messages
      form.querySelectorAll('.invalid-feedback').forEach(el => {
        el.textContent = '';
      });
    }

    function setError(input, message) {
      input.classList.add('is-invalid');
      input.classList.remove('is-valid');
      const feedback = input.nextElementSibling;
      if (feedback && feedback.classList.contains('invalid-feedback')) {
        feedback.textContent = message;
      }
    }

    function setValid(input) {
      input.classList.remove('is-invalid');
      input.classList.add('is-valid');
      const feedback = input.nextElementSibling;
      if (feedback && feedback.classList.contains('invalid-feedback')) {
        feedback.textContent = '';
      }
    }

    function clearField(input) {
      input.classList.remove('is-invalid', 'is-valid');
      const feedback = input.nextElementSibling;
      if (feedback && feedback.classList.contains('invalid-feedback')) {
        feedback.textContent = '';
      }
    }

    function handleFileUpload(inputId, uploadAreaSelector) {
      document.getElementById(inputId).addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
          if (file.size > 5 * 1024 * 1024) {
            showToast('File size must be less than 5MB', 'error');
            e.target.value = '';
            return;
          }

          if (!file.type.startsWith('image/')) {
            showToast('Please select a valid image file', 'error');
            e.target.value = '';
            return;
          }

          const uploadArea = document.querySelector(uploadAreaSelector);
          uploadArea.innerHTML = `
            <div class="upload-icon">
              <i class="fas fa-check-circle" style="color: #28a745;"></i>
            </div>
            <div class="upload-text">${file.name}</div>
            <div class="upload-hint">Ready to upload</div>
          `;
        }
      });
    }

    handleFileUpload('profileImageInput', '#imageUploadModal .file-upload-area');
    handleFileUpload('profileImageEdit', '#editProfileModal .file-upload-area');

    const uploadArea = document.querySelector('.file-upload-area');
    
    uploadArea.addEventListener('dragover', function(e) {
      e.preventDefault();
      this.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', function(e) {
      e.preventDefault();
      this.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', function(e) {
      e.preventDefault();
      this.classList.remove('dragover');
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        document.getElementById('profileImageInput').files = files;
        document.getElementById('profileImageInput').dispatchEvent(new Event('change'));
      }
    });



    document.getElementById('editProfileForm').addEventListener('submit', function (e) {
      e.preventDefault();

      if (!validateEditProfileForm(this)) return;

      const formData = new FormData(this);
      const submitBtn = this.querySelector('button[type="submit"]');

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

      fetch('/user/updateProfile', {
        method: 'POST',
        body: formData
      })
        .then(res => {
          if (res.redirected) {
            window.location.href = res.url;
          } else {
            return res.json();
          }
        })
        .catch(() => showToast('Profile update failed', 'error'))
        .finally(() => {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
        });
    });

    document.getElementById('imageUploadForm').addEventListener('submit', function(e) {
      e.preventDefault();
      
      const formData = new FormData(this);
      const submitBtn = this.querySelector('button[type="submit"]');
      
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
      
      fetch('/profile/upload-image', {
        method: 'POST',
        body: formData
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          showToast('Profile picture updated successfully!', 'success');
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          showToast(data.message || 'Failed to upload image', 'error');
        }
      })
      .catch(error => {
        console.error('Error:', error);
        showToast('An error occurred while uploading image', 'error');
      })
      .finally(() => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-upload"></i> Upload Picture';
      });
    });

    function showToast(message, type = 'success') {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.className = `toast ${type}`;
      toast.classList.add('show');
      
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }

    document.addEventListener('click', function(e) {
      if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
        document.body.classList.remove('modal-open');
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        const activeModal = document.querySelector('.modal-overlay.active');
        if (activeModal) {
          activeModal.classList.remove('active');
          document.body.classList.remove('modal-open');
        }
      }
    });

    <% if (typeof success !== 'undefined' && success) { %>
      showToast('<%= success %>', 'success');
    <% } %>

    <% if (typeof error !== 'undefined' && error) { %>
      showToast('<%= error %>', 'error');
    <% } %>