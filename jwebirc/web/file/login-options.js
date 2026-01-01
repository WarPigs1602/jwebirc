/**
 * jwebirc 2.0 - Login Page Options Manager
 * Handles UI preferences on login page (font size, hue)
 * Settings are stored in localStorage and can be accessed via URL parameters
 * @author Andreas Pschorn
 * @license MIT
 */

class LoginOptionsManager {
    constructor() {
        this.uiPrefs = {
            fontSize: 14,
            hue: 0
        };
        this.optionsMenu = null;
        this.optionsToggle = null;
    }
    
    /**
     * Initialize login options
     * - Load preferences from localStorage
     * - Apply URL parameters if provided
     * - Setup event listeners
     */
    initialize() {
        // Load stored preferences
        this.loadPreferences();
        
        // Apply URL parameters (external sites can pass settings)
        this.applyUrlParameters();
        
        // Get DOM elements
        this.optionsMenu = document.getElementById("loginOptionsMenu");
        this.optionsToggle = document.getElementById("loginOptionsToggle");
        
        if (!this.optionsMenu || !this.optionsToggle) {
            console.warn('Login options elements not found');
            return;
        }
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Apply preferences to UI
        this.applyPreferences();
    }
    
    /**
     * Load preferences from localStorage
     * Uses same key as chat (jwebirc_ui) for consistency
     */
    loadPreferences() {
        try {
            // Try to load from shared chat key first
            let stored = localStorage.getItem('jwebirc_ui');
            if (stored) {
                const parsed = JSON.parse(stored);
                // Extract only fontSize and hue
                if (parsed.fontSize !== undefined) {
                    this.uiPrefs.fontSize = parsed.fontSize;
                }
                if (parsed.hue !== undefined) {
                    this.uiPrefs.hue = parsed.hue;
                }
            }
        } catch (e) {
            console.warn('Could not load login preferences:', e);
        }
    }
    
    /**
     * Apply URL parameters to override preferences
     * Supported parameters:
     * - fontSize: 12-18 (pixels)
     * - hue: 0-360 (degrees)
     */
    applyUrlParameters() {
        const params = new URLSearchParams(window.location.search);
        
        // fontSize parameter
        if (params.has('fontSize')) {
            const size = parseInt(params.get('fontSize'), 10);
            if (!isNaN(size) && size >= 12 && size <= 18) {
                this.uiPrefs.fontSize = size;
            }
        }
        
        // hue parameter
        if (params.has('hue')) {
            const hueVal = parseInt(params.get('hue'), 10);
            if (!isNaN(hueVal) && hueVal >= 0 && hueVal <= 360) {
                this.uiPrefs.hue = hueVal;
            }
        }
    }
    
    /**
     * Setup event listeners for options controls
     */
    setupEventListeners() {
        // Toggle menu visibility
        this.optionsToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMenu();
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.optionsMenu.contains(e.target) && e.target !== this.optionsToggle && !this.optionsToggle.contains(e.target)) {
                this.optionsMenu.classList.remove('show');
                this.optionsToggle.setAttribute('aria-expanded', 'false');
            }
        });
        
        // Font size slider
        const fontSizeControl = document.getElementById('loginOptFontSize');
        if (fontSizeControl) {
            fontSizeControl.addEventListener('input', (e) => {
                const size = parseInt(e.target.value, 10);
                this.uiPrefs.fontSize = size;
                this.savePreferences();
                this.applyFontSize();
                document.getElementById('loginFontSizeValue').textContent = `${size}px`;
            });
        }
        
        // Hue slider
        const hueControl = document.getElementById('loginOptHue');
        if (hueControl) {
            hueControl.addEventListener('input', (e) => {
                const hue = parseInt(e.target.value, 10);
                this.uiPrefs.hue = hue;
                this.savePreferences();
                this.applyHue();
                document.getElementById('loginHueValue').textContent = `${hue}°`;
            });
        }
    }
    
    /**
     * Toggle menu visibility
     */
    toggleMenu() {
        this.optionsMenu.classList.toggle('show');
        const isVisible = this.optionsMenu.classList.contains('show');
        this.optionsToggle.setAttribute('aria-expanded', isVisible ? 'true' : 'false');
    }
    
    /**
     * Apply font size to login page
     */
    applyFontSize() {
        const root = document.documentElement;
        root.style.setProperty('--login-font-size', `${this.uiPrefs.fontSize}px`);
        
        // Apply to body as well for fallback
        document.body.style.fontSize = `${this.uiPrefs.fontSize}px`;
    }
    
    /**
     * Apply hue to login page
     * Rotates the primary color hue
     */
    applyHue() {
        const root = document.documentElement;
        const hueRotate = `hsl(${this.uiPrefs.hue}, 100%, 50%)`;
        root.style.setProperty('--login-hue-rotate', this.uiPrefs.hue);
        
        // Apply filter to specific elements if needed
        const loginContainer = document.querySelector('.login-container');
        if (loginContainer) {
            loginContainer.style.filter = `hue-rotate(${this.uiPrefs.hue}deg)`;
        }
    }
    
    /**
     * Apply all preferences to UI
     */
    applyPreferences() {
        // Update slider values
        const fontSizeControl = document.getElementById('loginOptFontSize');
        const hueControl = document.getElementById('loginOptHue');
        
        if (fontSizeControl) {
            fontSizeControl.value = this.uiPrefs.fontSize;
            document.getElementById('loginFontSizeValue').textContent = `${this.uiPrefs.fontSize}px`;
        }
        
        if (hueControl) {
            hueControl.value = this.uiPrefs.hue;
            document.getElementById('loginHueValue').textContent = `${this.uiPrefs.hue}°`;
        }
        
        // Apply styles
        this.applyFontSize();
        this.applyHue();
    }
    
    /**
     * Save preferences to localStorage
     * Uses same key as chat (jwebirc_ui) for consistency
     * Merges with existing chat preferences
     */
    savePreferences() {
        try {
            // Get existing chat preferences if any
            const existing = localStorage.getItem('jwebirc_ui');
            let allPrefs = {
                fontSize: this.uiPrefs.fontSize,
                hue: this.uiPrefs.hue
            };
            
            // Merge with existing chat preferences
            if (existing) {
                try {
                    const parsed = JSON.parse(existing);
                    allPrefs = {
                        ...parsed,
                        fontSize: this.uiPrefs.fontSize,
                        hue: this.uiPrefs.hue
                    };
                } catch (e) {
                    // If parse fails, just use our values
                }
            }
            
            localStorage.setItem('jwebirc_ui', JSON.stringify(allPrefs));
        } catch (e) {
            console.warn('Could not save login preferences:', e);
        }
    }
    
    /**
     * Get shareable link with current preferences
     * @returns {string} URL with preferences as parameters
     */
    getShareableLink() {
        const baseUrl = window.location.origin + window.location.pathname;
        const params = new URLSearchParams();
        params.append('fontSize', this.uiPrefs.fontSize);
        params.append('hue', this.uiPrefs.hue);
        return baseUrl + '?' + params.toString();
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    const loginOptionsManager = new LoginOptionsManager();
    loginOptionsManager.initialize();
});
