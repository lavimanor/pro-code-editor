export const PROSENSE_PY = [
    // ==========================================
    // Keywords & Declarations
    // ==========================================
    { label: 'def', insertText: 'def ', type: 'keyword' },
    { label: 'class', insertText: 'class ', type: 'keyword' },
    { label: 'return', insertText: 'return ', type: 'keyword' },
    { label: 'import', insertText: 'import ', type: 'keyword' },
    { label: 'from', insertText: 'from ', type: 'keyword' },
    { label: 'as', insertText: 'as ', type: 'keyword' },
    { label: 'global', insertText: 'global ', type: 'keyword' },
    { label: 'nonlocal', insertText: 'nonlocal ', type: 'keyword' },
    { label: 'lambda', insertText: 'lambda ', type: 'keyword' },
    { label: 'yield', insertText: 'yield ', type: 'keyword' },
    { label: 'pass', insertText: 'pass', type: 'keyword' },
    { label: 'break', insertText: 'break', type: 'keyword' },
    { label: 'continue', insertText: 'continue', type: 'keyword' },
    { label: 'assert', insertText: 'assert ', type: 'keyword' },
    { label: 'raise', insertText: 'raise ', type: 'keyword' },
    { label: 'del', insertText: 'del ', type: 'keyword' },
    { label: 'self', insertText: 'self', type: 'keyword' },

    // ==========================================
    // Async & Await
    // ==========================================
    { label: 'async def', insertText: 'async def ', type: 'keyword' },
    { label: 'await', insertText: 'await ', type: 'keyword' },

    // ==========================================
    // Logical & Membership Operators
    // ==========================================
    { label: 'and', insertText: 'and ', type: 'keyword' },
    { label: 'or', insertText: 'or ', type: 'keyword' },
    { label: 'not', insertText: 'not ', type: 'keyword' },
    { label: 'is', insertText: 'is ', type: 'keyword' },
    { label: 'in', insertText: 'in ', type: 'keyword' },
    { label: 'True', insertText: 'True', type: 'keyword' },
    { label: 'False', insertText: 'False', type: 'keyword' },
    { label: 'None', insertText: 'None', type: 'keyword' },

    // ==========================================
    // Control Flow & Snippets
    // ==========================================
    { label: 'if', insertText: 'if condition:\n    ', type: 'snippet' },
    { label: 'elif', insertText: 'elif condition:\n    ', type: 'snippet' },
    { label: 'else', insertText: 'else:\n    ', type: 'snippet' },
    { label: 'forIn', label: 'for...in', insertText: 'for item in iterable:\n    ', type: 'snippet' },
    { label: 'forRange', label: 'for i in range()', insertText: 'for i in range(len):\n    ', type: 'snippet' },
    { label: 'while', insertText: 'while condition:\n    ', type: 'snippet' },
    { label: 'tryExcept', label: 'try...except', insertText: 'try:\n    \nexcept Exception as e:\n    ', type: 'snippet' },
    { label: 'tryExceptFinally', insertText: 'try:\n    \nexcept Exception as e:\n    \nfinally:\n    ', type: 'snippet' },
    { label: 'withOpen', label: 'with open()', insertText: 'with open("filename", "r") as f:\n    ', type: 'snippet' },
    { label: 'matchCase', label: 'match...case (Pattern Matching)', insertText: 'match value:\n    case pattern:\n        ', type: 'snippet' }, // Python 3.10+

    // ==========================================
    // Comprehensions
    // ==========================================
    { label: 'listComprehension', label: 'List Comprehension', insertText: '[item for item in iterable if condition]', type: 'snippet' },
    { label: 'dictComprehension', label: 'Dict Comprehension', insertText: '{key: value for key, value in iterable}', type: 'snippet' },

    // ==========================================
    // Core Built-in Functions
    // ==========================================
    { label: 'print', insertText: 'print()', type: 'function' },
    { label: 'len', insertText: 'len()', type: 'function' },
    { label: 'range', insertText: 'range()', type: 'function' },
    { label: 'enumerate', insertText: 'enumerate()', type: 'function' },
    { label: 'zip', insertText: 'zip()', type: 'function' },
    { label: 'type', insertText: 'type()', type: 'function' },
    { label: 'isinstance', insertText: 'isinstance(, )', type: 'function' },
    { label: 'super', insertText: 'super()', type: 'function' },
    { label: 'open', insertText: 'open()', type: 'function' },
    { label: 'sorted', insertText: 'sorted()', type: 'function' },
    { label: 'any', insertText: 'any()', type: 'function' },
    { label: 'all', insertText: 'all()', type: 'function' },
    { label: 'sum', insertText: 'sum()', type: 'function' },
    { label: 'min', insertText: 'min()', type: 'function' },
    { label: 'max', insertText: 'max()', type: 'function' },

    // ==========================================
    // Type Casting & Built-in Types
    // ==========================================
    { label: 'str', insertText: 'str()', type: 'function' },
    { label: 'int', insertText: 'int()', type: 'function' },
    { label: 'float', insertText: 'float()', type: 'function' },
    { label: 'bool', insertText: 'bool()', type: 'function' },
    { label: 'list', insertText: 'list()', type: 'function' },
    { label: 'dict', insertText: 'dict()', type: 'function' },
    { label: 'set', insertText: 'set()', type: 'function' },
    { label: 'tuple', insertText: 'tuple()', type: 'function' },

    // ==========================================
    // Standard Snippets & Dunder Methods
    // ==========================================
    { label: 'main', label: '__name__ == "__main__"', insertText: 'if __name__ == "__main__":\n    ', type: 'snippet' },
    { label: 'init', label: '__init__()', insertText: 'def __init__(self):\n    ', type: 'snippet' },
    { label: 'strMethod', label: '__str__()', insertText: 'def __str__(self):\n    return ', type: 'snippet' },
    { label: 'reprMethod', label: '__repr__()', insertText: 'def __repr__(self):\n    return ', type: 'snippet' },
    { label: 'enterMethod', label: '__enter__()', insertText: 'def __enter__(self):\n    return self', type: 'snippet' },
    { label: 'exitMethod', label: '__exit__()', insertText: 'def __exit__(self, exc_type, exc_val, exc_tb):\n    ', type: 'snippet' },

    // ==========================================
    // Common Core Library Snippets
    // ==========================================
    { label: 'json.dumps', insertText: 'json.dumps()', type: 'function' },
    { label: 'json.loads', insertText: 'json.loads()', type: 'function' },
    { label: 'os.path.join', insertText: 'os.path.join()', type: 'function' },
    { label: 'dataclass', label: '@dataclass', insertText: '@dataclass\nclass Name:\n    ', type: 'snippet' }
];