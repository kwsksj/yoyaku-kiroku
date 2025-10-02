/// <reference path="../../types/gas-environment.d.ts" />
/// <reference path="../../types/constants.d.ts" />
/// <reference path="../../types/api-types.d.ts" />
/// <reference path="../../types/core/index.d.ts" />
/// <reference path="../../types/dto/index.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 07_CacheManager.js
 * 【バージョン】: 6.0
 * 【役割】: キャッシュ管理システム
 * 【v6.0での変更点】:
 * - Phase 3: 型システム統一 - Core型・DTO型参照の追加
 * - 将来的な ReservationCore[] への移行準備
 * - 差分更新関数の型定義明確化
 * =================================================================
 */

/**
 * ヘッダーマップから型安全にインデックスを取得するヘルパー関数
 * @param {HeaderMapType} headerMap - ヘッダーマップ（MapまたはRecord）
 * @param {string} headerName - ヘッダー名
 * @returns {number | undefined} インデックス値
 */
function getHeaderIndex(headerMap, headerName) {
  if (headerMap instanceof Map) {
    return headerMap.get(headerName);
  }
  return headerMap[headerName];
}

/**
 * ヘッダーマップをRecord型に正規化するヘルパー関数
 * @param {HeaderMapType} headerMap - ヘッダーマップ（MapまたはRecord）
 * @returns {Record<string, number>} Record型のヘッダーマップ
 */
function normalizeHeaderMap(headerMap) {
  if (headerMap instanceof Map) {
    return Object.fromEntries(headerMap);
  }
  return headerMap;
}

/**
 * キャッシュデータの型安全な取得ヘルパー関数
 * @param {any} cacheData - キャッシュデータ
 * @param {string} property - プロパティ名
 * @returns {any} プロパティ値
 */
function getCacheProperty(cacheData, property) {
  return cacheData && typeof cacheData === 'object'
    ? cacheData[property]
    : undefined;
}

/**
 * 日付・時刻値をフォーマットするヘルパー関数
 * @param {any} dateValue - 日付値
 * @param {'date' | 'time'} type - フォーマット種別
 * @returns {string} フォーマット済み文字列
 */
function formatDateTimeValue(dateValue, type) {
  const formatters = {
    date: (/** @type {any} */ dateValue) => {
      if (dateValue instanceof Date) {
        return Utilities.formatDate(dateValue, 'Asia/Tokyo', 'yyyy-MM-dd');
      }
      return String(dateValue);
    },
    time: (/** @type {any} */ dateValue) => {
      if (dateValue instanceof Date) {
        return Utilities.formatDate(dateValue, 'Asia/Tokyo', 'HH:mm');
      }
      return String(dateValue);
    },
  };
  return formatters[type](dateValue);
}

/**
 * =================================================================
 * 【ファイル名】: 07_CacheManager.js
 * 【バージョン】: 5.5
 * 【役割】: CacheServiceベースの統合キャッシュ管理システム
 *
 * 【主要機能】:
 * ✅ 統合データキャッシュ管理
 *   - 全予約データ（統合予約シート）
 *   - 生徒基本情報（生徒名簿）
 *   - 日程マスターデータ
 *   - 会計マスターデータ
 *
 * ✅ キャッシュ操作API
 *   - getCachedData(): 統一キャッシュ取得インターフェース
 *   - 自動再構築機能（キャッシュ未存在時）
 *   - キャッシュ情報管理（バージョン、件数、更新日時）
 *
 * ✅ 管理・保守機能
 *   - 一括キャッシュ再構築（UI付き）
 *   - 定期自動再構築（トリガー実行）
 *   - PropertiesServiceクリーンアップ（古いキャッシュ削除）
 *
 * 【v5.0での変更点】:
 * - rebuild系関数名を統一（rebuildAll***Cache, rebuild***Cache）
 * - getCachedData()による統一キャッシュアクセスAPI導入
 * - CACHE_KEYS定数による一元管理
 * - JSDocとエラーハンドリングの全面改善
 * - PropertiesService整理機能の責任分離と特化
 * =================================================================
 */

/**
 * 予約キャッシュに新しい予約データを追加（インクリメンタル更新）
 * シート全体の再読み込みを避けて、パフォーマンスを大幅に向上
 * @param {(string|number|Date)[]} newReservationRow - 新しい予約行データ
 * @param {HeaderMapType} headerMap - ヘッダーマッピング
 */
function addReservationToCache(newReservationRow, headerMap) {
  try {
    Logger.log('[CACHE] インクリメンタル予約追加開始');
    const startTime = new Date();

    // 現在のキャッシュを取得
    const currentCache = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);
    if (!currentCache || !getCacheProperty(currentCache, 'reservations')) {
      // キャッシュが存在しない場合は通常の再構築
      Logger.log('[CACHE] 既存キャッシュなし、通常の再構築実行');
      rebuildAllReservationsCache();
      return;
    }

    // 日付・時刻フォーマット処理
    const dateColumnIndex = getHeaderIndex(
      headerMap,
      CONSTANTS.HEADERS.RESERVATIONS.DATE,
    );
    const startTimeColumnIndex = getHeaderIndex(
      headerMap,
      CONSTANTS.HEADERS.RESERVATIONS.START_TIME,
    );
    const endTimeColumnIndex = getHeaderIndex(
      headerMap,
      CONSTANTS.HEADERS.RESERVATIONS.END_TIME,
    );

    // フォーマット済みの行データを作成
    const formattedRow = [...newReservationRow];
    if (
      dateColumnIndex !== undefined &&
      formattedRow[dateColumnIndex] instanceof Date
    ) {
      const dateValue = formattedRow[dateColumnIndex];
      const year = dateValue.getFullYear();
      const month = String(dateValue.getMonth() + 1).padStart(2, '0');
      const day = String(dateValue.getDate()).padStart(2, '0');
      formattedRow[dateColumnIndex] = `${year}-${month}-${day}`;
    }
    if (
      startTimeColumnIndex !== undefined &&
      formattedRow[startTimeColumnIndex] instanceof Date
    ) {
      const timeValue = formattedRow[startTimeColumnIndex];
      const hours = String(timeValue.getHours()).padStart(2, '0');
      const minutes = String(timeValue.getMinutes()).padStart(2, '0');
      formattedRow[startTimeColumnIndex] = `${hours}:${minutes}`;
    }
    if (
      endTimeColumnIndex !== undefined &&
      formattedRow[endTimeColumnIndex] instanceof Date
    ) {
      const timeValue = formattedRow[endTimeColumnIndex];
      const hours = String(timeValue.getHours()).padStart(2, '0');
      const minutes = String(timeValue.getMinutes()).padStart(2, '0');
      formattedRow[endTimeColumnIndex] = `${hours}:${minutes}`;
    }

    // キャッシュに新しい予約を追加
    const currentReservations = /** @type {ReservationRawDataArray} */ (
      getCacheProperty(currentCache, 'reservations')
    );
    const updatedReservations = [formattedRow, ...currentReservations]; // 新しい予約を先頭に追加

    // 更新されたキャッシュデータを構築
    /** @type {ReservationCacheData} */
    const updatedCacheData = {
      version: new Date().getTime(),
      reservations: updatedReservations,
      headerMap:
        getCacheProperty(currentCache, 'headerMap') ||
        normalizeHeaderMap(headerMap),
      metadata: {
        totalCount: updatedReservations.length,
        lastUpdated: new Date().toISOString(),
      },
    };

    // キャッシュを更新
    CacheService.getScriptCache().put(
      CACHE_KEYS.ALL_RESERVATIONS,
      JSON.stringify(updatedCacheData),
      CACHE_EXPIRY_SECONDS,
    );

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    Logger.log(
      `[CACHE] インクリメンタル予約追加完了: ${duration}ms, 総件数: ${updatedReservations.length}`,
    );
  } catch (error) {
    Logger.log(
      `[CACHE] インクリメンタル更新エラー: ${error.message}, 通常の再構築実行`,
    );
    // エラー時は従来の再構築にフォールバック
    rebuildAllReservationsCache();
  }
}

/**
 * キャッシュ内の予約ステータスを更新（インクリメンタル更新）
 * キャンセル処理などで使用し、シート全体の再読み込みを回避
 * @param {string} reservationId - 更新対象の予約ID
 * @param {string} newStatus - 新しいステータス
 */
