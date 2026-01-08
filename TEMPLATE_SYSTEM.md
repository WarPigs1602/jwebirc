# jWebIRC Template System - Quick Start Guide

## What is the Template System?

The Template System allows you to customize the visual appearance of jWebIRC by creating and using custom CSS themes. Users can switch between different themes without reloading the page.

## Key Features

✅ **Multiple Themes**: Pre-built dark and light themes included  
✅ **User Selection**: Users can choose their preferred theme  
✅ **Persistent**: Theme choice saved in cookies  
✅ **Easy Customization**: Create new themes with CSS only  
✅ **Hot-Swap**: Switch themes instantly without page reload  

## Quick Setup

### 1. Enable Template System

Add to your `web.xml` (values below match the shipped light and dark themes). For a Tomcat `context.xml` example see the dedicated snippet further below.

```xml
<context-param>
    <param-name>jwebirc.templateEnabled</param-name>
    <param-value>true</param-value>
</context-param>

<context-param>
    <param-name>jwebirc.templateDefault</param-name>
    <param-value>dark-theme</param-value>
</context-param>

<context-param>
    <param-name>jwebirc.templateUserSelectable</param-name>
    <param-value>true</param-value>
</context-param>

<context-param>
    <param-name>jwebirc.templateAvailable</param-name>
    <param-value>dark-theme,light-theme</param-value>
</context-param>

<context-param>
    <param-name>jwebirc.templatePath</param-name>
    <param-value>templates/</param-value>
</context-param>
```

### 2. Restart Application

Restart your servlet container (Tomcat, etc.) to apply the configuration.

### 3. Access Theme Selector

1. Open jWebIRC in your browser
2. Click the **gear icon** (⚙️) in the top-right corner
3. Find the **Theme** section in the dropdown
4. Select your preferred theme (dark-theme or light-theme by default)

## File Structure

```
web/
├── templates/                    # Template directory
│   ├── dark-theme/               # Built-in dark theme
│   │   └── style.css             # Dark theme styles
│   ├── light-theme/              # Built-in light theme
│   │   └── style.css             # Light theme styles
│   └── README.md                 # Full template documentation
├── file/
│   └── template-system.js       # Template switcher JavaScript
├── template.jsp                  # Template management logic
└── config.jsp                    # Configuration parameters

```

## Creating Your Own Theme

### Step 1: Create Directory

```bash
mkdir web/templates/my-theme
```

### Step 2: Create style.css

Create `web/templates/my-theme/style.css`:

```css
:root {
    /* Colors */
    --primary-color: #your-color;
    --background-main: #your-background;
    --text-primary: #your-text-color;

    /* Add more variables as needed */
}

/* Your custom styles */
body {
    background: var(--background-main);
}
```

### Step 3: Add to Configuration

```xml
<context-param>
    <param-name>jwebirc.templateAvailable</param-name>
    <param-value>dark-theme,light-theme,my-theme</param-value>
</context-param>
```

### Step 4: Test

Restart application and select your theme from the dropdown.

## Included Themes

### Dark Theme (default)
- Dark backgrounds with purple/blue accents
- Optimized for low-light environments
- High contrast for readability

### Light Theme
- Clean, minimal light design
- Blue accents
- Professional appearance
- Comfortable for bright environments

## Configuration Options

| Parameter | Default | Description |
|-----------|---------|-------------|
| `jwebirc.templateEnabled` | `false` | Enable/disable the template system |
| `jwebirc.templateDefault` | `dark-theme` | Default theme loaded on first visit |
| `jwebirc.templateUserSelectable` | `false` | Allow users to switch themes via UI |
| `jwebirc.templateAvailable` | `dark-theme,light-theme` | Comma-separated list of allowed theme directory names |
| `jwebirc.templatePath` | `templates/` | Base path for theme directories under `web/` |

### Tomcat context.xml example (META-INF)

Place a minimal theme configuration in `META-INF/context.xml` (see [jwebirc/web/META-INF/context.xml](jwebirc/web/META-INF/context.xml)):

```xml
<Context>
    <!-- Template System -->
    <Parameter name="jwebirc.templateEnabled" value="true" override="false"/>
    <Parameter name="jwebirc.templateDefault" value="dark-theme" override="false"/>
    <Parameter name="jwebirc.templateUserSelectable" value="true" override="false"/>
    <Parameter name="jwebirc.templateAvailable" value="dark-theme,light-theme" override="false"/>
    <Parameter name="jwebirc.templatePath" value="templates/" override="false"/>
</Context>
```

Keep the values in `context.xml` and `web.xml` in sync so the theme selector shows only available directories under `web/templates/`.

## Use Cases

### 1. Corporate Branding
Create a custom theme matching your company colors:
```xml
<context-param>
    <param-name>jwebirc.templateDefault</param-name>
    <param-value>corporate-theme</param-value>
</context-param>
<context-param>
    <param-name>jwebirc.templateUserSelectable</param-name>
    <param-value>false</param-value>
</context-param>
```

### 2. User Choice
Allow users to select their preferred theme:
```xml
<context-param>
    <param-name>jwebirc.templateUserSelectable</param-name>
    <param-value>true</param-value>
</context-param>
<context-param>
    <param-name>jwebirc.templateAvailable</param-name>
    <param-value>dark-theme,light-theme,corporate-theme</param-value>
</context-param>
```

### 3. Disable Templates
Use only base styling:
```xml
<context-param>
    <param-name>jwebirc.templateEnabled</param-name>
    <param-value>false</param-value>
</context-param>
```

## Troubleshooting

### Template Not Loading
- ✓ Check directory name matches configuration
- ✓ Verify `style.css` exists in template directory
- ✓ Clear browser cache
- ✓ Check browser console for errors

### Theme Selector Not Visible
- ✓ Confirm `jwebirc.templateUserSelectable` is `true`
- ✓ Verify `template-system.js` is loaded
- ✓ Check that you're on a page with the Display Options menu

### Styles Not Applied
- ✓ Check CSS syntax in browser DevTools
- ✓ Verify CSS variables are defined
- ✓ Ensure proper CSS specificity

## JavaScript API

```javascript
// Switch theme programmatically
TemplateSystem.switchTemplate('light-theme');

// Get current theme
console.log(TemplateSystem.currentTemplate);

// Listen for theme changes
document.addEventListener('templateChanged', (e) => {
    console.log('New theme:', e.detail.template);
});
```

## Support & Documentation

- **Full Documentation**: See [jwebirc/web/templates/README.md](jwebirc/web/templates/README.md)
- **Configuration Snippets**: Use the examples in this guide or [jwebirc/web/templates/README.md](jwebirc/web/templates/README.md)
- **Built-in Themes**: See [jwebirc/web/templates/dark-theme](jwebirc/web/templates/dark-theme) and [jwebirc/web/templates/light-theme](jwebirc/web/templates/light-theme)

## Version

Template System v1.0 - Created: 07.01.2026

---

**Need Help?** Check the full README.md in the templates directory for detailed information about creating custom themes, CSS variables reference, and advanced configuration options.
