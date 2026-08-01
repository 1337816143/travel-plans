import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'assets/**',
      'node_modules/**',
      'playwright-report/**',
      'src/**',
      'src-v2/**',
      'test-results/**',
      'versions/**',
      'wechat-mini-program/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: [
      'packages/schema/src/**/*.ts',
      'packages/domain/src/**/*.ts',
      'packages/map-core/src/**/*.ts',
      'packages/planner/src/**/*.ts',
      'packages/providers/src/**/*.ts',
      'packages/storage/src/**/*.ts',
      'packages/testing/src/**/*.ts',
    ],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.v3.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      'no-restricted-globals': [
        'error',
        'document',
        'indexedDB',
        'localStorage',
        'sessionStorage',
        'window',
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['leaflet', '@amap/*', '**/apps/**'],
              message: '共享领域核心不得依赖地图 SDK 或平台 app。',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/testing/tests/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.v3.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
);
