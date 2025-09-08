/**
 * GAS環境用グローバル型定義
 * GASの特殊な実行環境（全ファイルがグローバルスコープ）に対応
 */

// GAS環境では全てのファイルがグローバルスコープで実行される
// 同名の定数・関数・クラスは意図的にグローバル共有される

// SpreadsheetManagerクラス（バックエンド・フロントエンド共通）
declare class SpreadsheetManager {
  constructor();
  getSheet(sheetName: string): GoogleAppsScript.Spreadsheet.Sheet;
  getSpreadsheet(): GoogleAppsScript.Spreadsheet.Spreadsheet;
  clearCache(): void;
}

// GAS型の正しい定義（重複エラー解消）
declare type Spreadsheet = GoogleAppsScript.Spreadsheet.Spreadsheet;
declare type Sheet = GoogleAppsScript.Spreadsheet.Sheet;

// グローバルインスタンス
declare var SS_MANAGER: SpreadsheetManager;

// 重複定義を許可する定数群（GAS環境での意図的共有）
declare var CONSTANTS: Constants;
declare var STATUS: StatusConstants;
declare var UI: UIConstants;
declare var CLASSROOMS: ClassroomsConstants;
declare var ITEMS: ItemsConstants;
declare var SCHEDULE_STATUS_CANCELLED: string;
declare var SCHEDULE_STATUS_COMPLETED: string;
declare var SCHEDULE_STATUS_SCHEDULED: string;
declare var DEBUG_ENABLED: boolean;

// Logger関数（GAS環境用拡張）
declare namespace Logger {
  function log(message: any, level?: string, context?: string, timestamp?: Date): void;
}

// HTML内JavaScript用グローバル関数宣言
declare function showToast(message: string, title?: string): void;
declare function showError(message: string, title?: string): void;

// GAS特有のグローバルオブジェクト
declare var global: any;

// 関数重複定義の許可（意図的な場合）
declare function getUserHistoryFromCache(): any;
declare function getUserReservationsFromCache(): any;
declare function createSampleScheduleData(): any;

export {};