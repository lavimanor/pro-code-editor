# Developer Guide: Creating Custom IDE Environments for Pro Code Editor

This document outlines how to design, package, and develop full custom IDE workspaces for the Pro Code Editor using the developer APIs.

---

## 1. IDE vs. Extension: What is the Difference?

While an **Extension** adds specific syntax capabilities, tools, or styles, an **IDE** defines a complete, tailored workspace. An IDE can:
- Generate structured multi-folder directory templates.
- Bundle predefined asset resources.
- Create custom toolbar control systems inside the top bar.
- Provide custom workspace dialog interfaces.
- Intercept workspace loading events to render a welcome dashboard.
- Register dedicated IDE-specific configuration settings.
- Contribute sidebar panels, bottom dock tabs, status bar widgets, themes, icon packs, languages, runners, keybindings, stylesheets, and right-click menu entries.
- Read and write the workspace filesystem and run shell commands.

**The key rule:** an IDE's functionality is live *only while that IDE is the selected workspace.* See section 2.

---

## 2. IDE Scoping: Contributions Are Not Global

Everything an IDE plugin registers is scoped to that IDE's selection. When the user picks a
different environment from the IDE dropdown — or returns to **Normal Editor** — every
contribution the IDE made is switched off, and it comes back when the IDE is reselected.

This applies to *all* registrations made in the plugin's `activate(api)` function, not just
the ones made through the activation context:

| Contribution | Scoped? |
| --- | --- |
| Sidebar panels, bottom tabs, status bar items | Yes |
| Settings fields and diagnostic styles | Yes |
| Themes and icon packs | Yes — the selector hides them, and the editor falls back to a built-in if one was in use |
| Languages, highlighters, autocomplete, LSP clients | Yes — language servers are shut down on switch away |
| Terminal runners (the Run button) | Yes — the run registry is rebuilt on every switch |
| Event subscriptions (`api.events.on`) | Yes — listeners do not fire while the IDE is inactive |
| Context menu entries | Yes |
| Extensions the IDE **bundles** (`extensions/` subfolder) | Yes — they follow their host IDE |
| Standalone extensions in `custom/extensions/` | **No** — these are always active |

You do not need to opt in to any of this. Registering normally is enough:

```javascript
export function activate(api) {
    // Only live while 'my-ide' is the selected workspace.
    api.views.registerSidebarPanel('my-panel', { /* … */ });
    api.themes.register('my-theme', { /* … */ });
    api.terminal.registerRunner('mylang', { /* … */ });

    api.workspace.registerIDE('my-ide', { name: 'My IDE', /* … */ });
}
```

Anything registered inside `onActivate(ctx)` through the context (section 6) is *additionally*
torn down the moment the user leaves — see `ctx.onDispose`.

---

## 3. IDE Directory Conventions & Bundled Extensions

Custom IDEs are placed inside the `custom/ides/` directory.

An IDE can also bundle integrated extensions inside its folder. These extensions are private to the IDE: they activate when the IDE workspace is selected and cannot be disabled independently.

```
custom/
  ides/
    web-dev-ide/
      package.json          # IDE Manifest (declares dependencies or bundled plugins)
      index.js              # Entry point registering workspace hooks
      icon.svg              # Optional: Workspace selection icon
      core-files/           # Optional: Template files and assets cloned to user projects
        assets-manifest.json
        libs-bootstrap.css
      extensions/           # Optional: Bundled extensions owned by this IDE
        web-snippets/
          package.json
          index.js
          icon.svg
```

---

## 4. The IDE Manifest (`package.json`)

The manifest for an IDE uses `"type": "ide"` and can declare dependencies on other extensions.

### Example Manifest:

```json
{
  "id": "web-dev-ide",
  "name": "Web Creator IDE",
  "description": "An optimized workspace environment for rapid web prototyping and design.",
  "version": "1.0.0",
  "apiVersion": "1.0.0",
  "type": "ide",
  "main": "index.js",
  "icon": "icon.svg",
  "extensionDependencies": ["web-snippets"]
}
```

### Key Field Definitions:
- **`type`**: Must be set to `"ide"`.
- **`extensionDependencies`** *(Array, Optional)*: A list of extension IDs that must be loaded before the IDE can activate. If an extension in this list is currently deactivated by the user, the host force-enables and locks it to prevent system errors.
- **`main`**: Points to the main script file.

