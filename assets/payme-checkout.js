// Shipping zones configuration - single price per zone
const SHIPPING_ZONES = {
  tashkent: {
    name: "Toshkent shahri",
    price: 1000,
    days: "1-2 kun"
  },
  tashkent_region: {
    name: "Toshkent viloyati",
    price: 35000,
    days: "2-3 kun"
  },
  nearby: {
    name: "Yaqin viloyatlar",
    price: 45000,
    days: "3-5 kun"
  },
  distant: {
    name: "Uzoq viloyatlar",
    price: 55000,
    days: "4-7 kun"
  }
};

class PaymeCheckoutForm extends HTMLElement {
  constructor() {
    super();

    this.form = this.querySelector('form');
    this.submitButton = this.querySelector('#Payme-submit');
    this.cancelButton = this.querySelector('#Payme-cancel');
    this.errorContainer = this.querySelector('.payme-checkout-form__error');

    this.phoneInput = this.querySelector('#Payme-phone');
    this.nameInput = this.querySelector('#Payme-name');
    this.cityInput = this.querySelector('#Payme-city');
    this.addressInput = this.querySelector('#Payme-address');
    this.emailInput = this.querySelector('#Payme-email');

    this.selectedShipping = null;
    this.selectedCity = null;
    this.selectedZone = null;

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

    // City change handler for shipping options
    if (this.cityInput) {
      this.cityInput.addEventListener('change', this.handleCityChange.bind(this));
    }
  }

  handleCityChange(event) {
    const selectedOption = event.target.options[event.target.selectedIndex];
    const zone = selectedOption.dataset.zone;
    const cityName = selectedOption.text;
    const cityValue = event.target.value;
    const regionName = selectedOption.parentElement.label;

    this.selectedCity = {
      value: cityValue,
      name: cityName,
      regionName: regionName
    };
    this.selectedZone = zone;

    // Dispatch city change event
    window.dispatchEvent(new CustomEvent('city:changed', {
      detail: this.selectedCity
    }));

    this.updateShippingOptions(zone);
  }

  updateShippingOptions(zone) {
    const zoneData = SHIPPING_ZONES[zone];

    if (!zoneData) {
      this.selectedShipping = null;
      this.dispatchShippingChange();
      return;
    }

    // Set shipping data based on selected zone
    this.selectedShipping = {
      id: zone,
      name: "Yetkazib berish",
      price: zoneData.price,
      days: zoneData.days,
      zone: zone,
      zoneName: zoneData.name
    };
    this.dispatchShippingChange();
  }

  dispatchShippingChange() {
    // Dispatch custom event for cart summary to update
    window.dispatchEvent(new CustomEvent('shipping:changed', {
      detail: this.selectedShipping
    }));
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

      // Prepare payload with shipping information
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
        // Address information
        customerCity: this.selectedCity ? this.selectedCity.name : '',
        customerCityValue: this.selectedCity ? this.selectedCity.value : '',
        customerRegion: this.selectedCity ? this.selectedCity.regionName : '',
        customerAddress: this.addressInput ? this.addressInput.value.trim() : '',
        // Full formatted address for order
        customerFullAddress: this.selectedCity
          ? `${this.addressInput.value.trim()}, ${this.selectedCity.name}, ${this.selectedCity.regionName}`
          : this.addressInput.value.trim(),
        cartToken: cartToken,
        url: 'https://posterly.uz',
        // Shipping information for order creation
        shipping: this.selectedShipping ? {
          id: this.selectedShipping.id,
          name: this.selectedShipping.name,
          price: this.selectedShipping.price,
          deliveryDays: this.selectedShipping.days,
          zone: this.selectedZone,
          zoneName: SHIPPING_ZONES[this.selectedZone]?.name || ''
        } : null
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
      console.log(data)
      if (data.success && data.paymeUrl) {
        // Redirect to Payme payment page
        // window.location.href = data.paymeUrl;
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
      this.showFieldError('phone', 'Telefon raqami kiritilishi shart');
      isValid = false;
    } else if (!phonePattern.test(phoneValue)) {
      this.showFieldError('phone', "To'g'ri telefon raqamini kiriting: +998 XX XXX XX XX");
      isValid = false;
    }

    // Validate name
    const nameValue = this.nameInput.value.trim();
    if (!nameValue || nameValue.length < 2) {
      this.showFieldError('name', "To'liq ismingizni kiriting");
      isValid = false;
    }

    // Validate city selection
    if (this.cityInput) {
      const cityValue = this.cityInput.value;
      if (!cityValue) {
        this.showFieldError('city', 'Shahar yoki tumanni tanlang');
        isValid = false;
      }
    }

    // Validate address
    if (this.addressInput) {
      const addressValue = this.addressInput.value.trim();
      if (!addressValue || addressValue.length < 5) {
        this.showFieldError('address', "Manzilingizni to'liq kiriting (ko'cha, uy raqami)");
        isValid = false;
      }
    }

    // Validate shipping selection
    if (!this.selectedShipping) {
      this.showError('Yetkazib berish usulini tanlang');
      isValid = false;
    }

    // Validate email if provided
    const emailValue = this.emailInput.value.trim();
    if (emailValue) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(emailValue)) {
        this.showFieldError('email', "To'g'ri email manzilini kiriting");
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
    this.cart = null;
    this.selectedShipping = null;
    this.selectedCity = null;
    this.loadCartSummary();
    this.setupShippingListener();
  }

