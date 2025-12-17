const toggleBtn = document.querySelector(".toggle-btn");
const sidePanel = document.querySelector(".side-panel");
const mainContent = document.querySelector(".main-content");

if (toggleBtn && sidePanel && mainContent) {
  toggleBtn.addEventListener("click", () => {
    sidePanel.classList.toggle("visible");
    sidePanel.classList.toggle("hidden");
    mainContent.classList.toggle("expanded");
  });
}

document.querySelectorAll(".side-panel a").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    document
      .querySelectorAll(".side-panel a")
      .forEach((l) => l.classList.remove("active"));
    link.classList.add("active");
    window.location.href = link.href;
  });
});

// Custom Notification System
class NotificationManager {
  constructor() {
    this.container = document.getElementById('notification-container');
    this.notifications = [];
  }

  show(message, type = 'info', duration = 5000) {
    const notification = this.createNotification(message, type, duration);
    this.container.appendChild(notification);
    this.notifications.push(notification);

    // Trigger animation
    setTimeout(() => {
      notification.classList.add('show');
    }, 100);

    // Auto remove
    if (duration > 0) {
      setTimeout(() => {
        this.remove(notification);
      }, duration);
    }

    return notification;
  }

  createNotification(message, type, duration) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };

    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${icons[type] || icons.info}</span>
        <span class="notification-message">${message}</span>
      </div>
      <button class="notification-close" onclick="notificationManager.remove(this.parentElement)">×</button>
      ${duration > 0 ? `<div class="notification-progress" style="width: 100%; animation: progress ${duration}ms linear;"></div>` : ''}
    `;

    return notification;
  }

  remove(notification) {
    if (notification && notification.parentElement) {
      notification.classList.remove('show');
      setTimeout(() => {
        if (notification.parentElement) {
          notification.parentElement.removeChild(notification);
        }
        const index = this.notifications.indexOf(notification);
        if (index > -1) {
          this.notifications.splice(index, 1);
        }
      }, 300);
    }
  }

  success(message, duration = 5000) {
    return this.show(message, 'success', duration);
  }

  error(message, duration = 7000) {
    return this.show(message, 'error', duration);
  }

  warning(message, duration = 6000) {
    return this.show(message, 'warning', duration);
  }

  info(message, duration = 5000) {
    return this.show(message, 'info', duration);
  }
}

// Initialize notification manager
const notificationManager = new NotificationManager();

// Add CSS animation for progress bar
const style = document.createElement('style');
style.textContent = `
  @keyframes progress {
    from { width: 100%; }
    to { width: 0%; }
  }
`;
document.head.appendChild(style);

// Confirmation Modal Functions
let currentCouponId = null;
let currentCouponCode = null;

function showConfirmationModal(couponId, couponCode) {
  currentCouponId = couponId;
  currentCouponCode = couponCode;
  
  const modal = document.getElementById('confirmation-modal');
  const message = document.getElementById('confirmation-message');
  
  message.textContent = `Are you sure you want to delete the coupon "${couponCode}"? This action cannot be undone.`;
  modal.classList.add('show');
  
  // Add event listener to confirm button
  const confirmBtn = document.getElementById('confirm-delete-btn');
  confirmBtn.onclick = () => confirmDelete();
}

function hideConfirmationModal() {
  const modal = document.getElementById('confirmation-modal');
  modal.classList.remove('show');
  currentCouponId = null;
  currentCouponCode = null;
}

function confirmDelete() {
  if (!currentCouponId) return;
  
  const confirmBtn = document.getElementById('confirm-delete-btn');
  const originalText = confirmBtn.textContent;
  
  // Show loading state
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Deleting...';
  
  // Perform the actual deletion
  performCouponDeletion(currentCouponId, currentCouponCode)
    .finally(() => {
      // Reset button state
      confirmBtn.disabled = false;
      confirmBtn.textContent = originalText;
      hideConfirmationModal();
    });
}

async function performCouponDeletion(couponId, couponCode) {
  try {
    console.log(`Attempting to delete coupon: ${couponCode} (ID: ${couponId})`);
    
    const response = await fetch(`/admin/coupons/delete/${couponId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log(`Response status: ${response.status}`);
    
    // Parse the response data regardless of status
    let data;
    try {
      data = await response.json();
      console.log('Response data:', data);
    } catch (parseError) {
      console.error('Failed to parse response JSON:', parseError);
      throw new Error('Invalid server response');
    }

    if (response.ok && data.success) {
      // Success case - show notification and remove row from table
      notificationManager.success(data.message || `Coupon "${couponCode}" deleted successfully!`);
      
      // Remove the coupon row from the table
      const deleteButton = document.querySelector(`button[onclick="deleteCoupon('${couponId}')"]`);
      if (deleteButton) {
        const row = deleteButton.closest('tr');
        if (row) {
          row.remove();
        }
      }
    } else if (data.canSoftDelete) {
      // Show options for soft delete or force delete
      showDeleteOptionsModal(couponId, couponCode, data.message, data.usageCount);
    } else {
      // Error case - show the specific error message from server
      const errorMessage = data.message || getDefaultErrorMessage(response.status);
      notificationManager.error(errorMessage);
    }
  } catch (error) {
    console.error("Error deleting coupon:", error);
    
    // Handle network errors or other exceptions
    let errorMessage = "Failed to delete coupon. Please check your connection and try again.";
    
    if (error.message === 'Invalid server response') {
      errorMessage = "Server returned an invalid response. Please try again.";
    } else if (error.message.includes('fetch')) {
      errorMessage = "Network error. Please check your connection and try again.";
    }
    
    notificationManager.error(errorMessage);
  }
}

