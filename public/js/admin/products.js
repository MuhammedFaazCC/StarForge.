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