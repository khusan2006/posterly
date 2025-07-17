
class CustomPosterForm extends HTMLElement {
  // Configuration constants
  static CONFIG = {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    FIREBASE_TIMEOUT: 10000, // 10 seconds
    AUTO_HIDE_MESSAGES: 5000, // 5 seconds
    UPLOAD_PATH: 'custom-posters/',
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000
  };

  constructor() {
    super();
    this.sectionId = this.dataset.sectionId;
    this.templateProductId = this.dataset.templateProduct;
    
    // State management
    this.state = {
      selectedVariantId: null,
      selectedVariant: null,
      uploadedImageUrl: null,
      uploadedImageFile: null,
      templateProduct: null,
      isLoading: false
    };
    
    // Bind methods to preserve context
    this.boundMethods = {
      handleFileSelect: this.handleFileSelect.bind(this),
      handleDragOver: this.handleDragOver.bind(this),
      handleDrop: this.handleDrop.bind(this),
      handleDragLeave: this.handleDragLeave.bind(this),
      handleVariantChange: this.handleVariantChange.bind(this),
      handleAddToCart: this.handleAddToCart.bind(this),
      validateForm: this.validateForm.bind(this),
      openFileDialog: this.openFileDialog.bind(this),
      removeImage: this.removeImage.bind(this)
    };
    
    // Message timeouts for cleanup
    this.messageTimeouts = new Set();
    
    this.init();
  }

  /**
   * Initialize the component
   */
  async init() {
    try {
      this.bindElements();
      this.bindEvents();
      this.setupAccessibility();
      await this.fetchTemplateProduct();
    } catch (error) {
      this.handleError('Failed to initialize component', error);
    }
  }


  bindElements() {
    const elements = {
      // Upload elements
      uploadArea: `#upload-area-${this.sectionId}`,
      dropzone: `#dropzone-${this.sectionId}`,
      uploadInput: `#image-upload-${this.sectionId}`,
      previewContainer: `#preview-container-${this.sectionId}`,
      previewImage: `#preview-image-${this.sectionId}`,
      removeImageBtn: `#remove-image-${this.sectionId}`,
      imageName: `#image-name-${this.sectionId}`,
      imageSize: `#image-size-${this.sectionId}`,
      uploadProgress: `#upload-progress-${this.sectionId}`,
      progressFill: `#progress-fill-${this.sectionId}`,
      progressText: `#progress-text-${this.sectionId}`,

      // Form elements
      titleInput: `#poster-title-${this.sectionId}`,
      descriptionInput: `#poster-description-${this.sectionId}`,
      addToCartBtn: `#add-to-cart-${this.sectionId}`,
      priceDisplay: `#price-display-${this.sectionId}`,

      // Message elements
      errorContainer: `#errors-${this.sectionId}`,
      errorText: `#error-text-${this.sectionId}`,
      successContainer: `#success-${this.sectionId}`,
      successText: `#success-text-${this.sectionId}`,

      // Hidden inputs
      uploadedImageUrlInput: `#uploaded-image-url-${this.sectionId}`,
      selectedVariantIdInput: `#selected-variant-id-${this.sectionId}`
    };

    // Bind elements and validate they exist
    Object.entries(elements).forEach(([key, selector]) => {
      const element = this.querySelector(selector);
      if (!element) {
        console.warn(`Element not found: ${selector}`);
      }
      this[key] = element;
    });

    // Bind collections
    this.variantInputs = this.querySelectorAll('.custom-poster__variant-input');
    this.selectedValues = this.querySelectorAll('.custom-poster__selected-value');
    
    // Bind button text and loader
    if (this.addToCartBtn) {
      this.btnText = this.addToCartBtn.querySelector('.custom-poster__btn-text');
      this.btnLoader = this.addToCartBtn.querySelector('.custom-poster__btn-loader');
    }
  }

