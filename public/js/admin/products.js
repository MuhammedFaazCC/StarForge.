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

window.deleteProduct = async function (productId) {
  const result = await Swal.fire({
    title: 'Delete product?',
    text: 'This action cannot be undone.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'Delete',
  });

  if (!result.isConfirmed) return;

  try {
    const res = await fetch(`/admin/products/delete/${productId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Delete failed');
    }

    Swal.fire({
      icon: 'success',
      title: 'Deleted',
      text: data.message,
      timer: 2000,
      showConfirmButton: false
    });

    setTimeout(() => window.location.reload(), 1200);

  } catch (err) {
    console.error(err);
    Swal.fire({
      icon: 'error',
      title: 'Delete failed',
      text: err.message || 'Something went wrong'
    });
  }
};

window.toggleProductListing = async function (productId, checkbox) {
  const newState = checkbox.checked;

  try {
    const res = await fetch(`/admin/products/toggle-listing/${productId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ isListed: newState })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Failed to update listing");
    }

    checkbox.checked = data.isListed;

    // ✅ SUCCESS ALERT
    Swal.fire({
      icon: "success",
      title: data.isListed ? "Product Listed" : "Product Unlisted",
      text: data.message || "",
      timer: 1500,
      showConfirmButton: false,
      toast: true,
      position: "top-end"
    });

  } catch (err) {
    console.error(err);

    // revert UI
    checkbox.checked = !checkbox.checked;

    Swal.fire({
      icon: "error",
      title: "Update failed",
      text: err.message || "Could not update product listing status"
    });
  }
};


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