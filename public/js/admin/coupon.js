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
