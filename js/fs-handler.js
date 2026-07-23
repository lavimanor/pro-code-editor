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
        try {
            // Guard: Safe-scan directories to prevent permission crashes
            const files = fs.readdirSync(dirHandle.path);
            
            for (const file of files) {
                const fullPath = path.join(dirHandle.path, file);
                try {
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
                } catch (statErr) {
                    // Gracefully skip restricted system files/symlinks without failing the entire tree
                    console.warn(`Skipping restricted directory entry: ${fullPath}`, statErr);
                }
            }
        } catch (dirErr) {
            console.error(`Failed to read directory: ${dirHandle.path}`, dirErr);
        }
        
        return entries.sort((a, b) => b.kind.localeCompare(a.kind) || a.name.localeCompare(b.name));
    }
    
    // Web Fallback (remains identical)
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

/** True when an entry with `name` already lives inside `parentHandle`. */
export async function entryExists(parentHandle, name) {
    if (isElectron && parentHandle.isElectronMock) {
        return fs.existsSync(path.join(parentHandle.path, name));
    }
    try {
        await parentHandle.getFileHandle(name);
        return true;
    } catch (err) {
        try {
            await parentHandle.getDirectoryHandle(name);
            return true;
        } catch (err2) {
            return false;
        }
    }
}

/**
 * Renames a file or directory in place and returns a handle to the renamed entry.
 * The Web File System API has no rename primitive, so the fallback copies and removes.
 */
export async function renameEntryHandle(parentHandle, item, newName) {
    if (isElectron && parentHandle.isElectronMock) {
        const oldPath = item.handle.path;
        const newPath = path.join(parentHandle.path, newName);
        fs.renameSync(oldPath, newPath);
        return buildElectronHandle(newPath, item.kind);
    }

    if (item.kind === 'file') {
        const contents = await readFileContents(item.handle);
        const newHandle = await createFileHandle(parentHandle, newName);
        await saveFileContents(newHandle, contents);
        await parentHandle.removeEntry(item.name);
        return newHandle;
    }

    const newDir = await createDirectoryHandle(parentHandle, newName);
    await copyDirectoryWeb(item.handle, newDir);
    await parentHandle.removeEntry(item.name, { recursive: true });
    return newDir;
}

/**
 * Copies a file or directory (recursively) into `targetDirHandle` under `newName`.
 * Returns a handle to the copy.
 */
export async function copyEntryHandle(item, targetDirHandle, newName) {
    const name = newName || item.name;

    if (isElectron && targetDirHandle.isElectronMock) {
        const destPath = path.join(targetDirHandle.path, name);
        copyRecursive(item.handle.path, destPath);
        return buildElectronHandle(destPath, item.kind);
    }

    if (item.kind === 'file') {
        const contents = await readFileContents(item.handle);
        const newHandle = await createFileHandle(targetDirHandle, name);
        await saveFileContents(newHandle, contents);
        return newHandle;
    }

    const newDir = await createDirectoryHandle(targetDirHandle, name);
    await copyDirectoryWeb(item.handle, newDir);
    return newDir;
}

/**
 * Picks a free name inside `parentHandle` by appending " copy", " copy 2", ...
 * while preserving the file extension.
 */
export async function resolveAvailableName(parentHandle, baseName, kind) {
    const dotIdx = kind === 'file' ? baseName.lastIndexOf('.') : -1;
    const stem = dotIdx > 0 ? baseName.slice(0, dotIdx) : baseName;
    const ext = dotIdx > 0 ? baseName.slice(dotIdx) : '';

    let candidate = `${stem} copy${ext}`;
    let counter = 2;
    while (await entryExists(parentHandle, candidate)) {
        candidate = `${stem} copy ${counter}${ext}`;
        counter++;
    }
    return candidate;
}

function buildElectronHandle(fullPath, kind) {
    return {
        kind,
        name: path.basename(fullPath),
        path: fullPath,
        isElectronMock: true,
        getFile: async () => ({
            text: async () => fs.readFileSync(fullPath, 'utf8')
        })
    };
}

function copyRecursive(src, dest) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        for (const child of fs.readdirSync(src)) {
            copyRecursive(path.join(src, child), path.join(dest, child));
        }
    } else {
        fs.copyFileSync(src, dest);
    }
}

async function copyDirectoryWeb(sourceDirHandle, targetDirHandle) {
    for await (const entry of sourceDirHandle.values()) {
        if (entry.kind === 'file') {
            const file = await entry.getFile();
            const contents = await file.text();
            const newFile = await targetDirHandle.getFileHandle(entry.name, { create: true });
            const writable = await newFile.createWritable();
            await writable.write(contents);
            await writable.close();
        } else {
            const subDir = await targetDirHandle.getDirectoryHandle(entry.name, { create: true });
            await copyDirectoryWeb(entry, subDir);
        }
    }
}

/**
 * Calculates the path segments of a child handle relative to a parent handle.
 */
export async function resolveHandle(parentHandle, childHandle) {
    if (!parentHandle || !childHandle) return null;
    
    // Guard: Prevent resolving virtual handles (like the Settings tab)
    if (childHandle.isSettings) return null;

    if (isElectron && parentHandle.isElectronMock && childHandle.isElectronMock) {
        // Use Node's path.relative to find the exact relative path
        const relativePath = path.relative(parentHandle.path, childHandle.path);
        if (relativePath === '') return [];
        // Split path segments by either Windows backslashes (\) or Unix forward slashes (/)
        return relativePath.split(/[\\/]/);
    }
    
    // Web Fallback with robust type checking
    if (typeof parentHandle.resolve === 'function') {
        try {
            return await parentHandle.resolve(childHandle);
        } catch (err) {
            console.warn('Web resolve failed:', err);
            return null;
        }
    }
    return null;
}