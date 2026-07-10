export function activate(api) {
    api.workspace.registerIDE('web-dev-ide', {
        name: 'Web Creator IDE',
        onActivate: (ctx) => {
            // Register structured template generation tool action (Step 4 Update)
            ctx.addToolbarButton('new-web-project', 'Create Web Project', 'fa-solid fa-wand-magic-sparkles', async () => {
                const confirmCreate = confirm("Generate a structured web template layout (src/, assets/, HTML index, stylesheets, & entry app)?");
                if (!confirmCreate) return;
                
                await ctx.createProjectStructure({
                    folders: ['src', 'assets'],
                    files: {
                        'src/index.html': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Structured Web Template</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="card">
        <h1>Web Creator IDE Project</h1>
        <p>A highly structured static web workspace generated automatically.</p>
    </div>
    <script src="app.js"></script>
</body>
</html>`,
                        'src/style.css': `body {
    background-color: #0d1b2a;
    color: #e0e1dd;
    font-family: sans-serif;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    margin: 0;
}
.card {
    background-color: #1b263b;
    border: 1px solid #415a77;
    padding: 24px;
    border-radius: 8px;
    text-align: center;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}`,
                        'src/app.js': `console.log("Workspace project template successfully constructed.");`
                    }
                });
            });

            ctx.addToolbarButton('preview-web-info', 'Workspace Help', 'fa-solid fa-circle-question', () => {
                alert("Welcome to the Web Creator environment!\n\nUse 'Go Live' in the status bar to view index.html static previews.");
            });
        },
        onDeactivate: () => {
            console.log("Web Creator IDE environment closed.");
        },
        getWelcomePageHTML: () => {
            return `
                <div style="text-align:center; max-width:480px; font-family:var(--font-ui); display:flex; flex-direction:column; gap:16px; align-items:center;">
                    <div style="background:rgba(0,180,216,0.1); width:64px; height:64px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid #00b4d8;">
                        <i class="fa-solid fa-globe" style="font-size:32px; color:#00b4d8;"></i>
                    </div>
                    <h2 style="font-weight:600; font-size:20px; color:#ffffff; margin:0;">Web Creator IDE</h2>
                    <p style="font-size:13px; color:var(--text-muted); line-height:1.6; margin:0;">
                        A tailored workspace interface optimized for rapid web layouts, templates, and static script preview rendering.
                    </p>
                    <div style="display:flex; flex-direction:column; gap:12px; width:100%; text-align:left; background:var(--bg-darker); border:1px solid var(--border-color); padding:16px; border-radius:6px; font-size:12px;">
                        <div style="font-weight:600; color:#00b4d8; margin-bottom:4px; font-size:13px;">Structured Project Actions:</div>
                        <div>✨ Click <strong>Create Web Project</strong> on your toolbar to generate a standard folder template (src/ & assets/).</div>
                        <div>🚀 Use <strong>Go Live</strong> in the status bar to run your templates in browser views.</div>
                    </div>
                </div>
            `;
        }
    });
}