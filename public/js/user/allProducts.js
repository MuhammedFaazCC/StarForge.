document.addEventListener('DOMContentLoaded', function () {
  function buildUrl(params = {}) {
    const url = new URL(window.location.href);

    const currentParams = {
      category: url.searchParams.get('category') || 'all',
      minPrice: url.searchParams.get('minPrice') || '<%= priceRange.min %>',
      maxPrice: url.searchParams.get('maxPrice') || '<%= priceRange.max %>',
      sort: url.searchParams.get('sort') || 'latest',
      search: url.searchParams.get('search') || '',
      page: url.searchParams.get('page') || '1'
    };

    const finalParams = { ...currentParams, ...params };

    const newUrl = new URL(window.location.pathname, window.location.origin);

    if (finalParams.category !== 'all') {
      newUrl.searchParams.set('category', finalParams.category);
    }

    const minPrice = parseInt(finalParams.minPrice);
    const maxPrice = parseInt(finalParams.maxPrice);
    if (!isNaN(minPrice) && minPrice >= parseInt('<%= priceRange.min %>')) {
      newUrl.searchParams.set('minPrice', minPrice);
    }

    if (!isNaN(maxPrice) && maxPrice <= parseInt('<%= priceRange.max %>')) {
      newUrl.searchParams.set('maxPrice', maxPrice);
    }

    if (finalParams.sort !== 'latest') {
      newUrl.searchParams.set('sort', finalParams.sort);
    }

    if (finalParams.search) {
      newUrl.searchParams.set('search', finalParams.search);
    }

    if (finalParams.page !== '1') {
      newUrl.searchParams.set('page', finalParams.page);
    }

    const finalUrl = newUrl.toString();
    console.log('Navigating to:', finalUrl);
    return finalUrl;
  }

  window.buildUrl = buildUrl;

  const filterToggle = document.querySelector('.filter-toggle');
  const filterContent = document.querySelector('.filter-content');

  if (filterToggle) {
    filterToggle.addEventListener('click', function () {
      filterContent.classList.toggle('show');
    });
  }

  const priceRangeSlider = document.getElementById('priceRangeSlider');
  const minPriceInput = document.getElementById('minPrice');
  const maxPriceInput = document.getElementById('maxPrice');

  if (priceRangeSlider && minPriceInput && maxPriceInput) {
    priceRangeSlider.addEventListener('input', function () {
      const maxPrice = parseInt(this.value);
      if (!isNaN(maxPrice)) {
        maxPriceInput.value = maxPrice;
      }
    });

    minPriceInput.addEventListener('input', function () {
      let minPrice = parseInt(this.value);
      let maxPrice = parseInt(maxPriceInput.value);
      if (isNaN(minPrice) || minPrice < parseInt('<%= priceRange.min %>')) {
        minPrice = parseInt('<%= priceRange.min %>');
        this.value = minPrice;
      }
      if (!isNaN(minPrice) && !isNaN(maxPrice) && minPrice > maxPrice) {
        maxPriceInput.value = minPrice;
      }
      console.log('Price Input:', { minPrice, maxPrice });
    });

    maxPriceInput.addEventListener('input', function () {
      let minPrice = parseInt(minPriceInput.value);
      let maxPrice = parseInt(this.value);
      if (isNaN(maxPrice) || maxPrice > parseInt('<%= priceRange.max %>')) {
        maxPrice = parseInt('<%= priceRange.max %>');
        this.value = maxPrice;
      }
      if (!isNaN(minPrice) && !isNaN(maxPrice) && maxPrice < minPrice) {
        minPriceInput.value = maxPrice;
      }
      if (!isNaN(maxPrice)) {
        priceRangeSlider.value = maxPrice;
      }
      console.log('Price Input:', { minPrice, maxPrice });
    });
  }

  const applyPriceFilterBtn = document.getElementById('applyPriceFilter');
  if (applyPriceFilterBtn) {
    applyPriceFilterBtn.addEventListener('click', function () {
      let minPrice = parseInt(minPriceInput.value);
      let maxPrice = parseInt(maxPriceInput.value);
      if (isNaN(minPrice) || minPrice < parseInt('<%= priceRange.min %>')) {
        minPrice = parseInt('<%= priceRange.min %>');
      }
      if (isNaN(maxPrice) || maxPrice > parseInt('<%= priceRange.max %>')) {
        maxPrice = parseInt('<%= priceRange.max %>');
      }
      if (!isNaN(minPrice) && !isNaN(maxPrice)) {
        window.location.href = buildUrl({
          minPrice: minPrice,
          maxPrice: maxPrice,
          page: '1'
        });
      }
      console.log('Applying Price Filter:', { minPrice, maxPrice });
    });
  }

  const categoryFilters = document.querySelectorAll('.category-filter');
  categoryFilters.forEach(filter => {
    filter.addEventListener('change', function () {
      if (this.checked) {
        window.location.href = buildUrl({
          category: this.value,
          page: '1'
        });
      }
    });
  });

  const sortFilter = document.getElementById('sortFilter');
  if (sortFilter) {
    sortFilter.addEventListener('change', function () {
      window.location.href = buildUrl({
        sort: this.value,
        page: '1'
      });
    });
  }

  const applyFiltersBtn = document.getElementById('applyFilters');
  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener('click', function () {
      const selectedCategory = document.querySelector('input[name="category"]:checked').value;
      let minPrice = parseInt(document.getElementById('minPrice').value);
      let maxPrice = parseInt(document.getElementById('maxPrice').value);
      const sortOrder = document.getElementById('sortFilter').value;

      if (isNaN(minPrice) || minPrice < parseInt('<%= priceRange.min %>')) {
        minPrice = parseInt('<%= priceRange.min %>');
      }
      if (isNaN(maxPrice) || maxPrice > parseInt('<%= priceRange.max %>')) {
        maxPrice = parseInt('<%= priceRange.max %>');
      }

      window.location.href = buildUrl({
        category: selectedCategory,
        minPrice: minPrice,
        maxPrice: maxPrice,
        sort: sortOrder,
        page: '1'
      });
    });
  }

  const filterCloseButtons = document.querySelectorAll('.filter-badge .close');
  filterCloseButtons.forEach(button => {
    button.addEventListener('click', function () {
      const filterType = this.dataset.filter;

      switch (filterType) {
        case 'category':
          window.location.href = buildUrl({
            category: 'all',
            page: '1'
          });
          break;
        case 'price':
          window.location.href = buildUrl({
            minPrice: '<%= priceRange.min %>',
            maxPrice: '<%= priceRange.max %>',
            page: '1'
          });
          break;
        case 'search':
          window.location.href = buildUrl({
            search: '',
            page: '1'
          });
          break;
        case 'sort':
          window.location.href = buildUrl({
            sort: 'latest',
            page: '1'
          });
          break;
      }
    });
  });

  const clearAllFiltersBtn = document.getElementById('clearAllFilters');
  if (clearAllFiltersBtn) {
    clearAllFiltersBtn.addEventListener('click', function () {
      window.location.href = window.location.pathname;
    });
  }

  const searchInput = document.getElementById('searchInput');
  const searchContainer = document.querySelector('.search-container');
  const searchClear = document.getElementById('searchClear');

  let searchTimeout;

  if (searchInput) {
    function updateSearchState() {
      if (searchInput.value.trim()) {
        searchContainer.classList.add('has-text');
      } else {
        searchContainer.classList.remove('has-text');
      }
    }

    updateSearchState();

    searchInput.addEventListener('input', function () {
      updateSearchState();

      clearTimeout(searchTimeout);

      if (this.value.trim()) {
        searchContainer.classList.add('loading');
      }

      searchTimeout = setTimeout(() => {
        searchContainer.classList.remove('loading');
        const searchValue = this.value.trim();
        window.location.href = buildUrl({
          search: searchValue,
          page: '1'
        });
        console.log('Search Triggered:', { searchValue });
      }, 200);
    });

    if (searchClear) {
      searchClear.addEventListener('click', function () {
        searchInput.value = '';
        updateSearchState();
        window.location.href = buildUrl({
          search: '',
          page: '1'
        });
      });
    }

    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(searchTimeout);
        searchContainer.classList.remove('loading');
        const searchValue = this.value.trim();
        window.location.href = buildUrl({
          search: searchValue,
          page: '1'
        });
        console.log('Search via Enter:', { searchValue });
      }
    });
  }
});