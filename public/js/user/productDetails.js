
          // Simple image gallery controller
          (function () {
            document.addEventListener('DOMContentLoaded', function () {
              const mainImg = document.getElementById('mainProductImage');
              const zoomWrap = document.querySelector('.zoom-wrap');
              if (mainImg) {
                mainImg.addEventListener('click', function () {
                  this.classList.toggle('zoomed');
                });
                if (zoomWrap) {
                  zoomWrap.addEventListener('mousemove', function (e) {
                    if (!mainImg.classList.contains('zoomed')) return;
                    const rect = zoomWrap.getBoundingClientRect();
                    const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
                    const y = Math.min(Math.max(e.clientY - rect.top, 0), rect.height);
                    const xp = (x / rect.width) * 100;
                    const yp = (y / rect.height) * 100;
                    mainImg.style.transformOrigin = xp + '% ' + yp + '%';
                  });
                  zoomWrap.addEventListener('mouseleave', function () {
                    // Optional: reset origin when leaving
                    mainImg.style.transformOrigin = '';
                  });
                }
              }
              const placeholder = document.getElementById('mainProductImagePlaceholder');
              const thumbs = Array.from(document.querySelectorAll('#thumbStrip .p-thumb'));
              const prevBtn = document.getElementById('prevImageBtn');
              const nextBtn = document.getElementById('nextImageBtn');

              const sources = thumbs.map(t => t.getAttribute('data-src')).filter(Boolean);
              let current = 0;

              function show(index) {
                if (!sources.length) {
                  if (prevBtn && nextBtn) { prevBtn.style.display = 'none'; nextBtn.style.display = 'none'; }
                  return;
                }
                current = (index + sources.length) % sources.length;
                if (mainImg) {
                  mainImg.src = sources[current];
                  mainImg.classList.remove('zoomed');
                  if (placeholder) placeholder.style.display = 'none';
                }

                thumbs.forEach((t, i) => {
                  if (i === current) t.classList.add('border', 'border-primary');
                  else t.classList.remove('border', 'border-primary');
                });
              }

              // Initialize
              if (sources.length) {
                // If main image exists and is first in thumbs, current stays 0
                show(0);
              } else {
                if (prevBtn && nextBtn) { prevBtn.style.display = 'none'; nextBtn.style.display = 'none'; }
              }

              // Handlers
              thumbs.forEach((t, i) => {
                t.addEventListener('click', () => show(i));
              });
              if (prevBtn) prevBtn.addEventListener('click', () => show(current - 1));
              if (nextBtn) nextBtn.addEventListener('click', () => show(current + 1));
            });
          })();

          document.addEventListener("DOMContentLoaded", function () {
          const stars = document.querySelectorAll("#ratingInput i");
          const ratingInput = document.getElementById("ratingValue");

          stars.forEach(star => {
            star.addEventListener("mouseenter", () => {
              const value = star.getAttribute("data-value");
              highlightStars(value);
            });

            star.addEventListener("click", () => {
              const value = star.getAttribute("data-value");
              ratingInput.value = value;
              lockStars(value);
            });

            star.addEventListener("mouseleave", () => {
              lockStars(ratingInput.value);
            });
          });

          function highlightStars(num) {
            stars.forEach(s => {
              s.className = (s.getAttribute("data-value") <= num) ? "fas fa-star" : "far fa-star";
            });
          }

          function lockStars(num) {
            stars.forEach(s => {
              s.className = (s.getAttribute("data-value") <= num) ? "fas fa-star" : "far fa-star";
            });
          }
        });

          document.addEventListener('DOMContentLoaded', function () {
            const addToCartForm = document.querySelector('form[action*="/cart/add/"]');

            if (addToCartForm) {
              addToCartForm.addEventListener('submit', function (e) {
                e.preventDefault();

                const formData = new FormData(this);
                const productId = this.action.split('/').pop();

                const submitButton = this.querySelector('button[type="submit"]');
                const originalText = submitButton.textContent;
                submitButton.disabled = true;
                submitButton.textContent = 'Adding...';

                fetch(`/cart/add/${productId}`, {
                  method: 'POST',
                  headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded',
                  },
                  body: new URLSearchParams(formData)
                })
                  .then(async (response) => {
                    const data = await response.json();

                    if (response.status === 401) {
                      Swal.fire({
                        icon: 'warning',
                        title: 'Login Required',
                        text: 'You must be logged in to add items to your cart.',
                        confirmButtonText: 'Login',
                        showCancelButton: true,
                        cancelButtonText: 'Cancel',
                        confirmButtonColor: '#fca120'
                      }).then(result => {
                        if (result.isConfirmed) {
                          window.location.href = '/login';
                        }
                      });
                      throw new Error('User not authenticated');
                    }

                    return data;
                  })

                  .then(data => {
                    if (!data) return;

                    if (!data.success) {
                      Swal.fire({
                        icon: 'error',
                        title: 'Cannot add to cart',
                        text: data.message || 'This product is currently unavailable',
                        confirmButtonColor: '#d33'
                      });
                      return;
                    }

                    if (window.updateNavbarCounts && typeof data.cartCount !== 'undefined') {
                      window.updateNavbarCounts({ cartCount: data.cartCount });
                    }

                    Swal.fire({
                      toast: true,
                      position: 'top-end',
                      icon: 'success',
                      title: data.message || 'Added to cart',
                      showConfirmButton: false,
                      timer: 1500,
                      timerProgressBar: true
                    });
                  })

                  .catch(error => {
                    console.error('Error:', error);
                  })
                  .finally(() => {
                    submitButton.disabled = false;
                    submitButton.textContent = originalText;
                  });
              });
            }
          });

          document.addEventListener('DOMContentLoaded', function () {
            const wishlistBtn = document.getElementById('wishlistBtn');
            if (!wishlistBtn) return;

            wishlistBtn.addEventListener('click', function () {
              const productId = this.dataset.product;
              fetch(`/toggle-wishlist/${productId}`, {
                method: 'POST',
                headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' }
              })
                .then(res => res.json())
                .then(data => {
                  if (data.redirect) {
                    window.location.href = data.redirect;
                    return;
                  }
                  if (data.success) {
                    const icon = this.querySelector('i');
                    if (data.added) {
                      // Set to solid heart
                      icon.classList.remove('far');
                      icon.classList.add('fas');
                      this.classList.add('active');
                    } else {
                      // Set to outline heart
                      icon.classList.remove('fas');
                      icon.classList.add('far');
                      this.classList.remove('active');
                    }

                    if (window.updateNavbarCounts && typeof data.wishlistCount !== 'undefined') {
                      window.updateNavbarCounts({ wishlistCount: data.wishlistCount });
                    }
                    if (window.Swal) {
                      Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'success',
                        title: data.message || (data.added ? 'Added to wishlist' : 'Removed from wishlist'),
                        showConfirmButton: false,
                        timer: 1500,
                        timerProgressBar: true
                      });
                    }
                  }
                })
                .catch(err => console.error('Wishlist toggle error:', err));
            });
          });

          // Minimal toast utility (no dependencies) used by the quantity limiter
          (function () {
            const TOAST_ID = 'mini-toast-container';
            function ensureToastContainer() {
              let c = document.getElementById(TOAST_ID);
              if (c) return c;
              c = document.createElement('div');
              c.id = TOAST_ID;
              c.style.position = 'fixed';
              c.style.left = '50%';
              c.style.bottom = '20px';
              c.style.transform = 'translateX(-50%)';
              c.style.zIndex = '9999';
              c.style.pointerEvents = 'none';
              document.body.appendChild(c);
              return c;
            }

            window.showMiniToast = function (msg, duration = 2000) {
              const container = ensureToastContainer();
              const t = document.createElement('div');
              t.textContent = msg;
              t.style.background = 'rgba(0,0,0,0.85)';
              t.style.color = '#fff';
              t.style.padding = '8px 12px';
              t.style.marginTop = '6px';
              t.style.borderRadius = '6px';
              t.style.fontSize = '14px';
              t.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
              t.style.opacity = '0';
              t.style.transition = 'opacity 180ms ease';
              container.appendChild(t);
              requestAnimationFrame(() => { t.style.opacity = '1'; });
              setTimeout(() => {
                t.style.opacity = '0';
                setTimeout(() => t.remove(), 200);
              }, duration);
            };
          })();

          (function () {
            const MAX_QTY = 5;
            const MIN_QTY = 1;
            let lastToastAt = 0;

            function clamp(n) {
              const v = Number(n);
              if (Number.isNaN(v)) return MIN_QTY;
              return Math.max(MIN_QTY, Math.min(MAX_QTY, v));
            }

            function maybeToastMax() {
              const now = Date.now();
              if (now - lastToastAt > 800) { // rate-limit toasts
                showMiniToast(`Maximum quantity limit is ${MAX_QTY}`);
                lastToastAt = now;
              }
            }

            document.addEventListener('DOMContentLoaded', function () {
              const qtyInput = document.getElementById('quantity');
              if (!qtyInput) return;

              // Ensure initial clamp
              qtyInput.value = clamp(qtyInput.value || MIN_QTY);

              // Clamp while user types or uses arrows
              qtyInput.addEventListener('input', function () {
                const before = Number(qtyInput.value);
                const after = clamp(before);
                if (before !== after) {
                  qtyInput.value = after;
                  if (before > MAX_QTY) maybeToastMax();
                }
              });

              // On blur, ensure value is valid
              qtyInput.addEventListener('blur', function () {
                qtyInput.value = clamp(qtyInput.value || MIN_QTY);
              });

              // Safety: clamp on form submit as well
              const form = qtyInput.closest('form');
              if (form) {
                form.addEventListener('submit', function () {
                  const before = Number(qtyInput.value);
                  const after = clamp(before);
                  if (before !== after && before > MAX_QTY) {
                    maybeToastMax();
                  }
                  qtyInput.value = after;
                }, true);
              }
            });
          })();
          document.addEventListener("scroll", () => {
            const bar = document.querySelector(".sticky-cart-bar");
            if (!bar) return;
            const target = document.querySelector("#addToCartBtn");
            if (!target) return;
            const rect = target.getBoundingClientRect();
            bar.style.display = rect.top < 0 ? "flex" : "none";
          });
        