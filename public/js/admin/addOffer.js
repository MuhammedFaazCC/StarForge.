        const products = <%- JSON.stringify(products) %>;
        const categories = <%- JSON.stringify(categories) %>;

        document.getElementById('startDate').value = new Date().toISOString().slice(0, 16);

        function selectOfferType(e, type) {
            document.querySelectorAll('.offer-type-card').forEach(card => {
                card.classList.remove('selected');
            });
            
            if (e && e.currentTarget) {
                e.currentTarget.classList.add('selected');
            }
            
            document.getElementById('type' + type.charAt(0).toUpperCase() + type.slice(1)).checked = true;
            
            const applicableToSection = document.getElementById('applicableToSection');
            const applicableToSelect = document.getElementById('applicableTo');
            
            if (type === 'referral') {
                applicableToSection.style.display = 'none';
                applicableToSelect.innerHTML = '';
            } else {
                applicableToSection.style.display = 'block';
                populateApplicableToOptions(type);
            }
        }

        function populateApplicableToOptions(type) {
            const select = document.getElementById('applicableTo');
            select.innerHTML = '';
            
            if (type === 'product') {
                products.forEach(product => {
                    const option = document.createElement('option');
                    option.value = product._id;
                    option.textContent = `${product.name} - ${product.brand} (₹${product.price})`;
                    select.appendChild(option);
                });
            } else if (type === 'category') {
                categories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category._id;
                    option.textContent = category.name;
                    select.appendChild(option);
                });
            }
            
            $('#applicableTo').select2({
                placeholder: `Select ${type}s`,
                allowClear: true
            });
        }

        $('#applicableTo').select2({
            placeholder: 'Select items',
            allowClear: true
        });

        document.getElementById('addOfferForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            const data = Object.fromEntries(formData.entries());
            
            const applicableToValues = $('#applicableTo').val();
            if (applicableToValues) {
                data.applicableTo = applicableToValues;
            }
            
            try {
                const response = await fetch('/admin/offers/add', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    Swal.fire({
                      icon: 'success',
                      title: 'Success!',
                      text: 'Offer created successfully!',
                      timer: 2000,
                      timerProgressBar: true,
                      showConfirmButton: false
                    });
                    window.location.href = '/admin/offers';
                } else {
                    Swal.fire({
                      icon: 'error',
                      title: 'Error',
                      text: 'Error: ' + result.message,
                      confirmButtonText: 'OK',
                      confirmButtonColor: '#d33'
                    });
                }
            } catch (error) {
                Swal.fire({
                  icon: 'error',
                  title: 'Creation Failed',
                  text: 'Error creating offer',
                  confirmButtonText: 'OK',
                  confirmButtonColor: '#d33'
                });
                console.error(error);
            }
        });