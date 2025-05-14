function togglePassword() {
  const passwordInput = document.getElementById("password");
  const toggleText = document.querySelector(".toggle-password");
  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    toggleText.textContent = "Hide";
  } else {
    passwordInput.type = "password";
    toggleText.textContent = "Show";
  }
}
