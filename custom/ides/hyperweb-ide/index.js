import { registerWebSyntax, WEB_LANGUAGES } from './src/syntax.js';
import { registerWebLsp, WEB_SERVERS } from './src/lsp.js';
import { registerLspStatus } from './src/status.js';
import { registerOutlinePanel } from './src/outline.js';
import { snapshotLanguageRegistries } from './src/registry-guard.js';
import { setupProjectTools } from './src/project-tools.js';
import { registerHyperWebSidebar } from './src/hyperweb-sidebar.js';
import { registerExplorerMenu } from './src/explorer-menu.js';
import { registerWebFormatter } from './src/formatter.js';

export function activate(api) {
    // 1. Register unified HyperWeb sidebar panel
    registerHyperWebSidebar(api);

    api.workspace.registerIDE('hyperweb-ide', {
        name: 'HyperWeb IDE',
        onActivate: (ctx) => {
            // Language registry guard for shared languages
            ctx.onDispose(snapshotLanguageRegistries(ctx, {
                languages: WEB_LANGUAGES.flatMap((lang) => lang.extensions),
                highlighters: WEB_LANGUAGES.map((lang) => lang.id),
                lspClients: WEB_SERVERS.map((server) => server.key)
            }));

            // Highlighting for HTML, CSS, JavaScript, TypeScript & JSX
            registerWebSyntax(ctx);

            // Diagnostics, hover & completions from language servers
            const servers = registerWebLsp(ctx);

            // Status bar indicator
            ctx.registerStatusBarItem('hyperweb-indicator', {
                side: 'right',
                tooltip: 'HyperWeb IDE is active',
                text: '⚡ HyperWeb v2'
            });

            // Language server status widget
            registerLspStatus(ctx, servers);

            // Right-dock Structure panel
            registerOutlinePanel(ctx);

            // Toolbar scaffolding and design tools
            setupProjectTools(ctx);

            // Explorer context menu entries
            registerExplorerMenu(ctx);

            // Format on save pipeline
            registerWebFormatter(ctx);

            ctx.terminal.print('[HyperWeb] Full web workspace active — Syntax, Design Studio & Sandbox initialized.', 'system');
        },
        onDeactivate: () => {
            console.log('HyperWeb IDE environment closed.');
        },
        getWelcomePageHTML: () => {
            return `
                <div style="text-align:center; max-width:520px; font-family:var(--font-ui, sans-serif); display:flex; flex-direction:column; gap:16px; align-items:center; margin: auto; padding: 24px;">
                    <div style="background:rgba(0,180,216,0.1); width:64px; height:64px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid #00b4d8; box-shadow: 0 0 20px rgba(0,180,216,0.2);">
                        <i class="fa-solid fa-globe" style="font-size:32px; color:#00b4d8;"></i>
                    </div>
                    <h2 style="font-weight:600; font-size:22px; color:#ffffff; margin:0;">HyperWeb IDE</h2>
                    <p style="font-size:13px; color:var(--text-muted); line-height:1.6; margin:0;">
                        Next-generation web development workspace. Scaffolding wizards, Visual CSS Design Studio, live preview sandbox, formatters, and full HTML/CSS/JS/TS support built right in.
                    </p>
                    
                    <div style="display:flex; gap:10px; margin-top:8px;">
                        <button onclick="
                            const btn = document.getElementById('act-btn-new-web-project');
                            if (btn) btn.click();
                        " style="padding: 8px 16px; background: #00b4d8; color: #0f172a; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-wand-magic-sparkles"></i> New Web Project
                        </button>

                        <button onclick="
                            const tab = document.getElementById('act-btn-hyperweb-ide-panel');
                            if (tab) {
                                tab.click();
                                setTimeout(() => {
                                    const panel = document.getElementById('sidebar-plugin-content');
                                    if (panel) panel.dispatchEvent(new CustomEvent('open-sandbox-accordion'));
                                }, 60);
                            }
                        " style="padding: 8px 16px; background: rgba(0,180,216,0.15); color: #00b4d8; border: 1px solid #00b4d8; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-laptop-code"></i> Live Web Sandbox
                        </button>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:8px; width:100%; text-align:left; background:var(--bg-dark, #181818); border:1px solid var(--border-color, #3c3c3c); padding:14px; border-radius:8px; font-size:12px; margin-top: 10px;">
                        <div style="font-weight:600; color:#00b4d8; font-size:12px;">⚡ Workspace Highlights:</div>
                        <div style="color:var(--text-main); font-size:11.5px;">• <strong>Visual CSS Studio:</strong> Generate Flexbox, Glassmorphism & box shadows from the sidebar.</div>
                        <div style="color:var(--text-main); font-size:11.5px;">• <strong>Explorer Actions:</strong> Right-click files to format or minify HTML, CSS and JS.</div>
                        <div style="color:var(--text-main); font-size:11.5px;">• <strong>Go Live:</strong> Launch local dev preview directly from top toolbar.</div>
                    </div>
                </div>
            `;
        }
    });
}