---

## 5. Registering your IDE (`api.workspace.registerIDE`)

Your entry point script must call `api.workspace.registerIDE(id, config)` inside its `activate` function.

### IDE Registration Blueprint:

```javascript
export function activate(api) {
    api.workspace.registerIDE('web-dev-ide', {
        name: 'Web Creator IDE',
        
        // Triggered when the user selects this environment in the IDE dropdown
        onActivate: (ctx) => {
            console.log("Web Creator IDE activated.");
            setupWorkspace(ctx);
        },
        
        // Triggered when the user switches to a different IDE or closes this workspace
        onDeactivate: () => {
            console.log("Web Creator IDE deactivated.");
        },
        
        // Returns the HTML markup shown on the central welcome screen when no files are open
        getWelcomePageHTML: () => {
            return `
                <div style="text-align: center; padding: 40px; font-family: sans-serif;">
                    <h2>Welcome to Web Creator IDE</h2>
                    <p style="color: #888;">Select "Create Web Project" in the toolbar to start.</p>
                </div>
            `;
        }
    });
}
```

---

## 6. The IDE Context API (`ctx`)

When `onActivate(ctx)` is called, the host passes a highly capable workspace context (`ctx`) parameter. Your IDE uses this context to control the main window frame and modify file workspaces.

### 6.1 `ctx.addToolbarButton(id, label, iconClass, onClick)`
Injects a custom control button into the center of the application's top title bar.

```javascript
ctx.addToolbarButton('help-info', 'Workspace Help', 'fa-solid fa-circle-question', () => {
    alert("Use the 'Go Live' action to launch a local development server.");
});
```

### 6.2 `ctx.createProjectStructure(structure)`
Generates file layouts (including directories, sub-directories, and default template documents) directly within the currently active workspace.

```javascript
ctx.addToolbarButton('new-web-project', 'Create Web Project', 'fa-solid fa-wand-magic-sparkles', async () => {
    const confirmCreate = confirm("Generate a structured web template layout?");
    if (!confirmCreate) return;
    
    const result = await ctx.createProjectStructure({
        folders: ['src', 'assets'],
        files: {
            'src/index.html': `<!DOCTYPE html>
<html>
<head><title>Web Project</title></head>
<body><h1>Hello World</h1></body>
</html>`,
            'src/style.css': `body { background-color: #0d1b2a; }`
        }
    });

    if (result && result.success && result.files['src/index.html']) {
        // Automatically open the primary index file
        await ctx.openFile(result.files['src/index.html']);
    }
});
```

### 6.3 `ctx.showCustomModal(config)`
Renders a custom dialog interface styled according to the editor's theme. Returns a Promise that resolves with an key-value object containing the user's input values. All selection fields are automatically mapped to custom dropdown components.

```javascript
ctx.addToolbarButton('configure-project', 'Custom Setup', 'fa-solid fa-sliders', async () => {
    const results = await ctx.showCustomModal({
        title: "Configure Build Settings",
        inputs: [
            { id: "appName", label: "Project/App Name", type: "text", defaultValue: "web-app" },
            { id: "enableLogging", label: "Include developer debug log trace", type: "checkbox", defaultValue: true },
            { id: "framework", label: "Target Framework Preset", type: "select", options: ["Vanilla CSS", "TailwindCSS"], defaultValue: "Vanilla CSS" }
        ],
        okLabel: "Build Config",
        cancelLabel: "Cancel"
    });

    if (results) {
        console.log("Configuration parameters set: ", results);
    }
});
```

### 6.4 `ctx.copyTemplateFolder(templateFolderName)`
Copies an entire folder from your plugin's local directory on disk into the user's open workspace. 

*Note: This feature relies on native file APIs and is only supported when running inside the Electron shell. On success, it returns a boolean value.*

```javascript
ctx.addToolbarButton('replicate-core', 'Copy Framework Assets', 'fa-solid fa-clone', async () => {
    const success = await ctx.copyTemplateFolder('core-files');
    if (success) {
        alert("Predefined template assets successfully copied to your workspace.");
    }
});
```

### 6.5 `ctx.openFile(fileHandle)`
Instructs the editor workspace to open a specific file handle. Useful for auto-opening entry files after a template has been generated.

### 6.6 Contributed UI

Everything registered here is removed automatically when the user leaves the IDE — you never
have to clean it up yourself.

```javascript
ctx.registerSidebarPanel('my-panel', {
    iconClass: 'fa-solid fa-cubes',
    title: 'My Tools',
    render: (container) => { container.innerHTML = '<p>Panel content</p>'; }
});

