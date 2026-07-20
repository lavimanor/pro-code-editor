// Pythonix Code Outline: parses the active Python buffer into a navigable symbol
// tree (classes, methods, functions) rendered inside the Pythonix sidebar.
// Refreshes live through the core api.events bus; clicking a symbol jumps to it.

/**
 * Indentation-aware structural parse of a Python source string.
 * Returns [{ name, type: 'class'|'method'|'function', line (1-based), depth }].
 */
export function parsePythonOutline(text) {
    const items = [];
    const stack = []; // enclosing scopes: { indent, kind }

    (text || '').split('\n').forEach((line, index) => {
        const match = line.match(/^(\s*)(?:async\s+)?(def|class)\s+([A-Za-z_]\w*)/);
        if (!match) return;

        const indent = match[1].replace(/\t/g, '    ').length;
        while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();

        const kind = match[2];
        const parentIsClass = stack.length > 0 && stack[stack.length - 1].kind === 'class';
        const type = kind === 'class' ? 'class' : (parentIsClass ? 'method' : 'function');

        items.push({ name: match[3], type, line: index + 1, depth: stack.length });
        stack.push({ indent, kind });
    });

    return items;
}

const BADGES = {
    class:    { glyph: 'C', color: '#e5c07b', title: 'Class' },
    method:   { glyph: 'ƒ', color: '#61afef', title: 'Method' },
    function: { glyph: 'ƒ', color: '#c678dd', title: 'Function' }
};

/**
 * Mounts the outline into a container element (an accordion body in the Pythonix
 * sidebar) and keeps it synchronised with the active editor buffer. Subscriptions
 * self-dispose once the container leaves the DOM (sidebar re-render).
 */
export function initOutlineSection(api, container) {
    const unsubscribers = [];

    const renderEmptyHint = (message) => {
        container.innerHTML = `
            <div style="padding: 4px 2px; font-size: 11px; color: var(--text-muted);">
                <i class="fa-solid fa-sitemap" style="margin-right: 6px;"></i>${message}
            </div>
        `;
    };

    const renderOutline = (fileName, contents) => {
        if (!fileName || !/\.py$/i.test(fileName)) {
            renderEmptyHint('Open a Python file to view its structure.');
            return;
        }

        const symbols = parsePythonOutline(contents);
        if (symbols.length === 0) {
            renderEmptyHint('No classes or functions found yet.');
            return;
        }

        container.innerHTML = '';
        symbols.forEach(sym => {
            const badge = BADGES[sym.type];
            const row = document.createElement('div');
            row.style.cssText = `display: flex; align-items: center; gap: 7px; padding: 3px 4px 3px ${4 + sym.depth * 14}px; font-size: 11px; color: var(--text-main); cursor: pointer; border-radius: 3px; white-space: nowrap; overflow: hidden;`;
            row.innerHTML = `
                <span title="${badge.title}" style="width: 14px; height: 14px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 3px; font-size: 9px; font-weight: 700; font-family: 'Consolas', monospace; color: ${badge.color}; border: 1px solid ${badge.color};">${badge.glyph}</span>
                <span style="overflow: hidden; text-overflow: ellipsis;">${sym.name}</span>
                <span style="margin-left: auto; color: var(--text-muted); font-size: 9px; flex-shrink: 0;">:${sym.line}</span>
            `;
            row.addEventListener('mouseenter', () => { row.style.background = 'var(--bg-dark)'; });
            row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });
            row.addEventListener('click', () => api.editor.goToLine(sym.line));
            container.appendChild(row);
        });
    };

    const handleUpdate = (payload) => {
        // Self-clean once the sidebar re-rendered and this container was discarded.
        if (!container.isConnected) {
            unsubscribers.forEach(unsub => unsub());
            unsubscribers.length = 0;
            return;
        }
        renderOutline(payload.name, payload.contents);
    };

    unsubscribers.push(api.events.on('file-opened', handleUpdate));
    unsubscribers.push(api.events.on('content-changed', handleUpdate));

    // Initial paint from whatever is currently open.
    const active = api.editor.getActiveFile();
    if (active) {
        renderOutline(active.name, api.editor.getText());
    } else {
        renderEmptyHint('Open a Python file to view its structure.');
    }
}
