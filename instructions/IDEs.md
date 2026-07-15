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

---

## 2. IDE Directory Conventions & Bundled Extensions

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

## 3. The IDE Manifest (`package.json`)

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

## 4. Registering your IDE (`api.workspace.registerIDE`)

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

## 5. The IDE Context API (`ctx`)

When `onActivate(ctx)` is called, the host passes a highly capable workspace context (`ctx`) parameter. Your IDE uses this context to control the main window frame and modify file workspaces.

### 5.1 `ctx.addToolbarButton(id, label, iconClass, onClick)`
Injects a custom control button into the center of the application's top title bar.

```javascript
ctx.addToolbarButton('help-info', 'Workspace Help', 'fa-solid fa-circle-question', () => {
    alert("Use the 'Go Live' action to launch a local development server.");
});
```

### 5.2 `ctx.createProjectStructure(structure)`
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

### 5.3 `ctx.showCustomModal(config)`
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

### 5.4 `ctx.copyTemplateFolder(templateFolderName)`
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

### 5.5 `ctx.openFile(fileHandle)`
Instructs the editor workspace to open a specific file handle. Useful for auto-opening entry files after a template has been generated.

---

## 6. Adding IDE-Specific Settings

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

## 7. Complete Implementation: Web Creator IDE Tutorial

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