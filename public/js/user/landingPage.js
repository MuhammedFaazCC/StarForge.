document.addEventListener("DOMContentLoaded", () => {
  if (window.__NAV_INITED__) return;
  window.__NAV_INITED__ = true;
  console.log("JS Loaded");

  const hamburger = document.querySelector("#hamburgerMenu");
  const sidebar = document.querySelector(".sidebar");
  const sidebarOverlay = document.querySelector("#sidebarOverlay");
  const profileToggle = document.querySelector(".profile-toggle");
  const profileDropdown = document.querySelector(".profile-dropdown");
  const logoutBtn = document.getElementById("logout-btn");

  console.log("Elements found:", {
    hamburger: !!hamburger,
    sidebar: !!sidebar,
    profileToggle: !!profileToggle,
    profileDropdown: !!profileDropdown
  });

  function toggleSidebar() {
    if (sidebar && sidebarOverlay) {
      const isOpen = sidebar.classList.contains("open");
      
      if (isOpen) {
        sidebar.classList.remove("open");
        sidebarOverlay.classList.remove("active");
        sidebar.setAttribute("aria-hidden", "true");
      } else {
        sidebar.classList.add("open");
        sidebarOverlay.classList.add("active");
        sidebar.setAttribute("aria-hidden", "false");
      }
      
      console.log("Sidebar toggled, is open:", !isOpen);
    }
  }

  function toggleProfileDropdown() {
    if (profileDropdown) {
      const isOpen = profileDropdown.classList.contains("show");
      profileDropdown.classList.toggle("show");
      console.log("Profile dropdown toggled, is open:", !isOpen);
    }
  }

  if (hamburger) {
    hamburger.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("Hamburger clicked");
      toggleSidebar();
    });
  } else {
    console.error("Hamburger menu not found!");
  }

  if (profileToggle) {
    profileToggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("Profile toggle clicked");
      toggleProfileDropdown();
    });
  } else {
    console.error("Profile toggle not found!");
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener("click", () => {
      console.log("Overlay clicked");
      toggleSidebar();
    });
  }

  document.addEventListener("click", (e) => {
    if (
      sidebar &&
      sidebar.classList.contains("open") &&
      !sidebar.contains(e.target) &&
      !(hamburger && hamburger.contains(e.target))
    ) {
      console.log("Closing sidebar - clicked outside");
      toggleSidebar();
    }

    if (
      profileDropdown &&
      profileDropdown.classList.contains("show") &&
      !profileDropdown.contains(e.target) &&
      !(profileToggle && profileToggle.contains(e.target))
    ) {
      console.log("Closing profile dropdown - clicked outside");
      profileDropdown.classList.remove("show");
    }
  });

  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();

      if (typeof Swal !== 'undefined') {
        Swal.fire({
          title: "Are you sure you want to logout?",
          icon: "warning",
          showCancelButton: true,
          confirmButtonColor: "#fca120",
          cancelButtonColor: "#d33",
          confirmButtonText: "Yes, logout",
        }).then((result) => {
          if (result.isConfirmed) {
            window.location.href = "/logout";
          }
        });
      } else {
        if (confirm("Are you sure you want to logout?")) {
          window.location.href = "/logout";
        }
      }
    });
  }
  const retroBtn = document.querySelector(".retro-promo .explore");
  const offroadBtn = document.querySelector(".offroad-promo .shop-now");

  if (retroBtn) {
    retroBtn.addEventListener("click", () => {
      window.location.href = "/products?category=Classic Wheels";
    });
  }

  if (offroadBtn) {
    offroadBtn.addEventListener("click", () => {
      window.location.href = "/products?category=Off-Road";
    });
  }
});