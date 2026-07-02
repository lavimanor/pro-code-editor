export const PROSENSE_LUA = [
    // ==========================================
    // Keywords & Logical Operators
    // ==========================================
    { label: 'and', insertText: 'and ', type: 'keyword' },
    { label: 'or', insertText: 'or ', type: 'keyword' },
    { label: 'not', insertText: 'not ', type: 'keyword' },
    { label: 'true', insertText: 'true', type: 'keyword' },
    { label: 'false', insertText: 'false', type: 'keyword' },
    { label: 'nil', insertText: 'nil', type: 'keyword' },
    { label: 'local', insertText: 'local ', type: 'keyword' },
    { label: 'return', insertText: 'return ', type: 'keyword' },
    { label: 'break', insertText: 'break', type: 'keyword' },
    { label: 'goto', insertText: 'goto ', type: 'keyword' }, // Lua 5.2+
    { label: 'in', insertText: 'in ', type: 'keyword' },
    { label: 'then', insertText: 'then\n    ', type: 'keyword' },
    { label: 'end', insertText: 'end', type: 'keyword' },
    { label: 'function', insertText: 'function ', type: 'keyword' },
    { label: '_G', insertText: '_G', type: 'keyword' }, // Global table
    { label: 'closeAttribute', label: '<close>', insertText: '<close> ', type: 'keyword' }, // Lua 5.4 to-be-closed variable
    { label: 'constAttribute', label: '<const>', insertText: '<const> ', type: 'keyword' }, // Lua 5.4 constant

    // ==========================================
    // Control Flow & Loops Snippets
    // ==========================================
    { label: 'if', insertText: 'if condition then\n    \nend', type: 'snippet' },
    { label: 'else', insertText: 'else\n    ', type: 'snippet' },
    { label: 'elseif', insertText: 'elseif condition then\n    ', type: 'snippet' },
    { label: 'ifElse', label: 'if...else', insertText: 'if condition then\n    \nelse\n    \nend', type: 'snippet' },
    { label: 'forNumeric', label: 'for i = 1, max', insertText: 'for i = 1, length do\n    \nend', type: 'snippet' },
    { label: 'forPairs', label: 'for k, v in pairs()', insertText: 'for k, v in pairs(table) do\n    \nend', type: 'snippet' },
    { label: 'forIpairs', label: 'for i, v in ipairs()', insertText: 'for i, v in ipairs(array) do\n    \nend', type: 'snippet' },
    { label: 'while', insertText: 'while condition do\n    \nend', type: 'snippet' },
    { label: 'do', insertText: 'do\n    \nend', type: 'snippet' },
    { label: 'repeat', insertText: 'repeat\n    \nuntil condition', type: 'snippet' },
    { label: 'functionSnippet', label: 'local function', insertText: 'local function name()\n    \nend', type: 'snippet' },
    { label: 'label', label: '::label::', insertText: '::label::', type: 'snippet' },

    // ==========================================
    // Core Built-in Global Functions
    // ==========================================
    { label: 'print', insertText: 'print()', type: 'function' },
    { label: 'require', insertText: 'require("")', type: 'function' },
    { label: 'type', insertText: 'type()', type: 'function' },
    { label: 'tostring', insertText: 'tostring()', type: 'function' },
    { label: 'tonumber', insertText: 'tonumber()', type: 'function' },
    { label: 'pairs', insertText: 'pairs()', type: 'function' },
    { label: 'ipairs', insertText: 'ipairs()', type: 'function' },
    { label: 'next', insertText: 'next()', type: 'function' },
    { label: 'select', insertText: 'select()', type: 'function' },
    { label: 'assert', insertText: 'assert(, "")', type: 'function' },
    { label: 'error', insertText: 'error("")', type: 'function' },
    { label: 'pcall', insertText: 'pcall(function, )', type: 'function' },
    { label: 'xpcall', insertText: 'xpcall(function, errorHandler, )', type: 'function' },

    // ==========================================
    // Metatables & OOP
    // ==========================================
    { label: 'setmetatable', insertText: 'setmetatable({}, {})', type: 'function' },
    { label: 'getmetatable', insertText: 'getmetatable()', type: 'function' },
    { label: 'rawget', insertText: 'rawget(, )', type: 'function' },
    { label: 'rawset', insertText: 'rawset(, , )', type: 'function' },
    { label: 'rawequal', insertText: 'rawequal(, )', type: 'function' },

    // ==========================================
    // Table Manipulation Module (`table.*`)
    // ==========================================
    { label: 'table.insert', insertText: 'table.insert(, )', type: 'function' },
    { label: 'table.remove', insertText: 'table.remove(, )', type: 'function' },
    { label: 'table.sort', insertText: 'table.sort(, function(a, b) return a < b end)', type: 'function' },
    { label: 'table.concat', insertText: 'table.concat(, ", ")', type: 'function' },
    { label: 'table.unpack', insertText: 'table.unpack()', type: 'function' },
    { label: 'table.pack', insertText: 'table.pack()', type: 'function' },
    { label: 'table.move', insertText: 'table.move(, , , , )', type: 'function' },

    // ==========================================
    // String Manipulation Module (`string.*`)
    // ==========================================
    { label: 'string.format', insertText: 'string.format("", )', type: 'function' },
    { label: 'string.sub', insertText: 'string.sub(, start, end)', type: 'function' },
    { label: 'string.match', insertText: 'string.match(, pattern)', type: 'function' },
    { label: 'string.gsub', insertText: 'string.gsub(, pattern, replace)', type: 'function' },
    { label: 'string.find', insertText: 'string.find(, pattern)', type: 'function' },
    { label: 'string.len', insertText: 'string.len()', type: 'function' },
    { label: 'string.lower', insertText: 'string.lower()', type: 'function' },
    { label: 'string.upper', insertText: 'string.upper()', type: 'function' },
    { label: 'string.gmatch', insertText: 'string.gmatch(, pattern)', type: 'function' },
    { label: 'string.reverse', insertText: 'string.reverse()', type: 'function' },

    // ==========================================
    // Math Library Module (`math.*`)
    // ==========================================
    { label: 'math.floor', insertText: 'math.floor()', type: 'function' },
    { label: 'math.ceil', insertText: 'math.ceil()', type: 'function' },
    { label: 'math.random', insertText: 'math.random()', type: 'function' },
    { label: 'math.randomseed', insertText: 'math.randomseed(os.time())', type: 'function' },
    { label: 'math.max', insertText: 'math.max()', type: 'function' },
    { label: 'math.min', insertText: 'math.min()', type: 'function' },
    { label: 'math.abs', insertText: 'math.abs()', type: 'function' },
    { label: 'math.sqrt', insertText: 'math.sqrt()', type: 'function' },
    { label: 'math.sin', insertText: 'math.sin()', type: 'function' },
    { label: 'math.cos', insertText: 'math.cos()', type: 'function' },
    { label: 'math.huge', insertText: 'math.huge', type: 'keyword' },

    // ==========================================
    // Input/Output Module (`io.*`)
    // ==========================================
    { label: 'io.open', insertText: 'io.open("filename", "r")', type: 'function' },
    { label: 'io.read', insertText: 'io.read()', type: 'function' },
    { label: 'io.write', insertText: 'io.write()', type: 'function' },
    { label: 'io.close', insertText: 'io.close()', type: 'function' },
    { label: 'io.lines', insertText: 'io.lines("filename")', type: 'function' },

    // ==========================================
    // Operating System & Coroutines
    // ==========================================
    { label: 'os.time', insertText: 'os.time()', type: 'function' },
    { label: 'os.date', insertText: 'os.date("*t")', type: 'function' },
    { label: 'os.difftime', insertText: 'os.difftime(, )', type: 'function' },
    { label: 'os.execute', insertText: 'os.execute("")', type: 'function' },
    { label: 'os.exit', insertText: 'os.exit()', type: 'function' },
    { label: 'coroutine.create', insertText: 'coroutine.create(function() \n    \nend)', type: 'function' },
    { label: 'coroutine.resume', insertText: 'coroutine.resume()', type: 'function' },
    { label: 'coroutine.yield', insertText: 'coroutine.yield()', type: 'function' },
    { label: 'coroutine.status', insertText: 'coroutine.status()', type: 'function' }
];