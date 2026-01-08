/**
 * jWebIRC - Template System Manager
 * Version: 1.0
 * Created: 07.01.2026
 * Author: Andreas Pschorn
 * Description: Client-side template management and switching
 */

(function() {
    'use strict';

    const translate = (key, fallback, replacements) => {
        if (typeof window.jwebircTranslate === 'function') {
            const translated = window.jwebircTranslate(key, replacements);
            if (translated && translated !== key) return translated;
        }
        if (replacements && fallback) {
            return Object.keys(replacements).reduce((acc, rKey) => acc.replace(`{${rKey}}`, replacements[rKey]), fallback);
        }
        return fallback || key;
    };
    
    // Template System Configuration
    const TemplateSystem = {
        // Current template
        currentTemplate: null,
        
        // Available templates
        availableTemplates: [],
        
        // Template enabled flag
        enabled: false,
        
        // User can select templates
        userSelectable: false,
        
        /**
         * Initialize the template system
         */
        init: function() {
            // Get configuration from session/DOM
            this.loadConfiguration();
            
            // Set up template switcher UI if user-selectable
            if (this.userSelectable && this.enabled) {
                this.setupTemplateSwitcher();
            }
            
            // Apply current template
            this.applyTemplate(this.currentTemplate);
            
            console.log('[TemplateSystem] Initialized:', {
                enabled: this.enabled,
                currentTemplate: this.currentTemplate,
                availableTemplates: this.availableTemplates,
                userSelectable: this.userSelectable
            });
        },
        
        /**
         * Load configuration from DOM/session
         */
        loadConfiguration: function() {
            // Check if configuration was provided by server
            if (window.templateSystemConfig) {
                this.enabled = window.templateSystemConfig.enabled === true;
                this.userSelectable = window.templateSystemConfig.userSelectable === true;
                this.currentTemplate = window.templateSystemConfig.current || 'dark-theme';
                this.availableTemplates = window.templateSystemConfig.available || ['dark-theme', 'light-theme'];
            } else {
                // Fallback: Try to get template info from link tag
                const templateLink = document.querySelector('link[data-template="custom"]');
                if (templateLink) {
                    this.enabled = true;
                    const href = templateLink.getAttribute('href');
                    const match = href.match(/templates\/([^\/]+)\//);
                    if (match) {
                        this.currentTemplate = match[1];
                    }
                }
                
                // Check cookies for fallback configuration
                const cookies = document.cookie.split(';');
                for (let cookie of cookies) {
                    const [name, value] = cookie.trim().split('=');
                    if (name === 'jwebirc_template') {
                        this.currentTemplate = value;
                    }
                    if (name === 'jwebirc_template_enabled') {
                        this.enabled = value === 'true';
                    }
                    if (name === 'jwebirc_template_selectable') {
                        this.userSelectable = value === 'true';
                    }
                    if (name === 'jwebirc_templates_available') {
                        this.availableTemplates = decodeURIComponent(value).split(',');
                    }
                }
                
                // Final fallback to defaults
                if (!this.currentTemplate) {
                    this.currentTemplate = 'dark-theme';
                }
                if (this.availableTemplates.length === 0) {
                    this.availableTemplates = ['dark-theme', 'light-theme'];
                }
            }
        },
        
        /**
         * Apply a template
         * @param {string} templateName - Template identifier
         */
        applyTemplate: function(templateName) {
            if (!templateName || !this.enabled) return;
            
            // Check if template exists in available templates
            if (!this.availableTemplates.includes(templateName)) {
                console.warn('[TemplateSystem] Template not available:', templateName);
                return;
            }
            
            // Find existing template link
            let templateLink = document.querySelector('link[data-template="custom"]');
            
            if (templateLink) {
                // Update existing link
                templateLink.href = `templates/${templateName}/style.css`;
            } else {
                // Create new link
                templateLink = document.createElement('link');
                templateLink.rel = 'stylesheet';
                templateLink.type = 'text/css';
                templateLink.href = `templates/${templateName}/style.css`;
                templateLink.setAttribute('data-template', 'custom');
                
                // Insert after main style.css
                const mainStyle = document.querySelector('link[href*="style.css"]');
                if (mainStyle) {
                    mainStyle.parentNode.insertBefore(templateLink, mainStyle.nextSibling);
                } else {
                    document.head.appendChild(templateLink);
                }
            }
            
            this.currentTemplate = templateName;
            
            // Save to cookie
            this.saveTemplateCookie(templateName);
            
            // Update UI if exists
            this.updateSwitcherUI();
            
            // Dispatch custom event
            document.dispatchEvent(new CustomEvent('templateChanged', {
                detail: { template: templateName }
            }));
            
            console.log('[TemplateSystem] Applied template:', templateName);
        },
        
        /**
         * Switch to a different template
         * @param {string} templateName - Template identifier
         */
        switchTemplate: function(templateName) {
            if (!this.userSelectable || !this.enabled) {
                console.warn('[TemplateSystem] Template switching is disabled');
                return;
            }
            
            // Call server endpoint to switch template
            fetch('switch-template.jsp?template=' + encodeURIComponent(templateName), {
                method: 'GET',
                credentials: 'same-origin'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Apply template locally
                    this.applyTemplate(templateName);
                    
                    // Show notification
                    this.showNotification(translate('template.switched', 'Theme switched to: {theme}', { theme: this.getTemplateDisplayName(templateName) }));
                } else {
                    console.error('[TemplateSystem] Failed to switch template:', data.error);
                    this.showNotification(translate('template.error', 'Error: {error}', { error: data.error }));
                }
            })
            .catch(error => {
                console.error('[TemplateSystem] Error switching template:', error);
                // Try to apply locally anyway
                this.applyTemplate(templateName);
            });
        },
        
        /**
         * Save template preference to cookie
         * @param {string} templateName - Template identifier
         */
        saveTemplateCookie: function(templateName) {
            // Cookie expires in 365 days
            const expires = new Date();
            expires.setTime(expires.getTime() + (365 * 24 * 60 * 60 * 1000));
            document.cookie = `jwebirc_template=${templateName}; expires=${expires.toUTCString()}; path=/`;
        },
        
        /**
         * Get human-readable template name
         * @param {string} templateId - Template identifier
         * @returns {string} Display name
         */
        getTemplateDisplayName: function(templateId) {
            if (!templateId) return translate('template.default', 'Default');
            
            return templateId
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        },
        
        /**
         * Set up template switcher UI
         */
        setupTemplateSwitcher: function() {
            // Check for both login and chat options menus
            const loginSelector = document.getElementById('loginTemplateSelector');
            const chatOptionsMenu = document.getElementById('navOptionsMenu');
            
            // Set up for login page
            if (loginSelector) {
                this.populateTemplateSelector(loginSelector);
            }
            
            // Set up for chat page
            if (chatOptionsMenu && !document.getElementById('templateSelector')) {
                const templateSection = document.createElement('div');
                templateSection.className = 'nav-dropdown-item slider-item';
                const label = translate('template.theme', 'Theme');
                templateSection.innerHTML = `
                    <div class="nav-dropdown-item-header">
                        <i class="fas fa-palette"></i>
                        <span data-i18n="template.theme">${label}</span>
                    </div>
                    <div class="template-selector" id="templateSelector">
                    </div>
                `;
                
                // Insert at the end of dropdown content
                const content = chatOptionsMenu.querySelector('.nav-dropdown-content');
                if (content) {
                    content.appendChild(templateSection);
                    const selector = document.getElementById('templateSelector');
                    if (selector) {
                        this.populateTemplateSelector(selector);
                    }
                }
            }
        },
        
        /**
         * Populate template selector with available templates
         * @param {HTMLElement} container - Container element for template buttons
         */
        populateTemplateSelector: function(container) {
            if (!container) return;
            
            container.innerHTML = this.availableTemplates.map(template => `
                <button class="template-option ${template === this.currentTemplate ? 'active' : ''}" 
                        data-template="${template}">
                    <i class="fas fa-check"></i>
                    ${this.getTemplateDisplayName(template)}
                </button>
            `).join('');
            
            // Add event listeners
            container.addEventListener('click', (e) => {
                const button = e.target.closest('.template-option');
                if (button) {
                    const templateName = button.getAttribute('data-template');
                    this.switchTemplate(templateName);
                }
            });
        },
        
        /**
         * Update template switcher UI
         */
        updateSwitcherUI: function() {
            // Update all template option buttons on the page
            const buttons = document.querySelectorAll('.template-option');
            buttons.forEach(button => {
                const templateName = button.getAttribute('data-template');
                if (templateName === this.currentTemplate) {
                    button.classList.add('active');
                } else {
                    button.classList.remove('active');
                }
            });
        },
        
        /**
         * Show notification
         * @param {string} message - Notification message
         */
        showNotification: function(message) {
            // Create notification element
            const notification = document.createElement('div');
            notification.className = 'template-notification';
            notification.textContent = message;
            notification.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: var(--background-modal, #2d2d3d);
                color: var(--text-primary, #ffffff);
                padding: 12px 24px;
                border-radius: var(--border-radius, 6px);
                box-shadow: var(--shadow-lg, 0 10px 30px rgba(0, 0, 0, 0.5));
                z-index: 10000;
                animation: slideUp 0.3s ease;
            `;
            
            document.body.appendChild(notification);
            
            // Remove after 3 seconds
            setTimeout(() => {
                notification.style.animation = 'slideDown 0.3s ease';
                setTimeout(() => {
                    document.body.removeChild(notification);
                }, 300);
            }, 3000);
        }
    };
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => TemplateSystem.init());
    } else {
        TemplateSystem.init();
    }
    
    // Export to global scope for external access
    window.TemplateSystem = TemplateSystem;
    
})();

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideUp {
        from {
            transform: translateX(-50%) translateY(100px);
            opacity: 0;
        }
        to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
    }
    
    @keyframes slideDown {
        from {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
        to {
            transform: translateX(-50%) translateY(100px);
            opacity: 0;
        }
    }
    
    .template-selector {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 8px;
    }
    
    .template-option {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: var(--background-tertiary, #404050);
        border: 1px solid var(--border-color, #505060);
        border-radius: var(--border-radius-sm, 4px);
        color: var(--text-primary, #ffffff);
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 14px;
    }
    
    .template-option:hover {
        background: var(--background-hover, #4a4a5a);
        border-color: var(--primary-color, #5865f2);
    }
    
    .template-option.active {
        background: var(--primary-color, #5865f2);
        border-color: var(--primary-color, #5865f2);
    }
    
    .template-option .fa-check {
        opacity: 0;
        transition: opacity 0.2s ease;
    }
    
    .template-option.active .fa-check {
        opacity: 1;
    }
`;
document.head.appendChild(style);
