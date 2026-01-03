<%-- 
    Document   : footer-webchat
    Created on : 17.08.2024, 13:39:07
    Author     : Andreas Pschorn
    Updated    : 31.12.2025
--%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
        <script>
            // Update loading text with nickname when window.user is set
            if (typeof window.user !== 'undefined' && window.user) {
                const loadingText = document.getElementById('loadingText');
                if (loadingText) {
                    loadingText.textContent = 'Connecting to IRC as ' + window.user + '...';
                }
            }
            // Loading screen will be hidden by IRC parser when MOTD is received or on error
        </script>
    </body>
</html>