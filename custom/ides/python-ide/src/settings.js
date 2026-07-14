export function registerPythonSettings(api) {
    try {
        // 1. Python Environment selection setting
        api.views.registerSetting('python-pip-env', {
            label: 'Pip Install Target Environment',
            type: 'select',
            options: ['Global System', 'Virtual Environment (venv)', 'Conda Environment'],
            defaultValue: 'Global System',
            onChange: (value) => {
                console.log(`[Python IDE] Environment setting updated: ${value}`);
            }
        });

        // 2. Format on save toggler
        api.views.registerSetting('python-format-on-save', {
            label: 'Auto Format Python Files on Save',
            type: 'checkbox',
            defaultValue: false,
            onChange: (isChecked) => {
                console.log(`[Python IDE] Format-on-save setting updated: ${isChecked}`);
            }
        });

        // 3. Strict diagnostics level setting
        api.views.registerSetting('python-type-checking', {
            label: 'Pyright Diagnostic Mode Strictness',
            type: 'select',
            options: ['off', 'basic', 'strict'],
            defaultValue: 'basic',
            onChange: (level) => {
                console.log(`[Python IDE] Pyright strictness setting updated: ${level}`);
            }
        });

        console.log("Python IDE custom setting options registered.");
    } catch (error) {
        console.error("Could not register Python preference settings:", error);
    }
}