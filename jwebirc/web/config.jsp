<%-- 
    Document   : config
    Created on : 17.08.2024, 15:37:18
    Author     : Andreas Pschorn
--%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%!
    String webchatSessionTimeout = "300000";
    String sessionTimeout = "500";
    String webchatHost = "localhost";
    String webchatBind = "127.0.0.1";
    String webchatPort = "6669";
    String webchatSsl = "false";
    String webchatServerPassword = "";
    String webchatIdent = "webchat";
    String webchatUser = "jwebirc";
    String webchatPassword = "password";
    String webchatRealname = "https://irc.midiandmore.net/";
    String webchatName = "jWebIRC"; // Chat application name
    String webchatTitle = "jWebIRC - IRC Web Client"; // Browser title
    String ircNetworkName = "jWebIRC"; // IRC Network display name
    String ircNetworkDescription = "Modern web-based IRC client"; // IRC Network description
    String ircNetworkKeywords = "IRC, WebChat, Chat, Internet Relay Chat, jWebIRC"; // SEO keywords
    String forwardedForHeader = "X-Forwarded-For";
    String forwardedForIps = "127.0.0.1";
    String webircMode = "WEBIRC";
    String webircCgi = "CGIIRC";
    String hmacTemporal = "1337";
    String saslEnabled = "true"; // Enable SASL authentication option in login form
    
    // =============== CAPTCHA Configuration ===============
    // CAPTCHA Type: NONE, TURNSTILE, RECAPTCHA_V2, RECAPTCHA_V3, RECAPTCHA_ENTERPRISE
    String captchaEnabled = "false"; // Set to "true" to enable CAPTCHA
    String captchaType = "TURNSTILE"; // Choose: TURNSTILE, RECAPTCHA_V2, RECAPTCHA_V3, RECAPTCHA_ENTERPRISE
    
    // Cloudflare Turnstile Configuration
    String turnstileSiteKey = "1x00000000000000000000AA"; // Your Turnstile site key (visible)
    String turnstileSecretKey = "1x0000000000000000000000000000000AA"; // Your Turnstile secret key (server-side)
    
    // Google reCAPTCHA v2 Configuration
    String recaptchaV2SiteKey = "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"; // Your reCAPTCHA v2 site key
    String recaptchaV2SecretKey = "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe"; // Your reCAPTCHA v2 secret key
    
    // Google reCAPTCHA v3 Configuration
    String recaptchaV3SiteKey = "6LdqmCAqAAAAAJLpfQv9hGgYmHl8xT5qT3l6v8Z7"; // Your reCAPTCHA v3 site key
    String recaptchaV3SecretKey = "6LdqmCAqAAAAAI5qX5gT7pY8xC2fV9hN4mR6wL3k"; // Your reCAPTCHA v3 secret key
    String recaptchaV3MinScore = "0.5"; // Minimum score (0.0 to 1.0, typically 0.5)
    
    // Google reCAPTCHA Enterprise Configuration
    String recaptchaEnterpriseEnabled = "false"; // Set to "true" for Enterprise
    String recaptchaEnterpriseProjectId = "your-project-id"; // Your Google Cloud project ID
    String recaptchaEnterpriseSiteKey = "your-site-key"; // Your reCAPTCHA Enterprise site key
    String recaptchaEnterpriseApiKey = "your-api-key"; // Your Google Cloud API key
    String recaptchaEnterpriseMinScore = "0.5"; // Minimum score (0.0 to 1.0)
    
    // =============== CHATNAPPING Configuration ===============
    // Chatnapping allows embedding the webchat on external websites via iframe
    String chatnappingEnabled = "true"; // Set to "false" to disable chatnapping feature
    String chatnappingAllowedDomains = "*"; // Comma-separated list of allowed domains, or "*" for all (e.g., "example.com,test.org")
    String chatnappingDefaultNick = "Guest*"; // Default nickname for embed links (* = random digit placeholder)
    String chatnappingDefaultChannel = "#lobby"; // Default channel for embed links (empty = no channel)
    
    // =============== ERROR HANDLING Configuration ===============
    // Error page configuration for debugging
    String showStackTrace = "true"; // Set to "false" to hide stack traces in production
    String errorPageStyle = "detailed"; // "detailed" = full stack trace, "simple" = user-friendly message only
%>
