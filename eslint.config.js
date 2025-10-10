import prettierConfig from 'eslint-config-prettier';
import pluginGoogleAppsScript from 'eslint-plugin-googleappsscript';
import globals from 'globals';

// --- eslint.common.js からの内容をここに統合 ---
const commonRules = {
  'no-undef': 'warn',
  'no-unused-vars': ['warn', { argsIgnorePattern: '^_', vars: 'local' }],
  'no-console': 'off',
  'no-var': 'warn',
  'prefer-const': 'warn',
  'no-multiple-empty-lines': ['warn', { max: 2 }],
  'no-trailing-spaces': 'warn',
};

const projectConstants = {
  // 共通プロジェクト定数（TypeScript定義で管理）
  CONSTANTS: 'readonly',
  C: 'readonly',
  STATUS: 'readonly',
  UI: 'readonly',
  MESSAGES: 'readonly',
  BANK: 'readonly',
  PAYMENT: 'readonly',
  HEADERS: 'readonly',
};

const gasGlobals = {
  ...globals.es2020,
  // Google Apps Script globals
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
// --- 統合ここまで ---

export default [
  // =================================================================
  // グローバルな無視設定 (最初に記述することが重要)
  // =================================================================
  {
    ignores: [
      'node_modules/**',
      'archive/**',
      'build-output/**',
      'docs/**',
      'test/**', // `test-*.js` は別途設定しているため、ディレクトリ全体は無視
      '.claude/**',
      '.vscode/**',
      '.github/**',
    ],
  },
  // Google Apps Script server-side files (src/backend only)
  {
    files: ['src/backend/**/*.js', 'src/backend/*.js'],
    plugins: {
      googleappsscript: pluginGoogleAppsScript,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...gasGlobals,
        ...projectConstants,
        ...pluginGoogleAppsScript.environments.googleappsscript.globals,
        verifyMigratedData: 'readonly',
        // バックエンドのグローバル変数は、`npm run generate-types` で生成された
        // `types/generated-backend-globals` 以下の型定義ファイルによって解決されます。
        // そのため、ここでの手動定義は不要になりました。
        //
        // `CONSTANTS` や `SS_MANAGER` など、`export` されていない真のグローバル変数のみ
        // `projectConstants` で定義することで、ESLintに認識させています。
      },
    },
    rules: {
      ...commonRules,
    },
  },
  // Node.js tools
  {
    files: ['tools/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module', // Changed from commonjs
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...commonRules,
      'no-undef': 'error', // Node.jsでは未定義変数はエラーにする
    },
  },
  // Special config for frontend test file
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
  // Root-level test files
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
      'no-unused-vars': 'off', // テストファイルでは未使用変数を許可
    },
  },
  // --- src/eslint.config.js からの内容をここに統合 ---
  // Frontend JavaScript files
  {
    files: ['src/frontend/**/*.js', 'src/frontend/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.es2020,
        ...projectConstants,
        // フロントエンドのグローバル変数も、`npm run generate-types` で生成された
        // `types/generated-frontend-globals` 以下の型定義ファイルによって解決されます。
        //
        // `google.script.run` やビルド時に注入される変数など、
        // JSDocから型定義を生成できないもののみ、ここで定義します。
        google: 'readonly',
        server: 'readonly',
        isProduction: 'readonly',
      },
    },
    rules: {
      ...commonRules,
    },
  },
  prettierConfig,
];
