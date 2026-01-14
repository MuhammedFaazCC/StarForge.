// Form validation and submission
class CategoryFormValidator {
    constructor() {
        this.form = document.getElementById('categoryForm');
        this.submitBtn = document.getElementById('submitBtn');
        this.isSubmitting = false;
        
        this.initializeEventListeners();
        this.updateDescriptionCount();
    }
    
    initializeEventListeners() {
        // Real-time validation
        document.getElementById('name').addEventListener('input', () => this.validateName());
        document.getElementById('name').addEventListener('blur', () => this.validateName());
        document.getElementById('description').addEventListener('input', () => {
            this.validateDescription();
            this.updateDescriptionCount();
        });
        document.getElementById('offer').addEventListener('input', () => this.validateOffer());
        document.getElementById('image').addEventListener('change', (e) => this.handleImageChange(e));
        
        // Form submission
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }
    
    validateName() {
        const nameInput = document.getElementById('name');
        const nameError = document.getElementById('nameError');
        const name = nameInput.value.trim();
        
        // Clear previous errors
        this.clearFieldError('name');
        
        if (!name) {
            this.showFieldError('name', 'Category name is required');
            return false;
        }
        
        if (name.length < 2) {
            this.showFieldError('name', 'Category name must be at least 2 characters');
            return false;
        }

        if (/^[\-\s]+$/.test(name)) {
            this.showFieldError('name', 'Category name cannot contain only hyphens or spaces');
            return false;
        }
        
        if (name.length > 50) {
            this.showFieldError('name', 'Category name cannot exceed 50 characters');
            return false;
        }
        
        if (!/^[a-zA-Z0-9\s\-]+$/.test(name)) {
            this.showFieldError('name', 'Category name can only contain letters, numbers, spaces, and hyphens');
            return false;
        }
        
        return true;
    }
    
    validateDescription() {
        const descriptionInput = document.getElementById('description');
        const description = descriptionInput.value.trim();
        
        this.clearFieldError('description');
        
        if (description.length > 500) {
            this.showFieldError('description', 'Description cannot exceed 500 characters');
            return false;
        }
        
        return true;
    }
    
    validateOffer() {
        const offerInput = document.getElementById('offer');
        const offer = parseFloat(offerInput.value);
        
        this.clearFieldError('offer');
        
        if (isNaN(offer) || offer < 0 || offer > 50) {
            this.showFieldError('offer', 'Offer percentage must be between 0 and 50');
            return false;
        }
        
        return true;
    }
    
    updateDescriptionCount() {
        const description = document.getElementById('description').value;
        const count = document.getElementById('descriptionCount');
        if (count) {
            count.textContent = description.length;
        }
    }
    
    handleImageChange(e) {
        const preview = document.getElementById('imagePreview');
        const existingImage = preview.querySelector('img');
        const file = e.target.files[0];
        
        this.clearFieldError('image');
        
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                this.showFieldError('image', 'Please select a valid image file');
                e.target.value = '';
                return;
            }
            
            // Validate file size (5MB limit)
            if (file.size > 5 * 1024 * 1024) {
                this.showFieldError('image', 'Image size must be less than 5MB');
                e.target.value = '';
                return;
            }
            
            // Show preview
            preview.innerHTML = '';
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.style.maxWidth = '200px';
            img.style.marginTop = '10px';
            preview.appendChild(img);
        } else if (existingImage) {
            preview.innerHTML = '';
            preview.appendChild(existingImage);
        }
    }
    
    showFieldError(fieldName, message) {
        const errorElement = document.getElementById(fieldName + 'Error');
        const inputElement = document.getElementById(fieldName);
        
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
        
        if (inputElement) {
            inputElement.classList.add('error');
        }
    }
    
    clearFieldError(fieldName) {
        const errorElement = document.getElementById(fieldName + 'Error');
        const inputElement = document.getElementById(fieldName);
        
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.style.display = 'none';
        }
        
        if (inputElement) {
            inputElement.classList.remove('error');
        }
    }
    
    clearAllErrors() {
        const errorElements = document.querySelectorAll('.error-message');
        const inputElements = document.querySelectorAll('.form-control');
        
        errorElements.forEach(el => {
            el.textContent = '';
            el.style.display = 'none';
        });
        
        inputElements.forEach(el => {
            el.classList.remove('error');
        });
    }
    
    validateForm() {
        const isNameValid = this.validateName();
        const isDescriptionValid = this.validateDescription();
        const isOfferValid = this.validateOffer();
        
        return isNameValid && isDescriptionValid && isOfferValid;
    }
    
    setSubmitState(isSubmitting) {
        this.isSubmitting = isSubmitting;
        const btnText = this.submitBtn.querySelector('.btn-text');
        const btnLoading = this.submitBtn.querySelector('.btn-loading');
        
        if (isSubmitting) {
            btnText.style.display = 'none';
            btnLoading.style.display = 'inline-block';
            this.submitBtn.disabled = true;
        } else {
            btnText.style.display = 'inline-block';
            btnLoading.style.display = 'none';
            this.submitBtn.disabled = false;
        }
    }
    
    async handleSubmit(e) {
        e.preventDefault();
        
        if (this.isSubmitting) return;
        
        // Clear previous errors
        this.clearAllErrors();
        
        // Validate form
        if (!this.validateForm()) {
            Swal.fire({
                icon: 'error',
                title: 'Validation Error',
                text: 'Please fix the errors in the form before submitting.',
                confirmButtonColor: '#d33'
            });
            return;
        }
        
        this.setSubmitState(true);
        
        try {
            const formData = new FormData(this.form);
            const response = await fetch(this.form.action, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                await Swal.fire({
                    icon: 'success',
                    title: 'Success!',
                    text: result.message || 'Category saved successfully!',
                    confirmButtonColor: '#28a745'
                });
                window.location.href = '/admin/categories';
            } else {
                // Display field-specific errors
                if (result.errors) {
                    Object.keys(result.errors).forEach(field => {
                        this.showFieldError(field, result.errors[field]);
                    });
                    
                    // Restore form data if provided
                    if (result.formData) {
                        if (result.formData.name) document.getElementById('name').value = result.formData.name;
                        if (result.formData.description) document.getElementById('description').value = result.formData.description;
                        if (result.formData.offer) document.getElementById('offer').value = result.formData.offer;
                        this.updateDescriptionCount();
                    }
                }
                
                Swal.fire({
                    icon: 'error',
                    title: 'Validation Error',
                    text: 'Please fix the errors and try again.',
                    confirmButtonColor: '#d33'
                });
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'An unexpected error occurred. Please try again.',
                confirmButtonColor: '#d33'
            });
        } finally {
            this.setSubmitState(false);
        }
    }
}

// Initialize the form validator when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    new CategoryFormValidator();
});