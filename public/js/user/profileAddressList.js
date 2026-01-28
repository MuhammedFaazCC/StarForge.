
        function validateForm(form) {
          let isValid = true;
          const requiredFields = form.querySelectorAll('[required]');

          requiredFields.forEach(field => {
            const value = field.value.trim();
            const feedback = field.nextElementSibling;

            field.classList.remove('is-invalid');
            if (feedback && feedback.classList.contains('invalid-feedback')) {
              feedback.textContent = '';
            }

            if (!value) {
              showFieldError(field, 'This field is required');
              isValid = false;
            } else if (field.name === 'mobile' && value && !/^[0-9]{10}$/.test(value)) {
              showFieldError(field, 'Please enter a valid 10-digit mobile number');
              isValid = false;
            } else if (field.name === 'pincode' && !/^[0-9]{6}$/.test(value)) {
              showFieldError(field, 'Please enter a valid 6-digit pincode');
              isValid = false;
            } else if (field.name === 'name' && value.length < 2) {
              showFieldError(field, 'Name must be at least 2 characters long');
              isValid = false;
            } else if (field.name === 'address' && value.length < 10) {
              showFieldError(field, 'Please enter a complete address');
              isValid = false;
            }
          });

          return isValid;
        }

        function showFieldError(field, message) {
          field.classList.add('is-invalid');
          const feedback = field.nextElementSibling;
          if (feedback && feedback.classList.contains('invalid-feedback')) {
            feedback.textContent = message;
          }
        }

        function setButtonLoading(button, loading = true) {
          if (loading) {
            button.classList.add('btn-loading');
            button.disabled = true;
            button.innerHTML = '<span>Loading...</span>';
          } else {
            button.classList.remove('btn-loading');
            button.disabled = false;
          }
        }

        async function openEditModal(event, addressId) {
          event.preventDefault();

          try {
            const response = await fetch(`/address/${addressId}`);

            if (!response.ok) {
              throw new Error(`HTTP error: ${response.status}`);
            }

            const data = await response.json();
            const addr = data && data.address ? data.address : {};

            document.getElementById("editAddressId").value = addressId;
            document.getElementById("editName").value = addr.name || "";
            document.getElementById("editMobile").value = addr.phone || addr.mobile || "";
            document.getElementById("editAddress").value = addr.address || "";
            document.getElementById("editPincode").value = addr.pinCode || "";
            document.getElementById("editCity").value = addr.city || "";
            document.getElementById("editDistrict").value = addr.district || "";
            document.getElementById("editState").value = addr.state || "";
            document.getElementById("editIsDefault").checked = !!addr.isDefault;

            const form = document.getElementById('editAddressForm');
            form.querySelectorAll('.is-invalid').forEach(field => {
              field.classList.remove('is-invalid');
            });
            form.querySelectorAll('.invalid-feedback').forEach(feedback => {
              feedback.textContent = '';
            });

            const modal = new bootstrap.Modal(document.getElementById("editAddressModal"));
            modal.show();

          } catch (error) {
            console.error("Failed to load address data:", error);

            Swal.fire({
              title: 'Error!',
              text: 'Failed to load address data. Please try again.',
              icon: 'error',
              confirmButtonColor: '#ef4444'
            });
          }
        }

        document.getElementById('updateAddressBtn').addEventListener('click', async () => {
          const form = document.getElementById('editAddressForm');
          const updateBtn = document.getElementById('updateAddressBtn');

          if (!validateForm(form)) {
            return;
          }

          const addressId = document.getElementById('editAddressId').value;
          const formData = {
            name: document.getElementById('editName').value.trim(),
            phone: document.getElementById('editMobile').value.trim(),
            address: document.getElementById('editAddress').value.trim(),
            pinCode: document.getElementById('editPincode').value.trim(),
            city: document.getElementById('editCity').value.trim(),
            district: document.getElementById('editDistrict').value.trim(),
            state: document.getElementById('editState').value.trim(),
            isDefault: document.getElementById('editIsDefault').checked
          };

          try {
            setButtonLoading(updateBtn, true);

            const response = await fetch(`/address/${addressId}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (data.success) {
              const modal = bootstrap.Modal.getInstance(document.getElementById('editAddressModal'));
              modal.hide();

              await Swal.fire({
                title: 'Success!',
                text: 'Address updated successfully',
                icon: 'success',
                confirmButtonColor: '#28a745'
              });

              location.reload();
            } else {
              throw new Error(data.message || 'Failed to update address');
            }
          } catch (error) {
            console.error('Update failed:', error);

            Swal.fire({
              title: 'Error!',
              text: error.message || 'Something went wrong while updating the address.',
              icon: 'error',
              confirmButtonColor: '#ef4444'
            });
          } finally {
            setButtonLoading(updateBtn, false);
            updateBtn.innerHTML = '<i class="fas fa-save"></i> Update Address';
          }
        });

        async function setDefaultAddress(event, addressId) {
          event.preventDefault();

          const result = await Swal.fire({
            title: 'Set Default Address?',
            text: 'This will become your default delivery address.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#fca120',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, Set as Default',
            cancelButtonText: 'Cancel'
          });

          if (result.isConfirmed) {
            try {
              const response = await fetch(`/address/${addressId}/default`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                }
              });

              const data = await response.json();

              if (data.success) {
                await Swal.fire({
                  title: 'Success!',
                  text: 'Default address updated successfully',
                  icon: 'success',
                  confirmButtonColor: '#28a745'
                });
                location.reload();
              } else {
                throw new Error(data.message || 'Failed to set default address');
              }
            } catch (error) {
              await Swal.fire({
                title: 'Error!',
                text: error.message || 'Something went wrong while setting default address.',
                icon: 'error',
                confirmButtonColor: '#ef4444'
              });
            }
          }
        }

        async function deleteAddress(event, addressId) {
          event.preventDefault();

          const result = await Swal.fire({
            title: 'Delete Address?',
            text: 'Are you sure you want to delete this address? This action cannot be undone.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, Delete',
            cancelButtonText: 'Cancel',
            reverseButtons: true
          });

          if (result.isConfirmed) {
            try {
              const response = await fetch(`/address/${addressId}`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                }
              });

              const data = await response.json();

              if (data.success) {
                await Swal.fire({
                  title: 'Deleted!',
                  text: data.message,
                  icon: 'success',
                  confirmButtonColor: '#28a745'
                });
                location.reload();
              } else {
                throw new Error(data.message || 'Failed to delete address');
              }
            } catch (error) {
              await Swal.fire({
                title: 'Error!',
                text: error.message || 'Something went wrong while deleting the address.',
                icon: 'error',
                confirmButtonColor: '#ef4444'
              });
            }
          }
        }

        document.addEventListener('DOMContentLoaded', function () {
          const form = document.getElementById('editAddressForm');
          if (form) {
            const inputs = form.querySelectorAll('input, textarea');

            inputs.forEach(input => {
              input.addEventListener('blur', function () {
                if (this.hasAttribute('required') || this.value.trim()) {
                  validateSingleField(this);
                }
              });

              input.addEventListener('input', function () {
                if (this.classList.contains('is-invalid')) {
                  validateSingleField(this);
                }
              });
            });
          }
        });

        function validateSingleField(field) {
          const value = field.value.trim();
          field.classList.remove('is-invalid');

          const feedback = field.nextElementSibling;
          if (feedback && feedback.classList.contains('invalid-feedback')) {
            feedback.textContent = '';
          }

          if (field.hasAttribute('required') && !value) {
            showFieldError(field, 'This field is required');
            return false;
          }

          if (field.name === 'mobile' && value && !/^[0-9]{10}$/.test(value)) {
            showFieldError(field, 'Please enter a valid 10-digit mobile number');
            return false;
          }

          if (field.name === 'pincode' && value && !/^[0-9]{6}$/.test(value)) {
            showFieldError(field, 'Please enter a valid 6-digit pincode');
            return false;
          }

          return true;
        }

        async function copyAddress(addressId) {
          try {
            const addressCard = document.querySelector(`[data-address-id="${addressId}"]`);
            if (!addressCard) return;

            const nameText = addressCard.querySelector('.name-text').textContent;
            const addressText = addressCard.querySelector('.address-text').textContent;
            const phoneElement = addressCard.querySelector('.address-field i.fa-phone');
            const phoneText = phoneElement ? phoneElement.nextElementSibling.textContent : '';

            let fullAddress = `${nameText}\n${addressText}`;
            if (phoneText) {
              fullAddress += `\nPhone: ${phoneText}`;
            }

            if (navigator.clipboard && window.isSecureContext) {
              await navigator.clipboard.writeText(fullAddress);
            } else {
              const textArea = document.createElement('textarea');
              textArea.value = fullAddress;
              textArea.style.position = 'fixed';
              textArea.style.left = '-999999px';
              textArea.style.top = '-999999px';
              document.body.appendChild(textArea);
              textArea.focus();
              textArea.select();
              document.execCommand('copy');
              textArea.remove();
            }

            Swal.fire({
              title: 'Copied!',
              text: 'Address copied to clipboard',
              icon: 'success',
              timer: 2000,
              showConfirmButton: false,
              toast: true,
              position: 'top-end'
            });

          } catch (error) {
            console.error('Failed to copy address:', error);
            Swal.fire({
              title: 'Error!',
              text: 'Failed to copy address to clipboard',
              icon: 'error',
              confirmButtonColor: '#ef4444'
            });
          }
        }

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

        document.addEventListener('DOMContentLoaded', function () {
          const alerts = document.querySelectorAll('.alert');
          alerts.forEach(alert => {
            setTimeout(() => {
              if (alert.parentNode) {
                closeAlert(alert.id);
              }
            }, 5000);
          });

          alerts.forEach(alert => {
            alert.style.transition = 'all 0.3s ease';
          });
        });

        document.addEventListener('keydown', function (e) {
          if (e.key === 'Escape') {
            const modal = bootstrap.Modal.getInstance(document.getElementById('editAddressModal'));
            if (modal) {
              modal.hide();
            }
          }
        });

        window.addEventListener('load', function () {
          document.body.classList.add('loaded');
        });
      