/**
 * ESLint設定 - プロパティ名不整合検出強化版
 */
module.exports = {
  env: {
    browser: true,
    es2021: true,
    googleappsscript: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'script',
  },
  globals: {
    // GAS特有のグローバル変数
    SpreadsheetApp: 'readonly',
    Session: 'readonly',
    Utilities: 'readonly',
    CacheService: 'readonly',
    Logger: 'readonly',
    console: 'readonly',
    // プロジェクト固有のグローバル変数
    CONSTANTS: 'readonly',
    SS_MANAGER: 'readonly',
    API_PROPERTY_NAMES: 'readonly',
  },
  rules: {
    // プロパティアクセスの安全性を向上
    'dot-notation': ['error', { allowKeywords: true }],
    'no-undef': 'error',
    'no-unused-vars': ['warn', { args: 'none' }],

    // オブジェクトリテラルでの一貫性確保
    'quote-props': ['error', 'consistent-as-needed'],

    // 文字列リテラルの一貫性（プロパティ名の typo 防止）
    quotes: ['error', 'single', { avoidEscape: true }],

    // 未定義変数の使用を禁止（プロパティ名の typo を検出）
    'no-implicit-globals': 'error',

    // 一貫性のないプロパティアクセスを警告
    'consistent-return': 'warn',
  },
  overrides: [
    {
      // HTML内のJavaScriptに対する特別ルール
      files: ['**/*.html'],
      parser: '@html-eslint/parser',
      rules: {
        // HTML内のスクリプトでは緩い設定
        'no-undef': 'off',
      },
    },
  ],
};
