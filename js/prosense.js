import { api } from './api-core.js';
import { getCustomSnippets } from './snippets.js';

let prosenseEl = null;
let editorEl = null;
let surfaceEl = null;
let activeIndex = 0;
let filteredList = [];
let isOpen = false;
let delayTimeout = null;
let latestExtraBuffers = [];

const TYPE_META = {
    tag:       { icon: 'fa-code',    color: '#e34c26' },
    attribute: { icon: 'fa-cube',    color: '#2196f3' },
    property:  { icon: 'fa-wrench',  color: '#4caf50' },
    variable:  { icon: 'fa-cube',    color: '#9c27b0' },
    class:     { icon: 'fa-shapes',  color: '#ff9800' },
    function:  { icon: 'fa-bolt',    color: '#ffeb3b' },
    keyword:   { icon: 'fa-key',     color: '#569cd6' },
    snippet:   { icon: 'fa-scroll',  color: '#c586c0' }
};
const DEFAULT_TYPE_META = { icon: 'fa-bolt', color: '#ffeb3b' };

const SOURCE_BOOST = { local: 220, custom: 150, db: 0, extern: -90 };

function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Wraps the subsequence of `label` characters that fuzzy-match `query`
 * in highlight spans so the user can see why an entry ranked (Added Fix).
 */
function highlightLabel(label, query) {
    if (!query) return escHtml(label);
    const q = query.toLowerCase();
    const l = label.toLowerCase();
    let qi = 0;
    let out = '';
    for (let i = 0; i < label.length; i++) {
        if (qi < q.length && l[i] === q[qi]) {
            out += `<span class="prosense-match">${escHtml(label[i])}</span>`;
            qi++;
        } else {
            out += escHtml(label[i]);
        }
    }
    return out;
}

function getUsageMap() {
    try {
        return JSON.parse(localStorage.getItem('prosense-usage') || '{}');
    } catch (e) {
        return {};
    }
}
function recordUsage(label) {
    const map = getUsageMap();
    map[label] = (map[label] || 0) + 1;
    try { localStorage.setItem('prosense-usage', JSON.stringify(map)); } catch (e) { /* ignore */ }
}

export function initProSense(editor, surface) {
    editorEl = editor;
    surfaceEl = surface;

    prosenseEl = document.createElement('div');
    prosenseEl.id = 'prosense-widget';
    prosenseEl.className = 'prosense-hidden';
    surfaceEl.appendChild(prosenseEl);

    document.addEventListener('click', (e) => {
        if (!prosenseEl.contains(e.target) && e.target !== editorEl) {
            hideProSense();
        }
    });
}

export function hideProSense() {
    if (prosenseEl) {
        prosenseEl.classList.add('prosense-hidden');
    }
    isOpen = false;
    filteredList = [];
    activeIndex = 0;
    if (delayTimeout) clearTimeout(delayTimeout);
}

function insertSelection(item) {
    const word = getWordBeforeCursor();
    const cursor = editorEl.selectionStart;
    const start = cursor - word.length;
    const end = cursor;
    const text = editorEl.value;

    // Explicit cursor placeholder: an insertText may contain a single `$0`
    // marker to say exactly where the caret should land after insertion.
    let insertText = item.insertText;
    let caretOffset = -1;
    const placeholderIdx = insertText.indexOf('$0');
    if (placeholderIdx !== -1) {
        caretOffset = placeholderIdx;
        insertText = insertText.slice(0, placeholderIdx) + insertText.slice(placeholderIdx + 2);
    }

    editorEl.value = text.substring(0, start) + insertText + text.substring(end);

    let newCursorPos;
    if (caretOffset !== -1) {
        newCursorPos = start + caretOffset;
    } else {
        newCursorPos = start + insertText.length;
        // Heuristic: drop the caret inside a trailing empty pair so the user
        // can keep typing arguments/contents right away.
        if (/(\(\)|\{\}|\[\]|""|'')$/.test(insertText)) {
            newCursorPos -= 1;
        }
    }
    editorEl.selectionStart = editorEl.selectionEnd = newCursorPos;

    recordUsage(item.label);
    hideProSense();
    editorEl.dispatchEvent(new Event('input'));
    editorEl.focus();
}

export function getWordBeforeCursor() {
    if (!editorEl) return '';
    const text = editorEl.value;
    const cursorIndex = editorEl.selectionStart;
    const leftText = text.substring(0, cursorIndex);
    const match = leftText.match(/[\w-]*$/);
    return match ? match[0] : '';
}

