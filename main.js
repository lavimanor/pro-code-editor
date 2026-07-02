const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { execFile, exec } = require('child_process');

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

ipcMain.handle('compile-run-csharp', (event, filePath) => {
    return new Promise((resolve) => {
        const dir = path.dirname(filePath);
        const ext = path.extname(filePath);
        const baseName = path.basename(filePath, ext);
        const exePath = path.join(dir, `${baseName}.exe`);

        // Standard csc paths on Windows 10 architectures
        const winDir = process.env.windir || 'C:\\Windows';
        const cscPaths = [
            'csc', // Try global PATH first
            path.join(winDir, 'Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe'),
            path.join(winDir, 'Microsoft.NET\\Framework\\v4.0.30319\\csc.exe')
        ];

        // Locate first available compiler binary
        let cscCommand = 'csc';
        for (const p of cscPaths) {
            if (p === 'csc' || fs.existsSync(p)) {
                cscCommand = p;
                if (p !== 'csc') break;
            }
        }

        // Dynamically inspect the code to check for ReadKey or ReadLine pausing statements
        const code = fs.readFileSync(filePath, 'utf8');
        const hasReadKey = /\bReadKey\b|\bReadLine\b/i.test(code);

        // Compile using execFile to handle spaces in folder paths safely
        execFile(cscCommand, [`/out:${exePath}`, filePath], (compileErr, stdout, stderr) => {
            if (compileErr) {
                resolve({
                    success: false,
                    output: `[Compilation Error]\n${stdout}\n${stderr}`
                });
                return;
            }

            let runCmd;
            if (hasReadKey) {
                // Runs exe, prints spacing/custom instructions AFTER program exits, then pauses before closing
                runCmd = `start cmd.exe /C ""${exePath}" & echo. & echo [Press any key to close the window...] & pause > nul"`;
            } else {
                // Use /K (Keep open) so they can read standard console outputs
                runCmd = `start cmd.exe /K "${exePath}"`;
            }
            
            exec(runCmd, (runErr) => {
                if (runErr) {
                    resolve({
                        success: false,
                        output: `[Runtime Launch Error]\nCould not launch the compiled executable: ${runErr.message}`
                    });
                    return;
                }

                resolve({
                    success: true,
                    output: `[Successfully Compiled & Launched]\nExecuting C# binary in a separate system window (${hasReadKey ? 'ReadKey/ReadLine detected: window will close automatically on keypress' : 'No ReadKey/ReadLine detected: terminal window kept open to view outputs'})...`
                });
            });
        });
    });
});

ipcMain.handle('run-python', (event, filePath) => {
    return new Promise((resolve) => {
        const code = fs.readFileSync(filePath, 'utf8');
        // Check for any console input pausing statements in Python
        const hasInput = /\binput\s*\(|\braw_input\s*\(/i.test(code);

        const pythonCommand = 'python';
        let runCmd;

        if (hasInput) {
            // Runs python, outputs spacing/instructions after exit, then pauses before closing
            runCmd = `start cmd.exe /C ""${pythonCommand}" "${filePath}" & echo. & echo [Press any key to close the window...] & pause > nul"`;
        } else {
            // Keep open so they can read console logs
            runCmd = `start cmd.exe /K ""${pythonCommand}" "${filePath}""`;
        }

        exec(runCmd, (runErr) => {
            if (runErr) {
                // Fallback attempt using standard Windows global 'py' launcher
                const fallbackCmd = `start cmd.exe ${hasInput ? '/C' : '/K'} "py "${filePath}""`;
                exec(fallbackCmd, (fallbackErr) => {
                    if (fallbackErr) {
                        resolve({
                            success: false,
                            output: `[Runtime Error]\nCould not launch Python. Please verify Python is installed and added to your system PATH.`
                        });
                    } else {
                        resolve({
                            success: true,
                            output: `[Launched Python Successfully (via py fallback)]\nExecuting script in a separate system window...`
                        });
                    }
                });
                return;
            }

            resolve({
                success: true,
                output: `[Launched Python Successfully]\nExecuting script in a separate system window (${hasInput ? 'input() detected: window will close automatically on keypress' : 'No input() detected: terminal window kept open to view outputs'})...`
            });
        });
    });
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