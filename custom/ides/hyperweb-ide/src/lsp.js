/**
 * HyperWeb IDE language servers.
 *
 * The editor drives the whole LSP lifecycle itself (js/app.js starts a server on the
 * first matching file open, streams edits through textDocument/didChange, and renders
 * publishDiagnostics and hover results). All this module has to do is declare which
 * binary backs which language.
 *
 * Two details are easy to get wrong:
 *
 *  - The lookup key. `js/app.js` resolves a client with the *language name* lowercased
 *    (`api.languages.get(ext).name`) and only falls back to the file extension. So the
 *    keys below must stay in step with the `name` fields in `src/syntax.js`.
 *  - `initializationOptions` is used twice by `js/lsp-client.js`: once in the
 *    `initialize` request, and again as the payload of `workspace/didChangeConfiguration`.
 *    The objects below therefore carry both the server's init options and its settings;
 *    each server ignores the keys that are not its own.
 *
 * `ctx.registerLspClient` is a no-op outside the Electron shell, so the browser build
 * quietly keeps working with highlighting only.
 */

const isWindows = typeof window !== 'undefined' && window.process && window.process.platform === 'win32';

/** npm installs global CLIs as .cmd shims on Windows; the bare name will not spawn. */
const bin = (name) => (isWindows ? `${name}.cmd` : name);

export const WEB_SERVERS = [
    {
        key: 'html',
        label: 'HTML',
        command: 'vscode-html-language-server',
        install: 'npm i -g vscode-langservers-extracted',
        args: ['--stdio'],
        options: {
            // Read from initializationOptions by the server
            embeddedLanguages: { css: true, javascript: true },
            provideFormatter: true,
            // Read from the didChangeConfiguration settings payload
            html: {
                validate: { scripts: true, styles: true },
                suggest: { html5: true },
                hover: { documentation: true, references: true },
                format: { enable: true, wrapLineLength: 120 }
            },
            css: { validate: true },
            javascript: { validate: { enable: true } }
        }
    },
    {
        key: 'css',
        label: 'CSS / SCSS / LESS',
        command: 'vscode-css-language-server',
        install: 'npm i -g vscode-langservers-extracted',
        args: ['--stdio'],
        options: {
            // This server validates nothing until it receives settings, so all three
            // dialects have to be switched on explicitly.
            css: { validate: true, lint: { unknownAtRules: 'ignore' } },
            scss: { validate: true, lint: { unknownAtRules: 'ignore' } },
            less: { validate: true, lint: { unknownAtRules: 'ignore' } }
        }
    },
    {
        key: 'javascript',
        label: 'JavaScript',
        command: 'typescript-language-server',
        install: 'npm i -g typescript-language-server typescript',
        args: ['--stdio'],
        options: {
            // main.js resolves tsserver.js out of the global npm root for any command
            // starting with 'typescript-language-server' and merges it in here.
            hostInfo: 'pro-code-editor',
            preferences: {
                includeCompletionsForModuleExports: true,
                includeCompletionsWithSnippetText: true,
                includeCompletionsWithInsertText: true
            }
        }
    }
];

/**
 * Editor features driven off the running servers. Both are gated at runtime by each
 * server's advertised capabilities, so opting everyone in is safe: the JS
 * (typescript-language-server) server backs semantic highlighting, while all three feed
 * their completions into ProSense. The HTML and CSS servers simply don't advertise
 * semantic tokens, so that half is skipped for them and the regex highlighter stands.
 */
const WEB_LSP_FEATURES = { semanticTokens: true, completion: true };

/**
 * Registers every web language server for this IDE's lifetime. The host shuts them
 * down when the user switches workspace, so there is nothing to clean up here.
 */
export function registerWebLsp(ctx) {
    WEB_SERVERS.forEach((server) => {
        try {
            ctx.registerLspClient(server.key, bin(server.command), server.args, server.options, WEB_LSP_FEATURES);
        } catch (err) {
            console.error(`[HyperWeb] Could not register the ${server.label} language server:`, err);
        }
    });
    return WEB_SERVERS;
}

/**
 * Checks which server binaries are actually on PATH.
 *
 * Worth doing because a missing binary fails silently: the editor spawns the server
 * lazily through a shell, and `LspClient.start` waits on an `initialize` reply that
 * never arrives. Without this probe the only symptom is that nothing ever happens.
 *
 * Resolves to `[{ ...server, found }]`, or null when there is no shell to probe with.
 */
export async function probeLanguageServers(ctx) {
    if (typeof window === 'undefined' || !window.process) return null;

    const lookup = isWindows ? 'where' : 'command -v';

    return Promise.all(WEB_SERVERS.map(async (server) => {
        try {
            const result = await ctx.runCommand(`${lookup} ${bin(server.command)}`, { stream: false });
            return { ...server, found: !!(result && result.success) };
        } catch (err) {
            return { ...server, found: false };
        }
    }));
}
