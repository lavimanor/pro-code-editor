export const htmlRules = [
    { type: 'comment', regex: /<!--[\s\S]*?-->/ },
    { type: 'doctype', regex: /<!DOCTYPE[^>]*>/i },
    { type: 'attr-value', regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/ }, 
    { type: 'attr-name', regex: /\b[a-zA-Z0-9:-]+(?=\s*=)/ },
    { type: 'tag-name', regex: /(?<=<\/|<)[a-zA-Z0-9:-]+/ }, // Lookbehind isolates tag brackets
    { type: 'tag-bracket', regex: /<\/|<|>|\/>/ },
    { type: 'punctuation', regex: /=/ },
    { type: 'entity', regex: /&[a-zA-Z0-9#]+;/ } // Highlights elements like &nbsp; or &amp;
];