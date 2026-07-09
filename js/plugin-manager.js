import { printToTerminal } from './terminal.js';
import { api } from './api-core.js';

const CORE_API_VERSION = '1.0.0';

export class PluginManager {
    constructor() {
        this.plugins = [];
        this.isElectron = typeof window !== 'undefined' && window.process && window.process.type;
        this.ipcRenderer = null;
        if (this.isElectron) {
            this.ipcRenderer = window.require('electron').ipcRenderer;
        }
    }

    /**
     * Bootstraps the discovery and loading process.
     */
    async initialize() {
        printToTerminal('[System] Initializing plugin scanner...', 'system');
        
        try {
            const scanned = await this.scan();
            await this.validateAndRegister(scanned);
        } catch (err) {
            printToTerminal(`[System Error] Scanning phase failed: ${err.message}`, 'system');
        }
    }

    /**
     * Invokes scanning on the appropriate runtime channel.
     */
    async scan() {
        if (this.isElectron && this.ipcRenderer) {
            return await this.ipcRenderer.invoke('scan-plugins');
        } else {
            printToTerminal('[System] Running in browser context. Dynamic disk plugin scanning is disabled.', 'system');
            return [];
        }
    }

    /**
     * Validates, registers, and activates discovered manifests.
     */
    async validateAndRegister(scannedPlugins) {
        if (scannedPlugins.length === 0) {
            printToTerminal('[System] No custom extensions or IDEs discovered.', 'system');
            return;
        }

        for (const plugin of scannedPlugins) {
            if (plugin.error) {
                printToTerminal(`[Plugin Warning] Skipping "${plugin._dirName}": ${plugin.error}`, 'system');
                continue;
            }

            const { id, name, version, apiVersion, type, main } = plugin;

            // Enforce schema completeness
            if (!id || !name || !version || !apiVersion || !type) {
                printToTerminal(`[Plugin Warning] Skipping "${plugin._dirName}": Missing required package.json fields (id, name, version, apiVersion, or type).`, 'system');
                continue;
            }

            // Check API version compatibility
            if (!this.isCompatible(apiVersion)) {
                printToTerminal(`[Plugin Error] "${name}" (${id}) requires API version ${apiVersion}. Host API version is ${CORE_API_VERSION}.`, 'system');
                continue;
            }

            this.plugins.push(plugin);
            printToTerminal(`[System] Discovered and validated ${type}: ${name} [v${version}]`, 'system');

            // Dynamically activate the plugin if an entry point is defined
            if (main) {
                const entryUrl = `../${plugin._relativePath}/${main}`;
                try {
                    const module = await import(entryUrl);
                    if (typeof module.activate === 'function') {
                        module.activate(api);
                        printToTerminal(`[System] Activated plugin: ${name}`, 'system');
                    } else {
                        printToTerminal(`[Plugin Warning] "${name}" does not export an "activate" function.`, 'system');
                    }
                } catch (err) {
                    printToTerminal(`[Plugin Error] Failed to activate "${name}": ${err.message}`, 'system');
                    console.error(err);
                }
            }
        }

        printToTerminal(`[System] Scanning complete. Active plugin(s): ${this.plugins.length}`, 'system');
    }

    /**
     * Validates compatibility based on major version alignment.
     */
    isCompatible(pluginApiVersion) {
        const coreParts = CORE_API_VERSION.split('.');
        const pluginParts = pluginApiVersion.split('.');
        return coreParts[0] === pluginParts[0];
    }

    getPlugins() {
        return this.plugins;
    }
}

export const pluginManager = new PluginManager();