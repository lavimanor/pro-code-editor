/**
 * Core Lightweight Languages Registry:
 * Houses only structural, easily tokenized representations (JSON, XML, and Markdown).
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
        { type: 'attr-value', regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/ }, 
        { type: 'attr-name', regex: /\b[a-zA-Z0-9:-]+(?=\s*=)/ },
        { type: 'tag-name', regex: /(?<=<\/|<)[a-zA-Z0-9:-]+/ }, 
        { type: 'tag-bracket', regex: /<\/|<|>|\/>/ },
        { type: 'punctuation', regex: /=/ } 
    ]);

    // ==========================================
    // 3. MARKDOWN
    // ==========================================
    api.languages.register('markdown', {
        name: 'Markdown',
        extensions: ['md', 'markdown', 'mdown', 'mkdn', 'mkd'],
        db: [
            { label: 'h1', insertText: '# ${1:Header}', type: 'snippet' },
            { label: 'h2', insertText: '## ${1:Header}', type: 'snippet' },
            { label: 'h3', insertText: '### ${1:Header}', type: 'snippet' },
            { label: 'bold', insertText: '**${1:text}**', type: 'snippet' },
            { label: 'italic', insertText: '*${1:text}*', type: 'snippet' },
            { label: 'link', insertText: '[${1:text}](${2:url})', type: 'snippet' },
            { label: 'image', insertText: '![${1:alt}](${2:url})', type: 'snippet' },
            { label: 'codeblock', insertText: '```${1:javascript}\n${0}\n```', type: 'snippet' },
            { label: 'table', insertText: '| ${1:Header} | ${2:Header} |\n| --- | --- |\n| ${3:Value} | ${4:Value} |', type: 'snippet' }
        ],
        parser: 'markdown',
        parserRules: []
    });

    api.languages.registerHighlighter('markdown', [
        // 1. Line-start block rules (Must match first to consume boundaries)
        { type: 'md-codeblock-fence', regex: /(?<=^|[\r\n])\s*(?:`{3,}|~{3,})[^\r\n]*/ },
        { type: 'md-header', regex: /(?<=^|[\r\n])\s*#{1,6}\s+[^\r\n]+/ },
        { type: 'md-blockquote', regex: /(?<=^|[\r\n])\s*>\s+[^\r\n]+/ },
        { type: 'md-list', regex: /(?<=^|[\r\n])\s*(?:[-*+]\s+|\d+\.\s+)/ },

        // 2. Inline markup rules (Matched on remaining inner text)
        { type: 'md-inline-code', regex: /`[^`\r\n]+`/ },
        { type: 'md-link', regex: /!?\[[^\]\r\n]*\]\([^)\r\n]*\)/ },
        { type: 'md-bold', regex: /\*\*[^*\r\n]+?\*\*|__[^_\r\n]+?__/ },
        { type: 'md-italic', regex: /\*[^*\r\n]+?\*|_[^_\r\n]+?_/ }
    ]);
}