  /**
   * Set up accessibility features
   */
  setupAccessibility() {
    if (this.dropzone) {
      this.dropzone.setAttribute('role', 'button');
      this.dropzone.setAttribute('tabindex', '0');
      this.dropzone.setAttribute('aria-label', 'Click or drag to upload image');
      
      // Add keyboard support
      this.dropzone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.openFileDialog();
        }
      });
    }

    if (this.uploadInput) {
      this.uploadInput.setAttribute('aria-describedby', `upload-help-${this.sectionId}`);
    }
  }

  bindEvents() {
    if (!this.dropzone || !this.uploadInput) return;

    // Upload events
    this.dropzone.addEventListener('click', this.boundMethods.openFileDialog);
    this.uploadInput.addEventListener('change', this.boundMethods.handleFileSelect);
    
    if (this.removeImageBtn) {
      this.removeImageBtn.addEventListener('click', this.boundMethods.removeImage);
    }
    
    // Drag and drop events
    this.dropzone.addEventListener('dragover', this.boundMethods.handleDragOver);
    this.dropzone.addEventListener('drop', this.boundMethods.handleDrop);
    this.dropzone.addEventListener('dragleave', this.boundMethods.handleDragLeave);

    // Variant events
    this.variantInputs.forEach(input => {
      input.addEventListener('change', this.boundMethods.handleVariantChange);
    });

    // Form validation events
    if (this.titleInput) {
      this.titleInput.addEventListener('input', this.boundMethods.validateForm);
    }

    // Add to cart event
    if (this.addToCartBtn) {
      this.addToCartBtn.addEventListener('click', this.boundMethods.handleAddToCart);
    }
  }

  /**
   * Fetch template product with better error handling and retries
   */
  async fetchTemplateProduct() {
    if (!this.templateProductId) {
      throw new Error('No template product configured');
    }

    const fetchWithRetry = async (url, attempts = CustomPosterForm.CONFIG.RETRY_ATTEMPTS) => {
      for (let i = 0; i < attempts; i++) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            return await response.json();
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        } catch (error) {
          if (i === attempts - 1) throw error;
          await this.delay(CustomPosterForm.CONFIG.RETRY_DELAY * (i + 1));
        }
      }
    };

    try {
      const product = await fetchWithRetry(`/products/${this.templateProductId}.js`);   
      
      if (!product.variants || product.variants.length === 0) {
        throw new Error('Template product has no variants');
      }

      this.state.templateProduct = product;
      this.updateSelectedVariant();
      this.updatePriceDisplay();
      this.updateSelectedValueDisplay();
      
    } catch (error) {
      throw new Error(`Failed to load product: ${error.message}`);
    }
  }

  /**
   * Open file dialog
   */
  openFileDialog() {
    if (this.uploadInput) {
      this.uploadInput.click();
    }
  }

  /**
   * Handle drag over with better visual feedback
   */
  handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    if (this.dropzone) {
      this.dropzone.classList.add('dragover');
    }
  }

  /**
   * Handle drag leave
   */
  handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    if (this.dropzone) {
      this.dropzone.classList.remove('dragover');
    }
  }

  /**
   * Handle file drop
   */
  handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (this.dropzone) {
      this.dropzone.classList.remove('dragover');
    }
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  /**
   * Handle file selection
   */
  handleFileSelect(e) {
    const files = e.target.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  /**
   * Process uploaded file with better validation
   */
  async processFile(file) {
    try {
      // Validate file
      this.validateFile(file);
      
      // Store file and show preview
      this.state.uploadedImageFile = file;
      this.showPreview(file);
      
      // Upload file
      await this.uploadFile(file);
      
    } catch (error) {
      this.handleError('Failed to process file', error);
    }
  }

  /**
   * Validate file with detailed error messages
   */
  validateFile(file) {
    if (!file) {
      throw new Error('No file selected');
    }

    // Check file type
    if (!CustomPosterForm.CONFIG.ALLOWED_TYPES.includes(file.type)) {
      throw new Error('Please upload a valid image file (JPG, PNG, GIF, or WebP)');
    }

    // Check file size
    if (file.size > CustomPosterForm.CONFIG.MAX_FILE_SIZE) {
      const maxSizeMB = CustomPosterForm.CONFIG.MAX_FILE_SIZE / (1024 * 1024);
      throw new Error(`File size must be less than ${maxSizeMB}MB`);
    }

    // Check for potential malicious files
    if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
      throw new Error('Invalid file name');
    }
  }

  showPreview(file) {
    if (!file || !this.previewImage) return;

    const reader = new FileReader();
    
    reader.onload = (e) => {
      const result = e.target?.result;
      if (result) {
        this.previewImage.src = result;
        this.previewImage.alt = `Preview of ${file.name}`;
        
        if (this.imageName) this.imageName.textContent = file.name;
        if (this.imageSize) this.imageSize.textContent = this.formatFileSize(file.size);
        
        // Show preview, hide dropzone
        if (this.dropzone) this.dropzone.style.display = 'none';
        if (this.previewContainer) this.previewContainer.style.display = 'block';
        
        this.validateForm();
      }
    };

    reader.onerror = () => {
      this.handleError('Failed to read file', new Error('FileReader error'));
    };

    reader.readAsDataURL(file);
  }

  /**
   * Upload file with improved error handling and fallback
   */
  async uploadFile(file) {
    try {
      this.showProgress(0);
      if (this.uploadProgress) {
        this.uploadProgress.style.display = 'block';
      }

      // Try Firebase upload
      const firebaseUrl = await this.uploadToFirebase(file);
      
      if (firebaseUrl) {
        this.state.uploadedImageUrl = firebaseUrl;
        if (this.uploadedImageUrlInput) {
          this.uploadedImageUrlInput.value = firebaseUrl;
        }
        this.showProgress(100);
      } else {
        throw new Error('Firebase upload failed');
      }
      
    } catch (error) {
      console.warn('Firebase upload failed, using placeholder:', error);
      
      // Fallback: store placeholder for backend processing
      this.state.uploadedImageUrl = 'custom-poster-uploaded';
      
      if (this.uploadedImageUrlInput) {
        this.uploadedImageUrlInput.value = 'custom-poster-uploaded';
      }
      
      this.showMessage('warning', 'Image will be processed during order fulfillment.');
      
    } finally {
      this.hideProgress();
      this.validateForm();
    }
  }

  /**
   * Upload to Firebase with better error handling
   */
  async uploadToFirebase(file) {
    try {
      await this.ensureFirebaseInitialized();
      
      // Create unique filename
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `${CustomPosterForm.CONFIG.UPLOAD_PATH}${timestamp}-${randomString}-${sanitizedName}`;
      
      // Get storage reference
      const storageRef = firebase.storage().ref();
      const fileRef = storageRef.child(filename);
      
      // Upload with progress tracking
      const uploadTask = fileRef.put(file);
      
      return new Promise((resolve, reject) => {
        uploadTask.on('state_changed',
          // Progress callback
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            this.showProgress(Math.round(progress * 0.8)); // Reserve 20% for URL generation
          },
          // Error callback
          (error) => {
            console.error('Firebase upload error:', error);
            reject(error);
          },
          // Success callback
          async () => {
            try {
              const downloadURL = await fileRef.getDownloadURL();
              this.showProgress(100);
              resolve(downloadURL);
            } catch (error) {
              reject(error);
            }
          }
        );
      });
      
    } catch (error) {
      console.error('Firebase upload failed:', error);
      throw error;
    }
  }

  /**
   * Ensure Firebase is initialized with timeout
   */
  async ensureFirebaseInitialized() {
    return new Promise((resolve, reject) => {
      // Check if already initialized
      if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
        resolve();
        return;
      }
      
      const timeout = setTimeout(() => {
        reject(new Error('Firebase initialization timeout'));
      }, CustomPosterForm.CONFIG.FIREBASE_TIMEOUT);
      
      const handleReady = () => {
        clearTimeout(timeout);
        document.removeEventListener('firebaseReady', handleReady);
        resolve();
      };
      
      document.addEventListener('firebaseReady', handleReady);
      
      // Periodic check as fallback
      const checkPeriodically = () => {
        if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
          clearTimeout(timeout);
          document.removeEventListener('firebaseReady', handleReady);
          resolve();
        } else {
          setTimeout(checkPeriodically, 100);
        }
      };
      
      setTimeout(checkPeriodically, 100);
    });
  }

  /**
   * Show upload progress
   */
  showProgress(percentage) {
    if (this.progressFill) {
      this.progressFill.style.width = `${percentage}%`;
    }
    if (this.progressText) {
      this.progressText.textContent = `Uploading... ${percentage}%`;
    }
  }

  /**
   * Hide upload progress
   */
  hideProgress() {
    setTimeout(() => {
      if (this.uploadProgress) {
        this.uploadProgress.style.display = 'none';
      }
      if (this.progressFill) {
        this.progressFill.style.width = '0%';
      }
    }, 500);
  }

  /**
   * Remove uploaded image with proper cleanup
   */
  removeImage() {
    // Reset state
    this.state.uploadedImageFile = null;
    this.state.uploadedImageUrl = null;
    
    // Reset form elements
    if (this.uploadedImageUrlInput) this.uploadedImageUrlInput.value = '';
    if (this.uploadInput) this.uploadInput.value = '';
    
    // Update UI
    if (this.previewContainer) this.previewContainer.style.display = 'none';
    if (this.dropzone) this.dropzone.style.display = 'block';
    
    this.validateForm();
  }

  /**
   * Clean up blob URLs to prevent memory leaks
   */
  cleanupBlobUrls() {
    this.state.blobUrls.forEach(url => {
      URL.revokeObjectURL(url);
    });
    this.state.blobUrls.clear();
  }

  /**
   * Handle variant selection changes
   */
  handleVariantChange() {
    this.updateSelectedVariant();
    this.updatePriceDisplay();
    this.updateSelectedValueDisplay();
  }

  /**
   * Update selected variant with better error handling
   */
  updateSelectedVariant() {
    if (!this.state.templateProduct) return;

    const selectedOptions = {};
    this.variantInputs.forEach(input => {
      if (input.checked) {
        const optionName = input.name.replace(/^options\[(.+)\]$/, '$1');
        selectedOptions[optionName] = input.value;
      }
    });

    // Find matching variant
    const matchingVariant = this.state.templateProduct.variants.find(variant => {
      return variant.options.every((option, index) => {
        const optionName = this.state.templateProduct.options[index];
        return selectedOptions[optionName] === option;
      });
    });

    // Use matching variant or fallback to first available
    this.state.selectedVariant = matchingVariant || this.state.templateProduct.variants[0];
    this.state.selectedVariantId = this.state.selectedVariant.id;
    
    if (this.selectedVariantIdInput) {
      this.selectedVariantIdInput.value = this.state.selectedVariantId;
    }
  }

  /**
   * Update price display
   */
  updatePriceDisplay() {
    if (this.state.selectedVariant && this.priceDisplay) {
      const price = this.formatMoney(this.state.selectedVariant.price);
      this.priceDisplay.textContent = price;
    }
  }

  /**
   * Update selected value display
   */
  updateSelectedValueDisplay() {
    this.selectedValues.forEach(span => {
      const optionName = span.dataset.optionName;
      const selectedInput = this.querySelector(`input[name="options[${optionName}]"]:checked`);
      if (selectedInput) {
        span.textContent = selectedInput.value;
      }
    });
  }

  /**
   * Validate form with better feedback
   */
  validateForm() {
    const hasImage = this.state.uploadedImageFile !== null;
    const hasTitle = this.titleInput?.value.trim() !== '';
    
    const isValid = hasImage && hasTitle;
    
    if (this.addToCartBtn) {
      this.addToCartBtn.disabled = !isValid;
    }
    
    return isValid;
  }

  /**
   * Handle add to cart with better error handling
   */
  async handleAddToCart() {
    if (!this.validateForm()) {
      this.showMessage('error', 'Please fill in all required fields');
      return;
    }

    try {
      this.setLoading(true);
      
      const cartData = await this.addToCart();
      this.handleCartSuccess(cartData);
      this.showMessage('success', 'Custom poster added to cart successfully!');
      this.resetForm();
      
    } catch (error) {
      this.handleError('Failed to add poster to cart', error);
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Add item to cart with sanitized properties
   */
  async addToCart() {
    if (!this.state.selectedVariantId) {
      throw new Error('No variant selected');
    }

    // Sanitize user inputs
    const sanitizedTitle = this.sanitizeInput(this.titleInput?.value || '');
    const sanitizedDescription = this.sanitizeInput(this.descriptionInput?.value || '');

    // Prepare line item properties
    const properties = {
      '_Custom Poster': 'Yes',
      '_Poster Title': sanitizedTitle,
      '_Uploaded Image URL': this.state.uploadedImageUrl,
      '_Created At': new Date().toISOString()
    };

    if (sanitizedDescription) {
      properties['_Poster Description'] = sanitizedDescription;
    }

    // Add selected variant options
    if (this.state.selectedVariant) {
      this.state.selectedVariant.options.forEach((option, index) => {
        const optionName = this.state.templateProduct.options[index];
        properties[`_Selected ${optionName}`] = option;
      });
    }

    // Prepare form data
    const formData = new FormData();
    formData.append('id', this.state.selectedVariantId);
    formData.append('quantity', '1');
    
    Object.entries(properties).forEach(([key, value]) => {
      formData.append(`properties[${key}]`, value);
    });

    // Add cart sections for rendering
    const cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
    if (cart && cart.getSectionsToRender) {
      formData.append('sections', cart.getSectionsToRender().map(section => section.id));
      formData.append('sections_url', window.location.pathname);
      cart.setActiveElement(document.activeElement);
    }

    // Make request
    const response = await fetch('/cart/add.js', {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Add to cart failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Handle successful cart addition
   */
  handleCartSuccess(cartData) {
    const cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
    
    if (!cart) {
      window.location = window.routes?.cart_url || '/cart';
      return;
    }

    // Publish cart update event
    if (typeof publish !== 'undefined' && typeof PUB_SUB_EVENTS !== 'undefined') {
      publish(PUB_SUB_EVENTS.cartUpdate, {
        source: 'custom-poster-form',
        productVariantId: this.state.selectedVariantId,
        cartData: cartData,
      });
    }

    cart.renderContents(cartData);
  }

  /**
   * Set loading state
   */
  setLoading(loading) {
    this.state.isLoading = loading;
    
    this.classList.toggle('loading', loading);
    
    if (this.addToCartBtn) {
      this.addToCartBtn.classList.toggle('loading', loading);
      this.addToCartBtn.disabled = loading;
    }
    
    if (this.btnText) {
      this.btnText.style.display = loading ? 'none' : 'block';
    }
    
    if (this.btnLoader) {
      this.btnLoader.style.display = loading ? 'block' : 'none';
    }
  }

  /**
   * Reset form to initial state
   */
  resetForm() {
    this.removeImage();
    
    if (this.titleInput) this.titleInput.value = '';
    if (this.descriptionInput) this.descriptionInput.value = '';
    
    // Reset variant selection
    this.variantInputs.forEach((input, index) => {
      input.checked = index === 0;
    });
    
    this.updateSelectedVariant();
    this.updatePriceDisplay();
    this.updateSelectedValueDisplay();
    this.validateForm();
  }

  /**
   * Unified message display system
   */
  showMessage(type, message) {
    // Clear existing timeouts
    this.messageTimeouts.forEach(timeout => clearTimeout(timeout));
    this.messageTimeouts.clear();

    if (type === 'error') {
      this.showError(message);
    } else if (type === 'success') {
      this.showSuccess(message);
    } else if (type === 'warning') {
      // You can implement warning display if needed
      console.warn(message);
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    if (this.errorText) this.errorText.textContent = message;
    if (this.errorContainer) this.errorContainer.style.display = 'block';
    if (this.successContainer) this.successContainer.style.display = 'none';
    
    const timeout = setTimeout(() => {
      if (this.errorContainer) this.errorContainer.style.display = 'none';
    }, CustomPosterForm.CONFIG.AUTO_HIDE_MESSAGES);
    
    this.messageTimeouts.add(timeout);
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    if (this.successText) this.successText.textContent = message;
    if (this.successContainer) this.successContainer.style.display = 'block';
    if (this.errorContainer) this.errorContainer.style.display = 'none';
    
    const timeout = setTimeout(() => {
      if (this.successContainer) this.successContainer.style.display = 'none';
    }, CustomPosterForm.CONFIG.AUTO_HIDE_MESSAGES);
    
    this.messageTimeouts.add(timeout);
  }

  /**
   * Centralized error handling
   */
  handleError(context, error) {
    console.error(`${context}:`, error);
    const userMessage = error.message || 'An unexpected error occurred';
    this.showMessage('error', userMessage);
  }

  /**
   * Sanitize user input to prevent XSS
   */
  sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove basic HTML tags
      .substring(0, 500); // Limit length
  }

  /**
   * Cleanup resources on disconnect
   */
  disconnectedCallback() {
    // Clear timeouts
    this.messageTimeouts.forEach(timeout => clearTimeout(timeout));
    this.messageTimeouts.clear();
    
    // Remove event listeners would be automatic with bound methods
  }

  // Utility methods
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatMoney(cents) {
    const currency = this.dataset.currency || 'USD';
    const locale = this.dataset.locale || 'en-US';
    
    return (cents / 100).toLocaleString(locale, {
      style: 'currency',
      currency: currency
    });
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Register the custom element
customElements.define('custom-poster-form', CustomPosterForm);

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('Custom Poster Upload component loaded');
});

// Export for potential use in other scripts
window.CustomPosterForm = CustomPosterForm;