function updateReservationStatusInCache(reservationId, newStatus) {
  try {
    Logger.log('[CACHE] インクリメンタルステータス更新開始');
    const startTime = new Date();

    // 現在のキャッシュを取得
    const currentCache = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);
    if (!currentCache || !getCacheProperty(currentCache, 'reservations')) {
      // キャッシュが存在しない場合は通常の再構築
      Logger.log('[CACHE] 既存キャッシュなし、通常の再構築実行');
      rebuildAllReservationsCache();
      return;
    }

    // 予約IDに該当する行を検索してステータス更新
    const headerMap = getCacheProperty(currentCache, 'headerMap') || {};
    const reservationIdColumnIndex =
      headerMap[CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID];
    const statusColumnIndex = headerMap[CONSTANTS.HEADERS.RESERVATIONS.STATUS];

    if (
      reservationIdColumnIndex === undefined ||
      statusColumnIndex === undefined
    ) {
      Logger.log('[CACHE] ヘッダーマップが不正、通常の再構築実行');
      rebuildAllReservationsCache();
      return;
    }

    const currentReservations = /** @type {ReservationRawDataArray} */ (
      getCacheProperty(currentCache, 'reservations')
    );
    let updated = false;

    for (let i = 0; i < currentReservations.length; i++) {
      const reservation = currentReservations[i];
      if (reservation[reservationIdColumnIndex] === reservationId) {
        reservation[statusColumnIndex] = newStatus;
        updated = true;
        Logger.log(
          `[CACHE] 予約ID ${reservationId} のステータスを ${newStatus} に更新`,
        );
        break;
      }
    }

    if (!updated) {
      Logger.log(
        `[CACHE] 予約ID ${reservationId} が見つかりません、通常の再構築実行`,
      );
      rebuildAllReservationsCache();
      return;
    }

    // 更新されたキャッシュデータを構築
    /** @type {ReservationCacheData} */
    const updatedCacheData = {
      version: new Date().getTime(),
      reservations: currentReservations,
      headerMap: getCacheProperty(currentCache, 'headerMap'),
      metadata: {
        totalCount: currentReservations.length,
        lastUpdated: new Date().toISOString(),
      },
    };

    // キャッシュを更新
    CacheService.getScriptCache().put(
      CACHE_KEYS.ALL_RESERVATIONS,
      JSON.stringify(updatedCacheData),
      CACHE_EXPIRY_SECONDS,
    );

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    Logger.log(
      `[CACHE] インクリメンタルステータス更新完了: ${duration}ms, 総件数: ${currentReservations.length}`,
    );
  } catch (error) {
    Logger.log(
      `[CACHE] インクリメンタルステータス更新エラー: ${error.message}, 通常の再構築実行`,
    );
    // エラー時は従来の再構築にフォールバック
    rebuildAllReservationsCache();
  }
}

/**
 * キャッシュ内の予約データを完全に更新（インクリメンタル更新）
 * 予約詳細更新処理などで使用し、シート全体の再読み込みを回避
 * @param {string} reservationId - 更新対象の予約ID
 * @param {(string|number|Date)[]} updatedRowData - 更新された行データ
 * @param {HeaderMapType} headerMap - ヘッダーマッピング
 */
function updateReservationInCache(reservationId, updatedRowData, headerMap) {
  try {
    Logger.log('[CACHE] インクリメンタル予約更新開始');
    const startTime = new Date();

    // 現在のキャッシュを取得
    const currentCache = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);
    if (!currentCache || !getCacheProperty(currentCache, 'reservations')) {
      // キャッシュが存在しない場合は通常の再構築
      Logger.log('[CACHE] 既存キャッシュなし、通常の再構築実行');
      rebuildAllReservationsCache();
      return;
    }

    // 予約IDに該当する行を検索して完全更新
    const cacheHeaderMap = getCacheProperty(currentCache, 'headerMap') || {};
    const reservationIdColumnIndex =
      cacheHeaderMap[CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID];

    if (reservationIdColumnIndex === undefined) {
      Logger.log('[CACHE] 予約IDヘッダーが見つかりません、通常の再構築実行');
      rebuildAllReservationsCache();
      return;
    }

    const currentReservations = /** @type {ReservationRawDataArray} */ (
      getCacheProperty(currentCache, 'reservations')
    );
    let updated = false;

    // 日付・時刻フォーマット処理
    const dateColumnIndex = getHeaderIndex(
      headerMap,
      CONSTANTS.HEADERS.RESERVATIONS.DATE,
    );
    const startTimeColumnIndex = getHeaderIndex(
      headerMap,
      CONSTANTS.HEADERS.RESERVATIONS.START_TIME,
    );
    const endTimeColumnIndex = getHeaderIndex(
      headerMap,
      CONSTANTS.HEADERS.RESERVATIONS.END_TIME,
    );

    // フォーマット済みの行データを作成
    const formattedRow = [...updatedRowData];
    if (
      dateColumnIndex !== undefined &&
      formattedRow[dateColumnIndex] instanceof Date
    ) {
      const dateValue = formattedRow[dateColumnIndex];
      const year = dateValue.getFullYear();
      const month = String(dateValue.getMonth() + 1).padStart(2, '0');
      const day = String(dateValue.getDate()).padStart(2, '0');
      formattedRow[dateColumnIndex] = `${year}-${month}-${day}`;
    }
    if (
      startTimeColumnIndex !== undefined &&
      formattedRow[startTimeColumnIndex] instanceof Date
    ) {
      const timeValue = formattedRow[startTimeColumnIndex];
      const hours = String(timeValue.getHours()).padStart(2, '0');
      const minutes = String(timeValue.getMinutes()).padStart(2, '0');
      formattedRow[startTimeColumnIndex] = `${hours}:${minutes}`;
    }
    if (
      endTimeColumnIndex !== undefined &&
      formattedRow[endTimeColumnIndex] instanceof Date
    ) {
      const timeValue = formattedRow[endTimeColumnIndex];
      const hours = String(timeValue.getHours()).padStart(2, '0');
      const minutes = String(timeValue.getMinutes()).padStart(2, '0');
      formattedRow[endTimeColumnIndex] = `${hours}:${minutes}`;
    }

    for (let i = 0; i < currentReservations.length; i++) {
      const reservation = currentReservations[i];
      if (reservation[reservationIdColumnIndex] === reservationId) {
        currentReservations[i] = formattedRow;
        updated = true;
        Logger.log(`[CACHE] 予約ID ${reservationId} のデータを完全更新`);
        break;
      }
    }

    if (!updated) {
      Logger.log(
        `[CACHE] 予約ID ${reservationId} が見つかりません、通常の再構築実行`,
      );
      rebuildAllReservationsCache();
      return;
    }

    // 更新されたキャッシュデータを構築
    /** @type {ReservationCacheData} */
    const updatedCacheData = {
      version: new Date().getTime(),
      reservations: currentReservations,
      headerMap: getCacheProperty(currentCache, 'headerMap'),
      metadata: {
        totalCount: currentReservations.length,
        lastUpdated: new Date().toISOString(),
      },
    };

    // キャッシュを更新
    CacheService.getScriptCache().put(
      CACHE_KEYS.ALL_RESERVATIONS,
      JSON.stringify(updatedCacheData),
      CACHE_EXPIRY_SECONDS,
    );

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    Logger.log(
      `[CACHE] インクリメンタル予約更新完了: ${duration}ms, 総件数: ${currentReservations.length}`,
    );
  } catch (error) {
    Logger.log(
      `[CACHE] インクリメンタル予約更新エラー: ${error.message}, 通常の再構築実行`,
    );
    // エラー時は従来の再構築にフォールバック
    rebuildAllReservationsCache();
  }
}

/**
 * キャッシュ内の特定列を更新（インクリメンタル更新）
 * 会計詳細保存などで使用し、シート全体の再読み込みを回避
 * @param {string} reservationId - 更新対象の予約ID
 * @param {string} columnHeaderName - 更新する列のヘッダー名
 * @param {string|number|Date} newValue - 新しい値
 */
function updateReservationColumnInCache(
  reservationId,
  columnHeaderName,
  newValue,
) {
  try {
    Logger.log('[CACHE] インクリメンタル列更新開始');
    const startTime = new Date();

    // 現在のキャッシュを取得
    const currentCache = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);
    if (!currentCache || !getCacheProperty(currentCache, 'reservations')) {
      // キャッシュが存在しない場合は通常の再構築
      Logger.log('[CACHE] 既存キャッシュなし、通常の再構築実行');
      rebuildAllReservationsCache();
      return;
    }

    // 列インデックスを取得
    const cacheHeaderMap = getCacheProperty(currentCache, 'headerMap') || {};
    const reservationIdColumnIndex =
      cacheHeaderMap[CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID];
    const targetColumnIndex = cacheHeaderMap[columnHeaderName];

    if (
      reservationIdColumnIndex === undefined ||
      targetColumnIndex === undefined
    ) {
      Logger.log('[CACHE] ヘッダーマップが不正、通常の再構築実行');
      rebuildAllReservationsCache();
      return;
    }

    const currentReservations = /** @type {ReservationRawDataArray} */ (
      getCacheProperty(currentCache, 'reservations')
    );
    let updated = false;

    for (let i = 0; i < currentReservations.length; i++) {
      const reservation = currentReservations[i];
      if (reservation[reservationIdColumnIndex] === reservationId) {
        reservation[targetColumnIndex] = newValue;
        updated = true;
        Logger.log(
          `[CACHE] 予約ID ${reservationId} の${columnHeaderName}列を更新`,
        );
        break;
      }
    }

    if (!updated) {
      Logger.log(
        `[CACHE] 予約ID ${reservationId} が見つかりません、通常の再構築実行`,
      );
      rebuildAllReservationsCache();
      return;
    }

    // 更新されたキャッシュデータを構築
    /** @type {ReservationCacheData} */
    const updatedCacheData = {
      version: new Date().getTime(),
      reservations: currentReservations,
      headerMap: getCacheProperty(currentCache, 'headerMap'),
      metadata: {
        totalCount: currentReservations.length,
        lastUpdated: new Date().toISOString(),
      },
    };

    // キャッシュを更新
    CacheService.getScriptCache().put(
      CACHE_KEYS.ALL_RESERVATIONS,
      JSON.stringify(updatedCacheData),
      CACHE_EXPIRY_SECONDS,
    );

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    Logger.log(
      `[CACHE] インクリメンタル列更新完了: ${duration}ms, 総件数: ${currentReservations.length}`,
    );
  } catch (error) {
    Logger.log(
      `[CACHE] インクリメンタル列更新エラー: ${error.message}, 通常の再構築実行`,
    );
    // エラー時は従来の再構築にフォールバック
    rebuildAllReservationsCache();
  }
}

