/**
 * Line Operations
 * ---------------
 * Classic editor line manipulation shortcuts wired straight into the textarea:
 *   - Ctrl/Cmd + /            toggle line comment (language-aware)
 *   - Alt + ArrowUp/Down      move the current line / selection up or down
 *   - Shift+Alt + ArrowUp/Down  duplicate the current line / selection
 *   - Ctrl/Cmd + Shift + K    delete the current line / selection
 *
 * All operations act on whole lines and preserve a sensible selection so the
 * shortcuts can be repeated. They dispatch a synthetic `input` event so the rest
 * of the editor (highlighting, dirty-state, gutter, LSP sync) refreshes normally.
 */

// Single-token line comments keyed by file extension.
const LINE_COMMENTS = {
    js: '//', mjs: '//', cjs: '//', ts: '//', tsx: '//', jsx: '//',
    java: '//', c: '//', h: '//', cpp: '//', hpp: '//', cc: '//', cs: '//',
    go: '//', rs: '//', php: '//', swift: '//', kt: '//', scala: '//', dart: '//',
    py: '#', rb: '#', sh: '#', bash: '#', zsh: '#', yaml: '#', yml: '#',
    toml: '#', pl: '#', r: '#', ini: '#',
    lua: '--', sql: '--', hs: '--'
};

// Wrapping block comments for languages without a line-comment token.
const BLOCK_COMMENTS = {
    css: ['/*', '*/'], scss: ['/*', '*/'], less: ['/*', '*/'],
    html: ['<!--', '-->'], htm: ['<!--', '-->'], xml: ['<!--', '-->'],
    svg: ['<!--', '-->'], vue: ['<!--', '-->'], md: ['<!--', '-->']
};

function getExt(fileName) {
    return fileName ? fileName.split('.').pop().toLowerCase() : '';
}

/**
 * Expands the current selection to cover every whole line it touches.
 * Returns { start, end } as character offsets (end is exclusive of the trailing \n).
 */
function fullLineRange(value, selStart, selEnd) {
    // If the selection ends exactly at the start of a line, that line isn't really
    // part of the selection — pull the end back so we don't grab an extra line.
    let effEnd = selEnd;
    if (effEnd > selStart && value[effEnd - 1] === '\n') effEnd -= 1;

    const start = value.lastIndexOf('\n', selStart - 1) + 1;
    let end = value.indexOf('\n', effEnd);
    if (end === -1) end = value.length;
    return { start, end };
}

function setValueAndSelection(editor, value, selStart, selEnd) {
    editor.value = value;
    editor.selectionStart = selStart;
    editor.selectionEnd = selEnd;
    editor.dispatchEvent(new Event('input'));
    editor.focus();
}

/* ------------------------------- toggle comment ------------------------------ */

function toggleLineComment(editor, token) {
    const value = editor.value;
    const { start, end } = fullLineRange(value, editor.selectionStart, editor.selectionEnd);
    const block = value.substring(start, end);
    const lines = block.split('\n');

    const esc = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Comment matches the token whether or not it's followed by a space.
    const commentRe = new RegExp(`^(\\s*)${esc} ?`);

    const nonBlank = lines.filter(l => l.trim().length > 0);
    const allCommented = nonBlank.length > 0 && nonBlank.every(l => commentRe.test(l));

    const newLines = lines.map(line => {
        if (line.trim().length === 0) return line; // leave blank lines untouched
        if (allCommented) {
            return line.replace(commentRe, '$1');
        }
        const indent = line.match(/^\s*/)[0];
        return indent + token + ' ' + line.slice(indent.length);
    });

    const newBlock = newLines.join('\n');
    const newValue = value.substring(0, start) + newBlock + value.substring(end);
    // Re-select the whole affected block.
    setValueAndSelection(editor, newValue, start, start + newBlock.length);
}

function toggleBlockComment(editor, open, close) {
    const value = editor.value;
    const { start, end } = fullLineRange(value, editor.selectionStart, editor.selectionEnd);
    const block = value.substring(start, end);
    const trimmed = block.trim();

    let newBlock;
    if (trimmed.startsWith(open) && trimmed.endsWith(close)) {
        // Unwrap: strip the first open and last close (plus a padding space each).
        newBlock = block
            .replace(new RegExp(`${open.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} ?`), '')
            .replace(new RegExp(` ?${close.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s*)$`), '$1');
    } else {
        const indent = block.match(/^\s*/)[0];
        newBlock = indent + open + ' ' + block.slice(indent.length) + ' ' + close;
    }

    const newValue = value.substring(0, start) + newBlock + value.substring(end);
    setValueAndSelection(editor, newValue, start, start + newBlock.length);
}

