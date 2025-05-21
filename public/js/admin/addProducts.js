document.addEventListener("DOMContentLoaded", () => {
  const mainImageInput = document.getElementById("mainImage");
  const mainImagePreview = document.getElementById("mainImagePreview");
  const additionalImagesInput = document.getElementById("additionalImages");
  const additionalImagesPreview = document.getElementById(
    "additionalImagesPreview"
  );
  const form = document.getElementById("addProductForm");

  console.log("Script loaded at:", new Date().toISOString());
  console.log("mainImageInput:", mainImageInput);
  console.log("mainImagePreview:", mainImagePreview);
  console.log("additionalImagesInput:", additionalImagesInput);
  console.log("additionalImagesPreview:", additionalImagesPreview);

  if (!mainImageInput || !mainImagePreview) {
    console.error(
      "Main image elements not found. Check EJS for IDs: mainImage, mainImagePreview."
    );
    return;
  }
  if (!additionalImagesInput || !additionalImagesPreview) {
    console.error(
      "Additional images elements not found. Check EJS for IDs: additionalImages, additionalImagesPreview."
    );
    return;
  }

  mainImageInput.addEventListener("change", () => {
    console.log("Main image change event triggered");
    mainImagePreview.innerHTML = "";
    const file = mainImageInput.files[0];
    console.log(
      "Main image file:",
      file ? { name: file.name, type: file.type, size: file.size } : "None"
    );
    if (file && file.type.startsWith("image/")) {
      const img = document.createElement("img");
      img.src = URL.createObjectURL(file);
      img.alt = "Main Image Preview";
      img.style.maxWidth = "150px";
      img.style.maxHeight = "150px";
      mainImagePreview.appendChild(img);
      console.log("Main image preview added");
    } else {
      console.warn("No valid image for mainImage");
    }
  });

  additionalImagesInput.addEventListener("change", () => {
    console.log("Additional images change event triggered");
    additionalImagesPreview.innerHTML = "";
    const files = Array.from(additionalImagesInput.files).slice(0, 5);
    console.log(
      "Additional images files:",
      files.map((f) => ({ name: f.name, type: f.type, size: f.size }))
    );
    files.forEach((file) => {
      if (file && file.type.startsWith("image/")) {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.alt = "Additional Image Preview";
        img.style.maxWidth = "100px";
        img.style.maxHeight = "100px";
        img.style.marginRight = "5px";
        additionalImagesPreview.appendChild(img);
        console.log("Additional image preview added:", file.name);
      }
    });
    if (files.length === 0) {
      console.warn("No valid images for additionalImages");
    }
  });

  form.addEventListener("submit", (e) => {
    const requiredFields = ["name", "brand", "price", "category", "stock"];
    let valid = true;
    requiredFields.forEach((id) => {
      const el = document.getElementById(id);
      if (!el.value.trim()) {
        valid = false;
        el.style.border = "2px solid red";
      } else {
        el.style.border = "";
      }
    });
    if (!valid) {
      e.preventDefault();
      alert("Please fill all required fields marked with *");
    }
  });
});
