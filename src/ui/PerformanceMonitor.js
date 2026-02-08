/**
 * @typedef {Object} MetricEntry
 * @property {number | {duration: number, startTime: number}} value - Metric value
 * @property {number} timestamp - Recording timestamp
 */

/**
 * @typedef {Object} MetricSummary
 * @property {number} count - Number of entries
 * @property {number} average - Average value
 * @property {number} max - Maximum value
 * @property {number} min - Minimum value
 * @property {MetricEntry} latest - Most recent entry
 */

/**
 * Performance monitor using modern Performance Observer API.
 * Tracks layout shifts, long tasks, and paint timing.
 */
export class PerformanceMonitor {
  /**
   * Creates a performance monitor and sets up observers.
   */
  constructor() {
    /** @type {Map<string, MetricEntry[]>} Recorded metrics by name */
    this.metrics = new Map();
    /** @type {PerformanceObserver[]} Active observers */
    this.observers = [];
    this.setupObservers();
  }

  /**
   * Sets up performance observers for various metric types.
   * @private
   * @returns {void}
   */
  setupObservers() {
    if (!("PerformanceObserver" in window)) {
      console.warn("PerformanceObserver not supported");
      return;
    }

    // Monitor layout shifts and paint timing
    try {
      const layoutObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === "layout-shift") {
            // @ts-ignore - LayoutShift entries have a value property
            this.recordMetric("layoutShift", entry.value);
          }
        }
      });
      layoutObserver.observe({ entryTypes: ["layout-shift"] });
      this.observers.push(layoutObserver);
    } catch (e) {
      // Layout shift might not be supported
    }

    // Monitor long tasks that block the main thread
    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            // Tasks longer than 50ms
            this.recordMetric("longTask", {
              duration: entry.duration,
              startTime: entry.startTime,
            });
          }
        }
      });
      longTaskObserver.observe({ entryTypes: ["longtask"] });
      this.observers.push(longTaskObserver);
    } catch (e) {
      // Long task might not be supported
    }

    // Monitor paint timing
    try {
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric(entry.name, entry.startTime);
        }
      });
      paintObserver.observe({ entryTypes: ["paint"] });
      this.observers.push(paintObserver);
    } catch (e) {
      // Paint timing might not be supported
    }
  }

  /**
   * Records a metric value with timestamp.
   * Keeps only last 100 entries per metric.
   * @param {string} name - Metric name
   * @param {number | {duration: number, startTime: number}} value - Metric value
   * @returns {void}
   */
  recordMetric(name, value) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    const entries = /** @type {MetricEntry[]} */ (this.metrics.get(name));
    entries.push({
      value,
      timestamp: performance.now(),
    });

    // Keep only last 100 entries to prevent memory leaks
    if (entries.length > 100) {
      entries.splice(0, entries.length - 100);
    }
  }

  /**
   * Gets all entries for a specific metric.
   * @param {string} name - Metric name
   * @returns {MetricEntry[]} Metric entries
   */
  getMetrics(name) {
    return this.metrics.get(name) || [];
  }

  /**
   * Gets all recorded metrics.
   * @returns {Record<string, MetricEntry[]>} All metrics by name
   */
  getAllMetrics() {
    /** @type {Record<string, MetricEntry[]>} */
    const result = {};
    for (const [name, values] of this.metrics) {
      result[name] = values;
    }
    return result;
  }

  /**
   * Gets summary statistics for all metrics.
   * @returns {Record<string, MetricSummary>} Summary by metric name
   */
  getSummary() {
    /** @type {Record<string, MetricSummary>} */
    const summary = {};

    for (const [name, values] of this.metrics) {
      if (values.length === 0) continue;

      const numericValues = values.map((v) =>
        typeof v.value === "number" ? v.value : v.value.duration || 0,
      );

      summary[name] = {
        count: values.length,
        average:
          numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
        max: Math.max(...numericValues),
        min: Math.min(...numericValues),
        latest: values[values.length - 1],
      };
    }

    return summary;
  }

  /**
   * Marks a custom performance event.
   * @param {string} name - Mark name
   * @returns {void}
   */
  mark(name) {
    performance.mark(name);
    this.recordMetric(`mark-${name}`, performance.now());
  }

  /**
   * Measures duration between two marks.
   * @param {string} name - Measure name
   * @param {string} startMark - Start mark name
   * @param {string} endMark - End mark name
   * @returns {void}
   */
  measure(name, startMark, endMark) {
    try {
      performance.measure(name, startMark, endMark);
      const measure = performance.getEntriesByName(name, "measure")[0];
      if (measure) {
        this.recordMetric(`measure-${name}`, measure.duration);
      }
    } catch (e) {
      console.warn("Performance measure failed:", e);
    }
  }

  /**
   * Cleans up observers and clears metrics.
   * @returns {void}
   */
  cleanup() {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
    this.metrics.clear();
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();