/**
 * 全てのキャッシュデータを一括で再構築するエントリーポイント関数
 * UI確認ダイアログを表示してから、全種類のキャッシュを順次再構築します。
 * スプレッドシートのメニューから手動実行される場合に使用されます。
 *
 * 再構築対象:
 * - 統合予約データキャッシュ
 * - 生徒基本情報キャッシュ
 * - 会計マスターキャッシュ
 * - 日程マスターキャッシュ
 *
 * @throws {Error} いずれかのキャッシュ再構築中にエラーが発生した場合
 */
function rebuildAllCachesEntryPoint() {
  try {
    getActiveSpreadsheet().toast(
      'キャッシュデータの一括再構築を開始しました...',
      '処理中',
      -1,
    );

    // 全てのキャッシュを順次再構築
    rebuildAllReservationsCache();
    rebuildAllStudentsBasicCache();
    rebuildAccountingMasterCache();
    rebuildScheduleMasterCache();

    getActiveSpreadsheet().toast(
      'キャッシュデータの一括再構築が完了しました。',
      '成功',
      5,
    );

    Logger.log(
      'キャッシュ一括再構築: 全キャッシュ（予約、生徒、会計マスター、日程マスター）を再構築完了',
    );
  } catch (error) {
    handleError(
      `キャッシュデータの一括再構築中にエラーが発生しました: ${error.message}`,
      true,
    );
  }
}

/**
 * キャッシュの再構築が必要かどうかを判定します。
 * 短時間での重複実行を防止するため。
 * @returns {boolean} 再構築が必要な場合true
 */
function shouldRebuildReservationCache() {
  try {
    // 最後のキャッシュ更新時刻をチェック
    const lastRebuildTime = PropertiesService.getScriptProperties().getProperty(
      'LAST_CACHE_REBUILD_TIME',
    );
    if (!lastRebuildTime) {
      return true; // 初回実行
    }

    const now = Date.now();
    const lastTime = parseInt(lastRebuildTime, 10);
    const timeDiffMinutes = (now - lastTime) / (1000 * 60);

    // 5分以内の再構築はスキップ
    if (timeDiffMinutes < 5) {
      Logger.log(
        `キャッシュ再構築スキップ: 前回から${timeDiffMinutes.toFixed(1)}分経過`,
      );
      return false;
    }

    return true;
  } catch (e) {
    Logger.log(`shouldRebuildReservationCacheでエラー: ${e.message}`);
    return true; // エラー時は安全のため再構築を実行
  }
}

/**
 * 統合予約シートから全予約データを読み込み、CacheServiceに保存する
 * 日付・時刻列を適切にフォーマットして配列形式でキャッシュに保存します。
 *
 * @throws {Error} 統合予約シートが見つからない場合
 * @throws {Error} データ処理中にエラーが発生した場合
 */
