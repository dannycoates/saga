/**
 * @typedef {'light' | 'dark'} Theme
 */

/**
 * @callback ThemeChangeCallback
 * @param {Theme} theme - The new theme
 * @returns {void}
 */

/**
 * Manages light/dark theme switching for the application.
 * Persists theme preference to localStorage and watches system preferences.
 */
export class ThemeManager {
  /**
   * Creates a theme manager and applies the initial theme.
   */
  constructor() {
    /** @type {Theme} Current active theme */
    this.currentTheme = this.getInitialTheme();
    /** @type {ThemeChangeCallback[]} Registered theme change listeners */
    this.listeners = [];
    this.applyTheme(this.currentTheme);
  }

  /**
   * Determines the initial theme from localStorage or system preference.
   * @private
   * @returns {Theme} Initial theme to use
   */
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

  /**
   * Gets the current active theme.
   * @returns {Theme} Current theme
   */
  getCurrentTheme() {
    return this.currentTheme;
  }

  /**
   * Sets the theme to the specified value.
   * Persists to localStorage and notifies all listeners.
   * @param {Theme} theme - Theme to set
   * @throws {Error} If theme is not 'light' or 'dark'
   * @returns {void}
   */
  setTheme(theme) {
    if (theme !== 'light' && theme !== 'dark') {
      throw new Error('Theme must be "light" or "dark"');
    }

    this.currentTheme = theme;
    localStorage.setItem('elevator-saga-theme', theme);
    this.applyTheme(theme);
    this.notifyListeners(theme);
  }

  /**
   * Toggles between light and dark themes.
   * @returns {void}
   */
  toggleTheme() {
    this.setTheme(this.currentTheme === 'light' ? 'dark' : 'light');
  }

  /**
   * Applies the theme to the document element.
   * @private
   * @param {Theme} theme - Theme to apply
   * @returns {void}
   */
  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  /**
   * Registers a callback for theme changes.
   * Callback is immediately invoked with the current theme.
   * @param {ThemeChangeCallback} callback - Function to call on theme change
   * @returns {void}
   */
  onThemeChange(callback) {
    this.listeners.push(callback);
    // Call immediately with current theme
    callback(this.currentTheme);
  }

  /**
   * Unregisters a theme change callback.
   * @param {ThemeChangeCallback} callback - Callback to remove
   * @returns {void}
   */
  offThemeChange(callback) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  /**
   * Notifies all registered listeners of a theme change.
   * @private
   * @param {Theme} theme - New theme value
   * @returns {void}
   */
  notifyListeners(theme) {
    this.listeners.forEach(callback => callback(theme));
  }

  /**
   * Starts watching for system theme preference changes.
   * Only auto-switches if user hasn't manually set a preference.
   * @returns {void}
   */
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

/**
 * Global theme manager singleton instance.
 * @type {ThemeManager}
 */
export const themeManager = new ThemeManager();
