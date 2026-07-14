/**
 * Find & Replace system (Ctrl+F find, Ctrl+R / Ctrl+H replace).
 *
 * The editor is a transparent <textarea> layered over a syntax-highlighting
 * backdrop. To visually highlight search hits we inject a third layer
 * (#editor-search-layer) *beneath* the backdrop: it renders the full document
 * text transparently, wrapping matches in <mark> elements whose coloured
 * backgrounds show through behind the syntax-coloured text above them.
 *
 * All document mutations (Replace / Replace All) are pushed back through a
 * synthetic 'input' event so the core editor keeps dirty-state, caches, the
 * render engine and the LSP in sync — this module never has to know about them.
 */

import { hideProSense } from './prosense.js';

const LINE_HEIGHT = 22;   // keep in sync with #editor line-height in style.css
const PAD_TOP = 12;       // keep in sync with #editor padding
const MAX_MATCHES = 20000; // safety cap for pathological patterns

let editor, backdrop, surfaceBox, searchLayer, widget;
let findInput, replaceInput, countEl, replaceRow, toggleReplaceBtn;

let matches = [];
let currentIndex = -1;
let charWidth = 8.4; // measured lazily for horizontal scrolling
const opts = { case: false, word: false, regex: false };

function escapeHTML(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Build the search layer + find widget DOM and wire up all events. */
export function initFindReplace() {
    editor = document.getElementById('editor');
    backdrop = document.getElementById('editor-backdrop');
    surfaceBox = document.getElementById('editor-surface-box');
    if (!editor || !surfaceBox) return;

    searchLayer = document.createElement('div');
    searchLayer.id = 'editor-search-layer';
    surfaceBox.insertBefore(searchLayer, backdrop);

    widget = document.createElement('div');
    widget.id = 'find-widget';
    widget.className = 'find-hidden';
    widget.innerHTML = `
        <button id="find-toggle-replace" title="Toggle Replace (Ctrl+R)">
            <i class="fa-solid fa-chevron-right"></i>
        </button>
        <div class="find-controls">
            <div class="find-row">
                <div class="find-field">
                    <input id="find-input" type="text" placeholder="Find" autocomplete="off" spellcheck="false">
                    <span id="find-count" class="find-count"></span>
                </div>
                <button class="find-opt" data-opt="case" title="Match Case">Aa</button>
                <button class="find-opt" data-opt="word" title="Match Whole Word">\\b</button>
                <button class="find-opt" data-opt="regex" title="Use Regular Expression">.*</button>
                <button id="find-prev" class="find-nav" title="Previous Match (Shift+Enter)"><i class="fa-solid fa-chevron-up"></i></button>
                <button id="find-next" class="find-nav" title="Next Match (Enter)"><i class="fa-solid fa-chevron-down"></i></button>
                <button id="find-close" class="find-nav" title="Close (Esc)"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="find-row find-replace-row">
                <div class="find-field">
                    <input id="replace-input" type="text" placeholder="Replace" autocomplete="off" spellcheck="false">
                </div>
                <button id="replace-one" class="find-nav" title="Replace"><i class="fa-solid fa-right-left"></i></button>
                <button id="replace-all" class="find-nav" title="Replace All"><i class="fa-solid fa-angles-right"></i></button>
            </div>
        </div>`;

    const wrapper = document.getElementById('editor-viewport-wrapper');
    wrapper.appendChild(widget);

    findInput = document.getElementById('find-input');
    replaceInput = document.getElementById('replace-input');
    countEl = document.getElementById('find-count');
    replaceRow = widget.querySelector('.find-replace-row');
    toggleReplaceBtn = document.getElementById('find-toggle-replace');

    // --- Widget event wiring ---------------------------------------------
    findInput.addEventListener('input', () => runSearch(true));

    findInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.shiftKey ? gotoMatch(currentIndex - 1) : gotoMatch(currentIndex + 1);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeFind();
        }
    });

    replaceInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.ctrlKey || e.metaKey ? replaceAll() : replaceCurrent();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeFind();
        }
    });

    document.getElementById('find-next').addEventListener('click', () => gotoMatch(currentIndex + 1));
    document.getElementById('find-prev').addEventListener('click', () => gotoMatch(currentIndex - 1));
    document.getElementById('find-close').addEventListener('click', closeFind);
    document.getElementById('replace-one').addEventListener('click', replaceCurrent);
    document.getElementById('replace-all').addEventListener('click', replaceAll);
    toggleReplaceBtn.addEventListener('click', () => setReplaceVisible(widget.classList.contains('find-collapsed-replace')));

    widget.querySelectorAll('.find-opt').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.opt;
            opts[key] = !opts[key];
            btn.classList.toggle('active', opts[key]);
            runSearch(true);
            findInput.focus();
        });
    });

    // --- Keep the highlight layer aligned with the editor ----------------
    editor.addEventListener('scroll', syncScroll);
    // Re-run search when the document changes while the widget is open so the
    // hit list / counter never point at stale offsets.
    editor.addEventListener('input', () => {
        if (isOpen() && !suppressInput) runSearch(false);
    });

    // Global shortcuts
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
            e.preventDefault();
            openFind(false);
        } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'r' || e.key.toLowerCase() === 'h')) {
            // Ctrl+R / Ctrl+H open Replace. preventDefault stops Ctrl+R reloading the app.
            e.preventDefault();
            openFind(true);
        }
    });
}

