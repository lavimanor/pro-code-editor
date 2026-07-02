export const PROSENSE_JS = [
    // ==========================================
    // Keywords & Declarations
    // ==========================================
    { label: 'const', insertText: 'const ', type: 'keyword' },
    { label: 'let', insertText: 'let ', type: 'keyword' },
    { label: 'var', insertText: 'var ', type: 'keyword' },
    { label: 'function', insertText: 'function ', type: 'keyword' },
    { label: 'return', insertText: 'return ', type: 'keyword' },
    { label: 'export', insertText: 'export ', type: 'keyword' },
    { label: 'import', insertText: 'import ', type: 'keyword' },
    { label: 'default', insertText: 'default ', type: 'keyword' },
    { label: 'true', insertText: 'true', type: 'keyword' },
    { label: 'false', insertText: 'false', type: 'keyword' },
    { label: 'null', insertText: 'null', type: 'keyword' },
    { label: 'undefined', insertText: 'undefined', type: 'keyword' },
    { label: 'async', insertText: 'async ', type: 'keyword' },
    { label: 'await', insertText: 'await ', type: 'keyword' },
    { label: 'yield', insertText: 'yield ', type: 'keyword' },
    { label: 'typeof', insertText: 'typeof ', type: 'keyword' },
    { label: 'instanceof', insertText: 'instanceof ', type: 'keyword' },
    { label: 'this', insertText: 'this', type: 'keyword' },
    { label: 'super', insertText: 'super()', type: 'keyword' },
    { label: 'static', insertText: 'static ', type: 'keyword' },
    { label: 'extends', insertText: 'extends ', type: 'keyword' },
    { label: 'new', insertText: 'new ', type: 'keyword' },
    { label: 'throw', insertText: 'throw ', type: 'keyword' },
    { label: 'debugger', insertText: 'debugger;', type: 'keyword' },

    // ==========================================
    // Control Flow & Snippets
    // ==========================================
    { label: 'if', insertText: 'if () {\n    \n}', type: 'snippet' },
    { label: 'else', insertText: 'else {\n    \n}', type: 'snippet' },
    { label: 'else if', insertText: 'else if () {\n    \n}', type: 'snippet' },
    { label: 'for', insertText: 'for (let i = 0; i < length; i++) {\n    \n}', type: 'snippet' },
    { label: 'forOf', label: 'for...of', insertText: 'for (const item of array) {\n    \n}', type: 'snippet' },
    { label: 'forIn', label: 'for...in', insertText: 'for (const key in object) {\n    \n}', type: 'snippet' },
    { label: 'while', insertText: 'while () {\n    \n}', type: 'snippet' },
    { label: 'doWhile', insertText: 'do {\n    \n} while ();', type: 'snippet' },
    { label: 'switch', insertText: 'switch (key) {\n    case value:\n        break;\n    default:\n        break;\n}', type: 'snippet' },
    { label: 'tryCatch', label: 'try...catch', insertText: 'try {\n    \n} catch (error) {\n    console.error(error);\n}', type: 'snippet' },
    { label: 'tryCatchFinally', insertText: 'try {\n    \n} catch (error) {\n    \n} finally {\n    \n}', type: 'snippet' },
    { label: 'class', insertText: 'class Name {\n    constructor() {\n        \n    }\n}', type: 'snippet' },
    { label: 'importModule', label: 'import from', insertText: 'import {  } from "";', type: 'snippet' },
    { label: 'arrowFunction', label: '=> (arrow function)', insertText: 'const name = () => {\n    \n};', type: 'snippet' },

    // ==========================================
    // Dev Tools / Console
    // ==========================================
    { label: 'console.log', insertText: 'console.log()', type: 'function' },
    { label: 'console.error', insertText: 'console.error()', type: 'function' },
    { label: 'console.warn', insertText: 'console.warn()', type: 'function' },
    { label: 'console.table', insertText: 'console.table()', type: 'function' },
    { label: 'console.time', insertText: 'console.time("label")', type: 'function' },
    { label: 'console.timeEnd', insertText: 'console.timeEnd("label")', type: 'function' },

    // ==========================================
    // DOM Manipulation
    // ==========================================
    { label: 'document.getElementById', insertText: 'document.getElementById("")', type: 'function' },
    { label: 'document.querySelector', insertText: 'document.querySelector("")', type: 'function' },
    { label: 'document.querySelectorAll', insertText: 'document.querySelectorAll("")', type: 'function' },
    { label: 'document.createElement', insertText: 'document.createElement("")', type: 'function' },
    { label: 'addEventListener', insertText: 'addEventListener("", (e) => {\n    \n})', type: 'function' },
    { label: 'removeEventListener', insertText: 'removeEventListener("", callback)', type: 'function' },
    { label: 'classList.add', insertText: 'classList.add("")', type: 'function' },
    { label: 'classList.remove', insertText: 'classList.remove("")', type: 'function' },
    { label: 'classList.toggle', insertText: 'classList.toggle("")', type: 'function' },
    { label: 'setAttribute', insertText: 'setAttribute("", "")', type: 'function' },
    { label: 'getAttribute', insertText: 'getAttribute("")', type: 'function' },

    // ==========================================
    // Timers & Async
    // ==========================================
    { label: 'setTimeout', insertText: 'setTimeout(() => {\n    \n}, delay)', type: 'function' },
    { label: 'setInterval', insertText: 'setInterval(() => {\n    \n}, delay)', type: 'function' },
    { label: 'clearTimeout', insertText: 'clearTimeout()', type: 'function' },
    { label: 'clearInterval', insertText: 'clearInterval()', type: 'function' },
    { label: 'Promise', insertText: 'new Promise((resolve, reject) => {\n    \n})', type: 'snippet' },
    { label: 'Promise.all', insertText: 'Promise.all([])', type: 'function' },
    { label: 'Promise.resolve', insertText: 'Promise.resolve()', type: 'function' },
    { label: 'Promise.reject', insertText: 'Promise.reject()', type: 'function' },
    { label: 'fetch', insertText: 'fetch("url")\n    .then(response => response.json())\n    .then(data => {\n        \n    })\n    .catch(error => console.error(error));', type: 'snippet' },
    { label: 'fetchAsync', label: 'fetch (async/await)', insertText: 'const response = await fetch("url");\nconst data = await response.json();', type: 'snippet' },

    // ==========================================
    // JSON & Global Methods
    // ==========================================
    { label: 'JSON.stringify', insertText: 'JSON.stringify()', type: 'function' },
    { label: 'JSON.parse', insertText: 'JSON.parse()', type: 'function' },
    { label: 'parseInt', insertText: 'parseInt()', type: 'function' },
    { label: 'parseFloat', insertText: 'parseFloat()', type: 'function' },
    { label: 'isNaN', insertText: 'isNaN()', type: 'function' },
    { label: 'encodeURIComponent', insertText: 'encodeURIComponent()', type: 'function' },
    { label: 'decodeURIComponent', insertText: 'decodeURIComponent()', type: 'function' },

    // ==========================================
    // Array High-Order Methods
    // ==========================================
    { label: 'forEach', label: 'Array.forEach', insertText: 'forEach(item => {\n    \n})', type: 'function' },
    { label: 'map', label: 'Array.map', insertText: 'map(item => {\n    return \n})', type: 'function' },
    { label: 'filter', label: 'Array.filter', insertText: 'filter(item => {\n    return \n})', type: 'function' },
    { label: 'reduce', label: 'Array.reduce', insertText: 'reduce((accumulator, currentValue) => {\n    return accumulator;\n}, initialValue)', type: 'function' },
    { label: 'find', label: 'Array.find', insertText: 'find(item => item.id === id)', type: 'function' },
    { label: 'findIndex', label: 'Array.findIndex', insertText: 'findIndex(item => item.id === id)', type: 'function' },
    { label: 'includes', label: 'Array.includes', insertText: 'includes(value)', type: 'function' },
    { label: 'some', label: 'Array.some', insertText: 'some(item => \n)', type: 'function' },
    { label: 'every', label: 'Array.every', insertText: 'every(item => \n)', type: 'function' },
    { label: 'Array.isArray', insertText: 'Array.isArray()', type: 'function' },
    { label: 'Array.from', insertText: 'Array.from()', type: 'function' },

    // ==========================================
    // Object Methods
    // ==========================================
    { label: 'Object.keys', insertText: 'Object.keys()', type: 'function' },
    { label: 'Object.values', insertText: 'Object.values()', type: 'function' },
    { label: 'Object.entries', insertText: 'Object.entries()', type: 'function' },
    { label: 'Object.assign', insertText: 'Object.assign({}, )', type: 'function' },
    { label: 'Object.freeze', insertText: 'Object.freeze()', type: 'function' },

    // ==========================================
    // String & Math Methods
    // ==========================================
    { label: 'String.prototype.replace', label: 'replace', insertText: 'replace("", "")', type: 'function' },
    { label: 'String.prototype.replaceAll', label: 'replaceAll', insertText: 'replaceAll("", "")', type: 'function' },
    { label: 'String.prototype.split', label: 'split', insertText: 'split("")', type: 'function' },
    { label: 'String.prototype.trim', label: 'trim', insertText: 'trim()', type: 'function' },
    { label: 'Math.random', insertText: 'Math.random()', type: 'function' },
    { label: 'Math.floor', insertText: 'Math.floor()', type: 'function' },
    { label: 'Math.ceil', insertText: 'Math.ceil()', type: 'function' },
    { label: 'Math.round', insertText: 'Math.round()', type: 'function' },
    { label: 'Math.max', insertText: 'Math.max()', type: 'function' },
    { label: 'Math.min', insertText: 'Math.min()', type: 'function' },

    // ==========================================
    // Modern Storage & State APIs
    // ==========================================
    { label: 'localStorage.setItem', insertText: 'localStorage.setItem("", "")', type: 'function' },
    { label: 'localStorage.getItem', insertText: 'localStorage.getItem("")', type: 'function' },
    { label: 'localStorage.removeItem', insertText: 'localStorage.removeItem("")', type: 'function' },
    { label: 'sessionStorage.setItem', insertText: 'sessionStorage.setItem("", "")', type: 'function' },
    { label: 'sessionStorage.getItem', insertText: 'sessionStorage.getItem("")', type: 'function' }
];