const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'commonjs' },
      globals: { console: 'readonly', process: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', AbortController: 'readonly', URL: 'readonly', fetch: 'readonly' },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  { ignores: ['dist/**', 'node_modules/**', 'prisma/migrations/**'] },
];
