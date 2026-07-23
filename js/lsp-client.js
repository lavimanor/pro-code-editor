/**
 * Dynamic path segments to file URL URI helper
 */
function pathToUri(filePath) {
    let clean = filePath.replace(/\\/g, '/');
    if (!clean.startsWith('/')) {
        clean = '/' + clean;
    }
    return 'file://' + encodeURI(clean);
}

export class LspClient {
    constructor(lspId, ext) {
        this.lspId = lspId;
        this.ext = ext;
        this.requestId = 0;
        this.pendingRequests = new Map();
        this.notificationCallbacks = new Map();
        this.isElectron = typeof window !== 'undefined' && window.process && window.process.type;
        this.isStarted = false;
        this.isStarting = false;
        this.diagnosticsRegistered = false;

        // Populated from the server's `initialize` reply (see initialize()).
        this.capabilities = null;
        this.semanticTokensLegend = null;

        if (this.isElectron) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.on('lsp-message', (event, { lspId: id, message }) => {
                if (id !== this.lspId) return;

                // Silenced noisy console spams
                // console.log(`[LSP Client Debug ${id}] Incoming Message:`, message);

                if (message.id !== undefined) {
                    const resolve = this.pendingRequests.get(message.id);
                    if (resolve) {
                        resolve(message);
                        this.pendingRequests.delete(message.id);
                    }
                } else {
                    const callbacks = this.notificationCallbacks.get(message.method);
                    if (callbacks) {
                        callbacks.forEach(cb => cb(message.params));
                    }
                }
            });
        }
    }

    sendRequest(method, params) {
        const id = this.requestId++;
        return new Promise((resolve) => {
            if (!this.isElectron) {
                resolve(null);
                return;
            }
            const { ipcRenderer } = window.require('electron');
            this.pendingRequests.set(id, resolve);
            ipcRenderer.invoke('lsp-send', this.lspId, { jsonrpc: '2.0', id, method, params });
        });
    }

    sendNotification(method, params) {
        if (!this.isElectron) return;
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.invoke('lsp-send', this.lspId, { jsonrpc: '2.0', method, params });
    }

    onNotification(method, callback) {
        if (!this.notificationCallbacks.has(method)) {
            this.notificationCallbacks.set(method, []);
        }
        this.notificationCallbacks.get(method).push(callback);
    }

    async start(command, args, workspacePath, initializationOptions = null) {
        if (this.isStarted || this.isStarting) {
            return true;
        }
        if (!this.isElectron) {
            return false;
        }

        this.isStarting = true;
        const { ipcRenderer } = window.require('electron');
        const res = await ipcRenderer.invoke('lsp-start', this.lspId, command, args, workspacePath, initializationOptions);
        
        if (res && res.success) {
            try {
                await this.initialize(workspacePath, res.initializationOptions || initializationOptions);
                this.isStarted = true;
                this.isStarting = false;
                return true;
            } catch (err) {
                console.error('[LSP Client Debug] Handshake failed or timed out:', err);
                this.isStarting = false;
                this.isStarted = false;
                return false;
            }
        }
        this.isStarting = false;
        return false;
    }

    async initialize(workspacePath, initializationOptions = null) {
        const rootUri = pathToUri(workspacePath);
        return this.sendRequest('initialize', {
            processId: window.process ? window.process.pid : null,
            rootPath: workspacePath,
            rootUri: rootUri,
            capabilities: {
                workspace: {
                    // Advertise workspace configuration change capability
                    didChangeConfiguration: { dynamicRegistration: true }
                },
                textDocument: {
                    // Explicitly advertise document synchronization support to enable real-time typing analysis (Added Fix)
                    synchronization: {
                        dynamicRegistration: true,
                        willSave: true,
                        willSaveWaitUntil: true,
                        didSave: true
                    },
                    completion: { completionItem: { snippetSupport: true } },
                    hover: {},
                    // Ask servers to compute whole-document semantic tokens. The server
                    // answers with its own legend (captured below) and returns indices
                    // into it, so the exhaustive lists here are just the vocabulary we
                    // promise to understand — servers fall back gracefully when a type
                    // is unknown to us.
                    semanticTokens: {
                        dynamicRegistration: false,
                        requests: { range: false, full: true },
                        tokenTypes: [
                            'namespace', 'type', 'class', 'enum', 'interface', 'struct',
                            'typeParameter', 'parameter', 'variable', 'property', 'enumMember',
                            'event', 'function', 'method', 'macro', 'keyword', 'modifier',
                            'comment', 'string', 'number', 'regexp', 'operator', 'decorator'
                        ],
                        tokenModifiers: [
                            'declaration', 'definition', 'readonly', 'static', 'deprecated',
                            'abstract', 'async', 'modification', 'documentation', 'defaultLibrary'
                        ],
                        formats: ['relative'],
                        overlappingTokenSupport: false,
                        multilineTokenSupport: false
                    },
                    // Explicitly advertise standard diagnostic properties to activate server push streams
                    publishDiagnostics: {
                        relatedInformation: true,
                        tagSupport: { valueSet: [1, 2] },
                        versionSupport: true
                    }
                }
            },
            initializationOptions: initializationOptions
        }).then(async (res) => {
            this.sendNotification('initialized', {});

            // Remember what the server can actually do, so the editor only asks for
            // features it advertises (e.g. pyright ships completions and semantic
            // tokens; the CSS/HTML servers offer completions but no semantic tokens).
            if (res && res.result && res.result.capabilities) {
                this.capabilities = res.result.capabilities;
                const stp = this.capabilities.semanticTokensProvider;
                this.semanticTokensLegend = (stp && stp.legend) || null;
            }

            // Broadcast settings dynamically via workspace/didChangeConfiguration to satisfy
            // servers (like typescript-language-server) that expect config updates
            if (initializationOptions) {
                this.sendNotification('workspace/didChangeConfiguration', {
                    settings: initializationOptions
                });
            }
            
            return res;
        });
    }

    didOpen(filePath, languageId, text) {
        const uri = pathToUri(filePath);
        this.sendNotification('textDocument/didOpen', {
            textDocument: {
                uri,
                languageId,
                version: 1,
                text
            }
        });
    }

    didChange(filePath, version, text) {
        const uri = pathToUri(filePath);
        this.sendNotification('textDocument/didChange', {
            textDocument: { uri, version },
            contentChanges: [{ text }]
        });
    }

    async completion(filePath, line, character) {
        const uri = pathToUri(filePath);
        return this.sendRequest('textDocument/completion', {
            textDocument: { uri },
            position: { line, character }
        });
    }

    async hover(filePath, line, character) {
        const uri = pathToUri(filePath);
        return this.sendRequest('textDocument/hover', {
            textDocument: { uri },
            position: { line, character }
        });
    }

    /** Whole-document semantic tokens. Resolves to a message whose result is { data:[…] }. */
    async semanticTokens(filePath) {
        const uri = pathToUri(filePath);
        return this.sendRequest('textDocument/semanticTokens/full', {
            textDocument: { uri }
        });
    }

    /** True once the server has advertised a completion provider. */
    hasCompletion() {
        return !!(this.capabilities && this.capabilities.completionProvider);
    }

    /** True once the server has advertised a semantic-tokens provider with a legend. */
    hasSemanticTokens() {
        return !!(this.capabilities && this.capabilities.semanticTokensProvider) && !!this.semanticTokensLegend;
    }

    /** The server's { tokenTypes, tokenModifiers } legend, or null before initialize. */
    getSemanticTokensLegend() {
        return this.semanticTokensLegend;
    }

    async stop() {
        if (!this.isElectron) return;
        const { ipcRenderer } = window.require('electron');
        await ipcRenderer.invoke('lsp-stop', this.lspId);
        this.isStarted = false;
        this.isStarting = false;
    }
}