ctx.registerBottomPanelTab('my-output', {
    title: 'Build Output',
    render: (container) => { container.textContent = 'Waiting…'; }
});

ctx.registerStatusBarItem('my-indicator', {
    side: 'right',
    tooltip: 'Build status',
    text: '✓ Ready'
});

ctx.registerRightPanel('my-structure', {
    title: 'Structure',
    iconClass: 'fa-solid fa-list-tree',
    render: (container) => { container.innerHTML = '<p>Outline…</p>'; }
});

ctx.registerSetting('auto-build', {
    label: 'Build on save',
    type: 'checkbox',
    defaultValue: true,
    onChange: (enabled) => console.log('auto build:', enabled)
});
```

**`ctx.registerRightPanel(id, config)`** adds a tool window to the right-hand dock
(IntelliJ-style). Each registered panel gets its own toggle button on a right activity bar;
the whole dock stays hidden until at least one panel is live, and a splitter lets the user
resize it. Config is `{ title, iconClass, render(container) }`. The panel is rendered lazily
the first time it is opened and the container is then **kept alive**, so state (scroll
position, in-flight work, a future agent conversation) survives toggling the panel shut and
open again. Use it for rich side tools — outlines, structure views, dashboards, agents —
rather than transient output, which belongs in a bottom-dock tab. The HyperWeb IDE ships a
`Structure` panel (`src/outline.js`) as a worked example: it subscribes to `file-opened` and
`content-changed` and rebuilds a clickable symbol list that jumps the caret via
`ctx.editor.goToLine`.

`ctx.registerExplorerMenuItem(id, config)` and `ctx.registerEditorMenuItem(id, config)` add
right-click entries — see section 9.

### 6.7 Languages, Themes and Runners

```javascript
ctx.registerLanguage('mylang', { name: 'MyLang', extensions: ['ml'], db: [/* … */] });
ctx.registerHighlighter('mylang', [{ type: 'keyword', regex: /\b(let|fn)\b/ }]);
ctx.registerLspClient('ml', 'mylang-langserver', ['--stdio']);
ctx.registerTheme('my-dark', { name: 'My Dark', colors: { /* … */ } });
ctx.registerIconPack('my-icons', { name: 'My Icons', getFolderIcon: () => '📁', getFileIcon: (n) => '📄' });
await ctx.registerRunner('ml', { label: 'MyLang', run: [{ cmd: 'mylang', args: ['{file}'] }] });
```

**`ctx.registerLspClient(ext, command, args, initOptions, features)`** — the editor always
wires up push diagnostics and hover from the server. The optional 5th argument opts into
the two features that are driven off the live server:

```javascript
ctx.registerLspClient('ml', 'mylang-langserver', ['--stdio'], null, {
    semanticTokens: true, // paint the server's semantic tokens over the regex highlighter
    completion: true      // feed the server's completions into the ProSense popup
});
```

Both default off (a bare registration keeps diagnostics + hover only), and each is
additionally gated by the server's advertised capabilities — enabling `semanticTokens` for
a server that offers none is a harmless no-op, leaving the regex highlighter in place.
Semantic token colours map onto the active theme's `--syntax-*` variables via the core
`.sem-*` CSS classes.

### 6.8 Filesystem Access (`ctx.fs`)

Paths are resolved against the open workspace folder; absolute paths are used as-is.

| Method | Description |
| --- | --- |
| `ctx.fs.readFile(path)` | Returns the file's text |
| `ctx.fs.writeFile(path, contents)` | Writes the file, creating parent folders |
| `ctx.fs.exists(path)` | Boolean |
| `ctx.fs.list(path)` | `[{ name, path, kind }]` |
| `ctx.fs.mkdir(path)` | Creates a directory tree |
| `ctx.fs.delete(path)` | Removes a file or folder recursively |
| `ctx.fs.join(...segments)` | Platform-correct path join |

```javascript
if (!ctx.fs.exists('build')) await ctx.fs.mkdir('build');
await ctx.fs.writeFile('build/manifest.json', JSON.stringify({ built: Date.now() }));
```

### 6.9 `ctx.runCommand(command, options)`

Runs a shell command in the workspace directory. Output streams to the terminal as it
arrives. Resolves to `{ success, output, code }`.

```javascript
ctx.addToolbarButton('install', 'Install Deps', 'fa-solid fa-download', async () => {
    ctx.terminal.show();
    const result = await ctx.runCommand('npm install');
    ctx.notify(result.success ? 'Dependencies installed' : 'Install failed',
               result.success ? 'success' : 'error');
});
```

Pass `{ cwd }` to run somewhere other than the workspace root, or `{ stream: false }` to
capture output without printing it.

### 6.10 Editor and Terminal Surfaces

```javascript
ctx.editor.getText();                     // Full document text
ctx.editor.setText(text);                 // Replace the document
ctx.editor.getSelection();                // { start, end, text }
ctx.editor.replaceSelection('…');
ctx.editor.insertAtCursor('…');
ctx.editor.getCursorPosition();           // { line, column }
ctx.editor.getLanguageId();               // 'py', 'js', …
ctx.editor.getActiveFile();               // { path, name } | null
ctx.editor.getOpenFiles();                // [{ path, name }]
await ctx.editor.save();
ctx.editor.goToLine(42);

