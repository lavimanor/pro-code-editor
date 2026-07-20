import { printToTerminal } from './terminal.js';
import { api } from './api-core.js';
import { registerProblemsPanel } from './problems.js';

const CORE_API_VERSION = '1.0.0';

export class PluginManager {
    constructor() {
        this.plugins = [];       // Holds active, verified plugins only
        this.allPlugins = [];    // Holds all discovered plugins (with status metadata)
        this.isElectron = typeof window !== 'undefined' && window.process && window.process.type;
        this.ipcRenderer = null;
        if (this.isElectron) {
            this.ipcRenderer = window.require('electron').ipcRenderer;
        }
    }

    async initialize() {
        printToTerminal('[System] Initializing plugin scanner...', 'system');
        try {
            const scanned = await this.scan();
            await this.validateAndRegister(scanned);
        } catch (err) {
            printToTerminal(`[System Error] Scanning phase failed: ${err.message}`, 'system');
        }
    }

    async scan() {
        if (this.isElectron && this.ipcRenderer) {
            return await this.ipcRenderer.invoke('scan-plugins');
        } else {
            printToTerminal('[System] Running in browser context. Dynamic disk plugin scanning is disabled.', 'system');
            return [];
        }
    }

    getDisabledPluginIds() {
        try {
            return JSON.parse(localStorage.getItem('editor-disabled-plugins') || '[]');
        } catch (e) {
            return [];
        }
    }

    /**
     * Analyzes the raw scan results to resolve the relationships between IDEs and the
     * extensions they integrate (bundled) or depend on (declared dependencies).
     * Returns lookup structures consumed by the activation loop and the manager UI.
     */
    _buildDependencyContext(scanned, disabledIds) {
        const isUsable = (p) => p && p.id && p.name && p.version && p.apiVersion && p.type
            && this.isCompatible(p.apiVersion) && !p.error;

        // Every extension id present on disk (standalone or bundled inside an IDE)
        const presentExtIds = new Set(
            scanned.filter(p => p.type === 'extension' && p.id).map(p => p.id)
        );

        // IDEs the user actually wants active (valid, compatible, not manually disabled)
        const enabledIdeIds = new Set();
        scanned.forEach(p => {
            if (p.type === 'ide' && isUsable(p) && !disabledIds.includes(p.id)) {
                enabledIdeIds.add(p.id);
            }
        });

        // extId -> [ide display names] that require it as a hard dependency
        const requiredBy = new Map();
        // ideId -> [missing dependency ids]
        const missingDeps = new Map();
        scanned.forEach(p => {
            if (p.type !== 'ide' || !Array.isArray(p.extensionDependencies)) return;
            const missing = [];
            p.extensionDependencies.forEach(depId => {
                if (!presentExtIds.has(depId)) {
                    missing.push(depId);
                } else if (enabledIdeIds.has(p.id)) {
                    if (!requiredBy.has(depId)) requiredBy.set(depId, []);
                    requiredBy.get(depId).push(p.name || p.id);
                }
            });
            if (missing.length) missingDeps.set(p.id, missing);
        });

        return { presentExtIds, enabledIdeIds, requiredBy, missingDeps };
    }

    togglePluginState(id, shouldDisable) {
        const disabled = this.getDisabledPluginIds();
        if (shouldDisable) {
            if (!disabled.includes(id)) {
                disabled.push(id);
            }
        } else {
            const idx = disabled.indexOf(id);
            if (idx !== -1) {
                disabled.splice(idx, 1);
            }
        }
        localStorage.setItem('editor-disabled-plugins', JSON.stringify(disabled));
    }

