/**
 * Horizontal Scroll Carousel Web Component
 * A reusable carousel component for horizontal scrolling content
 * Features: Touch/swipe support, keyboard navigation, auto-scroll, responsive grid
 */
class HorizontalScrollCarousel extends HTMLElement {
  constructor() {
    super();
    
    // Bind methods to maintain context
    this.handleScroll = debounce(this.handleScroll.bind(this), 16);
    this.handleResize = debounce(this.handleResize.bind(this), 250);
    this.handleKeydown = this.handleKeydown.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.scrollLeft = this.scrollLeft.bind(this);
    this.scrollRight = this.scrollRight.bind(this);
    this.startAutoScroll = this.startAutoScroll.bind(this);
    this.stopAutoScroll = this.stopAutoScroll.bind(this);
    
    // Component state
    this.isDragging = false;
    this.startX = 0;
    this.scrollLeftPos = 0;
    this.intersectionObserver = null;
    
    // Touch state
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.isTouchScrolling = false;
  }

  connectedCallback() {
    this.init();
  }

  disconnectedCallback() {
    this.cleanup();
  }

  /**
   * Initialize the carousel component
   */
  init() {
    this.setupStructure();
    this.setupEventListeners();
    this.setupIntersectionObserver();
    this.updateNavigationState();
  }

  /**
   * Setup the carousel HTML structure
   */
  setupStructure() {
    this.classList.add('horizontal-scroll-carousel');
    
    // Find or create carousel container
    this.container = this.querySelector('.horizontal-scroll-carousel__container') || this.createContainer();
    
    // Create navigation if enabled
    if (this.showArrows) {
      this.createNavigation();
    }
    
    // Setup CSS custom properties
    this.setupCustomProperties();
  }

  /**
   * Create the main carousel container
   */
  createContainer() {
    const container = document.createElement('div');
    container.className = 'horizontal-scroll-carousel__container';
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', 'Carousel content');
    container.setAttribute('tabindex', '0');
    
    // Move all children to container
    while (this.firstChild) {
      container.appendChild(this.firstChild);
    }
    
    this.appendChild(container);
    return container;
  }

  /**
   * Create navigation arrows
   */
  createNavigation() {
    const nav = document.createElement('div');
    nav.className = 'horizontal-scroll-carousel__navigation';
    
    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'horizontal-scroll-carousel__btn horizontal-scroll-carousel__btn--prev';
    prevBtn.setAttribute('aria-label', 'Previous items');
    prevBtn.innerHTML = `
      <span class="svg-wrapper">
        <svg viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 1L4 7L2 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
    `;
    prevBtn.addEventListener('click', this.scrollLeft);
    
    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'horizontal-scroll-carousel__btn horizontal-scroll-carousel__btn--next';
    nextBtn.setAttribute('aria-label', 'Next items');
    nextBtn.innerHTML = `
      <span class="svg-wrapper">
        <svg viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 7L8 1L10 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
    `;
    nextBtn.addEventListener('click', this.scrollRight);
    
    nav.appendChild(prevBtn);
    nav.appendChild(nextBtn);
    this.appendChild(nav);
    
    this.prevBtn = prevBtn;
    this.nextBtn = nextBtn;
  }

  /**
   * Setup CSS custom properties for styling
   */
  setupCustomProperties() {
    this.style.setProperty('--carousel-gap', this.gap);
    this.style.setProperty('--carousel-items-desktop', this.itemsPerView.desktop || 4);
    this.style.setProperty('--carousel-items-tablet', this.itemsPerView.tablet || 2);
    this.style.setProperty('--carousel-items-mobile', this.itemsPerView.mobile || 1);
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Scroll events
    this.container.addEventListener('scroll', this.handleScroll);
    
    // Resize events
    window.addEventListener('resize', this.handleResize);
    
    // Keyboard navigation
    this.container.addEventListener('keydown', this.handleKeydown);
    
    // Touch events for mobile
    this.container.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    this.container.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.container.addEventListener('touchend', this.handleTouchEnd);
    
    // Mouse events for desktop drag
    this.container.addEventListener('mousedown', this.handleMouseDown);
    this.container.addEventListener('mousemove', this.handleMouseMove);
    this.container.addEventListener('mouseup', this.handleMouseUp);
    this.container.addEventListener('mouseleave', this.handleMouseUp);
    
    // Prevent context menu on right click during drag
    this.container.addEventListener('contextmenu', (e) => {
      if (this.isDragging) e.preventDefault();
    });
    
    // User interaction detection for auto-scroll
    this.addEventListener('mouseenter', this.stopAutoScroll);
    this.addEventListener('mouseleave', () => {
      if (this.autoScroll && !this.isUserInteracting) {
        this.startAutoScroll();
      }
    });
    
    // Setup external navigation if specified
    this.setupExternalNavigation();
  }