ctx.terminal.print('[MyIDE] Ready', 'system');
ctx.terminal.show();
ctx.terminal.setDirectory('C:/projects/app');
```

### 6.11 Events

`ctx.on(event, callback)` subscribes for this IDE's lifetime only.

| Event | Payload |
| --- | --- |
| `file-opened` | `{ path, name, contents }` |
| `file-saved` | `{ path, name, contents }` |
| `content-changed` | `{ path, contents }` |
| `file-created` | `{ path, name, kind }` |
| `file-renamed` | `{ oldPath, path, name, kind }` |
| `file-deleted` | `{ path, name, kind }` |
| `workspace-opened` | `{ path }` |
| `ide-changed` | `{ ideId, name }` |
| `diagnostics-updated` | `{ path, diagnostics }` |

```javascript
ctx.on('file-saved', async ({ path, name }) => {
    if (name.endsWith('.scss')) await ctx.runCommand(`sass "${path}"`);
});
```

### 6.12 Persistence, Interaction and Keybindings

```javascript
// Per-IDE store — namespaced, so IDEs cannot collide
ctx.storage.set('lastTarget', { name: 'debug' });
const target = ctx.storage.get('lastTarget', { name: 'release' });

ctx.notify('Build complete', 'success');       // 'info' | 'success' | 'warning' | 'error'
const name = await ctx.prompt('Module name:', 'my-module');
const ok = await ctx.confirm('Delete the build folder?');
const choice = await ctx.quickPick(['Debug', 'Release'], { title: 'Build mode' });

