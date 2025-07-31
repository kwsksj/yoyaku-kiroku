/**
 * =================================================================
 * 【ファイル名】: 00_SpreadsheetManager.js
 * 【バージョン】: 1.0
 * 【役割】: スプレッドシートオブジェクトの共通管理とキャッシュ
 * パフォーマンス向上のため、SpreadsheetApp.getActiveSpreadsheet()の
 * 重複呼び出しを避ける。
 * =================================================================
 */

/**
 * スプレッドシートマネージャー
 * アプリケーション全体でスプレッドシートオブジェクトを共有・管理
 */
class SpreadsheetManager {
  constructor() {
    this._spreadsheet = null;
    this._sheets = new Map();
    this._timezone = null;
  }

  /**
   * アクティブなスプレッドシートオブジェクトを取得（キャッシュ付き）
   * @returns {Spreadsheet}
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
   * @returns {Sheet|null}
   */
  getSheet(sheetName) {
    if (!this._sheets.has(sheetName)) {
      const sheet = this.getSpreadsheet().getSheetByName(sheetName);
      this._sheets.set(sheetName, sheet);
    }
    return this._sheets.get(sheetName);
  }

  /**
   * スプレッドシートのタイムゾーンを取得（キャッシュ付き）
   * @returns {string}
   */
  getTimezone() {
    if (!this._timezone) {
      this._timezone = this.getSpreadsheet().getSpreadsheetTimeZone();
    }
    return this._timezone;
  }

  /**
   * キャッシュをクリア（テスト時や強制リフレッシュ時に使用）
   */
  clearCache() {
    this._spreadsheet = null;
    this._sheets.clear();
    this._timezone = null;
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

function getSheetByName(sheetName) {
  return SS_MANAGER.getSheet(sheetName);
}

function getSpreadsheetTimezone() {
  return SS_MANAGER.getTimezone();
}
