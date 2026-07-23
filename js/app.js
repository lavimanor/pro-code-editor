import { api, ownership } from './api-core.js';
import { pluginManager } from './plugin-manager.js';
import {
    readDirectoryEntries, readFileContents, saveFileContents, verifyPermission,
    openDirectoryPicker, createDirectoryHandle, createFileHandle, removeEntryHandle,
    resolveHandle, renameEntryHandle, copyEntryHandle, entryExists, resolveAvailableName
} from './fs-handler.js';
import { renderFileTree, renderTabs } from './ui-handler.js';
import { showContextMenu, closeContextMenu, mergeContributedItems } from './context-menu.js';
import { renderThemeSelector, applyTheme } from './themes.js';
import { renderIconSelector } from './icons.js';
import { registerCoreLanguages } from './prosense-db/registry.js';
import { renderSyntaxHighlighting, highlightCodeToHTML } from './syntax.js';
import { initProSense, handleProSenseInput, handleProSenseKeydown, getWordBeforeCursor, hideProSense, triggerProSense, setProSenseLspProvider } from './prosense.js';
import { handleLineOperations } from './line-ops.js';
import * as folding from './folding.js';
import { initMinimapScroll } from './minimap.js';
import { getCustomSnippets, saveCustomSnippets, renderSnippetsList } from './snippets.js';
import { initTerminal, toggleTerminal, updateTerminalPrompt, printToTerminal, appendOutputChunk, setRunState } from './terminal.js';
import { initFindReplace } from './find.js';
import { registerProblemsPanel } from './problems.js';

// Application State Models
let rootDirectoryHandle = null;
let activeFileHandle = null;
let selectedHandle = null;
let selectedDirectoryContext = null;
let openTabs = [];
const dirtyFiles = new Set();
const expandedFolders = new Set();
let activeIconPack = localStorage.getItem('editor-icon-pack-preset') || 'material';
const tabContentsCache = new Map();

const settingsTabHandle = {
    name: 'Settings',
    path: 'virtual://settings',
    isSettings: true
};

// Electron IPC bridge
let ipcRenderer = null;

// Extensions the Run button supports
let runnableExts = new Set();

// Snapshot of the most recent tree render, so keyboard shortcuts can act on
// whatever the explorer currently has selected.
let lastRenderedEntries = [];

// Identify a file by its absolute path
const fileKey = (h) => (h && (h.path || h.name)) || '';

// Core Canvas Interface Elements Cache Maps
const btnOpenFolder = document.getElementById('btn-open-folder');
const btnSaveFile = document.getElementById('btn-save-file');
const btnNewFile = document.getElementById('btn-new-file');
const btnNewFolder = document.getElementById('btn-new-folder');
const fileTreeContainer = document.getElementById('file-tree');
const tabContainer = document.getElementById('tab-bar');
const editor = document.getElementById('editor');
const editorSurfaceBox = document.getElementById('editor-surface-box');
const filePathDisplay = document.getElementById('current-file-path');
const statusCursor = document.getElementById('status-cursor');
const statusLanguage = document.getElementById('status-language');

// Rendering Layout Containers
const lineGutter = document.getElementById('line-gutter');
const editorBackdrop = document.getElementById('editor-backdrop');
const minimapText = document.getElementById('minimap-text');
const minimapIndicator = document.getElementById('minimap-indicator');
const minimapGutter = document.getElementById('minimap-gutter');

// Activity Sidebar UI Modules
const sidebar = document.getElementById('sidebar');
const actExplorer = document.getElementById('act-explorer');
const actSettings = document.getElementById('act-settings');
const settingsPanel = document.getElementById('settings-panel');
const themeSelector = document.getElementById('theme-selector');
const iconSelector = document.getElementById('icon-selector');
const closeSettingsBtn = document.getElementById('close-settings-btn');

const bottomPanel = document.getElementById('bottom-panel');
const terminalOutput = document.getElementById('terminal-output');
const terminalInput = document.getElementById('terminal-input');
const terminalPrompt = document.getElementById('terminal-prompt');

// Web Server Trigger Buttons
const btnGoLive = document.getElementById('btn-go-live');
let serverActiveUrl = null;

// Run Code Trigger Buttons
const btnRunCode = document.getElementById('btn-run-code');

// Toggle Autocomplete Element
const prosenseToggle = document.getElementById('prosense-toggle');

window.convertSelectToCustom = function(selectEl, getIconHTMLFn = null) {
    // Prevent double-binding if already converted
    if (!selectEl || selectEl.style.display === 'none' || selectEl.nextElementSibling?.classList.contains('custom-dropdown-container')) {
        return;
    }

    const container = document.createElement('div');
    container.className = 'custom-dropdown-container';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'custom-dropdown-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');

    const labelWrap = document.createElement('div');
    labelWrap.className = 'custom-dropdown-label-wrap';

    const label = document.createElement('span');
    label.className = 'custom-dropdown-label';
    labelWrap.appendChild(label);
    trigger.appendChild(labelWrap);

    const chevron = document.createElement('i');
    chevron.className = 'fa-solid fa-chevron-down custom-dropdown-chevron';
    trigger.appendChild(chevron);

    const menu = document.createElement('div');
    menu.className = 'custom-dropdown-menu';
    menu.setAttribute('role', 'listbox');

    container.appendChild(trigger);
    container.appendChild(menu);

    // Hide native select element and insert our custom markup
    selectEl.style.display = 'none';
    selectEl.parentNode.insertBefore(container, selectEl.nextSibling);

    const updateTrigger = () => {
        const selectedOpt = selectEl.options[selectEl.selectedIndex];
        if (!selectedOpt) return;

        // Clear old icon
        const existingIcon = labelWrap.querySelector('.custom-dropdown-icon');
        if (existingIcon) existingIcon.remove();

        if (typeof getIconHTMLFn === 'function') {
            const iconHTML = getIconHTMLFn(selectedOpt.value, selectedOpt.text);
            if (iconHTML) {
                const temp = document.createElement('span');
                temp.className = 'custom-dropdown-icon';
                temp.innerHTML = iconHTML;
                labelWrap.insertBefore(temp, label);
            }
        }
        label.textContent = selectedOpt.text;
    };

    const renderMenu = () => {
        menu.innerHTML = '';
        Array.from(selectEl.options).forEach((opt, idx) => {
            const item = document.createElement('div');
            item.className = 'custom-dropdown-option' + (idx === selectEl.selectedIndex ? ' active' : '');
            item.setAttribute('role', 'option');
            item.setAttribute('aria-selected', String(idx === selectEl.selectedIndex));

            if (typeof getIconHTMLFn === 'function') {
                const iconHTML = getIconHTMLFn(opt.value, opt.text);
                if (iconHTML) {
                    const temp = document.createElement('span');
                    temp.className = 'custom-dropdown-icon';
                    temp.innerHTML = iconHTML;
                    item.appendChild(temp);
                }
            }

            const span = document.createElement('span');
            span.textContent = opt.text;
            item.appendChild(span);

            item.addEventListener('click', () => {
                selectEl.selectedIndex = idx;
                selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                updateTrigger();
                closeMenu();
            });

            menu.appendChild(item);
        });
    };

    const closeMenu = () => {
        container.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
    };

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const willOpen = !container.classList.contains('open');
        // Close all other open custom dropdowns first
        document.querySelectorAll('.custom-dropdown-container.open').forEach(el => {
            if (el !== container) el.classList.remove('open');
        });
        container.classList.toggle('open', willOpen);
        trigger.setAttribute('aria-expanded', String(willOpen));
        if (willOpen) renderMenu();
    });

    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) closeMenu();
    });

    selectEl.addEventListener('change', updateTrigger);
    updateTrigger();
};

/**
 * Sidebar Panel Switching Engine
 */
let currentActiveView = 'explorer';
window.currentActiveView = currentActiveView;

function switchSidebarView(viewId, panelConfig = null) {
    const fileTree = document.getElementById('file-tree');
    const pluginContent = document.getElementById('sidebar-plugin-content');
    const sidebarTitle = document.getElementById('sidebar-title');

    // Deselect all active classes
    document.querySelectorAll('.activity-icon').forEach(btn => btn.classList.remove('active'));

    if (viewId === 'explorer') {
        actExplorer.classList.add('active');
        if (fileTree) fileTree.style.display = 'block';
        if (pluginContent) pluginContent.style.display = 'none';
        if (sidebarTitle) sidebarTitle.textContent = 'EXPLORER';
        
        if (currentActiveView === 'explorer') {
            sidebar.classList.toggle('collapsed-bar');
        } else {
            sidebar.classList.remove('collapsed-bar');
        }
        currentActiveView = 'explorer';
        window.currentActiveView = 'explorer';
    } else if (panelConfig) {
        const btn = document.getElementById(`act-btn-${viewId}`);
        if (btn) btn.classList.add('active');
        
        if (fileTree) fileTree.style.display = 'none';
        if (pluginContent) {
            pluginContent.style.display = 'block';
            pluginContent.innerHTML = '';
            try {
                panelConfig.render(pluginContent);
            } catch (err) {
                pluginContent.innerHTML = `<div style="padding:16px; color:#ef5350;">Error rendering view: ${err.message}</div>`;
            }
        }
        if (sidebarTitle) sidebarTitle.textContent = panelConfig.title.toUpperCase();

        if (currentActiveView === viewId) {
            sidebar.classList.toggle('collapsed-bar');
        } else {
            sidebar.classList.remove('collapsed-bar');
        }
        currentActiveView = viewId;
        window.currentActiveView = viewId;
    }
}

/**
 * IDE Custom Splash / Welcome Page Overlay Renderer
 */
function showWelcomePage(contentHtml) {
    let welcome = document.getElementById('ide-welcome-overlay');
    if (!welcome) {
        welcome = document.createElement('div');
        welcome.id = 'ide-welcome-overlay';
        welcome.style.position = 'absolute';
        welcome.style.inset = '0';
        welcome.style.background = 'var(--bg-dark)';
        welcome.style.color = 'var(--text-main)';
        welcome.style.display = 'flex';
        welcome.style.flexDirection = 'column';
        welcome.style.alignItems = 'center';
        welcome.style.justifyContent = 'center';
        welcome.style.padding = '32px';
        welcome.style.zIndex = '10';
        welcome.style.overflowY = 'auto';
        editorSurfaceBox.appendChild(welcome);
    }
    welcome.innerHTML = contentHtml;
    welcome.style.display = 'flex';
}

function hideWelcomePage() {
    const welcome = document.getElementById('ide-welcome-overlay');
    if (welcome) {
        welcome.style.display = 'none';
    }
}

/**
 * Dynamically renders the IDE selector dropdown inside the top bar.
 *
 * Implemented as a custom (non-native) dropdown so each option can display the
 * environment's SVG icon alongside its name — the "Normal Editor" entry falls back
 * to the application icon, and IDEs use the glyph shipped in their plugin folder.
 */
window.renderIdeSelector = () => {
    const titleLeft = document.querySelector('.window-title-left');
    if (!titleLeft) return;

    const IDE_PLACEHOLDER = 'assets/placeholder-ide.svg';
    const APP_ICON = 'icon.png';

    // Resolve the icon path for a given selector value.
    const iconFor = (value) => {
        if (value === 'default') return APP_ICON;
        const cfg = api.workspace.ides.get(value);
        return (cfg && cfg._iconPath) || IDE_PLACEHOLDER;
    };

    // Small helper: an <img> that gracefully degrades to the IDE placeholder.
    const makeIcon = (src, size) => {
        const img = document.createElement('img');
        img.className = 'ide-selector-icon';
        img.alt = '';
        img.width = size;
        img.height = size;
        img.src = src;
        img.addEventListener('error', () => {
            if (img.src.indexOf(IDE_PLACEHOLDER) === -1) img.src = IDE_PLACEHOLDER;
        });
        return img;
    };

    let selector = document.getElementById('ide-selector');
    if (!selector) {
        selector = document.createElement('div');
        selector.id = 'ide-selector';
        selector.className = 'ide-selector';

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'ide-selector-trigger';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');

        const menu = document.createElement('div');
        menu.className = 'ide-selector-menu';
        menu.setAttribute('role', 'listbox');

        selector.appendChild(trigger);
        selector.appendChild(menu);
        titleLeft.appendChild(selector);

        const closeMenu = () => {
            selector.classList.remove('open');
            trigger.setAttribute('aria-expanded', 'false');
        };
        const onDocClick = (e) => { if (!selector.contains(e.target)) closeMenu(); };

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const willOpen = !selector.classList.contains('open');
            selector.classList.toggle('open', willOpen);
            trigger.setAttribute('aria-expanded', String(willOpen));
        });
        document.addEventListener('click', onDocClick);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

        selector._closeMenu = closeMenu;
    }

    const ides = api.workspace.ides;
    if (ides.size === 0) {
        selector.style.display = 'none';
        return;
    }

    const trigger = selector.querySelector('.ide-selector-trigger');
    const menu = selector.querySelector('.ide-selector-menu');

    // Build the ordered option list: Normal Editor first, then every registered IDE.
    const options = [{ value: 'default', name: 'Normal Editor' }];
    ides.forEach((config, id) => options.push({ value: id, name: config.name }));

    const activeValue = api.workspace.activeIdeId || 'default';

    // Render the trigger to reflect the current selection.
    const activeOption = options.find(o => o.value === activeValue) || options[0];
    trigger.innerHTML = '';
    trigger.appendChild(makeIcon(iconFor(activeOption.value), 20)); // Increased from 16
    const label = document.createElement('span');
    label.className = 'ide-selector-label';
    label.textContent = activeOption.name;
    trigger.appendChild(label);
    const chevron = document.createElement('i');
    chevron.className = 'fa-solid fa-chevron-down ide-selector-chevron';
    trigger.appendChild(chevron);

    // Render the option menu.
    menu.innerHTML = '';
    options.forEach(opt => {
        const item = document.createElement('div');
        item.className = 'ide-selector-option' + (opt.value === activeValue ? ' active' : '');
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', String(opt.value === activeValue));
        item.appendChild(makeIcon(iconFor(opt.value), 22)); // Increased from 18
        const optLabel = document.createElement('span');
        optLabel.textContent = opt.name;
        item.appendChild(optLabel);
        item.addEventListener('click', async () => {
            if (selector._closeMenu) selector._closeMenu();
            if (opt.value !== (api.workspace.activeIdeId || 'default')) {
                await window.switchWorkspaceIDE(opt.value);
                window.renderIdeSelector();
            }
        });
        menu.appendChild(item);
    });

    selector.style.display = 'inline-block';
};

/**
 * Re-evaluates every dynamically contributed surface against the current IDE selection.
 *
 * Contributions are scoped by ownership: anything registered by an IDE plugin (or by an
 * extension that IDE bundles) is only live while that IDE is selected. Switching
 * workspaces therefore has to repaint each surface rather than merely swapping toolbars.
 */
async function syncContributedSurfaces() {
    window.renderDynamicSidebarPanels();
    window.renderDynamicSettings();
    window.renderDynamicBottomTabs();
    window.renderDynamicStatusItems();
    window.renderDynamicRightPanels();
    window.renderDiagnosticStyleSelector();

    // A theme or icon pack shipped by an IDE disappears with it — fall back to a
    // built-in so the editor never renders against a missing palette.
    renderThemeSelector(themeSelector);
    const currentTheme = localStorage.getItem('editor-theme-preset') || 'vs-dark';
    if (!api.themes.isAvailable(currentTheme)) {
        applyTheme('vs-dark');
        themeSelector.value = 'vs-dark';
        localStorage.setItem('editor-theme-preset', 'vs-dark');
    } else {
        themeSelector.value = currentTheme;
    }

    renderIconSelector(iconSelector);
    if (!api.icons.isAvailable(activeIconPack)) {
        activeIconPack = 'material';
        localStorage.setItem('editor-icon-pack-preset', 'material');
    }
    iconSelector.value = activeIconPack;

    // If the open sidebar view belonged to the IDE we just left, fall back to the explorer.
    if (window.currentActiveView && window.currentActiveView !== 'explorer'
        && !api.views.activeSidebarPanels().has(window.currentActiveView)) {
        switchSidebarView('explorer', null);
    }

    // Run configurations and language servers are process-level; re-sync them so an
    // inactive IDE's runners and servers stop applying.
    api.languages.stopInactiveLspClients();
    await api.terminal.syncActiveRunners();

    await refreshExplorer();
    runLayoutRenderEngine();
}

/**
 * Builds the workspace context handed to an IDE's onActivate hook.
 *
 * Everything registered through this context is tracked as a disposable, so leaving the
 * IDE tears down exactly what it added — no residue in the other workspaces.
 */
