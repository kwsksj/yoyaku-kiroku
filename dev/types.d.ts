/// <reference types="google-apps-script" />

// =================================================================
// Dev Directory TypeScript Definitions
// GAS開発用型定義（dev/ディレクトリ専用）
// =================================================================

// Backend-specific globals (only for files that don't define them)
// CONSTANTS, CLASSROOMS, ITEMS, etc. are defined in 00_Constants.js
// declare const CONSTANTS: any; // Commented out - defined in 00_Constants.js
// declare const CLASSROOMS: any; // Commented out - defined in 00_Constants.js
// declare const ITEMS: any; // Commented out - defined in 00_Constants.js
declare const HEADERS: any;
// declare const STATUS: any; // Commented out - defined in 00_Constants.js
// declare const UI: any; // Commented out - defined in 00_Constants.js
declare const MESSAGES: any;
declare const BANK: any;
declare const PAYMENT: any;

// Schedule status constants (only for files that don't define them)
// declare const SCHEDULE_STATUS_CANCELLED: string; // Commented out - defined in 00_Constants.js
// declare const SCHEDULE_STATUS_COMPLETED: string; // Commented out - defined in 00_Constants.js
// declare const SCHEDULE_STATUS_SCHEDULED: string; // Commented out - defined in 00_Constants.js

// Backend utilities
// SS_MANAGER is defined in 00_SpreadsheetManager.js
// declare const SS_MANAGER: any;
// SpreadsheetManager class is defined in 00_SpreadsheetManager.js
// declare class SpreadsheetManager {
//   static getInstance(): SpreadsheetManager;
// }

// Backend functions (cross-file references)
declare function getActiveSpreadsheet(): GoogleAppsScript.Spreadsheet.Spreadsheet;
declare function getSheetByName(
  name: string,
): GoogleAppsScript.Spreadsheet.Sheet;
declare function handleServerError(error: any, context?: string): any;
declare function createApiResponse(success: boolean, data?: any): any;
declare function debugLog(message: string): void;
declare function formatDate(date: any): string;
declare function include(filename: string): string;

// Frontend-specific globals
declare const DesignConfig: any;
declare const stateManager: {
  getState(): any;
  dispatch(action: any): void;
  subscribe(callback: Function): Function;
  goBack?(): void;
  updateComputedData?(): void;
  state?: any;
};
declare const Components: any;
declare const pageTransitionManager: any;
declare const C: any;

// Frontend utility functions
declare function escapeHTML(str: string): string;
declare function showLoading(): void;
declare function hideLoading(): void;
declare function showInfo(message: string): void;
declare function showConfirm(config: any): void;
declare function getTuitionItemRule(
  master: any,
  classroom: string,
  itemName: string,
): any;
declare var getTimeBasedTuitionHtml: any;
declare var createReservationCard: any;
declare function findReservationByDateAndClassroom(
  date: string,
  classroom: string,
  state?: any,
): any;
declare function isTimeBasedClassroom(classroom: string): boolean;
declare function getClassroomTimesFromSchedule(classroom: string): any;
declare function buildSalesChecklist(data: any): any;
declare function findReservationById(id: string): any;
declare function normalizePhoneNumberFrontend(phone: string): {
  normalized: string;
  isValid: boolean;
  error?: string;
};

// Environment variables
declare const server: any;
declare const MockData: any;
declare const isProduction: boolean;
// declare const DEBUG_ENABLED: boolean; // Defined in 00_Constants.js

// Functions that may be defined across files
declare function render(): void;
declare function initializeApp(): void;

// Window extensions for frontend
interface Window {
  stateManager: typeof stateManager;
  C: any;
  // STATUS: any; // Commented out - defined in 00_Constants.js
  // UI: any; // Commented out - defined in 00_Constants.js
  MESSAGES: any;
  BANK: any;
  PAYMENT: any;
  // HEADERS: any; // Commented out - conflicts with 00_Constants.js
  render: () => void;
  pageTransitionManager: any;
  google: {
    script: {
      run: {
        [key: string]: (...args: any[]) => any;
      };
      host: {
        close(): void;
        setWidth(width: number): void;
        setHeight(height: number): void;
      };
    };
  };
  isProduction: boolean;
  normalizePhoneNumberFrontend: (phone: string) => {
    normalized: string;
    isValid: boolean;
    error?: string;
  };
}

// Google Apps Script global
declare const google: {
  script: {
    run: {
      [key: string]: (...args: any[]) => any;
    };
    host: {
      close(): void;
      setWidth(width: number): void;
      setHeight(height: number): void;
    };
  };
};

// HTML Element type extensions for better TypeScript support
interface HTMLInputElement {
  value: string;
  checked: boolean;
}

interface HTMLSelectElement {
  value: string;
}

interface HTMLTextAreaElement {
  value: string;
}

interface HTMLFormElement {
  elements: HTMLFormControlsCollection;
}

// Generic HTMLElement extensions
interface HTMLElement {
  value?: string;
  checked?: boolean;
  elements?: HTMLFormControlsCollection;
  dataset: DOMStringMap;
}

interface Element {
  value?: string;
  dataset?: DOMStringMap;
  closest(selector: string): Element | null;
  matches(selector: string): boolean;
  type?: string;
}

interface EventTarget {
  value?: string;
  checked?: boolean;
  name?: string;
  id?: string;
  closest?(selector: string): Element | null;
  matches?(selector: string): boolean;
  dataset?: DOMStringMap;
}
