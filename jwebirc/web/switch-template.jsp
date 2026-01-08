<%@page contentType="application/json" pageEncoding="UTF-8" trimDirectiveWhitespaces="true" import="jakarta.servlet.ServletContext,jakarta.servlet.http.Cookie"%><%!
    // Helper method for config parameters
    private String param(ServletContext ctx, String name, String defaultValue) {
        String value = ctx.getInitParameter(name);
        return value != null ? value : defaultValue;
    }
%><%
    // Set response headers first to prevent any HTML output
    response.setContentType("application/json");
    response.setCharacterEncoding("UTF-8");
    response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    response.setHeader("Pragma", "no-cache");
    response.setDateHeader("Expires", 0);
    
    // Load configuration directly (avoid including init.jsp to prevent contentType conflict)
    ServletContext ctx = application;
    String templateEnabled = param(ctx, "jwebirc.templateEnabled", "true");
    String templateDefault = param(ctx, "jwebirc.templateDefault", "dark-theme");
    String templateUserSelectable = param(ctx, "jwebirc.templateUserSelectable", "true");
    String templateAvailable = param(ctx, "jwebirc.templateAvailable", "dark-theme,light-theme");
    String templatePath = param(ctx, "jwebirc.templatePath", "templates/");
    
    // Get requested template from parameter
    String requestedTemplate = request.getParameter("template");
    
    // Response object
    String responseJson = "";
    
    try {
        if (requestedTemplate == null || requestedTemplate.isEmpty()) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            responseJson = "{\"success\": false, \"error\": \"No template specified\"}";
        } else {
            // Check if template system is enabled
            if (templateEnabled == null || !templateEnabled.equalsIgnoreCase("true")) {
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                responseJson = "{\"success\": false, \"error\": \"Template system is disabled\"}";
            } else if (templateUserSelectable == null || !templateUserSelectable.equalsIgnoreCase("true")) {
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                responseJson = "{\"success\": false, \"error\": \"Template switching is disabled\"}";
            } else {
                // Validate template against available templates
                String[] availableTemplates = templateAvailable.split(",");
                boolean validTemplate = false;
                
                for (String template : availableTemplates) {
                    if (template.trim().equals(requestedTemplate.trim())) {
                        validTemplate = true;
                        break;
                    }
                }
                
                if (!validTemplate) {
                    response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                    responseJson = "{\"success\": false, \"error\": \"Invalid template: " + requestedTemplate.replace("\"", "\\\"") + "\"}";
                } else {
                    // Update session
                    session.setAttribute("user_template", requestedTemplate);
                    
                    // Build new CSS path
                    String newCssPath = "templates/" + requestedTemplate + "/style.css";
                    session.setAttribute("template_css_path", newCssPath);
                    session.setAttribute("template_display_name", requestedTemplate);
                    
                    // Set cookie for persistence (expires in 1 year)
                    Cookie templateCookie = new Cookie("jwebirc_template", requestedTemplate);
                    templateCookie.setPath("/");
                    templateCookie.setMaxAge(365 * 24 * 60 * 60); // 1 year
                    templateCookie.setHttpOnly(false); // Allow JavaScript access
                    response.addCookie(templateCookie);
                    
                    response.setStatus(HttpServletResponse.SC_OK);
                    responseJson = "{\"success\": true, \"template\": \"" + requestedTemplate.replace("\"", "\\\"") + "\", \"cssPath\": \"" + newCssPath.replace("\"", "\\\"") + "\"}";
                }
            }
        }
    } catch (Exception e) {
        response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        responseJson = "{\"success\": false, \"error\": \"Internal server error: " + e.getMessage().replace("\"", "\\\"") + "\"}";
    }
    
    out.print(responseJson);
    out.flush();
%>