function buildIdeContext(ideId, ideConfig, disposables) {
    const ideToolbarContainer = document.getElementById('ide-toolbar-container');
    const isElectronApp = typeof window !== 'undefined' && window.process && window.process.type;
    const storagePrefix = `ide-storage-${ideId}-`;

    const fsNode = isElectronApp ? window.require('fs') : null;
    const pathNode = isElectronApp ? window.require('path') : null;

    const context = {
        /** The id this IDE was registered under. */
        id: ideId,

        /** Escape hatch: the full editor API, for anything the context doesn't wrap. */
        api,

        /** Registers a teardown callback run when the user leaves this IDE. */
        onDispose: (fn) => {
            if (typeof fn === 'function') disposables.push(fn);
        },

        addToolbarButton: (id, label, iconClass, onClick) => {
            const btn = document.createElement('button');
            btn.id = `ide-btn-${id}`;
            btn.className = 'ide-toolbar-button';
            btn.style.background = 'var(--bg-button)';
            btn.style.color = 'var(--text-main)';
            btn.style.border = '1px solid var(--border-color)';
            btn.style.padding = '4px 10px';
            btn.style.borderRadius = '4px';
            btn.style.fontSize = '12px';
            btn.style.display = 'inline-flex';
            btn.style.alignItems = 'center';
            btn.style.gap = '6px';
            btn.style.cursor = 'pointer';
            btn.innerHTML = `<i class="${iconClass}"></i> ${label}`;
            btn.addEventListener('click', onClick);

            if (ideToolbarContainer) {
                ideToolbarContainer.appendChild(btn);
            }
            // Returned so the IDE can mutate its own controls (label, disabled, badge…).
            return btn;
        },

        /** Vertical rule between groups of toolbar controls. */
        addToolbarSeparator: () => {
            if (!ideToolbarContainer) return null;
            const sep = document.createElement('span');
            sep.className = 'ide-toolbar-separator';
            ideToolbarContainer.appendChild(sep);
            return sep;
        },

        showWelcome: (html) => showWelcomePage(html),
        hideWelcome: () => hideWelcomePage(),
        openFile: async (fileHandle) => {
            if (fileHandle) {
                await handleOpenFile(fileHandle);
            }
        },
        showCustomModal: (config) => showCustomModal(config),

        copyTemplateFolder: async (templateFolderName) => {
            if (!isElectronApp || !ipcRenderer) {
                alert('Template replication is only supported inside the Desktop Shell environment.');
                return false;
            }
            if (!rootDirectoryHandle) {
                alert('Please open a folder workspace first.');
                return false;
            }

            printToTerminal(`[System] Replicating template directory structure: "${templateFolderName}"...`, 'system');
            try {
                const res = await ipcRenderer.invoke('copy-ide-template', ideId, templateFolderName, rootDirectoryHandle.path);
                if (res && res.success) {
                    printToTerminal('[System] Predefined folder structures copied successfully.', 'system');
                    await refreshExplorer();
                    return true;
                } else {
                    const errMsg = res ? res.error : 'Unknown replication error';
                    printToTerminal(`[System Error] Failed to replicate structures: ${errMsg}`, 'system');
                    return false;
                }
            } catch (err) {
                printToTerminal(`[System Error] Template copy request aborted: ${err.message}`, 'system');
                return false;
            }
        },

        /**
         * Project Structure Generator:
         * Generates complete template layouts (folders, nesting, index files)
         * recursively under the opened workspace directory handle.
         */
        createProjectStructure: async (structure) => {
            if (!rootDirectoryHandle) {
                alert('Please open a folder workspace first.');
                return { success: false, files: {} };
            }

            printToTerminal('[System] Generating project template directory structures...', 'system');
            const createdFiles = {};
            try {
                // 1. Generate folder architectures recursively
                if (structure.folders) {
                    for (const folder of structure.folders) {
                        const segments = folder.split('/');
                        let currentDir = rootDirectoryHandle;
                        for (const segment of segments) {
                            if (segment) {
                                currentDir = await createDirectoryHandle(currentDir, segment);
                            }
                        }
                    }
                }

                // 2. Generate and write nested index templates
                if (structure.files) {
                    for (const [filePath, contents] of Object.entries(structure.files)) {
                        const segments = filePath.split('/');
                        const fileName = segments.pop();

                        let currentDir = rootDirectoryHandle;
                        for (const segment of segments) {
                            if (segment) {
                                currentDir = await createDirectoryHandle(currentDir, segment);
                            }
                        }

                        const newFileHandle = await createFileHandle(currentDir, fileName);
                        await saveFileContents(newFileHandle, contents);
                        createdFiles[filePath] = newFileHandle;
                    }
                }

                printToTerminal('[System] Project structure generated successfully!', 'system');

                // Refresh folder tree visualization on creation completion
                await refreshExplorer();

                return { success: true, files: createdFiles };
            } catch (err) {
                printToTerminal(`[System Error] Failed to generate project architecture: ${err.message}`, 'system');
                console.error(err);
                return { success: false, files: {} };
            }
        },

        // =============================================================
        //  Contributed UI — all torn down automatically on deactivate
        // =============================================================

        /** Adds an icon + panel to the activity bar. Config: { iconClass, title, render(el) }. */
        registerSidebarPanel: (id, config) => {
            api.views.registerSidebarPanel(id, config);
            disposables.push(() => api.views.unregisterSidebarPanel(id));
        },

        /** Adds a tab beside TERMINAL in the bottom dock. Config: { title, render(el) }. */
        registerBottomPanelTab: (id, config) => {
            api.views.registerBottomPanelTab(id, config);
            disposables.push(() => api.views.unregisterBottomPanelTab(id));
        },

        /** Adds a status bar widget. Config: { side, tooltip, onClick, render(el) | text }. */
        registerStatusBarItem: (id, config) => {
            api.views.registerStatusBarItem(id, config);
            disposables.push(() => api.views.unregisterStatusBarItem(id));
        },

        /**
         * Adds a tool window to the right-hand dock (IntelliJ-style). Gets its own toggle
         * button on the right activity bar. Config: { title, iconClass, render(el) }.
         */
        registerRightPanel: (id, config) => {
            api.views.registerRightPanel(id, config);
            disposables.push(() => api.views.unregisterRightPanel(id));
        },

        /** Adds a settings field to this IDE's Details page. */
        registerSetting: (id, config) => {
            api.views.registerSetting(id, { pluginId: ideId, ...config });
            disposables.push(() => api.views.unregisterSetting(id));
        },

        /** Adds an entry to the file explorer's right-click menu. */
        registerExplorerMenuItem: (id, config) => {
            api.menus.registerExplorerItem(id, config);
            disposables.push(() => api.menus.unregisterExplorerItem(id));
        },

        /** Adds an entry to the code editor's right-click menu. */
        registerEditorMenuItem: (id, config) => {
            api.menus.registerEditorItem(id, config);
            disposables.push(() => api.menus.unregisterEditorItem(id));
        },

        // =============================================================
        //  Language, theme and execution contributions
        // =============================================================

        registerLanguage: (langId, config) => api.languages.register(langId, config),
        registerHighlighter: (langId, rules) => api.languages.registerHighlighter(langId, rules),
        registerLspClient: (ext, command, args, initOptions, features) =>
            api.languages.registerLspClient(ext, command, args, initOptions, features),

        registerTheme: (id, config) => {
            api.themes.register(id, config);
            renderThemeSelector(themeSelector);
        },
        registerIconPack: (id, config) => {
            api.icons.register(id, config);
            renderIconSelector(iconSelector);
        },

        /** Contributes a run configuration for a file extension. */
        registerRunner: async (ext, runnerConfig) => {
            await api.terminal.registerRunner(ext, runnerConfig);
        },

        /** Injects a stylesheet scoped to this IDE's lifetime. */
        injectCSS: (css) => {
            const style = document.createElement('style');
            style.dataset.ideStyle = ideId;
            style.textContent = css;
            document.head.appendChild(style);
            disposables.push(() => style.remove());
            return style;
        },

        /**
         * Binds a keyboard shortcut, e.g. 'ctrl+shift+b'. Only fires while this IDE
         * is selected, and is unbound on deactivate.
         */
        registerKeybinding: (combo, handler) => {
            const parts = combo.toLowerCase().split('+').map(p => p.trim());
            const key = parts[parts.length - 1];
            const needsCtrl = parts.includes('ctrl') || parts.includes('cmd');
            const needsShift = parts.includes('shift');
            const needsAlt = parts.includes('alt');

            const listener = (e) => {
                if (e.key.toLowerCase() !== key) return;
                if (needsCtrl !== (e.ctrlKey || e.metaKey)) return;
                if (needsShift !== e.shiftKey) return;
                if (needsAlt !== e.altKey) return;
                e.preventDefault();
                try { handler(); } catch (err) { console.error(err); }
            };
            document.addEventListener('keydown', listener);
            disposables.push(() => document.removeEventListener('keydown', listener));
        },

        /** Subscribes to an editor event for this IDE's lifetime. */
        on: (event, callback) => {
            const off = api.events.on(event, callback);
            disposables.push(off);
            return off;
        },

        /** Broadcasts a custom event to any subscriber. */
        emit: (event, payload) => api.events.emit(event, payload),

        // =============================================================
        //  Workspace, filesystem and process access
        // =============================================================

        get workspace() {
            return {
                rootPath: rootDirectoryHandle ? rootDirectoryHandle.path : null,
                name: rootDirectoryHandle ? rootDirectoryHandle.name : null,
                isOpen: !!rootDirectoryHandle,
                handle: rootDirectoryHandle
            };
        },

        /** Direct workspace filesystem access (desktop shell only for path helpers). */
        fs: {
            readFile: async (relOrAbsPath) => {
                const target = resolveWorkspacePath(relOrAbsPath, pathNode);
                if (!target || !fsNode) return null;
                return fsNode.readFileSync(target, 'utf8');
            },
            writeFile: async (relOrAbsPath, contents) => {
                const target = resolveWorkspacePath(relOrAbsPath, pathNode);
                if (!target || !fsNode) return false;
                fsNode.mkdirSync(pathNode.dirname(target), { recursive: true });
                fsNode.writeFileSync(target, contents, 'utf8');
                await refreshExplorer();
                return true;
            },
            exists: (relOrAbsPath) => {
                const target = resolveWorkspacePath(relOrAbsPath, pathNode);
                return !!target && !!fsNode && fsNode.existsSync(target);
            },
            list: (relOrAbsPath = '.') => {
                const target = resolveWorkspacePath(relOrAbsPath, pathNode);
                if (!target || !fsNode || !fsNode.existsSync(target)) return [];
                return fsNode.readdirSync(target).map(name => ({
                    name,
                    path: pathNode.join(target, name),
                    kind: fsNode.statSync(pathNode.join(target, name)).isDirectory() ? 'directory' : 'file'
                }));
            },
            mkdir: async (relOrAbsPath) => {
                const target = resolveWorkspacePath(relOrAbsPath, pathNode);
                if (!target || !fsNode) return false;
                fsNode.mkdirSync(target, { recursive: true });
                await refreshExplorer();
                return true;
            },
            delete: async (relOrAbsPath) => {
                const target = resolveWorkspacePath(relOrAbsPath, pathNode);
                if (!target || !fsNode || !fsNode.existsSync(target)) return false;
                fsNode.rmSync(target, { recursive: true, force: true });
                await refreshExplorer();
                return true;
            },
            join: (...segments) => (pathNode ? pathNode.join(...segments) : segments.join('/'))
        },

        /**
         * Runs a shell command in the workspace directory.
         * Returns { success, output, code }. Output streams to the terminal by default.
         */
        runCommand: async (command, options = {}) => api.terminal.exec(command, options),

        /** Terminal surface controls. */
        terminal: {
            print: (text, type = 'system') => printToTerminal(text, type),
            show: () => {
                if (bottomPanel.classList.contains('hidden-panel')) toggleTerminal();
                window.switchBottomTab('terminal');
            },
            setDirectory: (dirPath) => updateTerminalPrompt(dirPath)
        },

        /** Live editor surface (text, selection, caret, diagnostics). */
        editor: api.editor,

        // =============================================================
        //  Persistence and user interaction
        // =============================================================

        /** Per-IDE persistent key/value store, namespaced so IDEs cannot collide. */
        storage: {
            get: (key, fallback = null) => {
                const raw = localStorage.getItem(storagePrefix + key);
                if (raw === null) return fallback;
                try { return JSON.parse(raw); } catch (e) { return raw; }
            },
            set: (key, value) => localStorage.setItem(storagePrefix + key, JSON.stringify(value)),
            remove: (key) => localStorage.removeItem(storagePrefix + key),
            keys: () => Object.keys(localStorage)
                .filter(k => k.startsWith(storagePrefix))
                .map(k => k.slice(storagePrefix.length))
        },

        /** Transient toast in the corner of the window. */
        notify: (message, type = 'info') => showToast(message, type),

        /** Themed single-field prompt. Resolves to the entered string, or null. */
        prompt: (title, placeholder = '') => showPrompt(title, placeholder),

        confirm: (message) => Promise.resolve(confirm(message)),

        /** Themed list picker. Resolves to the chosen value, or null. */
        quickPick: async (choices, config = {}) => {
            const options = choices.map(c => (typeof c === 'string' ? c : c.label));
            const result = await showCustomModal({
                title: config.title || 'Select an option',
                inputs: [{
                    id: 'choice',
                    label: config.label || '',
                    type: 'select',
                    options,
                    defaultValue: config.defaultValue || options[0]
                }],
                okLabel: config.okLabel || 'Select',
                cancelLabel: 'Cancel'
            });
            if (!result) return null;
            const picked = choices.find(c => (typeof c === 'string' ? c : c.label) === result.choice);
            return typeof picked === 'string' ? picked : (picked ? picked.value ?? picked.label : null);
        },

        /** Repaints the file explorer (after generating files outside the ctx helpers). */
        refreshExplorer: () => refreshExplorer()
    };

    return context;
}

/** Resolves a workspace-relative path against the open folder. */
function resolveWorkspacePath(inputPath, pathNode) {
    if (!inputPath) return null;
    if (!pathNode) return null;
    if (pathNode.isAbsolute(inputPath)) return inputPath;
    if (!rootDirectoryHandle || !rootDirectoryHandle.path) return null;
    return pathNode.join(rootDirectoryHandle.path, inputPath);
}

/**
 * Orchestrates seamless environment switching between installed IDEs.
 *
 * Leaving an IDE disposes everything it contributed during activation, and
 * `syncContributedSurfaces` re-evaluates the registries so contributions belonging to
 * plugins that ship *other* IDEs stop applying. The result: an IDE's functionality is
 * live only while it is the selected workspace.
 */
window.switchWorkspaceIDE = async (ideId) => {
    const ideToolbarContainer = document.getElementById('ide-toolbar-container');

    // 1. Deactivate the outgoing workspace and dispose everything it registered.
    const oldIde = api.workspace.getActiveIDE();
    if (oldIde) {
        if (typeof oldIde.onDeactivate === 'function') {
            try { oldIde.onDeactivate(); } catch (err) { console.error(err); }
        }
        if (Array.isArray(oldIde._disposables)) {
            oldIde._disposables.forEach(dispose => {
                try { dispose(); } catch (err) { console.error('[IDE] Teardown failed:', err); }
            });
            oldIde._disposables = [];
        }
    }

    // Flush workspace context elements
    if (ideToolbarContainer) ideToolbarContainer.innerHTML = '';
    hideWelcomePage();
    closeContextMenu();

    if (ideId === 'default' || !ideId) {
        api.workspace.activeIdeId = null;
        printToTerminal('[System] Switched to normal editor mode.', 'system');
        editor.placeholder = "// Select or create a file from the explorer to begin...";
        await syncContributedSurfaces();
        api.events.emit('ide-changed', { ideId: null, name: 'Normal Editor' });
        return;
    }

    const newIde = api.workspace.ides.get(ideId);
    if (!newIde) return;

    api.workspace.activeIdeId = ideId;
    printToTerminal(`[System] Switched to ${newIde.name} environment.`, 'system');

    // 2. Bring this IDE's contributions online before running its activation hook,
    //    so the hook observes a workspace that already reflects its own registrations.
    await syncContributedSurfaces();

    // 3. Run the activation hook under this plugin's ownership, so anything it
    //    registers is scoped to the IDE rather than leaking into the plain editor.
    const disposables = [];
    newIde._disposables = disposables;
    const context = buildIdeContext(ideId, newIde, disposables);

    if (typeof newIde.onActivate === 'function') {
        const pluginId = ownership.findPluginForIde(ideId);
        ownership.beginActivation({ pluginId: pluginId || ideId, type: 'ide', name: newIde.name });
        try {
            newIde.onActivate(context);
        } catch (err) {
            console.error(err);
            printToTerminal(`[System Error] IDE activation failed: ${err.message}`, 'system');
        } finally {
            ownership.endActivation();
        }
    }

    // Evaluate welcome overlay triggers
    if (openTabs.length === 0 && typeof newIde.getWelcomePageHTML === 'function') {
        showWelcomePage(newIde.getWelcomePageHTML());
    }

    api.events.emit('ide-changed', { ideId, name: newIde.name });
};

/**
 * Dynamically renders custom setting panels contributed by active plugins.
 */
window.renderDynamicSettings = () => {
    const settingsBody = document.querySelector('.settings-body');
    if (!settingsBody) return;

    document.querySelectorAll('.dynamic-setting-item').forEach(el => el.remove());

    api.views.activeCustomSettings().forEach((config, id) => {
        // Skip plugin-specific configurations so they only render on their own Details page
        if (config.pluginId) return;

        const div = document.createElement('div');
        div.className = 'setting-item dynamic-setting-item';

        const label = document.createElement('label');
        label.textContent = config.label;
        div.appendChild(label);

        const cacheKey = `setting-pref-${id}`;
        let currentValue = localStorage.getItem(cacheKey);
        if (currentValue === null) {
            currentValue = config.defaultValue;
        } else {
            if (config.type === 'checkbox') currentValue = (currentValue === 'true');
            else if (config.type === 'number') currentValue = Number(currentValue);
        }

        // (Inside window.renderDynamicSettings in js/app.js)
        let input;
        if (config.type === 'select') {
            input = document.createElement('select');
            (config.options || []).forEach(optVal => {
                const opt = document.createElement('option');
                opt.value = optVal;
                opt.textContent = optVal;
                if (optVal === currentValue) opt.selected = true;
                input.appendChild(opt);
            });
            // Convert to custom component once inserted into the DOM
            setTimeout(() => {
                window.convertSelectToCustom(input, () => '<i class="fa-solid fa-sliders" style="color: var(--accent-color);"></i>');
            }, 0);
        } else if (config.type === 'checkbox') {
            div.classList.add('flex-row');
            label.classList.add('flex-grow');
            input = document.createElement('input');
            input.type = 'checkbox';
            input.id = `setting-input-${id}`;
            input.checked = !!currentValue;
        } else {
            input = document.createElement('input');
            input.type = config.type || 'text';
            input.value = currentValue;
            input.style.background = 'var(--bg-dark)';
            input.style.border = '1px solid var(--border-color)';
            input.style.color = 'var(--text-main)';
            input.style.padding = '6px';
            input.style.borderRadius = '4px';
            input.style.outline = 'none';
        }

        try { config.onChange(currentValue); } catch(e) {}

        input.addEventListener('change', (e) => {
            let val = config.type === 'checkbox' ? e.target.checked : e.target.value;
            localStorage.setItem(cacheKey, val);
            try {
                config.onChange(val);
            } catch (err) {
                console.error(err);
            }
        });

        div.appendChild(input);

        const tip = settingsBody.querySelector('.shortcut-tip');
        if (tip) {
            settingsBody.insertBefore(div, tip);
        } else {
            settingsBody.appendChild(div);
        }
    });
};

/**
 * Generates options dynamically inside the Settings dialog based on custom registrations (Added Fix)
 */
window.renderDiagnosticStyleSelector = () => {
    const selector = document.getElementById('diagnostic-style-selector');
    if (!selector) return;

    selector.innerHTML = '';
    
    // Built-in styles
    const vscodeOpt = document.createElement('option');
    vscodeOpt.value = 'vscode';
    vscodeOpt.textContent = 'VS Code Style (Wavy)';
    selector.appendChild(vscodeOpt);

    const intellijOpt = document.createElement('option');
    intellijOpt.value = 'intellij';
    intellijOpt.textContent = 'IntelliJ Style (Solid/Dotted)';
    selector.appendChild(intellijOpt);

    // Dynamic style selections added via plugins
    api.views.activeDiagnosticStyles().forEach((config, id) => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = config.name || id;
        selector.appendChild(opt);
    });

    const savedStyle = localStorage.getItem('editor-diagnostic-style') || 'vscode';
    selector.value = savedStyle;
};

// Bind selection events inside the Settings panel
const diagnosticStyleSelector = document.getElementById('diagnostic-style-selector');
if (diagnosticStyleSelector) {
    diagnosticStyleSelector.addEventListener('change', (e) => {
        localStorage.setItem('editor-diagnostic-style', e.target.value);
        runLayoutRenderEngine(); // Repaint immediately on selection
    });
}

/**
 * Dynamically renders custom activity icons inside the Activity Bar.
 */
window.renderDynamicSidebarPanels = () => {
    const activityTop = document.querySelector('.activity-top');
    if (!activityTop) return;

    document.querySelectorAll('.dynamic-activity-icon').forEach(el => el.remove());

    api.views.activeSidebarPanels().forEach((config, id) => {
        const btn = document.createElement('button');
        btn.className = 'activity-icon dynamic-activity-icon';
        btn.id = `act-btn-${id}`;
        btn.title = config.title;
        btn.innerHTML = `<i class="${config.iconClass}"></i>`;

        btn.addEventListener('click', () => switchSidebarView(id, config));
        activityTop.appendChild(btn);
    });
};

/**
 * Bottom Dock Tab Engine:
 * The bottom panel hosts the built-in TERMINAL plus any plugin-registered tabs
 * (e.g. a Problems view). Each dynamic tab owns an isolated content container.
 */
let activeBottomTab = 'terminal';

function switchBottomTab(tabId) {
    activeBottomTab = tabId;

    document.querySelectorAll('#bottom-tab-strip .bottom-tab').forEach(btn => {
        btn.classList.toggle('active', btn.id === `bottom-tab-${tabId}`);
    });

    const terminalContainer = document.getElementById('terminal-container');
    if (terminalContainer) {
        terminalContainer.style.display = tabId === 'terminal' ? '' : 'none';
    }
    document.querySelectorAll('.dynamic-bottom-content').forEach(el => {
        el.style.display = el.id === `bottom-content-${tabId}` ? 'block' : 'none';
    });
}
window.switchBottomTab = switchBottomTab;

// Reveal the bottom dock (if collapsed) and focus the requested tab.
window.openBottomPanelTab = (tabId) => {
    if (bottomPanel.classList.contains('hidden-panel')) {
        toggleTerminal();
    }
    switchBottomTab(tabId);
};

