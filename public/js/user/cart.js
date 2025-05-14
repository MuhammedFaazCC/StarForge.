document.addEventListener('DOMContentLoaded', () => {
    const cartItems = [
        { name: 'Lightweight Silver Alloys', price: 'USD $220.00', discount: 'USD $100', quantity: 1, image: 'path/to/silver-alloys.jpg' },
        { name: 'Turquoise Checks Linen Blend Shirt', price: 'USD $230.00', discount: '', quantity: 1, image: 'path/to/turquoise-shirt.jpg' }
    ];

    function calculateSubtotal() {
        let subtotal = 0;
        let discountedSubtotal = 0;

        cartItems.forEach(item => {
            const price = parseFloat(item.price.replace('USD $', ''));
            const quantity = item.quantity;
            subtotal += price * quantity;

            if (item.discount) {
                const discount = parseFloat(item.discount.replace('USD $', ''));
                discountedSubtotal += (price - discount) * quantity;
            } else {
                discountedSubtotal += price * quantity;
            }
        });

        document.querySelector('.original').textContent = `USD $${subtotal.toFixed(2)}`;
        document.querySelector('.discounted').textContent = `USD $${discountedSubtotal.toFixed(2)}`;
    }

    document.querySelectorAll('.cart-item').forEach((item, index) => {
        const decreaseBtn = item.querySelector('.decrease');
        const increaseBtn = item.querySelector('.increase');
        const quantitySpan = item.querySelector('.quantity');
        const removeBtn = item.querySelector('.remove');

        decreaseBtn.addEventListener('click', () => {
            if (cartItems[index].quantity > 1) {
                cartItems[index].quantity--;
                quantitySpan.textContent = cartItems[index].quantity;
                calculateSubtotal();
            }
        });

        increaseBtn.addEventListener('click', () => {
            cartItems[index].quantity++;
            quantitySpan.textContent = cartItems[index].quantity;
            calculateSubtotal();
        });

        removeBtn.addEventListener('click', () => {
            cartItems.splice(index, 1);
            item.remove();
            calculateSubtotal();
        });
    });

    document.querySelector('.empty-cart').addEventListener('click', () => {
        cartItems.length = 0;
        document.querySelector('.cart-items').innerHTML = '';
        calculateSubtotal();
    });

    calculateSubtotal();
});