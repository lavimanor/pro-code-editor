/**
 * Formatter and Minifier pipeline for HyperWeb IDE.
 * Formats or minifies HTML, CSS, and JS/TS files.
 */

export function minifyWebCode(code, ext) {
    if (!code) return '';
    if (ext === 'html' || ext === 'htm') {
        return code
            .replace(/<!--[\s\S]*?-->/g, '')
            .replace(/>\s+</g, '><')
            .replace(/\s{2,}/g, ' ')
            .trim();
    }
    if (ext === 'css' || ext === 'scss' || ext === 'less') {
        return code
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\s*([{}::;,])\s*/g, '$1')
            .replace(/;\}/g, '}')
            .trim();
    }
    if (ext === 'js' || ext === 'mjs' || ext === 'cjs' || ext === 'jsx' || ext === 'ts' || ext === 'tsx' || ext === 'json') {
        return code
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/.*/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
    return code;
}

export function formatWebCode(code, ext) {
    if (!code) return '';
    const lines = code.split('\n');
    let indent = 0;
    const formatted = [];

    lines.forEach(line => {
        let trimmed = line.trim();
        if (!trimmed) return;

        if (ext === 'css' || ext === 'scss' || ext === 'js' || ext === 'jsx' || ext === 'ts' || ext === 'tsx') {
            if (trimmed.startsWith('}') || trimmed.startsWith(']') || trimmed.startsWith(')')) {
                indent = Math.max(0, indent - 1);
            }
            formatted.push('    '.repeat(indent) + trimmed);
            if (trimmed.endsWith('{') || trimmed.endsWith('[') || trimmed.endsWith('(')) {
                indent++;
            }
        } else if (ext === 'html' || ext === 'htm') {
            if (trimmed.startsWith('</')) {
                indent = Math.max(0, indent - 1);
            }
            formatted.push('    '.repeat(indent) + trimmed);
            if (trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.startsWith('<!') && !trimmed.endsWith('/>') && !trimmed.includes('</')) {
                const tagMatch = /^<([a-zA-Z0-9]+)/.exec(trimmed);
                if (tagMatch) {
                    const tag = tagMatch[1].toLowerCase();
                    const voidTags = ['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'];
                    if (!voidTags.includes(tag)) {
                        indent++;
                    }
                }
            }
        } else {
            formatted.push(line);
        }
    });

    return formatted.join('\n');
}

export function registerWebFormatter(ctx) {
    ctx.registerSetting('hyperweb-format-on-save', {
        label: 'Format Web Files on Save',
        type: 'checkbox',
        defaultValue: false,
        pluginId: 'hyperweb-ide',
        description: 'Automatically formats HTML, CSS, and JS files when saving.',
        onChange: (enabled) => {
            console.log(`[HyperWeb IDE] Format-on-save set to: ${enabled}`);
        }
    });

    ctx.on('file-saved', async ({ path, name }) => {
        const enabled = ctx.storage.get('hyperweb-format-on-save', false);
        if (!enabled) return;

        const ext = name.split('.').pop().toLowerCase();
        if (!['html', 'htm', 'css', 'scss', 'less', 'js', 'jsx', 'ts', 'tsx', 'json'].includes(ext)) return;

        try {
            const text = await ctx.fs.readFile(path);
            const formatted = formatWebCode(text, ext);
            if (formatted !== text) {
                await ctx.fs.writeFile(path, formatted);
                ctx.notify(`[HyperWeb] Auto-formatted "${name}" on save.`, 'info');
            }
        } catch (e) {
            console.error('[HyperWeb] Auto-format on save failed:', e);
        }
    });
}
