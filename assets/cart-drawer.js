class CartDrawer extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());
    this.querySelector('#CartDrawer-Overlay').addEventListener('click', this.close.bind(this));
    this.setHeaderCartIconAccessibility();
  }

  setHeaderCartIconAccessibility() {
    const cartLink = document.querySelector('#cart-icon-bubble');
    if (!cartLink) return;

    cartLink.setAttribute('role', 'button');
    cartLink.setAttribute('aria-haspopup', 'dialog');
    cartLink.addEventListener('click', (event) => {
      event.preventDefault();
      this.open(cartLink);
    });
    cartLink.addEventListener('keydown', (event) => {
      if (event.code.toUpperCase() === 'SPACE') {
        event.preventDefault();
        this.open(cartLink);
      }
    });
  }

  open(triggeredBy) {
    if (triggeredBy) this.setActiveElement(triggeredBy);
    const cartDrawerNote = this.querySelector('[id^="Details-"] summary');
    if (cartDrawerNote && !cartDrawerNote.hasAttribute('role')) this.setSummaryAccessibility(cartDrawerNote);
    // here the animation doesn't seem to always get triggered. A timeout seem to help
    setTimeout(() => {
      this.classList.add('animate', 'active');
    });

    this.addEventListener(
      'transitionend',
      () => {
        const containerToTrapFocusOn = this.classList.contains('is-empty')
          ? this.querySelector('.drawer__inner-empty')
          : document.getElementById('CartDrawer');
        const focusElement = this.querySelector('.drawer__inner') || this.querySelector('.drawer__close');
        trapFocus(containerToTrapFocusOn, focusElement);
      },
      { once: true }
    );

    document.body.classList.add('overflow-hidden');
  }

  close() {
    this.classList.remove('active');
    removeTrapFocus(this.activeElement);
    document.body.classList.remove('overflow-hidden');
  }

  setSummaryAccessibility(cartDrawerNote) {
    cartDrawerNote.setAttribute('role', 'button');
    cartDrawerNote.setAttribute('aria-expanded', 'false');

    if (cartDrawerNote.nextElementSibling.getAttribute('id')) {
      cartDrawerNote.setAttribute('aria-controls', cartDrawerNote.nextElementSibling.id);
    }

    cartDrawerNote.addEventListener('click', (event) => {
      event.currentTarget.setAttribute('aria-expanded', !event.currentTarget.closest('details').hasAttribute('open'));
    });

    cartDrawerNote.parentElement.addEventListener('keyup', onKeyUpEscape);
  }

  renderContents(parsedState) {
    try {
      if (parsedState) {
        this.productId = parsedState.id;
      }

      if (parsedState && parsedState.sections) {
        const cartDrawerHtml = parsedState.sections['cart-drawer'];
        if (cartDrawerHtml) {
          const doc = new DOMParser().parseFromString(cartDrawerHtml, 'text/html');

          // Update the entire .drawer__inner content to handle empty/non-empty state changes
          const targetDrawerInner = this.querySelector('.drawer__inner');
          const sourceDrawerInner = doc.querySelector('.drawer__inner');
          if (targetDrawerInner && sourceDrawerInner) {
            targetDrawerInner.innerHTML = sourceDrawerInner.innerHTML;
          }
        }

        // Update cart icon bubble
        const cartIconHtml = parsedState.sections['cart-icon-bubble'];
        if (cartIconHtml) {
          const iconDoc = new DOMParser().parseFromString(cartIconHtml, 'text/html');
          const targetIcon = document.getElementById('cart-icon-bubble');
          const sourceIcon = iconDoc.querySelector('.shopify-section');
          if (targetIcon && sourceIcon) {
            targetIcon.innerHTML = sourceIcon.innerHTML;
          }
        }
      }

      // Update is-empty state on the drawer itself
      this.classList.toggle('is-empty', parsedState.item_count === 0);

      setTimeout(() => {
        const overlay = this.querySelector('#CartDrawer-Overlay');
        if (overlay) {
          overlay.addEventListener('click', this.close.bind(this));
        }
        this.open();
      });
    } catch (e) {
      console.error('Cart drawer renderContents error:', e);
      // Still try to open the drawer
      this.open();
    }
  }

  getSectionInnerHTML(html, selector = '.shopify-section') {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const element = doc.querySelector(selector);
    return element ? element.innerHTML : null;
  }

  getSectionsToRender() {
    return [
      {
        id: 'cart-drawer',
        selector: '#CartDrawer',
      },
      {
        id: 'cart-icon-bubble',
        selector: '.shopify-section',
      },
    ];
  }

  getSectionDOM(html, selector = '.shopify-section') {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector);
  }

  setActiveElement(element) {
    this.activeElement = element;
  }
}

customElements.define('cart-drawer', CartDrawer);

class CartDrawerItems extends CartItems {
  getSectionsToRender() {
    return [
      {
        id: 'CartDrawer',
        section: 'cart-drawer',
        selector: '.drawer__inner',
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section',
      },
    ];
  }
}

customElements.define('cart-drawer-items', CartDrawerItems);
