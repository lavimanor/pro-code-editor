# Developer Guide: Creating Extensions for Pro Code Editor

This document outlines the architecture, directory conventions, manifest requirements, and API specifications required to develop custom extensions for the Pro Code Editor. 

---

## 1. Extension Architecture Overview

Extensions are modular packages designed to extend the core capabilities of the Pro Code Editor. The editor core exposes a global API instance, `ProEditorAPI` (accessible via `api` in the activation entry point or globally via `window.ProEditorAPI`). 

Extensions can register:
- Custom syntax highlighting themes
- Custom file/folder icon packs
- Language definitions (extensions, autocomplete databases, and parsers)
- Regular expression syntax highlighters
- Language Server Protocol (LSP) clients
- Custom terminal script/code execution pathways (runners)
- Sidebar panels
- Bottom dock tabs (alongside the built-in terminal)
- Status bar widgets
- User preference settings (with custom dropdowns and per-extension details pages)
- Custom diagnostic styles (linters and error displays)
- Event subscriptions on the editor lifecycle (`api.events`) and programmatic editor control (`api.editor`)

---

## 2. Directory Structure Conventions

All standalone custom extensions must reside inside the `custom/extensions/` directory. Each extension must have its own isolated folder named after its unique package ID.

```
custom/
  extensions/
    my-custom-extension/
      package.json          # Required: Metadata and plugin manifest
      index.js              # Required: Main script containing activation hooks
      icon.svg              # Optional: Custom plugin icon (SVG, PNG, or JPG)
```

---

## 3. The Extension Manifest (`package.json`)

Each extension folder must contain a `package.json` file. This manifest is used by the host application's scanning phase to validate, resolve dependencies, and register the plugin.

### Manifest Schema & Fields

```json
{
  "id": "my-custom-extension",
  "name": "My Custom Extension",
  "description": "Adds support for the custom Neon language, styling, and run configurations.",
  "version": "1.0.0",
  "apiVersion": "1.0.0",
  "type": "extension",
  "main": "index.js",
  "icon": "icon.svg"
}
```

### Field Definitions:
- **`id`** *(String, Required)*: A unique, URL-safe identifier (lowercase, alphanumeric, and hyphens).
- **`name`** *(String, Required)*: The display name shown in the integrated Plugins Manager.
- **`description`** *(String, Optional)*: A brief summary of the extension's features.
- **`version`** *(String, Required)*: SemVer version string of the extension.
- **`apiVersion`** *(String, Required)*: The target `ProEditorAPI` version. Must match the major version of the host (currently `1.0.0`).
- **`type`** *(String, Required)*: Must be set to `"extension"`.
- **`main`** *(String, Required)*: The entry point JavaScript file relative to the extension folder root.
- **`icon`** *(String, Optional)*: Explicit path to the plugin icon. If omitted, the host automatically scans for a file named `icon.*` in the extension's folder. If no icon is found, the host falls back to `assets/placeholder-extension.svg`.

---

## 4. The Entry Point Script (`index.js`)

The entry point script declared in `"main"` must export an `activate(api)` function. It may optionally export a `deactivate()` function to handle cleanup during plugin disabling or hot-reloading.

### Entry Point Skeleton:

```javascript
export function activate(api) {
    console.log("My Custom Extension has been successfully activated.");
    
    // Feature registrations go here using the 'api' parameter
}

export function deactivate() {
    console.log("My Custom Extension has been deactivated and is cleaning up resources.");
}
```

---

## 5. API Registration Methods

The `api` parameter passed to your `activate` function provides access to several modular sub-APIs. Below are the complete specifications and code examples for each available registry.

### 5.1 Theme Registration (`api.themes.register`)
Contributes a custom color scheme to the editor. Themes use standard CSS custom properties injected directly into the application DOM.

```javascript
api.themes.register('custom-neon-blue', {
    name: 'Custom Neon Blue Theme',
    colors: {
        '--bg-darker': '#050a12',
        '--bg-dark': '#0d1b2a',
        '--bg-sidebar': '#1b263b',
        '--bg-button': '#415a77',
        '--bg-tab-inactive': '#0d1b2a',
        '--accent-color': '#00b4d8',
        '--accent-hover': '#90e0ef',
        '--text-main': '#e0e1dd',
        '--text-muted': '#778da9',
        '--border-color': '#415a77',
        '--scrollbar-thumb': '#415a77',
        '--scrollbar-thumb-hover': '#778da9',
        '--syntax-comment': '#778da9',
        '--syntax-doctype': '#00b4d8',
        '--syntax-tag-name': '#00b4d8',
        '--syntax-attr-name': '#90e0ef',
        '--syntax-attr-value': '#e0e1dd',
        '--syntax-tag-bracket': '#778da9',
        '--syntax-keyword': '#00b4d8',
        '--syntax-string': '#90e0ef',
        '--syntax-function': '#90e0ef',
        '--syntax-builtin': '#00b4d8',
        '--syntax-number': '#00b4d8',
        '--syntax-punctuation': '#e0e1dd',
        '--syntax-bracket': '#3267fc'
    }
});
```

