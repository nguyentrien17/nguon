const js = require('@eslint/js');
const globals = require('globals');
const { defineConfig, globalIgnores } = require('eslint/config');

// Quy tắc 1 của docs/dependency-rules.md: Core không được import Features. Trước đây chỉ kiểm
// bằng lệnh grep chạy tay; đưa vào lint để vi phạm bị bắt ở mọi lần `npm run lint` / CI.
const CORE_IMPORTS_FEATURE = {
    selector: "CallExpression[callee.name='require'][arguments.0.value=/^#features\\/|(\\.\\.\\/)+features\\//]",
    message: 'Core không được import Features (docs/dependency-rules.md quy tắc 1). Đưa phần phụ thuộc vào feature, hoặc nối qua server.js.',
};

module.exports = defineConfig([
    globalIgnores(['node_modules']),
    {
        files: ['**/*.js'],
        extends: [js.configs.recommended],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'commonjs',
            globals: globals.node,
        },
        rules: {
            'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^_', caughtErrors: 'none' }],
        },
    },
    {
        files: ['core/**/*.js'],
        rules: {
            'no-restricted-syntax': ['error', CORE_IMPORTS_FEATURE],
        },
    },
]);
