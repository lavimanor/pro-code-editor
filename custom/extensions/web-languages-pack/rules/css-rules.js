export const cssRules = [
    { type: 'comment', regex: /\/\*[\s\S]*?\*\// },
    { type: 'builtin', regex: /@[a-zA-Z0-9_-]+/ }, // At-rules like @media
    { type: 'string', regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/ },
    
    // Hex, RGB, and HSL colors
    { type: 'number', regex: /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|\b(?:rgb|rgba|hsl|hsla)\([^)]*\)/ },
    // Standard sizes, layout measurements, and timings
    { type: 'number', regex: /\b\d+(?:px|em|rem|%|vh|vw|ms|s|deg|fr|ch)?\b/ },
    
    // Tag Selectors, Classes (.element) and IDs (#header)
    { type: 'tag-name', regex: /\b(?:html|body|div|span|p|a|button|h1|h2|h3|h4|h5|h6|ul|ol|li|section|header|footer|nav|aside|main|img|input|form|label|table|tr|th|td)\b|\.[a-zA-Z0-9_-]+|#[a-zA-Z0-9_-]+/ },
    
    // Pseudo-classes and pseudo-elements (like :hover, ::before)
    { type: 'builtin', regex: /::?[a-zA-Z0-9_-]+/ },
    
    // Custom CSS Variables (--main-color) and usage functions var(...)
    { type: 'variable', regex: /--[a-zA-Z0-9_-]+/ },
    { type: 'builtin', regex: /\bvar\([^)]*\)/ },
    
    { type: 'keyword', regex: /[{};:]/ },
    { type: 'attr-name', regex: /\b[a-zA-Z-]+(?=\s*:)/ }, // Selects property keys
    { type: 'important', regex: /!important\b/i }
];