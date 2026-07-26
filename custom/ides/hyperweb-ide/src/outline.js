/**
 * HyperWeb "Structure" outline — a right-dock tool window.
 *
 * A lightweight symbol view for the active HTML / CSS / JavaScript file: parses the
 * current buffer into a clickable tree of tags, selectors or functions and jumps the
 * editor to the matching line. Rebuilds itself on tab focus and (debounced) edits.
 *
 * It is intentionally a single-pass, regex-driven parser — no AST — so it stays cheap
 * and dependency-free, matching the rest of the IDE. That means it is approximate on
 * pathological input, which is fine for a navigation aid.
 */

const VOID_TAGS = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

/** 1-based line number for a character offset. */
function lineAt(text, index) {
    let line = 1;
    for (let i = 0; i < index && i < text.length; i++) {
        if (text[i] === '\n') line++;
    }
    return line;
}

/** Extracts a `#id.class` suffix from a tag's attribute string. */
function tagQualifier(attrs) {
    let out = '';
    const idMatch = /\bid\s*=\s*["']([^"']+)["']/i.exec(attrs);
    if (idMatch) out += `#${idMatch[1]}`;
    const classMatch = /\bclass\s*=\s*["']([^"']+)["']/i.exec(attrs);
    if (classMatch) {
        const first = classMatch[1].trim().split(/\s+/)[0];
        if (first) out += `.${first}`;
    }
    return out;
}

/** HTML → indented tag tree. Comments/scripts are skipped for tag-depth purposes. */
export function parseHtml(text) {
    const symbols = [];
    let depth = 0;
    const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
    let m;
    while ((m = tagRe.exec(text)) !== null) {
        const raw = m[0];
        const tag = m[1].toLowerCase();
        const attrs = m[2] || '';
        const selfClosed = m[3] === '/';
        const isClosing = raw[1] === '/';

        if (isClosing) {
            depth = Math.max(0, depth - 1);
            continue;
        }

        const label = tag + tagQualifier(attrs);
        symbols.push({ label, line: lineAt(text, m.index), depth, icon: 'fa-solid fa-code' });

        if (!selfClosed && !VOID_TAGS.has(tag)) depth++;
    }
    return symbols;
}

