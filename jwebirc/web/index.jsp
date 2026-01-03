<%-- 
    Document   : webchat
    Created on : 17.08.2024, 13:27:04
    Author     : Andreas Pschorn
--%>

<%@page import="java.util.ArrayList"%>
<%@page import = "net.midiandmore.jwebirc.*" %>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%@include file="init.jsp"%>
<%
    var nick = (String) session.getAttribute("nick");
    session.setAttribute("webchat_session_timout", webchatSessionTimeout);
    session.setAttribute("webchat_host", webchatHost);
    session.setAttribute("webchat_bind", webchatBind);
    session.setAttribute("webchat_port", webchatPort);
    session.setAttribute("webchat_ssl", webchatSsl);
    session.setAttribute("webchat_server_password", webchatServerPassword);
    session.setAttribute("webchat_ident", webchatIdent);
    session.setAttribute("webchat_user", webchatUser);
    session.setAttribute("webchat_password", webchatPassword);
    session.setAttribute("webchat_realname", webchatRealname);
    session.setAttribute("webchat_name", webchatName);
    session.setAttribute("webchat_title", webchatTitle);
    session.setAttribute("irc_network_name", ircNetworkName);
    session.setAttribute("irc_network_description", ircNetworkDescription);
    session.setAttribute("irc_network_keywords", ircNetworkKeywords);
    session.setAttribute("webchat_mode", webircMode);
    session.setAttribute("webchat_cgi", webircCgi);
    session.setAttribute("hmac_temporal", hmacTemporal);
    session.setAttribute("sasl_enabled", saslEnabled);
    session.setAttribute("chatnapping_enabled", chatnappingEnabled);
    session.setAttribute("chatnapping_allowed_domains", chatnappingAllowedDomains);
    session.setAttribute("chatnapping_default_nick", chatnappingDefaultNick);
    session.setAttribute("chatnapping_default_channel", chatnappingDefaultChannel);
    session.setAttribute("hostname", request.getRemoteHost());
    session.setAttribute("ip", request.getRemoteAddr());
    session.setAttribute("forwarded_for_header", forwardedForHeader);
    session.setAttribute("forwarded_for_ips", forwardedForIps);
    var paramC = request.getParameter("channels");
    var paramN = request.getParameter("name");
    if (paramC == null) {
        paramC = "";
    } else if (!paramC.startsWith("#") && !paramC.startsWith("&")) {
        paramC = "#" + paramC;
    }
    if (paramN == null) {
        paramN = "";
    } else {
        // Replace placeholders with random digits (0-9)
        // Supports: * for random digit
        while (paramN.contains("*")) {
            paramN = paramN.replaceFirst("\\*", String.valueOf((int) (Math.random() * 10)));
        }
    }
    var paramConnect = request.getParameter("connect");
    if (paramConnect != null) {
        // CAPTCHA Validation
        String captchaError = null;
        if (captchaEnabled != null && captchaEnabled.equalsIgnoreCase("true")) {
            String captchaToken = request.getParameter("captchaToken");
            String remoteIp = request.getRemoteAddr();
            
            // Get forwarded IP if applicable
            String forwardedFor = request.getHeader(forwardedForHeader);
            if (forwardedFor != null && !forwardedFor.isEmpty() && forwardedForIps.contains(remoteIp)) {
                remoteIp = forwardedFor.split(",")[0].trim();
            }
            
            CaptchaValidator.CaptchaType cType = CaptchaValidator.CaptchaType.NONE;
            String siteKey = "";
            String secretKey = "";
            String projectId = "";
            double minScore = 0.5;
            
            // Determine CAPTCHA type and keys
            if (captchaType != null) {
                switch (captchaType.toUpperCase()) {
                    case "TURNSTILE":
                        cType = CaptchaValidator.CaptchaType.TURNSTILE;
                        secretKey = turnstileSecretKey;
                        break;
                    case "RECAPTCHA_V2":
                        cType = CaptchaValidator.CaptchaType.RECAPTCHA_V2;
                        secretKey = recaptchaV2SecretKey;
                        break;
                    case "RECAPTCHA_V3":
                        cType = CaptchaValidator.CaptchaType.RECAPTCHA_V3;
                        secretKey = recaptchaV3SecretKey;
                        minScore = Double.parseDouble(recaptchaV3MinScore);
                        break;
                    case "RECAPTCHA_ENTERPRISE":
                        cType = CaptchaValidator.CaptchaType.RECAPTCHA_ENTERPRISE;
                        projectId = recaptchaEnterpriseProjectId;
                        siteKey = recaptchaEnterpriseSiteKey;
                        secretKey = recaptchaEnterpriseApiKey;
                        minScore = Double.parseDouble(recaptchaEnterpriseMinScore);
                        break;
                }
            }
            
            // Validate CAPTCHA
            boolean captchaValid = CaptchaValidator.validate(cType, captchaToken, secretKey, 
                                                            remoteIp, projectId, siteKey, minScore);
            
            if (!captchaValid) {
                captchaError = "CAPTCHA validation failed. Please try again.";
            }
        }
        
        if (captchaError != null) {
            // Display error and show form again
            paramConnect = null; // Prevent connection
        }
    }
    
    if (paramConnect != null) {
        var paramNick = request.getParameter("nick");
        if (paramNick == null) {
            paramNick = "";
        }
        if (paramNick.length() > 15) {
            paramNick = paramNick.substring(0, 14);
        }
        session.setAttribute("param-nick", paramNick);
        var paramChannel = request.getParameter("channel");
        if (paramChannel == null) {
            paramChannel = "";
        } else {
            paramChannel = paramChannel.replace("#", "");
        }
        if (paramChannel.length() > 200) {
            paramChannel = paramChannel.substring(0, 199);
        }
        session.setAttribute("param-channel", paramChannel);
        
        // Handle SASL parameters
        var paramUseSasl = request.getParameter("useSasl");
        var paramSaslUsername = request.getParameter("saslUsername");
        var paramSaslPassword = request.getParameter("saslPassword");
        
        if (paramUseSasl != null && paramUseSasl.equals("true")) {
            if (paramSaslUsername != null && !paramSaslUsername.isBlank()) {
                session.setAttribute("sasl_username", paramSaslUsername);
            } else {
                session.setAttribute("sasl_username", "");
            }
            if (paramSaslPassword != null && !paramSaslPassword.isBlank()) {
                session.setAttribute("sasl_password", paramSaslPassword);
            } else {
                session.setAttribute("sasl_password", "");
            }
            session.setAttribute("use_sasl", "true");
        } else {
            session.setAttribute("use_sasl", "false");
            session.setAttribute("sasl_username", "");
            session.setAttribute("sasl_password", "");
        }
%>
<jsp:include page="header-webchat.jsp"/>

    <!-- Cookie Warning Banner -->
    <div id="cookieWarning" class="cookie-warning" role="region" aria-label="Cookie Notice" style="display: none;">
        <div class="cookie-warning-content">
            <div class="cookie-warning-icon">
                <i class="fas fa-cookie"></i>
            </div>
            <div class="cookie-warning-text">
                <p class="cookie-warning-title">We Use Cookies</p>
                <p class="cookie-warning-message">
                    This website uses cookies to store your preferences (such as font size and color tone) 
                    and to improve your browsing experience. Cookies are stored only locally in your browser.
                </p>
            </div>
            <div class="cookie-warning-actions">
                <button id="cookieAccept" class="cookie-btn cookie-btn-accept" aria-label="Accept cookie notice">
                    <i class="fas fa-check"></i> Accept
                </button>
            </div>
        </div>
    </div>

    <script>
        // Cookie Warning Management
        function initCookieWarning() {
            const warningElement = document.getElementById('cookieWarning');
            const acceptButton = document.getElementById('cookieAccept');
            
            if (!warningElement || !acceptButton) return;
            
            // Check if user has already acknowledged cookies
            const cookieAcknowledged = localStorage.getItem('cookie_warning_acknowledged');
            
            // Only show on login page (not in chat)
            const isChat = document.querySelector('.chat-container') !== null && 
                          document.querySelector('.input_frame') !== null;
            
            if (!cookieAcknowledged && !isChat) {
                // Delay showing to avoid blocking initial page render
                setTimeout(() => {
                    warningElement.style.display = '';
                }, 500);
            }
            
            // Accept button handler
            acceptButton.addEventListener('click', () => {
                localStorage.setItem('cookie_warning_acknowledged', 'true');
                warningElement.style.display = 'none';
            });
        }
        
        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initCookieWarning);
        } else {
            initCookieWarning();
        }
    </script>

    <div class="chat-container">
    <!-- Navigation Bar - Modern Design -->
    <nav class="top_frame" id="nav_window" role="navigation" aria-label="Channel Navigation">
        <div class="nav-container">
            <!-- Brand Section -->
            <div class="nav-brand">
                <div class="nav-brand-icon">
                    <i class="fas fa-server"></i>
                </div>
                <div class="nav-brand-text">
                    <span class="nav-brand-title">jWebIRC</span>
                    <span class="nav-brand-subtitle">Channels</span>
                </div>
            </div>
            
            <!-- Tabs Section -->
            <div class="nav-tabs-wrapper">
                <button class="nav-scroll-btn nav-scroll-left" id="navScrollLeft" aria-label="Scroll left">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <div class="nav-tabs" id="nav_tabs"></div>
                <button class="nav-scroll-btn nav-scroll-right" id="navScrollRight" aria-label="Scroll right">
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
            
            <!-- Actions Section -->
            <div class="nav-actions">
                <button class="nav-action-btn" id="navNotifications" title="Notifications" aria-label="Notifications">
                    <i class="fas fa-bell"></i>
                    <span class="nav-badge" id="notificationBadge" style="display: none;">0</span>
                </button>
                <button class="nav-action-btn" id="navOptionsToggle" aria-haspopup="true" aria-expanded="false" title="Settings">
                    <i class="fas fa-cog"></i>
                </button>
                
                <!-- Options Dropdown -->
                <div class="nav-dropdown" id="navOptionsMenu" role="menu">
                    <div class="nav-dropdown-header">
                        <i class="fas fa-sliders-h"></i>
                        <span>View Options</span>
                    </div>
                    <div class="nav-dropdown-content">
                        <label class="nav-dropdown-item" for="optHideTopic">
                            <div class="nav-dropdown-item-left">
                                <i class="fas fa-eye-slash"></i>
                                <span>Hide Topic</span>
                            </div>
                            <input type="checkbox" id="optHideTopic" class="nav-toggle">
                        </label>
                        <label class="nav-dropdown-item" for="optHideNicklist">
                            <div class="nav-dropdown-item-left">
                                <i class="fas fa-users"></i>
                                <span>Hide Nicklist</span>
                            </div>
                            <input type="checkbox" id="optHideNicklist" class="nav-toggle">
                        </label>
                        <div class="nav-dropdown-divider"></div>
                        <label class="nav-dropdown-item" for="optNavLeft">
                            <div class="nav-dropdown-item-left">
                                <i class="fas fa-align-left"></i>
                                <span>Sidebar Mode</span>
                            </div>
                            <input type="checkbox" id="optNavLeft" class="nav-toggle">
                        </label>
                        <div class="nav-dropdown-divider"></div>
                        <label class="nav-dropdown-item" for="optNotifications">
                            <div class="nav-dropdown-item-left">
                                <i class="fas fa-bell"></i>
                                <span>Browser Notifications</span>
                            </div>
                            <input type="checkbox" id="optNotifications" class="nav-toggle" checked>
                        </label>
                        <label class="nav-dropdown-item" for="optNotificationSound">
                            <div class="nav-dropdown-item-left">
                                <i class="fas fa-volume-up"></i>
                                <span>Notification Sound</span>
                            </div>
                            <input type="checkbox" id="optNotificationSound" class="nav-toggle" checked>
                        </label>
                        <div class="nav-dropdown-divider"></div>
                        <div class="nav-dropdown-item slider-item">
                            <div class="nav-dropdown-item-header">
                                <i class="fas fa-text-height"></i>
                                <span>Font Size</span>
                                <span class="nav-slider-value" id="fontSizeValue">14px</span>
                            </div>
                            <div class="nav-slider-wrapper">
                                <input type="range" id="optFontSize" min="12" max="18" step="1" value="14" class="nav-range-slider">
                                <div class="nav-slider-track"></div>
                            </div>
                        </div>
                        <div class="nav-dropdown-divider"></div>
                        <div class="nav-dropdown-item slider-item">
                            <div class="nav-dropdown-item-header">
                                <i class="fas fa-palette"></i>
                                <span>Hue</span>
                                <span class="nav-slider-value" id="hueValue">0°</span>
                            </div>
                            <div class="nav-slider-wrapper">
                                <input type="range" id="optHue" min="0" max="360" step="1" value="0" class="nav-range-slider hue-slider">
                                <div class="nav-slider-track hue-track"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </nav>
    
    <!-- Topic Bar -->
    <div class="topic_frame" id="topic_window" role="complementary" aria-label="Channel Topic">
        <i class="fas fa-info-circle topic-icon"></i>
        <span class="topic-text"></span>
    </div>
    
    <!-- Chat Window -->
    <div class="chat_frame" id="chat_window" role="main" aria-label="Chat Messages" aria-live="polite">
    </div>
    
    <!-- Typing Indicator Bar -->
    <div class="typing-bar" id="typingBar" role="status" aria-live="polite">
        <div class="typing-content">
            <span class="typing-text" id="typingText"></span>
            <div class="typing-dots">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
            </div>
        </div>
    </div>
    
    <!-- User List -->
    <div class="right_frame" id="right" role="complementary" aria-label="User List">
        <div class="user-list-header">
            <i class="fas fa-users"></i> <span class="user-count">Users</span>
        </div>
    </div>
    
    <!-- Message Input -->
    <div class="post_frame" role="form" aria-label="Message Input">
        <div class="input-group">
            <button class="btn btn-outline-secondary" type="button" id="emojiBtn" title="Emojis">
                <i class="far fa-smile"></i>
            </button>
            <button class="btn btn-outline-secondary" type="button" id="formatHelpBtn" title="IRC Formatting (Ctrl+B, Ctrl+I, Ctrl+U, ...)">
                <i class="fas fa-question-circle"></i>
            </button>
            <input type="text" 
                   class="form-control post_field" 
                   autocomplete="off" 
                   id="message" 
                   maxlength="400" 
                   value="" 
                   placeholder="Type a message..."
                   aria-label="Message input"
                   onkeydown="return submitChatInput(event);">
            <button class="btn btn-primary" 
                    type="button" 
                    onclick="sendText();"
                    aria-label="Send message">
                <i class="fas fa-paper-plane"></i> Send
            </button>
        </div>
        <!-- Format Help Tooltip -->
        <div id="formatHelp" class="format-help" style="display: none;">
            <div class="format-help-header">
                <span><i class="fas fa-keyboard"></i> IRC Formatting Shortcuts</span>
                <button class="format-help-close" onclick="document.getElementById('formatHelp').style.display='none'">×</button>
            </div>
            <div class="format-help-content">
                <div class="format-help-item"><kbd>Ctrl+B</kbd> <span style="color: white;"><strong>Bold</strong></span></div>
                <div class="format-help-item"><kbd>Ctrl+I</kbd> <span style="color: white;"><em>Italic</em></span></div>
                <div class="format-help-item"><kbd>Ctrl+U</kbd> <span style="color: white;"><u>Underline</u></span></div>
                <div class="format-help-item"><kbd>Ctrl+L</kbd> <span style="color: white;"><s>Strikethrough</s></span></div>
                <div class="format-help-item"><kbd>Ctrl+M</kbd> <span style="color: white;"><code>Monospace</code></span></div>
                <div class="format-help-item"><kbd>Ctrl+R</kbd> <span style="color: white; filter: invert(1);">Reverse</span></div>
                <div class="format-help-item"><kbd>Ctrl+K</kbd> <span style="color: #00aaff;">Color</span> <span style="color: white;">(then type numbers)</span></div>
                <div class="format-help-item"><kbd>Ctrl+O</kbd> <span style="color: white;">Reset all formatting</span></div>
            </div>
        </div>
    </div>