async function performSoftDelete(couponId, couponCode) {
  try {
    console.log(`Attempting to soft delete coupon: ${couponCode} (ID: ${couponId})`);
    
    const response = await fetch(`/admin/coupons/soft-delete/${couponId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log(`Soft delete response status: ${response.status}`);
    
    let data;
    try {
      data = await response.json();
      console.log('Soft delete response data:', data);
    } catch (parseError) {
      console.error('Failed to parse soft delete response JSON:', parseError);
      throw new Error('Invalid server response');
    }

    if (response.ok && data.success) {
      // Success case - show notification and update UI
      notificationManager.success(data.message || `Coupon "${couponCode}" deactivated successfully!`);
      
      // Update the coupon row in the table
      updateCouponRowStatus(couponId, 'Inactive');
    } else {
      const errorMessage = data.message || getDefaultErrorMessage(response.status);
      notificationManager.error(errorMessage);
    }
  } catch (error) {
    console.error("Error soft deleting coupon:", error);
    notificationManager.error("Failed to deactivate coupon. Please try again.");
  }
}

async function performForceDelete(couponId, couponCode) {
  try {
    console.log(`Attempting to force delete coupon: ${couponCode} (ID: ${couponId})`);
    
    const response = await fetch(`/admin/coupons/delete/${couponId}?force=true`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log(`Force delete response status: ${response.status}`);
    
    let data;
    try {
      data = await response.json();
      console.log('Force delete response data:', data);
    } catch (parseError) {
      console.error('Failed to parse force delete response JSON:', parseError);
      throw new Error('Invalid server response');
    }

    if (response.ok && data.success) {
      // Success case - show notification and remove row from table
      notificationManager.success(data.message || `Coupon "${couponCode}" permanently deleted!`);
      
      // Remove the coupon row from the table
      const deleteButton = document.querySelector(`button[onclick="deleteCoupon('${couponId}')"]`);
      if (deleteButton) {
        const row = deleteButton.closest('tr');
        if (row) {
          row.remove();
        }
      }
    } else {
      const errorMessage = data.message || getDefaultErrorMessage(response.status);
      notificationManager.error(errorMessage);
    }
  } catch (error) {
    console.error("Error force deleting coupon:", error);
    notificationManager.error("Failed to permanently delete coupon. Please try again.");
  }
}

function getDefaultErrorMessage(status) {
  switch (status) {
    case 400:
      return "Invalid request. Cannot delete this coupon.";
    case 404:
      return "Coupon not found.";
    case 500:
      return "Server error. Please try again later.";
    default:
      return "Failed to delete coupon. Please try again.";
  }
}

// Main delete function called by the delete buttons
function deleteCoupon(couponId) {
  // Get the coupon code from the table row
  const deleteButton = document.querySelector(`button[onclick="deleteCoupon('${couponId}')"]`);
  const row = deleteButton.closest('tr');
  const couponCode = row.cells[0].textContent.trim(); // First cell contains the coupon code
  
  console.log(`Delete requested for coupon: ${couponCode} (ID: ${couponId})`);
  
  // Show confirmation modal instead of browser confirm
  showConfirmationModal(couponId, couponCode);
}

// Create Coupon Form Handler
const createCouponForm = document.getElementById("createCouponForm");

if (createCouponForm) {
  createCouponForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const code = document.getElementById("modal-code").value.trim().toUpperCase();
    const discount = parseFloat(document.getElementById("modal-discount").value);
    const expiryDate = new Date(document.getElementById("modal-expiryDate").value);
    const usageLimit = parseInt(document.getElementById("modal-usageLimit").value);
    const minimumAmount = parseFloat(document.getElementById("modal-minimumAmount").value) || 0;


    // Validation
    if (!code) {
      notificationManager.error("Coupon code is required");
      return;
    }

    if (isNaN(discount) || discount < 0 || discount > 100) {
      notificationManager.error("Discount must be between 0 and 100");
      return;
    }

    if (isNaN(expiryDate.getTime()) || expiryDate <= new Date()) {
      notificationManager.error("Expiry date must be in the future");
      return;
    }

    if (isNaN(usageLimit) || usageLimit < 1) {
      notificationManager.error("Usage limit must be a positive integer");
      return;
    }

    // Show loading notification
    const loadingNotification = notificationManager.info("Creating coupon...", 0);

    try {
      const response = await fetch("/admin/coupons/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, discount, expiryDate, usageLimit, minimumAmount }),
      });
      
      const result = await response.json();

      // Remove loading notification
      notificationManager.remove(loadingNotification);

      if (result.success) {
        // Success case - redirect immediately
        window.location.href = "/admin/coupons";
      } else {
        notificationManager.error(result.message || "Failed to create coupon");
      }
    } catch (error) {
      console.error("Error creating coupon:", error);
      notificationManager.remove(loadingNotification);
      notificationManager.error("Failed to create coupon. Please try again.");
    }
  });
}

// Delete Options Modal Functions
let deleteOptionsCouponId = null;
let deleteOptionsCouponCode = null;

function showDeleteOptionsModal(couponId, couponCode, message, usageCount) {
  deleteOptionsCouponId = couponId;
  deleteOptionsCouponCode = couponCode;
  
  // Create the modal if it doesn't exist
  let modal = document.getElementById('delete-options-modal');
  if (!modal) {
    modal = createDeleteOptionsModal();
    document.body.appendChild(modal);
  }
  
  const messageElement = document.getElementById('delete-options-message');
  const usageInfo = document.getElementById('delete-options-usage');
  
  messageElement.textContent = message;
  usageInfo.textContent = `This coupon has been used ${usageCount} time(s). Choose an option:`;
  
  modal.classList.add('show');
}

function hideDeleteOptionsModal() {
  const modal = document.getElementById('delete-options-modal');
  if (modal) {
    modal.classList.remove('show');
  }
  deleteOptionsCouponId = null;
  deleteOptionsCouponCode = null;
}

function createDeleteOptionsModal() {
  const modal = document.createElement('div');
  modal.id = 'delete-options-modal';
  modal.className = 'confirmation-modal';
  
  modal.innerHTML = `
    <div class="confirmation-content" style="max-width: 500px;">
      <h3>Coupon Deletion Options</h3>
      <p id="delete-options-message"></p>
      <p id="delete-options-usage" style="font-weight: 500; color: #374151; margin-bottom: 20px;"></p>
      
      <div class="delete-options">
        <div class="delete-option">
          <h4>Deactivate (Recommended)</h4>
          <p>Sets coupon status to "Inactive". Preserves usage history and order data. Coupon cannot be used by customers.</p>
          <button type="button" class="confirmation-btn soft-delete" onclick="confirmSoftDelete()">Deactivate Coupon</button>
        </div>
        
        <div class="delete-option">
          <h4>Permanently Delete</h4>
          <p>Completely removes the coupon and all usage history. This action cannot be undone.</p>
          <button type="button" class="confirmation-btn force-delete" onclick="confirmForceDelete()">Permanently Delete</button>
        </div>
      </div>
      
      <div class="confirmation-actions" style="margin-top: 25px;">
        <button type="button" class="confirmation-btn cancel" onclick="hideDeleteOptionsModal()">Cancel</button>
      </div>
    </div>
  `;
  
  return modal;
}

function confirmSoftDelete() {
  if (!deleteOptionsCouponId) return;
  
  const softDeleteBtn = document.querySelector('.soft-delete');
  const originalText = softDeleteBtn.textContent;
  
  softDeleteBtn.disabled = true;
  softDeleteBtn.textContent = 'Deactivating...';
  
  performSoftDelete(deleteOptionsCouponId, deleteOptionsCouponCode)
    .finally(() => {
      softDeleteBtn.disabled = false;
      softDeleteBtn.textContent = originalText;
      hideDeleteOptionsModal();
    });
}

function confirmForceDelete() {
  if (!deleteOptionsCouponId) return;
  
  const forceDeleteBtn = document.querySelector('.force-delete');
  const originalText = forceDeleteBtn.textContent;
  
  forceDeleteBtn.disabled = true;
  forceDeleteBtn.textContent = 'Deleting...';
  
  performForceDelete(deleteOptionsCouponId, deleteOptionsCouponCode)
    .finally(() => {
      forceDeleteBtn.disabled = false;
      forceDeleteBtn.textContent = originalText;
      hideDeleteOptionsModal();
    });
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
  const confirmationModal = document.getElementById('confirmation-modal');
  const deleteOptionsModal = document.getElementById('delete-options-modal');
  
  if (e.target === confirmationModal) {
    hideConfirmationModal();
  }
  
  if (e.target === deleteOptionsModal) {
    hideDeleteOptionsModal();
  }
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    hideConfirmationModal();
    hideDeleteOptionsModal();
  }
});

// Reactivate coupon function
async function reactivateCoupon(couponId) {
  // Get the coupon code from the table row
  const reactivateButton = document.querySelector(`button[onclick="reactivateCoupon('${couponId}')"]`);
  const row = reactivateButton.closest('tr');
  const couponCode = row.cells[0].textContent.trim(); // First cell contains the coupon code
  
  console.log(`Reactivate requested for coupon: ${couponCode} (ID: ${couponId})`);
  
  // Show confirmation for reactivation
  const confirmed = confirm(`Are you sure you want to reactivate the coupon "${couponCode}"?`);
  if (!confirmed) return;
  
  const originalText = reactivateButton.textContent;
  
  // Show loading state
  reactivateButton.disabled = true;
  reactivateButton.textContent = 'Reactivating...';
  
  try {
    const response = await fetch(`/admin/coupons/reactivate/${couponId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log(`Reactivate response status: ${response.status}`);
    
    let data;
    try {
      data = await response.json();
      console.log('Reactivate response data:', data);
    } catch (parseError) {
      console.error('Failed to parse reactivate response JSON:', parseError);
      throw new Error('Invalid server response');
    }

    if (response.ok && data.success) {
      // Success case - show notification and update UI
      notificationManager.success(data.message || `Coupon "${couponCode}" reactivated successfully!`);
      
      // Update the coupon row in the table
      updateCouponRowStatus(couponId, 'Active');
    } else {
      const errorMessage = data.message || getDefaultErrorMessage(response.status);
      notificationManager.error(errorMessage);
    }
  } catch (error) {
    console.error("Error reactivating coupon:", error);
    
    let errorMessage = "Failed to reactivate coupon. Please check your connection and try again.";
    
    if (error.message === 'Invalid server response') {
      errorMessage = "Server returned an invalid response. Please try again.";
    } else if (error.message.includes('fetch')) {
      errorMessage = "Network error. Please check your connection and try again.";
    }
    
    notificationManager.error(errorMessage);
  } finally {
    // Reset button state
    reactivateButton.disabled = false;
    reactivateButton.textContent = originalText;
  }
}

// Helper function to update coupon row status in the UI
function updateCouponRowStatus(couponId, newStatus) {
  // Find the button that corresponds to this coupon
  const button = document.querySelector(`button[onclick*="'${couponId}'"]`);
  if (!button) return;
  
  const row = button.closest('tr');
  if (!row) return;
  
  // Find the status cell (assuming it's the 4th column based on typical table structure)
  const statusCell = row.cells[3]; // Adjust index if needed
  if (!statusCell) return;
  
  // Update the status badge
  const statusBadge = statusCell.querySelector('.status');
  if (statusBadge) {
    // Remove old status classes
    statusBadge.classList.remove('active', 'inactive', 'expired');
    
    // Add new status class and update text
    statusBadge.classList.add(newStatus.toLowerCase());
    statusBadge.textContent = newStatus;
  }
  
  // Update the action buttons based on new status
  const actionsCell = row.cells[4]; // Assuming actions are in the 5th column
  if (!actionsCell) return;
  
  if (newStatus === 'Inactive') {
    // Show reactivate button, hide delete button temporarily
    const deleteButton = actionsCell.querySelector('.btn-block');
    const reactivateButton = actionsCell.querySelector('.btn-reactivate');
    
    if (deleteButton) {
      deleteButton.style.display = 'none';
    }
    
    if (!reactivateButton) {
      // Create reactivate button if it doesn't exist
      const newReactivateButton = document.createElement('button');
      newReactivateButton.className = 'btn-action btn-reactivate';
      newReactivateButton.textContent = 'Reactivate';
      newReactivateButton.onclick = () => reactivateCoupon(couponId);
      actionsCell.appendChild(newReactivateButton);
    } else {
      reactivateButton.style.display = 'inline-block';
    }
  } else if (newStatus === 'Active') {
    // Show delete button, hide reactivate button
    const deleteButton = actionsCell.querySelector('.btn-block');
    const reactivateButton = actionsCell.querySelector('.btn-reactivate');
    
    if (deleteButton) {
      deleteButton.style.display = 'inline-block';
    }
    
    if (reactivateButton) {
      reactivateButton.style.display = 'none';
    }
  }
}

// Add Coupon Modal Functions
function openAddCouponModal() {
  const modal = document.getElementById('add-coupon-modal');
  if (modal) {
    modal.style.display = 'flex';
    // Clear form and errors
    clearModalForm();
    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('modal-expiryDate').setAttribute('min', today);
  }
}

const addMaxAmountInput = document.getElementById("modal-maxAmount");
const addOrderMaxAmountInput = document.getElementById("modal-orderMaxAmount");

function enforceExclusiveAddFields() {
  if (!addMaxAmountInput || !addOrderMaxAmountInput) return;

  const info = document.getElementById("maxRuleInfo");

  function updateMessage() {
    if (addMaxAmountInput.value.trim() !== "") {
      info.textContent =
        "Maximum Discount Amount is active. Maximum Order Amount has been disabled.";
    } else if (addOrderMaxAmountInput.value.trim() !== "") {
      info.textContent =
        "Maximum Order Amount is active. Maximum Discount Amount has been disabled.";
    } else {
      info.textContent =
        "You can set either “Maximum Discount Amount” or “Maximum Order Amount”, but not both.";
    }
  }

  // When typing in maxAmount field
  addMaxAmountInput.addEventListener("input", () => {
    if (addMaxAmountInput.value.trim() !== "") {
      addOrderMaxAmountInput.value = "";
      addOrderMaxAmountInput.disabled = true;
      addOrderMaxAmountInput.classList.add("exclusive-disabled");
      addOrderMaxAmountInput.title =
        "Disabled because Maximum Discount Amount is set.";
    } else {
      addOrderMaxAmountInput.disabled = false;
      addOrderMaxAmountInput.classList.remove("exclusive-disabled");
      addOrderMaxAmountInput.removeAttribute("title");
    }
    updateMessage();
  });

  // When typing in orderMaxAmount field
  addOrderMaxAmountInput.addEventListener("input", () => {
    if (addOrderMaxAmountInput.value.trim() !== "") {
      addMaxAmountInput.value = "";
      addMaxAmountInput.disabled = true;
      addMaxAmountInput.classList.add("exclusive-disabled");
      addMaxAmountInput.title =
        "Disabled because Maximum Order Amount is set.";
    } else {
      addMaxAmountInput.disabled = false;
      addMaxAmountInput.classList.remove("exclusive-disabled");
      addMaxAmountInput.removeAttribute("title");
    }
    updateMessage();
  });

  // Initialize initial message
  updateMessage();
}

enforceExclusiveAddFields();


function closeAddCouponModal() {
  const modal = document.getElementById('add-coupon-modal');
  if (modal) {
    modal.style.display = 'none';
    clearModalForm();
  }
}

function clearModalForm() {
  const form = document.getElementById('add-coupon-form');
  if (form) {
    form.reset();
    // Clear all error messages
    document.querySelectorAll('.error-message').forEach(error => {
      error.textContent = '';
    });
  }
}

// Form validation functions
function validateCouponForm(formData) {
    const errors = {};

    // Normalize values
    const code = (formData.code || "").trim().toUpperCase();
    const discount = Number(formData.discount);
    const usageLimit = Number(formData.usageLimit);
    const minimumAmount = formData.minimumAmount === "" ? "" : Number(formData.minimumAmount);
    const orderMaxAmount = formData.orderMaxAmount === "" ? "" : Number(formData.orderMaxAmount);
    const maxAmount = formData.maxAmount === "" ? "" : Number(formData.maxAmount);
    const expiryDate = formData.expiryDate ? new Date(formData.expiryDate) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // CODE VALIDATION
    if (!code) {
        errors.code = "Coupon code is required";
    } else if (code.length < 3) {
        errors.code = "Coupon code must be at least 3 characters";
    } else if (!/^[A-Z0-9_-]+$/.test(code)) {
        errors.code = "Only letters, numbers, hyphens and underscores allowed";
    }

    // DISCOUNT VALIDATION
    if (isNaN(discount)) {
        errors.discount = "Discount is required and must be a valid number";
    } else if (discount < 1) {
        errors.discount = "Discount must be at least 1%";
    } else if (discount > 50) {
        errors.discount = "Maximum allowed discount is 50%";
    }

    // DATE VALIDATION
    if (!expiryDate || isNaN(expiryDate.getTime())) {
        errors.expiryDate = "Expiry date is required and must be valid";
    } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // must be strictly in the future
        if (expiryDate <= today) {
            errors.expiryDate = "Expiry date must be in the future";
        }

        // not allowed to backdate by timezone drift
        if (expiryDate.toString() === "Invalid Date") {
            errors.expiryDate = "Invalid expiry date";
        }

        // safety upper bound (prevents unrealistic coupons)
        const threeYearsLater = new Date();
        threeYearsLater.setFullYear(threeYearsLater.getFullYear() + 3);

        if (expiryDate > threeYearsLater) {
            errors.expiryDate = "Expiry date cannot be more than 3 years from today";
        }
    }

    // USAGE LIMIT VALIDATION
    if (isNaN(usageLimit)) {
        errors.usageLimit = "Usage limit is required";
    } else if (usageLimit < 1) {
        errors.usageLimit = "Usage limit must be at least 1";
    }

    // MINIMUM AMOUNT VALIDATION
    if (minimumAmount !== "" && isNaN(minimumAmount)) {
        errors.minimumAmount = "Minimum amount must be a valid number";
    } else if (minimumAmount < 0) {
        errors.minimumAmount = "Minimum amount cannot be negative";
    }

    //MAX ORDER AMOUNT VALIDATION
    if (orderMaxAmount !== "" && isNaN(orderMaxAmount)) {
        errors.orderMaxAmount = "Maximum order amount must be a valid number";
    } else if (orderMaxAmount < 0) {
        errors.orderMaxAmount = "Maximum order amount cannot be negative";
    }

    // MAX AMOUNT VALIDATION
    if (maxAmount !== "" && isNaN(maxAmount)) {
        errors.maxAmount = "Maximum discount amount must be a valid number";
    } else if (maxAmount < 0) {
        errors.maxAmount = "Maximum discount amount cannot be negative";
    }

    // LOGICAL VALIDATION: min < max
    if (minimumAmount !== "" && orderMaxAmount !== "" && Number(minimumAmount) >= Number(orderMaxAmount)) {
        errors.orderMaxAmount = "Maximum order amount must be greater than minimum order amount";
    }

    // Additional logical rule for high discounts
    if (discount > 30 && (maxAmount === "" || isNaN(maxAmount))) {
        errors.maxAmount = "Max discount amount is required when discount exceeds 30%";
    }

    return errors;
}

function displayValidationErrors(errors) {
  // Clear previous errors
  document.querySelectorAll('.error-message').forEach(error => {
    error.textContent = '';
  });
  
  // Display new errors
  Object.keys(errors).forEach(field => {
    const errorElement = document.getElementById(`${field}-error`);
    if (errorElement) {
      errorElement.textContent = errors[field];
    }
  });
}

// Handle Add Coupon Form Submission
const addCouponForm = document.getElementById('add-coupon-form');
if (addCouponForm) {
  addCouponForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(addCouponForm);
const couponData = {
  code: formData.get('code'),
  discount: formData.get('discount'),
  expiryDate: formData.get('expiryDate'),
  usageLimit: formData.get('usageLimit'),
  minimumAmount: formData.get('minimumAmount') || 0,
  orderMaxAmount: formData.get('orderMaxAmount') || "",
  maxAmount: formData.get('maxAmount') || ""
};
    // Frontend validation
    const errors = validateCouponForm(couponData);
    if (Object.keys(errors).length > 0) {
      displayValidationErrors(errors);
      return;
    }
    
    try {
      const response = await fetch('/admin/coupons/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(couponData)
      });
      
      const result = await response.json();
      
      if (result.success) {
        notificationManager.show('Coupon created successfully!', 'success');
        closeAddCouponModal();
        // Refresh the page to show the new coupon
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        // Handle server-side validation errors
        if (result.message) {
          notificationManager.show(result.message, 'error');
        }
      }
    } catch (error) {
      console.error('Error creating coupon:', error);
      notificationManager.show('Failed to create coupon. Please try again.', 'error');
    }
  });
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
  const addCouponModal = document.getElementById('add-coupon-modal');
  if (e.target === addCouponModal) {
    closeAddCouponModal();
  }
  
  const editCouponModal = document.getElementById('edit-coupon-modal');
  if (e.target === editCouponModal) {
    closeEditCouponModal();
  }
});

