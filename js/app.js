import { 
    readDirectoryEntries, readFileContents, saveFileContents, verifyPermission,
    openDirectoryPicker, createDirectoryHandle, createFileHandle, removeEntryHandle,
    resolveHandle
} from './fs-handler.js';
import { renderFileTree, renderTabs } from './ui-handler.js';
import { applyTheme } from './themes.js';
import { renderSyntaxHighlighting } from './syntax.js';
import { initProSense, handleProSenseInput, handleProSenseKeydown, getWordBeforeCursor } from './prosense.js';
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

let activeSyntaxError = null;
let syntaxCheckTimeout = null;

// Electron IPC bridge (assigned in the Electron guard below). Module-scoped so
// helper functions like updateGoLiveVisibility / triggerSyntaxCheck can use it.
let ipcRenderer = null;

// Extensions the Run button supports — populated from the main-process run registry.
let runnableExts = new Set();

// Identify a file by its absolute path (falls back to name in the web build).
const fileKey = (h) => (h && (h.path || h.name)) || '';

// Core Canvas Interface Elements Cache Maps
const btnOpenFolder = document.getElementById('btn-open-folder');
const btnSaveFile = document.getElementById('btn-save-file');
const btnNewFile = document.getElementById('btn-new-file');
const btnNewFolder = document.getElementById('btn-new-folder');
const fileTreeContainer = document.getElementById('file-tree');
const tabContainer = document.getElementById('tab-bar');
const editor = document.getElementById('editor');
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
initTerminal(bottomPanel, terminalOutput, terminalInput, terminalPrompt);

// Bind activity toggle triggers
const actTerminal = document.getElementById('act-terminal');
const closePanelBtn = document.getElementById('close-panel-btn');
if (actTerminal) actTerminal.addEventListener('click', toggleTerminal);
if (closePanelBtn) closePanelBtn.addEventListener('click', toggleTerminal);

// Initialize State Defaults
const cachedTheme = localStorage.getItem('editor-theme-preset') || 'vs-dark';
themeSelector.value = cachedTheme;
iconSelector.value = activeIconPack;
applyTheme(cachedTheme);
const editorSurfaceBox = document.getElementById('editor-surface-box');
const prosenseToggle = document.getElementById('prosense-toggle');
if (prosenseToggle) {
    const isEnabled = localStorage.getItem('prosense-enabled') !== 'false';
    prosenseToggle.checked = isEnabled;
    localStorage.setItem('prosense-enabled', isEnabled);
    prosenseToggle.addEventListener('change', (e) => {
        localStorage.setItem('prosense-enabled', e.target.checked);
    });
}
initProSense(editor, editorSurfaceBox);
const btnGoLive = document.getElementById('btn-go-live');
let serverActiveUrl = null;

/**
 * Monitors active tab file extensions to show/hide the "Go Live" server button.
 */
