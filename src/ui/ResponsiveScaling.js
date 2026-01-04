/**
 * Responsive scaling utility for the innerworld area.
 * Scales the game world to fit within available container space.
 */
export class ResponsiveScaling {
  /**
   * Creates a responsive scaling manager.
   */
  constructor() {
    /** @type {HTMLElement | null} Inner world element */
    this.innerWorld = null;
    /** @type {HTMLElement | null} World container element */
    this.worldContainer = null;
    /** @type {ResizeObserver | null} Resize observer */
    this.resizeObserver = null;
    /** @type {number} Natural (unscaled) width */
    this.naturalWidth = 0;
    /** @type {number} Natural (unscaled) height */
    this.naturalHeight = 0;
    /** @type {boolean} Whether scaling is initialized */
    this.isInitialized = false;
  }

  /**
   * Initialize responsive scaling.
   * @returns {void}
   */
  initialize() {
    this.innerWorld = /** @type {HTMLElement | null} */ (
      document.querySelector(".innerworld")
    );
    this.worldContainer = /** @type {HTMLElement | null} */ (
      document.querySelector(".world-container")
    );

    if (!this.innerWorld || !this.worldContainer) {
      console.warn("ResponsiveScaling: Required DOM elements not found");
      return;
    }

    // Wait for initial rendering to capture natural dimensions
    requestAnimationFrame(() => {
      this.captureNaturalDimensions();
      this.setupResizeObserver();
      this.updateScale();
      this.isInitialized = true;
    });
  }

  /**
   * Captures the natural (unscaled) dimensions of the innerworld.
   * Temporarily removes scaling to measure true dimensions.
   * @private
   * @returns {void}
   */
  captureNaturalDimensions() {
    if (!this.innerWorld) return;

    // Temporarily remove any scaling to get natural dimensions
    const currentTransform = this.innerWorld.style.transform;
    this.innerWorld.style.transform = "none";

    // Get the dimensions including all content
    const rect = this.innerWorld.getBoundingClientRect();
    this.naturalWidth = parseInt(this.innerWorld.style.minWidth, 10);
    this.naturalHeight = Math.max(rect.height, this.innerWorld.scrollHeight);

    // If no natural dimensions yet (content not loaded), use defaults
    if (this.naturalWidth === 0 || this.naturalHeight === 0) {
      this.naturalWidth = 800; // Reasonable default
      this.naturalHeight = 400; // Reasonable default
    }

    // Restore previous transform
    this.innerWorld.style.transform = currentTransform;
  }

  /**
   * Sets up ResizeObserver to watch for container size changes.
   * Falls back to window resize events for older browsers.
   * @private
   * @returns {void}
   */
  setupResizeObserver() {
    if (typeof ResizeObserver === "undefined") {
      // Fallback to window resize events for older browsers
      window.addEventListener("resize", () => this.updateScale(), {
        passive: true,
      });
      return;
    }

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === this.worldContainer) {
          this.updateScale();
          break;
        }
      }
    });

    this.resizeObserver.observe(this.worldContainer);
  }

  /**
   * Updates the scale of the innerworld based on container size.
   * Calculates optimal scale factor and applies CSS transform.
   * @private
   * @returns {void}
   */
  updateScale() {
    if (!this.innerWorld || !this.worldContainer || !this.isInitialized) return;

    // Re-capture natural dimensions if needed (for dynamic content)
    if (this.naturalWidth === 0 || this.naturalHeight === 0) {
      this.captureNaturalDimensions();
    }

    // Get available space (subtract stats container width and padding)
    const containerRect = this.worldContainer.getBoundingClientRect();
    // const statsContainer = document.querySelector(".statscontainer");
    // const statsWidth = statsContainer ? statsContainer.offsetWidth : 180;

    const availableWidth = containerRect.width; // - statsWidth - 2; // 2px for borders
    const availableHeight = containerRect.height;

    // Calculate scale factors for both dimensions
    const scaleX = availableWidth / this.naturalWidth;
    const scaleY = availableHeight / this.naturalHeight;

    // Use the smaller scale to ensure content fits in both dimensions
    const scale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 100%

    // Apply the scale
    this.innerWorld.style.transform = `scale(${scale})`;

    // Only adjust container height if not in a flex layout
    // Check if world-container is part of a flex layout (main-content)
    const mainContent = this.worldContainer.closest(".main-content");
    const isFlexLayout =
      mainContent && window.getComputedStyle(mainContent).display === "flex";

    if (!isFlexLayout) {
      // Adjust the container height to match scaled content for non-flex layouts
      const scaledHeight = this.naturalHeight * scale;
      this.worldContainer.style.height = `${Math.max(scaledHeight, 150)}px`;
    } else {
      // Remove any explicit height in flex layouts to let flex handle sizing
      this.worldContainer.style.height = "";
    }
  }

  /**
   * Recalculates natural dimensions and updates scale.
   * Call when content changes significantly (e.g., new challenge loaded).
   * @returns {void}
   */
  recalculate() {
    if (!this.isInitialized) return;

    this.captureNaturalDimensions();
    this.updateScale();
  }

  /**
   * Cleans up observers and listeners.
   * Disconnects ResizeObserver and resets transform styles.
   * @returns {void}
   */
  cleanup() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.innerWorld) {
      this.innerWorld.style.transform = "";
    }

    this.isInitialized = false;
  }
}
