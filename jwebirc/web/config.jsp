<%-- 
    Document   : config
    Created on : 17.08.2024, 15:37:18
    Author     : Andreas Pschorn
--%>
<%@page contentType="text/html" pageEncoding="UTF-8" import="jakarta.servlet.ServletContext"%>
<%!
    private String param(ServletContext ctx, String name, String defaultValue) {
        String value = ctx.getInitParameter(name);
        return value != null ? value : defaultValue;
    }
%>
<%
    ServletContext ctx = application;

    String webchatSessionTimeout = param(ctx, "jwebirc.webchatSessionTimeout", "300000");
    String sessionTimeout = param(ctx, "jwebirc.sessionTimeout", "500");
    String webchatHost = param(ctx, "jwebirc.webchatHost", "localhost");
    String webchatBind = param(ctx, "jwebirc.webchatBind", "127.0.0.1");
    String webchatPort = param(ctx, "jwebirc.webchatPort", "6669");
    String webchatSsl = param(ctx, "jwebirc.webchatSsl", "false");
    String webchatServerPassword = param(ctx, "jwebirc.webchatServerPassword", "");
    String webchatIdent = param(ctx, "jwebirc.webchatIdent", "webchat");
    String webchatUser = param(ctx, "jwebirc.webchatUser", "jwebirc");
    String webchatPassword = param(ctx, "jwebirc.webchatPassword", "password");
    String webchatRealname = param(ctx, "jwebirc.webchatRealname", "https://irc.midiandmore.net/");
    String webchatName = param(ctx, "jwebirc.webchatName", "jWebIRC");
    String webchatTitle = param(ctx, "jwebirc.webchatTitle", "jWebIRC - IRC Web Client");
    String ircNetworkName = param(ctx, "jwebirc.ircNetworkName", "jWebIRC");
    String ircNetworkDescription = param(ctx, "jwebirc.ircNetworkDescription", "Modern web-based IRC client");
    String ircNetworkKeywords = param(ctx, "jwebirc.ircNetworkKeywords", "IRC, WebChat, Chat, Internet Relay Chat, jWebIRC");
    String forwardedForHeader = param(ctx, "jwebirc.forwardedForHeader", "X-Forwarded-For");
    String forwardedForIps = param(ctx, "jwebirc.forwardedForIps", "127.0.0.1");
    String webircMode = param(ctx, "jwebirc.webircMode", "WEBIRC");
    String webircCgi = param(ctx, "jwebirc.webircCgi", "CGIIRC");
    String hmacTemporal = param(ctx, "jwebirc.hmacTemporal", "1337");
    String saslEnabled = param(ctx, "jwebirc.saslEnabled", "true");

    String captchaEnabled = param(ctx, "jwebirc.captchaEnabled", "false");
    String captchaType = param(ctx, "jwebirc.captchaType", "TURNSTILE");
    String turnstileSiteKey = param(ctx, "jwebirc.turnstileSiteKey", "1x00000000000000000000AA");
    String turnstileSecretKey = param(ctx, "jwebirc.turnstileSecretKey", "1x0000000000000000000000000000000AA");
    String recaptchaV2SiteKey = param(ctx, "jwebirc.recaptchaV2SiteKey", "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI");
    String recaptchaV2SecretKey = param(ctx, "jwebirc.recaptchaV2SecretKey", "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe");
    String recaptchaV3SiteKey = param(ctx, "jwebirc.recaptchaV3SiteKey", "6LdqmCAqAAAAAJLpfQv9hGgYmHl8xT5qT3l6v8Z7");
    String recaptchaV3SecretKey = param(ctx, "jwebirc.recaptchaV3SecretKey", "6LdqmCAqAAAAAI5qX5gT7pY8xC2fV9hN4mR6wL3k");
    String recaptchaV3MinScore = param(ctx, "jwebirc.recaptchaV3MinScore", "0.5");
    String recaptchaEnterpriseEnabled = param(ctx, "jwebirc.recaptchaEnterpriseEnabled", "false");
    String recaptchaEnterpriseProjectId = param(ctx, "jwebirc.recaptchaEnterpriseProjectId", "your-project-id");
    String recaptchaEnterpriseSiteKey = param(ctx, "jwebirc.recaptchaEnterpriseSiteKey", "your-site-key");
    String recaptchaEnterpriseApiKey = param(ctx, "jwebirc.recaptchaEnterpriseApiKey", "your-api-key");
    String recaptchaEnterpriseMinScore = param(ctx, "jwebirc.recaptchaEnterpriseMinScore", "0.5");

    String chatnappingEnabled = param(ctx, "jwebirc.chatnappingEnabled", "true");
    String chatnappingAllowedDomains = param(ctx, "jwebirc.chatnappingAllowedDomains", "*");
    String chatnappingDefaultNick = param(ctx, "jwebirc.chatnappingDefaultNick", "Guest*");
    String chatnappingDefaultChannel = param(ctx, "jwebirc.chatnappingDefaultChannel", "#lobby");

    String showStackTrace = param(ctx, "jwebirc.showStackTrace", "true");
    String errorPageStyle = param(ctx, "jwebirc.errorPageStyle", "detailed");
%>
