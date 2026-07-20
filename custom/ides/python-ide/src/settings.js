export function registerPythonSettings(api) {
    try {
        // 1. Python Environment selection setting
        api.views.registerSetting('python-pip-env', {
            label: 'Pip Install Target Environment',
            type: 'select',
            options: ['Global System', 'Virtual Environment (venv)', 'Conda Environment'],
            defaultValue: 'Global System',
            pluginId: 'pythonix-ide', // Synchronized to match package.json
            description: 'Sets the targeted context used for downloading custom python libraries.',
            onChange: (value) => {
                console.log(`[Pythonix IDE] Environment setting updated: ${value}`);
                // Notify live widgets (interpreter status bar, pip manager) of the switch
                api.events.emit('pythonix-env-changed', value);
            }
        });

        // 2. Format on save toggler
        api.views.registerSetting('python-format-on-save', {
            label: 'Auto Format Python Files on Save',
            type: 'checkbox',
            defaultValue: false,
            pluginId: 'pythonix-ide', // Synchronized to match package.json
            description: 'Automatically formats code on each file save.',
            onChange: (isChecked) => {
                console.log(`[Pythonix IDE] Format-on-save setting updated: ${isChecked}`);
            }
        });

        // 3. Strict diagnostics level setting
        api.views.registerSetting('python-type-checking', {
            label: 'Pyright Diagnostic Mode Strictness',
            type: 'select',
            options: ['off', 'basic', 'strict'],
            defaultValue: 'basic',
            pluginId: 'pythonix-ide', // Synchronized to match package.json
            description: 'Configures type checking analysis rules for the Pyright LSP connection.',
            onChange: (level) => {
                console.log(`[Pythonix IDE] Pyright strictness setting updated: ${level}`);
            }
        });

        console.log("Pythonix IDE settings options registered successfully.");
    } catch (error) {
        console.error("Could not register Pythonix settings:", error);
    }
}