/**
 * Custom Poster Upload Component
 * Handles image upload, variant selection, and cart integration using line item properties
 * 
 * This component stores all custom poster data as cart line item properties, which is
 * the recommended approach for product customization in Shopify. The data includes:
 * - Uploaded image URL
 * - Poster title and description
 * - Selected variant options
 * - Creation timestamp
 * 
 * All data is automatically included in orders for fulfillment processing.
 */
class CustomPosterForm extends HTMLElement {
  constructor() {
    super();
    this.sectionId = this.dataset.sectionId;
    this.templateProductId = this.dataset.templateProduct;
    this.selectedVariantId = null;
    this.selectedVariant = null;
    this.uploadedImageUrl = null;
    this.uploadedImageFile = null;
    this.templateProduct = null;
    
    this.init();
  }

  init() {
    this.bindElements();
    this.bindEvents();
    this.fetchTemplateProduct();
  }

  bindElements() {
    // Upload elements
    this.uploadArea = this.querySelector(`#upload-area-${this.sectionId}`);
    this.dropzone = this.querySelector(`#dropzone-${this.sectionId}`);
    this.uploadInput = this.querySelector(`#image-upload-${this.sectionId}`);
    this.previewContainer = this.querySelector(`#preview-container-${this.sectionId}`);
    this.previewImage = this.querySelector(`#preview-image-${this.sectionId}`);
    this.removeImageBtn = this.querySelector(`#remove-image-${this.sectionId}`);
    this.imageName = this.querySelector(`#image-name-${this.sectionId}`);
    this.imageSize = this.querySelector(`#image-size-${this.sectionId}`);
    this.uploadProgress = this.querySelector(`#upload-progress-${this.sectionId}`);
    this.progressFill = this.querySelector(`#progress-fill-${this.sectionId}`);
    this.progressText = this.querySelector(`#progress-text-${this.sectionId}`);

    // Variant elements
    this.variantInputs = this.querySelectorAll('.custom-poster__variant-input');
    this.selectedValues = this.querySelectorAll('.custom-poster__selected-value');
    this.priceDisplay = this.querySelector(`#price-display-${this.sectionId}`);

    // Form elements
    this.titleInput = this.querySelector(`#poster-title-${this.sectionId}`);
    this.descriptionInput = this.querySelector(`#poster-description-${this.sectionId}`);
    this.addToCartBtn = this.querySelector(`#add-to-cart-${this.sectionId}`);
    this.btnText = this.addToCartBtn.querySelector('.custom-poster__btn-text');
    this.btnLoader = this.addToCartBtn.querySelector('.custom-poster__btn-loader');

    // Message elements
    this.errorContainer = this.querySelector(`#errors-${this.sectionId}`);
    this.errorText = this.querySelector(`#error-text-${this.sectionId}`);
    this.successContainer = this.querySelector(`#success-${this.sectionId}`);
    this.successText = this.querySelector(`#success-text-${this.sectionId}`);

    // Hidden inputs
    this.uploadedImageUrlInput = this.querySelector(`#uploaded-image-url-${this.sectionId}`);
    this.selectedVariantIdInput = this.querySelector(`#selected-variant-id-${this.sectionId}`);
  }

  bindEvents() {
    // Upload events
    this.dropzone.addEventListener('click', () => this.uploadInput.click());
    this.uploadInput.addEventListener('change', (e) => this.handleFileSelect(e));
    this.removeImageBtn.addEventListener('click', () => this.removeImage());
    
    // Drag and drop events
    this.dropzone.addEventListener('dragover', (e) => this.handleDragOver(e));
    this.dropzone.addEventListener('drop', (e) => this.handleDrop(e));
    this.dropzone.addEventListener('dragleave', () => this.handleDragLeave());

    // Variant events
    this.variantInputs.forEach(input => {
      input.addEventListener('change', () => this.handleVariantChange());
    });

    // Form validation events
    this.titleInput.addEventListener('input', () => this.validateForm());
    this.uploadInput.addEventListener('change', () => this.validateForm());

    // Add to cart event
    this.addToCartBtn.addEventListener('click', () => this.handleAddToCart());
  }

