let salesChartInstance = null;

document.addEventListener('DOMContentLoaded', function() {
    initDashboard();
});

function initDashboard() {
    setupHoverEffects();
    setupFilters();
    loadChartData();
    loadTopLists();
}

function setupHoverEffects() {
    const metricCards = document.querySelectorAll('.metric-card');
    metricCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
        });
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });
}

function setupFilters() {
    const rangeFilter = document.getElementById('rangeFilter');
    const yearInput = document.getElementById('yearInput');
    const monthInput = document.getElementById('monthInput');
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    const applyBtn = document.getElementById('applyFilterBtn');

    function updateVisibility() {
        const v = rangeFilter.value;
        yearInput.style.display = v === 'year' || v === 'month' ? 'block' : 'none';
        monthInput.style.display = v === 'month' ? 'block' : 'none';
        startDate.style.display = v === 'custom' ? 'block' : 'none';
        endDate.style.display = v === 'custom' ? 'block' : 'none';
    }

    rangeFilter.addEventListener('change', updateVisibility);
    applyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loadChartData();
    });

    updateVisibility();
}

function getFilterParams() {
    const params = new URLSearchParams();
    const range = document.getElementById('rangeFilter').value;
    params.set('range', range);
    if (range === 'year' || range === 'month') {
        const y = document.getElementById('yearInput').value;
        if (y) params.set('year', y);
    }
    if (range === 'month') {
        const m = document.getElementById('monthInput').value;
        if (m) params.set('month', String(parseInt(m) - 1)); // 0-indexed month on server
    }
    if (range === 'custom') {
        const s = document.getElementById('startDate').value;
        const e = document.getElementById('endDate').value;
        if (s && e) {
            params.set('startDate', s);
            params.set('endDate', e);
        }
    }
    return params;
}

async function loadChartData() {
    try {
        const params = getFilterParams();
        const res = await fetch(`/admin/dashboard/chart-data?${params.toString()}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Failed to fetch chart');
        renderSalesChart(data.labels, data.datasets);
    } catch (err) {
        console.error('Chart load error:', err);
        if (window.Swal) Swal.fire('Error', 'Failed to load chart data', 'error');
    }
}

function renderSalesChart(labels, datasets) {
    const ctx = document.getElementById('salesChart').getContext('2d');
    if (salesChartInstance) {
        salesChartInstance.destroy();
    }
    salesChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Revenue (₹)',
                    data: datasets.revenue,
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.15)',
                    tension: 0.35,
                    fill: true,
                    pointRadius: 2,
                    pointHoverRadius: 4,
                    yAxisID: 'y'
                },
                {
                    label: 'Orders',
                    data: datasets.orders,
                    borderColor: '#2196F3',
                    backgroundColor: 'rgba(33, 150, 243, 0.15)',
                    tension: 0.35,
                    pointRadius: 2,
                    pointHoverRadius: 4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: 8 },
            interaction: { mode: 'index', intersect: false },
            stacked: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            if (ctx.datasetIndex === 0) {
                                return ` Revenue: ₹${Number(ctx.parsed.y).toLocaleString('en-IN')}`;
                            }
                            return ` Orders: ${ctx.parsed.y}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    position: 'left',
                    grid: { color: 'rgba(0,0,0,0.06)' },
                    ticks: {
                        callback: (v) => `₹${Number(v).toLocaleString('en-IN')}`
                    }
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    grid: { drawOnChartArea: false, color: 'rgba(0,0,0,0.06)' }
                },
                x: {
                    ticks: { autoSkip: true, maxRotation: 0, color: '#374151' },
                    grid: { display: false }
                }
            }
        }
    });
}

async function loadTopLists() {
    try {
        const [pRes, cRes, bRes] = await Promise.all([
            fetch('/admin/dashboard/top-products'),
            fetch('/admin/dashboard/top-categories'),
            fetch('/admin/dashboard/top-brands')
        ]);
        const [pData, cData, bData] = await Promise.all([pRes.json(), cRes.json(), bRes.json()]);
        if (!pData.success || !cData.success || !bData.success) throw new Error('Fetch failed');
        fillTable('topProductsTable', pData.items, 'Product');
        fillTable('topCategoriesTable', cData.items, 'Category');
        fillTable('topBrandsTable', bData.items, 'Brand');
    } catch (err) {
        console.error('Top lists load error:', err);
    }
}

function fillTable(tableId, items, labelKeyFallback) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;
    tbody.innerHTML = '';
    items.forEach((it, idx) => {
        const tr = document.createElement('tr');
        const name = it.name || labelKeyFallback;
        const qty = it.quantitySold || 0;
        const revenue = it.revenue || 0;
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>${escapeHtml(name)}</td>
            <td>${qty}</td>
            <td>₹${Number(revenue).toLocaleString('en-IN')}</td>
        `;
        tbody.appendChild(tr);
    });
}

function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
}