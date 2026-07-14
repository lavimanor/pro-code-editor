export function registerPythonLsp(api) {
    // Detect the operating system to resolve shell wrapper differences
    const isWin = typeof window !== 'undefined' && window.process && window.process.platform === 'win32';
    
    // Windows installs global node modules with a .cmd extension
    const pyrightCmd = isWin ? 'pyright-langserver.cmd' : 'pyright-langserver';

    try {
        // Wire the 'pyright-langserver' executable to the '.py' file extension
        api.languages.registerLspClient('py', pyrightCmd, ['--stdio'], {
            python: {
                analysis: {
                    autoSearchPaths: true,
                    useLibraryCodeForTypes: true,
                    diagnosticMode: "openFilesOnly", // "workspace" or "openFilesOnly"
                    typeCheckingMode: "basic"       // "off", "basic", or "strict"
                }
            }
        });
        
        console.log(`Python LSP client registered using command: ${pyrightCmd}`);
    } catch (error) {
        console.error("Could not register Python LSP client. Error context:", error);
    }
}