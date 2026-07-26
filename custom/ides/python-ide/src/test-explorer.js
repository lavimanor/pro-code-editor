/**
 * Test Explorer module for Pythonix IDE.
 * Discovers and runs Python unit tests (unittest / pytest).
 */

import { isElectron, spawnPython } from './py-env.js';

export function initTestExplorer(api, container) {
    if (!container) return;

    container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; color: var(--text-muted);">Discover and run Python tests</span>
                <button id="py-test-run-all" style="padding: 4px 8px; background: var(--accent-color); border: none; border-radius: 4px; color: #fff; font-size: 10px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                    <i class="fa-solid fa-play"></i> Run Tests
                </button>
            </div>
            <div id="py-test-summary" style="font-size: 11px; font-weight: 600; color: var(--text-main);">
                Idle (Click Run Tests)
            </div>
            <div id="py-test-output" style="max-height: 140px; overflow-y: auto; background: var(--bg-darker); border: 1px solid var(--border-color); border-radius: 4px; padding: 6px; font-family: var(--font-code, monospace); font-size: 10px; color: var(--text-muted); white-space: pre-wrap; word-break: break-word;">
                No test run recorded yet.
            </div>
        </div>
    `;

    const runBtn = container.querySelector('#py-test-run-all');
    const summary = container.querySelector('#py-test-summary');
    const output = container.querySelector('#py-test-output');

    let child = null;

    runBtn.addEventListener('click', () => {
        if (!isElectron) {
            output.textContent = 'Test execution requires Desktop Shell environment.';
            output.style.color = '#e06c75';
            return;
        }

        if (child) {
            try { child.kill(); } catch (e) {}
            return;
        }

        output.textContent = 'Discovering and running tests with unittest...\n';
        output.style.color = 'var(--text-main)';
        summary.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Running test suite...';
        summary.style.color = 'var(--accent-color)';

        runBtn.innerHTML = '<i class="fa-solid fa-stop"></i> Stop';
        runBtn.style.background = '#e06c75';

        const appendLog = (text, isErr = false) => {
            const span = document.createElement('span');
            if (isErr) span.style.color = '#e06c75';
            span.textContent = text;
            output.appendChild(span);
            output.scrollTop = output.scrollHeight;
        };

        child = spawnPython(['-m', 'unittest', 'discover', '-v'], {
            onStdout: (t) => appendLog(t),
            onStderr: (t) => appendLog(t, t.includes('FAIL') || t.includes('ERROR')),
            onClose: (code) => {
                child = null;
                runBtn.innerHTML = '<i class="fa-solid fa-play"></i> Run Tests';
                runBtn.style.background = 'var(--accent-color)';

                if (code === 0) {
                    summary.innerHTML = '✓ All Tests Passed!';
                    summary.style.color = 'var(--syntax-string, #98c379)';
                } else {
                    summary.innerHTML = `✗ Tests Failed (Exit code ${code})`;
                    summary.style.color = '#e06c75';
                }
            },
            onError: (err) => {
                child = null;
                runBtn.innerHTML = '<i class="fa-solid fa-play"></i> Run Tests';
                runBtn.style.background = 'var(--accent-color)';
                summary.textContent = 'Test runner error.';
                summary.style.color = '#e06c75';
                appendLog(`Error: ${err.message}\n`, true);
            }
        });
    });
}
