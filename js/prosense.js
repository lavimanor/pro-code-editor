import { LANGUAGE_REGISTRY } from './prosense-db/registry.js';
import { getCustomSnippets } from './snippets.js';

let prosenseEl = null;
let editorEl = null;
let surfaceEl = null;
let activeIndex = 0;
let filteredList = [];
let isOpen = false;
let delayTimeout = null;

export function initProSense(editor, surface) {
    editorEl = editor;
    surfaceEl = surface;

    prosenseEl = document.createElement('div');
    prosenseEl.id = 'prosense-widget';
    prosenseEl.className = 'prosense-hidden';
    surfaceEl.appendChild(prosenseEl);

    document.addEventListener('click', (e) => {
        if (!prosenseEl.contains(e.target) && e.target !== editorEl) {
            hideProSense();
        }
    });
}

export function hideProSense() {
    if (prosenseEl) {
        prosenseEl.classList.add('prosense-hidden');
    }
    isOpen = false;
    filteredList = [];
    activeIndex = 0;
    if (delayTimeout) clearTimeout(delayTimeout);
}

function insertSelection(item) {
    const word = getWordBeforeCursor();
    const cursor = editorEl.selectionStart;
    const start = cursor - word.length;
    const end = cursor;
    const text = editorEl.value;

    editorEl.value = text.substring(0, start) + item.insertText + text.substring(end);
    
    const newCursorPos = start + item.insertText.length;
    editorEl.selectionStart = editorEl.selectionEnd = newCursorPos;

    hideProSense();
    editorEl.dispatchEvent(new Event('input'));
    editorEl.focus();
}

export function getWordBeforeCursor() {
    if (!editorEl) return '';
    const text = editorEl.value;
    const cursorIndex = editorEl.selectionStart;
    const leftText = text.substring(0, cursorIndex);
    const match = leftText.match(/[\w-]*$/);
    return match ? match[0] : '';
}

function updateWidgetPosition() {
    const marker = document.getElementById('prosense-caret-marker');
    if (!marker || !editorEl) return;

    const rect = marker.getBoundingClientRect();
    const editorRect = editorEl.getBoundingClientRect();

    let top = rect.bottom - editorRect.top;
    const left = rect.left - editorRect.left;

    const widgetHeight = prosenseEl.offsetHeight || 140;
    const spaceBelow = editorRect.bottom - rect.bottom;

    if (spaceBelow < widgetHeight && (rect.top - editorRect.top) > widgetHeight) {
        top = (rect.top - editorRect.top) - widgetHeight - 4;
    }

    prosenseEl.style.top = `${top}px`;
    prosenseEl.style.left = `${left}px`;
}

function renderWidget() {
    if (filteredList.length === 0) {
        hideProSense();
        return;
    }
    prosenseEl.innerHTML = '';
    const ul = document.createElement('ul');

    filteredList.forEach((item, idx) => {
        const li = document.createElement('li');
        li.className = `prosense-item ${idx === activeIndex ? 'active' : ''}`;
        
        const typeIcon = item.type === 'tag' 
            ? '<i class="fa-solid fa-code" style="color: #e34c26; font-size: 11px;"></i>' 
            : (item.type === 'attribute' 
                ? '<i class="fa-solid fa-cube" style="color: #2196f3; font-size: 11px;"></i>' 
                : (item.type === 'property'
                    ? '<i class="fa-solid fa-wrench" style="color: #4caf50; font-size: 11px;"></i>'
                    : (item.type === 'variable'
                        ? '<i class="fa-solid fa-cube" style="color: #9c27b0; font-size: 11px;"></i>'
                        : (item.type === 'class'
                            ? '<i class="fa-solid fa-shapes" style="color: #ff9800; font-size: 11px;"></i>'
                            : '<i class="fa-solid fa-bolt" style="color: #ffeb3b; font-size: 11px;"></i>'))));

        li.innerHTML = `<span class="prosense-type-icon">${typeIcon}</span> <span class="prosense-label">${item.label}</span>`;
        
        li.addEventListener('click', () => {
            insertSelection(item);
        });
        ul.appendChild(li);
    });

    prosenseEl.appendChild(ul);
    prosenseEl.classList.remove('prosense-hidden');
    isOpen = true;

    updateWidgetPosition();
}

export function handleProSenseKeydown(e) {
    if (!isOpen || filteredList.length === 0) return false;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % filteredList.length;
        renderWidget();
        return true;
    }
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + filteredList.length) % filteredList.length;
        renderWidget();
        return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertSelection(filteredList[activeIndex]);
        return true;
    }
    if (e.key === 'Escape') {
        e.preventDefault();
        hideProSense();
        return true;
    }

    return false;
}

/**
 * Dynamic parser module to extract declared variables, methods, and structures.
 */
