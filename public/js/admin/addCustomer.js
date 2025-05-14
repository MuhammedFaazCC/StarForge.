document.addEventListener("DOMContentLoaded", () => {
  const togglePassword = document.querySelector(".toggle-password");
  const passwordInput = document.getElementById("password");
  const toggleText = togglePassword.querySelector(".toggle-text");
  togglePassword.addEventListener("click", () => {
    const isShown = togglePassword.dataset.shown === "true";
    passwordInput.type = isShown ? "password" : "text";
    togglePassword.dataset.shown = !isShown;
    togglePassword.setAttribute(
      "aria-label",
      isShown ? "Show password" : "Hide password"
    );
    toggleText.textContent = isShown ? "Show" : "Hide";
  });

  const addCustomerForm = document.getElementById("addCustomerForm");
  addCustomerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(addCustomerForm);
    const customerData = {
      fullName: formData.get("fullName").trim(),
      email: formData.get("email").trim(),
      mobile: formData.get("mobile").trim(),
      password: formData.get("password") || undefined,
      orders: parseInt(formData.get("orders")) || 0,
      isBlocked: formData.get("isBlocked") === "on",
    };

    if (customerData.fullName.length < 2 || customerData.fullName.length > 50) {
      alert("Full name must be between 2 and 50 characters");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(customerData.email)) {
      alert("Please enter a valid email address");
      return;
    }
    if (!/^\+?[0-9]{10,15}$/.test(customerData.mobile)) {
      alert("Mobile number must be 10-15 digits, optionally starting with +");
      return;
    }
    if (customerData.password && customerData.password.length < 8) {
      alert("Password must be at least 8 characters");
      return;
    }

    try {
      const response = await fetch("/admin/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(customerData),
      });

      if (response.ok) {
        window.location.href = "/admin/customers";
      } else {
        const error = await response.json();
        alert(error.message || "Error adding customer");
      }
    } catch (error) {
      alert("Network error");
    }
  });
});
