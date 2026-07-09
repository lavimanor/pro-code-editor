import { PROSENSE_HTML } from './prosense-html.js';
import { PROSENSE_CSS } from './prosense-css.js';
import { PROSENSE_JS } from './prosense-js.js';
import { PROSENSE_JAVA } from './prosense-java.js';
import { PROSENSE_CS } from './prosense-cs.js';
import { PROSENSE_PY } from './prosense-py.js';
import { PROSENSE_C } from './prosense-c.js';
import { PROSENSE_CPP } from './prosense-cpp.js';
import { PROSENSE_LUA } from './prosense-lua.js';

export const LANGUAGE_REGISTRY = {
    'html': { db: PROSENSE_HTML, parser: 'markup' },
    'htm': { db: PROSENSE_HTML, parser: 'markup' },
    'css': { db: PROSENSE_CSS, parser: 'style' },
    'js': { db: PROSENSE_JS, parser: 'js' },
    'mjs': { db: PROSENSE_JS, parser: 'js' },
    'cjs': { db: PROSENSE_JS, parser: 'js' },
    'java': { db: PROSENSE_JAVA, parser: 'cstyle' },
    'cs': { db: PROSENSE_CS, parser: 'cstyle' },
    'py': { db: PROSENSE_PY, parser: 'python' },
    'c': { db: PROSENSE_C, parser: 'cstyle' },
    'h': { db: PROSENSE_C, parser: 'cstyle' },
    'cpp': { db: PROSENSE_CPP, parser: 'cstyle' },
    'hpp': { db: PROSENSE_CPP, parser: 'cstyle' },
    'cc': { db: PROSENSE_CPP, parser: 'cstyle' },
    'cxx': { db: PROSENSE_CPP, parser: 'cstyle' },
    'lua': { db: PROSENSE_LUA, parser: 'lua' }
};

const CSTYLE_RULES = [
    { regex: /\b(?:class|struct|interface|enum)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g, group: 1, type: 'class' },
    { regex: /\b(?!(?:if|for|foreach|while|switch|catch|return|new|throw|delete|co_return|co_yield|goto)\b)([a-zA-Z_$][a-zA-Z0-9_$<>]*)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g, group: 2, type: 'function', insertSuffix: '()' },
    { regex: /\b(?!(?:return|import|using|package|class|struct|interface|enum|new|throw|delete|goto|public|private|protected|static|const|extern|friend|inline|virtual|explicit|typedef)\b)([a-zA-Z_$][a-zA-Z0-9_$<>]*)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:[;=,])/g, group: 2, type: 'variable' }
];

export const PARSER_RULES = {
    js: [
        { regex: /\b(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g, group: 1, type: 'variable' },
        { regex: /\bfunction\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g, group: 1, type: 'function', insertSuffix: '()' },
        { regex: /\bclass\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g, group: 1, type: 'class' }
    ],
    cstyle: CSTYLE_RULES,
    python: [
        { regex: /\bclass\s+([a-zA-Z_][a-zA-Z0-9_]*)/g, group: 1, type: 'class' },
        { regex: /\bdef\s+([a-zA-Z_][a-zA-Z0-9_]*)/g, group: 1, type: 'function', insertSuffix: '()' },
        { regex: /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?![=])/g, group: 1, type: 'variable', exclude: ['if', 'elif', 'for', 'while', 'return', 'print'] }
    ],
    lua: [
        { regex: /\bfunction\s+([a-zA-Z_][a-zA-Z0-9_]*)/g, group: 1, type: 'function', insertSuffix: '()' },
        { regex: /\b(?:local\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?![=])/g, group: 1, type: 'variable', exclude: ['if', 'for', 'while', 'return', 'print', 'local', 'function', 'end'] }
    ]
};