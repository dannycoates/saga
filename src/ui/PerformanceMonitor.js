/**
 * Performance Monitor - Uses modern Performance Observer API to track metrics
 */

export class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.observers = [];
    this.setupObservers();
  }

  setupObservers() {
    if (!('PerformanceObserver' in window)) {
      console.warn('PerformanceObserver not supported');
      return;
    }

    // Monitor layout shifts and paint timing
    try {
      const layoutObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'layout-shift') {
            this.recordMetric('layoutShift', entry.value);
          }
        }
      });
      layoutObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(layoutObserver);
    } catch (e) {
      // Layout shift might not be supported
    }

    // Monitor long tasks that block the main thread
    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) { // Tasks longer than 50ms
            this.recordMetric('longTask', {
              duration: entry.duration,
              startTime: entry.startTime
            });
          }
        }
      });
      longTaskObserver.observe({ entryTypes: ['longtask'] });
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
      paintObserver.observe({ entryTypes: ['paint'] });
      this.observers.push(paintObserver);
    } catch (e) {
      // Paint timing might not be supported
    }
  }

  recordMetric(name, value) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name).push({
      value,
      timestamp: performance.now()
    });

    // Keep only last 100 entries to prevent memory leaks
    const entries = this.metrics.get(name);
    if (entries.length > 100) {
      entries.splice(0, entries.length - 100);
    }
  }

  getMetrics(name) {
    return this.metrics.get(name) || [];
  }

  getAllMetrics() {
    const result = {};
    for (const [name, values] of this.metrics) {
      result[name] = values;
    }
    return result;
  }

  // Get performance summary
  getSummary() {
    const summary = {};
    
    for (const [name, values] of this.metrics) {
      if (values.length === 0) continue;
      
      const numericValues = values.map(v => 
        typeof v.value === 'number' ? v.value : v.value.duration || 0
      );
      
      summary[name] = {
        count: values.length,
        average: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
        max: Math.max(...numericValues),
        min: Math.min(...numericValues),
        latest: values[values.length - 1]
      };
    }
    
    return summary;
  }

  // Mark custom performance events
  mark(name) {
    performance.mark(name);
    this.recordMetric(`mark-${name}`, performance.now());
  }

  // Measure between two marks
  measure(name, startMark, endMark) {
    try {
      performance.measure(name, startMark, endMark);
      const measure = performance.getEntriesByName(name, 'measure')[0];
      if (measure) {
        this.recordMetric(`measure-${name}`, measure.duration);
      }
    } catch (e) {
      console.warn('Performance measure failed:', e);
    }
  }

  cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.metrics.clear();
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();