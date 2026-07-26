/**
 * HyperWeb IDE syntax models.
 *
 * The editor resolves highlighters by language id, and HTML files additionally pull
 * the 'css' and 'javascript' models for their <style> and <script> blocks — so all
 * three must be registered for embedded highlighting to work.
 *
 * Two constraints shape every rule below:
 *
 *  1. `registerHighlighter` concatenates all rules into ONE alternation regex, wrapping
 *     each rule in a single capture group. A capturing group inside a rule shifts the
 *     group indexes and silently mis-labels every token after it — so all inner groups
 *     must be non-capturing `(?:…)`. Flags are dropped too (only the source is kept),
 *     which is why case-insensitivity is spelled out rather than passed as /i.
 *  2. The regex engine scans left to right, so the EARLIEST match wins regardless of
 *     rule order; order only breaks ties between rules matching at the same offset.
 *     Several orderings below exist purely to win those ties — they are marked.
 *
 * Anything left unmatched is re-tokenized by the editor's generic fallback model
 * (js/syntax.js), which reads `#…` and `--…` as line comments. Rules that exist only
 * to keep those characters away from the fallback are marked "fallback guard".
 */

import { inheritDb } from './registry-guard.js';

// ---------------------------------------------------------------------------
//  Word lists
// ---------------------------------------------------------------------------

const HTML_TAGS = [
    'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio', 'b', 'base', 'bdi', 'bdo',
    'blockquote', 'body', 'br', 'button', 'canvas', 'caption', 'cite', 'code', 'col',
    'colgroup', 'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'div', 'dl',
    'dt', 'em', 'embed', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2',
    'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup', 'hr', 'html', 'i', 'iframe', 'img',
    'input', 'ins', 'kbd', 'label', 'legend', 'li', 'link', 'main', 'map', 'mark', 'menu',
    'meta', 'meter', 'nav', 'noscript', 'object', 'ol', 'optgroup', 'option', 'output', 'p',
    'param', 'picture', 'pre', 'progress', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'script',
    'search', 'section', 'select', 'slot', 'small', 'source', 'span', 'strong', 'style',
    'sub', 'summary', 'sup', 'svg', 'table', 'tbody', 'td', 'template', 'textarea', 'tfoot',
    'th', 'thead', 'time', 'title', 'tr', 'track', 'u', 'ul', 'var', 'video', 'wbr'
].join('|');

// Selectors only — `var` is deliberately absent so `var(--x)` reads as a CSS function.
const CSS_ELEMENTS = [
    'html', 'body', 'div', 'span', 'p', 'a', 'button', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'section', 'header', 'footer', 'nav', 'aside',
    'main', 'article', 'figure', 'figcaption', 'img', 'picture', 'video', 'audio', 'canvas',
    'svg', 'path', 'input', 'textarea', 'select', 'option', 'form', 'label', 'fieldset',
    'legend', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'pre', 'code',
    'blockquote', 'hr', 'br', 'em', 'strong', 'small', 'sub', 'sup', 'iframe', 'dialog',
    'details', 'summary', 'template', 'slot'
].join('|');

// `default` is excluded on purpose: `cursor: default` would otherwise read as a pseudo.
const CSS_PSEUDO = [
    'hover', 'focus', 'focus-within', 'focus-visible', 'active', 'visited', 'link',
    'any-link', 'target', 'target-text', 'root', 'scope', 'host', 'host-context', 'part',
    'slotted', 'defined', 'dir', 'lang', 'not', 'is', 'where', 'has',
    'first-child', 'last-child', 'only-child', 'nth-child', 'nth-last-child',
    'first-of-type', 'last-of-type', 'only-of-type', 'nth-of-type', 'nth-last-of-type',
    'empty', 'checked', 'disabled', 'enabled', 'indeterminate', 'required', 'optional',
    'valid', 'invalid', 'user-valid', 'user-invalid', 'in-range', 'out-of-range',
    'read-only', 'read-write', 'placeholder-shown', 'autofill', 'open', 'modal',
    'popover-open', 'before', 'after', 'first-line', 'first-letter', 'placeholder',
    'selection', 'marker', 'backdrop', 'cue', 'file-selector-button', 'highlight',
    'grammar-error', 'spelling-error', 'view-transition', 'view-transition-group',
    'view-transition-image-pair', 'view-transition-old', 'view-transition-new'
].join('|');

