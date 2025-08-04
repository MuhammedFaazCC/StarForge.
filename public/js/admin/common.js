let sidebarToggled = false;
function initializeAdminCommon() {
    initializeSidebarToggle();
    initializeSidebarNavigation();
    handleResponsiveLayout();
}
function initializeSidebarToggle() {
    const toggleBtn = document.getElementById('sidebarToggle');
    const sidePanel = document.querySelector('.side-panel');
    const mainContent = document.querySelector('.main-content');

    if (toggleBtn && sidePanel && mainContent) {
        toggleBtn.addEventListener('click', function() {
            sidebarToggled = !sidebarToggled;
            
            if (sidebarToggled) {
                sidePanel.classList.add('collapsed');
                mainContent.classList.add('expanded');
                toggleBtn.innerHTML = '<i class="fas fa-times"></i>';
                toggleBtn.setAttribute('aria-label', 'Close Sidebar');
            } else {
                sidePanel.classList.remove('collapsed');
                mainContent.classList.remove('expanded');
                toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
                toggleBtn.setAttribute('aria-label', 'Toggle Sidebar');
            }
        });
    }
}

function initializeSidebarNavigation() {
    const sidebarLinks = document.querySelectorAll('.side-panel a');
    
    sidebarLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            
            sidebarLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            
            localStorage.setItem('adminActivePage', this.getAttribute('href'));
        });
    });
    
    const activePage = localStorage.getItem('adminActivePage');
    if (activePage) {
        const activeLink = document.querySelector(`.side-panel a[href="${activePage}"]`);
        if (activeLink) {
            sidebarLinks.forEach(l => l.classList.remove('active'));
            activeLink.classList.add('active');
        }
    }
}

function handleResponsiveLayout() {
    function checkScreenSize() {
        const sidePanel = document.querySelector('.side-panel');
        const mainContent = document.querySelector('.main-content');
        const toggleBtn = document.getElementById('sidebarToggle');
        
        if (window.innerWidth <= 768) {
            if (sidePanel) {
                sidePanel.classList.add('mobile');
                if (!sidebarToggled) {
                    sidePanel.classList.add('hidden');
                }
            }
            if (mainContent) {
                mainContent.classList.add('mobile');
            }
            if (toggleBtn) {
                toggleBtn.style.display = 'block';
            }
        } else {
            if (sidePanel) {
                sidePanel.classList.remove('mobile', 'hidden');
            }
            if (mainContent) {
                mainContent.classList.remove('mobile');
            }
            if (toggleBtn) {
                toggleBtn.style.display = 'block';
            }
            sidebarToggled = false;
        }
    }
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
}

function showButtonLoading(button, loadingText = 'Loading...') {
    if (!button) return;
    
    button.disabled = true;
    button.dataset.originalText = button.innerHTML;
    button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
}

function hideButtonLoading(button) {
    if (!button) return;
    
    button.disabled = false;
    if (button.dataset.originalText) {
        button.innerHTML = button.dataset.originalText;
        delete button.dataset.originalText;
    }
}

function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas fa-${getToastIcon(type)}"></i>
            <span>${message}</span>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, duration);
}

function getToastIcon(type) {
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    return icons[type] || 'info-circle';
}

function confirmAction(title, text, confirmButtonText = 'Yes', cancelButtonText = 'No') {
    return new Promise((resolve) => {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: title,
                text: text,
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#FCA120',
                cancelButtonColor: '#6c757d',
                confirmButtonText: confirmButtonText,
                cancelButtonText: cancelButtonText
            }).then((result) => {
                resolve(result.isConfirmed);
            });
        } else {
            resolve(confirm(`${title}\n\n${text}`));
        }
    });
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
}

function formatDate(date, options = {}) {
    const defaultOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    };
    
    return new Date(date).toLocaleDateString('en-IN', { ...defaultOptions, ...options });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function handleAjaxError(error, defaultMessage = 'An error occurred') {
    console.error('AJAX Error:', error);
    
    let message = defaultMessage;
    if (error.responseJSON && error.responseJSON.message) {
        message = error.responseJSON.message;
    } else if (error.statusText) {
        message = error.statusText;
    }
    
    showToast(message, 'error');
}

document.addEventListener('DOMContentLoaded', function() {
    initializeAdminCommon();
});

document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
    }
});

window.AdminCommon = {
    showButtonLoading,
    hideButtonLoading,
    showToast,
    confirmAction,
    formatCurrency,
    formatDate,
    debounce,
    handleAjaxError
};