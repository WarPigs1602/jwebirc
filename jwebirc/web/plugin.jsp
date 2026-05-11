<%@page contentType="text/html" pageEncoding="UTF-8" import="jakarta.servlet.ServletContext,java.util.ArrayList,java.util.List"%>
<%!
    private boolean isSafePluginId(String pluginId) {
        return pluginId != null && pluginId.matches("[a-zA-Z0-9_-]+") && !pluginId.contains("..");
    }

    private boolean pluginResourceExists(ServletContext context, String path) {
        try {
            return context.getResource("/" + path) != null;
        } catch (Exception ex) {
            return false;
        }
    }

    private String joinPluginList(List<String> items) {
        return String.join(",", items);
    }

    private String escapeForJs(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private String buildPluginConfigJson(List<String> pluginIds, String pluginBasePath, ServletContext context) {
        StringBuilder json = new StringBuilder("[");
        boolean first = true;
        for (String pluginId : pluginIds) {
            String normalizedBasePath = pluginBasePath.endsWith("/") ? pluginBasePath : pluginBasePath + "/";
            String pluginRoot = normalizedBasePath + pluginId + "/";
            String jsPath = pluginRoot + "plugin.js";
            String cssPath = pluginRoot + "style.css";

            if (!pluginResourceExists(context, jsPath)) {
                continue;
            }

            if (!first) {
                json.append(',');
            }
            json.append('{')
                .append("\"id\":\"").append(escapeForJs(pluginId)).append("\",")
                .append("\"script\":\"").append(escapeForJs(jsPath)).append("\",")
                .append("\"style\":");

            if (pluginResourceExists(context, cssPath)) {
                json.append("\"").append(escapeForJs(cssPath)).append("\"");
            } else {
                json.append("null");
            }

            json.append('}');
            first = false;
        }
        json.append(']');
        return json.toString();
    }
%>
<%
    boolean pluginSystemEnabled = "true".equalsIgnoreCase(pluginEnabled);
    String normalizedPluginPath = pluginPath != null && !pluginPath.isEmpty() ? pluginPath : "plugins/";
    if (!normalizedPluginPath.endsWith("/")) {
        normalizedPluginPath += "/";
    }

    List<String> availablePluginIds = new ArrayList<>();
    if (pluginAvailable != null && !pluginAvailable.isBlank()) {
        for (String pluginId : pluginAvailable.split(",")) {
            String normalizedId = pluginId.trim();
            if (!normalizedId.isEmpty() && isSafePluginId(normalizedId)) {
                availablePluginIds.add(normalizedId);
            }
        }
    }

    List<String> requestedPluginIds = new ArrayList<>();
    if (pluginSystemEnabled) {
        if (pluginAutoLoad != null && !pluginAutoLoad.isBlank()) {
            for (String pluginId : pluginAutoLoad.split(",")) {
                String normalizedId = pluginId.trim();
                if (!normalizedId.isEmpty()) {
                    requestedPluginIds.add(normalizedId);
                }
            }
        } else {
            requestedPluginIds.addAll(availablePluginIds);
        }
    }

    List<String> activePluginIds = new ArrayList<>();
    List<String> activePluginScriptPaths = new ArrayList<>();
    List<String> activePluginStylePaths = new ArrayList<>();
    if (pluginSystemEnabled) {
        for (String pluginId : requestedPluginIds) {
            String normalizedId = pluginId.trim();
            if (!normalizedId.isEmpty() && availablePluginIds.contains(normalizedId) && !activePluginIds.contains(normalizedId)) {
                String pluginScriptPath = normalizedPluginPath + normalizedId + "/plugin.js";
                String pluginStylePath = normalizedPluginPath + normalizedId + "/style.css";
                if (pluginResourceExists(application, pluginScriptPath)) {
                    activePluginIds.add(normalizedId);
                    activePluginScriptPaths.add(pluginScriptPath);
                    if (pluginResourceExists(application, pluginStylePath)) {
                        activePluginStylePaths.add(pluginStylePath);
                    }
                }
            }
        }
    }

    session.setAttribute("plugin_enabled", pluginSystemEnabled ? "true" : "false");
    session.setAttribute("plugin_path", normalizedPluginPath);
    session.setAttribute("plugin_available", joinPluginList(availablePluginIds));
    session.setAttribute("plugin_active", joinPluginList(activePluginIds));
    session.setAttribute("plugin_script_paths", joinPluginList(activePluginScriptPaths));
    session.setAttribute("plugin_style_paths", joinPluginList(activePluginStylePaths));
    session.setAttribute("plugin_config_json", buildPluginConfigJson(activePluginIds, normalizedPluginPath, application));
%>