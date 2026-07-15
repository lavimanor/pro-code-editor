const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { execFile, exec, spawn } = require('child_process');
const { StringDecoder } = require('string_decoder');

// Load default core code execution configurations dynamically
let RUN_CONFIG_REGISTRY = {};
try {
    const defaults = require('./run-config');
    RUN_CONFIG_REGISTRY = { ...defaults };
} catch (err) {
    console.error('Failed to parse default run-config:', err);
}

const MIME_TYPES = {
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

let webServer = null;

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        backgroundColor: '#1e1e1e',
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false
        }
    });

    win.loadFile('index.html');
}

ipcMain.on('window-minimize', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.minimize();
});

ipcMain.on('window-maximize', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
        if (win.isMaximized()) {
            win.unmaximize();
        } else {
            win.maximize();
        }
    }
});

ipcMain.on('window-close', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.close();
});

ipcMain.handle('open-directory', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    if (result.canceled) return null;
    return result.filePaths[0];
});

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

ipcMain.handle('start-server', (event, folderPath, activeFileName) => {
    return new Promise((resolve) => {
        if (webServer) {
            webServer.close();
        }

        webServer = http.createServer((req, res) => {
            let reqUrl = req.url.split('?')[0];
            if (reqUrl === '/') reqUrl = '/index.html';

            let decodedUrl = reqUrl;
            try {
                decodedUrl = decodeURIComponent(reqUrl);
            } catch (e) {
                console.error('Failed to decode URI:', e);
            }

            const filePath = path.resolve(folderPath, decodedUrl.replace(/^\//, ''));
            const normFolderPath = path.resolve(folderPath).toLowerCase();
            const normFilePath = filePath.toLowerCase();
            
            if (!normFilePath.startsWith(normFolderPath)) {
                res.writeHead(403, { 'Content-Type': 'text/plain' });
                res.end('403 Forbidden');
                return;
            }
            
            fs.readFile(filePath, (err, content) => {
                if (err) {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('404 Not Found');
                    return;
                }

                const ext = path.extname(filePath).toLowerCase();
                const contentType = MIME_TYPES[ext] || 'application/octet-stream';
                
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content);
            });
        });

        webServer.on('error', (err) => {
            console.error('Server error:', err);
            resolve(null);
        });

        webServer.listen(5500, () => {
            const targetPath = activeFileName ? `/${activeFileName}` : '';
            const serverUrl = `http://localhost:5500${targetPath}`;
            
            const { shell } = require('electron');
            shell.openExternal(serverUrl);
            resolve(`http://localhost:5500`);
        });
    });
});

ipcMain.handle('stop-server', () => {
    return new Promise((resolve) => {
        if (webServer) {
            webServer.close(() => {
                webServer = null;
                resolve(true);
            });
        } else {
            resolve(true);
        }
    });
});

// =====================================================================
//  Code Execution Engine
// =====================================================================

let activeChild = null;

function buildContext(filePath) {
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const base = path.basename(filePath, ext);
    return {
        file: filePath,
        dir,
        base,
        exe: path.join(dir, `${base}.exe`)
    };
}

function substitute(value, ctx) {
    return value
        .replace(/\{file\}/g, ctx.file)
        .replace(/\{dir\}/g, ctx.dir)
        .replace(/\{base\}/g, ctx.base)
        .replace(/\{exe\}/g, ctx.exe);
}

function resolveCandidate(candidate, ctx) {
    let cmd = substitute(candidate.cmd, ctx);
    return {
        cmd,
        args: (candidate.args || []).map(a => substitute(a, ctx))
    };
}

function launchStep(candidates, ctx, send) {
    return new Promise((resolve, reject) => {
        let idx = 0;
        const attempt = () => {
            if (idx >= candidates.length) {
                reject(new Error('command not found'));
                return;
            }
            const { cmd, args } = resolveCandidate(candidates[idx++], ctx);
            let child;
            const isWindows = process.platform === 'win32';
            const env = {
                ...process.env,
                PYTHONUTF8: '1',
                PYTHONIOENCODING: 'UTF-8',
                LANG: 'en_US.UTF-8',
                LC_ALL: 'en_US.UTF-8'
            };
            try {
                // Only use shell: true on Windows for batch files/scripts that require cmd.exe to execute.
                // Standard PE binaries (like python, node, java, dotnet) should run with shell: false
                // to prevent cmd.exe from incorrectly splitting arguments containing spaces.
                const cmdLower = cmd.toLowerCase();
                const needsShell = isWindows && (
                    cmdLower.endsWith('.cmd') || 
                    cmdLower.endsWith('.bat') || 
                    ['npm', 'npx', 'yarn', 'pnpm', 'gulp'].includes(cmdLower)
                );

                child = spawn(cmd, args, { 
                    cwd: ctx.dir,
                    shell: needsShell,
                    env
                });
            } catch (e) {
                attempt();
                return;
            }

            let launched = false;
            const stdoutDecoder = new StringDecoder('utf8');
            const stderrDecoder = new StringDecoder('utf8');

            child.once('spawn', () => {
                launched = true;
                if (child.stdout) child.stdout.on('data', d => send('stdout', stdoutDecoder.write(d)));
                if (child.stderr) child.stderr.on('data', d => send('stderr', stderrDecoder.write(d)));
                resolve(child);
            });
            child.once('error', (err) => {
                if (!launched) {
                    attempt();
                } else {
                    send('stderr', `\n[Process error] ${err.message}\n`);
                }
            });
        };
        attempt();
    });
}

async function runIntegrated(event, config, ctx) {
    if (activeChild) {
        try { activeChild.kill(); } catch (e) { /* ignore */ }
        activeChild = null;
    }

    const send = (stream, data) => {
        if (event.sender && !event.sender.isDestroyed()) {
            event.sender.send('run-output', { stream, data });
        }
    };

    send('system', `[Running ${config.label}...]\n`);
    let runChild;
    try {
        runChild = await launchStep(config.run, ctx, send);
    } catch (e) {
        return { success: false, output: `[Runtime Error] Could not launch ${config.label}. Verify it is installed and on your PATH.` };
    }

    activeChild = runChild;
    runChild.once('close', (code) => {
        if (activeChild === runChild) activeChild = null;
        if (event.sender && !event.sender.isDestroyed()) {
            event.sender.send('run-exit', { code });
        }
    });

    return { success: true, running: true };
}

async function runExternal(config, ctx) {
    if (!config.run || !config.run.length) {
        return { success: false, output: `[Error] Run configuration is empty.` };
    }
    const runCand = resolveCandidate(config.run[0], ctx);
    const platform = process.platform;

    let pause = false;
    try {
        const code = fs.readFileSync(ctx.file, 'utf8');
        pause = /\binput\s*\(|\braw_input\s*\(|\bReadKey\b|\bReadLine\b|\bScanner\b/i.test(code);
    } catch (e) { /* ignore */ }

    if (platform === 'win32') {
        const escapedArgs = runCand.args.map(arg => {
            // Enclose parameters in quotes if they contain spaces or special characters
            if (arg.includes(' ') || arg.includes('&') || arg.includes('^') || arg.includes('(') || arg.includes(')')) {
                return `"${arg.replace(/"/g, '')}"`; // Remove inner quotes to avoid triple-quoting
            }
            return arg;
        });
        const cmdEscaped = runCand.cmd.includes(' ') ? `"${runCand.cmd.replace(/"/g, '')}"` : runCand.cmd;
        const inner = [cmdEscaped, ...escapedArgs].join(' ');
        
        // Wrap the entire command string in an extra set of outer double quotes.
        // This satisfies cmd.exe's parsing rules exactly, preventing paths with spaces from breaking.
        const runCmd = pause
            ? `start "" cmd.exe /c ""${inner}" & pause"`
            : `start "" cmd.exe /k ""${inner}""`;

        return new Promise((resolve) => {
            exec(runCmd, { cwd: ctx.dir }, (runErr) => {
                if (runErr) {
                    resolve({ success: false, output: `[Runtime Launch Error]\n${runErr.message}` });
                } else {
                    resolve({ success: true, output: `[Launched ${config.label} in an external CMD window]` });
                }
            });
        });
    } else if (platform === 'darwin') {
        const escapedArgs = runCand.args.map(arg => `'${arg.replace(/'/g, "'\\''")}'`);
        const cmdEscaped = runCand.cmd.includes(' ') ? `'${runCand.cmd}'` : runCand.cmd;
        let inner = [cmdEscaped, ...escapedArgs].join(' ');
        if (pause) {
            inner += `; echo; read -p 'Press Enter to close...'`;
        }

        const appleScript = `
            tell application "Terminal"
                do script "cd '${ctx.dir.replace(/'/g, "'\\''")}' && ${inner.replace(/"/g, '\\"')}"
                activate
            end tell
        `;

        return new Promise((resolve) => {
            const child = spawn('osascript', ['-e', appleScript]);
            child.on('error', (err) => {
                resolve({ success: false, output: `[Runtime Launch Error]\n${err.message}` });
            });
            child.on('close', (code) => {
                if (code === 0) {
                    resolve({ success: true, output: `[Launched ${config.label} in macOS Terminal]` });
                } else {
                    resolve({ success: false, output: `[Runtime Launch Error] osascript exited with code ${code}` });
                }
            });
        });
    } else {
        const escapedArgs = runCand.args.map(arg => `'${arg.replace(/'/g, "'\\''")}'`);
        const cmdEscaped = runCand.cmd.includes(' ') ? `'${runCand.cmd}'` : runCand.cmd;
        let inner = [cmdEscaped, ...escapedArgs].join(' ');
        if (pause) {
            inner += `; echo; read -p 'Press Enter to close...'`;
        }

        const terminals = [
            { cmd: 'x-terminal-emulator', args: ['-e', `bash -c "cd '${ctx.dir}' && ${inner}"`] },
            { cmd: 'gnome-terminal', args: ['--', 'bash', '-c', `cd '${ctx.dir}' && ${inner}`] },
            { cmd: 'konsole', args: ['-e', 'bash', '-c', `cd '${ctx.dir}' && ${inner}`] },
            { cmd: 'xfce4-terminal', args: ['-e', `bash -c "cd '${ctx.dir}' && ${inner}"`] },
            { cmd: 'xterm', args: ['-e', `bash -c "cd '${ctx.dir}' && ${inner}"`] }
        ];

        return new Promise((resolve) => {
            let termIdx = 0;
            const tryNextTerminal = () => {
                if (termIdx >= terminals.length) {
                    resolve({ success: false, output: `[Runtime Launch Error] No supported terminal emulator found.` });
                    return;
                }
                const t = terminals[termIdx++];
                const proc = spawn(t.cmd, t.args);
                proc.on('error', () => {
                    tryNextTerminal();
                });
                proc.on('spawn', () => {
                    resolve({ success: true, output: `[Launched ${config.label} in ${t.cmd}]` });
                });
            };
            tryNextTerminal();
        });
    }
}
ipcMain.handle('run-file', async (event, filePath, mode) => {
    const ext = path.extname(filePath).replace('.', '').toLowerCase();
    const config = RUN_CONFIG_REGISTRY[ext];
    if (!config) {
        return { success: false, output: `[Unsupported] No run configuration exists for .${ext} files.` };
    }
    const ctx = buildContext(filePath);
    if (mode === 'external') {
        return runExternal(config, ctx);
    }
    return runIntegrated(event, config, ctx);
});

ipcMain.handle('run-input', (event, text) => {
    if (activeChild && activeChild.stdin && activeChild.stdin.writable) {
        activeChild.stdin.write(text + '\n');
        return true;
    }
    return false;
});

ipcMain.handle('run-kill', () => {
    if (activeChild) {
        try { activeChild.kill(); } catch (e) { /* ignore */ }
        activeChild = null;
        return true;
    }
    return false;
});

ipcMain.handle('get-run-langs', () => {
    const langs = {};
    for (const [ext, cfg] of Object.entries(RUN_CONFIG_REGISTRY)) {
        langs[ext] = cfg.label;
    }
    return langs;
});

// =====================================================================
//  Plugin Scanning & Manifest Discovery
// =====================================================================
ipcMain.handle('scan-plugins', async () => {
    const customDir = path.join(__dirname, 'custom');
    const extensionsDir = path.join(customDir, 'extensions');
    const idesDir = path.join(customDir, 'ides');

    if (!fs.existsSync(customDir)) fs.mkdirSync(customDir);
    if (!fs.existsSync(extensionsDir)) fs.mkdirSync(extensionsDir);
    if (!fs.existsSync(idesDir)) fs.mkdirSync(idesDir);

    const plugins = [];
    const ICON_EXTENSIONS = ['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.avif'];

    const resolveIconPath = (fullPath, relativePath, manifest) => {
        const toWeb = (abs) => path.relative(__dirname, abs).replace(/\\/g, '/');

        if (manifest && typeof manifest.icon === 'string' && manifest.icon.trim()) {
            const declared = path.join(fullPath, manifest.icon);
            if (fs.existsSync(declared)) return toWeb(declared);
        }
        for (const ext of ICON_EXTENSIONS) {
            const candidate = path.join(fullPath, `icon${ext}`);
            if (fs.existsSync(candidate)) return toWeb(candidate);
        }
        return null;
    };

    const readManifest = (fullPath, folder, expectedType, extra = {}) => {
        const manifestPath = path.join(fullPath, 'package.json');
        if (!fs.existsSync(manifestPath)) {
            return { error: 'Missing package.json file inside plugin directory', _dirName: folder, type: expectedType, ...extra };
        }
        try {
            const content = fs.readFileSync(manifestPath, 'utf8');
            const manifest = JSON.parse(content);

            manifest._localPath = fullPath;
            manifest._dirName = folder;
            manifest.type = manifest.type || expectedType;

            const relativePath = path.relative(__dirname, fullPath).replace(/\\/g, '/');
            manifest._relativePath = relativePath;
            manifest._iconPath = resolveIconPath(fullPath, relativePath, manifest);

            if (manifest.extensionDependencies && !Array.isArray(manifest.extensionDependencies)) {
                manifest.extensionDependencies = [manifest.extensionDependencies];
            }

            return { ...manifest, ...extra };
        } catch (err) {
            return { error: `Failed to parse package.json: ${err.message}`, _dirName: folder, type: expectedType, ...extra };
        }
    };

    const scanDir = (dirPath, expectedType) => {
        if (!fs.existsSync(dirPath)) return;
        const folders = fs.readdirSync(dirPath);

        for (const folder of folders) {
            const fullPath = path.join(dirPath, folder);
            const stat = fs.statSync(fullPath);
            if (!stat.isDirectory()) continue;

            const manifest = readManifest(fullPath, folder, expectedType);

            if (expectedType === 'ide' && !manifest.error) {
                const bundledDir = path.join(fullPath, 'extensions');
                if (fs.existsSync(bundledDir)) {
                    for (const sub of fs.readdirSync(bundledDir)) {
                        const subPath = path.join(bundledDir, sub);
                        if (!fs.statSync(subPath).isDirectory()) continue;
                        const bundled = readManifest(subPath, sub, 'extension', {
                            _bundledBy: manifest.id || folder,
                            _bundledByName: manifest.name || folder
                        });
                        plugins.push(bundled);
                    }
                }
            }

            plugins.push(manifest);
        }
    };

    scanDir(extensionsDir, 'extension');
    scanDir(idesDir, 'ide');

    return plugins;
});

ipcMain.handle('register-runner', (event, ext, config) => {
    const cleanExt = ext.replace('.', '').toLowerCase();
    RUN_CONFIG_REGISTRY[cleanExt] = config;
    return true;
});

// =====================================================================
//  System Environment Control Bridge
// =====================================================================
ipcMain.handle('relaunch-app', () => {
    app.relaunch();
    app.exit(0);
});

function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    if (isDirectory) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest);
        }
        fs.readdirSync(src).forEach(function(childItemName) {
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

ipcMain.handle('copy-ide-template', async (event, ideId, templateFolder, targetPath) => {
    const customDir = path.join(__dirname, 'custom');
    const idesDir = path.join(customDir, 'ides');
    const ideDir = path.join(idesDir, ideId);
    const sourceDir = path.join(ideDir, templateFolder);

    if (!fs.existsSync(sourceDir)) {
        return { success: false, error: `Template path not found: ${sourceDir}` };
    }

    try {
        copyRecursiveSync(sourceDir, targetPath);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('reset-runners', () => {
    try {
        delete require.cache[require.resolve('./run-config')];
        const defaults = require('./run-config');
        RUN_CONFIG_REGISTRY = { ...defaults };
    } catch (err) {
        console.error('Failed to reset run config default values:', err);
    }
    return true;
});

ipcMain.handle('focus-fix', () => {
    const wins = BrowserWindow.getAllWindows();
    if (wins.length > 0) {
        wins[0].blur();
        wins[0].focus();
    }
    return true;
});

// =====================================================================
//  LSP (Language Server Protocol) Process Subsystem
// =====================================================================

class LspProcess {
    constructor(id, command, args, win, cwd) {
        this.id = id;
        this.win = win;
        
        const isWindows = process.platform === 'win32';
        if (isWindows) {
            const cmdString = [command, ...args].join(' ');
            // Noisy spawn logging quieted:
            // console.log(`[LSP Main Debug] Windows Spawn: "${cmdString}" in cwd: "${cwd}"`);
            this.child = spawn(cmdString, { 
                cwd,
                shell: true
            });
        } else {
            // console.log(`[LSP Main Debug] Unix Spawn: "${command}" args: ${args} in cwd: "${cwd}"`);
            this.child = spawn(command, args, { 
                cwd,
                shell: false
            });
        }
        
        // if (this.child.pid) {
        //     console.log(`[LSP Main Debug] Subprocess successfully spawned. PID: ${this.child.pid}`);
        // }
        
        this.buffer = Buffer.alloc(0);

        this.child.stdout.on('data', (data) => {
            this.buffer = Buffer.concat([this.buffer, data]);
            this.parseBuffer();
        });

        this.child.stderr.on('data', (data) => {
            console.error(`[LSP ${id} Error]`, data.toString());
        });

        this.child.on('error', (err) => {
            console.error(`[LSP ${id} Spawn Error]`, err);
        });

        this.child.on('close', (code) => {
            console.log(`[LSP ${id}] Subprocess exited with code ${code}`);
        });
    }

    send(message) {
        const json = JSON.stringify(message);
        const payload = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`;
        if (this.child.stdin.writable) {
            this.child.stdin.write(payload);
        }
    }

    parseBuffer() {
        while (true) {
            const headerEnd = this.buffer.indexOf('\r\n\r\n');
            if (headerEnd === -1) break;

            const headerPart = this.buffer.toString('utf8', 0, headerEnd);
            const lengthMatch = headerPart.match(/Content-Length:\s*(\d+)/i);
            if (!lengthMatch) {
                this.buffer = this.buffer.subarray(headerEnd + 4);
                continue;
            }

            const contentLength = parseInt(lengthMatch[1], 10);
            const bodyStart = headerEnd + 4;

            if (this.buffer.length < bodyStart + contentLength) {
                break;
            }

            const bodyBuffer = this.buffer.subarray(bodyStart, bodyStart + contentLength);
            this.buffer = this.buffer.subarray(bodyStart + contentLength);

            try {
                const bodyStr = bodyBuffer.toString('utf8');
                const msg = JSON.parse(bodyStr);
                
                // console.log(`[LSP Main Debug] Parsed Message from "${this.id}" | Method: "${msg.method || 'Response'}" | ID: ${msg.id !== undefined ? msg.id : 'N/A'}`);
                
                if (this.win && !this.win.isDestroyed()) {
                    this.win.webContents.send('lsp-message', { lspId: this.id, message: msg });
                }
            } catch (err) {
                console.error('Failed to parse LSP JSON-RPC message body:', err);
            }
        }
    }

    kill() {
        try { this.child.kill(); } catch (e) {}
    }
}

const activeLspServers = new Map();

ipcMain.handle('lsp-start', (event, lspId, command, args, cwd, initializationOptions) => {
    console.log(`[LSP Main Debug] lsp-start IPC handler received lspId: "${lspId}" | cmd: "${command}"`);
    const win = BrowserWindow.fromWebContents(event.sender);
    
    let finalOptions = initializationOptions || {};
    if (process.platform === 'win32' && command.startsWith('typescript-language-server')) {
        try {
            const { execSync } = require('child_process');
            const globalNpmRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
            const resolvedPath = path.join(globalNpmRoot, 'typescript/lib/tsserver.js');
            
            if (fs.existsSync(resolvedPath)) {
                finalOptions = {
                    ...finalOptions,
                    tsserver: {
                        path: resolvedPath
                    }
                };
                console.log(`[LSP Main Debug] Dynamically resolved global tsserver.js path: "${resolvedPath}"`);
            } else {
                console.warn(`[LSP Main Debug Warning] Resolved tsserver.js path does not exist: "${resolvedPath}"`);
            }
        } catch (err) {
            console.error('[LSP Main Debug Error] Failed to query global npm root for tsserver path:', err.message);
        }
    }

    if (activeLspServers.has(lspId)) {
        console.log(`[LSP Main Debug] Terminating old active instance of "${lspId}"...`);
        activeLspServers.get(lspId).kill();
    }

    try {
        const server = new LspProcess(lspId, command, args, win, cwd);
        activeLspServers.set(lspId, server);
        return { success: true, initializationOptions: finalOptions };
    } catch (err) {
        console.error(`[LSP Main Debug] Failed to instantiate LspProcess:`, err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('lsp-send', (event, lspId, message) => {
    const server = activeLspServers.get(lspId);
    if (server) {
        server.send(message);
        return true;
    }
    return false;
});

ipcMain.handle('lsp-stop', (event, lspId) => {
    const server = activeLspServers.get(lspId);
    if (server) {
        server.kill();
        activeLspServers.delete(lspId);
        return true;
    }
    return false;
});

app.on('will-quit', () => {
    activeLspServers.forEach(server => server.kill());
    activeLspServers.clear();
});