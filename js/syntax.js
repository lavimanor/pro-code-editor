import { api } from './api-core.js';

// Universal fallback rules: Isolated brackets into stand-alone token colors (Added Fix)
const genericFallbackRules = [
    { type: 'comment', regex: /\/\*[\s\S]*?\*\/|\/\/.*|#.*|--.*/ },
    { type: 'string', regex: /`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/ },
    { type: 'number', regex: /\b(?:0[xX][0-9a-fA-F]+|0[bB][01]+|0[oO][0-7]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)n?\b/ },
    { type: 'bracket', regex: /[{}()[\]]/ },
    { type: 'punctuation', regex: /[.,;:?]|=>|&&|\|\||[-=+\/*%!<>^&|~]/ }
];

// Compile universal fallback rules once on load
const compiledGenericModel = {
    regex: new RegExp(genericFallbackRules.map(rule => `(${rule.regex.source})`).join('|'), 'g'),
    types: genericFallbackRules.map(rule => rule.type)
};

/**
 * Base Tokenizer: Match and split text strictly against a regex model.
 */
function baseTokenize(text, compiledModel) {
    const tokens = [];
    let lastIndex = 0;
    let match;

    const { regex, types } = compiledModel;
    regex.lastIndex = 0; // Reset lookups

    while ((match = regex.exec(text)) !== null) {
        const matchIndex = match.index;

        if (matchIndex > lastIndex) {
            tokens.push({
                type: 'text',
                text: text.substring(lastIndex, matchIndex),
                start: lastIndex
            });
        }

        const matchText = match[0];
        
        let tokenType = 'text';
        for (let i = 0; i < types.length; i++) {
            if (match[i + 1] !== undefined) {
                tokenType = types[i];
                break;
            }
        }

        tokens.push({
            type: tokenType,
            text: matchText,
            start: matchIndex
        });

        lastIndex = regex.lastIndex;

        if (regex.lastIndex === matchIndex) {
            regex.lastIndex++;
        }
    }

    if (lastIndex < text.length) {
        tokens.push({
            type: 'text',
            text: text.substring(lastIndex),
            start: lastIndex
        });
    }

    return tokens;
}

/**
 * Layered Tokenizer with Fallback Support:
 * Tokenizes text using the primary language model first, then sub-tokenizes 
 * any unmatched text blocks using the universal generic model.
 */
function tokenize(text, compiledModel) {
    // If we are already running on the fallback model itself, return the base tokenizer
    if (compiledModel === compiledGenericModel) {
        return baseTokenize(text, compiledModel);
    }

    const primaryTokens = baseTokenize(text, compiledModel);
    const finalTokens = [];

    primaryTokens.forEach(token => {
        if (token.type === 'text') {
            // Sub-tokenize unmatched text blocks using fallback rules
            const fallbackTokens = baseTokenize(token.text, compiledGenericModel);
            fallbackTokens.forEach(subToken => {
                finalTokens.push({
                    type: subToken.type,
                    text: subToken.text,
                    start: token.start + subToken.start
                });
            });
        } else {
            finalTokens.push(token);
        }
    });

    return finalTokens;
}

/**
 * Helper to offset matched token index positions relative to raw file coordinates.
 */
function tokenizeWithOffset(text, compiledModel, offset) {
    const tokens = tokenize(text, compiledModel);
    tokens.forEach(token => {
        token.start += offset;
    });
    return tokens;
}

/**
 * Standalone syntax highlighter for isolated code snippets (e.g. LSP hover tooltips).
 * Tokenizes `code` with the highlighter registered for `langId` (falling back to the
 * universal generic model) and returns HTML with <span class="syntax-*"> wrappers so
 * snippets pick up the exact same theme colors as the editor backdrop.
 */
export function highlightCodeToHTML(code, langId) {
    const cleanText = (code || '').replace(/\r/g, '');
    const model = (langId && api.languages.getHighlighter(langId)) || compiledGenericModel;
    const tokens = tokenize(cleanText, model);

    let html = '';
    tokens.forEach(token => {
        const safe = token.text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        html += token.type !== 'text'
            ? `<span class="syntax-${token.type}">${safe}</span>`
            : safe;
    });
    return html;
}

/**
 * Sub-Language Interpreter:
 * Recursively parses HTML files, extracting and styling style blocks and 
 * inline scripts using the respective CSS and JS dynamic registers.
 */
function tokenizeHTMLWithSubLanguages(text) {
    const tokens = [];
    
    // Resolve dynamic highlighter instances cleanly from active API registries
    const htmlModel = api.languages.getHighlighter('html');
    const cssModel = api.languages.getHighlighter('css');
    const jsModel = api.languages.getHighlighter('javascript');
    
    let index = 0;
    
    while (index < text.length) {
        const styleIdx = text.toLowerCase().indexOf('<style', index);
        const scriptIdx = text.toLowerCase().indexOf('<script', index);
        
        let nextBlockIdx = -1;
        let blockType = null; // 'style' or 'script'
        
        // Find which embedded sub-language node block starts first
        if (styleIdx !== -1 && (scriptIdx === -1 || styleIdx < scriptIdx)) {
            nextBlockIdx = styleIdx;
            blockType = 'style';
        } else if (scriptIdx !== -1 && (styleIdx === -1 || scriptIdx < styleIdx)) {
            nextBlockIdx = scriptIdx;
            blockType = 'script';
        }
        
        if (nextBlockIdx === -1) {
            // No more sub-language blocks. Tokenize remaining characters as plain HTML
            const restHTML = text.substring(index);
            if (htmlModel) {
                tokens.push(...tokenizeWithOffset(restHTML, htmlModel, index));
            } else {
                tokens.push({ type: 'text', text: restHTML, start: index });
            }
            break;
        }
        
        // 1. Tokenize HTML structures before the sub-language node
        if (nextBlockIdx > index) {
            const HTMLBefore = text.substring(index, nextBlockIdx);
            if (htmlModel) {
                tokens.push(...tokenizeWithOffset(HTMLBefore, htmlModel, index));
            } else {
                tokens.push({ type: 'text', text: HTMLBefore, start: index });
            }
        }
        
        // 2. Discover opening tag boundary limit (supports attribute setups)
        let tagEndIdx = -1;
        let inQuote = null;
        for (let i = nextBlockIdx + 1; i < text.length; i++) {
            const char = text[i];
            if (inQuote) {
                if (char === inQuote) inQuote = null;
            } else {
                if (char === '"' || char === "'") {
                    inQuote = char;
                } else if (char === '>') {
                    tagEndIdx = i;
                    break;
                }
            }
        }
        
        if (tagEndIdx === -1) {
            // Unclosed opening node. Highlight rest of file as standard HTML
            const restHTML = text.substring(nextBlockIdx);
            if (htmlModel) {
                tokens.push(...tokenizeWithOffset(restHTML, htmlModel, nextBlockIdx));
            } else {
                tokens.push({ type: 'text', text: restHTML, start: nextBlockIdx });
            }
            break;
        }
        
        // Highlight opening tag metadata (<style class="xyz">) as HTML
        const openingTag = text.substring(nextBlockIdx, tagEndIdx + 1);
        if (htmlModel) {
            tokens.push(...tokenizeWithOffset(openingTag, htmlModel, nextBlockIdx));
        } else {
            tokens.push({ type: 'text', text: openingTag, start: nextBlockIdx });
        }
        
        // 3. Extract and parse internal styles or script text content
        const innerStart = tagEndIdx + 1;
        const endTagLabel = `</${blockType}>`;
        const endTagIdx = text.toLowerCase().indexOf(endTagLabel, innerStart);
        
        if (endTagIdx === -1) {
            // Closing tag is missing. Highlight remaining script and break
            const innerContent = text.substring(innerStart);
            const subModel = (blockType === 'style') ? cssModel : jsModel;
            if (subModel) {
                tokens.push(...tokenizeWithOffset(innerContent, subModel, innerStart));
            } else {
                tokens.push({ type: 'text', text: innerContent, start: innerStart });
            }
            break;
        }
        
        // Apply sub-language highlighting model dynamically on the enclosed string block
        const innerContent = text.substring(innerStart, endTagIdx);
        const subModel = (blockType === 'style') ? cssModel : jsModel;
        if (subModel) {
            tokens.push(...tokenizeWithOffset(innerContent, subModel, innerStart));
        } else {
            tokens.push({ type: 'text', text: innerContent, start: innerStart });
        }
        
        // Progress index past the sub-language text and the closing tag
        index = endTagIdx;
    }
    
    return tokens;
}

/**
 * Helper to match if any active diagnostics cover the current character offset.
 */
function findDiagnosticAtIndex(globalIndex) {
    const diags = window.activeDiagnostics || [];
    // Sort by severity so that errors (severity 1) are given highest rendering priority over warnings
    return diags
        .filter(d => globalIndex >= d.start && globalIndex < d.end)
        .sort((a, b) => a.severity - b.severity)[0];
}

/**
 * Resolves the styling class according to user preferences or extension registrations.
 */
function getDiagnosticStyleClass(severity) {
    const activeStyleId = localStorage.getItem('editor-diagnostic-style') || 'vscode';
    
    if (activeStyleId === 'vscode' || activeStyleId === 'intellij') {
        return `style-${activeStyleId}`;
    }

    const customStyle = api.views.getDiagnosticStyle(activeStyleId);
    if (customStyle) {
        return severity === 1 ? customStyle.errorClass : customStyle.warningClass;
    }

    return 'style-vscode';
}

/**
 * Escapes tags structures and applies matching bracket styles.
 */
function escapeAndMarkChar(char, globalIndex, highlightIndices, cursorIndex) {
    let escaped = char;
    if (char === '&') escaped = '&amp;';
    else if (char === '<') escaped = '&lt;';
    else if (char === '>') escaped = '&gt;';

    let out = '';
    if (globalIndex === cursorIndex) {
        out += `<span id="prosense-caret-marker"></span>`;
    }

    const activeDiag = findDiagnosticAtIndex(globalIndex);
    let wrapperClass = '';
    if (activeDiag) {
        const severityClass = activeDiag.severity === 1 ? 'diag-error' : 'diag-warning';
        const styleClass = getDiagnosticStyleClass(activeDiag.severity);
        wrapperClass = `diagnostic ${severityClass} ${styleClass}`;
    }

    if (highlightIndices && highlightIndices.has(globalIndex)) {
        escaped = `<span class="bracket-highlight">${escaped}</span>`;
    }

    // Always wrap in a data-offset span so the mouse hover probe can find the character index (Added Fix)
    const offsetAttr = `data-offset="${globalIndex}"`;
    if (wrapperClass) {
        out += `<span class="${wrapperClass}" ${offsetAttr}>${escaped}</span>`;
    } else {
        out += `<span ${offsetAttr}>${escaped}</span>`;
    }

    return out;
}

/**
 * Entry render layer: Routes text streams to standard, sub-language split, or universal fallback tokenizers.
 */
export function renderSyntaxHighlighting(text, fileName, highlightIndices, cursorIndex) {
    // Strip all carriage returns globally to ensure 100% index-to-viewport alignment (Added Fix)
    const cleanText = text.replace(/\r/g, '');
    const ext = fileName ? fileName.split('.').pop().toLowerCase() : '';
    const config = api.languages.get(ext);

    let backdropHTML = '';
    let tokens = null;

    // Check if files require HTML nested block evaluations
    if (ext === 'html' || ext === 'htm') {
        tokens = tokenizeHTMLWithSubLanguages(cleanText);
    } else if (config) {
        const compiledModel = api.languages.getHighlighter(config.name) || api.languages.getHighlighter(ext);
        if (compiledModel) {
            tokens = tokenize(cleanText, compiledModel);
        }
    }

    // If no specific language tokens are compiled, default to the universal generic tokenizer
    if (!tokens) {
        tokens = tokenize(cleanText, compiledGenericModel);
    }

    tokens.forEach(token => {
        let tokenHTML = '';
        for (let i = 0; i < token.text.length; i++) {
            const globalIndex = token.start + i;
            tokenHTML += escapeAndMarkChar(token.text[i], globalIndex, highlightIndices, cursorIndex);
        }
        if (token.type !== 'text') {
            backdropHTML += `<span class="syntax-${token.type}">${tokenHTML}</span>`;
        } else {
            backdropHTML += tokenHTML;
        }
    });

    if (cursorIndex === cleanText.length) {
        backdropHTML += `<span id="prosense-caret-marker"></span>`;
    }

    return backdropHTML;
}