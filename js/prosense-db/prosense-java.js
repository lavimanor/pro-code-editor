export const PROSENSE_JAVA = [
    // ==========================================
    // Keywords & Access Modifiers
    // ==========================================
    { label: 'public', insertText: 'public ', type: 'keyword' },
    { label: 'private', insertText: 'private ', type: 'keyword' },
    { label: 'protected', insertText: 'protected ', type: 'keyword' },
    { label: 'class', insertText: 'class ', type: 'keyword' },
    { label: 'interface', insertText: 'interface ', type: 'keyword' },
    { label: 'enum', insertText: 'enum ', type: 'keyword' },
    { label: 'record', insertText: 'record ', type: 'keyword' }, // Modern Java
    { label: 'extends', insertText: 'extends ', type: 'keyword' },
    { label: 'implements', insertText: 'implements ', type: 'keyword' },
    { label: 'import', insertText: 'import ', type: 'keyword' },
    { label: 'package', insertText: 'package ', type: 'keyword' },
    { label: 'static', insertText: 'static ', type: 'keyword' },
    { label: 'final', insertText: 'final ', type: 'keyword' },
    { label: 'abstract', insertText: 'abstract ', type: 'keyword' },
    { label: 'synchronized', insertText: 'synchronized ', type: 'keyword' },
    { label: 'volatile', insertText: 'volatile ', type: 'keyword' },
    { label: 'transient', insertText: 'transient ', type: 'keyword' },
    { label: 'void', insertText: 'void ', type: 'keyword' },
    { label: 'new', insertText: 'new ', type: 'keyword' },
    { label: 'return', insertText: 'return ', type: 'keyword' },
    { label: 'this', insertText: 'this', type: 'keyword' },
    { label: 'super', insertText: 'super', type: 'keyword' },
    { label: 'instanceof', insertText: 'instanceof ', type: 'keyword' },
    { label: 'throw', insertText: 'throw ', type: 'keyword' },
    { label: 'throws', insertText: 'throws ', type: 'keyword' },
    { label: 'true', insertText: 'true', type: 'keyword' },
    { label: 'false', insertText: 'false', type: 'keyword' },
    { label: 'null', insertText: 'null', type: 'keyword' },

    // ==========================================
    // Core Primitive & Object Types
    // ==========================================
    { label: 'String', insertText: 'String ', type: 'class' },
    { label: 'Object', insertText: 'Object ', type: 'class' },
    { label: 'int', insertText: 'int ', type: 'keyword' },
    { label: 'double', insertText: 'double ', type: 'keyword' },
    { label: 'float', insertText: 'float ', type: 'keyword' },
    { label: 'boolean', insertText: 'boolean ', type: 'keyword' },
    { label: 'char', insertText: 'char ', type: 'keyword' },
    { label: 'long', insertText: 'long ', type: 'keyword' },
    { label: 'short', insertText: 'short ', type: 'keyword' },
    { label: 'byte', insertText: 'byte ', type: 'keyword' },
    { label: 'var', insertText: 'var ', type: 'keyword' }, // Local variable type inference

    // ==========================================
    // Control Flow & Snippets
    // ==========================================
    { label: 'psvm', insertText: 'public static void main(String[] args) {\n    \n}', type: 'snippet' },
    { label: 'sout', insertText: 'System.out.println();', type: 'snippet' },
    { label: 'souf', insertText: 'System.printf("");', type: 'snippet' },
    { label: 'if', insertText: 'if () {\n    \n}', type: 'snippet' },
    { label: 'else', insertText: 'else {\n    \n}', type: 'snippet' },
    { label: 'else if', insertText: 'else if () {\n    \n}', type: 'snippet' },
    { label: 'for', insertText: 'for (int i = 0; i < length; i++) {\n    \n}', type: 'snippet' },
    { label: 'foreach', label: 'for (each)', insertText: 'for (Type item : collection) {\n    \n}', type: 'snippet' },
    { label: 'while', insertText: 'while () {\n    \n}', type: 'snippet' },
    { label: 'doWhile', insertText: 'do {\n    \n} while ();', type: 'snippet' },
    { label: 'switch', insertText: 'switch (key) {\n    case value:\n        break;\n    default:\n        break;\n}', type: 'snippet' },
    { label: 'switchExpression', label: 'switch (arrow)', insertText: 'switch (key) {\n    case VALUE -> ;\n    default -> ;\n}', type: 'snippet' },
    { label: 'tryCatch', label: 'try-catch', insertText: 'try {\n    \n} catch (Exception e) {\n    e.printStackTrace();\n}', type: 'snippet' },
    { label: 'tryCatchFinally', insertText: 'try {\n    \n} catch (Exception e) {\n    \n} finally {\n    \n}', type: 'snippet' },
    { label: 'tryWithResources', insertText: 'try (Resource res = new Resource()) {\n    \n} catch (Exception e) {\n    \n}', type: 'snippet' },

    // ==========================================
    // Collections Framework
    // ==========================================
    { label: 'List', insertText: 'List<> name = new ArrayList<>();', type: 'snippet' },
    { label: 'Map', insertText: 'Map<, > name = new HashMap<>();', type: 'snippet' },
    { label: 'Set', insertText: 'Set<> name = new HashSet<>();', type: 'snippet' },
    { label: 'Optional', insertText: 'Optional<> ', type: 'class' },
    { label: 'StringBuilder', insertText: 'StringBuilder sb = new StringBuilder();', type: 'snippet' },

    // ==========================================
    // Common Core Methods & Utilities
    // ==========================================
    { label: 'Objects.equals', insertText: 'Objects.equals(, )', type: 'function' },
    { label: 'Objects.requireNonNull', insertText: 'Objects.requireNonNull()', type: 'function' },
    { label: 'String.format', insertText: 'String.format("", )', type: 'function' },
    { label: 'String.valueOf', insertText: 'String.valueOf()', type: 'function' },
    { label: 'Integer.parseInt', insertText: 'Integer.parseInt()', type: 'function' },
    { label: 'System.currentTimeMillis', insertText: 'System.currentTimeMillis()', type: 'function' },
    { label: 'Arrays.asList', insertText: 'Arrays.asList()', type: 'function' },
    { label: 'List.of', insertText: 'List.of()', type: 'function' },
    { label: 'Map.of', insertText: 'Map.of()', type: 'function' },

    // ==========================================
    // Streams & Lambdas
    // ==========================================
    { label: 'streamFilter', label: 'stream().filter()', insertText: 'stream().filter(item -> )', type: 'function' },
    { label: 'streamMap', label: 'stream().map()', insertText: 'stream().map(item -> )', type: 'function' },
    { label: 'streamCollect', label: 'stream().collect()', insertText: 'stream().collect(Collectors.toList())', type: 'function' },
    { label: 'streamForEach', label: 'stream().forEach()', insertText: 'stream().forEach(item -> );', type: 'function' },
    { label: 'Optional.ifPresent', insertText: 'ifPresent(value -> {\n    \n});', type: 'function' }
];