/* --------------------------- move / duplicate / delete ------------------------ */

function offsetToLine(value, offset) {
    let line = 0;
    for (let i = 0; i < offset && i < value.length; i++) {
        if (value[i] === '\n') line++;
    }
    return line;
}

function lineToOffset(lines, lineIdx) {
    let offset = 0;
    for (let i = 0; i < lineIdx; i++) offset += lines[i].length + 1; // +1 for the \n
    return offset;
}

function moveLines(editor, dir) {
    const value = editor.value;
    const lines = value.split('\n');
    const firstLine = offsetToLine(value, editor.selectionStart);
    const lastLine = offsetToLine(value, Math.max(editor.selectionStart, editor.selectionEnd - 1));

    if (dir < 0 && firstLine === 0) return;
    if (dir > 0 && lastLine === lines.length - 1) return;

    let newFirst;
    if (dir < 0) {
        const above = lines.splice(firstLine - 1, 1)[0];
        lines.splice(lastLine, 0, above);
        newFirst = firstLine - 1;
    } else {
        const below = lines.splice(lastLine + 1, 1)[0];
        lines.splice(firstLine, 0, below);
        newFirst = firstLine + 1;
    }

    const count = lastLine - firstLine;
    const newValue = lines.join('\n');
    const newStart = lineToOffset(lines, newFirst);
    const newEnd = lineToOffset(lines, newFirst + count) + lines[newFirst + count].length;
    setValueAndSelection(editor, newValue, newStart, newEnd);
}

function duplicateLines(editor, dir) {
    const value = editor.value;
    const { start, end } = fullLineRange(value, editor.selectionStart, editor.selectionEnd);
    const block = value.substring(start, end);
    const newValue = value.substring(0, end) + '\n' + block + value.substring(end);

    if (dir > 0) {
        // Duplicate downward: move the caret onto the new copy.
        const delta = block.length + 1;
        setValueAndSelection(editor, newValue,
            editor.selectionStart + delta, editor.selectionEnd + delta);
    } else {
        // Duplicate upward: keep the caret on the original (upper) copy.
        setValueAndSelection(editor, newValue, editor.selectionStart, editor.selectionEnd);
    }
}

function deleteLines(editor) {
    const value = editor.value;
    const { start, end } = fullLineRange(value, editor.selectionStart, editor.selectionEnd);
    // Remove the trailing newline too, or the leading one if this is the last line.
    let cutStart = start;
    let cutEnd = end;
    if (end < value.length) cutEnd += 1;          // eat following \n
    else if (start > 0) cutStart -= 1;            // last line: eat preceding \n

    const newValue = value.substring(0, cutStart) + value.substring(cutEnd);
    const caret = Math.min(start, newValue.length);
    setValueAndSelection(editor, newValue, caret, caret);
}

/* ---------------------------------- dispatch ---------------------------------- */

/**
 * Handles a keydown event for line operations.
 * @returns {boolean} true if the event was consumed.
 */
export function handleLineOperations(e, editor, fileName) {
    const mod = e.ctrlKey || e.metaKey;

    // Ctrl/Cmd + /  → toggle comment
    if (mod && !e.shiftKey && !e.altKey && (e.key === '/' || e.code === 'Slash')) {
        e.preventDefault();
        const ext = getExt(fileName);
        if (LINE_COMMENTS[ext]) {
            toggleLineComment(editor, LINE_COMMENTS[ext]);
        } else if (BLOCK_COMMENTS[ext]) {
            toggleBlockComment(editor, BLOCK_COMMENTS[ext][0], BLOCK_COMMENTS[ext][1]);
        } else {
            toggleLineComment(editor, '//'); // sensible default
        }
        return true;
    }

    // Ctrl/Cmd + Shift + K  → delete line
    if (mod && e.shiftKey && !e.altKey && (e.key === 'K' || e.key === 'k')) {
        e.preventDefault();
        deleteLines(editor);
        return true;
    }

    // Alt + ArrowUp/Down  → move; add Shift → duplicate
    if (e.altKey && !mod && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        const dir = e.key === 'ArrowUp' ? -1 : 1;
        if (e.shiftKey) duplicateLines(editor, dir);
        else moveLines(editor, dir);
        return true;
    }

    return false;
}
