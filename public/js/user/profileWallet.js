
  document.getElementById("wallet-form").addEventListener("submit", async function (e) {
  e.preventDefault();

  const submitButton = document.getElementById("wallet-submit");
  const amountInput = document.getElementById("amount");
  const amount = parseFloat(amountInput.value);

  if (!amount || amount <= 0) {
    Swal.fire({
      icon: 'error',
      title: 'Invalid Amount',
      text: 'Enter valid amount',
      confirmButtonText: 'OK',
      confirmButtonColor: '#d33'
    });
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Processing...';
  }

  try {
    const res = await fetch("/wallet/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });

    const data = await res.json();
    if (!data.success) {
      Swal.fire({
        icon: 'error',
        title: 'Payment Failed',
        text: data.error || "Failed to initiate payment",
        confirmButtonText: 'OK',
        confirmButtonColor: '#d33'
      });
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Add Money";
      }
      return;
    }

    if (typeof Razorpay === 'undefined') {
      Swal.fire({
        icon: 'error',
        title: 'System Error',
        text: "Payment system is not loaded. Please refresh the page and try again.",
        confirmButtonText: 'OK',
        confirmButtonColor: '#d33'
      });
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Add Money";
      }
      return;
    }

    const options = {
      key: data.key || window.RAZORPAY_KEY,
      amount: data.amount,
      currency: "INR",
      name: "StarForge Wallet",
      description: "Wallet Top-up",
      order_id: data.orderId,
      handler: async function (response) {
        await fetch("/wallet/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
            amount,
          }),
        });

        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Wallet credited successfully!',
          timer: 2000,
          timerProgressBar: true,
          showConfirmButton: false,
          confirmButtonColor: '#28a745'
        });
        window.location.reload();
      },
      prefill: {
        name: window.USER_NAME || "Customer",
        email: window.USER_EMAIL || "",
      },
      theme: { color: "#28a745" },
      modal: {
        ondismiss: function () {
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = "Add Money";
          }
        }
      }
    };

    const rzp = new Razorpay(options);
    rzp.open();

  } catch (error) {
    console.error("Wallet Razorpay error:", error);
    Swal.fire({
      icon: 'error',
      title: 'Payment Error',
      text: 'Something went wrong while processing payment.',
      confirmButtonText: 'OK',
      confirmButtonColor: '#d33'
    });
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Add Money";
    }
  }
});