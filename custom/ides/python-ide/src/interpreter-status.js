// Pythonix interpreter status-bar widget: shows the detected Python version and
// active environment (global vs. venv) like PyCharm/VS Code. Click to re-detect.

import { isElectron, resolvePython, spawnPython } from './py-env.js';

export function registerInterpreterStatus(api) {
    let statusElement = null;

    const setLabel = (html) => {
        if (statusElement && statusElement.isConnected) statusElement.innerHTML = html;
    };

    const detect = () => {
        if (!statusElement) return;

        if (!isElectron) {
            setLabel(`<i class="fa-brands fa-python"></i> Python (web mode)`);
            return;
        }

        const { env } = resolvePython();
        setLabel(`<i class="fa-brands fa-python"></i> Detecting…`);

        let output = '';
        const child = spawnPython(['--version'], {
            onStdout: (t) => { output += t; },
            onStderr: (t) => { output += t; }, // Python 2 prints its version to stderr
            onClose: () => {
                const match = output.match(/Python\s+([\d.]+)/i);
                if (match) {
                    const envLabel = env === 'venv' ? 'venv' : 'global';
                    setLabel(`<i class="fa-brands fa-python"></i> Python ${match[1]} · ${envLabel}`);
                } else {
                    setLabel(`<i class="fa-brands fa-python"></i> Python: unknown`);
                }
            },
            onError: () => {
                setLabel(`<i class="fa-solid fa-triangle-exclamation"></i> Python: not found`);
            }
        });
        if (!child) setLabel(`<i class="fa-solid fa-triangle-exclamation"></i> Python: not found`);
    };

    api.views.registerStatusBarItem('pythonix-interpreter', {
        side: 'right',
        tooltip: 'Active Python interpreter — click to re-detect',
        onClick: () => detect(),
        render: (el) => {
            statusElement = el;
            detect();
        }
    });

    // Re-detect when a workspace opens (a project venv may become available) and
    // when the user switches the target environment in the Pythonix settings.
    api.events.on('workspace-opened', () => detect());
    api.events.on('pythonix-env-changed', () => detect());
}
