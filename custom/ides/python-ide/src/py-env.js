// Shared Python environment helpers for the Pythonix IDE modules.
// Centralises interpreter resolution (venv vs. global) and process spawning so the
// sidebar, formatter, and status bar all agree on which Python they are talking to.

export const isElectron = typeof window !== 'undefined' && window.process && window.require;
export const isWin = isElectron && window.process.platform === 'win32';

let customPythonPath = null;

export function setCustomPythonPath(path) {
    customPythonPath = path;
}

export function getPythonPath() {
    if (customPythonPath) return customPythonPath;
    return resolvePython().cmd;
}

/**
 * Resolve the interpreter to use. Honours the "Pip Install Target Environment"
 * setting by preferring a project virtual-env interpreter when one exists.
 * Returns { cmd, env } where env is a human-readable environment label.
 */
export function resolvePython() {
    const fallback = isWin ? 'python' : 'python3';
    if (customPythonPath) return { cmd: customPythonPath, env: 'Venv (.venv)' };
    if (!isElectron) return { cmd: fallback, env: 'Global System' };

    const envSetting = localStorage.getItem('setting-pref-python-pip-env') || 'Global System';
    const workspace = window.currentWorkspacePath;

    if (envSetting.indexOf('venv') !== -1 && workspace) {
        try {
            const fs = window.require('fs');
            const path = window.require('path');
            const candidates = isWin
                ? [['venv', 'Scripts', 'python.exe'], ['.venv', 'Scripts', 'python.exe']]
                : [['venv', 'bin', 'python'], ['.venv', 'bin', 'python']];
            for (const parts of candidates) {
                const p = path.join(workspace, ...parts);
                if (fs.existsSync(p)) return { cmd: p, env: 'venv' };
            }
        } catch (e) { /* fall through to global */ }
    }
    return { cmd: fallback, env: envSetting };
}

/**
 * Spawn python with the given args. Returns the child process, or null if unavailable.
 * Callbacks: { onStdout, onStderr, onClose, onError }
 */
export function spawnPython(args, { onStdout, onStderr, onClose, onError } = {}) {
    if (!isElectron) {
        onError && onError(new Error('Native Python execution is only available in the Desktop Shell.'));
        return null;
    }
    const { cmd } = resolvePython();
    const cwd = window.currentWorkspacePath || undefined;
    try {
        const { spawn } = window.require('child_process');
        const child = spawn(cmd, args, { cwd });
        if (child.stdout) child.stdout.on('data', (c) => onStdout && onStdout(c.toString()));
        if (child.stderr) child.stderr.on('data', (c) => onStderr && onStderr(c.toString()));
        child.on('close', (code) => onClose && onClose(code));
        child.on('error', (err) => onError && onError(err));
        return child;
    } catch (err) {
        onError && onError(err);
        return null;
    }
}
