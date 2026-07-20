import { isElectron, resolvePython, spawnPython } from './py-env.js';
import { initOutlineSection } from './outline.js';

export function registerPythonixSidebar(api) {
    api.views.registerSidebarPanel('pythonix-ide-panel', {
        iconClass: 'fa-brands fa-python', // Unified Python brand icon
        title: 'Pythonix IDE',
        render: (container) => {
            // Setup the unified sidebar template with active CSS theme custom properties
            container.innerHTML = `
                <div style="height: 100%; display: flex; flex-direction: column; background: var(--bg-sidebar); font-family: sans-serif; box-sizing: border-box; color: var(--text-main);">

                    <!-- Header -->
                    <div style="padding: 12px; border-bottom: 1px solid var(--border-color); background: var(--bg-darker);">
                        <h4 style="margin: 0; color: var(--accent-color); font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                            <i class="fa-brands fa-python"></i> Pythonix Workspace Tools
                        </h4>
                    </div>

                    <!-- Accordion Section 0: Code Outline -->
                    <div class="menu-section" style="border-bottom: 1px solid var(--border-color);">
                        <!-- Accordion Header Toggle -->
                        <div class="menu-header" id="header-outline" style="
                            padding: 10px 12px;
                            background: var(--bg-dark);
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            cursor: pointer;
                            font-size: 12px;
                            font-weight: 600;
                            user-select: none;
                        ">
                            <span style="display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-sitemap" style="color: var(--accent-color); width: 14px;"></i> Code Outline
                            </span>
                            <i class="fa-solid fa-chevron-down arrow-icon" id="arrow-outline" style="font-size: 10px; color: var(--text-muted); transition: transform 0.2s;"></i>
                        </div>

                        <!-- Accordion Content Container -->
                        <div class="menu-content" id="content-outline" style="
                            padding: 8px;
                            display: block; /* Default expanded */
                            max-height: 220px;
                            overflow-y: auto;
                            background: var(--bg-sidebar);
                        "></div>
                    </div>

                    <!-- Accordion Section 1: Pip Package Manager -->
                    <div class="menu-section" style="border-bottom: 1px solid var(--border-color);">
                        <!-- Accordion Header Toggle -->
                        <div class="menu-header" id="header-pip" style="
                            padding: 10px 12px;
                            background: var(--bg-dark);
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            cursor: pointer;
                            font-size: 12px;
                            font-weight: 600;
                            user-select: none;
                        ">
                            <span style="display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-cubes" style="color: var(--accent-color); width: 14px;"></i> Pip Package Manager
                            </span>
                            <i class="fa-solid fa-chevron-down arrow-icon" id="arrow-pip" style="font-size: 10px; color: var(--text-muted); transition: transform 0.2s;"></i>
                        </div>

                        <!-- Accordion Content Container -->
                        <div class="menu-content" id="content-pip" style="
                            padding: 12px;
                            display: flex; /* Default expanded */
                            flex-direction: column;
                            gap: 10px;
                            background: var(--bg-sidebar);
                        ">
                            <p style="margin: 0; font-size: 11px; color: var(--text-muted);">Install Python packages with <code>pip</code>. Target: <span id="pip-env-label" style="color: var(--accent-color); font-weight: 600;">Global System</span></p>

                            <div style="display: flex; gap: 6px;">
                                <input id="pip-input" type="text" placeholder="e.g. requests" style="flex: 1; min-width: 0; padding: 6px 10px; background: var(--bg-darker); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-main); font-size: 11px; outline: none;" />
                                <button id="pip-install-btn" style="padding: 6px 12px; background: var(--accent-color); border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 11px; font-weight: 500; white-space: nowrap;">
                                    Install
                                </button>
                            </div>

                            <div style="font-weight: 600; font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Popular Libraries</div>
                            <div id="pip-popular" style="display: flex; flex-direction: column; gap: 6px;"></div>

                            <!-- Live pip output log -->
                            <div id="pip-output" style="
                                display: none;
                                max-height: 140px;
                                overflow-y: auto;
                                background: var(--bg-dark);
                                border: 1px solid var(--border-color);
                                border-radius: 4px;
                                padding: 6px 8px;
                                font-family: 'Consolas', 'Courier New', monospace;
                                font-size: 10px;
                                color: var(--text-main);
                                white-space: pre-wrap;
                                word-break: break-word;
                            "></div>
                        </div>
                    </div>

                    <!-- Accordion Section 2: Interactive Scratchpad -->
                    <div class="menu-section" style="border-bottom: 1px solid var(--border-color); flex: 1; display: flex; flex-direction: column;">
                        <!-- Accordion Header Toggle -->
                        <div class="menu-header" id="header-scratch" style="
                            padding: 10px 12px;
                            background: var(--bg-dark);
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            cursor: pointer;
                            font-size: 12px;
                            font-weight: 600;
                            user-select: none;
                        ">
                            <span style="display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-terminal" style="color: var(--accent-color); width: 14px;"></i> Interactive Scratchpad
                            </span>
                            <i class="fa-solid fa-chevron-down arrow-icon" id="arrow-scratch" style="font-size: 10px; color: var(--text-muted); transition: transform 0.2s; transform: rotate(-90deg);"></i>
                        </div>

                        <!-- Accordion Content Container -->
                        <div class="menu-content" id="content-scratch" style="
                            padding: 12px;
                            display: none; /* Default collapsed */
                            flex-direction: column;
                            gap: 10px;
                            background: var(--bg-sidebar);
                            flex: 1;
                        ">
                            <p style="margin: 0; font-size: 11px; color: var(--text-muted);">Draft and run isolated snippets of Python on-the-fly. <span style="color: var(--text-muted);">Tip: <strong>Ctrl+Enter</strong> runs.</span></p>

                            <!-- Scratchpad Editor Area -->
                            <textarea id="scratchpad-editor" spellcheck="false" style="
                                flex: 1;
                                min-height: 120px;
                                background: var(--bg-darker);
                                border: 1px solid var(--border-color);
                                border-radius: 4px;
                                color: var(--syntax-function);
                                font-family: 'Consolas', 'Courier New', monospace;
                                font-size: 11px;
                                padding: 8px;
                                resize: none;
                                outline: none;
                                white-space: pre;
                                overflow: auto;
                            " placeholder="# Type quick Python code here...&#10;print('Hello World!')"></textarea>

                            <div style="display: flex; gap: 6px; justify-content: flex-end;">
                                <button id="scratchpad-clear-btn" style="padding: 4px 10px; background: transparent; border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-muted); cursor: pointer; font-size: 10px;">Clear</button>
                                <button id="scratchpad-run-btn" style="padding: 4px 12px; background: var(--accent-color); border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 10px; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                    <i class="fa-solid fa-play"></i> Run Code
                                </button>
                            </div>

                            <div style="font-weight: 600; font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Console Output</div>
                            <div id="scratchpad-output" style="
                                height: 100px;
                                background: var(--bg-dark);
                                border: 1px solid var(--border-color);
                                border-radius: 4px;
                                padding: 6px;
                                overflow-y: auto;
                                font-family: 'Consolas', 'Courier New', monospace;
                                font-size: 10px;
                                color: var(--text-muted);
                                white-space: pre-wrap;
                                word-break: break-word;
                            ">Console idle...</div>
                        </div>
                    </div>
                </div>
            `;

            // ============================================================
            //  Shared Python process helpers (see ./py-env.js)
            // ============================================================
            const ERROR_RED = '#e06c75';
            const SUCCESS_GREEN = 'var(--syntax-string)';

            // ============================================================
            //  Accordion toggling
            // ============================================================
            const headerOutline = container.querySelector('#header-outline');
            const contentOutline = container.querySelector('#content-outline');
            const arrowOutline = container.querySelector('#arrow-outline');

            const headerPip = container.querySelector('#header-pip');
            const contentPip = container.querySelector('#content-pip');
            const arrowPip = container.querySelector('#arrow-pip');

            const headerScratch = container.querySelector('#header-scratch');
            const contentScratch = container.querySelector('#content-scratch');
            const arrowScratch = container.querySelector('#arrow-scratch');

            const toggleOutline = (shouldOpen) => {
                const open = shouldOpen !== undefined ? shouldOpen : contentOutline.style.display === 'none';
                contentOutline.style.display = open ? 'block' : 'none';
                arrowOutline.style.transform = open ? 'rotate(0deg)' : 'rotate(-90deg)';
            };

            const togglePip = (shouldOpen) => {
                const open = shouldOpen !== undefined ? shouldOpen : contentPip.style.display === 'none';
                contentPip.style.display = open ? 'flex' : 'none';
                arrowPip.style.transform = open ? 'rotate(0deg)' : 'rotate(-90deg)';
            };

            const toggleScratch = (shouldOpen) => {
                const open = shouldOpen !== undefined ? shouldOpen : contentScratch.style.display === 'none';
                contentScratch.style.display = open ? 'flex' : 'none';
                arrowScratch.style.transform = open ? 'rotate(0deg)' : 'rotate(-90deg)';
            };

            headerOutline.addEventListener('click', () => toggleOutline());
            headerPip.addEventListener('click', () => togglePip());
            headerScratch.addEventListener('click', () => toggleScratch());

            // Mount the live Code Outline view (self-refreshing via api.events)
            initOutlineSection(api, contentOutline);

            // Listen for internal execution routing event to slide/expand the Scratchpad section
            container.addEventListener('open-scratchpad-accordion', () => {
                toggleOutline(false);
                togglePip(false);
                toggleScratch(true);
                const editor = container.querySelector('#scratchpad-editor');
                if (editor) setTimeout(() => editor.focus(), 60);
            });

            // ============================================================
            //  Pip Package Manager
            // ============================================================
            const pipInput = container.querySelector('#pip-input');
            const pipBtn = container.querySelector('#pip-install-btn');
            const pipOutput = container.querySelector('#pip-output');
            const pipEnvLabel = container.querySelector('#pip-env-label');
            const pipPopular = container.querySelector('#pip-popular');

            // Reflect the current install target in the header.
            pipEnvLabel.textContent = resolvePython().env;

            let pipChild = null; // single active install at a time

            const POPULAR = [
                { name: 'requests', desc: 'HTTP library for Python' },
                { name: 'numpy', desc: 'Scientific computing library' },
                { name: 'pandas', desc: 'Data analysis toolset' },
                { name: 'flask', desc: 'Lightweight web framework' },
                { name: 'matplotlib', desc: 'Plotting & visualisation' }
            ];

            POPULAR.forEach(({ name, desc }) => {
                const row = document.createElement('div');
                row.className = 'pkg-row';
                row.style.cssText = 'background: var(--bg-darker); border: 1px solid var(--border-color); border-radius: 4px; padding: 6px 8px; display: flex; justify-content: space-between; align-items: center; gap: 8px;';
                row.innerHTML = `
                    <div style="display: flex; flex-direction: column; min-width: 0;">
                        <span style="font-size: 11px; font-weight: 600;">${name}</span>
                        <span style="font-size: 9px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${desc}</span>
                    </div>
                    <button class="pkg-add-btn" style="padding: 2px 8px; background: transparent; border: 1px solid var(--accent-color); border-radius: 3px; color: var(--accent-color); cursor: pointer; font-size: 9px; white-space: nowrap;">Add</button>
                `;
                row.querySelector('.pkg-add-btn').addEventListener('click', () => runPipInstall(name));
                pipPopular.appendChild(row);
            });

            const appendPipLog = (text, color) => {
                if (!pipOutput.isConnected) return;
                pipOutput.style.display = 'block';
                const span = document.createElement('span');
                if (color) span.style.color = color;
                span.textContent = text;
                pipOutput.appendChild(span);
                pipOutput.scrollTop = pipOutput.scrollHeight;
            };

            const setPipBusy = (busy) => {
                pipBtn.disabled = busy;
                pipBtn.style.opacity = busy ? '0.6' : '1';
                pipBtn.style.cursor = busy ? 'default' : 'pointer';
                pipBtn.innerHTML = busy ? `<i class="fa-solid fa-spinner fa-spin"></i>` : 'Install';
            };

            // A pip requirement specifier: name plus optional extras/version markers.
            // Reject anything starting with "-" so a stray token can't become a pip flag.
            const isValidPackageSpec = (spec) => /^[A-Za-z0-9][A-Za-z0-9._\-\[\]<>=!~,() ]*$/.test(spec);

            function runPipInstall(pkg) {
                pkg = (pkg || '').trim();
                if (!pkg) return;

                if (pipChild) {
                    appendPipLog(`\nAn install is already running. Please wait…\n`, ERROR_RED);
                    return;
                }
                if (!isValidPackageSpec(pkg)) {
                    pipOutput.textContent = '';
                    appendPipLog(`Invalid package name: "${pkg}"\n`, ERROR_RED);
                    return;
                }
                if (!isElectron) {
                    pipOutput.textContent = '';
                    appendPipLog('Native pip execution is only available in the Desktop Shell environment.\n', ERROR_RED);
                    return;
                }

                pipOutput.textContent = '';
                setPipBusy(true);
                appendPipLog(`$ pip install ${pkg}\n`, 'var(--accent-color)');

                // Split so specs like "numpy pandas" or "requests==2.31" pass through as separate args.
                const pkgArgs = pkg.split(/\s+/).filter(Boolean);
                pipChild = spawnPython(['-m', 'pip', 'install', ...pkgArgs], {
                    onStdout: (t) => appendPipLog(t),
                    onStderr: (t) => appendPipLog(t, 'var(--text-muted)'),
                    onClose: (code) => {
                        pipChild = null;
                        setPipBusy(false);
                        if (code === 0) {
                            appendPipLog(`\n✓ Successfully installed ${pkg}\n`, SUCCESS_GREEN);
                        } else {
                            appendPipLog(`\n✗ pip exited with code ${code}\n`, ERROR_RED);
                        }
                    },
                    onError: (err) => {
                        pipChild = null;
                        setPipBusy(false);
                        appendPipLog(`\nFailed to launch pip: ${err.message}\nEnsure Python is installed and on your PATH.\n`, ERROR_RED);
                    }
                });
            }

            pipBtn.addEventListener('click', () => {
                const pkg = pipInput.value.trim();
                if (pkg) {
                    runPipInstall(pkg);
                    pipInput.value = '';
                }
            });
            pipInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    pipBtn.click();
                }
            });

            // ============================================================
            //  Interactive Scratchpad
            // ============================================================
            const editor = container.querySelector('#scratchpad-editor');
            const runBtn = container.querySelector('#scratchpad-run-btn');
            const clearBtn = container.querySelector('#scratchpad-clear-btn');
            const output = container.querySelector('#scratchpad-output');

            let scratchChild = null;

            const setRunButtonState = (running) => {
                if (running) {
                    runBtn.innerHTML = `<i class="fa-solid fa-stop"></i> Stop`;
                    runBtn.style.background = ERROR_RED;
                } else {
                    runBtn.innerHTML = `<i class="fa-solid fa-play"></i> Run Code`;
                    runBtn.style.background = 'var(--accent-color)';
                }
            };

            const appendOutput = (text, color) => {
                if (!output.isConnected) return;
                const span = document.createElement('span');
                if (color) span.style.color = color;
                span.textContent = text;
                output.appendChild(span);
                output.scrollTop = output.scrollHeight;
            };

            clearBtn.addEventListener('click', () => {
                editor.value = '';
                output.textContent = 'Console idle...';
                output.style.color = 'var(--text-muted)';
            });

            const stopScratch = () => {
                if (scratchChild) {
                    try { scratchChild.kill(); } catch (e) { /* ignore */ }
                }
            };

            const runScratch = () => {
                const code = editor.value.trim();
                if (!code) {
                    output.textContent = 'Execution Error: Scratchpad is empty.';
                    output.style.color = ERROR_RED;
                    return;
                }
                if (!isElectron) {
                    output.textContent = 'Native Python execution is only available in the Desktop Shell environment.';
                    output.style.color = ERROR_RED;
                    return;
                }

                // Reset output to a neutral, streamable surface.
                output.textContent = '';
                output.style.color = 'var(--text-main)';
                appendOutput('Executing snippet…\n', 'var(--syntax-keyword)');

                scratchChild = spawnPython(['-X', 'utf8', '-c', code], {
                    onStdout: (t) => appendOutput(t),
                    onStderr: (t) => appendOutput(t, ERROR_RED),
                    onClose: (exitCode) => {
                        const wasRunning = scratchChild;
                        scratchChild = null;
                        setRunButtonState(false);
                        if (!wasRunning) return;
                        if (exitCode === 0) {
                            appendOutput(`\n[Finished]\n`, SUCCESS_GREEN);
                        } else if (exitCode === null) {
                            appendOutput(`\n[Stopped]\n`, 'var(--syntax-keyword)');
                        } else {
                            appendOutput(`\n[Exited with code ${exitCode}]\n`, ERROR_RED);
                        }
                    },
                    onError: (err) => {
                        scratchChild = null;
                        setRunButtonState(false);
                        output.textContent = `Process Error: Failed to execute Python.\n${err.message}`;
                        output.style.color = ERROR_RED;
                    }
                });

                if (scratchChild) setRunButtonState(true);
            };

            runBtn.addEventListener('click', () => {
                if (scratchChild) {
                    stopScratch();
                } else {
                    runScratch();
                }
            });

            // Keyboard ergonomics: Ctrl/Cmd+Enter runs, Tab inserts spaces instead of losing focus.
            editor.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    if (!scratchChild) runScratch();
                    return;
                }
                if (e.key === 'Tab') {
                    e.preventDefault();
                    const start = editor.selectionStart;
                    const end = editor.selectionEnd;
                    editor.value = editor.value.slice(0, start) + '    ' + editor.value.slice(end);
                    editor.selectionStart = editor.selectionEnd = start + 4;
                }
            });
        }
    });
}
