import globals from 'globals';

export default [
  // Google Apps Script server-side files
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.es2020,
        // Google Apps Script specific globals
        Utilities: 'readonly',
        Logger: 'readonly',
        SpreadsheetApp: 'readonly',
        DriveApp: 'readonly',
        FormApp: 'readonly',
        CalendarApp: 'readonly',
        MailApp: 'readonly',
        Session: 'readonly',
        HtmlService: 'readonly',
        ScriptApp: 'readonly',
        PropertiesService: 'readonly',
        CacheService: 'readonly',
        LockService: 'readonly',
        UrlFetchApp: 'readonly',
        ContentService: 'readonly',
        XmlService: 'readonly',
        Blob: 'readonly',
        console: 'readonly',
        // Project specific globals and functions
        SS_MANAGER: 'readonly',
        CONSTANTS: 'readonly',
        getActiveSpreadsheet: 'readonly',
        getSpreadsheetTimezone: 'readonly',
        getCachedData: 'readonly',
        setCachedData: 'readonly',
        createApiResponse: 'readonly',
        BackendErrorHandler: 'readonly',
        transformReservationArrayToObject: 'readonly',
        transformReservationArrayToObjectWithHeaders: 'readonly',
        getUserHistoryFromCache: 'readonly',
        // Status constants
        STATUS_CANCEL: 'readonly',
        STATUS_WAITING: 'readonly',
        // Header constants (commonly used)
        HEADER_STUDENT_ID: 'readonly',
        HEADER_RESERVATION_ID: 'readonly',
        HEADER_DATE: 'readonly',
        HEADER_CLASSROOM: 'readonly',
        HEADER_VENUE: 'readonly',
        HEADER_START_TIME: 'readonly',
        HEADER_END_TIME: 'readonly',
        HEADER_STATUS: 'readonly',
        HEADER_CHISEL_RENTAL: 'readonly',
        HEADER_FIRST_LECTURE: 'readonly',
        HEADER_WORK_IN_PROGRESS: 'readonly',
        HEADER_ORDER: 'readonly',
        HEADER_MESSAGE_TO_TEACHER: 'readonly',
        // Cache keys
        CACHE_KEYS: 'readonly',
      },
    },
    rules: {
      'no-undef': 'warn', // Changed from 'error' to 'warn' for now
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', vars: 'local' }],
      'no-console': 'off',
      'no-var': 'warn',
      'prefer-const': 'warn',
      'no-multiple-empty-lines': ['warn', { max: 2 }],
      'no-trailing-spaces': 'warn',
    },
  },
  // Node.js tools
  {
    files: ['tools/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-var': 'warn',
      'prefer-const': 'warn',
    },
  },
  // Ignore HTML files for now (they contain mixed HTML/JS)
  {
    ignores: [
      'node_modules/**',
      'archive/**',
      'docs/**',
      'test/**',
      '.claude/**',
      '.vscode/**',
      '.github/**',
      'src/**/*.html', // Skip HTML files as they need special parsing
      'eslint.config.js', // Skip our own config file
    ],
  },
];
