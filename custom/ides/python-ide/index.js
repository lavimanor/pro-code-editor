import { setupProjectTools } from './src/project-tools.js';
import { registerPythonSyntax } from './src/syntax.js';
import { registerPythonAutocomplete } from './src/autocomplete.js';
import { registerPythonLsp } from './src/lsp.js';
import { registerPythonRunner } from './src/runner.js';
import { registerPythonSettings } from './src/settings.js';
import { registerPythonDiagnostics } from './src/diagnostics.js';
import { registerPythonixThemes } from './src/themes.js';
import { registerPythonixIcons } from './src/icons.js';
import { registerPythonixSidebar } from './src/pythonix-sidebar.js';
import { registerInterpreterStatus } from './src/interpreter-status.js';
import { registerPythonFormatter } from './src/formatter.js';
import { registerExplorerMenu } from './src/explorer-menu.js';
import { registerPythonVenvManager } from './src/venv-manager.js';

export function activate(api) {
    console.log("Initializing Pythonix IDE v2 Modules...");

    // Enforce UTF-8 for Python subprocesses
    if (typeof window !== 'undefined' && window.process && window.process.env) {
        window.process.env.PYTHONUTF8 = "1";
    }

    registerPythonixIcons(api);
    registerPythonixThemes(api);
    registerPythonSettings(api);
    registerPythonDiagnostics(api);
    registerPythonAutocomplete(api);
    registerPythonSyntax(api);
    registerPythonLsp(api);
    registerPythonRunner(api);
    registerPythonixSidebar(api);
    registerInterpreterStatus(api);
    registerPythonFormatter(api);
    registerPythonVenvManager(api);

    api.workspace.registerIDE('pythonix-ide', {
        name: 'Pythonix IDE',
        onActivate: (ctx) => {
            console.log("Pythonix IDE workspace session active.");
            setupProjectTools(ctx);
            registerExplorerMenu(ctx);
        },
        onDeactivate: () => {
            console.log("Pythonix IDE workspace session closed.");
        },
        getWelcomePageHTML: () => {
            return `
                <div style="text-align:center; max-width:520px; font-family:var(--font-ui, sans-serif); display:flex; flex-direction:column; gap:16px; align-items:center; margin: auto; padding: 24px;">
                    <div style="background:rgba(53,114,165,0.1); width:64px; height:64px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid #3572A5; margin-bottom: 4px; box-shadow: 0 0 20px rgba(53,114,165,0.2);">
                        <i class="fa-brands fa-python" style="font-size:36px; color:#3572A5;"></i>
                    </div>
                    <h2 style="font-weight:600; font-size:22px; color:var(--text-main); margin:0;">Pythonix IDE</h2>
                    <p style="font-size:13px; color:var(--text-muted); line-height:1.6; margin:0;">
                        Professional Python development environment with built-in Virtual Environment management, Pytest test explorer, Pip package manager, benchmark runner, Black formatter, and interactive scratchpad.
                    </p>
                    
                    <div style="display:flex; gap:10px; margin-top:8px;">
                        <button onclick="
                            const btn = document.getElementById('act-btn-new-python-project');
                            if (btn) btn.click();
                        " style="padding: 8px 16px; background: #3572A5; color: #ffffff; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-cube"></i> New Python Project
                        </button>

                        <button onclick="
                            const tab = document.getElementById('act-btn-pythonix-ide-panel');
                            if (tab) {
                                tab.click();
                                setTimeout(() => {
                                    const panel = document.getElementById('sidebar-plugin-content');
                                    if (panel) panel.dispatchEvent(new CustomEvent('open-scratchpad-accordion'));
                                }, 60);
                            }
                        " style="padding: 8px 16px; background: rgba(53,114,165,0.15); color: #3572A5; border: 1px solid #3572A5; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-terminal"></i> Open Interactive Scratchpad
                        </button>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:8px; width:100%; text-align:left; background:var(--bg-dark, #181818); border:1px solid var(--border-color, #3c3c3c); padding:14px; border-radius:8px; font-size:12px; margin-top: 10px;">
                        <div style="font-weight:600; color:#3572A5; font-size:12px;">🐍 Workspace Features:</div>
                        <div style="color:var(--text-main); font-size:11.5px;">• <strong>Venv Manager:</strong> Create and switch virtual environments (.venv) in 1 click.</div>
                        <div style="color:var(--text-main); font-size:11.5px;">• <strong>Test Explorer:</strong> Run unittest & pytest suites with visual pass/fail indicators.</div>
                        <div style="color:var(--text-main); font-size:11.5px;">• <strong>Explorer Actions:</strong> Right-click .py files to benchmark performance or format with Black.</div>
                    </div>
                </div>
            `;
        }
    });
}