### 5.2 Icon Pack Registration (`api.icons.register`)
Registers folder and file glyph providers to replace or style tree and tab icons.

```javascript
api.icons.register('cyberpunk', {
    name: 'Cyberpunk Icons (Custom)',
    getFolderIcon: () => '⚡',
    getFileIcon: (fileName) => {
        const ext = fileName.split('.').pop().toLowerCase();
        switch(ext) {
            case 'js': return '⧉';
            case 'html': return '⚛';
            case 'css': return '✦';
            case 'neon': return '✹';
            default: return '⌺';
        }
    }
});
```

### 5.3 Language & Autocomplete Database (`api.languages.register`)
Defines file association rules, local token parsing expressions, and autocompletion listings (ProSense database entries).

```javascript
api.languages.register('neonscript', {
    name: 'NeonScript',
    extensions: ['neon'],
    db: [
        { label: 'neonBeam', insertText: 'neonBeam($0)', type: 'function', detail: 'Fires high-energy beam' },
        { label: 'fluxCapacitor', insertText: 'fluxCapacitor', type: 'variable', detail: '1.21 Gigawatts constant' },
        { label: 'activateCore', insertText: 'activateCore()', type: 'keyword', detail: 'Initialize power grid' }
    ],
    parser: 'neon',
    parserRules: [
        // Parses words defined as local variables for active indexing
        { regex: /define\s+([a-zA-Z_][a-zA-Z0-9_]*)/g, group: 1, type: 'variable' }
    ]
});
```

### 5.4 Syntax Highlighter Registration (`api.languages.registerHighlighter`)
Binds token highlighting rules to a language. These rules match regular expressions to core syntax themes.

```javascript
api.languages.registerHighlighter('neonscript', [
    { type: 'comment', regex: /\/\/.*|#.*/ },
    { type: 'string', regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/ },
    { type: 'keyword', regex: /\b(?:define|activateCore|fluxCapacitor)\b/ },
    { type: 'function', regex: /\b[a-zA-Z_]\w*(?=\s*\()/ },
    { type: 'number', regex: /\b\d+(?:\.\d+)?\b/ }
]);
```
*Note: Available token highlighting classes are `.syntax-comment`, `.syntax-doctype`, `.syntax-tag-name`, `.syntax-attr-name`, `.syntax-attr-value`, `.syntax-tag-bracket`, `.syntax-keyword`, `.syntax-string`, `.syntax-function`, `.syntax-builtin`, `.syntax-class-name`, `.syntax-number`, `.syntax-punctuation`, and `.syntax-bracket`.*

### 5.5 LSP Client Integration (`api.languages.registerLspClient`)
Wires an external Language Server Protocol executable to a file extension. 

```javascript
// Register a Python server (Assumes pyright-langserver is available globally)
api.languages.registerLspClient('py', 'pyright-langserver', ['--stdio']);

// Handle Windows vs. UNIX executable wrappers cleanly
const isWin = typeof window !== 'undefined' && window.process && window.process.platform === 'win32';
const tsCmd = isWin ? 'typescript-language-server.cmd' : 'typescript-language-server';

api.languages.registerLspClient('javascript', tsCmd, ['--stdio'], {
    javascript: {
        implicitProjectConfiguration: {
            checkJs: true
        }
    }
});
```

### 5.6 Custom Terminal Code Runner (`api.terminal.registerRunner`)
Registers script execution instructions. When a user clicks **Run** while a supported file extension is active, the runner directs compiler actions to the integrated terminal.

```javascript
api.terminal.registerRunner('neon', {
    label: 'NeonScript Engine',
    run: [
        { 
            cmd: 'node', 
            args: ['-e', 'console.log("Executing target: " + process.argv[1]);', '{file}'] 
        }
    ]
});
```
*Template parameters: `{file}` resolves to the active file's absolute path, `{dir}` resolves to its directory, `{base}` to the base name, and `{exe}` to a projected executable name.*

### 5.7 Custom Sidebar Panels (`api.views.registerSidebarPanel`)
Registers a new button inside the primary Activity Bar that displays a custom sidebar panel.

