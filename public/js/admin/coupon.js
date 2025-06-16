const toggleBtn = document.querySelector(".toggle-btn");
const sidePanel = document.querySelector(".side-panel");
const mainContent = document.querySelector(".main-content");

if (toggleBtn && sidePanel && mainContent) {
  toggleBtn.addEventListener("click", () => {
    sidePanel.classList.toggle("visible");
    sidePanel.classList.toggle("hidden");
    mainContent.classList.toggle("expanded");
  });
}

document.querySelectorAll(".side-panel a").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    document
      .querySelectorAll(".side-panel a")
      .forEach((l) => l.classList.remove("active"));
    link.classList.add("active");
    window.location.href = link.href;
  });
});

const createCouponForm = document.getElementById("createCouponForm");

    const code = document.getElementById("code").value.trim().toUpperCase();
    const discount = parseFloat(document.getElementById("discount").value);
    const expiryDate = new Date(document.getElementById("expiryDate").value);
    const usageLimit = parseInt(document.getElementById("usageLimit").value);

    if (!code) {
      alert("Coupon code is required");
      return;
    }

    if (isNaN(discount) || discount < 0 || discount > 100) {
      alert("Discount must be between 0 and 100");
      return;
    }

    if (isNaN(expiryDate.getTime()) || expiryDate <= new Date()) {
      alert("Expiry date must be in the future");
      return;
    }

    if (isNaN(usageLimit) || usageLimit < 1) {
      alert("Usage limit must be a positive integer");
      return;
    }

    try {
      const response = await fetch("/admin/coupons/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, discount, expiryDate, usageLimit }),
      });
      const result = await response.json();

      if (result.success) {
        window.location.href = "/admin/coupons";
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error("Error creating coupon:", error);
      alert("Failed to create coupon");
    }

function deleteCoupon(couponId) {
  if (!confirm("Are you sure you want to delete this coupon?")) return;

  fetch(`/admin/coupons/delete/${couponId}`, {
    method: "DELETE",
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        window.location.reload();
      } else {
        alert(data.message);
      }
    })
    .catch((error) => {
      console.error("Error deleting coupon:", error);
      alert("Failed to delete coupon");
    });
}