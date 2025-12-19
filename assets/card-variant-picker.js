/**
 * Card Variant Picker - Handles variant selection on product cards
 * Updates price dynamically when variant options are selected
 */

class CardVariantPicker {
  constructor() {
    this.init();
  }

  init() {
    // Initialize all variant option containers
    document.querySelectorAll('.card__variant-options').forEach((container) => {
      this.initContainer(container);
    });

    // Listen for dynamically added cards (e.g., from infinite scroll)
    this.observeNewCards();
  }

  initContainer(container) {
    const productId = container.dataset.productId;
    const dataScript = container.querySelector('.card__variant-data');

    if (!dataScript) return;

    try {
      const data = JSON.parse(dataScript.textContent);
      container._variantData = data;

      // Store current selections
      container._currentSelections = {};

      // Initialize with first available variant's options
      const firstVariant = data.variants.find(v => v.available) || data.variants[0];
      if (firstVariant) {
        data.options.forEach((optionName, index) => {
          container._currentSelections[optionName] = firstVariant.options[index];
        });
      }

      // Add click handlers to swatches (support both old and new class names)
      container.querySelectorAll('.card__variant-swatch, .card__swatch').forEach((swatch) => {
        swatch.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.handleSwatchClick(container, swatch);
        });
      });

      // Update initial state
      this.updateSwatchStates(container);
    } catch (error) {
      console.error('Error parsing variant data:', error);
    }
  }

  handleSwatchClick(container, swatch) {
    const optionName = swatch.dataset.optionName;
    const optionValue = swatch.dataset.optionValue;
    const data = container._variantData;

    // Update selection
    container._currentSelections[optionName] = optionValue;

    // Find matching variant
    const selectedVariant = this.findVariant(data, container._currentSelections);

    // Update swatch states
    this.updateSwatchStates(container);

    // Update price display
    if (selectedVariant) {
      this.updatePrice(container, selectedVariant);

      // Update any hidden variant ID inputs for quick add forms
      this.updateVariantInput(container, selectedVariant);
    }
  }

  findVariant(data, selections) {
    return data.variants.find((variant) => {
      return data.options.every((optionName, index) => {
        return variant.options[index] === selections[optionName];
      });
    });
  }

  updateSwatchStates(container) {
    const data = container._variantData;
    const selections = container._currentSelections;

    container.querySelectorAll('.card__variant-swatch, .card__swatch').forEach((swatch) => {
      const optionName = swatch.dataset.optionName;
      const optionValue = swatch.dataset.optionValue;

      // Update selected state
      const isSelected = selections[optionName] === optionValue;
      // Support both old and new class names
      swatch.classList.toggle('card__variant-swatch--selected', isSelected);
      swatch.classList.toggle('card__swatch--active', isSelected);

      // Check availability
      const testSelections = { ...selections, [optionName]: optionValue };
      const matchingVariant = this.findVariant(data, testSelections);
      const isAvailable = matchingVariant ? matchingVariant.available : false;

      swatch.classList.toggle('card__variant-swatch--unavailable', !isAvailable);
      swatch.classList.toggle('card__swatch--unavailable', !isAvailable);
    });
  }

  updatePrice(container, variant) {
    const productId = container.dataset.productId;
    const priceWrapper = document.querySelector(
      `.card__price-wrapper[data-product-id="${productId}"]`
    );

    if (!priceWrapper) return;

    // Add loading state
    priceWrapper.classList.add('loading');

    // Build new price HTML
    let priceHtml = '';

    if (variant.compare_at_price && variant.compare_at_price > variant.price) {
      // On sale
      priceHtml = `
        <div class="price price--on-sale">
          <div class="price__container">
            <div class="price__regular">
              <span class="visually-hidden">Regular price</span>
              <span class="price-item price-item--regular">${variant.price_formatted}</span>
            </div>
            <div class="price__sale">
              <span class="visually-hidden">Regular price</span>
              <span><s class="price-item price-item--regular">${variant.compare_at_price_formatted}</s></span>
              <span class="visually-hidden">Sale price</span>
              <span class="price-item price-item--sale price-item--last">${variant.price_formatted}</span>
            </div>
          </div>
        </div>
      `;
    } else {
      // Regular price
      priceHtml = `
        <div class="price${!variant.available ? ' price--sold-out' : ''}">
          <div class="price__container">
            <div class="price__regular">
              <span class="visually-hidden">Regular price</span>
              <span class="price-item price-item--regular">${variant.price_formatted}</span>
            </div>
          </div>
        </div>
      `;
    }

    // Update price with fade effect
    setTimeout(() => {
      priceWrapper.innerHTML = priceHtml;
      priceWrapper.classList.remove('loading');
    }, 100);
  }

  updateVariantInput(container, variant) {
    const productId = container.dataset.productId;

    // Update any forms that reference this product
    const forms = document.querySelectorAll(`product-form[data-section-id] form`);
    forms.forEach((form) => {
      const input = form.querySelector(`.product-variant-id`);
      if (input) {
        // Check if this form is for our product by checking nearby elements
        const cardWrapper = form.closest('.card-wrapper');
        if (cardWrapper && cardWrapper.querySelector(`[data-product-id="${productId}"]`)) {
          input.value = variant.id;
          input.disabled = !variant.available;
        }
      }
    });

    // Also update drawer opener data
    const drawerOpeners = document.querySelectorAll(`drawer-opener[data-product-id="${productId}"]`);
    drawerOpeners.forEach((opener) => {
      opener.dataset.variantId = variant.id;
    });
  }

  observeNewCards() {
    // Use MutationObserver to catch dynamically added cards
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const containers = node.querySelectorAll
              ? node.querySelectorAll('.card__variant-options')
              : [];
            containers.forEach((container) => {
              if (!container._variantData) {
                this.initContainer(container);
              }
            });
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new CardVariantPicker());
} else {
  new CardVariantPicker();
}