window.renderDynamicBottomTabs = () => {
    const strip = document.getElementById('bottom-tab-strip');
    if (!strip) return;

    document.querySelectorAll('.dynamic-bottom-tab').forEach(el => el.remove());
    document.querySelectorAll('.dynamic-bottom-content').forEach(el => el.remove());

    const liveTabs = api.views.activeBottomPanelTabs();
    liveTabs.forEach((config, id) => {
        const btn = document.createElement('button');
        btn.className = 'bottom-tab dynamic-bottom-tab';
        btn.id = `bottom-tab-${id}`;
        btn.textContent = (config.title || id).toUpperCase();
        btn.addEventListener('click', () => switchBottomTab(id));
        strip.appendChild(btn);

        const content = document.createElement('div');
        content.className = 'dynamic-bottom-content';
        content.id = `bottom-content-${id}`;
        bottomPanel.appendChild(content);
        try {
            config.render(content);
        } catch (err) {
            content.innerHTML = `<div style="padding:12px; color:#ef5350;">Error rendering tab: ${err.message}</div>`;
        }
    });

    // Fall back to the terminal if the previously active tab is gone or belongs to an
    // IDE that is no longer selected.
    if (activeBottomTab !== 'terminal' && !liveTabs.has(activeBottomTab)) {
        activeBottomTab = 'terminal';
    }
    switchBottomTab(activeBottomTab);
};

/**
 * Dynamically renders plugin-contributed widgets into the status bar.
 */
window.renderDynamicStatusItems = () => {
    document.querySelectorAll('.dynamic-status-item').forEach(el => el.remove());

    api.views.activeStatusBarItems().forEach((config, id) => {
        const container = document.querySelector(config.side === 'left' ? '.status-left' : '.status-right');
        if (!container) return;

        const item = document.createElement('span');
        item.className = 'dynamic-status-item' + (config.onClick ? ' status-clickable' : '');
        item.id = `status-item-${id}`;
        if (config.tooltip) item.title = config.tooltip;
        if (config.onClick) {
            item.addEventListener('click', () => {
                try { config.onClick(); } catch (err) { console.error(err); }
            });
        }

        // Right-side items slot in before the theme indicator; left-side items append.
        // Insert BEFORE invoking render so the plugin sees a connected element.
        const themeIndicator = container.querySelector('#status-theme-indicator');
        container.insertBefore(item, config.side === 'left' ? null : themeIndicator);

        if (typeof config.render === 'function') {
            try { config.render(item); } catch (err) { console.error(err); }
        } else if (config.text) {
            item.textContent = config.text;
        }
    });
};

// =====================================================================
//  Right Tool-Window Dock Engine
//  Hosts extension/IDE-contributed panels (api.views.registerRightPanel). Each panel
//  gets a toggle button on the right activity bar; the whole dock stays hidden until at
//  least one panel is live. Rendered content is cached per panel so switching between
//  tools — and future stateful agents — keeps their state alive.
// =====================================================================
let activeRightPanel = null;

function collapseRightPanel() {
    const rightPanel = document.getElementById('right-panel');
    if (rightPanel) rightPanel.classList.add('right-collapsed');
    document.querySelectorAll('.right-activity-icon').forEach(b => b.classList.remove('active'));
}

function openRightPanel(id) {
    const config = api.views.activeRightPanels().get(id);
    if (!config) return;

    const rightPanel = document.getElementById('right-panel');
    const title = document.getElementById('right-panel-title');
    if (rightPanel) rightPanel.classList.remove('right-collapsed');
    activeRightPanel = id;

    document.querySelectorAll('.right-activity-icon').forEach(b => {
        b.classList.toggle('active', b.id === `right-act-${id}`);
    });
    document.querySelectorAll('.right-panel-content').forEach(c => {
        c.style.display = c.id === `right-content-${id}` ? 'block' : 'none';
    });
    if (title) title.textContent = (config.title || id).toUpperCase();

    // Render lazily on first reveal; cached afterwards so state survives toggling.
    const content = document.getElementById(`right-content-${id}`);
    if (content && content.dataset.rendered !== 'true') {
        content.dataset.rendered = 'true';
        try {
            config.render(content);
        } catch (err) {
            content.innerHTML = `<div style="padding:16px; color:#ef5350;">Error rendering panel: ${err.message}</div>`;
        }
    }
}

function toggleRightPanel(id) {
    const rightPanel = document.getElementById('right-panel');
    const isCollapsed = !rightPanel || rightPanel.classList.contains('right-collapsed');
    if (activeRightPanel === id && !isCollapsed) {
        collapseRightPanel();
    } else {
        openRightPanel(id);
    }
}
window.toggleRightPanel = toggleRightPanel;

window.renderDynamicRightPanels = () => {
    const rightBar = document.getElementById('right-activity-bar');
    const body = document.getElementById('right-panel-body');
    if (!rightBar || !body) return;

    rightBar.innerHTML = '';
    body.innerHTML = '';

    const panels = api.views.activeRightPanels();

    // No live panels → hide the whole dock (activity bar + collapsed panel).
    if (panels.size === 0) {
        rightBar.classList.add('hidden');
        collapseRightPanel();
        activeRightPanel = null;
        return;
    }
    rightBar.classList.remove('hidden');

    panels.forEach((config, id) => {
        const btn = document.createElement('button');
        btn.className = 'activity-icon right-activity-icon';
        btn.id = `right-act-${id}`;
        btn.title = config.title || id;
        btn.innerHTML = `<i class="${config.iconClass || 'fa-solid fa-window-maximize'}"></i>`;
        btn.addEventListener('click', () => toggleRightPanel(id));
        rightBar.appendChild(btn);

        const content = document.createElement('div');
        content.className = 'right-panel-content';
        content.id = `right-content-${id}`;
        content.style.display = 'none';
        content.dataset.rendered = 'false';
        body.appendChild(content);
    });

    // Restore the previously open panel if it survived the re-render; else stay collapsed.
    // The container was just rebuilt, so openRightPanel re-runs its render().
    const previous = activeRightPanel;
    activeRightPanel = null;
    if (previous && panels.has(previous)) {
        openRightPanel(previous);
    } else {
        collapseRightPanel();
    }
};

// Monitors active tab file extensions to show/hide the "Go Live" server button
function updateGoLiveVisibility(fileName) {
    if (!btnGoLive) return;
    
    const ext = fileName ? fileName.split('.').pop().toLowerCase() : '';
    const isWebLang = ['html', 'htm', 'css', 'js', 'mjs', 'cjs'].includes(ext);

    if (isWebLang && rootDirectoryHandle) {
        btnGoLive.classList.remove('hidden-btn');
    } else {
        if (serverActiveUrl && ipcRenderer) {
            ipcRenderer.invoke('stop-server').then(() => {
                serverActiveUrl = null;
                btnGoLive.innerHTML = '<i class="fa-solid fa-tower-broadcast"></i> Go Live';
                btnGoLive.title = 'Run Local Web Server';
            });
        }
        btnGoLive.classList.add('hidden-btn');
    }
}

// Monitors active tab file extensions to show/hide the "Run" button
function updateRunButtonVisibility(fileName) {
    if (!btnRunCode) return;
    const ext = fileName ? fileName.split('.').pop().toLowerCase() : '';

    if (runnableExts.has(ext) && rootDirectoryHandle) {
        btnRunCode.classList.remove('hidden-btn');
        const langName = ext === 'py' ? 'Python' : ext === 'js' ? 'Node.js' : ext === 'cs' ? 'C#' : ext === 'java' ? 'Java' : '';
        btnRunCode.title = `Run Active ${langName} Code`;
    } else {
        btnRunCode.classList.add('hidden-btn');
    }
}

// Bind custom title bar buttons to native window actions under Electron
const isElectronApp = typeof window !== 'undefined' && window.process && window.process.type;
if (isElectronApp) {
    ipcRenderer = window.require('electron').ipcRenderer;

    window.updateRunnableExtensions = async () => {
        if (ipcRenderer) {
            try {
                const langs = await ipcRenderer.invoke('get-run-langs');
                runnableExts = new Set(Object.keys(langs || {}));
                if (activeFileHandle) {
                    updateRunButtonVisibility(activeFileHandle.name);
                }
            } catch (err) {
                console.error('Failed to query active code runner list:', err);
            }
        }
    };

    ipcRenderer.on('run-output', (e, { stream, data }) => {
        appendOutputChunk(data, stream);
    });
    ipcRenderer.on('run-exit', (e, { code }) => {
        appendOutputChunk(`\n[Process exited with code ${code}]\n`, 'system');
        setRunState(false);
    });

    const winMin = document.getElementById('win-min');
    const winMax = document.getElementById('win-max');
    const winClose = document.getElementById('win-close');

    if (winMin && winMax && winClose) {
        winMin.addEventListener('click', () => ipcRenderer.send('window-minimize'));
        winMax.addEventListener('click', () => ipcRenderer.send('window-maximize'));
        winClose.addEventListener('click', () => ipcRenderer.send('window-close'));
    }

    if (btnGoLive) {
        btnGoLive.addEventListener('click', async () => {
            if (serverActiveUrl) {
                const stopped = await ipcRenderer.invoke('stop-server');
                if (stopped) {
                    serverActiveUrl = null;
                    btnGoLive.innerHTML = '<i class="fa-solid fa-tower-broadcast"></i> Go Live';
                    btnGoLive.title = 'Run Local Web Server';
                }
            } else {
                if (rootDirectoryHandle) {
                    const folderPath = rootDirectoryHandle.path;
                    let relativePath = '';

                    if (activeFileHandle) {
                        try {
                            const pathParts = await resolveHandle(rootDirectoryHandle, activeFileHandle);
                            if (pathParts) {
                                relativePath = pathParts.join('/');
                            }
                        } catch (err) {
                            console.error('Failed to resolve active file path for server:', err);
                        }
                    }

                    const url = await ipcRenderer.invoke('start-server', folderPath, relativePath);
                    if (url) {
                        serverActiveUrl = url;
                        btnGoLive.innerHTML = `<i class="fa-solid fa-circle" style="color: #4caf50; font-size: 8px;"></i> Port: 5500`;
                        btnGoLive.title = 'Stop Local Web Server';
                    }
                }
            }
        });
    }

    if (btnRunCode) {
        btnRunCode.addEventListener('click', async () => {
            if (!activeFileHandle) return;
            const ext = activeFileHandle.name.split('.').pop().toLowerCase();
            if (!runnableExts.has(ext)) return;

            if (dirtyFiles.has(fileKey(activeFileHandle))) {
                await handleSaveFile();
            }

            const mode = localStorage.getItem('run-mode-preset') || 'integrated';

            if (mode === 'integrated') {
                setRunState(true, (line) => ipcRenderer.invoke('run-input', line));
            } else {
                printToTerminal(`Launching ${activeFileHandle.name} in an external window...`);
            }

            const result = await ipcRenderer.invoke('run-file', activeFileHandle.path, mode);

            if (!result || !result.running) {
                if (mode === 'integrated') setRunState(false);
                if (result && result.output) printToTerminal(result.output);
            }
        });
    }
}

// Safety listener for unsaved file contents
window.addEventListener('beforeunload', (e) => {
    if (dirtyFiles.size > 0) {
        const confirmClose = confirm('You have unsaved changes. Are you sure you want to exit?');
        if (!confirmClose) {
            e.preventDefault();
            e.returnValue = '';
        }
    }
});

/**
 * Converts 0-based LSP line/character coordinates into absolute file offset index positions
 */
function lspPositionToOffset(text, line, character) {
    // Strip all carriage returns globally to prevent index-to-viewport drift on Windows (Added Fix)
    const cleanText = text.replace(/\r/g, '');
    const lines = cleanText.split('\n');
    let offset = 0;
    for (let i = 0; i < line && i < lines.length; i++) {
        offset += lines[i].length + 1; // +1 for newline character
    }
    return offset + character;
}

/**
 * Converts absolute index offsets back into 0-based LSP line/character coordinates (Added Fix)
 */
function offsetToLspPosition(text, offset) {
    const cleanText = text.replace(/\r/g, '');
    const lines = cleanText.split('\n');
    let accumulated = 0;
    for (let i = 0; i < lines.length; i++) {
        const lineLength = lines[i].length + 1; // +1 for newline character
        if (offset < accumulated + lineLength) {
            return {
                line: i,
                character: offset - accumulated
            };
        }
        accumulated += lineLength;
    }
    return { line: Math.max(0, lines.length - 1), character: 0 };
}

/**
 * Maps the LSP standard semantic token *type names* onto the editor's `sem-*` CSS
 * classes (defined in style.css). Types we don't map are dropped, so the regex
 * highlighter keeps colouring those characters — the semantic layer only overrides
 * what the server can speak to authoritatively.
 */
const SEMANTIC_TYPE_TO_CLASS = {
    namespace: 'sem-namespace',
    type: 'sem-type', class: 'sem-class', enum: 'sem-type',
    interface: 'sem-type', struct: 'sem-type', typeParameter: 'sem-type',
    parameter: 'sem-parameter', variable: 'sem-variable', property: 'sem-property',
    enumMember: 'sem-property', event: 'sem-property',
    function: 'sem-function', method: 'sem-function', macro: 'sem-function',
    keyword: 'sem-keyword', modifier: 'sem-keyword',
    comment: 'sem-comment', string: 'sem-string', regexp: 'sem-string',
    number: 'sem-number', operator: 'sem-operator', decorator: 'sem-decorator'
};

/**
 * Decodes the flat integer array from `textDocument/semanticTokens/full` into absolute
 * `{ start, end, cls }` offset ranges against `fileText`.
 *
 * The wire format packs five ints per token — deltaLine, deltaStartChar, length,
 * tokenTypeIndex, tokenModifiers — where line/char deltas are relative to the previous
 * token (char resets to absolute whenever the line advances). See the LSP spec.
 */
function decodeSemanticTokens(data, legend, fileText) {
    if (!Array.isArray(data) || !legend || !Array.isArray(legend.tokenTypes)) return [];

    const out = [];
    let line = 0;
    let char = 0;

    for (let i = 0; i + 4 < data.length; i += 5) {
        const deltaLine = data[i];
        const deltaChar = data[i + 1];
        const length = data[i + 2];
        const typeIdx = data[i + 3];

        if (deltaLine > 0) {
            line += deltaLine;
            char = deltaChar;
        } else {
            char += deltaChar;
        }

        const typeName = legend.tokenTypes[typeIdx];
        const cls = typeName && SEMANTIC_TYPE_TO_CLASS[typeName];
        if (!cls || length <= 0) continue;

        const start = lspPositionToOffset(fileText, line, char);
        out.push({ start, end: start + length, cls });
    }

    // The renderer binary-searches these, so keep them ordered by start offset.
    out.sort((a, b) => a.start - b.start);
    return out;
}

// One in-flight request at a time is enough; a burst of edits collapses to the last.
let semanticTokensTimer = null;

/**
 * Requests semantic tokens for `fileHandle`, decodes them against the buffer as the
 * server currently sees it, caches the result and repaints if it is the active file.
 * A no-op unless the client opted into the feature *and* the server advertises it.
 */
async function fetchSemanticTokens(lspEntry, fileHandle) {
    if (!lspEntry || !lspEntry.client || !fileHandle) return;
    if (!lspEntry.features || !lspEntry.features.semanticTokens) return;

    const client = lspEntry.client;
    if (!client.isStarted || !client.hasSemanticTokens()) return;

    const legend = client.getSemanticTokensLegend();
    if (!legend) return;

    // Snapshot the exact text the offsets will be measured against. This matches what
    // the most recent didChange sent, so the decoded ranges line up with the backdrop.
    const isActive = activeFileHandle && fileKey(activeFileHandle) === fileKey(fileHandle);
    const fileText = isActive
        ? folding.getFullText(editor.value).replace(/\r/g, '')
        : (tabContentsCache.get(fileKey(fileHandle)) || '').replace(/\r/g, '');

    try {
        const res = await client.semanticTokens(fileHandle.path);
        const data = res && res.result ? res.result.data : null;
        const decoded = decodeSemanticTokens(data, legend, fileText);

        const key = (fileHandle.path || '').toLowerCase();
        window.semanticTokensCache.set(key, decoded);

        const activePath = activeFileHandle && activeFileHandle.path ? activeFileHandle.path.toLowerCase() : '';
        if (key === activePath) {
            window.activeSemanticTokens = decoded;
            runLayoutRenderEngine();
        }
    } catch (err) {
        // A server that lied about its capability (or died mid-request) just leaves the
        // regex highlighting in place — nothing to recover.
    }
}

/**
 * Debounced entry point used after edits; pass `immediate` on file open for a fast
 * first paint. Safe to call for any file — it self-cancels when the feature is off.
 */
function scheduleSemanticTokens(lspEntry, fileHandle, immediate = false) {
    if (!lspEntry || !lspEntry.features || !lspEntry.features.semanticTokens) return;
    if (semanticTokensTimer) clearTimeout(semanticTokensTimer);
    if (immediate) {
        fetchSemanticTokens(lspEntry, fileHandle);
        return;
    }
    semanticTokensTimer = setTimeout(() => fetchSemanticTokens(lspEntry, fileHandle), 350);
}

// LSP CompletionItemKind (1–25) → the ProSense item `type`, which drives its icon/colour.
const LSP_COMPLETION_KIND_TO_TYPE = {
    1: 'variable', 2: 'method', 3: 'function', 4: 'function', 5: 'property',
    6: 'variable', 7: 'class', 8: 'class', 9: 'module', 10: 'property',
    11: 'variable', 12: 'variable', 13: 'class', 14: 'keyword', 15: 'snippet',
    16: 'variable', 17: 'variable', 18: 'variable', 19: 'variable', 20: 'property',
    21: 'variable', 22: 'class', 23: 'property', 24: 'keyword', 25: 'class'
};

/**
 * Rewrites an LSP snippet (`${1:name}`, `$2`, `$0`) into the plain insert text ProSense
 * understands, keeping default values as literal text and preserving the final caret
 * stop as ProSense's single `$0` marker.
 */
function sanitizeLspSnippet(text) {
    if (!text) return text;
    const CARET = '\u0000'; // temporary sentinel for the final tab stop
    let out = text
        .replace(/\$\{0(?::([^}]*))?\}/g, CARET) // ${0} / ${0:default} → caret
        .replace(/\$0/g, CARET)                   // $0 → caret
        .replace(/\$\{\d+:([^}]*)\}/g, '$1')     // ${n:default} → default
        .replace(/\$\{\d+\}/g, '')                // ${n} → ''
        .replace(/\$\d+/g, '');                   // $n → ''

    const caretIdx = out.indexOf(CARET);
    out = out.split(CARET).join('');
    if (caretIdx !== -1) out = out.slice(0, caretIdx) + '$0' + out.slice(caretIdx);
    return out;
}

/**
 * Normalises an LSP completion response (either a bare item array or a CompletionList)
 * into ProSense items. Capped so a server returning thousands of symbols can't stall the
 * fuzzy ranker.
 */
function mapLspCompletions(res) {
    if (!res || !res.result) return [];
    const raw = Array.isArray(res.result) ? res.result : (res.result.items || []);

    const out = [];
    for (const item of raw) {
        if (out.length >= 200) break;
        const label = typeof item.label === 'string'
            ? item.label
            : (item.label && item.label.label);
        if (!label) continue;

        let insertText = item.insertText
            || (item.textEdit && item.textEdit.newText)
            || label;
        if (item.insertTextFormat === 2) insertText = sanitizeLspSnippet(insertText);

        const detail = item.detail
            || (item.labelDetails && (item.labelDetails.detail || item.labelDetails.description))
            || '';

        out.push({
            label,
            insertText,
            type: LSP_COMPLETION_KIND_TO_TYPE[item.kind] || 'variable',
            detail,
            source: 'lsp'
        });
    }
    return out;
}

