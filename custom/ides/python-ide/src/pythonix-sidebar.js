import { isElectron, resolvePython, spawnPython, setCustomPythonPath } from './py-env.js';
import { initOutlineSection } from './outline.js';
import { initTestExplorer } from './test-explorer.js';
import { createVirtualEnv } from './venv-manager.js';

export function registerPythonixSidebar(api) {
    api.views.registerSidebarPanel('pythonix-ide-panel', {
        iconClass: 'fa-brands fa-python',
        title: 'Pythonix IDE',
        render: (container) => {
            container.innerHTML = `
                <div style="height: 100%; display: flex; flex-direction: column; background: var(--bg-sidebar); font-family: var(--font-ui, sans-serif); box-sizing: border-box; color: var(--text-main);">

                    <!-- Header -->
                    <div style="padding: 12px; border-bottom: 1px solid var(--border-color); background: var(--bg-darker); display: flex; align-items: center; justify-content: space-between;">
                        <h4 style="margin: 0; color: var(--accent-color); font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                            <i class="fa-brands fa-python"></i> Pythonix Tools
                        </h4>
                        <span id="py-env-badge" style="font-size: 10px; background: rgba(53, 114, 165, 0.15); color: var(--accent-color); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-color);">
                            System Python
                        </span>
                    </div>

                    <!-- Accordion 0: Code Outline -->
                    <div class="menu-section" style="border-bottom: 1px solid var(--border-color);">
                        <div class="menu-header" id="header-outline" style="padding: 10px 12px; background: var(--bg-dark); display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-size: 12px; font-weight: 600; user-select: none;">
                            <span style="display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-sitemap" style="color: var(--accent-color); width: 14px;"></i> Code Outline
                            </span>
                            <i class="fa-solid fa-chevron-down arrow-icon" id="arrow-outline" style="font-size: 10px; color: var(--text-muted); transition: transform 0.2s;"></i>
                        </div>
                        <div class="menu-content" id="content-outline" style="padding: 8px; display: block; max-height: 180px; overflow-y: auto; background: var(--bg-sidebar);"></div>
                    </div>

                    <!-- Accordion 1: Virtual Environment (.venv) Manager -->
                    <div class="menu-section" style="border-bottom: 1px solid var(--border-color);">
                        <div class="menu-header" id="header-venv" style="padding: 10px 12px; background: var(--bg-dark); display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-size: 12px; font-weight: 600; user-select: none;">
                            <span style="display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-cube" style="color: var(--accent-color); width: 14px;"></i> Virtual Environment
                            </span>
                            <i class="fa-solid fa-chevron-down arrow-icon" id="arrow-venv" style="font-size: 10px; color: var(--text-muted); transition: transform 0.2s; transform: rotate(-90deg);"></i>
                        </div>
                        <div class="menu-content" id="content-venv" style="padding: 12px; display: none; flex-direction: column; gap: 8px; background: var(--bg-sidebar);">
                            <div style="font-size: 11px; color: var(--text-muted);">
                                Current Env: <strong id="venv-current-name" style="color: var(--accent-color);">System Python</strong>
                            </div>
                            <div style="display: flex; gap: 6px;">
                                <button id="venv-create-btn" style="flex: 1; padding: 6px; background: var(--accent-color); border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 11px; font-weight: 600;">
                                    <i class="fa-solid fa-plus"></i> Create .venv
                                </button>
                            </div>
                            <div id="venv-log-output" style="display: none; max-height: 100px; overflow-y: auto; background: var(--bg-darker); border: 1px solid var(--border-color); border-radius: 4px; padding: 6px; font-family: var(--font-code, monospace); font-size: 10px;"></div>
                        </div>
                    </div>

                    <!-- Accordion 2: Pip Package Manager -->
                    <div class="menu-section" style="border-bottom: 1px solid var(--border-color);">
                        <div class="menu-header" id="header-pip" style="padding: 10px 12px; background: var(--bg-dark); display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-size: 12px; font-weight: 600; user-select: none;">
                            <span style="display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-cubes" style="color: var(--accent-color); width: 14px;"></i> Pip Package Manager
                            </span>
                            <i class="fa-solid fa-chevron-down arrow-icon" id="arrow-pip" style="font-size: 10px; color: var(--text-muted); transition: transform 0.2s; transform: rotate(-90deg);"></i>
                        </div>
                        <div class="menu-content" id="content-pip" style="padding: 12px; display: none; flex-direction: column; gap: 10px; background: var(--bg-sidebar);">
                            <div style="display: flex; gap: 6px;">
                                <input id="pip-input" type="text" placeholder="Package (e.g. requests)" style="flex: 1; min-width: 0; padding: 6px 8px; background: var(--bg-darker); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-main); font-size: 11px; outline: none;" />
                                <button id="pip-install-btn" style="padding: 6px 12px; background: var(--accent-color); border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 11px; font-weight: 500;">
                                    Install
                                </button>
                            </div>
                            <div style="display: flex; gap: 6px;">
                                <button id="pip-req-install" style="flex: 1; padding: 4px 6px; background: var(--bg-darker); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-main); cursor: pointer; font-size: 10px;">
                                    <i class="fa-solid fa-file-import"></i> Install requirements.txt
                                </button>
                                <button id="pip-freeze-export" style="flex: 1; padding: 4px 6px; background: var(--bg-darker); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-main); cursor: pointer; font-size: 10px;">
                                    <i class="fa-solid fa-file-export"></i> Freeze to requirements.txt
                                </button>
                            </div>
                            <div id="pip-output" style="display: none; max-height: 120px; overflow-y: auto; background: var(--bg-dark); border: 1px solid var(--border-color); border-radius: 4px; padding: 6px; font-family: var(--font-code, monospace); font-size: 10px; white-space: pre-wrap; word-break: break-word;"></div>
                        </div>
                    </div>

                    <!-- Accordion 3: Unit Test Explorer -->
                    <div class="menu-section" style="border-bottom: 1px solid var(--border-color);">
                        <div class="menu-header" id="header-tests" style="padding: 10px 12px; background: var(--bg-dark); display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-size: 12px; font-weight: 600; user-select: none;">
                            <span style="display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-vial" style="color: var(--accent-color); width: 14px;"></i> Test Explorer
                            </span>
                            <i class="fa-solid fa-chevron-down arrow-icon" id="arrow-tests" style="font-size: 10px; color: var(--text-muted); transition: transform 0.2s; transform: rotate(-90deg);"></i>
                        </div>
                        <div class="menu-content" id="content-tests" style="padding: 12px; display: none; flex-direction: column; background: var(--bg-sidebar);"></div>
                    </div>

                    <!-- Accordion 4: Interactive Scratchpad -->
                    <div class="menu-section" style="border-bottom: 1px solid var(--border-color); flex: 1; display: flex; flex-direction: column;">
                        <div class="menu-header" id="header-scratch" style="padding: 10px 12px; background: var(--bg-dark); display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-size: 12px; font-weight: 600; user-select: none;">
                            <span style="display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-terminal" style="color: var(--accent-color); width: 14px;"></i> Interactive Scratchpad
                            </span>
                            <i class="fa-solid fa-chevron-down arrow-icon" id="arrow-scratch" style="font-size: 10px; color: var(--text-muted); transition: transform 0.2s; transform: rotate(-90deg);"></i>
                        </div>
                        <div class="menu-content" id="content-scratch" style="padding: 12px; display: none; flex-direction: column; gap: 8px; background: var(--bg-sidebar); flex: 1;">
                            <div style="display: flex; gap: 6px; align-items: center;">
                                <span style="font-size: 10px; color: var(--text-muted);">Preset:</span>
                                <select id="scratch-preset" style="flex: 1; padding: 3px; background: var(--bg-darker); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-main); font-size: 10px;">
                                    <option value="custom">-- Custom Snippet --</option>
                                    <option value="fastapi">FastAPI App Skeleton</option>
                                    <option value="benchmark">Performance Benchmark</option>
                                    <option value="scraper">Requests Web Scraper</option>
                                    <option value="dataviz">Numpy / Matplotlib Starter</option>
                                </select>
                            </div>
                            <textarea id="scratchpad-editor" spellcheck="false" style="flex: 1; min-height: 100px; background: var(--bg-darker); border: 1px solid var(--border-color); border-radius: 4px; color: var(--syntax-function); font-family: var(--font-code, monospace); font-size: 11px; padding: 8px; resize: none; outline: none; white-space: pre;" placeholder="# Type quick Python snippet here...\nprint('Hello World!')"></textarea>
                            <div style="display: flex; gap: 6px; justify-content: flex-end;">
                                <button id="scratchpad-clear-btn" style="padding: 4px 10px; background: transparent; border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-muted); cursor: pointer; font-size: 10px;">Clear</button>
                                <button id="scratchpad-run-btn" style="padding: 4px 12px; background: var(--accent-color); border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 10px; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                    <i class="fa-solid fa-play"></i> Run Code
                                </button>
                            </div>
                            <div id="scratchpad-output" style="height: 90px; background: var(--bg-dark); border: 1px solid var(--border-color); border-radius: 4px; padding: 6px; overflow-y: auto; font-family: var(--font-code, monospace); font-size: 10px; color: var(--text-muted); white-space: pre-wrap; word-break: break-word;">Console idle...</div>
                        </div>
                    </div>
                </div>
            `;

            // Setup Accordion handlers
            const toggle = (c, a, force) => {
                const open = force !== undefined ? force : c.style.display === 'none';
                c.style.display = open ? (c.id === 'content-outline' ? 'block' : 'flex') : 'none';
                a.style.transform = open ? 'rotate(0deg)' : 'rotate(-90deg)';
            };

            const sections = [
                ['outline', container.querySelector('#header-outline'), container.querySelector('#content-outline'), container.querySelector('#arrow-outline')],
                ['venv', container.querySelector('#header-venv'), container.querySelector('#content-venv'), container.querySelector('#arrow-venv')],
                ['pip', container.querySelector('#header-pip'), container.querySelector('#content-pip'), container.querySelector('#arrow-pip')],
                ['tests', container.querySelector('#header-tests'), container.querySelector('#content-tests'), container.querySelector('#arrow-tests')],
                ['scratch', container.querySelector('#header-scratch'), container.querySelector('#content-scratch'), container.querySelector('#arrow-scratch')]
            ];

            sections.forEach(([id, h, c, a]) => {
                h.addEventListener('click', () => toggle(c, a));
            });

            container.addEventListener('open-scratchpad-accordion', () => {
                sections.forEach(([id, h, c, a]) => toggle(c, a, id === 'scratch'));
                const ed = container.querySelector('#scratchpad-editor');
                if (ed) setTimeout(() => ed.focus(), 60);
            });

            // Mount Outline & Test Explorer
            initOutlineSection(api, container.querySelector('#content-outline'));
            initTestExplorer(api, container.querySelector('#content-tests'));

            // Venv Manager UI logic
            const venvCurrentName = container.querySelector('#venv-current-name');
            const venvBadge = container.querySelector('#py-env-badge');
            const venvCreateBtn = container.querySelector('#venv-create-btn');
            const venvLog = container.querySelector('#venv-log-output');

            const updateEnvDisplay = () => {
                const env = resolvePython().env;
                venvCurrentName.textContent = env;
                venvBadge.textContent = env;
            };
            updateEnvDisplay();
            api.events.on('pythonix-env-changed', updateEnvDisplay);

            venvCreateBtn.addEventListener('click', async () => {
                venvLog.style.display = 'block';
                venvLog.innerHTML = '';
                await createVirtualEnv(api, venvLog);
                updateEnvDisplay();
            });

            // Pip Manager UI logic
            const pipInput = container.querySelector('#pip-input');
            const pipBtn = container.querySelector('#pip-install-btn');
            const pipReqBtn = container.querySelector('#pip-req-install');
            const pipFreezeBtn = container.querySelector('#pip-freeze-export');
            const pipOutput = container.querySelector('#pip-output');

            const logPip = (t, color) => {
                pipOutput.style.display = 'block';
                const span = document.createElement('span');
                if (color) span.style.color = color;
                span.textContent = t;
                pipOutput.appendChild(span);
                pipOutput.scrollTop = pipOutput.scrollHeight;
            };

            const runPipCmd = (args) => {
                if (!isElectron) {
                    logPip('Pip execution requires Desktop Shell.\n', '#e06c75');
                    return;
                }
                pipOutput.textContent = '';
                logPip(`$ pip ${args.join(' ')}\n`, 'var(--accent-color)');
                spawnPython(['-m', 'pip', ...args], {
                    onStdout: (t) => logPip(t),
                    onStderr: (t) => logPip(t, 'var(--text-muted)'),
                    onClose: (code) => {
                        if (code === 0) logPip('\n✓ Pip operation succeeded.\n', 'var(--syntax-string, #98c379)');
                        else logPip(`\n✗ Pip exited with code ${code}\n`, '#e06c75');
                    }
                });
            };

            pipBtn.addEventListener('click', () => {
                const pkg = pipInput.value.trim();
                if (pkg) { runPipCmd(['install', pkg]); pipInput.value = ''; }
            });
            pipReqBtn.addEventListener('click', () => runPipCmd(['install', '-r', 'requirements.txt']));
            pipFreezeBtn.addEventListener('click', () => runPipCmd(['freeze']));

            // Scratchpad Preset Handler
            const editor = container.querySelector('#scratchpad-editor');
            const presetSelect = container.querySelector('#scratch-preset');
            const runBtn = container.querySelector('#scratchpad-run-btn');
            const clearBtn = container.querySelector('#scratchpad-clear-btn');
            const output = container.querySelector('#scratchpad-output');

            presetSelect.addEventListener('change', () => {
                switch (presetSelect.value) {
                    case 'fastapi':
                        editor.value = `from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.get("/")\ndef read_root():\n    return {"message": "Hello from Pythonix FastAPI!"}\n\nprint("FastAPI app instance created.")`;
                        break;
                    case 'benchmark':
                        editor.value = `import time\n\ndef benchmark():\n    start = time.perf_counter()\n    res = sum(i * i for i in range(1_000_000))\n    elapsed = (time.perf_counter() - start) * 1000\n    print(f"Computed sum in {elapsed:.2f} ms: {res}")\n\nbenchmark()`;
                        break;
                    case 'scraper':
                        editor.value = `import urllib.request\nimport json\n\ntry:\n    req = urllib.request.urlopen("https://httpbin.org/get")\n    data = json.loads(req.read().decode())\n    print("Fetched URL headers:", data.get("headers"))\nexcept Exception as e:\n    print("Scraper error:", e)`;
                        break;
                    case 'dataviz':
                        editor.value = `import math\n\ndata = [round(math.sin(x / 10), 3) for x in range(20)]\nprint("Wave dataset:", data)`;
                        break;
                }
            });

            let scratchChild = null;
            clearBtn.addEventListener('click', () => {
                editor.value = '';
                output.textContent = 'Console idle...';
            });

            runBtn.addEventListener('click', () => {
                if (!isElectron) {
                    output.textContent = 'Execution requires Desktop Shell environment.';
                    output.style.color = '#e06c75';
                    return;
                }
                const code = editor.value.trim();
                if (!code) return;

                if (scratchChild) {
                    try { scratchChild.kill(); } catch (e) {}
                    scratchChild = null;
                    runBtn.innerHTML = '<i class="fa-solid fa-play"></i> Run Code';
                    return;
                }

                output.textContent = 'Executing snippet...\n';
                output.style.color = 'var(--text-main)';
                runBtn.innerHTML = '<i class="fa-solid fa-stop"></i> Stop';

                const appendOut = (t, color) => {
                    const span = document.createElement('span');
                    if (color) span.style.color = color;
                    span.textContent = t;
                    output.appendChild(span);
                    output.scrollTop = output.scrollHeight;
                };

                scratchChild = spawnPython(['-X', 'utf8', '-c', code], {
                    onStdout: (t) => appendOut(t),
                    onStderr: (t) => appendOut(t, '#e06c75'),
                    onClose: (code) => {
                        scratchChild = null;
                        runBtn.innerHTML = '<i class="fa-solid fa-play"></i> Run Code';
                        if (code === 0) appendOut('\n[Finished]\n', 'var(--syntax-string, #98c379)');
                        else appendOut(`\n[Exited code ${code}]\n`, '#e06c75');
                    }
                });
            });
        }
    });
}