const CSS_VALUES = [
    'inherit', 'initial', 'unset', 'revert', 'revert-layer', 'none', 'auto', 'normal',
    'block', 'inline', 'inline-block', 'flex', 'inline-flex', 'grid', 'inline-grid',
    'contents', 'flow-root', 'table', 'table-cell', 'table-row', 'inline-table', 'list-item',
    'default',
    'absolute', 'relative', 'fixed', 'sticky', 'static',
    'solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'outset',
    'hidden', 'visible', 'scroll', 'clip', 'overlay',
    'bold', 'bolder', 'lighter', 'italic', 'oblique',
    'uppercase', 'lowercase', 'capitalize',
    'center', 'justify', 'space-between', 'space-around', 'space-evenly',
    'stretch', 'baseline', 'flex-start', 'flex-end',
    'wrap', 'nowrap', 'wrap-reverse', 'row', 'row-reverse', 'column', 'column-reverse',
    'border-box', 'content-box', 'padding-box', 'cover', 'contain',
    'repeat', 'no-repeat', 'repeat-x', 'repeat-y', 'round', 'space',
    'ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear', 'step-start', 'step-end',
    'infinite', 'alternate', 'alternate-reverse', 'forwards', 'backwards', 'both',
    'pointer', 'crosshair', 'move', 'grab', 'grabbing', 'not-allowed', 'text', 'wait',
    'transparent', 'currentColor', 'currentcolor',
    'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'gray', 'grey',
    'thin', 'thick', 'medium', 'small', 'large', 'larger', 'smaller',
    'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui'
].join('|');

const JS_KEYWORDS = [
    'as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'constructor',
    'continue', 'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends',
    'finally', 'for', 'from', 'function', 'get', 'if', 'import', 'in', 'instanceof', 'let',
    'new', 'of', 'return', 'set', 'static', 'super', 'switch', 'this', 'throw', 'try',
    'typeof', 'var', 'void', 'while', 'with', 'yield'
].join('|');

const JS_GLOBALS = [
    'console', 'document', 'window', 'globalThis', 'self', 'navigator', 'location',
    'history', 'screen', 'localStorage', 'sessionStorage', 'indexedDB', 'fetch', 'alert',
    'confirm', 'prompt', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
    'requestAnimationFrame', 'cancelAnimationFrame', 'queueMicrotask', 'structuredClone',
    'crypto', 'performance', 'customElements', 'process', 'module', 'exports', 'require',
    '__dirname', '__filename'
].join('|');

const JS_CONSTRUCTORS = [
    'Array', 'ArrayBuffer', 'BigInt', 'Boolean', 'DataView', 'Date', 'Error', 'EvalError',
    'RangeError', 'ReferenceError', 'SyntaxError', 'TypeError', 'URIError', 'Function',
    'Intl', 'JSON', 'Map', 'Math', 'Number', 'Object', 'Promise', 'Proxy', 'Reflect',
    'RegExp', 'Set', 'String', 'Symbol', 'WeakMap', 'WeakRef', 'WeakSet',
    'URL', 'URLSearchParams', 'FormData', 'Headers', 'Request', 'Response', 'AbortSignal',
    'AbortController', 'Blob', 'File', 'FileReader', 'Event', 'CustomEvent', 'EventTarget',
    'Node', 'Element', 'HTMLElement', 'ShadowRoot', 'DocumentFragment', 'DOMParser',
    'IntersectionObserver', 'MutationObserver', 'ResizeObserver', 'Worker', 'WebSocket',
    'Image', 'Audio', 'Uint8Array', 'Uint16Array', 'Uint32Array', 'Int8Array', 'Int16Array',
    'Int32Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'TextEncoder',
    'TextDecoder'
].join('|');

