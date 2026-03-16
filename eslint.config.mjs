// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  prettierConfig,
  {
    ignores: [
      '**/dist/',
      '**/coverage/',
      '**/node_modules/',
      '**/*.config.*',
      '**/*.mjs',
      'docs/',
      'scripts/',
    ],
  },
  {
    files: ['packages/*/src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);
