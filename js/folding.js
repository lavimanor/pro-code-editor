/**
 * Code Folding
 * ------------
 * Collapse and expand structural regions — classes, functions, objects, blocks,
 * and indentation scopes — directly inside the textarea-backed editor.
 *
 * Because the editor surface is a real <textarea>, folding physically removes the
 * interior lines of a region from the visible value while stashing them away, and
 * reinserts them on unfold. The header and footer lines stay visible (so the code
 * you see is still syntactically whole), a "⋯ N lines" badge is painted onto the
 * highlight backdrop, and the gutter keeps showing true file line numbers.
 *
 * Persistence never sees the folded view: `getFullText()` reconstructs the complete
 * document, and callers (save, LSP sync, tab caching) route through it so a folded
 * buffer round-trips losslessly.
 *
 * Regions are detected two ways:
 *   • Bracket scopes  — a line ending in an opening { [ ( paired with its match.
 *   • Indent scopes   — a line ending in ':' (Python/YAML-style) whose following
 *                       lines are more deeply indented.
 */

let editorEl = null;
let onChange = () => {};

// Active folds for the current buffer: { atOffset, hiddenText }.
//  - atOffset:    char offset in the CURRENT (folded) editor value where the hidden
//                 interior should be reinserted (this equals the footer line start).
//  - hiddenText:  the removed interior lines, including their trailing newlines.
let folds = [];

const OPENERS = { '{': '}', '[': ']', '(': ')' };
const CLOSERS = { '}': '{', ']': '[', ')': '(' };

export function initFolding(editor, opts = {}) {
    editorEl = editor;
    if (typeof opts.onChange === 'function') onChange = opts.onChange;
}

export function hasFolds() {
    return folds.length > 0;
}

/** Drop all fold state without touching the buffer (used when switching files). */
export function clear() {
    folds = [];
}

// ---------------------------------------------------------------------------
//  Text geometry helpers
// ---------------------------------------------------------------------------

function lineStarts(text) {
    const starts = [0];
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '\n') starts.push(i + 1);
    }
    return starts;
}

function countNewlines(text) {
    let n = 0;
    for (let i = 0; i < text.length; i++) if (text[i] === '\n') n++;
    return n;
}

// Display line index that a character offset falls on (0-based).
function displayLineAt(text, offset) {
    return countNewlines(text.slice(0, offset));
}

/** The display line index whose header owns a given fold. */
function headerLineOfFold(text, fold) {
    // atOffset marks the footer line start; the header sits directly above it.
    return displayLineAt(text, fold.atOffset) - 1;
}

// ---------------------------------------------------------------------------
//  Region detection
// ---------------------------------------------------------------------------

/**
 * Given a header line index, resolve the [startLine, endLine] the fold should span,
 * or null when the line does not open a multi-line region. Operates on `text`.
 */
function findRegion(text, headerLine, starts) {
    starts = starts || lineStarts(text);
    if (headerLine < 0 || headerLine >= starts.length) return null;

    const lineStart = starts[headerLine];
    const lineEnd = headerLine + 1 < starts.length ? starts[headerLine + 1] - 1 : text.length;
    const lineText = text.slice(lineStart, lineEnd);
    const trimmedEnd = lineText.replace(/\s+$/, '');

    // --- Bracket scope: header ends with an opening bracket ---------------------
    const lastChar = trimmedEnd[trimmedEnd.length - 1];
    if (OPENERS[lastChar]) {
        const openIdx = lineStart + trimmedEnd.length - 1;
        const closeIdx = matchBracket(text, openIdx);
        if (closeIdx !== -1) {
            const endLine = displayLineAt(text, closeIdx);
            if (endLine > headerLine) return { startLine: headerLine, endLine };
        }
        return null;
    }

    // --- Indent scope: header ends with ':' (block-introducing) -----------------
    if (trimmedEnd.endsWith(':')) {
        const headerIndent = lineText.match(/^\s*/)[0].length;
        let endLine = headerLine;
        for (let l = headerLine + 1; l < starts.length; l++) {
            const s = starts[l];
            const e = l + 1 < starts.length ? starts[l + 1] - 1 : text.length;
            const lt = text.slice(s, e);
            if (lt.trim() === '') { endLine = l; continue; } // blank lines belong to the block
            const indent = lt.match(/^\s*/)[0].length;
            if (indent > headerIndent) endLine = l;
            else break;
        }
        // Trim trailing blank lines back out of the region.
        while (endLine > headerLine) {
            const s = starts[endLine];
            const e = endLine + 1 < starts.length ? starts[endLine + 1] - 1 : text.length;
            if (text.slice(s, e).trim() === '') endLine--;
            else break;
        }
        if (endLine > headerLine) return { startLine: headerLine, endLine };
    }

    return null;
}