function updateWidgetPosition() {
    const marker = document.getElementById('prosense-caret-marker');
    if (!marker || !editorEl) {
        return;
    }

    const rect = marker.getBoundingClientRect();
    const editorRect = editorEl.getBoundingClientRect();

    let top = rect.bottom - editorRect.top;
    const left = rect.left - editorRect.left;

    const widgetHeight = prosenseEl.offsetHeight || 140;
    const spaceBelow = editorRect.bottom - rect.bottom;

    if (spaceBelow < widgetHeight && (rect.top - editorRect.top) > widgetHeight) {
        top = (rect.top - editorRect.top) - widgetHeight - 4;
    }

    prosenseEl.style.top = `${top}px`;
    prosenseEl.style.left = `${left}px`;
}

function renderWidget() {
    if (filteredList.length === 0) {
        hideProSense();
        return;
    }
    prosenseEl.innerHTML = '';
    const ul = document.createElement('ul');
    const word = getWordBeforeCursor();

    filteredList.forEach((item, idx) => {
        const li = document.createElement('li');
        li.className = `prosense-item ${idx === activeIndex ? 'active' : ''}`;

        const meta = TYPE_META[item.type] || DEFAULT_TYPE_META;
        const typeIcon = `<i class="fa-solid ${meta.icon}" style="color: ${meta.color}; font-size: 11px;"></i>`;

        // Prefer an explicit `detail` (e.g. a signature hint) over the raw type name.
        const detailText = item.detail || item.type || '';

        li.innerHTML =
            `<span class="prosense-type-icon">${typeIcon}</span>` +
            `<span class="prosense-label">${highlightLabel(item.label, word)}</span>` +
            `<span class="prosense-detail">${escHtml(detailText)}</span>`;

        li.addEventListener('click', () => {
            insertSelection(item);
        });
        ul.appendChild(li);
    });

    prosenseEl.appendChild(ul);
    prosenseEl.classList.remove('prosense-hidden');
    isOpen = true;

    // Keep the active row within the scroll viewport during keyboard navigation (Added Fix)
    const activeLi = ul.children[activeIndex];
    if (activeLi) {
        const liTop = activeLi.offsetTop;
        const liBottom = liTop + activeLi.offsetHeight;
        if (liTop < prosenseEl.scrollTop) {
            prosenseEl.scrollTop = liTop;
        } else if (liBottom > prosenseEl.scrollTop + prosenseEl.clientHeight) {
            prosenseEl.scrollTop = liBottom - prosenseEl.clientHeight;
        }
    }

    updateWidgetPosition();
}

export function handleProSenseKeydown(e) {
    if (!isOpen || filteredList.length === 0) return false;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % filteredList.length;
        renderWidget();
        return true;
    }
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + filteredList.length) % filteredList.length;
        renderWidget();
        return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertSelection(filteredList[activeIndex]);
        return true;
    }
    if (e.key === 'Escape') {
        e.preventDefault();
        hideProSense();
        return true;
    }

    return false;
}

function extractFileIdentifiers(text, parserType, sourceTag = 'local') {
    const rules = api.languages.getParserRules(parserType);
    if (!rules) return [];

    const identifiers = [];
    const seen = new Set();

    for (const rule of rules) {
        const re = new RegExp(rule.regex.source, rule.regex.flags);
        let match;
        while ((match = re.exec(text)) !== null) {
            const name = match[rule.group];
            if (!name || seen.has(name)) continue;
            if (rule.exclude && rule.exclude.includes(name)) continue;
            seen.add(name);
            identifiers.push({
                label: name,
                insertText: name + (rule.insertSuffix || ''),
                type: rule.type,
                source: sourceTag
            });
        }
    }

    return identifiers;
}

function scoreMatch(label, query) {
    if (!query) return 0;
    const l = label.toLowerCase();
    const q = query.toLowerCase();

    if (l === q) return 1000;
    if (l.startsWith(q)) return 600 - (label.length - query.length);

    let score = 0;
    let qi = 0;
    let streak = 0;
    let firstIdx = -1;

    for (let l_idx = 0; l_idx < l.length && qi < q.length; l_idx++) {
        if (l[l_idx] === q[qi]) {
            if (firstIdx === -1) firstIdx = l_idx;
            streak++;
            score += 8 + streak * 2; 
            const prev = label[l_idx - 1];
            const isBoundary = l_idx === 0 || prev === '_' ||
                (label[l_idx] >= 'A' && label[l_idx] <= 'Z' && prev >= 'a' && prev <= 'z');
            if (isBoundary) score += 14;
            qi++;
        } else {
            streak = 0;
        }
    }

    if (qi < q.length) return null; 
    score -= firstIdx;                     
    score -= (label.length - query.length) * 0.5; 
    return score;
}

