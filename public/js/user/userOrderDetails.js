
    // Global variable to track if any cancellation is in progress
    let cancellationInProgress = false;

    function disableAllCancelButtons() {
      const cancelButtons = document.querySelectorAll('.btn-cancel, .btn-cancel-item');
      cancelButtons.forEach(button => {
        button.disabled = true;
        button.classList.add('btn-processing');
        const originalText = button.textContent;
        button.setAttribute('data-original-text', originalText);
        if (button.classList.contains('btn-cancel')) {
          button.innerHTML = '<span>Cancelling Order...</span>';
        } else {
          button.innerHTML = '<span>Cancelling...</span>';
        }
      });
      cancellationInProgress = true;
    }

    function enableAllCancelButtons() {
      const cancelButtons = document.querySelectorAll('.btn-cancel, .btn-cancel-item');
      cancelButtons.forEach(button => {
        button.disabled = false;
        button.classList.remove('btn-processing');
        const originalText = button.getAttribute('data-original-text');
        if (originalText) {
          button.textContent = originalText;
        }
      });
      cancellationInProgress = false;
    }

    async function cancelOrder(orderId) {
      if (cancellationInProgress) {
        return;
      }

      const result = await Swal.fire({
        title: 'Cancel Order?',
        text: 'Are you sure you want to cancel this order? This action cannot be undone.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, Cancel Order',
        cancelButtonText: 'Keep Order'
      });

      if (result.isConfirmed) {
        disableAllCancelButtons();
        
        try {
          const response = await fetch(`/order/cancel/${orderId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            }
          });

          const data = await response.json();

          if (data.success) {
            // IMMEDIATELY UPDATE THE UI - Hide cancel order button and show cancelled banner
            const cancelOrderBtn = document.querySelector('#cancelOrderBtn');
            if (cancelOrderBtn) {
              cancelOrderBtn.style.display = 'none';
            }
            
            // Add order cancelled banner if not already present
            const mainContent = document.querySelector('.main-content');
            const existingBanner = document.querySelector('.order-cancelled-label');
            if (!existingBanner && mainContent) {
              const banner = document.createElement('div');
              banner.className = 'order-cancelled-label';
              banner.innerHTML = 'Order Cancelled';
              const h1 = mainContent.querySelector('h1');
              if (h1) {
                h1.insertAdjacentElement('afterend', banner);
              }
            }
            
            // Update order status in summary
            const statusValue = document.querySelector('.order-summary p:nth-child(2) .value');
            if (statusValue) {
              statusValue.textContent = 'Cancelled';
            }
            
            // Update all item statuses and hide their cancel buttons
            const itemActionsElements = document.querySelectorAll('.item-actions');
            itemActionsElements.forEach(itemActions => {
              const cancelItemBtn = itemActions.querySelector('.btn-cancel-item');
              if (cancelItemBtn) {
                itemActions.innerHTML = `
                  <div class="cancelled-badge">
                    Cancelled
                  </div>
                `;
              }
            });
            
            // Update all item statuses in product details
            const statusSpans = document.querySelectorAll('.item-status');
            statusSpans.forEach(statusSpan => {
              statusSpan.textContent = 'Status: Cancelled';
              statusSpan.className = 'item-status status-cancelled';
            });
            
            await Swal.fire({
              title: 'Order Cancelled!',
              text: data.message,
              icon: 'success',
              confirmButtonColor: '#28a745'
            });
            
            // Don't force refresh - the UI has been updated correctly
            console.log('Order cancellation UI update completed successfully');
          } else {
            enableAllCancelButtons();
            throw new Error(data.message || 'Failed to cancel order');
          }
        } catch (error) {
          enableAllCancelButtons();
          await Swal.fire({
            title: 'Error!',
            text: error.message || 'Something went wrong while cancelling the order.',
            icon: 'error',
            confirmButtonColor: '#dc3545'
          });
        }
      }
    }

    async function requestReturn(orderId) {
      const { value: reason } = await Swal.fire({
        title: 'Request Return',
        text: 'Please provide a reason for returning this order:',
        input: 'textarea',
        inputPlaceholder: 'Enter your reason for return...',
        inputAttributes: {
          'aria-label': 'Return reason'
        },
        showCancelButton: true,
        confirmButtonColor: '#ffc107',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Submit Return Request',
        cancelButtonText: 'Cancel',
        inputValidator: (value) => {
          if (!value || value.trim().length < 10) {
            return 'Please provide a detailed reason (at least 10 characters)';
          }
        }
      });

      if (reason) {
        try {
          const response = await fetch(`/order/return/${orderId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ reason: reason.trim() })
          });

          const data = await response.json();

          if (data.success) {
            await Swal.fire({
              title: 'Return Request Submitted!',
              text: data.message,
              icon: 'success',
              confirmButtonColor: '#28a745'
            });
            window.location.reload();
          } else {
            throw new Error(data.message || 'Failed to submit return request');
          }
        } catch (error) {
          await Swal.fire({
            title: 'Error!',
            text: error.message || 'Something went wrong while submitting the return request.',
            icon: 'error',
            confirmButtonColor: '#dc3545'
          });
        }
      }
    }

    async function cancelSingleItem(orderId, productId) {
      if (cancellationInProgress) {
        return;
      }

      const result = await Swal.fire({
        title: 'Cancel Item?',
        text: 'Are you sure you want to cancel this item? This action cannot be undone.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, Cancel Item',
        cancelButtonText: 'Keep Item'
      });

      if (result.isConfirmed) {
        disableAllCancelButtons();
        
        try {
          const response = await fetch(`/cancelItem/${orderId}/${productId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            }
          });

          const data = await response.json();

          if (data.success) {
            // IMMEDIATELY UPDATE THE UI - Remove the cancel button and show cancelled badge
            const itemActionsDiv = document.querySelector(`[data-product-id="${productId}"]`);
            if (itemActionsDiv) {
              itemActionsDiv.innerHTML = `
                <div class="cancelled-badge">
                  Cancelled
                </div>
              `;
              
              // Update the item status in the product details
              const productItem = itemActionsDiv.closest('.product-item');
              if (productItem) {
                const statusSpan = productItem.querySelector('.item-status');
                if (statusSpan) {
                  statusSpan.textContent = 'Status: Cancelled';
                  statusSpan.className = 'item-status status-cancelled';
                }
              }
            }
            
            // Update the total amount displayed on the page
            if (data.newOrderTotal !== undefined) {
              const orderSummary = document.querySelector('.order-summary');
              if (orderSummary) {
                const totalParagraph = orderSummary.querySelector('p:last-child .value');
                if (totalParagraph) {
                  totalParagraph.textContent = `₹${data.newOrderTotal.toFixed(2)}`;
                }
              }
            }
            
            // Check if all items are now cancelled and update order status
            if (data.orderFullyCancelled) {
              // Add order cancelled banner if not already present
              const mainContent = document.querySelector('.main-content');
              const existingBanner = document.querySelector('.order-cancelled-label');
              if (!existingBanner && mainContent) {
                const banner = document.createElement('div');
                banner.className = 'order-cancelled-label';
                banner.innerHTML = 'Order Cancelled';
                const h1 = mainContent.querySelector('h1');
                if (h1) {
                  h1.insertAdjacentElement('afterend', banner);
                }
              }
              
              // Hide the main cancel order button if it exists
              const cancelOrderBtn = document.querySelector('#cancelOrderBtn');
              if (cancelOrderBtn) {
                cancelOrderBtn.style.display = 'none';
              }
              
              // Update order status in summary
              const statusValue = document.querySelector('.order-summary p:nth-child(2) .value');
              if (statusValue) {
                statusValue.textContent = 'Cancelled';
              }
            }
            
            let message = data.message;
            let htmlContent = `<div style="text-align: left;">`;
            
            if (data.refundAmount && data.refundAmount > 0) {
              htmlContent += `<p><strong>✓ Item cancelled successfully</strong></p>`;
              htmlContent += `<p><strong>Refund Amount:</strong> ₹${data.refundAmount.toFixed(2)}</p>`;
              htmlContent += `<p><em>The refund has been credited to your wallet.</em></p>`;
            } else {
              htmlContent += `<p><strong>✓ Item cancelled successfully</strong></p>`;
            }
            
            if (data.couponRemoved) {
              htmlContent += `<p><strong>Coupon Adjustment:</strong></p>`;
              htmlContent += `<p><em>The coupon was removed as the remaining order total no longer meets the minimum requirement.</em></p>`;
            }
            
            if (data.newOrderTotal !== undefined) {
              htmlContent += `<p><strong>Updated Order Total:</strong> ₹${data.newOrderTotal.toFixed(2)}</p>`;
            }
            
            htmlContent += `</div>`;
            
            await Swal.fire({
              title: 'Item Cancelled!',
              html: htmlContent,
              icon: 'success',
              confirmButtonColor: '#28a745',
              width: '500px'
            });
            
            // Re-enable remaining cancel buttons
            cancellationInProgress = false;
            const remainingCancelButtons = document.querySelectorAll('.btn-cancel, .btn-cancel-item');
            remainingCancelButtons.forEach(button => {
              button.disabled = false;
              button.classList.remove('btn-processing');
              const originalText = button.getAttribute('data-original-text');
              if (originalText) {
                button.textContent = originalText;
              }
            });
            
          } else {
            enableAllCancelButtons();
            throw new Error(data.error || 'Failed to cancel item');
          }
        } catch (error) {
          enableAllCancelButtons();
          await Swal.fire({
            title: 'Error!',
            text: error.message || 'Something went wrong while cancelling the item.',
            icon: 'error',
            confirmButtonColor: '#dc3545'
          });
        }
      }
    }

    async function requestReturnItem(orderId, productId) {
      const { value: reason } = await Swal.fire({
        title: 'Request Item Return',
        text: 'Please provide a reason for returning this item:',
        input: 'textarea',
        inputPlaceholder: 'Enter your reason for return...',
        inputAttributes: {
          'aria-label': 'Return reason'
        },
        showCancelButton: true,
        confirmButtonColor: '#ffc107',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Submit Return Request',
        cancelButtonText: 'Cancel',
        inputValidator: (value) => {
          if (!value || value.trim().length < 10) {
            return 'Please provide a detailed reason (at least 10 characters)';
          }
        }
      });

      if (reason) {
        try {
          const response = await fetch(`/returnItem/${orderId}/${productId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ reason: reason.trim() })
          });

          const data = await response.json();

          if (data.success) {
            await Swal.fire({
              title: 'Return Request Submitted!',
              text: data.message,
              icon: 'success',
              confirmButtonColor: '#28a745'
            });
            window.location.reload();
          } else {
            await Swal.fire({
              title: 'Cannot Submit Return',
              text: data.message,
              icon: 'warning',
              confirmButtonColor: '#ffc107'
            });
          }
        } catch (error) {
          await Swal.fire({
            title: 'Error!',
            text: error.message || 'Something went wrong while submitting the return request.',
            icon: 'error',
            confirmButtonColor: '#dc3545'
          });
        }
      }
    }