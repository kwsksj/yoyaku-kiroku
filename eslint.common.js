// 共通ESLint設定
import globals from 'globals';
import prettierConfig from 'eslint-config-prettier';

export const commonRules = {
  'no-undef': 'warn',
  'no-unused-vars': ['warn', { argsIgnorePattern: '^_', vars: 'local' }],
  'no-console': 'off',
  'no-var': 'warn',
  'prefer-const': 'warn',
  'no-multiple-empty-lines': ['warn', { max: 2 }],
  'no-trailing-spaces': 'warn',
};

export const projectConstants = {
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

export const gasGlobals = {
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

export default [prettierConfig];
