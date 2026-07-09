import { PROSENSE_JS } from './prosense-js.js';
import { PROSENSE_PY } from './prosense-py.js';
import { PROSENSE_HTML } from './prosense-html.js';
import { PROSENSE_CSS } from './prosense-css.js';
import { PROSENSE_JAVA } from './prosense-java.js';
import { PROSENSE_CS } from './prosense-cs.js';
import { PROSENSE_CPP } from './prosense-cpp.js';
import { PROSENSE_C } from './prosense-c.js';
import { PROSENSE_LUA } from './prosense-lua.js';

/**
 * Registers standard default language profiles and syntax rules with the system.
 */
export function registerCoreLanguages(api) {
    // 1. JavaScript
    api.languages.register('javascript', {
        name: 'JavaScript',
        extensions: ['js', 'mjs', 'cjs'],
        db: PROSENSE_JS,
        parser: 'js',
        parserRules: [
            { regex: /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g, group: 1, type: 'variable' },
            { regex: /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g, group: 1, type: 'function', insertSuffix: '()' },
            { regex: /class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g, group: 1, type: 'class' }
        ]
    });

    // 2. Python
    api.languages.register('python', {
        name: 'Python',
        extensions: ['py'],
        db: PROSENSE_PY,
        parser: 'py',
        parserRules: [
            { regex: /def\s+([a-zA-Z_][a-zA-Z0-9_]*)/g, group: 1, type: 'function', insertSuffix: '()' },
            { regex: /class\s+([a-zA-Z_][a-zA-Z0-9_]*)/g, group: 1, type: 'class' }
        ]
    });

    // 3. HTML
    api.languages.register('html', {
        name: 'HTML',
        extensions: ['html', 'htm'],
        db: PROSENSE_HTML,
        parser: 'html',
        parserRules: []
    });

    // 4. CSS
    api.languages.register('css', {
        name: 'CSS',
        extensions: ['css'],
        db: PROSENSE_CSS,
        parser: 'css',
        parserRules: []
    });

    // 5. Java
    api.languages.register('java', {
        name: 'Java',
        extensions: ['java'],
        db: PROSENSE_JAVA,
        parser: 'java',
        parserRules: [
            { regex: /(?:public\s+)?class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g, group: 1, type: 'class' },
            { regex: /(?:public|private|protected|static)\s+[\w<>]+\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g, group: 1, type: 'function', insertSuffix: '()' }
        ]
    });

    // 6. C#
    api.languages.register('csharp', {
        name: 'C#',
        extensions: ['cs'],
        db: PROSENSE_CS,
        parser: 'cs',
        parserRules: [
            { regex: /(?:public\s+)?class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g, group: 1, type: 'class' },
            { regex: /(?:public|private|protected|static|internal)\s+[\w<>]+\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g, group: 1, type: 'function', insertSuffix: '()' }
        ]
    });

    // 7. C++
    api.languages.register('cpp', {
        name: 'C++',
        extensions: ['cpp', 'hpp', 'cc', 'cxx'],
        db: PROSENSE_CPP,
        parser: 'cpp',
        parserRules: [
            { regex: /\b[a-zA-Z_][a-zA-Z0-9_]*\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^;{]*\)\s*\{/g, group: 1, type: 'function', insertSuffix: '()' }
        ]
    });

    // 8. C
    api.languages.register('c', {
        name: 'C',
        extensions: ['c', 'h'],
        db: PROSENSE_C,
        parser: 'c',
        parserRules: [
            { regex: /\b[a-zA-Z_][a-zA-Z0-9_]*\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^;{]*\)\s*\{/g, group: 1, type: 'function', insertSuffix: '()' }
        ]
    });

    // 9. Lua
    api.languages.register('lua', {
        name: 'Lua',
        extensions: ['lua'],
        db: PROSENSE_LUA,
        parser: 'lua',
        parserRules: [
            { regex: /local\s+function\s+([a-zA-Z_][a-zA-Z0-9_]*)/g, group: 1, type: 'function', insertSuffix: '()' },
            { regex: /function\s+([a-zA-Z_][a-zA-Z0-9_]*)/g, group: 1, type: 'function', insertSuffix: '()' },
            { regex: /local\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g, group: 1, type: 'variable' }
        ]
    });
}