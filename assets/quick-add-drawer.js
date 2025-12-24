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

        // Listen for product added to cart event to close drawer
        this.addEventListener('product-added-to-cart', () => {
          this.hide(true);
        });
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

          // Update IDs using DOM manipulation to avoid HTML entity encoding issues
          // Update all elements with IDs containing the section ID
          productElement.querySelectorAll('[id]').forEach(el => {
            if (el.id.includes(oldId)) {
              el.id = el.id.replaceAll(oldId, newId);
            }
          });

          // Update all attributes that reference the section ID
          const attributesToCheck = ['for', 'aria-describedby', 'aria-labelledby', 'aria-controls', 'data-section', 'data-section-id', 'form', 'href'];
          attributesToCheck.forEach(attr => {
            productElement.querySelectorAll(`[${attr}]`).forEach(el => {
              const value = el.getAttribute(attr);
              if (value && value.includes(oldId)) {
                el.setAttribute(attr, value.replaceAll(oldId, newId));
              }
            });
          });

          // Update attributes on the productElement itself
          Array.from(productElement.attributes).forEach((attribute) => {
            if (attribute.value.includes(oldId)) {
              productElement.setAttribute(attribute.name, attribute.value.replaceAll(oldId, newId));
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
        // Only render product info header and product content (no close button or handle)
        // Create wrapper structure
        const wrapper = document.createElement('div');
        wrapper.className = 'quick-add-drawer__wrapper';

        // Create header
        const header = document.createElement('div');
        header.className = 'quick-add-drawer__product-header';

        if (productInfo.vendor) {
          const vendorDiv = document.createElement('div');
          vendorDiv.className = 'quick-add-drawer__vendor';
          vendorDiv.textContent = productInfo.vendor;
          header.appendChild(vendorDiv);
        }

        const title = document.createElement('h2');
        title.className = 'quick-add-drawer__title';
        title.textContent = productInfo.title;
        header.appendChild(title);

        const viewDetails = document.createElement('a');
        viewDetails.href = productInfo.url;
        viewDetails.className = 'quick-add-drawer__view-details';
        viewDetails.textContent = 'View full details →';
        header.appendChild(viewDetails);

        wrapper.appendChild(header);

        // Create product content container and append the actual element (not outerHTML)
        const productContent = document.createElement('div');
        productContent.className = 'quick-add-drawer__product-content';
        productContent.appendChild(productElement);
        wrapper.appendChild(productContent);

        if (this.drawerBody) {
          this.drawerBody.innerHTML = '';
          this.drawerBody.appendChild(wrapper);
          // Initialize Shopify 3D model viewer if present
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