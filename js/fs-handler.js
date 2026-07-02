// Detect if running inside an Electron desktop window shell
const isElectron = typeof window !== 'undefined' && window.process && window.process.type;

let fs, path, ipcRenderer;
if (isElectron) {
    fs = window.require('fs');
    path = window.require('path');
    ipcRenderer = window.require('electron').ipcRenderer;
}

export async function verifyPermission(fileHandle, readWrite) {
    if (isElectron) return true; // Node.js has full native access

    const options = {};
    if (readWrite) options.mode = 'readwrite';
    if ((await fileHandle.queryPermission(options)) === 'granted') return true;
    if ((await fileHandle.requestPermission(options)) === 'granted') return true;
    return false;
}

/**
 * Dual-Mode Folder Picker: Triggers Electron's native open dialog or falls back to Web Picker
 */
export async function openDirectoryPicker() {
    if (isElectron) {
        const directoryPath = await ipcRenderer.invoke('open-directory');
        if (!directoryPath) return null;
        
        return {
            kind: 'directory',
            name: path.basename(directoryPath),
            path: directoryPath,
            isElectronMock: true
        };
    }
    return await window.showDirectoryPicker();
}

/**
 * Dual-Mode File System Scanner
 */
export async function readDirectoryEntries(dirHandle, parentHandle = null) {
    if (isElectron && dirHandle.isElectronMock) {
        const entries = [];
        const files = fs.readdirSync(dirHandle.path);
        
        for (const file of files) {
            const fullPath = path.join(dirHandle.path, file);
            const stat = fs.statSync(fullPath);
            const isDirectory = stat.isDirectory();
            
            const item = {
                name: file,
                kind: isDirectory ? 'directory' : 'file',
                handle: {
                    kind: isDirectory ? 'directory' : 'file',
                    name: file,
                    path: fullPath,
                    isElectronMock: true,
                    getFile: async () => ({
                        text: async () => fs.readFileSync(fullPath, 'utf8')
                    })
                },
                parent: parentHandle || dirHandle
            };
            
            if (isDirectory) {
                item.children = await readDirectoryEntries(item.handle, item.handle);
            }
            entries.push(item);
        }
        
        return entries.sort((a, b) => b.kind.localeCompare(a.kind) || a.name.localeCompare(b.name));
    }
    
    // Web Fallback
    const entries = [];
    for await (const entry of dirHandle.values()) {
        const item = {
            name: entry.name,
            kind: entry.kind,
            handle: entry,
            parent: parentHandle || dirHandle
        };
        if (entry.kind === 'directory') {
            item.children = await readDirectoryEntries(entry, entry);
        }
        entries.push(item);
    }
    return entries.sort((a, b) => b.kind.localeCompare(a.kind) || a.name.localeCompare(b.name));
}

export async function readFileContents(fileHandle) {
    if (isElectron && fileHandle.isElectronMock) {
        return fs.readFileSync(fileHandle.path, 'utf8');
    }
    const file = await fileHandle.getFile();
    return await file.text();
}

export async function saveFileContents(fileHandle, contents) {
    if (isElectron && fileHandle.isElectronMock) {
        fs.writeFileSync(fileHandle.path, contents, 'utf8');
        return;
    }
    const writable = await fileHandle.createWritable();
    await writable.write(contents);
    await writable.close();
}

export async function createDirectoryHandle(parentHandle, folderName) {
    if (isElectron && parentHandle.isElectronMock) {
        const newPath = path.join(parentHandle.path, folderName);
        if (!fs.existsSync(newPath)) {
            fs.mkdirSync(newPath);
        }
        return {
            kind: 'directory',
            name: folderName,
            path: newPath,
            isElectronMock: true
        };
    }
    return await parentHandle.getDirectoryHandle(folderName, { create: true });
}

export async function createFileHandle(parentHandle, fileName) {
    if (isElectron && parentHandle.isElectronMock) {
        const newPath = path.join(parentHandle.path, fileName);
        if (!fs.existsSync(newPath)) {
            fs.writeFileSync(newPath, '', 'utf8');
        }
        return {
            kind: 'file',
            name: fileName,
            path: newPath,
            isElectronMock: true,
            getFile: async () => ({
                text: async () => fs.readFileSync(newPath, 'utf8')
            })
        };
    }
    return await parentHandle.getFileHandle(fileName, { create: true });
}

export async function removeEntryHandle(parentHandle, entryName) {
    if (isElectron && parentHandle.isElectronMock) {
        const targetPath = path.join(parentHandle.path, entryName);
        const stat = fs.statSync(targetPath);
        if (stat.isDirectory()) {
            fs.rmSync(targetPath, { recursive: true, force: true });
        } else {
            fs.unlinkSync(targetPath);
        }
        return;
    }
    await parentHandle.removeEntry(entryName, { recursive: true });
}

/**
 * Calculates the path segments of a child handle relative to a parent handle.
 */
export async function resolveHandle(parentHandle, childHandle) {
    if (isElectron && parentHandle.isElectronMock && childHandle.isElectronMock) {
        // Use Node's path.relative to find the exact relative path
        const relativePath = path.relative(parentHandle.path, childHandle.path);
        if (relativePath === '') return [];
        // Split path segments by either Windows backslashes (\) or Unix forward slashes (/)
        return relativePath.split(/[\\/]/);
    }
    
    // Web Fallback
    return await parentHandle.resolve(childHandle);
}