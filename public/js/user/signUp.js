document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("signupForm");
  const formError = document.getElementById("formError");

  const fieldErrors = {
    fullName: document.getElementById("fullNameError"),
    email: document.getElementById("emailError"),
    mobile: document.getElementById("mobileError"),
    password: document.getElementById("passwordError"),
    confirmPassword: document.getElementById("confirmPasswordError"),
    referralCode: document.getElementById("referralCodeError")
  };

  /* =========================
     HELPERS
  ========================= */

  function clearErrors() {
    if (formError) {
      formError.textContent = "";
      formError.style.display = "none";
    }
    Object.values(fieldErrors).forEach(el => {
      if (el) el.textContent = "";
    });
  }

  function showFieldError(field, message) {
    if (fieldErrors[field]) {
      fieldErrors[field].textContent = message;
    }
  }

  /* =========================
     PASSWORD TOGGLE (FIXED)
  ========================= */

  window.togglePassword = function (id) {
    const input = document.getElementById(id);
    if (!input) return;

    const icon = input.nextElementSibling?.querySelector("i");
    if (!icon) return;

    if (input.type === "password") {
      input.type = "text";
      icon.classList.remove("fa-eye");
      icon.classList.add("fa-eye-slash");
    } else {
      input.type = "password";
      icon.classList.remove("fa-eye-slash");
      icon.classList.add("fa-eye");
    }
  };

  /* =========================
     VALIDATION
  ========================= */

  function validate(payload) {
    let valid = true;

    // Full Name
    if (!payload.fullName || payload.fullName.trim().length < 3) {
      showFieldError("fullName", "Full name must be at least 3 characters.");
      valid = false;
    } else if (!/^[A-Za-z\s]+$/.test(payload.fullName)) {
      showFieldError("fullName", "Full name can contain only letters and spaces.");
      valid = false;
    }

    // Email
    if (!payload.email) {
      showFieldError("email", "Email is required.");
      valid = false;
    } else if (!/^\S+@\S+\.\S+$/.test(payload.email)) {
      showFieldError("email", "Enter a valid email address.");
      valid = false;
    }

    // Mobile
    if (!payload.mobile) {
      showFieldError("mobile", "Mobile number is required.");
      valid = false;
    } else if (!/^[0-9]{10}$/.test(payload.mobile)) {
      showFieldError("mobile", "Mobile number must be exactly 10 digits.");
      valid = false;
    }

    // Password
    if (!payload.password) {
      showFieldError("password", "Password is required.");
      valid = false;
    } else if (
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/.test(payload.password)
    ) {
      showFieldError(
        "password",
        "Password must be at least 8 characters and include uppercase, lowercase, number, and special character."
      );
      valid = false;
    }

    // Confirm Password
    if (!payload.confirmPassword) {
      showFieldError("confirmPassword", "Please confirm your password.");
      valid = false;
    } else if (payload.password !== payload.confirmPassword) {
      showFieldError("confirmPassword", "Passwords do not match.");
      valid = false;
    }

    // Referral Code (optional)
    if (
      payload.referralCode &&
      !/^[A-Za-z0-9]{6,12}$/.test(payload.referralCode)
    ) {
      showFieldError(
        "referralCode",
        "Referral code must be 6–12 alphanumeric characters."
      );
      valid = false;
    }

    return valid;
  }

  /* =========================
     FORM SUBMIT
  ========================= */

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors();

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    if (!validate(payload)) return;

    try {
      const res = await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      let data;
      const contentType = res.headers.get("content-type");

      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        throw new Error("Invalid server response");
      }

      if (!res.ok || !data.success) {
        if (data.field && fieldErrors[data.field]) {
          showFieldError(data.field, data.message || "Invalid input");
          return;
        }

        if (formError) {
          formError.textContent = data.message || "Registration failed.";
          formError.style.display = "block";
        }
        return;
      }

      // Success
      window.location.href = data.redirect || "/login";

    } catch (err) {
      console.error("SIGNUP ERROR:", err);
      if (formError) {
        formError.textContent =
          "Unable to complete signup. Please try again later.";
        formError.style.display = "block";
      }
    }
  });
});