/**
 * Theme Manager - Handles light/dark theme switching for the application
 */

export class ThemeManager {
  constructor() {
    this.currentTheme = this.getInitialTheme();
    this.listeners = [];
    this.applyTheme(this.currentTheme);
  }

  getInitialTheme() {
    // Check localStorage first
    const stored = localStorage.getItem('elevator-saga-theme');
    if (stored && (stored === 'light' || stored === 'dark')) {
      return stored;
    }

    // Fall back to system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    return 'light';
  }

  getCurrentTheme() {
    return this.currentTheme;
  }

  setTheme(theme) {
    if (theme !== 'light' && theme !== 'dark') {
      throw new Error('Theme must be "light" or "dark"');
    }

    this.currentTheme = theme;
    localStorage.setItem('elevator-saga-theme', theme);
    this.applyTheme(theme);
    this.notifyListeners(theme);
  }

  toggleTheme() {
    this.setTheme(this.currentTheme === 'light' ? 'dark' : 'light');
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  onThemeChange(callback) {
    this.listeners.push(callback);
    // Call immediately with current theme
    callback(this.currentTheme);
  }

  offThemeChange(callback) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  notifyListeners(theme) {
    this.listeners.forEach(callback => callback(theme));
  }

  // Listen to system theme changes
  watchSystemTheme() {
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', (e) => {
        // Only auto-switch if user hasn't manually set a preference
        if (!localStorage.getItem('elevator-saga-theme')) {
          this.setTheme(e.matches ? 'dark' : 'light');
        }
      });
    }
  }
}

// Create global theme manager instance
export const themeManager = new ThemeManager();
