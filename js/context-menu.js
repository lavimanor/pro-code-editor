/**
 * Reusable context-menu surface.
 *
 * `showContextMenu` renders a flat list of items at a screen position, keeps it inside
 * the viewport, and handles dismissal (outside click, Escape, scroll, blur). Items support
 * icons, keyboard-shortcut hints, separators, disabled states and nested submenus.
 *
 * Item shape:
 *   { label, icon?, shortcut?, danger?, disabled?, submenu?: [items], onClick?() }
 *   { separator: true }
 */

let openMenus = [];
let dismissBound = false;

export function closeContextMenu() {
    openMenus.forEach(menu => menu.remove());
    openMenus = [];
}

function bindDismissHandlers() {
    if (dismissBound) return;
    dismissBound = true;

    document.addEventListener('mousedown', (e) => {
        if (openMenus.length && !openMenus.some(menu => menu.contains(e.target))) {
            closeContextMenu();
        }
    }, true);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && openMenus.length) {
            e.stopPropagation();
            closeContextMenu();
        }
    }, true);

    window.addEventListener('blur', closeContextMenu);
    window.addEventListener('resize', closeContextMenu);
    document.addEventListener('wheel', (e) => {
        if (openMenus.length && !openMenus.some(menu => menu.contains(e.target))) {
            closeContextMenu();
        }
    }, true);
}

/**
 * Opens a menu at (x, y). Returns the menu element.
 * Nested submenus are rendered as sibling layers so they can escape overflow clipping.
 */
export function showContextMenu(x, y, items, options = {}) {
    if (!options._isSubmenu) closeContextMenu();
    bindDismissHandlers();

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.setAttribute('role', 'menu');

    const visibleItems = items.filter(Boolean);
    if (visibleItems.length === 0) return null;

    // Collapse runs of separators and trim them from the edges so contributed
    // groups can be appended without producing doubled dividers.
    const cleaned = [];
    visibleItems.forEach(item => {
        if (item.separator) {
            if (cleaned.length === 0) return;
            if (cleaned[cleaned.length - 1].separator) return;
        }
        cleaned.push(item);
    });
    while (cleaned.length && cleaned[cleaned.length - 1].separator) cleaned.pop();

    cleaned.forEach(item => {
        if (item.separator) {
            const sep = document.createElement('div');
            sep.className = 'context-menu-separator';
            menu.appendChild(sep);
            return;
        }

        const row = document.createElement('div');
        row.className = 'context-menu-item';
        row.setAttribute('role', 'menuitem');
        if (item.disabled) row.classList.add('disabled');
        if (item.danger) row.classList.add('danger');

        const iconEl = document.createElement('span');
        iconEl.className = 'context-menu-icon';
        if (item.icon) iconEl.innerHTML = `<i class="${item.icon}"></i>`;
        row.appendChild(iconEl);

        const labelEl = document.createElement('span');
        labelEl.className = 'context-menu-label';
        labelEl.textContent = item.label;
        row.appendChild(labelEl);

        if (item.submenu && item.submenu.length) {
            const chevron = document.createElement('span');
            chevron.className = 'context-menu-chevron';
            chevron.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
            row.appendChild(chevron);
        } else if (item.shortcut) {
            const hint = document.createElement('span');
            hint.className = 'context-menu-shortcut';
            hint.textContent = item.shortcut;
            row.appendChild(hint);
        }

        if (item.disabled) {
            menu.appendChild(row);
            return;
        }

        let submenuEl = null;
        const closeSubmenu = () => {
            if (submenuEl) {
                const idx = openMenus.indexOf(submenuEl);
                if (idx !== -1) openMenus.splice(idx, 1);
                submenuEl.remove();
                submenuEl = null;
            }
        };

        if (item.submenu && item.submenu.length) {
            row.addEventListener('mouseenter', () => {
                // Only one submenu may be open per level.
                Array.from(menu.querySelectorAll('.context-menu-item.submenu-open'))
                    .forEach(other => other !== row && other.dispatchEvent(new CustomEvent('close-submenu')));

                if (submenuEl) return;
                const rect = row.getBoundingClientRect();
                row.classList.add('submenu-open');
                submenuEl = showContextMenu(rect.right - 4, rect.top - 4, item.submenu, { _isSubmenu: true });
            });
            row.addEventListener('close-submenu', () => {
                row.classList.remove('submenu-open');
                closeSubmenu();
            });
            menu.addEventListener('mouseleave', () => {
                // Keep the submenu alive while the pointer is inside it.
                setTimeout(() => {
                    if (submenuEl && !submenuEl.matches(':hover')) {
                        row.classList.remove('submenu-open');
                        closeSubmenu();
                    }
                }, 180);
            });
        } else {
            row.addEventListener('mouseenter', () => {
                Array.from(menu.querySelectorAll('.context-menu-item.submenu-open'))
                    .forEach(other => other.dispatchEvent(new CustomEvent('close-submenu')));
            });
        }

        row.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (item.submenu && item.submenu.length) return;
            closeContextMenu();
            if (typeof item.onClick === 'function') {
                try {
                    await item.onClick();
                } catch (err) {
                    console.error('[ContextMenu] Item handler threw:', err);
                }
            }
        });

        menu.appendChild(row);
    });

    // Render off-screen first so the real size is known before positioning.
    menu.style.visibility = 'hidden';
    menu.style.left = '0px';
    menu.style.top = '0px';
    document.body.appendChild(menu);

    const { width, height } = menu.getBoundingClientRect();
    let left = x;
    let top = y;
    if (left + width > window.innerWidth - 4) left = Math.max(4, x - width);
    if (top + height > window.innerHeight - 4) top = Math.max(4, window.innerHeight - height - 4);

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.visibility = 'visible';

    openMenus.push(menu);
    return menu;
}

