/**
 * Core Lightweight Languages Registry:
 * Houses only structural, easily tokenized representations (JSON and XML).
 * All advanced programming languages are designed to load dynamically via Extensions.
 */

export function registerCoreLanguages(api) {
    // ==========================================
    // 1. JSON
    // ==========================================
    api.languages.register('json', {
        name: 'JSON',
        extensions: ['json'],
        db: [
            { label: 'true', insertText: 'true', type: 'keyword' },
            { label: 'false', insertText: 'false', type: 'keyword' },
            { label: 'null', insertText: 'null', type: 'keyword' }
        ],
        parser: 'json',
        parserRules: [
            { regex: /"(?:\\.|[^"\\])*"(?=\s*:)/g, group: 0, type: 'variable' }
        ]
    });

    api.languages.registerHighlighter('json', [
        { type: 'comment', regex: /\/\/.*|\/\*[\s\S]*?\*\// },
        { type: 'keyword', regex: /"(?:\\.|[^"\\])*"(?=\s*:)/ }, // JSON key
        { type: 'string', regex: /"(?:\\.|[^"\\])*"/ },          // JSON string value
        { type: 'number', regex: /\b\d+(?:\.\d+)?\b/ },
        { type: 'builtin', regex: /\b(?:true|false|null)\b/ },
        { type: 'punctuation', regex: /[{}[\]:,]/ }
    ]);

    // ==========================================
    // 2. XML
    // ==========================================
    api.languages.register('xml', {
        name: 'XML',
        extensions: ['xml', 'svg', 'xhtml'],
        db: [
            { label: 'version', insertText: 'version="1.0"', type: 'attribute' },
            { label: 'encoding', insertText: 'encoding="UTF-8"', type: 'attribute' }
        ],
        parser: 'xml',
        parserRules: []
    });

    api.languages.registerHighlighter('xml', [
        { type: 'comment', regex: /<!--[\s\S]*?-->/ },
        { type: 'doctype', regex: /<!DOCTYPE[^>]*>/i },
        { type: 'attr-value', regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/ }, // Removed '=' prefix
        { type: 'attr-name', regex: /\b[a-zA-Z0-9:-]+(?=\s*=)/ },
        { type: 'tag-name', regex: /(?<=<\/|<)[a-zA-Z0-9:-]+/ }, 
        { type: 'tag-bracket', regex: /<\/|<|>|\/>/ },
        { type: 'punctuation', regex: /=/ } // Styled separately as clean punctuation
    ]);
}