</div>

<script>
    window.user = "<% out.print(paramNick); %>";
    window.chan = "<% out.print(paramChannel); %>";
    
    // Loading screen will be hidden by IRC connection logic
    window.addEventListener('load', function() {
        // Setup format help button
        const formatHelpBtn = document.getElementById('formatHelpBtn');
        const formatHelp = document.getElementById('formatHelp');
        
        if (formatHelpBtn && formatHelp) {
            formatHelpBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const isVisible = formatHelp.style.display !== 'none';
                formatHelp.style.display = isVisible ? 'none' : 'block';
            });
            
            // Close format help when clicking outside
            document.addEventListener('click', function(e) {
                if (formatHelp.style.display !== 'none' && 
                    !formatHelp.contains(e.target) && 
                    !formatHelpBtn.contains(e.target)) {
                    formatHelp.style.display = 'none';
                }
            });
        }
    });
</script>
<script src="file/notifications.js"></script>
<script src="file/chat.js"></script>
<script src="file/irc.js"></script> 
<script src="file/post.js"></script> 
<jsp:include page="footer-webchat.jsp"/> 
<%
} else {
%>
<jsp:include page="header.jsp"/>

<!-- CAPTCHA Scripts -->
<% 
String activeCaptchaType = (captchaEnabled != null && captchaEnabled.equalsIgnoreCase("true")) ? captchaType : "NONE";
String activeSiteKey = "";

if (activeCaptchaType.equalsIgnoreCase("TURNSTILE")) {
    activeSiteKey = turnstileSiteKey;
%>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<%
} else if (activeCaptchaType.equalsIgnoreCase("RECAPTCHA_V2")) {
    activeSiteKey = recaptchaV2SiteKey;
%>
<script src="https://www.google.com/recaptcha/api.js" async defer></script>
<%
} else if (activeCaptchaType.equalsIgnoreCase("RECAPTCHA_V3")) {
    activeSiteKey = recaptchaV3SiteKey;
%>
<script src="https://www.google.com/recaptcha/api.js?render=<%= activeSiteKey %>"></script>
<%
} else if (activeCaptchaType.equalsIgnoreCase("RECAPTCHA_ENTERPRISE")) {
    activeSiteKey = recaptchaEnterpriseSiteKey;
%>
<script src="https://www.google.com/recaptcha/enterprise.js?render=<%= activeSiteKey %>"></script>
<%
}
%>

<div class="login-container">
    <div class="login-card">
        <div class="login-header">
            <i class="fas fa-comments fa-3x" style="color: var(--primary-color); margin-bottom: 1rem;"></i>
            <h2><%= session.getAttribute("irc_network_name") != null ? session.getAttribute("irc_network_name") : "IRC" %></h2>
            <p class="text-muted">Join the conversation</p>
        </div>
        
        <script>
            // Cookie-Verwaltung
            function setCookie(name, value, days = 365) {
                const d = new Date();
                d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
                const expires = "expires=" + d.toUTCString();
                document.cookie = name + "=" + encodeURIComponent(value) + ";" + expires + ";path=/;SameSite=Lax";
            }
            
            function getCookie(name) {
                const nameEQ = name + "=";
                const ca = document.cookie.split(';');
                for(let i = 0; i < ca.length; i++) {
                    let c = ca[i];
                    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
                    if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
                }
                return null;
            }
            
            // URL-Parameter auslesen
            function getUrlParameter(name) {
                const urlParams = new URLSearchParams(window.location.search);
                return urlParams.get(name);
            }
            
            // Toggle SASL authentication fields
            function toggleSaslFields() {
                const checkbox = document.getElementById('useSaslAuth');
                const saslFields = document.getElementById('saslFields');
                if (checkbox && saslFields) {
                    saslFields.style.display = checkbox.checked ? 'block' : 'none';
                    // Cookie speichern
                    setCookie('jwebirc_useSasl', checkbox.checked ? 'true' : 'false');
                }
            }
            
            // Formular-Werte beim Laden wiederherstellen
            window.addEventListener('DOMContentLoaded', function() {
                const nickInput = document.getElementById('nickInput');
                const channelInput = document.getElementById('channelInput');
                const useSaslCheckbox = document.getElementById('useSaslAuth');
                
                // URL-Parameter haben höchste Priorität
                const urlChannels = getUrlParameter('channels') || getUrlParameter('channel');
                const urlName = getUrlParameter('name');
                
                // Wenn keine URL-Parameter vorhanden, Cookie-Werte laden
                if (nickInput && !urlName && !nickInput.value) {
                    const savedNick = getCookie('jwebirc_nick');
                    if (savedNick) {
                        nickInput.value = savedNick;
                    }
                }
                
                if (channelInput && !urlChannels && !channelInput.value) {
                    const savedChannel = getCookie('jwebirc_channel');
                    if (savedChannel) {
                        channelInput.value = savedChannel;
                    }
                }
                
                // SASL-Checkbox aus Cookie laden
                if (useSaslCheckbox) {
                    const savedUseSasl = getCookie('jwebirc_useSasl');
                    if (savedUseSasl === 'true') {
                        useSaslCheckbox.checked = true;
                        toggleSaslFields();
                    }
                }
                
                // Event-Listener für das Speichern beim Submit
                const loginForm = document.forms['login'];
                if (loginForm) {
                    loginForm.addEventListener('submit', function() {
                        if (nickInput && nickInput.value) {
                            setCookie('jwebirc_nick', nickInput.value);
                        }
                        if (channelInput && channelInput.value) {
                            setCookie('jwebirc_channel', channelInput.value);
                        }
                    });
                }
            });
        </script>
        
        <form method="POST" name="login" action="" target="_top" accept-charset="utf-8" class="login-form" id="loginForm">
            <input name="connect" value="true" type="hidden">
            <input type="hidden" id="captchaToken" name="captchaToken" value="">
            
            <!-- Basic Information -->
            <div class="form-section">
                <div class="form-floating mb-3">
                    <input class="form-control" 
                           id="nickInput"
                           maxlength="15" 
                           name="nick" 
                           value="<% out.print(paramN); %>" 
                           required
                           autocomplete="nickname"
                           pattern="[a-zA-Z0-9_\-\[\]\{\}\\\|]+"
                           placeholder=" ">
                    <label for="nickInput">
                        <i class="fas fa-user"></i> Nickname
                    </label>
                </div>
                
                <div class="form-floating mb-3">
                    <input class="form-control" 
                           id="channelInput"
                           maxlength="200" 
                           name="channel" 
                           value="<% out.print(paramC); %>" 
                           autocomplete="off"
                           placeholder=" ">
                    <label for="channelInput">
                        <i class="fas fa-hashtag"></i> Channel
                    </label>
                </div>
                <div class="form-text" style="margin-top: -0.75rem; margin-bottom: 1rem; font-size: 0.75rem; color: #999;">
                    <i class="fas fa-info-circle"></i> Optional - leave empty to join no channel
                </div>
            </div>
            
            <% if (saslEnabled != null && saslEnabled.equalsIgnoreCase("true")) { %>
            <!-- Authentication (Optional) -->
            <div class="form-section" style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                <div class="mb-3" style="background-color: rgba(88, 101, 242, 0.08); border: 1px solid rgba(88, 101, 242, 0.2); border-radius: 8px; padding: 1rem;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <input class="form-check-input" 
                               type="checkbox" 
                               id="useSaslAuth" 
                               name="useSasl" 
                               value="true" 
                               onchange="toggleSaslFields()" 
                               style="width: 20px; height: 20px; margin: 0; cursor: pointer; flex-shrink: 0; border: 2px solid #5865f2; background-color: transparent; border-radius: 4px;">
                        <label class="form-check-label" for="useSaslAuth" style="cursor: pointer; margin: 0; flex: 1; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-key" style="color: var(--primary-color); font-size: 1.1rem;"></i>
                            <div style="flex: 1;">
                                <span style="font-size: 0.95rem; font-weight: 500; color: #ffffff;">I have an account</span>
                                <span style="margin-left: 8px; font-size: 0.8rem; color: rgba(255, 255, 255, 0.65);">(Use SASL authentication)</span>
                            </div>
                        </label>
                    </div>
                </div>
                
                <div id="saslFields" style="display: none; margin-top: 0.5rem;">
                    <div class="form-floating mb-3">
                        <input class="form-control" 
                               id="saslUsername"
                               maxlength="50" 
                               name="saslUsername" 
                               autocomplete="username"
                               placeholder=" ">
                        <label for="saslUsername">
                            <i class="fas fa-user-shield"></i> Account name
                        </label>
                    </div>
                    
                    <div class="form-floating mb-3">
                        <input class="form-control" 
                               type="password"
                               id="saslPassword"
                               maxlength="200" 
                               name="saslPassword" 
                               autocomplete="current-password"
                               placeholder=" ">
                        <label for="saslPassword">
                            <i class="fas fa-lock"></i> Password
                        </label>
                    </div>
                </div>
            </div>
            <% } %>
            
            <!-- CAPTCHA Widget -->
            <% if (captchaEnabled != null && captchaEnabled.equalsIgnoreCase("true")) { %>
            <div class="form-section" style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                <div class="mb-3" style="text-align: center;">
                    <% if (captchaType.equalsIgnoreCase("TURNSTILE")) { %>
                        <!-- Cloudflare Turnstile -->
                        <div class="cf-turnstile" data-sitekey="<%= turnstileSiteKey %>" data-callback="onCaptchaSuccess" style="display: inline-block;"></div>
                    <% } else if (captchaType.equalsIgnoreCase("RECAPTCHA_V2")) { %>
                        <!-- Google reCAPTCHA v2 -->
                        <div class="g-recaptcha" data-sitekey="<%= recaptchaV2SiteKey %>" data-callback="onCaptchaSuccess" style="display: inline-block;"></div>
                    <% } else if (captchaType.equalsIgnoreCase("RECAPTCHA_V3")) { %>
                        <!-- Google reCAPTCHA v3 (invisible) -->
                        <input type="hidden" id="recaptchaV3Token" name="recaptchaV3Token">
                        <small class="text-muted" style="display: block; margin-top: -0.5rem;">
                            <i class="fas fa-shield-alt"></i> Protected by reCAPTCHA v3
                        </small>
                    <% } else if (captchaType.equalsIgnoreCase("RECAPTCHA_ENTERPRISE")) { %>
                        <!-- Google reCAPTCHA Enterprise (invisible) -->
                        <input type="hidden" id="recaptchaEnterpriseToken" name="recaptchaEnterpriseToken">
                        <small class="text-muted" style="display: block; margin-top: -0.5rem;">
                            <i class="fas fa-shield-alt"></i> Protected by reCAPTCHA Enterprise
                        </small>
                    <% } %>
                </div>
            </div>
            <% } %>
            
            <div style="margin-top: 2rem;">
                <button class="btn btn-primary btn-lg w-100" type="submit" id="submitBtn">
                    <i class="fas fa-sign-in-alt"></i> Join Chat
                </button>
                
                <% if (chatnappingEnabled != null && chatnappingEnabled.equalsIgnoreCase("true")) { %>
                <!-- Chatnapping Link Button -->
                <button type="button" class="btn btn-outline-secondary btn-sm w-100 mt-2" onclick="generateChatnappingLink()" style="font-size: 0.85rem;">
                    <i class="fas fa-link"></i> Generate Embed Link
                </button>
                <% } %>
            </div>
        </form>
        
        <div class="login-footer">
            <small class="text-muted">
                    <i class="fas fa-shield-alt"></i> Secure connection &bull; 
                    <i class="fas fa-globe"></i> WebSocket supported &bull;
                    <a href="about.jsp" style="color: var(--primary-color); text-decoration: none;"><i class="fas fa-info-circle"></i> About</a>
            </small>
        </div>
    </div>
</div>

<!-- CAPTCHA JavaScript -->
<script>
    const captchaEnabled = <%= (captchaEnabled != null && captchaEnabled.equalsIgnoreCase("true")) ? "true" : "false" %>;
    const captchaType = "<%= activeCaptchaType %>";
    const captchaSiteKey = "<%= activeSiteKey %>";
    
    // CAPTCHA success callback
    function onCaptchaSuccess(token) {
        document.getElementById('captchaToken').value = token;
    }
    
    // Form submission handler
    document.getElementById('loginForm').addEventListener('submit', function(e) {
        if (!captchaEnabled) {
            return true;
        }
        
        if (captchaType === 'RECAPTCHA_V3') {
            e.preventDefault();
            grecaptcha.ready(function() {
                grecaptcha.execute(captchaSiteKey, {action: 'login'}).then(function(token) {
                    document.getElementById('captchaToken').value = token;
                    document.getElementById('loginForm').submit();
                });
            });
            return false;
        } else if (captchaType === 'RECAPTCHA_ENTERPRISE') {
            e.preventDefault();
            grecaptcha.enterprise.ready(function() {
                grecaptcha.enterprise.execute(captchaSiteKey, {action: 'login'}).then(function(token) {
                    document.getElementById('captchaToken').value = token;
                    document.getElementById('loginForm').submit();
                });
            });
            return false;
        } else {
            // For TURNSTILE and RECAPTCHA_V2, check if token is set
            const token = document.getElementById('captchaToken').value;
            if (!token) {
                alert('Please complete the CAPTCHA verification.');
                e.preventDefault();
                return false;
            }
        }
        
        return true;
    });
    
    // =============== CHATNAPPING FEATURE ===============
    function generateChatnappingLink() {
        // Get current or default values
        const nickInput = document.getElementById('nickInput');
        const channelInput = document.getElementById('channelInput');
        
        const defaultNick = '<%= session.getAttribute("chatnapping_default_nick") != null ? session.getAttribute("chatnapping_default_nick") : "" %>';
        const defaultChannel = '<%= session.getAttribute("chatnapping_default_channel") != null ? session.getAttribute("chatnapping_default_channel") : "" %>';
        
        const currentNick = nickInput && nickInput.value ? nickInput.value : defaultNick;
        const currentChannel = channelInput && channelInput.value ? channelInput.value : defaultChannel;
        
        // Get UI preferences from localStorage (login options)
        let defaultFontSize = 14;
        let defaultHue = 0;
        let defaultHideTopic = false;
        let defaultHideNicklist = false;
        let defaultNavLeft = false;
        let defaultNotifications = true;
        let defaultNotificationSound = true;
        try {
            const stored = localStorage.getItem('jwebirc_ui');
            if (stored) {
                const parsed = JSON.parse(stored);
                defaultFontSize = parsed.fontSize || 14;
                defaultHue = parsed.hue || 0;
                defaultHideTopic = parsed.hideTopic || false;
                defaultHideNicklist = parsed.hideNicklist || false;
                defaultNavLeft = parsed.navLeft || false;
                defaultNotifications = parsed.notificationsEnabled !== false;
                defaultNotificationSound = parsed.notificationSound !== false;
            }
        } catch (e) {
            // Use defaults if localStorage is unavailable
        }
        
        // Get current primary color from CSS variables
        const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || '#5865f2';
        
        // Create configuration modal
        const configModal = document.createElement('div');
        configModal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 9999; display: flex; align-items: center; justify-content: center;';
        
        const configContent = document.createElement('div');
        configContent.style.cssText = 'background: #2d2d3d; color: #ffffff; padding: 30px; border-radius: 8px; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.5);';
        
        configContent.innerHTML = `
            <h3 style="margin-top: 0; color: ` + primaryColor + `;"><i class="fas fa-cog"></i> Configure Embed Link</h3>
            <p style="color: #d0d0d0; margin-bottom: 20px;">Customize the nickname and channel for the embed link:</p>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; font-weight: bold; margin-bottom: 5px; color: #ffffff;">
                    <i class="fas fa-user"></i> Nickname:
                </label>
                <input type="text" id="embedNick" value="" 
                       style="width: 100%; padding: 10px; border: 1px solid #555; background: #404050; color: #ffffff; border-radius: 4px; font-size: 14px;"
                       placeholder="Enter nickname">
                <small style="display: block; margin-top: 5px; color: #a0a0a0;">
                    Use * for random digit (e.g., Guest* becomes Guest7)
                </small>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; font-weight: bold; margin-bottom: 5px; color: #ffffff;">
                    <i class="fas fa-hashtag"></i> Channel:
                </label>
                <input type="text" id="embedChannel" value="" 
                       style="width: 100%; padding: 10px; border: 1px solid #555; background: #404050; color: #ffffff; border-radius: 4px; font-size: 14px;"
                       placeholder="Enter channel (e.g., #lobby)">
                <small style="display: block; margin-top: 5px; color: #a0a0a0;">
                    Leave empty to skip auto-join. Multiple channels: #channel1,#channel2
                </small>
            </div>
            
            <div style="background: rgba(88, 101, 242, 0.1); border-left: 4px solid ` + primaryColor + `; padding: 12px; border-radius: 4px; margin-top: 20px; margin-bottom: 20px;">
                <small style="color: #d0d0d0;">
                    <i class="fas fa-info-circle" style="color: ` + primaryColor + `;"></i> <strong>Display Settings:</strong><br>
                    Font size and color theme will be taken from your current login options settings.<br>
                    Current: <strong>` + defaultFontSize + `px</strong> font, <strong>` + defaultHue + `°</strong> hue
                </small>
            </div>
            
            <div style="text-align: right;">
                <button id="btnGenerateLink" style="padding: 10px 24px; background: ` + primaryColor + `; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 8px; font-size: 14px; transition: background 0.2s;">
                    <i class="fas fa-check"></i> Generate Link
                </button>
                <button id="btnCancelConfig" style="padding: 10px 24px; background: #555565; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; transition: background 0.2s;">
                    <i class="fas fa-times"></i> Cancel
                </button>
            </div>
        `;
        
        configModal.appendChild(configContent);
        document.body.appendChild(configModal);
        
        // Set the current values after the modal is added to DOM
        document.getElementById('embedNick').value = currentNick;
        document.getElementById('embedChannel').value = currentChannel;
        
        // Handle Generate button
        document.getElementById('btnGenerateLink').onclick = function() {
            const nickname = document.getElementById('embedNick').value;
            const channels = document.getElementById('embedChannel').value;
            
            configModal.remove();
            showGeneratedLink(nickname, channels, defaultFontSize, defaultHue, defaultHideTopic, defaultHideNicklist, defaultNavLeft, defaultNotifications, defaultNotificationSound);
        };
        
        // Handle Cancel button
        document.getElementById('btnCancelConfig').onclick = function() {
            configModal.remove();
        };
        
        // Handle click outside
        configModal.onclick = function(e) {
            if (e.target === configModal) {
                configModal.remove();
            }
        };
    }
    
    function showGeneratedLink(nickname, channels, overrideFontSize, overrideHue, overrideHideTopic, overrideHideNicklist, overrideNavLeft, overrideNotifications, overrideNotificationSound) {
        const baseUrl = window.location.origin + window.location.pathname;
        
        // Use provided values or get defaults
        const fontSize = overrideFontSize !== undefined ? overrideFontSize : 14;
        const hue = overrideHue !== undefined ? overrideHue : 0;
        const hideTopic = overrideHideTopic !== undefined ? overrideHideTopic : false;
        const hideNicklist = overrideHideNicklist !== undefined ? overrideHideNicklist : false;
        const navLeft = overrideNavLeft !== undefined ? overrideNavLeft : false;
        const notifications = overrideNotifications !== false;
        const notificationSound = overrideNotificationSound !== false;
        
        let url = baseUrl + '?connect=1';
        if (nickname && nickname.trim()) {
            url += '&name=' + encodeURIComponent(nickname);
        }
        if (channels && channels.trim()) {
            url += '&channels=' + encodeURIComponent(channels);
        }
        // Add UI preferences to URL
        url += '&fontSize=' + fontSize;
        url += '&hue=' + hue;
        if (hideTopic) {
            url += '&hideTopic=true';
        }
        if (hideNicklist) {
            url += '&hideNicklist=true';
        }
        if (navLeft) {
            url += '&navLeft=true';
        }
        // Add notification preferences
        if (!notifications) {
            url += '&notificationsEnabled=false';
        }
        if (!notificationSound) {
            url += '&notificationSound=false';
        }
        
        const embedCode = '<iframe src="' + url.replace(/"/g, '&quot;') + '" width="800" height="600" frameborder="0" style="border: 1px solid #555;"></iframe>';
        
        // Get primary color for theming
        const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || '#5865f2';
        
        // Show result modal
        const modal = document.createElement('div');
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 9999; display: flex; align-items: center; justify-content: center;';
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = 'background: #2d2d3d; color: #ffffff; padding: 30px; border-radius: 8px; max-width: 700px; width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.5);';
        
        const title = document.createElement('h3');
        title.style.cssText = 'margin-top: 0; color: ' + primaryColor + ';';
        title.innerHTML = '<i class="fas fa-link"></i> Chatnapping Link Generated';
        
        const description = document.createElement('p');
        description.style.cssText = 'color: #d0d0d0; margin-bottom: 20px;';
        description.textContent = 'Share this link or embed the chat on your website:';
        
        // Nickname display
        if (nickname && nickname.trim()) {
            const nickInfo = document.createElement('div');
            nickInfo.style.cssText = 'background: rgba(88, 101, 242, 0.15); padding: 8px 12px; border-radius: 4px; margin-bottom: 15px; font-size: 13px; color: #d0d0d0;';
            nickInfo.innerHTML = '<i class="fas fa-user"></i> <strong>Nickname:</strong> ' + nickname.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            modalContent.appendChild(nickInfo);
        }
        
        // Channel display
        if (channels && channels.trim()) {
            const channelInfo = document.createElement('div');
            channelInfo.style.cssText = 'background: rgba(0, 184, 148, 0.15); padding: 8px 12px; border-radius: 4px; margin-bottom: 15px; font-size: 13px; color: #d0d0d0;';
            channelInfo.innerHTML = '<i class="fas fa-hashtag"></i> <strong>Channel:</strong> ' + channels.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            modalContent.appendChild(channelInfo);
        }
        
        // UI Options display
        const uiInfo = document.createElement('div');
        let uiDisplay = 'Font Size: ' + fontSize + 'px, Hue: ' + hue + '°';
        if (hideTopic) uiDisplay += ', Hide Topic: ✓';
        if (hideNicklist) uiDisplay += ', Hide Nicklist: ✓';
        if (navLeft) uiDisplay += ', Sidebar Mode: ✓';
        if (notifications) uiDisplay += ', Notifications: ✓';
        if (notificationSound) uiDisplay += ', Sound: ✓';
        uiInfo.style.cssText = 'background: rgba(243, 156, 18, 0.15); padding: 8px 12px; border-radius: 4px; margin-bottom: 15px; font-size: 13px; color: #d0d0d0;';
        uiInfo.innerHTML = '<i class="fas fa-sliders-h"></i> <strong>Display Options:</strong> ' + uiDisplay;
        modalContent.appendChild(uiInfo);
        
        const linkLabel = document.createElement('p');
        linkLabel.innerHTML = '<strong>Direct Link:</strong>';
        linkLabel.style.marginBottom = '5px';
        linkLabel.style.color = '#ffffff';
        
        const linkInput = document.createElement('input');
        linkInput.type = 'text';
        linkInput.value = url;
        linkInput.readOnly = true;
        linkInput.style.cssText = 'width: 100%; padding: 8px; margin-bottom: 15px; border: 1px solid #555; background: #404050; color: #ffffff; border-radius: 4px; font-size: 13px; font-family: monospace;';
        linkInput.onclick = function() { this.select(); };
        
        const embedLabel = document.createElement('p');
        embedLabel.innerHTML = '<strong>Embed Code (iframe):</strong>';
        embedLabel.style.marginBottom = '5px';
        embedLabel.style.color = '#ffffff';
        
        const embedTextarea = document.createElement('textarea');
        embedTextarea.value = embedCode;
        embedTextarea.readOnly = true;
        embedTextarea.style.cssText = 'width: 100%; height: 100px; padding: 8px; margin-bottom: 15px; border: 1px solid #555; background: #404050; color: #ffffff; border-radius: 4px; font-family: monospace; font-size: 12px; resize: vertical;';
        embedTextarea.onclick = function() { this.select(); };
        
        const tipBox = document.createElement('div');
        tipBox.style.cssText = 'background: rgba(243, 156, 18, 0.2); border-left: 4px solid #f39c12; padding: 12px; border-radius: 4px; margin-bottom: 15px;';
        tipBox.innerHTML = '<small style="color: #d0d0d0;"><i class="fas fa-lightbulb"></i> <strong>Tip:</strong> The link includes your current display settings (font size, hue). Users can change these after joining. Test the link before embedding it on your website to ensure it works correctly.</small>';
        
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'text-align: right;';
        
        const copyLinkButton = document.createElement('button');
        copyLinkButton.innerHTML = '<i class="fas fa-copy"></i> Copy Link';
        copyLinkButton.style.cssText = 'padding: 8px 20px; background: ' + primaryColor + '; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 8px; transition: opacity 0.2s;';
        copyLinkButton.onmouseover = function() { this.style.opacity = '0.8'; };
        copyLinkButton.onmouseout = function() { this.style.opacity = '1'; };
        copyLinkButton.onclick = function() {
            navigator.clipboard.writeText(url).then(function() {
                copyLinkButton.innerHTML = '<i class="fas fa-check"></i> Copied!';
                setTimeout(function() {
                    copyLinkButton.innerHTML = '<i class="fas fa-copy"></i> Copy Link';
                }, 2000);
            }).catch(function() {
                linkInput.select();
                document.execCommand('copy');
                copyLinkButton.innerHTML = '<i class="fas fa-check"></i> Copied!';
                setTimeout(function() {
                    copyLinkButton.innerHTML = '<i class="fas fa-copy"></i> Copy Link';
                }, 2000);
            });
        };
        
        const copyCodeButton = document.createElement('button');
        copyCodeButton.innerHTML = '<i class="fas fa-code"></i> Copy Code';
        copyCodeButton.style.cssText = 'padding: 8px 20px; background: #00b894; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 8px; transition: opacity 0.2s;';
        copyCodeButton.onmouseover = function() { this.style.opacity = '0.8'; };
        copyCodeButton.onmouseout = function() { this.style.opacity = '1'; };
        copyCodeButton.onclick = function() {
            navigator.clipboard.writeText(embedCode).then(function() {
                copyCodeButton.innerHTML = '<i class="fas fa-check"></i> Copied!';
                setTimeout(function() {
                    copyCodeButton.innerHTML = '<i class="fas fa-code"></i> Copy Code';
                }, 2000);
            }).catch(function() {
                embedTextarea.select();
                document.execCommand('copy');
                copyCodeButton.innerHTML = '<i class="fas fa-check"></i> Copied!';
                setTimeout(function() {
                    copyCodeButton.innerHTML = '<i class="fas fa-code"></i> Copy Code';
                }, 2000);
            });
        };
        
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '<i class="fas fa-times"></i> Close';
        closeButton.style.cssText = 'padding: 8px 20px; background: #555565; color: white; border: none; border-radius: 4px; cursor: pointer; transition: opacity 0.2s;';
        closeButton.onmouseover = function() { this.style.opacity = '0.8'; };
        closeButton.onmouseout = function() { this.style.opacity = '1'; };
        closeButton.onclick = function() {
            modal.remove();
        };
        
        buttonContainer.appendChild(copyLinkButton);
        buttonContainer.appendChild(copyCodeButton);
        buttonContainer.appendChild(closeButton);
        
        modalContent.appendChild(title);
        modalContent.appendChild(description);
        modalContent.appendChild(linkLabel);
        modalContent.appendChild(linkInput);
        modalContent.appendChild(embedLabel);
        modalContent.appendChild(embedTextarea);
        modalContent.appendChild(tipBox);
        modalContent.appendChild(buttonContainer);
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        modal.onclick = function(e) {
            if (e.target === modal) {
                modal.remove();
            }
        };
    }
</script>

<jsp:include page="footer.jsp"/> 
<%
    }
%>
