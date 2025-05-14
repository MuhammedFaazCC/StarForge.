document.addEventListener("DOMContentLoaded", () => {
    let allRows = [...document.querySelectorAll(".banners-table tbody tr")];

    const searchInput = document.querySelector(".search-bar input");
    const sortSelect = document.querySelector(".sort-select");
    const filterTabs = document.querySelectorAll(".filter-tab");
    const addButton = document.querySelector(".add-banner-btn");
    const tbody = document.querySelector(".banners-table tbody");

    const itemsPerPage = 5;
    let currentFilter = "ALL";
    let currentPage = 1;

    const parseDate = str => {
        const [d, m, y] = str.split("/");
        return new Date(`${y}-${m}-${d}`);
    };

    function createPagination(totalItems) {
        const pages = Math.ceil(totalItems / itemsPerPage);
        let paginationDiv = document.querySelector(".pagination");
        if (paginationDiv) paginationDiv.remove();

        paginationDiv = document.createElement("div");
        paginationDiv.className = "pagination";

        for (let i = 1; i <= pages; i++) {
            const btn = document.createElement("button");
            btn.textContent = i;
            btn.classList.add("page-btn");
            if (i === currentPage) btn.classList.add("active");

            btn.addEventListener("click", () => {
                currentPage = i;
                renderTable();
            });

            paginationDiv.appendChild(btn);
        }

        tbody.parentElement.appendChild(paginationDiv);
    }

    function filterAndSearch() {
        return allRows.filter(row => {
            const title = row.children[1].textContent.toLowerCase();
            const status = row.children[4].textContent.toUpperCase();
            const matchesSearch = title.includes(searchInput.value.toLowerCase());
            const matchesFilter = currentFilter === "ALL" || status === currentFilter;
            return matchesSearch && matchesFilter;
        });
    }

    function sortRows(rows) {
        const sorted = [...rows].sort((a, b) => {
            const endA = parseDate(a.children[3].textContent);
            const endB = parseDate(b.children[3].textContent);
            const startA = parseDate(a.children[2].textContent);
            const startB = parseDate(b.children[2].textContent);

            switch (sortSelect.value) {
                case "more days left":
                    return endB - endA;
                case "less days left":
                    return endA - endB;
                case "Last added first":
                    return startB - startA;
                default:
                    return 0;
            }
        });
        return sorted;
    }

    function renderTable() {
        const filtered = filterAndSearch();
        const sorted = sortRows(filtered);

        const start = (currentPage - 1) * itemsPerPage;
        const paginated = sorted.slice(start, start + itemsPerPage);

        tbody.innerHTML = "";
        paginated.forEach(row => tbody.appendChild(row));

        bindRowEvents(paginated);
        createPagination(filtered.length);
    }

    function bindRowEvents(rows) {
        rows.forEach(row => {
            const checkIcon = row.querySelector(".fa-check");
            const trashIcon = row.querySelector(".fa-trash");

            if (checkIcon) {
                checkIcon.addEventListener("click", () => {
                    const statusCell = row.children[4];
                    statusCell.textContent = statusCell.textContent === "Active" ? "Inactive" : "Active";
                    renderTable();
                });
            }

            if (trashIcon) {
                trashIcon.addEventListener("click", () => {
                    allRows = allRows.filter(r => r !== row);
                    row.remove();
                    renderTable();
                });
            }
        });
    }

    searchInput.addEventListener("input", () => {
        currentPage = 1;
        renderTable();
    });

    sortSelect.addEventListener("change", () => {
        renderTable();
    });

    filterTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            filterTabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            currentFilter = tab.textContent.toUpperCase();
            currentPage = 1;
            renderTable();
        });
    });

    addButton.addEventListener("click", () => {
        const title = prompt("Enter Banner Title:");
        const startingDate = prompt("Enter Starting Date (dd/mm/yyyy):");
        const endingDate = prompt("Enter Ending Date (dd/mm/yyyy):");
        const status = prompt("Enter Status (Active/Scheduled/Expired):");

        if (!title || !startingDate || !endingDate || !status) return alert("All fields required!");

        const newRow = document.createElement("tr");
        newRow.innerHTML = `
            <td><img src="https://via.placeholder.com/50" alt="Banner Image" /></td>
            <td>${title}</td>
            <td>${startingDate}</td>
            <td>${endingDate}</td>
            <td>${status}</td>
            <td>
                <i class="fas fa-check text-success action-icon"></i>
                <i class="fas fa-trash text-danger action-icon"></i>
            </td>
        `;

        allRows.push(newRow);
        currentPage = 1;
        renderTable();
    });

    renderTable();
});
