document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".status-toggle").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const categoryId = btn.dataset.id;
            btn.disabled = true;
            try {
                const res = await fetch("/admin/categories/toggle-status", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: categoryId }),
                });
                const data = await res.json();
                if (data.status === "success") {
                    btn.textContent = data.isActive ? "UNLIST" : "LIST";
                    btn.classList.toggle("active", data.isActive);
                    btn.classList.toggle("inactive", !data.isActive);
                } else {
                    Swal.fire({
                      icon: 'error',
                      title: 'Toggle Failed',
                      text: 'Failed to toggle status',
                      confirmButtonText: 'OK',
                      confirmButtonColor: '#d33'
                    });
                }
            } catch (err) {
                Swal.fire({
                  icon: 'error',
                  title: 'Toggle Error',
                  text: 'Error toggling status',
                  confirmButtonText: 'OK',
                  confirmButtonColor: '#d33'
                });
            }
            btn.disabled = false;
        });
    });

    function filterTable() {
        const input = document.getElementById("searchInput");
        const filter = input.value.toLowerCase();
        const rows = document.querySelectorAll("#categoriesTable tbody tr");
        const clearLink = document.querySelector(".clear-search");

        rows.forEach((row) => {
            const nameCell = row.querySelector("td:nth-child(1)");
            if (nameCell) {
                const text = nameCell.textContent.toLowerCase();
                row.style.display = text.includes(filter) ? "" : "none";
            }
        });
        if (clearLink) {
            clearLink.style.display = filter ? "inline-block" : "none";
        }
    }

    document.querySelectorAll(".offer-remove").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const result = await Swal.fire({
              title: 'Remove offer?',
              text: 'This will remove the category offer for this category.',
              icon: 'warning',
              showCancelButton: true,
              confirmButtonText: 'Yes, remove it',
              cancelButtonText: 'Cancel',
              confirmButtonColor: '#d33',
              cancelButtonColor: '#3085d6'
            });

            if (!result.isConfirmed) return;

            const categoryId = btn.dataset.id;
            btn.disabled = true;
            try {
                const res = await fetch(`/admin/categories/offer/${categoryId}`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                });
                const data = await res.json();
                if (data.success) {
                    await Swal.fire({
                      icon: 'success',
                      title: 'Offer Removed',
                      text: 'The category offer has been removed.',
                      confirmButtonText: 'OK',
                      confirmButtonColor: '#10b981'
                    });
                    location.reload();
                } else {
                    Swal.fire({
                      icon: 'error',
                      title: 'Remove Failed',
                      text: data.message || 'Failed to remove offer',
                      confirmButtonText: 'OK',
                      confirmButtonColor: '#d33'
                    });
                }
            } catch (err) {
                Swal.fire({
                  icon: 'error',
                  title: 'Remove Error',
                  text: 'Error removing offer',
                  confirmButtonText: 'OK',
                  confirmButtonColor: '#d33'
                });
            }
            btn.disabled = false;
        });
    });

    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        if (searchInput.value) {
            filterTable();
        }
        searchInput.addEventListener("input", filterTable);
    }
});