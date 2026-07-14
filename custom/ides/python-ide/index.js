import { setupProjectTools } from './src/project-tools.js';
import { registerPythonSyntax } from './src/syntax.js';
import { registerPythonAutocomplete } from './src/autocomplete.js';
import { registerPythonLsp } from './src/lsp.js';
import { registerPythonRunner } from './src/runner.js';
import { registerPipManager } from './src/pip-manager.js';
import { registerPythonSettings } from './src/settings.js'; // Import custom settings

export function activate(api) {
    console.log("Initializing Python Developer IDE Modules...");

    // Enforce UTF-8 for Python subprocesses
    if (typeof window !== 'undefined' && window.process && window.process.env) {
        window.process.env.PYTHONUTF8 = "1"; 
    }

    // 1. Register preference setting configurations
    registerPythonSettings(api);

    // 2. Register file extensions and local database parsing rules
    registerPythonAutocomplete(api);

    // 3. Register custom syntax keyword highlighting patterns
    registerPythonSyntax(api);

    // 4. Register Language Server Protocol connection (Pyright)
    registerPythonLsp(api);

    // 5. Register compiler/terminal runner configurations
    registerPythonRunner(api);

    // 6. Register sidebar application panel
    registerPipManager(api);

    // 7. Register the global workspace configuration structure
    api.workspace.registerIDE('python-ide', {
        name: 'Python Developer IDE',
        onActivate: (ctx) => {
            console.log("Python Developer IDE workspace session active.");
            setupProjectTools(ctx);
        },
        onDeactivate: () => {
            console.log("Python Developer IDE workspace session closed.");
        },
        getWelcomePageHTML: () => {
            return `
                <div style="text-align:center; max-width:480px; font-family:sans-serif; display:flex; flex-direction:column; gap:16px; align-items:center; margin: auto;">
                    <div style="background:rgba(53,114,165,0.1); width:64px; height:64px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid #3572A5; margin-bottom: 12px;">
                        <i class="fa-brands fa-python" style="font-size:36px; color:#3572A5;"></i>
                    </div>
                    <h2 style="font-weight:600; font-size:20px; color:#ffffff; margin:0;">Python Developer IDE</h2>
                    <p style="font-size:13px; color:#888; line-height:1.6; margin:0;">
                        Your complete Python workspace. Scaffolding tools, syntax checkers, and environment integrations ready out of the box.
                    </p>
                </div>
            `;
        }
    });
}