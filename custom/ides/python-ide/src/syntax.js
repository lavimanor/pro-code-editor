export function registerPythonSyntax(api) {
    try {
        api.languages.registerHighlighter('python', [
            // 1. Comments
            { type: 'comment', regex: /#.*/ },

            // 2. Multi-line & single-line strings (Supporting prefixes: f, r, b, fr, etc.)
            // Now prevents single-line strings from spilling over across newlines (\n)
            { 
                type: 'string', 
                regex: /(?:\b[fFrRbB]{1,2})?(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\n\\])*"|'(?:\\.|[^'\n\\])*')/ 
            },

            // 3. Decorators (including dotted paths, e.g. @blueprint.route)
            { type: 'builtin', regex: /@[a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*/ },

            // 4. Double-Underscore (Dunder) magic methods and variables (e.g. __init__, __name__)
            { type: 'builtin', regex: /\b__[a-zA-Z0-9_]+__\b/ },

            // 5. Lookbehind: Colors ONLY the Class Name inside definitions (e.g. class MyClass:)
            { type: 'class-name', regex: /(?<=class\s+)[a-zA-Z_]\w*/ },

            // 6. Built-in Exception Classes
            { 
                type: 'class-name', 
                regex: /\b(?:Exception|ValueError|TypeError|KeyError|IndexError|RuntimeError|AttributeError|IOError|ImportError|NameError|KeyboardInterrupt|SystemExit|GeneratorExit|StopIteration|ZeroDivisionError|FileNotFoundError)\b/ 
            },

            // 7. Standard Core Constants and Self/Cls references
            { type: 'builtin', regex: /\b(?:True|False|None|self|cls)\b/ },

            // 8. Core Keywords (including modern match/case and raise statements)
            { 
                type: 'keyword', 
                regex: /\b(?:def|class|if|else|elif|for|while|try|except|finally|import|from|as|return|pass|break|continue|lambda|in|is|not|and|or|with|assert|yield|global|nonlocal|del|raise|match|case)\b/ 
            },

            // 9. Standard Built-in Core Functions
            { 
                type: 'builtin', 
                regex: /\b(?:print|len|range|str|int|float|list|dict|set|tuple|enumerate|zip|open|sum|min|max|abs|type|id|map|filter|any|all|super|isinstance|issubclass|getattr|setattr|hasattr)\b/ 
            },

            // 10. Function Definitions and Invocations (matched by preceding an open parenthesis)
            { type: 'function', regex: /\b[a-zA-Z_]\w*(?=\s*\()/ },

            // 11. Multi-System Numeric Values (Hex: 0xFF, Binary: 0b10, Floats, Scientific: 1e-5)
            { type: 'number', regex: /\b0[xX][0-9a-fA-F]+\b|\b0[bB][01]+\b|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/ },

            // 12. Punctuation, Arithmetic, Logical, and Assignment Operators
            { type: 'punctuation', regex: /[-+*/%=<>!&|^~:]+/ },

            // 13. Block and Grouping Brackets
            { type: 'bracket', regex: /[\[\]{}()]/ }
        ]);

        console.log("Python syntax highlighting updated with single-line string protections.");
    } catch (error) {
        console.error("Could not register Python highlighter:", error);
    }
}