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

    clear() {
        this.sidebarPanels.clear();
        this.customSettings.clear();
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
    }
}

export const api = new ProEditorAPI();

// Expose on the window context for global access by dynamic scripts
window.ProEditorAPI = api;