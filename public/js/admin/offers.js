
        document.querySelectorAll('.toggle-offer').forEach(button => {
            button.addEventListener('click', async function() {
                const offerId = this.dataset.id;
                try {
                    const response = await fetch(`/admin/offers/toggle/${offerId}`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    const result = await response.json();
                    if (result.success) {
                        location.reload();
                    } else {
                        Swal.fire({
                          icon: 'error',
                          title: 'Error',
                          text: result.message || 'An unexpected error occurred.',
                          confirmButtonText: 'OK',
                          confirmButtonColor: '#d33'
                        });
                    }
                } catch (error) {
                    Swal.fire({
                      icon: 'error',
                      title: 'Toggle Error',
                      text: 'Error toggling offer status',
                      confirmButtonText: 'OK',
                      confirmButtonColor: '#d33'
                    });
                }
            });
        });

        document.querySelectorAll('.delete-offer').forEach(button => {
            button.addEventListener('click', async function() {
                const result = await Swal.fire({
                  title: 'Delete Offer?',
                  text: 'Are you sure you want to delete this offer?',
                  icon: 'warning',
                  showCancelButton: true,
                  confirmButtonColor: '#d33',
                  cancelButtonColor: '#6c757d',
                  confirmButtonText: 'Yes, delete it!',
                  cancelButtonText: 'Cancel'
                });
                if (!result.isConfirmed) return;
                
                const offerId = this.dataset.id;
                try {
                    const response = await fetch(`/admin/offers/delete/${offerId}`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    const result = await response.json();
                    if (result.success) {
                        location.reload();
                    } else {
                        Swal.fire({
                          icon: 'error',
                          title: 'Error',
                          text: result.message || 'An unexpected error occurred.',
                          confirmButtonText: 'OK',
                          confirmButtonColor: '#d33'
                        });
                    }
                } catch (error) {
                    Swal.fire({
                      icon: 'error',
                      title: 'Delete Error',
                      text: 'Error deleting offer',
                      confirmButtonText: 'OK',
                      confirmButtonColor: '#d33'
                    });
                }
            });
        });
    