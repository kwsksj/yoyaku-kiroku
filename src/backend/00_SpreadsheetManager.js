/// <reference path="../../types/backend-index.d.ts" />

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
export const SALES_SPREADSHEET_ID =
  PropertiesService.getScriptProperties().getProperty('SALES_SPREADSHEET_ID');

/**
 * スプレッドシートマネージャー
 * アプリケーション全体でスプレッドシートオブジェクトを共有・管理
 */
export class SpreadsheetManager {
  constructor() {
    this._spreadsheet = null;
    this._sheets = new Map();
    this._isWarming = false;
    this._warmupPromise = null;
  }

  /**
   * アクティブなスプレッドシートオブジェクトを取得（キャッシュ付き）
   * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
   */
  getSpreadsheet() {
    // キャッシュの有効性を検証（GAS実行コンテキスト変更対応）
    if (this._spreadsheet) {
      try {
        // スプレッドシートオブジェクトが有効かテスト
        this._spreadsheet.getId();
        Logger.log(
          `[SS_MANAGER] キャッシュからSpreadsheet取得: ${new Date().toISOString()}`,
        );
        return this._spreadsheet;
      } catch (error) {
        // キャッシュが無効になった場合はクリアして再取得
        Logger.log(
          `[SS_MANAGER] キャッシュ無効化検出、再取得実行: ${error.message}`,
        );
        this._spreadsheet = null;
        this._sheets.clear();
      }
    }

    // 新規取得またはキャッシュ無効時の再取得
    Logger.log(
      `[SS_MANAGER] SpreadsheetApp.getActiveSpreadsheet()呼び出し: ${new Date().toISOString()}`,
    );
    const startTime = new Date();

    try {
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

      // 初期化成功時にPropertiesServiceにタイムスタンプを保存
      PropertiesService.getScriptProperties().setProperty(
        'SS_MANAGER_LAST_INIT',
        new Date().toISOString(),
      );
    } catch (error) {
      Logger.log(`[SS_MANAGER] 初期化エラー: ${error.message}`);
      // 重要：エラー時もnullでは返さず、再試行
      Utilities.sleep(1000); // 1秒待機後に再試行
      this._spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      Logger.log(`[SS_MANAGER] 再試行成功`);
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
   * スプレッドシートの事前ウォームアップ（非同期）
   * GAS実行環境の初期化遅延を回避するため、バックグラウンドで事前に初期化
   */
  warmupAsync() {
    // 既に初期化済みかチェック（PropertiesServiceベース）
    const lastInit = PropertiesService.getScriptProperties().getProperty(
      'SS_MANAGER_LAST_INIT',
    );
    const now = new Date().getTime();

    if (lastInit) {
      const timeDiff = now - new Date(lastInit).getTime();
      // 5分以内に初期化済みなら、現在のコンテキストでも有効とみなす
      if (timeDiff < 5 * 60 * 1000 && this._spreadsheet) {
        Logger.log(
          `[SS_MANAGER] ウォームアップスキップ: ${Math.round(timeDiff / 1000)}秒前に初期化済み`,
        );
        return;
      }
    }

    if (this._isWarming) {
      Logger.log(`[SS_MANAGER] ウォームアップ中につきスキップ`);
      return;
    }

    this._isWarming = true;
    Logger.log(`[SS_MANAGER] ウォームアップ開始: ${new Date().toISOString()}`);

    // 非同期でスプレッドシートを初期化
    try {
      const startTime = new Date();

      // 【GAS環境安定化】段階的初期化アプローチ
      Logger.log(
        `[SS_MANAGER] Step1: SpreadsheetApp.getActiveSpreadsheet() 実行開始`,
      );
      this._spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

      Logger.log(`[SS_MANAGER] Step2: 基本情報取得開始`);
      const spreadsheetId = this._spreadsheet.getId();
      Logger.log(
        `[SS_MANAGER] Step3: ID取得完了: ${spreadsheetId.substring(0, 10)}...`,
      );

      const spreadsheetName = this._spreadsheet.getName();
      Logger.log(`[SS_MANAGER] Step4: 名前取得完了: ${spreadsheetName}`);

      // 【重要】GAS環境の安定化のため、少し待機
      Utilities.sleep(100);

      const sheetCount = this._spreadsheet.getSheets().length;
      Logger.log(`[SS_MANAGER] Step5: シート数取得完了: ${sheetCount}`);

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // PropertiesServiceに成功時刻を記録
      PropertiesService.getScriptProperties().setProperty(
        'SS_MANAGER_LAST_INIT',
        endTime.toISOString(),
      );
      Logger.log(`[SS_MANAGER] Step6: PropertiesService保存完了`);

      Logger.log(
        `[SS_MANAGER] ウォームアップ完了: ${endTime.toISOString()}, 所要時間: ${duration}ms`,
      );

      this._isWarming = false;
    } catch (error) {
      Logger.log(`[SS_MANAGER] ウォームアップエラー: ${error.message}`);
      // 重要：エラー時もnullでは返さず、再試行
      Logger.log(`[SS_MANAGER] 1秒待機後に再試行`);
      Utilities.sleep(1000);
      try {
        this._spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
        Logger.log(`[SS_MANAGER] 再試行成功`);
      } catch (retryError) {
        Logger.log(`[SS_MANAGER] 再試行も失敗: ${retryError.message}`);
        this._spreadsheet = null;
      }
      this._isWarming = false;
    }
  }

  /**
   * キャッシュをクリア（テスト時や強制リフレッシュ時に使用）
   */
  clearCache() {
    this._spreadsheet = null;
    this._sheets.clear();
    this._isWarming = false;
    this._warmupPromise = null;
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
export const SS_MANAGER = new SpreadsheetManager();
