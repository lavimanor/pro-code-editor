export const PROSENSE_C = [
    // ==========================================
    // Keywords & Core Data Types
    // ==========================================
    { label: 'int', insertText: 'int ', type: 'keyword' },
    { label: 'char', insertText: 'char ', type: 'keyword' },
    { label: 'float', insertText: 'float ', type: 'keyword' },
    { label: 'double', insertText: 'double ', type: 'keyword' },
    { label: 'long', insertText: 'long ', type: 'keyword' },
    { label: 'short', insertText: 'short ', type: 'keyword' },
    { label: 'signed', insertText: 'signed ', type: 'keyword' },
    { label: 'unsigned', insertText: 'unsigned ', type: 'keyword' },
    { label: 'void', insertText: 'void ', type: 'keyword' },
    { label: 'const', insertText: 'const ', type: 'keyword' },
    { label: 'static', insertText: 'static ', type: 'keyword' },
    { label: 'extern', insertText: 'extern ', type: 'keyword' },
    { label: 'volatile', insertText: 'volatile ', type: 'keyword' },
    { label: 'register', insertText: 'register ', type: 'keyword' },
    { label: 'auto', insertText: 'auto ', type: 'keyword' },
    { label: 'inline', insertText: 'inline ', type: 'keyword' },
    { label: 'restrict', insertText: 'restrict ', type: 'keyword' },
    { label: 'struct', insertText: 'struct ', type: 'keyword' },
    { label: 'union', insertText: 'union ', type: 'keyword' },
    { label: 'enum', insertText: 'enum ', type: 'keyword' },
    { label: 'typedef', insertText: 'typedef ', type: 'keyword' },
    { label: 'return', insertText: 'return ', type: 'keyword' },
    { label: 'break', insertText: 'break;', type: 'keyword' },
    { label: 'continue', insertText: 'continue;', type: 'keyword' },
    { label: 'goto', insertText: 'goto ', type: 'keyword' },
    { label: 'sizeof', insertText: 'sizeof()', type: 'function' },
    { label: 'NULL', insertText: 'NULL', type: 'keyword' },

    // ==========================================
    // Fixed-Width Integer & Bool Types (<stdint.h>, <stdbool.h>)
    // ==========================================
    { label: 'size_t', insertText: 'size_t ', type: 'keyword' },
    { label: 'ssize_t', insertText: 'ssize_t ', type: 'keyword' },
    { label: 'bool', insertText: 'bool ', type: 'keyword' },
    { label: 'true', insertText: 'true', type: 'keyword' },
    { label: 'false', insertText: 'false', type: 'keyword' },
    { label: 'int8_t', insertText: 'int8_t ', type: 'keyword' },
    { label: 'int16_t', insertText: 'int16_t ', type: 'keyword' },
    { label: 'int32_t', insertText: 'int32_t ', type: 'keyword' },
    { label: 'int64_t', insertText: 'int64_t ', type: 'keyword' },
    { label: 'uint8_t', insertText: 'uint8_t ', type: 'keyword' },
    { label: 'uint16_t', insertText: 'uint16_t ', type: 'keyword' },
    { label: 'uint32_t', insertText: 'uint32_t ', type: 'keyword' },
    { label: 'uint64_t', insertText: 'uint64_t ', type: 'keyword' },

    // ==========================================
    // Preprocessor Directives
    // ==========================================
    { label: '#include', insertText: '#include <>.h', type: 'snippet' },
    { label: '#include_local', insertText: '#include "".h', type: 'snippet' },
    { label: '#define', insertText: '#define ', type: 'snippet' },
    { label: '#ifdef', insertText: '#ifdef \n\n#endif', type: 'snippet' },
    { label: '#ifndef', insertText: '#ifndef \n\n#endif', type: 'snippet' },
    { label: '#if', insertText: '#if \n\n#endif', type: 'snippet' },

    // ==========================================
    // Control Flow & Boilerplate Snippets
    // ==========================================
    { label: 'main', insertText: 'int main(int argc, char *argv[]) {\n    \n    return 0;\n}', type: 'snippet' },
    { label: 'main_void', insertText: 'int main(void) {\n    \n    return 0;\n}', type: 'snippet' },
    { label: 'if', insertText: 'if () {\n    \n}', type: 'snippet' },
    { label: 'else', insertText: 'else {\n    \n}', type: 'snippet' },
    { label: 'else if', insertText: 'else if () {\n    \n}', type: 'snippet' },
    { label: 'for', insertText: 'for (int i = 0; i < length; i++) {\n    \n}', type: 'snippet' },
    { label: 'while', insertText: 'while () {\n    \n}', type: 'snippet' },
    { label: 'do', insertText: 'do {\n    \n} while ();', type: 'snippet' },
    { label: 'switch', insertText: 'switch (expression) {\n    case value:\n        break;\n    default:\n        break;\n}', type: 'snippet' },
    { label: 'typedef_struct', insertText: 'typedef struct {\n    \n} Name;', type: 'snippet' },

    // ==========================================
    // Standard Input/Output (<stdio.h>)
    // ==========================================
    { label: 'printf', insertText: 'printf("\\n");', type: 'function' },
    { label: 'scanf', insertText: 'scanf("", &);', type: 'function' },
    { label: 'fprintf', insertText: 'fprintf(stderr, "\\n");', type: 'function' },
    { label: 'sprintf', insertText: 'sprintf(buffer, "", );', type: 'function' },
    { label: 'snprintf', insertText: 'snprintf(buffer, sizeof(buffer), "", );', type: 'function' },
    { label: 'fgets', insertText: 'fgets(buffer, sizeof(buffer), stdin);', type: 'function' },
    { label: 'fopen', insertText: 'fopen("filename", "r");', type: 'function' },
    { label: 'fclose', insertText: 'fclose();', type: 'function' },
    { label: 'perror', insertText: 'perror("");', type: 'function' },

    // ==========================================
    // Memory Management (<stdlib.h>)
    // ==========================================
    { label: 'malloc', insertText: 'malloc()', type: 'function' },
    { label: 'calloc', insertText: 'calloc(count, sizeof())', type: 'function' },
    { label: 'realloc', insertText: 'realloc(, )', type: 'function' },
    { label: 'free', insertText: 'free();', type: 'function' },
    { label: 'exit', insertText: 'exit();', type: 'function' },

    // ==========================================
    // String & Memory Utilities (<string.h>)
    // ==========================================
    { label: 'strlen', insertText: 'strlen()', type: 'function' },
    { label: 'strcmp', insertText: 'strcmp(, )', type: 'function' },
    { label: 'strncmp', insertText: 'strncmp(, , )', type: 'function' },
    { label: 'strcpy', insertText: 'strcpy(, )', type: 'function' },
    { label: 'strncpy', insertText: 'strncpy(, , )', type: 'function' },
    { label: 'strcat', insertText: 'strcat(, )', type: 'function' },
    { label: 'strchr', insertText: 'strchr(, )', type: 'function' },
    { label: 'strstr', insertText: 'strstr(, )', type: 'function' },
    { label: 'memcpy', insertText: 'memcpy(, , )', type: 'function' },
    { label: 'memset', insertText: 'memset(, 0, sizeof())', type: 'function' },
    { label: 'memmove', insertText: 'memmove(, , )', type: 'function' }
];