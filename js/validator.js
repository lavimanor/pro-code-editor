/**
 * Advanced Structural Syntax Validator (With Real-Time Console Logging)
 */
export function validateCode(text, ext) {
    console.log(`[ProSense Validator] validateCode triggered. Extension: "${ext}", Characters: ${text.length}`);
    const errors = [];
    if (!text) {
        console.log(`[ProSense Validator] Empty text buffer. Returning no errors.`);
        return errors;
    }

    if (ext === 'js' || ext === 'mjs' || ext === 'cjs') {
        console.log(`[ProSense Validator] Invoking JavaScript parsers...`);
        validateJSBraces(text, errors);
        validateQuotes(text, errors);
        validateJSNative(text, errors);
    } else if (ext === 'css') {
        console.log(`[ProSense Validator] Invoking CSS parsers...`);
        validateCSSStructure(text, errors);
        validateQuotes(text, errors);
    } else if (ext === 'html' || ext === 'htm') {
        console.log(`[ProSense Validator] Invoking HTML tag-stack parsers...`);
        validateHTMLTags(text, errors);
    } else {
        console.log(`[ProSense Validator] Extension "${ext}" is not registered for active syntax validation.`);
    }

    console.log(`[ProSense Validator] Complete. Total structural errors detected:`, errors.length, errors);
    return errors;
}

/**
 * Checks for unmatched braces, parentheses, and brackets.
 */
function validateJSBraces(text, errors) {
    const stack = [];
    const openChars = ['{', '(', '['];
    const closeChars = ['}', ')', ']'];
    const pairMap = { '}': '{', ')': '(', ']': '[' };

    let inString = null;
    let isComment = false;
    let isBlockComment = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (isComment) {
            if (char === '\n') isComment = false;
            continue;
        }
        if (isBlockComment) {
            if (char === '*' && nextChar === '/') {
                isBlockComment = false;
                i++;
            }
            continue;
        }
        if (inString) {
            if (char === '\\') {
                i++;
            } else if (char === inString) {
                inString = null;
            }
            continue;
        }

        if (char === '/' && nextChar === '/') {
            isComment = true;
            i++;
            continue;
        }
        if (char === '/' && nextChar === '*') {
            isBlockComment = true;
            i++;
            continue;
        }

        if (char === '"' || char === "'" || char === '`') {
            inString = char;
            continue;
        }

        if (openChars.includes(char)) {
            stack.push({ char, index: i });
        } else if (closeChars.includes(char)) {
            const expectedOpen = pairMap[char];
            if (stack.length === 0) {
                errors.push({
                    start: i,
                    end: i + 1,
                    message: `Unmatched closing character '${char}'`
                });
            } else {
                const last = stack.pop();
                if (last.char !== expectedOpen) {
                    errors.push({
                        start: i,
                        end: i + 1,
                        message: `Mismatched closing character '${char}' (expected '${expectedOpen}')`
                    });
                }
            }
        }
    }

    while (stack.length > 0) {
        const unclosed = stack.pop();
        errors.push({
            start: unclosed.index,
            end: unclosed.index + 1,
            message: `Unclosed opening character '${unclosed.char}'`
        });
    }
}

/**
 * Checks for unclosed single/double quotes on a single line.
 */
function validateQuotes(text, errors) {
    const lines = text.split('\n');
    let offset = 0;

    lines.forEach(line => {
        let inQuote = null;
        let quoteStart = -1;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (inQuote) {
                if (char === '\\') {
                    i++;
                } else if (char === inQuote) {
                    inQuote = null;
                }
            } else {
                if (char === '"' || char === "'") {
                    inQuote = char;
                    quoteStart = offset + i;
                }
            }
        }

        if (inQuote) {
            errors.push({
                start: quoteStart,
                end: offset + line.length,
                message: `Unclosed string literal`
            });
        }

        offset += line.length + 1;
    });
}

/**
 * Executes a native compile check on JS using the browser's V8 engine and parses
 * the stack trace to pinpoint the exact character index of the syntax error.
 */
