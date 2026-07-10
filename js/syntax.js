import { api } from './api-core.js';

/**
 * Standard single-regex tokenization parser:
 * Parses text streams using compiled capture group offsets.
 */
function tokenize(text, compiledModel) {
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
 * Sub-Language Interpreter (Added Feature):
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

    if (highlightIndices && highlightIndices.has(globalIndex)) {
        out += `<span class="bracket-highlight">${escaped}</span>`;
    } else {
        out += escaped;
    }
    return out;
}

/**
 * Entry render layer: Routes text streams to standard or sub-language split tokenizers.
 */
export function renderSyntaxHighlighting(text, fileName, highlightIndices, cursorIndex) {
    const ext = fileName ? fileName.split('.').pop().toLowerCase() : '';
    const config = api.languages.get(ext);

    let backdropHTML = '';
    let tokens = null;

    // Check if files require HTML nested block evaluations
    if (ext === 'html' || ext === 'htm') {
        tokens = tokenizeHTMLWithSubLanguages(text);
    } else if (config) {
        const compiledModel = api.languages.getHighlighter(config.name) || api.languages.getHighlighter(ext);
        if (compiledModel) {
            tokens = tokenize(text, compiledModel);
        }
    }

    if (tokens) {
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
    } else {
        // Plain text fallback if no registered language model is active
        for (let i = 0; i < text.length; i++) {
            backdropHTML += escapeAndMarkChar(text[i], i, highlightIndices, cursorIndex);
        }
    }

    if (cursorIndex === text.length) {
        backdropHTML += `<span id="prosense-caret-marker"></span>`;
    }

    return backdropHTML;
}