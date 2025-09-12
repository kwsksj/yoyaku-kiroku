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

// 実行時取得定数
const SALES_SPREADSHEET_ID =
  PropertiesService.getScriptProperties().getProperty('SALES_SPREADSHEET_ID');

/**
 * スプレッドシートマネージャー
 * アプリケーション全体でスプレッドシートオブジェクトを共有・管理
 */
class SpreadsheetManager {
  constructor() {
    this._spreadsheet = null;
    this._sheets = new Map();
  }

  /**
   * アクティブなスプレッドシートオブジェクトを取得（キャッシュ付き）
   * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
   */
  getSpreadsheet() {
    if (!this._spreadsheet) {
      this._spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    }
    return this._spreadsheet;
  }

  /**
   * 指定されたシートを取得（キャッシュ付き）
   * @param {string} sheetName - シート名
   * @returns {GoogleAppsScript.Spreadsheet.Sheet|null}
   */
  getSheet(sheetName) {
    if (!this._sheets.has(sheetName)) {
      const sheet = this.getSpreadsheet().getSheetByName(sheetName);
      this._sheets.set(sheetName, sheet);
    }
    return this._sheets.get(sheetName);
  }

  /**
   * キャッシュをクリア（テスト時や強制リフレッシュ時に使用）
   */
  clearCache() {
    this._spreadsheet = null;
    this._sheets.clear();
  }

  /**
   * 特定のシートのキャッシュをクリア
   * @param {string} sheetName - シート名
   */
  clearSheetCache(sheetName) {
    this._sheets.delete(sheetName);
  }
}

// グローバルインスタンス
const SS_MANAGER = new SpreadsheetManager();

/**
 * 従来の関数と互換性を保つためのヘルパー関数
 */
function getActiveSpreadsheet() {
  return SS_MANAGER.getSpreadsheet();
}

/**
 * @param {string} sheetName
 */
function getSheetByName(sheetName) {
  return SS_MANAGER.getSheet(sheetName);
}