    /**
     * Resets and dynamically re-activates all plugins using cache-busting queries.
     */
    async reloadAllPlugins() {
        printToTerminal('[System] Initiating hot-reload sequence...', 'system');

        // Cache active IDE ID before clearing the workspace registry (Added Fix)
        const cachedActiveIdeId = api.workspace.activeIdeId;

        // 1. Teardown active dynamic toolbar elements and greetings
        const ideToolbarContainer = document.getElementById('ide-toolbar-container');
        if (ideToolbarContainer) ideToolbarContainer.innerHTML = '';
        const welcomeOverlay = document.getElementById('ide-welcome-overlay');
        if (welcomeOverlay) welcomeOverlay.style.display = 'none';

        // 2. Tear down in-memory API registries
        api.workspace.clear();
        api.themes.clear();
        api.icons.clear();
        api.languages.clear();
        api.views.clear(); // This clears the registry including 'plugins-manager'
        api.events.clear(); // Drop stale plugin event subscriptions before re-activation
        await api.terminal.resetRunners();

        // 3. Immediately re-register the built-in Plugins Manager panel
        api.views.registerSidebarPanel('plugins-manager', {
            iconClass: 'fa-solid fa-puzzle-piece',
            title: 'Plugins',
            render: (container) => {
                renderPluginsManagerPanel(container);
            }
        });

        // Re-register the built-in Problems panel + status counter (views.clear() and
        // events.clear() above dropped its registration and diagnostics subscription).
        registerProblemsPanel(api);

        // 4. Re-initialize baseline standard configurations
        const themesModule = await import('./themes.js');
        themesModule.registerDefaultThemes();
        
        const iconsModule = await import('./icons.js');
        iconsModule.registerDefaultIcons();
        
        const registryModule = await import('./prosense-db/registry.js');
        registryModule.registerCoreLanguages(api);

        // 5. Scan disk directories and re-activate with cache-busting query strings
        printToTerminal('[System] Re-scanning workspace plugin directories...', 'system');
        const scanned = await this.scan();
        await this._activatePlugins(scanned, true);

        // 6. Redraw application layout selectors
        const themeSelector = document.getElementById('theme-selector');
        const iconSelector = document.getElementById('icon-selector');

        themesModule.renderThemeSelector(themeSelector);
        iconsModule.renderIconSelector(iconSelector);

        // Re-apply style parameters
        const activeTheme = localStorage.getItem('editor-theme-preset') || 'vs-dark';
        themesModule.applyTheme(activeTheme);

        // Refresh dynamically contributed views
        if (typeof window.renderDynamicSidebarPanels === 'function') window.renderDynamicSidebarPanels();
        if (typeof window.renderDynamicSettings === 'function') window.renderDynamicSettings();
        if (typeof window.renderDynamicBottomTabs === 'function') window.renderDynamicBottomTabs();
        if (typeof window.renderDynamicStatusItems === 'function') window.renderDynamicStatusItems();
        if (typeof window.renderIdeSelector === 'function') window.renderIdeSelector();

        // Restore active IDE if it exists
        const savedActiveIdeId = api.workspace.ides.has(cachedActiveIdeId) ? cachedActiveIdeId : null;
        if (savedActiveIdeId) {
            window.switchWorkspaceIDE(savedActiveIdeId);
        } else {
            window.switchWorkspaceIDE('default');
        }

        // 7. Safely restore open sidebar layout view state with no visual disruption
        const savedViewId = window.currentActiveView;
        if (savedViewId && savedViewId !== 'explorer') {
            const activePanel = api.views.sidebarPanels.get(savedViewId);
            if (activePanel) {
                const fileTree = document.getElementById('file-tree');
                const pluginContent = document.getElementById('sidebar-plugin-content');
                const sidebarTitle = document.getElementById('sidebar-title');
                
                document.querySelectorAll('.activity-icon').forEach(btn => btn.classList.remove('active'));
                const btn = document.getElementById(`act-btn-${savedViewId}`);
                if (btn) btn.classList.add('active');
                
                if (fileTree) fileTree.style.display = 'none';
                if (pluginContent) {
                    pluginContent.style.display = 'block';
                    pluginContent.innerHTML = '';
                    activePanel.render(pluginContent);
                }
                if (sidebarTitle) sidebarTitle.textContent = activePanel.title.toUpperCase();
            }
        }

        printToTerminal('[System] Hot-reload complete! All live edits successfully synchronized.', 'system');
    }

