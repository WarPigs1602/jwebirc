# jWebIRC Plugin System

## Overview

The plugin system extends jWebIRC independently from the template system. Themes remain responsible for styling the base UI, while plugins can inject optional behavior or page-specific UI additions.

## Configuration

Add these parameters to `jwebirc/web/META-INF/context.xml` or to your server-managed context file:

```xml
<Parameter name="jwebirc.pluginEnabled" value="true" override="false" />
<Parameter name="jwebirc.pluginAvailable" value="welcome-banner" override="false" />
<Parameter name="jwebirc.pluginAutoLoad" value="welcome-banner" override="false" />
<Parameter name="jwebirc.pluginPath" value="plugins/" override="false" />
```

If `jwebirc.pluginAutoLoad` is left empty, the loader automatically activates all plugin ids listed in `jwebirc.pluginAvailable`.

## Directory Layout

```text
jwebirc/web/plugins/
  <plugin-id>/
    plugin.js
    style.css      # optional
```

## Lifecycle

1. `init.jsp` loads plugin configuration through `plugin.jsp`.
2. `plugin-head.jsp` injects plugin CSS and the core loader `file/plugin-system.js`.
3. `plugin-foot.jsp` injects the active plugin scripts and initializes the loader.
4. Every plugin registers itself through `window.jwebircRegisterPlugin(...)`.
5. The loader calls `initialize(context)` once the page DOM is ready.

## Plugin API

```javascript
window.jwebircRegisterPlugin({
  id: 'my-plugin',
  initialize(context) {
    console.log(context.id);
    console.log(context.page);
    console.log(context.lang);
    console.log(context.getTemplate());

    context.emit('jwebirc:plugin:my-plugin:started', {
      page: context.page
    });
  }
});
```

Available context fields:

- `id`: plugin id
- `meta`: configured metadata for the plugin
- `page`: `login`, `chat`, or `about`
- `lang`: active UI language
- `emit(name, detail)`: dispatch a custom DOM event
- `getTemplate()`: current template id if the template system is active
- `getGlobal(name)`: access a global browser object or app export
- `storageKey(suffix)`: namespaced localStorage key helper

## Example Plugin

The repository ships with `welcome-banner` as a minimal reference implementation:

- `plugin.js` registers the plugin and injects a banner on the chat page
- `style.css` provides the banner styling

It is available for activation but not autoloaded by default.