  async fetchTemplateProduct() {
    // Ensure we have a template product    
    if (!this.templateProductId) {
      this.showError('No template product configured');
      return;
    }

    try {
      // Try to fetch by handle first (more reliable), then by ID
      let response = await fetch(`/products/${this.templateProductId}.js`);
      
      if (!response.ok) {
        // If handle fails, try numeric ID
        response = await fetch(`/products/${this.templateProductId}.js`);
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch product: ${response.status} ${response.statusText}`);
      }
      
      this.templateProduct = await response.json();
      
      // Ensure we have variants
      if (!this.templateProduct.variants || this.templateProduct.variants.length === 0) {
        throw new Error('Template product has no variants');
      }      
      
      this.updateSelectedVariant();
      this.updatePriceDisplay();
      this.updateSelectedValueDisplay();
      
    } catch (error) {
      this.showError('Failed to load product information. Please check the template product configuration.');
    }
  }

  handleDragOver(e) {
    e.preventDefault();
    this.dropzone.classList.add('dragover');
  }

  handleDragLeave() {
    this.dropzone.classList.remove('dragover');
  }

  handleDrop(e) {
    e.preventDefault();
    this.dropzone.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      this.processFile(files[0]);
    }
  }

  handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
      this.processFile(files[0]);
    }
  }

  processFile(file) {
    // Validate file
    if (!this.validateFile(file)) {
      return;
    }

    this.uploadedImageFile = file;
    this.showPreview(file);
    this.uploadFile(file);
  }

  validateFile(file) {
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.showError('Please upload a valid image file (JPG, PNG, GIF, or WebP)');
      return false;
    }

    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      this.showError('File size must be less than 10MB');
      return false;
    }

    return true;
  }

  showPreview(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.previewImage.src = e.target.result;
      this.imageName.textContent = file.name;
      this.imageSize.textContent = this.formatFileSize(file.size);
      
      this.dropzone.style.display = 'none';
      this.previewContainer.style.display = 'block';
      this.validateForm();
    };
    reader.readAsDataURL(file);
  }

  async uploadFile(file) {
    try {
      this.showProgress(0);
      this.uploadProgress.style.display = 'block';
      

      await this.uploadToFirebase(file);
      
    } catch (error) {
      this.showError('Failed to upload image. Please try again.');
      this.hideProgress();
    }
  }

  
  // Upload to Firebase Storage
  async uploadToFirebase(file) {
    try {
      // Wait for Firebase to be initialized
      await this.ensureFirebaseInitialized();
      
      // Create a unique filename
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const filename = `custom-posters/${timestamp}-${randomString}-${file.name}`;
      
      // Get storage reference
      const storageRef = firebase.storage().ref();
      const fileRef = storageRef.child(filename);
      
      // Upload file with progress tracking
      const uploadTask = fileRef.put(file);
      
      // Track upload progress
      const progressHandler = (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        this.showProgress(Math.round(progress * 0.8)); // Reserve 20% for getting URL
      };
      
      uploadTask.on('state_changed', progressHandler);
      
      // Wait for upload to complete
      await uploadTask;
      
      // Get download URL
      const downloadURL = await fileRef.getDownloadURL();
      
      return downloadURL;
      
    } catch (error) {
      console.error('Firebase upload error:', error);
      throw error;
    }
  }

  // Ensure Firebase is initialized before using it
  async ensureFirebaseInitialized() {
    return new Promise((resolve, reject) => {
      // Check if Firebase is already initialized
      if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
        console.log('Firebase is ready');
        resolve();
        return;
      }
      
      // Set up timeout
      const timeout = setTimeout(() => {
        reject(new Error('Firebase failed to initialize within 10 seconds'));
      }, 10000);
      
      // Listen for Firebase ready event
      const handleFirebaseReady = () => {
        clearTimeout(timeout);
        document.removeEventListener('firebaseReady', handleFirebaseReady);
        console.log('Firebase is ready');
        resolve();
      };
      
      document.addEventListener('firebaseReady', handleFirebaseReady);
      
      // Also check periodically in case the event was missed
      const checkFirebase = () => {
        if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
          clearTimeout(timeout);
          document.removeEventListener('firebaseReady', handleFirebaseReady);
          console.log('Firebase is ready (periodic check)');
          resolve();
        } else {
          setTimeout(checkFirebase, 100);
        }
      };
      
      setTimeout(checkFirebase, 100);
    });
  }
  
  // Upload to permanent storage (Firebase)
  async uploadToFirebase(file) {
    try {
      // Show progress
      this.showProgress(10);
      
      // Upload to Firebase Storage
      const firebaseUrl = await this.uploadToFirebase(file);
      
      this.showProgress(90);
      
      // Store the permanent URL
      this.uploadedImageUrl = firebaseUrl;
      this.uploadedImageUrlInput.value = firebaseUrl;
      
      this.showProgress(100);
      this.hideProgress();
      this.validateForm();
      
    } catch (error) {
      console.error('Upload failed:', error);
      
      // Fallback: Create temporary preview and store placeholder
      this.uploadedImageFile = file;
      this.uploadedImageUrl = URL.createObjectURL(file);
      this.uploadedImageUrlInput.value = 'custom-poster-uploaded';
      
      this.hideProgress();
      this.validateForm();
      
      // Show warning to user
      this.showError('Image upload failed. Using temporary preview. Please contact support if this persists.');
    }
  }
  
  // Helper method to create data URL (works but not ideal for large images)
  createDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  showProgress(percentage) {
    this.progressFill.style.width = `${percentage}%`;
    this.progressText.textContent = `Uploading... ${percentage}%`;
  }

  hideProgress() {
    setTimeout(() => {
      this.uploadProgress.style.display = 'none';
      this.progressFill.style.width = '0%';
    }, 500);
  }

  removeImage() {
    this.uploadedImageFile = null;
    this.uploadedImageUrl = null;
    this.uploadedImageUrlInput.value = '';
    this.uploadInput.value = '';
    
    this.previewContainer.style.display = 'none';
    this.dropzone.style.display = 'block';
    this.validateForm();
  }

  handleVariantChange() {
    this.updateSelectedVariant();
    this.updatePriceDisplay();
    this.updateSelectedValueDisplay();
  }

  updateSelectedVariant() {
    if (!this.templateProduct) {
      return;
    }

    const selectedOptions = {};
    this.variantInputs.forEach(input => {
      if (input.checked) {
        const optionName = input.name.replace('options[', '').replace(']', '');
        selectedOptions[optionName] = input.value;
      }
    });

    // Find matching variant
    this.selectedVariant = this.templateProduct.variants.find(variant => {
      const isMatch = variant.options.every((option, index) => {
        const optionName = this.templateProduct.options[index];
        const matches = selectedOptions[optionName] === option;
        return matches;
      });
      return isMatch;
    });


    if (this.selectedVariant) {
      this.selectedVariantId = this.selectedVariant.id;
      this.selectedVariantIdInput.value = this.selectedVariantId;
    } else {
      // Use first available variant as fallback
      this.selectedVariant = this.templateProduct.variants[0];
      this.selectedVariantId = this.selectedVariant.id;
      this.selectedVariantIdInput.value = this.selectedVariantId;
      console.log('Using fallback variant ID:', this.selectedVariantId);
    }
  }

  updatePriceDisplay() {
    if (this.selectedVariant) {
      const price = this.formatMoney(this.selectedVariant.price);
      this.priceDisplay.textContent = price;
    }
  }

  updateSelectedValueDisplay() {
    this.selectedValues.forEach(span => {
      const optionName = span.dataset.optionName;
      const selectedInput = this.querySelector(`input[name="options[${optionName}]"]:checked`);
      if (selectedInput) {
        span.textContent = selectedInput.value;
      }
    });
  }

  validateForm() {
    const hasImage = this.uploadedImageFile !== null;
    const hasTitle = this.titleInput.value.trim() !== '';
    
    const isValid = hasImage && hasTitle;
    this.addToCartBtn.disabled = !isValid;
    
    return isValid;
  }

  async handleAddToCart() {
    if (!this.validateForm()) {
      this.showError('Please fill in all required fields');
      return;
    }

    try {
      this.setLoading(true);
      
      // Add to cart with custom poster data as line item properties
      const cartData = await this.addToCart();
      
      this.handleCartSuccess(cartData);
      
      this.showSuccess('Custom poster added to cart successfully!');
      this.resetForm();
      
    } catch (error) {
      this.showError('Failed to add poster to cart. Please try again.');
    } finally {
      this.setLoading(false);
    }
  }

  handleCartSuccess(cartData) {
    // Find cart notification or cart drawer (same logic as product-form.js)
    const cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
    
    if (!cart) {
      // If no cart notification/drawer, redirect to cart page
      window.location = window.routes.cart_url;
      return;
    }

    // Publish cart update event (same as product-form.js)
    if (typeof publish !== 'undefined' && typeof PUB_SUB_EVENTS !== 'undefined') {
      publish(PUB_SUB_EVENTS.cartUpdate, {
        source: 'custom-poster-form',
        productVariantId: this.selectedVariantId,
        cartData: cartData,
      });
    }

    // Render cart contents to show notification
    cart.renderContents(cartData);
  }


  async addToCart() {
    // Prepare line item properties with all custom poster data
    const properties = {
      '_Custom Poster': 'Yes',
      '_Poster Title': this.titleInput.value,
      '_Uploaded Image URL': this.uploadedImageUrl,
      '_Created At': new Date().toISOString()
    };

    // Add description if provided
    if (this.descriptionInput.value.trim()) {
      properties['_Poster Description'] = this.descriptionInput.value;
    }

    // Add selected variant options for reference
    if (this.selectedVariant) {
      this.selectedVariant.options.forEach((option, index) => {
        const optionName = this.templateProduct.options[index];
        properties[`_Selected ${optionName}`] = option;
      });
    }

    // Ensure we have a valid variant ID
    if (!this.selectedVariantId) {
      throw new Error('No variant selected. Please select product options.');
    }

    console.log('Adding to cart with variant ID:', this.selectedVariantId);
    console.log('Properties:', properties);

    // Find cart notification or cart drawer to get sections to render
    const cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
    
    // Use FormData like product-form.js does
    const formData = new FormData();
    formData.append('id', this.selectedVariantId);
    formData.append('quantity', '1');
    
    // Add properties to form data
    Object.keys(properties).forEach(key => {
      formData.append(`properties[${key}]`, properties[key]);
    });

    // Add sections for cart notification/drawer rendering (like product-form.js)
    if (cart && cart.getSectionsToRender) {
      formData.append('sections', cart.getSectionsToRender().map(section => section.id));
      formData.append('sections_url', window.location.pathname);
      cart.setActiveElement(document.activeElement);
    }

    const response = await fetch('/cart/add.js', {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Cart add error:', errorData);
      throw new Error(`Failed to add to cart: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  setLoading(loading) {
    this.classList.toggle('loading', loading);
    this.addToCartBtn.classList.toggle('loading', loading);
    this.addToCartBtn.disabled = loading;
    this.btnText.style.display = loading ? 'none' : 'block';
    this.btnLoader.style.display = loading ? 'block' : 'none';
  }

  resetForm() {
    this.removeImage();
    this.titleInput.value = '';
    this.descriptionInput.value = '';
    
    // Reset variant selection to first option
    this.variantInputs.forEach((input, index) => {
      input.checked = index === 0;
    });
    
    this.updateSelectedVariant();
    this.updatePriceDisplay();
    this.updateSelectedValueDisplay();
    this.validateForm();
  }

  showError(message) {
    this.errorText.textContent = message;
    this.errorContainer.style.display = 'block';
    this.successContainer.style.display = 'none';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.errorContainer.style.display = 'none';
    }, 5000);
  }

  showSuccess(message) {
    this.successText.textContent = message;
    this.successContainer.style.display = 'block';
    this.errorContainer.style.display = 'none';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.successContainer.style.display = 'none';
    }, 5000);
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
    return (cents / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD'
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
  // Additional initialization if needed
  console.log('Custom Poster Upload component loaded');
});

// Export for potential use in other scripts
window.CustomPosterForm = CustomPosterForm;
