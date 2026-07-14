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
| `Tab / Shift + Tab` | Indent / outdent the selected line(s) |
| `Ctrl/Cmd + G` | Go to line |
| `Ctrl/Cmd + Shift + [` | Collapse (fold) the region at the caret |
| `Ctrl/Cmd + Shift + ]` | Expand (unfold) the region at the caret |
| `Ctrl/Cmd + Space` | Manually trigger ProSense autocomplete |

The footer status bar shows a live **Ln / Col** readout (with selection size and line
count while text is selected) and the active file's language. The cursor readout is
clickable and opens the same **Go to Line** prompt as `Ctrl/Cmd + G`; folded regions are
expanded automatically so any line stays reachable.

### 7. Code Folding
Structural regions — classes, functions, objects, blocks, and indentation scopes — can be
collapsed and expanded directly in the editor. Hover the line gutter to reveal fold arrows,
or use the keyboard shortcuts above. Folding is **view-only**: the gutter keeps showing true
file line numbers, a `⋯ N lines` badge marks each collapsed region, and the full document is
transparently reconstructed for saving, LSP synchronization, and code execution so nothing is
ever lost. Bracket scopes (`{ [ (`) and colon-introduced indent scopes (Python/YAML) are both
detected automatically.

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
      icon.svg              # (optional) plugin icon — SVG/PNG/JPG/GIF/WEBP/ICO/BMP/AVIF
      rules/
        html-rules.js       # HTML token regexes
        css-rules.js        # CSS token regexes
        js-rules.js         # JS token regexes
  ides/
    web-dev-ide/            # Custom Web Creator IDE environment
      package.json          # Manifest metadata (may declare extensionDependencies)
      index.js              # Toolbars, templates, and welcome overlay scripts
      extensions/           # Integrated extensions bundled with (and owned by) the IDE
        web-snippets/
          package.json
          index.js
```

### Plugin & IDE Icons
Every extension and IDE can ship its own icon. Point the manifest at a file with the `icon`
field, or simply drop a conventionally-named `icon.*` file in the plugin folder and it is
auto-detected. Supported formats: **SVG, PNG, JPG/JPEG, GIF, WEBP, ICO, BMP, AVIF**. When no
icon is provided, a neutral placeholder is shown — `assets/placeholder-extension.svg` for
extensions and `assets/placeholder-ide.svg` for IDEs — which you can also use as a starting
template for your own artwork.

### Integrated & Dependent Extensions (IDEs)
IDEs are themselves activated exactly like extensions — their `activate(api)` entry point can
register themes, languages, highlighters, runners, settings, and panels — and then additionally
call `api.workspace.registerIDE(...)` to contribute a full workspace. On top of that, an IDE can
own extensions two ways:

* **Integrated (bundled):** extensions placed in the IDE's own `extensions/` subfolder are
  discovered and activated together with the IDE, and are disabled automatically when it is.
* **Dependent (declared):** the manifest's `extensionDependencies` array lists extension ids the
  IDE requires. Missing dependencies block the IDE from activating; present ones are force-enabled
  and locked (they cannot be manually disabled) for as long as the IDE is enabled.

Both relationships are surfaced with relationship chips and a lock indicator in the Plugins
Manager panel.

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
  "main": "index.js",
  "icon": "icon.svg"
}
```

IDEs use `"type": "ide"` and may additionally declare the extensions they depend on:

```json
{
  "id": "web-dev-ide",
  "name": "Web Creator IDE",
  "version": "1.0.0",
  "apiVersion": "1.0.0",
  "type": "ide",
  "main": "index.js",
  "icon": "icon.png",
  "extensionDependencies": ["web-snippets"]
}
```

> `icon` is optional. Any supported image file named `icon.*` in the plugin folder is picked up
> automatically, and a placeholder is used if none is present.

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