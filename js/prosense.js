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

    editorEl.value = text.substring(0, start) + item.insertText + text.substring(end);

    let newCursorPos = start + item.insertText.length;
    if (item.insertText.endsWith('()')) {
        newCursorPos -= 1; 
    } else if (item.insertText.endsWith('{}')) {
        newCursorPos -= 1;
    } else if (item.insertText.endsWith('[]')) {
        newCursorPos -= 1;
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
    if (!marker || !editorEl) return;

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

    filteredList.forEach((item, idx) => {
        const li = document.createElement('li');
        li.className = `prosense-item ${idx === activeIndex ? 'active' : ''}`;

        const meta = TYPE_META[item.type] || DEFAULT_TYPE_META;
        const typeIcon = `<i class="fa-solid ${meta.icon}" style="color: ${meta.color}; font-size: 11px;"></i>`;

        li.innerHTML = `<span class="prosense-type-icon">${typeIcon}</span> <span class="prosense-label">${item.label}</span>`;
        
        li.addEventListener('click', () => {
            insertSelection(item);
        });
        ul.appendChild(li);
    });

    prosenseEl.appendChild(ul);
    prosenseEl.classList.remove('prosense-hidden');
    isOpen = true;

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

    for (let li = 0; li < l.length && qi < q.length; li++) {
        if (l[li] === q[qi]) {
            if (firstIdx === -1) firstIdx = li;
            streak++;
            score += 8 + streak * 2; 
            const prev = label[li - 1];
            const isBoundary = li === 0 || prev === '_' ||
                (label[li] >= 'A' && label[li] <= 'Z' && prev >= 'a' && prev <= 'z');
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

function evaluateProSense(fileName) {
    if (!editorEl) return;

    const ext = fileName ? fileName.split('.').pop().toLowerCase() : '';
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
    if (!word || completions.length === 0) {
        hideProSense();
        return;
    }

    const wordLower = word.toLowerCase();
    if (completions.some(item => item.label.toLowerCase() === wordLower)) {
        hideProSense();
        return;
    }

    const cursor = editorEl.selectionStart;
    const charBefore = editorEl.value[cursor - word.length - 1];
    const isMemberAccess = charBefore === '.';

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