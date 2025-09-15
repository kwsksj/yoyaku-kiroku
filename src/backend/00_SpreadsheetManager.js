/// <reference path="../../types/gas-environment.d.ts" />

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
      Logger.log(
        `[SS_MANAGER] 初回SpreadsheetApp.getActiveSpreadsheet()呼び出し: ${new Date().toISOString()}`,
      );
      const startTime = new Date();
      this._spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // スプレッドシート情報を取得
      const sheetCount = this._spreadsheet.getSheets().length;
      const spreadsheetName = this._spreadsheet.getName();

      Logger.log(
        `[SS_MANAGER] Spreadsheet初期化完了: ${endTime.toISOString()}, 所要時間: ${duration}ms`,
      );
      Logger.log(
        `[SS_MANAGER] スプレッドシート名: ${spreadsheetName}, シート数: ${sheetCount}`,
      );
    } else {
      Logger.log(
        `[SS_MANAGER] キャッシュからSpreadsheet取得: ${new Date().toISOString()}`,
      );
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
      Logger.log(
        `[SS_MANAGER] 初回シート'${sheetName}'取得: ${new Date().toISOString()}`,
      );
      const sheet = this.getSpreadsheet().getSheetByName(sheetName);
      this._sheets.set(sheetName, sheet);
      Logger.log(
        `[SS_MANAGER] シート'${sheetName}'初期化完了: ${new Date().toISOString()}`,
      );
    } else {
      Logger.log(
        `[SS_MANAGER] キャッシュからシート'${sheetName}'取得: ${new Date().toISOString()}`,
      );
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
