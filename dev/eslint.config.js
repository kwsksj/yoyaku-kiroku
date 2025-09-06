import globals from 'globals';
import pluginGoogleAppsScript from 'eslint-plugin-googleappsscript';
import { commonRules, projectConstants, gasGlobals } from '../eslint.common.js';
import prettierConfig from 'eslint-config-prettier';

export default [
  // Backend JavaScript files
  {
    files: ['backend/**/*.js'],
    plugins: {
      googleappsscript: pluginGoogleAppsScript,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...gasGlobals,
        ...projectConstants,
        // Backend-specific globals
        CLASSROOMS: 'readonly',
        ITEMS: 'readonly',
        SCHEDULE_STATUS_CANCELLED: 'readonly',
        SCHEDULE_STATUS_COMPLETED: 'readonly',
        SCHEDULE_STATUS_SCHEDULED: 'readonly',
        SS_MANAGER: 'readonly',
        SpreadsheetManager: 'readonly',
        // Backend functions (cross-file references)
        getActiveSpreadsheet: 'readonly',
        getSheetByName: 'readonly',
        handleServerError: 'readonly',
        createApiResponse: 'readonly',
        debugLog: 'readonly',
        formatDate: 'readonly',
        include: 'readonly',
      },
    },
    rules: {
      ...commonRules,
      'googleappsscript/no-browser': 'warn',
    },
  },

  // Frontend JavaScript files
  {
    files: ['frontend/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.es2020,
        ...projectConstants,
        // Google Apps Script frontend globals
        google: 'readonly',
        // Frontend-specific globals
        CLASSROOMS: 'readonly',
        ITEMS: 'readonly',
        CLASSROOM_CAPACITIES: 'readonly',
        ITEM_TYPES: 'readonly',
        UNITS: 'readonly',
        PAYMENT_METHODS: 'readonly',
        UI: 'readonly',
        SESSIONS: 'readonly',
        PAYMENT_DISPLAY: 'readonly',
        PAYMENT: 'readonly',
        BANK_INFO: 'readonly',
        BANK: 'readonly',
        MESSAGES: 'readonly',
        LOG_ACTIONS: 'readonly',
        COLORS: 'readonly',
        CLASSROOM_TYPES: 'readonly',
        SCHEDULE_STATUS: 'readonly',
        SHEET_NAMES: 'readonly',
        LIMITS: 'readonly',
        DISCOUNT_OPTIONS: 'readonly',
        TIME_SETTINGS: 'readonly',
        SYSTEM: 'readonly',
        HEADERS_RESERVATIONS: 'readonly',
        HEADERS_ROSTER: 'readonly',
        HEADERS_ACCOUNTING: 'readonly',
        HEADERS_SCHEDULE: 'readonly',
        // Project globals (defined in files)
        DesignConfig: 'readonly',
        stateManager: 'readonly',
        Components: 'readonly',
        pageTransitionManager: 'readonly',
        C: 'readonly',
        // Utility functions
        escapeHTML: 'readonly',
        formatDate: 'readonly',
        showLoading: 'readonly',
        hideLoading: 'readonly',
        showInfo: 'readonly',
        showConfirm: 'readonly',
        debugLog: 'readonly',
        getTuitionItemRule: 'readonly',
        getTimeBasedTuitionHtml: 'writable',
        createReservationCard: 'writable',
        findReservationByDateAndClassroom: 'readonly',
        isTimeBasedClassroom: 'readonly',
        getClassroomTimesFromSchedule: 'readonly',
        buildSalesChecklist: 'readonly',
        findReservationById: 'readonly',
        normalizePhoneNumberFrontend: 'readonly',
        // Environment variables
        server: 'readonly',
        MockData: 'readonly',
        isProduction: 'readonly',
        DEBUG_ENABLED: 'readonly',
        // Functions that may be defined across files
        render: 'readonly',
        initializeApp: 'readonly',
      },
    },
    rules: {
      ...commonRules,
    },
  },

  prettierConfig,
];
