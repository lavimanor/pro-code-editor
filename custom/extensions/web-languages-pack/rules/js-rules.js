export const jsRules = [
    { type: 'comment', regex: /\/\*[\s\S]*?\*\/|\/\/.*/ },
    { type: 'string', regex: /`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/ },
    
    // Accessed properties/methods (using lookbehind to style item.method uniquely)
    { type: 'function', regex: /(?<=\.)[a-zA-Z_$][a-zA-Z0-9_$]*/ },
    // Capitalized words match as Class Names / Constructors (e.g. XMLHttpRequest)
    { type: 'class-name', regex: /\b[A-Z][a-zA-Z0-9_$]*\b/ },
    
    // Native Regex Literals
    { type: 'string', regex: /\/(?![/*])(?:\\\/|[^\/])+\/[gimy]*\b/ },
    
    // Capitalized globals / system constants
    { type: 'builtin', regex: /\b[A-Z_][A-Z0-9_]{2,}\b/ },
    
    { type: 'keyword', regex: /\b(?:const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|class|extends|constructor|static|get|set|export|import|from|default|yield|package|private|protected|public|arguments|eval|try|catch|finally|throw|async|await|true|false|null|undefined|NaN|Infinity)\b/ },
    { type: 'builtin', regex: /\b(?:console|document|window|Math|Array|Object|String|Number|Boolean|Set|Map|Promise|fetch|localStorage|sessionStorage|JSON)\b/ },
    { type: 'number', regex: /\b\d+(?:\.\d+)?\b/ },
    { type: 'function', regex: /\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\()/ },
    { type: 'punctuation', regex: /[{}()[\].,;:]/ },
    { type: 'keyword', regex: /=>|&&|\|\||[=+\-*/!<>%?&|^~]/ } // Logical and arithmetic operators
];