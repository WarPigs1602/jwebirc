<%-- 
    Document   : 500
    Created on : 01.01.2026
    Author     : Andreas Pschorn
--%>
<%-- 
    Document   : 500
    Created on : 01.01.2026
    Author     : Andreas Pschorn
--%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%@page isErrorPage="true"%>
<%@include file="error-config.jsp" %>
<%
    // Use configuration from error-config.jsp
    String showStackTraceConfig = SHOW_STACK_TRACE;
    String errorPageStyleConfig = ERROR_PAGE_STYLE;
%>
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>500 - Internal Server Error</title>
        <link rel="stylesheet" href="<%= request.getContextPath() %>/file/bootstrap/css/bootstrap.min.css">
        <link rel="stylesheet" href="<%= request.getContextPath() %>/file/style.css">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" crossorigin="anonymous">
        <style>
            .error-container {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: var(--spacing-md);
                background: var(--background-main);
                overflow-y: auto;
            }
            .error-card {
                background: rgba(45, 45, 61, 0.95);
                border: 1px solid rgba(88, 101, 242, 0.3);
                border-radius: var(--border-radius-lg);
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
                padding: var(--spacing-2xl);
                width: 100%;
                max-width: 1000px;
                backdrop-filter: blur(10px);
                animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            }
            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(30px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            .error-header {
                text-align: center;
                margin-bottom: 2rem;
            }
            .error-code {
                font-size: 6rem;
                font-weight: 800;
                color: var(--danger-color);
                margin: 0;
                line-height: 1;
            }
            .error-title {
                font-size: 2rem;
                font-weight: 700;
                color: var(--text-primary);
                margin: 1rem 0;
            }
            .error-message {
                color: var(--text-secondary);
                font-size: 1.1rem;
                margin-bottom: 2rem;
            }
            .error-icon {
                font-size: 4rem;
                color: var(--danger-color);
                margin-bottom: 1rem;
            }
            .btn-home {
                background: var(--primary-color);
                color: var(--text-primary);
                padding: 12px 30px;
                border: none;
                border-radius: var(--border-radius);
                font-size: 1rem;
                font-weight: 600;
                text-decoration: none;
                display: inline-block;
                transition: all var(--transition-speed);
                box-shadow: var(--shadow-md);
            }
            .btn-home:hover {
                transform: translateY(-2px);
                box-shadow: var(--shadow-hover), var(--glow-primary);
                color: var(--text-primary);
                background: var(--primary-light);
            }
            .stack-trace-container {
                background: var(--background-tertiary);
                border-left: 4px solid var(--danger-color);
                padding: 1.5rem;
                border-radius: var(--border-radius);
                margin-top: 2rem;
                max-height: 400px;
                overflow-y: auto;
            }
            .stack-trace-title {
                font-weight: 700;
                color: var(--text-primary);
                margin-bottom: 1rem;
                font-size: 1.1rem;
            }
            .stack-trace {
                font-family: 'Courier New', Courier, monospace;
                font-size: 0.85rem;
                color: #ff6b9d;
                background: var(--background-main);
                padding: 1rem;
                border-radius: var(--border-radius);
                white-space: pre-wrap;
                word-wrap: break-word;
                margin: 0;
            }
            .error-details {
                background: rgba(243, 156, 18, 0.15);
                border-left: 4px solid var(--warning-color);
                padding: 1rem;
                border-radius: var(--border-radius);
                margin-bottom: 1rem;
            }
            .detail-label {
                font-weight: 600;
                color: var(--warning-color);
            }
            .detail-value {
                color: var(--text-secondary);
                word-break: break-all;
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
        <div class="error-container">
            <div class="error-card">
                <div class="error-header">
                    <i class="fas fa-exclamation-triangle error-icon"></i>
                    <h1 class="error-code">500</h1>
                    <h2 class="error-title">Internal Server Error</h2>
                    <p class="error-message">
                        Something went wrong on our end.<br>
                        We're working to fix it.
                    </p>
                </div>
            
            <% 
            boolean showTrace = showStackTraceConfig != null && showStackTraceConfig.equalsIgnoreCase("true");
            String style = errorPageStyleConfig != null ? errorPageStyleConfig : "simple";
            
            if (showTrace && "detailed".equalsIgnoreCase(style)) {
                Throwable throwable = (Throwable) request.getAttribute("jakarta.servlet.error.exception");
                Integer statusCode = (Integer) request.getAttribute("jakarta.servlet.error.status_code");
                String requestUri = (String) request.getAttribute("jakarta.servlet.error.request_uri");
                String servletName = (String) request.getAttribute("jakarta.servlet.error.servlet_name");
                String errorMessage = (String) request.getAttribute("jakarta.servlet.error.message");
            %>
            
            <div class="error-details">
                <% if (statusCode != null) { %>
                <div class="mb-2">
                    <span class="detail-label">Status Code:</span>
                    <span class="detail-value"><%= statusCode %></span>
                </div>
                <% } %>
                <% if (requestUri != null) { %>
                <div class="mb-2">
                    <span class="detail-label">Request URI:</span>
                    <span class="detail-value"><%= requestUri %></span>
                </div>
                <% } %>
                <% if (servletName != null) { %>
                <div class="mb-2">
                    <span class="detail-label">Servlet Name:</span>
                    <span class="detail-value"><%= servletName %></span>
                </div>
                <% } %>
                <% if (errorMessage != null) { %>
                <div>
                    <span class="detail-label">Message:</span>
                    <span class="detail-value"><%= errorMessage %></span>
                </div>
                <% } %>
            </div>
            
            <% if (throwable != null) { %>
            <div class="stack-trace-container">
                <div class="stack-trace-title">
                    <i class="fas fa-bug"></i> Stack Trace
                </div>
                <pre class="stack-trace"><%
                    java.io.StringWriter sw = new java.io.StringWriter();
                    java.io.PrintWriter pw = new java.io.PrintWriter(sw);
                    throwable.printStackTrace(pw);
                    out.print(sw.toString().replace("<", "&lt;").replace(">", "&gt;"));
                %></pre>
            </div>
            <% } %>
            <% } %>
            
                <div style="text-align: center; margin-top: 2rem;">
                    <a href="<%= request.getContextPath() %>/" class="btn-home">
                        <i class="fas fa-home"></i> Back to Home
                    </a>
                </div>
            </div>
        </div>
    </body>
</html>
