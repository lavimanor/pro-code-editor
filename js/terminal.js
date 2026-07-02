let terminalPanel = null;
let terminalOutput = null;
let terminalInput = null;
let terminalPrompt = null;
let activePrompt = 'C:\\>';

/**
 * Initialize mock terminal elements and events.
 */
export function initTerminal(panel, output, input, promptEl) {
    terminalPanel = panel;
    terminalOutput = output;
    terminalInput = input;
    terminalPrompt = promptEl;

    // Listen to Enter key inside command line input
    terminalInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const command = terminalInput.value;
            appendCommandLine(command);
            terminalInput.value = '';
            
            // Core mock command checks
            const cleanCmd = command.trim().toLowerCase();
            if (cleanCmd === 'help') {
                appendSystemLine('Available mock commands: help, clear, about');
            } else if (cleanCmd === 'clear') {
                terminalOutput.innerHTML = '';
            } else if (cleanCmd === 'about') {
                appendSystemLine('Pro Code Editor Terminal v1.0.0 (Mockup Shell)');
            } else if (cleanCmd !== '') {
                appendSystemLine(`'${command}' is not recognized as an internal or external command.`);
            }
            
            // Scroll safely to newly written inputs
            terminalInput.scrollIntoView({ behavior: 'smooth' });
        }
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

/**
 * Dynamically updates prompt to display opened directory path.
 */
export function updateTerminalPrompt(workspacePath) {
    if (!terminalPrompt) return;
    activePrompt = workspacePath ? `${workspacePath}>` : 'Workspace>';
    terminalPrompt.textContent = activePrompt;
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

/**
 * Custom stdout printer to dump compiler/runtime logs directly into the terminal.
 */
export function printToTerminal(text, type = 'system') {
    if (type === 'system') {
        appendSystemLine(text);
    } else {
        appendCommandLine(text);
    }
    
    // Auto-open terminal panel if hidden
    if (terminalPanel && terminalPanel.classList.contains('hidden-panel')) {
        toggleTerminal();
    }
}