function escapeHTML(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Standardizes incoming LSP hover payload contents (Added Fix)
 */
function parseHoverContents(contents) {
    if (!contents) return '';
    if (typeof contents === 'string') return contents;
    if (Array.isArray(contents)) {
        return contents.map(item => parseHoverContents(item)).join('\n');
    }
    if (contents.value) return contents.value;
    return '';
}

/**
 * Lightweight markdown renderer for LSP hover payloads (Added Fix).
 * Splits fenced code blocks (the type signature) from prose docs and applies
 * minimal inline formatting so tooltips read like a real IDE instead of raw markdown.
 */
function resolveHoverLang(fenceLang, defaultLang) {
    const alias = { ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', py: 'python' };
    let l = (fenceLang || '').toLowerCase();
    if (alias[l]) l = alias[l];
    return l || defaultLang || null;
}

function renderHoverMarkdown(md, defaultLang) {
    const parts = [];
    const fenceRe = /```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/g;
    let lastIdx = 0;
    let m;
    while ((m = fenceRe.exec(md)) !== null) {
        if (m.index > lastIdx) parts.push({ code: false, text: md.slice(lastIdx, m.index) });
        parts.push({ code: true, lang: m[1], text: m[2].replace(/\n+$/, '') });
        lastIdx = fenceRe.lastIndex;
    }
    if (lastIdx < md.length) parts.push({ code: false, text: md.slice(lastIdx) });

    return parts.map(part => {
        if (part.code) {
            if (!part.text.trim()) return '';
            const langId = resolveHoverLang(part.lang, defaultLang);
            let inner;
            try {
                inner = highlightCodeToHTML(part.text.trim(), langId);
            } catch (err) {
                inner = escapeHTML(part.text.trim());
            }
            return `<pre class="hover-code">${inner}</pre>`;
        }
        let t = escapeHTML(part.text);
        t = t.replace(/`([^`]+)`/g, '<code class="hover-inline-code">$1</code>');
        t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        t = t.replace(/__([^_]+)__/g, '<strong>$1</strong>');
        t = t.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
        // Markdown links: [text](url) -> just the visible text
        t = t.replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, '$1');
        // ATX headings (### Foo) -> bold section titles
        t = t.replace(/^\s{0,3}#{1,6}\s+(.+?)\s*#*$/gm, '<strong class="hover-heading">$1</strong>');
        // Normalize bullet list markers to a real bullet glyph
        t = t.replace(/^(\s*)[-*+]\s+/gm, '$1• ');
        // Horizontal rules used by tsserver to separate sections
        t = t.replace(/^\s*---+\s*$/gm, '<hr class="hover-rule">');
        t = t.replace(/\n{3,}/g, '\n\n').trim();
        if (!t) return '';
        return `<div class="hover-doc-text">${t}</div>`;
    }).join('');
}

// Global storage caches for active workspace diagnostics (Added Fix)
window.activeDiagnosticsCache = new Map();
window.activeDiagnostics = [];

// Per-file decoded LSP semantic tokens, keyed by lowercased path, plus the slice for
// the currently open file (read by js/syntax.js while painting the backdrop).
window.semanticTokensCache = new Map();
window.activeSemanticTokens = [];

// Active hover trackers to prevent cursor movement flickers (Added Fix)
window.lastHoverOffset = -1;
window.lastHoverDiag = null;

/**
 * Converts a standard file:// URI into a clean OS-native file path (Added Fix)
 */
function uriToPath(uri) {
    let clean = uri.replace(/^file:\/\/\//, '');
    const isWin = typeof window !== 'undefined' && window.process && window.process.platform === 'win32';
    if (isWin) {
        clean = clean.replace(/\//g, '\\');
    }
    return decodeURIComponent(clean);
}

// Setup Settings Snippet Manager inputs and list update bindings
const snippetTrigger = document.getElementById('snippet-trigger');
const snippetLang = document.getElementById('snippet-lang');
const snippetBody = document.getElementById('snippet-body');
const addSnippetBtn = document.getElementById('add-snippet-btn');
const snippetsList = document.getElementById('custom-snippets-list');

if (addSnippetBtn && snippetsList) {
    const handleRender = () => {
        renderSnippetsList(snippetsList, (indexToDelete) => {
            const snippets = getCustomSnippets();
            snippets.splice(indexToDelete, 1);
            saveCustomSnippets(snippets);
            handleRender();
        });
    };

    addSnippetBtn.addEventListener('click', () => {
        const trigger = snippetTrigger.value.trim();
        const lang = snippetLang.value;
        const body = snippetBody.value.replace(/\\n/g, '\n');

        if (!trigger || !body) {
            alert('Trigger prefix and expansion body cannot be empty.');
            return;
        }

        const snippets = getCustomSnippets();
        snippets.push({ trigger, lang, body });
        saveCustomSnippets(snippets);

        snippetTrigger.value = '';
        snippetBody.value = '';
        handleRender();
    });

    handleRender();
}

btnOpenFolder.addEventListener('click', handleOpenFolder);
btnSaveFile.addEventListener('click', handleSaveFile);
btnNewFile.addEventListener('click', handleCreateFile);
btnNewFolder.addEventListener('click', handleCreateFolder);

themeSelector.addEventListener('change', (e) => {
    applyTheme(e.target.value);
    runLayoutRenderEngine(); 
});
iconSelector.addEventListener('change', (e) => {
    activeIconPack = e.target.value;
    localStorage.setItem('editor-icon-pack-preset', activeIconPack);
    refreshExplorer();
});

// Bind activity switches
actExplorer.addEventListener('click', () => switchSidebarView('explorer'));
actSettings.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSettingsPanel();
});

closeSettingsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSettingsPanel();
});

editor.addEventListener('input', () => {
    if (activeFileHandle && !dirtyFiles.has(fileKey(activeFileHandle))) {
        dirtyFiles.add(fileKey(activeFileHandle));
        updateTabsUI();
    }
    // Real-time offset tracking for active diagnostics on typing
    const currentLength = editor.value.length;
    const delta = currentLength - (window.lastTextLength || currentLength);
    const cursor = editor.selectionStart;
    const editPoint = delta > 0 ? cursor - delta : cursor;

    // Keep fold anchors aligned when the user edits visible text ahead of them. This
    // MUST run before the full-text cache below, otherwise reconstruction splices the
    // hidden interior at a stale offset and corrupts the cached document.
    if (delta !== 0) folding.adjustForEdit(editPoint, delta);

    if (activeFileHandle) {
        // Cache the reconstructed full document, not the folded view, so tab switching
        // and diagnostics never lose collapsed interiors.
        tabContentsCache.set(fileKey(activeFileHandle), folding.getFullText(editor.value));
    }

    if (delta !== 0 && window.activeDiagnostics && window.activeDiagnostics.length > 0) {
        window.activeDiagnostics.forEach(diag => {
            if (diag.start >= editPoint) {
                diag.start += delta;
                diag.end += delta;
            } else if (diag.end > editPoint) {
                diag.end += delta;
            }
        });
    }
    window.lastTextLength = currentLength;

    runLayoutRenderEngine();

    // Sync current document state changes back to active LSP servers (Added Fix)
    if (activeFileHandle) {
        const fileExt = activeFileHandle.name.split('.').pop().toLowerCase();
        const langConfig = api.languages.get(fileExt);
        const lspKey = langConfig ? langConfig.name.toLowerCase() : fileExt;
        const lspEntry = api.languages.getLspClient(lspKey) || api.languages.getLspClient(fileExt);

        if (lspEntry && lspEntry.client) {
            const cachedVersions = (window.lspVersionCache = window.lspVersionCache || {});
            const currentVersion = cachedVersions[fileKey(activeFileHandle)] = (cachedVersions[fileKey(activeFileHandle)] || 1) + 1;
            
            // Ensure no \r characters are sent to the LSP during edits, and always send
            // the full document (folded interiors reconstructed) so ranges stay correct.
            const cleanText = folding.getFullText(editor.value).replace(/\r/g, '');
            lspEntry.client.didChange(activeFileHandle.path, currentVersion, cleanText);

            // Refresh semantic highlighting off the edited buffer (debounced).
            scheduleSemanticTokens(lspEntry, activeFileHandle);
        }
    }

    // Debounced content-change broadcast for plugin subscribers (outline views, etc.)
    clearTimeout(window._contentChangedTimer);
    window._contentChangedTimer = setTimeout(() => {
        if (!activeFileHandle || activeFileHandle.isSettings || activeFileHandle.isPluginDetails) return;
        api.events.emit('content-changed', {
            path: activeFileHandle.path || activeFileHandle.name,
            name: activeFileHandle.name,
            contents: folding.getFullText(editor.value)
        });
    }, 300);

    // Trigger autocomplete suggestions strictly during input events
    const activeName = activeFileHandle ? activeFileHandle.name : '';
    const activeKey = fileKey(activeFileHandle);
    const extraBuffers = [];
    for (const [key, buf] of tabContentsCache) {
        if (key !== activeKey && buf) extraBuffers.push(buf);
    }
    handleProSenseInput(activeName, extraBuffers);
});

editor.addEventListener('scroll', () => {
    editorBackdrop.scrollTop = editor.scrollTop;
    editorBackdrop.scrollLeft = editor.scrollLeft;
    lineGutter.scrollTop = editor.scrollTop;

    const viewportRatio = editor.scrollTop / (editor.scrollHeight - editor.clientHeight || 1);
    const maxMinimapScroll = minimapGutter.clientHeight - minimapIndicator.clientHeight;
    minimapIndicator.style.top = `${viewportRatio * maxMinimapScroll}px`;
});

editor.addEventListener('click', () => {
    hideProSense(); // Hide autocomplete if the user clicks elsewhere inside the text area [1]
    runLayoutRenderEngine();
});

editor.addEventListener('keyup', (e) => {
    // Hide autocomplete if caret navigates away using Arrow keys [2]
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
        // When the popup is open it consumes Up/Down/Enter/Tab in keydown to navigate the
        // list, so the caret never moved — don't dismiss it on the arrow key release (Added Fix)
        const widget = document.getElementById('prosense-widget');
        if (widget && !widget.classList.contains('prosense-hidden') &&
            (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            return;
        }
        hideProSense();
        runLayoutRenderEngine();
    }
});

editor.addEventListener('blur', () => {
    // Hide autocomplete when focus is lost (using a small timeout so clicks on list items register first)
    setTimeout(() => {
        hideProSense();
    }, 150);
});

/**
 * Indent (dir = 1) or outdent (dir = -1) every line touched by the current selection
 * by one 4-space step, then re-anchor the selection over the same block so Tab /
 * Shift+Tab can be pressed repeatedly. Used for multi-line selections and Shift+Tab.
 */
function indentSelection(el, dir) {
    const UNIT = '    ';
    const val = el.value;
    const selStart = el.selectionStart;
    const selEnd = el.selectionEnd;

    const blockStart = val.lastIndexOf('\n', selStart - 1) + 1;
    // Extend to the end of the line the selection ends on. If the selection stops exactly
    // at a line start (a trailing newline), don't drag the following line into the block.
    let blockEnd;
    if (selEnd > selStart && val[selEnd - 1] === '\n') {
        blockEnd = selEnd - 1;
    } else {
        blockEnd = val.indexOf('\n', selEnd);
        if (blockEnd === -1) blockEnd = val.length;
    }

    const before = val.slice(0, blockStart);
    const block = val.slice(blockStart, blockEnd);
    const after = val.slice(blockEnd);

    let firstLineDelta = 0; // chars added/removed before the first line's start
    let totalDelta = 0;     // net change across the whole block
    const lines = block.split('\n').map((line, i) => {
        if (dir > 0) {
            if (i === 0) firstLineDelta = UNIT.length;
            totalDelta += UNIT.length;
            return UNIT + line;
        }
        // Outdent: strip up to one indent step of leading whitespace.
        const match = line.match(/^[\t ]{1,4}/);
        const removed = match ? match[0].length : 0;
        if (i === 0) firstLineDelta = -removed;
        totalDelta -= removed;
        return line.slice(removed);
    });

    // Nothing changed (e.g. outdenting lines that have no leading whitespace): leave the
    // buffer — and its dirty flag — untouched.
    if (totalDelta === 0) return;

    el.value = before + lines.join('\n') + after;

    // Keep the selection covering the same block; clamp the anchor to the first line
    // start so an outdent never pulls the caret up into the previous line.
    const newStart = Math.max(blockStart, selStart + firstLineDelta);
    const newEnd = Math.max(newStart, selEnd + totalDelta);
    el.selectionStart = newStart;
    el.selectionEnd = newEnd;

    el.dispatchEvent(new Event('input'));
}

editor.addEventListener('keydown', (e) => {
    // Code folding: Ctrl/Cmd+Shift+[ collapses the region at the caret, +] expands it.
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.code === 'BracketLeft' || e.code === 'BracketRight')) {
        e.preventDefault();
        hideProSense();
        if (e.code === 'BracketLeft') folding.foldAtCursor();
        else folding.unfoldAtCursor();
        return;
    }

    // Line operations (comment toggle, move/duplicate/delete line) claim their own
    // modifier combos and run before ProSense so Alt+Arrow never navigates the popup.
    if (handleLineOperations(e, editor, activeFileHandle ? activeFileHandle.name : '')) {
        hideProSense();
        return;
    }

    if (handleProSenseKeydown(e)) {
        return;
    }

    // Ctrl+Space (or Cmd+Space) manually opens the completion popup (Added Fix)
    if ((e.ctrlKey || e.metaKey) && (e.code === 'Space' || e.key === ' ')) {
        e.preventDefault();
        const activeName = activeFileHandle ? activeFileHandle.name : '';
        const activeKey = fileKey(activeFileHandle);
        const manualBuffers = [];
        for (const [key, buf] of tabContentsCache) {
            if (key !== activeKey && buf) manualBuffers.push(buf);
        }
        triggerProSense(activeName, manualBuffers);
        return;
    }

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const val = editor.value;

    if (e.key === 'Tab') {
        e.preventDefault();

        const multiLine = val.slice(start, end).includes('\n');

        // Shift+Tab always outdents; Tab across multiple lines indents the whole block.
        // A plain Tab with a collapsed / single-line selection keeps the simple insert
        // (which, unlike the old behaviour, no longer silently destroys a selection that
        // spanned several lines).
        if (e.shiftKey || multiLine) {
            indentSelection(editor, e.shiftKey ? -1 : 1);
            return;
        }

        editor.value = val.substring(0, start) + "    " + val.substring(end);
        editor.selectionStart = editor.selectionEnd = start + 4;
        editor.dispatchEvent(new Event('input'));
        return;
    }

    const pairs = {
        '(': ')',
        '[': ']',
        '{': '}',
        '"': '"',
        "'": "'"
    };

    if ([')', ']', '}', '>', '"', "'"].includes(e.key) && start === end && val[start] === e.key) {
        e.preventDefault();
        editor.selectionStart = editor.selectionEnd = start + 1;
        return;
    }

    if (pairs[e.key] !== undefined) {
        e.preventDefault();
        const closingChar = pairs[e.key];
        const selectedText = val.substring(start, end);
        editor.value = val.substring(0, start) + e.key + selectedText + closingChar + val.substring(end);

        if (start !== end) {
            editor.selectionStart = start + 1;
            editor.selectionEnd = end + 1;
        } else {
            editor.selectionStart = editor.selectionEnd = start + 1;
        }
        editor.dispatchEvent(new Event('input'));
    }

    if (e.key === '>') {
        const text = editor.value;
        const cursor = editor.selectionStart;
        const leftText = text.substring(0, cursor);
        
        const lastLess = leftText.lastIndexOf('<');
        if (lastLess !== -1 && !leftText.substring(lastLess).includes('>')) {
            const tagMatch = leftText.substring(lastLess).match(/^<([a-zA-Z0-9:-]+)/);
            if (tagMatch) {
                const tagName = tagMatch[1];
                
                const voidTags = ['img', 'br', 'input', 'hr', 'link', 'meta', 'base', 'col', 'embed', 'source', 'track', 'wbr'];
                if (!voidTags.includes(tagName.toLowerCase()) && !tagName.startsWith('/')) {
                    e.preventDefault();
                    
                    const closingTag = `</${tagName}>`;
                    editor.value = text.substring(0, cursor) + '>' + closingTag + text.substring(cursor);
                    
                    editor.selectionStart = editor.selectionEnd = cursor + 1;
                    editor.dispatchEvent(new Event('input'));
                    return;
                }
            }
        }
    }
    if (e.key === 'Enter') {
        const text = editor.value;
        const cursor = editor.selectionStart;
        const leftText = text.substring(0, cursor);
        const rightText = text.substring(cursor);

        const lastNewline = leftText.lastIndexOf('\n');
        const currentLine = leftText.substring(lastNewline + 1);

        const matchIndent = currentLine.match(/^\s*/);
        const indent = matchIndent ? matchIndent[0] : '';

        e.preventDefault();

        const trimmedLine = currentLine.trim();
        const shouldIncreaseIndent = trimmedLine.endsWith('{') || 
                                     trimmedLine.endsWith('[') || 
                                     trimmedLine.endsWith('(') || 
                                     trimmedLine.endsWith(':');

        let insertText = '\n' + indent;
        let newCursorOffset = 1 + indent.length;

        if (shouldIncreaseIndent) {
            const extraIndent = '    ';
            insertText = '\n' + indent + extraIndent;
            newCursorOffset = 1 + indent.length + extraIndent.length;

            if (trimmedLine.endsWith('{') && rightText.startsWith('}')) {
                insertText += '\n' + indent;
            }
        }

        editor.value = leftText + insertText + rightText;
        editor.selectionStart = editor.selectionEnd = cursor + newCursorOffset;
        editor.dispatchEvent(new Event('input'));
        return;
    }
});

// Global shortkeys
window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (activeFileHandle && !activeFileHandle.isSettings) handleSaveFile();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        toggleSettingsPanel();
    }
    // Ctrl/Cmd+G — Go to line
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        handleGoToLine();
    }
    // Ctrl/Cmd+W — Close the active tab
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'w') {
        if (activeFileHandle) {
            e.preventDefault();
            handleCloseTab(activeFileHandle);
        }
    }
});

// Keep the status-bar cursor readout live as the selection moves (keyboard or mouse).
document.addEventListener('selectionchange', () => {
    if (document.activeElement === editor) updateStatusBar();
});

// Clicking the Ln/Col readout opens Go to Line, mirroring VS Code.
if (statusCursor) {
    statusCursor.addEventListener('click', handleGoToLine);
}

function toggleSettingsPanel() {
    const key = fileKey(settingsTabHandle);
    const isActive = activeFileHandle && fileKey(activeFileHandle) === key;
    if (isActive) {
        handleCloseTab(settingsTabHandle);
    } else {
        openSettingsTab();
    }
}

function openSettingsTab() {
    const key = fileKey(settingsTabHandle);
    if (!openTabs.find(t => fileKey(t) === key)) {
        openTabs.push(settingsTabHandle);
    }
    handleOpenFile(settingsTabHandle);
}



/**
 * Updates line numbers and coordinates the editor backdrop overlay.
 */
