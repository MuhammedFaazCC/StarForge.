const toggleBtn = document.querySelector(".toggle-btn");
const sidePanel = document.querySelector(".side-panel");
const mainContent = document.querySelector(".main-content");

toggleBtn.addEventListener("click", () => {
  sidePanel.classList.toggle("visible");
  sidePanel.classList.toggle("hidden");
  mainContent.classList.toggle("expanded");
});

document.querySelectorAll(".side-panel a").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    document
      .querySelectorAll(".side-panel a")
      .forEach((l) => l.classList.remove("active"));
    link.classList.add("active");
  });
});

function deleteProduct(productId) {
  Swal.fire({
    title: 'Are you sure?',
    text: "You won't be able to revert this!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'Yes, delete it!',
    cancelButtonText: 'Cancel'
  }).then((result) => {
    if (result.isConfirmed) {
      // Show loading state
      Swal.fire({
        title: 'Deleting...',
        text: 'Please wait while we delete the product.',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      fetch(`/admin/products/delete/${productId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      })
        .then((res) => {
          if (res.ok) {
            Swal.fire({
              icon: 'success',
              title: 'Deleted!',
              text: 'Product has been deleted successfully.',
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

function filterTable() {
  const input = document.getElementById("searchInput");
  const filter = input.value.toLowerCase();
  const rows = document.querySelectorAll("#productsTable tbody tr");
  let visibleRows = 0;

  rows.forEach((row) => {
    const nameCell = row.querySelector("td:nth-child(2)");
    if (nameCell) {
      const text = nameCell.textContent.toLowerCase();
      const isVisible = text.includes(filter);
      row.style.display = isVisible ? "" : "none";
      if (isVisible) visibleRows++;
    }
  });

  // Show message if no results found
  const noResultsRow = document.getElementById("noResultsRow");
  if (visibleRows === 0 && filter.length > 0) {
    if (!noResultsRow) {
      const tbody = document.querySelector("#productsTable tbody");
      const newRow = document.createElement("tr");
      newRow.id = "noResultsRow";
      newRow.innerHTML = '<td colspan="6" style="text-align: center; padding: 20px; color: #6b7280;">No products found matching your search.</td>';
      tbody.appendChild(newRow);
    }
  } else if (noResultsRow) {
    noResultsRow.remove();
  }
}

const rowsPerPage = 10;
let currentPage = 1;

function paginateTable() {
  const rows = document.querySelectorAll("#productsTable tbody tr:not(#noResultsRow)");
  const totalPages = Math.ceil(rows.length / rowsPerPage);
  const paginationContainer = document.getElementById("pagination");

  rows.forEach((row, index) => {
    row.style.display =
      index >= (currentPage - 1) * rowsPerPage &&
      index < currentPage * rowsPerPage
        ? ""
        : "none";
  });

  if (paginationContainer) {
    paginationContainer.innerHTML = "";
    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement("button");
      btn.innerText = i;
      btn.classList.add("page-link");
      btn.classList.toggle("active", i === currentPage);
      btn.addEventListener("click", () => {
        currentPage = i;
        paginateTable();
      });
      paginationContainer.appendChild(btn);
    }
  }
}

// Enhanced error handling for page load
window.addEventListener("load", () => {
  try {
    paginateTable();
    
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        currentPage = 1;
        filterTable();
        paginateTable();
      });
    }
  } catch (error) {
    console.error("Error initializing page:", error);
    Swal.fire({
      icon: 'error',
      title: 'Initialization Error',
      text: 'There was an error loading the page. Please refresh and try again.',
      confirmButtonColor: '#ef4444'
    });
  }
});

// Global error handler for uncaught errors
window.addEventListener('error', function(event) {
  console.error('Global error:', event.error);
  Swal.fire({
    icon: 'error',
    title: 'Unexpected Error',
    text: 'An unexpected error occurred. Please refresh the page and try again.',
    confirmButtonColor: '#ef4444'
  });
});

// Handle network errors
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