```javascript
api.views.registerSidebarPanel('neon-diagnostics', {
    iconClass: 'fa-solid fa-gauge-high', // FontAwesome class
    title: 'Neon Monitor',
    render: (container) => {
        container.innerHTML = `
            <div style="padding: 10px;">
                <h4 style="color:#00b4d8;">Status: ACTIVE</h4>
                <button id="btn-pulse" style="margin-top: 10px; width: 100%;">Pulse Reactor</button>
            </div>
        `;
        
        container.querySelector('#btn-pulse').addEventListener('click', () => {
            alert('Neon reactor pulsed!');
        });
    }
});
```

### 5.8 Custom Preference Settings (`api.views.registerSetting`)
Registers preference setting parameters. 

Settings that do not declare a `pluginId` are rendered inside the global "Editor Preferences" panel. Settings that **do** declare a `pluginId` are isolated from global preferences and are rendered on your extension's dedicated, VS Code-style Settings/Info details page.

Values are automatically persisted in `localStorage` under `setting-pref-[settingId]`. All select elements are retrofitted with custom styled dropdowns.

```javascript
api.views.registerSetting('neon-sparkle', {
    label: 'Enable Neon Sparkle Effect',
    type: 'checkbox',
    defaultValue: false,
    pluginId: 'my-custom-extension', // Maps this setting to the extension's dedicated info page
    description: 'Injects neon beams and sparkle effects across diagnostic overlays.',
    onChange: (isChecked) => {
        console.log("Sparkle updated: ", isChecked);
    }
});
```
*Supported types: `"checkbox"`, `"text"`, `"number"`, and `"select"` (which requires an `"options": []` array).*

### 5.9 Bottom Dock Tabs (`api.views.registerBottomPanelTab`)
Registers a tab inside the bottom dock, next to the built-in TERMINAL tab (e.g. a Problems or Test Results view). Each tab owns an isolated content container that is rendered once at registration.

```javascript
api.views.registerBottomPanelTab('neon-problems', {
    title: 'Problems', // Rendered uppercase in the tab strip
    render: (container) => {
        container.innerHTML = `<div style="padding:12px;">No neon leaks detected.</div>`;
    }
});

// Reveal the dock and focus your tab programmatically:
api.editor.openBottomPanelTab('neon-problems');
```
*The tab strip button receives the id `bottom-tab-[id]`, so its label can be updated live (e.g. appending a problem count).*

### 5.10 Status Bar Widgets (`api.views.registerStatusBarItem`)
Registers a live widget inside the bottom status bar. `render` is invoked with the (already-connected) element; keep a reference to update it later.

```javascript
api.views.registerStatusBarItem('neon-reactor-state', {
    side: 'right',                       // 'left' or 'right'
    tooltip: 'Reactor core temperature',
    onClick: () => alert('Reactor vented.'),
    render: (el) => {
        el.innerHTML = `<i class="fa-solid fa-atom"></i> Core: stable`;
    }
});
```

### 5.11 Right Dock Tool Windows (`api.views.registerRightPanel`)
Registers a tool window in the right-hand dock (IntelliJ-style). Each registered panel gets its own toggle button on a dedicated right activity bar; the dock stays hidden until at least one panel is live, and the user can resize it with a splitter. Content is rendered lazily the first time the panel is opened and then kept alive, so state survives toggling it shut and open again — making it the right home for rich, stateful side tools (outlines, dashboards, agents) rather than transient output.

```javascript
api.views.registerRightPanel('neon-inspector', {
    title: 'Inspector',          // Rendered uppercase in the panel header
    iconClass: 'fa-solid fa-wand-magic-sparkles',
    render: (container) => {
        container.innerHTML = `<div>Nothing selected.</div>`;
    }
});

// Programmatically reveal/hide a panel by id:
window.toggleRightPanel('neon-inspector');

api.views.unregisterRightPanel('neon-inspector');
```
*The toggle button receives the id `right-act-[id]` and the content container `right-content-[id]`.*

### 5.12 Core Event Bus (`api.events`)
Subscribe to editor lifecycle events. `on` returns an unsubscribe function. Plugins may also `emit` their own namespaced events to coordinate between modules.

| Event | Payload |
|---|---|
| `file-opened` | `{ path, name, contents }` — fired when a tab is opened or focused |
| `file-saved` | `{ path, name, contents }` |
| `content-changed` | `{ path, name, contents }` — debounced (~300ms) while typing |
| `diagnostics-updated` | `{ path, diagnostics: [{ start, end, line, col, severity, message }] }` |
| `workspace-opened` | `{ path }` |
| `file-created` | `{ path, name, kind }` — a file or folder was created in the explorer |
| `file-renamed` | `{ oldPath, path, name, kind }` |
| `file-deleted` | `{ path, name, kind }` |
| `ide-changed` | `{ ideId, name }` — `ideId` is `null` for the normal editor |

```javascript
const unsubscribe = api.events.on('file-saved', ({ name }) => {
    console.log(`Saved: ${name}`);
});
```

