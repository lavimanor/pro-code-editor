export function activate(api) {
    api.workspace.registerIDE('web-dev-ide', {
        name: 'Web Creator IDE',
        onActivate: (ctx) => {
            // Register specialized workspace toolbar buttons
            ctx.addToolbarButton('new-web-project', 'Create HTML Template', 'fa-solid fa-wand-magic-sparkles', () => {
                alert("Web IDE tip: Choose your workspace directory, create a blank 'index.html' file using the 'New File' button, and start editing!");
            });

            ctx.addToolbarButton('preview-web-info', 'Workspace Help', 'fa-solid fa-circle-question', () => {
                alert("Welcome to the Web Creator environment!\n\nUse the status-bar button 'Go Live' in HTML, CSS, or JS files to view instantaneous static browser renders.");
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
                        <div style="font-weight:600; color:#00b4d8; margin-bottom:4px; font-size:13px;">Tailored Workflow Actions:</div>
                        <div>⚡ Use <strong>Create HTML Template</strong> on your toolbar for setup logs.</div>
                        <div>🌐 Fire up <strong>Go Live</strong> in the status bar to review your results in real-time.</div>
                    </div>
                </div>
            `;
        }
    });
}