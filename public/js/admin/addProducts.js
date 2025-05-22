document.addEventListener("DOMContentLoaded", () => {
  const mainImageInput = document.getElementById("mainImage");
  const mainImagePreview = document.getElementById("mainImagePreview");
  const additionalImagesInput = document.getElementById("additionalImages");
  const additionalImagesPreview = document.getElementById("additionalImagesPreview");
  const sizesInput = document.getElementById("sizes");
  const sizesPreview = document.getElementById("sizesPreview");
  const form = document.getElementById("addProductForm");
  const cropModal = document.getElementById("cropModal");
  const cropImage = document.getElementById("cropImage");
  const cropButton = document.getElementById("cropButton");
  const cancelCropButton = document.getElementById("cancelCropButton");

  let cropper = null;
  let currentInput = null;
  let croppedFiles = { mainImage: null, additionalImages: [] };

  console.log("Script loaded at:", new Date().toISOString());
  console.log("mainImageInput:", mainImageInput);
  console.log("mainImagePreview:", mainImagePreview);
  console.log("additionalImagesInput:", additionalImagesInput);
  console.log("additionalImagesPreview:", additionalImagesPreview);
  console.log("sizesInput:", sizesInput);
  console.log("sizesPreview:", sizesPreview);
  console.log("form:", form);
  console.log("cropModal:", cropModal);

  if (!mainImageInput || !mainImagePreview || !additionalImagesInput || !additionalImagesPreview) {
    console.error("Image elements not found. Check EJS for IDs: mainImage, mainImagePreview, additionalImages, additionalImagesPreview.");
    return;
  }
  if (!sizesInput || !sizesPreview) {
    console.error("Sizes elements not found. Check EJS for IDs: sizes, sizesPreview.");
    return;
  }
  if (!form) {
    console.error("Form element not found. Check EJS for ID: addProductForm.");
    return;
  }
  if (!cropModal || !cropImage || !cropButton || !cancelCropButton) {
    console.error("Cropper elements not found. Check EJS for IDs: cropModal, cropImage, cropButton, cancelCropButton.");
    return;
  }

  const initCropper = (file, input) => {
    currentInput = input;
    cropImage.src = URL.createObjectURL(file);
    cropModal.style.display = "block";
    if (cropper) cropper.destroy();
    cropper = new cropper(cropImage, {
      aspectRatio: 1,
      viewMode: 1,
      autoCropArea: 0.8,
      responsive: true,
    });
  };

  cropButton.addEventListener("click", () => {
    if (!cropper) return;
    const canvas = cropper.getCroppedCanvas({ width: 300, height: 300 });
    canvas.toBlob(blob => {
      const file = new File([blob], `cropped-${Date.now()}.jpg`, { type: "image/jpeg" });
      if (currentInput === mainImageInput) {
        croppedFiles.mainImage = file;
        mainImagePreview.innerHTML = "";
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.alt = "Main Image Preview";
        img.className = "main-image-preview";
        mainImagePreview.appendChild(img);
        console.log("Cropped main image preview added");
      } else {
        if (croppedFiles.additionalImages.length < 5) {
          croppedFiles.additionalImages.push(file);
          updateAdditionalImagesPreview();
        }
      }
      cropModal.style.display = "none";
      cropper.destroy();
      cropper = null;
      currentInput = null;
    }, "image/jpeg");
  });

  cancelCropButton.addEventListener("click", () => {
    cropModal.style.display = "none";
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
    currentInput = null;
    if (currentInput === mainImageInput) {
      mainImageInput.value = "";
    } else {
      additionalImagesInput.value = "";
    }
  });

  const updateAdditionalImagesPreview = () => {
    additionalImagesPreview.innerHTML = "";
    if (croppedFiles.additionalImages.length === 0) {
      additionalImagesPreview.innerHTML = "<p>No additional images selected</p>";
      return;
    }
    croppedFiles.additionalImages.forEach(file => {
      const img = document.createElement("img");
      img.src = URL.createObjectURL(file);
      img.alt = "Additional Image Preview";
      img.className = "additional-image-preview";
      additionalImagesPreview.appendChild(img);
      console.log("Additional image preview added:", file.name);
    });
  };

  mainImageInput.addEventListener("change", () => {
    console.log("Main image change event triggered");
    const file = mainImageInput.files[0];
    console.log("Main image file:", file ? { name: file.name, type: file.type, size: file.size } : "None");
    if (file && file.type.startsWith("image/")) {
      initCropper(file, mainImageInput);
    } else {
      console.warn("No valid image selected for mainImage");
      mainImagePreview.innerHTML = "<p class='error'>No valid image selected</p>";
      mainImageInput.value = "";
    }
  });

  additionalImagesInput.addEventListener("change", () => {
    console.log("Additional images change event triggered");
    const files = Array.from(additionalImagesInput.files).slice(0, 5 - croppedFiles.additionalImages.length);
    console.log("Additional images files:", files.map(f => ({ name: f.name, type: f.type, size: f.size })));
    if (files.length === 0) {
      console.warn("No images selected for additionalImages");
      additionalImagesPreview.innerHTML = "<p class='error'>No additional images selected</p>";
      return;
    }
    files.forEach(file => {
      if (file && file.type.startsWith("image/")) {
        initCropper(file, additionalImagesInput);
      } else {
        console.warn("Invalid image file:", file.name);
      }
    });
  });

  sizesInput.addEventListener("input", () => {
    console.log("Sizes input event triggered");
    sizesPreview.innerHTML = "";
    const sizes = sizesInput.value.split(",").map(size => size.trim()).filter(size => size);
    console.log("Sizes:", sizes);
    if (sizes.length === 0) {
      sizesPreview.innerHTML = "<p class='error'>No sizes entered</p>";
      return;
    }
    sizes.forEach(size => {
      const span = document.createElement("span");
      span.textContent = size;
      span.className = "size-tag";
      sizesPreview.appendChild(span);
    });
  });

  form.addEventListener("submit", (e) => {
    console.log("Form submit event triggered");
    e.preventDefault();

    const formData = new FormData(form);
    if (croppedFiles.mainImage) {
      formData.set("mainImage", croppedFiles.mainImage, croppedFiles.mainImage.name);
    }
    formData.delete("additionalImages");
    croppedFiles.additionalImages.forEach(file => {
      formData.append("additionalImages", file, file.name);
    });

    fetch(form.action, {
      method: form.method,
      body: formData,
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          alert(data.message);
          window.location.href = "/admin/products";
        } else {
          alert(data.message);
        }
      })
      .catch(error => {
        console.error("Form submission error:", error);
        alert("An error occurred while adding the product");
      });
  });
});