### 5.13 Editor Facade (`api.editor`)
Inspect and drive the live editor surface:

```javascript
api.editor.getText();                    // Full (unfolded) text of the active document
api.editor.setText(text);                // Replace the document (marks the tab dirty)
api.editor.getActiveFile();              // { path, name } or null
api.editor.getOpenFiles();               // [{ path, name }] for every open tab
api.editor.getLanguageId();              // 'py', 'js', … (extension of the active file)
api.editor.getSelection();               // { start, end, text }
api.editor.replaceSelection('…');        // Overwrite the selection (inserts at caret if empty)
api.editor.insertAtCursor('…');
api.editor.getCursorPosition();          // { line, column }, both 1-based
api.editor.goToLine(42, 4);              // Jump caret to 1-based line (optional 0-based column)
await api.editor.openFileByPath(path);   // Re-focus an already-open tab by absolute path
await api.editor.reloadActiveFile();     // Re-read active file from disk (e.g. after external formatting)
await api.editor.save();                 // Save the active file
api.editor.openBottomPanelTab(id);       // Reveal the bottom dock on a registered tab
```

### 5.14 Custom Diagnostic Underlines (`api.views.registerDiagnosticStyle`)
Registers custom syntax CSS classes for LSP warnings or error text decorators.

```javascript
api.views.registerDiagnosticStyle('neon-sparkle', {
    name: 'Neon Sparkle Underline',
    errorClass: 'diag-error-neon',
    warningClass: 'diag-warning-neon'
});
```
*Corresponding styles must be declared inside a loaded dynamic theme or inline stylesheet injection.*

### 5.15 Explorer Context Menu Entries (`api.menus.registerExplorerItem`)

Adds entries to the right-click menu on files, folders, and the empty space below the file
tree. Your entries are merged with the editor's built-in actions (New File, Rename, Delete,
Copy Path, and so on).

```javascript
api.menus.registerExplorerItem('minify-css', {
    label: 'Minify Stylesheet',
    icon: 'fa-solid fa-compress',
    group: 'plugins',
    order: 10,
    when: (target) => target.kind === 'file' && target.name.endsWith('.css'),
    onClick: (target) => {
        console.log('Minifying', target.path);
    }
});
```

**Config fields**

| Field | Type | Description |
| --- | --- | --- |
| `label` | string \| `(target) => string` | Menu text; a function can interpolate the target name |
| `icon` | string | Font Awesome class |
| `group` | string | Placement slot (below). Defaults to `'plugins'` |
| `order` | number | Sort position inside the group. Defaults to `100` |
| `when` | `(target) => boolean` | Show only when true |
| `enabled` | `(target) => boolean` | Grey the entry out when false |
| `submenu` | array \| `(target) => array` | Nested entries; use `{ separator: true }` for dividers |
| `danger` | boolean | Renders in red |
| `onClick` | `(target) => void \| Promise` | The action |

**The `target` object**

| Field | Description |
| --- | --- |
| `kind` | `'file'`, `'directory'`, or `'root'` when empty space was clicked |
| `name` / `path` | Name and absolute path of the clicked entry |
| `handle` / `parent` | Underlying file handle and its parent directory handle |
| `isRoot`, `isEmptyArea` | True when empty space was clicked |
| `rootPath` | Absolute path of the open workspace |
| `api` | The editor API |
| `refresh()` | Repaints the explorer |

**Groups**, in display order: `new`, `open`, `clipboard`, `edit`, `copy`, `reveal`,
`plugins`, then any custom group name you invent, then `danger`. Separators are inserted
between groups automatically, and `danger` stays last so Delete keeps its position.

`api.menus.registerEditorItem(id, config)` takes the same shape for the code editor's own
right-click menu. Both have matching `unregisterExplorerItem` / `unregisterEditorItem`
methods.

### 5.16 IDE Scoping and Bundled Extensions

Extensions installed in `custom/extensions/` are **always active**, regardless of which IDE
the user has selected.

Extensions **bundled inside an IDE** (`custom/ides/<ide>/extensions/<your-ext>/`) behave
differently: they are owned by their host IDE, so every contribution they register is live
only while that IDE is the selected workspace. Write them exactly the same way — the host
handles the scoping. See `IDEs.md` §2.

---

## 6. Developer Workflow: Hot-Reloading

The Pro Code Editor supports dynamic developer hot-reloading. You do not need to restart the Electron application to test changes.

1. Open your workspace folder.
2. Select the **Plugins Manager** tab (puzzle icon) in the Activity Bar.
3. Edit your extension code inside `custom/extensions/my-custom-extension/`.
4. Click **Reload** in the top right corner of the Plugins panel. 
5. The host application will flush the registries and reload your plugin's active module using cache-busting queries.