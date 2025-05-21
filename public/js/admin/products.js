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
  if (confirm("Are you sure you want to delete this product?")) {
    fetch(`/admin/products/delete/${productId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => {
        if (res.ok) {
          alert("Product deleted successfully!");
          window.location.reload();
        } else {
          alert("Failed to delete product.");
        }
      })
      .catch((err) => {
        console.error(err);
        alert("An error occurred.");
      });
  }
}

function filterTable() {
  const input = document.getElementById("searchInput");
  const filter = input.value.toLowerCase();
  const rows = document.querySelectorAll("#productsTable tbody tr");

  rows.forEach((row) => {
    const nameCell = row.querySelector("td:nth-child(2)");
    if (nameCell) {
      const text = nameCell.textContent.toLowerCase();
      row.style.display = text.includes(filter) ? "" : "none";
    }
  });
}

const rowsPerPage = 10;
let currentPage = 1;

function paginateTable() {
  const rows = document.querySelectorAll("#productsTable tbody tr");
  const totalPages = Math.ceil(rows.length / rowsPerPage);
  const paginationContainer = document.getElementById("pagination");

  rows.forEach((row, index) => {
    row.style.display =
      index >= (currentPage - 1) * rowsPerPage &&
      index < currentPage * rowsPerPage
        ? ""
        : "none";
  });

  paginationContainer.innerHTML = "";
  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.innerText = i;
    btn.classList.toggle("active", i === currentPage);
    btn.addEventListener("click", () => {
      currentPage = i;
      paginateTable();
    });
    paginationContainer.appendChild(btn);
  }
}

window.addEventListener("load", () => {
  paginateTable();
  document.getElementById("searchInput").addEventListener("input", () => {
    currentPage = 1;
    paginateTable();
  });
});
