import { setupProjectTools } from './src/project-tools.js';
import { registerPythonSyntax } from './src/syntax.js';
import { registerPythonAutocomplete } from './src/autocomplete.js';
import { registerPythonLsp } from './src/lsp.js';
import { registerPythonRunner } from './src/runner.js';
import { registerPythonSettings } from './src/settings.js';
import { registerPythonDiagnostics } from './src/diagnostics.js';
import { registerPythonixThemes } from './src/themes.js';
import { registerPythonixIcons } from './src/icons.js';
import { registerPythonixSidebar } from './src/pythonix-sidebar.js'; // Import our new unified sidebar
import { registerInterpreterStatus } from './src/interpreter-status.js';
import { registerPythonFormatter } from './src/formatter.js';

export function activate(api) {
    console.log("Initializing Pythonix IDE Modules...");

    // Enforce UTF-8 for Python subprocesses
    if (typeof window !== 'undefined' && window.process && window.process.env) {
        window.process.env.PYTHONUTF8 = "1"; 
    }

    // 1. Register custom vector icons
    registerPythonixIcons(api);

    // 2. Register custom themes
    registerPythonixThemes(api);

    // 3. Register preference setting configurations
    registerPythonSettings(api);

    // 4. Register custom warning/error styles
    registerPythonDiagnostics(api);

    // 5. Register language and autocompletion structures
    registerPythonAutocomplete(api);

    // 6. Register regex syntax highlighting configurations
    registerPythonSyntax(api);

    // 7. Register Language Server Protocol connection (Pyright)
    registerPythonLsp(api);

    // 8. Register compiler/terminal runner configurations
    registerPythonRunner(api);

    // 9. Register the single unified sidebar panel (now includes the Code Outline)
    registerPythonixSidebar(api);

    // (The Problems bottom-dock tab + status bar diagnostics counter is now a
    //  built-in editor feature — see js/problems.js — so the IDE no longer registers it.)

    // 11. Register the Python interpreter status bar widget
    registerInterpreterStatus(api);

    // 12. Register the black-powered format-on-save pipeline
    registerPythonFormatter(api);

    // 13. Register the global workspace configuration structure
    api.workspace.registerIDE('pythonix-ide', {
        name: 'Pythonix IDE',
        onActivate: (ctx) => {
            console.log("Pythonix IDE workspace session active.");
            setupProjectTools(ctx);
        },
        onDeactivate: () => {
            console.log("Pythonix IDE workspace session closed.");
        },
        getWelcomePageHTML: () => {
            return `
                <div style="text-align:center; max-width:480px; font-family:sans-serif; display:flex; flex-direction:column; gap:16px; align-items:center; margin: auto; padding: 20px;">
                    <div style="background:rgba(53,114,165,0.1); width:64px; height:64px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid #3572A5; margin-bottom: 12px;">
                        <i class="fa-brands fa-python" style="font-size:36px; color:#3572A5;"></i>
                    </div>
                    <h2 style="font-weight:600; font-size:20px; color:var(--text-main); margin:0;">Pythonix IDE</h2>
                    <p style="font-size:13px; color:var(--text-muted); line-height:1.6; margin:0;">
                        Your complete Python workspace. Scaffolding tools, syntax checkers, and environment integrations ready out of the box.
                    </p>
                    
                    <!-- Welcome Page button that switches to the Pythonix sidebar and expands the Scratchpad section -->
                    <button onclick="
                        const tab = document.getElementById('act-btn-pythonix-ide-panel');
                        if (tab) {
                            tab.click();
                            setTimeout(() => {
                                const panel = document.getElementById('sidebar-plugin-content');
                                if (panel) panel.dispatchEvent(new CustomEvent('open-scratchpad-accordion'));
                            }, 60);
                        }
                    " style="
                        margin-top: 10px;
                        padding: 8px 16px;
                        background: var(--accent-color);
                        color: #fff;
                        border: none;
                        border-radius: 4px;
                        font-weight: 600;
                        cursor: pointer;
                        font-size: 12px;
                        transition: background 0.2s;
                    ">
                        <i class="fa-solid fa-terminal" style="margin-right: 4px;"></i> Open Interactive Scratchpad
                    </button>
                </div>
            `;
        }
    });
}