function rebuildAllReservationsCache() {
  try {
    const integratedReservationSheet = getSheetByName('統合予約シート');
    if (!integratedReservationSheet) {
      Logger.log('統合予約シートが見つからないか、データが空です。');
      // 空データの場合もキャッシュを作成
      /** @type {ReservationCacheData} */
      const emptyCacheData = {
        version: new Date().getTime(),
        reservations: [],
      };
      CacheService.getScriptCache().put(
        CACHE_KEYS.ALL_RESERVATIONS,
        JSON.stringify(emptyCacheData),
        CACHE_EXPIRY_SECONDS,
      );
      return;
    }

    // ヘッダー行を取得してマッピングを作成
    const headerRow = integratedReservationSheet
      .getRange(1, 1, 1, integratedReservationSheet.getLastColumn())
      .getValues()[0];
    const headerColumnMap = createHeaderMap(headerRow);

    // 日付・時刻列のインデックスを取得
    const dateColumnIndex = headerColumnMap.get(
      CONSTANTS.HEADERS.RESERVATIONS.DATE,
    );
    const startTimeColumnIndex = headerColumnMap.get(
      CONSTANTS.HEADERS.RESERVATIONS.START_TIME,
    );
    const endTimeColumnIndex = headerColumnMap.get(
      CONSTANTS.HEADERS.RESERVATIONS.END_TIME,
    );

    // 会計詳細列のインデックスを取得（除外対象）
    const accountingDetailsColumnIndex = headerColumnMap.get(
      CONSTANTS.HEADERS.RESERVATIONS.ACCOUNTING_DETAILS,
    );

    // データ行を取得（パフォーマンス最適化：会計詳細列を除外して読み取り）
    const dataRowCount = integratedReservationSheet.getLastRow() - 1;
    const totalColumns = integratedReservationSheet.getLastColumn();

    // データが空の場合の処理
    if (dataRowCount < 1) {
      Logger.log('統合予約シートにデータがありません。');
      /** @type {ReservationCacheData} */
      const emptyCacheData = {
        version: new Date().getTime(),
        reservations: [],
      };
      CacheService.getScriptCache().put(
        CACHE_KEYS.ALL_RESERVATIONS,
        JSON.stringify(emptyCacheData),
        CACHE_EXPIRY_SECONDS,
      );
      return;
    }

    let allReservationRows;

    if (accountingDetailsColumnIndex !== undefined && totalColumns > 1) {
      // 会計詳細列を除外して読み取り（大幅な高速化）
      const leftColumns = accountingDetailsColumnIndex; // 会計詳細列より前の列
      const rightColumns = totalColumns - accountingDetailsColumnIndex - 1; // 会計詳細列より後の列

      /** @type {(string|number|Date)[][]} */
      let leftData = [];
      /** @type {(string|number|Date)[][]} */
      let rightData = [];

      // 左側の列データを取得
      if (leftColumns > 0) {
        leftData = integratedReservationSheet
          .getRange(2, 1, dataRowCount, leftColumns)
          .getValues();
      }

      // 右側の列データを取得
      if (rightColumns > 0) {
        rightData = integratedReservationSheet
          .getRange(
            2,
            accountingDetailsColumnIndex + 2,
            dataRowCount,
            rightColumns,
          )
          .getValues();
      }

      // データを結合し、会計詳細列の位置に空文字を挿入
      allReservationRows = [];
      for (let i = 0; i < dataRowCount; i++) {
        const leftRow = leftData[i] || [];
        const rightRow = rightData[i] || [];

        // 行データを構築：左側 + 空文字（会計詳細列） + 右側
        const fullRow = [...leftRow, '', ...rightRow];
        allReservationRows.push(fullRow);
      }
    } else {
      // 会計詳細列がない場合は従来通り
      allReservationRows = integratedReservationSheet
        .getRange(2, 1, dataRowCount, totalColumns)
        .getValues();
    }

    // 日付・時刻のフォーマット関数
    // 【パフォーマンス最適化】 事前定義されたフォーマッター（関数重複定義を排除）
    const DateTimeFormatters = {
      date: (/** @type {any} */ dateValue) => {
        if (!(dateValue instanceof Date)) return String(dateValue);
        const year = dateValue.getFullYear();
        const month = String(dateValue.getMonth() + 1).padStart(2, '0');
        const day = String(dateValue.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      },
      time: (/** @type {any} */ dateValue) => {
        if (!(dateValue instanceof Date)) return String(dateValue);
        const hours = String(dateValue.getHours()).padStart(2, '0');
        const minutes = String(dateValue.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
      },
    };

    // 【最適化】 バッチ処理で効率的にフォーマット
    const formatColumns = [
      { index: dateColumnIndex, type: 'date' },
      { index: startTimeColumnIndex, type: 'time' },
      { index: endTimeColumnIndex, type: 'time' },
    ].filter(column => column.index !== undefined);

    // データを一括処理（ループ内の関数定義を排除）
    allReservationRows.forEach(reservationRow => {
      formatColumns.forEach(({ index, type }) => {
        const originalValue = reservationRow[index];
        if (originalValue instanceof Date) {
          const formatter =
            type === 'date' ? DateTimeFormatters.date : DateTimeFormatters.time;
          reservationRow[index] = formatter(originalValue);
        }
      });

      // 会計詳細列は既にデータ読み取り時に空文字で処理済み
    });

    // 全データを日付順にソート（新しい順）
    const sortedReservations = allReservationRows.sort((a, b) => {
      const dateA = new Date(a[dateColumnIndex]);
      const dateB = new Date(b[dateColumnIndex]);
      return dateB.getTime() - dateA.getTime(); // 新しい順
    });

    // データサイズをチェックして分割キャッシュまたは通常キャッシュを決定
    const testCacheData = {
      version: new Date().getTime(),
      reservations: sortedReservations,
      headerMap: Object.fromEntries(headerColumnMap),
      metadata: {
        totalCount: sortedReservations.length,
        lastUpdated: new Date().toISOString(),
      },
    };

    const cacheDataJson = JSON.stringify(testCacheData);
    const dataSizeKB = Math.round(cacheDataJson.length / 1024);

    PerformanceLog.debug(
      `キャッシュデータサイズ: ${dataSizeKB}KB, 件数: ${sortedReservations.length}`,
    );

    if (dataSizeKB >= CHUNK_SIZE_LIMIT_KB) {
      // 分割キャッシュシステムを使用
      PerformanceLog.info(
        `データサイズが${CHUNK_SIZE_LIMIT_KB}KB以上のため、分割キャッシュシステムを使用します。`,
      );

      const dataChunks = splitDataIntoChunks(
        sortedReservations,
        CHUNK_SIZE_LIMIT_KB,
      );
      /** @type {ChunkedCacheMetadata} */
      const metadata = /** @type {ChunkedCacheMetadata} */ ({
        version: new Date().getTime(),
        headerMap: Object.fromEntries(headerColumnMap),
        totalCount: sortedReservations.length,
        totalChunks: 0, // saveChunkedDataToCache内で設定される
        isChunked: true,
        lastUpdated: new Date().toISOString(),
      });

      const success = saveChunkedDataToCache(
        CACHE_KEYS.ALL_RESERVATIONS,
        dataChunks,
        metadata,
      );

      if (!success) {
        throw new Error('分割キャッシュの保存に失敗しました');
      }

      Logger.log(
        `分割キャッシュ保存完了: ${dataChunks.length}チャンク, 合計${sortedReservations.length}件`,
      );
    } else {
      // 通常の単一キャッシュを使用
      PerformanceLog.debug('通常の単一キャッシュを使用します。');

      try {
        CacheService.getScriptCache().put(
          CACHE_KEYS.ALL_RESERVATIONS,
          cacheDataJson,
          CACHE_EXPIRY_SECONDS,
        );

        Logger.log(
          `単一キャッシュ保存完了: ${dataSizeKB}KB, ${sortedReservations.length}件`,
        );
      } catch (putError) {
        PerformanceLog.error(`単一キャッシュ保存エラー: ${putError.message}`);
        throw new Error(
          `キャッシュ保存に失敗: ${putError.message}（データサイズ: ${dataSizeKB}KB）`,
        );
      }
    }

    Logger.log(
      `全予約データキャッシュを更新しました。件数: ${sortedReservations.length}`,
    );

    // キャッシュ再構築完了時刻を記録
    PropertiesService.getScriptProperties().setProperty(
      'LAST_CACHE_REBUILD_TIME',
      Date.now().toString(),
    );
  } catch (e) {
    Logger.log(`rebuildAllReservationsCacheでエラー: ${e.message}`);
    throw e;
  }
}

/**
 * 日程マスターデータを読み込み、CacheServiceに保存する
 * 今日から1年後までの日程データを取得し、キャッシュに保存します。
 *
 * @param {string} [fromDate] - 取得開始日（YYYY-MM-DD形式、省略時は今日）
 * @param {string} [toDate] - 取得終了日（YYYY-MM-DD形式、省略時は1年後）
 * @throws {Error} 日程データの取得や処理中にエラーが発生した場合
 */
function rebuildScheduleMasterCache(fromDate, toDate) {
  try {
    // デフォルトの日付範囲を設定（今日から1年後まで）
    const today = new Date();

    const oldestDate = new Date(
      today.getFullYear() - 1,
      today.getMonth(),
      today.getDate(),
    );
    const startDate =
      fromDate ||
      Utilities.formatDate(oldestDate, CONSTANTS.TIMEZONE, 'yyyy-MM-dd');

    const oneYearLater = new Date(
      today.getFullYear() + 1,
      today.getMonth(),
      today.getDate(),
    );
    const endDate =
      toDate ||
      Utilities.formatDate(oneYearLater, CONSTANTS.TIMEZONE, 'yyyy-MM-dd');

    // 日程マスターシートから直接データを取得
    const sheet = SS_MANAGER.getSheet(CONSTANTS.SHEET_NAMES.SCHEDULE);
    if (!sheet) {
      Logger.log(
        '日程マスターシートが見つかりません。空のキャッシュを保存します。',
      );
      /** @type {ScheduleCacheData} */
      const emptyCacheData = { schedule: [], version: Date.now() };
      CacheService.getScriptCache().put(
        CACHE_KEYS.MASTER_SCHEDULE_DATA,
        JSON.stringify(emptyCacheData),
        CACHE_EXPIRY_SECONDS,
      );
      return;
    }

    const allData = sheet.getDataRange().getValues();
    const headers = allData.shift();

    // 時間列のインデックスを特定
    const timeColumnNames = [
      CONSTANTS.HEADERS.SCHEDULE.FIRST_START,
      CONSTANTS.HEADERS.SCHEDULE.FIRST_END,
      CONSTANTS.HEADERS.SCHEDULE.SECOND_START,
      CONSTANTS.HEADERS.SCHEDULE.SECOND_END,
      CONSTANTS.HEADERS.SCHEDULE.BEGINNER_START,
    ];

    const scheduleDataList = allData
      .filter(row => {
        const dateValue = row[headers.indexOf(CONSTANTS.HEADERS.SCHEDULE.DATE)];
        if (!dateValue) return false;

        // Date オブジェクトを文字列形式に変換して比較
        const dateStr =
          dateValue instanceof Date
            ? Utilities.formatDate(dateValue, CONSTANTS.TIMEZONE, 'yyyy-MM-dd')
            : String(dateValue);

        return dateStr >= startDate && dateStr <= endDate;
      })
      .map(row => {
        /** @type {ScheduleMasterData} */
        const scheduleObj = /** @type {ScheduleMasterData} */ ({});
        headers.forEach((header, index) => {
          let value = row[index];
          // 時間列の処理
          if (timeColumnNames.includes(header) && value instanceof Date) {
            value = Utilities.formatDate(value, CONSTANTS.TIMEZONE, 'HH:mm');
          }
          // 日付列の処理（文字列形式でキャッシュに保存）
          else if (header === CONSTANTS.HEADERS.SCHEDULE.DATE) {
            if (value instanceof Date) {
              // Date型を文字列形式に変換してキャッシュ保存
              value = Utilities.formatDate(
                value,
                CONSTANTS.TIMEZONE,
                'yyyy-MM-dd',
              );
            } else if (value && typeof value === 'string') {
              // 文字列の場合は一度Date型に変換して検証後、文字列に戻す
              try {
                const dateObj = new Date(value);
                if (isNaN(dateObj.getTime())) {
                  Logger.log(`無効な日付文字列: ${value}, 行をスキップ`);
                  return null; // 無効な行をスキップ
                }
                value = Utilities.formatDate(
                  dateObj,
                  CONSTANTS.TIMEZONE,
                  'yyyy-MM-dd',
                );
              } catch (error) {
                Logger.log(`日付変換エラー: ${value}, 行をスキップ`);
                return null; // 無効な行をスキップ
              }
            } else {
              Logger.log(`無効な日付値: ${value}, 行をスキップ`);
              return null; // 無効な行をスキップ
            }
          }

          // 日本語ヘッダーを英語プロパティ名に変換
          let propertyName = header;
          switch (header) {
            case CONSTANTS.HEADERS.SCHEDULE.DATE:
              propertyName = 'date';
              break;
            case CONSTANTS.HEADERS.SCHEDULE.CLASSROOM:
              propertyName = 'classroom';
              break;
            case CONSTANTS.HEADERS.SCHEDULE.VENUE:
              propertyName = 'venue';
              break;
            case CONSTANTS.HEADERS.SCHEDULE.TYPE:
              propertyName = 'classroomType';
              break;
            case CONSTANTS.HEADERS.SCHEDULE.FIRST_START:
              propertyName = 'firstStart';
              break;
            case CONSTANTS.HEADERS.SCHEDULE.FIRST_END:
              propertyName = 'firstEnd';
              break;
            case CONSTANTS.HEADERS.SCHEDULE.SECOND_START:
              propertyName = 'secondStart';
              break;
            case CONSTANTS.HEADERS.SCHEDULE.SECOND_END:
              propertyName = 'secondEnd';
              break;
            case CONSTANTS.HEADERS.SCHEDULE.BEGINNER_START:
              propertyName = 'beginnerStart';
              break;
            case CONSTANTS.HEADERS.SCHEDULE.TOTAL_CAPACITY:
              propertyName = 'totalCapacity';
              break;
            case CONSTANTS.HEADERS.SCHEDULE.BEGINNER_CAPACITY:
              propertyName = 'beginnerCapacity';
              break;
            case CONSTANTS.HEADERS.SCHEDULE.STATUS:
              propertyName = 'status';
              break;
            case CONSTANTS.HEADERS.SCHEDULE.NOTES:
              propertyName = 'notes';
              break;
            // その他はそのまま
          }

          scheduleObj[propertyName] = value;
        });
        return scheduleObj;
      })
      .filter(scheduleObj => scheduleObj !== null); // 無効な行を除外

    // ★ 日付順でソート処理を追加（文字列形式前提）
    if (scheduleDataList && scheduleDataList.length > 0) {
      scheduleDataList.sort((a, b) => {
        // 文字列形式（yyyy-MM-dd）で保存されているため文字列比較
        const dateA = String(a.date);
        const dateB = String(b.date);
        return dateA.localeCompare(dateB);
      });
    }

    const cacheData = {
      version: new Date().getTime(),
      schedule: scheduleDataList || [],
      dateRange: {
        from: startDate,
        to: endDate,
        cached: new Date().toISOString(),
      },
    };

    CacheService.getScriptCache().put(
      CACHE_KEYS.MASTER_SCHEDULE_DATA,
      JSON.stringify(cacheData),
      CACHE_EXPIRY_SECONDS,
    );

    Logger.log(
      `日程マスターデータキャッシュを更新しました。件数: ${scheduleDataList?.length || 0}、期間: ${startDate} ～ ${endDate}`,
    );
    return cacheData;
  } catch (error) {
    Logger.log(`rebuildScheduleMasterCacheでエラー: ${error.message}`);
    throw new Error(
      `日程マスターのキャッシュ作成に失敗しました: ${error.message}`,
    );
  }
}

/**
 * 会計マスターデータを読み込み、CacheServiceに保存する
 * スプレッドシートの「会計マスタ」シートから直接データを読み込み、
 * 時間列を適切にフォーマットしてキャッシュに保存します。
 *
 * @throws {Error} 会計マスタシートが見つからない場合
 * @throws {Error} データ処理中にエラーが発生した場合
 */
function rebuildAccountingMasterCache() {
  try {
    const sheet = getSheetByName(CONSTANTS.SHEET_NAMES.ACCOUNTING);
    if (!sheet) {
      throw new Error('会計マスタシートが見つかりません');
    }

    if (sheet.getLastRow() < 2) {
      Logger.log('会計マスタシートにデータがありません');
      /** @type {AccountingCacheData} */
      const emptyCacheData = {
        version: new Date().getTime(),
        items: [],
      };
      CacheService.getScriptCache().put(
        CACHE_KEYS.MASTER_ACCOUNTING_DATA,
        JSON.stringify(emptyCacheData),
        CACHE_EXPIRY_SECONDS,
      );
      return;
    }

    const allData = sheet.getDataRange().getValues();
    const headers = allData.shift();

    // 削除済み: 会計マスタに時刻情報がなくなったため、時間列の処理は不要
    // 時刻情報は日程マスタから取得

    // データを処理してオブジェクト形式に変換
    const processedItems = allData.map(rowData => {
      /** @type {Partial<AccountingMasterItem>} */
      const item = {};
      headers.forEach((headerName, columnIndex) => {
        const cellValue = rowData[columnIndex];
        item[headerName] = cellValue;
      });
      return item;
    });

    const cacheData = {
      version: new Date().getTime(),
      items: processedItems,
    };

    CacheService.getScriptCache().put(
      CACHE_KEYS.MASTER_ACCOUNTING_DATA,
      JSON.stringify(cacheData),
      CACHE_EXPIRY_SECONDS,
    );

    Logger.log(
      `会計マスターデータキャッシュを更新しました。件数: ${processedItems.length}`,
    );
    return cacheData;
  } catch (error) {
    Logger.log(`rebuildAccountingMasterCacheでエラー: ${error.message}`);
    throw new Error(
      `会計マスターのキャッシュ作成に失敗しました: ${error.message}`,
    );
  }
}

/**
 * 生徒名簿から基本情報（ID、本名、ニックネーム、電話番号）を読み込み、CacheServiceに保存する
 * 生徒IDをキーとしたオブジェクト形式でキャッシュに保存します。
 *
 * @throws {Error} 生徒名簿シートが見つからない場合
 * @throws {Error} 必須ヘッダーが見つからない場合
 * @throws {Error} データ処理中にエラーが発生した場合
 */
function rebuildAllStudentsBasicCache() {
  try {
    const studentRosterSheet = getSheetByName(CONSTANTS.SHEET_NAMES.ROSTER);
    if (!studentRosterSheet || studentRosterSheet.getLastRow() < 2) {
      Logger.log('生徒名簿シートが見つからないか、データが空です。');
      // 空データの場合もキャッシュを作成
      const emptyCacheData = {
        version: new Date().getTime(),
        students: {},
      };
      CacheService.getScriptCache().put(
        CACHE_KEYS.ALL_STUDENTS_BASIC,
        JSON.stringify(emptyCacheData),
        CACHE_EXPIRY_SECONDS,
      );
      return;
    }

    // ヘッダー行を取得してマッピングを作成
    const headerRow = studentRosterSheet
      .getRange(1, 1, 1, studentRosterSheet.getLastColumn())
      .getValues()[0];
    const headerColumnMap = createHeaderMap(headerRow);

    // 必須列のインデックスを取得
    const requiredColumns = {
      studentId: headerColumnMap.get(CONSTANTS.HEADERS.ROSTER.STUDENT_ID),
      realName: headerColumnMap.get(CONSTANTS.HEADERS.ROSTER.REAL_NAME),
      nickname: headerColumnMap.get(CONSTANTS.HEADERS.ROSTER.NICKNAME),
      phone: headerColumnMap.get(CONSTANTS.HEADERS.ROSTER.PHONE),
    };

    // オプション列のインデックスを取得（メール関連・通知設定）
    const optionalColumns = {
      email: headerColumnMap.get(CONSTANTS.HEADERS.ROSTER.EMAIL),
      emailPreference: headerColumnMap.get(
        CONSTANTS.HEADERS.ROSTER.EMAIL_PREFERENCE,
      ),
      scheduleNotificationPreference: headerColumnMap.get(
        CONSTANTS.HEADERS.ROSTER.SCHEDULE_NOTIFICATION_PREFERENCE,
      ),
      notificationDay: headerColumnMap.get(
        CONSTANTS.HEADERS.ROSTER.NOTIFICATION_DAY,
      ),
      notificationHour: headerColumnMap.get(
        CONSTANTS.HEADERS.ROSTER.NOTIFICATION_HOUR,
      ),
    };

    // 必須列の存在確認
    const missingColumns = Object.entries(requiredColumns)
      .filter(([, index]) => index === undefined)
      .map(([columnName]) => columnName);

    if (missingColumns.length > 0) {
      throw new Error(
        `生徒名簿の必須ヘッダーが見つかりません: ${missingColumns.join(', ')}`,
      );
    }

    // データ行を取得
    const dataRowCount = studentRosterSheet.getLastRow() - 1;
    const allStudentRows = studentRosterSheet
      .getRange(2, 1, dataRowCount, studentRosterSheet.getLastColumn())
      .getValues();

    // 生徒データをオブジェクト形式に変換
    /** @type {{ [studentId: string]: StudentData }} */
    const studentsDataMap = {};
    allStudentRows.forEach((studentRow, index) => {
      const studentId = studentRow[requiredColumns.studentId];
      if (studentId && String(studentId).trim()) {
        // メール連絡希望フラグの処理
        let wantsEmail = false;
        if (optionalColumns.emailPreference !== undefined) {
          const preference = studentRow[optionalColumns.emailPreference];
          wantsEmail =
            preference === 'TRUE' ||
            preference === '希望する' ||
            preference === true;
        }

        // 日程連絡希望フラグの処理
        let wantsScheduleNotification = false;
        if (optionalColumns.scheduleNotificationPreference !== undefined) {
          const preference =
            studentRow[optionalColumns.scheduleNotificationPreference];
          wantsScheduleNotification =
            preference === 'TRUE' ||
            preference === '希望する' ||
            preference === true;
        }

        // 通知設定の取得
        const notificationDay =
          optionalColumns.notificationDay !== undefined
            ? studentRow[optionalColumns.notificationDay]
            : null;
        const notificationHour =
          optionalColumns.notificationHour !== undefined
            ? studentRow[optionalColumns.notificationHour]
            : null;

        studentsDataMap[studentId] = {
          studentId: studentId,
          displayName:
            studentRow[requiredColumns.nickname] ||
            studentRow[requiredColumns.realName] ||
            '',
          realName: studentRow[requiredColumns.realName] || '',
          nickname: studentRow[requiredColumns.nickname] || '',
          phone: studentRow[requiredColumns.phone] || '',
          email:
            optionalColumns.email !== undefined
              ? studentRow[optionalColumns.email] || ''
              : '',
          wantsEmail: wantsEmail,
          wantsScheduleNotification: wantsScheduleNotification,
          notificationDay: notificationDay,
          notificationHour: notificationHour,
          rowIndex: index + 2, // ヘッダー行を考慮した実際の行番号 (1-based + header)
        };
      }
    });

    // 生徒データを配列形式に変換（分割キャッシュ用）
    const studentsArray = Object.values(studentsDataMap);

    const cacheData = {
      version: new Date().getTime(),
      students: studentsDataMap,
      metadata: {
        totalCount: Object.keys(studentsDataMap).length,
        lastUpdated: new Date().toISOString(),
      },
    };

    // データサイズをチェックして分割キャッシュまたは通常キャッシュを決定
    const cacheDataJson = JSON.stringify(cacheData);
    const dataSizeKB = Math.round(cacheDataJson.length / 1024);

    Logger.log(
      `生徒名簿キャッシュデータサイズ: ${dataSizeKB}KB, 件数: ${studentsArray.length}`,
    );

    if (dataSizeKB >= CHUNK_SIZE_LIMIT_KB) {
      // 分割キャッシュシステムを使用
      Logger.log(
        `データサイズが${CHUNK_SIZE_LIMIT_KB}KB以上のため、分割キャッシュシステムを使用します。`,
      );

      const dataChunks = splitDataIntoChunks(
        studentsArray,
        CHUNK_SIZE_LIMIT_KB,
      );
      /** @type {ChunkedCacheMetadata} */
      const metadata = /** @type {ChunkedCacheMetadata} */ ({
        version: new Date().getTime(),
        totalCount: studentsArray.length,
        lastUpdated: new Date().toISOString(),
        isChunked: true,
      });

      const success = saveChunkedDataToCache(
        CACHE_KEYS.ALL_STUDENTS_BASIC,
        dataChunks,
        metadata,
        CACHE_EXPIRY_SECONDS,
      );

      if (success) {
        Logger.log(
          `生徒基本情報キャッシュを分割保存しました。件数: ${studentsArray.length}, チャンク数: ${dataChunks.length}`,
        );
      } else {
        Logger.log('⚠️ 分割キャッシュの保存に失敗しました。');
        throw new Error('分割キャッシュの保存に失敗しました。');
      }
    } else {
      // 通常のキャッシュシステムを使用
      CacheService.getScriptCache().put(
        CACHE_KEYS.ALL_STUDENTS_BASIC,
        cacheDataJson,
        CACHE_EXPIRY_SECONDS,
      );

      Logger.log(
        `生徒基本情報キャッシュを更新しました。件数: ${Object.keys(studentsDataMap).length}`,
      );
    }
  } catch (e) {
    Logger.log(`rebuildAllStudentsBasicCacheでエラー: ${e.message}`);
    throw e;
  }
}

/**
 * 日程マスタのステータスを自動更新（開催予定 → 開催済み）
 * 現在日時を基準に、過去の開催予定講座を開催済みに変更します。
 *
 * 判定基準:
 * - 日付が今日より前
 * - ステータスが「開催予定」
 *
 * @returns {number} 更新した件数
 */
function updateScheduleStatusToCompleted() {
  try {
    Logger.log('[ScheduleStatus] 開催済みステータス自動更新を開始');

    const sheet = SS_MANAGER.getSheet(CONSTANTS.SHEET_NAMES.SCHEDULE);
    if (!sheet) {
      Logger.log('[ScheduleStatus] 日程マスターシートが見つかりません');
      return 0;
    }

    // 現在の日時を取得（JST）
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    Logger.log(`[ScheduleStatus] 基準日時: ${today.toDateString()}`);

    // シートからデータを取得
    const dataRange = sheet.getDataRange();
    const allData = dataRange.getValues();

    if (allData.length <= 1) {
      Logger.log('[ScheduleStatus] データが存在しません');
      return 0;
    }

    const headers = allData[0];
    const dateColIndex = headers.indexOf(CONSTANTS.HEADERS.SCHEDULE.DATE);
    const statusColIndex = headers.indexOf(CONSTANTS.HEADERS.SCHEDULE.STATUS);

    if (dateColIndex === -1 || statusColIndex === -1) {
      Logger.log('[ScheduleStatus] 必要な列が見つかりません');
      return 0;
    }

    let updatedCount = 0;

    // データ行をチェック（2行目から）
    for (let i = 1; i < allData.length; i++) {
      const row = allData[i];
      const scheduleDate = row[dateColIndex];
      const currentStatus = row[statusColIndex];

      // 開催予定のみを対象とする
      if (currentStatus !== CONSTANTS.SCHEDULE_STATUS.SCHEDULED) {
        continue;
      }

      // 日付チェック
      let isDatePast = false;
      if (scheduleDate instanceof Date) {
        isDatePast = scheduleDate < today;
      } else if (scheduleDate && typeof scheduleDate === 'string') {
        try {
          const parsedDate = new Date(scheduleDate);
          isDatePast = parsedDate < today;
        } catch (error) {
          Logger.log(`[ScheduleStatus] 日付解析エラー: ${scheduleDate}`);
          continue;
        }
      } else {
        continue;
      }

      // 過去の日付の場合、開催済みに更新
      if (isDatePast) {
        sheet
          .getRange(i + 1, statusColIndex + 1)
          .setValue(CONSTANTS.SCHEDULE_STATUS.COMPLETED);
        updatedCount++;

        Logger.log(
          `[ScheduleStatus] 更新: ${scheduleDate} → ${CONSTANTS.SCHEDULE_STATUS.COMPLETED}`,
        );
      }
    }

    Logger.log(
      `[ScheduleStatus] 開催済みステータス更新完了: ${updatedCount}件`,
    );
    return updatedCount;
  } catch (error) {
    Logger.log(`[ScheduleStatus] エラー: ${error.message}`);
    return 0;
  }
}

/**
 * 時間主導型トリガーから自動実行されるキャッシュ再構築関数
 * 定期的にスケジュールされたトリガーが呼び出す関数です。
 * スクリプトロックを使用して同時実行を防止します。
 *
 * 処理内容:
 * - 日程マスタのステータス自動更新（開催予定 → 開催済み）
 * - 全キャッシュデータの定期再構築
 * - エラー発生時のログ記録
 * - アクティビティログの記録
 *
 * @throws {Error} ロック取得失敗やキャッシュ再構築中のエラーは内部でキャッチされログに記録
 */
function triggerScheduledCacheRebuild() {
  const scriptLock = LockService.getScriptLock();

  // 他の処理が実行中の場合はスキップ
  if (!scriptLock.tryLock(CONSTANTS.LIMITS.LOCK_WAIT_TIME_MS)) {
    Logger.log(
      '定期キャッシュ再構築: 他の処理が実行中のためスキップしました。',
    );
    return;
  }

  try {
    PerformanceLog.info('定期メンテナンス: 開始します。');

    // 1. 日程マスタのステータス自動更新
    const updatedStatusCount = updateScheduleStatusToCompleted();
    if (updatedStatusCount > 0) {
      Logger.log(`日程ステータス更新: ${updatedStatusCount}件を開催済みに更新`);
    }

    // 2. 全てのキャッシュを順次再構築
    rebuildAllReservationsCache();
    rebuildAllStudentsBasicCache();
    rebuildScheduleMasterCache(); // ステータス更新後にキャッシュも再構築
    rebuildAccountingMasterCache();

    PerformanceLog.info('定期メンテナンス: 正常に完了しました。');

    Logger.log(
      `定期メンテナンス完了: ステータス更新${updatedStatusCount}件 + 全キャッシュ再構築`,
    );
  } catch (error) {
    PerformanceLog.error(
      `定期キャッシュ再構築: エラーが発生しました - ${error.message}`,
    );
  } finally {
    scriptLock.releaseLock();
  }
}

// =================================================================
// キャッシュサービスからのデータ取得関数群
// =================================================================

/**
 * 指定されたキャッシュキーからデータを取得する汎用関数（キャッシュがない場合は自動再構築）
 * @param {string} cacheKey - キャッシュキー（CACHE_KEYS定数の使用推奨）
 * @param {boolean} [autoRebuild=true] - キャッシュがない場合に自動再構築するか（デフォルト: true）
 * @returns {CacheDataStructure | null} キャッシュされたデータまたはnull
 */
function getCachedData(cacheKey, autoRebuild = true) {
  try {
    // まず分割キャッシュの確認を試行
    /** @type {CacheDataStructure | null} */
    let parsedData = null;

    // 分割キャッシュが存在するかチェック
    const metaCacheKey = `${cacheKey}_meta`;
    const metaJson = CacheService.getScriptCache().get(metaCacheKey);

    if (metaJson) {
      // 分割キャッシュから読み込み
      Logger.log(
        `${cacheKey}の分割キャッシュを検出しました。統合読み込みを開始します...`,
      );
      /** @type {CacheDataStructure | null} */
      parsedData = loadChunkedDataFromCache(cacheKey);

      if (parsedData) {
        const dataCount = getDataCount(parsedData, cacheKey);
        PerformanceLog.debug(
          `${cacheKey}分割キャッシュから取得完了。件数: ${dataCount}`,
        );
        return parsedData;
      } else {
        Logger.log(
          `${cacheKey}分割キャッシュの読み込みに失敗しました。通常キャッシュを確認します。`,
        );
      }
    }

    // 通常の単一キャッシュを確認
    let cachedData = CacheService.getScriptCache().get(cacheKey);

    if (!cachedData && autoRebuild) {
      Logger.log(
        `${cacheKey}キャッシュが見つかりません。自動再構築を開始します...`,
      );
      try {
        // キャッシュキーに応じて適切な再構築関数を呼び出し
        switch (cacheKey) {
          case CACHE_KEYS.ALL_RESERVATIONS:
            rebuildAllReservationsCache();
            break;
          case CACHE_KEYS.ALL_STUDENTS_BASIC:
            rebuildAllStudentsBasicCache();
            break;
          case CACHE_KEYS.MASTER_SCHEDULE_DATA:
            rebuildScheduleMasterCache();
            break;
          case CACHE_KEYS.MASTER_ACCOUNTING_DATA:
            rebuildAccountingMasterCache();
            break;
          default:
            Logger.log(`${cacheKey}の自動再構築方法が不明です`);
            return null;
        }

        // 再構築後、再度分割キャッシュか単一キャッシュかを確認
        const newMetaJson = CacheService.getScriptCache().get(metaCacheKey);
        if (newMetaJson) {
          /** @type {CacheDataStructure | null} */
          parsedData = loadChunkedDataFromCache(cacheKey);
          if (parsedData) {
            const dataCount = getDataCount(parsedData, cacheKey);
            Logger.log(
              `${cacheKey}再構築後の分割キャッシュから取得完了。件数: ${dataCount}`,
            );
            return parsedData;
          }
        } else {
          cachedData = CacheService.getScriptCache().get(cacheKey);
        }
      } catch (rebuildError) {
        Logger.log(
          `${cacheKey}キャッシュ再構築エラー: ${rebuildError.message}`,
        );
        return null;
      }
    }

    if (!cachedData) {
      PerformanceLog.debug(`${cacheKey}キャッシュが見つかりません`);
      return null;
    }

    parsedData = JSON.parse(cachedData);
    const dataCount = getDataCount(parsedData, cacheKey);
    PerformanceLog.debug(
      `${cacheKey}単一キャッシュから取得完了。件数: ${dataCount}`,
    );
    return parsedData;
  } catch (e) {
    Logger.log(`getCachedData(${cacheKey})でエラー: ${e.message}`);
    return null;
  }
}

/**
 * キャッシュの存在確認とバージョン情報を取得する
 * @param {string} cacheKey - キャッシュキー
 * @returns {object} { exists: boolean, version: number|null, dataCount: number|null }
 */
function getCacheInfo(cacheKey) {
  try {
    // まず分割キャッシュの確認
    const metaCacheKey = `${cacheKey}_meta`;
    const metaJson = CacheService.getScriptCache().get(metaCacheKey);

    if (metaJson) {
      // 分割キャッシュの場合
      const metadata = JSON.parse(metaJson);
      return {
        exists: true,
        version: metadata.version || null,
        dataCount: metadata.totalCount || null,
        isChunked: true,
        totalChunks: metadata.totalChunks || null,
      };
    }

    // 通常の単一キャッシュを確認
    const cachedData = CacheService.getScriptCache().get(cacheKey);
    if (!cachedData) {
      return { exists: false, version: null, dataCount: null };
    }

    const parsedData = JSON.parse(cachedData);
    let dataCount = null;

    if (parsedData.reservations) {
      dataCount = parsedData.reservations.length;
    } else if (parsedData.students) {
      dataCount = Object.keys(parsedData.students).length;
    } else if (parsedData.schedule) {
      dataCount = parsedData.schedule.length;
    } else if (parsedData.items) {
      dataCount = parsedData.items.length;
    } else if (parsedData.data) {
      dataCount = Array.isArray(parsedData.data)
        ? parsedData.data.length
        : null;
    }

    return {
      exists: true,
      version: parsedData.version || null,
      dataCount: dataCount,
      isChunked: false,
    };
  } catch (e) {
    Logger.log(`getCacheInfo(${cacheKey})でエラー: ${e.message}`);
    return { exists: false, version: null, dataCount: null, error: e.message };
  }
}

/**
 * すべてのキャッシュの状態を取得する
 * @returns {{ [key: string]: CacheInfo }} 各キャッシュの状態情報
 */
function getAllCacheInfo() {
  /** @type {{ [key: string]: CacheInfo }} */
  const result = {};

  // 各キャッシュキーに対してgetCacheInfoを呼び出し
  for (const key of Object.values(CACHE_KEYS)) {
    /** @type {string} */
    const keyStr = /** @type {string} */ (key);
    // @ts-ignore - Object.create(null)との整合性のため意図的なキャスト
    result[keyStr] = getCacheInfo(keyStr);
  }

  // @ts-ignore - TypeScriptの空オブジェクトリテラル制約を回避
  return result;
}

/**
 * 使いやすさのための定数定義
 */
const CACHE_KEYS = {
  ALL_RESERVATIONS: 'all_reservations',
  ALL_STUDENTS_BASIC: 'all_students_basic',
  MASTER_SCHEDULE_DATA: 'master_schedule_data',
  MASTER_ACCOUNTING_DATA: 'master_accounting_data',
};

/**
 * 分割キャッシュ用の定数
 */
const CHUNK_SIZE_LIMIT_KB = 90; // 90KBでチャンク分割（余裕を持たせる）
const MAX_CHUNKS = 20; // 最大チャンク数

/**
 * データを指定サイズで分割する関数
 * @param {(string|number|Date)[][]} data - 分割対象のデータ配列
 * @param {number} maxSizeKB - 最大サイズ（KB）
 * @returns {(string|number|Date)[][][]} 分割されたデータチャンクの配列
 */
function splitDataIntoChunks(data, maxSizeKB = CHUNK_SIZE_LIMIT_KB) {
  if (!data || data.length === 0) return [[]];

  /** @type {(string|number|Date)[][][]} */
  const chunks = [];

  // アイテムあたりの平均サイズを推定（全データの10%をサンプル）
  const sampleSize = Math.min(Math.ceil(data.length * 0.1), 50);
  const sampleItems = data.slice(0, sampleSize);
  const sampleTotalSize = JSON.stringify(sampleItems).length;
  const avgItemSizeBytes = sampleTotalSize / sampleSize;
  const estimatedItemsPerChunk = Math.floor(
    ((maxSizeKB * 1024) / avgItemSizeBytes) * 0.8,
  ); // 80%の余裕を持つ

  Logger.log(
    `データ分割: 平均アイテムサイズ=${Math.round(avgItemSizeBytes)}bytes, チャンクあたり推定=${estimatedItemsPerChunk}件`,
  );

  for (let i = 0; i < data.length; i += estimatedItemsPerChunk) {
    const chunkData = data.slice(i, i + estimatedItemsPerChunk);

    // 実際のチャンクサイズを確認
    const chunkSizeKB = Math.round(JSON.stringify(chunkData).length / 1024);

    if (chunkSizeKB <= maxSizeKB) {
      chunks.push(chunkData);
      Logger.log(
        `チャンク${chunks.length - 1}: ${chunkData.length}件, ${chunkSizeKB}KB`,
      );
    } else {
      // チャンクが大きすぎる場合は更に半分に分割
      const halfSize = Math.floor(chunkData.length / 2);
      const firstHalf = chunkData.slice(0, halfSize);
      const secondHalf = chunkData.slice(halfSize);

      chunks.push(firstHalf);
      chunks.push(secondHalf);

      Logger.log(
        `チャンク${chunks.length - 2}: ${firstHalf.length}件 (分割1/2)`,
      );
      Logger.log(
        `チャンク${chunks.length - 1}: ${secondHalf.length}件 (分割2/2)`,
      );
    }
  }

  Logger.log(`データ分割完了: 全${data.length}件 → ${chunks.length}チャンク`);
  return chunks;
}

/**
 * 分割されたデータをキャッシュに保存する関数
 * @param {string} baseKey - ベースキャッシュキー
 * @param {(string|number|Date)[][][]} dataChunks - 分割されたデータチャンク配列
 * @param {ChunkedCacheMetadata} metadata - メタデータ
 * @param {number} expiry - キャッシュ有効期限（秒）
 * @returns {boolean} 保存成功の可否
 */
function saveChunkedDataToCache(
  baseKey,
  dataChunks,
  metadata,
  expiry = CACHE_EXPIRY_SECONDS,
) {
  const cache = CacheService.getScriptCache();

  try {
    // まず古い分割キャッシュを削除
    clearChunkedCache(baseKey);

    // メタデータを保存（チャンク数など）
    const metaCacheKey = `${baseKey}_meta`;
    const metaData = {
      ...metadata,
      version: new Date().getTime(),
      totalChunks: dataChunks.length,
      lastUpdated: new Date().toISOString(),
    };
    cache.put(metaCacheKey, JSON.stringify(metaData), expiry);

    // 各チャンクを保存
    for (let i = 0; i < dataChunks.length; i++) {
      const chunkKey = `${baseKey}_chunk_${i}`;
      const chunkData = {
        chunkIndex: i,
        data: dataChunks[i],
        version: metaData.version,
      };

      const chunkJson = JSON.stringify(chunkData);
      const chunkSizeKB = Math.round(chunkJson.length / 1024);

      if (chunkSizeKB > 95) {
        Logger.log(`⚠️ チャンク${i}が大きすぎます: ${chunkSizeKB}KB`);
        return false;
      }

      cache.put(chunkKey, chunkJson, expiry);
      Logger.log(
        `チャンク${i}を保存しました: ${chunkSizeKB}KB, ${dataChunks[i].length}件`,
      );
    }

    Logger.log(
      `分割キャッシュ保存完了: ${dataChunks.length}チャンク, 合計${dataChunks.reduce((sum, chunk) => sum + chunk.length, 0)}件`,
    );
    return true;
  } catch (error) {
    Logger.log(`分割キャッシュ保存エラー: ${error.message}`);
    return false;
  }
}

/**
 * 分割キャッシュからデータを読み込んで統合する関数
 * @param {string} baseKey - ベースキャッシュキー
 * @returns {CacheDataStructure|null} 統合されたキャッシュデータまたはnull
 */
function loadChunkedDataFromCache(baseKey) {
  const cache = CacheService.getScriptCache();

  try {
    // メタデータを取得
    const metaCacheKey = `${baseKey}_meta`;
    const metaJson = cache.get(metaCacheKey);
    if (!metaJson) {
      Logger.log(`${baseKey}のメタデータキャッシュが見つかりません`);
      return null;
    }

    const metadata = JSON.parse(metaJson);
    const totalChunks = metadata.totalChunks;

    if (!totalChunks || totalChunks === 0) {
      Logger.log(`${baseKey}にチャンクがありません`);
      return null;
    }

    // 全チャンクを読み込んで統合
    /** @type {(string|number|Date)[][]} */
    let allData = [];
    for (let i = 0; i < totalChunks; i++) {
      const chunkKey = `${baseKey}_chunk_${i}`;
      const chunkJson = cache.get(chunkKey);

      if (!chunkJson) {
        Logger.log(`チャンク${i}が見つかりません: ${chunkKey}`);
        return null;
      }

      const chunkData = JSON.parse(chunkJson);
      if (chunkData.data && Array.isArray(chunkData.data)) {
        allData = allData.concat(chunkData.data);
      }
    }

    // 統合データを返す（キャッシュキーによって適切な構造を返す）
    /** @type {CacheDataStructure} */
    let result;

    if (baseKey === CACHE_KEYS.ALL_STUDENTS_BASIC) {
      // 生徒名簿の場合：配列をオブジェクトに変換
      /** @type {{ [studentId: string]: StudentData }} */
      const studentsMap = {};
      allData.forEach(student => {
        const studentData = /** @type {StudentData} */ (student);
        if (studentData.studentId) {
          studentsMap[studentData.studentId] = studentData;
        }
      });

      result = {
        version: metadata.version,
        students: studentsMap,
        metadata: {
          totalCount: allData.length,
          isChunked: true,
          totalChunks: totalChunks,
          lastUpdated: metadata.lastUpdated,
        },
      };
    } else {
      // 予約データなど他のキャッシュの場合
      result = {
        version: metadata.version,
        reservations: allData,
        headerMap: metadata.headerMap,
        metadata: {
          totalCount: allData.length,
          isChunked: true,
          totalChunks: totalChunks,
          lastUpdated: metadata.lastUpdated,
        },
      };
    }

    Logger.log(
      `分割キャッシュ読み込み完了: ${totalChunks}チャンク, ${allData.length}件`,
    );
    return result;
  } catch (error) {
    Logger.log(`分割キャッシュ読み込みエラー: ${error.message}`);
    return null;
  }
}

/**
 * 指定されたベースキーの全分割キャッシュを削除する関数
 * @param {string} baseKey - ベースキャッシュキー
 */
function clearChunkedCache(baseKey) {
  const cache = CacheService.getScriptCache();

  try {
    // メタデータから総チャンク数を取得
    const metaCacheKey = `${baseKey}_meta`;
    const metaJson = cache.get(metaCacheKey);

    if (metaJson) {
      const metadata = JSON.parse(metaJson);
      const totalChunks = metadata.totalChunks || MAX_CHUNKS;

      // 全チャンクを削除
      for (let i = 0; i < totalChunks; i++) {
        const chunkKey = `${baseKey}_chunk_${i}`;
        cache.remove(chunkKey);
      }
    } else {
      // メタデータがない場合は最大チャンク数まで削除を試行
      for (let i = 0; i < MAX_CHUNKS; i++) {
        const chunkKey = `${baseKey}_chunk_${i}`;
        cache.remove(chunkKey);
      }
    }

    // メタデータも削除
    cache.remove(metaCacheKey);
    Logger.log(`${baseKey}の分割キャッシュをクリアしました`);
  } catch (error) {
    Logger.log(`分割キャッシュクリアエラー: ${error.message}`);
  }
}

/**
 * 各キャッシュキーに対応するデータ件数取得関数
 * @param {object} parsedData - パース済みキャッシュデータ
 * @param {string} cacheKey - キャッシュキー
 * @returns {number} データ件数
 */
function getDataCount(parsedData, cacheKey) {
  if (!parsedData || typeof parsedData !== 'object') return 0;

  /** @type {CacheDataStructure} */
  const data = /** @type {CacheDataStructure} */ (parsedData);

  switch (cacheKey) {
    case CACHE_KEYS.ALL_RESERVATIONS:
      return Array.isArray(data['reservations'])
        ? data['reservations'].length
        : 0;
    case CACHE_KEYS.ALL_STUDENTS_BASIC:
      return Object.keys(data['students'] || {}).length;
    case CACHE_KEYS.MASTER_SCHEDULE_DATA:
      return Array.isArray(data['schedule']) ? data['schedule'].length : 0;
    case CACHE_KEYS.MASTER_ACCOUNTING_DATA:
      return Array.isArray(data['items']) ? data['items'].length : 0;
    default:
      return data['data']
        ? Array.isArray(data['data'])
          ? data['data'].length
          : 0
        : 0;
  }
}

/**
 * Schedule Master キャッシュの診断・修復機能
 * シートの存在確認とキャッシュの整合性チェックを実行
 * GASエディタから直接実行可能（メニューからトリガー登録推奨）
 */
function diagnoseAndFixScheduleMasterCache() {
  Logger.log('=== Schedule Master キャッシュ診断・修復開始 ===');

  try {
    // 1. シートの存在確認
    const sheet = SS_MANAGER.getSheet(CONSTANTS.SHEET_NAMES.SCHEDULE);
    if (!sheet) {
      Logger.log('⚠️ Schedule Masterシートが存在しません');
      Logger.log('既存予約データから自動生成を試行します...');

      // 既存予約データから自動生成を試行（関数が未定義のため無効化）
      try {
        // const result = generateScheduleMasterFromExistingReservations();
        /** @type {OperationResult | null} */
        const result = null; // 関数が未定義のため一時的に無効化
        if (result && result.success !== false) {
          Logger.log('✅ Schedule Masterシートの自動生成完了');
        } else {
          Logger.log('❌ Schedule Masterシートの自動生成失敗');
          Logger.log('手動でSchedule Masterシートを作成してください');
          return false;
        }
      } catch (error) {
        Logger.log(`❌ 自動生成でエラー発生: ${error.message}`);
        return false;
      }
    } else {
      Logger.log('✅ Schedule Masterシートが存在します');

      // シートのデータ数を確認
      const dataRange = sheet.getDataRange();
      const rowCount = dataRange.getNumRows();
      Logger.log(`シートデータ行数: ${rowCount}行（ヘッダー含む）`);

      if (rowCount <= 1) {
        Logger.log(
          '⚠️ Schedule Masterシートにデータがありません（ヘッダーのみ）',
        );
      }
    }

    // 2. キャッシュ再構築
    Logger.log('キャッシュを再構築します...');
    rebuildScheduleMasterCache();

    // 3. キャッシュ検証
    const cacheData = getCachedData(CACHE_KEYS.MASTER_SCHEDULE_DATA);
    if (
      !cacheData ||
      !(/** @type {ScheduleCacheData} */ (cacheData)['schedule'])
    ) {
      Logger.log('❌ キャッシュ再構築後もデータが空です');
      return false;
    }

    Logger.log(
      `✅ キャッシュ診断・修復完了 - Schedule データ件数: ${/** @type {ScheduleCacheData} */ (cacheData)['schedule'].length}`,
    );
    return true;
  } catch (error) {
    Logger.log(`❌ 診断・修復中にエラー: ${error.message}`);
    Logger.log(`スタックトレース: ${error.stack}`);
    return false;
  }
}

/**
 * 日程マスタのステータス自動更新を手動実行する関数
 * GASエディタから直接実行可能、またはメニューから実行
 *
 * 実行内容:
 * - 開催予定 → 開催済み の自動更新
 * - 更新後のキャッシュ再構築
 * - スプレッドシートでの結果表示
 */
function updateScheduleStatusManual() {
  try {
    const ss = getActiveSpreadsheet();
    ss.toast('日程マスタのステータス更新を開始しています...', '処理中', -1);

    const updatedCount = updateScheduleStatusToCompleted();

    if (updatedCount > 0) {
      // ステータス更新後はキャッシュも再構築
      rebuildScheduleMasterCache();

      ss.toast(
        `${updatedCount}件の日程を「開催済み」に更新しました。`,
        '更新完了',
        5,
      );

      Logger.log(`手動ステータス更新完了: ${updatedCount}件`);
    } else {
      ss.toast('更新対象の日程はありませんでした。', '確認完了', 3);

      Logger.log('手動ステータス更新: 更新対象なし');
    }
  } catch (error) {
    const ss = getActiveSpreadsheet();
    ss.toast(`エラーが発生しました: ${error.message}`, 'エラー', 5);
    Logger.log(`手動ステータス更新エラー: ${error.message}`);
  }
}

/**
 * 指定された生徒IDのメール情報を含む生徒情報を取得
 * @param {string} studentId - 生徒ID
 * @returns {Object|null} 生徒情報（メールアドレス・連絡希望フラグ含む）またはnull
 */
function getStudentWithEmail(studentId) {
  try {
    const studentsCache = getCachedData(CACHE_KEYS.ALL_STUDENTS_BASIC);
    if (!studentsCache || !studentsCache['students']) {
      Logger.log('生徒基本情報キャッシュが利用できません');
      return null;
    }

    const student = /** @type {StudentCacheData} */ (studentsCache)['students'][
      studentId
    ];
    if (!student) {
      Logger.log(`生徒ID ${studentId} が見つかりません`);
      return null;
    }

    return {
      ...student,
      // 明示的にメール情報を含める
      email: student.email || '',
      wantsEmail: student.wantsEmail || false,
    };
  } catch (error) {
    Logger.log(`getStudentWithEmail(${studentId})でエラー: ${error.message}`);
    return null;
  }
}
