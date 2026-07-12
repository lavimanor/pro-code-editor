import { htmlRules } from './rules/html-rules.js';
import { cssRules } from './rules/css-rules.js';
import { jsRules } from './rules/js-rules.js';

export function activate(api) {
    console.log("[Web Pack] Registering HTML, CSS, and JS configurations dynamically...");

    // ==========================================
    // 1. EXTENDED HTML AUTOCOMPLETE & SNIPPETS
    // ==========================================
    api.languages.register('html', {
        name: 'HTML',
        extensions: ['html', 'htm'],
        db: [
            // Core Skeletons & Embeds
            { label: 'html:5', insertText: '!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <title>Document</title>\n</head>\n<body>\n    \n</body>\n</html>', type: 'snippet' },
            { label: 'style', insertText: 'style>\n    \n</style>', type: 'tag' },
            { label: 'script', insertText: 'script>\n    \n</script>', type: 'tag' },
            { label: 'script:src', insertText: 'script src=""></script>', type: 'snippet' },
            { label: 'link:css', insertText: 'link rel="stylesheet" href="">', type: 'snippet' },
            
            // Standard Emmet Extensions
            { label: 'div', insertText: 'div>\n    \n</div>', type: 'tag' },
            { label: 'span', insertText: 'span></span>', type: 'tag' },
            { label: 'p', insertText: 'p></p>', type: 'tag' },
            { label: 'a', insertText: 'a href=""></a>', type: 'tag' },
            { label: 'button', insertText: 'button></button>', type: 'tag' },
            { label: 'img', insertText: 'img src="" alt="" />', type: 'tag' },
            { label: 'iframe', insertText: 'iframe src="" frameborder="0"></iframe>', type: 'tag' },
            
            // Structured Inputs & Forms
            { label: 'form+', insertText: 'form action="" method="POST">\n    \n</form>', type: 'snippet' },
            { label: 'input:text', insertText: 'input type="text" name="" id="" />', type: 'snippet' },
            { label: 'input:checkbox', insertText: 'input type="checkbox" name="" id="" />', type: 'snippet' },
            { label: 'input:submit', insertText: 'input type="submit" value="" />', type: 'snippet' },
            { label: 'textarea', insertText: 'textarea name="" id="" cols="30" rows="10"></textarea>', type: 'tag' },
            { label: 'select', insertText: 'select name="" id="">\n    <option value=""></option>\n</select>', type: 'tag' },
            
            // Structured Lists & Tables
            { label: 'ul+', insertText: 'ul>\n    <li></li>\n</ul>', type: 'snippet' },
            { label: 'ol+', insertText: 'ol>\n    <li></li>\n</ol>', type: 'snippet' },
            { label: 'table+', insertText: 'table>\n    <thead>\n        <tr>\n            <th></th>\n        </tr>\n    </thead>\n    <tbody>\n        <tr>\n            <td></td>\n        </tr>\n    </tbody>\n</table>', type: 'snippet' },

            // Global Metadata Attributes
            { label: 'class', insertText: 'class=""', type: 'attribute' },
            { label: 'id', insertText: 'id=""', type: 'attribute' },
            { label: 'style', insertText: 'style=""', type: 'attribute' },
            { label: 'placeholder', insertText: 'placeholder=""', type: 'attribute' },
            { label: 'href', insertText: 'href=""', type: 'attribute' },
            { label: 'src', insertText: 'src=""', type: 'attribute' },
            { label: 'target', insertText: 'target="_blank"', type: 'attribute' },
            { label: 'disabled', insertText: 'disabled', type: 'attribute' },
            { label: 'required', insertText: 'required', type: 'attribute' }
        ],
        parser: 'html',
        parserRules: []
    });
    api.languages.registerHighlighter('html', htmlRules);

    // ==========================================
    // 2. EXTENDED CSS AUTOCOMPLETE & SNIPPETS
    // ==========================================
    api.languages.register('css', {
        name: 'CSS',
        extensions: ['css'],
        db: [
            // Properties
            { label: 'color', insertText: 'color: ', type: 'property' },
            { label: 'background-color', insertText: 'background-color: ', type: 'property' },
            { label: 'margin', insertText: 'margin: ', type: 'property' },
            { label: 'padding', insertText: 'padding: ', type: 'property' },
            { label: 'display', insertText: 'display: ', type: 'property' },
            { label: 'position', insertText: 'position: ', type: 'property' },
            { label: 'font-size', insertText: 'font-size: ', type: 'property' },
            { label: 'font-family', insertText: 'font-family: ', type: 'property' },
            { label: 'width', insertText: 'width: ', type: 'property' },
            { label: 'height', insertText: 'height: ', type: 'property' },
            { label: 'border', insertText: 'border: 1px solid ', type: 'property' },
            { label: 'border-radius', insertText: 'border-radius: ', type: 'property' },
            { label: 'box-shadow', insertText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.15);', type: 'property' },
            { label: 'transition', insertText: 'transition: all 0.2s ease-out;', type: 'property' },
            { label: 'cursor: pointer', insertText: 'cursor: pointer;', type: 'snippet' },
            
            // Value Presets
            { label: 'display: flex', insertText: 'display: flex;', type: 'snippet' },
            { label: 'display: grid', insertText: 'display: grid;', type: 'snippet' },
            { label: 'position: absolute', insertText: 'position: absolute;', type: 'snippet' },
            { label: 'position: relative', insertText: 'position: relative;', type: 'snippet' },
            { label: 'flex-center', insertText: 'display: flex;\njustify-content: center;\nalign-items: center;', type: 'snippet' },
            { label: 'media', insertText: '@media (max-width: 768px) {\n    \n}', type: 'snippet' },
            { label: 'keyframes', insertText: '@keyframes name {\n    from { opacity: 0; }\n    to { opacity: 1; }\n}', type: 'snippet' },
            { label: 'reset', insertText: '*, *::before, *::after {\n    box-sizing: border-box;\n    margin: 0;\n    padding: 0;\n}', type: 'snippet' }
        ],
        parser: 'css',
        parserRules: []
    });
    api.languages.registerHighlighter('css', cssRules);

    // ==========================================
    // 3. EXTENDED JAVASCRIPT AUTOCOMPLETE & SNIPPETS
    // ==========================================
    api.languages.register('javascript', {
        name: 'JavaScript',
        extensions: ['js', 'mjs', 'cjs'],
        db: [
            // Core Keywords
            { label: 'const', insertText: 'const ', type: 'keyword' },
            { label: 'let', insertText: 'let ', type: 'keyword' },
            { label: 'function', insertText: 'function ', type: 'keyword' },
            { label: 'async', insertText: 'async ', type: 'keyword' },
            { label: 'await', insertText: 'await ', type: 'keyword' },
            { label: 'return', insertText: 'return ', type: 'keyword' },
            { label: 'class', insertText: 'class Name {\n    constructor() {\n        \n    }\n}', type: 'snippet' },
            
            // DOM Access APIs
            { label: 'console.log', insertText: 'console.log();', type: 'function' },
            { label: 'document.getElementById', insertText: 'document.getElementById("");', type: 'function' },
            { label: 'document.querySelector', insertText: 'document.querySelector("");', type: 'function' },
            { label: 'document.querySelectorAll', insertText: 'document.querySelectorAll("");', type: 'function' },
            { label: 'addEventListener', insertText: 'addEventListener("click", (e) => {\n    \n});', type: 'snippet' },
            
            // Array Traversal & Data API
            { label: 'forEach', insertText: 'forEach(item => {\n    \n});', type: 'snippet' },
            { label: 'map', insertText: 'map(item => {\n    return \n});', type: 'snippet' },
            { label: 'filter', insertText: 'filter(item => {\n    return \n});', type: 'snippet' },
            { label: 'fetch', insertText: 'fetch("")\n    .then(res => res.json())\n    .then(data => {\n        \n    })\n    .catch(err => console.error(err));', type: 'snippet' },
            
            // Timers & JSON
            { label: 'setTimeout', insertText: 'setTimeout(() => {\n    \n}, 1000);', type: 'snippet' },
            { label: 'promise', insertText: 'new Promise((resolve, reject) => {\n    \n});', type: 'snippet' },
            { label: 'JSON.stringify', insertText: 'JSON.stringify();', type: 'function' },
            { label: 'JSON.parse', insertText: 'JSON.parse();', type: 'function' }
        ],
        parser: 'js',
        parserRules: [
            { regex: /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g, group: 1, type: 'variable' },
            { regex: /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g, group: 1, type: 'function', insertSuffix: '()' },
            { regex: /class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g, group: 1, type: 'class' }
        ]
    });
    api.languages.registerHighlighter('javascript', jsRules);

    // ==========================================
    // 4. REGISTRATION OF BUILT-IN WEB LSP CLIENTS (Added Fix)
    // ==========================================
    const isWin = typeof window !== 'undefined' && window.process && window.process.platform === 'win32';
    
    // Explicitly target Windows .cmd batch wrappers on Windows to ensure shell resolution
    const tsCmd = isWin ? 'typescript-language-server.cmd' : 'typescript-language-server';
    const cssCmd = isWin ? 'vscode-css-language-server.cmd' : 'vscode-css-language-server';
    const htmlCmd = isWin ? 'vscode-html-language-server.cmd' : 'vscode-html-language-server';

    // Force-enable semantic diagnostics on all JS files under proper language scoping
    const tsInitializationOptions = {
        javascript: {
            implicitProjectConfiguration: {
                checkJs: true
            }
        },
        typescript: {
            implicitProjectConfiguration: {
                checkJs: true
            }
        }
    };

    api.languages.registerLspClient('javascript', tsCmd, ['--stdio'], tsInitializationOptions);
    api.languages.registerLspClient('css', cssCmd, ['--stdio']);
    api.languages.registerLspClient('html', htmlCmd, ['--stdio']);

    // ==========================================
    // 5. REGISTRATION OF CUSTOM DIAGNOSTIC STYLES
    // ==========================================
    api.views.registerDiagnosticStyle('web-dashed', {
        name: 'Web Dev Dashed Underline',
        errorClass: 'diag-error-web',
        warningClass: 'diag-warning-web'
    });

    console.log("[Web Pack] All syntax highlighters, autocomplete models, LSP clients, and custom styles loaded.");
}

export function deactivate() {
    console.log("[Web Pack] Syntax highlighting and LSP client registries flushed.");
}