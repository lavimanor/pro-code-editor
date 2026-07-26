/**
 * HyperWeb IDE Unified Sidebar Panel
 * Integrates Code Outline, Visual CSS Design Studio, Web Components Library & Live Web Sandbox.
 */

import { parseHtml, parseCss, parseJs } from './outline.js';

export function registerHyperWebSidebar(api) {
    api.views.registerSidebarPanel('hyperweb-ide-panel', {
        iconClass: 'fa-solid fa-globe',
        title: 'HyperWeb IDE',
        render: (container) => {
            container.innerHTML = `
                <div style="height: 100%; display: flex; flex-direction: column; background: var(--bg-sidebar); font-family: var(--font-ui, sans-serif); box-sizing: border-box; color: var(--text-main);">
                    <!-- Header -->
                    <div style="padding: 12px; border-bottom: 1px solid var(--border-color); background: var(--bg-darker); display: flex; align-items: center; justify-content: space-between;">
                        <h4 style="margin: 0; color: #00b4d8; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-globe"></i> HyperWeb Tools
                        </h4>
                        <span style="font-size: 10px; background: rgba(0, 180, 216, 0.15); color: #00b4d8; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(0, 180, 216, 0.3);">
                            v2.0
                        </span>
                    </div>

                    <!-- Accordion Section 1: DOM & Code Outline -->
                    <div class="menu-section" style="border-bottom: 1px solid var(--border-color);">
                        <div class="menu-header" id="hw-header-outline" style="padding: 10px 12px; background: var(--bg-dark); display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-size: 12px; font-weight: 600; user-select: none;">
                            <span style="display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-sitemap" style="color: #00b4d8; width: 14px;"></i> DOM & Code Outline
                            </span>
                            <i class="fa-solid fa-chevron-down arrow-icon" id="hw-arrow-outline" style="font-size: 10px; color: var(--text-muted); transition: transform 0.2s;"></i>
                        </div>
                        <div class="menu-content" id="hw-content-outline" style="padding: 8px; display: block; max-height: 200px; overflow-y: auto; background: var(--bg-sidebar);">
                            <div id="hw-outline-status" style="font-size: 11px; color: var(--text-muted); padding-bottom: 4px;">Select a file to inspect structure...</div>
                            <div id="hw-outline-list" style="display: flex; flex-direction: column;"></div>
                        </div>
                    </div>

                    <!-- Accordion Section 2: Visual CSS Design Studio -->
                    <div class="menu-section" style="border-bottom: 1px solid var(--border-color);">
                        <div class="menu-header" id="hw-header-css" style="padding: 10px 12px; background: var(--bg-dark); display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-size: 12px; font-weight: 600; user-select: none;">
                            <span style="display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-palette" style="color: #00b4d8; width: 14px;"></i> Visual CSS Studio
                            </span>
                            <i class="fa-solid fa-chevron-down arrow-icon" id="hw-arrow-css" style="font-size: 10px; color: var(--text-muted); transition: transform 0.2s; transform: rotate(-90deg);"></i>
                        </div>
                        <div class="menu-content" id="hw-content-css" style="padding: 12px; display: none; flex-direction: column; gap: 10px; background: var(--bg-sidebar);">
                            <!-- Flexbox Builder -->
                            <div style="font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Flexbox Visualizer</div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                                <label style="font-size: 10px; color: var(--text-muted);">Direction
                                    <select id="css-flex-dir" style="width: 100%; margin-top: 2px; padding: 4px; background: var(--bg-darker); border: 1px solid var(--border-color); color: var(--text-main); font-size: 11px; border-radius: 4px;">
                                        <option value="row">row</option>
                                        <option value="column">column</option>
                                    </select>
                                </label>
                                <label style="font-size: 10px; color: var(--text-muted);">Justify
                                    <select id="css-flex-justify" style="width: 100%; margin-top: 2px; padding: 4px; background: var(--bg-darker); border: 1px solid var(--border-color); color: var(--text-main); font-size: 11px; border-radius: 4px;">
                                        <option value="center">center</option>
                                        <option value="space-between">space-between</option>
                                        <option value="flex-start">flex-start</option>
                                        <option value="flex-end">flex-end</option>
                                    </select>
                                </label>
                            </div>
                            <button id="css-flex-insert" style="padding: 6px; background: rgba(0, 180, 216, 0.15); border: 1px solid #00b4d8; color: #00b4d8; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600;">
                                Insert Flex Rule
                            </button>

                            <!-- Glassmorphism Generator -->
                            <div style="font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">Glassmorphism Generator</div>
                            <div style="display: flex; gap: 6px; align-items: center;">
                                <input type="range" id="css-glass-blur" min="4" max="30" value="12" style="flex: 1;" />
                                <span id="css-glass-val" style="font-size: 10px; color: var(--text-muted); width: 32px;">12px</span>
                            </div>
                            <button id="css-glass-insert" style="padding: 6px; background: rgba(0, 180, 216, 0.15); border: 1px solid #00b4d8; color: #00b4d8; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600;">
                                Insert Glassmorphism CSS
                            </button>
                        </div>
                    </div>

                    <!-- Accordion Section 3: Web Components & Snippets -->
                    <div class="menu-section" style="border-bottom: 1px solid var(--border-color);">
                        <div class="menu-header" id="hw-header-snippets" style="padding: 10px 12px; background: var(--bg-dark); display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-size: 12px; font-weight: 600; user-select: none;">
                            <span style="display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-cubes" style="color: #00b4d8; width: 14px;"></i> Components & Snippets
                            </span>
                            <i class="fa-solid fa-chevron-down arrow-icon" id="hw-arrow-snippets" style="font-size: 10px; color: var(--text-muted); transition: transform 0.2s; transform: rotate(-90deg);"></i>
                        </div>
                        <div class="menu-content" id="hw-content-snippets" style="padding: 10px; display: none; flex-direction: column; gap: 8px; background: var(--bg-sidebar);">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;" id="hw-snippets-grid"></div>
                        </div>
                    </div>

                    <!-- Accordion Section 4: Live Web Playground (Sandbox) -->
                    <div class="menu-section" style="border-bottom: 1px solid var(--border-color); flex: 1; display: flex; flex-direction: column;">
                        <div class="menu-header" id="hw-header-sandbox" style="padding: 10px 12px; background: var(--bg-dark); display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-size: 12px; font-weight: 600; user-select: none;">
                            <span style="display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-laptop-code" style="color: #00b4d8; width: 14px;"></i> Live Web Playground
                            </span>
                            <i class="fa-solid fa-chevron-down arrow-icon" id="hw-arrow-sandbox" style="font-size: 10px; color: var(--text-muted); transition: transform 0.2s; transform: rotate(-90deg);"></i>
                        </div>
                        <div class="menu-content" id="hw-content-sandbox" style="padding: 10px; display: none; flex-direction: column; gap: 8px; background: var(--bg-sidebar); flex: 1;">
                            <p style="margin: 0; font-size: 11px; color: var(--text-muted);">Draft HTML/CSS code & see instant rendering.</p>
                            <textarea id="hw-sandbox-code" spellcheck="false" style="height: 110px; background: var(--bg-darker); border: 1px solid var(--border-color); border-radius: 4px; color: #00b4d8; font-family: var(--font-code, monospace); font-size: 11px; padding: 6px; resize: none; outline: none;" placeholder="<h2 style='color:#00b4d8'>Live Sandbox</h2>&#10;<p>Test HTML components...</p>"></textarea>
                            <iframe id="hw-sandbox-preview" style="flex: 1; min-height: 120px; border: 1px solid var(--border-color); border-radius: 4px; background: #ffffff;"></iframe>
                        </div>
                    </div>
                </div>
            `;

            // Accordion Logic
            const hOutline = container.querySelector('#hw-header-outline');
            const cOutline = container.querySelector('#hw-content-outline');
            const aOutline = container.querySelector('#hw-arrow-outline');

            const hCss = container.querySelector('#hw-header-css');
            const cCss = container.querySelector('#hw-content-css');
            const aCss = container.querySelector('#hw-arrow-css');

            const hSnippets = container.querySelector('#hw-header-snippets');
            const cSnippets = container.querySelector('#hw-content-snippets');
            const aSnippets = container.querySelector('#hw-arrow-snippets');

            const hSandbox = container.querySelector('#hw-header-sandbox');
            const cSandbox = container.querySelector('#hw-content-sandbox');
            const aSandbox = container.querySelector('#hw-arrow-sandbox');

            const toggle = (c, a, force) => {
                const open = force !== undefined ? force : c.style.display === 'none';
                c.style.display = open ? (c.id === 'hw-content-outline' ? 'block' : 'flex') : 'none';
                a.style.transform = open ? 'rotate(0deg)' : 'rotate(-90deg)';
            };

            hOutline.addEventListener('click', () => toggle(cOutline, aOutline));
            hCss.addEventListener('click', () => toggle(cCss, aCss));
            hSnippets.addEventListener('click', () => toggle(cSnippets, aSnippets));
            hSandbox.addEventListener('click', () => toggle(cSandbox, aSandbox));

            // Custom event listener for sandbox
            container.addEventListener('open-sandbox-accordion', () => {
                toggle(cOutline, aOutline, false);
                toggle(cCss, aCss, false);
                toggle(cSnippets, aSnippets, false);
                toggle(cSandbox, aSandbox, true);
            });

            // 1. Outline Rebuilder
            const statusEl = container.querySelector('#hw-outline-status');
            const listEl = container.querySelector('#hw-outline-list');

            const rebuildOutline = () => {
                if (!container.isConnected) return;
                const file = api.editor.getActiveFile();
                const langId = (api.editor.getLanguageId() || '').toLowerCase();
                const text = api.editor.getText() || '';

                if (!file) {
                    statusEl.textContent = 'Open an HTML, CSS or JS file to view outline.';
                    listEl.innerHTML = '';
                    return;
                }

                let symbols = null;
                if (langId === 'html' || langId === 'htm') symbols = parseHtml(text);
                else if (['css', 'scss', 'less'].includes(langId)) symbols = parseCss(text);
                else if (['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx'].includes(langId)) symbols = parseJs(text);

                if (!symbols || symbols.length === 0) {
                    statusEl.textContent = `${file.name} — no symbols detected.`;
                    listEl.innerHTML = '';
                    return;
                }

                statusEl.textContent = `${file.name} (${symbols.length} symbols)`;
                listEl.innerHTML = '';
                symbols.forEach((sym) => {
                    const row = document.createElement('button');
                    row.type = 'button';
                    row.style.cssText = `display:flex; align-items:center; gap:6px; width:100%; background:none; border:none; text-align:left; cursor:pointer; color:var(--text-main); font-size:11.5px; padding:3px 6px; padding-left:${6 + Math.min(sym.depth || 0, 10) * 10}px; border-radius:4px; margin-bottom:1px;`;
                    row.innerHTML = `<i class="${sym.icon}" style="color:#00b4d8; font-size:10px;"></i> <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${sym.label}</span> <span style="font-size:9px; color:var(--text-muted);">${sym.line}</span>`;
                    row.addEventListener('click', () => api.editor.goToLine(sym.line));
                    listEl.appendChild(row);
                });
            };

            rebuildOutline();
            api.events.on('file-opened', rebuildOutline);
            api.events.on('content-changed', rebuildOutline);

            // 2. CSS Design Studio Logic
            const flexDir = container.querySelector('#css-flex-dir');
            const flexJustify = container.querySelector('#css-flex-justify');
            const flexBtn = container.querySelector('#css-flex-insert');
            flexBtn.addEventListener('click', () => {
                const rule = `display: flex;\nflex-direction: ${flexDir.value};\njustify-content: ${flexJustify.value};\nalign-items: center;\n`;
                api.editor.insertAtCursor(rule);
            });

            const glassBlur = container.querySelector('#css-glass-blur');
            const glassVal = container.querySelector('#css-glass-val');
            const glassBtn = container.querySelector('#css-glass-insert');

            glassBlur.addEventListener('input', () => {
                glassVal.textContent = `${glassBlur.value}px`;
            });
            glassBtn.addEventListener('click', () => {
                const val = glassBlur.value;
                const rule = `background: rgba(255, 255, 255, 0.05);\nbackdrop-filter: blur(${val}px);\n-webkit-backdrop-filter: blur(${val}px);\nborder: 1px solid rgba(255, 255, 255, 0.1);\nborder-radius: 12px;\n`;
                api.editor.insertAtCursor(rule);
            });

            // 3. Components Library Snippets
            const snippetsGrid = container.querySelector('#hw-snippets-grid');
            const SNIPPETS = [
                { name: 'HTML5 Skeleton', icon: 'fa-regular fa-file-code', code: '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <title>Document</title>\n</head>\n<body>\n    \n</body>\n</html>' },
                { name: 'Card Component', icon: 'fa-solid fa-id-card', code: '<div class="card">\n    <h3>Card Title</h3>\n    <p>Card description text goes here.</p>\n</div>' },
                { name: 'Primary Button', icon: 'fa-solid fa-toggle-on', code: '<button class="btn btn-primary">Click Me</button>' },
                { name: 'Input Form Group', icon: 'fa-solid fa-keyboard', code: '<div class="form-group">\n    <label for="email">Email Address</label>\n    <input type="email" id="email" placeholder="enter email">\n</div>' },
                { name: 'SVG Icon', icon: 'fa-solid fa-icons', code: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20"/></svg>' },
                { name: 'Media Query', icon: 'fa-solid fa-mobile-screen', code: '@media (max-width: 768px) {\n    .container { flex-direction: column; }\n}' }
            ];

            SNIPPETS.forEach(s => {
                const btn = document.createElement('button');
                btn.style.cssText = 'display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; padding:8px; background:var(--bg-darker); border:1px solid var(--border-color); border-radius:6px; color:var(--text-main); cursor:pointer; font-size:10px; transition:border-color 0.2s;';
                btn.innerHTML = `<i class="${s.icon}" style="color:#00b4d8; font-size:14px;"></i> <span>${s.name}</span>`;
                btn.addEventListener('click', () => {
                    api.editor.insertAtCursor(s.code);
                });
                snippetsGrid.appendChild(btn);
            });

            // 4. Live Sandbox Sandbox Logic
            const sandboxCode = container.querySelector('#hw-sandbox-code');
            const sandboxPreview = container.querySelector('#hw-sandbox-preview');

            const updateSandbox = () => {
                const doc = sandboxPreview.contentDocument || sandboxPreview.contentWindow.document;
                doc.open();
                doc.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: system-ui, sans-serif; padding: 12px; margin: 0; background: #ffffff; color: #1e293b; }
                        </style>
                    </head>
                    <body>${sandboxCode.value}</body>
                    </html>
                `);
                doc.close();
            };

            sandboxCode.addEventListener('input', updateSandbox);
            updateSandbox();
        }
    });
}
