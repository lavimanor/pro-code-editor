let terminalPanel = null;
let terminalOutput = null;
let terminalInput = null;
let terminalPrompt = null;
let activePrompt = 'C:\\>';

// Live-run state: when a program is executing, terminal input is piped to its stdin.
let runActive = false;
let stdinHandler = null;

/**
 * Initialize terminal elements and events.
 */
export function initTerminal(panel, output, input, promptEl) {
    terminalPanel = panel;
    terminalOutput = output;
    terminalInput = input;
    terminalPrompt = promptEl;

    // Listen to Enter key inside command line input
    terminalInput.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;

        const command = terminalInput.value;
        terminalInput.value = '';

        // While a program is running, forward the line to its stdin instead of
        // treating it as a shell command.
        if (runActive) {
            appendOutputChunk(command + '\n', 'stdin');
            if (stdinHandler) stdinHandler(command);
            scrollToBottom();
            return;
        }

        appendCommandLine(command);

        // Built-in mock commands (available when no program is running)
        const cleanCmd = command.trim().toLowerCase();
        if (cleanCmd === 'help') {
            appendSystemLine('Commands: help, clear, about. While a program runs, whatever you type is sent to its input.');
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

/** Ensure the terminal panel is visible. */
function ensureTerminalOpen() {
    if (terminalPanel && terminalPanel.classList.contains('hidden-panel')) {
        toggleTerminal();
    }
}

/**
 * Dynamically updates prompt to display opened directory path.
 */
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

/**
 * Appends a raw chunk of program output, preserving whitespace and newlines.
 * `stream` is one of 'stdout' | 'stderr' | 'system' | 'stdin'.
 */
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

/**
 * Toggles the running state. When active, the terminal input feeds the program's
 * stdin via `onStdin(lineText)`.
 */
export function setRunState(active, onStdin) {
    runActive = active;
    stdinHandler = active ? (onStdin || null) : null;

    if (terminalPrompt) {
        terminalPrompt.textContent = active ? '»' : activePrompt;
    }
    if (terminalInput) {
        terminalInput.placeholder = active
            ? 'Program running — type input and press Enter…'
            : '';
    }
    if (active) {
        ensureTerminalOpen();
        setTimeout(() => terminalInput && terminalInput.focus(), 50);
    }
}

/**
 * Prints a status/system line to the terminal (used for launch notices, errors).
 */
export function printToTerminal(text, type = 'system') {
    if (type === 'system') {
        appendSystemLine(text);
    } else {
        appendCommandLine(text);
    }
    ensureTerminalOpen();
    scrollToBottom();
}
