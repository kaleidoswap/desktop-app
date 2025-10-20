import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import';
import sortKeysFix from 'eslint-plugin-sort-keys-fix';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      import: importPlugin,
      'sort-keys-fix': sortKeysFix,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'sort-keys-fix/sort-keys-fix': 'warn',
      'react/prop-types': 'off',
      'react/jsx-sort-props': 'warn',
      'react/no-unescaped-entities': 'off',
      'import/order': [
        'warn',
        {
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
          'newlines-between': 'always',
          pathGroups: [
            {
              pattern: '@/assets/**',
              group: 'external',
              position: 'after',
            },
            {
              pattern: '@/components/**',
              group: 'external',
              position: 'after',
            },
          ],
          distinctGroup: false,
        },
      ],
      'import/no-default-export': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
    settings: {
      react: {
        version: 'detect',
      },
      'import/resolver': {
        typescript: true,
        node: true,
      },
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'src-tauri/**'],
  }
);