function extractFileIdentifiers(text, parserType) {
    const identifiers = [];
    const seen = new Set();
    let match;

    if (parserType === 'js') {
        const varRegex = /\b(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
        while ((match = varRegex.exec(text)) !== null) {
            const name = match[1];
            if (!seen.has(name)) {
                seen.add(name);
                identifiers.push({ label: name, insertText: name, type: 'variable' });
            }
        }
        const funcRegex = /\bfunction\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
        while ((match = funcRegex.exec(text)) !== null) {
            const name = match[1];
            if (!seen.has(name)) {
                seen.add(name);
                identifiers.push({ label: name, insertText: name + '()', type: 'function' });
            }
        }
        const classRegex = /\bclass\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
        while ((match = classRegex.exec(text)) !== null) {
            const name = match[1];
            if (!seen.has(name)) {
                seen.add(name);
                identifiers.push({ label: name, insertText: name, type: 'class' });
            }
        }
    } else if (parserType === 'java' || parserType === 'csharp' || parserType === 'c' || parserType === 'cpp') {
        // Shared C-Style Language Parser (Java, C#, C, C++)
        const classRegex = /\b(?:class|struct|interface|enum)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
        while ((match = classRegex.exec(text)) !== null) {
            const name = match[1];
            if (!seen.has(name)) {
                seen.add(name);
                identifiers.push({ label: name, insertText: name, type: 'class' });
            }
        }
        const methodRegex = /\b(?!(?:if|for|foreach|while|switch|catch)\b)([a-zA-Z_$][a-zA-Z0-9_$<>]*)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
        while ((match = methodRegex.exec(text)) !== null) {
            const name = match[2];
            if (!seen.has(name)) {
                seen.add(name);
                identifiers.push({ label: name, insertText: name + '()', type: 'function' });
            }
        }
        const varRegex = /\b(?!(?:return|import|using|package|class|struct|interface|enum|new|throw)\b)([a-zA-Z_$][a-zA-Z0-9_$<>]*)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:[;=,])/g;
        while ((match = varRegex.exec(text)) !== null) {
            const name = match[2];
            if (!seen.has(name)) {
                seen.add(name);
                identifiers.push({ label: name, insertText: name, type: 'variable' });
            }
        }
    } else if (parserType === 'python') {
        // Parse Python classes: class Name
        const classRegex = /\bclass\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
        while ((match = classRegex.exec(text)) !== null) {
            const name = match[1];
            if (!seen.has(name)) {
                seen.add(name);
                identifiers.push({ label: name, insertText: name, type: 'class' });
            }
        }

        // Parse Python function declarations: def name(
        const funcRegex = /\bdef\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
        while ((match = funcRegex.exec(text)) !== null) {
            const name = match[1];
            if (!seen.has(name)) {
                seen.add(name);
                identifiers.push({ label: name, insertText: name + '()', type: 'function' });
            }
        }

        // Parse Python variable definitions: name = value (excluding comparisons/operators)
        const varRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?![=])/g;
        while ((match = varRegex.exec(text)) !== null) {
            const name = match[1];
            // Exclude control flow keywords from variable suggestions
            if (!seen.has(name) && !['if', 'elif', 'for', 'while', 'return', 'print'].includes(name)) {
                seen.add(name);
                identifiers.push({ label: name, insertText: name, type: 'variable' });
            }
        }
    } else if (parserType === 'lua') {
        // Parse Lua functions: function name() or local function name()
        const funcRegex = /\bfunction\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
        while ((match = funcRegex.exec(text)) !== null) {
            const name = match[1];
            if (!seen.has(name)) {
                seen.add(name);
                identifiers.push({ label: name, insertText: name + '()', type: 'function' });
            }
        }

        // Parse Lua variable declarations: local name = value or name = value
        const varRegex = /\b(?:local\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?![=])/g;
        while ((match = varRegex.exec(text)) !== null) {
            const name = match[1];
            // Exclude control flow keywords from variable lists
            if (!seen.has(name) && !['if', 'for', 'while', 'return', 'print', 'local', 'function', 'end'].includes(name)) {
                seen.add(name);
                identifiers.push({ label: name, insertText: name, type: 'variable' });
            }
        }
    }

    return identifiers;
}

function evaluateProSense(fileName) {
    if (!editorEl) return;

    const ext = fileName ? fileName.split('.').pop().toLowerCase() : '';
    const config = LANGUAGE_REGISTRY[ext];
    if (!config) {
        hideProSense();
        return;
    }

    const localCompletions = extractFileIdentifiers(editorEl.value, config.parser);
    
    // Dynamically retrieve user-defined custom snippets matching current scope
    const customSnippetsRaw = getCustomSnippets();
    const customSnippets = customSnippetsRaw
        .filter(s => s.lang === 'all' || s.lang === ext)
        .map(s => ({
            label: s.trigger,
            insertText: s.body,
            type: 'snippet'
        }));

    const completions = [...config.db, ...localCompletions, ...customSnippets];

    const word = getWordBeforeCursor();
    if (!word || completions.length === 0) {
        hideProSense();
        return;
    }

    filteredList = completions.filter(item => 
        item.label.toLowerCase().startsWith(word.toLowerCase())
    );

    const hasExactMatch = filteredList.some(item => item.label.toLowerCase() === word.toLowerCase());
    if (hasExactMatch || filteredList.length === 0) {
        hideProSense();
        return;
    }

    if (activeIndex >= filteredList.length) activeIndex = 0;

    renderWidget();
}

export function handleProSenseInput(fileName) {
    if (delayTimeout) clearTimeout(delayTimeout);

    if (localStorage.getItem('prosense-enabled') === 'false') {
        hideProSense();
        return;
    }

    delayTimeout = setTimeout(() => {
        evaluateProSense(fileName);
    }, 180);
}