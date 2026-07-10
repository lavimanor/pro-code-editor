import { api } from './api-core.js';
import { pluginManager } from './plugin-manager.js';
import { 
    readDirectoryEntries, readFileContents, saveFileContents, verifyPermission,
    openDirectoryPicker, createDirectoryHandle, createFileHandle, removeEntryHandle,
    resolveHandle
} from './fs-handler.js';
import { renderFileTree, renderTabs } from './ui-handler.js';
import { renderThemeSelector, applyTheme } from './themes.js';
import { renderIconSelector } from './icons.js';
import { registerCoreLanguages } from './prosense-db/registry.js';
import { renderSyntaxHighlighting } from './syntax.js';
import { initProSense, handleProSenseInput, handleProSenseKeydown, getWordBeforeCursor, hideProSense } from './prosense.js';
import { initMinimapScroll } from './minimap.js';
import { getCustomSnippets, saveCustomSnippets, renderSnippetsList } from './snippets.js';
import { initTerminal, toggleTerminal, updateTerminalPrompt, printToTerminal, appendOutputChunk, setRunState } from './terminal.js';

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

// Electron IPC bridge
let ipcRenderer = null;

// Extensions the Run button supports
let runnableExts = new Set();

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
 * Dynamically renders the IDE selector dropdown inside the top bar
 */
window.renderIdeSelector = () => {
    const titleLeft = document.querySelector('.window-title-left');
    if (!titleLeft) return;

    let selector = document.getElementById('ide-selector');
    if (!selector) {
        selector = document.createElement('select');
        selector.id = 'ide-selector';
        selector.style.background = 'var(--bg-sidebar)';
        selector.style.color = 'var(--text-main)';
        selector.style.border = '1px solid var(--border-color)';
        selector.style.padding = '4px 10px';
        selector.style.borderRadius = '4px';
        selector.style.fontSize = '11px';
        selector.style.outline = 'none';
        selector.style.cursor = 'pointer';
        selector.style.marginLeft = '12px';
        selector.style.fontFamily = 'var(--font-ui)';
        selector.style.display = 'none';

        selector.addEventListener('change', (e) => {
            window.switchWorkspaceIDE(e.target.value);
        });

        titleLeft.appendChild(selector);
    }

    const ides = api.workspace.ides;
    if (ides.size === 0) {
        selector.style.display = 'none';
        return;
    }

    selector.innerHTML = '';
    
    // Add baseline Normal Editor options
    const defOpt = document.createElement('option');
    defOpt.value = 'default';
    defOpt.textContent = 'Normal Editor';
    selector.appendChild(defOpt);

    ides.forEach((config, id) => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = config.name;
        if (api.workspace.activeIdeId === id) {
            opt.selected = true;
        }
        selector.appendChild(opt);
    });

    selector.style.display = 'inline-block';
};

/**
 * Orchestrates seamless environment switching between installed IDEs
 */
window.switchWorkspaceIDE = (ideId) => {
    const ideToolbarContainer = document.getElementById('ide-toolbar-container');
    
    // 1. Deactivate existing active workspace
    const oldIde = api.workspace.getActiveIDE();
    if (oldIde && typeof oldIde.onDeactivate === 'function') {
        try { oldIde.onDeactivate(); } catch (err) { console.error(err); }
    }

    // Flush workspace context elements
    if (ideToolbarContainer) ideToolbarContainer.innerHTML = '';
    hideWelcomePage();

    if (ideId === 'default' || !ideId) {
        api.workspace.activeIdeId = null;
        printToTerminal('[System] Switched to normal editor mode.', 'system');
        editor.placeholder = "// Select or create a file from the explorer to begin...";
        return;
    }

    const newIde = api.workspace.ides.get(ideId);
    if (!newIde) return;

    api.workspace.activeIdeId = ideId;
    printToTerminal(`[System] Switched to ${newIde.name} environment.`, 'system');

    // Build the dynamic workspace context passed to the IDE active hooks
    const context = {
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
        },
        showWelcome: (html) => showWelcomePage(html),
        hideWelcome: () => hideWelcomePage(),

        /**
         * Project Structure Generator (Added in Step 4):
         * Generates complete template layouts (folders, nesting, index files) 
         * recursively under the opened workspace directory handle.
         */
        createProjectStructure: async (structure) => {
            if (!rootDirectoryHandle) {
                alert('Please open a folder workspace first.');
                return false;
            }
            
            printToTerminal('[System] Generating project template directory structures...', 'system');
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
                    }
                }
                
                printToTerminal('[System] Project structure generated successfully!', 'system');
                
                // Refresh folder tree visualization on creation completion
                if (typeof refreshExplorer === 'function') {
                    await refreshExplorer();
                }
                return true;
            } catch (err) {
                printToTerminal(`[System Error] Failed to generate project architecture: ${err.message}`, 'system');
                console.error(err);
                return false;
            }
        }
    };

    // Invoke workspace entry hooks
    if (typeof newIde.onActivate === 'function') {
        try { 
            newIde.onActivate(context); 
        } catch (err) { 
            console.error(err); 
            printToTerminal(`[System Error] IDE activation failed: ${err.message}`, 'system');
        }
    }

    // Evaluate welcome overlay triggers
    if (openTabs.length === 0 && typeof newIde.getWelcomePageHTML === 'function') {
        showWelcomePage(newIde.getWelcomePageHTML());
    }
};

