function toggleCustomDates() {
    const dateFilter = document.getElementById('dateFilter').value;
    const customDates = document.getElementById('customDates');
    
    if (dateFilter === 'custom') {
        customDates.style.display = 'flex';
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        
        if (!startDateInput.value) {
            const today = new Date();
            const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
            startDateInput.value = lastMonth.toISOString().split('T')[0];
        }
        
        if (!endDateInput.value) {
            const today = new Date();
            endDateInput.value = today.toISOString().split('T')[0];
        }
    } else {
        customDates.style.display = 'none';
    }
}

function clearFilters() {
    document.getElementById('filterForm').reset();
    window.location.href = '/admin/sales';
}

function exportReport(format) {
    const params = new URLSearchParams(window.location.search);
    const exportUrl = `/admin/sales/export/${format}?${params.toString()}`;
    
    Swal.fire({
        title: 'Generating Report...',
        text: 'Please wait while we prepare your report.',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    const link = document.createElement('a');
    link.href = exportUrl;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => {
        Swal.close();
        Swal.fire({
            icon: 'success',
            title: 'Report Generated!',
            text: 'Your report has been downloaded successfully.',
            timer: 2000,
            showConfirmButton: false
        });
    }, 1000);
}

function viewOrderDetails(orderId) {
  window.location.href = `/admin/orders/${orderId}`;
}

function toggleOrderItems(index) {
    const itemsRow = document.getElementById(`items-${index}`);
    const chevron = document.getElementById(`chevron-${index}`);
    
    if (itemsRow.style.display === 'none') {
        itemsRow.style.display = 'table-row';
        chevron.classList.remove('fa-chevron-right');
        chevron.classList.add('fa-chevron-down');
    } else {
        itemsRow.style.display = 'none';
        chevron.classList.remove('fa-chevron-down');
        chevron.classList.add('fa-chevron-right');
    }
}

let salesChart;

async function updateChart() {
    const period = document.getElementById('chartPeriod').value;
    
    try {
        const chartContainer = document.querySelector('.chart-container');
        chartContainer.style.opacity = '0.5';
        
        const response = await fetch(`/admin/sales/chart-data?period=${period}`);
        const data = await response.json();
        
        if (data.success) {
            renderChart(data.data, data.dateFormat);
        } else {
            console.error('Failed to fetch chart data:', data.message);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to load chart data. Please try again.',
                timer: 3000,
                showConfirmButton: false
            });
        }
        
        chartContainer.style.opacity = '1';
    } catch (error) {
        console.error('Error updating chart:', error);
        Swal.fire({
            icon: 'error',
            title: 'Network Error',
            text: 'Failed to connect to server. Please check your connection.',
            timer: 3000,
            showConfirmButton: false
        });
    }
}

function renderChart(data, dateFormat) {
    const ctx = document.getElementById('salesChart');
    if (!ctx) return;
    
    const context = ctx.getContext('2d');
    
    if (salesChart) {
        salesChart.destroy();
    }

    const labels = data.map(item => {
        if (dateFormat === 'monthly') {
            const [year, month] = item._id.split('-');
            return new Date(year, month - 1).toLocaleDateString('en-US', { 
                month: 'short', 
                year: 'numeric' 
            });
        } else {
            return new Date(item._id).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
            });
        }
    });

    const salesData = data.map(item => item.totalSales || 0);
    const ordersData = data.map(item => item.totalOrders || 0);

    salesChart = new Chart(context, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Sales Amount (₹)',
                data: salesData,
                borderColor: '#FCA120',
                backgroundColor: 'rgba(252, 161, 32, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                yAxisID: 'y',
                pointBackgroundColor: '#FCA120',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
            }, {
                label: 'Number of Orders',
                data: ordersData,
                borderColor: '#1f2937',
                backgroundColor: 'rgba(31, 41, 55, 0.1)',
                borderWidth: 3,
                fill: false,
                tension: 0.4,
                yAxisID: 'y1',
                pointBackgroundColor: '#1f2937',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: {
                            size: 12,
                            weight: '500'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#FCA120',
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            if (context.datasetIndex === 0) {
                                return 'Sales: ₹' + context.parsed.y.toLocaleString('en-IN');
                            } else {
                                return 'Orders: ' + context.parsed.y;
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Date',
                        font: {
                            size: 12,
                            weight: '600'
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Sales Amount (₹)',
                        font: {
                            size: 12,
                            weight: '600'
                        }
                    },
                    ticks: {
                        callback: function(value) {
                            return '₹' + value.toLocaleString('en-IN');
                        }
                    },
                    grid: {
                        color: 'rgba(252, 161, 32, 0.1)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Number of Orders',
                        font: {
                            size: 12,
                            weight: '600'
                        }
                    },
                    grid: {
                        drawOnChartArea: false,
                        color: 'rgba(31, 41, 55, 0.1)'
                    },
                    ticks: {
                        stepSize: 1
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            }
        }
    });
}

document.getElementById('filterForm')?.addEventListener('submit', function(e) {
    const submitBtn = this.querySelector('.filter-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Applying...';
        
        setTimeout(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Apply Filters';
        }, 5000);
    }
});

document.getElementById('dateFilter')?.addEventListener('change', function() {
    if (this.value !== 'custom') {
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        
        setTimeout(() => {
            document.getElementById('filterForm').submit();
        }, 100);
    }
});

function validateDateRange() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (start > end) {
            Swal.fire({
                icon: 'warning',
                title: 'Invalid Date Range',
                text: 'Start date cannot be later than end date.',
                timer: 3000,
                showConfirmButton: false
            });
            return false;
        }
        
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > 365) {
            Swal.fire({
                icon: 'warning',
                title: 'Date Range Too Large',
                text: 'Please select a date range of 1 year or less for better performance.',
                timer: 4000,
                showConfirmButton: false
            });
            return false;
        }
    }
    
    return true;
}

document.getElementById('startDate')?.addEventListener('change', validateDateRange);
document.getElementById('endDate')?.addEventListener('change', validateDateRange);

document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('salesChart')) {
        updateChart();
    }
    
    toggleCustomDates();
    
    document.querySelectorAll('.export-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            this.disabled = true;
            const originalText = this.innerHTML;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
            
            setTimeout(() => {
                this.disabled = false;
                this.innerHTML = originalText;
            }, 3000);
        });
    });
    
    document.querySelectorAll('.status-badge').forEach(badge => {
        badge.title = `Order Status: ${badge.textContent}`;
    });

    document.querySelectorAll('.sales-table tbody tr').forEach(row => {
        if (!row.querySelector('.no-data')) {
            row.style.cursor = 'pointer';
            row.addEventListener('click', function(e) {
                if (!e.target.closest('button')) {
                    const orderId = this.cells[0].textContent;
                    viewOrderDetails(orderId);
                }
            });
        }
    });
});

document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        exportReport('excel');
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        exportReport('pdf');
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        clearFilters();
    }
});

function printReport() {
    window.print();
}

const printStyles = `
    @media print {
        .export-buttons, .filters-section, .chart-section, .pagination {
            display: none !important;
        }
        
        .sales-table {
            font-size: 10px;
        }
        
        .analytics-section {
            page-break-inside: avoid;
        }
        
        .table-section {
            page-break-inside: avoid;
        }
    }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = printStyles;
document.head.appendChild(styleSheet);