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
            if (!confirm("Remove this offer?")) return;

            const categoryId = btn.dataset.id;
            btn.disabled = true;
            try {
                const res = await fetch(`/admin/categories/offer/${categoryId}`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                });
                const data = await res.json();
                if (data.success) {
                    location.reload();
                } else {
                    Swal.fire({
                      icon: 'error',
                      title: 'Remove Failed',
                      text: 'Failed to remove offer',
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

    document.querySelectorAll(".delete-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
            if (!confirm("Are you sure you want to delete this category?")) return;

            const categoryId = btn.dataset.id;
            btn.disabled = true;
            try {
                const res = await fetch(`/admin/categories/delete/${categoryId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                });
                const data = await res.json();
                if (data.success) {
                    location.reload();
                } else {
                    Swal.fire({
                      icon: 'error',
                      title: 'Delete Failed',
                      text: 'Failed to delete category',
                      confirmButtonText: 'OK',
                      confirmButtonColor: '#d33'
                    });
                }
            } catch (err) {
                Swal.fire({
                  icon: 'error',
                  title: 'Delete Error',
                  text: 'Error deleting category',
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