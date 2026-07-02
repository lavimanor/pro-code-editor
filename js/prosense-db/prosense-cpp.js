export const PROSENSE_CPP = [
    // ==========================================
    // Keywords & Access Modifiers
    // ==========================================
    { label: 'class', insertText: 'class ', type: 'keyword' },
    { label: 'struct', insertText: 'struct ', type: 'keyword' },
    { label: 'public', insertText: 'public:\n    ', type: 'keyword' },
    { label: 'private', insertText: 'private:\n    ', type: 'keyword' },
    { label: 'protected', insertText: 'protected:\n    ', type: 'keyword' },
    { label: 'virtual', insertText: 'virtual ', type: 'keyword' },
    { label: 'override', insertText: 'override', type: 'keyword' },
    { label: 'final', insertText: 'final', type: 'keyword' },
    { label: 'inline', insertText: 'inline ', type: 'keyword' },
    { label: 'explicit', insertText: 'explicit ', type: 'keyword' },
    { label: 'friend', insertText: 'friend ', type: 'keyword' },
    { label: 'operator', insertText: 'operator ', type: 'keyword' },
    { label: 'constexpr', insertText: 'constexpr ', type: 'keyword' },
    { label: 'consteval', insertText: 'consteval ', type: 'keyword' }, // C++20 immediate function
    { label: 'constinit', insertText: 'constinit ', type: 'keyword' }, // C++20 compile-time init
    { label: 'nullptr', insertText: 'nullptr', type: 'keyword' },
    { label: 'auto', insertText: 'auto ', type: 'keyword' },
    { label: 'decltype', insertText: 'decltype()', type: 'keyword' },
    { label: 'mutable', insertText: 'mutable ', type: 'keyword' },
    { label: 'noexcept', insertText: 'noexcept', type: 'keyword' },
    { label: 'using', insertText: 'using ', type: 'keyword' },
    { label: 'namespace', insertText: 'namespace ', type: 'keyword' },
    { label: 'new', insertText: 'new ', type: 'keyword' },
    { label: 'delete', insertText: 'delete ', type: 'keyword' },
    { label: 'this', insertText: 'this', type: 'keyword' },
    { label: 'throw', insertText: 'throw ', type: 'keyword' },

    // ==========================================
    // Type Casting Operators
    // ==========================================
    { label: 'static_cast', insertText: 'static_cast<>()', type: 'keyword' },
    { label: 'dynamic_cast', insertText: 'dynamic_cast<>()', type: 'keyword' },
    { label: 'reinterpret_cast', insertText: 'reinterpret_cast<>()', type: 'keyword' },
    { label: 'const_cast', insertText: 'const_cast<>()', type: 'keyword' },

    // ==========================================
    // Templates & Concepts (Modern C++)
    // ==========================================
    { label: 'template', insertText: 'template <typename T>\n', type: 'keyword' },
    { label: 'typename', insertText: 'typename ', type: 'keyword' },
    { label: 'concept', insertText: 'concept  = ;\n', type: 'keyword' }, // C++20 Concepts
    { label: 'requires', insertText: 'requires ', type: 'keyword' }, // C++20 Constraints

    // ==========================================
    // Control Flow & Boilerplate Snippets
    // ==========================================
    { label: 'main', insertText: 'int main(int argc, char* argv[]) {\n    \n    return 0;\n}', type: 'snippet' },
    { label: 'if', insertText: 'if () {\n    \n}', type: 'snippet' },
    { label: 'else', insertText: 'else {\n    \n}', type: 'snippet' },
    { label: 'else if', insertText: 'else if () {\n    \n}', type: 'snippet' },
    { label: 'for', insertText: 'for (int i = 0; i < length; i++) {\n    \n}', type: 'snippet' },
    { label: 'foreach', insertText: 'for (const auto& item : collection) {\n    \n}', type: 'snippet' }, // Range-based for
    { label: 'while', insertText: 'while () {\n    \n}', type: 'snippet' },
    { label: 'doWhile', insertText: 'do {\n    \n} while ();', type: 'snippet' },
    { label: 'switch', insertText: 'switch (expression) {\n    case value:\n        break;\n    default:\n        break;\n}', type: 'snippet' },
    { label: 'tryCatch', insertText: 'try {\n    \n} catch (const std::exception& e) {\n    \n}', type: 'snippet' },
    { label: 'lambda', insertText: '[&] () {\n    \n}', type: 'snippet' },
    { label: 'structuredBinding', insertText: 'const auto& [a, b] = ', type: 'snippet' }, // C++17 Decompression

    // ==========================================
    // Input/Output & Modern Formatting
    // ==========================================
    { label: 'std::cout', insertText: 'std::cout <<  << std::endl;', type: 'function' },
    { label: 'std::cin', insertText: 'std::cin >> ;', type: 'function' },
    { label: 'std::endl', insertText: 'std::endl', type: 'keyword' },
    { label: 'std::print', insertText: 'std::print("{}", );', type: 'function' }, // C++23 native printing
    { label: 'std::println', insertText: 'std::println("{}", );', type: 'function' }, // C++23 native printing with newline
    { label: 'std::format', insertText: 'std::format("{}", )', type: 'function' }, // C++20 string formatting
    { label: 'cout', insertText: 'cout <<  << endl;', type: 'function' },
    { label: 'cin', insertText: 'cin >> ;', type: 'function' },
    { label: 'endl', insertText: 'endl', type: 'keyword' },

    // ==========================================
    // STL Containers & Strings
    // ==========================================
    { label: 'std::string', insertText: 'std::string ', type: 'class' },
    { label: 'std::string_view', insertText: 'std::string_view ', type: 'class' }, // C++17 efficient string pass
    { label: 'std::vector', insertText: 'std::vector<> ', type: 'class' },
    { label: 'std::map', insertText: 'std::map<, > ', type: 'class' },
    { label: 'std::set', insertText: 'std::set<> ', type: 'class' },
    { label: 'std::unordered_map', insertText: 'std::unordered_map<, > ', type: 'class' },
    { label: 'std::unordered_set', insertText: 'std::unordered_set<> ', type: 'class' },
    { label: 'std::pair', insertText: 'std::pair<, > ', type: 'class' },
    { label: 'std::tuple', insertText: 'std::tuple<> ', type: 'class' },

    // ==========================================
    // Smart Pointers (Memory Management)
    // ==========================================
    { label: 'std::unique_ptr', insertText: 'std::unique_ptr<> ', type: 'class' },
    { label: 'std::shared_ptr', insertText: 'std::shared_ptr<> ', type: 'class' },
    { label: 'std::weak_ptr', insertText: 'std::weak_ptr<> ', type: 'class' },
    { label: 'std::make_unique', insertText: 'std::make_unique<>()', type: 'function' },
    { label: 'std::make_shared', insertText: 'std::make_shared<>()', type: 'function' },

    // ==========================================
    // STL Algorithms & Utilites
    // ==========================================
    { label: 'std::sort', insertText: 'std::sort(.begin(), .end());', type: 'function' },
    { label: 'std::find', insertText: 'std::find(.begin(), .end(), );', type: 'function' },
    { label: 'std::move', insertText: 'std::move()', type: 'function' },
    { label: 'std::forward', insertText: 'std::forward<>()', type: 'function' }
];