function validateJSNative(text, errors) {
    if (errors.length > 0) return; // Prioritize structural bracket mismatch logs

    try {
        new Function(text);
    } catch (err) {
        if (err.name === 'SyntaxError' && err.stack) {
            console.log(`[ProSense Validator] V8 caught compile-time SyntaxError stack:\n`, err.stack);
            
            // Extract the anonymous compilation coordinates (<anonymous>:line:col) from the stack
            const stackMatch = err.stack.match(/<anonymous>:(\d+):(\d+)/);
            if (stackMatch) {
                const v8Line = parseInt(stackMatch[1], 10);
                const v8Col = parseInt(stackMatch[2], 10);
                
                // Subtract 2 to account for V8's "function anonymous() {" wrapper header line
                const realLineIndex = v8Line - 2; 

                const lines = text.split('\n');
                if (realLineIndex >= 0 && realLineIndex < lines.length) {
                    // Find the absolute character offset up to the error line
                    let startOffset = 0;
                    for (let j = 0; j < realLineIndex; j++) {
                        startOffset += lines[j].length + 1;
                    }

                    const col = v8Col - 1; // 0-indexed column
                    const errorStart = startOffset + Math.max(0, col);
                    const lineText = lines[realLineIndex];
                    
                    // Highlight from the error column to the end of that specific line
                    const errorEnd = Math.min(startOffset + lineText.length, errorStart + Math.max(1, lineText.length - col));

                    errors.push({
                        start: errorStart,
                        end: errorEnd,
                        message: err.message
                    });
                    return;
                }
            }
        }
        
        // Fallback to highlighting whole file if stack trace cannot be parsed
        if (err.name === 'SyntaxError') {
            errors.push({
                start: 0,
                end: text.length,
                message: err.message
            });
        }
    }
}

/**
 * Checks CSS specific structural rules.
 */
function validateCSSStructure(text, errors) {
    validateJSBraces(text, errors);

    if (errors.length > 0) return;

    const lines = text.split('\n');
    let offset = 0;
    let inBlock = false;

    lines.forEach(line => {
        const trimmed = line.trim();

        if (trimmed.includes('{')) {
            inBlock = true;
        }
        if (trimmed.includes('}')) {
            inBlock = false;
        }

        if (inBlock && trimmed !== '' && !trimmed.startsWith('/*') && !trimmed.endsWith('*/')) {
            if (trimmed.includes(':') && !trimmed.endsWith(';') && !trimmed.endsWith('{') && !trimmed.endsWith('}')) {
                errors.push({
                    start: offset,
                    end: offset + line.length,
                    message: `CSS property statement must end with a semicolon`
                });
            }
        }

        offset += line.length + 1;
    });
}

/**
 * Checks HTML tags balancing and unclosed brackets.
 */
function validateHTMLTags(text, errors) {
    const stack = [];
    const voidTags = ['img', 'br', 'hr', 'input', 'link', 'meta', 'base', 'col', 'embed', 'source', 'track', 'wbr'];
    
    let index = 0;
    while (index < text.length) {
        const tagStartIdx = text.indexOf('<', index);
        if (tagStartIdx === -1) break;

        const tagEndIdx = text.indexOf('>', tagStartIdx + 1);
        if (tagEndIdx === -1) {
            errors.push({
                start: tagStartIdx,
                end: text.length,
                message: `Unclosed HTML tag bracket`
            });
            break;
        }

        if (text.startsWith('<!--', tagStartIdx)) {
            const commentEndIdx = text.indexOf('-->', tagStartIdx + 4);
            if (commentEndIdx !== -1) {
                index = commentEndIdx + 3;
                continue;
            }
        }

        const tagContent = text.substring(tagStartIdx + 1, tagEndIdx).trim();
        
        if (tagContent.startsWith('/')) {
            const tagName = tagContent.substring(1).trim().split(/\s+/)[0].toLowerCase();
            if (stack.length === 0) {
                errors.push({
                    start: tagStartIdx,
                    end: tagEndIdx + 1,
                    message: `Unmatched closing tag </${tagName}>`
                });
            } else {
                const expected = stack.pop();
                if (expected.name !== tagName) {
                    errors.push({
                        start: tagStartIdx,
                        end: tagEndIdx + 1,
                        message: `Mismatched closing tag </${tagName}> (expected </${expected.name}>)`
                    });
                }
            }
        } else if (!tagContent.startsWith('!') && !tagContent.endsWith('/')) {
            const tagName = tagContent.split(/\s+/)[0].toLowerCase();
            if (!voidTags.includes(tagName)) {
                stack.push({ name: tagName, index: tagStartIdx });
            }
        }

        index = tagEndIdx + 1;
    }

    while (stack.length > 0) {
        const unclosed = stack.pop();
        errors.push({
            start: unclosed.index,
            end: unclosed.index + 5,
            message: `Unclosed opening tag <${unclosed.name}>`
        });
    }
}