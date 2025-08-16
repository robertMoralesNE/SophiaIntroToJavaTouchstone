// ==== STORAGE ADAPTER (sessionStorage/localStorage with safe fallback) ====
(function () {
    function isStorageAvailable(type) {
        try {
            const storage = window[type];
            const testKey = '__storage_test__';
            storage.setItem(testKey, '1');
            storage.removeItem(testKey);
            return true;
        } catch (e) {
            return false;
        }
    }

    // Fallback object if Web Storage is unavailable (e.g., blocked/incognito)
    const fallback = {
        _session: {},
        _local: {},
        sessionSet(k, v) { this._session[k] = String(v); },
        sessionGet(k) { return Object.prototype.hasOwnProperty.call(this._session, k) ? this._session[k] : null; },
        sessionRemove(k) { delete this._session[k]; },
        sessionClear() { this._session = {}; },
        localSet(k, v) { this._local[k] = String(v); },
        localGet(k) { return Object.prototype.hasOwnProperty.call(this._local, k) ? this._local[k] : null; },
        localRemove(k) { delete this._local[k]; },
    };

    const useSession = isStorageAvailable('sessionStorage') ? window.sessionStorage : null;
    const useLocal   = isStorageAvailable('localStorage')   ? window.localStorage   : null;

    // Public adapter so the rest of the code is storage-agnostic
    window.cartStorage = {
        // Session (cart)
        setSessionItem(key, value) { useSession ? useSession.setItem(key, value) : fallback.sessionSet(key, value); },
        getSessionItem(key)        { return useSession ? useSession.getItem(key) : fallback.sessionGet(key); },
        removeSessionItem(key)     { useSession ? useSession.removeItem(key) : fallback.sessionRemove(key); },
        clearSession()             { useSession ? useSession.clear() : fallback.sessionClear(); },

        // Local (customer data)
        setLocalItem(key, value)   { useLocal ? useLocal.setItem(key, value) : fallback.localSet(key, value); },
        getLocalItem(key)          { return useLocal ? useLocal.getItem(key) : fallback.localGet(key); },
        removeLocalItem(key)       { useLocal ? useLocal.removeItem(key) : fallback.localRemove(key); },

        hasRealSession: !!useSession,
        hasRealLocal: !!useLocal,
    };

    // Cross-tab sync (fires when storage changes in another tab)
    window.addEventListener('storage', (e) => {
        if (e.key === 'cartItems') {
            document.dispatchEvent(new CustomEvent('cart:externalUpdate'));
        }
    });
})();

