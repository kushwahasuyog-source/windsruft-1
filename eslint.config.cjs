const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
module.exports = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { ignores: ['**/dist/**', 'node_modules/**', 'eslint.config.cjs'] },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: {
        console: 'readonly',
        localStorage: 'readonly',
        document: 'readonly',
        window: 'readonly',
        matchMedia: 'readonly',
        setInterval: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        Express: 'readonly',
        crypto: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
