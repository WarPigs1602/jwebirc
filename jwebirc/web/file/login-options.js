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
            hue: 0,
            hideTopic: false,
            hideNicklist: false,
            navLeft: false,
            notificationsEnabled: true,
            notificationSound: true
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
                // Extract all preferences
                if (parsed.fontSize !== undefined) {
                    this.uiPrefs.fontSize = parsed.fontSize;
                }
                if (parsed.hue !== undefined) {
                    this.uiPrefs.hue = parsed.hue;
                }
                if (parsed.hideTopic !== undefined) {
                    this.uiPrefs.hideTopic = parsed.hideTopic;
                }
                if (parsed.hideNicklist !== undefined) {
                    this.uiPrefs.hideNicklist = parsed.hideNicklist;
                }
                if (parsed.navLeft !== undefined) {
                    this.uiPrefs.navLeft = parsed.navLeft;
                }
                if (parsed.notificationsEnabled !== undefined) {
                    this.uiPrefs.notificationsEnabled = parsed.notificationsEnabled;
                }
                if (parsed.notificationSound !== undefined) {
                    this.uiPrefs.notificationSound = parsed.notificationSound;
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
     * - hideTopic: true/false
     * - hideNicklist: true/false
     * - navLeft: true/false
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
        
        // Boolean parameters
        if (params.has('hideTopic')) {
            this.uiPrefs.hideTopic = params.get('hideTopic') === 'true';
        }
        
        if (params.has('hideNicklist')) {
            this.uiPrefs.hideNicklist = params.get('hideNicklist') === 'true';
        }
        
        if (params.has('navLeft')) {
            this.uiPrefs.navLeft = params.get('navLeft') === 'true';
        }
        
        if (params.has('notificationsEnabled')) {
            this.uiPrefs.notificationsEnabled = params.get('notificationsEnabled') === 'true';
        }
        
        if (params.has('notificationSound')) {
            this.uiPrefs.notificationSound = params.get('notificationSound') === 'true';
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
        
        // Hide Topic toggle
        const hideTopicControl = document.getElementById('loginOptHideTopic');
        if (hideTopicControl) {
            hideTopicControl.addEventListener('change', (e) => {
                this.uiPrefs.hideTopic = e.target.checked;
                this.savePreferences();
            });
        }
        
        // Hide Nicklist toggle
        const hideNicklistControl = document.getElementById('loginOptHideNicklist');
        if (hideNicklistControl) {
            hideNicklistControl.addEventListener('change', (e) => {
                this.uiPrefs.hideNicklist = e.target.checked;
                this.savePreferences();
            });
        }
        
        // Sidebar Mode toggle
        const navLeftControl = document.getElementById('loginOptNavLeft');
        if (navLeftControl) {
            navLeftControl.addEventListener('change', (e) => {
                this.uiPrefs.navLeft = e.target.checked;
                this.savePreferences();
            });
        }
        
        // Browser Notifications toggle
        const notificationsControl = document.getElementById('loginOptNotifications');
        if (notificationsControl) {
            notificationsControl.addEventListener('change', (e) => {
                this.uiPrefs.notificationsEnabled = e.target.checked;
                this.savePreferences();
            });
        }
        
        // Notification Sound toggle
        const notificationSoundControl = document.getElementById('loginOptNotificationSound');
        if (notificationSoundControl) {
            notificationSoundControl.addEventListener('change', (e) => {
                this.uiPrefs.notificationSound = e.target.checked;
                this.savePreferences();
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
     * Rotates the primary color hue by adjusting CSS custom properties
     */
    applyHue() {
        const root = document.documentElement;
        
        // Apply hue-rotate filter to entire page (same as chat)
        root.style.setProperty('--hue-rotate', `${this.uiPrefs.hue}deg`);
    }
    
    /**
     * Apply all preferences to UI
     */
    applyPreferences() {
        // Update slider values
        const fontSizeControl = document.getElementById('loginOptFontSize');
        const hueControl = document.getElementById('loginOptHue');
        const hideTopicControl = document.getElementById('loginOptHideTopic');
        const hideNicklistControl = document.getElementById('loginOptHideNicklist');
        const navLeftControl = document.getElementById('loginOptNavLeft');
        const notificationsControl = document.getElementById('loginOptNotifications');
        const notificationSoundControl = document.getElementById('loginOptNotificationSound');
        
        if (fontSizeControl) {
            fontSizeControl.value = this.uiPrefs.fontSize;
            const fontSizeValue = document.getElementById('loginFontSizeValue');
            if (fontSizeValue) {
                fontSizeValue.textContent = `${this.uiPrefs.fontSize}px`;
            }
        }
        
        if (hueControl) {
            hueControl.value = this.uiPrefs.hue;
            const hueValue = document.getElementById('loginHueValue');
            if (hueValue) {
                hueValue.textContent = `${this.uiPrefs.hue}°`;
            }
        }
        
        if (hideTopicControl) {
            hideTopicControl.checked = this.uiPrefs.hideTopic;
        }
        
        if (hideNicklistControl) {
            hideNicklistControl.checked = this.uiPrefs.hideNicklist;
        }
        
        if (navLeftControl) {
            navLeftControl.checked = this.uiPrefs.navLeft;
        }
        
        if (notificationsControl) {
            notificationsControl.checked = this.uiPrefs.notificationsEnabled;
        }
        
        if (notificationSoundControl) {
            notificationSoundControl.checked = this.uiPrefs.notificationSound;
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
                hue: this.uiPrefs.hue,
                hideTopic: this.uiPrefs.hideTopic,
                hideNicklist: this.uiPrefs.hideNicklist,
                navLeft: this.uiPrefs.navLeft,
                notificationsEnabled: this.uiPrefs.notificationsEnabled,
                notificationSound: this.uiPrefs.notificationSound
            };
            
            // Merge with existing chat preferences
            if (existing) {
                try {
                    const parsed = JSON.parse(existing);
                    allPrefs = {
                        ...parsed,
                        fontSize: this.uiPrefs.fontSize,
                        hue: this.uiPrefs.hue,
                        hideTopic: this.uiPrefs.hideTopic,
                        hideNicklist: this.uiPrefs.hideNicklist,
                        navLeft: this.uiPrefs.navLeft,
                        notificationsEnabled: this.uiPrefs.notificationsEnabled,
                        notificationSound: this.uiPrefs.notificationSound
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
