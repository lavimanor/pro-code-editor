export const PROSENSE_CS = [
    // ==========================================
    // Keywords & Access Modifiers
    // ==========================================
    { label: 'using', insertText: 'using ', type: 'keyword' },
    { label: 'namespace', insertText: 'namespace ', type: 'keyword' },
    { label: 'class', insertText: 'class ', type: 'keyword' },
    { label: 'struct', insertText: 'struct ', type: 'keyword' },
    { label: 'interface', insertText: 'interface ', type: 'keyword' },
    { label: 'record', insertText: 'record ', type: 'keyword' }, // Modern C#
    { label: 'public', insertText: 'public ', type: 'keyword' },
    { label: 'private', insertText: 'private ', type: 'keyword' },
    { label: 'protected', insertText: 'protected ', type: 'keyword' },
    { label: 'internal', insertText: 'internal ', type: 'keyword' },
    { label: 'static', insertText: 'static ', type: 'keyword' },
    { label: 'readonly', insertText: 'readonly ', type: 'keyword' },
    { label: 'virtual', insertText: 'virtual ', type: 'keyword' },
    { label: 'override', insertText: 'override ', type: 'keyword' },
    { label: 'abstract', insertText: 'abstract ', type: 'keyword' },
    { label: 'sealed', insertText: 'sealed ', type: 'keyword' },
    { label: 'async', insertText: 'async ', type: 'keyword' },
    { label: 'await', insertText: 'await ', type: 'keyword' },
    { label: 'void', insertText: 'void ', type: 'keyword' },
    { label: 'new', insertText: 'new ', type: 'keyword' },
    { label: 'return', insertText: 'return ', type: 'keyword' },
    { label: 'this', insertText: 'this', type: 'keyword' },
    { label: 'base', insertText: 'base', type: 'keyword' },
    { label: 'typeof', insertText: 'typeof()', type: 'keyword' },
    { label: 'nameof', insertText: 'nameof()', type: 'keyword' },
    { label: 'throw', insertText: 'throw ', type: 'keyword' },
    { label: 'true', insertText: 'true', type: 'keyword' },
    { label: 'false', insertText: 'false', type: 'keyword' },
    { label: 'null', insertText: 'null', type: 'keyword' },

    // ==========================================
    // Core Types (Primitives & Objects)
    // ==========================================
    { label: 'var', insertText: 'var ', type: 'keyword' },
    { label: 'string', insertText: 'string ', type: 'keyword' },
    { label: 'int', insertText: 'int ', type: 'keyword' },
    { label: 'bool', insertText: 'bool ', type: 'keyword' },
    { label: 'double', insertText: 'double ', type: 'keyword' },
    { label: 'float', insertText: 'float ', type: 'keyword' },
    { label: 'decimal', insertText: 'decimal ', type: 'keyword' },
    { label: 'long', insertText: 'long ', type: 'keyword' },
    { label: 'object', insertText: 'object ', type: 'keyword' },
    { label: 'Task', insertText: 'Task ', type: 'class' },
    { label: 'Guid', insertText: 'Guid ', type: 'class' },

    // ==========================================
    // Control Flow & Snippets
    // ==========================================
    { label: 'if', insertText: 'if () {\n    \n}', type: 'snippet' },
    { label: 'else', insertText: 'else {\n    \n}', type: 'snippet' },
    { label: 'else if', insertText: 'else if () {\n    \n}', type: 'snippet' },
    { label: 'for', insertText: 'for (int i = 0; i < length; i++) {\n    \n}', type: 'snippet' },
    { label: 'foreach', insertText: 'foreach (var item in collection) {\n    \n}', type: 'snippet' },
    { label: 'while', insertText: 'while () {\n    \n}', type: 'snippet' },
    { label: 'doWhile', insertText: 'do {\n    \n} while ();', type: 'snippet' },
    { label: 'switch', insertText: 'switch (key) {\n    case value:\n        break;\n    default:\n        break;\n}', type: 'snippet' },
    { label: 'switchExpression', label: 'switch (expression)', insertText: 'var result = key switch {\n    value => ,\n    _ => \n};', type: 'snippet' },
    { label: 'tryCatch', label: 'try-catch', insertText: 'try {\n    \n} catch (Exception ex) {\n    \n}', type: 'snippet' },
    { label: 'tryCatchFinally', insertText: 'try {\n    \n} catch (Exception ex) {\n    \n} finally {\n    \n}', type: 'snippet' },
    { label: 'usingBlock', label: 'using statement', insertText: 'using (var resource = ) {\n    \n}', type: 'snippet' },
    { label: 'ctor', label: 'Constructor', insertText: 'public ClassName() {\n    \n}', type: 'snippet' },

    // ==========================================
    // Properties & Members
    // ==========================================
    { label: 'prop', label: 'Auto Property', insertText: 'public int MyProperty { get; set; }', type: 'snippet' },
    { label: 'propg', label: 'Get-only Property', insertText: 'public int MyProperty { get; private set; }', type: 'snippet' },
    { label: 'propinit', label: 'Init Property', insertText: 'public int MyProperty { get; init; }', type: 'snippet' },
    { label: 'propfull', label: 'Full Property', insertText: 'private int _myVar;\npublic int MyProperty\n{\n    get { return _myVar; }\n    set { _myVar = value; }\n}', type: 'snippet' },

    // ==========================================
    // Core Input/Output & Utility Methods
    // ==========================================
    { label: 'Console.WriteLine', insertText: 'Console.WriteLine();', type: 'function' },
    { label: 'Console.ReadLine', insertText: 'Console.ReadLine();', type: 'function' },
    { label: 'Console.Write', insertText: 'Console.Write();', type: 'function' },
    { label: 'Console.ReadKey', insertText: 'Console.ReadKey();', type: 'function' },
    { label: 'string.IsNullOrEmpty', insertText: 'string.IsNullOrEmpty()', type: 'function' },
    { label: 'string.IsNullOrWhiteSpace', insertText: 'string.IsNullOrWhiteSpace()', type: 'function' },
    { label: 'string.Format', insertText: 'string.Format("", )', type: 'function' },
    { label: 'string.Join', insertText: 'string.Join("", )', type: 'function' },
    { label: 'Guid.NewGuid', insertText: 'Guid.NewGuid()', type: 'function' },

    // ==========================================
    // Collections & LINQ
    // ==========================================
    { label: 'List', insertText: 'List<> name = new List<>();', type: 'snippet' },
    { label: 'Dictionary', insertText: 'Dictionary<, > name = new Dictionary<, >();', type: 'snippet' },
    { label: 'linqWhere', label: 'LINQ .Where()', insertText: 'Where(x => )', type: 'function' },
    { label: 'linqSelect', label: 'LINQ .Select()', insertText: 'Select(x => )', type: 'function' },
    { label: 'linqFirstOrDefault', label: 'LINQ .FirstOrDefault()', insertText: 'FirstOrDefault(x => )', type: 'function' },
    { label: 'linqToList', label: 'LINQ .ToList()', insertText: 'ToList()', type: 'function' },
    { label: 'linqAny', label: 'LINQ .Any()', insertText: 'Any(x => )', type: 'function' }
];