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

<div class="chat-container">
    <!-- Navigation Bar -->
    <div class="top_frame" id="nav_window" role="navigation" aria-label="Channel Navigation">
        <div class="nav-header">
            <i class="fas fa-server"></i> <span class="nav-title">Channels</span>
        </div>
    </div>
    
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
    
    // Hide loading screen when page is ready
    window.addEventListener('load', function() {
        setTimeout(function() {
            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen) {
                loadingScreen.classList.add('hidden');
            }
        }, 500);
        
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
</script>

<jsp:include page="footer.jsp"/> 
<%
    }
%>
