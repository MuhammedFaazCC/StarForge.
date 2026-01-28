document.addEventListener('DOMContentLoaded', () => {
    const otpInput = document.getElementById('otp');
    const resendBtn = document.getElementById('resendOtpBtn');
    const resendStatus = document.getElementById('resendStatus');

    if (otpInput) {
        otpInput.addEventListener('input', () => {
            const otpPattern = /^[0-9]{0,6}$/;
            if (!otpPattern.test(otpInput.value)) {
                otpInput.style.border = '1px solid #ff4444';
                otpInput.value = otpInput.value.slice(0, 6).replace(/[^0-9]/g, '');
            } else {
                otpInput.style.border = '1px solid #ddd';
            }
        });
    }

    // Resend OTP handling with 30s cooldown
    let cooldownTimer = null;
    const COOLDOWN_SECONDS = 30;

    function setCooldown(seconds) {
      let remaining = seconds;
      if (resendBtn) {
        resendBtn.disabled = true;
        resendBtn.style.opacity = '0.6';
        resendBtn.style.cursor = 'not-allowed';
      }
      if (resendStatus) {resendStatus.textContent = `You can resend in ${remaining}s`;}

      clearInterval(cooldownTimer);
      cooldownTimer = setInterval(() => {
        remaining -= 1;
        if (resendStatus) {resendStatus.textContent = `You can resend in ${remaining}s`;}
        if (remaining <= 0) {
          clearInterval(cooldownTimer);
          if (resendBtn) {
            resendBtn.disabled = false;
            resendBtn.style.opacity = '';
            resendBtn.style.cursor = '';
          }
          if (resendStatus) {resendStatus.textContent = '';}
        }
      }, 1000);
    }

async function resendOtp() {
  try {
    if (resendBtn) {
      resendBtn.disabled = true;
      resendBtn.style.opacity = "0.6";
      resendBtn.style.cursor = "not-allowed";
    }

    if (resendStatus) {
      resendStatus.textContent = "Sending...";
    }

    const res = await fetch("/resend-otp", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    let data = null;

    try {
      data = await res.json();
    } catch (err) {
      console.error("OTP JSON parse error:", err);
    }

    if (res.ok && data && data.success) {
      if (resendStatus) {
        resendStatus.textContent = "OTP resent successfully!";
      }

      setTimeout(() => setCooldown(COOLDOWN_SECONDS), 300);
    } else {
      const msg = data?.message || "Failed to resend OTP";

      if (resendStatus) {
        resendStatus.textContent = msg;
      }

      if (resendBtn) {
        resendBtn.disabled = false;
        resendBtn.style.opacity = "";
        resendBtn.style.cursor = "";
      }
    }
  } catch (err) {
    console.error("Resend OTP network error:", err);

    if (resendStatus) {
      resendStatus.textContent = "Network error. Please try again.";
    }

    if (resendBtn) {
      resendBtn.disabled = false;
      resendBtn.style.opacity = "";
      resendBtn.style.cursor = "";
    }
  }
}

    if (resendBtn) {
      resendBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // do not start cooldown until success
        resendOtp();
      });
    }
});