    async validateAndRegister(scannedPlugins) {
        if (scannedPlugins.length === 0) {
            this.plugins = [];
            this.allPlugins = [];
            printToTerminal('[System] No custom extensions or IDEs discovered.', 'system');
            return;
        }
        await this._activatePlugins(scannedPlugins, false);
    }

    /**
     * Shared validation + activation pipeline used by both the initial boot pass and the
     * live hot-reload pass. Resolves IDE ↔ extension dependencies, force-activates required
     * and bundled extensions, blocks IDEs with unmet dependencies, then imports entry scripts.
     */
    async _activatePlugins(scanned, reload) {
        this.plugins = [];
        this.allPlugins = [];
        const disabledIds = this.getDisabledPluginIds();
        const ctx = this._buildDependencyContext(scanned, disabledIds);

        for (const plugin of scanned) {
            const entry = { ...plugin, status: 'active', errorMessage: '' };

            if (plugin.error) {
                entry.status = 'error';
                entry.errorMessage = plugin.error;
                this.allPlugins.push(entry);
                printToTerminal(`[Plugin Warning] Skipping "${plugin._dirName}": ${plugin.error}`, 'system');
                continue;
            }

            const { id, name, version, apiVersion, type, main } = plugin;

            if (!id || !name || !version || !apiVersion || !type) {
                entry.status = 'invalid';
                entry.errorMessage = 'Missing required package.json fields';
                this.allPlugins.push(entry);
                printToTerminal(`[Plugin Warning] Skipping "${plugin._dirName}": Missing metadata.`, 'system');
                continue;
            }

            if (!this.isCompatible(apiVersion)) {
                entry.status = 'incompatible';
                entry.errorMessage = `Requires API version ${apiVersion}. Host runs ${CORE_API_VERSION}`;
                this.allPlugins.push(entry);
                printToTerminal(`[Plugin Error] "${name}" requires API version ${apiVersion}.`, 'system');
                continue;
            }

            // --- Dependency-aware gating -------------------------------------------------
            // 1. IDEs are blocked when any declared extension dependency is absent on disk.
            if (type === 'ide' && ctx.missingDeps.has(id)) {
                entry.status = 'error';
                entry.errorMessage = `Missing extension dependency: ${ctx.missingDeps.get(id).join(', ')}`;
                this.allPlugins.push(entry);
                printToTerminal(`[Plugin Error] IDE "${name}" is missing dependencies: ${ctx.missingDeps.get(id).join(', ')}.`, 'system');
                continue;
            }

            // 2. Annotate the extension's relationship to any IDEs for the manager UI.
            const requiredByNames = type === 'extension' ? (ctx.requiredBy.get(id) || []) : [];
            entry.requiredBy = requiredByNames;
            if (plugin._bundledBy) {
                entry.bundledBy = plugin._bundledBy;
                entry.bundledByName = plugin._bundledByName;
            }
            const ownerActive = plugin._bundledBy ? ctx.enabledIdeIds.has(plugin._bundledBy) : true;
            const isRequired = requiredByNames.length > 0;

            // 3. A bundled extension whose host IDE is disabled stays dormant with it.
            if (plugin._bundledBy && !ownerActive) {
                entry.status = 'disabled';
                entry.errorMessage = `Bundled by "${plugin._bundledByName || plugin._bundledBy}" (IDE disabled)`;
                this.allPlugins.push(entry);
                continue;
            }

            // 4. Honor the user's manual disable — unless an active IDE hard-requires it.
            if (disabledIds.includes(id) && !isRequired && !plugin._bundledBy) {
                entry.status = 'disabled';
                this.allPlugins.push(entry);
                printToTerminal(`[System] Plugin "${name}" is disabled. Skipping activation.`, 'system');
                continue;
            }
            if (disabledIds.includes(id) && isRequired) {
                entry.forcedByDependency = true;
                printToTerminal(`[System] Extension "${name}" force-enabled: required by ${requiredByNames.join(', ')}.`, 'system');
            }

            this.plugins.push(plugin);
            this.allPlugins.push(entry);
            printToTerminal(`[System] Discovered and validated ${type}: ${name} [v${version}]`, 'system');

            if (main) {
                const entryUrl = reload
                    ? `../${plugin._relativePath}/${main}?t=${Date.now()}`
                    : `../${plugin._relativePath}/${main}`;
                // Snapshot registered IDE ids so we can stamp the shipped icon onto any
                // IDE this plugin registers during activation (the config the plugin passes
                // to registerIDE has no knowledge of the scan-time icon path).
                const ideIdsBefore = type === 'ide' ? new Set(api.workspace.ides.keys()) : null;
                try {
                    const module = await import(entryUrl);
                    if (typeof module.activate === 'function') {
                        module.activate(api);
                        if (type === 'ide') {
                            api.workspace.ides.forEach((cfg, ideId) => {
                                if (cfg && !ideIdsBefore.has(ideId) && !cfg._iconPath) {
                                    cfg._iconPath = plugin._iconPath || null;
                                }
                            });
                        }
                        printToTerminal(`[System] ${reload ? 'Re-activated' : 'Activated'} plugin: ${name}`, 'system');
                    } else {
                        entry.status = 'warning';
                        entry.errorMessage = 'Active entry script does not export an activate() function';
                        printToTerminal(`[Plugin Warning] "${name}" does not export an "activate" function.`, 'system');
                    }
                } catch (err) {
                    entry.status = 'error';
                    entry.errorMessage = err.message;
                    printToTerminal(`[Plugin Error] Failed to activate "${name}": ${err.message}`, 'system');
                    console.error(err);
                }
            }
        }

        printToTerminal(`[System] Scanning complete. Discovered ${this.plugins.length} active plugin(s).`, 'system');
    }

