import { LspClient } from './lsp-client.js';

class ThemesAPI {
    constructor() {
        this.registry = new Map();
    }

    register(id, themeConfig) {
        if (this.registry.has(id)) {
            console.warn(`[API] Theme registration conflict: "${id}" is already registered. Overwriting.`);
        }
        this.registry.set(id, themeConfig);
    }

    get(id) {
        return this.registry.get(id);
    }

    getAll() {
        return Object.fromEntries(this.registry.entries());
    }

    clear() {
        this.registry.clear();
    }
}

class IconsAPI {
    constructor() {
        this.registry = new Map();
    }

    register(id, iconPackConfig) {
        if (this.registry.has(id)) {
            console.warn(`[API] Icon pack registration conflict: "${id}" is already registered. Overwriting.`);
        }
        this.registry.set(id, iconPackConfig);
    }

    get(id) {
        return this.registry.get(id);
    }

    getAll() {
        return Object.fromEntries(this.registry.entries());
    }

    clear() {
        this.registry.clear(); // <-- Added this method to prevent the TypeError
    }
}

class LanguagesAPI {
    constructor() {
        this.languages = new Map();     // Map: fileExtension -> langConfig
        this.parserRules = new Map();   // Map: parserId -> array of rules
        this.highlighters = new Map();  // Map: langId -> compiled syntax regex model
        this.lspClients = new Map();    // Map: fileExtension -> active LSP client configuration (Added Fix)
    }

    register(langId, config) {
        if (config.parser && config.parserRules) {
            this.parserRules.set(config.parser, config.parserRules);
        }

        if (config.extensions) {
            config.extensions.forEach(ext => {
                this.languages.set(ext.toLowerCase(), {
                    db: config.db || [],
                    parser: config.parser,
                    name: config.name || langId
                });
            });
        }
    }

    registerLspClient(ext, command, args, initializationOptions = null) {
        if (typeof window !== 'undefined' && window.process) {
            const cleanExt = ext.replace('.', '').toLowerCase();
            const client = new LspClient(cleanExt, cleanExt);
            this.lspClients.set(cleanExt, { client, command, args, initializationOptions }); // Track options
        }
    }

    getLspClient(ext) {
        return this.lspClients.get(ext.toLowerCase());
    }

    /**
     * Compiles and registers custom syntax highlighting rules for a language.
     * Maps alternate patterns into unified capture-group regex trees for performance.
     */
    registerHighlighter(langId, rules) {
        if (!rules || rules.length === 0) return;

        // Combine regex sources into grouped alternatives: (pattern1)|(pattern2)...
        const source = rules.map(rule => `(${rule.regex.source})`).join('|');
        try {
            const model = {
                regex: new RegExp(source, 'g'),
                types: rules.map(rule => rule.type)
            };
            this.highlighters.set(langId.toLowerCase(), model);
        } catch (err) {
            console.error(`[API Error] Failed to compile syntax highlighter rules for ${langId}:`, err);
        }
    }

    getHighlighter(langId) {
        return this.highlighters.get(langId.toLowerCase());
    }

    get(ext) {
        return this.languages.get(ext.toLowerCase());
    }

    getParserRules(parserId) {
        return this.parserRules.get(parserId);
    }

    clear() {
        this.languages.clear();
        this.parserRules.clear();
        this.highlighters.clear(); // Wipes syntax caches to prevent leaks during hot-reloads
        
        // Terminate any background servers safely before flushing (Added Fix)
        this.lspClients.forEach(entry => {
            try { entry.client.stop(); } catch (err) { console.error(err); }
        });
        this.lspClients.clear();
    }
}

class EventsAPI {
    constructor() {
        this.listeners = new Map(); // Map: eventName -> Set of callbacks
    }

    /**
     * Subscribe to a core editor event. Returns an unsubscribe function.
     * Core events: 'file-opened', 'file-saved', 'content-changed',
     * 'diagnostics-updated', 'workspace-opened'.
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
        return () => this.off(event, callback);
    }

    off(event, callback) {
        const set = this.listeners.get(event);
        if (set) set.delete(callback);
    }

    emit(event, payload) {
        const set = this.listeners.get(event);
        if (!set) return;
        set.forEach(cb => {
            try { cb(payload); } catch (err) {
                console.error(`[API] Event listener for "${event}" threw:`, err);
            }
        });
    }

    clear() {
        this.listeners.clear();
    }
}

/**
 * Facade over the live editor surface. The host (app.js) attaches its
 * internal handlers at boot; plugins consume the stable methods below.
 */
class EditorAPI {
    constructor() {
        this._host = null;
    }

    _attachHost(host) {
        this._host = host;
    }

    /** Full (unfolded) text of the active document. */
    getText() {
        return this._host ? this._host.getText() : '';
    }

    /** { path, name } of the active file, or null. */
    getActiveFile() {
        return this._host ? this._host.getActiveFile() : null;
    }

