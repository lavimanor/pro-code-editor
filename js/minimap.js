/**
 * Initialize interactive mouse navigation drag-and-scroll events on the Minimap.
 */
export function initMinimapScroll(editor, minimapGutter, minimapIndicator) {
    let isDragging = false;

    function scrollToPosition(clientY) {
        const rect = minimapGutter.getBoundingClientRect();
        const clickY = clientY - rect.top;
        
        const halfIndicator = minimapIndicator.clientHeight / 2;
        const targetY = clickY - halfIndicator;
        const maxMinimapScroll = minimapGutter.clientHeight - minimapIndicator.clientHeight;
        
        const ratio = Math.max(0, Math.min(1, targetY / (maxMinimapScroll || 1)));
        editor.scrollTop = ratio * (editor.scrollHeight - editor.clientHeight);
    }

    minimapGutter.addEventListener('mousedown', (e) => {
        isDragging = true;
        scrollToPosition(e.clientY);
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        scrollToPosition(e.clientY);
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
    });
}