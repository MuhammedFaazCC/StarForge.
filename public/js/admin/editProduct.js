  window.addEventListener('DOMContentLoaded', () => {
      const serverMessage = <%- JSON.stringify(typeof message !== 'undefined' ? message : null) %>;
      if (serverMessage && serverMessage.text) {
        Swal.fire({
          icon: serverMessage.success ? 'success' : 'error',
          title: serverMessage.success ? 'Success' : 'Error',
          text: serverMessage.text,
          confirmButtonText: 'OK'
        });
      }
    });
    
    const form = document.getElementById("editProductForm");
    const loadingOverlay = document.getElementById("loadingOverlay");

    function clearErrors() {
      document.querySelectorAll('.form-group').forEach(group => {
        group.classList.remove('error');
      });
    }

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
      const color = document.getElementById("color");
      const mainImage = document.getElementById("mainImage");
      const additionalImages = document.getElementById("additionalImages");

      if (name.value.trim().length < 3) {
        document.getElementById("name").parentElement.classList.add('error');
        errors.push("Product name must be at least 3 characters.");
        isValid = false;
      }
      if (brand.value.trim().length < 2) {
        document.getElementById("brand").parentElement.classList.add('error');
        errors.push("Brand must be at least 2 characters.");
        isValid = false;
      }
      if (Number(price.value) <= 0) {
        document.getElementById("price").parentElement.classList.add('error');
        errors.push("Price must be a positive number.");
        isValid = false;
      }
      if (offer.value && (Number(offer.value) < 0 || Number(offer.value) > 100)) {
        document.getElementById("offer").parentElement.classList.add('error');
        errors.push("Offer must be between 0 and 100.");
        isValid = false;
      }
      if (!description.value.trim()) {
        document.getElementById("description").parentElement.classList.add('error');
        errors.push("Description cannot be empty.");
        isValid = false;
      }
      if (!category.value) {
        document.getElementById("category").parentElement.classList.add('error');
        errors.push("Category must be selected.");
        isValid = false;
      }
      if (!sizes.value.trim()) {
        document.getElementById("sizes").parentElement.classList.add('error');
        errors.push("Sizes are required.");
        isValid = false;
      }
      if (!rimMaterial.value.trim()) {
        document.getElementById("rimMaterial").parentElement.classList.add('error');
        errors.push("Rim Material cannot be empty.");
        isValid = false;
      }
      if (Number(stock.value) < 0) {
        document.getElementById("stock").parentElement.classList.add('error');
        errors.push("Stock cannot be negative.");
        isValid = false;
      }
      
      if (mainImage.files.length > 0) {
        const validImageTypes = ['image/jpeg','image/jpg','image/webp', 'image/png'];
        if (!validImageTypes.includes(mainImage.files[0].type)) {
          document.getElementById("mainImage").parentElement.classList.add('error');
          errors.push("Main image must be a valid JPEG or PNG file.");
          isValid = false;
        }
      }
      if (additionalImages.files.length > 0) {
        const validImageTypes = ['image/jpeg','image/jpg','image/webp', 'image/png'];
        for (let file of additionalImages.files) {
          if (!validImageTypes.includes(file.type)) {
            document.getElementById("additionalImages").parentElement.classList.add('error');
            errors.push("Additional images must be valid JPEG or PNG files.");
            isValid = false;
            break;
          }
        }
      }

      if (!isValid) {
        Swal.fire({
          icon: 'error',
          title: 'Validation Error',
          html: errors.join('<br>'),
          customClass: {
            popup: 'swal-wide'
          }
        });
        return;
      }

      Swal.fire({
        title: 'Update Product',
        text: 'Are you sure you want to update this product?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, update it!'
      }).then((result) => {
        if (result.isConfirmed) {
          loadingOverlay.classList.add('active');
          
          setTimeout(() => {
            form.submit();
          }, 500);
        }
      });
    });