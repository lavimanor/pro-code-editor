/**
 * Stateful tokenizer for CSS code blocks.
 */
export function tokenizeCSS(text, baseOffset = 0) {
    const tokens = [];
    const cssRegex = /(\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(@[a-zA-Z0-9_-]+)|([{};:])|([a-zA-Z0-9_.*#%:-]+)|([ \t\r\n]+)/gi;
    
    let lastIndex = 0;
    let match;
    let inBlock = false;
    let inValue = false;

    while ((match = cssRegex.exec(text)) !== null) {
        const matchIndex = match.index;
        const globalIndex = baseOffset + matchIndex;

        if (matchIndex > lastIndex) {
            tokens.push({
                type: 'text',
                text: text.substring(lastIndex, matchIndex),
                start: baseOffset + lastIndex
            });
        }

        const matchText = match[0];
        if (match[1]) { // Comment
            tokens.push({ type: 'comment', text: matchText, start: globalIndex });
        } else if (match[2]) { // String
            tokens.push({ type: 'string', text: matchText, start: globalIndex });
        } else if (match[3]) { // At-rule
            tokens.push({ type: 'builtin', text: matchText, start: globalIndex });
        } else if (match[4]) { // Punctuation: { } ; :
            tokens.push({ type: 'punctuation', text: matchText, start: globalIndex });
            if (matchText === '{') {
                inBlock = true;
            } else if (matchText === '}') {
                inBlock = false;
                inValue = false;
            } else if (matchText === ':') {
                if (inBlock) inValue = true;
            } else if (matchText === ';') {
                inValue = false;
            }
        } else if (match[5]) { // Word/Selector/Property
            let type = 'text';
            if (inBlock) {
                type = inValue ? 'string' : 'keyword';
            } else {
                type = 'function';
            }
            tokens.push({ type, text: matchText, start: globalIndex });
        } else if (match[6]) { // Whitespace
            tokens.push({ type: 'text', text: matchText, start: globalIndex });
        }

        lastIndex = cssRegex.lastIndex;
    }

    if (lastIndex < text.length) {
        tokens.push({
            type: 'text',
            text: text.substring(lastIndex),
            start: baseOffset + lastIndex
        });
    }

    return tokens;
}

/**
 * Stateful tokenizer for JavaScript code blocks.
 */
export function tokenizeJS(text, baseOffset = 0) {
    const tokens = [];
    const jsRegex = /(\/\*[\s\S]*?\*\/|\/\/.*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b(?:const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|class|export|import|from|default|new|this|typeof|instanceof|try|catch|finally|throw|async|await|yield|true|false|null|undefined)\b)|([a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\())|(\b(?:console|document|window|Math|Array|Object|String|Number|Boolean|Set|Map|Promise)\b)|(\b\d+(?:\.\d+)?\b)|([{}[\]().,;=+\-*/!&|:<>?%]+)|([a-zA-Z_$][a-zA-Z0-9_$]*)/g;

    let lastIndex = 0;
    let match;

    while ((match = jsRegex.exec(text)) !== null) {
        const matchIndex = match.index;
        const globalIndex = baseOffset + matchIndex;

        if (matchIndex > lastIndex) {
            tokens.push({
                type: 'text',
                text: text.substring(lastIndex, matchIndex),
                start: baseOffset + lastIndex
            });
        }

        const matchText = match[0];
        if (match[1]) { // Comment
            tokens.push({ type: 'comment', text: matchText, start: globalIndex });
        } else if (match[2]) { // String
            tokens.push({ type: 'string', text: matchText, start: globalIndex });
        } else if (match[3]) { // Keyword
            tokens.push({ type: 'keyword', text: matchText, start: globalIndex });
        } else if (match[4]) { // Function Name
            tokens.push({ type: 'function', text: matchText, start: globalIndex });
        } else if (match[5]) { // Built-in / Globals
            tokens.push({ type: 'builtin', text: matchText, start: globalIndex });
        } else if (match[6]) { // Number
            tokens.push({ type: 'number', text: matchText, start: globalIndex });
        } else if (match[7]) { // Punctuation & Operators
            tokens.push({ type: 'punctuation', text: matchText, start: globalIndex });
        } else if (match[8]) { // Base Identifier
            tokens.push({ type: 'text', text: matchText, start: globalIndex });
        }

        lastIndex = jsRegex.lastIndex;
    }

    if (lastIndex < text.length) {
        tokens.push({
            type: 'text',
            text: text.substring(lastIndex),
            start: baseOffset + lastIndex
        });
    }

    return tokens;
}

/**
 * Internal tag content attribute scanner with isolated bracket separation.
 */
function tokenizeTagInternal(tagContent, baseOffset, tokens) {
    const nameMatch = tagContent.match(/^<\/?[a-zA-Z0-9:-]+/);
    if (!nameMatch) {
        tokens.push({ type: 'text', text: tagContent, start: baseOffset });
        return;
    }
    
    const tagNameWithBracket = nameMatch[0]; // e.g. "<html" or "</head"
    
    // Separate the "<" or "</" brackets from the actual tag name
    const bracketLen = tagNameWithBracket.startsWith('</') ? 2 : 1;
    const bracketText = tagNameWithBracket.substring(0, bracketLen);
    const actualTagName = tagNameWithBracket.substring(bracketLen);
    
    // Push opening bracket as 'tag-bracket' (gray)
    tokens.push({ type: 'tag-bracket', text: bracketText, start: baseOffset });
    
    // Push tag name as 'tag-name' (blue)
    tokens.push({ type: 'tag-name', text: actualTagName, start: baseOffset + bracketLen });
    
    let lastIndex = tagNameWithBracket.length;
    const attrRegex = /(\s+[a-zA-Z0-9:-]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g;
    attrRegex.lastIndex = lastIndex;
    
    let match;
    while ((match = attrRegex.exec(tagContent)) !== null) {
        const matchIndex = match.index;
        if (matchIndex > lastIndex) {
            tokens.push({ type: 'text', text: tagContent.substring(lastIndex, matchIndex), start: baseOffset + lastIndex });
        }
        
        tokens.push({ type: 'attr-name', text: match[1], start: baseOffset + matchIndex });
        
        const fullMatch = match[0];
        const eqIdx = fullMatch.indexOf('=');
        if (eqIdx !== -1) {
            const eqAndVal = fullMatch.substring(eqIdx);
            tokens.push({ type: 'text', text: '=', start: baseOffset + matchIndex + eqIdx });
            tokens.push({ type: 'attr-value', text: eqAndVal.substring(1), start: baseOffset + matchIndex + eqIdx + 1 });
        }
        
        lastIndex = attrRegex.lastIndex;
    }
    
    if (lastIndex < tagContent.length) {
        const rest = tagContent.substring(lastIndex);
        if (rest.trim() === '>' || rest.trim() === '/>') {
            tokens.push({ type: 'tag-bracket', text: rest, start: baseOffset + lastIndex });
        } else {
            tokens.push({ type: 'text', text: rest, start: baseOffset + lastIndex });
        }
    }
}

/**
 * Stateful HTML Tokenizer with CSS `<style>` and JS `<script>` tag block interception.
 */
export function tokenizeHTML(text) {
    const tokens = [];
    let index = 0;
    
    while (index < text.length) {
        const tagStartIdx = text.indexOf('<', index);
        if (tagStartIdx === -1) {
            tokens.push({ type: 'text', text: text.substring(index), start: index });
            break;
        }
        
        if (tagStartIdx > index) {
            tokens.push({ type: 'text', text: text.substring(index, tagStartIdx), start: index });
        }
        
        // Comment matching
        if (text.startsWith('<!--', tagStartIdx)) {
            const commentEndIdx = text.indexOf('-->', tagStartIdx + 4);
            if (commentEndIdx !== -1) {
                tokens.push({ type: 'comment', text: text.substring(tagStartIdx, commentEndIdx + 3), start: tagStartIdx });
                index = commentEndIdx + 3;
                continue;
            }
        }
        
        // Doctype matching
        if (text.toUpperCase().startsWith('<!DOCTYPE', tagStartIdx)) {
            const doctypeEndIdx = text.indexOf('>', tagStartIdx + 9);
            if (doctypeEndIdx !== -1) {
                tokens.push({ type: 'doctype', text: text.substring(tagStartIdx, doctypeEndIdx + 1), start: tagStartIdx });
                index = doctypeEndIdx + 1;
                continue;
            }
        }
        
        // Match tag block while respecting string quotes inside attributes
        let tagEndIdx = -1;
        let inQuote = null;
        for (let i = tagStartIdx + 1; i < text.length; i++) {
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
            tokens.push({ type: 'tag-name', text: text.substring(tagStartIdx), start: tagStartIdx });
            break;
        }
        
        const tagContent = text.substring(tagStartIdx, tagEndIdx + 1);
        tokenizeTagInternal(tagContent, tagStartIdx, tokens);
        
        // Parse embedded sub-languages
        const nameMatch = tagContent.match(/^<([a-zA-Z0-9:-]+)/);
        if (nameMatch) {
            const tagNameLower = nameMatch[1].toLowerCase();
            if (tagNameLower === 'style' || tagNameLower === 'script') {
                const innerStart = tagEndIdx + 1;
                const endTag = `</${tagNameLower}>`;
                const endTagIdx = text.toLowerCase().indexOf(endTag, innerStart);
                
                if (endTagIdx !== -1) {
                    const content = text.substring(innerStart, endTagIdx);
                    tokens.push({
                        type: tagNameLower === 'style' ? 'css-style' : 'js-script',
                        text: content,
                        start: innerStart
                    });
                    index = endTagIdx;
                    continue;
                } else {
                    const content = text.substring(innerStart);
                    tokens.push({
                        type: tagNameLower === 'style' ? 'css-style' : 'js-script',
                        text: content,
                        start: innerStart
                    });
                    index = text.length;
                    break;
                }
            }
        }
        
        index = tagEndIdx + 1;
    }
    
    return tokens;
}

/**
 * Stateful tokenizer for JSON data blocks.
 */
export function tokenizeJSON(text, baseOffset = 0) {
    const tokens = [];
    const jsonRegex = /("(?:\\.|[^"\\])*")\s*(?=:)|("(?:\\.|[^"\\])*")|(\b(?:true|false|null)\b)|(\b\d+(?:\.\d+)?\b)|([{}[\]:,])/g;

    let lastIndex = 0;
    let match;

    while ((match = jsonRegex.exec(text)) !== null) {
        const matchIndex = match.index;
        const globalIndex = baseOffset + matchIndex;

        if (matchIndex > lastIndex) {
            tokens.push({
                type: 'text',
                text: text.substring(lastIndex, matchIndex),
                start: baseOffset + lastIndex
            });
        }

        const matchText = match[0];
        if (match[1]) { // JSON Key
            tokens.push({ type: 'keyword', text: matchText, start: globalIndex });
        } else if (match[2]) { // JSON String value
            tokens.push({ type: 'string', text: matchText, start: globalIndex });
        } else if (match[3]) { // JSON Literal value
            tokens.push({ type: 'keyword', text: matchText, start: globalIndex });
        } else if (match[4]) { // JSON Number
            tokens.push({ type: 'number', text: matchText, start: globalIndex });
        } else if (match[5]) { // JSON Punctuation
            tokens.push({ type: 'punctuation', text: matchText, start: globalIndex });
        }

        lastIndex = jsonRegex.lastIndex;
    }

    if (lastIndex < text.length) {
        tokens.push({
            type: 'text',
            text: text.substring(lastIndex),
            start: baseOffset + lastIndex
        });
    }

    return tokens;
}

/**
 * Inline regex tokenizer helper for Markdown line formats.
 */
function tokenizeMDInline(lineText, baseLineOffset) {
    const tokens = [];
    const mdInlineRegex = /(\*\*|__)(.*?)\1|(\*|_)(.*?)\3|(`)(.*?)\5|(!?\[.*?\]\(.*?\))/g;
    
    let lastIndex = 0;
    let match;

    while ((match = mdInlineRegex.exec(lineText)) !== null) {
        const matchIndex = match.index;
        const globalIndex = baseLineOffset + matchIndex;

        if (matchIndex > lastIndex) {
            tokens.push({
                type: 'text',
                text: lineText.substring(lastIndex, matchIndex),
                start: baseLineOffset + lastIndex
            });
        }

        const matchText = match[0];
        if (match[1]) { // Bold
            tokens.push({ type: 'md-bold', text: matchText, start: globalIndex });
        } else if (match[3]) { // Italic
            tokens.push({ type: 'md-italic', text: matchText, start: globalIndex });
        } else if (match[5]) { // Inline Code
            tokens.push({ type: 'md-inline-code', text: matchText, start: globalIndex });
        } else if (match[7]) { // Link/Image
            tokens.push({ type: 'md-link', text: matchText, start: globalIndex });
        }

        lastIndex = mdInlineRegex.lastIndex;
    }

    if (lastIndex < lineText.length) {
        tokens.push({
            type: 'text',
            text: lineText.substring(lastIndex),
            start: baseLineOffset + lastIndex
        });
    }

    return tokens;
}

/**
 * Line-based structure tokenizer for Markdown blocks.
 */
export function tokenizeMD(text, baseOffset = 0) {
    const tokens = [];
    const lines = text.split('\n');
    
    let currentOffset = baseOffset;
    let inCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineLengthWithNewline = line.length + (i < lines.length - 1 ? 1 : 0);

        if (line.trim().startsWith('```')) {
            tokens.push({
                type: 'md-codeblock-fence',
                text: line,
                start: currentOffset
            });
            inCodeBlock = !inCodeBlock;
            currentOffset += lineLengthWithNewline;
            continue;
        }

        if (inCodeBlock) {
            tokens.push({
                type: 'md-codeblock-content',
                text: line,
                start: currentOffset
            });
        } else {
            if (line.trim().startsWith('#')) {
                tokens.push({
                    type: 'md-header',
                    text: line,
                    start: currentOffset
                });
            } else if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
                tokens.push({
                    type: 'md-list',
                    text: line,
                    start: currentOffset
                });
            } else if (line.trim().startsWith('>')) {
                tokens.push({
                    type: 'md-blockquote',
                    text: line,
                    start: currentOffset
                });
            } else {
                const inlineTokens = tokenizeMDInline(line, currentOffset);
                tokens.push(...inlineTokens);
            }
        }

        if (i < lines.length - 1) {
            tokens.push({
                type: 'text',
                text: '\n',
                start: currentOffset + line.length
            });
        }

        currentOffset += lineLengthWithNewline;
    }

    return tokens;
}

/**
 * Stateful tokenizer for Java code blocks.
 */
export function tokenizeJava(text, baseOffset = 0) {
    const tokens = [];
    const javaRegex = /(\/\*[\s\S]*?\*\/|\/\/.*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(@[a-zA-Z_$][a-zA-Z0-9_$]*)|(\b(?:class|interface|enum|extends|implements|package|import|public|private|protected|static|final|void|int|double|float|boolean|char|byte|long|short|if|else|for|while|do|switch|case|break|continue|return|new|this|super|try|catch|finally|throw|throws|instanceof|volatile|transient|synchronized|native|abstract|strictfp|assert|default|true|false|null)\b)|([a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\())|(\b(?:System|String|Object|Class|Integer|Double|Float|Boolean|Character|Byte|Long|Short|Math|Exception|Thread|ArrayList|HashMap|List|Map)\b)|(\b\d+(?:\.\d+)?\b)|([{}[\]().,;=+\-*/!&|:<>?%]+)|([a-zA-Z_$][a-zA-Z0-9_$]*)/g;

    let lastIndex = 0;
    let match;

    while ((match = javaRegex.exec(text)) !== null) {
        const matchIndex = match.index;
        const globalIndex = baseOffset + matchIndex;

        if (matchIndex > lastIndex) {
            tokens.push({
                type: 'text',
                text: text.substring(lastIndex, matchIndex),
                start: baseOffset + lastIndex
            });
        }

        const matchText = match[0];
        if (match[1]) { // Comment
            tokens.push({ type: 'comment', text: matchText, start: globalIndex });
        } else if (match[2]) { // String
            tokens.push({ type: 'string', text: matchText, start: globalIndex });
        } else if (match[3]) { // Annotation
            tokens.push({ type: 'builtin', text: matchText, start: globalIndex });
        } else if (match[4]) { // Keyword
            tokens.push({ type: 'keyword', text: matchText, start: globalIndex });
        } else if (match[5]) { // Method / Function
            tokens.push({ type: 'function', text: matchText, start: globalIndex });
        } else if (match[6]) { // Core Built-in Class
            tokens.push({ type: 'builtin', text: matchText, start: globalIndex });
        } else if (match[7]) { // Number
            tokens.push({ type: 'number', text: matchText, start: globalIndex });
        } else if (match[8]) { // Punctuation & Operators
            tokens.push({ type: 'punctuation', text: matchText, start: globalIndex });
        } else if (match[9]) { // Identifier
            tokens.push({ type: 'text', text: matchText, start: globalIndex });
        }

        lastIndex = javaRegex.lastIndex;
    }

    if (lastIndex < text.length) {
        tokens.push({
            type: 'text',
            text: text.substring(lastIndex),
            start: baseOffset + lastIndex
        });
    }

    return tokens;
}

/**
 * Stateful tokenizer for C# code blocks.
 */
export function tokenizeCSharp(text, baseOffset = 0) {
    const tokens = [];
    const csharpRegex = /(\/\*[\s\S]*?\*\/|\/\/.*)|(@?"(?:\\.|""|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b(?:class|struct|interface|enum|delegate|namespace|using|public|private|protected|internal|static|readonly|const|void|int|double|float|bool|char|byte|long|short|string|decimal|object|if|else|for|foreach|in|while|do|switch|case|break|continue|return|new|this|base|try|catch|finally|throw|var|dynamic|null|true|false|as|is|ref|out|params|lock|await|async|get|set|yield|override|virtual|abstract|partial)\b)|([a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\())|(\b(?:Console|Convert|Math|Task|Thread|List|Dictionary|Enumerable|Guid|DateTime|Int32|String|Object)\b)|(\b\d+(?:\.\d+)?\b)|([{}[\]().,;=+\-*/!&|:<>?%]+)|([a-zA-Z_$][a-zA-Z0-9_$]*)/g;

    let lastIndex = 0;
    let match;

    while ((match = csharpRegex.exec(text)) !== null) {
        const matchIndex = match.index;
        const globalIndex = baseOffset + matchIndex;

        if (matchIndex > lastIndex) {
            tokens.push({
                type: 'text',
                text: text.substring(lastIndex, matchIndex),
                start: baseOffset + lastIndex
            });
        }

        const matchText = match[0];
        if (match[1]) { // Comment
            tokens.push({ type: 'comment', text: matchText, start: globalIndex });
        } else if (match[2]) { // String
            tokens.push({ type: 'string', text: matchText, start: globalIndex });
        } else if (match[3]) { // Keyword
            tokens.push({ type: 'keyword', text: matchText, start: globalIndex });
        } else if (match[4]) { // Method / Function
            tokens.push({ type: 'function', text: matchText, start: globalIndex });
        } else if (match[5]) { // Core Built-in Class
            tokens.push({ type: 'builtin', text: matchText, start: globalIndex });
        } else if (match[6]) { // Number
            tokens.push({ type: 'number', text: matchText, start: globalIndex });
        } else if (match[7]) { // Punctuation & Operators
            tokens.push({ type: 'punctuation', text: matchText, start: globalIndex });
        } else if (match[8]) { // Identifier
            tokens.push({ type: 'text', text: matchText, start: globalIndex });
        }

        lastIndex = csharpRegex.lastIndex;
    }

    if (lastIndex < text.length) {
        tokens.push({
            type: 'text',
            text: text.substring(lastIndex),
            start: baseOffset + lastIndex
        });
    }

    return tokens;
}

/**
 * Stateful tokenizer for Python code blocks.
 */
export function tokenizePython(text, baseOffset = 0) {
    const tokens = [];
    const pythonRegex = /(#.*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(@[a-zA-Z_][a-zA-Z0-9_]*)|(\b(?:class|def|return|if|elif|else|for|while|break|continue|import|from|as|try|except|finally|raise|assert|pass|yield|with|global|nonlocal|lambda|and|or|not|is|in|True|False|None)\b)|([a-zA-Z_][a-zA-Z0-9_]*(?=\s*\())|(\b(?:print|len|range|str|int|float|list|dict|set|tuple|open|type|dir|id|map|filter|sum|max|min)\b)|(\b\d+(?:\.\d+)?\b)|([{}[\]().,;=+\-*/!&|:<>?%]+)|([a-zA-Z_][a-zA-Z0-9_]*)/g;

    let lastIndex = 0;
    let match;

    while ((match = pythonRegex.exec(text)) !== null) {
        const matchIndex = match.index;
        const globalIndex = baseOffset + matchIndex;

        if (matchIndex > lastIndex) {
            tokens.push({
                type: 'text',
                text: text.substring(lastIndex, matchIndex),
                start: baseOffset + lastIndex
            });
        }

        const matchText = match[0];
        if (match[1]) { // Comment
            tokens.push({ type: 'comment', text: matchText, start: globalIndex });
        } else if (match[2]) { // String (Double, Single, or Triple formats)
            tokens.push({ type: 'string', text: matchText, start: globalIndex });
        } else if (match[3]) { // Decorator
            tokens.push({ type: 'builtin', text: matchText, start: globalIndex });
        } else if (match[4]) { // Keyword
            tokens.push({ type: 'keyword', text: matchText, start: globalIndex });
        } else if (match[5]) { // Function
            tokens.push({ type: 'function', text: matchText, start: globalIndex });
        } else if (match[6]) { // Built-in Functions & Objects
            tokens.push({ type: 'builtin', text: matchText, start: globalIndex });
        } else if (match[7]) { // Number
            tokens.push({ type: 'number', text: matchText, start: globalIndex });
        } else if (match[8]) { // Punctuation & Operators
            tokens.push({ type: 'punctuation', text: matchText, start: globalIndex });
        } else if (match[9]) { // Identifier
            tokens.push({ type: 'text', text: matchText, start: globalIndex });
        }

        lastIndex = pythonRegex.lastIndex;
    }

    if (lastIndex < text.length) {
        tokens.push({
            type: 'text',
            text: text.substring(lastIndex),
            start: baseOffset + lastIndex
        });
    }

    return tokens;
}

/**
 * Stateful tokenizer for C and C++ code blocks.
 */
export function tokenizeCPP(text, baseOffset = 0) {
    const tokens = [];
    const cppRegex = /(\/\*[\s\S]*?\*\/|\/\/.*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b(?:class|struct|interface|union|enum|public|private|protected|static|const|volatile|inline|virtual|override|final|abstract|void|if|else|for|while|do|switch|case|break|continue|return|new|delete|this|try|catch|throw|namespace|using|friend|template|typename|operator|sizeof|typeof|typedef|extern|auto|register|explicit)\b)|([a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\())|(\b(?:int|double|float|bool|char|wchar_t|long|short|unsigned|signed|size_t|std|string|vector|map|set|list|unordered_map|unordered_set|cout|cin|cerr|endl)\b)|(\b\d+(?:\.\d+)?\b)|([{}[\]().,;=+\-*/!&|:<>?%]+)|([a-zA-Z_$][a-zA-Z0-9_$]*)/g;

    let lastIndex = 0;
    let match;

    while ((match = cppRegex.exec(text)) !== null) {
        const matchIndex = match.index;
        const globalIndex = baseOffset + matchIndex;

        if (matchIndex > lastIndex) {
            tokens.push({
                type: 'text',
                text: text.substring(lastIndex, matchIndex),
                start: baseOffset + lastIndex
            });
        }

        const matchText = match[0];
        if (match[1]) { // Comment
            tokens.push({ type: 'comment', text: matchText, start: globalIndex });
        } else if (match[2]) { // String
            tokens.push({ type: 'string', text: matchText, start: globalIndex });
        } else if (match[3]) { // Keyword
            tokens.push({ type: 'keyword', text: matchText, start: globalIndex });
        } else if (match[4]) { // Method / Function
            tokens.push({ type: 'function', text: matchText, start: globalIndex });
        } else if (match[5]) { // Type / Standard Library
            tokens.push({ type: 'builtin', text: matchText, start: globalIndex });
        } else if (match[6]) { // Number
            tokens.push({ type: 'number', text: matchText, start: globalIndex });
        } else if (match[7]) { // Punctuation & Operators
            tokens.push({ type: 'punctuation', text: matchText, start: globalIndex });
        } else if (match[8]) { // Identifier
            tokens.push({ type: 'text', text: matchText, start: globalIndex });
        }

        lastIndex = cppRegex.lastIndex;
    }

    if (lastIndex < text.length) {
        tokens.push({
            type: 'text',
            text: text.substring(lastIndex),
            start: baseOffset + lastIndex
        });
    }

    return tokens;
}

/**
 * Stateful tokenizer for Lua code blocks.
 */
export function tokenizeLua(text, baseOffset = 0) {
    const tokens = [];
    const luaRegex = /(--\[\[[\s\S]*?\]\]|--.*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\[\[[\s\S]*?\]\])|(\b(?:and|break|do|else|elseif|end|false|for|function|goto|if|in|local|nil|not|or|repeat|return|then|true|until|while)\b)|([a-zA-Z_][a-zA-Z0-9_]*(?=\s*\())|(\b(?:print|pairs|ipairs|type|tostring|tonumber|table|string|math|io|os|require|assert|error|pcall|xpcall)\b)|(\b\d+(?:\.\d+)?\b)|([{}[\]().,;:+\-*/%^#=~<>]+)|([a-zA-Z_][a-zA-Z0-9_]*)/g;

    let lastIndex = 0;
    let match;

    while ((match = luaRegex.exec(text)) !== null) {
        const matchIndex = match.index;
        const globalIndex = baseOffset + matchIndex;

        if (matchIndex > lastIndex) {
            tokens.push({
                type: 'text',
                text: text.substring(lastIndex, matchIndex),
                start: baseOffset + lastIndex
            });
        }

        const matchText = match[0];
        if (match[1]) { // Comment
            tokens.push({ type: 'comment', text: matchText, start: globalIndex });
        } else if (match[2]) { // String (Double, Single, or Double-Bracket block)
            tokens.push({ type: 'string', text: matchText, start: globalIndex });
        } else if (match[3]) { // Keyword
            tokens.push({ type: 'keyword', text: matchText, start: globalIndex });
        } else if (match[4]) { // Function definition / call
            tokens.push({ type: 'function', text: matchText, start: globalIndex });
        } else if (match[5]) { // Built-in / Global Library
            tokens.push({ type: 'builtin', text: matchText, start: globalIndex });
        } else if (match[6]) { // Number
            tokens.push({ type: 'number', text: matchText, start: globalIndex });
        } else if (match[7]) { // Punctuation & Operators
            tokens.push({ type: 'punctuation', text: matchText, start: globalIndex });
        } else if (match[8]) { // Base Identifier
            tokens.push({ type: 'text', text: matchText, start: globalIndex });
        }

        lastIndex = luaRegex.lastIndex;
    }

    if (lastIndex < text.length) {
        tokens.push({
            type: 'text',
            text: text.substring(lastIndex),
            start: baseOffset + lastIndex
        });
    }

    return tokens;
}

/**
 * Calculates absolute character index from line and column indexes.
 */
function getGlobalIndexFromLineCol(text, lineNum, colNum) {
    const lines = text.split('\n');
    if (lineNum > lines.length) return -1;
    
    let index = 0;
    for (let i = 0; i < lineNum - 1; i++) {
        index += lines[i].length + 1; // +1 for the newline
    }
    
    const colIndex = Math.max(0, colNum - 1);
    return index + colIndex;
}

/**
 * Expands a single character index outwards to isolate entire word boundaries.
 */
function getWordRangeAtIndex(text, globalIndex) {
    if (globalIndex < 0 || globalIndex >= text.length) return null;
    
    const char = text[globalIndex];
    if (/\s/.test(char)) {
        return { start: globalIndex, end: globalIndex + 1 };
    }
    
    let start = globalIndex;
    while (start > 0 && /[a-zA-Z0-9_]/.test(text[start - 1])) {
        start--;
    }
    
    let end = globalIndex;
    while (end < text.length && /[a-zA-Z0-9_]/.test(text[end])) {
        end++;
    }
    
    if (start === end) {
        return { start: globalIndex, end: globalIndex + 1 };
    }
    
    return { start, end };
}

/**
 * Escapes characters, injects caret markers, and overlays syntax error spans.
 */
function escapeAndMarkChar(char, globalIndex, highlightIndices, cursorIndex, errorRange, errorStyleClass) {
    let escaped = char;
    if (char === '&') escaped = '&amp;';
    else if (char === '<') escaped = '&lt;';
    else if (char === '>') escaped = '&gt;';

    let out = '';
    if (globalIndex === cursorIndex) {
        out += `<span id="prosense-caret-marker"></span>`;
    }

    const isError = errorRange && (globalIndex >= errorRange.start && globalIndex < errorRange.end);

    let charHTML = '';
    if (highlightIndices && highlightIndices.has(globalIndex)) {
        charHTML = `<span class="bracket-highlight">${escaped}</span>`;
    } else {
        charHTML = escaped;
    }

    if (isError) {
        out += `<span class="${errorStyleClass}">${charHTML}</span>`;
    } else {
        out += charHTML;
    }
    return out;
}

/**
 * Escapes characters and wraps individual tokens in syntax-coloring spans.
 */
function renderTokenHTML(token, highlightIndices, cursorIndex, errorRange, errorStyleClass) {
    let tokenHTML = '';
    for (let i = 0; i < token.text.length; i++) {
        const globalIndex = token.start + i;
        tokenHTML += escapeAndMarkChar(token.text[i], globalIndex, highlightIndices, cursorIndex, errorRange, errorStyleClass);
    }
    if (token.type !== 'text') {
        return `<span class="syntax-${token.type}">${tokenHTML}</span>`;
    }
    return tokenHTML;
}

/**
 * Core entry point for compiling syntax-highlighted code with bracket overlays.
 */
export function renderSyntaxHighlighting(text, fileName, highlightIndices, cursorIndex, activeSyntaxError, errorStyleClass) {
    const isHTML = fileName && (fileName.endsWith('.html') || fileName.endsWith('.htm'));
    const isCSS = fileName && fileName.endsWith('.css');
    const isJS = fileName && (fileName.endsWith('.js') || fileName.endsWith('.mjs') || fileName.endsWith('.cjs'));
    const isJSON = fileName && fileName.endsWith('.json');
    const isMD = fileName && fileName.endsWith('.md');
    const isJava = fileName && fileName.endsWith('.java');
    const isCSharp = fileName && fileName.endsWith('.cs');
    const isPython = fileName && fileName.endsWith('.py');
    const isCPP = fileName && (
        fileName.endsWith('.cpp') || fileName.endsWith('.hpp') || 
        fileName.endsWith('.cc') || fileName.endsWith('.cxx') ||
        fileName.endsWith('.c') || fileName.endsWith('.h')
    );
    const isLua = fileName && fileName.endsWith('.lua');

    // Calculate error highlights boundaries
    let errorRange = null;
    if (activeSyntaxError && activeSyntaxError.line) {
        const errorIdx = getGlobalIndexFromLineCol(text, activeSyntaxError.line, activeSyntaxError.offset);
        if (errorIdx !== -1) {
            errorRange = getWordRangeAtIndex(text, errorIdx);
        }
    }

    let backdropHTML = '';

    if (isHTML) {
        const tokens = tokenizeHTML(text);
        tokens.forEach(token => {
            if (token.type === 'css-style') {
                const cssTokens = tokenizeCSS(token.text, token.start);
                cssTokens.forEach(cssToken => {
                    backdropHTML += renderTokenHTML(cssToken, highlightIndices, cursorIndex, errorRange, errorStyleClass);
                });
            } else if (token.type === 'js-script') {
                const jsTokens = tokenizeJS(token.text, token.start);
                jsTokens.forEach(jsToken => {
                    backdropHTML += renderTokenHTML(jsToken, highlightIndices, cursorIndex, errorRange, errorStyleClass);
                });
            } else {
                backdropHTML += renderTokenHTML(token, highlightIndices, cursorIndex, errorRange, errorStyleClass);
            }
        });
    } else if (isCSS) {
        const tokens = tokenizeCSS(text);
        tokens.forEach(token => {
            backdropHTML += renderTokenHTML(token, highlightIndices, cursorIndex, errorRange, errorStyleClass);
        });
    } else if (isJS) {
        const tokens = tokenizeJS(text);
        tokens.forEach(token => {
            backdropHTML += renderTokenHTML(token, highlightIndices, cursorIndex, errorRange, errorStyleClass);
        });
    } else if (isJSON) {
        const tokens = tokenizeJSON(text);
        tokens.forEach(token => {
            backdropHTML += renderTokenHTML(token, highlightIndices, cursorIndex, errorRange, errorStyleClass);
        });
    } else if (isMD) {
        const tokens = tokenizeMD(text);
        tokens.forEach(token => {
            backdropHTML += renderTokenHTML(token, highlightIndices, cursorIndex, errorRange, errorStyleClass);
        });
    } else if (isJava) {
        const tokens = tokenizeJava(text);
        tokens.forEach(token => {
            backdropHTML += renderTokenHTML(token, highlightIndices, cursorIndex, errorRange, errorStyleClass);
        });
    } else if (isCSharp) {
        const tokens = tokenizeCSharp(text);
        tokens.forEach(token => {
            backdropHTML += renderTokenHTML(token, highlightIndices, cursorIndex, errorRange, errorStyleClass);
        });
    } else if (isPython) {
        const tokens = tokenizePython(text);
        tokens.forEach(token => {
            backdropHTML += renderTokenHTML(token, highlightIndices, cursorIndex, errorRange, errorStyleClass);
        });
    } else if (isCPP) {
        const tokens = tokenizeCPP(text);
        tokens.forEach(token => {
            backdropHTML += renderTokenHTML(token, highlightIndices, cursorIndex, errorRange, errorStyleClass);
        });
    } else if (isLua) {
        const tokens = tokenizeLua(text);
        tokens.forEach(token => {
            backdropHTML += renderTokenHTML(token, highlightIndices, cursorIndex, errorRange, errorStyleClass);
        });
    } else {
        for (let i = 0; i < text.length; i++) {
            backdropHTML += escapeAndMarkChar(text[i], i, highlightIndices, cursorIndex, errorRange, errorStyleClass);
        }
    }

    if (cursorIndex === text.length) {
        backdropHTML += `<span id="prosense-caret-marker"></span>`;
    }

    return backdropHTML;
}