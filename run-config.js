/**
 * =====================================================================
 *  Language Run Registry
 * ---------------------------------------------------------------------
 *  The SINGLE place to register a runnable language. To add support for
 *  a new language, drop another entry keyed by its file extension.
 *
 *  Each entry:
 *    label    : Human-friendly name shown in the terminal.
 *    compile  : (optional) Ordered list of compile steps. Each step is a
 *               candidate list; the first candidate that launches wins.
 *    run      : Ordered candidate commands. The first one that launches
 *               wins (used for PATH fallbacks e.g. python -> py).
 *
 *  A "candidate" is { cmd, args:[...] }. The following placeholders are
 *  substituted at spawn time (see main.js -> substitutePlaceholders):
 *    {file}  absolute path to the source file
 *    {dir}   directory containing the source file
 *    {base}  file name without extension  (e.g. Program)
 *    {exe}   {dir}/{base}.exe             (compiled binary target)
 *
 *  Special command tokens resolved by main.js:
 *    __csc__ -> the located C# (csc.exe) compiler.
 *
 *  This module is CommonJS on purpose: it is required by the Electron
 *  main process (main.js).
 * =====================================================================
 */

const RUN_CONFIG = {
    py: {
        label: 'Python',
        run: [
            { cmd: 'python', args: ['{file}'] },
            { cmd: 'py', args: ['{file}'] }
        ]
    },

    js: {
        label: 'Node.js',
        run: [
            { cmd: 'node', args: ['{file}'] }
        ]
    },

    cs: {
        label: 'C#',
        compile: [
            [ { cmd: '__csc__', args: ['/nologo', '/out:{exe}', '{file}'] } ]
        ],
        run: [
            { cmd: '{exe}', args: [] }
        ]
    },

    java: {
        label: 'Java',
        compile: [
            [ { cmd: 'javac', args: ['{file}'] } ]
        ],
        run: [
            // Run the compiled class by name using the source folder as classpath.
            { cmd: 'java', args: ['-cp', '{dir}', '{base}'] }
        ]
    }
};

module.exports = RUN_CONFIG;
