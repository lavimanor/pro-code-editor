// Built-in Problems panel: a VS Code-style bottom dock tab that aggregates every
// diagnostic pushed by any language server, plus a status-bar error/warning counter.
// Built on the core api.events bus, api.views.registerBottomPanelTab, and
// api.views.registerStatusBarItem surfaces. This ships with the editor core, so it
// is available regardless of which IDE/plugin is active.

export function registerProblemsPanel(api) {
    // path (lowercase) -> array of mapped diagnostics ({line, col, severity, message})
    const fileDiagnostics = new Map();

    let listContainer = null;   // the bottom tab's content element
    let statusElement = null;   // the status-bar counter element

    const SEVERITY_META = {
        1: { icon: 'fa-solid fa-circle-xmark', color: '#e06c75', label: 'Error' },
        2: { icon: 'fa-solid fa-triangle-exclamation', color: '#e5c07b', label: 'Warning' },
        3: { icon: 'fa-solid fa-circle-info', color: '#61afef', label: 'Info' },
        4: { icon: 'fa-solid fa-lightbulb', color: '#61afef', label: 'Hint' }
    };

    const baseName = (p) => (p || '').split(/[\\/]/).pop();

    const countTotals = () => {
        let errors = 0, warnings = 0, total = 0;
        fileDiagnostics.forEach(diags => {
            diags.forEach(d => {
                total++;
                if (d.severity === 1) errors++;
                else if (d.severity === 2) warnings++;
            });
        });
        return { errors, warnings, total };
    };

    const updateStatusCounter = () => {
        if (!statusElement || !statusElement.isConnected) return;
        const { errors, warnings } = countTotals();
        statusElement.innerHTML =
            `<i class="fa-solid fa-circle-xmark"></i> ${errors} ` +
            `<i class="fa-solid fa-triangle-exclamation" style="margin-left:6px;"></i> ${warnings}`;
    };

    const updateTabBadge = () => {
        const tabBtn = document.getElementById('bottom-tab-problems');
        if (!tabBtn) return;
        const { total } = countTotals();
        tabBtn.textContent = total > 0 ? `PROBLEMS (${total})` : 'PROBLEMS';
    };

    const renderList = () => {
        if (!listContainer || !listContainer.isConnected) return;

        const filesWithIssues = [];
        fileDiagnostics.forEach((diags, path) => {
            if (diags.length > 0) filesWithIssues.push({ path, diags });
        });

        if (filesWithIssues.length === 0) {
            listContainer.innerHTML = `
                <div style="padding: 16px; font-size: 12px; color: var(--text-muted); font-family: sans-serif;">
                    <i class="fa-solid fa-check" style="color: var(--syntax-string); margin-right: 6px;"></i>
                    No problems detected in the workspace.
                </div>
            `;
            return;
        }

        listContainer.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.style.cssText = 'padding: 6px 0; font-family: sans-serif;';

        filesWithIssues.forEach(({ path, diags }) => {
            const fileHeader = document.createElement('div');
            fileHeader.style.cssText = 'padding: 5px 16px 3px; font-size: 11px; font-weight: 600; color: var(--text-main); display: flex; align-items: center; gap: 6px;';
            fileHeader.innerHTML = `<i class="fa-solid fa-file-code" style="color: var(--accent-color);"></i> ${baseName(path)} <span style="color: var(--text-muted); font-weight: 400;">— ${diags.length} problem${diags.length === 1 ? '' : 's'}</span>`;
            wrap.appendChild(fileHeader);

            diags.forEach(diag => {
                const meta = SEVERITY_META[diag.severity] || SEVERITY_META[3];
                const line = (diag.line || 0) + 1;
                const col = (diag.col || 0) + 1;

                const row = document.createElement('div');
                row.className = 'problem-row';
                row.style.cssText = 'padding: 3px 16px 3px 28px; font-size: 12px; color: var(--text-main); cursor: pointer; display: flex; align-items: baseline; gap: 8px; white-space: nowrap; overflow: hidden;';
                row.innerHTML = `
                    <i class="${meta.icon}" style="color: ${meta.color}; font-size: 11px; flex-shrink: 0;" title="${meta.label}"></i>
                    <span style="overflow: hidden; text-overflow: ellipsis;">${escapeHTML(diag.message)}</span>
                    <span style="color: var(--text-muted); font-size: 11px; flex-shrink: 0;">Ln ${line}, Col ${col}</span>
                `;
                row.addEventListener('mouseenter', () => { row.style.background = 'var(--bg-dark)'; });
                row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });
                row.addEventListener('click', async () => {
                    const opened = await api.editor.openFileByPath(path);
                    if (opened) api.editor.goToLine(line, diag.col || 0);
                });
                wrap.appendChild(row);
            });
        });

        listContainer.appendChild(wrap);
    };

    const escapeHTML = (str) => (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const refresh = () => {
        renderList();
        updateStatusCounter();
        updateTabBadge();
    };

    // Seed from any diagnostics the core has already collected (e.g. after a plugin
    // hot-reload, where this panel is re-registered but the language server is still live).
    if (typeof window !== 'undefined' && window.activeDiagnosticsCache instanceof Map) {
        window.activeDiagnosticsCache.forEach((diags, path) => {
            fileDiagnostics.set((path || '').toLowerCase(), diags || []);
        });
    }

    // Live diagnostics feed from the core LSP pipeline
    api.events.on('diagnostics-updated', ({ path, diagnostics }) => {
        fileDiagnostics.set((path || '').toLowerCase(), diagnostics || []);
        refresh();
    });

    // 1. Bottom dock tab
    api.views.registerBottomPanelTab('problems', {
        title: 'Problems',
        render: (container) => {
            listContainer = container;
            refresh();
        }
    });

    // 2. Status bar counter (left side, VS Code style) — click opens the panel
    api.views.registerStatusBarItem('problem-counts', {
        side: 'left',
        tooltip: 'Problems reported by language servers — click to open the panel',
        onClick: () => api.editor.openBottomPanelTab('problems'),
        render: (el) => {
            statusElement = el;
            updateStatusCounter();
        }
    });

    console.log('Built-in Problems panel registered.');
}
