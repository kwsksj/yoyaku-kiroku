/**
 * =================================================================
 * 【ファイル名】: 05-1_Backend_Read.gs
 * 【バージョン】: 3.0
 * 【役割】: WebAppからのデータ取得要求（Read）に特化したバックエンド機能。
 * - 予約枠、ユーザー自身の予約、会計マスタ、参加履歴などの読み取り処理を担当します。
 * 【v3.0での変更点】:
 * - フェーズ1リファクタリング: 統一APIレスポンス形式への移行
 * - 旧形式 { success: true, details: {...} } を統一形式 { success: true, data: {...}, meta: {...} } に変更
 * - 統一エラーハンドリングシステム（08_ErrorHandler.js）を使用
 * 【v2.0での変更点】:
 * - 設計変更の過程で残された、未使用の最適化関数群を削除。
 * =================================================================
 */
/**
 * 会計マスタのデータを取得します。
 * @returns {object} - 統一APIレスポンス形式
 */
function getAccountingMasterData() {
  try {
    // 1. キャッシュからデータを取得
    const accountingCache = getCachedData(CACHE_KEYS.MASTER_ACCOUNTING_DATA);

    if (accountingCache) {
      return createApiResponse(true, accountingCache.items || []);
    }

    // 2. キャッシュ再構築も失敗した場合のフォールバック
    Logger.log(
      '会計マスタキャッシュ再構築に失敗しました。スプレッドシートから直接取得します。',
    );
    const sheet = getSheetByName(ACCOUNTING_MASTER_SHEET_NAME);
    if (!sheet) throw new Error('シート「会計マスタ」が見つかりません。');

    if (sheet.getLastRow() < 2) {
      return createApiResponse(true, []);
    }

    const data = sheet.getDataRange().getValues();
    const header = data.shift();
    const timezone = getSpreadsheetTimezone();

    const timeColumns = [
      HEADER_CLASS_START,
      HEADER_CLASS_END,
      HEADER_BREAK_START,
      HEADER_BREAK_END,
    ];
    const timeColumnIndices = timeColumns.map(h => header.indexOf(h));

    const processedData = data.map(row => {
      const item = {};
      header.forEach((key, index) => {
        if (timeColumnIndices.includes(index) && row[index] instanceof Date) {
          item[key] = Utilities.formatDate(row[index], timezone, 'HH:mm');
        } else {
          item[key] = row[index];
        }
      });
      return item;
    });

    // 3. データをキャッシュに保存
    try {
      const cacheData = {
        version: new Date().getTime(),
        items: processedData,
      };
      CacheService.getScriptCache().put(
        CACHE_KEYS.MASTER_ACCOUNTING_DATA,
        JSON.stringify(cacheData),
        CACHE_EXPIRY_SECONDS,
      );
      Logger.log(
        `会計マスタデータをフォールバックで取得し、キャッシュに保存しました。件数: ${processedData.length}`,
      );
    } catch (cacheError) {
      Logger.log(`会計マスタキャッシュ保存エラー: ${cacheError.message}`);
    }

    return createApiResponse(true, processedData);
  } catch (err) {
    return BackendErrorHandler.handle(err, 'getAccountingMasterData');
  }
}
