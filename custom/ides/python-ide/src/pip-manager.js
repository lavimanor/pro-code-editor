export function registerPipManager(api) {
    api.views.registerSidebarPanel('pip-manager', {
        iconClass: 'fa-solid fa-cubes',
        title: 'Pip Packages',
        render: (container) => {
            container.innerHTML = `
                <div style="padding: 12px; font-family: sans-serif; color: #fff; display: flex; flex-direction: column; gap: 12px; height: 100%; position: relative;">
                    <h4 style="margin: 0; color: #3572A5; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-cubes"></i> Pip Package Manager
                    </h4>
                    <p style="margin: 0; font-size: 11px; color: #888;">Install and manage Python packages globally or in your local workspace environment.</p>
                    
                    <div style="display: flex; gap: 6px;">
                        <input id="pip-input" type="text" placeholder="e.g. requests" style="flex: 1; padding: 6px 10px; background: #1e1e1e; border: 1px solid #3c3c3c; border-radius: 4px; color: #fff; font-size: 12px;" />
                        <button id="pip-install-btn" style="padding: 6px 12px; background: #3572A5; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 12px; font-weight: 500;">
                            Install
                        </button>
                    </div>

                    <hr style="border: 0; border-top: 1px solid #2d2d2d; margin: 4px 0;" />

                    <div style="font-weight: 600; font-size: 11px; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px;">Popular Libraries</div>
                    
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <div class="pkg-row" data-pkg="requests" style="background: #181818; border: 1px solid #2d2d2d; border-radius: 4px; padding: 8px; display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; flex-direction: column; gap: 2px;">
                                <span style="font-size: 12px; font-weight: 600; color: #fff;">requests</span>
                                <span style="font-size: 10px; color: #888;">HTTP library for Python</span>
                            </div>
                            <button class="pkg-add-btn" style="padding: 4px 8px; background: transparent; border: 1px solid #3572A5; border-radius: 4px; color: #3572A5; cursor: pointer; font-size: 10px;">Add</button>
                        </div>

                        <div class="pkg-row" data-pkg="numpy" style="background: #181818; border: 1px solid #2d2d2d; border-radius: 4px; padding: 8px; display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; flex-direction: column; gap: 2px;">
                                <span style="font-size: 12px; font-weight: 600; color: #fff;">numpy</span>
                                <span style="font-size: 10px; color: #888;">Scientific computing library</span>
                            </div>
                            <button class="pkg-add-btn" style="padding: 4px 8px; background: transparent; border: 1px solid #3572A5; border-radius: 4px; color: #3572A5; cursor: pointer; font-size: 10px;">Add</button>
                        </div>

                        <div class="pkg-row" data-pkg="pandas" style="background: #181818; border: 1px solid #2d2d2d; border-radius: 4px; padding: 8px; display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; flex-direction: column; gap: 2px;">
                                <span style="font-size: 12px; font-weight: 600; color: #fff;">pandas</span>
                                <span style="font-size: 10px; color: #888;">Data analysis toolset</span>
                            </div>
                            <button class="pkg-add-btn" style="padding: 4px 8px; background: transparent; border: 1px solid #3572A5; border-radius: 4px; color: #3572A5; cursor: pointer; font-size: 10px;">Add</button>
                        </div>
                    </div>
                </div>
            `;

            // Inline, elegant widget popup function to replace system alerts
            const showNotificationPopup = (packageName) => {
                // Delete active instances
                const existing = container.querySelector('.widget-popup');
                if (existing) existing.remove();

                const popup = document.createElement('div');
                popup.className = 'widget-popup';
                popup.style.cssText = `
                    position: absolute;
                    bottom: 12px;
                    left: 12px;
                    right: 12px;
                    background: #1e1e1e;
                    border: 1px solid #3572A5;
                    border-radius: 6px;
                    padding: 10px;
                    color: #fff;
                    font-size: 11px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    z-index: 10;
                    transform: translateY(20px);
                    opacity: 0;
                    transition: transform 0.2s ease-out, opacity 0.2s ease-out;
                `;

                popup.innerHTML = `
                    <div style="font-weight: 600; color: #3572A5; display: flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-spinner fa-spin"></i> Package Installation Initiated
                    </div>
                    <div style="color: #aaa; font-size: 10px;">Triggered local workspace package installation framework for: <strong>${packageName}</strong>.</div>
                `;

                container.appendChild(popup);

                // Trigger slide-in animation
                setTimeout(() => {
                    popup.style.transform = 'translateY(0)';
                    popup.style.opacity = '1';
                }, 20);

                // Self-dismiss mechanism
                setTimeout(() => {
                    popup.style.transform = 'translateY(10px)';
                    popup.style.opacity = '0';
                    setTimeout(() => popup.remove(), 200);
                }, 3500);
            };

            // Setup listeners
            const installBtn = container.querySelector('#pip-install-btn');
            const inputField = container.querySelector('#pip-input');
            
            installBtn.addEventListener('click', () => {
                const pkgName = inputField.value.trim();
                if (pkgName) {
                    showNotificationPopup(pkgName);
                    inputField.value = '';
                }
            });

            container.querySelectorAll('.pkg-row').forEach(row => {
                const pkgName = row.getAttribute('data-pkg');
                const addBtn = row.querySelector('.pkg-add-btn');
                addBtn.addEventListener('click', () => {
                    showNotificationPopup(pkgName);
                });
            });
        }
    });
}