class PaymeCheckoutForm extends HTMLElement {
  constructor() {
    super();

    this.form = this.querySelector('form');
    this.submitButton = this.querySelector('#Payme-submit');
    this.cancelButton = this.querySelector('#Payme-cancel');
    this.errorContainer = this.querySelector('.payme-checkout-form__error');

    this.phoneInput = this.querySelector('#Payme-phone');
    this.nameInput = this.querySelector('#Payme-name');
    this.locationInput = this.querySelector('#Payme-location');
    this.emailInput = this.querySelector('#Payme-email');

    this.setupEventListeners();
  }

  setupEventListeners() {
    if (this.form) {
      this.form.addEventListener('submit', this.handleSubmit.bind(this));
    }

    if (this.cancelButton) {
      this.cancelButton.addEventListener('click', this.handleCancel.bind(this));
    }

    // Real-time phone validation
    if (this.phoneInput) {
      this.phoneInput.addEventListener('input', this.formatPhoneNumber.bind(this));
    }
  }

  formatPhoneNumber(event) {
    let value = event.target.value.replace(/\D/g, '');

    // Auto-add +998 prefix for Uzbekistan
    if (value.length > 0 && !value.startsWith('998')) {
      if (value.startsWith('998')) {
        value = '998' + value.substring(3);
      }
    }

    // Format: +998 XX XXX XX XX
    if (value.length >= 3) {
      value = '+998' + value.substring(3);
    } else if (value.length > 0) {
      value = '+' + value;
    }

    event.target.value = value;
  }

  async handleSubmit(event) {
    event.preventDefault();

    // Clear previous errors
    this.clearErrors();

    // Validate form
    if (!this.validateForm()) {
      return;
    }

    // Show loading state
    this.setLoading(true);

    try {
      // Get cart data
      const cart = await this.getCart();

      if (!cart || !cart.items || cart.items.length === 0) {
        this.showError('Your cart is empty');
        return;
      }

      // Extract cart token
      const cartToken = this.extractCartToken(cart.token);

      // Prepare payload
      const payload = {
        items: cart.items.map(item => ({
          productId: item.product_id.toString(),
          variantId: item.variant_id.toString(),
          title: item.title,
          quantity: item.quantity,
          price: item.price / 100, // Convert from cents
          sku: item.sku || ''
        })),
        customerName: this.nameInput.value.trim(),
        customerEmail: this.emailInput.value.trim() || '',
        customerPhone: this.phoneInput.value.trim(),
        customerLocation: this.locationInput.value.trim(),
        cartToken: cartToken,
        url: window.location.origin
      };

      // Call Payme API
      const response = await fetch(
        'https://still-river-95661-5a9729d2ab3c.herokuapp.com/api/shopify/initialize-with-draft',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.paymeUrl) {
        // Redirect to Payme payment page
        window.location.href = data.paymeUrl;
      } else {
        this.showError(data.message || 'Payment initialization failed. Please try again.');
      }
    } catch (error) {
      console.error('Payme checkout error:', error);
      this.showError('Network error. Please check your connection and try again.');
    } finally {
      this.setLoading(false);
    }
  }

  handleCancel() {
    // Hide the form
    const formContainer = document.getElementById('payme-form-container');
    const toggleBtn = document.getElementById('payme-checkout-toggle');

    if (formContainer) {
      formContainer.classList.remove('active');
    }

    if (toggleBtn) {
      toggleBtn.textContent = 'Pay with Payme';
      toggleBtn.setAttribute('aria-expanded', 'false');
    }

    // Clear form
    this.form.reset();
    this.clearErrors();
  }

  validateForm() {
    let isValid = true;

    // Validate phone number (Uzbekistan format: +998XXXXXXXXX)
    const phonePattern = /^\+998\d{9}$/;
    const phoneValue = this.phoneInput.value.trim();

    if (!phoneValue) {
      this.showFieldError('phone', 'Phone number is required');
      isValid = false;
    } else if (!phonePattern.test(phoneValue)) {
      this.showFieldError('phone', 'Please enter a valid Uzbek phone number: +998 XX XXX XX XX');
      isValid = false;
    }

    // Validate name
    const nameValue = this.nameInput.value.trim();
    if (!nameValue || nameValue.length < 2) {
      this.showFieldError('name', 'Please enter your full name');
      isValid = false;
    }

    // Validate location
    const locationValue = this.locationInput.value.trim();
    if (!locationValue || locationValue.length < 2) {
      this.showFieldError('location', 'Please enter your location');
      isValid = false;
    }

    // Validate email if provided
    const emailValue = this.emailInput.value.trim();
    if (emailValue) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(emailValue)) {
        this.showFieldError('email', 'Please enter a valid email address');
        isValid = false;
      }
    }

    return isValid;
  }

  async getCart() {
    try {
      const response = await fetch('/cart.js');
      if (!response.ok) {
        throw new Error('Failed to fetch cart');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching cart:', error);
      throw error;
    }
  }

  extractCartToken(token) {
    if (!token) return '';

    try {
      const match = token.match(/^(.*?)\?key/);
      return match ? match[1] : token;
    } catch (error) {
      return token;
    }
  }

  setLoading(isLoading) {
    if (this.submitButton) {
      this.submitButton.classList.toggle('loading', isLoading);
      this.submitButton.disabled = isLoading;
    }

    if (this.cancelButton) {
      this.cancelButton.disabled = isLoading;
    }

    // Disable all form inputs
    const inputs = this.form.querySelectorAll('input, button');
    inputs.forEach(input => {
      if (input !== this.cancelButton) {
        input.disabled = isLoading;
      }
    });
  }

  showError(message) {
    if (!this.errorContainer) return;

    this.errorContainer.innerHTML = `
      <div class="form__message">
        <span class="svg-wrapper">
          <svg aria-hidden="true" focusable="false" class="icon icon-error" viewBox="0 0 13 13">
            <circle cx="6.5" cy="6.50049" r="5.5" stroke="white" stroke-width="2"/>
            <circle cx="6.5" cy="6.5" r="5.5" fill="#EB001B" stroke="#EB001B" stroke-width="0.7"/>
            <path d="M5.87413 3.52832L5.97974 7.57216H7.02921L7.13482 3.52832H5.87413ZM6.50395 8.58201C6.67599 8.58201 6.82516 8.64305 6.95145 8.76513C7.07774 8.88721 7.14088 9.03688 7.14088 9.21393C7.14088 9.39099 7.07774 9.54066 6.95145 9.66274C6.82516 9.78482 6.67599 9.84586 6.50395 9.84586C6.33191 9.84586 6.18274 9.78482 6.05645 9.66274C5.93016 9.54066 5.86702 9.39099 5.86702 9.21393C5.86702 9.03688 5.93016 8.88721 6.05645 8.76513C6.18274 8.64305 6.33191 8.58201 6.50395 8.58201Z" fill="white"/>
          </svg>
        </span>
        ${message}
      </div>
    `;

    this.errorContainer.setAttribute('role', 'alert');
    this.errorContainer.focus();
  }

  showFieldError(fieldName, message) {
    const input = this.querySelector(`#Payme-${fieldName}`);
    if (input) {
      const field = input.closest('.field');
      if (field) {
        field.classList.add('field--error');
        input.setAttribute('aria-invalid', 'true');
      }
    }

    // Also show in main error container
    this.showError(message);
  }

  clearErrors() {
    if (this.errorContainer) {
      this.errorContainer.innerHTML = '';
      this.errorContainer.removeAttribute('role');
    }

    // Clear field errors
    const errorFields = this.querySelectorAll('.field--error');
    errorFields.forEach(field => {
      field.classList.remove('field--error');
    });

    const invalidInputs = this.querySelectorAll('[aria-invalid="true"]');
    invalidInputs.forEach(input => {
      input.removeAttribute('aria-invalid');
    });
  }
}

