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
        // frame: false,
        backgroundColor: '#1e1e1e',
        icon: path.join(__dirname, 'icon.png'), // Binds the taskbar and system window icon
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false
        }
    });

    // Menu.setApplicationMenu(null);
    win.loadFile('index.html');
}

// Window control event routing
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

// Directory picker handling...
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

            // Safe URI decoding to handle spaces (%20) and special characters
            let decodedUrl = reqUrl;
            try {
                decodedUrl = decodeURIComponent(reqUrl);
            } catch (e) {
                console.error('Failed to decode URI:', e);
            }

            const filePath = path.join(folderPath, decodedUrl);
            
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

        webServer.listen(5500, () => {
            // Open the browser directly to your active web file, avoiding blank 404s
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
//  Code Execution Engine (config-driven, see run-config.js)
// =====================================================================

// Currently executing child process for the integrated terminal (single active run).
let activeChild = null;

/**
 * Locates a usable C# compiler (csc.exe). Falls back to the PATH binary.
 */
function resolveCsc() {
    const winDir = process.env.windir || 'C:\\Windows';
    const candidates = [
        path.join(winDir, 'Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe'),
        path.join(winDir, 'Microsoft.NET\\Framework\\v4.0.30319\\csc.exe')
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) return p;
    }
    return 'csc'; // Rely on PATH as a last resort
}

/**
 * Builds the placeholder substitution context for a source file.
 */
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

/** Resolves a candidate { cmd, args } with placeholders + special tokens substituted. */
function resolveCandidate(candidate, ctx) {
    let cmd = candidate.cmd;
    if (cmd === '__csc__') {
        cmd = resolveCsc();
    } else {
        cmd = substitute(cmd, ctx);
    }
    return {
        cmd,
        args: (candidate.args || []).map(a => substitute(a, ctx))
    };
}

/**
 * Spawns the first candidate in the list that successfully launches (PATH fallback),
 * streaming stdout/stderr to `send`. Resolves with the live child process, or rejects
 * if none of the candidates could be started.
 */
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
                    attempt(); // Binary missing / ENOENT -> try the next candidate
                } else {
                    send('stderr', `\n[Process error] ${err.message}\n`);
                }
            });
        };
        attempt();
    });
}

/**
 * Runs a file inside the integrated terminal: compile steps (each must exit 0) then run,
 * streaming all output back to the renderer via 'run-output' / 'run-exit' events.
 */
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

    // Compile phase
    if (config.compile) {
        for (const stepCandidates of config.compile) {
            send('system', `[Compiling ${config.label}...]\n`);
            let child;
            try {
                child = await launchStep(stepCandidates, ctx, send);
            } catch (e) {
                return { success: false, output: `[Compiler not found] Could not launch the ${config.label} compiler. Verify the toolchain is installed and on your PATH.` };
            }
            const code = await new Promise(res => child.once('close', res));
            if (code !== 0) {
                send('system', `\n[Compilation failed — exit code ${code}]\n`);
                return { success: false, output: `[Compilation Error] ${config.label} compilation failed (exit code ${code}).` };
            }
        }
    }

    // Run phase
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

/** Windows-safe quoting of a single token. */
function quoteWin(s) {
    return `"${String(s).replace(/"/g, '')}"`;
}

/**
 * Runs a file in an external cmd.exe window. Compiles first (blocking) if needed.
 * Uses `cmd /s` so only the outermost quotes are stripped — this makes paths with
 * spaces safe (fixes the old broken nested-quote fallback).
 */
async function runExternal(config, ctx) {
    // Compile phase (blocking) — try candidates until one launches.
    if (config.compile) {
        for (const stepCandidates of config.compile) {
            const result = await new Promise((resolve) => {
                let idx = 0;
                const attempt = () => {
                    if (idx >= stepCandidates.length) {
                        resolve({ ok: false, err: 'compiler not found' });
                        return;
                    }
                    const { cmd, args } = resolveCandidate(stepCandidates[idx++], ctx);
                    execFile(cmd, args, { cwd: ctx.dir }, (err, stdout, stderr) => {
                        if (err && err.code === 'ENOENT') { attempt(); return; }
                        if (err) { resolve({ ok: false, err: `${stdout}\n${stderr}` }); return; }
                        resolve({ ok: true });
                    });
                };
                attempt();
            });
            if (!result.ok) {
                return { success: false, output: `[Compilation Error]\n${result.err}` };
            }
        }
    }

    const runCand = resolveCandidate(config.run[0], ctx);
    const inner = [quoteWin(runCand.cmd), ...runCand.args.map(quoteWin)].join(' ');

    // Detect input-pausing statements so the window pauses before closing.
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

// Feed a line of text to the running program's stdin (integrated terminal input).
ipcMain.handle('run-input', (event, text) => {
    if (activeChild && activeChild.stdin && activeChild.stdin.writable) {
        activeChild.stdin.write(text + '\n');
        return true;
    }
    return false;
});

// Terminate the active integrated run.
ipcMain.handle('run-kill', () => {
    if (activeChild) {
        try { activeChild.kill(); } catch (e) { /* ignore */ }
        activeChild = null;
        return true;
    }
    return false;
});

// Report which extensions are runnable (ext -> label) — single source of truth for the UI.
ipcMain.handle('get-run-langs', () => {
    const langs = {};
    for (const [ext, cfg] of Object.entries(RUN_CONFIG)) {
        langs[ext] = cfg.label;
    }
    return langs;
});

ipcMain.handle('check-python-syntax', (event, code) => {
    return new Promise((resolve) => {
        const pythonCmd = 'python';
        
        // Inline lightweight AST compiler that accepts standard inputs and dumps JSON outputs
        const pyScript = `
import ast, sys, json
try:
    ast.parse(sys.stdin.read())
    print(json.dumps({"success": True}))
except SyntaxError as e:
    print(json.dumps({
        "success": False,
        "line": e.lineno,
        "offset": e.offset,
        "msg": e.msg
    }))
except Exception as e:
    print(json.dumps({"success": True}))
`;

        const { spawn } = require('child_process');
        const child = spawn(pythonCmd, ['-c', pyScript]);
        
        let outputData = '';
        
        child.stdin.write(code);
        child.stdin.end();
        
        child.stdout.on('data', (data) => {
            outputData += data.toString();
        });
        
        child.on('close', (exitCode) => {
            try {
                const parsed = JSON.parse(outputData.trim());
                resolve(parsed);
            } catch (err) {
                // Fallback attempt using standard global 'py' command on Windows
                const fallbackChild = spawn('py', ['-c', pyScript]);
                let fbOutput = '';
                
                fallbackChild.stdin.write(code);
                fallbackChild.stdin.end();
                
                fallbackChild.stdout.on('data', (data) => {
                    fbOutput += data.toString();
                });
                
                fallbackChild.on('close', () => {
                    try {
                        const parsedFb = JSON.parse(fbOutput.trim());
                        resolve(parsedFb);
                    } catch (fbErr) {
                        resolve({ success: true }); // Fallback silent on failure
                    }
                });
            }
        });
    });
});