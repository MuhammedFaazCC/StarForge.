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
    let searchTimeout = null;

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
            sortCustomers();
            paginateTable();
        } catch (error) {
            console.error('Error fetching customers:', error);
            showToast('error', 'Failed to load customers');
        } finally {
            tableBody.classList.remove('loading');
        }
    }

    // Helper function for showing toast notifications
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

    // Handle block/unblock button clicks
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

                if (!result.isConfirmed) return;

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

                        // Update customers array
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

    // IMPROVED: Search input handling with robust debouncing
    if (searchInput) {
        // Apply any initial value that might be in the input
        const initialSearchValue = searchInput.value.trim();
        if (initialSearchValue) {
            // Wait a moment to ensure DOM is fully loaded before performing initial search
            setTimeout(() => performSearch(initialSearchValue), 100);
        }
        
        // Set up the event listener with proper debouncing
        searchInput.addEventListener("input", () => {
            // Clear any existing timeout
            if (searchTimeout) {
                clearTimeout(searchTimeout);
                searchTimeout = null;
            }
            
            // Set new timeout for debouncing
            const searchTerm = searchInput.value.trim();
            // Show loading indicator
            tableBody.classList.add('loading');
            
            searchTimeout = setTimeout(() => {
                tableBody.classList.remove('loading');
                performSearch(searchTerm);
            }, 300);
        });
        
        // Also handle enter key for immediate search
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

    // IMPROVED: Extract search functionality to separate function
    function performSearch(searchTerm) {
        console.log("Performing search with term:", searchTerm);
        currentPage = 1; // Reset to first page on new search
        
        // Direct search the customers array and render results
        const filteredCustomers = filterCustomers(searchTerm);
        console.log(`Found ${filteredCustomers.length} matching customers`);
        
        // Reset pagination and display results
        paginateTable(searchTerm);
        
        // Update URL with search param for bookmarking/sharing
        const url = new URL(window.location);
        if (searchTerm) {
            url.searchParams.set('query', searchTerm);
        } else {
            url.searchParams.delete('query');
        }
        history.replaceState({}, '', url);
    }
    
    // Helper function to filter customers by search term
    function filterCustomers(searchTerm) {
        if (!searchTerm) return customers;
        
        const term = searchTerm.toLowerCase();
        return customers.filter(customer => {
            // Safety checks for null/undefined properties
            const fullName = (customer.fullName || '').toLowerCase();
            const email = (customer.email || '').toLowerCase();
            
            return fullName.includes(term) || email.includes(term);
        });
    }

    // Clear search results
    if (clearResultsBtn) {
        clearResultsBtn.addEventListener("click", () => {
            if (searchInput) {
                searchInput.value = "";
                performSearch(""); // Explicitly search with empty string
                
                // Visually indicate the search has been cleared
                searchInput.focus();
                showToast('info', 'Search cleared');
            }
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
                if (sortIcon) {
                    sortIcon.classList.add(currentSort.order);
                }

                sortCustomers();
                currentPage = 1;
                paginateTable();
            });
        });
    }

    // Sort customers array
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
            
            // String comparison for text fields
            return currentSort.order === 'asc'
                ? String(aValue).localeCompare(String(bValue))
                : String(bValue).localeCompare(String(aValue));
        });
    }

    // IMPROVED: Paginate table with more robust filtering
    function paginateTable(overrideFilter) {
        // Use provided filter or get from search input
        const filter = overrideFilter !== undefined 
            ? overrideFilter.toLowerCase() 
            : (searchInput ? searchInput.value.trim().toLowerCase() : '');
        
        // Apply filtering with improved case handling
        const filteredCustomers = filterCustomers(filter);
        console.log(`Pagination: ${filteredCustomers.length} customers after filtering`);

        const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / rowsPerPage));
        
        // Ensure current page is within valid range
        if (currentPage > totalPages) {
            currentPage = totalPages;
        }
        
        const startIndex = (currentPage - 1) * rowsPerPage;
        const rows = filteredCustomers.slice(startIndex, startIndex + rowsPerPage);
        console.log(`Displaying ${rows.length} rows for page ${currentPage}`);

        renderTableRows(rows, filter);
        renderPagination(totalPages);
        
        // Show or hide the clear button depending on whether there's a filter
        if (clearResultsBtn) {
            clearResultsBtn.style.display = filter ? 'inline-block' : 'none';
        }
    }
    
    // IMPROVED: Separate table rendering function
    function renderTableRows(rows, filter) {
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
                    <td>${customer.fullName || ''}</td>
                    <td>${customer.email || ''}</td>
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
    
    // IMPROVED: Separate pagination rendering function
    function renderPagination(totalPages) {
        paginationContainer.innerHTML = '';
        
        // Don't show pagination if there's only one page
        if (totalPages <= 1) return;
        
        // Add Previous button if not on first page
        if (currentPage > 1) {
            addPaginationButton('«', currentPage - 1);
        }
        
        // Logic for showing limited number of pages
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        
        // Adjust start if we're near the end
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }
        
        // First page
        if (startPage > 1) {
            addPaginationButton(1, 1);
            if (startPage > 2) {
                addEllipsis();
            }
        }
        
        // Page numbers
        for (let i = startPage; i <= endPage; i++) {
            addPaginationButton(i, i, i === currentPage);
        }
        
        // Last page
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                addEllipsis();
            }
            addPaginationButton(totalPages, totalPages);
        }
        
        // Add Next button if not on last page
        if (currentPage < totalPages) {
            addPaginationButton('»', currentPage + 1);
        }
    }
    
    // Helper for pagination buttons
    function addPaginationButton(text, page, isActive = false) {
        const btn = document.createElement('button');
        btn.innerText = text;
        if (isActive) {
            btn.classList.add('active');
        }
        btn.classList.add('btn-arrow');
        btn.addEventListener('click', () => {
            currentPage = page;
            paginateTable();
        });
        paginationContainer.appendChild(btn);
    }
    
    // Helper for pagination ellipsis
    function addEllipsis() {
        const span = document.createElement('span');
        span.innerText = '...';
        span.classList.add('pagination-ellipsis');
        paginationContainer.appendChild(span);
    }

    // Initial fetch
    fetchAllCustomers();
});