// ==== MAIN SCRIPT ====
document.addEventListener('DOMContentLoaded', function () {
    // CUSTOM ALERT FUNCTION - creates centered alerts instead of browser alerts
    function showCustomAlert(message) {
        const alertDiv = document.createElement('div');

        if (message.includes('\n')) {
            alertDiv.innerHTML = message.replace(/\n/g, '<br>');
        } else {
            alertDiv.textContent = message;
        }

        alertDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: #96BAA0;
            color: #014038;
            padding: 20px 30px;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            font-family: Arial, sans-serif;
            font-weight: bold;
            font-size: 16px;
            z-index: 1000;
            max-width: 500px;
            max-height: 400px;
            overflow-y: auto;
            text-align: center;
            border: 2px solid #014038;
            white-space: pre-line;
        `;

        document.body.appendChild(alertDiv);

        const timeout = message.includes('Cart Contents') ? 5000 : 3000;
        setTimeout(function () {
            if (document.body.contains(alertDiv)) {
                document.body.removeChild(alertDiv);
            }
        }, timeout);
    }

    // ---- STORAGE HELPERS (now using cartStorage) ----
    function saveCartToSession(cartItems) {
        cartStorage.setSessionItem('cartItems', JSON.stringify(cartItems));
    }

    function getCartFromSession() {
        const cartData = cartStorage.getSessionItem('cartItems');
        return cartData ? JSON.parse(cartData) : {};
    }

    function clearCartFromSession() {
        cartStorage.removeSessionItem('cartItems');
    }

    function saveCustomerToLocal(customerData) {
        cartStorage.setLocalItem('customerData', JSON.stringify(customerData));
    }

    // ==== NEWSLETTER SUBSCRIPTION FUNCTIONALITY ====
    const newsletterForm = document.getElementById('newsletter-form');

    if (newsletterForm) {
        newsletterForm.addEventListener('submit', function (event) {
            event.preventDefault();

            const emailInput = document.getElementById('newsletter-email');
            const email = emailInput.value.trim();

            if (email === '') {
                showCustomAlert('Please enter an email address.');
                return;
            }

            if (!email.includes('@')) {
                showCustomAlert('Please include a "@" in the email address.');
                return;
            }

            const emailParts = email.split('@');
            if (emailParts.length !== 2 || emailParts[0] === '' || emailParts[1] === '') {
                showCustomAlert('Please enter a valid email address.');
                return;
            }

            showCustomAlert('You are now subscribed to our newsletter with email: ' + email);
            emailInput.value = '';
        });
    }

    // ==== NEW CART FUNCTIONALITY (gallery page only) ====
    const addToCartButtons = document.querySelectorAll('.add-to-cart-btn');

    if (addToCartButtons.length > 0) {
        // Add item to cart (incremental quantities)
        addToCartButtons.forEach(function(button) {
            button.addEventListener('click', function() {
                const itemId = button.getAttribute('data-id');
                const itemName = button.getAttribute('data-name');
                const itemPrice = parseFloat(button.getAttribute('data-price'));

                // Get current cart
                let cartItems = getCartFromSession();

                // Add item or increment quantity
                if (cartItems[itemId]) {
                    cartItems[itemId].quantity += 1;
                } else {
                    cartItems[itemId] = {
                        name: itemName,
                        price: itemPrice,
                        quantity: 1
                    };
                }

                // Save updated cart
                saveCartToSession(cartItems);
                showCustomAlert('Item added to cart!');
            });
        });

        // Auto-refresh UI if cart changes in another tab
        document.addEventListener('cart:externalUpdate', () => {
            // Cart data updated externally, could refresh UI if needed
            // For now, no specific UI to update since cart counter is removed
        });

        // VIEW CART
        const viewCartBtn = document.getElementById('view-cart-btn');
        if (viewCartBtn) {
            viewCartBtn.addEventListener('click', function () {
                const cartItems = getCartFromSession();
                const itemKeys = Object.keys(cartItems);

                if (itemKeys.length === 0) {
                    showCustomAlert('Your cart is empty');
                } else {
                    let totalPrice = 0;
                    const cartItemStrings = itemKeys.map(function (itemId) {
                        const item = cartItems[itemId];
                        const itemTotal = item.price * item.quantity;
                        totalPrice += itemTotal;
                        return item.name + ' (x' + item.quantity + ') - $' + itemTotal.toFixed(2);
                    });

                    const cartMessage =
                        'Cart Contents:\n\n' +
                        cartItemStrings.join('\n') +
                        '\n\nTotal: $' +
                        totalPrice.toFixed(2);

                    showCustomAlert(cartMessage);
                }
            });
        }

        // CLEAR CART
        const clearCartBtn = document.getElementById('clear-cart-btn');
        if (clearCartBtn) {
            clearCartBtn.addEventListener('click', function () {
                const cartItems = getCartFromSession();
                const itemKeys = Object.keys(cartItems);

                if (itemKeys.length === 0) {
                    showCustomAlert('No items to clear');
                } else {
                    clearCartFromSession();
                    showCustomAlert('Cart has been cleared!');
                }
            });
        }

        // PROCESS ORDER
        const processOrderBtn = document.getElementById('process-order-btn');
        if (processOrderBtn) {
            processOrderBtn.addEventListener('click', function () {
                const cartItems = getCartFromSession();
                const itemKeys = Object.keys(cartItems);

                if (itemKeys.length > 0) {
                    let totalItems = 0;
                    itemKeys.forEach(function(itemId) {
                        totalItems += cartItems[itemId].quantity;
                    });

                    showCustomAlert(
                        'Order processed successfully! ' + totalItems + ' item(s) ordered.'
                    );
                    clearCartFromSession();
                } else {
                    showCustomAlert('No items in cart');
                }
            });
        }
    }

    // ==== FEEDBACK FORM FUNCTIONALITY (saves to localStorage) ====
    const feedbackForm = document.getElementById('feedback-form');

    if (feedbackForm) {
        function loadCustomerData() {
            const customerData = cartStorage.getLocalItem('customerData');
            if (customerData) {
                const data = JSON.parse(customerData);
                const nameEl = document.getElementById('feedback-name');
                const emailEl = document.getElementById('feedback-email');
                const phoneEl = document.getElementById('feedback-phone');

                if (nameEl) nameEl.value = data.name || '';
                if (emailEl) emailEl.value = data.email || '';
                if (phoneEl) phoneEl.value = data.phone || '';
                // Do not prefill message
            }
        }

        loadCustomerData();

        feedbackForm.addEventListener('submit', function (event) {
            event.preventDefault();

            const name = document.getElementById('feedback-name').value.trim();
            const email = document.getElementById('feedback-email').value.trim();
            const phone = document.getElementById('feedback-phone').value.trim();
            const message = document.getElementById('feedback-message').value.trim();

            if (name === '') {
                showCustomAlert('Please enter your name.');
                return;
            }

            if (email === '') {
                showCustomAlert('Please enter your email address.');
                return;
            }

            if (!email.includes('@')) {
                showCustomAlert('Please include a "@" in the email address.');
                return;
            }

            const emailParts = email.split('@');
            if (emailParts.length !== 2 || emailParts[0] === '' || emailParts[1] === '') {
                showCustomAlert('Please enter a valid email address.');
                return;
            }

            if (message === '') {
                showCustomAlert('Please enter your issue/order information.');
                return;
            }

            const customerData = {
                name: name,
                email: email,
                phone: phone,
                lastMessage: message,
                timestamp: new Date().toISOString()
            };

            saveCustomerToLocal(customerData);

            showCustomAlert(
                'Thank you for your message, ' +
                name +
                '! We will get back to you soon.'
            );

            // Only clear the message field, keep contact details for next time
            document.getElementById('feedback-message').value = '';
        });
    }
});