/** Forward bracket matcher that respects nesting and skips strings/line comments. */
function matchBracket(text, openIdx) {
    const open = text[openIdx];
    const close = OPENERS[open];
    let depth = 0;
    let str = null; // active string delimiter
    for (let i = openIdx; i < text.length; i++) {
        const c = text[i];
        const prev = text[i - 1];
        if (str) {
            if (c === str && prev !== '\\') str = null;
            continue;
        }
        if (c === '"' || c === "'" || c === '`') { str = c; continue; }
        // Skip `//` and `#` line comments so brackets inside them don't count.
        if ((c === '/' && text[i + 1] === '/') || c === '#') {
            const nl = text.indexOf('\n', i);
            if (nl === -1) return -1;
            i = nl;
            continue;
        }
        if (c === open) depth++;
        else if (c === close) {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

/**
 * True when a display line currently opens a foldable region (and is not already
 * folded). Cheap pre-check keeps the gutter build fast on large files.
 */
function lineLooksFoldable(lineText) {
    const t = lineText.replace(/\s+$/, '');
    const last = t[t.length - 1];
    return !!OPENERS[last] || t.endsWith(':');
}

// ---------------------------------------------------------------------------
//  Fold / unfold operations
// ---------------------------------------------------------------------------

/** Reconstruct the complete document from the folded display value. */
export function getFullText(displayText) {
    if (!folds.length) return displayText;
    const ordered = [...folds].sort((a, b) => a.atOffset - b.atOffset);
    let out = '';
    let cursor = 0;
    for (const f of ordered) {
        const at = Math.max(cursor, Math.min(f.atOffset, displayText.length));
        out += displayText.slice(cursor, at) + f.hiddenText;
        cursor = at;
    }
    out += displayText.slice(cursor);
    return out;
}

/**
 * Map a character offset in the current (folded) display value to its 0-based line
 * index in the *full* reconstructed document. Columns are unaffected by folding —
 * only whole interior lines are ever hidden — so callers can read the column straight
 * off the display text. Lets status readouts show true file line numbers while folded.
 */
export function realLineForDisplayOffset(displayText, offset) {
    const dispLine = displayLineAt(displayText, offset);
    let extra = 0;
    folds.forEach(f => {
        // Only folds whose header sits strictly above the caret contribute hidden lines;
        // a fold anchored on the caret's own header line hides lines that come after it.
        if (headerLineOfFold(displayText, f) < dispLine) extra += countNewlines(f.hiddenText);
    });
    return dispLine + extra;
}

/** Shift fold anchors when the user edits visible text ahead of them. */
export function adjustForEdit(editPoint, delta) {
    if (!folds.length || !delta) return;
    folds.forEach(f => {
        if (editPoint <= f.atOffset) f.atOffset += delta;
    });
}

/** Expand every fold, restoring the full document into the editor. */
export function unfoldAll() {
    if (!folds.length || !editorEl) return;
    editorEl.value = getFullText(editorEl.value);
    folds = [];
    onChange();
}

/**
 * Toggle the fold whose header is at display line `dispLine`. Folds an open region
 * or expands an already-folded one. Returns true when something changed.
 */
export function toggleFoldAtLine(dispLine) {
    if (!editorEl) return false;
    const text = editorEl.value;

    // Already folded here? -> unfold just this region.
    const existingIdx = folds.findIndex(f => headerLineOfFold(text, f) === dispLine);
    if (existingIdx !== -1) {
        const fold = folds[existingIdx];
        editorEl.value = text.slice(0, fold.atOffset) + fold.hiddenText + text.slice(fold.atOffset);
        const removedLen = fold.hiddenText.length;
        folds.splice(existingIdx, 1);
        // Anchors sitting after this one slide forward by the reinserted length.
        folds.forEach(f => { if (f.atOffset >= fold.atOffset) f.atOffset += removedLen; });
        onChange();
        return true;
    }

    // Otherwise attempt to fold the region opened on this line.
    return foldRegionAtLine(dispLine);
}

function foldRegionAtLine(dispLine) {
    const text = editorEl.value;
    const region = findRegion(text, dispLine);
    if (!region) return false;

    const starts = lineStarts(text);
    const bodyStart = starts[region.startLine + 1];
    const bodyEnd = starts[region.endLine]; // footer line start
    if (bodyStart === undefined || bodyEnd === undefined || bodyEnd <= bodyStart) return false;

    // Absorb any nested folds inside this region so reconstruction stays flat: expand
    // them back into the interior first, then capture the fully-expanded body.
    const inner = folds.filter(f => f.atOffset > bodyStart && f.atOffset < bodyEnd);
    if (inner.length) {
        inner.sort((a, b) => a.atOffset - b.atOffset);
        let expanded = text;
        // Reinsert from the end backwards to keep earlier offsets valid.
        for (let i = inner.length - 1; i >= 0; i--) {
            const f = inner[i];
            expanded = expanded.slice(0, f.atOffset) + f.hiddenText + expanded.slice(f.atOffset);
        }
        folds = folds.filter(f => !(f.atOffset > bodyStart && f.atOffset < bodyEnd));
        editorEl.value = expanded;
        // Region boundaries moved; recompute from the same header line.
        return foldRegionAtLine(dispLine);
    }

    const hiddenText = text.slice(bodyStart, bodyEnd);
    editorEl.value = text.slice(0, bodyStart) + text.slice(bodyEnd);

    // Following anchors shift back by the removed length.
    const removed = hiddenText.length;
    folds.forEach(f => { if (f.atOffset >= bodyStart) f.atOffset -= removed; });
    folds.push({ atOffset: bodyStart, hiddenText });

    onChange();
    return true;
}

/** Fold the innermost region enclosing the caret (Ctrl+Shift+[). */
export function foldAtCursor() {
    if (!editorEl) return false;
    const text = editorEl.value;
    const caretLine = displayLineAt(text, editorEl.selectionStart);
    // Walk upward from the caret line to the nearest line that opens a region.
    for (let l = caretLine; l >= 0; l--) {
        const region = findRegion(text, l);
        if (region && region.startLine <= caretLine && region.endLine >= caretLine) {
            return foldRegionAtLine(l);
        }
    }
    return false;
}

/** Expand a fold at (or just below) the caret (Ctrl+Shift+]). */
export function unfoldAtCursor() {
    if (!editorEl || !folds.length) return false;
    const text = editorEl.value;
    const caretLine = displayLineAt(text, editorEl.selectionStart);
    const target = folds.find(f => headerLineOfFold(text, f) === caretLine);
    if (target) return toggleFoldAtLine(caretLine);
    return false;
}

// ---------------------------------------------------------------------------
//  Rendering: gutter numbers + arrows, and backdrop "⋯" badges
// ---------------------------------------------------------------------------

/**
 * Build the line-number gutter for the current display text, injecting fold arrows
 * and preserving true file line numbers across collapsed regions.
 */
export function buildGutterHTML(displayText) {
    const lines = displayText.split('\n');
    const starts = lineStarts(displayText); // computed once, reused across all rows
    const foldedHeaderLines = new Map(); // dispLine -> hidden line count
    folds.forEach(f => {
        foldedHeaderLines.set(headerLineOfFold(displayText, f), countNewlines(f.hiddenText));
    });

    let html = '';
    let realLine = 0; // 0-based real file line for the current display line
    for (let i = 0; i < lines.length; i++) {
        const realNum = realLine + 1;
        const isFolded = foldedHeaderLines.has(i);
        const foldable = isFolded || (lineLooksFoldable(lines[i]) && !!findRegion(displayText, i, starts));

        let arrow = '<span class="fold-toggle empty"></span>';
        if (isFolded) {
            arrow = `<span class="fold-toggle folded" data-fold-line="${i}" title="Expand region"><i class="fa-solid fa-chevron-right"></i></span>`;
        } else if (foldable) {
            arrow = `<span class="fold-toggle" data-fold-line="${i}" title="Collapse region"><i class="fa-solid fa-chevron-down"></i></span>`;
        }

        html += `<span class="gutter-num${isFolded ? ' has-fold' : ''}">${arrow}<span class="gutter-lnum">${realNum}</span></span>`;

        // Advance the real-line counter, skipping over hidden interior lines.
        realLine += 1;
        if (isFolded) realLine += foldedHeaderLines.get(i);
    }
    return html;
}

/**
 * Paint a "⋯ N lines" badge at the end of each folded region's header line by
 * splicing it into the highlight backdrop just before the terminating newline.
 */
export function decorateBackdrop(backdropHTML) {
    if (!folds.length) return backdropHTML;

    const text = editorEl ? editorEl.value : '';
    // Map: header display line -> hidden line count.
    const badges = new Map();
    folds.forEach(f => {
        badges.set(headerLineOfFold(text, f), countNewlines(f.hiddenText));
    });
    if (!badges.size) return backdropHTML;

    let result = '';
    let line = 0;
    let idx = 0;
    while (idx < backdropHTML.length) {
        const nl = backdropHTML.indexOf('\n', idx);
        if (nl === -1) {
            result += backdropHTML.slice(idx);
            break;
        }
        result += backdropHTML.slice(idx, nl);
        if (badges.has(line)) {
            const n = badges.get(line);
            result += `<span class="fold-badge">⋯ ${n} line${n === 1 ? '' : 's'}</span>`;
        }
        result += '\n';
        idx = nl + 1;
        line++;
    }
    return result;
}
