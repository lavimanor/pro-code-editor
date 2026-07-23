import { LspClient } from './lsp-client.js';

/**
 * Contribution ownership & IDE scoping.
 *
 * Every registration made while a plugin's activate() is running is stamped with the
 * plugin that made it. Contributions owned by an IDE plugin — or by an extension the
 * IDE bundles — are only *live* while one of that plugin's IDEs is the selected
 * workspace. Everything else (standalone extensions, core registrations) is always live.
 */
class OwnershipRegistry {
    constructor() {
        this._stack = [];              // Activation owner stack (activate() calls can nest)
        this.pluginIdes = new Map();   // pluginId -> Set(ide ids that plugin registered)
        this._resolveActiveIde = () => null;
    }

    /** Wired by ProEditorAPI so ownership can read the live selection. */
    _bindActiveIdeResolver(fn) {
        this._resolveActiveIde = fn;
    }

    beginActivation(owner) {
        this._stack.push(owner || null);
    }

    endActivation() {
        this._stack.pop();
    }

    /** The plugin currently being activated, or null when the host itself registers. */
    current() {
        return this._stack.length ? this._stack[this._stack.length - 1] : null;
    }

    /** The plugin id that registered a given IDE, or null. */
    findPluginForIde(ideId) {
        for (const [pluginId, ideIds] of this.pluginIdes.entries()) {
            if (ideIds.has(ideId)) return pluginId;
        }
        return null;
    }

    /** Records which IDE ids a plugin registered, so its contributions can be scoped. */
    bindPluginIdes(pluginId, ideIds) {
        if (!pluginId || !ideIds || !ideIds.length) return;
        if (!this.pluginIdes.has(pluginId)) this.pluginIdes.set(pluginId, new Set());
        const set = this.pluginIdes.get(pluginId);
        ideIds.forEach(id => set.add(id));
    }

    /** Attaches the current owner to a contribution config (non-destructively). */
    stamp(config) {
        const owner = this.current();
        if (!owner) return config;
        if (config && typeof config === 'object') {
            Object.defineProperty(config, '_owner', {
                value: owner, enumerable: false, writable: true, configurable: true
            });
        }
        return config;
    }

    /**
     * True when a contribution should currently be live. Contributions from plugins
     * that own no IDE are unconditional; IDE-owned ones follow the active selection.
     */
    isActive(config) {
        const owner = config && config._owner;
        if (!owner) return true;

        // A bundled extension shares the lifecycle of the IDE that ships it.
        const scopePluginId = owner.hostPluginId || owner.pluginId;
        const ideIds = this.pluginIdes.get(scopePluginId);
        if (!ideIds || ideIds.size === 0) return true;

        return ideIds.has(this._resolveActiveIde());
    }

    /** A copy of `map` holding only the entries that are currently live. */
    filter(map) {
        const out = new Map();
        map.forEach((config, id) => {
            if (this.isActive(config)) out.set(id, config);
        });
        return out;
    }

    reset() {
        this._stack = [];
        this.pluginIdes.clear();
    }
}

export const ownership = new OwnershipRegistry();

class ThemesAPI {
    constructor() {
        this.registry = new Map();
    }

    register(id, themeConfig) {
        if (this.registry.has(id)) {
            console.warn(`[API] Theme registration conflict: "${id}" is already registered. Overwriting.`);
        }
        this.registry.set(id, ownership.stamp(themeConfig));
    }

    get(id) {
        return this.registry.get(id);
    }

    /** Only themes whose owning plugin is currently live (drives the theme selector). */
    getAll() {
        return Object.fromEntries(ownership.filter(this.registry).entries());
    }

    /** Every registered theme, ignoring IDE scoping. */
    getAllRegistered() {
        return Object.fromEntries(this.registry.entries());
    }

    isAvailable(id) {
        const theme = this.registry.get(id);
        return !!theme && ownership.isActive(theme);
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
        this.registry.set(id, ownership.stamp(iconPackConfig));
    }

    get(id) {
        return this.registry.get(id);
    }

    /** Only icon packs whose owning plugin is currently live. */
    getAll() {
        return Object.fromEntries(ownership.filter(this.registry).entries());
    }

    getAllRegistered() {
        return Object.fromEntries(this.registry.entries());
    }

    isAvailable(id) {
        const pack = this.registry.get(id);
        return !!pack && ownership.isActive(pack);
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
            this.parserRules.set(config.parser, ownership.stamp({ rules: config.parserRules }));
        }

