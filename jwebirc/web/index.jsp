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
        paramN = paramN.replace("%", String.valueOf((int) (Math.random() * 9)));
    }
    var paramConnect = request.getParameter("connect");
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
<div class="login-container">
    <div class="login-card">
        <div class="login-header">
            <i class="fas fa-comments fa-3x" style="color: var(--primary-color); margin-bottom: 1rem;"></i>
            <h2>MidiAndMore IRC</h2>
                <p class="text-muted">Join the chat</p>
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
        
        <form method="POST" name="login" action="" target="_top" accept-charset="utf-8" class="login-form">
            <input name="connect" value="true" type="hidden">
            
            <div class="form-floating mb-3">
                <input class="form-control" 
                       id="nickInput"
                       maxlength="15" 
                       name="nick" 
                       value="<% out.print(paramN); %>" 
                       required
                       autocomplete="nickname"
                       pattern="[a-zA-Z0-9_\-\[\]\{\}\\\|]+">
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
                       autocomplete="off">
                <label for="channelInput">
                    <i class="fas fa-hashtag"></i> Channel (optional)
                </label>
            </div>
            
            <% if (saslEnabled != null && saslEnabled.equalsIgnoreCase("true")) { %>
            <div class="form-check mb-3" style="padding-left: 0; display: flex; align-items: center; gap: 10px;">
                <input class="form-check-input" type="checkbox" id="useSaslAuth" name="useSasl" value="true" onchange="toggleSaslFields()" style="width: 20px; height: 20px; margin: 0; cursor: pointer;">
                <label class="form-check-label" for="useSaslAuth" style="margin: 0; cursor: pointer; font-size: 1rem; color: #f0f0f0;">
                    <i class="fas fa-key" style="margin-right: 6px;"></i> I have a password (SASL Authentication)
                </label>
            </div>
            
            <div id="saslFields" style="display: none;">
                <div class="form-floating mb-3">
                    <input class="form-control" 
                           id="saslUsername"
                           maxlength="50" 
                           name="saslUsername" 
                           autocomplete="username">
                    <label for="saslUsername">
                        <i class="fas fa-user-shield"></i> Auth name
                    </label>
                </div>
                
                <div class="form-floating mb-3">
                    <input class="form-control" 
                           type="password"
                           id="saslPassword"
                           maxlength="200" 
                           name="saslPassword" 
                           autocomplete="current-password">
                    <label for="saslPassword">
                        <i class="fas fa-lock"></i> Auth password
                    </label>
                </div>
            </div>
            <% } %>
            
                <button class="btn btn-primary btn-lg w-100" type="submit">
                    <i class="fas fa-sign-in-alt"></i> Join chat
            </button>
        </form>
        
        <div class="login-footer">
            <small class="text-muted">
                    <i class="fas fa-shield-alt"></i> Secure connection &bull; 
                    <i class="fas fa-globe"></i> WebSocket supported
            </small>
        </div>
    </div>
</div>
<jsp:include page="footer.jsp"/> 
<%
    }
%>
