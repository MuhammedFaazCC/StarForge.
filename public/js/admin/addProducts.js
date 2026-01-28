document.addEventListener("DOMContentLoaded", () => {

  function validateAddProductForm() {
  const name = document.getElementById("name").value.trim();
  const brand = document.getElementById("brand").value.trim();
  const price = document.getElementById("price").value.trim();
  const offer = document.getElementById("offer").value.trim();
  const description = document.getElementById("description").value.trim();
  const category = document.getElementById("category").value;
  const stock = document.getElementById("stock").value.trim();
  const sizes = document.getElementById("sizes").value.trim();
  const rimMaterial = document.getElementById("rimMaterial").value.trim();
  const color = document.getElementById("color").value.trim();

  const allowedSizes = ["16","17","18","19","20","21","22"]; // same as server

  if (!name) {return "Product name is required";}
  if (name.length < 2 || name.length > 100) {return "Name must be 2–100 characters";}

  if (!/^[A-Za-z0-9\s\-']+$/.test(name))
    {return "Invalid characters in product name";}

  if (!/[A-Za-z0-9]/.test(name))
    {return "Name must contain at least one alphanumeric character";}

  if (/---+/.test(name))
    {return "Name cannot contain repeated hyphens";}

  if (/^[-']|[-']$/.test(name))
    {return "Name cannot start or end with hyphens or apostrophes";}

  if (!brand) {return "Brand is required";}

  if (brand.length < 2 || brand.length > 50)
    {return "Brand must be 2–50 characters";}

  if (!/^[A-Za-z0-9\s\-']+$/.test(brand))
    {return "Brand contains invalid characters";}

  if (!/[A-Za-z0-9]/.test(brand))
    {return "Brand must contain at least one alphanumeric character";}

  if (/^[^A-Za-z0-9]+$/.test(brand))
    {return "Brand cannot be only symbols";}

  if (/---+/.test(brand))
    {return "Brand cannot contain repeated hyphens";}

  if (/^[-']|[-']$/.test(brand))
    {return "Brand cannot start or end with hyphens or apostrophes";}

  if (/[<>]/.test(brand))
    {return "Brand cannot contain < or >";}


  if (!price) {return "Price is required";}

  if (!/^\d+(\.\d{1,2})?$/.test(price))
    {return "Price must be a valid number with up to 2 decimals";}

  if (price.startsWith("."))
    {return "Price cannot start with a dot";}

  if (/^0\d+/.test(price))
    {return "Invalid leading zeros in price";}

  if (!(Number(price) > 0))
    {return "Price must be greater than 0";}

  if (price.length > 15)
    {return "Price value is too large";}

  let off = offer.trim();

  if (off === "") {off = "0";}

  if (!/^\d+$/.test(off))
    {return "Offer must be an integer";}

  if (off.length > 1 && off.startsWith("0"))
    {return "Offer cannot contain leading zeros";}

  const offerNum = Number(off);

  if (offerNum < 0 || offerNum > 90)
    {return "Offer must be between 0 and 90%";}

  if (off.length > 2)
    {return "Invalid offer value";}

  if (description.length > 2000)
    {return "Description must be ≤ 2000 characters";}

  if (description && !/[A-Za-z0-9]/.test(description))
    {return "Description must contain at least one alphanumeric character";}

  if (/^[^A-Za-z0-9]+$/.test(description))
    {return "Description cannot be only special characters";}

  if (/([^\w\s])\1\1+/.test(description))
    {return "Description contains invalid repeated symbols";}

  if (/[<>]/.test(description))
    {return "Description cannot contain < or >";}

  if (/\n{4,}/.test(description))
    {return "Too many blank lines in description";}

  if (!category) {return "Category required";}

  if (!stock || !/^\d+$/.test(stock) || Number(stock) < 0)
    {return "Stock must be integer ≥ 0";}

  if (!sizes) {return "Size required";}
  const splitSizes = sizes.split(",").map(s => s.trim()).filter(Boolean);
  for (const s of splitSizes) {
    if (!allowedSizes.includes(s)) {return `Invalid size: ${s}`;}
  }

  if (rimMaterial.length > 100)
    {return "Rim material must be ≤ 100 characters";}

  if (rimMaterial) {
    if (!/^[A-Za-z0-9\s\-']+$/.test(rimMaterial))
      {return "Rim material contains invalid characters";}

    if (!/[A-Za-z0-9]/.test(rimMaterial))
      {return "Rim material must contain at least one alphanumeric character";}

    if (/^[^A-Za-z0-9]+$/.test(rimMaterial))
      {return "Rim material cannot be only symbols";}

    if (/---+/.test(rimMaterial))
      {return "Rim material cannot contain repeated hyphens";}

    if (/^[-']|[-']$/.test(rimMaterial))
      {return "Rim material cannot start or end with hyphens or apostrophes";}

    if (/[<>]/.test(rimMaterial))
      {return "Rim material cannot contain < or >";}

    if (/([^\w\s])\1\1+/.test(rimMaterial))
      {return "Rim material contains repeated symbols";}
  }

  if (color.length > 50)
    {return "Color must be ≤ 50 characters";}

  if (color) {
    if (!/^[A-Za-z0-9\s\-']+$/.test(color))
      {return "Color contains invalid characters";}

    if (!/[A-Za-z0-9]/.test(color))
      {return "Color must contain at least one alphanumeric character";}

    if (/^[^A-Za-z0-9]+$/.test(color))
      {return "Color cannot be only symbols";}

    if (/---+/.test(color))
      {return "Color cannot contain repeated hyphens";}

    if (/^[-']|[-']$/.test(color))
      {return "Color cannot start or end with hyphens or apostrophes";}

    if (/[<>]/.test(color))
      {return "Color cannot contain < or >";}

    if (/([^\w\s])\1\1+/.test(color))
      {return "Color contains repeated symbols";}
  }

  // image validation
  if (!croppedFiles.mainImage) {return "Main image required";}
  if (croppedFiles.mainImage.size > 2 * 1024 * 1024) {return "Main image > 2MB";}
  if (croppedFiles.additionalImages.length > 5) {return "Max 5 additional images";}
  for (const f of croppedFiles.additionalImages) {
    if (f.size > 2 * 1024 * 1024) {return "One of the additional images > 2MB";}
  }

  return null;
}

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
  const croppedFiles = { mainImage: null, additionalImages: [] };

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
    if (cropper) {cropper.destroy();}
    cropper = new Cropper(cropImage, {
      aspectRatio: 1,
      viewMode: 1,
      autoCropArea: 0.8,
      responsive: true,
    });
  };

  cropButton.addEventListener("click", () => {
    if (!cropper) {return;}
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
  e.preventDefault();

  const error = validateAddProductForm();
  if (error) {
    Swal.fire({
      icon: "error",
      title: "Validation Error",
      text: error
    });
    return;
  }

    console.log("Form action:", form.action);
    console.log("Form method:", form.method);
    console.log("Form data entries:");

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
          Swal.fire({
            icon: 'success',
            title: 'Success!',
            text: data.message,
            timer: 2000,
            timerProgressBar: true,
            showConfirmButton: false
          });
          window.location.href = "/admin/products";
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: data.message,
            confirmButtonText: 'OK',
            confirmButtonColor: '#d33'
          });
        }
      })
      .catch(error => {
        console.error("Form submission error:", error);
        Swal.fire({
          icon: 'error',
          title: 'Product Addition Failed',
          text: 'An error occurred while adding the product',
          confirmButtonText: 'OK',
          confirmButtonColor: '#d33'
        });
      });
  });
});