/**
 * Project Scaffolding and Toolbar Tools for Pythonix IDE.
 */

import { createVirtualEnv } from './venv-manager.js';

export function setupProjectTools(ctx) {
    // 1. Toolbar Button: New Python Project Wizard
    ctx.addToolbarButton('new-python-project', 'New Python Project', 'fa-solid fa-cube', async () => {
        const response = await ctx.showCustomModal({
            title: "Create Python Project",
            inputs: [
                { id: "projectName", label: "Project Title", type: "text", defaultValue: "my_python_app" },
                {
                    id: "preset",
                    label: "Project Preset",
                    type: "select",
                    options: [
                        "Standard CLI App (argparse)",
                        "FastAPI Web Microservice",
                        "Data Science Starter (Pandas & Numpy)",
                        "Pygame Game Loop Starter"
                    ],
                    defaultValue: "Standard CLI App (argparse)"
                },
                { id: "createVenv", label: "Generate requirements.txt & tests", type: "checkbox", defaultValue: true }
            ],
            okLabel: "Generate Project",
            cancelLabel: "Cancel"
        });

        if (!response) return;

        const { projectName, preset, createVenv } = response;
        const files = {};
        const folders = ['src', 'tests'];

        if (preset === "FastAPI Web Microservice") {
            files['src/main.py'] = `from fastapi import FastAPI, HTTPException\n\napp = FastAPI(title="${projectName}")\n\n@app.get("/")\ndef root():\n    return {"status": "online", "app": "${projectName}"}\n\n@app.get("/health")\ndef health():\n    return {"health": "ok"}\n`;
            files['requirements.txt'] = `fastapi>=0.100.0\nuvicorn>=0.22.0\npydantic>=2.0.0\n`;
            files['README.md'] = `# ${projectName}\n\nFastAPI service created with Pythonix IDE.\n\n## Run Server:\n\`\`\`bash\nuvicorn src.main:app --reload\n\`\`\``;
        } else if (preset === "Data Science Starter (Pandas & Numpy)") {
            files['src/analysis.py'] = `import numpy as np\nimport pandas as pd\n\ndef run_analysis():\n    print("[Data Science] Generating synthetic dataset...")\n    dates = pd.date_range(start="2026-01-01", periods=10, freq="D")\n    values = np.random.randn(10).cumsum()\n    df = pd.DataFrame({"Date": dates, "Metric": values})\n    print(df)\n    return df\n\nif __name__ == "__main__":\n    run_analysis()\n`;
            files['requirements.txt'] = `numpy\npandas\nmatplotlib\n`;
            files['README.md'] = `# ${projectName}\n\nData Science analysis workspace powered by Pythonix IDE.`;
        } else if (preset === "Pygame Game Loop Starter") {
            files['src/game.py'] = `import sys\n\ndef main():\n    print("[Pygame] Initializing Game Engine loop...")\n    print("Install pygame using Pip Manager in Pythonix Sidebar to render graphics!")\n\nif __name__ == "__main__":\n    main()\n`;
            files['requirements.txt'] = `pygame>=2.5.0\n`;
            files['README.md'] = `# ${projectName}\n\nPygame 2D game project setup with Pythonix IDE.`;
        } else {
            // Standard CLI App
            files['src/main.py'] = `import argparse\nimport sys\n\ndef main():\n    parser = argparse.ArgumentParser(description="${projectName} CLI Tool")\n    parser.add_argument("--name", type=str, default="Pythonix User", help="Name to greet")\n    args = parser.parse_args()\n\n    print(f"Hello, {args.name}! Welcome to ${projectName}. 🐍")\n\nif __name__ == "__main__":\n    main()\n`;
            files['requirements.txt'] = `# Dependencies for ${projectName}\n`;
            files['README.md'] = `# ${projectName}\n\nA CLI application created with Pythonix IDE.`;
        }

        files['tests/test_main.py'] = `import unittest\n\nclass TestApp(unittest.TestCase):\n    def test_sample(self):\n        self.assertEqual(True, True)\n\nif __name__ == "__main__":\n    unittest.main()\n`;

        const result = await ctx.createProjectStructure({ folders, files });

        if (result && result.success && (result.files['src/main.py'] || result.files['src/analysis.py'] || result.files['src/game.py'])) {
            const openPath = result.files['src/main.py'] || result.files['src/analysis.py'] || result.files['src/game.py'];
            await ctx.openFile(openPath);
        }
    });

    // 2. Toolbar Button: Create Virtual Environment Tool
    ctx.addToolbarButton('create-venv-tool', 'Create .venv', 'fa-solid fa-cube', async () => {
        await createVirtualEnv(ctx);
    });

    // 3. Toolbar Button: Trigger to open Scratchpad panel
    ctx.addToolbarButton('open-scratchpad-panel', 'Scratchpad', 'fa-brands fa-python', () => {
        const tab = document.getElementById('act-btn-pythonix-ide-panel');
        if (!tab) return;

        const sidebar = document.getElementById('sidebar');
        const alreadyOpen = tab.classList.contains('active') && sidebar && !sidebar.classList.contains('collapsed-bar');

        if (!alreadyOpen) tab.click();

        setTimeout(() => {
            const panel = document.getElementById('sidebar-plugin-content');
            if (panel) {
                panel.dispatchEvent(new CustomEvent('open-scratchpad-accordion'));
            }
        }, 60);
    });
}