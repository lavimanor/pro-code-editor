# HyperWeb IDE — Handoff

A web-dev workspace at `custom/ides/hyperweb-ide/`. Auto-discovered by the directory
scan in `main.js`; no registration list to update.

## Done

- `package.json` — manifest (`type: "ide"`, id `hyperweb-ide`), no extension dependencies.
- `icon.svg` — copied verbatim from `web-dev-ide`.
- `index.js` — registers the IDE, the registry guard, syntax, LSP, status bar and welcome page.
- `src/syntax.js` — highlighting for HTML, CSS (plus SCSS/LESS) and JavaScript. Adds the
  token types `property`, `selector`, `pseudo`, `at-rule`, `variable`, `important`,
  `regex`, `operator`, `escape` and `doc-comment` on top of the editor's built-in set,
  with colours injected via `ctx.injectCSS` that fall back to core theme variables.
- `src/lsp.js` — `vscode-html-language-server`, `vscode-css-language-server` and
  `typescript-language-server`, plus a PATH probe. All three are registered with the
  `{ semanticTokens: true, completion: true }` features flag (5th arg of
  `registerLspClient`): the TypeScript server paints semantic tokens over the JS regex
  highlighter, and all three feed completions into ProSense. Each feature is gated by the
  server's advertised capabilities, so the HTML/CSS servers (no semantic-tokens provider)
  fall back to regex highlighting automatically.
- `src/status.js` — the `LSP n/n` status bar badge. Click it for install commands.
- `src/registry-guard.js` — snapshot/restore for the shared language registries.

## Three things that will bite you

**1. Rules are concatenated into one regex.** `registerHighlighter` joins every rule
into a single alternation, wrapping each in one capture group. So:

- A capturing group *inside* a rule shifts the group indexes and silently mislabels
  every token after it. Use `(?:…)`.
- Flags are dropped — only `regex.source` survives. `/i` does nothing; spell out both
  cases or accept lowercase-only matching.
- The engine takes the **earliest** match, so rule order only breaks ties between rules
  matching at the same offset. Several orderings in `src/syntax.js` exist purely to win
  those ties and are commented as such.

**2. Unmatched text falls through to the generic model** in `js/syntax.js`, which reads
`#…`, `--…` and `//…` as line comments. A character your rules do not claim can grey out
the rest of the line — see the "fallback guard" rules at the end of `htmlRules`.

**3. The web languages are shared.** `custom/extensions/web-languages-pack` is a
standalone extension, so it is active for the whole session and owns the `html`, `css`
and `javascript` registry entries. Registering the same ids here overwrites them *and*
restamps them as HyperWeb-owned — and switching IDEs does not re-run extension
`activate()`. Without `src/registry-guard.js` the Normal Editor would lose web
highlighting, snippets and language servers for the rest of the session. If you add
another shared language id, add its keys to the `snapshotLanguageRegistries` call in
`index.js`.

Related: `registerLanguage` overwrites `parserRules` whenever `config.parserRules` is
passed, even as `[]`. We omit the field so the pack's JS parser rules survive, and
inherit its `db` through `inheritDb` instead of replacing it with an empty array.

## LSP wiring

`js/app.js` resolves a client by the **language name lowercased**
(`api.languages.get(ext).name`), falling back to the file extension — so the keys in
`src/lsp.js` must track the `name` fields in `src/syntax.js`.

`initializationOptions` is used twice by `js/lsp-client.js`: in the `initialize` request
*and* as the `workspace/didChangeConfiguration` settings payload. The objects in
`src/lsp.js` therefore carry both; each server ignores the keys that are not its own.
This matters for the CSS server, which validates nothing until it receives settings.

Servers are expected on PATH (`.cmd` shims on Windows):

```
npm i -g vscode-langservers-extracted          # html + css
npm i -g typescript-language-server typescript # javascript
```

A missing binary fails **silently** — the editor spawns through a shell and
`LspClient.start` waits on an `initialize` reply that never arrives, with no timeout.
That is what the PATH probe in `src/lsp.js` and the status badge are for.

## Not done / next steps

1. **Template literal interpolation** — `` `a ${x} b` `` is highlighted as one string.
   Breaking out `${…}` needs brace tracking the single-pass tokenizer cannot do.
2. **Boolean HTML attributes** — `<input disabled>` is unstyled. A curated word list
   would also colour those words in prose; it needs tag-interior context to be safe.
3. **TypeScript** — `.ts` / `.tsx` are not registered. `typescript-language-server`
   already handles them; it needs a `ts` language, a highlighter and an LSP key.
4. **Autocomplete `db`** — inherited from `web-languages-pack` rather than owned. A
   HyperWeb-specific set could cover CSS values and DOM APIs. (Live server completions
   are now merged in on top of this via the `completion` feature flag; the `db` is still
   the instant/offline layer.)
5. **Project scaffolding** — no toolbar buttons. `ctx.createProjectStructure` can
   generate a starter `src/index.html` + `style.css` + `app.js`.
6. **Live preview** — the built-in "Go Live" status bar action already serves HTML;
   check it behaves correctly under this IDE before adding anything custom.
7. **Explorer menu / keybindings** — nothing registered.

## Gotcha

Highlighter lookup is `getHighlighter(config.name)` falling back to `getHighlighter(ext)`,
both lowercased — so the language `name` (`"JavaScript"`) must match the highlighter id
(`"javascript"`). Renaming one without the other silently disables highlighting.

## Docs

`instructions/IDEs.md` is the full IDE API reference.