/**
 * Merges plugin-contributed items into the built-in menu.
 *
 * Contributions declare a `group`; entries land in their group's slot and are ordered by
 * `order` then registration sequence. A plugin may invent its own group name — those
 * collect at the `'*'` slot in `groupOrder` (or at the end when no slot is declared), so
 * the host keeps control of what stays last (e.g. Delete).
 */
export function mergeContributedItems(builtinGroups, groupOrder, contributions, ctx) {
    const groups = new Map();
    groupOrder.forEach(name => {
        if (name !== '*') groups.set(name, [...(builtinGroups[name] || [])]);
    });

    const extraGroups = [];

    contributions.forEach(contribution => {
        try {
            if (typeof contribution.when === 'function' && !contribution.when(ctx)) return;

            const label = typeof contribution.label === 'function'
                ? contribution.label(ctx)
                : contribution.label;
            if (!label) return;

            const item = {
                label,
                icon: contribution.icon,
                danger: contribution.danger,
                shortcut: contribution.shortcut,
                _order: typeof contribution.order === 'number' ? contribution.order : 100,
                disabled: typeof contribution.enabled === 'function' ? !contribution.enabled(ctx) : false,
                onClick: typeof contribution.onClick === 'function'
                    ? () => contribution.onClick(ctx)
                    : undefined
            };

            if (typeof contribution.submenu === 'function') {
                item.submenu = buildSubmenu(contribution.submenu(ctx), ctx);
            } else if (Array.isArray(contribution.submenu)) {
                item.submenu = buildSubmenu(contribution.submenu, ctx);
            }

            const group = contribution.group || 'plugins';
            if (!groups.has(group)) {
                groups.set(group, []);
                extraGroups.push(group);
            }
            groups.get(group).push(item);
        } catch (err) {
            console.error(`[ContextMenu] Contribution "${contribution.id}" failed to build:`, err);
        }
    });

    // Splice plugin-invented groups into the '*' slot, or append when none was declared.
    const wildcardIdx = groupOrder.indexOf('*');
    const ordered = wildcardIdx === -1
        ? [...groupOrder, ...extraGroups]
        : [...groupOrder.slice(0, wildcardIdx), ...extraGroups, ...groupOrder.slice(wildcardIdx + 1)];

    const result = [];
    ordered.forEach(name => {
        const entries = groups.get(name) || [];
        if (entries.length === 0) return;
        entries.sort((a, b) => (a._order ?? 100) - (b._order ?? 100));
        if (result.length) result.push({ separator: true });
        result.push(...entries);
    });
    return result;
}

function buildSubmenu(entries, ctx) {
    if (!Array.isArray(entries)) return [];
    return entries.map(entry => {
        if (entry.separator) return { separator: true };
        return {
            label: typeof entry.label === 'function' ? entry.label(ctx) : entry.label,
            icon: entry.icon,
            danger: entry.danger,
            shortcut: entry.shortcut,
            disabled: typeof entry.enabled === 'function' ? !entry.enabled(ctx) : !!entry.disabled,
            submenu: entry.submenu ? buildSubmenu(
                typeof entry.submenu === 'function' ? entry.submenu(ctx) : entry.submenu, ctx
            ) : undefined,
            onClick: typeof entry.onClick === 'function' ? () => entry.onClick(ctx) : undefined
        };
    });
}
