<%-- 
    Document   : 404
    Created on : 01.01.2026
    Author     : Andreas Pschorn
--%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%@page isErrorPage="true"%>
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>404 - Page Not Found</title>
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
                max-width: 600px;
                text-align: center;
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
            .error-code {
                font-size: 8rem;
                font-weight: 800;
                color: var(--primary-color);
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
            .error-icon {
                font-size: 5rem;
                color: var(--primary-color);
                margin-bottom: 1rem;
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
                <i class="fas fa-search error-icon"></i>
                <h1 class="error-code">404</h1>
                <h2 class="error-title">Page Not Found</h2>
                <p class="error-message">
                    Oops! The page you're looking for doesn't exist.<br>
                    It might have been moved or deleted.
                </p>
                <a href="<%= request.getContextPath() %>/" class="btn-home">
                    <i class="fas fa-home"></i> Back to Home
                </a>
            </div>
        </div>
    </body>
</html>
