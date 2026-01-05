const toggleBtn = document.querySelector(".toggle-btn");
const sidePanel = document.querySelector(".side-panel");
const mainContent = document.querySelector(".main-content");

if (toggleBtn && sidePanel && mainContent) {
  toggleBtn.addEventListener("click", () => {
    sidePanel.classList.toggle("visible");
    sidePanel.classList.toggle("hidden");
    mainContent.classList.toggle("expanded");
  });
}

document.querySelectorAll(".side-panel a").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    document
      .querySelectorAll(".side-panel a")
      .forEach((l) => l.classList.remove("active"));
    link.classList.add("active");
    window.location.href = link.href;
  });
});

function deleteProduct(productId) {
  Swal.fire({
    title: 'Are you absolutely sure?',
    text: "This will permanently delete the product from the database. This action cannot be undone!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'Yes, delete permanently!',
    cancelButtonText: 'Cancel'
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: 'Deleting...',
        text: 'Please wait while we permanently delete the product.',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      fetch(`/admin/products/delete/${productId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" }
      })
        .then((res) => {
          if (res.ok) {
            Swal.fire({
              icon: 'success',
              title: 'Deleted!',
              text: 'Product has been permanently deleted.',
              timer: 2000,
              showConfirmButton: false
            }).then(() => {
              window.location.reload();
            });
          } else {
            return res.json().then(data => {
              throw new Error(data.message || 'Failed to delete product');
            });
          }
        })
        .catch((err) => {
          console.error(err);
          Swal.fire({
            icon: 'error',
            title: 'Error!',
            text: err.message || 'An error occurred while deleting the product.',
            confirmButtonColor: '#ef4444'
          });
        });
    }
  });
}


function toggleProductListing(productId, checkbox) {
  const isChecked = checkbox.checked;

  fetch(`/admin/products/toggle-listing/${productId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ isListed: isChecked }),
  })
    .then((res) => {
      if (!res.ok) {
        throw new Error('Failed to toggle listing status');
      }
      return res.json();
    })
    .then((data) => {
      Swal.fire({
        icon: 'success',
        title: 'Updated!',
        text: `Product has been ${isChecked ? 'listed' : 'unlisted'}.`,
        toast: true,
        position: 'top-end',
        timer: 2000,
        showConfirmButton: false,
      });
    })
    .catch((err) => {
      console.error(err);
      checkbox.checked = !isChecked;
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: err.message || 'Something went wrong while updating listing status.',
      });
    });
}

function filterTable() {
  const input = document.getElementById("searchInput");
  const filter = input.value.toLowerCase();
  const rows = document.querySelectorAll("#productsTable tbody tr");

  const existingNoResults = document.getElementById("noResultsRow");
  if (existingNoResults) existingNoResults.remove();

  let visible = 0;

  rows.forEach(row => {
    const nameCell = row.querySelector("td:nth-child(1)");
    if (!nameCell) return;

    const match = nameCell.textContent.toLowerCase().includes(filter);
    row.style.display = match ? "" : "none";
    if (match) visible++;
  });

  if (visible === 0 && filter) {
    const tr = document.createElement("tr");
    tr.id = "noResultsRow";
    tr.innerHTML = `
      <td colspan="6" style="text-align:center;padding:20px;color:#6b7280;">
        No products found
      </td>`;
    document.querySelector("#productsTable tbody").appendChild(tr);
  }
}

window.addEventListener('error', function(event) {
  console.error('Global error:', event.error);
  Swal.fire({
    icon: 'error',
    title: 'Unexpected Error',
    text: 'An unexpected error occurred. Please refresh the page and try again.',
    confirmButtonColor: '#ef4444'
  });
});

window.addEventListener('offline', function() {
  Swal.fire({
    icon: 'warning',
    title: 'Connection Lost',
    text: 'You are currently offline. Some features may not work properly.',
    confirmButtonColor: '#f59e0b'
  });
});

window.addEventListener('online', function() {
  Swal.fire({
    icon: 'success',
    title: 'Connection Restored',
    text: 'You are back online!',
    timer: 2000,
    showConfirmButton: false
  });
});