    isCompatible(pluginApiVersion) {
        const coreParts = CORE_API_VERSION.split('.');
        const pluginParts = pluginApiVersion.split('.');
        return coreParts[0] === pluginParts[0];
    }

    getPlugins() {
        return this.plugins;
    }
}

export const pluginManager = new PluginManager();

/**
 * Programmatic Plugins Panel HTML Renderer with Hot-Reload Controls
 */
export function renderPluginsManagerPanel(container) {
    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '14px';
    wrapper.style.fontFamily = 'var(--font-ui)';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.borderBottom = '1px solid var(--border-color)';
    header.style.paddingBottom = '8px';

    const title = document.createElement('span');
    title.textContent = 'PLUGINS MANAGER';
    title.style.fontSize = '11px';
    title.style.fontWeight = '600';
    title.style.letterSpacing = '0.8px';
    title.style.color = 'var(--text-muted)';
    header.appendChild(title);

    const headerBtns = document.createElement('div');
    headerBtns.style.display = 'flex';
    headerBtns.style.gap = '6px';

    // 1. Dynamic Hot-Reload Controller Trigger (With Added Exception Safeguards)
    const reloadBtn = document.createElement('button');
    reloadBtn.id = 'plugin-reload-btn';
    reloadBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Reload';
    reloadBtn.style.padding = '3px 8px';
    reloadBtn.style.fontSize = '10px';
    reloadBtn.style.cursor = 'pointer';
    reloadBtn.style.background = 'var(--bg-button)';
    reloadBtn.style.color = 'var(--text-main)';
    reloadBtn.style.border = '1px solid var(--border-color)';
    reloadBtn.style.borderRadius = '4px';
    
    reloadBtn.addEventListener('click', async () => {
        reloadBtn.disabled = true;
        reloadBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i> Reloading...';
        try {
            await pluginManager.reloadAllPlugins();
        } catch (err) {
            console.error('[System Error] Hot-reload failed:', err);
        } finally {
            // Guarantee layout status restoration even if DOM transitions race
            reloadBtn.disabled = false;
            reloadBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Reload';
        }
    });
    headerBtns.appendChild(reloadBtn);

    // 2. Hard Application Restart Trigger
    const restartBtn = document.createElement('button');
    restartBtn.id = 'plugin-restart-btn';
    restartBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Restart';
    restartBtn.style.padding = '3px 8px';
    restartBtn.style.fontSize = '10px';
    restartBtn.style.display = 'none'; 
    restartBtn.style.borderRadius = '4px';
    
    restartBtn.addEventListener('click', () => {
        const isElectron = typeof window !== 'undefined' && window.process && window.process.type;
        if (isElectron) {
            window.require('electron').ipcRenderer.invoke('relaunch-app');
        } else {
            window.location.reload();
        }
    });
    headerBtns.appendChild(restartBtn);

    header.appendChild(headerBtns);
    wrapper.appendChild(header);

    const listContainer = document.createElement('div');
    listContainer.style.display = 'flex';
    listContainer.style.flexDirection = 'column';
    listContainer.style.gap = '10px';

    const allScanned = pluginManager.allPlugins;

    if (allScanned.length === 0) {
        const empty = document.createElement('div');
        empty.style.color = 'var(--text-muted)';
        empty.style.fontSize = '12px';
        empty.style.textAlign = 'center';
        empty.style.padding = '24px 0';
        empty.textContent = 'No plugins discovered inside custom/ directories.';
        listContainer.appendChild(empty);
    } else {
        allScanned.forEach(plugin => {
            const card = document.createElement('div');
            card.style.background = 'var(--bg-darker)';
            card.style.border = '1px solid var(--border-color)';
            card.style.borderRadius = '6px';
            card.style.padding = '10px';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.gap = '6px';

            const topRow = document.createElement('div');
            topRow.style.display = 'flex';
            topRow.style.justifyContent = 'space-between';
            topRow.style.alignItems = 'center';
            topRow.style.gap = '8px';

            const identity = document.createElement('div');
            identity.style.display = 'flex';
            identity.style.alignItems = 'center';
            identity.style.gap = '9px';
            identity.style.minWidth = '0';

            // Plugin icon — the plugin's shipped glyph, or a type-based placeholder fallback.
            const iconImg = document.createElement('img');
            iconImg.className = 'plugin-card-icon';
            iconImg.alt = '';
            iconImg.width = 48;  // Increased from 32
            iconImg.height = 48; // Increased from 32
            const placeholder = `assets/placeholder-${plugin.type === 'ide' ? 'ide' : 'extension'}.svg`;
            iconImg.src = plugin._iconPath || placeholder;
            // Gracefully fall back to the placeholder if a shipped icon fails to decode.
            iconImg.addEventListener('error', () => {
                if (iconImg.src.indexOf(placeholder) === -1) iconImg.src = placeholder;
            });
            identity.appendChild(iconImg);

            const nameWrap = document.createElement('div');
            nameWrap.style.display = 'flex';
            nameWrap.style.flexDirection = 'column';
            nameWrap.style.minWidth = '0';

            const nameText = document.createElement('span');
            nameText.style.fontWeight = '600';
            nameText.style.fontSize = '12px';
            nameText.style.color = 'var(--text-main)';
            nameText.style.whiteSpace = 'nowrap';
            nameText.style.overflow = 'hidden';
            nameText.style.textOverflow = 'ellipsis';
            nameText.textContent = plugin.name || plugin._dirName;
            nameWrap.appendChild(nameText);

            if (plugin.id) {
                const idText = document.createElement('span');
                idText.style.fontSize = '9px';
                idText.style.color = 'var(--text-muted)';
                idText.textContent = plugin.id;
                nameWrap.appendChild(idText);
            }
            identity.appendChild(nameWrap);

            const verBadge = document.createElement('span');
            verBadge.style.fontSize = '10px';
            verBadge.style.color = 'var(--text-muted)';
            verBadge.style.background = 'rgba(125,125,125,0.1)';
            verBadge.style.padding = '1px 5px';
            verBadge.style.borderRadius = '3px';
            verBadge.style.flexShrink = '0';
            verBadge.textContent = plugin.version ? `v${plugin.version}` : 'N/A';

            topRow.appendChild(identity);
            topRow.appendChild(verBadge);
            card.appendChild(topRow);

            const descText = document.createElement('p');
            descText.style.fontSize = '11px';
            descText.style.color = 'var(--text-muted)';
            descText.style.margin = '0';
            descText.style.lineHeight = '1.4';
            descText.textContent = plugin.description || 'No description provided.';
            card.appendChild(descText);

            // Relationship chips: dependencies (IDE) / integrations (extension).
            const relChips = [];
            if (plugin.type === 'ide' && Array.isArray(plugin.extensionDependencies) && plugin.extensionDependencies.length) {
                relChips.push({ icon: 'fa-link', text: `Depends on: ${plugin.extensionDependencies.join(', ')}`, color: '#64b5f6' });
            }
            if (plugin.bundledByName || plugin.bundledBy) {
                relChips.push({ icon: 'fa-box-open', text: `Integrated in ${plugin.bundledByName || plugin.bundledBy}`, color: '#ba9bff' });
            }
            if (Array.isArray(plugin.requiredBy) && plugin.requiredBy.length) {
                relChips.push({ icon: 'fa-lock', text: `Required by ${plugin.requiredBy.join(', ')}`, color: '#ffb74d' });
            }
            if (relChips.length) {
                const relWrap = document.createElement('div');
                relWrap.style.display = 'flex';
                relWrap.style.flexWrap = 'wrap';
                relWrap.style.gap = '5px';
                relChips.forEach(chip => {
                    const c = document.createElement('span');
                    c.style.display = 'inline-flex';
                    c.style.alignItems = 'center';
                    c.style.gap = '4px';
                    c.style.fontSize = '9.5px';
                    c.style.color = chip.color;
                    c.style.background = 'rgba(125,125,125,0.12)';
                    c.style.padding = '2px 6px';
                    c.style.borderRadius = '10px';
                    c.innerHTML = `<i class="fa-solid ${chip.icon}" style="font-size:9px;"></i> ${chip.text}`;
                    relWrap.appendChild(c);
                });
                card.appendChild(relWrap);
            }

            const actionRow = document.createElement('div');
            actionRow.style.display = 'flex';
            actionRow.style.justifyContent = 'space-between';
            actionRow.style.alignItems = 'center';
            actionRow.style.marginTop = '4px';

            const statusBadge = document.createElement('span');
            statusBadge.style.fontSize = '10px';
            statusBadge.style.fontWeight = '500';
            statusBadge.style.padding = '1px 6px';
            statusBadge.style.borderRadius = '10px';

            let showButton = false;
            let buttonText = '';

            switch(plugin.status) {
                case 'active':
                    statusBadge.textContent = 'Active';
                    statusBadge.style.color = '#4caf50';
                    statusBadge.style.background = 'rgba(76,175,80,0.1)';
                    showButton = true;
                    buttonText = 'Disable';
                    break;
                case 'disabled':
                    statusBadge.textContent = 'Disabled';
                    statusBadge.style.color = 'var(--text-muted)';
                    statusBadge.style.background = 'rgba(125,125,125,0.15)';
                    showButton = true;
                    buttonText = 'Enable';
                    break;
                case 'incompatible':
                    statusBadge.textContent = 'Incompatible';
                    statusBadge.style.color = '#ff9800';
                    statusBadge.style.background = 'rgba(255,152,0,0.1)';
                    descText.innerHTML += `<div style="color:#ef5350; margin-top:4px; font-size:10px;">Error: ${plugin.errorMessage}</div>`;
                    break;
                case 'error':
                case 'invalid':
                    statusBadge.textContent = 'Error';
                    statusBadge.style.color = '#ef5350';
                    statusBadge.style.background = 'rgba(239,83,80,0.1)';
                    descText.innerHTML += `<div style="color:#ef5350; margin-top:4px; font-size:10px;">Error: ${plugin.errorMessage}</div>`;
                    break;
            }

            const badgeContainer = document.createElement('div');
            badgeContainer.style.display = 'flex';
            badgeContainer.style.alignItems = 'center';
            badgeContainer.style.gap = '6px';
            
            badgeContainer.appendChild(statusBadge);
            
            // Build type indicators
            const iconSpan = document.createElement('span');
            iconSpan.className = 'prosense-type-icon';
            iconSpan.innerHTML = `<i class="fa-solid ${plugin.type === 'ide' ? 'fa-laptop-code' : 'fa-puzzle-piece'}" style="font-size:10px; color:var(--accent-color);"></i>`;
            badgeContainer.appendChild(iconSpan);

            const typeText = document.createElement('span');
            typeText.style.fontSize = '9px';
            typeText.style.textTransform = 'uppercase';
            typeText.style.letterSpacing = '0.5px';
            typeText.style.color = 'var(--text-muted)';
            typeText.textContent = plugin.type || 'extension';
            badgeContainer.appendChild(typeText);

            // Added: Settings gear button on active extension cards
            if (plugin.status === 'active') {
                const configBtn = document.createElement('button');
                configBtn.className = 'plugin-settings-btn';
                configBtn.innerHTML = '<i class="fa-solid fa-gear"></i>';
                configBtn.style.padding = '2px 6px';
                configBtn.style.fontSize = '11px';
                configBtn.style.background = 'transparent';
                configBtn.style.border = 'none';
                configBtn.style.color = 'var(--text-muted)';
                configBtn.style.cursor = 'pointer';
                configBtn.title = 'Configure extension settings';

                configBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (typeof window.openPluginDetailsTab === 'function') {
                        window.openPluginDetailsTab(plugin);
                    }
                });
                badgeContainer.appendChild(configBtn);
            }
            
            actionRow.appendChild(badgeContainer);

            // An extension an active IDE integrates or hard-requires cannot be freely disabled:
            // the dependency owns its lifecycle, so surface a lock instead of a toggle.
            const dependencyLocked = plugin.type === 'extension' &&
                ((Array.isArray(plugin.requiredBy) && plugin.requiredBy.length > 0) || !!plugin.bundledBy);

            if (dependencyLocked) {
                const lock = document.createElement('span');
                lock.style.fontSize = '10px';
                lock.style.color = 'var(--text-muted)';
                lock.style.display = 'inline-flex';
                lock.style.alignItems = 'center';
                lock.style.gap = '5px';
                lock.title = plugin.bundledBy
                    ? 'Managed by its host IDE'
                    : 'Locked on while a dependent IDE is enabled';
                lock.innerHTML = `<i class="fa-solid fa-lock" style="font-size:9px;"></i> Managed`;
                actionRow.appendChild(lock);
            } else if (showButton && plugin.id) {
                const actionBtn = document.createElement('button');
                actionBtn.textContent = buttonText;
                actionBtn.style.padding = '2px 8px';
                actionBtn.style.fontSize = '11px';
                actionBtn.style.background = 'var(--bg-button)';
                actionBtn.style.color = 'var(--text-main)';
                actionBtn.style.border = '1px solid var(--border-color)';
                actionBtn.style.borderRadius = '3px';
                actionBtn.style.cursor = 'pointer';

                actionBtn.addEventListener('click', () => {
                    const shouldDisable = buttonText === 'Disable';
                    pluginManager.togglePluginState(plugin.id, shouldDisable);
                    const restartNeeded = document.getElementById('plugin-restart-btn');
                    if (restartNeeded) restartNeeded.style.display = 'inline-block';
                    
                    plugin.status = shouldDisable ? 'disabled' : 'active';
                    renderPluginsManagerPanel(container);
                });
                actionRow.appendChild(actionBtn);
            }

            card.appendChild(actionRow);
            listContainer.appendChild(card);
        });
    }
    
    wrapper.appendChild(listContainer);
    container.appendChild(wrapper);
}