customElements.define('payme-checkout-form', PaymeCheckoutForm);

// Cart Summary Component for Payme Checkout Page
class PaymeCartSummary extends HTMLElement {
  constructor() {
    super();
    this.loadCartSummary();
  }

  async loadCartSummary() {
    try {
      const cart = await fetch('/cart.js').then(r => r.json());

      if (!cart || !cart.items || cart.items.length === 0) {
        this.showEmptyCart();
        return;
      }

      this.renderCartItems(cart);
    } catch (error) {
      console.error('Error loading cart:', error);
      this.showError('Failed to load cart. Please try again.');
    }
  }

  renderCartItems(cart) {
    const currencySymbol = cart.currency || 'UZS';

    const itemsHTML = cart.items.map(item => {
      const itemTotal = (item.price * item.quantity) / 100;
      const itemPrice = item.price / 100;

      return `
        <div class="payme-cart-item">
          <div class="payme-cart-item__image">
            ${item.image ? `<img src="${item.image}" alt="${item.title}" loading="lazy">` : '<div class="payme-cart-item__placeholder"></div>'}
          </div>
          <div class="payme-cart-item__details">
            <h3 class="payme-cart-item__title">${item.title}</h3>
            ${item.variant_title ? `<p class="payme-cart-item__variant">${item.variant_title}</p>` : ''}
            <div class="payme-cart-item__meta">
              <span class="payme-cart-item__quantity">Qty: ${item.quantity}</span>
              <span class="payme-cart-item__price">${this.formatMoney(itemPrice, currencySymbol)} each</span>
            </div>
          </div>
          <div class="payme-cart-item__total">
            ${this.formatMoney(itemTotal, currencySymbol)}
          </div>
        </div>
      `;
    }).join('');

    const subtotal = cart.total_price / 100;

    this.innerHTML = `
      <div class="payme-cart-items">
        ${itemsHTML}
      </div>
      <div class="payme-cart-totals">
        <div class="payme-cart-total-row">
          <span class="payme-cart-total-label">Subtotal</span>
          <span class="payme-cart-total-value">${this.formatMoney(subtotal, currencySymbol)}</span>
        </div>
        ${cart.total_discount > 0 ? `
          <div class="payme-cart-total-row payme-cart-total-row--discount">
            <span class="payme-cart-total-label">Discount</span>
            <span class="payme-cart-total-value">-${this.formatMoney(cart.total_discount / 100, currencySymbol)}</span>
          </div>
        ` : ''}
        <div class="payme-cart-total-row payme-cart-total-row--final">
          <span class="payme-cart-total-label">Total</span>
          <span class="payme-cart-total-value">${this.formatMoney(subtotal - (cart.total_discount / 100), currencySymbol)}</span>
        </div>
        <p class="payme-cart-note">Shipping and taxes calculated by Payme</p>
      </div>
    `;
  }

  showEmptyCart() {
    this.innerHTML = `
      <div class="payme-cart-empty">
        <p>Your cart is empty</p>
        <a href="/collections/all" class="button">Continue Shopping</a>
      </div>
    `;
  }

  showError(message) {
    this.innerHTML = `
      <div class="payme-cart-error">
        <p>${message}</p>
        <button class="button" onclick="location.reload()">Retry</button>
      </div>
    `;
  }

  formatMoney(amount, currency) {
    // Format money based on currency
    if (currency === 'UZS') {
      return `${Math.round(amount).toLocaleString('uz-UZ')} so'm`;
    } else {
      return `${amount.toFixed(2)} ${currency}`;
    }
  }
}

customElements.define('payme-cart-summary', PaymeCartSummary);
