import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import perfectionist from 'eslint-plugin-perfectionist';
import prettier from 'eslint-plugin-prettier/recommended';

export default [
  perfectionist.configs['recommended-natural'],
  {
    files: ['**/*.ts'],
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      parser: tsParser,
      sourceType: 'module',
    },

    plugins: {
      '@typescript-eslint': typescriptEslint,
    },

    rules: {
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          fixStyle: 'separate-type-imports',
          prefer: 'type-imports',
        },
      ],
      '@typescript-eslint/naming-convention': [
        'warn',
        {
          format: ['camelCase', 'PascalCase'],
          selector: 'import',
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],

      curly: 'warn',
      eqeqeq: 'warn',
      'no-throw-literal': 'warn',
      semi: 'warn',
    },
  },
  prettier,
];
