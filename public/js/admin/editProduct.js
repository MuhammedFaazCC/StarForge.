document.addEventListener("DOMContentLoaded", () => {

  /* =========================
     SERVER MESSAGE
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
     DOM ELEMENTS
  ========================= */

  const form = document.getElementById("editProductForm");
  if (!form) return;

  const loadingOverlay = document.getElementById("loadingOverlay");

  const mainImageInput = document.getElementById("mainImage");
  const additionalImagesInput = document.getElementById("additionalImages");

  const mainPreview = document.getElementById("mainImagePreview");
  const additionalPreview = document.getElementById("additionalImagesPreview");

  const cropModal = document.getElementById("cropModal");
  const cropImage = document.getElementById("cropImage");
  const cropButton = document.getElementById("cropButton");
  const cancelCropButton = document.getElementById("cancelCropButton");

  if (!cropModal || !cropImage || !cropButton || !cancelCropButton) return;

  /* =========================
     CROPPER STATE
  ========================= */

  let cropper = null;
  let activeInput = null;

  let additionalQueue = [];
  let additionalIndex = 0;

  /* =========================
     HELPERS
  ========================= */

  function openCropModal() {
    cropModal.classList.add("active");
  }

  function closeCropModal() {
    cropModal.classList.remove("active");
  }

  function setFileToInput(input, file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
  }

  function addPreview(container, file, clear = false) {
    if (clear) container.innerHTML = "";
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    container.appendChild(img);
  }

  /* =========================
     INIT CROPPER
  ========================= */

  function initCropper(file, input) {
    activeInput = input;
    openCropModal();

    const reader = new FileReader();
    reader.onload = () => {
      cropImage.src = reader.result;

      cropImage.onload = () => {
        if (cropper) cropper.destroy();

        cropper = new Cropper(cropImage, {
          aspectRatio: 1,
          viewMode: 1,
          autoCropArea: 1,
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

  mainImageInput.addEventListener("change", function () {
    if (this.files && this.files[0]) {
      initCropper(this.files[0], mainImageInput);
    }
  });

  additionalImagesInput.addEventListener("change", function () {
    additionalQueue = Array.from(this.files).slice(0, 5);
    additionalIndex = 0;

    if (additionalQueue.length) {
      initCropper(additionalQueue[additionalIndex], additionalImagesInput);
    }
  });

  /* =========================
     CROP & SAVE
  ========================= */

  cropButton.addEventListener("click", () => {
    if (!cropper || !activeInput) return;

    cropper
      .getCroppedCanvas({ width: 800, height: 800 })
      .toBlob(blob => {

        const file = new File(
          [blob],
          `cropped-${Date.now()}.jpg`,
          { type: "image/jpeg" }
        );

        if (activeInput === mainImageInput) {
          setFileToInput(mainImageInput, file);
          addPreview(mainPreview, file, true);
          closeCropModal();
        } else {
          addPreview(additionalPreview, file);
          additionalIndex++;

          const dt = new DataTransfer();
          Array.from(additionalPreview.querySelectorAll("img")).forEach((_, i) => {
            if (additionalQueue[i]) {
              dt.items.add(file);
            }
          });
          setFileToInput(additionalImagesInput, file);

          if (additionalIndex < additionalQueue.length) {
            initCropper(additionalQueue[additionalIndex], additionalImagesInput);
            return;
          }

          closeCropModal();
        }

        cropper.destroy();
        cropper = null;
        activeInput = null;

      }, "image/jpeg", 0.9);
  });

  /* =========================
     CANCEL CROP
  ========================= */

  cancelCropButton.addEventListener("click", () => {
    if (cropper) cropper.destroy();
    cropper = null;
    activeInput = null;
    additionalQueue = [];
    additionalIndex = 0;
    closeCropModal();
  });

  /* =========================
     VALIDATION
  ========================= */

  function clearErrors() {
    document
      .querySelectorAll(".form-group")
      .forEach(g => g.classList.remove("error"));
  }

  /* =========================
     FORM SUBMIT
  ========================= */

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearErrors();

    let valid = true;
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
      valid = false;
    }

    if (brand.value.trim().length < 2) {
      brand.parentElement.classList.add("error");
      errors.push("Brand must be at least 2 characters.");
      valid = false;
    }

    if (Number(price.value) <= 0) {
      price.parentElement.classList.add("error");
      errors.push("Price must be positive.");
      valid = false;
    }

    if (offer.value && (offer.value < 0 || offer.value > 100)) {
      offer.parentElement.classList.add("error");
      errors.push("Offer must be between 0 and 100.");
      valid = false;
    }

    if (!description.value.trim()) {
      description.parentElement.classList.add("error");
      errors.push("Description is required.");
      valid = false;
    }

    if (!category.value) {
      category.parentElement.classList.add("error");
      errors.push("Category is required.");
      valid = false;
    }

    if (!sizes.value.trim()) {
      sizes.parentElement.classList.add("error");
      errors.push("Sizes are required.");
      valid = false;
    }

    if (!rimMaterial.value.trim()) {
      rimMaterial.parentElement.classList.add("error");
      errors.push("Rim material is required.");
      valid = false;
    }

    if (Number(stock.value) < 0) {
      stock.parentElement.classList.add("error");
      errors.push("Stock cannot be negative.");
      valid = false;
    }

    if (!valid) {
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

      loadingOverlay?.classList.add("active");
      form.submit();
    });
  });

});
