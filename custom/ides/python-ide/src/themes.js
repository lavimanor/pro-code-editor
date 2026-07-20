export function registerPythonixThemes(api) {
    try {
        // 1. Register "Intellect Dark" (Modern Darcula Variation)
        api.themes.register('intellect-dark', {
            name: 'Intellect Dark',
            colors: {
                '--bg-darker': '#131316',
                '--bg-dark': '#1e1e22',
                '--bg-sidebar': '#17171a',
                '--bg-button': '#2c2c31',
                '--bg-tab-inactive': '#151518',
                '--accent-color': '#7c4dff', // Deep modern indigo accent
                '--accent-hover': '#9e79ff',
                '--text-main': '#cfd2d6',
                '--text-muted': '#787e87',
                '--border-color': '#2a2a2e',
                '--scrollbar-thumb': '#3a3a3e',
                '--scrollbar-thumb-hover': '#4e4e54',
                
                // Classic IntelliJ Darcula Code Syntax Colors
                '--syntax-comment': '#787e87',
                '--syntax-doctype': '#7c4dff',
                '--syntax-tag-name': '#e2c08d',
                '--syntax-attr-name': '#bababa',
                '--syntax-attr-value': '#6a8759',
                '--syntax-tag-bracket': '#a9b7c6',
                '--syntax-keyword': '#cc7832',     // IntelliJ Orange-Brown Keyword
                '--syntax-string': '#6a8759',      // IntelliJ Sage Green String
                '--syntax-function': '#ffc66d',    // IntelliJ Soft Gold Function
                '--syntax-builtin': '#8888c6',     // Orchid Builtin
                '--syntax-number': '#6897bb',      // Soft Blue Number
                '--syntax-punctuation': '#a9b7c6',
                '--syntax-bracket': '#fbc02d'
            }
        });

        // 2. Register "Intellect Light" (Soft Paper Variation)
        api.themes.register('intellect-light', {
            name: 'Intellect Light',
            colors: {
                '--bg-darker': '#eaecef',
                '--bg-dark': '#fcfcfd',          // Comforting off-white
                '--bg-sidebar': '#f4f5f7',
                '--bg-button': '#e1e4e8',
                '--bg-tab-inactive': '#f0f1f4',
                '--accent-color': '#2b579a',       // Soft Navy-Blue accent
                '--accent-hover': '#3d71bc',
                '--text-main': '#24292e',
                '--text-muted': '#6a737d',
                '--border-color': '#d1d5da',
                '--scrollbar-thumb': '#c6cbd1',
                '--scrollbar-thumb-hover': '#959da5',
                
                // Classic IntelliJ Light Code Syntax Colors
                '--syntax-comment': '#808080',
                '--syntax-doctype': '#0033b3',
                '--syntax-tag-name': '#000080',
                '--syntax-attr-name': '#0000ff',
                '--syntax-attr-value': '#008000',
                '--syntax-tag-bracket': '#808080',
                '--syntax-keyword': '#0033b3',     // Bold Blue Keyword
                '--syntax-string': '#067d17',      // Deep Emerald Green String
                '--syntax-function': '#7a7a43',    // Soft Olive Function
                '--syntax-builtin': '#0033b3',
                '--syntax-number': '#1750eb',      // Deep Royal Blue Number
                '--syntax-punctuation': '#080808',
                '--syntax-bracket': '#000000'
            }
        });

        console.log("Pythonix themes registered successfully.");
    } catch (error) {
        console.error("Could not register Pythonix themes:", error);
    }
}