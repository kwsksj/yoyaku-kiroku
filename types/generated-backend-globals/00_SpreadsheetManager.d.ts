/**
 * =================================================================
 * 【ファイル名】: 00_SpreadsheetManager.js
 * 【バージョン】: 1.1
 * 【役割】: スプレッドシートオブジェクトの共通管理とキャッシュ
 * パフォーマンス向上のため、SpreadsheetApp.getActiveSpreadsheet()の
 * 重複呼び出しを避ける。
 * 【v1.1での変更点】:
 * - タイムゾーン管理を削除し、CONSTANTS.TIMEZONEへの移行を促進。
 * =================================================================
 */
export const SALES_SPREADSHEET_ID: string;
/**
 * スプレッドシートマネージャー
 * アプリケーション全体でスプレッドシートオブジェクトを共有・管理
 */
export class SpreadsheetManager {
    _spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet;
    _sheets: Map<any, any>;
    _isWarming: boolean;
    _warmupPromise: any;
    /**
     * アクティブなスプレッドシートオブジェクトを取得（キャッシュ付き）
     * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
     */
    getSpreadsheet(): GoogleAppsScript.Spreadsheet.Spreadsheet;
    /**
     * 指定されたシートを取得（キャッシュ付き）
     * @param {string} sheetName - シート名
     * @returns {GoogleAppsScript.Spreadsheet.Sheet|null}
     */
    getSheet(sheetName: string): GoogleAppsScript.Spreadsheet.Sheet | null;
    /**
     * スプレッドシートの事前ウォームアップ（非同期）
     * GAS実行環境の初期化遅延を回避するため、バックグラウンドで事前に初期化
     */
    warmupAsync(): void;
    /**
     * キャッシュをクリア（テスト時や強制リフレッシュ時に使用）
     */
    clearCache(): void;
    /**
     * 特定のシートのキャッシュをクリア
     * @param {string} sheetName - シート名
     */
    clearSheetCache(sheetName: string): void;
}
export const SS_MANAGER: SpreadsheetManager;
