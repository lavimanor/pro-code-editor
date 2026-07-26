/**
 * Explorer Context Menu contributions for Pythonix IDE.
 */

import { isElectron, spawnPython, getPythonPath } from './py-env.js';
import { createVirtualEnv } from './venv-manager.js';

export function registerExplorerMenu(ctx) {
    // 1. File Menu: Run Python File in Terminal
    ctx.registerExplorerMenuItem('python-run-file', {
        label: 'Run Python File in Terminal',
        icon: 'fa-solid fa-play',
        group: 'open',
        order: 10,
        when: (target) => target.kind === 'file' && target.name.endsWith('.py'),
        onClick: async (target) => {
            const pyPath = getPythonPath();
            ctx.terminal.show();
            ctx.terminal.print(`[Pythonix] Executing script: ${target.name}`, 'system');
            await ctx.runCommand(`"${pyPath}" -u "${target.path}"`);
        }
    });

    // 2. File Menu: Run with Benchmark Timer
    ctx.registerExplorerMenuItem('python-benchmark-file', {
        label: 'Run with Performance Benchmark',
        icon: 'fa-solid fa-stopwatch',
        group: 'open',
        order: 11,
        when: (target) => target.kind === 'file' && target.name.endsWith('.py'),
        onClick: async (target) => {
            if (!isElectron) {
                ctx.notify('Native execution requires Desktop Shell environment.', 'error');
                return;
            }
            ctx.terminal.show();
            ctx.terminal.print(`[Pythonix Benchmark] Measuring runtime performance for ${target.name}...`, 'system');

            const pyCode = `import time, runpy\nstart = time.perf_counter()\ntry:\n    runpy.run_path(r'${target.path.replace(/\\/g, '\\\\')}', run_name='__main__')\nfinally:\n    elapsed = (time.perf_counter() - start) * 1000\n    print(f'\\n[Benchmark Finished in {elapsed:.2f} ms]')\n`;

            spawnPython(['-c', pyCode], {
                onStdout: (t) => ctx.terminal.print(t, 'stdout'),
                onStderr: (t) => ctx.terminal.print(t, 'stderr'),
                onClose: (code) => {
                    ctx.terminal.print(`[Pythonix] Process finished with exit code ${code}`, 'system');
                }
            });
        }
    });

    // 3. requirements.txt context menu item: Install All Dependencies
    ctx.registerExplorerMenuItem('python-install-reqs', {
        label: 'Install All Dependencies (pip install -r)',
        icon: 'fa-solid fa-boxes-packing',
        group: 'plugins',
        when: (target) => target.kind === 'file' && target.name.toLowerCase() === 'requirements.txt',
        onClick: async (target) => {
            ctx.terminal.show();
            ctx.terminal.print(`[Pythonix Pip] Installing dependencies from ${target.name}...`, 'system');
            const pyPath = getPythonPath();
            await ctx.runCommand(`"${pyPath}" -m pip install -r "${target.path}"`);
        }
    });

    // 4. Directory Submenu: Scaffold Python Code / Venv
    ctx.registerExplorerMenuItem('python-scaffold-dir', {
        label: (target) => `Scaffold Python in "${target.name}"`,
        icon: 'fa-brands fa-python',
        group: 'plugins',
        when: (target) => target.kind === 'directory' || target.isRoot,
        submenu: (target) => [
            {
                label: 'Create Virtual Environment (.venv)',
                icon: 'fa-solid fa-cube',
                onClick: async () => {
                    await createVirtualEnv(ctx);
                }
            },
            {
                label: 'New Python Script / Module',
                icon: 'fa-solid fa-file-code',
                onClick: async () => {
                    const name = await ctx.prompt('Enter Python script name:', 'module.py');
                    if (!name) return;
                    const path = ctx.fs.join(target.path || '', name.endsWith('.py') ? name : `${name}.py`);
                    const content = `"""\n${name} — Module documentation\n"""\n\ndef main():\n    print("Running ${name}...")\n\nif __name__ == "__main__":\n    main()\n`;
                    await ctx.fs.writeFile(path, content);
                    ctx.refreshExplorer();
                    await ctx.openFile(path);
                }
            },
            {
                label: 'New Unittest Test Suite',
                icon: 'fa-solid fa-vial',
                onClick: async () => {
                    const name = await ctx.prompt('Enter test suite name:', 'test_module.py');
                    if (!name) return;
                    const path = ctx.fs.join(target.path || '', name.endsWith('.py') ? name : `${name}.py`);
                    const content = `import unittest\n\nclass TestSuite(unittest.TestCase):\n    def test_example(self):\n        self.assertEqual(1 + 1, 2)\n\nif __name__ == "__main__":\n    unittest.main()\n`;
                    await ctx.fs.writeFile(path, content);
                    ctx.refreshExplorer();
                    await ctx.openFile(path);
                }
            }
        ]
    });
}
