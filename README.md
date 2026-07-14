# Pro Code Editor

A lightweight, modular, and extensible Electron-based code editor and file explorer. Designed with a fully decoupled architecture, the editor core remains minimal and generic, while languages, syntax highlight rules, autocomplete dictionaries, sidebars, settings, code runners, and full IDE environments are loaded dynamically at runtime.

---

## Architecture Overview

The editor is structured around a central, versioned API manager (`ProEditorAPI`). The editor core exposes registration endpoints (registrars) that extensions and IDEs hook into upon activation.

```
                      ┌─────────────────────────────────────────┐
                      │               CORE EDITOR               │
                      │  (File lifecycle, basic UI, system bus) │
                      └────────────────────┬────────────────────┘
                                           │
                            Exposes window.ProEditorAPI
                                           │
               ┌───────────────────────────┴───────────────────────────┐
               ▼                                                       ▼
    ┌─────────────────────────────────────┐         ┌─────────────────────────────────────┐
    │          CUSTOM EXTENSIONS          │         │             CUSTOM IDEs             │
    │  Themes, Autocomplete, Language     │         │  Custom Workspace Views, Templates, │
    │  Parsers, UI Panels, Custom Icons   │         │  Custom Compilers, Toolbars         │
    └─────────────────────────────────────┘         └─────────────────────────────────────┘
```

---

## Core Features

### 1. Versioned Plugin API (`window.ProEditorAPI`)
All workspace attributes are registered via standard API endpoints:
*   `api.themes.register(id, config)`: Contributes custom CSS variable-based styling palettes.
*   `api.icons.register(id, config)`: Contributes dynamic file/folder icon glyphs and classes.
*   `api.languages.register(langId, config)`: Contributes autocomplete databases and keyword parsing rules.
*   `api.languages.registerHighlighter(langId, rules)`: Contributes regular expression syntax coloring models.
*   `api.terminal.registerRunner(ext, config)`: Contributes custom compiler and script execution pathways.
*   `api.views.registerSidebarPanel(id, config)`: Contributes custom Activity Bar buttons and sidebar panels.
*   `api.views.registerSetting(id, config)`: Contributes dynamic user preference options with persistent browser caching.
*   `api.workspace.registerIDE(id, config)`: Contributes custom IDE workspaces, top-bar toolbars, and empty welcome dashboards.

### 2. High-Performance Resizable Layout
Horizontal and vertical splitters allow you to slide and customize the size of your explorer and terminal panels. Features include:
*   **Persistent Memory:** Sidebar width and terminal height persist dynamically inside `localStorage` across application reloads.
*   **Throttled Rendering:** Dimensions update smoothly inside `requestAnimationFrame` boundaries.
*   **Pointer-Events Drag Shielding:** Temporary input shields prevent cursor stutters when dragging quickly over textareas or browser containers.

### 3. Integrated Plugins Manager
A built-in sidebar manager (`plugins-manager`) lets you inspect, enable, or disable loaded packages. If configurations are modified, you can trigger a hard reload/relaunch of the active Electron shell with a single click.

### 4. Dynamic Developer Hot-Reloading
By clicking **Reload** inside the Plugins Manager panel, developers can flush in-memory API registries, re-scan directories, and re-import modified plugin scripts using cache-busting query strings (`?t=timestamp`) without closing the Electron application.

### 5. Multi-Language Highlighting Core
The core syntax highlighter uses lookbehind and alternative capture-group regular expressions to process code. In HTML documents, a specialized block-splitter automatically isolates `<style>` and `<script>` tags, highlighting their contents using CSS and JS rules dynamically.

### 6. Editor Shortcuts & Line Operations
Beyond auto-pairing, auto-indent and tag auto-closing, the editor provides language-aware line operations:

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd + /` | Toggle comment (line-style for JS/PY/etc., block-style for CSS/HTML) |
| `Alt + ↑ / ↓` | Move the current line or selection up / down |
| `Shift + Alt + ↑ / ↓` | Duplicate the current line or selection |
| `Ctrl/Cmd + Shift + K` | Delete the current line |
| `Ctrl/Cmd + Space` | Manually trigger ProSense autocomplete |

ProSense completion entries may include a `detail` signature hint and a `$0` caret placeholder in their `insertText` to control where the cursor lands after insertion.

---

## Directory Conventions

Custom plugins must reside inside the root-level `custom/` directory, organized by plugin type:

```
custom/
  extensions/
    web-languages-pack/     # Multi-file web languages syntax/autocomplete pack
      package.json          # Manifest metadata
      index.js              # Activation entry point
      rules/
        html-rules.js       # HTML token regexes
        css-rules.js        # CSS token regexes
        js-rules.js         # JS token regexes
  ides/
    web-dev-ide/            # Custom Web Creator IDE environment
      package.json          # Manifest metadata
      index.js              # Toolbars, templates, and welcome overlay scripts
```

---

## Developing Plugins

### 1. The Manifest (`package.json`)
Every extension or IDE must contain a manifest declaring its package properties:

```json
{
  "id": "my-plugin-id",
  "name": "My Custom Plugin",
  "description": "Adds a custom workflow helper.",
  "version": "1.0.0",
  "apiVersion": "1.0.0",
  "type": "extension",
  "main": "index.js"
}
```

### 2. The Activation Entry Point (`index.js`)
The main script must export an `activate(api)` function. This function receives the central host API context to register its features:

```javascript
export function activate(api) {
    // Register a custom setting
    api.views.registerSetting('custom-boolean-pref', {
        label: 'Enable Custom Feature',
        type: 'checkbox',
        defaultValue: false,
        onChange: (isChecked) => {
            console.log("Preference updated: ", isChecked);
        }
    });

    // Register a custom sidebar panel
    api.views.registerSidebarPanel('custom-monitor', {
        iconClass: 'fa-solid fa-chart-line',
        title: 'System Monitor',
        render: (container) => {
            container.innerHTML = `<h4>Status: Normal</h4>`;
        }
    });
}

export function deactivate() {
    console.log("Cleanup on disable or reload...");
}
```

---

## Installation & Running

Ensure you have [Node.js](https://nodejs.org/) and npm installed.

1. Install developer dependencies:
   ```bash
   npm install
   ```

2. Start the Electron application:
   ```bash
   npm start
   ```

---

## License

This project is licensed under the MIT License - see the `LICENSE` file for details.