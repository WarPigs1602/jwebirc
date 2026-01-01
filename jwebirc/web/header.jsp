<%-- 
    Document   : header
    Created on : 17.08.2024, 13:38:44
    Author     : Andreas Pschorn
    Updated    : 31.12.2025
--%>

<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
    // Set X-Frame-Options based on chatnapping configuration
    String chatnappingEnabled = (String) session.getAttribute("chatnapping_enabled");
    String allowedDomains = (String) session.getAttribute("chatnapping_allowed_domains");
    
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
<html lang="en">
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
        <link rel="stylesheet" href="file/bootstrap/css/bootstrap.min.css" type="text/css">
        <link rel="stylesheet" href="file/style.css" type="text/css">
        
        <!-- Icons -->
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" crossorigin="anonymous">
        
        <!-- Scripts -->
        <script src="file/jquery.js"></script>
        <script src="file/login-options.js"></script>
    </head>
    <body>
        <!-- Login Options Menu Button -->
        <div id="loginOptionsContainer" style="position: fixed; top: 10px; right: 10px; z-index: 1000;">
            <button class="nav-action-btn" id="loginOptionsToggle" aria-haspopup="true" aria-expanded="false" title="Display Options">
                <i class="fas fa-cog"></i>
            </button>
            
            <!-- Login Options Dropdown -->
            <div class="nav-dropdown" id="loginOptionsMenu" role="menu">
                <div class="nav-dropdown-header">
                    <i class="fas fa-sliders-h"></i>
                    <span>Display Options</span>
                </div>
                <div class="nav-dropdown-content">
                    <div class="nav-dropdown-item slider-item">
                        <div class="nav-dropdown-item-header">
                            <i class="fas fa-text-height"></i>
                            <span>Font Size</span>
                            <span class="nav-slider-value" id="loginFontSizeValue">14px</span>
                        </div>
                        <div class="nav-slider-wrapper">
                            <input type="range" id="loginOptFontSize" min="12" max="18" step="1" value="14" class="nav-range-slider">
                            <div class="nav-slider-track"></div>
                        </div>
                    </div>
                    <div class="nav-dropdown-divider"></div>
                    <div class="nav-dropdown-item slider-item">
                        <div class="nav-dropdown-item-header">
                            <i class="fas fa-palette"></i>
                            <span>Hue</span>
                            <span class="nav-slider-value" id="loginHueValue">0°</span>
                        </div>
                        <div class="nav-slider-wrapper">
                            <input type="range" id="loginOptHue" min="0" max="360" step="1" value="0" class="nav-range-slider hue-slider">
                            <div class="nav-slider-track hue-track"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>