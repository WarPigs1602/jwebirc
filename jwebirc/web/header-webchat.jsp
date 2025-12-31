<%-- 
    Document   : header-webchat
    Created on : 17.08.2024, 13:38:44
    Author     : Andreas Pschorn
    Updated    : 31.12.2025
--%>

<%@page contentType="text/html" pageEncoding="UTF-8"%>
<!DOCTYPE html>
<html lang="en" data-theme="dark">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
        
        <title><%= session.getAttribute("webchat_title") != null ? session.getAttribute("webchat_title") : "IRC Web Client" %></title>
        
        <!-- Meta Tags -->
        <meta name="author" content="Andreas Pschorn">
        <meta name="description" content="<%= session.getAttribute("irc_network_description") != null ? session.getAttribute("irc_network_description") : "Modern web-based IRC client" %>">
        <meta name="keywords" content="<%= session.getAttribute("irc_network_keywords") != null ? session.getAttribute("irc_network_keywords") : "IRC, WebChat, Chat, Internet Relay Chat" %>">
        <meta name="application-name" content="<%= session.getAttribute("webchat_name") != null ? session.getAttribute("webchat_name") : "jWebIRC" %>">
        <meta name="theme-color" content="#990000">
        
        <!-- Open Graph / Social Media -->
        <meta property="og:type" content="website">
        <meta property="og:title" content="<%= session.getAttribute("webchat_title") != null ? session.getAttribute("webchat_title") : "IRC Web Client" %>">
        <meta property="og:description" content="Modern web-based IRC client">
        
        <!-- Favicon -->
        <link rel="icon" type="image/svg+xml" href="file/logo.svg">
        <link rel="icon" type="image/png" sizes="32x32" href="file/favicon-32x32.png">
        <link rel="shortcut icon" href="file/favicon.ico">
        
        <!-- Stylesheets -->
        <link rel="preload" href="file/style.css" as="style">
        <link rel="stylesheet" href="file/bootstrap/css/bootstrap.min.css" type="text/css">
        <link rel="stylesheet" media="screen" href="file/style.css" type="text/css">
        <link rel="stylesheet" href="file/emoji-picker.css" type="text/css">
        
        <!-- Icons -->
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==" crossorigin="anonymous" referrerpolicy="no-referrer">
        
        <!-- Scripts -->
        <script src="file/jquery.js"></script>
        <script src="file/emoji-picker.js"></script>
        
        <style>
            /* Loading Animation */
            .loading-screen {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, var(--primary-dark) 0%, #4a0000 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                transition: opacity 0.5s ease;
            }
            
            .loading-screen.hidden {
                opacity: 0;
                pointer-events: none;
            }
            
            .loading-spinner {
                width: 50px;
                height: 50px;
                border: 4px solid rgba(255, 255, 255, 0.1);
                border-top-color: var(--primary-color);
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            
            /* Mobile Keyboard Support */
            @media (max-width: 768px) {
                html, body {
                    position: fixed;
                    width: 100%;
                    height: 100%;
                }
                
                .chat-container {
                    height: 100dvh !important;
                }
            }
        </style>
    </head>
    <body>
        <div class="loading-screen" id="loadingScreen">
            <div class="loading-spinner"></div>
        </div>