function runLayoutRenderEngine() {
    const text = editor.value;

    // Gutter numbers + fold arrows (true file line numbers are preserved across folds).
    lineGutter.innerHTML = folding.buildGutterHTML(text);

    minimapText.textContent = text;

    let highlightIndices = new Set();
    const cursor = editor.selectionStart;

    let targetPos = -1;
    const bracketChars = ['(', ')', '[', ']', '{', '}', '<', '>'];
    
    if (bracketChars.includes(text[cursor])) {
        targetPos = cursor;
    } else if (bracketChars.includes(text[cursor - 1])) {
        targetPos = cursor - 1;
    }

    if (targetPos !== -1) {
        const targetChar = text[targetPos];
        const matchingPairIndex = findMatchingBracketIndex(text, targetPos, targetChar);
        if (matchingPairIndex !== -1) {
            highlightIndices.add(targetPos);
            highlightIndices.add(matchingPairIndex);
        }
    }

    const activeName = activeFileHandle ? activeFileHandle.name : '';
    const currentWord = getWordBeforeCursor();
    const markerIndex = cursor - currentWord.length;

    // While regions are folded the visible text no longer aligns with LSP diagnostic
    // offsets (which track the full document), so suppress squiggles for this paint.
    const foldsActive = folding.hasFolds();
    const savedDiagnostics = window.activeDiagnostics;
    const savedSemanticTokens = window.activeSemanticTokens;
    if (foldsActive) {
        window.activeDiagnostics = [];
        window.activeSemanticTokens = [];
    }

    const backdropHTML = renderSyntaxHighlighting(text, activeName, highlightIndices, markerIndex);

    if (foldsActive) {
        window.activeDiagnostics = savedDiagnostics;
        window.activeSemanticTokens = savedSemanticTokens;
    }

    editorBackdrop.innerHTML = folding.decorateBackdrop(backdropHTML) + (text.endsWith('\n') ? '\n ' : ' ');

    updateStatusBar();
}

/**
 * Repaint the status-bar cursor / selection readout and the active language label.
 * Line numbers report true file lines even while regions are folded.
 */
function updateStatusBar() {
    if (!statusCursor) return;

    if (!activeFileHandle) {
        statusCursor.classList.add('hidden-btn');
        if (statusLanguage) statusLanguage.classList.add('hidden-btn');
        return;
    }

    if (activeFileHandle.isSettings) {
        statusCursor.classList.add('hidden-btn');
        if (statusLanguage) statusLanguage.classList.add('hidden-btn');
        return;
    }

    const text = editor.value;
    const selStart = editor.selectionStart;
    const selEnd = editor.selectionEnd;

    const realLine = folding.realLineForDisplayOffset(text, selStart); // 0-based, fold-aware
    const lineStartIdx = text.lastIndexOf('\n', selStart - 1) + 1;
    const col = selStart - lineStartIdx;

    let label = `Ln ${realLine + 1}, Col ${col + 1}`;
    if (selEnd > selStart) {
        const selLen = selEnd - selStart;
        const selLines = (text.slice(selStart, selEnd).match(/\n/g) || []).length + 1;
        label += selLines > 1 ? ` (${selLen} selected · ${selLines} lines)` : ` (${selLen} selected)`;
    }
    statusCursor.innerHTML = `<i class="fa-solid fa-location-crosshairs"></i> ${label}`;
    statusCursor.classList.remove('hidden-btn');

    if (statusLanguage) {
        const ext = (activeFileHandle.name.split('.').pop() || '').toLowerCase();
        const langConfig = api.languages.get(ext);
        const langName = langConfig ? langConfig.name : (ext ? ext.toUpperCase() : 'Plain Text');
        statusLanguage.innerHTML = `<i class="fa-solid fa-code"></i> ${langName}`;
        statusLanguage.classList.remove('hidden-btn');
    }
}

/**
 * Jump the caret to a user-supplied 1-based file line. Any folded regions are expanded
 * first so the target is always reachable, then the line is scrolled into view.
 */
async function handleGoToLine() {
    if (!activeFileHandle) return;

    if (folding.hasFolds()) folding.unfoldAll();

    const lines = editor.value.split('\n');
    const input = await showPrompt(`Go to line (1–${lines.length}):`, 'Line number');
    if (input === null || input === '') return;

    const requested = parseInt(input, 10);
    if (Number.isNaN(requested)) return;

    jumpToEditorLine(requested);
}

/**
 * Programmatically move the caret to a 1-based file line (optionally a 0-based
 * column) and center it in the viewport. Folded regions are expanded first.
 * Also exposed to plugins through api.editor.goToLine.
 */
function jumpToEditorLine(lineNumber, column = null) {
    if (!activeFileHandle) return;

    if (folding.hasFolds()) folding.unfoldAll();

    const lines = editor.value.split('\n');
    const target = Math.max(1, Math.min(lines.length, lineNumber));
    let offset = 0;
    for (let i = 0; i < target - 1; i++) offset += lines[i].length + 1;

    const lineText = lines[target - 1];
    if (column !== null && !Number.isNaN(column)) {
        offset += Math.max(0, Math.min(lineText.length, column));
    } else {
        // Land after any leading indentation so the caret sits on the first real token.
        offset += lineText.match(/^\s*/)[0].length;
    }

    editor.focus();
    editor.selectionStart = editor.selectionEnd = offset;

    // Center the target line in the viewport.
    const cs = getComputedStyle(editor);
    let lineHeight = parseFloat(cs.lineHeight);
    if (Number.isNaN(lineHeight)) lineHeight = parseFloat(cs.fontSize) * 1.5;
    editor.scrollTop = Math.max(0, (target - 1) * lineHeight - editor.clientHeight / 2);

    runLayoutRenderEngine();
}

function findMatchingBracketIndex(text, pos, char) {
    const pairs = {
        '(': { open: true, partner: ')', dir: 1 },
        '[': { open: true, partner: ']', dir: 1 },
        '{': { open: true, partner: '}', dir: 1 },
        '<': { open: true, partner: '>', dir: 1 },
        ')': { open: false, partner: '(', dir: -1 },
        ']': { open: false, partner: '[', dir: -1 },
        '}': { open: false, partner: '{', dir: -1 },
        '>': { open: false, partner: '<', dir: -1 }
    };

    const config = pairs[char];
    if (!config) return -1;

    let depth = 0;
    let idx = pos;

    while (idx >= 0 && idx < text.length) {
        const current = text[idx];
        if (current === char) {
            depth++;
        } else if (current === config.partner) {
            depth--;
            if (depth === 0) return idx;
        }
        idx += config.dir;
    }
    return -1;
}

async function refreshExplorer() {
    if (!rootDirectoryHandle) return;

    let selectedPath = null;
    // Guard: Skip resolving paths for virtual settings handles
    if (selectedHandle && !selectedHandle.isSettings) {
        if (selectedHandle === rootDirectoryHandle) {
            selectedPath = 'root';
        } else {
            try {
                const pathParts = await resolveHandle(rootDirectoryHandle, selectedHandle);
                if (pathParts) {
                    selectedPath = 'root/' + pathParts.join('/');
                }
            } catch (err) {
                console.error('Could not resolve selected path:', err);
            }
        }
    }

    const entries = await readDirectoryEntries(rootDirectoryHandle);
    renderFileTree(
        fileTreeContainer, entries, selectedPath, expandedFolders, activeIconPack,
        handleOpenFile, handleFolderCollapseToggle, handleProjectItemDelete, handleMoveItem,
        handleExplorerContextMenu
    );
    lastRenderedEntries = entries;
}

function findEntryByHandle(handle, entries = lastRenderedEntries) {
    if (!handle) return null;
    const key = fileKey(handle);
    for (const entry of entries) {
        if (fileKey(entry.handle) === key) return entry;
        if (entry.children) {
            const hit = findEntryByHandle(handle, entry.children);
            if (hit) return hit;
        }
    }
    return null;
}

function updateTabsUI() {
    renderTabs(tabContainer, openTabs, activeFileHandle, dirtyFiles, activeIconPack, handleOpenFile, handleCloseTab, handleTabReorder, handleTabContextMenu);
}

async function handleFolderCollapseToggle(pathString, directoryItem) {
    selectedHandle = directoryItem.handle;
    selectedDirectoryContext = directoryItem.handle;
    if (expandedFolders.has(pathString)) {
        expandedFolders.delete(pathString);
    } else {
        expandedFolders.add(pathString);
    }
    await refreshExplorer();
}

async function handleOpenFolder() {
    try {
        rootDirectoryHandle = await openDirectoryPicker();
        if (rootDirectoryHandle && await verifyPermission(rootDirectoryHandle, true)) {
            btnNewFile.disabled = false;
            btnNewFolder.disabled = false;
            selectedDirectoryContext = rootDirectoryHandle;
            expandedFolders.clear();
            
            updateTerminalPrompt(rootDirectoryHandle.path);
            // Expose the active workspace path so IDE plugins (e.g. Pythonix pip manager)
            // can resolve the correct working directory / virtual environment.
            window.currentWorkspacePath = rootDirectoryHandle.path;
            await refreshExplorer();
            api.events.emit('workspace-opened', { path: rootDirectoryHandle.path });
        }
    } catch (err) {
        console.error('Directory pipeline configuration closed.', err);
    }
}

async function handleOpenFile(fileHandle) {
    hideWelcomePage();
    folding.clear();
    const actualHandle = fileHandle.handle ? fileHandle.handle : fileHandle;

    if (actualHandle.isSettings) {
        activeFileHandle = actualHandle;
        selectedHandle = actualHandle;
        
        // Hide standard file editor wrappers
        document.getElementById('line-gutter').style.display = 'none';
        document.getElementById('editor-surface-box').style.display = 'none';
        document.getElementById('minimap-gutter').style.display = 'none';
        
        const settingsPanel = document.getElementById('settings-panel');
        settingsPanel.classList.remove('hidden');
        settingsPanel.style.display = 'flex';
        
        filePathDisplay.textContent = "Editor / Settings";
        
        updateGoLiveVisibility('');
        updateRunButtonVisibility('');
        updateTabsUI();
        await refreshExplorer();
        return;
    }

    if (actualHandle.isPluginDetails) {
        activeFileHandle = actualHandle;
        selectedHandle = actualHandle;

        // Hide standard file editor wrappers
        document.getElementById('line-gutter').style.display = 'none';
        document.getElementById('editor-surface-box').style.display = 'none';
        document.getElementById('minimap-gutter').style.display = 'none';
        document.getElementById('settings-panel').style.display = 'none';

        // Reveal and render Details Viewport
        const detailsPanel = document.getElementById('plugin-details-panel');
        detailsPanel.classList.remove('hidden');
        detailsPanel.style.display = 'flex';

        renderPluginDetailsPage(detailsPanel, actualHandle.plugin);

        filePathDisplay.textContent = `${actualHandle.plugin.type === 'ide' ? 'IDE' : 'Extension'} / ${actualHandle.plugin.name}`;
        updateGoLiveVisibility('');
        updateRunButtonVisibility('');
        updateTabsUI();
        await refreshExplorer();
        return;
    }

    // Standard file tab: Ensure standard editor viewports are visible
    document.getElementById('line-gutter').style.display = 'flex';
    document.getElementById('editor-surface-box').style.display = 'block';
    document.getElementById('minimap-gutter').style.display = 'block';
    
    const settingsPanel = document.getElementById('settings-panel');
    settingsPanel.classList.add('hidden');
    settingsPanel.style.display = 'none';

    // Hide Details Viewport
    const detailsPanel = document.getElementById('plugin-details-panel');
    detailsPanel.classList.add('hidden');
    detailsPanel.style.display = 'none';

    try {
        if (!openTabs.find(t => fileKey(t) === fileKey(actualHandle))) {
            openTabs.push(actualHandle);
        }
        activeFileHandle = actualHandle;
        selectedHandle = actualHandle;

        if (fileHandle.parent) {
            selectedDirectoryContext = fileHandle.parent;
        }

        let contents;
        if (tabContentsCache.has(fileKey(actualHandle))) {
            contents = tabContentsCache.get(fileKey(actualHandle));
        } else {
            // Normalize CRLF (\r\n) line endings to LF (\n) on load to prevent character drift (Added Fix)
            contents = (await readFileContents(activeFileHandle)).replace(/\r\n/g, '\n');
            tabContentsCache.set(fileKey(actualHandle), contents);
        }

        editor.value = contents;
        window.lastTextLength = contents.length; // Track length for real-time offset adjustments (Added Fix)
        editor.disabled = false;
        btnSaveFile.disabled = false;
        filePathDisplay.textContent = "Workspace / " + activeFileHandle.name;
        
        // Restore cached diagnostics for this file if they exist (Added Fix)
        const activePath = activeFileHandle.path ? activeFileHandle.path.toLowerCase() : '';
        window.activeDiagnostics = window.activeDiagnosticsCache.get(activePath) || [];
        // Restore any semantic tokens computed on a previous visit for an instant paint;
        // a fresh request below supersedes them once the server responds.
        window.activeSemanticTokens = window.semanticTokensCache.get(activePath) || [];

        updateGoLiveVisibility(activeFileHandle.name);
        updateRunButtonVisibility(activeFileHandle.name);
        updateTabsUI();
        runLayoutRenderEngine();
        await refreshExplorer();

        // Broadcast tab focus to plugin subscribers (outline views, problem panels, etc.)
        api.events.emit('file-opened', {
            path: activeFileHandle.path || activeFileHandle.name,
            name: activeFileHandle.name,
            contents
        });

        // Check if an LSP client is registered for this file extension
        const fileExt = activeFileHandle.name.split('.').pop().toLowerCase();
        const langConfig = api.languages.get(fileExt);
        const lspKey = langConfig ? langConfig.name.toLowerCase() : fileExt;
        const lspEntry = api.languages.getLspClient(lspKey) || api.languages.getLspClient(fileExt);

        console.log(`[LSP Debug] File: ${activeFileHandle.name} | Extension: ${fileExt} | Lookup Key: ${lspKey} | Found Client:`, !!lspEntry);

        if (lspEntry && rootDirectoryHandle) {
            const client = lspEntry.client;
            // Removed noisy console.log statements
            client.start(lspEntry.command, lspEntry.args, rootDirectoryHandle.path, lspEntry.initializationOptions).then((started) => {
                if (started) {
                    // Resolve official LSP Language ID mappings
                    const lspLangId = (fileExt === 'js' || fileExt === 'mjs' || fileExt === 'cjs') ? 'javascript' :
                                      (fileExt === 'py') ? 'python' :
                                      (fileExt === 'ts') ? 'typescript' :
                                      fileExt;

                    // Ensure no \r characters are sent to the LSP on open (Added Fix)
                    const cleanContents = contents.replace(/\r/g, '');
                    client.didOpen(activeFileHandle.path, lspLangId, cleanContents);

                    // Paint semantic highlighting as soon as the server can answer.
                    scheduleSemanticTokens(lspEntry, activeFileHandle, true);

                    // Register the diagnostics listener exactly once per client instance
                    if (!client.diagnosticsRegistered) {
                        client.diagnosticsRegistered = true;
                        client.onNotification('textDocument/publishDiagnostics', (params) => {
                            const count = params.diagnostics.length;
                            const cleanPath = uriToPath(params.uri).toLowerCase();

                            let fileText = null;
                            for (const [key, text] of tabContentsCache.entries()) {
                                if (key.toLowerCase() === cleanPath) {
                                    fileText = text;
                                    break;
                                }
                            }
                            if (!fileText) {
                                fileText = editor.value;
                            }
                            
                            const mappedDiags = params.diagnostics.map(diag => {
                                let startOffset = lspPositionToOffset(fileText, diag.range.start.line, diag.range.start.character);
                                let endOffset = lspPositionToOffset(fileText, diag.range.end.line, diag.range.end.character);
                                
                                if (startOffset === endOffset) {
                                    if (startOffset > 0) {
                                        startOffset = startOffset - 1;
                                    } else {
                                        endOffset = startOffset + 1;
                                    }
                                }

                                startOffset = Math.max(0, Math.min(fileText.length - 1, startOffset));
                                endOffset = Math.max(1, Math.min(fileText.length, endOffset));

                                // Carry line/column coordinates so list views (Problems
                                // panels) can display and jump without re-deriving them.
                                const pos = offsetToLspPosition(fileText, startOffset);

                                return {
                                    start: startOffset,
                                    end: endOffset,
                                    line: pos.line,
                                    col: pos.character,
                                    severity: diag.severity,
                                    message: diag.message
                                };
                            });

                            window.activeDiagnosticsCache.set(cleanPath, mappedDiags);

                            // Broadcast to plugin subscribers (e.g. Problems panels)
                            api.events.emit('diagnostics-updated', {
                                path: cleanPath,
                                diagnostics: mappedDiags
                            });

                            const currentActivePath = activeFileHandle && activeFileHandle.path ? activeFileHandle.path.toLowerCase() : '';
                            if (cleanPath === currentActivePath) {
                                window.activeDiagnostics = mappedDiags;
                                runLayoutRenderEngine();
                            }

                            // Completely commented out to remove LSP terminal message flood
                            /*
                            if (count > 0) {
                                printToTerminal(`[LSP Diagnostics] "${activeFileHandle.name}" has ${count} warning/error nodes reported by language server.`, 'system');
                            }
                            */
                        });
                    }
                }
            });
        }
    } catch (err) {
        alert('Could not open target resource path stream.');
    }
}

async function handleSaveFile() {
    if (!activeFileHandle) return;
    try {
        // Persist the reconstructed full document so folded regions are written intact.
        const fullText = folding.getFullText(editor.value);
        await saveFileContents(activeFileHandle, fullText);
        tabContentsCache.set(fileKey(activeFileHandle), fullText);
        dirtyFiles.delete(fileKey(activeFileHandle));
        updateTabsUI();

        // Broadcast to plugin subscribers (e.g. format-on-save pipelines)
        api.events.emit('file-saved', {
            path: activeFileHandle.path || activeFileHandle.name,
            name: activeFileHandle.name,
            contents: fullText
        });
    } catch (err) {
        alert('Disk write execution target exception errors encountered.');
    }
}

async function handleCreateFile() {
    const targetDir = selectedDirectoryContext || rootDirectoryHandle;
    const fileName = await showPrompt("Create file inside [" + targetDir.name + "]:", 'filename.html');
    if (!fileName) return;
    try {
        const newFileHandle = await createFileHandle(targetDir, fileName);
        await refreshExplorer();
        handleOpenFile(newFileHandle);
    } catch (err) {
        alert('Could not allocate target workspace file node.');
    }
}

async function handleCreateFolder() {
    const targetDir = selectedDirectoryContext || rootDirectoryHandle;
    const folderName = await showPrompt("Create directory inside [" + targetDir.name + "]:", 'folder_name');
    if (!folderName) return;
    try {
        await createDirectoryHandle(targetDir, folderName);
        await refreshExplorer();
    } catch (err) {
        alert('Could not allocate target directory infrastructure.');
    }
}

