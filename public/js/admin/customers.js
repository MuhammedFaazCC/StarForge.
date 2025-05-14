document.addEventListener('DOMContentLoaded', () => {
    // Side panel toggle
    const toggleBtn = document.querySelector('.toggle-btn');
    const sidePanel = document.querySelector('.side-panel');
    toggleBtn.addEventListener('click', () => {
        sidePanel.classList.toggle('visible');
        sidePanel.classList.toggle('hidden');
    });

    // Block/Unblock buttons
    document.querySelectorAll('.btn-action').forEach(button => {
        button.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            const action = e.target.dataset.action;
            const confirmMessage = action === 'block' 
                ? 'Are you sure you want to block this user?'
                : 'Are you sure you want to unblock this user?';

            if (confirm(confirmMessage)) {
                try {
                    const response = await fetch(`/admin/customers/${id}/${action}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });

                    if (response.ok) {
                        window.location.reload();
                    } else {
                        alert('Error performing action');
                    }
                } catch (error) {
                    alert('Network error');
                }
            }
        });
    });

    // Clear results
    document.getElementById('clearResults').addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear all customer results? This cannot be undone.')) {
            try {
                const response = await fetch('/admin/customers/clear', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    window.location.reload();
                } else {
                    alert('Error clearing results');
                }
            } catch (error) {
                alert('Network error');
            }
        }
    });

    // Search functionality
    document.getElementById('searchInput').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('.customers-table tbody tr:not(.no-results)');

        rows.forEach(row => {
            const name = row.cells[0].textContent.toLowerCase();
            const email = row.cells[1].textContent.toLowerCase();
            row.style.display = (name.includes(searchTerm) || email.includes(searchTerm)) ? '' : 'none';
        });

        const visibleRows = Array.from(rows).filter(row => row.style.display !== 'none');
        const noResultsRow = document.querySelector('.no-results');
        if (visibleRows.length === 0 && noResultsRow) {
            noResultsRow.style.display = 'table-row';
        } else if (noResultsRow) {
            noResultsRow.style.display = 'none';
        }
    });

    // Pagination
    document.getElementById('prevPage')?.addEventListener('click', () => {
        const currentPage = parseInt('<%= currentPage %>');
        if (currentPage > 1) {
            window.location.href = `/admin/customers?page=${currentPage - 1}`;
        }
    });

    document.getElementById('nextPage')?.addEventListener('click', () => {
        const currentPage = parseInt('<%= currentPage %>');
        const totalPages = parseInt('<%= totalPages %>');
        if (currentPage < totalPages) {
            window.location.href = `/admin/customers?page=${currentPage + 1}`;
        }
    });

    // Sorting
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', () => {
            const sortKey = header.dataset.sort;
            const currentUrl = new URL(window.location);
            const currentSort = currentUrl.searchParams.get('sort') || 'createdAt';
            const currentOrder = currentUrl.searchParams.get('order') || 'desc';

            const newOrder = (currentSort === sortKey && currentOrder === 'desc') ? 'asc' : 'desc';
            currentUrl.searchParams.set('sort', sortKey);
            currentUrl.searchParams.set('order', newOrder);

            window.location.href = currentUrl.toString();
        });
    });
});