console.log('userProfile.js loaded');
    
    
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

    async function removeProfileImage() {
      const result = await Swal.fire({
        title: 'Remove Profile Picture?',
        text: 'Are you sure you want to remove your profile picture?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, remove',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6c757d'
      });

      if (!result.isConfirmed) return;

      try {
        const response = await fetch('/profile/remove-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        const data = await response.json();

        if (data.success) {
          showToast('Profile picture removed successfully!', 'success');
          setTimeout(() => window.location.reload(), 1500);
        } else {
          showToast(data.message || 'Failed to remove profile picture', 'error');
        }
      } catch (error) {
        console.error('Error:', error);
        showToast('An error occurred while removing profile picture', 'error');
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
      } else if (/([-'])\1{2,}/.test(name)) {
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
          const icon = uploadArea.querySelector('.upload-icon i');
          const text = uploadArea.querySelector('.upload-text');
          const hint = uploadArea.querySelector('.upload-hint');

          if (icon) {
            icon.className = 'fas fa-check-circle';
            icon.style.color = '#28a745';
          }

          if (text) {
            text.textContent = file.name;
          }

          if (hint) {
            hint.textContent = 'Ready to upload';
          }
        }
      });
    }

    handleFileUpload('profileImageInput', '#imageUploadModal .file-upload-area');

    document.querySelectorAll('.file-upload-area').forEach(uploadArea => {
      uploadArea.addEventListener('dragover', function (e) {
        e.preventDefault();
        this.classList.add('dragover');
      });

      uploadArea.addEventListener('dragleave', function (e) {
        e.preventDefault();
        this.classList.remove('dragover');
      });

      uploadArea.addEventListener('drop', function (e) {
        e.preventDefault();
        this.classList.remove('dragover');

        const files = e.dataTransfer.files;
        if (!files || !files.length) return;

        const input = document.getElementById('profileImageInput');
        if (!input) return;

        input.files = files;
        input.dispatchEvent(new Event('change', { bubbles: true }));

        if (!input) return;

        input.files = files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });

    document.getElementById('imageUploadForm').addEventListener('submit', async function (e) {
      e.preventDefault();

      const formData = new FormData(this);
      const submitBtn = this.querySelector('button[type="submit"]');

      if (!formData.get('profileImage')) {
        Swal.fire({
          icon: 'warning',
          title: 'No Image Selected',
          text: 'Please select an image to upload'
        });
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';

      try {
        const res = await fetch('/profile/upload-image', {
          method: 'POST',
          body: formData
        });

        const data = await res.json();

        if (data.success) {
          Swal.fire({
            icon: 'success',
            title: 'Profile Picture Updated',
            text: data.message || 'Image uploaded successfully',
            confirmButtonColor: '#fca120'
          }).then(() => window.location.reload());
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Upload Failed',
            text: data.message || 'Unable to upload image'
          });
        }
      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Something went wrong while uploading'
        });
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-upload"></i> Upload Picture';
      }
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