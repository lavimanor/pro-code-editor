export function registerPythonRunner(api) {
    const isWin = typeof window !== 'undefined' && window.process && window.process.platform === 'win32';
    const pythonCmd = isWin ? 'python' : 'python3';

    try {
        api.terminal.registerRunner('python', {
            label: 'Python Interpreter',
            run: [
                { 
                    cmd: pythonCmd, 
                    // Add '-X', 'utf8' before passing the file path to force UTF-8 mode
                    args: ['-X', 'utf8', '{file}'] 
                }
            ]
        });

        console.log(`Python execution runner registered with UTF-8 support: ${pythonCmd}`);
    } catch (error) {
        console.error("Could not register Python runner execution target:", error);
    }
}