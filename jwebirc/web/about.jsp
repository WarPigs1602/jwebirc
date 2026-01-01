<%-- 
    Document   : about
    Created on : 31.12.2025
    Author     : Andreas Pschorn
--%>

<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%@include file="init.jsp"%>
<%
    // Set session attributes from config
    session.setAttribute("webchat_name", webchatName);
    session.setAttribute("webchat_title", webchatTitle);
    session.setAttribute("irc_network_name", ircNetworkName);
    session.setAttribute("irc_network_description", ircNetworkDescription);
    session.setAttribute("irc_network_keywords", ircNetworkKeywords);
    session.setAttribute("webchat_host", webchatHost);
    session.setAttribute("webchat_port", webchatPort);
    session.setAttribute("webchat_ssl", webchatSsl);
%>
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        
        <title>About - <%= session.getAttribute("webchat_title") != null ? session.getAttribute("webchat_title") : "IRC Web Client" %></title>
        
        <!-- Meta Tags -->
        <meta name="author" content="Andreas Pschorn">
        <meta name="description" content="<%= session.getAttribute("irc_network_description") != null ? session.getAttribute("irc_network_description") : "Web-based IRC client" %>">
        <meta name="keywords" content="<%= session.getAttribute("irc_network_keywords") != null ? session.getAttribute("irc_network_keywords") : "IRC, WebChat, Chat" %>">
        <meta name="theme-color" content="#990000">
        
        <!-- Favicon -->
        <link rel="icon" type="image/svg+xml" href="file/logo.svg">
        <link rel="icon" type="image/png" sizes="32x32" href="file/favicon-32x32.png">
        <link rel="shortcut icon" href="file/favicon.ico">
        
        <!-- Stylesheets -->
        <link rel="stylesheet" href="file/bootstrap/css/bootstrap.min.css" type="text/css">
        <link rel="stylesheet" href="file/style.css" type="text/css">
        
        <!-- Icons -->
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" crossorigin="anonymous">
        
        <!-- Scripts -->
        <script src="file/jquery.js"></script>
        
        <style>
            /* Force page to be scrollable */
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            html {
                height: 100%;
                overflow-y: scroll;
                overflow-x: hidden;
            }
            
            body {
                min-height: 100%;
                height: auto;
                position: relative;
                overflow-x: hidden;
            }
            
            /* Custom Scrollbar */
            ::-webkit-scrollbar {
                width: 8px;
                height: 8px;
            }

            ::-webkit-scrollbar-track {
                background: var(--background-secondary);
                border-radius: 4px;
            }

            ::-webkit-scrollbar-thumb {
                background: var(--background-tertiary);
                border-radius: 4px;
                transition: background 0.3s ease;
            }

            ::-webkit-scrollbar-thumb:hover {
                background: var(--background-hover);
            }
            
            /* Override fixed positioning completely */
            .login-container {
                position: static !important;
                height: auto !important;
                min-height: 100vh !important;
                max-height: none !important;
                padding: 2rem 1rem !important;
                overflow: visible !important;
                display: block !important;
            }
            
            .login-card {
                max-width: 900px !important;
                height: auto !important;
                max-height: none !important;
                overflow: visible !important;
                margin: 0 auto !important;
                position: relative !important;
            }
            
            .about-section {
                margin-bottom: 2rem;
            }
            
            /* Logo Animation */
            .logo-container {
                text-align: center;
                margin-bottom: 2rem;
                padding: 2rem 0;
            }
            
            .animated-logo {
                width: 150px;
                height: 150px;
                animation: fadeInScale 1.5s ease-out;
            }
            
            @keyframes fadeInScale {
                0% {
                    opacity: 0;
                    transform: scale(0.5) rotate(-10deg);
                }
                60% {
                    transform: scale(1.1) rotate(2deg);
                }
                100% {
                    opacity: 1;
                    transform: scale(1) rotate(0deg);
                }
            }
            
            .animated-logo:hover {
                animation: pulse 1s ease-in-out infinite;
            }
            
            @keyframes pulse {
                0%, 100% {
                    transform: scale(1);
                }
                50% {
                    transform: scale(1.05);
                }
            }
            
            .about-section h2 {
                color: var(--primary-color);
                margin-bottom: 1rem;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                font-size: 1.5rem;
            }
            
            .about-section h3 {
                color: #ffffff;
                margin-top: 1.5rem;
                margin-bottom: 0.75rem;
                font-size: 1.2rem;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .info-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 1rem;
                margin: 1.5rem 0;
            }
            
            .info-item {
                background: rgba(255, 255, 255, 0.05);
                padding: 1rem;
                border-radius: 6px;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .info-item strong {
                color: var(--primary-color);
                display: block;
                margin-bottom: 0.5rem;
            }
            
            .info-item span {
                color: #b3b3b3;
            }
            
            .feature-list {
                list-style: none;
                padding: 0;
                margin: 1rem 0;
            }
            
            .feature-list li {
                padding: 0.75rem 1rem;
                margin-bottom: 0.5rem;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 4px;
                border-left: 3px solid var(--primary-color);
                color: #b3b3b3;
            }
            
            .feature-list li i {
                color: var(--primary-color);
                margin-right: 0.75rem;
                width: 20px;
            }
            
            .tech-badges {
                display: flex;
                flex-wrap: wrap;
                gap: 0.5rem;
                margin: 1rem 0;
            }
            
            .tech-badge {
                display: inline-block;
                padding: 0.4rem 0.8rem;
                background: var(--primary-color);
                color: white;
                border-radius: 20px;
                font-size: 0.9rem;
            }
            
            .back-link {
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                color: var(--primary-color);
                text-decoration: none;
                padding: 0.75rem 1.5rem;
                border: 1px solid var(--primary-color);
                border-radius: 4px;
                transition: all 0.2s;
                margin-top: 1rem;
            }
            
            .back-link:hover {
                background: var(--primary-color);
                color: white;
                text-decoration: none;
            }
            
            @media (max-width: 768px) {
                .info-grid {
                    grid-template-columns: 1fr;
                }
            }
        </style>
        <script>
            // Apply UI preferences from localStorage (Hue and Font Size)
            // Run immediately before rendering to avoid flickering
            (function() {
                try {
                    const saved = localStorage.getItem('jwebirc_ui');
                    if (saved) {
                        const prefs = JSON.parse(saved);
                        // Apply hue rotation filter
                        if (prefs.hue !== undefined && prefs.hue !== null) {
                            const hue = parseInt(prefs.hue, 10) || 0;
                            document.documentElement.style.setProperty('--hue-rotate', hue + 'deg');
                        }
                        // Apply font size
                        if (prefs.fontSize !== undefined && prefs.fontSize !== null) {
                            const fontSize = Math.min(Math.max(parseInt(prefs.fontSize, 10) || 14, 12), 18);
                            document.documentElement.style.setProperty('--font-size-base', fontSize + 'px');
                        }
                    }
                } catch (e) {
                    console.error('Error applying UI preferences:', e);
                }
            })();
        </script>
    </head>
    <body>

<div class="login-container">
    <div class="login-card">
        <div class="login-header">
            <div class="logo-container">
                <img src="file/logo.svg" alt="jWebIRC Logo" class="animated-logo">
            </div>
            <h2>About jWebIRC</h2>
            <p class="text-muted"><%= session.getAttribute("irc_network_description") != null ? session.getAttribute("irc_network_description") : "Modern web-based IRC client" %></p>
        </div>
        
        <div class="about-section">
            <h3>
                <i class="fas fa-code"></i>
                Software Architecture
            </h3>
            
            <div class="info-grid">
                <div class="info-item">
                    <strong><i class="fab fa-java"></i> Backend</strong>
                    <span>Java WebSocket Gateway</span>
                </div>
                <div class="info-item">
                    <strong><i class="fab fa-js"></i> Frontend</strong>
                    <span>JavaScript ES6+</span>
                </div>
                <div class="info-item">
                    <strong><i class="fas fa-plug"></i> Protocol</strong>
                    <span>IRC + IRCv3 Extensions</span>
                </div>
                <div class="info-item">
                    <strong><i class="fas fa-network-wired"></i> Communication</strong>
                    <span>WebSocket (RFC 6455)</span>
                </div>
            </div>
        </div>
        
        <div class="about-section">
            <h3>
                <i class="fas fa-puzzle-piece"></i>
                APIs & Protocols
            </h3>
            
            <p class="text-muted" style="margin-bottom: 1rem;">
                This application implements and integrates various APIs and protocols:
            </p>
            
            <ul class="feature-list">
                <li>
                    <i class="fas fa-comments"></i> 
                    <strong>IRC Protocol (RFC 1459, RFC 2812)</strong><br>
                    <span style="font-size: 0.9em; opacity: 0.8;">Standard Internet Relay Chat protocol for messaging and channel management</span>
                </li>
                <li>
                    <i class="fas fa-plug"></i> 
                    <strong>IRCv3 Extensions</strong><br>
                    <span style="font-size: 0.9em; opacity: 0.8;">
                        • message-tags: Client metadata transmission<br>
                        • SASL: Simple Authentication and Security Layer<br>
                        • multi-prefix: Multiple user mode symbols<br>
                        • capability-negotiation: Feature discovery
                    </span>
                </li>
                <li>
                    <i class="fas fa-exchange-alt"></i> 
                    <strong>WebSocket API (RFC 6455)</strong><br>
                    <span style="font-size: 0.9em; opacity: 0.8;">Full-duplex communication protocol for real-time bidirectional data transfer</span>
                </li>
                <li>
                    <i class="fas fa-network-wired"></i> 
                    <strong>WEBIRC Protocol</strong><br>
                    <span style="font-size: 0.9em; opacity: 0.8;">Transparent client IP forwarding for IRC servers with HMAC authentication</span>
                </li>
                <li>
                    <i class="fas fa-terminal"></i> 
                    <strong>CTCP (Client-to-Client Protocol)</strong><br>
                    <span style="font-size: 0.9em; opacity: 0.8;">Extended IRC commands: VERSION, PING, ACTION, TIME, CLIENTINFO</span>
                </li>
            </ul>
        </div>
        
        <div class="about-section">
            <h3>
                <i class="fas fa-box-open"></i>
                External APIs & Services
            </h3>
            
            <ul class="feature-list">
                <li>
                    <i class="fab fa-cloudflare"></i> 
                    <strong>Cloudflare Turnstile API</strong><br>
                    <span style="font-size: 0.9em; opacity: 0.8;">Privacy-first CAPTCHA alternative for bot protection</span>
                </li>
                <li>
                    <i class="fab fa-google"></i> 
                    <strong>Google reCAPTCHA API (v2/v3/Enterprise)</strong><br>
                    <span style="font-size: 0.9em; opacity: 0.8;">Advanced bot detection and abuse prevention service</span>
                </li>
                <li>
                    <i class="fas fa-font"></i> 
                    <strong>Font Awesome Icons API</strong><br>
                    <span style="font-size: 0.9em; opacity: 0.8;">Vector icon library via CDN (v6.5.1)</span>
                </li>
            </ul>
        </div>
        
        <div class="about-section">
            <h3>
                <i class="fas fa-book-open"></i>
                Libraries & Dependencies
            </h3>
            
            <div class="tech-badges" style="margin-bottom: 1rem;">
                <span class="tech-badge"><i class="fab fa-java"></i> Jakarta WebSocket API</span>
                <span class="tech-badge"><i class="fab fa-java"></i> Jakarta Servlet API</span>
                <span class="tech-badge"><i class="fab fa-js"></i> jQuery 3.x</span>
                <span class="tech-badge"><i class="fab fa-bootstrap"></i> Bootstrap 5</span>
                <span class="tech-badge"><i class="fas fa-code"></i> JSP/JSTL</span>
                <span class="tech-badge"><i class="fab fa-html5"></i> HTML5 APIs</span>
                <span class="tech-badge"><i class="fab fa-css3-alt"></i> CSS3 Variables</span>
            </div>
            
            <p class="text-muted" style="font-size: 0.9em;">
                <strong>Backend:</strong> Java servlet container (Apache Tomcat, Jakarta EE compatible)<br>
                <strong>Frontend:</strong> Vanilla JavaScript ES6+, jQuery for DOM manipulation<br>
                <strong>Styling:</strong> Custom CSS with Bootstrap components
            </p>
        </div>
        
        <div class="about-section">
            <h3>
                <i class="fas fa-shield-alt"></i>
                Security Features
            </h3>
            
            <ul class="feature-list">
                <li><i class="fas fa-lock"></i> <strong>SASL Authentication</strong> - Secure account login before joining channels</li>
                <li><i class="fas fa-lock"></i> <strong>SSL/TLS Support</strong> - Encrypted connection to IRC servers</li>
                <li><i class="fas fa-robot"></i> <strong>CAPTCHA Integration</strong> - Cloudflare Turnstile, Google reCAPTCHA v2/v3/Enterprise</li>
                <li><i class="fas fa-lock"></i> <strong>HMAC Validation</strong> - Secure client authentication</li>
                <li><i class="fas fa-lock"></i> <strong>XSS Protection</strong> - HTML entity escaping with IRC control code preservation</li>
                <li><i class="fas fa-lock"></i> <strong>IP Forwarding Security</strong> - Trusted proxy IP validation</li>
            </ul>
        </div>
        
        <div class="about-section">
            <h3>
                <i class="fas fa-star"></i>
                Client Features
            </h3>
            
            <ul class="feature-list">
                <li><i class="fas fa-check-circle"></i> Modern web-based interface - no installation required</li>
                <li><i class="fas fa-check-circle"></i> Real-time communication via persistent WebSocket connection</li>
                <li><i class="fas fa-check-circle"></i> Full IRC formatting support (colors, bold, italic, underline, strikethrough, monospace)</li>
                <li><i class="fas fa-check-circle"></i> Keyboard shortcuts for formatting (Ctrl+B, Ctrl+I, Ctrl+U, etc.)</li>
                <li><i class="fas fa-check-circle"></i> Multiple channel support with tab-based navigation</li>
                <li><i class="fas fa-check-circle"></i> Private messaging (query windows)</li>
                <li><i class="fas fa-check-circle"></i> Emoji picker with search and categories</li>
                <li><i class="fas fa-check-circle"></i> Typing indicators for active users (IRCv3 TAGMSG)</li>
                <li><i class="fas fa-check-circle"></i> User list with status symbols (@, +, etc.)</li>
                <li><i class="fas fa-check-circle"></i> Topic display and editing</li>
                <li><i class="fas fa-check-circle"></i> Auto-reconnect on connection loss</li>
                <li><i class="fas fa-check-circle"></i> Responsive design for mobile and desktop</li>
            </ul>
        </div>
               
        <div class="about-section">
            <h3>
                <i class="fas fa-code-branch"></i>
                Technology Stack
            </h3>
            
            <div class="info-grid">
                <div class="info-item">
                    <strong><i class="fab fa-java"></i> Backend Framework</strong>
                    <span>Jakarta EE / Java Servlets</span>
                </div>
                <div class="info-item">
                    <strong><i class="fab fa-js"></i> Frontend Language</strong>
                    <span>JavaScript ES6+ / ECMAScript 2015+</span>
                </div>
                <div class="info-item">
                    <strong><i class="fas fa-database"></i> Data Format</strong>
                    <span>JSON for WebSocket messages</span>
                </div>
                <div class="info-item">
                    <strong><i class="fas fa-globe"></i> Web Standards</strong>
                    <span>HTML5, CSS3, WebSocket API</span>
                </div>
            </div>
        </div>
        
        <div class="about-section">
            <h3>
                <i class="fas fa-balance-scale"></i>
                License & Copyright
            </h3>
            
            <div style="background: rgba(255, 255, 255, 0.05); padding: 1.5rem; border-radius: 6px; border-left: 3px solid var(--primary-color); margin-bottom: 1rem;">
                <p style="margin-bottom: 0.75rem;"><strong style="color: var(--primary-color);">MIT License</strong></p>
                <p class="text-muted" style="margin-bottom: 0.75rem; font-size: 0.95em;">
                    Copyright © 2024-2025 Andreas Pschorn
                </p>
                <p class="text-muted" style="font-size: 0.9em; line-height: 1.6;">
                    Permission is hereby granted, free of charge, to any person obtaining a copy
                    of this software and associated documentation files (the "Software"), to deal
                    in the Software without restriction, including without limitation the rights
                    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
                    copies of the Software, and to permit persons to whom the Software is
                    furnished to do so, subject to the following conditions:
                </p>
                <p class="text-muted" style="font-size: 0.9em; line-height: 1.6; margin-top: 0.75rem;">
                    The above copyright notice and this permission notice shall be included in all
                    copies or substantial portions of the Software.
                </p>
                <p class="text-muted" style="font-size: 0.85em; line-height: 1.6; margin-top: 0.75rem; font-style: italic;">
                    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
                    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
                    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
                </p>
            </div>
            
            <p class="text-muted" style="font-size: 0.9em;">
                <i class="fab fa-github"></i> Source code available at: 
                <a href="https://github.com/WarPigs1602/jwebirc" target="_blank" style="color: var(--primary-color);">
                    github.com/WarPigs1602/jwebirc
                </a>
            </p>
        </div>
        
        <div class="about-section">
            <h3>
                <i class="fas fa-heart"></i>
                Third-Party Acknowledgments
            </h3>
            
            <ul class="feature-list" style="font-size: 0.95em;">
                <li>
                    <i class="fab fa-bootstrap"></i> 
                    <strong><a href="https://getbootstrap.com/" target="_blank" style="color: var(--primary-color); text-decoration: none;">Bootstrap</a></strong> - Licensed under MIT License
                </li>
                <li>
                    <i class="fab fa-font-awesome"></i> 
                    <strong><a href="https://fontawesome.com/" target="_blank" style="color: var(--primary-color); text-decoration: none;">Font Awesome</a></strong> - Icons licensed under CC BY 4.0, Fonts under SIL OFL 1.1, Code under MIT License
                </li>
                <li>
                    <i class="fas fa-code"></i> 
                    <strong><a href="https://jquery.com/" target="_blank" style="color: var(--primary-color); text-decoration: none;">jQuery</a></strong> - Licensed under MIT License
                </li>
                <li>
                    <i class="fab fa-google"></i> 
                    <strong><a href="https://www.google.com/recaptcha/" target="_blank" style="color: var(--primary-color); text-decoration: none;">Google reCAPTCHA</a></strong> - Subject to Google Terms of Service
                </li>
                <li>
                    <i class="fab fa-cloudflare"></i> 
                    <strong><a href="https://www.cloudflare.com/products/turnstile/" target="_blank" style="color: var(--primary-color); text-decoration: none;">Cloudflare Turnstile</a></strong> - Subject to Cloudflare Terms of Service
                </li>
            </ul>
        </div>
        
        <div class="about-section">
            <h3>
                <i class="fas fa-question-circle"></i>
                Getting Started
            </h3>
            
            <p class="text-muted">
                To connect to the IRC network:
            </p>
            
            <ol style="color: #b3b3b3; line-height: 1.8; margin-left: 1.5rem; margin-bottom: 1rem;">
                <li>Enter your desired nickname on the login page</li>
                <li>Optionally specify channels to join (comma-separated)</li>
                <li>Complete any required CAPTCHA verification</li>
                <li>Click "Connect" to join the network</li>
            </ol>
            
            <p class="text-muted">
                Once connected, you can use standard IRC commands like <code style="background: rgba(255, 255, 255, 0.1); padding: 0.2rem 0.5rem; border-radius: 3px; color: var(--primary-color);">/join</code>, 
                <code style="background: rgba(255, 255, 255, 0.1); padding: 0.2rem 0.5rem; border-radius: 3px; color: var(--primary-color);">/msg</code>, 
                <code style="background: rgba(255, 255, 255, 0.1); padding: 0.2rem 0.5rem; border-radius: 3px; color: var(--primary-color);">/nick</code>, and more.
            </p>
        </div>
        
        <div class="login-footer" style="text-align: center; margin-top: 2rem;">
            <a href="index.jsp" class="back-link">
                <i class="fas fa-arrow-left"></i>
                Back to Login
            </a>
        </div>
    </div>
</div>

<jsp:include page="footer.jsp"/>