  /**
   * Setup external navigation (header arrows)
   */
  setupExternalNavigation() {
    const externalNavId = this.getAttribute('data-external-nav');
    if (externalNavId) {
      const externalNav = document.getElementById(externalNavId);
      if (externalNav) {
        const prevBtn = externalNav.querySelector('[data-action="prev"]');
        const nextBtn = externalNav.querySelector('[data-action="next"]');
        
        if (prevBtn) {
          prevBtn.addEventListener('click', this.scrollLeft);
          this.externalPrevBtn = prevBtn;
        }
        
        if (nextBtn) {
          nextBtn.addEventListener('click', this.scrollRight);
          this.externalNextBtn = nextBtn;
        }
      }
    }
  }

  /**
   * Setup intersection observer for performance
   */
  setupIntersectionObserver() {
    if ('IntersectionObserver' in window) {
      this.intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            if (this.autoScroll) this.startAutoScroll();
          } else {
            this.stopAutoScroll();
          }
        });
      }, { threshold: 0.1 });
      
      this.intersectionObserver.observe(this);
    }
  }

  /**
   * Handle scroll events
   */
  handleScroll() {
    this.updateNavigationState();
    this.stopAutoScroll();
    
    // Reset auto-scroll after user stops scrolling
    clearTimeout(this.scrollTimeout);
    this.scrollTimeout = setTimeout(() => {
      this.isUserInteracting = false;
      if (this.autoScroll) this.startAutoScroll();
    }, 2000);
  }

  /**
   * Handle resize events
   */
  handleResize() {
    this.updateNavigationState();
  }

  /**
   * Handle keyboard navigation
   */
  handleKeydown(e) {
    if (e.target !== this.container) return;
    
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        this.scrollLeft();
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.scrollRight();
        break;
      case 'Home':
        e.preventDefault();
        this.scrollToStart();
        break;
      case 'End':
        e.preventDefault();
        this.scrollToEnd();
        break;
    }
  }

  /**
   * Handle touch start
   */
  handleTouchStart(e) {
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
    this.isTouchScrolling = false;
  }

  /**
   * Handle touch move
   */
  handleTouchMove(e) {
    if (!this.touchStartX) return;
    
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    const diffX = this.touchStartX - touchX;
    const diffY = this.touchStartY - touchY;
    
    // Determine if this is a horizontal or vertical scroll
    if (!this.isTouchScrolling) {
      if (Math.abs(diffX) > Math.abs(diffY)) {
        this.isTouchScrolling = true;
        e.preventDefault(); // Prevent vertical scroll
      } else {
        return; // Let vertical scroll happen
      }
    }
    
    if (this.isTouchScrolling) {
      e.preventDefault();
      this.container.scrollLeft += diffX * 0.8; // Smooth scrolling factor
      this.touchStartX = touchX;
    }
  }

  /**
   * Handle touch end
   */
  handleTouchEnd() {
    if (this.isTouchScrolling) {
      // Snap to nearest card on mobile
      this.snapToNearestCard();
    }
    
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.isTouchScrolling = false;
  }

  /**
   * Handle mouse down for drag functionality
   */
  handleMouseDown(e) {
    this.isDragging = true;
    this.startX = e.pageX - this.container.offsetLeft;
    this.scrollLeftPos = this.container.scrollLeft;
    this.container.style.cursor = 'grabbing';
    this.isUserInteracting = true;
    this.stopAutoScroll();
    e.preventDefault();
  }

  /**
   * Handle mouse move for drag functionality
   */
  handleMouseMove(e) {
    if (!this.isDragging) return;
    e.preventDefault();
    
    const x = e.pageX - this.container.offsetLeft;
    const walk = (x - this.startX) * 2; // Scroll speed multiplier
    this.container.scrollLeft = this.scrollLeftPos - walk;
  }

  /**
   * Handle mouse up
   */
  handleMouseUp() {
    if (this.isDragging) {
      // Snap to nearest card after dragging
      this.snapToNearestCard();
    }
    
    this.isDragging = false;
    this.container.style.cursor = 'grab';
    
    // Reset auto-scroll after mouse interaction
    setTimeout(() => {
      this.isUserInteracting = false;
      if (this.autoScroll) this.startAutoScroll();
    }, 1000);
  }

  /**
   * Scroll to the left
   */
  scrollLeft() {
    const itemWidth = this.getItemWidth();
    const gap = this.getGapValue();
    const itemWithGap = itemWidth + gap;
    const itemsToScroll = this.getCurrentItemsPerView();
    const scrollAmount = itemWithGap * itemsToScroll;
    
    this.container.scrollBy({
      left: -scrollAmount,
      behavior: 'smooth'
    });
    this.isUserInteracting = true;
    this.stopAutoScroll();
  }

  /**
   * Scroll to the right
   */
  scrollRight() {
    const itemWidth = this.getItemWidth();
    const gap = this.getGapValue();
    const itemWithGap = itemWidth + gap;
    const itemsToScroll = this.getCurrentItemsPerView();
    const scrollAmount = itemWithGap * itemsToScroll;
    
    this.container.scrollBy({
      left: scrollAmount,
      behavior: 'smooth'
    });
    this.isUserInteracting = true;
    this.stopAutoScroll();
  }

  /**
   * Scroll to start
   */
  scrollToStart() {
    this.container.scrollTo({
      left: 0,
      behavior: 'smooth'
    });
  }

  /**
   * Scroll to end
   */
  scrollToEnd() {
    this.container.scrollTo({
      left: this.container.scrollWidth,
      behavior: 'smooth'
    });
  }

  /**
   * Get scroll amount based on container width
   */
  getScrollAmount() {
    return this.container.clientWidth * 0.8; // Scroll 80% of container width
  }

  /**
   * Snap to the nearest card
   */
  snapToNearestCard() {
    const itemWidth = this.getItemWidth();
    const gap = this.getGapValue();
    const itemWithGap = itemWidth + gap;
    const currentScroll = this.container.scrollLeft;
    
    // Calculate which card we're closest to
    const currentCard = Math.round(currentScroll / itemWithGap);
    const targetScroll = currentCard * itemWithGap;
    
    // Smooth scroll to the target position
    this.container.scrollTo({
      left: targetScroll,
      behavior: 'smooth'
    });
  }

  /**
   * Get the width of a single item
   */
  getItemWidth() {
    const firstItem = this.container.firstElementChild;
    if (!firstItem) return 0;
    
    const itemsPerView = this.getCurrentItemsPerView();
    const gap = this.getGapValue();
    const containerWidth = this.container.clientWidth;
    
    // Calculate item width based on items per view and gap
    return (containerWidth - (gap * (itemsPerView - 1))) / itemsPerView;
  }

  /**
   * Get the current items per view based on screen size
   */
  getCurrentItemsPerView() {
    const width = window.innerWidth;
    if (width >= 990) {
      return this.itemsPerView.desktop || 4;
    } else if (width >= 750) {
      return this.itemsPerView.tablet || 2;
    } else {
      return this.itemsPerView.mobile || 1;
    }
  }

  /**
   * Get the gap value in pixels
   */
  getGapValue() {
    const gapString = this.gap || '1.5rem';
    
    // Convert rem to pixels (assuming 1rem = 16px)
    if (gapString.includes('rem')) {
      return parseFloat(gapString) * 16;
    } else if (gapString.includes('px')) {
      return parseFloat(gapString);
    } else {
      return parseFloat(gapString);
    }
  }

  /**
   * Update navigation button states
   */
  updateNavigationState() {
    const { scrollLeft, scrollWidth, clientWidth } = this.container;
    const isAtStart = scrollLeft <= 0;
    const isAtEnd = scrollLeft + clientWidth >= scrollWidth - 1;
    
    // Update internal navigation buttons
    if (this.showArrows) {
      if (this.prevBtn) {
        this.prevBtn.disabled = isAtStart;
        this.prevBtn.setAttribute('aria-hidden', isAtStart);
      }
      
      if (this.nextBtn) {
        this.nextBtn.disabled = isAtEnd;
        this.nextBtn.setAttribute('aria-hidden', isAtEnd);
      }
    }
    
    // Update external navigation buttons
    if (this.externalPrevBtn) {
      this.externalPrevBtn.disabled = isAtStart;
      this.externalPrevBtn.setAttribute('aria-hidden', isAtStart);
    }
    
    if (this.externalNextBtn) {
      this.externalNextBtn.disabled = isAtEnd;
      this.externalNextBtn.setAttribute('aria-hidden', isAtEnd);
    }
  }

  /**
   * Start auto-scroll
   */
  startAutoScroll() {
    if (!this.autoScroll || this.isUserInteracting) return;
    
    this.stopAutoScroll(); // Clear any existing interval
    
    this.autoScrollInterval = setInterval(() => {
      if (this.isUserInteracting) return;
      
      const { scrollLeft, scrollWidth, clientWidth } = this.container;
      const isAtEnd = scrollLeft + clientWidth >= scrollWidth - 1;
      
      if (isAtEnd) {
        // Reset to start
        this.scrollToStart();
      } else {
        // Scroll to next
        this.scrollRight();
      }
    }, this.scrollSpeed);
  }

  /**
   * Stop auto-scroll
   */
  stopAutoScroll() {
    if (this.autoScrollInterval) {
      clearInterval(this.autoScrollInterval);
      this.autoScrollInterval = null;
    }
  }

  /**
   * Cleanup component
   */
  cleanup() {
    this.stopAutoScroll();
    
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    
    window.removeEventListener('resize', this.handleResize);
    
    // Clean up timeouts
    clearTimeout(this.scrollTimeout);
  }



  // Getters for component attributes
  get itemsPerView() {
    const value = this.getAttribute('items-per-view');
    if (value) {
      try {
        return JSON.parse(value);
      } catch (e) {
        console.warn('Invalid items-per-view format, expected JSON object');
      }
    }
    return { desktop: 4, tablet: 2, mobile: 1 };
  }

  get gap() {
    return this.getAttribute('gap') || '1rem';
  }

  get showArrows() {
    return this.getAttribute('show-arrows') === 'true';
  }

  get autoScroll() {
    return this.getAttribute('auto-scroll') === 'true';
  }

  get scrollSpeed() {
    return parseInt(this.getAttribute('scroll-speed')) || 5000;
  }

  // Setters for dynamic updates
  set itemsPerView(value) {
    this.setAttribute('items-per-view', JSON.stringify(value));
    this.setupCustomProperties();
  }

  set gap(value) {
    this.setAttribute('gap', value);
    this.setupCustomProperties();
  }

  set showArrows(value) {
    this.setAttribute('show-arrows', value);
    if (value && !this.querySelector('.horizontal-scroll-carousel__navigation')) {
      this.createNavigation();
    } else if (!value && this.querySelector('.horizontal-scroll-carousel__navigation')) {
      this.querySelector('.horizontal-scroll-carousel__navigation').remove();
    }
  }

  set autoScroll(value) {
    this.setAttribute('auto-scroll', value);
    if (value) {
      this.startAutoScroll();
    } else {
      this.stopAutoScroll();
    }
  }

  set scrollSpeed(value) {
    this.setAttribute('scroll-speed', value);
    if (this.autoScroll) {
      this.stopAutoScroll();
      this.startAutoScroll();
    }
  }
}

// Register the custom element
if (!customElements.get('horizontal-scroll-carousel')) {
  customElements.define('horizontal-scroll-carousel', HorizontalScrollCarousel);
} 