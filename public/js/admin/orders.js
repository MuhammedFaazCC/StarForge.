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

  // Function to validate status transition
  function isValidTransition(currentStatus, newStatus) {
    if (currentStatus === newStatus) {return false;} // No change
    if (newStatus === 'Cancelled') {return true;} // Can always cancel (except final states)
    return statusTransitions[currentStatus]?.includes(newStatus) || false;
  }

  // Handle item status dropdown changes
  document.querySelectorAll('.item-status-dropdown').forEach(dropdown => {
    dropdown.addEventListener('change', function() {
      const orderId = this.getAttribute('data-order-id');
      const itemId = this.getAttribute('data-item-id');
      const currentStatus = this.getAttribute('data-current-status');
      const newStatus = this.value;
      const updateBtn = document.querySelector(`button[data-order-id="${orderId}"][data-item-id="${itemId}"]`);
      
      if (newStatus && newStatus !== currentStatus) {
        if (isValidTransition(currentStatus, newStatus)) {
          updateBtn.disabled = false;
          updateBtn.classList.add('enabled');
          updateBtn.innerHTML = `<i class="fas fa-sync"></i> Update to ${newStatus}`;
        } else {
          updateBtn.disabled = true;
          updateBtn.classList.remove('enabled');
          updateBtn.innerHTML = `<i class="fas fa-sync"></i> Update`;
          
          // Show error message
          Swal.fire({
            icon: 'error',
            title: 'Invalid Transition',
            text: `Cannot change status from "${currentStatus}" to "${newStatus}"`,
            confirmButtonColor: '#fca120'
          });
          
          this.value = ''; // Reset dropdown
        }
      } else {
        updateBtn.disabled = true;
        updateBtn.classList.remove('enabled');
        updateBtn.innerHTML = `<i class="fas fa-sync"></i> Update`;
      }
    });
  });

  // Handle update button clicks
  document.querySelectorAll('.btn-update-status').forEach(button => {
    button.addEventListener('click', async function() {
      const orderId = this.getAttribute('data-order-id');
      const itemId = this.getAttribute('data-item-id');
      const dropdown = document.querySelector(`select[data-order-id="${orderId}"][data-item-id="${itemId}"]`);
      const newStatus = dropdown.value;
      const currentStatus = dropdown.getAttribute('data-current-status');
      
      if (!newStatus || newStatus === currentStatus) {
        Swal.fire({
          icon: 'warning',
          title: 'No Status Selected',
          text: 'Please select a different status',
          confirmButtonColor: '#fca120'
        });
        return;
      }

      // Confirm the status change
      const result = await Swal.fire({
        title: 'Confirm Status Change',
        text: `Change item status from "${currentStatus}" to "${newStatus}"?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#28a745',
        cancelButtonColor: '#dc3545',
        confirmButtonText: 'Yes, update it!',
        cancelButtonText: 'Cancel'
      });

      if (!result.isConfirmed) {return;}

      // Disable button during request
      this.disabled = true;
      this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

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
          await Swal.fire({
            icon: 'success',
            title: 'Status Updated!',
            text: `Item status updated to "${newStatus}" successfully!`,
            confirmButtonColor: '#28a745',
            timer: 2000,
            timerProgressBar: true
          });

          // Update the UI
          const itemCard = this.closest('.item-card');
          const statusBadge = itemCard.querySelector('.status-badge');
          const statusContainer = itemCard.querySelector('.item-status-container');
          
          // Update status badge
          statusBadge.className = `status-badge status-${newStatus.toLowerCase().replace(/\s+/g, '-')}`;
          statusBadge.textContent = newStatus;
          
          // Add timestamp if delivered or cancelled
          if (newStatus === 'Delivered' || newStatus === 'Cancelled') {
            const existingTimestamp = statusContainer.querySelector('.status-timestamp');
            if (existingTimestamp) {
              existingTimestamp.remove();
            }
            
            const timestamp = document.createElement('small');
            timestamp.className = 'status-timestamp';
            timestamp.textContent = `${newStatus}: ${new Date().toDateString()}`;
            statusContainer.appendChild(timestamp);
          }
          
          // Update dropdown current status
          dropdown.setAttribute('data-current-status', newStatus);
          dropdown.value = '';
          
          // Reset button
          this.disabled = true;
          this.classList.remove('enabled');
          this.innerHTML = '<i class="fas fa-sync"></i> Update';
          
          // If final status, replace with final status indicator
          if (['Delivered', 'Cancelled', 'Returned'].includes(newStatus)) {
            const actionsContainer = this.closest('.item-actions');
            actionsContainer.innerHTML = `
              <span class="final-status">
                <i class="fas fa-check-circle"></i>
                Final Status
              </span>
            `;
          }
          
        } else {
          await Swal.fire({
            icon: 'error',
            title: 'Update Failed',
            text: data.message || 'Failed to update item status',
            confirmButtonColor: '#dc3545'
          });
          
          this.disabled = false;
          this.classList.remove('enabled');
          this.innerHTML = '<i class="fas fa-sync"></i> Update';
        }
      } catch (error) {
        console.error('Error updating item status:', error);
        
        await Swal.fire({
          icon: 'error',
          title: 'Network Error',
          text: 'An error occurred while updating the item status.',
          confirmButtonColor: '#dc3545'
        });
        
        this.disabled = false;
        this.classList.remove('enabled');
        this.innerHTML = '<i class="fas fa-sync"></i> Update';
      }
    });
  });

  // Order status update functionality for listing page
  document.querySelectorAll('.order-status-dropdown').forEach(dropdown => {
    dropdown.addEventListener('change', function() {
      const orderId = this.getAttribute('data-order-id');
      const currentStatus = this.getAttribute('data-current-status');
      const newStatus = this.value;
      const updateBtn = document.querySelector(`button.btn-update-order-status[data-order-id="${orderId}"]`);
      
      if (newStatus && newStatus !== currentStatus) {
        updateBtn.disabled = false;
        updateBtn.classList.add('enabled');
        updateBtn.innerHTML = `<i class="fas fa-sync"></i> Update to ${newStatus}`;
      } else {
        updateBtn.disabled = true;
        updateBtn.classList.remove('enabled');
        updateBtn.innerHTML = `<i class="fas fa-sync"></i> Update`;
      }
    });
  });

  // Handle order status update button clicks
  document.querySelectorAll('.btn-update-order-status').forEach(button => {
    button.addEventListener('click', async function() {
      const orderId = this.getAttribute('data-order-id');
      const dropdown = document.querySelector(`select.order-status-dropdown[data-order-id="${orderId}"]`);
      const newStatus = dropdown.value;
      const currentStatus = dropdown.getAttribute('data-current-status');
      
      if (!newStatus || newStatus === currentStatus) {
        Swal.fire({
          icon: 'warning',
          title: 'No Status Selected',
          text: 'Please select a different status',
          confirmButtonColor: '#fca120'
        });
        return;
      }

      // Show confirmation with different messages for critical actions
      let confirmTitle = 'Update Order Status?';
      let confirmText = `Change order status from "${currentStatus}" to "${newStatus}"?`;
      let confirmButtonText = 'Yes, Update';
      
      if (newStatus === 'Cancelled') {
        confirmTitle = 'Cancel Entire Order?';
        confirmText = 'This will cancel all items in the order and process refunds if applicable. This action cannot be undone.';
        confirmButtonText = 'Yes, Cancel Order';
      } else if (newStatus === 'Delivered') {
        confirmTitle = 'Mark Order as Delivered?';
        confirmText = 'This will mark all items as delivered and finalize the order. This action cannot be undone.';
        confirmButtonText = 'Yes, Mark Delivered';
      }

      const result = await Swal.fire({
        title: confirmTitle,
        text: confirmText,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: newStatus === 'Cancelled' ? '#dc3545' : '#fca120',
        cancelButtonColor: '#6c757d',
        confirmButtonText: confirmButtonText,
        cancelButtonText: 'Cancel'
      });

      if (!result.isConfirmed) {
        dropdown.value = '';
        this.disabled = true;
        this.classList.remove('enabled');
        this.innerHTML = `<i class="fas fa-sync"></i> Update`;
        return;
      }

      // Disable button during request
      this.disabled = true;
      this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

      try {
        const response = await fetch(`/admin/orders/${orderId}/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: newStatus })
        });

        const data = await response.json();
        
        if (data.success) {
          await Swal.fire({
            icon: 'success',
            title: 'Status Updated!',
            text: data.message,
            confirmButtonColor: '#fca120',
            timer: 2000,
            timerProgressBar: true
          });

          // Update the UI without page reload
          const orderCard = this.closest('.order-card');
          
          // Update all item status badges in this order
          orderCard.querySelectorAll('.status-badge').forEach(badge => {
            const itemStatus = newStatus === 'Pending' ? 'Placed' : newStatus;
            badge.className = `status-badge status-${itemStatus.toLowerCase().replace(/\s+/g, '-')}`;
            badge.textContent = itemStatus;
          });
          
          // Update dropdown current status
          dropdown.setAttribute('data-current-status', newStatus);
          dropdown.value = '';
          
          // Reset button or replace with final status indicator
          if (['Delivered', 'Cancelled', 'Returned'].includes(newStatus)) {
            const orderStatusUpdate = this.closest('.order-status-update');
            orderStatusUpdate.innerHTML = `
              <span class="final-order-status">
                <i class="fas fa-check-circle"></i>
                Final Status
              </span>
            `;
          } else {
            this.disabled = true;
            this.classList.remove('enabled');
            this.innerHTML = '<i class="fas fa-sync"></i> Update';
          }
          
        } else {
          await Swal.fire({
            icon: 'error',
            title: 'Update Failed',
            text: data.message || 'Failed to update order status',
            confirmButtonColor: '#dc3545'
          });
          
          dropdown.value = '';
          this.disabled = true;
          this.classList.remove('enabled');
          this.innerHTML = '<i class="fas fa-sync"></i> Update';
        }
      } catch (error) {
        console.error('Error updating order status:', error);
        
        await Swal.fire({
          icon: 'error',
          title: 'Network Error',
          text: 'An error occurred while updating the order status.',
          confirmButtonColor: '#dc3545'
        });
        
        dropdown.value = '';
        this.disabled = true;
        this.classList.remove('enabled');
        this.innerHTML = '<i class="fas fa-sync"></i> Update';
      }
    });
  });

  // Add smooth animations for status updates
  const style = document.createElement('style');
  style.textContent = `
    .item-card {
      transition: all 0.3s ease;
    }
    
    .item-card.updating {
      transform: scale(1.02);
      box-shadow: 0 4px 12px rgba(252, 161, 32, 0.3);
      border-color: #fca120;
    }
    
    .status-badge {
      transition: all 0.3s ease;
    }
    
    .btn-update-status.enabled {
      animation: pulse-green 2s infinite;
    }
    
    @keyframes pulse-green {
      0% {
        box-shadow: 0 0 0 0 rgba(40, 167, 69, 0.7);
      }
      70% {
        box-shadow: 0 0 0 10px rgba(40, 167, 69, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(40, 167, 69, 0);
      }
    }
  `;
  document.head.appendChild(style);
});