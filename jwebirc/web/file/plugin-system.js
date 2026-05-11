/**
 * jWebIRC - Plugin System Manager
 * Loads plugin registrations independently from templates and core UI code.
 */

(function() {
    'use strict';

    function createDispatcher(pluginId) {
        return function(eventName, detail) {
            document.dispatchEvent(new CustomEvent(eventName, {
                detail: Object.assign({ pluginId: pluginId }, detail || {})
            }));
        };
    }

    const PluginSystem = {
        initialized: false,
        enabled: false,
        page: 'chat',
        configuredPlugins: [],
        registry: {},
        started: {},

        init: function() {
            if (this.initialized) {
                return;
            }

            const config = window.pluginSystemConfig || {};
            this.enabled = config.enabled === true;
            this.page = config.page || document.body.getAttribute('data-page') || 'chat';
            this.configuredPlugins = Array.isArray(config.plugins) ? config.plugins.slice() : [];
            this.initialized = true;

            document.dispatchEvent(new CustomEvent('jwebirc:plugins:config', {
                detail: {
                    enabled: this.enabled,
                    page: this.page,
                    plugins: this.configuredPlugins.slice()
                }
            }));

            if (!this.enabled) {
                return;
            }

            for (const pluginMeta of this.configuredPlugins) {
                if (pluginMeta && pluginMeta.id && this.registry[pluginMeta.id]) {
                    this.startPlugin(pluginMeta.id);
                }
            }

            document.dispatchEvent(new CustomEvent('jwebirc:plugins:ready', {
                detail: {
                    started: Object.keys(this.started)
                }
            }));
        },

        registerPlugin: function(pluginDefinition) {
            if (!pluginDefinition || typeof pluginDefinition.id !== 'string' || !pluginDefinition.id.trim()) {
                return false;
            }

            const pluginId = pluginDefinition.id.trim();
            this.registry[pluginId] = pluginDefinition;

            document.dispatchEvent(new CustomEvent('jwebirc:plugin:registered', {
                detail: {
                    pluginId: pluginId
                }
            }));

            if (this.initialized && this.enabled) {
                this.startPlugin(pluginId);
            }

            return true;
        },

        startPlugin: function(pluginId) {
            if (!this.enabled || this.started[pluginId]) {
                return false;
            }

            const pluginDefinition = this.registry[pluginId];
            if (!pluginDefinition) {
                return false;
            }

            const pluginMeta = this.getPluginMeta(pluginId);
            if (!pluginMeta) {
                return false;
            }

            if (!this.isAllowedOnCurrentPage(pluginDefinition, pluginMeta)) {
                return false;
            }

            if (typeof pluginDefinition.initialize === 'function') {
                pluginDefinition.initialize(this.createContext(pluginId, pluginMeta));
            }

            this.started[pluginId] = true;
            document.dispatchEvent(new CustomEvent('jwebirc:plugin:started', {
                detail: {
                    pluginId: pluginId
                }
            }));
            return true;
        },

        getPluginMeta: function(pluginId) {
            return this.configuredPlugins.find(function(pluginMeta) {
                return pluginMeta && pluginMeta.id === pluginId;
            }) || null;
        },

        isAllowedOnCurrentPage: function(pluginDefinition, pluginMeta) {
            const pageConfig = pluginDefinition.pages || pluginMeta.pages;
            if (!pageConfig) {
                return true;
            }

            const allowedPages = Array.isArray(pageConfig) ? pageConfig : [pageConfig];
            return allowedPages.some(function(pageName) {
                return typeof pageName === 'string' && pageName.trim() === PluginSystem.page;
            });
        },

        createContext: function(pluginId, pluginMeta) {
            return {
                id: pluginId,
                meta: pluginMeta,
                page: this.page,
                lang: window.jwebircLang || document.documentElement.lang || 'en',
                emit: createDispatcher(pluginId),
                getTemplate: function() {
                    return window.TemplateSystem ? window.TemplateSystem.currentTemplate : null;
                },
                getGlobal: function(name) {
                    return window[name];
                },
                storageKey: function(suffix) {
                    return 'jwebirc.plugin.' + pluginId + '.' + (suffix || 'state');
                }
            };
        }
    };

    window.PluginSystem = PluginSystem;
    window.jwebircRegisterPlugin = function(pluginDefinition) {
        return PluginSystem.registerPlugin(pluginDefinition);
    };
})();