function isOpen() {
    return widget && !widget.classList.contains('find-hidden');
}

function setReplaceVisible(visible) {
    widget.classList.toggle('find-collapsed-replace', !visible);
    toggleReplaceBtn.querySelector('i').className = visible
        ? 'fa-solid fa-chevron-down'
        : 'fa-solid fa-chevron-right';
}

export function openFind(withReplace) {
    if (!widget) return;
    widget.classList.remove('find-hidden');
    setReplaceVisible(!!withReplace);

    // Seed the query with the current selection, if any.
    const sel = editor.value.substring(editor.selectionStart, editor.selectionEnd);
    if (sel && !sel.includes('\n')) {
        findInput.value = sel;
    }

    runSearch(true);
    findInput.focus();
    findInput.select();
}

export function closeFind() {
    if (!widget) return;
    widget.classList.add('find-hidden');
    matches = [];
    currentIndex = -1;
    searchLayer.innerHTML = '';
    editor.focus();
}

/**
 * Recompute matches for the current query.
 * @param {boolean} resetToNearest jump selection to the match nearest the caret
 */
function runSearch(resetToNearest) {
    const query = findInput.value;
    matches = [];
    currentIndex = -1;

    if (!query) {
        renderHighlights();
        updateCounter();
        return;
    }

    let regex;
    try {
        let pattern = opts.regex ? query : escapeRegExp(query);
        if (opts.word) pattern = `\\b${pattern}\\b`;
        regex = new RegExp(pattern, opts.case ? 'g' : 'gi');
    } catch (err) {
        // Invalid regex — show an error state rather than throwing.
        countEl.textContent = 'Bad pattern';
        widget.classList.add('find-error');
        searchLayer.innerHTML = '';
        return;
    }
    widget.classList.remove('find-error');

    const text = editor.value;
    let m;
    while ((m = regex.exec(text)) !== null) {
        matches.push({ start: m.index, end: m.index + m[0].length });
        if (m[0].length === 0) regex.lastIndex++; // avoid zero-width infinite loop
        if (matches.length >= MAX_MATCHES) break;
    }

    if (matches.length > 0) {
        if (resetToNearest) {
            const caret = editor.selectionStart;
            let idx = matches.findIndex(mm => mm.start >= caret);
            currentIndex = idx === -1 ? 0 : idx;
        } else {
            currentIndex = Math.min(Math.max(currentIndex, 0), matches.length - 1);
        }
    }

    renderHighlights();
    updateCounter();
    if (currentIndex >= 0) scrollToMatch(matches[currentIndex]);
}

function gotoMatch(index) {
    if (matches.length === 0) return;
    currentIndex = ((index % matches.length) + matches.length) % matches.length;
    renderHighlights();
    updateCounter();
    scrollToMatch(matches[currentIndex]);
}

function updateCounter() {
    if (!findInput.value) {
        countEl.textContent = '';
    } else if (matches.length === 0) {
        countEl.textContent = 'No results';
    } else {
        const shown = matches.length >= MAX_MATCHES ? `${MAX_MATCHES}+` : matches.length;
        countEl.textContent = `${currentIndex + 1} of ${shown}`;
    }
}

