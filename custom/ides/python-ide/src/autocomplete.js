export function registerPythonAutocomplete(api) {
    try {
        api.languages.register('python', {
            name: 'Python',
            extensions: ['py', 'pyw'],
            parser: 'python',
            
            // Advanced contextual indexing rules to harvest scopes on-the-fly
            parserRules: [
                // 1. Standard and Async Function Declarations
                { regex: /\b(?:async\s+)?def\s+([a-zA-Z_]\w*)/g, group: 1, type: 'function' },
                
                // 2. Class Declarations
                { regex: /\bclass\s+([a-zA-Z_]\w*)/g, group: 1, type: 'class-name' },
                
                // 3. Simple Variable Assignments
                { regex: /^\s*([a-zA-Z_]\w*)\s*=\s*(?!class|def)/gm, group: 1, type: 'variable' },
                
                // 4. Instance Attributes (e.g. self.connection_state = True -> harvests "connection_state")
                { regex: /\bself\.([a-zA-Z_]\w*)\s*=\s*/g, group: 1, type: 'property' },
                
                // 5. Function/Method Signature Parameters (e.g. def run(timeout, retries) -> harvests "timeout", "retries")
                { regex: /(?<=\bdef\s+\w+\(|,\s*)([a-zA-Z_]\w*)(?=\s*[,=)])/g, group: 1, type: 'variable' },
                
                // 6. For Loop Iterator Variables (e.g. for cluster_node in group -> harvests "cluster_node")
                { regex: /\bfor\s+([a-zA-Z_]\w*)\s+in\b/g, group: 1, type: 'variable' },
                
                // 7. "as" bound names: context managers, except aliases, and import aliases
                //    (e.g. "with open() as f", "except E as err", "import numpy as np")
                { regex: /\bas\s+([a-zA-Z_]\w*)/g, group: 1, type: 'variable' },
                
                // 8. Package Imports
                { regex: /\bimport\s+([a-zA-Z_]\w*)/g, group: 1, type: 'module' },
                
                // 9. Component From-Imports
                { regex: /\bfrom\s+\w+\s+import\s+([a-zA-Z_]\w*)/g, group: 1, type: 'variable' }
            ],

            // Predefined database containing structural templates and extensive dot-notation library indices
            db: [
                // --- Structural Boilerplates (Plain Text) ---
                { label: 'def', insertText: 'def func_name(args):\n    pass', type: 'keyword', detail: 'Define function' },
                { label: 'class', insertText: 'class ClassName:\n    def __init__(self):\n        pass', type: 'keyword', detail: 'Define class structure' },
                { label: 'if-main', insertText: 'if __name__ == "__main__":\n    main()', type: 'keyword', detail: 'Main execution block' },
                { label: 'for', insertText: 'for item in iterable:\n    pass', type: 'keyword', detail: 'For loop block' },
                { label: 'while', insertText: 'while condition:\n    pass', type: 'keyword', detail: 'While loop block' },
                { label: 'try', insertText: 'try:\n    pass\nexcept Exception as e:\n    raise e', type: 'keyword', detail: 'Try-except block' },
                { label: 'listcomp', insertText: '[item for item in iterable if condition]', type: 'keyword', detail: 'List comprehension' },
                { label: 'dictcomp', insertText: '{key: value for item in iterable}', type: 'keyword', detail: 'Dictionary comprehension' },
                { label: 'with', insertText: 'with open(\'file.txt\', \'r\') as f:\n    contents = f.read()', type: 'keyword', detail: 'With open context manager' },
                { label: 'unittest', insertText: 'import unittest\n\nclass TestCase(unittest.TestCase):\n    def test_something(self):\n        self.assertEqual(expected, actual)\n\nif __name__ == \'__main__\':\n    unittest.main()', type: 'keyword', detail: 'Unittest suite template' },

                // --- Standard Library Modules & Dot-Notation Indexing ---
                
                // JSON Module
                { label: 'json.dumps', insertText: 'json.dumps()', type: 'function', detail: 'Serialize Python object to a JSON-formatted string' },
                { label: 'json.loads', insertText: 'json.loads()', type: 'function', detail: 'Deserialize JSON string to a Python object' },
                { label: 'json.dump', insertText: 'json.dump()', type: 'function', detail: 'Serialize Python object to a JSON stream file' },
                { label: 'json.load', insertText: 'json.load()', type: 'function', detail: 'Deserialize JSON stream file to a Python object' },
                
                // OS & Path Modules
                { label: 'os.path.join', insertText: 'os.path.join()', type: 'function', detail: 'Join path components intelligently' },
                { label: 'os.path.exists', insertText: 'os.path.exists()', type: 'function', detail: 'Verify if path target exists' },
                { label: 'os.path.isdir', insertText: 'os.path.isdir()', type: 'function', detail: 'Verify if path target is a directory' },
                { label: 'os.path.isfile', insertText: 'os.path.isfile()', type: 'function', detail: 'Verify if path target is a file' },
                { label: 'os.makedirs', insertText: 'os.makedirs()', type: 'function', detail: 'Create directory paths recursively' },
                { label: 'os.environ', insertText: 'os.environ', type: 'variable', detail: 'System environment variables mapping dictionary' },
                
                // Sys Module
                { label: 'sys.argv', insertText: 'sys.argv', type: 'variable', detail: 'List of command line arguments' },
                { label: 'sys.exit', insertText: 'sys.exit()', type: 'function', detail: 'Exit execution thread' },
                { label: 'sys.path', insertText: 'sys.path', type: 'variable', detail: 'List of directories searched for modules' },

                // Math Module
                { label: 'math.sqrt', insertText: 'math.sqrt()', type: 'function', detail: 'Calculate the square root of a value' },
                { label: 'math.ceil', insertText: 'math.ceil()', type: 'function', detail: 'Round a value up to the nearest integer' },
                { label: 'math.floor', insertText: 'math.floor()', type: 'function', detail: 'Round a value down to the nearest integer' },

                // Random Module
                { label: 'random.randint', insertText: 'random.randint()', type: 'function', detail: 'Generate a random integer within a range' },
                { label: 'random.choice', insertText: 'random.choice()', type: 'function', detail: 'Select a random element from a sequence' },
                { label: 'random.shuffle', insertText: 'random.shuffle()', type: 'function', detail: 'Shuffle a mutable sequence in-place' },

                // Time & Datetime Modules
                { label: 'time.sleep', insertText: 'time.sleep()', type: 'function', detail: 'Suspend execution for a specified number of seconds' },
                { label: 'time.time', insertText: 'time.time()', type: 'function', detail: 'Return the current epoch timestamp float' },
                { label: 'datetime.now', insertText: 'datetime.now()', type: 'function', detail: 'Return the current local date and time' },
                { label: 'datetime.strptime', insertText: 'datetime.strptime()', type: 'function', detail: 'Parse a string to a datetime object' },
                
                // Regex (RE) Module
                { label: 're.search', insertText: 're.search()', type: 'function', detail: 'Scan string looking for regular expression match' },
                { label: 're.match', insertText: 're.match()', type: 'function', detail: 'Try to apply regular expression pattern at start of string' },
                { label: 're.findall', insertText: 're.findall()', type: 'function', detail: 'Return list of all non-overlapping pattern matches' },
                { label: 're.sub', insertText: 're.sub()', type: 'function', detail: 'Replace substring patterns using regular expressions' }
            ]
        });
        
        console.log("IDE-Grade ProSense indexing systems loaded successfully.");
    } catch (error) {
        console.error("Could not register ProSense database:", error);
    }
}