function updateGoLiveVisibility(fileName) {
    if (!btnGoLive) return;
    
    const ext = fileName ? fileName.split('.').pop().toLowerCase() : '';
    const isWebLang = ['html', 'htm', 'css', 'js', 'mjs', 'cjs'].includes(ext);

    if (isWebLang && rootDirectoryHandle) {
        btnGoLive.classList.remove('hidden-btn');
    } else {
        // Stop server automatically if the active tab changes to a non-web language
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
const btnRunCode = document.getElementById('btn-run-code');

/**
 * Monitors active tab file extensions to show/hide the "Run" button.
 * Which extensions are runnable comes from the main-process run registry
 * (run-config.js) via the 'get-run-langs' IPC, so adding a language needs
 * no change here.
 */
function updateRunButtonVisibility(fileName) {
    if (!btnRunCode) return;
    const ext = fileName ? fileName.split('.').pop().toLowerCase() : '';

    if (runnableExts.has(ext) && rootDirectoryHandle) {
        btnRunCode.classList.remove('hidden-btn');
    } else {
        btnRunCode.classList.add('hidden-btn');
    }
}

// Bind custom title bar buttons to native window actions under Electron
const isElectronApp = typeof window !== 'undefined' && window.process && window.process.type;
if (isElectronApp) {
    ipcRenderer = window.require('electron').ipcRenderer;

    // Populate the set of runnable extensions from the main-process registry.
    ipcRenderer.invoke('get-run-langs').then((langs) => {
        runnableExts = new Set(Object.keys(langs || {}));
        if (activeFileHandle) updateRunButtonVisibility(activeFileHandle.name);
    }).catch(() => {});

    // Stream live program output from integrated runs into the terminal.
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
                // Stop Server
                const stopped = await ipcRenderer.invoke('stop-server');
                if (stopped) {
                    serverActiveUrl = null;
                    btnGoLive.innerHTML = '<i class="fa-solid fa-tower-broadcast"></i> Go Live';
                    btnGoLive.title = 'Run Local Web Server';
                }
            } else {
                // Start Server
                if (rootDirectoryHandle) {
                    const folderPath = rootDirectoryHandle.path;
                    let relativePath = '';

                    // Calculate the complete subfolder path of the active file from the workspace root
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

            // Save first so we run the latest source on disk.
            if (dirtyFiles.has(fileKey(activeFileHandle))) {
                await handleSaveFile();
            }

            const mode = localStorage.getItem('run-mode-preset') || 'integrated';

            if (mode === 'integrated') {
                // Route terminal input to the running program's stdin.
                setRunState(true, (line) => ipcRenderer.invoke('run-input', line));
            } else {
                printToTerminal(`Launching ${activeFileHandle.name} in an external window...`);
            }

            const result = await ipcRenderer.invoke('run-file', activeFileHandle.path, mode);

            // For integrated runs, a truthy `running` means output/exit arrive via events.
            if (!result || !result.running) {
                if (mode === 'integrated') setRunState(false);
                if (result && result.output) printToTerminal(result.output);
            }
        });
    }
}
initMinimapScroll(editor, minimapGutter, minimapIndicator);

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
        const body = snippetBody.value.replace(/\\n/g, '\n'); // Support escaped newlines

        if (!trigger || !body) {
            alert('Trigger prefix and expansion body cannot be empty.');
            return;
        }

        const snippets = getCustomSnippets();
        snippets.push({ trigger, lang, body });
        saveCustomSnippets(snippets);

        // Reset input fields
        snippetTrigger.value = '';
        snippetBody.value = '';
        handleRender();
    });

    handleRender(); // Initial UI lists compile
}

// Event Routing Binds
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

actExplorer.addEventListener('click', () => sidebar.classList.toggle('collapsed-bar'));
actSettings.addEventListener('click', toggleSettingsPanel);
closeSettingsBtn.addEventListener('click', toggleSettingsPanel);

// Dynamic rendering sync loops
editor.addEventListener('input', () => {
    if (activeFileHandle && !dirtyFiles.has(fileKey(activeFileHandle))) {
        dirtyFiles.add(fileKey(activeFileHandle));
        updateTabsUI();
    }
    if (activeFileHandle) {
        tabContentsCache.set(fileKey(activeFileHandle), editor.value);
    }
    runLayoutRenderEngine();
    triggerSyntaxCheck(); // Evaluate compilation errors in the background
});

editor.addEventListener('scroll', () => {
    editorBackdrop.scrollTop = editor.scrollTop;
    editorBackdrop.scrollLeft = editor.scrollLeft;
    lineGutter.scrollTop = editor.scrollTop;

    const viewportRatio = editor.scrollTop / (editor.scrollHeight - editor.clientHeight || 1);
    const maxMinimapScroll = minimapGutter.clientHeight - minimapIndicator.clientHeight;
    minimapIndicator.style.top = `${viewportRatio * maxMinimapScroll}px`;
});

editor.addEventListener('click', runLayoutRenderEngine);
editor.addEventListener('keyup', (e) => {
    if(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
        runLayoutRenderEngine();
    }
});

