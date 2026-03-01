document.addEventListener("DOMContentLoaded", () => {

  /* ===========================
     STATE
  =========================== */

  const croppedFiles = {
    mainImage: null,
    additionalImages: []
  };

  let cropper = null;
  let activeInput = null;

  /* ===========================
     ELEMENTS
  =========================== */

  const form = document.getElementById("addProductForm");

  const mainImageInput = document.getElementById("mainImage");
  const mainImagePreview = document.getElementById("mainImagePreview");

  const additionalImagesInput = document.getElementById("additionalImages");
  const additionalImagesPreview = document.getElementById("additionalImagesPreview");

  const cropModal = document.getElementById("cropModal");
  const cropImage = document.getElementById("cropImage");
  const cropButton = document.getElementById("cropButton");
  const cancelCropButton = document.getElementById("cancelCropButton");

  if (!form || !mainImageInput || !cropModal || !cropImage) {
    console.error("Required elements missing in addProducts.ejs");
    return;
  }

  /* ===========================
     VALIDATION
  =========================== */

  function validateAddProductForm() {
    const name = document.getElementById("name").value.trim();
    const brand = document.getElementById("brand").value.trim();
    const offer = document.getElementById("offer").value.trim();
    const category = document.getElementById("category").value;

    if (!name) return "Product name is required";
    if (name.length < 2 || name.length > 100) return "Name must be 2–100 characters";
    if (!/^[A-Za-z0-9\s\-']+$/.test(name)) return "Invalid characters in product name";

    if (!brand) return "Brand is required";
    if (brand.length < 2 || brand.length > 50) return "Brand must be 2–50 characters";

    if (offer && (!/^\d+$/.test(offer) || Number(offer) > 90))
      return "Offer must be between 0 and 90";

    if (!category) return "Category is required";

    if (variantsList.length === 0) return "At least one variant config must be added";

    if (!croppedFiles.mainImage) return "Main image is required";
    if (croppedFiles.mainImage.size > 2 * 1024 * 1024) return "Main image exceeds 2MB";

    if (croppedFiles.additionalImages.length > 5) return "Max 5 additional images allowed";
    for (const img of croppedFiles.additionalImages) {
      if (img.size > 2 * 1024 * 1024) return "Additional image exceeds 2MB";
    }

    return null;
  }

  /* ===========================
     CROPPER HELPERS
  =========================== */

  function openCropper(file, input) {
    activeInput = input;
    cropImage.src = URL.createObjectURL(file);
    cropModal.style.display = "block";

    if (cropper) cropper.destroy();

    cropper = new Cropper(cropImage, {
      aspectRatio: 1,
      viewMode: 1,
      autoCropArea: 0.8,
      responsive: true
    });
  }

  function closeCropper() {
    cropModal.style.display = "none";
    if (cropper) cropper.destroy();
    cropper = null;
    activeInput = null;
  }

  /* ===========================
     IMAGE HANDLING
  =========================== */

  mainImageInput.addEventListener("change", () => {
    const file = mainImageInput.files[0];
    if (file && file.type.startsWith("image/")) {
      openCropper(file, mainImageInput);
    } else {
      mainImageInput.value = "";
    }
  });

  additionalImagesInput.addEventListener("change", () => {
    const files = Array.from(additionalImagesInput.files)
      .slice(0, 5 - croppedFiles.additionalImages.length);

    files.forEach(file => {
      if (file.type.startsWith("image/")) {
        openCropper(file, additionalImagesInput);
      }
    });
  });

  cropButton.addEventListener("click", () => {
    if (!cropper) return;

    cropper.getCroppedCanvas({ width: 300, height: 300 }).toBlob(blob => {
      const file = new File([blob], `cropped-${Date.now()}.jpg`, {
        type: "image/jpeg"
      });

      if (activeInput === mainImageInput) {
        croppedFiles.mainImage = file;
        mainImagePreview.innerHTML = "";
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.className = "main-image-preview";
        mainImagePreview.appendChild(img);
      } else {
        croppedFiles.additionalImages.push(file);
        renderAdditionalImages();
      }

      closeCropper();
    }, "image/jpeg");
  });

  cancelCropButton.addEventListener("click", closeCropper);

  function renderAdditionalImages() {
    additionalImagesPreview.innerHTML = "";
    croppedFiles.additionalImages.forEach(file => {
      const img = document.createElement("img");
      img.src = URL.createObjectURL(file);
      img.className = "additional-image-preview";
      additionalImagesPreview.appendChild(img);
    });
  }

  /* ===========================
     VARIANTS HANDLING
  =========================== */

  const variantsTable = document.getElementById("variantsTable");
  const variantsBody = document.getElementById("variantsBody");
  const addVariantBtn = document.getElementById("addVariantBtn");
  const variantsPayload = document.getElementById("variantsPayload");

  let variantsList = [];

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

  /* ===========================
     FINAL SUBMIT (NORMAL FORM)
  =========================== */

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const error = validateAddProductForm();
    if (error) {
      Swal.fire({ icon: "error", title: "Validation Error", text: error });
      return;
    }

    const formData = new FormData(form);

    // inject cropped images
    const mainDT = new DataTransfer();
    mainDT.items.add(croppedFiles.mainImage);
    formData.set("mainImage", mainDT.files[0]);

    croppedFiles.additionalImages.forEach(f => {
      formData.append("additionalImages", f);
    });

    try {
      const res = await fetch("/admin/products/add", {
        method: "POST",
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        Swal.fire({ icon: "error", title: "Error", text: data.message });
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
      Swal.fire({
        icon: "error",
        title: "Server Error",
        text: "Something went wrong"
      });
    }
  });


});
