/**
 * Virtual Environment Manager for Pythonix IDE.
 * Manages creation, detection, and activation of .venv environments.
 */

import { isElectron, spawnPython, setCustomPythonPath } from './py-env.js';

function safeNotify(ctx, msg, type = 'info') {
    if (ctx && typeof ctx.notify === 'function') {
        ctx.notify(msg, type);
    } else if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
        window.showToast(msg, type);
    } else {
        console.log(`[${type}] ${msg}`);
    }
}

export function registerPythonVenvManager(api) {
    api.events.on('workspace-opened', () => {
        detectAndSuggestVenv(api);
    });
}

export function detectAndSuggestVenv(api) {
    if (typeof window === 'undefined' || !window.electronAPI) return;
    const activeFile = api.editor ? api.editor.getActiveFile() : null;
    const rootPath = (activeFile && activeFile.path)
        ? activeFile.path.split(/[/\\]/).slice(0, -1).join('/')
        : (window.currentWorkspacePath || null);

    if (!rootPath) return;

    const isWin = process.platform === 'win32';
    const venvPy = isWin ? `${rootPath}/.venv/Scripts/python.exe` : `${rootPath}/.venv/bin/python`;

    if (window.electronAPI.fileExists && window.electronAPI.fileExists(venvPy)) {
        setCustomPythonPath(venvPy);
        if (api && api.events) {
            api.events.emit('pythonix-env-changed', `Venv (.venv)`);
        }
    }
}

export async function createVirtualEnv(ctx, containerLog) {
    if (!isElectron) {
        safeNotify(ctx, 'Virtual environment creation requires Desktop Shell environment.', 'error');
        return false;
    }

    const rootPath = (ctx && ctx.workspace && ctx.workspace.rootPath)
        ? ctx.workspace.rootPath
        : (typeof window !== 'undefined' ? window.currentWorkspacePath : null);

    if (!rootPath) {
        safeNotify(ctx, 'Please open a workspace folder before creating a virtual environment.', 'warning');
        return false;
    }

    const log = (msg, isErr = false) => {
        if (containerLog) {
            const span = document.createElement('div');
            span.style.color = isErr ? '#e06c75' : 'var(--accent-color)';
            span.textContent = msg;
            containerLog.appendChild(span);
            containerLog.scrollTop = containerLog.scrollHeight;
        }
        if (ctx && ctx.terminal && typeof ctx.terminal.print === 'function') {
            ctx.terminal.print(`[Pythonix Venv] ${msg}`, isErr ? 'error' : 'system');
        } else if (typeof window !== 'undefined' && typeof window.printToTerminal === 'function') {
            window.printToTerminal(`[Pythonix Venv] ${msg}`, isErr ? 'error' : 'system');
        }
    };

    log(`Creating virtual environment in "${rootPath}/.venv"...`);

    return new Promise((resolve) => {
        const child = spawnPython(['-m', 'venv', `${rootPath}/.venv`], {
            onStdout: (t) => log(t),
            onStderr: (t) => log(t, true),
            onClose: (code) => {
                if (code === 0) {
                    log(`✓ Virtual environment successfully created at .venv`);
                    const isWin = process.platform === 'win32';
                    const venvPy = isWin ? `${rootPath}/.venv/Scripts/python.exe` : `${rootPath}/.venv/bin/python`;
                    setCustomPythonPath(venvPy);
                    if (ctx && ctx.events && typeof ctx.events.emit === 'function') {
                        ctx.events.emit('pythonix-env-changed', 'Venv (.venv)');
                    }
                    safeNotify(ctx, 'Created and activated .venv environment!', 'success');
                    resolve(true);
                } else {
                    log(`✗ Failed to create virtual environment (exit code ${code})`, true);
                    resolve(false);
                }
            },
            onError: (err) => {
                log(`Process Error: ${err.message}`, true);
                resolve(false);
            }
        });
    });
}
