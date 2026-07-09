/**
 * =====================================================================
 *  Language Run Registry
 * ---------------------------------------------------------------------
 *  The SINGLE place to register a runnable language.
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
        run: [
            { cmd: 'dotnet', args: ['run', '--project', '{dir}'] }
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