        if (config.extensions) {
            config.extensions.forEach(ext => {
                this.languages.set(ext.toLowerCase(), ownership.stamp({
                    db: config.db || [],
                    parser: config.parser,
                    name: config.name || langId
                }));
            });
        }
    }

    /**
     * Registers a language server for a file extension.
     *
     * `features` opts the client into the editor-side features that are driven off the
     * running server: `{ semanticTokens, completion }`. Both default off so a bare
     * registration keeps the previous behaviour (diagnostics + hover only). Each feature
     * is additionally gated at runtime by the server's advertised capabilities.
     */
    registerLspClient(ext, command, args, initializationOptions = null, features = null) {
        if (typeof window !== 'undefined' && window.process) {
            const cleanExt = ext.replace('.', '').toLowerCase();
            const client = new LspClient(cleanExt, cleanExt);
            this.lspClients.set(cleanExt, ownership.stamp({
                client, command, args, initializationOptions,
                features: features || {}
            })); // Track options + opted-in features
        }
    }

    getLspClient(ext) {
        const entry = this.lspClients.get(ext.toLowerCase());
        return entry && ownership.isActive(entry) ? entry : undefined;
    }

    /**
     * Shuts down language servers belonging to IDEs that are no longer selected.
     * Called whenever the workspace IDE changes so background processes don't linger.
     */
    stopInactiveLspClients() {
        this.lspClients.forEach(entry => {
            if (!ownership.isActive(entry)) {
                try { entry.client.stop(); } catch (err) { console.error(err); }
            }
        });
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
            this.highlighters.set(langId.toLowerCase(), ownership.stamp(model));
        } catch (err) {
            console.error(`[API Error] Failed to compile syntax highlighter rules for ${langId}:`, err);
        }
    }

    getHighlighter(langId) {
        const model = this.highlighters.get(langId.toLowerCase());
        return model && ownership.isActive(model) ? model : undefined;
    }

    get(ext) {
        const lang = this.languages.get(ext.toLowerCase());
        return lang && ownership.isActive(lang) ? lang : undefined;
    }

    getParserRules(parserId) {
        const entry = this.parserRules.get(parserId);
        return entry && ownership.isActive(entry) ? entry.rules : undefined;
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
        this.listeners = new Map(); // Map: eventName -> Set of { callback, _owner }
    }

    /**
     * Subscribe to a core editor event. Returns an unsubscribe function.
     * Core events: 'file-opened', 'file-saved', 'content-changed',
     * 'diagnostics-updated', 'workspace-opened', 'ide-changed',
     * 'file-created', 'file-renamed', 'file-deleted'.
     *
     * A subscription made by an IDE plugin only fires while that IDE is selected.
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(ownership.stamp({ callback }));
        return () => this.off(event, callback);
    }

    off(event, callback) {
        const set = this.listeners.get(event);
        if (!set) return;
        set.forEach(entry => {
            if (entry.callback === callback) set.delete(entry);
        });
    }

    emit(event, payload) {
        const set = this.listeners.get(event);
        if (!set) return;
        set.forEach(entry => {
            if (!ownership.isActive(entry)) return;
            try { entry.callback(payload); } catch (err) {
                console.error(`[API] Event listener for "${event}" threw:`, err);
            }
        });
    }

    clear() {
        this.listeners.clear();
    }
}

/**
 * Contextual menu contributions.
 *
 * Extensions and IDEs add their own entries to the file-explorer right-click menu.
 * Items are grouped, ordered, and can decide per-target whether they apply.
 */
class MenusAPI {
    constructor() {
        this.explorerItems = new Map(); // Map: id -> item config
        this.editorItems = new Map();   // Map: id -> item config
    }

    /**
     * Adds an entry to the file/folder right-click menu in the explorer.
     *
     * config: {
     *   label: string | (ctx) => string,
     *   icon?: string,                       // Font Awesome class
     *   group?: string,                      // 'new' | 'edit' | 'clipboard' | 'copy' | 'reveal' | 'danger' | custom
     *   order?: number,                      // Sort position inside the group
     *   when?: (ctx) => boolean,             // Visibility predicate
     *   enabled?: (ctx) => boolean,          // Greys the item out when false
     *   submenu?: (ctx) => Array<item>,      // Nested entries
     *   onClick: (ctx) => void | Promise
     * }
     *
     * ctx: { kind, name, path, item, handle, parent, isRoot, isEmptyArea, rootPath, api }
     */
    registerExplorerItem(id, config) {
        this.explorerItems.set(id, ownership.stamp({ ...config, id }));
    }

    /** Removes a previously registered explorer entry. */
    unregisterExplorerItem(id) {
        this.explorerItems.delete(id);
    }

    /** Adds an entry to the code editor's right-click menu. Same config shape. */
    registerEditorItem(id, config) {
        this.editorItems.set(id, ownership.stamp({ ...config, id }));
    }

    unregisterEditorItem(id) {
        this.editorItems.delete(id);
    }

