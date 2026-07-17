// @ts-check
import js from '@eslint/js'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const srcFiles = ['src/**/*.{ts,tsx}']

/**
 * Flat config：
 * - @eslint/js + typescript-eslint recommended
 * - React Hooks：经典 rules-of-hooks / exhaustive-deps
 *   （不用 Compiler 扩展规则，避免未启用 React Compiler 时全库误报）
 * - prettier recommended 放最后
 */
export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'src-tauri/**', 'scripts/**'],
  },
  {
    files: srcFiles,
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
      // 与常见 catch 再包装错误的写法兼容
      'preserve-caught-error': 'off',
    },
  },
  eslintPluginPrettierRecommended,
)
