<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
    String pluginEnabledFoot = (String) session.getAttribute("plugin_enabled");
    boolean pluginSystemActiveFoot = "true".equalsIgnoreCase(pluginEnabledFoot);
    String pluginScriptPaths = (String) session.getAttribute("plugin_script_paths");
%>
<% if (pluginSystemActiveFoot && pluginScriptPaths != null && !pluginScriptPaths.isBlank()) {
    for (String pluginScriptPath : pluginScriptPaths.split(",")) {
        String normalizedScriptPath = pluginScriptPath.trim();
        if (!normalizedScriptPath.isEmpty()) {
%>
        <script src="<%= normalizedScriptPath %>"></script>
<%
        }
    }
} %>
        <script>
            if (window.PluginSystem) {
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', function() {
                        window.PluginSystem.init();
                    }, { once: true });
                } else {
                    window.PluginSystem.init();
                }
            }
        </script>