    /** Live explorer contributions, honouring IDE scoping. */
    getExplorerItems() {
        return Array.from(ownership.filter(this.explorerItems).values());
    }

    /** Live editor contributions, honouring IDE scoping. */
    getEditorItems() {
        return Array.from(ownership.filter(this.editorItems).values());
    }

    clear() {
        this.explorerItems.clear();
        this.editorItems.clear();
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

    /** Replaces the whole document body in the active editor (marks the tab dirty). */
    setText(text) {
        if (this._host) this._host.setText(text);
    }

    /** { start, end, text } of the current selection. */
    getSelection() {
        return this._host ? this._host.getSelection() : { start: 0, end: 0, text: '' };
    }

    /** Overwrites the current selection (or inserts at the caret when nothing is selected). */
    replaceSelection(text) {
        if (this._host) this._host.replaceSelection(text);
    }

    /** Inserts text at the caret without disturbing the surrounding selection anchors. */
    insertAtCursor(text) {
        if (this._host) this._host.insertAtCursor(text);
    }

    /** 1-based { line, column } of the caret. */
    getCursorPosition() {
        return this._host ? this._host.getCursorPosition() : { line: 1, column: 1 };
    }

    /** Lowercased extension of the active file ('py', 'js', ...), or ''. */
    getLanguageId() {
        return this._host ? this._host.getLanguageId() : '';
    }

    /** Saves the active file to disk. */
    async save() {
        return this._host ? this._host.save() : false;
    }

    /** Every open tab as [{ name, path }]. */
    getOpenFiles() {
        return this._host ? this._host.getOpenFiles() : [];
    }

    /** Publishes diagnostics for a file: [{ line, column, endColumn, message, severity }]. */
    setDiagnostics(path, diagnostics) {
        if (this._host) this._host.setDiagnostics(path, diagnostics);
    }
}

class TerminalAPI {
    constructor() {
        this.isElectron = typeof window !== 'undefined' && window.process && window.process.type;
        this.ipcRenderer = null;
        this.runners = new Map(); // Map: ext -> { config, _owner }
        if (this.isElectron) {
            this.ipcRenderer = window.require('electron').ipcRenderer;
        }
    }

    async registerRunner(ext, runnerConfig) {
        const cleanExt = ext.replace('.', '').toLowerCase();
        this.runners.set(cleanExt, ownership.stamp({ config: runnerConfig }));

        if (this.isElectron && this.ipcRenderer) {
            await this.ipcRenderer.invoke('register-runner', cleanExt, runnerConfig);

            if (typeof window.updateRunnableExtensions === 'function') {
                await window.updateRunnableExtensions();
            }
        }
    }

    /**
     * Rebuilds the main-process run registry from scratch so it holds only the runners
     * whose owning plugin is currently live. Invoked on every IDE switch — a Python IDE's
     * `.py` runner must not stay wired up once the user moves to another workspace.
     */
    async syncActiveRunners() {
        if (!this.isElectron || !this.ipcRenderer) return;

        await this.ipcRenderer.invoke('reset-runners');
        for (const [ext, entry] of this.runners.entries()) {
            if (!ownership.isActive(entry)) continue;
            await this.ipcRenderer.invoke('register-runner', ext, entry.config);
        }
        if (typeof window.updateRunnableExtensions === 'function') {
            await window.updateRunnableExtensions();
        }
    }

    async resetRunners() {
        this.runners.clear();
        if (this.isElectron && this.ipcRenderer) {
            await this.ipcRenderer.invoke('reset-runners');
        }
    }

    /** Runs a shell command in the workspace and streams its output to the terminal. */
    async exec(command, options = {}) {
        if (!this.isElectron || !this.ipcRenderer) {
            return { success: false, output: '[Unsupported] Shell execution requires the desktop shell.' };
        }
        return await this.ipcRenderer.invoke('exec-command', command, {
            cwd: options.cwd || window.currentWorkspacePath || null,
            stream: options.stream !== false
        });
    }
}

class ViewsAPI {
    constructor() {
        this.sidebarPanels = new Map();
        this.customSettings = new Map();
        this.diagnosticStyles = new Map(); // Map: id -> custom css class definitions (Added Fix)
        this.bottomPanelTabs = new Map();  // Map: id -> { title, render } bottom dock tabs
        this.statusBarItems = new Map();   // Map: id -> { side, tooltip, onClick, render } status bar widgets
        this.rightPanels = new Map();      // Map: id -> { title, iconClass, render } right dock tool windows
    }

    registerSidebarPanel(id, config) {
        this.sidebarPanels.set(id, ownership.stamp(config));
        if (typeof window.renderDynamicSidebarPanels === 'function') {
            window.renderDynamicSidebarPanels();
        }
    }

