/**
 * The status bar readout for the web language servers.
 *
 * The host renders status items from a registry and re-runs every `render` callback
 * on `window.renderDynamicStatusItems()` (see js/app.js). So the widget keeps its
 * state in a closure, and a refresh is just a re-render request.
 */

import { probeLanguageServers } from './lsp.js';

const STATUS_ID = 'hyperweb-lsp-status';

function repaint() {
    if (typeof window.renderDynamicStatusItems === 'function') {
        window.renderDynamicStatusItems();
    }
}

function paint(el, state) {
    if (state.phase === 'checking') {
        el.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> LSP';
        el.title = 'Looking for the web language servers…';
        return;
    }

    if (state.phase === 'unavailable') {
        el.innerHTML = '<i class="fa-regular fa-circle"></i> LSP';
        el.title = 'Language servers need the desktop shell — highlighting only in the browser build.';
        el.style.color = 'var(--text-muted)';
        return;
    }

    const missing = state.servers.filter((s) => !s.found);
    const total = state.servers.length;

    if (missing.length === 0) {
        el.innerHTML = `<i class="fa-solid fa-bolt"></i> LSP ${total}/${total}`;
        el.title = `Ready: ${state.servers.map((s) => s.label).join(', ')}`;
        el.style.color = '';
    } else {
        el.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> LSP ${total - missing.length}/${total}`;
        el.title = `Not on PATH: ${missing.map((s) => s.command).join(', ')} — click for install commands`;
        el.style.color = '#e2c08d';
    }
}

/**
 * Registers the widget, then probes for the server binaries in the background so
 * activation is never blocked on spawning shells.
 */
export function registerLspStatus(ctx, servers) {
    const state = {
        phase: 'checking',
        servers: servers.map((server) => ({ ...server, found: false }))
    };

    ctx.registerStatusBarItem(STATUS_ID, {
        side: 'right',
        tooltip: 'Web language servers',
        render: (el) => paint(el, state),
        onClick: () => {
            ctx.terminal.show();
            report(ctx, state);
        }
    });

    probeLanguageServers(ctx).then((results) => {
        if (results === null) {
            state.phase = 'unavailable';
        } else {
            state.phase = 'ready';
            state.servers = results;

            const missing = results.filter((s) => !s.found);
            if (missing.length > 0) {
                // 'system' keeps this quiet: any other type force-opens the terminal
                // panel, which is too loud for a background probe (see js/terminal.js).
                ctx.terminal.print(
                    `[HyperWeb] ${missing.length} language server(s) not found on PATH — click the LSP item in the status bar for install commands.`,
                    'system'
                );
            }
        }
        repaint();
    }).catch((err) => {
        console.error('[HyperWeb] Language server probe failed:', err);
        state.phase = 'ready';
        repaint();
    });
}

/** Prints a per-server breakdown, with the install command for anything missing. */
function report(ctx, state) {
    if (state.phase === 'unavailable') {
        ctx.terminal.print('[HyperWeb] Language servers require the desktop shell. Syntax highlighting is active.', 'system');
        return;
    }

    ctx.terminal.print('[HyperWeb] Web language servers:', 'system');
    state.servers.forEach((server) => {
        if (server.found) {
            ctx.terminal.print(`  ✓ ${server.label} — ${server.command}`, 'system');
        } else {
            ctx.terminal.print(`  ✗ ${server.label} — not found. Install with: ${server.install}`, 'system');
        }
    });
}
