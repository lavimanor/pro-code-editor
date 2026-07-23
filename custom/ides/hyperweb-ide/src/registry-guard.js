/**
 * Keeps HyperWeb from permanently hijacking the shared language registries.
 *
 * `custom/extensions/web-languages-pack` is a standalone extension, so it stays active
 * for the whole session and owns the 'html', 'css' and 'javascript' entries in
 * `api.languages`. Registering the same ids from here overwrites its entries *and*
 * restamps them as HyperWeb-owned. Since switching IDEs does not re-run extension
 * activate() (see js/app.js), the moment the user returns to the Normal Editor
 * `getHighlighter('html')` finds an inactive owner and returns nothing — highlighting,
 * snippets and language servers would quietly disappear for the rest of the session
 * even though the extension is still enabled.
 *
 * So snapshot whatever we are about to replace and put it back on dispose. The saved
 * objects still carry their original non-enumerable `_owner` stamp, so restoring the
 * object restores its ownership with it.
 */

/** The three registries an IDE can claim, in the order LanguagesAPI declares them. */
function registriesFor(ctx, spec) {
    const languages = ctx.api.languages;
    return [
        [languages.languages, spec.languages || []],
        [languages.highlighters, spec.highlighters || []],
        [languages.lspClients, spec.lspClients || []]
    ];
}

/**
 * Records the current value of every listed key and returns a restore function.
 * Keys that had no entry are deleted again rather than restored as undefined.
 *
 * @param {object} spec `{ languages: [ext], highlighters: [langId], lspClients: [key] }`
 * @returns {() => void} pass straight to `ctx.onDispose`
 */
export function snapshotLanguageRegistries(ctx, spec) {
    const saved = registriesFor(ctx, spec).map(([map, keys]) => [
        map,
        keys.map((key) => {
            const k = key.toLowerCase();
            return [k, map.has(k), map.get(k)];
        })
    ]);

    return () => {
        saved.forEach(([map, entries]) => {
            entries.forEach(([key, existed, previous]) => {
                if (existed) map.set(key, previous);
                else map.delete(key);
            });
        });
    };
}

/**
 * Returns the autocomplete database already registered for `ext`, so replacing a
 * language definition does not throw away someone else's snippets. Ownership-filtered:
 * a database belonging to an IDE that is not selected is not inherited.
 */
export function inheritDb(ctx, ext, fallback = []) {
    const existing = ctx.api.languages.get(ext);
    return existing && Array.isArray(existing.db) && existing.db.length ? existing.db : fallback;
}