  setupShippingListener() {
    window.addEventListener('shipping:changed', (event) => {
      this.selectedShipping = event.detail;
      if (this.cart) {
        this.renderCartItems(this.cart);
      }
    });

    window.addEventListener('city:changed', (event) => {
      this.selectedCity = event.detail;
      if (this.cart) {
        this.renderCartItems(this.cart);
      }
    });
  }

  hideLoadingSpinner() {
    const loadingEl = this.parentElement?.querySelector('.payme-cart-summary__loading');
    if (loadingEl) {
      loadingEl.style.display = 'none';
    }
  }

  async loadCartSummary() {
    try {
      const cart = await fetch('/cart.js').then(r => r.json());
      this.cart = cart;
      this.hideLoadingSpinner();

      if (!cart || !cart.items || cart.items.length === 0) {
        this.showEmptyCart();
        return;
      }

      this.renderCartItems(cart);
    } catch (error) {
      console.error('Error loading cart:', error);
      this.hideLoadingSpinner();
      this.showError("Savatni yuklashda xatolik. Qayta urinib ko'ring.");
    }
  }

  renderCartItems(cart) {
    const currencySymbol = cart.currency || 'UZS';
    const itemCount = cart.item_count;

    const itemsHTML = cart.items.map(item => {
      const itemTotal = (item.price * item.quantity) / 100;
      const itemPrice = item.price / 100;

      return `
        <div class="payme-cart-item">
          <div class="payme-cart-item__image">
            ${item.image ? `<img src="${item.image}" alt="${this.escapeHtml(item.title)}" loading="lazy">` : '<div class="payme-cart-item__placeholder"></div>'}
          </div>
          <div class="payme-cart-item__details">
            <h3 class="payme-cart-item__title">${this.escapeHtml(item.title)}</h3>
            ${item.variant_title ? `<p class="payme-cart-item__variant">${this.escapeHtml(item.variant_title)}</p>` : ''}
            <div class="payme-cart-item__meta">
              <span class="payme-cart-item__quantity">${item.quantity} dona</span>
              <span class="payme-cart-item__price">${this.formatMoney(itemPrice, currencySymbol)}</span>
            </div>
          </div>
          <div class="payme-cart-item__total">
            ${this.formatMoney(itemTotal, currencySymbol)}
          </div>
        </div>
      `;
    }).join('');

    const subtotal = cart.total_price / 100;
    const discount = cart.total_discount / 100;
    const shippingCost = this.selectedShipping ? this.selectedShipping.price : 0;
    const finalTotal = subtotal - discount + shippingCost;

    this.innerHTML = `
      <div class="payme-cart-summary__header">
        <span class="payme-cart-summary__count">${itemCount} ta mahsulot</span>
      </div>
      <div class="payme-cart-items">
        ${itemsHTML}
      </div>
      <div class="payme-cart-totals">
        <div class="payme-cart-total-row">
          <span class="payme-cart-total-label">Mahsulotlar</span>
          <span class="payme-cart-total-value">${this.formatMoney(subtotal, currencySymbol)}</span>
        </div>
        ${cart.total_discount > 0 ? `
          <div class="payme-cart-total-row payme-cart-total-row--discount">
            <span class="payme-cart-total-label">Chegirma</span>
            <span class="payme-cart-total-value">-${this.formatMoney(discount, currencySymbol)}</span>
          </div>
        ` : ''}
        ${this.selectedCity ? `
          <div class="payme-cart-delivery-location">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <span>${this.escapeHtml(this.selectedCity.name)}, ${this.escapeHtml(this.selectedCity.regionName)}</span>
          </div>
          <div class="payme-cart-total-row payme-cart-total-row--shipping">
            <span class="payme-cart-total-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="1" y="3" width="15" height="13"></rect>
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                <circle cx="18.5" cy="18.5" r="2.5"></circle>
              </svg>
              Yetkazib berish
            </span>
            <span class="payme-cart-total-value">${this.formatMoney(shippingCost, currencySymbol)}</span>
          </div>
        ` : ''}
        <div class="payme-cart-total-row payme-cart-total-row--final">
          <span class="payme-cart-total-label">Jami to'lov</span>
          <span class="payme-cart-total-value">${this.formatMoney(finalTotal, currencySymbol)}</span>
        </div>
      </div>
    `;
  }

  showEmptyCart() {
    this.innerHTML = `
      <div class="payme-cart-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="9" cy="21" r="1"/>
          <circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        <p>Savatingiz bo'sh</p>
        <a href="/collections/all" class="button button--secondary">Xarid qilishni boshlash</a>
      </div>
    `;
  }

  showError(message) {
    this.innerHTML = `
      <div class="payme-cart-error">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p>${message}</p>
        <button class="button button--secondary" onclick="location.reload()">Qayta urinish</button>
      </div>
    `;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  formatMoney(amount, currency) {
    if (currency === 'UZS') {
      return `${Math.round(amount).toLocaleString('uz-UZ')} so'm`;
    } else {
      return `${amount.toFixed(2)} ${currency}`;
    }
  }
}

customElements.define('payme-cart-summary', PaymeCartSummary);
