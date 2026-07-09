import { api } from './api-core.js';

const DEFAULT_ICON_PACKS = {
    'material': {
        name: 'VS Code Material (Icons)',
        getFolderIcon: () => '<i class="fa-solid fa-folder"></i>',
        getFileIcon: (fileName) => {
            const ext = fileName.split('.').pop().toLowerCase();
            switch(ext) {
                case 'js': return '<i class="fa-brands fa-js"></i>';
                case 'html': case 'htm': return '<i class="fa-brands fa-html5"></i>';
                case 'css': return '<i class="fa-brands fa-css3-alt"></i>';
                case 'json': return '<i class="fa-solid fa-code"></i>';
                case 'md': return '<i class="fa-solid fa-file-lines"></i>';
                case 'py': return '<i class="fa-brands fa-python"></i>';
                case 'java': return '<i class="fa-brands fa-java"></i>';
                case 'cs': return '<i class="fa-solid fa-hashtag"></i>';
                case 'c': case 'h': return '<i class="fa-solid fa-c"></i>';
                case 'cpp': case 'hpp': case 'cc': case 'cxx': return '<i class="fa-solid fa-c"></i>';
                case 'png': case 'jpg': case 'jpeg': return '<i class="fa-regular fa-file-image"></i>';
                case 'svg': return '<i class="fa-solid fa-bezier-curve"></i>';
                case 'lua': return '<i class="fa-solid fa-moon"></i>';
                default: return '<i class="fa-regular fa-file-lines"></i>';
            }
        }
    },
    'emoji': {
        name: 'Retro Emoji Pack',
        getFolderIcon: () => '📁',
        getFileIcon: (fileName) => {
            const ext = fileName.split('.').pop().toLowerCase();
            switch(ext) {
                case 'js': return '💛';
                case 'html': case 'htm': return '🌐';
                case 'css': return '🎨';
                case 'json': return '⚙️';
                case 'md': return '📝';
                case 'py': return '🐍';
                case 'java': return '☕';
                case 'cs': return '💠';
                case 'c': case 'h': return '🇨';
                case 'cpp': case 'hpp': case 'cc': case 'cxx': return '➕';
                case 'png': case 'jpg': case 'jpeg': case 'svg': return '🖼️';
                case 'lua': return '🌙';
                default: return '📄';
            }
        }
    }
};

export function registerDefaultIcons() {
    Object.entries(DEFAULT_ICON_PACKS).forEach(([key, config]) => {
        api.icons.register(key, config);
    });
}
registerDefaultIcons(); // run once on standard script load

/**
 * Renders registered options dynamically to the settings element
 */
export function renderIconSelector(selectorEl) {
    if (!selectorEl) return;
    selectorEl.innerHTML = '';
    const allPacks = api.icons.getAll();
    Object.entries(allPacks).forEach(([key, pack]) => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = pack.name || key;
        selectorEl.appendChild(opt);
    });
}