async function handleMoveItem(sourceItem, targetDirectoryHandle) {
    try {
        const isElectronApp = typeof window !== 'undefined' && window.process && window.process.type;
        
        if (isElectronApp) {
            // Electron Direct High-Performance Move:
            // Uses Node's fs.renameSync to relocate files and folders of any size 
            // instantly, safely, and recursively!
            const fsNode = window.require('fs');
            const pathNode = window.require('path');
            
            const oldPath = sourceItem.handle.path;
            const newPath = pathNode.join(targetDirectoryHandle.path, sourceItem.name);
            
            // Check if source and destination are identical
            if (oldPath === newPath) return;

            fsNode.renameSync(oldPath, newPath);

            // If a moved file was currently open in the tabs, update its file handle reference
            if (sourceItem.kind === 'file') {
                const sourceKey = fileKey(sourceItem.handle);
                const newHandle = {
                    kind: 'file',
                    name: sourceItem.name,
                    path: newPath,
                    isElectronMock: true,
                    getFile: async () => ({
                        text: async () => fsNode.readFileSync(newPath, 'utf8')
                    })
                };

                const tabIdx = openTabs.findIndex(t => fileKey(t) === sourceKey);
                if (tabIdx !== -1) openTabs[tabIdx] = newHandle;

                if (tabContentsCache.has(sourceKey)) {
                    tabContentsCache.set(fileKey(newHandle), tabContentsCache.get(sourceKey));
                    tabContentsCache.delete(sourceKey);
                }
                if (dirtyFiles.has(sourceKey)) {
                    dirtyFiles.delete(sourceKey);
                    dirtyFiles.add(fileKey(newHandle));
                }
                if (activeFileHandle && fileKey(activeFileHandle) === sourceKey) {
                    activeFileHandle = newHandle;
                    selectedHandle = newHandle;
                }
            }
        } else {
            // Web File System API Fallback:
            // Uses our abstract fs-handler utility methods correctly instead of bypassing them.
            if (sourceItem.kind === 'file') {
                const fileData = await readFileContents(sourceItem.handle);
                const newFileHandle = await createFileHandle(targetDirectoryHandle, sourceItem.name);
                await saveFileContents(newFileHandle, fileData);
                
                const sourceKey = fileKey(sourceItem.handle);
                const tabIdx = openTabs.findIndex(t => fileKey(t) === sourceKey);
                if (tabIdx !== -1) openTabs[tabIdx] = newFileHandle;

                if (tabContentsCache.has(sourceKey)) {
                    tabContentsCache.set(fileKey(newFileHandle), tabContentsCache.get(sourceKey));
                    tabContentsCache.delete(sourceKey);
                }
                if (dirtyFiles.has(sourceKey)) {
                    dirtyFiles.delete(sourceKey);
                    dirtyFiles.add(fileKey(newFileHandle));
                }
                if (activeFileHandle && fileKey(activeFileHandle) === sourceKey) {
                    activeFileHandle = newFileHandle;
                    selectedHandle = newFileHandle;
                }
            } else {
                // Creates folder on the web 
                await createDirectoryHandle(targetDirectoryHandle, sourceItem.name);
            }
            // Safely delete the source file/directory using our abstraction wrapper
            await removeEntryHandle(sourceItem.parent, sourceItem.name);
        }
        
        await refreshExplorer();
        updateTabsUI();
    } catch (err) {
        console.error('Drag movement exception:', err);
        alert(`Move operation failed: ${err.message}`);
    }
}

/**
 * Resets the workspace to its "no open tab" state: blank, disabled editor, hidden
 * settings/details panels, restored editor viewports, and the IDE welcome splash when one
 * is registered. Shared by single- and bulk-close paths so they stay in lock-step.
 */
function resetToEmptyEditorState() {
    activeFileHandle = null;
    selectedHandle = null;
    editor.value = '';
    editor.disabled = true;
    btnSaveFile.disabled = true;
    filePathDisplay.textContent = rootDirectoryHandle ? "Workspace: " + rootDirectoryHandle.name : 'Workspace Closed';
    updateGoLiveVisibility('');
    updateRunButtonVisibility('');

    const settingsPanel = document.getElementById('settings-panel');
    settingsPanel.classList.add('hidden');
    settingsPanel.style.display = 'none';

    const detailsPanel = document.getElementById('plugin-details-panel');
    detailsPanel.classList.add('hidden');
    detailsPanel.style.display = 'none';

    document.getElementById('line-gutter').style.display = 'flex';
    document.getElementById('editor-surface-box').style.display = 'block';
    document.getElementById('minimap-gutter').style.display = 'block';

    runLayoutRenderEngine();

    // Reactivate the IDE welcome splash if no open records remain.
    const activeIde = api.workspace.getActiveIDE();
    if (activeIde && typeof activeIde.getWelcomePageHTML === 'function') {
        showWelcomePage(activeIde.getWelcomePageHTML());
    }
}

/**
 * Closes a set of tabs in one pass. Prompts a single confirmation covering every dirty
 * tab in the set, then reactivates a surviving tab (or the empty state) if the active tab
 * was among those closed. Returns false when the user cancels the confirmation.
 */
function closeTabsBatch(handles) {
    const keys = new Set();
    handles.forEach(h => { const k = fileKey(h); if (k) keys.add(k); });
    if (keys.size === 0) return false;

    // One confirmation for the whole batch when any target has unsaved changes.
    const dirtyHandles = handles.filter(h => dirtyFiles.has(fileKey(h)));
    if (dirtyHandles.length === 1) {
        if (!confirm('"' + dirtyHandles[0].name + '" contains unsaved changes. Close anyway?')) return false;
    } else if (dirtyHandles.length > 1) {
        if (!confirm(`${dirtyHandles.length} tabs contain unsaved changes. Close them anyway?`)) return false;
    }

    const activeClosed = activeFileHandle && keys.has(fileKey(activeFileHandle));

    openTabs = openTabs.filter(t => !keys.has(fileKey(t)));
    keys.forEach(k => { dirtyFiles.delete(k); tabContentsCache.delete(k); });

    if (activeClosed) {
        if (openTabs.length > 0) {
            handleOpenFile(openTabs[openTabs.length - 1]);
        } else {
            resetToEmptyEditorState();
        }
    }
    updateTabsUI();
    refreshExplorer();
    return true;
}

function handleCloseTab(fileHandle) {
    closeTabsBatch([fileHandle]);
}

/**
 * Builds and opens the tab strip's right-click menu: single close plus the bulk
 * operations (others / to the right / saved / all), then path helpers.
 */
function handleTabContextMenu(event, fileHandle) {
    const key = fileKey(fileHandle);
    const idx = openTabs.findIndex(t => fileKey(t) === key);
    const tabsToRight = idx === -1 ? [] : openTabs.slice(idx + 1);
    const otherTabs = openTabs.filter(t => fileKey(t) !== key);
    const savedTabs = openTabs.filter(t => !dirtyFiles.has(fileKey(t)));
    const diskPath = fileHandle.path && !String(fileHandle.path).startsWith('virtual://')
        ? fileHandle.path
        : (fileHandle.handle && fileHandle.handle.path) || null;

    const items = [
        {
            label: 'Close', icon: 'fa-regular fa-rectangle-xmark', shortcut: 'Ctrl+W',
            onClick: () => handleCloseTab(fileHandle)
        },
        {
            label: 'Close Others', icon: 'fa-regular fa-clone',
            disabled: otherTabs.length === 0,
            onClick: () => closeTabsBatch(otherTabs)
        },
        {
            label: 'Close to the Right', icon: 'fa-solid fa-angles-right',
            disabled: tabsToRight.length === 0,
            onClick: () => closeTabsBatch(tabsToRight)
        },
        {
            label: 'Close Saved', icon: 'fa-regular fa-floppy-disk',
            disabled: savedTabs.length === 0,
            onClick: () => closeTabsBatch(savedTabs)
        },
        {
            label: 'Close All', icon: 'fa-solid fa-xmark',
            disabled: openTabs.length === 0,
            onClick: () => closeTabsBatch([...openTabs])
        },
        { separator: true },
        {
            label: 'Copy Path', icon: 'fa-regular fa-copy',
            disabled: !diskPath,
            onClick: () => copyTextToClipboard(diskPath)
        },
        ...(isElectronApp && diskPath ? [{
            label: 'Reveal in File Explorer', icon: 'fa-regular fa-folder-open',
            onClick: () => revealInSystemExplorer(diskPath)
        }] : [])
    ];

    showContextMenu(event.clientX, event.clientY, items);
}

async function handleProjectItemDelete(item) {
    const confirmDelete = confirm('Permanently delete "' + item.name + '" from disk?');
    if (!confirmDelete) return;
    try {
        handleCloseTab(item.handle);
        await removeEntryHandle(item.parent, item.name);
        await refreshExplorer();
        api.events.emit('file-deleted', {
            path: item.handle.path || item.name,
            name: item.name,
            kind: item.kind
        });
    } catch (err) {
        alert('FileSystem execution access context authorization denial parameters triggered.');
    }
}

// =====================================================================
//  Explorer Context Menu
// =====================================================================

// Pending cut/copy operation shared between the explorer menu and paste targets.
let explorerClipboard = null; // { item, mode: 'copy' | 'cut' }

/**
 * Resolves the directory an action should target: the folder itself when a directory was
 * clicked, otherwise the file's parent. Falls back to the workspace root for empty space.
 */
function resolveTargetDirectory(item) {
    if (!item) return rootDirectoryHandle;
    return item.kind === 'directory' ? item.handle : item.parent;
}

async function handleContextCreate(item, kind) {
    const targetDir = resolveTargetDirectory(item) || rootDirectoryHandle;
    if (!targetDir) return;

    const isFile = kind === 'file';
    const name = await showPrompt(
        `New ${isFile ? 'file' : 'folder'} inside [${targetDir.name}]:`,
        isFile ? 'filename.ext' : 'folder-name'
    );
    if (!name) return;

    if (await entryExists(targetDir, name)) {
        alert(`"${name}" already exists in ${targetDir.name}.`);
        return;
    }

    try {
        if (isFile) {
            const handle = await createFileHandle(targetDir, name);
            // Reveal the new file by expanding the folder it landed in.
            if (item && item.kind === 'directory') expandedFolders.add(item.treePath);
            await refreshExplorer();
            await handleOpenFile(handle);
            api.events.emit('file-created', { path: handle.path || name, name, kind: 'file' });
        } else {
            const handle = await createDirectoryHandle(targetDir, name);
            if (item && item.kind === 'directory') expandedFolders.add(item.treePath);
            await refreshExplorer();
            api.events.emit('file-created', { path: handle.path || name, name, kind: 'directory' });
        }
    } catch (err) {
        alert(`Could not create "${name}": ${err.message}`);
    }
}

async function handleContextRename(item) {
    if (!item) return;
    const newName = await showPrompt(`Rename "${item.name}" to:`, item.name);
    if (!newName || newName === item.name) return;

    if (await entryExists(item.parent, newName)) {
        alert(`"${newName}" already exists in this folder.`);
        return;
    }

    try {
        const oldKey = fileKey(item.handle);
        const newHandle = await renameEntryHandle(item.parent, item, newName);

        // Re-point any open tab at the renamed file so edits keep saving to the right path.
        if (item.kind === 'file') {
            const tabIdx = openTabs.findIndex(t => fileKey(t) === oldKey);
            if (tabIdx !== -1) openTabs[tabIdx] = newHandle;

            if (tabContentsCache.has(oldKey)) {
                tabContentsCache.set(fileKey(newHandle), tabContentsCache.get(oldKey));
                tabContentsCache.delete(oldKey);
            }
            if (dirtyFiles.has(oldKey)) {
                dirtyFiles.delete(oldKey);
                dirtyFiles.add(fileKey(newHandle));
            }
            if (activeFileHandle && fileKey(activeFileHandle) === oldKey) {
                activeFileHandle = newHandle;
                selectedHandle = newHandle;
                filePathDisplay.textContent = newHandle.path || newHandle.name;
            }
        } else {
            // A renamed folder invalidates the cached paths of everything beneath it.
            const oldPath = item.handle.path;
            const newPath = newHandle.path;
            if (oldPath && newPath) {
                openTabs.forEach(tab => {
                    if (tab.path && tab.path.startsWith(oldPath)) {
                        tab.path = newPath + tab.path.slice(oldPath.length);
                    }
                });
            }
            expandedFolders.clear();
        }

        await refreshExplorer();
        updateTabsUI();
        api.events.emit('file-renamed', {
            oldPath: oldKey,
            path: newHandle.path || newName,
            name: newName,
            kind: item.kind
        });
    } catch (err) {
        alert(`Rename failed: ${err.message}`);
    }
}

async function handleContextDuplicate(item) {
    if (!item) return;
    try {
        const name = await resolveAvailableName(item.parent, item.name, item.kind);
        await copyEntryHandle(item, item.parent, name);
        await refreshExplorer();
    } catch (err) {
        alert(`Duplicate failed: ${err.message}`);
    }
}

async function handleContextPaste(item) {
    if (!explorerClipboard) return;
    const targetDir = resolveTargetDirectory(item) || rootDirectoryHandle;
    if (!targetDir) return;

    const source = explorerClipboard.item;
    try {
        const taken = await entryExists(targetDir, source.name);

        if (explorerClipboard.mode === 'cut') {
            // A move cannot silently rename — refuse rather than clobber the destination.
            if (taken) {
                alert(`"${source.name}" already exists in ${targetDir.name}.`);
                return;
            }
            await handleMoveItem(source, targetDir);
            explorerClipboard = null;
        } else {
            // Pasting a copy beside itself gets a " copy" suffix instead of colliding.
            const name = taken
                ? await resolveAvailableName(targetDir, source.name, source.kind)
                : source.name;
            await copyEntryHandle(source, targetDir, name);
            await refreshExplorer();
        }
    } catch (err) {
        alert(`Paste failed: ${err.message}`);
    }
}

async function copyTextToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
    } catch (err) {
        // Clipboard API is unavailable when the window isn't focused; fall back to a
        // throwaway textarea so the action still succeeds.
        const scratch = document.createElement('textarea');
        scratch.value = text;
        scratch.style.position = 'fixed';
        scratch.style.opacity = '0';
        document.body.appendChild(scratch);
        scratch.select();
        try { document.execCommand('copy'); } catch (e) { /* best effort */ }
        scratch.remove();
    }
}

function revealInSystemExplorer(targetPath) {
    if (ipcRenderer && targetPath) {
        ipcRenderer.invoke('reveal-in-explorer', targetPath);
    }
}

function openPathInTerminal(item) {
    const dir = item ? (item.kind === 'directory' ? item.handle.path : (item.parent && item.parent.path))
                     : (rootDirectoryHandle && rootDirectoryHandle.path);
    if (!dir) return;
    if (bottomPanel.classList.contains('hidden-panel')) toggleTerminal();
    updateTerminalPrompt(dir);
    printToTerminal(`[System] Terminal working directory set to ${dir}`, 'system');
}

/**
 * Builds and opens the explorer right-click menu.
 * `item` is null when the user right-clicked empty space (the workspace root).
 */
function handleExplorerContextMenu(event, item) {
    if (!rootDirectoryHandle) return;

    const isEmptyArea = !item;
    const isDirectory = !isEmptyArea && item.kind === 'directory';
    const isFile = !isEmptyArea && item.kind === 'file';
    const canCreateInside = isEmptyArea || isDirectory;
    const isElectronApp = !!ipcRenderer;

    // Right-clicking selects, matching the behaviour of clicking an entry.
    if (item) {
        selectedHandle = item.handle;
        selectedDirectoryContext = resolveTargetDirectory(item);
    } else {
        selectedDirectoryContext = rootDirectoryHandle;
    }

    const ctx = {
        item: item || null,
        kind: isEmptyArea ? 'root' : item.kind,
        name: isEmptyArea ? rootDirectoryHandle.name : item.name,
        path: isEmptyArea ? rootDirectoryHandle.path : (item.handle.path || item.name),
        handle: isEmptyArea ? rootDirectoryHandle : item.handle,
        parent: isEmptyArea ? null : item.parent,
        isRoot: isEmptyArea,
        isEmptyArea,
        rootPath: rootDirectoryHandle.path || '',
        api,
        refresh: () => refreshExplorer()
    };

    const builtinGroups = {
        new: canCreateInside ? [
            {
                label: 'New File…', icon: 'fa-regular fa-file', _order: 1,
                onClick: () => handleContextCreate(item, 'file')
            },
            {
                label: 'New Folder…', icon: 'fa-regular fa-folder', _order: 2,
                onClick: () => handleContextCreate(item, 'directory')
            }
        ] : [],

        open: isFile ? [
            {
                label: 'Open', icon: 'fa-regular fa-file-lines', _order: 1,
                onClick: () => handleOpenFile(item)
            }
        ] : [],

        clipboard: isEmptyArea ? [
            {
                label: 'Paste', icon: 'fa-regular fa-paste', _order: 3,
                disabled: !explorerClipboard,
                onClick: () => handleContextPaste(item)
            }
        ] : [
            {
                label: 'Cut', icon: 'fa-solid fa-scissors', _order: 1,
                onClick: () => { explorerClipboard = { item, mode: 'cut' }; }
            },
            {
                label: 'Copy', icon: 'fa-regular fa-copy', _order: 2,
                onClick: () => { explorerClipboard = { item, mode: 'copy' }; }
            },
            {
                label: 'Paste', icon: 'fa-regular fa-paste', _order: 3,
                disabled: !explorerClipboard,
                onClick: () => handleContextPaste(item)
            }
        ],

        edit: isEmptyArea ? [] : [
            {
                label: 'Rename…', icon: 'fa-solid fa-i-cursor', shortcut: 'F2', _order: 1,
                onClick: () => handleContextRename(item)
            },
            {
                label: 'Duplicate', icon: 'fa-regular fa-clone', _order: 2,
                onClick: () => handleContextDuplicate(item)
            }
        ],

        copy: isEmptyArea ? [] : [
            {
                label: 'Copy Path', icon: 'fa-regular fa-copy', _order: 1,
                onClick: () => copyTextToClipboard(item.handle.path || item.name)
            },
            {
                label: 'Copy Relative Path', icon: 'fa-solid fa-diagram-project', _order: 2,
                onClick: async () => {
                    const parts = await resolveHandle(rootDirectoryHandle, item.handle);
                    await copyTextToClipboard(parts ? parts.join('/') : item.name);
                }
            }
        ],

        reveal: [
            ...(isElectronApp ? [{
                label: 'Reveal in File Explorer', icon: 'fa-regular fa-folder-open', _order: 1,
                onClick: () => revealInSystemExplorer(ctx.path)
            }] : []),
            ...(canCreateInside ? [{
                label: 'Open in Terminal', icon: 'fa-solid fa-terminal', _order: 2,
                onClick: () => openPathInTerminal(item)
            }] : []),
            {
                label: 'Refresh Explorer', icon: 'fa-solid fa-arrows-rotate', _order: 3,
                onClick: () => refreshExplorer()
            },
            ...(isEmptyArea ? [{
                label: 'Collapse All Folders', icon: 'fa-solid fa-compress', _order: 4,
                onClick: async () => { expandedFolders.clear(); await refreshExplorer(); }
            }] : [])
        ],

        danger: isEmptyArea ? [] : [
            {
                label: 'Delete', icon: 'fa-regular fa-trash-can', danger: true, shortcut: 'Del', _order: 1,
                onClick: () => handleProjectItemDelete(item)
            }
        ]
    };

    // '*' marks where plugin-invented groups are spliced in — Delete always stays last.
    const groupOrder = ['new', 'open', 'clipboard', 'edit', 'copy', 'reveal', 'plugins', '*', 'danger'];
    const items = mergeContributedItems(builtinGroups, groupOrder, api.menus.getExplorerItems(), ctx);

    showContextMenu(event.clientX, event.clientY, items);
}

function handleTabReorder(sourceKey, targetKey) {
    const sourceIdx = openTabs.findIndex(t => fileKey(t) === sourceKey);
    const targetIdx = openTabs.findIndex(t => fileKey(t) === targetKey);
    if (sourceIdx !== -1 && targetIdx !== -1) {
        const [draggedTab] = openTabs.splice(sourceIdx, 1);
        openTabs.splice(targetIdx, 0, draggedTab);
        updateTabsUI();
    }
}

/**
 * Transient corner notification. Stacks vertically and self-dismisses.
 * `type` is one of 'info' | 'success' | 'warning' | 'error'.
 */
