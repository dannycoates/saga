/**
 * Responsive scaling utility for the innerworld area
 * Scales the game world to fit within available container space
 */
export class ResponsiveScaling {
  constructor() {
    this.innerWorld = null;
    this.worldContainer = null;
    this.resizeObserver = null;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this.isInitialized = false;
  }

  /**
   * Initialize responsive scaling
   */
  initialize() {
    this.innerWorld = document.querySelector(".innerworld");
    this.worldContainer = document.querySelector(".world-container");

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
   * Capture the natural (unscaled) dimensions of the innerworld
   */
  captureNaturalDimensions() {
    if (!this.innerWorld) return;

    // Temporarily remove any scaling to get natural dimensions
    const currentTransform = this.innerWorld.style.transform;
    this.innerWorld.style.transform = "none";

    // Get the dimensions including all content
    const rect = this.innerWorld.getBoundingClientRect();
    this.naturalWidth = Math.max(rect.width, this.innerWorld.scrollWidth);
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
   * Set up ResizeObserver to watch for container size changes
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
   * Update the scale of the innerworld based on container size
   */
  updateScale() {
    if (!this.innerWorld || !this.worldContainer || !this.isInitialized) return;

    // Re-capture natural dimensions if needed (for dynamic content)
    if (this.naturalWidth === 0 || this.naturalHeight === 0) {
      this.captureNaturalDimensions();
    }

    // Get available space (subtract stats container width and padding)
    const containerRect = this.worldContainer.getBoundingClientRect();
    const statsContainer = document.querySelector(".statscontainer");
    const statsWidth = statsContainer ? statsContainer.offsetWidth : 180;

    const availableWidth = containerRect.width - statsWidth - 2; // 2px for borders
    const availableHeight = containerRect.height;

    // Calculate scale factors for both dimensions
    const scaleX = availableWidth / this.naturalWidth;
    const scaleY = availableHeight / this.naturalHeight;

    // Use the smaller scale to ensure content fits in both dimensions
    const scale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 100%

    // Apply the scale
    this.innerWorld.style.transform = `scale(${scale})`;

    // Adjust the container height to match scaled content
    const scaledHeight = this.naturalHeight * scale;
    this.worldContainer.style.height = `${Math.max(scaledHeight, 150)}px`;
  }

  /**
   * Recalculate natural dimensions (call when content changes significantly)
   */
  recalculate() {
    if (!this.isInitialized) return;

    this.captureNaturalDimensions();
    this.updateScale();
  }

  /**
   * Clean up observers and listeners
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
