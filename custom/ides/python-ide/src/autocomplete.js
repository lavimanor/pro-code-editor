export function registerPythonAutocomplete(api) {
    api.languages.register('python', {
        name: 'Python',
        extensions: ['py', 'pyw'],
        parser: 'python',
        
        // Local parsing rules to index custom defined variables or functions on the fly
        parserRules: [
            { regex: /def\s+([a-zA-Z_]\w*)/g, group: 1, type: 'function' },
            { regex: /class\s+([a-zA-Z_]\w*)/g, group: 1, type: 'class-name' }
        ],

        // Predefined ProSense database
        db: [
            // Structural snippets
            { label: 'def', insertText: 'def ${1:func_name}(${2:args}):\n    ${0:pass}', type: 'keyword', detail: 'Define function template' },
            { label: 'class', insertText: 'class ${1:ClassName}:\n    def __init__(self):\n        ${0:pass}', type: 'keyword', detail: 'Class declaration template' },
            { label: 'if-main', insertText: 'if __name__ == "__main__":\n    ${0:main()}', type: 'keyword', detail: 'Main block boilerplate' },
            
            // Core keywords
            { label: 'import', insertText: 'import ${0:module}', type: 'keyword', detail: 'Import Python package' },
            { label: 'from', insertText: 'from ${1:package} import ${0:module}', type: 'keyword', detail: 'Import selective components' },
            { label: 'try', insertText: 'try:\n    ${1:pass}\nexcept ${2:Exception} as e:\n    ${0:raise e}', type: 'keyword', detail: 'Try-except block' },
            
            // Standard built-ins
            { label: 'print', insertText: 'print(${0})', type: 'function', detail: 'Prints message to standard output' },
            { label: 'len', insertText: 'len(${0})', type: 'function', detail: 'Return length of collection' },
            { label: 'enumerate', insertText: 'enumerate(${1:iterable})', type: 'function', detail: 'Generate indexed loops' }
        ]
    });
}