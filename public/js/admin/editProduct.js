document.addEventListener("DOMContentLoaded", () => {

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

  function clearErrors() {
    document
      .querySelectorAll(".form-group")
      .forEach(g => g.classList.remove("error"));
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
     VARIANTS HANDLING
  ========================= */

  const variantsTable = document.getElementById("variantsTable");
  const variantsBody = document.getElementById("variantsBody");
  const addVariantBtn = document.getElementById("addVariantBtn");
  const variantsPayload = document.getElementById("variantsPayload");

  let variantsList = [];

  if (window.__EXISTING_VARIANTS__) {
    variantsList = window.__EXISTING_VARIANTS__.map(v => ({
      Size: v.attributes?.Size || '',
      Color: v.attributes?.Color || '',
      price: v.price || '',
      stock: v.stock || 0,
      sku: v.sku || ''
    }));
    renderVariants();
  }

  function renderVariants() {
    variantsBody.innerHTML = "";
    if (variantsList.length === 0) {
      variantsTable.style.display = "none";
      variantsPayload.value = "[]";
      return;
    }
    variantsTable.style.display = "table";
    variantsList.forEach((v, index) => {
      const tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid #eee";
      tr.innerHTML = `
        <td style="padding: 10px;"><input type="text" class="form-control" style="width:100%" value="${v.Size || ''}" placeholder="e.g. 18"></td>
        <td style="padding: 10px;"><input type="text" class="form-control" style="width:100%" value="${v.Color || ''}" placeholder="e.g. Red"></td>
        <td style="padding: 10px;"><input type="number" class="form-control" style="width:100%" value="${v.price || ''}" step="0.01" min="0"></td>
        <td style="padding: 10px;"><input type="number" class="form-control" style="width:100%" value="${v.stock || ''}" min="0"></td>
        <td style="padding: 10px;"><input type="text" class="form-control" style="width:100%" value="${v.sku || ''}"></td>
        <td style="padding: 10px;"><button type="button" class="btn btn-sm btn-danger remove-var-btn" data-index="${index}">X</button></td>
      `;

      const inputs = tr.querySelectorAll('input');
      inputs[0].addEventListener('input', (e) => { variantsList[index].Size = e.target.value; updatePayload(); });
      inputs[1].addEventListener('input', (e) => { variantsList[index].Color = e.target.value; updatePayload(); });
      inputs[2].addEventListener('input', (e) => { variantsList[index].price = e.target.value; updatePayload(); });
      inputs[3].addEventListener('input', (e) => { variantsList[index].stock = e.target.value; updatePayload(); });
      inputs[4].addEventListener('input', (e) => { variantsList[index].sku = e.target.value; updatePayload(); });

      tr.querySelector('.remove-var-btn').addEventListener('click', () => {
        variantsList.splice(index, 1);
        renderVariants();
      });

      variantsBody.appendChild(tr);
    });
    updatePayload();
  }

  function updatePayload() {
    variantsPayload.value = JSON.stringify(variantsList);
  }

  addVariantBtn.addEventListener("click", () => {
    variantsList.push({ Size: '', Color: '', price: '', stock: '0', sku: '' });
    renderVariants();
  });

  /* =========================
     FORM SUBMIT (AJAX)
  ========================= */

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearErrors();

    let valid = true;
    const errors = [];

    const name = document.getElementById("name");
    const brand = document.getElementById("brand");
    const offer = document.getElementById("offer");
    const description = document.getElementById("description");
    const category = document.getElementById("category");
    const rimMaterial = document.getElementById("rimMaterial");

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

    if (variantsList.length === 0) {
      errors.push("At least one variant config must be added.");
      valid = false;
    }

    if (!rimMaterial.value.trim()) {
      rimMaterial.parentElement.classList.add("error");
      errors.push("Rim material is required.");
      valid = false;
    }

    // Removed stock validation

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
    }).then(async result => {
      if (!result.isConfirmed) return;

      loadingOverlay?.classList.add("active");

      const formData = new FormData(form);

      try {
        const res = await fetch(form.action, {
          method: "POST",
          body: formData
        });

        let data;
        const contentType = res.headers.get("content-type");

        if (contentType && contentType.includes("application/json")) {
          data = await res.json();
        } else {
          const text = await res.text();
          throw new Error("Server returned non-JSON response");
        }

        if (!res.ok) {
          Swal.fire({
            icon: "error",
            title: "Error",
            text: data.message || "Request failed"
          });
          return;
        }


        Swal.fire({
          icon: "success",
          title: "Success",
          text: data.message
        }).then(() => {
          window.location.href = "/admin/products";
        });

      } catch (err) {
        loadingOverlay?.classList.remove("active");
        Swal.fire({
          icon: "error",
          title: "Server Error",
          text: "Something went wrong"
        });
      }
    });
  });

});