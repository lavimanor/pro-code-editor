/**
 * =====================================================================
 *  Language Run Registry (Compilations Removed)
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
        run: [
            // Runs standard Java source files directly on newer JDK versions
            { cmd: 'java', args: ['{file}'] }
        ]
    }
};

module.exports = RUN_CONFIG;