// ---------------------------------------------------------------------------
//  HTML
// ---------------------------------------------------------------------------

export const htmlRules = [
    { type: 'comment', regex: /<!--[\s\S]*?-->/ },
    { type: 'comment', regex: /<!\[CDATA\[[\s\S]*?\]\]>/ },
    { type: 'doctype', regex: /<!DOCTYPE[^>]*>|<!doctype[^>]*>/ },

    // &amp;  &#169;  &#x1F600;
    { type: 'escape', regex: /&(?:[a-zA-Z][a-zA-Z0-9]{1,30}|#\d{1,7}|#[xX][0-9a-fA-F]{1,6});/ },

    // Only quoted text that actually follows an `=` is an attribute value. Without the
    // lookbehind an apostrophe in prose ("It's fine") opens a string that runs to the
    // next apostrophe in the document.
    { type: 'attr-value', regex: /(?<==\s*)(?:"[^"]*"|'[^']*')/ },
    { type: 'attr-value', regex: /(?<==\s*)[^\s"'=<>`]+/ },

    // Behaviour reads differently from structure: inline handlers and the common
    // framework binding prefixes (Vue, Alpine, htmx, Angular) get keyword colouring.
    { type: 'keyword', regex: /\bon[a-z]{2,}(?=\s*=)/ },
    { type: 'keyword', regex: /(?<=[\s"'])(?:v-|x-|hx-|ng-|@|:|#)[a-zA-Z][a-zA-Z0-9.:_-]*(?=\s*=)/ },

    // Anchored to attribute position: without it, `<data-list>` would be read as a
    // data- attribute instead of a custom element.
    { type: 'variable', regex: /(?<=\s)(?:data|aria)-[a-zA-Z0-9_-]+(?=\s*=)/ },
    { type: 'attr-name', regex: /\b[a-zA-Z_][a-zA-Z0-9._:-]*(?=\s*=)/ },

    // Known elements first. The lookahead (rather than \b) stops `<data-list>` from
    // matching the known tag `data` and leaving `-list` unstyled.
    { type: 'tag-name', regex: new RegExp(`(?<=<\\/?)(?:${HTML_TAGS})(?=[\\s/>])`) },
    // Anything hyphenated is a custom element / web component.
    { type: 'class-name', regex: /(?<=<\/?)[a-zA-Z][a-zA-Z0-9]*-[a-zA-Z0-9-]*/ },
    { type: 'tag-name', regex: /(?<=<\/?)[a-zA-Z][a-zA-Z0-9:._-]*/ },

    { type: 'tag-bracket', regex: /<\/|\/>|[<>]/ },
    { type: 'punctuation', regex: /=/ },

    // Fallback guard: '#', '--' and '//' in text content ("Item #3", a bare URL) would
    // otherwise reach the generic model, which reads all three as the start of a line
    // comment and greys out the rest of the line.
    { type: 'punctuation', regex: /#|--+|\/\// }
];

// ---------------------------------------------------------------------------
//  CSS (also used for SCSS and LESS, best effort)
// ---------------------------------------------------------------------------

export const cssRules = [
    { type: 'comment', regex: /\/\*[\s\S]*?\*\// },
    { type: 'string', regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/ },

    { type: 'at-rule', regex: /@[a-zA-Z-]+/ },
    { type: 'important', regex: /!\s*important\b/ },

    // Custom properties, and SCSS/LESS variables
    { type: 'variable', regex: /--[a-zA-Z0-9_-]+/ },
    { type: 'variable', regex: /\$[a-zA-Z_][a-zA-Z0-9_-]*/ },

    // Colour literals before the id-selector rule, which would otherwise eat `#fff`
    { type: 'number', regex: /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/ },

    { type: 'selector', regex: /[.#][a-zA-Z_-][a-zA-Z0-9_-]*/ },
    { type: 'pseudo', regex: new RegExp(`::?(?:${CSS_PSEUDO})\\b`) },

    // Attribute selectors: [type="text"], [data-open]
    { type: 'attr-name', regex: /(?<=\[)[a-zA-Z_-][a-zA-Z0-9_-]*/ },

    // Ties at the same offset are resolved by the next three rules in this exact order:
    //   `var(`     -> function      (function wins because of the '(' lookahead)
    //   `a:hover`  -> selector      (selector wins over the property rule)
    //   `color:`   -> property      (no element named `color`, so it falls through)
    // `\b` cannot be used here: it never matches before the '-' of a vendor prefix, so
    // `-webkit-transform:` would lose its property colouring.
    { type: 'function', regex: /(?<![\w-])[a-zA-Z_-][a-zA-Z0-9_-]*(?=\()/ },
    { type: 'selector', regex: new RegExp(`(?<![\\w-])(?:${CSS_ELEMENTS})(?=[\\s.,:#\\[{>+~])`) },
    { type: 'property', regex: /(?<![\w-])[a-zA-Z_-][a-zA-Z0-9_-]*(?=\s*:)/ },

    { type: 'builtin', regex: new RegExp(`\\b(?:${CSS_VALUES})\\b`) },

    // Numbers keep their unit. The lookbehind stops the `1` of `h1` matching, and `%`
    // is spelled out because \b cannot follow a non-word character.
    { type: 'number', regex: /(?<![\w.-])-?(?:\d+(?:\.\d+)?|\.\d+)(?:%|[a-zA-Z]+)?/ },

    { type: 'bracket', regex: /[{}()[\]]/ },
    { type: 'operator', regex: /[~^|$*]?=|[>+~&*]/ },
    { type: 'punctuation', regex: /[;:,.!]/ }
];

// ---------------------------------------------------------------------------
//  JavaScript
// ---------------------------------------------------------------------------

export const jsRules = [
    { type: 'comment', regex: /^#!.*/ },
    { type: 'doc-comment', regex: /\/\*\*[\s\S]*?\*\// },
    { type: 'comment', regex: /\/\*[\s\S]*?\*\/|\/\/.*/ },

    // Template literals are matched whole — interpolations are not broken out.
    { type: 'string', regex: /`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/ },

    // A '/' only starts a regex where a value can legally begin, which the lookbehind
    // checks. That keeps `a / b`, `(x) / 2` and `x /= 2` as division.
    {
        type: 'regex',
        regex: /(?<=[=(,:\[!&|?{};+\-*%~^<>\n]\s*|\breturn\s+|\btypeof\s+)\/(?![*/])(?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\\n[])+\/[dgimsuvy]*/
    },

    // Fallback guard, and correct in its own right: #private class members.
    { type: 'variable', regex: /#[a-zA-Z_$][\w$]*/ },
    { type: 'builtin', regex: /@[a-zA-Z_$][\w$]*/ },

    // Member access is resolved before keywords so `map.get(k)` and `res.default`
    // are not repainted as the `get` / `default` keywords.
    { type: 'function', regex: /(?<=\.)[a-zA-Z_$][\w$]*(?=\s*\()/ },
    { type: 'property', regex: /(?<=\.)[a-zA-Z_$][\w$]*/ },

    { type: 'keyword', regex: new RegExp(`\\b(?:${JS_KEYWORDS})\\b`) },
    { type: 'keyword', regex: /\b(?:true|false|null|undefined|NaN|Infinity)\b/ },

    { type: 'builtin', regex: new RegExp(`\\b(?:${JS_GLOBALS})\\b`) },
    { type: 'class-name', regex: new RegExp(`\\b(?:${JS_CONSTRUCTORS})\\b`) },

    // SCREAMING_SNAKE constants, then any other PascalCase identifier
    { type: 'builtin', regex: /\b[A-Z_][A-Z0-9_]{2,}\b/ },
    { type: 'class-name', regex: /\b[A-Z][a-zA-Z0-9_$]*\b/ },

    // Numeric separators and BigInt suffixes included
    { type: 'number', regex: /\b(?:0[xX][0-9a-fA-F](?:_?[0-9a-fA-F])*|0[bB][01](?:_?[01])*|0[oO][0-7](?:_?[0-7])*|\d(?:_?\d)*(?:\.\d(?:_?\d)*)?(?:[eE][+-]?\d+)?)n?\b/ },

    { type: 'function', regex: /\b[a-zA-Z_$][\w$]*(?=\s*\()/ },

    // Object literal keys. Anchoring to '{', ',' or a line start keeps the middle
    // branch of a ternary (`cond ? a : b`) out of it.
    { type: 'property', regex: /(?<=[{,\n]\s*)[a-zA-Z_$][\w$]*(?=\s*:)/ },

    // Longest-first, so `===` is not split into `==` + `=`
    { type: 'operator', regex: /=>|\.{3}|\?\?=|\?\?|\?\.|===|!==|==|!=|<=|>=|&&=|\|\|=|&&|\|\||\*\*=|\*\*|\+\+|--|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|<<=|>>>=|>>=|>>>|>>|<<|[-+*/%!<>=&|^~]/ },
    { type: 'bracket', regex: /[{}()[\]]/ },
    { type: 'punctuation', regex: /[.,;:?]/ }
];

/**
 * Colours for the token types this IDE adds on top of the editor's built-in set.
 * Each falls back to a core token colour, so every theme stays coherent, while a
 * theme that wants finer control can define the `--syntax-hw-*` variables.
 */
export const tokenStyles = `
    .syntax-property    { color: var(--syntax-hw-property, var(--syntax-attr-name)); }
    .syntax-selector    { color: var(--syntax-hw-selector, var(--syntax-function)); }
    .syntax-pseudo      { color: var(--syntax-hw-pseudo, var(--syntax-class-name, var(--syntax-builtin))); font-style: italic; }
    .syntax-at-rule     { color: var(--syntax-hw-at-rule, var(--syntax-keyword)); font-weight: 600; }
    .syntax-variable    { color: var(--syntax-hw-variable, var(--syntax-attr-name)); }
    .syntax-important   { color: var(--syntax-hw-important, #f14c4c); font-weight: 700; }
    .syntax-regex       { color: var(--syntax-hw-regex, #d16969); }
    .syntax-operator    { color: var(--syntax-hw-operator, var(--syntax-punctuation)); }
    .syntax-escape      { color: var(--syntax-hw-escape, var(--syntax-number)); font-weight: 600; }
    .syntax-doc-comment { color: var(--syntax-hw-doc, var(--syntax-comment)); font-style: italic; }
`;

/**
 * The languages this IDE claims.
 *
 * `id` doubles as the highlighter id and — lowercased from `name` — as the key
 * js/app.js uses to find a language server, so the three must stay in agreement.
 * SCSS and LESS ride on the CSS model: the highlighter covers the syntax they share
 * with CSS, and one CSS language server handles all three dialects.
 */
export const WEB_LANGUAGES = [
    { id: 'html', name: 'HTML', parser: 'html', extensions: ['html', 'htm'], rules: htmlRules },
    { id: 'css', name: 'CSS', parser: 'css', extensions: ['css', 'scss', 'less'], rules: cssRules },
    { id: 'javascript', name: 'JavaScript', parser: 'js', extensions: ['js', 'mjs', 'cjs', 'jsx'], rules: jsRules },
    { id: 'typescript', name: 'TypeScript', parser: 'js', extensions: ['ts', 'tsx'], rules: jsRules }
];

/**
 * Registers the web languages through the IDE context, so the models are torn down
 * again the moment the user switches to another workspace.
 */
export function registerWebSyntax(ctx) {
    ctx.injectCSS(tokenStyles);

    WEB_LANGUAGES.forEach((lang) => {
        ctx.registerLanguage(lang.id, {
            name: lang.name,
            extensions: lang.extensions,
            parser: lang.parser,
            // Carry over whatever snippet database is already registered — otherwise
            // selecting this IDE would replace the web-languages-pack completions
            // with nothing.
            db: inheritDb(ctx, lang.extensions[0])
            // `parserRules` is deliberately omitted: passing it (even empty) overwrites
            // the shared parser rule set, which is what feeds local-symbol completion.
        });
        ctx.registerHighlighter(lang.id, lang.rules);
    });
}
