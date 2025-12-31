<%-- 
    Document   : footer-webchat
    Created on : 17.08.2024, 13:39:07
    Author     : Andreas Pschorn
    Updated    : 31.12.2025
--%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
        <script>
            // Remove loading screen after WebSocket connection
            window.addEventListener('load', function() {
                setTimeout(function() {
                    const loadingScreen = document.getElementById('loadingScreen');
                    if (loadingScreen) {
                        loadingScreen.classList.add('hidden');
                    }
                }, 800);
            });
        </script>
    </body>
</html>