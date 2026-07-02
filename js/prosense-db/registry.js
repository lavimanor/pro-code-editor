import { PROSENSE_HTML } from './prosense-html.js';
import { PROSENSE_CSS } from './prosense-css.js';
import { PROSENSE_JS } from './prosense-js.js';
import { PROSENSE_JAVA } from './prosense-java.js';
import { PROSENSE_CS } from './prosense-cs.js';
import { PROSENSE_PY } from './prosense-py.js';
import { PROSENSE_C } from './prosense-c.js';
import { PROSENSE_CPP } from './prosense-cpp.js';
import { PROSENSE_LUA } from './prosense-lua.js';

export const LANGUAGE_REGISTRY = {
    'html': { db: PROSENSE_HTML, parser: 'markup' },
    'htm': { db: PROSENSE_HTML, parser: 'markup' },
    'css': { db: PROSENSE_CSS, parser: 'style' },
    'js': { db: PROSENSE_JS, parser: 'js' },
    'mjs': { db: PROSENSE_JS, parser: 'js' },
    'cjs': { db: PROSENSE_JS, parser: 'js' },
    'java': { db: PROSENSE_JAVA, parser: 'java' },
    'cs': { db: PROSENSE_CS, parser: 'csharp' },
    'py': { db: PROSENSE_PY, parser: 'python' },
    'c': { db: PROSENSE_C, parser: 'c' },
    'h': { db: PROSENSE_C, parser: 'c' },
    'cpp': { db: PROSENSE_CPP, parser: 'cpp' },
    'hpp': { db: PROSENSE_CPP, parser: 'cpp' },
    'cc': { db: PROSENSE_CPP, parser: 'cpp' },
    'cxx': { db: PROSENSE_CPP, parser: 'cpp' },
    'lua': { db: PROSENSE_LUA, parser: 'lua' }
};