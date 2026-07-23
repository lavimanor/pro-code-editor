export function activate(api) {
    // 1. Register custom NeonScript language
    api.languages.register('neonscript', {
        name: 'NeonScript',
        extensions: ['neon'],
        db: [
            { label: 'neonBeam', insertText: 'neonBeam()', type: 'function' },
            { label: 'fluxCapacitor', insertText: 'fluxCapacitor', type: 'variable' },
            { label: 'activateCore', insertText: 'activateCore()', type: 'keyword' }
        ],
        parser: 'neon',
        parserRules: [
            { regex: /define\s+([a-zA-Z_][a-zA-Z0-9_]*)/g, group: 1, type: 'variable' }
        ]
    });
    
    // 2. Register the Neon Blue Theme
    api.themes.register('custom-neon-blue', {
        name: 'Custom Neon Blue Theme',
        colors: {
            '--bg-darker': '#050a12',
            '--bg-dark': '#0d1b2a',
            '--bg-sidebar': '#1b263b',
            '--bg-button': '#415a77',
            '--bg-tab-inactive': '#0d1b2a',
            '--accent-color': '#00b4d8',
            '--accent-hover': '#90e0ef',
            '--text-main': '#e0e1dd',
            '--text-muted': '#778da9',
            '--border-color': '#415a77',
            '--scrollbar-thumb': '#415a77',
            '--scrollbar-thumb-hover': '#778da9',
            '--syntax-comment': '#778da9',
            '--syntax-doctype': '#00b4d8',
            '--syntax-tag-name': '#00b4d8',
            '--syntax-attr-name': '#90e0ef',
            '--syntax-attr-value': '#e0e1dd',
            '--syntax-tag-bracket': '#778da9',
            '--syntax-keyword': '#00b4d8',
            '--syntax-string': '#90e0ef',
            '--syntax-function': '#90e0ef',
            '--syntax-builtin': '#00b4d8',
            '--syntax-number': '#00b4d8',
            '--syntax-punctuation': '#e0e1dd',
            '--syntax-bracket': '#3267fc'
        }
    });

    // 3. Register Cyberpunk Icon Pack
    api.icons.register('cyberpunk', {
        name: 'Cyberpunk Icons (Custom)',
        getFolderIcon: () => '⚡',
        getFileIcon: (fileName) => {
            const ext = fileName.split('.').pop().toLowerCase();
            switch(ext) {
                case 'js': return '⧉';
                case 'html': return '⚛';
                case 'css': return '✦';
                case 'neon': return '✹';
                // default: return '⌺';
            }
        }
    });

    // 4. Register custom runner for .neon files
    api.terminal.registerRunner('neon', {
        label: 'NeonScript Engine',
        run: [
            { 
                cmd: 'node', 
                args: ['-e', 'console.log("NeonScript executing target: " + process.argv[1]); console.log("Success! Active power output: 1.21 Gigawatts.");', '{file}'] 
            }
        ]
    });

    // 5. Register custom sidebar panel (New test addition)
    api.views.registerSidebarPanel('neon-diagnostics', {
        iconClass: 'fa-solid fa-gauge-high',
        title: 'Neon Monitor',
        render: (container) => {
            container.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:12px;">
                    <h4 style="color:#00b4d8; font-size:14px; border-bottom:1px solid #415a77; padding-bottom:6px;">Status: ACTIVE</h4>
                    <p style="font-size:12px; color:#778da9;">System monitoring active. Real-time metrics are fully stable.</p>
                    <div style="background:#050a12; border:1px solid #415a77; padding:8px; border-radius:4px; font-family:monospace; font-size:11px;">
                        <div>CORE_TEMP: 38C</div>
                        <div>SPARKLE_POWER: <span id="diag-sparkle-val">OFF</span></div>
                        <div>NEON_FLUX: 1.21 GW</div>
                    </div>
                    <button id="btn-neon-trigger" style="background:#00b4d8; color:#050a12; border:none; padding:8px; border-radius:4px; font-weight:600; cursor:pointer; font-family:sans-serif; font-size:12px;">Pulse Reactor</button>
                </div>
            `;
            
            const btn = container.querySelector('#btn-neon-trigger');
            if (btn) {
                btn.addEventListener('click', () => {
                    alert('Neon Flux Reactor Pulsed Successfully!');
                });
            }

            // Read from persistent local pref
            const sparkleVal = container.querySelector('#diag-sparkle-val');
            if (sparkleVal) {
                const isSparkleActive = localStorage.getItem('setting-pref-neon-sparkle') === 'true';
                sparkleVal.textContent = isSparkleActive ? '100% MAXIMUM' : 'OFF';
            }
        }
    });

    // 6. Register custom preference settings (New test addition)
    api.views.registerSetting('neon-sparkle', {
        label: 'Enable Neon Sparkle Effect',
        type: 'checkbox',
        defaultValue: false,
        pluginId: 'sample-extension', // Maps this setting directly to the Sample Extension page
        description: 'Injects neon beams and sparkle effects across diagnostic overlays.',
        onChange: (isChecked) => {
            const sparkleVal = document.getElementById('diag-sparkle-val');
            if (sparkleVal) {
                sparkleVal.textContent = isChecked ? '100% MAXIMUM' : 'OFF';
            }
        }
    });

    // 7. Register custom syntax highlighting for your NeonScript language (New Addition)
    api.languages.registerHighlighter('neonscript', [
        { type: 'comment', regex: /\/\/.*|#.*/ },
        { type: 'string', regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/ },
        { type: 'keyword', regex: /\b(?:define|activateCore|fluxCapacitor)\b/ },
        { type: 'function', regex: /\b[a-zA-Z_]\w*(?=\s*\()/ },
        { type: 'number', regex: /\b\d+(?:\.\d+)?\b/ }
    ]);

    api.languages.registerLspClient('py', 'pyright-langserver', ['--stdio']);

    // 8. Register custom diagnostic highlighting style (New Addition)
    api.views.registerDiagnosticStyle('neon-sparkle', {
        name: 'Neon Sparkle Underline',
        errorClass: 'diag-error-neon',
        warningClass: 'diag-warning-neon'
    });

    // 9. Contribute entries to the file explorer's right-click menu (New Addition)

    // Only shown on .neon files — demonstrates the `when` predicate and a nested submenu.
    api.menus.registerExplorerItem('neon-tools', {
        label: 'NeonScript',
        icon: 'fa-solid fa-bolt',
        group: 'plugins',
        when: (ctx) => ctx.kind === 'file' && ctx.name.endsWith('.neon'),
        submenu: (ctx) => [
            {
                label: 'Validate Reactor Syntax',
                icon: 'fa-solid fa-circle-check',
                onClick: () => alert(`Validating ${ctx.name}...\nAll neon beams aligned.`)
            },
            {
                label: 'Show Flux Report',
                icon: 'fa-solid fa-chart-line',
                onClick: () => alert(`Flux output for ${ctx.name}: 1.21 GW`)
            }
        ]
    });

    // Shown on any folder — demonstrates a dynamic label and a custom group.
    api.menus.registerExplorerItem('neon-scan-folder', {
        label: (ctx) => `Scan "${ctx.name}" for Neon Files`,
        icon: 'fa-solid fa-magnifying-glass',
        group: 'neon',
        when: (ctx) => ctx.kind === 'directory' || ctx.isRoot,
        onClick: (ctx) => {
            window.printToTerminal(`[NeonScript] Scanning ${ctx.path} for .neon sources...`, 'system');
        }
    });
}