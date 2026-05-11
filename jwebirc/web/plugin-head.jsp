<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
    String pluginEnabledHead = (String) session.getAttribute("plugin_enabled");
    boolean pluginSystemActiveHead = "true".equalsIgnoreCase(pluginEnabledHead);
    String pluginStylePaths = (String) session.getAttribute("plugin_style_paths");
    String pluginPage = "chat";
    String requestUri = request.getRequestURI();
    if (requestUri != null && requestUri.contains("about")) {
        pluginPage = "about";
    } else if (requestUri != null && requestUri.contains("index")) {
        pluginPage = request.getParameter("connect") != null ? "chat" : "login";
    }
%>
<% if (pluginSystemActiveHead && pluginStylePaths != null && !pluginStylePaths.isBlank()) {
    for (String pluginStylePath : pluginStylePaths.split(",")) {
        String normalizedStylePath = pluginStylePath.trim();
        if (!normalizedStylePath.isEmpty()) {
%>
        <link rel="stylesheet" href="<%= normalizedStylePath %>" type="text/css" data-plugin-style="<%= normalizedStylePath %>">
<%
        }
    }
} %>
        <script>
            window.pluginSystemConfig = {
                enabled: <%= pluginSystemActiveHead ? "true" : "false" %>,
                page: document.documentElement.getAttribute('data-page') || '<%= pluginPage %>',
                plugins: <%= session.getAttribute("plugin_config_json") != null ? session.getAttribute("plugin_config_json") : "[]" %>
            };
        </script>
        <script src="file/plugin-system.js"></script>