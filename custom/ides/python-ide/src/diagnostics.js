export function registerPythonDiagnostics(api) {
    try {
        // 1. Register custom CSS class bindings for editor syntax errors/warnings
        api.views.registerDiagnosticStyle('pythonix-waves', {
            name: 'Pythonix Soft Wave underlines',
            errorClass: 'diag-error-pythonix',
            warningClass: 'diag-warning-pythonix'
        });

        // 2. Dynamically inject the CSS styling definitions directly into the application DOM
        if (typeof document !== 'undefined') {
            const styleId = 'pythonix-diagnostic-stylesheet';
            
            if (!document.getElementById(styleId)) {
                const styleSheet = document.createElement('style');
                styleSheet.id = styleId;
                styleSheet.innerText = `
                    .diag-error-pythonix {
                        text-decoration: underline wavy #e06c75 1.5px !important;
                        text-underline-offset: 3px;
                    }
                    .diag-warning-pythonix {
                        text-decoration: underline wavy #e5c07b 1.5px !important;
                        text-underline-offset: 3px;
                    }
                `;
                document.head.appendChild(styleSheet);
            }
        }
        
        console.log("Pythonix diagnostic style decorators injected.");
    } catch (error) {
        console.error("Could not register Pythonix diagnostic styles:", error);
    }
}