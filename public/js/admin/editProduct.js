document.addEventListener("DOMContentLoaded", () => {

  /* =========================
     SERVER MESSAGE (SAFE)
  ========================= */

  if (window.__SERVER_MESSAGE__ && window.__SERVER_MESSAGE__.text) {
    Swal.fire({
      icon: window.__SERVER_MESSAGE__.success ? "success" : "error",
      title: window.__SERVER_MESSAGE__.success ? "Success" : "Error",
      text: window.__SERVER_MESSAGE__.text,
      confirmButtonText: "OK"
    });
  }

  /* =========================
     DOM ELEMENTS (SAFE)
  ========================= */

  const form = document.getElementById("editProductForm");
  if (!form) return;

  const loadingOverlay = document.getElementById("loadingOverlay");

  const mainImageInput = document.getElementById("mainImage");
  const additionalImagesInput = document.getElementById("additionalImages");

  const cropModal = document.getElementById("cropModal");
  const cropImage = document.getElementById("cropImage");
  const cropButton = document.getElementById("cropButton");
  const cancelCropButton = document.getElementById("cancelCropButton");

  if (!cropModal || !cropImage || !cropButton || !cancelCropButton) return;

  /* =========================
     CROPPER STATE
  ========================= */

  let cropper = null;
  let currentInput = null;

  let additionalFilesQueue = [];
  let additionalIndex = 0;

  const croppedFiles = {
    mainImage: null,
    additionalImages: []
  };

  /* =========================
     MODAL HELPERS (ADDED)
  ========================= */

  function openCropModal() {
    cropModal.classList.add("active");
  }

  function closeCropModal() {
    cropModal.classList.remove("active");
  }

  /* =========================
     INIT CROPPER (UNCHANGED)
  ========================= */

  function initCropper(file, input) {
    currentInput = input;
    openCropModal();

    const reader = new FileReader();
    reader.onload = () => {
      cropImage.src = reader.result;

      cropImage.onload = () => {
        if (cropper) cropper.destroy();

        cropper = new Cropper(cropImage, {
          aspectRatio: 1,
          viewMode: 1,
          autoCropArea: 0.8,
          responsive: true,
          movable: true,
          zoomable: true,
          cropBoxResizable: true
        });
      };
    };

    reader.readAsDataURL(file);
  }

  /* =========================
     FILE INPUT HANDLERS
  ========================= */

  mainImageInput?.addEventListener("change", function () {
    if (this.files && this.files[0]) {
      initCropper(this.files[0], mainImageInput);
    }
  });

  additionalImagesInput?.addEventListener("change", function () {
    additionalFilesQueue = Array.from(this.files)
      .slice(0, 5 - croppedFiles.additionalImages.length);

    additionalIndex = 0;

    if (additionalFilesQueue.length) {
      initCropper(additionalFilesQueue[additionalIndex], additionalImagesInput);
    }
  });

  /* =========================
     CROP CONFIRM (SINGLE HANDLER)
  ========================= */

  cropButton.addEventListener("click", () => {
    if (!cropper || !currentInput) return;

    cropper.getCroppedCanvas({ width: 300, height: 300 })
      .toBlob(blob => {

        const file = new File(
          [blob],
          `cropped-${Date.now()}.jpg`,
          { type: "image/jpeg" }
        );

        if (currentInput === mainImageInput) {
          croppedFiles.mainImage = file;
          currentInput = null;
          closeCropModal();
        } else {
          croppedFiles.additionalImages.push(file);
          additionalIndex++;

          if (additionalIndex < additionalFilesQueue.length) {
            initCropper(
              additionalFilesQueue[additionalIndex],
              additionalImagesInput
            );
            return;
          }

          currentInput = null;
          closeCropModal();
        }

        cropper.destroy();
        cropper = null;

      }, "image/jpeg", 0.9);
  });

  /* =========================
     CROP CANCEL
  ========================= */

  cancelCropButton.addEventListener("click", () => {
    closeCropModal();
    if (cropper) cropper.destroy();
    cropper = null;
    currentInput = null;
    additionalFilesQueue = [];
    additionalIndex = 0;
  });

  /* =========================
     VALIDATION HELPERS
  ========================= */

  function clearErrors() {
    document.querySelectorAll(".form-group")
      .forEach(g => g.classList.remove("error"));
  }

  /* =========================
     FORM SUBMIT
  ========================= */

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearErrors();

    let isValid = true;
    const errors = [];

    const name = document.getElementById("name");
    const brand = document.getElementById("brand");
    const price = document.getElementById("price");
    const offer = document.getElementById("offer");
    const description = document.getElementById("description");
    const category = document.getElementById("category");
    const sizes = document.getElementById("sizes");
    const rimMaterial = document.getElementById("rimMaterial");
    const stock = document.getElementById("stock");

    if (name.value.trim().length < 3) {
      name.parentElement.classList.add("error");
      errors.push("Product name must be at least 3 characters.");
      isValid = false;
    }

    if (brand.value.trim().length < 2) {
      brand.parentElement.classList.add("error");
      errors.push("Brand must be at least 2 characters.");
      isValid = false;
    }

    if (Number(price.value) <= 0) {
      price.parentElement.classList.add("error");
      errors.push("Price must be positive.");
      isValid = false;
    }

    if (offer.value && (offer.value < 0 || offer.value > 100)) {
      offer.parentElement.classList.add("error");
      errors.push("Offer must be between 0 and 100.");
      isValid = false;
    }

    if (!description.value.trim()) {
      description.parentElement.classList.add("error");
      errors.push("Description required.");
      isValid = false;
    }

    if (!category.value) {
      category.parentElement.classList.add("error");
      errors.push("Category required.");
      isValid = false;
    }

    if (!sizes.value.trim()) {
      sizes.parentElement.classList.add("error");
      errors.push("Sizes required.");
      isValid = false;
    }

    if (!rimMaterial.value.trim()) {
      rimMaterial.parentElement.classList.add("error");
      errors.push("Rim material required.");
      isValid = false;
    }

    if (Number(stock.value) < 0) {
      stock.parentElement.classList.add("error");
      errors.push("Stock cannot be negative.");
      isValid = false;
    }

    if (!isValid) {
      Swal.fire({
        icon: "error",
        title: "Validation Error",
        html: errors.join("<br>")
      });
      return;
    }

    Swal.fire({
      title: "Update Product",
      text: "Are you sure?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, update it!"
    }).then(result => {
      if (!result.isConfirmed) return;

      if (croppedFiles.mainImage) {
        const dt = new DataTransfer();
        dt.items.add(croppedFiles.mainImage);
        mainImageInput.files = dt.files;
      }

      if (croppedFiles.additionalImages.length) {
        const dt = new DataTransfer();
        croppedFiles.additionalImages.forEach(f => dt.items.add(f));
        additionalImagesInput.files = dt.files;
      }

      if (loadingOverlay) {
        loadingOverlay.classList.add("active");
      }

      form.submit();
    });
  });

});
