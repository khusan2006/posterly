// Quick Add Drawer Custom Elements
if (!customElements.get('drawer-opener')) {
  customElements.define(
    'drawer-opener',
    class DrawerOpener extends HTMLElement {
      constructor() {
        super();
      }

      connectedCallback() {
        const button = this.querySelector('button');
        if (!button) return;
        
        button.addEventListener('click', (e) => {
          e.preventDefault();
          const drawerId = this.getAttribute('data-drawer');
          const drawer = document.querySelector(drawerId);
          if (drawer) {
            drawer.show(button);
          }
        });
      }
    }
  );
}

if (!customElements.get('quick-add-drawer')) {
  customElements.define(
    'quick-add-drawer',
    class QuickAddDrawer extends HTMLElement {
      constructor() {
        super();
        this.drawerBody = this.querySelector('.quick-add-drawer__body');
        this.isOpen = false;
        this.openedBy = null;
        this.currentProductId = null;
        
        // Bind methods
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onOverlayClick = this.onOverlayClick.bind(this);
      }

      connectedCallback() {
        this.setupEventListeners();
      }

      setupEventListeners() {
        // Close button
        const closeButton = this.querySelector('.quick-add-drawer__close');
        if (closeButton) {
          closeButton.addEventListener('click', () => this.hide());
        }

        // Overlay click to close
        const overlay = this.querySelector('.quick-add-drawer__overlay');
        if (overlay) {
          overlay.addEventListener('click', this.onOverlayClick.bind(this));
        }

        // Alternative: Listen on the main drawer for clicks outside content
        this.addEventListener('click', (event) => {
          const content = this.querySelector('.quick-add-drawer__content');
          if (content && !content.contains(event.target)) {
            this.hide();
          }
        });

        // Prevent content clicks from bubbling to main drawer
        const content = this.querySelector('.quick-add-drawer__content');
        if (content) {
          content.addEventListener('click', (event) => {
            event.stopPropagation();
          });
        }
      }

      onOverlayClick(event) {
        // Close the drawer when clicking on the overlay
        this.hide();
      }

      onKeyDown(event) {
        if (event.key === 'Escape') {
          this.hide();
        }
      }

      async show(opener) {
        this.openedBy = opener;
        this.currentProductId = opener.getAttribute('data-product-id');
        
        // If drawer is already open with the same product, don't reload
        if (this.isOpen && this.getAttribute('data-current-product') === this.currentProductId) {
          return;
        }

        // Add loading state to button
        opener.setAttribute('aria-disabled', true);
        opener.classList.add('loading');
        const spinner = opener.querySelector('.loading__spinner');
        if (spinner) spinner.classList.remove('hidden');

        // Load product data first
        const productUrl = opener.getAttribute('data-product-url');
        if (productUrl) {
          const success = await this.loadProductData(productUrl, opener);
          
          // Only open drawer if loading was successful
          if (success) {
            // Show drawer if not already open
            if (!this.isOpen) {
              this.isOpen = true;
              this.setAttribute('open', '');
              document.body.style.overflow = 'hidden';
              document.addEventListener('keydown', this.onKeyDown);
            }

            // Set current product
            this.setAttribute('data-current-product', this.currentProductId);

            // Focus management
            setTimeout(() => this.focusFirstFocusableElement(), 100);
          }
        }

        // Remove loading state from button
        opener.removeAttribute('aria-disabled');
        opener.classList.remove('loading');
        if (spinner) spinner.classList.add('hidden');
      }

      hide() {
        if (!this.isOpen) return;

        // Start closing animation
        this.setAttribute('closing', '');
        
        // Wait for CSS transition to complete before fully hiding
        const content = this.querySelector('.quick-add-drawer__content');
        const transitionDuration = parseFloat(getComputedStyle(content).transitionDuration) * 1000 || 300;
        
        setTimeout(() => {
          this.isOpen = false;
          this.removeAttribute('open');
          this.removeAttribute('closing');
          document.body.style.overflow = '';
          document.removeEventListener('keydown', this.onKeyDown);

          // Clear content after animation
          if (this.drawerBody) {
            this.drawerBody.innerHTML = '';
          }

          // Clear current product
          this.removeAttribute('data-current-product');
          this.currentProductId = null;

          // Restore focus
          if (this.openedBy) {
            this.openedBy.focus();
            this.openedBy = null;
          }
        }, transitionDuration);
      }

      async loadProductData(productUrl, opener) {
        try {
          const response = await fetch(productUrl);
          const html = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          
          // Extract product data
          const product = {
            title: doc.querySelector('.product__title h1')?.textContent?.trim() || 'Product',
            vendor: doc.querySelector('.product__vendor')?.textContent?.trim() || '',
            price: this.extractPrice(doc),
            image: doc.querySelector('.product__media img')?.getAttribute('src') || '',
            imageAlt: doc.querySelector('.product__media img')?.getAttribute('alt') || '',
            url: productUrl,
            variants: this.extractVariants(doc),
            selectedVariantId: this.extractSelectedVariantId(doc)
          };

          this.renderDrawerContent(product, opener);
          return true; // Success
        } catch (error) {
          console.error('Error loading product data:', error);
          this.renderErrorContent();
          return false; // Failure
        }
      }

      extractPrice(doc) {
        const priceElement = doc.querySelector('.price .price-item--regular, .price__regular .price-item');
        return priceElement ? priceElement.innerHTML : '';
      }

      extractSelectedVariantId(doc) {
        const variantIdInput = doc.querySelector('input[name="id"], .product-variant-id');
        return variantIdInput ? variantIdInput.value : '';
      }

      extractVariants(doc) {
        const variants = [];
        
        // Extract from fieldset elements (common pattern in Shopify themes)
        const fieldsets = doc.querySelectorAll('fieldset');
        fieldsets.forEach(fieldset => {
          const legend = fieldset.querySelector('legend');
          if (!legend) return;
          
          const optionName = legend.textContent.trim();
          const inputs = fieldset.querySelectorAll('input[type="radio"]');
          
          if (inputs.length > 0) {
            const options = Array.from(inputs).map(input => ({
              name: input.value,
              value: input.value,
              selected: input.checked,
              available: !input.disabled
            }));
            variants.push({ name: optionName, options });
          }
        });

        // Fallback: Extract from select elements
        if (variants.length === 0) {
          const variantSelects = doc.querySelectorAll('select[name*="option"]');
          variantSelects.forEach(select => {
            const optionName = select.name.replace('options[', '').replace(']', '');
            const options = Array.from(select.options).map(option => ({
              name: option.textContent.trim(),
              value: option.value,
              selected: option.selected,
              available: !option.disabled
            }));
            if (options.length > 0) {
              variants.push({ name: optionName, options });
            }
          });
        }

        return variants;
      }

      renderDrawerContent(product, opener) {
        const productId = this.currentProductId || 'default';
        
        const content = `
          <div class="quick-add-drawer__wrapper">
            <div class="quick-add-drawer__media">
              ${product.image ? `
                <div class="quick-add-drawer__image">
                  <img
                    src="${product.image}"
                    alt="${product.imageAlt}"
                    loading="lazy"
                  >
                </div>
              ` : ''}
            </div>

            <div class="quick-add-drawer__details">
              ${product.vendor ? `<div class="quick-add-drawer__vendor">${product.vendor}</div>` : ''}
              <h2 class="quick-add-drawer__title">${product.title}</h2>
              <div class="quick-add-drawer__price">${product.price}</div>
              <a href="${product.url}" class="quick-add-drawer__view-details">View full details →</a>

              <form action="/cart/add" method="post" enctype="multipart/form-data" id="quick-add-drawer-form-${productId}" class="form" novalidate="novalidate" data-type="add-to-cart-form">
                <input type="hidden" name="id" value="${product.selectedVariantId}" class="product-variant-id">

                ${this.renderVariantOptions(product.variants, productId)}

                <div class="quick-add-drawer__quantity">
                  <label class="quick-add-drawer__option-label">Quantity:</label>
                  <div class="quick-add-drawer__quantity-controls">
                    <button type="button" class="quick-add-drawer__quantity-btn quick-add-drawer__quantity-btn--minus" aria-label="Decrease quantity">−</button>
                    <input 
                      type="number" 
                      name="quantity" 
                      value="1" 
                      min="1" 
                      class="quick-add-drawer__quantity-input"
                      aria-label="Quantity"
                    >
                    <button type="button" class="quick-add-drawer__quantity-btn quick-add-drawer__quantity-btn--plus" aria-label="Increase quantity">+</button>
                  </div>
                </div>

                <div class="quick-add-drawer__actions">
                  <button
                    type="submit"
                    name="add"
                    class="quick-add-drawer__add-to-cart"
                  >
                    <span>Add to cart</span>
                  </button>
                  
                  <button type="button" class="quick-add-drawer__buy-now">
                    Buy it now
                  </button>
                  
                  <button type="button" class="quick-add-drawer__more-payment-options">
                    More payment options
                  </button>
                </div>
              </form>
            </div>
          </div>
        `;

        if (this.drawerBody) {
          this.drawerBody.innerHTML = content;
          this.setupDrawerInteractions();
        }
      }

      renderVariantOptions(variants, productId) {
        if (!variants.length) return '';

        return `
          <div class="quick-add-drawer__variants">
            ${variants.map((variant, index) => `
              <div class="quick-add-drawer__option-group">
                <label class="quick-add-drawer__option-label">${variant.name}</label>
                ${variant.name.toLowerCase() === 'color' ? this.renderColorOptions() : this.renderRegularOptions(variant, productId, index)}
              </div>
            `).join('')}
          </div>
        `;
      }

      renderColorOptions() {
        return `
          <div class="quick-add-drawer__color-options">
            <div class="quick-add-drawer__color-swatch quick-add-drawer__color-swatch--white quick-add-drawer__color-swatch--selected" data-color="white"></div>
            <div class="quick-add-drawer__color-swatch quick-add-drawer__color-swatch--black" data-color="black"></div>
          </div>
          <span class="quick-add-drawer__color-label">White</span>
        `;
      }

      renderRegularOptions(variant, productId, variantIndex) {
        return `
          <div class="quick-add-drawer__option-values" data-option-position="${variantIndex + 1}">
            ${variant.options.map((option, optionIndex) => `
              <input
                type="radio"
                id="quick-add-drawer-${productId}-${variantIndex}-${optionIndex}"
                name="options[${variant.name}]"
                value="${option.value}"
                ${option.selected ? 'checked' : ''}
                ${!option.available ? 'disabled' : ''}
                class="quick-add-drawer__option-input"
              >
              <label 
                for="quick-add-drawer-${productId}-${variantIndex}-${optionIndex}"
                class="quick-add-drawer__option-button${!option.available ? ' quick-add-drawer__option-button--disabled' : ''}"
              >
                ${option.name}
                ${this.getOptionSubtext(variant.name, option.name)}
              </label>
            `).join('')}
          </div>
        `;
      }

      getOptionSubtext(variantName, optionName) {
        if (variantName.toLowerCase().includes('torso')) {
          const subtexts = {
            'Extra Sm': '<small>&lt;15"</small>',
            'Small': '<small>15"-17"</small>',
            'Medium': '<small>17"-19"</small>',
            'Large': '<small>19"-21"</small>',
            'Tall': '<small>21"+</small>'
          };
          return subtexts[optionName] || '';
        }
        return '';
      }

      setupDrawerInteractions() {
        // Quantity controls
        const quantityInput = this.querySelector('.quick-add-drawer__quantity-input');
        const minusBtn = this.querySelector('.quick-add-drawer__quantity-btn--minus');
        const plusBtn = this.querySelector('.quick-add-drawer__quantity-btn--plus');

        if (minusBtn && quantityInput) {
          minusBtn.addEventListener('click', () => {
            const currentValue = parseInt(quantityInput.value) || 1;
            if (currentValue > 1) {
              quantityInput.value = currentValue - 1;
            }
          });
        }

        if (plusBtn && quantityInput) {
          plusBtn.addEventListener('click', () => {
            const currentValue = parseInt(quantityInput.value) || 1;
            quantityInput.value = currentValue + 1;
          });
        }

        // Color swatches
        const colorSwatches = this.querySelectorAll('.quick-add-drawer__color-swatch');
        const colorLabel = this.querySelector('.quick-add-drawer__color-label');
        
        colorSwatches.forEach(swatch => {
          swatch.addEventListener('click', () => {
            colorSwatches.forEach(s => s.classList.remove('quick-add-drawer__color-swatch--selected'));
            swatch.classList.add('quick-add-drawer__color-swatch--selected');
            
            const color = swatch.getAttribute('data-color');
            if (colorLabel) {
              colorLabel.textContent = color.charAt(0).toUpperCase() + color.slice(1);
            }
          });
        });

        // Form submission
        const form = this.querySelector('form');
        if (form) {
          form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddToCart(form);
          });
        }

        // Variant selection
        const variantInputs = this.querySelectorAll('.quick-add-drawer__option-input');
        variantInputs.forEach(input => {
          input.addEventListener('change', () => {
            this.updateSelectedVariant();
          });
        });
      }

      updateSelectedVariant() {
        // This would need to be implemented based on your variant logic
        // For now, we'll keep it simple
        console.log('Variant selection changed');
      }

      async handleAddToCart(form) {
        const formData = new FormData(form);
        const addButton = form.querySelector('.quick-add-drawer__add-to-cart');
        
        // Add loading state
        addButton.disabled = true;
        addButton.innerHTML = '<span>Adding...</span>';

        try {
          const response = await fetch('/cart/add.js', {
            method: 'POST',
            body: formData
          });

          if (response.ok) {
            // Success
            addButton.innerHTML = '<span>Added!</span>';
            setTimeout(() => {
              this.hide();
              // Trigger cart update event if you have a cart drawer
              document.dispatchEvent(new Event('cart:refresh'));
            }, 1000);
          } else {
            throw new Error('Failed to add to cart');
          }
        } catch (error) {
          console.error('Add to cart error:', error);
          addButton.innerHTML = '<span>Error - Try again</span>';
          setTimeout(() => {
            addButton.disabled = false;
            addButton.innerHTML = '<span>Add to cart</span>';
          }, 2000);
        }
      }

      renderErrorContent() {
        if (this.drawerBody) {
          this.drawerBody.innerHTML = `
            <div class="quick-add-drawer__error">
              <h3>Sorry, we couldn't load this product.</h3>
              <p>Please try again or visit the product page directly.</p>
            </div>
          `;
        }
      }

      focusFirstFocusableElement() {
        const focusableElements = this.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        }
      }
    }
  );
} 