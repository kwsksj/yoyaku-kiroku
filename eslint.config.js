import prettierConfig from 'eslint-config-prettier';
import pluginGoogleAppsScript from 'eslint-plugin-googleappsscript';
import globals from 'globals';

// =============================================================================
// 共通設定
// =============================================================================

/**
 * 全ファイルタイプで共有するESLintルール
 *
 * 設計方針:
 * - no-undef: TypeScriptの型チェック（checkJs）で未定義変数を検出するため無効化
 * - ESLintはコードスタイルとベストプラクティスに専念
 */
const commonRules = {
  'no-undef': 'off', // TypeScript型チェックで検出
  'no-unused-vars': ['warn', { argsIgnorePattern: '^_', vars: 'local' }],
  'no-console': 'off',
  'no-var': 'warn',
  'prefer-const': 'warn',
  'no-multiple-empty-lines': ['warn', { max: 2 }],
  'no-trailing-spaces': 'warn',
};

/**
 * プロジェクト共通の定数（ビルド時にグローバルスコープに注入される）
 * 型定義: src/shared/00_Constants.js
 */
const projectConstants = {
  CONSTANTS: 'readonly',
  C: 'readonly',
  STATUS: 'readonly',
  UI: 'readonly',
  MESSAGES: 'readonly',
  BANK: 'readonly',
  PAYMENT: 'readonly',
  HEADERS: 'readonly',
};

/**
 * Google Apps Script APIのグローバル変数
 */
const gasGlobals = {
  ...globals.es2020,
  SpreadsheetApp: 'readonly',
  DriveApp: 'readonly',
  GmailApp: 'readonly',
  CalendarApp: 'readonly',
  PropertiesService: 'readonly',
  CacheService: 'readonly',
  LockService: 'readonly',
  HtmlService: 'readonly',
  Logger: 'readonly',
  Session: 'readonly',
  Utilities: 'readonly',
  UrlFetchApp: 'readonly',
};

// =============================================================================
// ESLint設定配列
// =============================================================================

export default [
  // ---------------------------------------------------------------------------
  // グローバルな無視設定（最初に記述することが重要）
  // ---------------------------------------------------------------------------
  {
    ignores: [
      'node_modules/**',
      'archive/**',
      'build-output/**',
      'docs/**',
      'tools/**',
      '.claude/**',
      '.vscode/**',
      '.github/**',
    ],
  },

  // ---------------------------------------------------------------------------
  // バックエンド（Google Apps Script サーバーサイド）
  // ---------------------------------------------------------------------------
  {
    files: ['src/backend/**/*.js'],
    plugins: {
      googleappsscript: pluginGoogleAppsScript,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...gasGlobals,
        ...projectConstants,
        ...pluginGoogleAppsScript.environments.googleappsscript.globals,
        verifyMigratedData: 'readonly',
      },
    },
    rules: {
      ...commonRules,
    },
  },

  // ---------------------------------------------------------------------------
  // フロントエンド（ブラウザで実行されるJavaScript）
  // ---------------------------------------------------------------------------
  {
    files: ['src/frontend/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2020,
        ...projectConstants,
        // ビルド時に注入される変数
        google: 'readonly', // google.script.run
        server: 'readonly',
        isProduction: 'readonly',
      },
    },
    rules: {
      ...commonRules,
    },
  },

  // ---------------------------------------------------------------------------
  // Node.jsツール（型チェックなし）
  // ---------------------------------------------------------------------------
  {
    files: ['tools/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...commonRules,
      'no-undef': 'error', // TypeScript型チェックがないため有効化
    },
  },

  // ---------------------------------------------------------------------------
  // フロントエンドテストファイル
  // ---------------------------------------------------------------------------
  {
    files: ['tools/frontend-test.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        escapeHTML: 'readonly',
        setState: 'readonly',
      },
    },
  },

  // ---------------------------------------------------------------------------
  // ルートレベルのテストファイル
  // ---------------------------------------------------------------------------
  {
    files: ['test-*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.es2020,
        ...projectConstants,
      },
    },
    rules: {
      ...commonRules,
      'no-unused-vars': 'off',
    },
  },

  // ---------------------------------------------------------------------------
  // Prettier統合（最後に配置）
  // ---------------------------------------------------------------------------
  prettierConfig,
];