    registerSetting(id, config) {
        this.customSettings.set(id, ownership.stamp(config));
        if (typeof window.renderDynamicSettings === 'function') {
            window.renderDynamicSettings();
        }
    }

    registerDiagnosticStyle(id, config) {
        this.diagnosticStyles.set(id, ownership.stamp(config));
        if (typeof window.renderDiagnosticStyleSelector === 'function') {
            window.renderDiagnosticStyleSelector();
        }
    }

    /**
     * Registers a tab inside the bottom dock (next to TERMINAL).
     * Config: { title: string, render: (container) => void }
     */
    registerBottomPanelTab(id, config) {
        this.bottomPanelTabs.set(id, ownership.stamp(config));
        if (typeof window.renderDynamicBottomTabs === 'function') {
            window.renderDynamicBottomTabs();
        }
    }

    /**
     * Registers a widget inside the status bar.
     * Config: { side: 'left'|'right', tooltip, onClick, render: (el) => void, text }
     */
    registerStatusBarItem(id, config) {
        this.statusBarItems.set(id, ownership.stamp(config));
        if (typeof window.renderDynamicStatusItems === 'function') {
            window.renderDynamicStatusItems();
        }
    }

    /**
     * Registers a tool window in the right-hand dock (IntelliJ-style). Each panel gets a
     * toggle button on the right activity bar; the dock stays hidden until at least one
     * panel is registered. Intended for rich, stateful side tools (outlines, agents…).
     * Config: { title: string, iconClass: string, render: (container) => void, order?: number }
     */
    registerRightPanel(id, config) {
        this.rightPanels.set(id, ownership.stamp(config));
        if (typeof window.renderDynamicRightPanels === 'function') {
            window.renderDynamicRightPanels();
        }
    }

    /** Removal helpers so a plugin can retract a contribution without a full reload. */
    unregisterSidebarPanel(id) {
        this.sidebarPanels.delete(id);
        if (typeof window.renderDynamicSidebarPanels === 'function') window.renderDynamicSidebarPanels();
    }

    unregisterBottomPanelTab(id) {
        this.bottomPanelTabs.delete(id);
        if (typeof window.renderDynamicBottomTabs === 'function') window.renderDynamicBottomTabs();
    }

    unregisterStatusBarItem(id) {
        this.statusBarItems.delete(id);
        if (typeof window.renderDynamicStatusItems === 'function') window.renderDynamicStatusItems();
    }

    unregisterRightPanel(id) {
        this.rightPanels.delete(id);
        if (typeof window.renderDynamicRightPanels === 'function') window.renderDynamicRightPanels();
    }

    unregisterSetting(id) {
        this.customSettings.delete(id);
        if (typeof window.renderDynamicSettings === 'function') window.renderDynamicSettings();
    }

    // --- Scoped accessors: only contributions whose owning plugin is currently live ---
    activeSidebarPanels() { return ownership.filter(this.sidebarPanels); }
    activeBottomPanelTabs() { return ownership.filter(this.bottomPanelTabs); }
    activeStatusBarItems() { return ownership.filter(this.statusBarItems); }
    activeCustomSettings() { return ownership.filter(this.customSettings); }
    activeDiagnosticStyles() { return ownership.filter(this.diagnosticStyles); }
    activeRightPanels() { return ownership.filter(this.rightPanels); }

    getDiagnosticStyle(id) {
        const style = this.diagnosticStyles.get(id);
        return style && ownership.isActive(style) ? style : undefined;
    }

    clear() {
        this.sidebarPanels.clear();
        this.customSettings.clear();
        this.diagnosticStyles.clear();
        this.bottomPanelTabs.clear();
        this.statusBarItems.clear();
        this.rightPanels.clear();
    }
}

class WorkspaceAPI {
    constructor() {
        this.ides = new Map();
        this.activeIdeId = null;
    }

    registerIDE(id, config) {
        this.ides.set(id, ownership.stamp(config));
        // Bind the IDE to the plugin that registered it so every other contribution
        // from that same plugin can be scoped to this workspace selection.
        const owner = ownership.current();
        if (owner && owner.pluginId) {
            ownership.bindPluginIdes(owner.pluginId, [id]);
        }
        if (typeof window.renderIdeSelector === 'function') {
            window.renderIdeSelector();
        }
    }

    getActiveIDE() {
        return this.activeIdeId ? this.ides.get(this.activeIdeId) : null;
    }

    /** True when `ideId` is the selected workspace. Handy inside plugin callbacks. */
    isActive(ideId) {
        return this.activeIdeId === ideId;
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
        this.menus = new MenusAPI();
        this.ownership = ownership;

        ownership._bindActiveIdeResolver(() => this.workspace.activeIdeId);
    }
}

export const api = new ProEditorAPI();

// Expose on the window context for global access by dynamic scripts
window.ProEditorAPI = api;