// Edit Coupon Modal Functions
async function openEditCouponModal(couponId) {
  try {
    // Fetch coupon data
    const response = await fetch(`/admin/coupons/${couponId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch coupon data');
    }

    const data = await response.json();
    if (!data.success) {
      notificationManager.error(data.message || 'Failed to fetch coupon data');
      return;
    }

    const coupon = data.coupon;
    
    // Pre-fill the form with coupon data
    document.getElementById('edit-coupon-id').value = coupon._id;
    document.getElementById('edit-modal-code').value = coupon.code;
    document.getElementById('edit-modal-discount').value = coupon.discount;
    
    // Format date for input field (YYYY-MM-DD)
    const expiryDate = new Date(coupon.expiryDate);
    const formattedDate = expiryDate.toISOString().split('T')[0];
    document.getElementById('edit-modal-expiryDate').value = formattedDate;
    
    document.getElementById('edit-modal-usageLimit').value = coupon.usageLimit;
    document.getElementById('edit-modal-minimumAmount').value = coupon.minimumAmount || '';

    document.getElementById('edit-modal-orderMaxAmount').value = coupon.orderMaxAmount || '';

    document.getElementById('edit-modal-maxAmount').value = coupon.maxAmount || '';

    /* ======= EXCLUSIVE MAX FIELDS (Edit Coupon Modal) ======= */
    const editMaxAmountInput = document.getElementById("edit-modal-maxAmount");
    const editOrderMaxAmountInput = document.getElementById("edit-modal-orderMaxAmount");

    function enforceExclusiveEditFields() {
  if (!editMaxAmountInput || !editOrderMaxAmountInput) return;

  const info = document.getElementById("edit-maxRuleInfo"); // Separate message for Edit modal

  function updateMessage() {
    if (editMaxAmountInput.value.trim() !== "") {
      info.textContent =
        "Maximum Discount Amount is active. Maximum Order Amount has been disabled.";
    } else if (editOrderMaxAmountInput.value.trim() !== "") {
      info.textContent =
        "Maximum Order Amount is active. Maximum Discount Amount has been disabled.";
    } else {
      info.textContent =
        "You can set either “Maximum Discount Amount” or “Maximum Order Amount”, but not both.";
    }
  }

  // Initial cleanup of classes + tooltips
  editMaxAmountInput.classList.remove("exclusive-disabled");
  editOrderMaxAmountInput.classList.remove("exclusive-disabled");
  editMaxAmountInput.removeAttribute("title");
  editOrderMaxAmountInput.removeAttribute("title");

  // Apply pre-filled state logic
  if (editMaxAmountInput.value.trim() !== "") {
    editOrderMaxAmountInput.disabled = true;
    editOrderMaxAmountInput.classList.add("exclusive-disabled");
    editOrderMaxAmountInput.title =
      "Disabled because Maximum Discount Amount is set.";
  } else if (editOrderMaxAmountInput.value.trim() !== "") {
    editMaxAmountInput.disabled = true;
    editMaxAmountInput.classList.add("exclusive-disabled");
    editMaxAmountInput.title =
      "Disabled because Maximum Order Amount is set.";
  } else {
    editMaxAmountInput.disabled = false;
    editOrderMaxAmountInput.disabled = false;
  }

  // When editing maxAmount
  editMaxAmountInput.addEventListener("input", () => {
    if (editMaxAmountInput.value.trim() !== "") {
      editOrderMaxAmountInput.value = "";
      editOrderMaxAmountInput.disabled = true;
      editOrderMaxAmountInput.classList.add("exclusive-disabled");
      editOrderMaxAmountInput.title =
        "Disabled because Maximum Discount Amount is set.";
    } else {
      editOrderMaxAmountInput.disabled = false;
      editOrderMaxAmountInput.classList.remove("exclusive-disabled");
      editOrderMaxAmountInput.removeAttribute("title");
    }
    updateMessage();
  });

  // When editing orderMaxAmount
  editOrderMaxAmountInput.addEventListener("input", () => {
    if (editOrderMaxAmountInput.value.trim() !== "") {
      editMaxAmountInput.value = "";
      editMaxAmountInput.disabled = true;
      editMaxAmountInput.classList.add("exclusive-disabled");
      editMaxAmountInput.title =
        "Disabled because Maximum Order Amount is set.";
    } else {
      editMaxAmountInput.disabled = false;
      editMaxAmountInput.classList.remove("exclusive-disabled");
      editMaxAmountInput.removeAttribute("title");
    }
    updateMessage();
  });

  updateMessage(); // Set initial message
}

enforceExclusiveEditFields();



    // Clear any previous errors
    clearEditModalErrors();
    
    // Show the modal
    document.getElementById('edit-coupon-modal').style.display = 'flex';
  } catch (error) {
    console.error('Error opening edit modal:', error);
    notificationManager.error('Failed to open edit modal');
  }
}

function closeEditCouponModal() {
  document.getElementById('edit-coupon-modal').style.display = 'none';
  clearEditModalForm();
}

function clearEditModalForm() {
  document.getElementById('edit-coupon-form').reset();
  clearEditModalErrors();
}

function clearEditModalErrors() {
  const errorElements = document.querySelectorAll('#edit-coupon-modal .error-message');
  errorElements.forEach(element => {
    element.textContent = '';
    element.style.display = 'none';
  });
}

function displayEditValidationErrors(errors) {
  clearEditModalErrors();

  Object.keys(errors).forEach(field => {
    const errorElement = document.getElementById(`edit-${field}-error`);
    if (errorElement) {
      errorElement.textContent = errors[field];
      errorElement.style.display = 'block';
    }
  });
}


// Handle Edit Coupon Form Submission
const editCouponForm = document.getElementById('edit-coupon-form');
if (editCouponForm) {
  editCouponForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(editCouponForm);
    const couponId = formData.get('couponId');
    
    const couponData = {
      code: formData.get('code'),
      discount: formData.get('discount'),
      expiryDate: formData.get('expiryDate'),
      usageLimit: formData.get('usageLimit'),
      minimumAmount: formData.get('minimumAmount'),
      orderMaxAmount: formData.get('orderMaxAmount'),
      maxAmount: formData.get('maxAmount'),
    };

    const errors = validateCouponForm(couponData);
    if (Object.keys(errors).length > 0) {
        displayEditValidationErrors(errors);
        return;
    }

    try {
      const response = await fetch(`/admin/coupons/${couponId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(couponData)
      });

      const data = await response.json();

      if (data.success) {
        notificationManager.success(data.message || 'Coupon updated successfully');
        closeEditCouponModal();
        
        // Update the coupon row in the table
        updateCouponRow(couponId, data.coupon);
      } else {
        if (data.errors) {
          displayEditValidationErrors(data.errors);
        } else {
          notificationManager.error(data.message || 'Failed to update coupon');
        }
      }
    } catch (error) {
      console.error('Error updating coupon:', error);
      notificationManager.error('Failed to update coupon');
    }
  });
}

// Helper function to update coupon row in the table
function updateCouponRow(couponId, updatedCoupon) {
  const rows = document.querySelectorAll('tbody tr');
  
  rows.forEach(row => {
    const editButton = row.querySelector(`button[onclick="openEditCouponModal('${couponId}')"]`);
    if (editButton) {
      // Update the row data
      const cells = row.querySelectorAll('td');
      if (cells.length >= 5) {
        cells[0].textContent = updatedCoupon.code; // Coupon Code
        cells[1].textContent = updatedCoupon.discount; // Discount
        
        // Minimum Amount
        if (updatedCoupon.minimumAmount > 0) {
          cells[2].innerHTML = `₹${updatedCoupon.minimumAmount.toLocaleString('en-IN')}`;
        } else {
          cells[2].innerHTML = '<span style="color: #666;">No minimum</span>';
        }
        
        // Expiry Date
        const expiryDate = new Date(updatedCoupon.expiryDate);
        cells[3].textContent = expiryDate.toLocaleDateString('en-GB');
      }
    }
  });
}

console.log('Coupon management system initialized with custom notifications and soft delete options');