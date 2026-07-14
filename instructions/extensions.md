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
- User preference settings
- Custom diagnostic styles (linters and error displays)

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
Injects native interactive inputs directly into the Editor Preferences settings panel. Input values are automatically persisted in `localStorage` inside the namespace `setting-pref-[settingId]`.

```javascript
api.views.registerSetting('neon-sparkle', {
    label: 'Enable Neon Sparkle Effect',
    type: 'checkbox',
    defaultValue: false,
    onChange: (isChecked) => {
        console.log("Sparkle updated: ", isChecked);
    }
});
```
*Supported types: `"checkbox"`, `"text"`, `"number"`, and `"select"` (which requires an `"options": []` array).*

### 5.9 Custom Diagnostic Underlines (`api.views.registerDiagnosticStyle`)
Registers custom syntax CSS classes for LSP warnings or error text decorators.

```javascript
api.views.registerDiagnosticStyle('neon-sparkle', {
    name: 'Neon Sparkle Underline',
    errorClass: 'diag-error-neon',
    warningClass: 'diag-warning-neon'
});
```
*Corresponding styles must be declared inside a loaded dynamic theme or inline stylesheet injection.*

---

## 6. Developer Workflow: Hot-Reloading

The Pro Code Editor supports dynamic developer hot-reloading. You do not need to restart the Electron application to test changes.

1. Open your workspace folder.
2. Select the **Plugins Manager** tab (puzzle icon) in the Activity Bar.
3. Edit your extension code inside `custom/extensions/my-custom-extension/`.
4. Click **Reload** in the top right corner of the Plugins panel. 
5. The host application will flush the registries and reload your plugin's active module using cache-busting queries.