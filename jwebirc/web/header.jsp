<%-- 
    Document   : header
    Created on : 17.08.2024, 13:38:44
    Author     : Andreas Pschorn
    Updated    : 31.12.2025
--%>

<%@page contentType="text/html" pageEncoding="UTF-8" trimDirectiveWhitespaces="true"%>
<%
    // Set X-Frame-Options based on chatnapping configuration
    String chatnappingEnabled = (String) session.getAttribute("chatnapping_enabled");
    String allowedDomains = (String) session.getAttribute("chatnapping_allowed_domains");
    String uiLang = (String) session.getAttribute("ui_lang");
    if (uiLang == null) {
        uiLang = "en";
    }
    
    // Get template configuration
    String templateCss = (String) session.getAttribute("template_css_path");
    String templateEnabledHeader = (String) session.getAttribute("template_enabled");
    boolean useTemplate = templateEnabledHeader != null && templateEnabledHeader.equalsIgnoreCase("true") && templateCss != null;
    boolean debugAssetsEnabled = "true".equalsIgnoreCase(application.getInitParameter("jwebirc.debugAssets"));
    String bundleVersion = (String) application.getAttribute("jwebirc.bundleVersion");
    if (bundleVersion == null) {
        bundleVersion = "";
        try (java.io.InputStream stream = application.getResourceAsStream("/file/bundles/asset-bundles.properties")) {
            if (stream != null) {
                java.util.Properties props = new java.util.Properties();
                props.load(stream);
                bundleVersion = props.getProperty("build.id", "").trim();
            }
        } catch (Exception ignored) {
            bundleVersion = "";
        }
        application.setAttribute("jwebirc.bundleVersion", bundleVersion);
    }
    String bundleQuery = bundleVersion.isEmpty() ? "" : "?v=" + bundleVersion;
    
    if (chatnappingEnabled != null && chatnappingEnabled.equalsIgnoreCase("true")) {
        if (allowedDomains != null && !allowedDomains.equals("*")) {
            // If specific domains are configured, set Content-Security-Policy
            response.setHeader("Content-Security-Policy", "frame-ancestors 'self' " + allowedDomains.replace(",", " "));
        } else {
            // Allow all domains - remove X-Frame-Options restriction
            // Note: Content-Security-Policy frame-ancestors is more flexible
        }
    } else {
        // Chatnapping disabled - prevent framing
        response.setHeader("X-Frame-Options", "SAMEORIGIN");
    }
