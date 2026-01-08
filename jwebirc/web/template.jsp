<%-- 
    Document   : template
    Created on : 07.01.2026
    Author     : Andreas Pschorn
    Description: Template system management and configuration
--%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
    // Template System Logic
    // Initialize template configuration in session
    // NOTE: This file requires config.jsp to be included first (done by init.jsp)
    
    // Check if template is enabled
    session.setAttribute("template_enabled", templateEnabled);
    session.setAttribute("template_user_selectable", templateUserSelectable);
    session.setAttribute("template_path", templatePath);
    
    // Get user's selected template from session, URL parameter, or cookie
    String selectedTemplate = null;
    
    // Priority 1: Check URL parameter (for embed links)
    String urlTemplate = request.getParameter("template");
    if (urlTemplate != null && !urlTemplate.isEmpty()) {
        selectedTemplate = urlTemplate;
    }
    // Priority 2: Check if user has already selected a template in this session
    else if (session.getAttribute("user_template") != null) {
        selectedTemplate = (String) session.getAttribute("user_template");
    }
    // Priority 3: Check cookie for persistent template selection
    else if (request.getCookies() != null) {
        for (Cookie cookie : request.getCookies()) {
            if ("jwebirc_template".equals(cookie.getName())) {
                selectedTemplate = cookie.getValue();
                break;
            }
        }
    }
    // Priority 4: Use default template
    if (selectedTemplate == null || selectedTemplate.isEmpty()) {
        selectedTemplate = templateDefault;
    }
    
    // Validate selected template against available templates
    String[] availableTemplates = templateAvailable.split(",");
    boolean validTemplate = false;
    for (String template : availableTemplates) {
        if (template.trim().equals(selectedTemplate)) {
            validTemplate = true;
            break;
        }
    }
    
    // If invalid template, fall back to default
    if (!validTemplate) {
        selectedTemplate = templateDefault;
    }
    
    // Store validated template in session
    session.setAttribute("user_template", selectedTemplate);
    session.setAttribute("template_available", templateAvailable);
    
    // Build template CSS path
    String templateCssPath = "templates/" + selectedTemplate + "/style.css";
    session.setAttribute("template_css_path", templateCssPath);
    
    // Store template name for display
    session.setAttribute("template_display_name", selectedTemplate);
%>
<%!
    /**
     * Get human-readable template name
     * @param templateId Technical template identifier
     * @return Formatted display name
     */
    private String getTemplateDisplayName(String templateId) {
        if (templateId == null || templateId.isEmpty()) {
            return "Default";
        }
        
        // Convert template-name to Template Name
        String[] parts = templateId.split("-");
        StringBuilder displayName = new StringBuilder();
        
        for (String part : parts) {
            if (displayName.length() > 0) {
                displayName.append(" ");
            }
            if (part.length() > 0) {
                displayName.append(Character.toUpperCase(part.charAt(0)));
                if (part.length() > 1) {
                    displayName.append(part.substring(1).toLowerCase());
                }
            }
        }
        
        return displayName.toString();
    }
    
    /**
     * Check if a file exists in the templates directory
     * @param context ServletContext
     * @param path Relative path to check
     * @return true if file exists
     */
    private boolean templateFileExists(ServletContext context, String path) {
        try {
            return context.getResource("/" + path) != null;
        } catch (Exception e) {
            return false;
        }
    }
%>
