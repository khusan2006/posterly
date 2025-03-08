class DetailsDisclosure extends HTMLElement {
  constructor() {
    super();
    this.mainDetailsToggle = this.querySelector('details');
    this.summary = this.mainDetailsToggle.querySelector('summary');
    this.content = this.summary.nextElementSibling;
    
    this.mainDetailsToggle.addEventListener('focusout', this.onFocusOut.bind(this));
    this.addEventListener('mouseenter', this.onMouseEnter.bind(this));
    this.addEventListener('mouseleave', this.onMouseLeave.bind(this));

    this.animation = null;
    this.isAnimating = false;
  }

  onFocusOut() {
    setTimeout(() => {
      if (!this.contains(document.activeElement)) this.close();
    });
  }

  onMouseEnter() {
    this.open();
  }

  onMouseLeave() {
    this.close();
  }

  open() {
    if (this.isAnimating) return;
    this.mainDetailsToggle.setAttribute('open', '');
    this.summary.setAttribute('aria-expanded', 'true');
    this.animateOpen();
  }

  close() {
    if (this.isAnimating) return;
    this.animateClose();
  }

  animateOpen() {
    this.isAnimating = true;

    // Stop any ongoing animation and play new one
    if (this.animation) this.animation.cancel();

    this.animation = this.content.animate([
      { opacity: 0, transform: 'translateY(-10px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], {
      duration: 300,
      easing: 'ease-out',
      fill: 'forwards'
    });

    this.animation.onfinish = () => {
      this.isAnimating = false;
    };
  }

  animateClose() {
    this.isAnimating = true;

    if (this.animation) this.animation.cancel();

    this.animation = this.content.animate([
      { opacity: 1, transform: 'translateY(0)' },
      { opacity: 0, transform: 'translateY(-10px)' }
    ], {
      duration: 200,
      easing: 'ease-in',
      fill: 'forwards'
    });

    this.animation.onfinish = () => {
      this.mainDetailsToggle.removeAttribute('open');
      this.summary.setAttribute('aria-expanded', 'false');
      this.isAnimating = false;
    };
  }
}

customElements.define('details-disclosure', DetailsDisclosure);

class HeaderMenu extends DetailsDisclosure {
  constructor() {
    super();
    this.header = document.querySelector('.header-wrapper');
  }

  open() {
    super.open();
    if (!this.header) return;
    this.header.preventHide = true;

    if (document.documentElement.style.getPropertyValue('--header-bottom-position-desktop') !== '') return;
    document.documentElement.style.setProperty(
      '--header-bottom-position-desktop',
      `${Math.floor(this.header.getBoundingClientRect().bottom)}px`
    );
  }

  close() {
    super.close();
    if (this.header) this.header.preventHide = false;
  }
}

customElements.define('header-menu', HeaderMenu);
