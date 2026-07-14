export const jsRules = [
    { type: 'comment', regex: /\/\*[\s\S]*?\*\/|\/\/.*/ },
    { type: 'string', regex: /`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/ },
    
    // Accessed properties/methods (using lookbehind to style item.method uniquely)
    { type: 'function', regex: /(?<=\.)[a-zA-Z_$][a-zA-Z0-9_$]*/ },

    // Native Regex Literals
    { type: 'string', regex: /\/(?![/*])(?:\\\/|[^\/])+\/[gimsuy]*\b/ },

    // ALL_CAPS globals / constants (matched before class-name so they stay distinct)
    { type: 'builtin', regex: /\b[A-Z_][A-Z0-9_]{2,}\b/ },
    // Capitalized words match as Class Names / Constructors (e.g. XMLHttpRequest)
    { type: 'class-name', regex: /\b[A-Z][a-zA-Z0-9_$]*\b/ },

    { type: 'keyword', regex: /\b(?:const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|class|extends|constructor|static|get|set|export|import|from|as|default|yield|package|private|protected|public|arguments|eval|try|catch|finally|throw|async|await|new|delete|typeof|instanceof|void|in|of|this|super|debugger|with|true|false|null|undefined|NaN|Infinity)\b/ },
    { type: 'builtin', regex: /\b(?:console|document|window|globalThis|Math|Array|Object|String|Number|BigInt|Boolean|Symbol|Set|Map|WeakSet|WeakMap|Promise|Proxy|Reflect|Date|RegExp|Error|fetch|localStorage|sessionStorage|JSON)\b/ },
    { type: 'number', regex: /\b(?:0[xX][0-9a-fA-F]+|0[bB][01]+|0[oO][0-7]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)n?\b/ },
    { type: 'function', regex: /\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\()/ },
    { type: 'bracket', regex: /[{}()[\]]/ }, // Braces and brackets (Added Fix)
    { type: 'punctuation', regex: /\.{3}|\?\.|\?\?|=>|&&|\|\||[.,;:?]|\*\*|[-=+\/*%!<>^&|~]/ }
];