/** CSS/SCSS/LESS → flat list of rule selectors. */
export function parseCss(text) {
    const symbols = [];
    // Strip comments so `{` inside them can't open a phantom rule.
    const cleaned = text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
    const ruleRe = /([^{}();@]+?)\{/g;
    let m;
    while ((m = ruleRe.exec(cleaned)) !== null) {
        const selector = m[1].replace(/\s+/g, ' ').trim();
        if (!selector) continue;
        symbols.push({ label: selector, line: lineAt(cleaned, m.index), depth: 0, icon: 'fa-solid fa-hashtag' });
    }
    // Also surface @-rules (media, keyframes…) which the rule regex skips.
    const atRe = /@([a-zA-Z-]+)([^{;]*)[{;]/g;
    while ((m = atRe.exec(cleaned)) !== null) {
        symbols.push({
            label: `@${m[1]}${m[2].replace(/\s+/g, ' ').trimEnd()}`.trim(),
            line: lineAt(cleaned, m.index), depth: 0, icon: 'fa-solid fa-at'
        });
    }
    return symbols.sort((a, b) => a.line - b.line);
}

/**
 * Blanks out comments and string/template literals — replacing their bodies with spaces
 * of the same length (newlines kept) so offsets still line up with the original text.
 * Lets the symbol regexes run without matching keywords or braces that live inside a
 * string or comment, and makes the brace-depth count below trustworthy.
 */
function maskLiterals(text) {
    const out = [];
    const n = text.length;
    let i = 0;
    while (i < n) {
        const c = text[i], c2 = text[i + 1];
        if (c === '/' && c2 === '/') {                       // line comment
            while (i < n && text[i] !== '\n') { out.push(' '); i++; }
            continue;
        }
        if (c === '/' && c2 === '*') {                       // block comment
            out.push(' ', ' '); i += 2;
            while (i < n && !(text[i] === '*' && text[i + 1] === '/')) {
                out.push(text[i] === '\n' ? '\n' : ' '); i++;
            }
            if (i < n) { out.push(' ', ' '); i += 2; }
            continue;
        }
        if (c === '"' || c === "'" || c === '`') {           // string / template literal
            const quote = c;
            out.push(' '); i++;
            while (i < n && text[i] !== quote) {
                if (text[i] === '\\') {                       // keep escapes from ending it early
                    out.push(' '); i++;
                    if (i < n) { out.push(text[i] === '\n' ? '\n' : ' '); i++; }
                    continue;
                }
                out.push(text[i] === '\n' ? '\n' : ' '); i++;
            }
            if (i < n) { out.push(' '); i++; }
            continue;
        }
        out.push(c); i++;
    }
    return out.join('');
}

// Line-start words that look like a method (`name(...) {`) but are control flow, not defs.
const JS_NON_METHODS = new Set([
    'if', 'for', 'while', 'switch', 'catch', 'with', 'do', 'return',
    'else', 'function', 'try', 'finally', 'class', 'await', 'yield'
]);

/**
 * JavaScript → classes, functions, class/object methods, getters/setters and assigned
 * arrows. Regex-driven and single-pass (no AST), so it is approximate on pathological
 * input — fine for a navigation aid. Nesting depth comes from real brace counting, so
 * methods indent under their class or object.
 */
export function parseJs(text) {
    const src = maskLiterals(text);

    // Prefix brace depth: depthByOffset[i] is how many `{` are open just before offset i.
    const depthByOffset = new Array(src.length + 1);
    let depth = 0;
    for (let i = 0; i < src.length; i++) {
        depthByOffset[i] = depth;
        const ch = src[i];
        if (ch === '{') depth++;
        else if (ch === '}') depth = Math.max(0, depth - 1);
    }
    depthByOffset[src.length] = depth;

    const symbols = [];
    const add = (name, index, icon) => {
        symbols.push({ label: name, line: lineAt(src, index), depth: depthByOffset[index] || 0, icon });
    };

    const patterns = [
        // class Foo   /   export default class Foo
        { re: /\bclass\s+([A-Za-z_$][\w$]*)/g, icon: 'fa-solid fa-cube' },
        // function foo(   /   async function* foo(
        { re: /\b(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g, icon: 'fa-solid fa-bolt' },
        // const/let/var foo = function | (…) => | x =>
        {
            re: /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g,
            icon: 'fa-solid fa-bolt'
        },
        // Object-literal function properties:  foo: function | foo: (…) => | foo: async x =>
        {
            re: /([A-Za-z_$][\w$]*)\s*:\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g,
            icon: 'fa-solid fa-bolt'
        }
    ];
    patterns.forEach(({ re, icon }) => {
        let m;
        while ((m = re.exec(src)) !== null) add(m[1], m.index, icon);
    });

    // Method shorthand / class methods — the big win over the old parser. Anchored to the
    // start of a line so calls like `this.foo()` and `bar()` mid-expression don't match;
    // control-flow words that share the `name(...) {` shape are filtered out.
    const methodRe = /^[ \t]*(?:static\s+)?(?:async\s+)?(?:(get|set)\s+)?\*?\s*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/gm;
    let mm;
    while ((mm = methodRe.exec(src)) !== null) {
        const name = mm[2];
        if (JS_NON_METHODS.has(name)) continue;
        add(mm[1] ? `${mm[1]} ${name}` : name, mm.index, 'fa-solid fa-bolt');
    }

    if (symbols.length === 0) return symbols;

    // Re-base indentation so top-level symbols sit flush even if the whole file is wrapped
    // (an IIFE or module closure would otherwise push everything in by one level).
    const baseDepth = symbols.reduce((min, s) => Math.min(min, s.depth), Infinity);

    // De-dupe symbols landing on the same line+name (patterns can overlap).
    const seen = new Set();
    return symbols
        .map(s => ({ ...s, depth: s.depth - baseDepth }))
        .sort((a, b) => a.line - b.line || a.depth - b.depth)
        .filter(s => { const k = `${s.line}:${s.label}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

/** Picks a parser from a lowercased file extension. Returns null for unsupported types. */
export function parseByLanguage(langId, text) {
    if (langId === 'html' || langId === 'htm') return parseHtml(text);
    if (['css', 'scss', 'less'].includes(langId)) return parseCss(text);
    if (['js', 'mjs', 'cjs', 'jsx'].includes(langId)) return parseJs(text);
    return null;
}

/**
 * Registers the Structure panel on the right dock. `ctx` is the IDE activation context.
 */
export function registerOutlinePanel(ctx) {
    ctx.registerRightPanel('hyperweb-outline', {
        title: 'Structure',
        // fa-list-tree is Font Awesome *Pro* only; the app loads FA 6 Free, where that
        // class has no glyph and the toggle button renders invisible. fa-sitemap is Free.
        iconClass: 'fa-solid fa-sitemap',
        render: (container) => {
            container.innerHTML = `
                <div class="hw-outline">
                    <div class="hw-outline-status"></div>
                    <div class="hw-outline-list"></div>
                </div>`;
            const statusEl = container.querySelector('.hw-outline-status');
            const listEl = container.querySelector('.hw-outline-list');

            const rebuild = () => {
                // If the host rebuilt the dock, this container is detached — the live one
                // has its own subscription, so this stale handler is a cheap no-op.
                if (!container.isConnected) return;
                const file = ctx.editor.getActiveFile();
                const langId = (ctx.editor.getLanguageId() || '').toLowerCase();
                const text = ctx.editor.getText() || '';

                if (!file) {
                    statusEl.textContent = 'Open a file to see its structure.';
                    listEl.innerHTML = '';
                    return;
                }

                const symbols = parseByLanguage(langId, text);
                if (symbols === null) {
                    statusEl.textContent = `No structure view for ".${langId || '?'}" files.`;
                    listEl.innerHTML = '';
                    return;
                }
                if (symbols.length === 0) {
                    statusEl.textContent = `${file.name} — nothing to outline yet.`;
                    listEl.innerHTML = '';
                    return;
                }

                statusEl.textContent = `${file.name} · ${symbols.length} item${symbols.length === 1 ? '' : 's'}`;
                listEl.innerHTML = '';
                symbols.forEach((sym) => {
                    const row = document.createElement('button');
                    row.type = 'button';
                    row.className = 'hw-outline-item';
                    row.style.paddingLeft = `${8 + Math.min(sym.depth, 12) * 12}px`;
                    row.title = `Line ${sym.line}`;
                    row.innerHTML =
                        `<i class="${sym.icon}"></i>` +
                        `<span class="hw-outline-label"></span>` +
                        `<span class="hw-outline-line">${sym.line}</span>`;
                    row.querySelector('.hw-outline-label').textContent = sym.label;
                    row.addEventListener('click', () => ctx.editor.goToLine(sym.line));
                    listEl.appendChild(row);
                });
            };

            rebuild();
            // Refresh on tab focus and on (debounced) edits — both events carry the buffer.
            ctx.on('file-opened', rebuild);
            ctx.on('content-changed', rebuild);
        }
    });

    // Scoped styling — torn down with the IDE via ctx.injectCSS's disposable.
    ctx.injectCSS(`
        .hw-outline { display: flex; flex-direction: column; gap: 8px; }
        .hw-outline-status {
            font-size: 11px; color: var(--text-muted); letter-spacing: 0.3px;
            padding-bottom: 6px; border-bottom: 1px solid var(--border-color);
        }
        .hw-outline-list { display: flex; flex-direction: column; }
        .hw-outline-item {
            display: flex; align-items: center; gap: 8px; width: 100%;
            background: none; border: none; text-align: left; cursor: pointer;
            color: var(--text-main); font-family: var(--font-ui); font-size: 12.5px;
            padding: 4px 8px; border-radius: 4px;
        }
        .hw-outline-item:hover { background: rgba(125, 125, 125, 0.12); }
        .hw-outline-item i { font-size: 11px; color: var(--accent-color); width: 14px; text-align: center; flex-shrink: 0; }
        .hw-outline-label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .hw-outline-line { font-size: 10px; color: var(--text-muted); font-family: var(--font-code); flex-shrink: 0; }
    `);
}