/**
 * Dynamically renders custom setting panels contributed by active plugins.
 */
window.renderDynamicSettings = () => {
    const settingsBody = document.querySelector('.settings-body');
    if (!settingsBody) return;

    document.querySelectorAll('.dynamic-setting-item').forEach(el => el.remove());

    api.views.customSettings.forEach((config, id) => {
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
 * Dynamically renders custom activity icons inside the Activity Bar.
 */
window.renderDynamicSidebarPanels = () => {
    const activityTop = document.querySelector('.activity-top');
    if (!activityTop) return;

    document.querySelectorAll('.dynamic-activity-icon').forEach(el => el.remove());

    api.views.sidebarPanels.forEach((config, id) => {
        const btn = document.createElement('button');
        btn.className = 'activity-icon dynamic-activity-icon';
        btn.id = `act-btn-${id}`;
        btn.title = config.title;
        btn.innerHTML = `<i class="${config.iconClass}"></i>`;

        btn.addEventListener('click', () => switchSidebarView(id, config));
        activityTop.appendChild(btn);
    });
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
actSettings.addEventListener('click', toggleSettingsPanel);
closeSettingsBtn.addEventListener('click', toggleSettingsPanel);

editor.addEventListener('input', () => {
    if (activeFileHandle && !dirtyFiles.has(fileKey(activeFileHandle))) {
        dirtyFiles.add(fileKey(activeFileHandle));
        updateTabsUI();
    }
    if (activeFileHandle) {
        tabContentsCache.set(fileKey(activeFileHandle), editor.value);
    }
    runLayoutRenderEngine();

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

editor.addEventListener('keydown', (e) => {
    if (handleProSenseKeydown(e)) {
        return;
    }

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const val = editor.value;

    if (e.key === 'Tab') {
        e.preventDefault();
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
        if (activeFileHandle) handleSaveFile();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        toggleSettingsPanel();
    }
});

function toggleSettingsPanel() {
    settingsPanel.classList.toggle('hidden');
    actSettings.classList.toggle('active', !settingsPanel.classList.contains('hidden'));
}

/**
 * Updates line numbers and coordinates the editor backdrop overlay.
 */
function runLayoutRenderEngine() {
    const text = editor.value;

    const lines = text.split('\n');
    let gutterHTML = '';
    for (let i = 1; i <= lines.length; i++) {
        gutterHTML += `<span class="gutter-num">${i}</span>`;
    }
    lineGutter.innerHTML = gutterHTML;

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

    const backdropHTML = renderSyntaxHighlighting(text, activeName, highlightIndices, markerIndex);
    editorBackdrop.innerHTML = backdropHTML + (text.endsWith('\n') ? '\n ' : ' ');
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
    if (selectedHandle) {
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
        handleOpenFile, handleFolderCollapseToggle, handleProjectItemDelete, handleMoveItem
    );
}

function updateTabsUI() {
    renderTabs(tabContainer, openTabs, activeFileHandle, dirtyFiles, activeIconPack, handleOpenFile, handleCloseTab, handleTabReorder);
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
            await refreshExplorer();
        }
    } catch (err) {
        console.error('Directory pipeline configuration closed.', err);
    }
}

async function handleOpenFile(fileHandle) {
    hideWelcomePage(); // Instantly close active dynamic welcome screens on open file events
    const actualHandle = fileHandle.handle ? fileHandle.handle : fileHandle;
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
            contents = await readFileContents(activeFileHandle);
            tabContentsCache.set(fileKey(actualHandle), contents);
        }

        editor.value = contents;
        editor.disabled = false;
        btnSaveFile.disabled = false;
        filePathDisplay.textContent = "Workspace / " + activeFileHandle.name;
        
        updateGoLiveVisibility(activeFileHandle.name);
        updateRunButtonVisibility(activeFileHandle.name);
        updateTabsUI();
        runLayoutRenderEngine();
        await refreshExplorer();
    } catch (err) {
        alert('Could not open target resource path stream.');
    }
}

async function handleSaveFile() {
    if (!activeFileHandle) return;
    try {
        await saveFileContents(activeFileHandle, editor.value);
        tabContentsCache.set(fileKey(activeFileHandle), editor.value);
        dirtyFiles.delete(fileKey(activeFileHandle));
        updateTabsUI();
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
        if (sourceItem.kind === 'file') {
            const fileData = await readFileContents(sourceItem.handle);
            const newFileHandle = await targetDirectoryHandle.getFileHandle(sourceItem.name, { create: true });
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
            await targetDirectoryHandle.getDirectoryHandle(sourceItem.name, { create: true });
        }
        await sourceItem.parent.removeEntry(sourceItem.name, { recursive: true });
        await refreshExplorer();
        updateTabsUI();
    } catch (err) {
        alert('System drag execution parameter lock error.');
    }
}

function handleCloseTab(fileHandle) {
    const key = fileKey(fileHandle);
    if (dirtyFiles.has(key)) {
        const confirmClose = confirm('"' + fileHandle.name + '" contains unsaved changes. Close anyway?');
        if (!confirmClose) return;
    }
    openTabs = openTabs.filter(t => fileKey(t) !== key);
    dirtyFiles.delete(key);
    tabContentsCache.delete(key);

    if (activeFileHandle && fileKey(activeFileHandle) === key) {
        if (openTabs.length > 0) {
            handleOpenFile(openTabs[openTabs.length - 1]);
        } else {
            activeFileHandle = null;
            selectedHandle = null;
            editor.value = '';
            editor.disabled = true;
            btnSaveFile.disabled = true;
            filePathDisplay.textContent = rootDirectoryHandle ? "Workspace: " + rootDirectoryHandle.name : 'Workspace Closed';
            updateGoLiveVisibility('');
            updateRunButtonVisibility('');
            runLayoutRenderEngine();

            // Reactivate IDE welcome splash view on close tabs events if no open records remain
            const activeIde = api.workspace.getActiveIDE();
            if (activeIde && typeof activeIde.getWelcomePageHTML === 'function') {
                showWelcomePage(activeIde.getWelcomePageHTML());
            }
        }
    } else if (openTabs.length === 0) {
        updateGoLiveVisibility('');
        updateRunButtonVisibility('');

        const activeIde = api.workspace.getActiveIDE();
        if (activeIde && typeof activeIde.getWelcomePageHTML === 'function') {
            showWelcomePage(activeIde.getWelcomePageHTML());
        }
    }
    updateTabsUI();
    refreshExplorer();
}

async function handleProjectItemDelete(item) {
    const confirmDelete = confirm('Permanently delete "' + item.name + '" from disk?');
    if (!confirmDelete) return;
    try {
        handleCloseTab(item.handle);
        await removeEntryHandle(item.parent, item.name);
        await refreshExplorer();
    } catch (err) {
        alert('FileSystem execution access context authorization denial parameters triggered.');
    }
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

// Bind activity panel toggles
const actTerminal = document.getElementById('act-terminal');
const closePanelBtn = document.getElementById('close-panel-btn');
if (actTerminal) actTerminal.addEventListener('click', toggleTerminal);
if (closePanelBtn) closePanelBtn.addEventListener('click', toggleTerminal);

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

// Initialize Terminal Panel Context
initTerminal(bottomPanel, terminalOutput, terminalInput, terminalPrompt);

/**
 * Sequential Boot Loader: Ensures core subsystems and plugins load 
 * prior to building selectors or configuring the workspace.
 */
async function bootEditor() {
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

    // Setup and activate Plugins manager sidebar tab panel using our Views API (New Addition)
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
    if (typeof window.renderDynamicSidebarPanels === 'function') window.renderDynamicSidebarPanels();
    if (typeof window.renderDynamicSettings === 'function') window.renderDynamicSettings();

    // Apply cached style preferences
    const cachedTheme = localStorage.getItem('editor-theme-preset') || 'vs-dark';
    themeSelector.value = cachedTheme;
    applyTheme(cachedTheme);

    // Apply cached icon preference
    iconSelector.value = activeIconPack;

    // Set up interactive window splitting layout controls (New Addition)
    initLayoutResizing();
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

    // 1. Configure Sidebar Vertical Resizer
    const resizerSidebar = document.createElement('div');
    resizerSidebar.id = 'resizer-sidebar';
    resizerSidebar.className = 'resizer-v';
    sidebar.parentNode.insertBefore(resizerSidebar, workspaceContainer);

    resizerSidebar.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = sidebar.offsetWidth;
        resizerSidebar.className = 'resizer-v dragging';
        document.body.className = 'layout-resizing';
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
            resizerSidebar.className = 'resizer-v';
            document.body.className = '';
            document.body.style.cursor = '';

            // Cache setting permanently on completion
            localStorage.setItem('layout-sidebar-width', newWidth);

            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
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
        resizerTerminal.className = 'resizer-h dragging';
        document.body.className = 'layout-resizing';
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
            resizerTerminal.className = 'resizer-h';
            document.body.className = '';
            document.body.style.cursor = '';

            // Cache setting permanently on completion
            localStorage.setItem('layout-terminal-height', newHeight);

            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    // 3. Configure Safeguard Window Clamps
    window.addEventListener('resize', () => {
        // Automatically scale down the sidebar if it exceeds half of the window viewport
        const maxAllowedWidth = window.innerWidth / 2;
        if (sidebar.offsetWidth > maxAllowedWidth) {
            const safeWidth = Math.max(160, Math.floor(maxAllowedWidth));
            sidebar.style.width = `${safeWidth}px`;
        }
    });
}

// Fire Boot Loader
bootEditor();