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

  const priceRangeSlider = document.getElementById('priceRangeSlider');
  const minPriceInput = document.getElementById('minPrice');
  const maxPriceInput = document.getElementById('maxPrice');

  if (priceRangeSlider && minPriceInput && maxPriceInput) {
    priceRangeSlider.addEventListener('input', function () {
      maxPriceInput.value = this.value;
    });

    minPriceInput.addEventListener('input', function () {
      if (parseInt(this.value) > parseInt(maxPriceInput.value)) {
        maxPriceInput.value = this.value;
      }
    });

    maxPriceInput.addEventListener('input', function () {
      if (parseInt(this.value) < parseInt(minPriceInput.value)) {
        minPriceInput.value = this.value;
      }
      priceRangeSlider.value = this.value;
    });
  }

  const applyPriceFilterBtn = document.getElementById('applyPriceFilter');
  if (applyPriceFilterBtn) {
    applyPriceFilterBtn.addEventListener('click', function () {
      const minPrice = parseInt(minPriceInput.value) || minLimit;
      const maxPrice = parseInt(maxPriceInput.value) || maxLimit;
      window.location.href = buildUrl({ minPrice, maxPrice, page: 1 });
    });
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

    fetch(`/wishlist/add/${productId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
      .then(res => res.json())
      .then(data => {
        const toast = document.getElementById('toast');
        if (toast) {
          toast.textContent = data.message || 'Added to wishlist!';
          toast.classList.add('show');
          setTimeout(() => toast.classList.remove('show'), 2000);
        }
      })
      .catch(err => {
        console.error('Error adding to wishlist:', err);
      });
  });
});
});

document.querySelectorAll('.wishlist-btn').forEach(button => {
  button.addEventListener('click', function (e) {
    e.preventDefault();

    const productId = this.getAttribute('data-product-id');
    const icon = this.querySelector('i');

    fetch(`/wishlist/add/${productId}`, {
      method: 'POST',
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          icon.classList.toggle('bi-heart');
          icon.classList.toggle('bi-heart-fill');
          icon.classList.toggle('text-danger');

          const toast = document.getElementById('toast');
          if (toast) {
            toast.textContent = data.message || 'Wishlist updated!';
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 2000);
          }
        }
      })
      .catch(err => {
        console.error('Wishlist update error:', err);
      });
  });
});