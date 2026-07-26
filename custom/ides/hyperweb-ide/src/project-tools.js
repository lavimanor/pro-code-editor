/**
 * Project Scaffolding and Toolbar Tools for HyperWeb IDE.
 */

export function setupProjectTools(ctx) {
    // 1. Toolbar Button: New Web Project Wizard
    ctx.addToolbarButton('new-web-project', 'New Web Project', 'fa-solid fa-wand-magic-sparkles', async () => {
        const response = await ctx.showCustomModal({
            title: "Create Web Project",
            inputs: [
                { id: "projectName", label: "Project Title", type: "text", defaultValue: "My Web App" },
                {
                    id: "template",
                    label: "Project Template",
                    type: "select",
                    options: [
                        "HTML5 & CSS3 Modern Starter",
                        "Responsive Dashboard Layout",
                        "Single Page App (JS + CSS)",
                        "Tailwind CDN Quickstart"
                    ],
                    defaultValue: "HTML5 & CSS3 Modern Starter"
                },
                { id: "includeJs", label: "Include JavaScript app module", type: "checkbox", defaultValue: true }
            ],
            okLabel: "Generate Project",
            cancelLabel: "Cancel"
        });

        if (!response) return;

        const { projectName, template, includeJs } = response;
        let htmlContent = '';
        let cssContent = '';
        let jsContent = '';

        if (template === "Tailwind CDN Quickstart") {
            htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName}</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen flex flex-col items-center justify-center p-6">
    <div class="max-w-md w-full bg-slate-800 p-8 rounded-xl shadow-2xl border border-slate-700 text-center">
        <div class="w-16 h-16 bg-cyan-500/10 text-cyan-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-cyan-500/30">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
        </div>
        <h1 class="text-2xl font-bold text-white mb-2">${projectName}</h1>
        <p class="text-slate-400 text-sm mb-6">TailwindCSS-powered static web layout build with HyperWeb IDE.</p>
        <button id="action-btn" class="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-slate-900 font-semibold rounded-lg shadow-lg transition-all transform hover:-translate-y-0.5">
            Get Started
        </button>
    </div>
    ${includeJs ? '<script src="app.js"></script>' : ''}
</body>
</html>`;
            cssContent = `/* Custom styles alongside Tailwind */\nbody { font-family: system-ui, -apple-system, sans-serif; }\n`;
        } else if (template === "Responsive Dashboard Layout") {
            htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName} — Dashboard</title>
    <link rel="stylesheet" href="style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body>
    <div class="app-layout">
        <aside class="sidebar">
            <div class="logo"><i class="fa-solid fa-bolt"></i> HyperWeb</div>
            <nav class="nav-menu">
                <a href="#" class="nav-item active"><i class="fa-solid fa-chart-pie"></i> Overview</a>
                <a href="#" class="nav-item"><i class="fa-solid fa-box"></i> Products</a>
                <a href="#" class="nav-item"><i class="fa-solid fa-users"></i> Users</a>
                <a href="#" class="nav-item"><i class="fa-solid fa-gear"></i> Settings</a>
            </nav>
        </aside>
        <main class="main-content">
            <header class="top-bar">
                <h2>${projectName}</h2>
                <div class="user-profile"><i class="fa-solid fa-user-circle"></i> Developer</div>
            </header>
            <section class="grid-container">
                <div class="card">
                    <h3>Total Revenue</h3>
                    <p class="metric">$24,500</p>
                </div>
                <div class="card">
                    <h3>Active Users</h3>
                    <p class="metric">1,280</p>
                </div>
                <div class="card">
                    <h3>Conversion Rate</h3>
                    <p class="metric">3.4%</p>
                </div>
            </section>
        </main>
    </div>
    ${includeJs ? '<script src="app.js"></script>' : ''}
</body>
</html>`;
            cssContent = `:root {
    --bg-dark: #0f172a;
    --bg-card: #1e293b;
    --accent: #06b6d4;
    --text-main: #f8fafc;
    --text-muted: #94a3b8;
    --border: #334155;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--bg-dark); color: var(--text-main); font-family: system-ui, sans-serif; }
.app-layout { display: flex; min-height: 100vh; }
.sidebar { width: 220px; background: #020617; border-right: 1px solid var(--border); padding: 20px; }
.logo { font-size: 18px; font-weight: 700; color: var(--accent); display: flex; align-items: center; gap: 8px; margin-bottom: 30px; }
.nav-menu { display: flex; flex-direction: column; gap: 8px; }
.nav-item { color: var(--text-muted); text-decoration: none; padding: 10px; border-radius: 6px; display: flex; align-items: center; gap: 10px; font-size: 14px; }
.nav-item.active, .nav-item:hover { background: var(--bg-card); color: var(--accent); }
.main-content { flex: 1; padding: 24px; }
.top-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 16px; margin-bottom: 24px; }
.grid-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; }
.card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 20px; }
.card h3 { font-size: 13px; color: var(--text-muted); font-weight: 500; }
.card .metric { font-size: 28px; font-weight: 700; color: var(--accent); margin-top: 8px; }`;
        } else {
            // HTML5 & CSS3 Starter
            htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName}</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <header class="header">
            <h1 class="title">⚡ ${projectName}</h1>
            <p class="subtitle">Built with HyperWeb IDE</p>
        </header>

        <main class="content">
            <div class="card">
                <h2>Welcome to your Web Workspace</h2>
                <p>Edit HTML, CSS, and JS files with instant structure outline and design tools.</p>
                <button id="btn-click" class="btn">Interactive Demo</button>
            </div>
        </main>
    </div>
    ${includeJs ? '<script src="app.js"></script>' : ''}
</body>
</html>`;
            cssContent = `/* HyperWeb Design Tokens */
:root {
    --primary: #00b4d8;
    --primary-hover: #0077b6;
    --bg-main: #0b0f19;
    --bg-card: #161e2e;
    --text-main: #f3f4f6;
    --text-muted: #9ca3af;
    --border: #1f293d;
    --radius: 12px;
}

body {
    background-color: var(--bg-main);
    color: var(--text-main);
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 0;
}

.container {
    max-width: 600px;
    width: 90%;
    text-align: center;
}

.title {
    font-size: 2.2rem;
    color: var(--primary);
    margin-bottom: 0.25rem;
}

.subtitle {
    color: var(--text-muted);
    font-size: 1rem;
    margin-bottom: 2rem;
}

.card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 2.5rem;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
}

.card h2 {
    font-size: 1.4rem;
    margin-bottom: 1rem;
}

.card p {
    color: var(--text-muted);
    line-height: 1.6;
    margin-bottom: 1.5rem;
}

.btn {
    background-color: var(--primary);
    color: #ffffff;
    border: none;
    padding: 0.75rem 1.5rem;
    font-size: 0.95rem;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.btn:hover {
    background-color: var(--primary-hover);
    transform: translateY(-2px);
}`;
        }

        if (includeJs) {
            jsContent = `// ${projectName} JavaScript Module
document.addEventListener('DOMContentLoaded', () => {
    console.log('[HyperWeb] App initialized successfully.');

    const btn = document.getElementById('btn-click') || document.getElementById('action-btn');
    if (btn) {
        btn.addEventListener('click', () => {
            alert('🚀 Hello from ${projectName}! Web app is fully interactive.');
        });
    }
});`;
        }

        const files = {
            'index.html': htmlContent,
            'style.css': cssContent
        };
        if (includeJs) {
            files['app.js'] = jsContent;
        }

        const result = await ctx.createProjectStructure({
            folders: [],
            files
        });

        if (result && result.success && result.files['index.html']) {
            await ctx.openFile(result.files['index.html']);
        }
    });

    // 2. Toolbar Button: CSS & Design Generator Helper Modal
    ctx.addToolbarButton('web-design-tools', 'Design Studio', 'fa-solid fa-palette', async () => {
        const response = await ctx.showCustomModal({
            title: "CSS & Design Tools",
            inputs: [
                {
                    id: "toolType",
                    label: "Select Tool / Generator",
                    type: "select",
                    options: [
                        "CSS Glassmorphism Card",
                        "Modern Box Shadow Preset",
                        "Gradient Background CSS Variables",
                        "Flexbox Centering Boilerplate"
                    ],
                    defaultValue: "CSS Glassmorphism Card"
                }
            ],
            okLabel: "Insert Snippet into Active File",
            cancelLabel: "Cancel"
        });

        if (!response) return;

        let snippet = '';
        switch (response.toolType) {
            case 'CSS Glassmorphism Card':
                snippet = `\n/* Glassmorphism Card */\n.glass-card {\n    background: rgba(255, 255, 255, 0.05);\n    backdrop-filter: blur(12px);\n    -webkit-backdrop-filter: blur(12px);\n    border: 1px solid rgba(255, 255, 255, 0.1);\n    border-radius: 16px;\n    padding: 24px;\n    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);\n}\n`;
                break;
            case 'Modern Box Shadow Preset':
                snippet = `\n/* Soft Elevation Shadow */\n.elevated-shadow {\n    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);\n}\n.glow-shadow {\n    box-shadow: 0 0 20px rgba(0, 180, 216, 0.4);\n}\n`;
                break;
            case 'Gradient Background CSS Variables':
                snippet = `\n/* Modern Gradient Variables */\n:root {\n    --grad-primary: linear-gradient(135deg, #00b4d8 0%, #7209b7 100%);\n    --grad-dark: linear-gradient(180deg, #0f172a 0%, #020617 100%);\n    --grad-sunset: linear-gradient(45deg, #ff007f 0%, #7928ca 100%);\n}\n`;
                break;
            case 'Flexbox Centering Boilerplate':
                snippet = `\n/* Flexbox Center Helper */\n.flex-center {\n    display: flex;\n    justify-content: center;\n    align-items: center;\n}\n`;
                break;
        }

        ctx.editor.insertAtCursor(snippet);
        ctx.notify('Inserted CSS design snippet into active editor', 'success');
    });

    // 3. Toolbar Button: Open Sidebar Web Playground
    ctx.addToolbarButton('open-hyperweb-sidebar', 'Web Tools', 'fa-solid fa-globe', () => {
        const tab = document.getElementById('act-btn-hyperweb-ide-panel');
        if (!tab) return;

        const sidebar = document.getElementById('sidebar');
        const alreadyOpen = tab.classList.contains('active') && sidebar && !sidebar.classList.contains('collapsed-bar');

        if (!alreadyOpen) tab.click();

        setTimeout(() => {
            const panel = document.getElementById('sidebar-plugin-content');
            if (panel) {
                panel.dispatchEvent(new CustomEvent('open-sandbox-accordion'));
            }
        }, 60);
    });

    // 4. Toolbar Button: Go Live Server Shortcut
    ctx.addToolbarButton('web-go-live', 'Go Live', 'fa-solid fa-wifi', () => {
        // Trigger core Go Live status bar toggle if available
        const liveBtn = document.getElementById('status-live-server') || document.querySelector('[title*="Live Server"]');
        if (liveBtn) {
            liveBtn.click();
        } else {
            ctx.notify('Starting local preview server... Click Live Server in status bar', 'info');
        }
    });
}