%>
<!DOCTYPE html>
<html lang="<%= uiLang %>">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        
        <title><%= session.getAttribute("irc_network_name") != null ? session.getAttribute("irc_network_name") + " - Login" : "IRC - Login" %></title>
        
        <!-- Meta Tags -->
        <meta name="author" content="Andreas Pschorn">
        <meta name="description" content="<%= session.getAttribute("irc_network_description") != null ? session.getAttribute("irc_network_description") : "Web-based IRC client" %>">
        <meta name="theme-color" content="#990000">
        
        <!-- Favicon -->
        <link rel="icon" type="image/svg+xml" href="file/logo.svg">
        <link rel="icon" type="image/png" sizes="32x32" href="file/favicon-32x32.png">
        <link rel="shortcut icon" href="file/favicon.ico">
        
        <!-- Stylesheets -->
        <% if (!debugAssetsEnabled) { %>
        <link rel="stylesheet" href="file/bundles/login.bundle.min.css<%= bundleQuery %>" type="text/css">
        <% } else { %>
        <link rel="stylesheet" href="file/bootstrap/css/bootstrap.min.css" type="text/css">
        <link rel="stylesheet" href="file/style.css" type="text/css">
        <% } %>
        <% if (useTemplate) { %>
        <!-- Template System: Custom Theme -->
        <link rel="stylesheet" href="<%= templateCss %>" type="text/css" data-template="custom">
        <% } %>
        
        <!-- Icons -->
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" crossorigin="anonymous">
        
        <!-- Scripts -->
        <script>
            // Template System Configuration
            window.templateSystemConfig = {
                enabled: <%= useTemplate ? "true" : "false" %>,
                userSelectable: <%= session.getAttribute("template_user_selectable") != null && session.getAttribute("template_user_selectable").toString().equalsIgnoreCase("true") ? "true" : "false" %>,
                current: "<%= session.getAttribute("user_template") != null ? session.getAttribute("user_template") : "dark-theme" %>",
                available: "<%= session.getAttribute("template_available") != null ? session.getAttribute("template_available") : "dark-theme,light-theme" %>".split(",")
            };
        </script>
        <% if (!debugAssetsEnabled) { %>
        <script src="file/bundles/login.bundle.min.js<%= bundleQuery %>"></script>
        <% } else { %>
        <script src="file/jquery.js"></script>
        <script src="file/i18n.js"></script>
        <script src="file/login-options.js"></script>
        <script src="file/template-system.js"></script>
        <% } %>
        <%@include file="plugin-head.jsp"%>
    </head>
    <body>
        <!-- Language + Login Options -->
        <div id="loginTopControls">
            <div id="loginOptionsContainer">
                <button class="nav-action-btn" id="loginOptionsToggle" aria-haspopup="true" aria-expanded="false" title="Display Options" data-i18n-title="options.display">
                    <i class="fas fa-cog"></i>
                </button>
            
                <!-- Login Options Dropdown -->
                <div class="nav-dropdown" id="loginOptionsMenu" role="menu">
                    <div class="nav-dropdown-header">
                        <i class="fas fa-sliders-h"></i>
                        <span data-i18n="options.display">Display Options</span>
                    </div>
                    <div class="nav-dropdown-content">
                        <div class="nav-dropdown-item slider-item">
                            <div class="nav-dropdown-item-header">
                                <i class="fas fa-text-height"></i>
                                <span data-i18n="nav.fontSize">Font Size</span>
                                <span class="nav-slider-value" id="loginFontSizeValue">14px</span>
                            </div>
                            <div class="nav-slider-wrapper">
                                <input type="range" id="loginOptFontSize" min="12" max="18" step="1" value="14" class="nav-range-slider">
                                <div class="nav-slider-track"></div>
                            </div>
                        </div>
                        <div class="nav-dropdown-divider"></div>
                        <label class="nav-dropdown-item" for="loginOptHideTopic">
                            <div class="nav-dropdown-item-left">
                                <i class="fas fa-bars"></i>
                                <span data-i18n="nav.hideTopic">Hide Topic</span>
                            </div>
                            <input type="checkbox" id="loginOptHideTopic" class="nav-toggle">
                        </label>
                        <label class="nav-dropdown-item" for="loginOptHideNicklist">
                            <div class="nav-dropdown-item-left">
                                <i class="fas fa-users"></i>
                                <span data-i18n="nav.hideNicklist">Hide Nicklist</span>
                            </div>
                            <input type="checkbox" id="loginOptHideNicklist" class="nav-toggle">
                        </label>
                        <div class="nav-dropdown-divider"></div>
                        <label class="nav-dropdown-item nav-sidebar-mode-item" for="loginOptNavLeft">
                            <div class="nav-dropdown-item-left">
                                <i class="fas fa-align-left"></i>
                                <span data-i18n="nav.sidebarMode">Sidebar Mode</span>
                            </div>
                            <input type="checkbox" id="loginOptNavLeft" class="nav-toggle">
                        </label>
                        <div class="nav-dropdown-divider"></div>
                        <label class="nav-dropdown-item" for="loginOptNotifications">
                            <div class="nav-dropdown-item-left">
                                <i class="fas fa-bell"></i>
                                <span data-i18n="nav.browserNotifications">Browser Notifications</span>
                            </div>
                            <input type="checkbox" id="loginOptNotifications" class="nav-toggle" checked>
                        </label>
                        <label class="nav-dropdown-item" for="loginOptNotificationSound">
                            <div class="nav-dropdown-item-left">
                                <i class="fas fa-volume-up"></i>
                                <span data-i18n="nav.notificationSound">Notification Sound</span>
                            </div>
                            <input type="checkbox" id="loginOptNotificationSound" class="nav-toggle" checked>
                        </label>
                        <div class="nav-dropdown-divider"></div>
                        <div class="nav-dropdown-item slider-item">
                            <div class="nav-dropdown-item-header">
                                <i class="fas fa-palette"></i>
                                <span data-i18n="nav.hue">Hue</span>
                                <span class="nav-slider-value" id="loginHueValue">0°</span>
                            </div>
                            <div class="nav-slider-wrapper">
                                <input type="range" id="loginOptHue" min="0" max="360" step="1" value="0" class="nav-range-slider hue-slider">
                                <div class="nav-slider-track hue-track"></div>
                            </div>
                        </div>
                        <% if (useTemplate && session.getAttribute("template_user_selectable") != null && session.getAttribute("template_user_selectable").toString().equalsIgnoreCase("true")) { %>
                        <!-- Template Selector -->
                        <div class="nav-dropdown-divider"></div>
                        <div class="nav-dropdown-item slider-item">
                            <div class="nav-dropdown-item-header">
                                <i class="fas fa-palette"></i>
                                <span data-i18n="template.theme">Theme</span>
                            </div>
                            <div class="template-selector" id="loginTemplateSelector">
                                <!-- Template options will be populated by JavaScript -->
                            </div>
                        </div>
                        <% } %>
                    </div>
                </div>
            </div>

            <div id="languageSwitcher">
                <button class="nav-action-btn lang-btn" id="languageToggle" aria-haspopup="true" aria-expanded="false" title="Language" data-i18n-title="lang.menu">
                    <i class="fas fa-language"></i>
                    <span id="languageToggleLabel"><%= uiLang != null ? uiLang.toUpperCase() : "EN" %></span>
                </button>
                <div class="nav-dropdown" id="languageMenu" role="menu">
                    <div class="nav-dropdown-header">
                        <i class="fas fa-language"></i>
                        <span data-i18n="lang.menu">Language</span>
                    </div>
                    <button type="button" class="nav-dropdown-item lang-option" data-lang="en" data-i18n="lang.english">English</button>
                    <button type="button" class="nav-dropdown-item lang-option" data-lang="de" data-i18n="lang.german">Deutsch</button>
                    <button type="button" class="nav-dropdown-item lang-option" data-lang="fr" data-i18n="lang.french">Français</button>
                    <button type="button" class="nav-dropdown-item lang-option" data-lang="it" data-i18n="lang.italian">Italiano</button>
                    <button type="button" class="nav-dropdown-item lang-option" data-lang="es" data-i18n="lang.spanish">Español</button>
                    <button type="button" class="nav-dropdown-item lang-option" data-lang="sv" data-i18n="lang.swedish">Svenska</button>
                    <button type="button" class="nav-dropdown-item lang-option" data-lang="pt" data-i18n="lang.portuguese">Português</button>
                    <button type="button" class="nav-dropdown-item lang-option" data-lang="tr" data-i18n="lang.turkish">Türkçe</button>
                </div>
            </div>
        </div>

        <script>
            (function() {
                const langToggle = document.getElementById('languageToggle');
                const langMenu = document.getElementById('languageMenu');
                const langOptions = langMenu ? langMenu.querySelectorAll('.lang-option') : [];
            
                function closeMenu(e) {
                    if (!langMenu || !langToggle) return;
                    if (e && (langMenu.contains(e.target) || langToggle.contains(e.target))) return;
                    langMenu.classList.remove('open');
                    langToggle.setAttribute('aria-expanded', 'false');
                }
            
                if (langToggle && langMenu) {
                    langToggle.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const willOpen = !langMenu.classList.contains('open');
                        langMenu.classList.toggle('open', willOpen);
                        langToggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
                    });
                    document.addEventListener('click', closeMenu);
                }
            
                if (langOptions && langOptions.length && window.jwebircSetLanguage) {
                    langOptions.forEach((btn) => {
                        btn.addEventListener('click', (e) => {
                            e.preventDefault();
                            window.jwebircSetLanguage(btn.dataset.lang || 'en');
                        });
                    });
                }
            })();
        </script>