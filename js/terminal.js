let terminalPanel = null;
let terminalOutput = null;
let terminalInput = null;
let terminalPrompt = null;
let activePrompt = 'C:\\>';

// Live-run state
let runActive = false;
let stdinHandler = null;

const isElectron = typeof window !== 'undefined' && window.process && window.process.type;
let ipcRenderer = null;
if (isElectron) {
    ipcRenderer = window.require('electron').ipcRenderer;
}

/**
 * Initialize terminal elements and events.
 */
export function initTerminal(panel, output, input, promptEl) {
    terminalPanel = panel;
    terminalOutput = output;
    terminalInput = input;
    terminalPrompt = promptEl;

    terminalInput.addEventListener('keydown', (e) => {
        // Intercept standard Ctrl+C to terminate running processes
        if (e.ctrlKey && e.key.toLowerCase() === 'c') {
            if (runActive) {
                e.preventDefault();
                appendOutputChunk('^C\n', 'system');
                if (ipcRenderer) {
                    ipcRenderer.invoke('run-kill');
                }
                return;
            }
        }

        if (e.key !== 'Enter') return;

        const command = terminalInput.value;
        terminalInput.value = '';

        if (runActive) {
            appendOutputChunk(command + '\n', 'stdin');
            if (stdinHandler) stdinHandler(command);
            scrollToBottom();
            return;
        }

        appendCommandLine(command);

        const cleanCmd = command.trim().toLowerCase();
        if (cleanCmd === 'help') {
            appendSystemLine('Commands: help, clear, about. Press Ctrl+C while a program runs to terminate it.');
        } else if (cleanCmd === 'clear') {
            terminalOutput.innerHTML = '';
        } else if (cleanCmd === 'about') {
            appendSystemLine('Pro Code Editor Terminal v1.0.0');
        } else if (cleanCmd !== '') {
            appendSystemLine(`'${command}' is not recognized as an internal or external command.`);
        }

        scrollToBottom();
    });

    const container = document.getElementById('terminal-container');
    if (container) {
        container.addEventListener('click', () => {
            terminalInput.focus();
        });
    }
}

export function toggleTerminal() {
    terminalPanel.classList.toggle('hidden-panel');
    const actTerminal = document.getElementById('act-terminal');
    if (actTerminal) {
        actTerminal.classList.toggle('active', !terminalPanel.classList.contains('hidden-panel'));
    }
    if (!terminalPanel.classList.contains('hidden-panel')) {
        setTimeout(() => terminalInput.focus(), 50);
    }
}

function ensureTerminalOpen() {
    if (terminalPanel && terminalPanel.classList.contains('hidden-panel')) {
        toggleTerminal();
    }
}

export function updateTerminalPrompt(workspacePath) {
    if (!terminalPrompt) return;
    activePrompt = workspacePath ? `${workspacePath}>` : 'Workspace>';
    if (!runActive) terminalPrompt.textContent = activePrompt;
}

function appendCommandLine(cmd) {
    const line = document.createElement('div');
    line.className = 'terminal-line';
    line.innerHTML = `<span class="prompt-prefix">${activePrompt}</span> ${escapeHTML(cmd)}`;
    terminalOutput.appendChild(line);
}

function appendSystemLine(text) {
    const line = document.createElement('div');
    line.className = 'terminal-line';
    line.textContent = text;
    terminalOutput.appendChild(line);
}

function escapeHTML(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function scrollToBottom() {
    if (terminalOutput) terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

export function appendOutputChunk(data, stream = 'stdout') {
    if (!terminalOutput) return;

    const span = document.createElement('span');
    span.className = `term-chunk term-${stream}`;
    span.style.whiteSpace = 'pre-wrap';
    span.style.fontFamily = 'inherit';

    if (stream === 'stderr') {
        span.style.color = '#ff6b6b';
    } else if (stream === 'system') {
        span.style.color = 'var(--text-muted, #888)';
        span.style.fontStyle = 'italic';
    } else if (stream === 'stdin') {
        span.style.color = 'var(--accent-color, #4caf50)';
    }

    span.textContent = data;
    terminalOutput.appendChild(span);

    ensureTerminalOpen();
    scrollToBottom();
}

export function setRunState(active, onStdin) {
    runActive = active;
    stdinHandler = active ? (onStdin || null) : null;

    if (terminalPrompt) {
        terminalPrompt.textContent = active ? '»' : activePrompt;
    }
    if (terminalInput) {
        terminalInput.placeholder = active
            ? 'Program running — type input and press Enter, or press Ctrl+C to terminate…'
            : '';
    }
    if (active) {
        ensureTerminalOpen();
        setTimeout(() => terminalInput && terminalInput.focus(), 50);
    }
}

export function printToTerminal(text, type = 'system') {
    if (type === 'system') {
        appendSystemLine(text);
    } else {
        appendCommandLine(text);
    }
    ensureTerminalOpen();
    scrollToBottom();
}