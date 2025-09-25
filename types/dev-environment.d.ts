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
declare const HEADERS: {
  RESERVATIONS: Record<string, string>;
  STUDENTS: Record<string, string>;
  SCHEDULE: Record<string, string>;
  [key: string]: Record<string, string>;
};
// declare const STATUS: any; // Commented out - defined in 00_Constants.js
// declare const UI: any; // Commented out - defined in 00_Constants.js
declare const MESSAGES: Record<string, string>;
declare const BANK: Record<string, string>;
declare const PAYMENT: Record<string, string>;

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
declare function handleServerError(error: Error, context?: string): ApiErrorResponse;
declare function createApiResponse(success: boolean, data?: unknown): UnifiedApiResponse;
declare function debugLog(message: string): void;
declare function formatDate(date: Date | string): string;
declare function include(filename: string): string;

// Frontend-specific globals
// DesignConfig型は html-environment.d.ts の DesignSystemConfig を参照
declare const stateManager: StateManager;
// Components型は html-environment.d.ts の ComponentsObject を参照
declare const pageTransitionManager: {
  showPage(pageName: string): void;
  hidePage(pageName: string): void;
  [key: string]: (...args: unknown[]) => unknown;
};
declare const C: Components;

// Frontend utility functions
declare function escapeHTML(str: string): string;
declare function showLoading(category?: string): void;
declare function hideLoading(): void;
declare function showInfo(message: string): void;
declare function showConfirm(config: {
  title?: string;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}): void;
declare function getTuitionItemRule(
  master: AccountingMasterItem[],
  classroom: string,
  itemName: string,
): AccountingMasterItem | null;
declare function getTimeBasedTuitionHtml(
  master: AccountingMasterItem[],
  classroom: string
): string;
declare function createReservationCard(reservation: {
  date: string;
  classroom: string;
  startTime: string;
  endTime: string;
  [key: string]: unknown;
}): string;
declare function findReservationByDateAndClassroom(
  date: string,
  classroom: string,
  state?: AppState,
): ReservationObject | null;
declare function getScheduleDataFromLessons(reservation: {
  date: string;
  classroom: string;
}): ScheduleMasterData | null;
declare function isTimeBasedClassroom(scheduleData: ScheduleMasterData): boolean;
declare function buildSalesChecklist(data: AccountingDetails): string;
declare function findReservationById(id: string): ReservationObject | null;
declare function normalizePhoneNumberFrontend(phone: string): {
  normalized: string;
  isValid: boolean;
  error?: string;
};

// Environment variables
declare const server: {
  [functionName: string]: (...args: unknown[]) => unknown;
};
declare const MockData: {
  lessons?: DevLesson[];
  students?: StudentData[];
  reservations?: ReservationObject[];
  [key: string]: unknown;
};
declare const isProduction: boolean;
// declare const DEBUG_ENABLED: boolean; // Defined in 00_Constants.js

// Functions that may be defined across files
declare function render(): void;
declare function initializeApp(): void;

// =================================================================
// Core Data Types (lessons hierarchy structure)
// NOTE: LessonSchedule, LessonStatus, Lessonはtypes/api-types.d.tsと統合予定
// 現在は開発環境固有の拡張型として定義
// =================================================================

// 開発環境用拡張Lesson型（api-types.d.tsのLessonを拡張）
interface DevLessonSchedule extends LessonSchedule {
  beginnerCapacity: number;
  beginnerStart?: string;
  firstStart: string;
  firstEnd: string;
  secondStart?: string;
  secondEnd?: string;
  [key: string]: unknown;
}

interface DevLessonStatus extends LessonStatus {
  availableSlots?: number;
  morningSlots?: number;
  afternoonSlots?: number;
  firstLectureSlots: number;
  firstLectureIsFull?: boolean;
  [key: string]: unknown;
}

interface DevLesson extends Lesson {
  schedule: DevLessonSchedule;
  status: DevLessonStatus;
}

// 開発環境では html-environment.d.ts の UIState と AppState を使用
// 重複定義を避けるため、ここでは型エイリアスのみ定義

interface StateManager {
  getState(): UIState;
  dispatch(action: { type: string; payload?: unknown }): void;
  subscribe(callback: Function): Function;
  goBack?(): void;
  updateComputedData?(): void;
  state?: AppState;
  isInEditMode?(reservationId: string): boolean;
  endEditMode?(reservationId: string): void;
  startEditMode?(reservationId: string, originalMemo?: string): void;
  updateMemoInputChanged?(reservationId: string, currentValue: string): boolean;
  clearAllEditModes?(): void;
  showAccountingConfirmation?(grandTotal?: number): void;
  confirmAndPay?(): void;
}

// Window拡張はtypes/index.d.tsで統一管理されています
// 開発環境固有の型定義のみここで定義

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
