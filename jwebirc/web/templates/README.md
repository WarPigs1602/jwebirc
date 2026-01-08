# jWebIRC Template System

## Overview

The jWebIRC Template System allows you to create and use custom visual themes for your IRC web client. Templates are modular, CSS-based designs that can be easily switched by users or administrators.

## Features

- **Multiple Templates**: Support for unlimited custom templates
- **User-Selectable**: Allow users to choose their preferred theme
- **Easy Customization**: CSS-based system for easy theme creation
- **Persistent Selection**: User preferences saved in cookies
- **Fallback Support**: Automatic fallback to default theme if custom theme fails
- **Hot-Swapping**: Switch themes without page reload

## Configuration

### Context Parameters (web.xml or context.xml)

```xml
<!-- Enable Template System -->
<context-param>
    <param-name>jwebirc.templateEnabled</param-name>
    <param-value>true</param-value>
</context-param>

<!-- Default Template -->
<context-param>
    <param-name>jwebirc.templateDefault</param-name>
    <param-value>dark-theme</param-value>
</context-param>

<!-- Allow User Selection -->
<context-param>
    <param-name>jwebirc.templateUserSelectable</param-name>
    <param-value>true</param-value>
</context-param>

<!-- Available Templates (comma-separated) -->
<context-param>
    <param-name>jwebirc.templateAvailable</param-name>
    <param-value>dark-theme,light-theme,custom-theme</param-value>
</context-param>

<!-- Template Path Prefix -->
<context-param>
    <param-name>jwebirc.templatePath</param-name>
    <param-value>templates/</param-value>
</context-param>
```

## Directory Structure

```
web/
├── templates/
│   ├── dark-theme/
│   │   └── style.css
│   ├── light-theme/
│   │   └── style.css
│   └── custom-theme/
│       └── style.css
└── file/
    └── template-system.js
```

## Built-in Templates

### Dark Theme
- Modern dark color scheme
- Purple/blue accents
- Optimized for low-light environments
- High contrast for readability

### Light Theme
- Clean, minimal light design
- Blue accents
- Comfortable for bright environments
- Professional appearance

## Creating a Custom Template

### Step 1: Create Template Directory

Create a new directory in `web/templates/` with your template name:

```
web/templates/my-custom-theme/
```

### Step 2: Create style.css

Create a `style.css` file in your template directory. Start with CSS variables:

```css
/* ============================================
   My Custom Theme
   ============================================ */

:root {
    /* Primary Colors */
    --primary-color: #ff6b6b;
    --primary-hover: #ee5a52;
    --accent-color: #4ecdc4;
    
    /* Backgrounds */
    --background-main: #1a1a2e;
    --background-secondary: #16213e;
    --background-tertiary: #0f3460;
    
    /* Text */
    --text-primary: #eaeaea;
    --text-secondary: #b4b4b4;
    --text-muted: #888888;
    
    /* Borders & Effects */
    --border-color: #2d3748;
    --border-radius: 8px;
    --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.3);
}

/* Override specific components */
.btn-primary {
    background: var(--primary-color);
}

/* Add custom styles */
body {
    background: var(--background-main);
    color: var(--text-primary);
}
```

### Step 3: Add Template to Configuration

Update your configuration to include the new template:

```xml
<context-param>
    <param-name>jwebirc.templateAvailable</param-name>
    <param-value>dark-theme,light-theme,my-custom-theme</param-value>
</context-param>
```

### Step 4: Test Your Template

1. Restart your application
2. Open the Display Options menu (gear icon)
3. Select your custom theme from the Theme section

## CSS Variables Reference

### Colors
- `--primary-color`: Primary action color
- `--accent-color`: Accent/highlight color
- `--danger-color`: Error/danger color
- `--warning-color`: Warning color
- `--success-color`: Success color

### Backgrounds
- `--background-main`: Page background
- `--background-secondary`: Card/container background
- `--background-tertiary`: Nested element background
- `--background-hover`: Hover state background
- `--background-modal`: Modal background

### Text
- `--text-primary`: Main text color
- `--text-secondary`: Secondary text color
- `--text-muted`: Muted/disabled text
- `--text-link`: Link color

### Borders & Spacing
- `--border-color`: Default border color
- `--border-radius`: Border radius
- `--shadow-sm/md/lg`: Box shadows
- `--spacing-sm/md/lg`: Spacing units

### IRC-Specific
- `--irc-notice-color`: Notice message color
- `--irc-action-color`: Action message color
- `--irc-join-color`: Join message color
- `--irc-part-color`: Part/quit message color

## JavaScript API

### Switching Templates Programmatically

```javascript
// Switch to a specific template
TemplateSystem.switchTemplate('light-theme');

// Get current template
console.log(TemplateSystem.currentTemplate);

// Get available templates
console.log(TemplateSystem.availableTemplates);

// Listen for template changes
document.addEventListener('templateChanged', (e) => {
    console.log('Template changed to:', e.detail.template);
});
```

## Best Practices

1. **CSS Variables**: Always use CSS variables for colors and spacing to maintain consistency
2. **Fallbacks**: Provide fallback values for CSS variables: `color: var(--text-primary, #ffffff);`
3. **Testing**: Test your template with all components (forms, buttons, modals, IRC messages)
4. **Accessibility**: Ensure sufficient contrast ratios (WCAG 2.1 guidelines)
5. **Responsive**: Test on different screen sizes
6. **Browser Support**: Test in major browsers (Chrome, Firefox, Safari, Edge)

## Troubleshooting

### Template Not Loading

1. Check that the template directory exists in `web/templates/`
2. Verify `style.css` exists in the template directory
3. Confirm template name is in `jwebirc.templateAvailable` configuration
4. Check browser console for CSS loading errors
5. Clear browser cache and cookies

### Styles Not Applied

1. Verify CSS specificity (template CSS loads after main style.css)
2. Use `!important` sparingly for overrides
3. Check for CSS syntax errors in browser DevTools
4. Ensure CSS variables are defined in `:root`

### Template Selector Not Visible

1. Confirm `jwebirc.templateUserSelectable` is set to `true`
2. Verify `template-system.js` is loaded
3. Check that Display Options menu exists on the page
4. Check browser console for JavaScript errors

## Migration from Old System

If you have custom CSS in `file/style.css`:

1. Create a new template directory
2. Copy relevant custom styles to template's `style.css`
3. Update color values to use CSS variables
4. Test thoroughly before deploying

## Version History

- **1.0** (07.01.2026): Initial template system implementation
  - Dark theme and light theme included
  - User-selectable themes
  - Cookie-based persistence
  - JavaScript API

## Support

For issues or questions about the template system:
- Check the browser console for errors
- Verify configuration in web.xml/context.xml
- Review this documentation
- Test with built-in themes first

## License

Part of jWebIRC - Modern web-based IRC client