    /** Jump the caret to a 1-based line (optional 0-based column). */
    goToLine(line, column = null) {
        if (this._host) this._host.goToLine(line, column);
    }

    /** Re-focus an already-open tab by absolute path. Resolves true on success. */
    async openFileByPath(path) {
        return this._host ? this._host.openFileByPath(path) : false;
    }

    /** Re-read the active file from disk (e.g. after an external formatter ran). */
    async reloadActiveFile() {
        return this._host ? this._host.reloadActiveFile() : false;
    }

    /** Reveal the bottom panel and focus the given registered tab. */
    openBottomPanelTab(id) {
        if (this._host) this._host.openBottomPanelTab(id);
    }
}

class TerminalAPI {
    constructor() {
        this.isElectron = typeof window !== 'undefined' && window.process && window.process.type;
        this.ipcRenderer = null;
        if (this.isElectron) {
            this.ipcRenderer = window.require('electron').ipcRenderer;
        }
    }

    async registerRunner(ext, runnerConfig) {
        if (this.isElectron && this.ipcRenderer) {
            const cleanExt = ext.replace('.', '').toLowerCase();
            await this.ipcRenderer.invoke('register-runner', cleanExt, runnerConfig);
            
            if (typeof window.updateRunnableExtensions === 'function') {
                await window.updateRunnableExtensions();
            }
        }
    }

    async resetRunners() {
        if (this.isElectron && this.ipcRenderer) {
            await this.ipcRenderer.invoke('reset-runners');
        }
    }
}

class ViewsAPI {
    constructor() {
        this.sidebarPanels = new Map();
        this.customSettings = new Map();
        this.diagnosticStyles = new Map(); // Map: id -> custom css class definitions (Added Fix)
        this.bottomPanelTabs = new Map();  // Map: id -> { title, render } bottom dock tabs
        this.statusBarItems = new Map();   // Map: id -> { side, tooltip, onClick, render } status bar widgets
    }

    registerSidebarPanel(id, config) {
        this.sidebarPanels.set(id, config);
        if (typeof window.renderDynamicSidebarPanels === 'function') {
            window.renderDynamicSidebarPanels();
        }
    }

    registerSetting(id, config) {
        this.customSettings.set(id, config);
        if (typeof window.renderDynamicSettings === 'function') {
            window.renderDynamicSettings();
        }
    }

    registerDiagnosticStyle(id, config) {
        this.diagnosticStyles.set(id, config);
        if (typeof window.renderDiagnosticStyleSelector === 'function') {
            window.renderDiagnosticStyleSelector();
        }
    }

    /**
     * Registers a tab inside the bottom dock (next to TERMINAL).
     * Config: { title: string, render: (container) => void }
     */
    registerBottomPanelTab(id, config) {
        this.bottomPanelTabs.set(id, config);
        if (typeof window.renderDynamicBottomTabs === 'function') {
            window.renderDynamicBottomTabs();
        }
    }

    /**
     * Registers a widget inside the status bar.
     * Config: { side: 'left'|'right', tooltip, onClick, render: (el) => void, text }
     */
    registerStatusBarItem(id, config) {
        this.statusBarItems.set(id, config);
        if (typeof window.renderDynamicStatusItems === 'function') {
            window.renderDynamicStatusItems();
        }
    }

    getDiagnosticStyle(id) {
        return this.diagnosticStyles.get(id);
    }

    clear() {
        this.sidebarPanels.clear();
        this.customSettings.clear();
        this.diagnosticStyles.clear();
        this.bottomPanelTabs.clear();
        this.statusBarItems.clear();
    }
}

class WorkspaceAPI {
    constructor() {
        this.ides = new Map(); 
        this.activeIdeId = null;
    }

    registerIDE(id, config) {
        this.ides.set(id, config);
        if (typeof window.renderIdeSelector === 'function') {
            window.renderIdeSelector();
        }
    }

    getActiveIDE() {
        return this.activeIdeId ? this.ides.get(this.activeIdeId) : null;
    }

    clear() {
        const activeIde = this.getActiveIDE();
        if (activeIde && typeof activeIde.onDeactivate === 'function') {
            try { activeIde.onDeactivate(); } catch (err) { console.error(err); }
        }
        this.ides.clear();
        this.activeIdeId = null; // Reset the active ID to prevent stale references (Added Fix)
    }
}

class ProEditorAPI {
    constructor() {
        this.version = '1.0.0';
        this.themes = new ThemesAPI();
        this.icons = new IconsAPI();
        this.languages = new LanguagesAPI();
        this.terminal = new TerminalAPI();
        this.views = new ViewsAPI();
        this.workspace = new WorkspaceAPI();
        this.events = new EventsAPI();
        this.editor = new EditorAPI();
    }
}

export const api = new ProEditorAPI();

// Expose on the window context for global access by dynamic scripts
window.ProEditorAPI = api;