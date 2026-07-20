export function registerPythonixIcons(api) {
    try {
        api.icons.register('pythonix-icons', {
            name: 'Pythonix Modern Icons',
            
            // Standardizes the folder icon to match the editor's built-in line weight
            getFolderIcon: () => {
                return `<i class="fa-solid fa-folder" style="color: #dcb35c; font-size: 14px; vertical-align: middle;"></i>`;
            },
            
            getFileIcon: (fileName) => {
                const ext = fileName.split('.').pop().toLowerCase();
                
                // Helper to create clean typographic badges for compiled/custom languages
                const makeBadge = (text, color) => {
                    return `
                        <span style="
                            color: ${color}; 
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                            font-weight: 800; 
                            font-size: 8px; 
                            border: 1px solid ${color}; 
                            border-radius: 3px; 
                            padding: 0px 3px; 
                            display: inline-block; 
                            line-height: 1.3; 
                            vertical-align: middle;
                        ">${text}</span>
                    `;
                };

                // Map file extensions directly to styled FontAwesome glyphs or badges
                switch (ext) {
                    case 'py':
                    case 'pyw':
                    case 'pyi':
                        return `<i class="fa-brands fa-python" style="color: #3572A5; font-size: 14px; vertical-align: middle;"></i>`;
                    
                    case 'js':
                    case 'mjs':
                    case 'cjs':
                        return `<i class="fa-brands fa-square-js" style="color: #f1e05a; font-size: 14px; vertical-align: middle;"></i>`;
                    
                    case 'ts':
                        return makeBadge('TS', '#3178C6');
                    
                    case 'html':
                    case 'htm':
                        return `<i class="fa-brands fa-html5" style="color: #e34c26; font-size: 14px; vertical-align: middle;"></i>`;
                    
                    case 'css':
                        return `<i class="fa-brands fa-css3-alt" style="color: #563d7c; font-size: 14px; vertical-align: middle;"></i>`;
                    
                    case 'json':
                        return `<i class="fa-solid fa-code" style="color: #2b7489; font-size: 13px; vertical-align: middle;"></i>`;
                    
                    case 'md':
                        return `<i class="fa-brands fa-markdown" style="color: #083fa1; font-size: 14px; vertical-align: middle;"></i>`;
                    
                    case 'cpp':
                    case 'cc':
                    case 'h':
                    case 'hpp':
                        return makeBadge('C++', '#f34b7d');

                    case 'c':
                        return makeBadge('C', '#555555');

                    case 'java':
                        return `<i class="fa-brands fa-java" style="color: #f89820; font-size: 14px; vertical-align: middle;"></i>`;

                    case 'cs':
                        return makeBadge('C#', '#854cc7');

                    case 'lua':
                        return makeBadge('LUA', '#000080');
                    
                    case 'rs':
                        return `<i class="fa-brands fa-rust" style="color: #e26d28; font-size: 14px; vertical-align: middle;"></i>`;

                    case 'png':
                    case 'jpg':
                    case 'jpeg':
                    case 'gif':
                    case 'webp':
                        return `<i class="fa-solid fa-file-image" style="color: #4caf50; font-size: 14px; vertical-align: middle;"></i>`;

                    case 'svg':
                        return makeBadge('SVG', '#f57c00');

                    case 'txt':
                        return `<i class="fa-solid fa-file-lines" style="color: #a0aec0; font-size: 14px; vertical-align: middle;"></i>`;
                    
                    default:
                        // Crisp fallback icon for files without registered extensions
                        return `<i class="fa-solid fa-file-code" style="color: #718096; font-size: 14px; vertical-align: middle;"></i>`;
                }
            }
        });
        
        console.log("Pythonix FontAwesome-backed icons registered.");
    } catch (error) {
        console.error("Could not register Pythonix icons:", error);
    }
}