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

      hide(isProductFormSubmission = false) {
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

          // Trigger modalClosed event for product-form compatibility
          if (isProductFormSubmission) {
            document.body.dispatchEvent(new CustomEvent('modalClosed'));
          }

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
          const doc = new DOMParser().parseFromString(html, 'text/html');
          
          // Get the product-info element which contains everything
          const productInfoElement = doc.querySelector('product-info');
          if (productInfoElement) {
            console.log('Found product-info element');
            
            // Clone the element to avoid modifying the original
            const productClone = productInfoElement.cloneNode(true);
            
            // Process the element to avoid ID conflicts with the main page
            this.preprocessHTML(productClone);
            
            // Extract basic info for header from the original document
            const title = doc.querySelector('.product__title h1, h1')?.textContent?.trim() || 'Product';
            const vendor = doc.querySelector('.product__text.caption-with-letter-spacing')?.textContent?.trim() || '';
            
            // Get the first image from media gallery
            const image = doc.querySelector('.product__media img')?.getAttribute('src') || '';
            const imageAlt = doc.querySelector('.product__media img')?.getAttribute('alt') || '';
            
            console.log('Extracted info:', { title, vendor, image, imageAlt });
            
            this.renderDrawerContent(productClone, { title, vendor, image, imageAlt, url: productUrl });
            return true;
          } else {
            console.error('Product info element not found');
            console.log('Available elements:', Array.from(doc.querySelectorAll('[class*="product"]')).map(el => el.className));
            throw new Error('Product info element not found');
          }
        } catch (error) {
          console.error('Error loading product data:', error);
          this.renderErrorContent();
          return false;
        }
      }



      preprocessHTML(productElement) {
        // Prevent duplicate IDs by adding a unique prefix
        const sectionId = productElement.dataset.section;
        if (sectionId) {
          const oldId = sectionId;
          const newId = `quickadd-drawer-${sectionId}`;
          productElement.innerHTML = productElement.innerHTML.replaceAll(oldId, newId);
          
          // Update attributes that reference the old ID
          Array.from(productElement.attributes).forEach((attribute) => {
            if (attribute.value.includes(oldId)) {
              productElement.setAttribute(attribute.name, attribute.value.replace(oldId, newId));
            }
          });
          
          productElement.dataset.originalSection = sectionId;
        }
        
        // Only remove elements that are definitely not needed in drawer
        const elementsToRemove = [
          '.product__media-item:not(:first-child)', // Extra product images
          '.quick-add-hidden', // Elements marked to hide in quick add
          '.breadcrumb' // Navigation breadcrumbs
        ];
        
        elementsToRemove.forEach(selector => {
          const elements = productElement.querySelectorAll(selector);
          elements.forEach(el => el.remove());
        });
        
        // Remove product description only if it's very long (keep short descriptions)
        const description = productElement.querySelector('.product__description');
        if (description && description.textContent.length > 200) {
          description.remove();
        }
      }

      renderDrawerContent(productElement, productInfo) {
        // Create a simplified wrapper that includes product info and the product element
        const content = `
          <div class="quick-add-drawer__wrapper">
            <div class="quick-add-drawer__product-header">
              ${productInfo.vendor ? `<div class="quick-add-drawer__vendor">${productInfo.vendor}</div>` : ''}
              <h2 class="quick-add-drawer__title">${productInfo.title}</h2>
              <a href="${productInfo.url}" class="quick-add-drawer__view-details">View full details →</a>
            </div>
            <div class="quick-add-drawer__product-content">
              ${productElement.outerHTML}
            </div>
          </div>
        `;

        if (this.drawerBody) {
          this.drawerBody.innerHTML = content;
          
          // Initialize Shopify features after content is loaded
          if (window.Shopify && Shopify.PaymentButton) {
            Shopify.PaymentButton.init();
          }
          if (window.ProductModel) window.ProductModel.loadShopifyXR();
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