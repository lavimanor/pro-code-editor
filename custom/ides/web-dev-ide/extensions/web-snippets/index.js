/**
 * Web Snippets & Tools
 * --------------------
 * An "integrated" extension that ships *inside* the Web Creator IDE folder
 * (custom/ides/web-dev-ide/extensions/). The host application discovers it as a
 * normal extension, but its lifecycle is tied to the IDE: it activates when the IDE
 * is enabled and cannot be independently disabled while the IDE depends on it.
 *
 * It contributes a quick-reference sidebar panel with copyable web boilerplate.
 */
export function activate(api) {
    const SNIPPETS = [
        { label: 'HTML5 Boilerplate', code: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>Document</title>\n</head>\n<body>\n\n</body>\n</html>' },
        { label: 'Flex Center', code: 'display: flex;\nalign-items: center;\njustify-content: center;' },
        { label: 'Fetch JSON', code: "const res = await fetch(url);\nconst data = await res.json();" }
    ];

    api.views.registerSidebarPanel('web-tools', {
        iconClass: 'fa-solid fa-code',
        title: 'Web Tools',
        render: (container) => {
            container.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:10px; font-family:var(--font-ui);">
                    <p style="font-size:11px; color:var(--text-muted); margin:0;">
                        Bundled with the Web Creator IDE. Click a snippet to copy it.
                    </p>
                </div>`;
            const list = container.querySelector('div');
            SNIPPETS.forEach(sn => {
                const btn = document.createElement('button');
                btn.textContent = sn.label;
                btn.style.cssText = 'text-align:left; padding:8px 10px; font-size:12px; background:var(--bg-darker); color:var(--text-main); border:1px solid var(--border-color); border-radius:5px; cursor:pointer;';
                btn.addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(sn.code);
                        const prev = btn.textContent;
                        btn.textContent = '✓ Copied!';
                        setTimeout(() => { btn.textContent = prev; }, 1200);
                    } catch (e) {
                        console.error('Clipboard copy failed:', e);
                    }
                });
                list.appendChild(btn);
            });
        }
    });
}

export function deactivate() {
    console.log('Web Snippets & Tools deactivated.');
}
