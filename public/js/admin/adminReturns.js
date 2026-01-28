    async function acceptReturn(orderId) {
      const result = await Swal.fire({
        title: 'Accept Return Request?',
        text: 'This will approve the return and process the refund if applicable.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#28a745',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, Accept Return',
        cancelButtonText: 'Cancel'
      });

      if (result.isConfirmed) {
        try {
          const response = await fetch(`/admin/order/return/accept/${orderId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            }
          });

          const data = await response.json();

          if (data.success) {
            await Swal.fire({
              title: 'Return Accepted!',
              text: data.message,
              icon: 'success',
              confirmButtonColor: '#28a745'
            });
            window.location.reload();
          } else {
            throw new Error(data.message || 'Failed to accept return');
          }
        } catch (error) {
          await Swal.fire({
            title: 'Error!',
            text: error.message || 'Something went wrong while accepting the return.',
            icon: 'error',
            confirmButtonColor: '#dc3545'
          });
        }
      }
    }

    async function declineReturn(orderId) {
      const result = await Swal.fire({
        title: 'Decline Return Request?',
        text: 'This will reject the return request. The customer will be notified.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, Decline Return',
        cancelButtonText: 'Cancel'
      });

      if (result.isConfirmed) {
        try {
          const response = await fetch(`/admin/order/return/decline/${orderId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            }
          });

          const data = await response.json();

          if (data.success) {
            await Swal.fire({
              title: 'Return Declined!',
              text: data.message,
              icon: 'success',
              confirmButtonColor: '#28a745'
            });
            window.location.reload();
          } else {
            throw new Error(data.message || 'Failed to decline return');
          }
        } catch (error) {
          await Swal.fire({
            title: 'Error!',
            text: error.message || 'Something went wrong while declining the return.',
            icon: 'error',
            confirmButtonColor: '#dc3545'
          });
        }
      }
    }
    async function acceptItemReturn(orderId, productId) {
      const result = await Swal.fire({
        title: 'Accept Item Return?',
        text: 'This will approve the item return and process the refund if applicable.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#28a745',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, Accept Item Return',
        cancelButtonText: 'Cancel'
      });

      if (result.isConfirmed) {
        try {
          const response = await fetch(`/admin/order/${orderId}/item/${productId}/return/accept`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            }
          });

          const data = await response.json();

          if (data.success) {
            await Swal.fire({
              title: 'Item Return Accepted!',
              text: data.message,
              icon: 'success',
              confirmButtonColor: '#28a745'
            });
            window.location.reload();
          } else {
            throw new Error(data.message || 'Failed to accept item return');
          }
        } catch (error) {
          await Swal.fire({
            title: 'Error!',
            text: error.message || 'Something went wrong while accepting the item return.',
            icon: 'error',
            confirmButtonColor: '#dc3545'
          });
        }
      }
    }

    async function declineItemReturn(orderId, productId) {
      const result = await Swal.fire({
        title: 'Decline Item Return?',
        text: 'This will reject the item return request. The customer will be notified.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, Decline Item Return',
        cancelButtonText: 'Cancel'
      });

      if (result.isConfirmed) {
        try {
          const response = await fetch(`/admin/order/${orderId}/item/${productId}/return/decline`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            }
          });

          const data = await response.json();

          if (data.success) {
            await Swal.fire({
              title: 'Item Return Declined!',
              text: data.message,
              icon: 'success',
              confirmButtonColor: '#28a745'
            });
            window.location.reload();
          } else {
            throw new Error(data.message || 'Failed to decline item return');
          }
        } catch (error) {
          await Swal.fire({
            title: 'Error!',
            text: error.message || 'Something went wrong while declining the item return.',
            icon: 'error',
            confirmButtonColor: '#dc3545'
          });
        }
      }
    }