document.addEventListener("DOMContentLoaded", () => {
    const tableBody = document.getElementById("customersTableBody");
    const searchInput = document.getElementById("searchInput");
    const clearResultsBtn = document.getElementById("clearResults");
    const paginationContainer = document.getElementById("pagination");

    let customers = []; // Store all customers
    const rowsPerPage = 8; // Match original backend limit
    let currentPage = 1;
    let currentSort = {
        field: 'createdAt',
        order: 'desc'
    };

    // Fetch all customers on load
    async function fetchAllCustomers() {
        try {
            tableBody.classList.add('loading');
            const response = await fetch('/admin/customers', {
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch customers: ${response.status}`);
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || 'Failed to fetch customers');
            }

            customers = data.customers;
            paginateTable();
        } catch (error) {
            console.error('Error fetching customers:', error);
            showAlert('error', 'Failed to load customers');
        } finally {
            tableBody.classList.remove('loading');
        }
    }

    // Handle block/unblock button clicks
    if (tableBody) {
        tableBody.addEventListener("click", async (event) => {
            const target = event.target;

            if (target.classList.contains("btn-block") || target.classList.contains("btn-unblock")) {
                const customerId = target.dataset.id;
                const action = target.dataset.action;
                const confirmMessage = action === 'block' 
                    ? 'Are you sure you want to block this user?' 
                    : 'Are you sure you want to unblock this user?';

                if (!confirm(confirmMessage)) return;

                try {
                    console.log(`Sending ${action} request for user ${customerId}`);
                    const res = await fetch(`/admin/customers/${customerId}/${action}`, {
                        method: 'PATCH',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({})
                    });

                    console.log(`Response status: ${res.status}`);

                    const result = await res.json();
                    console.log('Response data:', result);

                    if (res.ok && result.success) {
                        const row = target.closest("tr");
                        const statusCell = row.querySelector(".status");
                        const button = row.querySelector(".btn-action");

                        if (action === "block") {
                            statusCell.textContent = "Blocked";
                            statusCell.classList.remove("active");
                            statusCell.classList.add("blocked");

                            button.textContent = "Unblock";
                            button.classList.remove("btn-block");
                            button.classList.add("btn-unblock");
                            button.dataset.action = "unblock";
                        } else {
                            statusCell.textContent = "Active";
                            statusCell.classList.remove("blocked");
                            statusCell.classList.add("active");

                            button.textContent = "Block";
                            button.classList.remove("btn-unblock");
                            button.classList.add("btn-block");
                            button.dataset.action = "block";
                        }

                        // Update customers array
                        const customer = customers.find(c => c._id === customerId);
                        if (customer) {
                            customer.isBlocked = action === 'block';
                        }

                        showAlert('success', result.message);
                    } else {
                        showAlert('error', result.message || "Something went wrong.");
                    }
                } catch (error) {
                    console.error(`Error ${action}ing user:`, error);
                    showAlert('error', "An error occurred. Please try again.");
                }
            }
        });
    }

    // Search input handling
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            currentPage = 1;
            paginateTable();
        });
    }

    // Clear search results
    if (clearResultsBtn) {
        clearResultsBtn.addEventListener("click", () => {
            if (searchInput) {
                searchInput.value = "";
            }
            currentPage = 1;
            paginateTable();
        });
    }

    // Sortable table headers
    const sortableHeaders = document.querySelectorAll('.sortable');
    if (sortableHeaders) {
        sortableHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const field = header.dataset.sort;

                if (currentSort.field === field) {
                    currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSort.field = field;
                    currentSort.order = 'asc';
                }

                document.querySelectorAll('.sort-icon').forEach(icon => {
                    icon.classList.remove('asc', 'desc');
                });

                const sortIcon = header.querySelector('.sort-icon');
                sortIcon.classList.add(currentSort.order);

                sortCustomers();
                currentPage = 1;
                paginateTable();
            });
        });
    }

    // Sort customers array
    function sortCustomers() {
        customers.sort((a, b) => {
            const aValue = a[currentSort.field] || '';
            const bValue = b[currentSort.field] || '';
            if (currentSort.field === 'createdAt') {
                return currentSort.order === 'asc'
                    ? new Date(aValue) - new Date(bValue)
                    : new Date(bValue) - new Date(aValue);
            }
            return currentSort.order === 'asc'
                ? aValue.localeCompare(bValue)
                : bValue.localeCompare(aValue);
        });
    }

    // Paginate table
    function paginateTable() {
        const filter = searchInput ? searchInput.value.toLowerCase() : '';
        const filteredCustomers = filter
            ? customers.filter(customer =>
                customer.fullName.toLowerCase().includes(filter) ||
                customer.email.toLowerCase().includes(filter)
              )
            : customers;

        const totalPages = Math.ceil(filteredCustomers.length / rowsPerPage);
        const rows = filteredCustomers.slice(
            (currentPage - 1) * rowsPerPage,
            currentPage * rowsPerPage
        );

        tableBody.innerHTML = '';

        if (rows.length === 0) {
            const noResultsRow = document.createElement('tr');
            noResultsRow.className = 'no-results';
            noResultsRow.innerHTML = `<td colspan="6">${filter ? 'No customers match your search' : 'No customers found'}</td>`;
            tableBody.appendChild(noResultsRow);
        } else {
            rows.forEach(customer => {
                const row = document.createElement('tr');
                row.dataset.id = customer._id;
                row.innerHTML = `
                    <td>${customer.fullName}</td>
                    <td>${customer.email}</td>
                    <td>${new Date(customer.createdAt).toLocaleDateString()}</td>
                    <td>${customer.orders || 0}</td>
                    <td>
                        <span class="status ${customer.isBlocked ? 'blocked' : 'active'}">
                            ${customer.isBlocked ? 'Blocked' : 'Active'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-action ${customer.isBlocked ? 'btn-unblock' : 'btn-block'}"
                            data-id="${customer._id}"
                            data-action="${customer.isBlocked ? 'unblock' : 'block'}">
                            ${customer.isBlocked ? 'Unblock' : 'Block'}
                        </button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        }

        // Update pagination buttons
        paginationContainer.innerHTML = '';
        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.innerText = i;
            btn.classList.toggle('active', i === currentPage);
            btn.classList.add('btn-arrow');
            btn.addEventListener('click', () => {
                currentPage = i;
                paginateTable();
            });
            paginationContainer.appendChild(btn);
        }
    }

    // Show alert messages
    function showAlert(type, message) {
        const alertContainer = document.createElement('div');
        alertContainer.className = `alert ${type}`;
        alertContainer.textContent = message;

        const mainContent = document.querySelector('.customers-section');
        if (mainContent) {
            const sectionHeader = mainContent.querySelector('.section-header');
            if (sectionHeader) {
                mainContent.insertBefore(alertContainer, sectionHeader.nextSibling);
            } else {
                mainContent.prepend(alertContainer);
            }

            setTimeout(() => {
                alertContainer.remove();
            }, 3000);
        }
    }

    // Initial fetch
    fetchAllCustomers();
});