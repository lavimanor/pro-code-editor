import { registerWebSyntax, WEB_LANGUAGES } from './src/syntax.js';
import { registerWebLsp, WEB_SERVERS } from './src/lsp.js';
import { registerLspStatus } from './src/status.js';
import { registerOutlinePanel } from './src/outline.js';
import { snapshotLanguageRegistries } from './src/registry-guard.js';

export function activate(api) {
    api.workspace.registerIDE('hyperweb-ide', {
        name: 'HyperWeb IDE',
        onActivate: (ctx) => {
            // These language ids are shared with the always-on web-languages-pack
            // extension. Put its registry entries back when we leave, or they stay
            // stamped as HyperWeb-owned and go dark in the Normal Editor.
            ctx.onDispose(snapshotLanguageRegistries(ctx, {
                languages: WEB_LANGUAGES.flatMap((lang) => lang.extensions),
                highlighters: WEB_LANGUAGES.map((lang) => lang.id),
                lspClients: WEB_SERVERS.map((server) => server.key)
            }));

            // Highlighting for HTML, CSS (plus SCSS/LESS) and JavaScript, including
            // the <style> and <script> blocks embedded in HTML files.
            registerWebSyntax(ctx);

            // Diagnostics, hover and completion from the three web language servers.
            const servers = registerWebLsp(ctx);

            ctx.registerStatusBarItem('hyperweb-indicator', {
                side: 'right',
                tooltip: 'HyperWeb IDE is active',
                text: '⚡ HyperWeb'
            });

            // Reports which servers are live, and offers install commands for the rest.
            registerLspStatus(ctx, servers);

            // Right-dock "Structure" tool window: a clickable outline of the active file.
            registerOutlinePanel(ctx);

            ctx.terminal.print('[HyperWeb] Syntax models loaded for HTML, CSS and JavaScript.', 'system');
        },
        onDeactivate: () => {
            console.log('HyperWeb IDE environment closed.');
        },
        getWelcomePageHTML: () => {
            return `
                <div style="text-align:center; max-width:480px; font-family:var(--font-ui); display:flex; flex-direction:column; gap:16px; align-items:center;">
                    <div style="background:rgba(0,180,216,0.1); width:64px; height:64px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid #00b4d8;">
                        <i class="fa-solid fa-globe" style="font-size:32px; color:#00b4d8;"></i>
                    </div>
                    <h2 style="font-weight:600; font-size:20px; color:#ffffff; margin:0;">HyperWeb IDE</h2>
                    <p style="font-size:13px; color:var(--text-muted); line-height:1.6; margin:0;">
                        A lightweight web development workspace. Open any HTML, CSS or JavaScript
                        file for syntax highlighting, live diagnostics, hover docs and completions.
                    </p>
                    <p style="font-size:12px; color:var(--text-muted); line-height:1.6; margin:0;">
                        The <strong>LSP</strong> badge in the status bar shows which language servers
                        are running — click it if any are missing.
                    </p>
                </div>
            `;
        }
    });
}