function showToast(message, type = 'info') {
    let stack = document.getElementById('toast-stack');
    if (!stack) {
        stack = document.createElement('div');
        stack.id = 'toast-stack';
        document.body.appendChild(stack);
    }

    const icons = {
        info: 'fa-circle-info',
        success: 'fa-circle-check',
        warning: 'fa-triangle-exclamation',
        error: 'fa-circle-exclamation'
    };

    const toast = document.createElement('div');
    toast.className = `editor-toast toast-${type}`;
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span></span>`;
    toast.querySelector('span').textContent = message;
    stack.appendChild(toast);

    // Allow the entry transition to run before scheduling the exit.
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 250);
    }, 3200);

    return toast;
}
window.showEditorToast = showToast;

function showPrompt(title, placeholder = '') {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-prompt-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalInput = document.getElementById('modal-input');
        const okBtn = document.getElementById('modal-ok-btn');
        const cancelBtn = document.getElementById('modal-cancel-btn');

        if (!modal || !modalTitle || !modalInput || !okBtn || !cancelBtn) {
            resolve(null);
            return;
        }

        modalTitle.textContent = title;
        modalInput.value = '';
        modalInput.placeholder = placeholder;
        modal.classList.remove('hidden-modal');
        
        setTimeout(() => modalInput.focus(), 50);

        function handleOk() {
            cleanup();
            resolve(modalInput.value.trim());
        }

        function handleCancel() {
            cleanup();
            resolve(null);
        }

        function handleKeydown(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleOk();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
            }
        }

        function cleanup() {
            modal.classList.add('hidden-modal');
            okBtn.removeEventListener('click', handleOk);
            cancelBtn.removeEventListener('click', handleCancel);
            modalInput.removeEventListener('keydown', handleKeydown);
        }

        okBtn.addEventListener('click', handleOk);
        cancelBtn.addEventListener('click', handleCancel);
        modalInput.addEventListener('keydown', handleKeydown);
    });
}

function showCustomModal(config) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.id = 'dynamic-custom-modal';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.55)';
        modal.style.display = 'flex';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        modal.style.zIndex = '2000';

        const content = document.createElement('div');
        content.className = 'modal-content';
        content.style.backgroundColor = 'var(--bg-sidebar)';
        content.style.border = '1px solid var(--border-color)';
        content.style.borderRadius = '6px';
        content.style.padding = '16px';
        content.style.width = '350px';
        content.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.5)';
        content.style.display = 'flex';
        content.style.flexDirection = 'column';
        content.style.gap = '12px';

        const title = document.createElement('h3');
        title.style.fontSize = '14px';
        title.style.fontWeight = '600';
        title.style.color = 'var(--text-main)';
        title.textContent = config.title || 'Workspace Dialog';
        content.appendChild(title);

        const formBody = document.createElement('div');
        formBody.style.display = 'flex';
        formBody.style.flexDirection = 'column';
        formBody.style.gap = '10px';

        const inputElements = {};

        (config.inputs || []).forEach(inputConfig => {
            const itemDiv = document.createElement('div');
            itemDiv.style.display = 'flex';
            itemDiv.style.flexDirection = 'column';
            itemDiv.style.gap = '4px';

            const label = document.createElement('label');
            label.style.fontSize = '11px';
            label.style.color = 'var(--text-muted)';
            label.textContent = inputConfig.label;
            itemDiv.appendChild(label);

            // (Inside showCustomModal in js/app.js)
            let input;
            if (inputConfig.type === 'select') {
                input = document.createElement('select');
                input.style.backgroundColor = 'var(--bg-dark)';
                input.style.border = '1px solid var(--border-color)';
                input.style.color = 'var(--text-main)';
                input.style.padding = '6px';
                input.style.borderRadius = '4px';
                input.style.outline = 'none';
                input.style.fontSize = '12px';

                (inputConfig.options || []).forEach(optVal => {
                    const opt = document.createElement('option');
                    opt.value = optVal;
                    opt.textContent = optVal;
                    if (optVal === inputConfig.defaultValue) opt.selected = true;
                    input.appendChild(opt);
                });
                // Convert to custom component once inserted into the DOM
                setTimeout(() => {
                    window.convertSelectToCustom(input, () => '<i class="fa-solid fa-sliders" style="color: var(--accent-color);"></i>');
                }, 0);
            } else if (inputConfig.type === 'checkbox') {
                itemDiv.style.flexDirection = 'row';
                itemDiv.style.alignItems = 'center';
                itemDiv.style.justifyContent = 'space-between';
                input = document.createElement('input');
                input.type = 'checkbox';
                input.style.width = '16px';
                input.style.height = '16px';
                input.style.cursor = 'pointer';
                input.checked = !!inputConfig.defaultValue;
            } else {
                input = document.createElement('input');
                input.type = inputConfig.type || 'text';
                input.placeholder = inputConfig.placeholder || '';
                input.value = inputConfig.defaultValue !== undefined ? inputConfig.defaultValue : '';
                input.style.backgroundColor = 'var(--bg-dark)';
                input.style.border = '1px solid var(--border-color)';
                input.style.color = 'var(--text-main)';
                input.style.padding = '8px';
                input.style.borderRadius = '4px';
                input.style.outline = 'none';
                input.style.fontSize = '12px';
            }

            itemDiv.appendChild(input);
            formBody.appendChild(itemDiv);
            inputElements[inputConfig.id] = input;
        });

        content.appendChild(formBody);

        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'modal-buttons flex-row';
        buttonsDiv.style.justifyContent = 'flex-end';
        buttonsDiv.style.gap = '8px';
        buttonsDiv.style.marginTop = '8px';

        const cancelBtn = document.createElement('button');
        cancelBtn.style.background = 'none';
        cancelBtn.style.border = '1px solid var(--border-color)';
        cancelBtn.textContent = config.cancelLabel || 'Cancel';
        buttonsDiv.appendChild(cancelBtn);

        const okBtn = document.createElement('button');
        okBtn.style.backgroundColor = 'var(--accent-color)';
        okBtn.style.borderColor = 'transparent';
        okBtn.style.color = '#ffffff';
        okBtn.textContent = config.okLabel || 'OK';
        buttonsDiv.appendChild(okBtn);

        content.appendChild(buttonsDiv);
        modal.appendChild(content);
        document.body.appendChild(modal);

        const firstTextInput = formBody.querySelector('input[type="text"]');
        if (firstTextInput) {
            setTimeout(() => firstTextInput.focus(), 50);
        }

        function handleOk() {
            const results = {};
            Object.entries(inputElements).forEach(([id, element]) => {
                results[id] = element.type === 'checkbox' ? element.checked : element.value;
            });
            cleanup();
            resolve(results);
        }

        function handleCancel() {
            cleanup();
            resolve(null);
        }

        function handleKeydown(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleOk();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
            }
        }

        function cleanup() {
            modal.remove();
            okBtn.removeEventListener('click', handleOk);
            cancelBtn.removeEventListener('click', handleCancel);
            modal.removeEventListener('keydown', handleKeydown);
        }

        okBtn.addEventListener('click', handleOk);
        cancelBtn.addEventListener('click', handleCancel);
        modal.addEventListener('keydown', handleKeydown);
    });
}

// Bind activity panel toggles
const actTerminal = document.getElementById('act-terminal');
const closePanelBtn = document.getElementById('close-panel-btn');
if (actTerminal) actTerminal.addEventListener('click', toggleTerminal);
if (closePanelBtn) closePanelBtn.addEventListener('click', toggleTerminal);

const closeRightPanelBtn = document.getElementById('close-right-panel-btn');
if (closeRightPanelBtn) closeRightPanelBtn.addEventListener('click', collapseRightPanel);

const terminalTabBtn = document.getElementById('bottom-tab-terminal');
if (terminalTabBtn) terminalTabBtn.addEventListener('click', () => switchBottomTab('terminal'));

// Prosense Toggle setup
if (prosenseToggle) {
    const isEnabled = localStorage.getItem('prosense-enabled') !== 'false';
    prosenseToggle.checked = isEnabled;
    localStorage.setItem('prosense-enabled', isEnabled);
    prosenseToggle.addEventListener('change', (e) => {
        localStorage.setItem('prosense-enabled', e.target.checked);
    });
}

// Initializing the minimap & ProSense components
initMinimapScroll(editor, minimapGutter, minimapIndicator);
initProSense(editor, editorSurfaceBox);

// Feed ProSense with real language-server completions for any active file whose LSP
// client opted into `completion` and whose server advertises the capability. Returns an
// empty list otherwise, so ProSense simply falls back to its local suggestions.
setProSenseLspProvider(async (fileName) => {
    if (!activeFileHandle || !activeFileHandle.path) return [];

    const fileExt = activeFileHandle.name.split('.').pop().toLowerCase();
    const langConfig = api.languages.get(fileExt);
    const lspKey = langConfig ? langConfig.name.toLowerCase() : fileExt;
    const lspEntry = api.languages.getLspClient(lspKey) || api.languages.getLspClient(fileExt);

    if (!lspEntry || !lspEntry.features || !lspEntry.features.completion) return [];
    const client = lspEntry.client;
    if (!client || !client.isStarted || !client.hasCompletion()) return [];

    const pos = offsetToLspPosition(editor.value, editor.selectionStart);
    try {
        const res = await client.completion(activeFileHandle.path, pos.line, pos.character);
        return mapLspCompletions(res);
    } catch (err) {
        return [];
    }
});

// Initialize code folding — fold state is view-only and never dirties the buffer,
// so its onChange just repaints and keeps the diagnostics length tracker in sync.
folding.initFolding(editor, {
    onChange: () => {
        window.lastTextLength = editor.value.length;
        runLayoutRenderEngine();
    }
});

// Delegate clicks on the gutter fold arrows to collapse / expand regions.
if (lineGutter) {
    lineGutter.addEventListener('click', (e) => {
        const toggle = e.target.closest('.fold-toggle[data-fold-line]');
        if (!toggle) return;
        const line = parseInt(toggle.getAttribute('data-fold-line'), 10);
        if (!Number.isNaN(line)) folding.toggleFoldAtLine(line);
    });
}

// Initialize Terminal Panel Context
initTerminal(bottomPanel, terminalOutput, terminalInput, terminalPrompt);

// Initialize Find & Replace (Ctrl+F find, Ctrl+R replace)
initFindReplace();

/**
 * Sequential Boot Loader: Ensures core subsystems and plugins load 
 * prior to building selectors or configuring the workspace.
 */
async function bootEditor() {
    // Wire the editor facade so plugins can inspect and drive the live surface
    api.editor._attachHost({
        getText: () => (activeFileHandle ? folding.getFullText(editor.value) : ''),
        getActiveFile: () => {
            if (!activeFileHandle || activeFileHandle.isSettings || activeFileHandle.isPluginDetails) return null;
            return { path: activeFileHandle.path || activeFileHandle.name, name: activeFileHandle.name };
        },
        goToLine: (line, column) => jumpToEditorLine(line, column),
        openFileByPath: async (path) => {
            const targetKey = (path || '').toLowerCase();
            const tab = openTabs.find(t => fileKey(t).toLowerCase() === targetKey);
            if (!tab) return false;
            await handleOpenFile(tab);
            return true;
        },
        reloadActiveFile: async () => {
            if (!activeFileHandle || activeFileHandle.isSettings || activeFileHandle.isPluginDetails) return false;
            try {
                const contents = (await readFileContents(activeFileHandle)).replace(/\r\n/g, '\n');
                folding.clear();
                tabContentsCache.set(fileKey(activeFileHandle), contents);
                editor.value = contents;
                window.lastTextLength = contents.length;
                dirtyFiles.delete(fileKey(activeFileHandle));
                updateTabsUI();
                runLayoutRenderEngine();

                // Keep any running language server in sync with the reloaded buffer
                const fileExt = activeFileHandle.name.split('.').pop().toLowerCase();
                const langConfig = api.languages.get(fileExt);
                const lspKey = langConfig ? langConfig.name.toLowerCase() : fileExt;
                const lspEntry = api.languages.getLspClient(lspKey) || api.languages.getLspClient(fileExt);
                if (lspEntry && lspEntry.client && lspEntry.client.isStarted) {
                    const cachedVersions = (window.lspVersionCache = window.lspVersionCache || {});
                    const version = cachedVersions[fileKey(activeFileHandle)] = (cachedVersions[fileKey(activeFileHandle)] || 1) + 1;
                    lspEntry.client.didChange(activeFileHandle.path, version, contents.replace(/\r/g, ''));
                    scheduleSemanticTokens(lspEntry, activeFileHandle, true);
                }
                return true;
            } catch (err) {
                console.error('Active file reload failed:', err);
                return false;
            }
        },
        openBottomPanelTab: (id) => window.openBottomPanelTab(id),

        setText: (text) => {
            if (!activeFileHandle) return;
            folding.clear();
            editor.value = text;
            window.lastTextLength = text.length;
            dirtyFiles.add(fileKey(activeFileHandle));
            updateTabsUI();
            runLayoutRenderEngine();
        },

        getSelection: () => ({
            start: editor.selectionStart,
            end: editor.selectionEnd,
            text: editor.value.slice(editor.selectionStart, editor.selectionEnd)
        }),

        replaceSelection: (text) => {
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            editor.value = editor.value.slice(0, start) + text + editor.value.slice(end);
            editor.selectionStart = editor.selectionEnd = start + text.length;
            if (activeFileHandle) dirtyFiles.add(fileKey(activeFileHandle));
            updateTabsUI();
            runLayoutRenderEngine();
        },

        insertAtCursor: (text) => {
            const pos = editor.selectionStart;
            editor.value = editor.value.slice(0, pos) + text + editor.value.slice(pos);
            editor.selectionStart = editor.selectionEnd = pos + text.length;
            if (activeFileHandle) dirtyFiles.add(fileKey(activeFileHandle));
            updateTabsUI();
            runLayoutRenderEngine();
        },

        getCursorPosition: () => {
            const upToCaret = editor.value.slice(0, editor.selectionStart);
            const lines = upToCaret.split('\n');
            return { line: lines.length, column: lines[lines.length - 1].length + 1 };
        },

        getLanguageId: () => {
            if (!activeFileHandle || !activeFileHandle.name) return '';
            const parts = activeFileHandle.name.split('.');
            return parts.length > 1 ? parts.pop().toLowerCase() : '';
        },

        save: async () => {
            await handleSaveFile();
            return true;
        },

        getOpenFiles: () => openTabs
            .filter(t => !t.isSettings && !t.isPluginDetails)
            .map(t => ({ path: t.path || t.name, name: t.name })),

        setDiagnostics: (path, diagnostics) => {
            api.events.emit('diagnostics-updated', { path, diagnostics });
        }
    });

    // Expose terminal printing for plugin status/hint messages
    window.printToTerminal = printToTerminal;

    // Register standard default programming languages
    registerCoreLanguages(api);

    // Scan and activate custom plugins
    await pluginManager.initialize();

    // Set up top bar IDE switcher dropdown
    window.renderIdeSelector();

    // Prepare custom dynamic center toolbars container
    const centerTitle = document.querySelector('.window-title-center');
    let ideToolbarContainer = document.getElementById('ide-toolbar-container');
    if (centerTitle && !ideToolbarContainer) {
        ideToolbarContainer = document.createElement('div');
        ideToolbarContainer.id = 'ide-toolbar-container';
        ideToolbarContainer.style.display = 'flex';
        ideToolbarContainer.style.gap = '8px';
        centerTitle.appendChild(ideToolbarContainer);
    }

    // Register the built-in Problems panel (bottom dock tab + status bar counter)
    registerProblemsPanel(api);

    // Setup and activate Plugins manager sidebar tab panel using our Views API
    api.views.registerSidebarPanel('plugins-manager', {
        iconClass: 'fa-solid fa-puzzle-piece',
        title: 'Plugins',
        render: (container) => {
            // Leverage module-isolated render execution
            import('./plugin-manager.js').then(module => {
                module.renderPluginsManagerPanel(container);
            });
        }
    });

    // Setup dynamic sidebar elements
    const sidebarHeader = sidebar.querySelector('.sidebar-header span');
    if (sidebarHeader && !sidebarHeader.id) {
        sidebarHeader.id = 'sidebar-title';
    }
    let pluginContentContainer = document.getElementById('sidebar-plugin-content');
    if (!pluginContentContainer) {
        pluginContentContainer = document.createElement('div');
        pluginContentContainer.id = 'sidebar-plugin-content';
        pluginContentContainer.style.display = 'none';
        pluginContentContainer.style.flex = '1';
        pluginContentContainer.style.overflowY = 'auto';
        sidebar.appendChild(pluginContentContainer);
    }

    // Dynamically render UI options based on loaded registries
    renderThemeSelector(themeSelector);
    renderIconSelector(iconSelector);
    window.renderDiagnosticStyleSelector();

    // Map all standard select elements to custom dropdown components on launch
    window.convertSelectToCustom(themeSelector, () => '<i class="fa-solid fa-palette" style="color: var(--accent-color);"></i>');
    window.convertSelectToCustom(iconSelector, () => '<i class="fa-regular fa-folder-open" style="color: var(--accent-color);"></i>');
    window.convertSelectToCustom(document.getElementById('diagnostic-style-selector'), () => '<i class="fa-solid fa-triangle-exclamation" style="color: var(--accent-color);"></i>');
    window.convertSelectToCustom(document.getElementById('run-mode-selector'), () => '<i class="fa-solid fa-terminal" style="color: var(--accent-color);"></i>');
    window.convertSelectToCustom(document.getElementById('snippet-lang'), () => '<i class="fa-solid fa-code" style="color: var(--accent-color);"></i>');
    if (typeof window.renderDynamicSidebarPanels === 'function') window.renderDynamicSidebarPanels();
    if (typeof window.renderDynamicSettings === 'function') window.renderDynamicSettings();
    if (typeof window.renderDynamicBottomTabs === 'function') window.renderDynamicBottomTabs();
    if (typeof window.renderDynamicStatusItems === 'function') window.renderDynamicStatusItems();
    if (typeof window.renderDynamicRightPanels === 'function') window.renderDynamicRightPanels();

    // Apply cached style preferences. The editor boots into plain mode, so a theme or
    // icon pack shipped by an IDE isn't live yet — fall back to a built-in rather than
    // rendering against a palette that no longer applies.
    let cachedTheme = localStorage.getItem('editor-theme-preset') || 'vs-dark';
    if (!api.themes.isAvailable(cachedTheme)) cachedTheme = 'vs-dark';
    themeSelector.value = cachedTheme;
    applyTheme(cachedTheme);

    // Apply cached icon preference
    if (!api.icons.isAvailable(activeIconPack)) activeIconPack = 'material';
    iconSelector.value = activeIconPack;

    // Set up interactive window splitting layout controls
    initLayoutResizing();
    
    // Ensure terminal configurations and run settings load on launch
    if (isElectronApp && typeof window.updateRunnableExtensions === 'function') {
        await window.updateRunnableExtensions();
    }
}

/**
 * Advanced Interactivity Layout Resizer:
 * Controls dual-axis scaling, uses requestAnimationFrame for layout updates, 
 * implements input shields, and persists dimensions to localStorage.
 */
function initLayoutResizing() {
    const sidebar = document.getElementById('sidebar');
    const workspaceContainer = document.getElementById('workspace-container');
    const bottomPanel = document.getElementById('bottom-panel');

    if (!sidebar || !workspaceContainer || !bottomPanel) return;

    // Load persisted sizes from settings cache
    const savedSidebarWidth = localStorage.getItem('layout-sidebar-width');
    if (savedSidebarWidth) {
        sidebar.style.width = `${savedSidebarWidth}px`;
    }
    const savedTerminalHeight = localStorage.getItem('layout-terminal-height');
    if (savedTerminalHeight) {
        bottomPanel.style.height = `${savedTerminalHeight}px`;
    }
    const rightPanel = document.getElementById('right-panel');
    const savedRightWidth = localStorage.getItem('layout-right-panel-width');
    if (rightPanel && savedRightWidth) {
        rightPanel.style.width = `${savedRightWidth}px`;
    }

    // 1. Configure Sidebar Vertical Resizer
    const resizerSidebar = document.createElement('div');
    resizerSidebar.id = 'resizer-sidebar';
    resizerSidebar.className = 'resizer-v';
    sidebar.parentNode.insertBefore(resizerSidebar, workspaceContainer);

    resizerSidebar.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = sidebar.offsetWidth;
        resizerSidebar.classList.add('dragging');
        document.body.classList.add('layout-resizing');
        document.body.style.cursor = 'col-resize';

        let newWidth = startWidth;
        let updatePending = false;

        const onMouseMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            // Clamp sidebar width constraints between 160px and 600px
            newWidth = Math.max(160, Math.min(600, startWidth + deltaX));

            // Prevent rendering overhead by executing inside animation frames
            if (!updatePending) {
                updatePending = true;
                requestAnimationFrame(() => {
                    sidebar.style.width = `${newWidth}px`;
                    updatePending = false;
                });
            }
        };

        const onMouseUp = () => {
            resizerSidebar.classList.remove('dragging');
            document.body.classList.remove('layout-resizing');
            document.body.style.cursor = '';

            // Cache setting permanently on completion
            localStorage.setItem('layout-sidebar-width', newWidth);

            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    });

    // 2. Configure Bottom Panel Horizontal Resizer
    const resizerTerminal = document.createElement('div');
    resizerTerminal.id = 'resizer-terminal';
    resizerTerminal.className = 'resizer-h';
    bottomPanel.parentNode.insertBefore(resizerTerminal, bottomPanel);

    resizerTerminal.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const startY = e.clientY;
        const startHeight = bottomPanel.offsetHeight;
        resizerTerminal.classList.add('dragging');
        document.body.classList.add('layout-resizing');
        document.body.style.cursor = 'row-resize';

        let newHeight = startHeight;
        let updatePending = false;

        const onMouseMove = (moveEvent) => {
            const deltaY = moveEvent.clientY - startY;
            // Pulling UP (smaller coordinate) increases panel height
            newHeight = Math.max(80, Math.min(550, startHeight - deltaY));

            if (!updatePending) {
                updatePending = true;
                requestAnimationFrame(() => {
                    bottomPanel.style.height = `${newHeight}px`;
                    updatePending = false;
                });
            }
        };

        const onMouseUp = () => {
            resizerTerminal.classList.remove('dragging');
            document.body.classList.remove('layout-resizing');
            document.body.style.cursor = '';

            // Cache setting permanently on completion
            localStorage.setItem('layout-terminal-height', newHeight);

            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    });

    // 3. Configure Right Tool-Window Vertical Resizer
    if (rightPanel) {
        const resizerRight = document.createElement('div');
        resizerRight.id = 'resizer-right-panel';
        resizerRight.className = 'resizer-v';
        // Sits between the workspace and the right dock; CSS hides it when collapsed.
        rightPanel.parentNode.insertBefore(resizerRight, rightPanel);

        resizerRight.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startWidth = rightPanel.offsetWidth;
            resizerRight.classList.add('dragging');
            document.body.classList.add('layout-resizing');
            document.body.style.cursor = 'col-resize';

            let newWidth = startWidth;
            let updatePending = false;

            const onMouseMove = (moveEvent) => {
                const deltaX = moveEvent.clientX - startX;
                // The dock is anchored to the right edge, so pulling LEFT widens it.
                newWidth = Math.max(200, Math.min(640, startWidth - deltaX));

                if (!updatePending) {
                    updatePending = true;
                    requestAnimationFrame(() => {
                        rightPanel.style.width = `${newWidth}px`;
                        updatePending = false;
                    });
                }
            };

            const onMouseUp = () => {
                resizerRight.classList.remove('dragging');
                document.body.classList.remove('layout-resizing');
                document.body.style.cursor = '';
                localStorage.setItem('layout-right-panel-width', newWidth);
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });
    }

    // 4. Configure Safeguard Window Clamps
    window.addEventListener('resize', () => {
        // Automatically scale down the sidebar if it exceeds half of the window viewport
        const maxAllowedWidth = window.innerWidth / 2;
        if (sidebar.offsetWidth > maxAllowedWidth) {
            const safeWidth = Math.max(160, Math.floor(maxAllowedWidth));
            sidebar.style.width = `${safeWidth}px`;
        }

        // Safeguard for terminal panel vertical height
        const maxAllowedHeight = window.innerHeight / 2;
        if (bottomPanel.offsetHeight > maxAllowedHeight) {
            const safeHeight = Math.max(80, Math.floor(maxAllowedHeight));
            bottomPanel.style.height = `${safeHeight}px`;
        }
    });

    // Force-clear layout locks if focus is lost mid-drag (Added Safety Fix)
    window.addEventListener('blur', () => {
        if (document.body.classList.contains('layout-resizing')) {
            document.body.classList.remove('layout-resizing');
            document.body.style.cursor = '';
            resizerSidebar.classList.remove('dragging');
            resizerTerminal.classList.remove('dragging');
        }
    });
}

// Fire Boot Loader
bootEditor();

// =====================================================================
//  Transparent Focus-Fix Wrappers for Native Dialogs
// =====================================================================
if (isElectronApp && ipcRenderer) {
    const originalAlert = window.alert;
    window.alert = function(msg) {
        originalAlert(msg);
        ipcRenderer.invoke('focus-fix');
    };

    const originalConfirm = window.confirm;
    window.confirm = function(msg) {
        const res = originalConfirm(msg);
        ipcRenderer.invoke('focus-fix');
        return res;
    };

    const originalPrompt = window.prompt;
    window.prompt = function(msg, defaultVal) {
        const res = originalPrompt(msg, defaultVal);
        ipcRenderer.invoke('focus-fix');
        return res;
    };
}

// =====================================================================
//  Interactive LSP & Diagnostics Hover Subsystem (Added Fix)
// =====================================================================
let hoverTimeout = null;
// Monotonic token to discard stale async LSP hover responses (Added Fix)
let hoverRequestSeq = 0;

function hideHoverPopup() {
    // Invalidate any in-flight hover request so a late response can't repopulate a closed popup
    hoverRequestSeq++;
    const popup = document.getElementById('lsp-hover-popup');
    if (popup) {
        popup.style.display = 'none';
    }
}

/**
 * Helper to probe and retrieve the element under the cursor from the backdrop (Added Fix)
 */
function getHoveredElement(e) {
    const backdrop = document.getElementById('editor-backdrop');
    if (!backdrop) return null;

    // Temporarily bypass input layer and enable backdrop hits
    editor.style.pointerEvents = 'none';
    backdrop.style.pointerEvents = 'auto';

    const el = document.elementFromPoint(e.clientX, e.clientY);

    // Instantly restore original pointer-events values
    editor.style.pointerEvents = 'auto';
    backdrop.style.pointerEvents = 'none';

    return el;
}

function showHoverPopup(clientX, clientY, globalIndex, activeDiag, client) {
    let popup = document.getElementById('lsp-hover-popup');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'lsp-hover-popup';
        document.body.appendChild(popup); // Append to body to prevent overflow clippings
    }

    popup.innerHTML = '';
    let htmlContent = '';
    
    // 1. Draw Local Diagnostic alert if present
    if (activeDiag) {
        const severityLabel = activeDiag.severity === 1 ? 'Error' : 'Warning';
        const severityColor = activeDiag.severity === 1 ? '#ef5350' : '#ffcc00';
        htmlContent += `
            <div style="display:flex; align-items:center; gap:6px; font-weight:600; color:${severityColor}; margin-bottom:4px;">
                <i class="fa-solid fa-triangle-exclamation"></i> ${severityLabel}:
            </div>
            <div style="color:var(--text-main); margin-bottom:4px; font-style:italic; line-height:1.4;">${escapeHTML(activeDiag.message)}</div>
        `;
    }

    popup.innerHTML = htmlContent || '<div class="hover-loading">Loading details…</div>';
    popup.style.display = 'block';

    // Calculate safe clamped boundaries to prevent off-screen clipping
    const popupWidth = 360;
    const popupHeight = popup.offsetHeight || 80;

    let top = clientY + 16; // 16px below cursor
    let left = clientX + 8;

    if (left + popupWidth > window.innerWidth) {
        left = window.innerWidth - popupWidth - 12;
    }
    if (top + popupHeight > window.innerHeight) {
        top = clientY - popupHeight - 12; // Flip above cursor if overflowing bottom boundary
    }

    left = Math.max(12, left);
    top = Math.max(12, top);

    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;

    // 2. Query active LSP hover documentation
    if (client && activeFileHandle) {
        const reqId = ++hoverRequestSeq;
        const text = editor.value;
        const pos = offsetToLspPosition(text, globalIndex);
        // Highlight code snippets using the current file's language grammar
        const fileConfig = api.languages.get((activeFileHandle.name.split('.').pop() || '').toLowerCase());
        const defaultLang = fileConfig ? fileConfig.name.toLowerCase() : null;

        const settle = (fn) => {
            // Ignore responses superseded by a newer hover or a dismissal (Added Fix)
            if (reqId !== hoverRequestSeq) return;
            if (popup.style.display === 'none') return;
            fn();
        };

        client.hover(activeFileHandle.path, pos.line, pos.character).then(res => {
            settle(() => {
                const hoverText = res && res.result ? parseHoverContents(res.result.contents) : '';
                if (hoverText && hoverText.trim() !== '') {
                    const docDiv = document.createElement('div');
                    docDiv.className = 'hover-doc';
                    if (activeDiag) {
                        docDiv.style.borderTop = '1px solid var(--border-color)';
                        docDiv.style.paddingTop = '6px';
                        docDiv.style.marginTop = '6px';
                    }
                    docDiv.innerHTML = renderHoverMarkdown(hoverText.trim(), defaultLang);

                    if (!activeDiag) {
                        popup.innerHTML = '';
                    }
                    popup.appendChild(docDiv);

                    // Re-clamp bottom boundary with dynamic content height
                    const dynamicHeight = popup.offsetHeight || 120;
                    if (top + dynamicHeight > window.innerHeight) {
                        popup.style.top = `${Math.max(12, clientY - dynamicHeight - 12)}px`;
                    }
                } else if (!activeDiag) {
                    hideHoverPopup();
                }
            });
        }).catch(() => {
            settle(() => { if (!activeDiag) hideHoverPopup(); });
        });
    }
}

function handleHoverEvent(e) {
    if (!activeFileHandle) return;
    const el = getHoveredElement(e);
    if (!el) return;

    // Resolve closest data-offset tracking attribute
    const offsetAttr = el.getAttribute('data-offset') || el.closest('[data-offset]')?.getAttribute('data-offset');
    if (offsetAttr === null || offsetAttr === undefined) return;

    const globalIndex = parseInt(offsetAttr, 10);
    const activeDiag = window.activeDiagnostics ? window.activeDiagnostics.find(d => globalIndex >= d.start && globalIndex < d.end) : null;
    
    // Save current hover states to prevent refires (Added Fix)
    window.lastHoverOffset = globalIndex;
    window.lastHoverDiag = activeDiag;

    // Check if an LSP server is active for the current document
    const fileExt = activeFileHandle.name.split('.').pop().toLowerCase();
    const langConfig = api.languages.get(fileExt);
    const lspKey = langConfig ? langConfig.name.toLowerCase() : fileExt;
    const lspEntry = api.languages.getLspClient(lspKey) || api.languages.getLspClient(fileExt);

    if (activeDiag || (lspEntry && lspEntry.client && lspEntry.client.isStarted)) {
        showHoverPopup(e.clientX, e.clientY, globalIndex, activeDiag, lspEntry ? lspEntry.client : null);
    }
}

// Bind mouse listeners
editor.addEventListener('mousemove', (e) => {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    
    // 1. If the mouse is inside or entering the hover popup, do not close (Added Fix)
    const popup = document.getElementById('lsp-hover-popup');
    if (popup && popup.style.display === 'block') {
        const rect = popup.getBoundingClientRect();
        const buffer = 16; // 16px bridge padding space
        if (e.clientX >= rect.left - buffer && e.clientX <= rect.right + buffer &&
            e.clientY >= rect.top - buffer && e.clientY <= rect.bottom + buffer) {
            return;
        }
    }

    // 2. Perform a fast element check to see if we are still hovering over the same active block (Added Fix)
    const el = getHoveredElement(e);
    if (el) {
        const offsetAttr = el.getAttribute('data-offset') || el.closest('[data-offset]')?.getAttribute('data-offset');
        if (offsetAttr !== null && offsetAttr !== undefined) {
            const globalIndex = parseInt(offsetAttr, 10);
            const activeDiag = window.activeDiagnostics ? window.activeDiagnostics.find(d => globalIndex >= d.start && globalIndex < d.end) : null;
            
            // If we are hovering over the exact same diagnostic block, do absolutely nothing (Added Fix)
            if (activeDiag && window.lastHoverDiag === activeDiag) {
                return;
            }
            
            // If no diagnostic, but still hovering over the same character, do nothing (Added Fix)
            if (!activeDiag && window.lastHoverOffset === globalIndex) {
                return;
            }
        }
    }

    // Hide popup immediately on mouse movements outside the active token or buffer zones
    hideHoverPopup();
    window.lastHoverOffset = -1;
    window.lastHoverDiag = null;

    // Open hover window after 300ms hover delay
    hoverTimeout = setTimeout(() => {
        handleHoverEvent(e);
    }, 300);
});

editor.addEventListener('mouseleave', () => {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    hideHoverPopup();
    window.lastHoverOffset = -1;
    window.lastHoverDiag = null;
});

editor.addEventListener('scroll', () => {
    editorBackdrop.scrollTop = editor.scrollTop;
    editorBackdrop.scrollLeft = editor.scrollLeft;
    lineGutter.scrollTop = editor.scrollTop;

    const viewportRatio = editor.scrollTop / (editor.scrollHeight - editor.clientHeight || 1);
    const maxMinimapScroll = minimapGutter.clientHeight - minimapIndicator.clientHeight;
    minimapIndicator.style.top = `${viewportRatio * maxMinimapScroll}px`;

    // FIXED: Hide open autocomplete lists and hovers on scroll to prevent static floating desyncs
    hideProSense();
    hideHoverPopup();
});

// Dismiss the hover popup with Escape (Added Fix)
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const popup = document.getElementById('lsp-hover-popup');
        if (popup && popup.style.display === 'block') {
            hideHoverPopup();
        }
    }
});

// Enable the empty sidebar area to accept drags and drops back to the root workspace level
fileTreeContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
});

fileTreeContainer.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const dragContext = window.draggedItemReference;
    if (!dragContext) return;
    
    // If dropping onto empty space in the file tree, move the item to the root folder
    if (rootDirectoryHandle) {
        // Prevent moving a root-level item onto the root itself
        if (dragContext.item.parent && dragContext.item.parent.path === rootDirectoryHandle.path) {
            return;
        }
        await handleMoveItem(dragContext.item, rootDirectoryHandle);
    }
});

window.openPluginDetailsTab = (plugin) => {
    const handle = {
        name: plugin.name,
        path: `virtual://plugin/${plugin.id}`,
        isPluginDetails: true,
        plugin: plugin
    };
    const key = fileKey(handle);
    if (!openTabs.find(t => fileKey(t) === key)) {
        openTabs.push(handle);
    }
    handleOpenFile(handle);
};

