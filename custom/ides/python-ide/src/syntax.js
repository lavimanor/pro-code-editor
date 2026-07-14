export function registerPythonSyntax(api) {
    api.languages.registerHighlighter('python', [
        // Comments
        { type: 'comment', regex: /#.*/ },

        // Multi-line and single-line strings
        { type: 'string', regex: /"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/ },

        // Decorators
        { type: 'builtin', regex: /@[a-zA-Z_]\w*/ },

        // Core keywords
        { type: 'keyword', regex: /\b(?:def|class|if|else|elif|for|while|try|except|finally|import|from|as|return|pass|break|continue|lambda|in|is|not|and|or|with|assert|yield|global|nonlocal|del)\b/ },

        // Build-in constants
        { type: 'builtin', regex: /\b(?:True|False|None|self|cls)\b/ },

        // Common built-in helper functions
        { type: 'builtin', regex: /\b(?:print|len|range|str|int|float|list|dict|set|tuple|enumerate|zip|open|sum|min|max|abs|type|id|map|filter|any|all)\b/ },

        // Function invocations
        { type: 'function', regex: /\b[a-zA-Z_]\w*(?=\s*\()/ },

        // Numbers (integers, decimals, scientific notation)
        { type: 'number', regex: /\b\d+(?:\.\d+)?\b/ }
    ]);
}