/** Paint the transparent highlight layer with <mark> spans over each hit. */
function renderHighlights() {
    if (matches.length === 0) {
        searchLayer.innerHTML = '';
        return;
    }
    const text = editor.value;
    let html = '';
    let cursor = 0;
    for (let i = 0; i < matches.length; i++) {
        const { start, end } = matches[i];
        html += escapeHTML(text.slice(cursor, start));
        const cls = i === currentIndex ? 'search-hit current' : 'search-hit';
        html += `<mark class="${cls}">${escapeHTML(text.slice(start, end))}</mark>`;
        cursor = end;
    }
    html += escapeHTML(text.slice(cursor));
    searchLayer.innerHTML = html;
    syncScroll();
}

function syncScroll() {
    if (!searchLayer) return;
    searchLayer.scrollTop = editor.scrollTop;
    searchLayer.scrollLeft = editor.scrollLeft;
}

function measureCharWidth() {
    const probe = document.createElement('span');
    probe.textContent = 'MMMMMMMMMM';
    const cs = getComputedStyle(editor);
    probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font-family:${cs.fontFamily};font-size:${cs.fontSize};letter-spacing:${cs.letterSpacing};`;
    document.body.appendChild(probe);
    charWidth = probe.getBoundingClientRect().width / 10 || charWidth;
    probe.remove();
}

/** Select the match in the textarea and scroll it into view. */
function scrollToMatch(match) {
    if (!match) return;

    // Select the range so the caret lands here once the widget is dismissed.
    editor.setSelectionRange(match.start, match.end);

    const before = editor.value.slice(0, match.start);
    const line = (before.match(/\n/g) || []).length;
    const targetTop = PAD_TOP + line * LINE_HEIGHT;

    const viewTop = editor.scrollTop;
    const viewH = editor.clientHeight;
    if (targetTop < viewTop + LINE_HEIGHT || targetTop > viewTop + viewH - LINE_HEIGHT) {
        editor.scrollTop = Math.max(0, targetTop - viewH / 2);
    }

    // Horizontal: keep the match column visible.
    if (charWidth <= 1) measureCharWidth();
    const col = match.start - (before.lastIndexOf('\n') + 1);
    const targetLeft = col * charWidth;
    const viewLeft = editor.scrollLeft;
    const viewW = editor.clientWidth;
    if (targetLeft < viewLeft + 40 || targetLeft > viewLeft + viewW - 60) {
        editor.scrollLeft = Math.max(0, targetLeft - viewW / 2);
    }

    syncScroll();
}

// Guards against our own programmatic edits re-triggering runSearch mid-replace.
let suppressInput = false;

/** Apply a new document value and notify the core editor via a synthetic input event. */
function commitEdit(newValue, caretStart, caretEnd) {
    suppressInput = true;
    editor.value = newValue;
    editor.setSelectionRange(caretStart, caretEnd);
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    suppressInput = false;
    hideProSense(); // the synthetic input can pop the autocomplete widget open
}

function replaceCurrent() {
    if (currentIndex < 0 || currentIndex >= matches.length) return;
    const match = matches[currentIndex];
    const text = editor.value;
    const replacement = replaceInput.value;

    const newValue = text.slice(0, match.start) + replacement + text.slice(match.end);
    commitEdit(newValue, match.start + replacement.length, match.start + replacement.length);

    // Re-search, then advance to the next hit at/after the edit point.
    runSearch(false);
    if (matches.length > 0) {
        const editPoint = match.start + replacement.length;
        let idx = matches.findIndex(mm => mm.start >= editPoint);
        currentIndex = idx === -1 ? 0 : idx;
        renderHighlights();
        updateCounter();
        scrollToMatch(matches[currentIndex]);
    }
    findInput.focus();
}

function replaceAll() {
    if (matches.length === 0) return;
    const text = editor.value;
    const replacement = replaceInput.value;

    // Rebuild the document in one pass so a single edit event covers everything.
    let out = '';
    let cursor = 0;
    for (const match of matches) {
        out += text.slice(cursor, match.start) + replacement;
        cursor = match.end;
    }
    out += text.slice(cursor);

    const count = matches.length;
    commitEdit(out, out.length, out.length);
    runSearch(false);
    countEl.textContent = `Replaced ${count}`;
    findInput.focus();
}
