/**
 * Explorer Context Menu contributions for HyperWeb IDE.
 */

import { minifyWebCode, formatWebCode } from './formatter.js';

export function registerExplorerMenu(ctx) {
    // 1. File Menu: Minify Web Code
    ctx.registerExplorerMenuItem('hw-minify-file', {
        label: 'Minify Web Code',
        icon: 'fa-solid fa-compress',
        group: 'edit',
        order: 50,
        when: (target) => target.kind === 'file' && /\.(html|htm|css|scss|less|js|jsx|ts|tsx|json)$/i.test(target.name),
        onClick: async (target) => {
            try {
                const text = await ctx.fs.readFile(target.path);
                const ext = target.name.split('.').pop().toLowerCase();
                const minified = minifyWebCode(text, ext);
                await ctx.fs.writeFile(target.path, minified);
                ctx.notify(`Minified ${target.name}`, 'success');
            } catch (err) {
                ctx.notify(`Failed to minify ${target.name}: ${err.message}`, 'error');
            }
        }
    });

    // 2. File Menu: Format Web Code
    ctx.registerExplorerMenuItem('hw-format-file', {
        label: 'Format / Beautify Web Code',
        icon: 'fa-solid fa-align-left',
        group: 'edit',
        order: 51,
        when: (target) => target.kind === 'file' && /\.(html|htm|css|scss|less|js|jsx|ts|tsx|json)$/i.test(target.name),
        onClick: async (target) => {
            try {
                const text = await ctx.fs.readFile(target.path);
                const ext = target.name.split('.').pop().toLowerCase();
                const formatted = formatWebCode(text, ext);
                await ctx.fs.writeFile(target.path, formatted);
                ctx.notify(`Formatted ${target.name}`, 'success');
            } catch (err) {
                ctx.notify(`Failed to format ${target.name}: ${err.message}`, 'error');
            }
        }
    });

    // 3. Directory Submenu: Scaffold Web File in Directory
    ctx.registerExplorerMenuItem('hw-scaffold-dir', {
        label: (target) => `Scaffold Web Element in "${target.name}"`,
        icon: 'fa-solid fa-wand-magic-sparkles',
        group: 'plugins',
        when: (target) => target.kind === 'directory' || target.isRoot,
        submenu: (target) => [
            {
                label: 'HTML5 Page File',
                icon: 'fa-brands fa-html5',
                onClick: async () => {
                    const name = await ctx.prompt('Enter HTML filename:', 'page.html');
                    if (!name) return;
                    const path = ctx.fs.join(target.path || '', name.endsWith('.html') ? name : `${name}.html`);
                    const content = `<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <title>${name}</title>\n    <link rel="stylesheet" href="style.css">\n</head>\n<body>\n    <h1>${name}</h1>\n</body>\n</html>`;
                    await ctx.fs.writeFile(path, content);
                    ctx.refreshExplorer();
                    await ctx.openFile(path);
                }
            },
            {
                label: 'CSS Stylesheet File',
                icon: 'fa-brands fa-css3-alt',
                onClick: async () => {
                    const name = await ctx.prompt('Enter CSS filename:', 'style.css');
                    if (!name) return;
                    const path = ctx.fs.join(target.path || '', name.endsWith('.css') ? name : `${name}.css`);
                    const content = `/* Stylesheet ${name} */\n:root {\n    --primary: #00b4d8;\n}\nbody {\n    font-family: system-ui, sans-serif;\n}\n`;
                    await ctx.fs.writeFile(path, content);
                    ctx.refreshExplorer();
                    await ctx.openFile(path);
                }
            },
            {
                label: 'JavaScript Module File',
                icon: 'fa-brands fa-js',
                onClick: async () => {
                    const name = await ctx.prompt('Enter JS filename:', 'component.js');
                    if (!name) return;
                    const path = ctx.fs.join(target.path || '', name.endsWith('.js') ? name : `${name}.js`);
                    const content = `/**\n * ${name}\n */\nexport function init() {\n    console.log('${name} initialized.');\n}\n`;
                    await ctx.fs.writeFile(path, content);
                    ctx.refreshExplorer();
                    await ctx.openFile(path);
                }
            }
        ]
    });
}
