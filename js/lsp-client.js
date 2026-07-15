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

    async stop() {
        if (!this.isElectron) return;
        const { ipcRenderer } = window.require('electron');
        await ipcRenderer.invoke('lsp-stop', this.lspId);
        this.isStarted = false;
        this.isStarting = false;
    }
}