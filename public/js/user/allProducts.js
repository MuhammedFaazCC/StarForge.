document.addEventListener('DOMContentLoaded', function () {
  const minLimit = window.initialFilters.minPrice;
  const maxLimit = window.initialFilters.maxPrice;

  function buildUrl(params = {}) {
    const url = new URL(window.location.href);
    const currentParams = {
      category: url.searchParams.get('category') || 'all',
      minPrice: url.searchParams.get('minPrice') || minLimit,
      maxPrice: url.searchParams.get('maxPrice') || maxLimit,
      sort: url.searchParams.get('sort') || 'latest',
      search: url.searchParams.get('search') || '',
      page: url.searchParams.get('page') || '1'
    };
    const finalParams = { ...currentParams, ...params };  

    const newUrl = new URL(window.location.pathname, window.location.origin);
    if (finalParams.category !== 'all') newUrl.searchParams.set('category', finalParams.category);
    if (parseInt(finalParams.minPrice) > minLimit) newUrl.searchParams.set('minPrice', finalParams.minPrice);
    if (parseInt(finalParams.maxPrice) < maxLimit) newUrl.searchParams.set('maxPrice', finalParams.maxPrice);
    if (finalParams.sort !== 'latest') newUrl.searchParams.set('sort', finalParams.sort);
    if (finalParams.search) newUrl.searchParams.set('search', finalParams.search);
    if (finalParams.page !== '1') newUrl.searchParams.set('page', finalParams.page);

    return newUrl.toString();
  }

  const filterToggle = document.querySelector('.filter-toggle');
  const filterContent = document.querySelector('.filter-content');
  if (filterToggle) {
    filterToggle.addEventListener('click', () => {
      filterContent.classList.toggle('show');
    });
  }

  const minPriceSlider = document.getElementById('minPriceSlider');
  const maxPriceSlider = document.getElementById('maxPriceSlider');
  const minPriceInput = document.getElementById('minPrice');
  const maxPriceInput = document.getElementById('maxPrice');
  const priceTrack = document.getElementById('priceTrack');
  const applyPriceBtn = document.getElementById('applyPriceFilter');

  if (minPriceSlider && maxPriceSlider && minPriceInput && maxPriceInput && priceTrack) {
    const priceMin = parseInt(minPriceSlider.min);
    const priceMax = parseInt(minPriceSlider.max);
    const step = 10;

    function updateTrack() {
      const minVal = parseInt(minPriceSlider.value);
      const maxVal = parseInt(maxPriceSlider.value);
      const range = priceMax - priceMin;
      
      const minPercent = ((minVal - priceMin) / range) * 100;
      const maxPercent = ((maxVal - priceMin) / range) * 100;
      
      priceTrack.style.left = minPercent + '%';
      priceTrack.style.width = (maxPercent - minPercent) + '%';
    }

    function updateFromSlider(type) {
      const minVal = parseInt(minPriceSlider.value);
      const maxVal = parseInt(maxPriceSlider.value);
      
      if (type === 'min') {
        if (minVal >= maxVal) {
          minPriceSlider.value = Math.max(priceMin, maxVal - step);
        }
        minPriceInput.value = minPriceSlider.value;
      } else {
        if (maxVal <= minVal) {
          maxPriceSlider.value = Math.min(priceMax, minVal + step);
        }
        maxPriceInput.value = maxPriceSlider.value;
      }
      
      updateTrack();
    }

    function updateFromInput(type) {
      const minVal = parseInt(minPriceInput.value) || priceMin;
      const maxVal = parseInt(maxPriceInput.value) || priceMax;
      
      if (type === 'min') {
        const clampedMin = Math.max(priceMin, Math.min(minVal, maxVal - step));
        minPriceInput.value = clampedMin;
        minPriceSlider.value = clampedMin;
      } else {
        const clampedMax = Math.min(priceMax, Math.max(maxVal, minVal + step));
        maxPriceInput.value = clampedMax;
        maxPriceSlider.value = clampedMax;
      }
      
      updateTrack();
    }

    minPriceSlider.addEventListener('input', () => updateFromSlider('min'));
    maxPriceSlider.addEventListener('input', () => updateFromSlider('max'));
    
    minPriceInput.addEventListener('input', () => updateFromInput('min'));
    maxPriceInput.addEventListener('input', () => updateFromInput('max'));
    
    minPriceInput.addEventListener('blur', () => updateFromInput('min'));
    maxPriceInput.addEventListener('blur', () => updateFromInput('max'));

    if (applyPriceBtn) {
      applyPriceBtn.addEventListener('click', function() {
        const minPrice = parseInt(minPriceInput.value);
        const maxPrice = parseInt(maxPriceInput.value);
        
        if (minPrice >= maxPrice) {
          Swal.fire({
            icon: 'warning',
            title: 'Invalid Price Range',
            text: 'Minimum price must be less than maximum price',
            confirmButtonText: 'OK',
            confirmButtonColor: '#ffc107'
          });
          return;
        }
        
        window.location.href = buildUrl({ 
          minPrice: minPrice, 
          maxPrice: maxPrice, 
          page: 1 
        });
      });
    }

    let isSliding = false;
    
    minPriceSlider.addEventListener('mousedown', () => { isSliding = true; });
    maxPriceSlider.addEventListener('mousedown', () => { isSliding = true; });
    
    minPriceSlider.addEventListener('mouseup', () => {
      if (isSliding) {
        isSliding = false;
        applyPriceFilter();
      }
    });
    
    maxPriceSlider.addEventListener('mouseup', () => {
      if (isSliding) {
        isSliding = false;
        applyPriceFilter();
      }
    });

    minPriceSlider.addEventListener('touchend', () => {
      setTimeout(() => applyPriceFilter(), 100);
    });
    
    maxPriceSlider.addEventListener('touchend', () => {
      setTimeout(() => applyPriceFilter(), 100);
    });

    function applyPriceFilter() {
      const minPrice = parseInt(minPriceInput.value);
      const maxPrice = parseInt(maxPriceInput.value);
      
      const currentUrl = new URL(window.location.href);
      const currentMin = parseInt(currentUrl.searchParams.get('minPrice')) || minLimit;
      const currentMax = parseInt(currentUrl.searchParams.get('maxPrice')) || maxLimit;
      
      if (minPrice !== currentMin || maxPrice !== currentMax) {
        window.location.href = buildUrl({ 
          minPrice: minPrice, 
          maxPrice: maxPrice, 
          page: 1 
        });
      }
    }

    minPriceInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        const minPrice = parseInt(this.value);
        const maxPrice = parseInt(maxPriceInput.value);
        
        if (minPrice >= maxPrice) {
          Swal.fire({
            icon: 'warning',
            title: 'Invalid Price Range',
            text: 'Minimum price must be less than maximum price',
            confirmButtonText: 'OK',
            confirmButtonColor: '#ffc107'
          });
          return;
        }
        
        window.location.href = buildUrl({ 
          minPrice: minPrice, 
          maxPrice: maxPrice, 
          page: 1 
        });
      }
    });

    maxPriceInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        const minPrice = parseInt(minPriceInput.value);
        const maxPrice = parseInt(this.value);
        
        if (minPrice >= maxPrice) {
          Swal.fire({
            icon: 'warning',
            title: 'Invalid Price Range',
            text: 'Minimum price must be less than maximum price',
            confirmButtonText: 'OK',
            confirmButtonColor: '#ffc107'
          });
          return;
        }
        
        window.location.href = buildUrl({ 
          minPrice: minPrice, 
          maxPrice: maxPrice, 
          page: 1 
        });
      }
    });

    maxPriceSlider.style.zIndex = '2';
    minPriceSlider.style.zIndex = '1';

    updateTrack();
  }

  document.querySelectorAll('.category-filter').forEach(input => {
    input.addEventListener('change', () => {
      window.location.href = buildUrl({ category: input.value, page: 1 });
    });
  });

  const sortFilter = document.getElementById('sortFilter');
  if (sortFilter) {
    sortFilter.addEventListener('change', function () {
      window.location.href = buildUrl({ sort: this.value, page: 1 });
    });
  }

  document.querySelectorAll('.filter-badge .close').forEach(closeBtn => {
    closeBtn.addEventListener('click', function () {
      const type = this.getAttribute('data-filter');
      const newParams = {};
      if (type === 'price') {
        newParams.minPrice = minLimit;
        newParams.maxPrice = maxLimit;
      } else if (type === 'category') {
        newParams.category = 'all';
      } else if (type === 'sort') {
        newParams.sort = 'latest';
      } else if (type === 'search') {
        newParams.search = '';
      }
      newParams.page = 1;
      window.location.href = buildUrl(newParams);
    });
  });

  const clearAllBtn = document.getElementById('clearAllFilters');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      window.location.href = buildUrl({
        category: 'all',
        minPrice: minLimit,
        maxPrice: maxLimit,
        sort: 'latest',
        search: '',
        page: 1
      });
    });
  }

  document.querySelectorAll('.wishlist-btn').forEach(button => {
    button.addEventListener('click', function (e) {
      e.preventDefault();
      const productId = this.getAttribute('data-product-id');
      const icon = this.querySelector('i');

      fetch(`/wishlist/add/${productId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
        .then(res => res.json())
        .then(data => {
          if (data.redirect) {
            window.location.href = data.redirect;
            return;
          }
          if (data.success) {
            icon.classList.toggle('bi-heart');
            icon.classList.toggle('bi-heart-fill');
            icon.classList.toggle('text-danger');
          }

          const toast = document.getElementById('toast');
          if (toast) {
            toast.textContent = data.message || 'Wishlist updated!';
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 2000);
          }

          if (window.updateNavbarCounts && typeof data.wishlistCount !== 'undefined') {
            window.updateNavbarCounts({ wishlistCount: data.wishlistCount });
          }
        })
        .catch(err => {
          console.error('Wishlist update error:', err);
        });
    });
  });

  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');

  if (searchInput) {
    searchInput.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') {
        window.location.href = buildUrl({ search: searchInput.value.trim(), page: 1 });
      }
    });
  }

  if (searchClear) {
    searchClear.addEventListener('click', function () {
      const input = document.getElementById('searchInput');
      if (input) input.value = '';
      window.location.href = buildUrl({ search: '', page: 1 });
    });
  }
});