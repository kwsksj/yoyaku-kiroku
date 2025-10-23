/**
 * =================================================================
 * 【ファイル名】  : 00_SpreadsheetManager.js
 * 【モジュール種別】: バックエンド（GAS）
 * 【役割】        : Google スプレッドシートへのアクセスを集中管理し、重複取得を防いでパフォーマンスを最適化する。
 *
 * 【主な責務】
 *   - `SpreadsheetManager` クラスでアクティブシートと各シートのキャッシュを保持
 *   - 外部スプレッドシート（売上ログなど）を安全に取得するラッパーを提供
 *   - 初期ロードやウォームアップ処理を一箇所にまとめ、呼び出し元の実装を簡潔化
 *
 * 【関連モジュール】
 *   - `07_CacheManager.js`: シートデータのキャッシュ再構築時に利用
 *   - `05-2_Backend_Write.js`: 売上ログの書き込みで外部スプレッドシートを扱う
 *   - `08_Utilities.js`: シートデータ取得ヘルパーから内部 API を利用
 *
 * 【利用時の留意点】
 *   - `SS_MANAGER` はシングルトンとして設計されているため、直接 new せず export を使う
 *   - `getExternalSheet` は PropertiesService で設定された ID を前提とするため、設定漏れに注意
 *   - テスト環境で外部シートを参照する場合は、読み取り専用になっていないか確認する
 * =================================================================
 */
export const SALES_SPREADSHEET_ID: string;
/**
 * スプレッドシートマネージャー
 * アプリケーション全体でスプレッドシートオブジェクトを共有・管理
 */
export class SpreadsheetManager {
    /** @type {GoogleAppsScript.Spreadsheet.Spreadsheet | null} */
    _spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet | null;
    /** @type {Map<string, GoogleAppsScript.Spreadsheet.Sheet | null>} */
    _sheets: Map<string, GoogleAppsScript.Spreadsheet.Sheet | null>;
    _isWarming: boolean;
    /** @type {Promise<void> | null} */
    _warmupPromise: Promise<void> | null;
    /**
     * 外部スプレッドシート用キャッシュ
     * @type {Map<
     *   string,
     *   {
     *     spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet | null;
     *     sheets: Map<string, GoogleAppsScript.Spreadsheet.Sheet | null>;
     *   }
     * >}
     */
    _externalSpreadsheets: Map<string, {
        spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet | null;
        sheets: Map<string, GoogleAppsScript.Spreadsheet.Sheet | null>;
    }>;
    /**
     * アクティブなスプレッドシートオブジェクトを取得（キャッシュ付き）
     * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
     */
    getSpreadsheet(): GoogleAppsScript.Spreadsheet.Spreadsheet;
    /**
     * 指定されたシートを取得（キャッシュ付き）
     * @param {string} sheetName - シート名
     * @returns {GoogleAppsScript.Spreadsheet.Sheet | null | undefined}
     */
    getSheet(sheetName: string): GoogleAppsScript.Spreadsheet.Sheet | null | undefined;
    /**
     * 外部スプレッドシート用キャッシュを取得（必要に応じて初期化）
     * @param {string} spreadsheetId
     * @returns {{ spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet | null, sheets: Map<string, GoogleAppsScript.Spreadsheet.Sheet | null> }}
     * @private
     */
    private _ensureExternalSpreadsheetCache;
    /**
     * Spreadsheet IDからスプレッドシートオブジェクトを取得（キャッシュ付き）
     * @param {string} spreadsheetId
     * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
     */
    getSpreadsheetById(spreadsheetId: string): GoogleAppsScript.Spreadsheet.Spreadsheet;
    /**
     * 指定IDのスプレッドシートからシートを取得（キャッシュ付き）
     * @param {string} spreadsheetId
     * @param {string} sheetName
     * @returns {GoogleAppsScript.Spreadsheet.Sheet | null | undefined}
     */
    getExternalSheet(spreadsheetId: string, sheetName: string): GoogleAppsScript.Spreadsheet.Sheet | null | undefined;
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
