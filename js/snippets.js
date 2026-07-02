export function getCustomSnippets() {
    const raw = localStorage.getItem('editor-custom-snippets');
    return raw ? JSON.parse(raw) : [];
}

export function saveCustomSnippets(snippets) {
    localStorage.setItem('editor-custom-snippets', JSON.stringify(snippets));
}

/**
 * Renders defined snippets list with integrated deletion hooks.
 */
export function renderSnippetsList(listEl, onDelete) {
    listEl.innerHTML = '';
    const snippets = getCustomSnippets();
    
    if (snippets.length === 0) {
        listEl.innerHTML = '<li class="custom-snippet-item" style="color: var(--text-muted); justify-content: center;">No snippets defined.</li>';
        return;
    }

    snippets.forEach((snippet, idx) => {
        const li = document.createElement('li');
        li.className = 'custom-snippet-item';
        li.innerHTML = `
            <span><strong>${snippet.trigger}</strong> (${snippet.lang})</span>
            <button class="delete-snippet-btn" data-index="${idx}"><i class="fa-regular fa-trash-can"></i></button>
        `;
        li.querySelector('.delete-snippet-btn').addEventListener('click', () => {
            onDelete(idx);
        });
        listEl.appendChild(li);
    });
}