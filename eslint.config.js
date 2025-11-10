import js from '@eslint/js'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import importPlugin from 'eslint-plugin-import'
import sortKeysFixPlugin from 'eslint-plugin-sort-keys-fix'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // Base ESLint recommended config
  js.configs.recommended,
  
  // TypeScript ESLint recommended configs
  ...tseslint.configs.recommended,
  
  // React plugin configs
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      import: importPlugin,
      'sort-keys-fix': sortKeysFixPlugin,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
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
    rules: {
      // React rules
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,
      'react/prop-types': 'off',
      'react/jsx-sort-props': 'warn',
      'react/no-unescaped-entities': 'off',
      
      // React Hooks rules
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/set-state-in-effect': 'warn',
      
      // Import rules
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
      
      // Sort keys rules
      'sort-keys-fix/sort-keys-fix': 'warn',
      
      // TypeScript rules
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  
  // Ignore patterns
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.tauri/**',
      '**/target/**',
      '**/coverage/**',
      '**/*.config.js',
      '**/*.config.ts',
    ],
  }
)

