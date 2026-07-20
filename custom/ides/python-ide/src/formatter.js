// Pythonix format-on-save: pipes saved .py files through `black` when the
// "Auto Format Python Files on Save" setting is enabled, then reloads the
// formatted result back into the editor via api.editor.reloadActiveFile().

import { isElectron, spawnPython } from './py-env.js';

export function registerPythonFormatter(api) {
    let missingBlackHintShown = false;
    let formatInFlight = false;

    api.events.on('file-saved', ({ path, name }) => {
        if (!name || !/\.py$/i.test(name)) return;
        if (localStorage.getItem('setting-pref-python-format-on-save') !== 'true') return;
        if (!isElectron || !path || formatInFlight) return;

        formatInFlight = true;
        let stderrBuffer = '';

        spawnPython(['-m', 'black', '--quiet', path], {
            onStderr: (t) => { stderrBuffer += t; },
            onClose: async (code) => {
                formatInFlight = false;
                if (code === 0) {
                    // Pull the formatted file back into the buffer if it is still focused.
                    const active = api.editor.getActiveFile();
                    if (active && active.path && active.path.toLowerCase() === path.toLowerCase()) {
                        await api.editor.reloadActiveFile();
                    }
                    if (window.printToTerminal) {
                        window.printToTerminal(`[Pythonix] Formatted "${name}" with black.`, 'system');
                    }
                } else if (/No module named/i.test(stderrBuffer) && !missingBlackHintShown) {
                    missingBlackHintShown = true;
                    if (window.printToTerminal) {
                        window.printToTerminal('[Pythonix] Format-on-save requires the "black" package — install it from the Pip Package Manager in the Pythonix sidebar.', 'system');
                    }
                }
                // Other non-zero exits (e.g. syntax errors) stay quiet: Pyright already
                // surfaces those in the Problems panel.
            },
            onError: () => { formatInFlight = false; }
        });
    });
}