ctx.registerKeybinding('ctrl+shift+b', () => runBuild());
ctx.injectCSS('.my-ide-badge { color: #00b4d8; }');
```

### 6.13 Miscellaneous

| Member | Description |
| --- | --- |
| `ctx.id` | The id this IDE was registered under |
| `ctx.api` | The full editor API, for anything the context doesn't wrap |
| `ctx.workspace` | `{ rootPath, name, isOpen, handle }` |
| `ctx.addToolbarSeparator()` | Vertical rule between toolbar control groups |
| `ctx.refreshExplorer()` | Repaints the file tree |
| `ctx.emit(event, payload)` | Broadcasts a custom event |
| `ctx.onDispose(fn)` | Runs `fn` when the user leaves this IDE |

`ctx.addToolbarButton` returns the button element, so you can mutate it later:

```javascript
const btn = ctx.addToolbarButton('run', 'Run', 'fa-solid fa-play', doRun);
btn.disabled = true;
```

Use `ctx.onDispose` for anything you set up yourself:

```javascript
const timer = setInterval(pollBuildServer, 5000);
ctx.onDispose(() => clearInterval(timer));
```

---

## 7. Adding IDE-Specific Settings

IDEs can register custom, dedicated settings fields that reside strictly on their own **Details & Settings page** in the virtual tab bar. This isolates IDE settings from the global "Editor Preferences" panel and keeps your workspace organized.

To configure IDE-specific settings, register your properties using `api.views.registerSetting` and map them directly using your IDE package ID:

```javascript
export function activate(api) {
    // Register IDE setting
    api.views.registerSetting('my-ide-setting', {
        label: 'Auto-compile Templates',
        type: 'checkbox',
        defaultValue: true,
        pluginId: 'web-dev-ide', // Maps settings strictly to this IDE's Details tab
        description: 'Compiles and aggregates project layouts in background threads on save.',
        onChange: (isEnabled) => {
            console.log("IDE compile state updated: ", isEnabled);
        }
    });

    // Register Workspace
    api.workspace.registerIDE('web-dev-ide', {
        name: 'Web Creator IDE',
        onActivate: (ctx) => {
            // ...
        }
    });
}
```

---

## 8. Complete Implementation: Web Creator IDE Tutorial

Below is a complete, production-ready `index.js` showing how to implement an IDE that leverages toolbar injection, modal parameters, directory tree generation, and asset replication.

```javascript
export function activate(api) {
    api.workspace.registerIDE('web-dev-ide', {
        name: 'Web Creator IDE',
        onActivate: (ctx) => {
            
            // 1. Add web boilerplate creation hook
            ctx.addToolbarButton('new-web-project', 'Create Web Project', 'fa-solid fa-wand-magic-sparkles', async () => {
                const confirmCreate = confirm("Generate a structured web template layout (src/, assets/, HTML index, stylesheets, & entry app)?");
                if (!confirmCreate) return;
                
                const result = await ctx.createProjectStructure({
                    folders: ['src', 'assets'],
                    files: {
                        'src/index.html': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Web IDE Project</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <h1>Web Creator IDE Project</h1>
    <script src="app.js"></script>
</body>
</html>`,
                        'src/style.css': `body { background-color: #0d1b2a; color: #fff; font-family: sans-serif; }`,
                        'src/app.js': `console.log("Workspace project template successfully constructed.");`
                    }
                });

                if (result && result.success && result.files['src/index.html']) {
                    await ctx.openFile(result.files['src/index.html']);
                }
            });

            // 2. Add build parameters configuration hook
            ctx.addToolbarButton('configure-project', 'Custom Setup', 'fa-solid fa-sliders', async () => {
                const results = await ctx.showCustomModal({
                    title: "Configure Build Settings",
                    inputs: [
                        { id: "appName", label: "Project/App Name", type: "text", defaultValue: "web-creator-app" },
                        { id: "enableLogging", label: "Include developer debug log trace", type: "checkbox", defaultValue: true },
                        { id: "framework", label: "Target Framework Preset", type: "select", options: ["Vanilla CSS", "SASS Module", "TailwindCSS"], defaultValue: "Vanilla CSS" }
                    ],
                    okLabel: "Build Config",
                    cancelLabel: "Cancel"
                });

                if (!results) return;

                await ctx.createProjectStructure({
                    folders: ['src'],
                    files: {
                        'src/app-config.js': `// Generated by Web Creator IDE Setup
export const AppConfig = {
    appName: "${results.appName}",
    enableLogging: ${results.enableLogging},
    framework: "${results.framework}"
};`
                    }
                });

                alert("Successfully created customized configuration file: src/app-config.js!");
            });

            // 3. Add framework assets copy hook
            ctx.addToolbarButton('replicate-core', 'Replicate Core', 'fa-solid fa-clone', async () => {
                const confirmCopy = confirm("Replicate the predefined 'core-files' folder from the IDE plugin directory directly into your workspace?");
                if (!confirmCopy) return;

                const success = await ctx.copyTemplateFolder('core-files');
                if (success) {
                    alert("IDE predefined template folder copy finished successfully!");
                }
            });
        },
        onDeactivate: () => {
            console.log("Web Creator IDE environment closed.");
        },
        getWelcomePageHTML: () => {
            return `
                <div style="text-align:center; max-width:480px; font-family:sans-serif; display:flex; flex-direction:column; gap:16px; align-items:center; margin: auto;">
                    <div style="background:rgba(0,180,216,0.1); width:64px; height:64px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid #00b4d8; margin-bottom: 12px;">
                        <i class="fa-solid fa-globe" style="font-size:32px; color:#00b4d8;"></i>
                    </div>
                    <h2 style="font-weight:600; font-size:20px; color:#ffffff; margin:0;">Web Creator IDE</h2>
                    <p style="font-size:13px; color:#888; line-height:1.6; margin:0;">
                        A tailored workspace interface optimized for rapid web layouts, templates, and static script preview rendering.
                    </p>
                    <div style="display:flex; flex-direction:column; gap:12px; width:100%; text-align:left; background:#181818; border:1px solid #3c3c3c; padding:16px; border-radius:6px; font-size:12px; margin-top: 10px;">
                        <div style="font-weight:600; color:#00b4d8; margin-bottom:4px; font-size:13px;">Structured Project Actions:</div>
                        <div>✨ Click <strong>Create Web Project</strong> on your toolbar to generate a standard folder template (src/ & assets/).</div>
                        <div>🚀 Use <strong>Go Live</strong> in the status bar to run your templates in browser views.</div>
                    </div>
                </div>
            `;
        }
    });
}
```
---

## 9. Contributing to the Explorer Context Menu

Right-clicking a file, a folder, or the empty space below the tree opens a menu built from
the editor's built-in actions plus every registered contribution.

An IDE registers entries through `ctx.registerExplorerMenuItem(id, config)` so they are
removed when the workspace is switched. (Extensions use `api.menus.registerExplorerItem` —
see `extensions.md` §5.14 — with the same config shape.)

### Item Configuration

| Field | Type | Description |
| --- | --- | --- |
| `label` | string \| `(target) => string` | Menu text. A function lets you interpolate the target's name. |
| `icon` | string | Font Awesome class, e.g. `'fa-solid fa-bolt'` |
| `group` | string | Placement slot — see below. Defaults to `'plugins'`. |
| `order` | number | Sort position within the group. Defaults to `100`. |
| `when` | `(target) => boolean` | Show the entry only when this returns true |
| `enabled` | `(target) => boolean` | Render greyed out when this returns false |
| `submenu` | array \| `(target) => array` | Nested entries (same shape, minus `group`) |
| `danger` | boolean | Renders in red, like Delete |
| `onClick` | `(target) => void \| Promise` | The action |

### The `target` Object

Every callback receives the entry that was right-clicked:

| Field | Description |
| --- | --- |
| `kind` | `'file'`, `'directory'`, or `'root'` for empty space |
| `name` | File or folder name |
| `path` | Absolute path |
| `handle` | The underlying file handle |
| `parent` | Parent directory handle (`null` at the root) |
| `isRoot` / `isEmptyArea` | True when empty space was clicked |
| `rootPath` | Absolute path of the open workspace |
| `api` | The editor API |
| `refresh()` | Repaints the explorer |

### Groups

Built-in slots, in display order: `new`, `open`, `clipboard`, `edit`, `copy`, `reveal`,
`plugins`, then any group name you invent, then `danger`. Separators between groups are
inserted automatically, and `danger` always stays last so Delete keeps its position.

### Example

```javascript
onActivate: (ctx) => {
    // A simple entry restricted to one file type
    ctx.registerExplorerMenuItem('minify-css', {
        label: 'Minify Stylesheet',
        icon: 'fa-solid fa-compress',
        group: 'plugins',
        when: (target) => target.kind === 'file' && target.name.endsWith('.css'),
        onClick: async (target) => {
            const css = await ctx.fs.readFile(target.path);
            await ctx.fs.writeFile(target.path.replace(/\.css$/, '.min.css'),
                                   css.replace(/\s+/g, ' '));
            ctx.notify('Minified ' + target.name, 'success');
        }
    });

    // A submenu on folders, in its own group
    ctx.registerExplorerMenuItem('scaffold', {
        label: (target) => `Scaffold in "${target.name}"`,
        icon: 'fa-solid fa-wand-magic-sparkles',
        group: 'scaffold',
        when: (target) => target.kind === 'directory' || target.isRoot,
        submenu: (target) => [
            {
                label: 'Component',
                icon: 'fa-solid fa-cube',
                onClick: () => scaffoldComponent(target.path)
            },
            { separator: true },
            {
                label: 'Page',
                icon: 'fa-regular fa-file-lines',
                enabled: () => target.kind === 'directory',
                onClick: () => scaffoldPage(target.path)
            }
        ]
    });
}
```