function renderPluginDetailsPage(container, plugin) {
    container.innerHTML = '';

    const placeholder = `assets/placeholder-${plugin.type === 'ide' ? 'ide' : 'extension'}.svg`;
    const iconUrl = plugin._iconPath || placeholder;

    const header = document.createElement('div');
    header.className = 'plugin-details-header';
    header.innerHTML = `
        <img class="plugin-details-icon" src="${iconUrl}" onerror="if(this.src.indexOf('${placeholder}')===-1)this.src='${placeholder}';" />
        <div class="plugin-details-info">
            <div class="plugin-details-title-row">
                <span class="plugin-details-title">${escapeHTML(plugin.name)}</span>
                <span class="plugin-details-version">v${escapeHTML(plugin.version)}</span>
            </div>
            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">ID: <strong>${escapeHTML(plugin.id)}</strong></div>
            <div class="plugin-details-meta-row">
                <span><i class="fa-solid ${plugin.type === 'ide' ? 'fa-laptop-code' : 'fa-puzzle-piece'}"></i> ${plugin.type.toUpperCase()}</span>
                <span><i class="fa-solid fa-code"></i> API: v${escapeHTML(plugin.apiVersion)}</span>
            </div>
        </div>
    `;
    container.appendChild(header);

    const body = document.createElement('div');
    body.className = 'plugin-details-body';

    // 1. Description Section
    const descSec = document.createElement('div');
    descSec.className = 'plugin-details-section';
    descSec.innerHTML = `
        <div class="plugin-details-section-title">Description</div>
        <p style="font-size: 12px; line-height: 1.5; color: var(--text-muted);">${escapeHTML(plugin.description || 'No description provided.')}</p>
    `;
    body.appendChild(descSec);

    // 2. Settings Section
    const settingsSec = document.createElement('div');
    settingsSec.className = 'plugin-details-section';
    settingsSec.innerHTML = `<div class="plugin-details-section-title">Configuration Settings</div>`;

    // Gather settings explicitly mapped to this plugin ID
    const pluginSettings = Array.from(api.views.customSettings.entries())
        .filter(([id, config]) => config.pluginId === plugin.id || id.startsWith(`${plugin.id}-`));

    if (pluginSettings.length === 0) {
        const empty = document.createElement('div');
        empty.style.color = 'var(--text-muted)';
        empty.style.fontSize = '12px';
        empty.style.fontStyle = 'italic';
        empty.textContent = 'This plugin does not contribute any configurable setting options.';
        settingsSec.appendChild(empty);
    } else {
        pluginSettings.forEach(([id, config]) => {
            const card = document.createElement('div');
            card.className = 'plugin-details-setting-card';

            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.gap = '12px';

            const label = document.createElement('span');
            label.style.fontSize = '12px';
            label.style.fontWeight = '600';
            label.textContent = config.label;
            row.appendChild(label);

            const cacheKey = `setting-pref-${id}`;
            let currentValue = localStorage.getItem(cacheKey);
            if (currentValue === null) {
                currentValue = config.defaultValue;
            } else {
                if (config.type === 'checkbox') currentValue = (currentValue === 'true');
                else if (config.type === 'number') currentValue = Number(currentValue);
            }

            // (Inside renderPluginDetailsPage in js/app.js)
            let input;
            if (config.type === 'select') {
                input = document.createElement('select');
                input.style.backgroundColor = 'var(--bg-dark)';
                input.style.border = '1px solid var(--border-color)';
                input.style.color = 'var(--text-main)';
                input.style.padding = '4px 8px';
                input.style.borderRadius = '4px';
                input.style.fontSize = '12px';
                input.style.outline = 'none';

                (config.options || []).forEach(optVal => {
                    const opt = document.createElement('option');
                    opt.value = optVal;
                    opt.textContent = optVal;
                    if (optVal === currentValue) opt.selected = true;
                    input.appendChild(opt);
                });
                // Convert to custom component once inserted into the DOM
                setTimeout(() => {
                    window.convertSelectToCustom(input, () => '<i class="fa-solid fa-sliders" style="color: var(--accent-color);"></i>');
                }, 0);
            } else if (config.type === 'checkbox') {
                input = document.createElement('input');
                input.type = 'checkbox';
                input.style.width = '16px';
                input.style.height = '16px';
                input.style.cursor = 'pointer';
                input.checked = !!currentValue;
            } else {
                input = document.createElement('input');
                input.type = config.type || 'text';
                input.value = currentValue;
                input.style.backgroundColor = 'var(--bg-dark)';
                input.style.border = '1px solid var(--border-color)';
                input.style.color = 'var(--text-main)';
                input.style.padding = '6px';
                input.style.borderRadius = '4px';
                input.style.fontSize = '12px';
                input.style.outline = 'none';
            }

            input.addEventListener('change', (e) => {
                let val = config.type === 'checkbox' ? e.target.checked : e.target.value;
                localStorage.setItem(cacheKey, val);
                try {
                    config.onChange(val);
                } catch (err) {
                    console.error(`Error in setting ${id} onChange:`, err);
                }
            });

            row.appendChild(input);
            card.appendChild(row);

            if (config.description) {
                const tip = document.createElement('div');
                tip.style.fontSize = '11px';
                tip.style.color = 'var(--text-muted)';
                tip.style.marginTop = '4px';
                tip.textContent = config.description;
                card.appendChild(tip);
            }

            settingsSec.appendChild(card);
        });
    }

    body.appendChild(settingsSec);
    container.appendChild(body);
}