// MULTI-FEATURE ENGINE: Keypress routers intercepts
editor.addEventListener('keydown', (e) => {
    // Intercept with ProSense key handler first
    if (handleProSenseKeydown(e)) {
        return;
    }

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const val = editor.value;

    // FEATURE 1: Tab Key Space Emulation Injection
    if (e.key === 'Tab') {
        e.preventDefault();
        editor.value = val.substring(0, start) + "    " + val.substring(end);
        editor.selectionStart = editor.selectionEnd = start + 4;
        editor.dispatchEvent(new Event('input'));
        return;
    }

    // FEATURE 2: Intelligent Pair-Closing Match Engines
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
        
        // Find the boundary of the tag currently being typed
        const lastLess = leftText.lastIndexOf('<');
        if (lastLess !== -1 && !leftText.substring(lastLess).includes('>')) {
            const tagMatch = leftText.substring(lastLess).match(/^<([a-zA-Z0-9:-]+)/);
            if (tagMatch) {
                const tagName = tagMatch[1];
                
                // Exclude self-closing HTML void elements and closing tags
                const voidTags = ['img', 'br', 'input', 'hr', 'link', 'meta', 'base', 'col', 'embed', 'source', 'track', 'wbr'];
                if (!voidTags.includes(tagName.toLowerCase()) && !tagName.startsWith('/')) {
                    e.preventDefault();
                    
                    const closingTag = `</${tagName}>`;
                    editor.value = text.substring(0, cursor) + '>' + closingTag + text.substring(cursor);
                    
                    // Position cursor inside the container tags (directly after '>')
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
        // Check standard bracketed/indented block triggers
        const shouldIncreaseIndent = trimmedLine.endsWith('{') || 
                                     trimmedLine.endsWith('[') || 
                                     trimmedLine.endsWith('(') || 
                                     trimmedLine.endsWith(':');

        let insertText = '\n' + indent;
        let newCursorOffset = 1 + indent.length;

        if (shouldIncreaseIndent) {
            const extraIndent = '    '; // Standard 4-space indent
            insertText = '\n' + indent + extraIndent;
            newCursorOffset = 1 + indent.length + extraIndent.length;

            // Smart bracing format: place closing brace on its own indented line below
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
 * CORE RECONSTRUCTION ENGINE: Updates line numbers column, minimap text,
 * and searches for enclosing brackets around the cursor to apply visual highlights.
 * Incorporates modular HTML & CSS syntax highlighting.
 */
function runLayoutRenderEngine() {
    const text = editor.value;

    // 1. Line Counter Assembly
    const lines = text.split('\n');
    let gutterHTML = '';
    for (let i = 1; i <= lines.length; i++) {
        gutterHTML += `<span class="gutter-num">${i}</span>`;
    }
    lineGutter.innerHTML = gutterHTML;

    // 2. Refresh Mirror Data to Minimap
    minimapText.textContent = text;

    // 3. Scan & Evaluate Bracket Highlight Index Matches
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
    
    // Fetch active custom settings style class
    const stylePreset = localStorage.getItem('error-style-preset') || 'underline';
    const errorClass = stylePreset === 'highlight' ? 'syntax-error-highlight' : 'syntax-error-underline';

    // Compile syntax highlighting along with active diagnostics and caret markers
    const backdropHTML = renderSyntaxHighlighting(text, activeName, highlightIndices, markerIndex, activeSyntaxError, errorClass);
    
    editorBackdrop.innerHTML = backdropHTML + (text.endsWith('\n') ? '\n ' : ' ');

    // Harvest symbols from other open buffers so ProSense can suggest across files.
    const activeKey = fileKey(activeFileHandle);
    const extraBuffers = [];
    for (const [key, buf] of tabContentsCache) {
        if (key !== activeKey && buf) extraBuffers.push(buf);
    }
    handleProSenseInput(activeName, extraBuffers);
}

// FIXED: Cleaned up structural definition properties references
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
                // Use the dual-mode helper to resolve child file segments safely
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
            
            // Sync terminal prompt with selected local workspace folder path
            updateTerminalPrompt(rootDirectoryHandle.path);
            
            await refreshExplorer();
        }
    } catch (err) {
        console.error('Directory pipeline configuration closed.', err);
    }
}

async function handleOpenFile(fileHandle) {
    const actualHandle = fileHandle.handle ? fileHandle.handle : fileHandle;
    try {
        if (!openTabs.find(t => fileKey(t) === fileKey(actualHandle))) {
            openTabs.push(actualHandle);
        }
        activeFileHandle = actualHandle;
        selectedHandle = actualHandle;

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
        filePathDisplay.textContent = `Workspace / ${activeFileHandle.name}`;
        
        updateGoLiveVisibility(activeFileHandle.name);
        updateRunButtonVisibility(activeFileHandle.name); // Add this call
        updateTabsUI();
        runLayoutRenderEngine();
        triggerSyntaxCheck(); // Add this call
        await refreshExplorer();
    } catch (err) {
        alert('Could not open target resource path stream.');
    }
}

async function handleSaveFile() {
    if (!activeFileHandle) return;
    try {
        await saveFileContents(activeFileHandle, editor.value);
        tabContentsCache.set(fileKey(activeFileHandle), editor.value); // Sync buffer changes
        dirtyFiles.delete(fileKey(activeFileHandle));
        updateTabsUI();
    } catch (err) {
        alert('Disk write execution target exception errors encountered.');
    }
}

async function handleCreateFile() {
    const targetDir = selectedDirectoryContext || rootDirectoryHandle;
    // Swap native prompt() with our safe async custom modal dialog
    const fileName = await showPrompt(`Create file inside [${targetDir.name}]:`, 'filename.html');
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
    // Swap native prompt() with our safe async custom modal dialog
    const folderName = await showPrompt(`Create directory inside [${targetDir.name}]:`, 'folder_name');
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

            // Migrate any cached buffer / dirty state to the new location key.
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
        const confirmClose = confirm(`"${fileHandle.name}" contains unsaved changes. Close anyway?`);
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
            filePathDisplay.textContent = 'Workspace Closed';
            updateGoLiveVisibility('');
            updateRunButtonVisibility('');
            triggerSyntaxCheck(); // Add this call (clears error states)
            runLayoutRenderEngine();
        }
    } else if (openTabs.length === 0) {
        updateGoLiveVisibility('');
        updateRunButtonVisibility(''); // Add this call
    }
    updateTabsUI();
    refreshExplorer();
}

async function handleProjectItemDelete(item) {
    const confirmDelete = confirm(`Permanently delete "${item.name}" from disk?`);
    if (!confirmDelete) return;
    try {
        handleCloseTab(item.handle);
        await removeEntryHandle(item.parent, item.name);
        await refreshExplorer();
    } catch (err) {
        alert('FileSystem execution access context authorization denial parameters triggered.');
    }
}

/**
 * Splice-swaps dragged tab positions in array when dropped over another tab.
 */
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
 * Displays a custom async modal prompt dialog in place of native window.prompt()
 */
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
        
        // Auto-focus input field
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

/**
 * Triggers an optimized background compilation check for active Python files.
 */
function triggerSyntaxCheck() {
    if (!ipcRenderer || !activeFileHandle || !activeFileHandle.name.endsWith('.py')) {
        activeSyntaxError = null;
        return;
    }

    if (syntaxCheckTimeout) clearTimeout(syntaxCheckTimeout);
    
    syntaxCheckTimeout = setTimeout(async () => {
        try {
            const result = await ipcRenderer.invoke('check-python-syntax', editor.value);
            if (result.success) {
                activeSyntaxError = null;
            } else {
                activeSyntaxError = result; // { line, offset, msg, text }
            }
            runLayoutRenderEngine(); // Redraw backdrop with highlights
        } catch (err) {
            console.error('Syntax validation failed:', err);
        }
    }, 250); // 250ms debounce
}

const errorStyleSelector = document.getElementById('error-style-selector');
if (errorStyleSelector) {
    errorStyleSelector.value = localStorage.getItem('error-style-preset') || 'underline';
    errorStyleSelector.addEventListener('change', (e) => {
        localStorage.setItem('error-style-preset', e.target.value);
        runLayoutRenderEngine();
    });
}

// Run output mode: 'integrated' (in-app terminal) or 'external' (cmd.exe window).
const runModeSelector = document.getElementById('run-mode-selector');
if (runModeSelector) {
    runModeSelector.value = localStorage.getItem('run-mode-preset') || 'integrated';
    runModeSelector.addEventListener('change', (e) => {
        localStorage.setItem('run-mode-preset', e.target.value);
    });
}