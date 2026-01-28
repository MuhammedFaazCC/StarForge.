    document.addEventListener('DOMContentLoaded', () => {
      // Status validation rules
      const statusTransitions = {
        'Placed': ['Ordered', 'Processing', 'Shipped', 'Cancelled'],
        'Ordered': ['Processing', 'Shipped', 'Cancelled'],
        'Processing': ['Shipped', 'Cancelled'],
        'Shipped': ['Out for Delivery', 'Delivered', 'Cancelled'],
        'Out for Delivery': ['Delivered', 'Cancelled'],
        'Delivered': [], // Final status
        'Cancelled': [], // Final status
        'Return Requested': ['Returned', 'Return Declined'],
        'Returned': [], // Final status
        'Return Declined': []
      };

      // Order-level status updates are now handled from the Orders Listing page

      // Function to validate status transition
      function isValidTransition(currentStatus, newStatus) {
        if (currentStatus === newStatus) return false; // No change
        if (newStatus === 'Cancelled') return true; // Can always cancel (except final states)
        return statusTransitions[currentStatus]?.includes(newStatus) || false;
      }

      // Handle dropdown changes
      document.querySelectorAll('.status-dropdown').forEach(dropdown => {
        dropdown.addEventListener('change', function() {
          const itemId = this.getAttribute('data-item-id');
          const currentStatus = this.getAttribute('data-current-status');
          const newStatus = this.value;
          const updateBtn = document.querySelector(`button[data-item-id="${itemId}"]`);
          
          if (newStatus && newStatus !== currentStatus) {
            if (isValidTransition(currentStatus, newStatus)) {
              updateBtn.disabled = false;
              updateBtn.classList.add('enabled');
            } else {
              updateBtn.disabled = true;
              updateBtn.classList.remove('enabled');
              Swal.fire({
                icon: 'warning',
                title: 'Invalid Transition',
                text: `Invalid status transition from "${currentStatus}" to "${newStatus}"`,
                confirmButtonText: 'OK',
                confirmButtonColor: '#ffc107'
              });
              this.value = currentStatus; // Reset to current status
            }
          } else {
            updateBtn.disabled = true;
            updateBtn.classList.remove('enabled');
          }
        });
      });

      // Handle update button clicks
      document.querySelectorAll('.update-status-btn').forEach(button => {
        button.addEventListener('click', async function() {
          const orderId = this.getAttribute('data-order-id');
          const itemId = this.getAttribute('data-item-id');
          const dropdown = document.querySelector(`select[data-item-id="${itemId}"]`);
          const newStatus = dropdown.value;
          const currentStatus = dropdown.getAttribute('data-current-status');
          
          if (!newStatus || newStatus === currentStatus) {
            Swal.fire({
              icon: 'warning',
              title: 'Status Selection',
              text: 'Please select a different status',
              confirmButtonText: 'OK',
              confirmButtonColor: '#ffc107'
            });
            return;
          }

          // Confirm the status change
          const confirmed = confirm(`Change item status from "${currentStatus}" to "${newStatus}"?`);
          if (!confirmed) return;

          // Disable button during request
          this.disabled = true;
          this.textContent = 'Updating...';

          try {
            const response = await fetch(`/admin/orders/${orderId}/items/${itemId}/status`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ status: newStatus })
            });

            const data = await response.json();
            
            if (data.success) {
              // Show success message
              const successMsg = document.createElement('div');
              successMsg.className = 'success-message';
              successMsg.textContent = `Item status updated to "${newStatus}" successfully!`;
              successMsg.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #4caf50;
                color: white;
                padding: 12px 20px;
                border-radius: 4px;
                z-index: 1000;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
              `;
              document.body.appendChild(successMsg);
              
              // Remove message after 3 seconds
              setTimeout(() => {
                successMsg.remove();
              }, 3000);

              // Reload the page to show updated status
              setTimeout(() => {
                window.location.reload();
              }, 1500);
            } else {
              Swal.fire({
                icon: 'error',
                title: 'Update Failed',
                text: 'Failed to update item status: ' + (data.message || 'Unknown error'),
                confirmButtonText: 'OK',
                confirmButtonColor: '#d33'
              });
              this.disabled = false;
              this.textContent = 'Update';
            }
          } catch (error) {
            console.error('Error updating item status:', error);
            Swal.fire({
              icon: 'error',
              title: 'Update Error',
              text: 'An error occurred while updating the item status.',
              confirmButtonText: 'OK',
              confirmButtonColor: '#d33'
            });
            this.disabled = false;
            this.textContent = 'Update';
          }
        });
      });

      // Handle legacy mark as delivered buttons (if any exist)
      document.querySelectorAll('.mark-delivered-btn').forEach(button => {
        button.addEventListener('click', async function() {
          const orderId = this.getAttribute('data-order-id');
          const itemId = this.getAttribute('data-item-id');
          
          const confirmed = confirm('Mark this item as delivered?');
          if (!confirmed) return;

          try {
            const response = await fetch(`/admin/orders/${orderId}/items/${itemId}/status`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ status: 'Delivered' })
            });

            const data = await response.json();
            
            if (data.success) {
              Swal.fire({
                icon: 'success',
                title: 'Success!',
                text: 'Item marked as delivered successfully!',
                timer: 2000,
                timerProgressBar: true,
                showConfirmButton: false
              });
              window.location.reload();
            } else {
              Swal.fire({
                icon: 'error',
                title: 'Update Failed',
                text: 'Failed to update item status: ' + (data.message || 'Unknown error'),
                confirmButtonText: 'OK',
                confirmButtonColor: '#d33'
              });
            }
          } catch (error) {
            console.error('Error updating item status:', error);
            Swal.fire({
              icon: 'error',
              title: 'Update Error',
              text: 'An error occurred while updating the item status.',
              confirmButtonText: 'OK',
              confirmButtonColor: '#d33'
            });
          }
        });
      });
    });