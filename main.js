const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { execFile, exec, spawn } = require('child_process');
const RUN_CONFIG = require('./run-config');

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
            if (!filePath.startsWith(path.resolve(folderPath))) {
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
//  Code Execution Engine (Direct Execution Only)
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
            try {
                child = spawn(cmd, args, { cwd: ctx.dir });
            } catch (e) {
                attempt();
                return;
            }

            let launched = false;
            child.once('spawn', () => {
                launched = true;
                if (child.stdout) child.stdout.on('data', d => send('stdout', d.toString()));
                if (child.stderr) child.stderr.on('data', d => send('stderr', d.toString()));
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

function quoteWin(s) {
    return `"${String(s).replace(/"/g, '')}"`;
}

async function runExternal(config, ctx) {
    const runCand = resolveCandidate(config.run[0], ctx);
    const inner = [quoteWin(runCand.cmd), ...runCand.args.map(quoteWin)].join(' ');

    let pause = false;
    try {
        const code = fs.readFileSync(ctx.file, 'utf8');
        pause = /\binput\s*\(|\braw_input\s*\(|\bReadKey\b|\bReadLine\b|\bScanner\b/i.test(code);
    } catch (e) { /* ignore */ }

    const runCmd = pause
        ? `start "" cmd.exe /s /c "${inner} & echo. & echo [Press any key to close the window...] & pause > nul"`
        : `start "" cmd.exe /s /k "${inner}"`;

    return new Promise((resolve) => {
        exec(runCmd, (runErr) => {
            if (runErr) {
                resolve({ success: false, output: `[Runtime Launch Error]\n${runErr.message}` });
            } else {
                resolve({ success: true, output: `[Launched ${config.label} in an external window]` });
            }
        });
    });
}

ipcMain.handle('run-file', async (event, filePath, mode) => {
    const ext = path.extname(filePath).replace('.', '').toLowerCase();
    const config = RUN_CONFIG[ext];
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
    for (const [ext, cfg] of Object.entries(RUN_CONFIG)) {
        langs[ext] = cfg.label;
    }
    return langs;
});