/**
 * Sub-Language Context Tracker:
 * Checks if the cursor is typing inside a script or style block.
 */
function getHtmlContext(text, cursorIndex) {
    const styleStart = text.toLowerCase().lastIndexOf('<style', cursorIndex);
    const scriptStart = text.toLowerCase().lastIndexOf('<script', cursorIndex);
    
    if (styleStart !== -1 || scriptStart !== -1) {
        if (styleStart > scriptStart) {
            const styleEnd = text.toLowerCase().lastIndexOf('</style>', cursorIndex);
            if (styleEnd === -1 || styleEnd < styleStart) {
                return 'css'; 
            }
        } else {
            const scriptEnd = text.toLowerCase().lastIndexOf('</script>', cursorIndex);
            if (scriptEnd === -1 || scriptEnd < scriptStart) {
                return 'js'; // Returns 'js' to match the active registry keys correctly
            }
        }
    }
    return 'html';
}

function evaluateProSense(fileName, manual = false) {
    if (!editorEl) return;

    let ext = fileName ? fileName.split('.').pop().toLowerCase() : '';
    
    if (ext === 'html' || ext === 'htm') {
        const cursor = editorEl.selectionStart;
        const subContext = getHtmlContext(editorEl.value, cursor);
        if (subContext !== 'html') {
            ext = subContext; 
        }
    }

    const config = api.languages.get(ext);
    
    if (!config) {
        hideProSense();
        return;
    }

    const localCompletions = extractFileIdentifiers(editorEl.value, config.parser, 'local');
    const externCompletions = [];
    const localLabels = new Set(localCompletions.map(c => c.label));
    for (const buf of latestExtraBuffers) {
        for (const item of extractFileIdentifiers(buf, config.parser, 'extern')) {
            if (!localLabels.has(item.label)) externCompletions.push(item);
        }
    }

    const customSnippets = getCustomSnippets()
        .filter(s => s.lang === 'all' || s.lang === ext)
        .map(s => ({ label: s.trigger, insertText: s.body, type: 'snippet', source: 'custom' }));

    const dbCompletions = config.db.map(c => ({ ...c, source: c.source || 'db' }));
    const completions = [...dbCompletions, ...localCompletions, ...externCompletions, ...customSnippets];

    const word = getWordBeforeCursor();
    const cursor = editorEl.selectionStart;
    const charBefore = editorEl.value[cursor - word.length - 1];
    const isMemberAccess = charBefore === '.';
    
    // Allow empty words if we are right after a dot (member access context),
    // or if the popup was explicitly requested via a manual trigger (Ctrl+Space).
    if ((!word && !isMemberAccess && !manual) || completions.length === 0) {
        hideProSense();
        return;
    }

    const wordLower = word.toLowerCase();
    // Only verify exact matching constraints if a word is typed (skipped for manual triggers)
    if (!manual && word && completions.some(item => item.label.toLowerCase() === wordLower)) {
        hideProSense();
        return;
    }

    const usage = getUsageMap();

    filteredList = completions
        .map(item => {
            const base = scoreMatch(item.label, word);
            if (base === null) return null;
            let score = base + (SOURCE_BOOST[item.source] || 0);
            score += (usage[item.label] || 0) * 8; 
            if (isMemberAccess) {
                if (item.type === 'keyword') score -= 800;
                else if (['function', 'property', 'variable'].includes(item.type)) score += 40;
            }
            return { item, score };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score)
        .slice(0, 50)
        .map(entry => entry.item);

    if (filteredList.length === 0) {
        hideProSense();
        return;
    }

    if (activeIndex >= filteredList.length) activeIndex = 0;

    renderWidget();
}

export function handleProSenseInput(fileName, extraBuffers = []) {
    if (delayTimeout) clearTimeout(delayTimeout);

    if (localStorage.getItem('prosense-enabled') === 'false') {
        hideProSense();
        return;
    }

    latestExtraBuffers = extraBuffers;

    delayTimeout = setTimeout(() => {
        evaluateProSense(fileName);
    }, 180);
}

/**
 * Manually force-opens the completion popup (e.g. Ctrl+Space), bypassing the
 * input debounce and the "empty word" / "already exact" suppression guards.
 */
export function triggerProSense(fileName, extraBuffers = []) {
    if (!editorEl) return;
    if (localStorage.getItem('prosense-enabled') === 'false') {
        hideProSense();
        return;
    }
    if (delayTimeout) clearTimeout(delayTimeout);
    latestExtraBuffers = extraBuffers;
    evaluateProSense(fileName, true);
}