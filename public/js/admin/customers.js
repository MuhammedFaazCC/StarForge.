document.addEventListener("DOMContentLoaded", () => {
    const tableBody = document.getElementById("customersTableBody");
    const searchInput = document.getElementById("searchInput");
    const clearResultsBtn = document.getElementById("clearResults");
    const paginationContainer = document.getElementById("pagination");

    let customers = [];
    let currentPage = 1;
    const currentSort = {
        field: 'createdAt',
        order: 'desc'
    };
    let searchTimeout = null;
    let currentSearchTerm = '';

    async function fetchCustomers(page = 1, searchQuery = '') {
        try {
            tableBody.classList.add('loading');
            
            let url = '/admin/customers';
            const params = new URLSearchParams();
            
            if (searchQuery.trim()) {
                url = '/admin/customers/search';
                params.set('q', searchQuery.trim());
            }
            
            params.set('page', page);
            params.set('sortField', currentSort.field);
            params.set('sortOrder', currentSort.order);
            
            const response = await fetch(`${url}?${params}`, {
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
            renderTableRows(customers, searchQuery);
            renderPagination(data.pagination);
            
        } catch (error) {
            console.error('Error fetching customers:', error);
            showToast('error', 'Error', 'Failed to load customers');
        } finally {
            tableBody.classList.remove('loading');
        }
    }

    function showToast(icon, title, text = '') {
        Swal.fire({
            icon,
            title,
            text,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000
        });
    }

    if (tableBody) {
        tableBody.addEventListener("click", async (event) => {
            const target = event.target;

            if (target.classList.contains("btn-block") || target.classList.contains("btn-unblock")) {
                const customerId = target.dataset.id;
                const action = target.dataset.action;

                const result = await Swal.fire({
                    title: `Are you sure you want to ${action} this user?`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    confirmButtonText: `Yes, ${action}!`
                });

                if (!result.isConfirmed) {return;}

                try {
                    const res = await fetch(`/admin/customers/${customerId}/${action}`, {
                        method: 'PATCH',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({})
                    });

                    const responseData = await res.json();

                    if (res.ok && responseData.success) {
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

                        const customer = customers.find(c => c._id === customerId);
                        if (customer) {
                            customer.isBlocked = action === 'block';
                        }

                        showToast('success', responseData.message);
                    } else {
                        showToast('error', 'Error', responseData.message || 'Something went wrong.');
                    }
                } catch (error) {
                    console.error(`Error ${action}ing user:`, error);
                    showToast('error', 'Error', 'An error occurred. Please try again.');
                }
            }
        });
    }

    if (searchInput) {
        const initialSearchValue = searchInput.value.trim();
        if (initialSearchValue) {
            setTimeout(() => performSearch(initialSearchValue), 100);
        }
        
        searchInput.addEventListener("input", () => {
            if (searchTimeout) {
                clearTimeout(searchTimeout);
                searchTimeout = null;
            }
            
            const searchTerm = searchInput.value.trim();
            tableBody.classList.add('loading');
            
            searchTimeout = setTimeout(() => {
                tableBody.classList.remove('loading');
                performSearch(searchTerm);
            }, 300);
        });
        
        searchInput.addEventListener("keydown", (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (searchTimeout) {
                    clearTimeout(searchTimeout);
                    searchTimeout = null;
                }
                performSearch(searchInput.value.trim());
            }
        });
    }

    function performSearch(searchTerm) {
        console.log("Performing search with term:", searchTerm);
        currentPage = 1;
        currentSearchTerm = searchTerm;
        
        fetchCustomers(1, searchTerm);
        
        const url = new URL(window.location);
        if (searchTerm) {
            url.searchParams.set('query', searchTerm);
        } else {
            url.searchParams.delete('query');
        }
        history.replaceState({}, '', url);
    }
    
    function highlightSearchTerm(text, searchTerm) {
        if (!searchTerm || !text) {return text;}
        
        const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    if (clearResultsBtn) {
        clearResultsBtn.addEventListener("click", () => {
            if (searchInput) {
                searchInput.value = "";
                performSearch("");
                
                searchInput.focus();
                showToast('info', 'Search cleared');
            }
        });
    }

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
                if (sortIcon) {
                    sortIcon.classList.add(currentSort.order);
                }

                sortCustomers();
                currentPage = 1;
                paginateTable();
            });
        });
    }

    function sortCustomers() {
        customers.sort((a, b) => {
            const aValue = a[currentSort.field] !== undefined ? a[currentSort.field] : '';
            const bValue = b[currentSort.field] !== undefined ? b[currentSort.field] : '';
            
            if (currentSort.field === 'createdAt') {
                return currentSort.order === 'asc'
                    ? new Date(aValue) - new Date(bValue)
                    : new Date(bValue) - new Date(aValue);
            }
            
            if (currentSort.field === 'orders') {
                const aNum = parseInt(aValue) || 0;
                const bNum = parseInt(bValue) || 0;
                return currentSort.order === 'asc' ? aNum - bNum : bNum - aNum;
            }
            
            return currentSort.order === 'asc'
                ? String(aValue).localeCompare(String(bValue))
                : String(bValue).localeCompare(String(aValue));
        });
    }

    // This function is no longer needed as pagination is handled by the backend
    // Keeping for compatibility with sorting functionality
    function paginateTable() {
        fetchCustomers(currentPage, currentSearchTerm);
    }
    
    function renderTableRows(rows, searchTerm = '') {
        tableBody.innerHTML = '';

        if (rows.length === 0) {
            const noResultsRow = document.createElement('tr');
            noResultsRow.className = 'no-results';
            noResultsRow.innerHTML = `<td colspan="6">${searchTerm ? 'No customers match your search' : 'No customers found'}</td>`;
            tableBody.appendChild(noResultsRow);
        } else {
            rows.forEach(customer => {
                const row = document.createElement('tr');
                row.dataset.id = customer._id;
                
                // Apply highlighting if search term exists
                const highlightedName = highlightSearchTerm(customer.fullName || '', searchTerm);
                const highlightedEmail = highlightSearchTerm(customer.email || '', searchTerm);
                const highlightedMobile = highlightSearchTerm(customer.mobile || '', searchTerm);
                
                row.innerHTML = `
                    <td>${highlightedName}</td>
                    <td>${highlightedEmail}</td>
                    <td>${highlightedMobile || 'N/A'}</td>
                    <td>${customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : ''}</td>
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
    }
    
    function renderPagination(paginationData) {
        paginationContainer.innerHTML = '';
        
        if (!paginationData || paginationData.totalPages <= 1) {return;}
        
        const { currentPage: page, totalPages } = paginationData;
        currentPage = page;
        
        if (currentPage > 1) {
            addPaginationButton('«', currentPage - 1);
        }
        
        let startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, startPage + 4);
        
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }
    
        if (startPage > 1) {
            addPaginationButton(1, 1);
            if (startPage > 2) {
                addEllipsis();
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            addPaginationButton(i, i, i === currentPage);
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                addEllipsis();
            }
            addPaginationButton(totalPages, totalPages);
        }
        
        if (currentPage < totalPages) {
            addPaginationButton('»', currentPage + 1);
        }
    }
    
    function addPaginationButton(text, page, isActive = false) {
        const btn = document.createElement('button');
        btn.innerText = text;
        if (isActive) {
            btn.classList.add('active');
        }
        btn.classList.add('btn-arrow');
        btn.addEventListener('click', () => {
            currentPage = page;
            fetchCustomers(page, currentSearchTerm);
        });
        paginationContainer.appendChild(btn);
    }
    
    function addEllipsis() {
        const span = document.createElement('span');
        span.innerText = '...';
        span.classList.add('pagination-ellipsis');
        paginationContainer.appendChild(span);
    }

    // Initialize with search term from URL if present
    const urlParams = new URLSearchParams(window.location.search);
    const initialSearchTerm = urlParams.get('query') || '';
    if (initialSearchTerm && searchInput) {
        searchInput.value = initialSearchTerm;
        currentSearchTerm = initialSearchTerm;
    }
    
    fetchCustomers(1, currentSearchTerm);
});