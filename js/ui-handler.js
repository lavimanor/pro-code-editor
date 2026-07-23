import { api } from './api-core.js';

export function renderFileTree(container, items, selectedPath, expandedFolders, activeIconPackKey, onSelect, onFolderToggle, onDelete, onMove, onContextMenu) {
    container.innerHTML = '';
    const iconPack = api.icons.get(activeIconPackKey) || api.icons.get('material');

    // Right-clicking the empty space below the tree targets the workspace root.
    if (typeof onContextMenu === 'function' && !container._rootContextMenuBound) {
        container._rootContextMenuBound = true;
        container.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.tree-item')) return; // Handled by the item itself
            e.preventDefault();
            onContextMenu(e, null);
        });
    }

    function buildTreeHTML(itemsElement, parentElement, levelPath = 'root') {
        const ul = document.createElement('ul');

        itemsElement.forEach(item => {
            const li = document.createElement('li');
            const wrapper = document.createElement('div');
            
            const currentItemPath = `${levelPath}/${item.name}`;
            const isSelected = selectedPath && selectedPath === currentItemPath;
            wrapper.className = `tree-item ${item.kind} ${isSelected ? 'selected' : ''}`;
            
            // FIX 1: Set draggable as a native attribute to ensure compatibility
            wrapper.setAttribute('draggable', 'true');
            
            const labelDiv = document.createElement('div');
            labelDiv.className = 'tree-label';
            
            if (item.kind === 'directory') {
                const caret = document.createElement('i');
                const isExpanded = expandedFolders.has(currentItemPath);
                caret.className = `fa-solid fa-caret-right folder-caret ${isExpanded ? 'expanded' : ''}`;
                labelDiv.appendChild(caret);
                
                // Load Folder Icon from Active Pack
                labelDiv.insertAdjacentHTML('beforeend', iconPack.getFolderIcon());
            } else {
                const spacer = document.createElement('span');
                spacer.style.width = '12px';
                labelDiv.appendChild(spacer);
                
                // Load File Icon from Active Pack
                labelDiv.insertAdjacentHTML('beforeend', iconPack.getFileIcon(item.name));
            }
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = item.name;
            labelDiv.appendChild(nameSpan);
            wrapper.appendChild(labelDiv);

            const delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.innerHTML = '<i class="fa-regular fa-trash-can"></i>';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                onDelete(item);
            });
            wrapper.appendChild(delBtn);

            wrapper.addEventListener('click', (e) => {
                e.stopPropagation();
                if (item.kind === 'directory') {
                    onFolderToggle(currentItemPath, item);
                } else {
                    onSelect(item);
                }
            });

            if (typeof onContextMenu === 'function') {
                wrapper.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onContextMenu(e, { ...item, treePath: currentItemPath });
                });
            }

            // Drag and Drop Binds
            wrapper.addEventListener('dragstart', (e) => {
                e.stopPropagation();
                
                // FIX 2: Set effectAllowed and plain-text data payload. 
                // Without this, Chromium immediately cancels the drag gesture.
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', item.name);
                
                window.draggedItemReference = { item, currentItemPath };
            });

            wrapper.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (item.kind === 'directory') wrapper.classList.add('drag-over');
            });

            wrapper.addEventListener('dragleave', (e) => {
                e.stopPropagation();
                wrapper.classList.remove('drag-over');
            });

            wrapper.addEventListener('drop', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                wrapper.classList.remove('drag-over');
                
                const dragContext = window.draggedItemReference;
                if (!dragContext || dragContext.item.name === item.name) return;

                const targetDirHandle = item.kind === 'directory' ? item.handle : item.parent;
                onMove(dragContext.item, targetDirHandle);
            });

            li.appendChild(wrapper);

            if (item.kind === 'directory' && item.children) {
                const subContainer = document.createElement('div');
                if (!expandedFolders.has(currentItemPath)) {
                    subContainer.style.display = 'none';
                }
                buildTreeHTML(item.children, subContainer, currentItemPath);
                li.appendChild(subContainer);
            }
            ul.appendChild(li);
        });
        parentElement.appendChild(ul);
    }
    buildTreeHTML(items, container);
}

/**
 * Renders file tabs with integrated workspace file-icons and drag-and-drop tab ordering.
 */
export function renderTabs(container, openTabs, activeFileHandle, dirtyFiles, activeIconPackKey, onTabSelect, onTabClose, onTabReorder, onTabContextMenu) {
    container.innerHTML = '';
    const iconPack = api.icons.get(activeIconPackKey) || api.icons.get('material');

    // Identify tabs by absolute path (falls back to name in the web build) so two
    // files sharing a name in different folders don't collide.
    const keyOf = (h) => (h && (h.path || h.name)) || '';
    const activeKey = keyOf(activeFileHandle);

    openTabs.forEach(fileHandle => {
        const tab = document.createElement('div');
        const handleKey = keyOf(fileHandle);
        const isDirty = dirtyFiles.has(handleKey);

        tab.className = `tab ${handleKey === activeKey ? 'active' : ''} ${isDirty ? 'dirty' : ''}`;
        
        // Render File Type Icon
        const iconSpan = document.createElement('span');
        iconSpan.className = 'tab-icon';
        if (fileHandle.isSettings) {
            iconSpan.innerHTML = '<i class="fa-solid fa-gear" style="color: var(--text-muted);"></i>';
        } else if (fileHandle.isPluginDetails) {
            // Render explicit designator icons based on package type
            const isIde = fileHandle.plugin && fileHandle.plugin.type === 'ide';
            iconSpan.innerHTML = `<i class="fa-solid ${isIde ? 'fa-laptop-code' : 'fa-puzzle-piece'}" style="color: var(--accent-color);"></i>`;
        } else {
            iconSpan.innerHTML = iconPack.getFileIcon(fileHandle.name);
        }
        tab.appendChild(iconSpan);

        // Render File Tab Label
        const label = document.createElement('span');
        label.textContent = fileHandle.name;
        label.className = 'tab-label';
        label.addEventListener('click', () => onTabSelect(fileHandle));
        tab.appendChild(label);
        
        const closeBtn = document.createElement('span');
        closeBtn.className = 'tab-close';
        if (!isDirty) closeBtn.textContent = '×';
        
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            onTabClose(fileHandle);
        });
        tab.appendChild(closeBtn);

        // Right-clicking a tab opens the bulk-close / tab actions menu.
        if (typeof onTabContextMenu === 'function') {
            tab.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                onTabContextMenu(e, fileHandle);
            });
        }

        // Drag and Drop Tab Reordering
        tab.draggable = true;
        
        tab.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            e.dataTransfer.setData('text/plain', handleKey);
            window.draggedTabKey = handleKey;
        });

        tab.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            tab.classList.add('tab-drag-over');
        });

        tab.addEventListener('dragleave', (e) => {
            e.stopPropagation();
            tab.classList.remove('tab-drag-over');
        });

        tab.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            tab.classList.remove('tab-drag-over');
            
            const sourceKey = window.draggedTabKey || e.dataTransfer.getData('text/plain');
            const targetKey = handleKey;
            if (sourceKey && sourceKey !== targetKey) {
                onTabReorder(sourceKey, targetKey);
            }
        });

        container.appendChild(tab);
    });
}