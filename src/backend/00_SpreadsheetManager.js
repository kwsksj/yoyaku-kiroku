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

// 実行時取得定数
export const SALES_SPREADSHEET_ID =
  PropertiesService.getScriptProperties().getProperty('SALES_SPREADSHEET_ID');

/**
 * スプレッドシートマネージャー
 * アプリケーション全体でスプレッドシートオブジェクトを共有・管理
 */
export class SpreadsheetManager {
  constructor() {
    /** @type {GoogleAppsScript.Spreadsheet.Spreadsheet | null} */
    this._spreadsheet = null;
    /** @type {Map<string, GoogleAppsScript.Spreadsheet.Sheet | null>} */
    this._sheets = new Map();
    this._isWarming = false;
    /** @type {Promise<void> | null} */
    this._warmupPromise = null;
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
    this._externalSpreadsheets = new Map();
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
   * @returns {GoogleAppsScript.Spreadsheet.Sheet | null | undefined}
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
   * 外部スプレッドシート用キャッシュを取得（必要に応じて初期化）
   * @param {string} spreadsheetId
   * @returns {{ spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet | null, sheets: Map<string, GoogleAppsScript.Spreadsheet.Sheet | null> }}
   * @private
   */
  _ensureExternalSpreadsheetCache(spreadsheetId) {
    if (!spreadsheetId) {
      throw new Error(
        'Spreadsheet ID is required to access external spreadsheets.',
      );
    }

    let cache = this._externalSpreadsheets.get(spreadsheetId) || null;

    if (cache?.spreadsheet) {
      try {
        cache.spreadsheet.getId();
      } catch (error) {
        Logger.log(
          `[SS_MANAGER] 外部Spreadsheetキャッシュ無効化検出(ID: ${spreadsheetId.substring(
            0,
            10,
          )}...): ${error.message}`,
        );
        this._externalSpreadsheets.delete(spreadsheetId);
        cache = null;
      }
    }

    if (!cache) {
      Logger.log(
        `[SS_MANAGER] 外部Spreadsheet(${spreadsheetId.substring(0, 10)}...)取得開始: ${new Date().toISOString()}`,
      );
      const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
      cache = {
        spreadsheet,
        sheets: new Map(),
      };
      this._externalSpreadsheets.set(spreadsheetId, cache);
      Logger.log(
        `[SS_MANAGER] 外部Spreadsheet(${spreadsheetId.substring(0, 10)}...)初期化完了: ${new Date().toISOString()}`,
      );
    }

    return cache;
  }

  /**
   * Spreadsheet IDからスプレッドシートオブジェクトを取得（キャッシュ付き）
   * @param {string} spreadsheetId
   * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
   */
  getSpreadsheetById(spreadsheetId) {
    const cache = this._ensureExternalSpreadsheetCache(spreadsheetId);
    if (!cache.spreadsheet) {
      throw new Error(
        `Spreadsheet(ID: ${spreadsheetId})の取得に失敗しました。`,
      );
    }
    return cache.spreadsheet;
  }

  /**
   * 指定IDのスプレッドシートからシートを取得（キャッシュ付き）
   * @param {string} spreadsheetId
   * @param {string} sheetName
   * @returns {GoogleAppsScript.Spreadsheet.Sheet | null | undefined}
   */
  getExternalSheet(spreadsheetId, sheetName) {
    const cache = this._ensureExternalSpreadsheetCache(spreadsheetId);
    if (!cache.sheets.has(sheetName)) {
      Logger.log(
        `[SS_MANAGER] 外部シート'${sheetName}'取得開始: ${new Date().toISOString()}`,
      );
      const sheet = cache.spreadsheet
        ? cache.spreadsheet.getSheetByName(sheetName)
        : null;
      cache.sheets.set(sheetName, sheet || null);
      if (sheet) {
        Logger.log(
          `[SS_MANAGER] 外部シート'${sheetName}'初期化完了: ${new Date().toISOString()}`,
        );
      } else {
        Logger.log(
          `[SS_MANAGER] 外部シート'${sheetName}'が見つかりませんでした: ${new Date().toISOString()}`,
        );
      }
    } else {
      Logger.log(
        `[SS_MANAGER] 外部シート'${sheetName}'キャッシュ利用: ${new Date().toISOString()}`,
      );
    }
    return cache.sheets.get(sheetName);
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
