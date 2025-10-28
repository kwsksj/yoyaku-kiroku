/**
 * =================================================================
 * 【ファイル名】  : 07_CacheManager.js
 * 【モジュール種別】: バックエンド（GAS）
 * 【役割】        : CacheService と PropertiesService を活用し、予約・生徒などの大型データを統合管理する。
 *
 * 【主な責務】
 *   - `getCachedData` を中心に、キャッシュ取得・自動再構築を一元化
 *   - 予約／生徒／日程など各種キャッシュのインクリメンタル更新 API を提供
 *   - キャッシュメタ情報（バージョン、件数、更新時刻）の整合性を維持
 *
 * 【関連モジュール】
 *   - `00_SpreadsheetManager.js`: シートアクセスの基盤
 *   - `05-2_Backend_Write.js`: 予約操作後のキャッシュ更新で多数利用
 *   - `08_Utilities.js`: HeaderMap 生成やログ出力との連携
 *
 * 【利用時の留意点】
 *   - CacheService の容量制限（1MB/キー）に対応するため、分割保存ロジックを理解しておく
 *   - 新しいキャッシュ種別を追加する際は、`CACHE_KEYS` と再構築ハンドラを必ず定義
 *   - エラー時には `BackendErrorHandler` を用いて API へ適切なレスポンスを返す
 * =================================================================
 */

// ================================================================
// 依存モジュール
// ================================================================
import { SS_MANAGER } from './00_SpreadsheetManager.js';
import { BackendErrorHandler } from './08_ErrorHandler.js';
import {
  PerformanceLog,
  createHeaderMap,
  handleError,
} from './08_Utilities.js';

/**
 * ヘッダーマップから型安全にインデックスを取得するヘルパー関数
 * @param {HeaderMapType} headerMap - ヘッダーマップ（MapまたはRecord）
 * @param {string} headerName - ヘッダー名
 * @returns {number | undefined} インデックス値
 */
export function getHeaderIndex(headerMap, headerName) {
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
export function normalizeHeaderMap(headerMap) {
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
export function getCacheProperty(cacheData, property) {
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
export function formatDateTimeValue(dateValue, type) {
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
 *   - 全予約データ（予約記録シート）
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
export function addReservationToCache(newReservationRow, headerMap) {
  try {
    Logger.log('[CACHE] インクリメンタル予約追加開始');
    const startTime = new Date();

    // 現在のキャッシュを取得
    const currentCache = getTypedCachedData(CACHE_KEYS.ALL_RESERVATIONS);
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

    // reservationIdIndexMap を再構築
    const cacheHeaderMap =
      getCacheProperty(currentCache, 'headerMap') ||
      normalizeHeaderMap(headerMap);
    const reservationIdColIndex =
      cacheHeaderMap[CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID];
    const newReservationIdIndexMap =
      /** @type {{[key: string]: number}} */ ({});
    updatedReservations.forEach((row, index) => {
      const reservationId = row[reservationIdColIndex];
      if (reservationId) {
        newReservationIdIndexMap[String(reservationId)] = index;
      }
    });

    // 更新されたキャッシュデータを構築
    /** @type {ReservationCacheData} */
    const updatedCacheData = {
      version: new Date().getTime(),
      reservations: updatedReservations,
      headerMap: cacheHeaderMap,
      reservationIdIndexMap: newReservationIdIndexMap,
      metadata: {
        totalCount: updatedReservations.length,
        lastUpdated: new Date().toISOString(),
      },
    };

    // キャッシュを更新
    CacheService.getScriptCache().put(
      CACHE_KEYS.ALL_RESERVATIONS,
      JSON.stringify(updatedCacheData),
      CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
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
export function updateReservationStatusInCache(reservationId, newStatus) {
  try {
    Logger.log('[CACHE] インクリメンタルステータス更新開始');
    const startTime = new Date();

    // 現在のキャッシュを取得
    const currentCache = getTypedCachedData(CACHE_KEYS.ALL_RESERVATIONS);
    if (!currentCache || !getCacheProperty(currentCache, 'reservations')) {
      Logger.log('[CACHE] 既存キャッシュなし、通常の再構築実行');
      rebuildAllReservationsCache();
      return;
    }

    const headerMap = getCacheProperty(currentCache, 'headerMap') || {};
    const statusColumnIndex = headerMap[CONSTANTS.HEADERS.RESERVATIONS.STATUS];
    const reservationIdIndexMap =
      getCacheProperty(currentCache, 'reservationIdIndexMap') || {};
    const targetIndex = reservationIdIndexMap[reservationId];

    if (statusColumnIndex === undefined) {
      Logger.log('[CACHE] ステータスヘッダーが不正、通常の再構築実行');
      rebuildAllReservationsCache();
      return;
    }

    const currentReservations = /** @type {ReservationRawDataArray} */ (
      getCacheProperty(currentCache, 'reservations')
    );

    if (targetIndex !== undefined && currentReservations[targetIndex]) {
      currentReservations[targetIndex][statusColumnIndex] = newStatus;
      Logger.log(
        `[CACHE] 予約ID ${reservationId} のステータスを ${newStatus} に更新`,
      );
    } else {
      Logger.log(
        `[CACHE] 予約ID ${reservationId} が見つかりません、通常の再構築実行`,
      );
      rebuildAllReservationsCache();
      return;
    }

    // 更新されたキャッシュデータを構築 (ts(2698)エラー回避)
    /** @type {ReservationCacheData} */
    const updatedCacheData = {
      version: new Date().getTime(),
      reservations: currentReservations,
      headerMap: getCacheProperty(currentCache, 'headerMap'),
      reservationIdIndexMap: getCacheProperty(
        currentCache,
        'reservationIdIndexMap',
      ),
      metadata: {
        ...(getCacheProperty(currentCache, 'metadata') || {}),
        lastUpdated: new Date().toISOString(),
      },
    };

    // キャッシュを更新
    CacheService.getScriptCache().put(
      CACHE_KEYS.ALL_RESERVATIONS,
      JSON.stringify(updatedCacheData),
      CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
    );

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    Logger.log(`[CACHE] インクリメンタルステータス更新完了: ${duration}ms`);
  } catch (error) {
    Logger.log(
      `[CACHE] インクリメンタルステータス更新エラー: ${error.message}, 通常の再構築実行`,
    );
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
export function updateReservationInCache(
  reservationId,
  updatedRowData,
  headerMap,
) {
  try {
    Logger.log('[CACHE] インクリメンタル予約更新開始');
    const startTime = new Date();

    const currentCache = getTypedCachedData(CACHE_KEYS.ALL_RESERVATIONS);
    if (!currentCache || !getCacheProperty(currentCache, 'reservations')) {
      Logger.log('[CACHE] 既存キャッシュなし、通常の再構築実行');
      rebuildAllReservationsCache();
      return;
    }

    const reservationIdIndexMap =
      getCacheProperty(currentCache, 'reservationIdIndexMap') || {};
    const targetIndex = reservationIdIndexMap[reservationId];

    const currentReservations = /** @type {ReservationRawDataArray} */ (
      getCacheProperty(currentCache, 'reservations')
    );

    if (targetIndex === undefined) {
      Logger.log(
        `[CACHE] 予約ID ${reservationId} が見つかりません、通常の再構築実行`,
      );
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

    const formattedRow = [...updatedRowData];
    if (
      dateColumnIndex !== undefined &&
      formattedRow[dateColumnIndex] instanceof Date
    ) {
      formattedRow[dateColumnIndex] = formatDateTimeValue(
        formattedRow[dateColumnIndex],
        'date',
      );
    }
    if (
      startTimeColumnIndex !== undefined &&
      formattedRow[startTimeColumnIndex] instanceof Date
    ) {
      formattedRow[startTimeColumnIndex] = formatDateTimeValue(
        formattedRow[startTimeColumnIndex],
        'time',
      );
    }
    if (
      endTimeColumnIndex !== undefined &&
      formattedRow[endTimeColumnIndex] instanceof Date
    ) {
      formattedRow[endTimeColumnIndex] = formatDateTimeValue(
        formattedRow[endTimeColumnIndex],
        'time',
      );
    }

    currentReservations[targetIndex] = formattedRow;
    Logger.log(`[CACHE] 予約ID ${reservationId} のデータを完全更新`);

    // 更新されたキャッシュデータを構築 (ts(2698)エラー回避)
    /** @type {ReservationCacheData} */
    const updatedCacheData = {
      version: new Date().getTime(),
      reservations: currentReservations,
      headerMap: getCacheProperty(currentCache, 'headerMap'),
      reservationIdIndexMap: getCacheProperty(
        currentCache,
        'reservationIdIndexMap',
      ),
      metadata: {
        ...(getCacheProperty(currentCache, 'metadata') || {}),
        lastUpdated: new Date().toISOString(),
      },
    };

    CacheService.getScriptCache().put(
      CACHE_KEYS.ALL_RESERVATIONS,
      JSON.stringify(updatedCacheData),
      CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
    );

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    Logger.log(`[CACHE] インクリメンタル予約更新完了: ${duration}ms`);
  } catch (error) {
    Logger.log(
      `[CACHE] インクリメンタル予約更新エラー: ${error.message}, 通常の再構築実行`,
    );
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
export function updateReservationColumnInCache(
  reservationId,
  columnHeaderName,
  newValue,
) {
  try {
    Logger.log('[CACHE] インクリメンタル列更新開始');
    const startTime = new Date();

    const currentCache = getTypedCachedData(CACHE_KEYS.ALL_RESERVATIONS);
    if (!currentCache || !getCacheProperty(currentCache, 'reservations')) {
      Logger.log('[CACHE] 既存キャッシュなし、通常の再構築実行');
      rebuildAllReservationsCache();
      return;
    }

    const cacheHeaderMap = getCacheProperty(currentCache, 'headerMap') || {};
    const targetColumnIndex = cacheHeaderMap[columnHeaderName];
    const reservationIdIndexMap =
      getCacheProperty(currentCache, 'reservationIdIndexMap') || {};
    const targetIndex = reservationIdIndexMap[reservationId];

    if (targetColumnIndex === undefined) {
      Logger.log('[CACHE] 列ヘッダーが不正、通常の再構築実行');
      rebuildAllReservationsCache();
      return;
    }

    const currentReservations = /** @type {ReservationRawDataArray} */ (
      getCacheProperty(currentCache, 'reservations')
    );

    if (targetIndex !== undefined && currentReservations[targetIndex]) {
      currentReservations[targetIndex][targetColumnIndex] = newValue;
      Logger.log(
        `[CACHE] 予約ID ${reservationId} の${columnHeaderName}列を更新`,
      );
    } else {
      Logger.log(
        `[CACHE] 予約ID ${reservationId} が見つかりません、通常の再構築実行`,
      );
      rebuildAllReservationsCache();
      return;
    }

    // 更新されたキャッシュデータを構築 (ts(2698)エラー回避)
    /** @type {ReservationCacheData} */
    const updatedCacheData = {
      version: new Date().getTime(),
      reservations: currentReservations,
      headerMap: getCacheProperty(currentCache, 'headerMap'),
      reservationIdIndexMap: getCacheProperty(
        currentCache,
        'reservationIdIndexMap',
      ),
      metadata: {
        ...(getCacheProperty(currentCache, 'metadata') || {}),
        lastUpdated: new Date().toISOString(),
      },
    };

    CacheService.getScriptCache().put(
      CACHE_KEYS.ALL_RESERVATIONS,
      JSON.stringify(updatedCacheData),
      CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
    );

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    Logger.log(`[CACHE] インクリメンタル列更新完了: ${duration}ms`);
  } catch (error) {
    Logger.log(
      `[CACHE] インクリメンタル列更新エラー: ${error.message}, 通常の再構築実行`,
    );
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
export function rebuildAllCachesEntryPoint() {
  try {
    SS_MANAGER.getSpreadsheet().toast(
      'キャッシュデータの一括再構築を開始しました...',
      '処理中',
      -1,
    );

    // 全てのキャッシュを順次再構築
    rebuildAllReservationsCache();
    rebuildAllStudentsBasicCache();
    rebuildAccountingMasterCache();
    rebuildScheduleMasterCache();

    SS_MANAGER.getSpreadsheet().toast(
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
export function shouldRebuildReservationCache() {
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
 * 予約記録シートから全予約データを読み込み、CacheServiceに保存する
 * 日付・時刻列を適切にフォーマットして配列形式でキャッシュに保存します。
 *
 * @throws {Error} 予約記録シートが見つからない場合
 * @throws {Error} データ処理中にエラーが発生した場合
 */
export function rebuildAllReservationsCache() {
  try {
    const integratedReservationSheet = SS_MANAGER.getSheet(
      CONSTANTS.SHEET_NAMES.RESERVATIONS,
    );
    if (!integratedReservationSheet) {
      Logger.log(
        `${CONSTANTS.SHEET_NAMES.RESERVATIONS}シートが見つからないか、データが空です。`,
      );
      // 空データの場合もキャッシュを作成
      /** @type {ReservationCacheData} */
      const emptyCacheData = {
        version: new Date().getTime(),
        reservations: [],
        headerMap: {},
        reservationIdIndexMap: {},
        metadata: {
          totalCount: 0,
          lastUpdated: new Date().toISOString(),
        },
      };
      CacheService.getScriptCache().put(
        CACHE_KEYS.ALL_RESERVATIONS,
        JSON.stringify(emptyCacheData),
        CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
      );
      return;
    }

    // ヘッダー行を取得してマッピングを作成
    const headerRow = integratedReservationSheet
      .getRange(1, 1, 1, integratedReservationSheet.getLastColumn())
      .getValues()[0];
    const headerColumnMap = /** @type {Map<string, number>} */ (
      createHeaderMap(headerRow)
    );

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
      Logger.log(
        `${CONSTANTS.SHEET_NAMES.RESERVATIONS}シートにデータがありません。`,
      );
      /** @type {ReservationCacheData} */
      const emptyCacheData = {
        version: new Date().getTime(),
        reservations: [],
        headerMap: Object.fromEntries(headerColumnMap),
        reservationIdIndexMap: {},
        metadata: {
          totalCount: 0,
          lastUpdated: new Date().toISOString(),
        },
      };
      CacheService.getScriptCache().put(
        CACHE_KEYS.ALL_RESERVATIONS,
        JSON.stringify(emptyCacheData),
        CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
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

    const formatColumns = [
      { index: dateColumnIndex, type: 'date' },
      { index: startTimeColumnIndex, type: 'time' },
      { index: endTimeColumnIndex, type: 'time' },
    ].filter(
      /**
       * @param {{ index: number | undefined; type: 'date' | 'time' }} column
       * @returns {column is { index: number; type: 'date' | 'time' }}
       */
      column => typeof column.index === 'number',
    );

    if (dateColumnIndex === undefined) {
      throw new Error('予約シートで日付列を特定できませんでした。');
    }

    allReservationRows.forEach(
      /** @param {(string|number|Date)[]} reservationRow */ reservationRow => {
        formatColumns.forEach(({ index, type }) => {
          const originalValue = reservationRow[index];
          if (originalValue instanceof Date) {
            const formatter =
              type === 'date'
                ? DateTimeFormatters.date
                : DateTimeFormatters.time;
            reservationRow[index] = formatter(originalValue);
          }
        });
      },
    );

    // 全データを日付順にソート（新しい順）
    const sortedReservations = allReservationRows.sort(
      (
        /** @type {(string|number|Date)[]} */ a,
        /** @type {(string|number|Date)[]} */ b,
      ) => {
        const dateA = new Date(a[dateColumnIndex]);
        const dateB = new Date(b[dateColumnIndex]);
        return dateB.getTime() - dateA.getTime(); // 新しい順
      },
    );

    // reservationIdIndexMap を作成
    const reservationIdColIndex = headerColumnMap.get(
      CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID,
    );
    /** @type {{[key: string]: number}} */
    const reservationIdIndexMap = {};
    if (reservationIdColIndex !== undefined) {
      sortedReservations.forEach(
        (
          /** @type {(string|number|Date)[]} */ reservation,
          /** @type {number} */ index,
        ) => {
          const reservationId = reservation[reservationIdColIndex];
          if (reservationId) {
            reservationIdIndexMap[String(reservationId)] = index;
          }
        },
      );
    }

    // データサイズをチェックして分割キャッシュまたは通常キャッシュを決定
    const testCacheData = {
      version: new Date().getTime(),
      reservations: sortedReservations,
      headerMap: Object.fromEntries(headerColumnMap),
      reservationIdIndexMap: reservationIdIndexMap,
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
        reservationIdIndexMap: reservationIdIndexMap,
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
          CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
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
    BackendErrorHandler.handle(e, 'rebuildAllReservationsCache');
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
export function rebuildScheduleMasterCache(fromDate, toDate) {
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
        CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
      );
      return;
    }

    const allData = sheet.getDataRange().getValues();
    const headerRowCandidate = allData.shift();
    if (!Array.isArray(headerRowCandidate)) {
      Logger.log('日程マスターのヘッダー行が取得できませんでした。');
      return;
    }
    const headerRow = /** @type {string[]} */ (headerRowCandidate);

    // 時間列のインデックスを特定
    const timeColumnNames = [
      CONSTANTS.HEADERS.SCHEDULE.FIRST_START,
      CONSTANTS.HEADERS.SCHEDULE.FIRST_END,
      CONSTANTS.HEADERS.SCHEDULE.SECOND_START,
      CONSTANTS.HEADERS.SCHEDULE.SECOND_END,
      CONSTANTS.HEADERS.SCHEDULE.BEGINNER_START,
    ];

    const dateColumn = headerRow.indexOf(CONSTANTS.HEADERS.SCHEDULE.DATE);
    const lessonIdColumn = headerRow.indexOf(
      CONSTANTS.HEADERS.SCHEDULE.LESSON_ID,
    ); // ★ 追加

    if (dateColumn === -1) {
      throw new Error('日程マスターシートに必須の「日付」列が見つかりません。');
    }
    if (lessonIdColumn === -1) {
      throw new Error(
        '日程マスターシートに必須の「レッスンID」列が見つかりません。',
      );
    }

    /** @type {{row: number, col: number, value: string}[]} */
    const updatesForSheet = []; // シートへの書き戻し用

    // filter内ではdateColumnを直接使用
    const scheduleDataList = allData
      .filter(row => {
        const dateValue = row[dateColumn];
        if (!dateValue) return false;

        // Date オブジェクトを文字列形式に変換して比較
        const dateStr =
          dateValue instanceof Date
            ? Utilities.formatDate(dateValue, CONSTANTS.TIMEZONE, 'yyyy-MM-dd')
            : String(dateValue);

        return dateStr >= startDate && dateStr <= endDate;
      })
      .map(
        /** @param {(string|number|Date)[]} row */ (row, rowIndex) => {
          /** @type {LessonCore} */
          const scheduleObj = /** @type {LessonCore} */ ({});

          // ★ lessonId がない場合に自動採番して書き戻し準備
          let lessonId = row[lessonIdColumn];
          if (!lessonId) {
            lessonId = Utilities.getUuid();
            row[lessonIdColumn] = lessonId; // 後続の処理で使えるように
            updatesForSheet.push({
              row: rowIndex + 2, // allDataはヘッダーが除かれているので、+2でシート上の行番号
              col: lessonIdColumn + 1,
              value: lessonId,
            });
          }

          for (let index = 0; index < headerRow.length; index += 1) {
            const header = headerRow[index];
            let value = row[index];

            // 時間列の処理
            if (timeColumnNames.includes(header) && value instanceof Date) {
              value = Utilities.formatDate(value, CONSTANTS.TIMEZONE, 'HH:mm');
            } else if (header === CONSTANTS.HEADERS.SCHEDULE.DATE) {
              // 日付列の処理（文字列形式でキャッシュに保存）
              if (value instanceof Date) {
                value = Utilities.formatDate(
                  value,
                  CONSTANTS.TIMEZONE,
                  'yyyy-MM-dd',
                );
              } else if (value && typeof value === 'string') {
                try {
                  const dateObj = new Date(value);
                  if (isNaN(dateObj.getTime())) {
                    Logger.log(`無効な日付文字列: ${value}, 行をスキップ`);
                    return null;
                  }
                  value = Utilities.formatDate(
                    dateObj,
                    CONSTANTS.TIMEZONE,
                    'yyyy-MM-dd',
                  );
                } catch (error) {
                  Logger.log(
                    `日付変換エラー: ${value}, エラー: ${error.message}, 行をスキップ`,
                  );
                  return null;
                }
              } else if (value == null || value === '') {
                Logger.log(`無効な日付値: ${value}, 行をスキップ`);
                return null;
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
              case CONSTANTS.HEADERS.SCHEDULE.LESSON_ID:
                propertyName = 'lessonId';
                break;
              case CONSTANTS.HEADERS.SCHEDULE.RESERVATION_IDS:
                propertyName = 'reservationIds';
                // reservationIdsはJSON文字列で保存されているため、配列にパースする
                try {
                  value = value ? JSON.parse(String(value)) : [];
                } catch (e) {
                  Logger.log(
                    `reservationIdsのJSONパースに失敗: ${value}, エラー: ${e.message}`,
                  );
                  value = /** @type {any} */ ([]); // パース失敗時は空配列
                }
                break;
              default:
                propertyName = header;
            }

            scheduleObj[propertyName] = value;
          }

          return scheduleObj;
        },
      )
      .filter(
        /** @param {LessonCore | null} scheduleObj */ scheduleObj =>
          scheduleObj !== null,
      ); // 無効な行を除外

    // ★ 自動採番した lessonId をシートに書き戻す（キャッシュ保存より前に実行）
    if (updatesForSheet.length > 0) {
      try {
        const ranges = updatesForSheet.map(
          update => `R${update.row}C${update.col}`,
        );
        const rangeList = sheet.getRangeList(ranges).getRanges();
        rangeList.forEach((range, i) => {
          range.setValue(updatesForSheet[i].value);
        });
        Logger.log(
          `${updatesForSheet.length}件の日程に新しいレッスンIDを付与し、シートに保存しました。`,
        );
      } catch (e) {
        Logger.log(`lessonIdのシート書き戻し中にエラーが発生: ${e.message}`);
        // エラーが発生してもキャッシュ構築は続行する
      }
    }

    // ★ 日付順でソート処理を追加（文字列形式前提）
    if (scheduleDataList && scheduleDataList.length > 0) {
      scheduleDataList.sort(
        (/** @type {LessonCore} */ a, /** @type {LessonCore} */ b) => {
          // 文字列形式（yyyy-MM-dd）で保存されているため文字列比較
          const dateA = String(a.date);
          const dateB = String(b.date);
          return dateA.localeCompare(dateB);
        },
      );
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
      CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
    );

    Logger.log(
      `日程マスターデータキャッシュを更新しました。件数: ${
        scheduleDataList?.length || 0
      }、期間: ${startDate} ～ ${endDate}`,
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
export function rebuildAccountingMasterCache() {
  try {
    const sheet = SS_MANAGER.getSheet(CONSTANTS.SHEET_NAMES.ACCOUNTING);
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
        CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
      );
      return;
    }

    const allData = sheet.getDataRange().getValues();
    const accountingHeaderCandidate = allData.shift();
    if (!Array.isArray(accountingHeaderCandidate)) {
      Logger.log('会計マスタのヘッダー行が取得できませんでした。');
      return;
    }
    const accountingHeaderRow = /** @type {string[]} */ (
      accountingHeaderCandidate
    );

    // 削除済み: 会計マスタに時刻情報がなくなったため、時間列の処理は不要
    // 時刻情報は日程マスタから取得

    // データを処理してオブジェクト形式に変換
    const processedItems = allData.map(
      /** @param {(string|number|Date)[]} rowData */ rowData => {
        /** @type {Partial<AccountingMasterItem>} */
        const item = {};
        accountingHeaderRow.forEach(
          (
            /** @type {string} */ headerName,
            /** @type {number} */ columnIndex,
          ) => {
            const cellValue = rowData[columnIndex];
            item[headerName] = cellValue;
          },
        );
        return item;
      },
    );

    const cacheData = {
      version: new Date().getTime(),
      items: processedItems,
    };

    CacheService.getScriptCache().put(
      CACHE_KEYS.MASTER_ACCOUNTING_DATA,
      JSON.stringify(cacheData),
      CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
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
export function rebuildAllStudentsBasicCache() {
  try {
    const studentRosterSheet = SS_MANAGER.getSheet(
      CONSTANTS.SHEET_NAMES.ROSTER,
    );
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
        CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
      );
      return;
    }

    // ヘッダー行を取得してマッピングを作成
    const headerRow = studentRosterSheet
      .getRange(1, 1, 1, studentRosterSheet.getLastColumn())
      .getValues()[0];
    const headerColumnMap = /** @type {Map<string, number>} */ (
      createHeaderMap(headerRow)
    );

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
        CONSTANTS.HEADERS.ROSTER.WANTS_RESERVATION_EMAIL,
      ),
      scheduleNotificationPreference: headerColumnMap.get(
        CONSTANTS.HEADERS.ROSTER.WANTS_SCHEDULE_INFO,
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

    const {
      studentId: studentIdColumn,
      realName: realNameColumn,
      nickname: nicknameColumn,
      phone: phoneColumn,
    } = /** @type {{ studentId: number; realName: number; nickname: number; phone: number }} */ (
      requiredColumns
    );

    // データ行を取得
    const dataRowCount = studentRosterSheet.getLastRow() - 1;
    const allStudentRows = studentRosterSheet
      .getRange(2, 1, dataRowCount, studentRosterSheet.getLastColumn())
      .getValues();

    // 生徒データをオブジェクト形式に変換
    /** @type {{ [studentId: string]: StudentData }} */
    const studentsDataMap = {};
    allStudentRows.forEach(
      (
        /** @type {(string|number|Date)[]} */ studentRow,
        /** @type {number} */ index,
      ) => {
        const studentId = studentRow[studentIdColumn];
        if (studentId && String(studentId).trim()) {
          // メール連絡希望フラグの処理
          let wantsEmail = false;
          if (typeof optionalColumns.emailPreference === 'number') {
            const preference = studentRow[optionalColumns.emailPreference];
            wantsEmail =
              String(preference) === 'TRUE' ||
              String(preference) === '希望する' ||
              String(preference) === 'true';
          }

          // 日程連絡希望フラグの処理
          let wantsScheduleNotification = false;
          if (
            typeof optionalColumns.scheduleNotificationPreference === 'number'
          ) {
            const preference =
              studentRow[optionalColumns.scheduleNotificationPreference];
            wantsScheduleNotification =
              String(preference) === 'TRUE' ||
              String(preference) === '希望する' ||
              String(preference) === 'true';
          }

          // 通知設定の取得
          const notificationDay =
            typeof optionalColumns.notificationDay === 'number'
              ? studentRow[optionalColumns.notificationDay]
              : null;
          const notificationHour =
            typeof optionalColumns.notificationHour === 'number'
              ? studentRow[optionalColumns.notificationHour]
              : null;

          const studentIdStr = String(studentId);
          studentsDataMap[studentIdStr] = {
            studentId: studentIdStr,
            displayName: String(
              studentRow[nicknameColumn] || studentRow[realNameColumn] || '',
            ),
            realName: String(studentRow[realNameColumn] || ''),
            nickname: String(studentRow[nicknameColumn] || ''),
            phone: String(studentRow[phoneColumn] || ''),
            email: String(
              typeof optionalColumns.email === 'number'
                ? studentRow[optionalColumns.email] || ''
                : '',
            ),
            wantsEmail: wantsEmail,
            wantsScheduleNotification: wantsScheduleNotification,
            notificationDay:
              typeof notificationDay === 'number' ? notificationDay : undefined,
            notificationHour:
              typeof notificationHour === 'number'
                ? notificationHour
                : undefined,
            rowIndex: index + 2, // ヘッダー行を考慮した実際の行番号 (1-based + header)
          };
        }
      },
    );

    // 生徒データを配列形式に変換（分割キャッシュ用）
    /** @type {StudentData[]} */
    const studentsArray = Object.values(studentsDataMap);

    const cacheData = {
      version: new Date().getTime(),
      students: studentsDataMap,
      headerMap: Object.fromEntries(headerColumnMap), // ヘッダーマップを追加
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
        headerMap: Object.fromEntries(headerColumnMap), // ヘッダーマップを追加
        lastUpdated: new Date().toISOString(),
        isChunked: true,
      });

      const success = saveChunkedDataToCache(
        CACHE_KEYS.ALL_STUDENTS_BASIC,
        dataChunks,
        metadata,
        CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
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
        CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
      );

      Logger.log(
        `生徒基本情報キャッシュを更新しました。件数: ${Object.keys(studentsDataMap).length}`,
      );
    }
  } catch (e) {
    BackendErrorHandler.handle(e, 'rebuildAllStudentsBasicCache');
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
export function updateScheduleStatusToCompleted() {
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
      const errorMsg = '[ScheduleStatus] データが存在しません';
      Logger.log(errorMsg);
      throw new Error(errorMsg);
    }

    const headers = allData[0];
    if (!Array.isArray(headers)) {
      const errorMsg = '[ScheduleStatus] ヘッダー行を取得できませんでした';
      Logger.log(errorMsg);
      throw new Error(errorMsg);
    }
    const dateColIndex = headers.indexOf(CONSTANTS.HEADERS.SCHEDULE.DATE);
    const statusColIndex = headers.indexOf(CONSTANTS.HEADERS.SCHEDULE.STATUS);

    if (dateColIndex === -1 || statusColIndex === -1) {
      const errorMsg = `[ScheduleStatus] 必要な列が見つかりません: DATE=${dateColIndex}, STATUS=${statusColIndex}`;
      Logger.log(errorMsg);
      throw new Error(errorMsg);
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
          Logger.log(
            `[ScheduleStatus] 日付解析エラー: ${scheduleDate}, エラー: ${error.message}`,
          );
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
 * - ログシートの記録
 *
 * @throws {Error} ロック取得失敗やキャッシュ再構築中のエラーは内部でキャッチされログに記録
 */
export function triggerScheduledCacheRebuild() {
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
 * 使いやすさのための定数定義
 */
export const CACHE_KEYS = /** @type {const} */ ({
  ALL_RESERVATIONS: 'all_reservations',
  ALL_STUDENTS_BASIC: 'all_students_basic',
  MASTER_SCHEDULE_DATA: 'master_schedule_data',
  MASTER_ACCOUNTING_DATA: 'master_accounting_data',
});

/**
 * @typedef {typeof CACHE_KEYS[keyof typeof CACHE_KEYS]} CacheKey
 */

/**
 * @template {CacheKey} K
 * @typedef {K extends 'all_reservations' ? ReservationCacheData :
 *           K extends 'all_students_basic' ? StudentCacheData :
 *           K extends 'master_schedule_data' ? ScheduleCacheData :
 *           K extends 'master_accounting_data' ? AccountingCacheData :
 *           never} CacheDataType
 */

/**
 * 型定義に基づいたキャッシュ取得のオーバーロード定義
 * @template {CacheKey} K
 * @overload
 * @param {K} cacheKey
 * @param {boolean} [autoRebuild]
 * @returns {CacheDataType<K> | null}
 */

/**
 * 指定されたキャッシュキーから型付けされたデータを取得する汎用関数
 * @template {CacheKey} K
 * @param {K} cacheKey - キャッシュキー（CACHE_KEYS定数の使用推奨）
 * @param {boolean} [autoRebuild=true] - キャッシュがない場合に自動再構築するか
 * @returns {CacheDataType<K> | null} 型付けされたキャッシュデータまたはnull
 */
export function getTypedCachedData(cacheKey, autoRebuild = true) {
  // @ts-ignore
  return getCachedData(cacheKey, autoRebuild);
}

/**
 * 指定されたキャッシュキーからデータを取得する汎用関数（キャッシュがない場合は自動再構築）
 * @param {string} cacheKey - キャッシュキー（CACHE_KEYS定数の使用推奨）
 * @param {boolean} [autoRebuild=true] - キャッシュがない場合に自動再構築するか（デフォルト: true）
 * @returns {CacheDataStructure | null} キャッシュされたデータまたはnull
 */
export function getCachedData(cacheKey, autoRebuild = true) {
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
    if (!parsedData || typeof parsedData !== 'object') {
      PerformanceLog.debug(
        `${cacheKey}キャッシュに不正なデータが含まれています`,
      );
      return null;
    }
    const typedData = /** @type {CacheDataStructure} */ (parsedData);
    const dataCount = getDataCount(typedData, cacheKey);
    PerformanceLog.debug(
      `${cacheKey}単一キャッシュから取得完了。件数: ${dataCount}`,
    );
    return typedData;
  } catch (e) {
    Logger.log(`getCachedData(${cacheKey})でエラー: ${e.message}`);
    return null;
  }
}

/**
 * キャッシュの存在確認とバージョン情報を取得する
 * @param {string} cacheKey - キャッシュキー
 * @returns {CacheInfo} { exists: boolean, version: number|null, dataCount: number|null }
 */
export function getCacheInfo(cacheKey) {
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
export function getAllCacheInfo() {
  /** @type {{ [key: string]: CacheInfo }} */
  const result = {};

  // 各キャッシュキーに対してgetCacheInfoを呼び出し
  for (const key of Object.values(CACHE_KEYS)) {
    result[key] = getCacheInfo(key);
  }

  // @ts-ignore - TypeScriptの空オブジェクトリテラル制約を回避
  return result;
}

/**
 * 分割キャッシュ用の定数
 */
export const CHUNK_SIZE_LIMIT_KB = 90; // 90KBでチャンク分割（余裕を持たせる）
export const MAX_CHUNKS = 20; // 最大チャンク数

/**
 * データを指定サイズで分割する関数
 * @param {(string|number|Date)[][]|StudentData[]} data - 分割対象のデータ配列
 * @param {number} maxSizeKB - 最大サイズ（KB）
 * @returns {((string|number|Date)[][]|StudentData[])[]} 分割されたデータチャンクの配列
 */
export function splitDataIntoChunks(data, maxSizeKB = CHUNK_SIZE_LIMIT_KB) {
  if (!data || data.length === 0) return [[]];

  /** @type {((string|number|Date)[][]|StudentData[])[]} */
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
    `データ分割: 平均アイテムサイズ=${Math.round(
      avgItemSizeBytes,
    )}bytes, チャンクあたり推定=${estimatedItemsPerChunk}件`,
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
 * @param {((string|number|Date)[][]|StudentData[])[]} dataChunks - 分割されたデータチャンク配列
 * @param {ChunkedCacheMetadata} metadata - メタデータ
 * @param {number} expiry - キャッシュ有効期限（秒）
 * @returns {boolean} 保存成功の可否
 */
export function saveChunkedDataToCache(
  baseKey,
  dataChunks,
  metadata,
  expiry = CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
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
      `分割キャッシュ保存完了: ${dataChunks.length}チャンク, 合計${dataChunks.reduce(
        (sum, chunk) => sum + chunk.length,
        0,
      )}件`,
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
export function loadChunkedDataFromCache(baseKey) {
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
      allData.forEach(
        /** @param {any} student */ student => {
          // StudentDataは元々配列形式で保存されているため、型アサーションで変換
          const studentData = /** @type {any} */ (student);
          if (studentData.studentId) {
            studentsMap[studentData.studentId] = studentData;
          }
        },
      );

      result = {
        version: metadata.version,
        students: studentsMap,
        headerMap: metadata.headerMap,
        metadata: {
          totalCount: allData.length,
          isChunked: true,
          totalChunks: totalChunks,
          lastUpdated: metadata.lastUpdated,
        },
      };
    } else {
      // 予約データなど他のキャッシュの場合
      // ★ reservationIdIndexMapをメタデータから取得、なければ再構築
      const reservationIdIndexMap = metadata.reservationIdIndexMap || {};

      // メタデータにreservationIdIndexMapがない場合は再構築
      if (
        !metadata.reservationIdIndexMap ||
        Object.keys(reservationIdIndexMap).length === 0
      ) {
        Logger.log(
          `${baseKey}: reservationIdIndexMapが見つからないため再構築します`,
        );
        const headerMap = metadata.headerMap || {};
        const reservationIdColIndex =
          headerMap[CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID];

        if (reservationIdColIndex !== undefined) {
          allData.forEach(
            (
              /** @type {(string|number|Date)[]} */ row,
              /** @type {number} */ index,
            ) => {
              const reservationId = row[reservationIdColIndex];
              if (reservationId) {
                reservationIdIndexMap[String(reservationId)] = index;
              }
            },
          );
          Logger.log(
            `${baseKey}: reservationIdIndexMapを再構築しました（${Object.keys(reservationIdIndexMap).length}件）`,
          );
        }
      }

      result = {
        version: metadata.version,
        reservations: allData,
        headerMap: metadata.headerMap,
        reservationIdIndexMap: reservationIdIndexMap,
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
export function clearChunkedCache(baseKey) {
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
 * 生徒基本情報キャッシュを取得し、Record形式で返すヘルパー
 * @param {boolean} [autoRebuild=true] - キャッシュ未存在時に再構築を試行するか
 * @returns {Record<string, UserCore> | null} 生徒情報マップ
 */
export function getCachedAllStudents(autoRebuild = true) {
  const cache = getTypedCachedData(CACHE_KEYS.ALL_STUDENTS_BASIC, autoRebuild);
  if (!cache || !cache.students || typeof cache.students !== 'object') {
    return null;
  }
  return /** @type {Record<string, UserCore>} */ (cache.students);
}

/**
 * キャッシュ上の生徒情報を更新する
 * @param {UserCore} updatedStudent - 更新後の生徒情報（studentId必須）
 */
export function updateCachedStudent(updatedStudent) {
  if (!updatedStudent || !updatedStudent.studentId) {
    Logger.log(
      'updateCachedStudent: studentIdが指定されていないためスキップしました',
    );
    return;
  }

  const cache = getTypedCachedData(
    CACHE_KEYS.ALL_STUDENTS_BASIC,
    /* autoRebuild */ false,
  );

  if (!cache || !cache.students) {
    Logger.log(
      'updateCachedStudent: 生徒キャッシュが存在しないため再構築を実行します',
    );
    rebuildAllStudentsBasicCache();
    return;
  }

  const students = /** @type {Record<string, UserCore>} */ ({
    ...cache.students,
  });
  const baseStudent = students[updatedStudent.studentId] || {};
  students[updatedStudent.studentId] = {
    ...baseStudent,
    ...updatedStudent,
  };

  const headerMap =
    cache['headerMap'] && typeof cache['headerMap'] === 'object'
      ? /** @type {Record<string, number>} */ (cache['headerMap'])
      : undefined;

  persistStudentCache(students, headerMap);
}

/**
 * キャッシュに新しい生徒情報を追加する
 * @param {UserCore} newStudent - 追加する生徒情報（studentId必須）
 */
export function addCachedStudent(newStudent) {
  if (!newStudent || !newStudent.studentId) {
    Logger.log(
      'addCachedStudent: studentIdが指定されていないためスキップしました',
    );
    return;
  }

  const cache = getTypedCachedData(
    CACHE_KEYS.ALL_STUDENTS_BASIC,
    /* autoRebuild */ false,
  );

  if (!cache || !cache.students) {
    Logger.log(
      'addCachedStudent: 生徒キャッシュが存在しないため再構築を実行します',
    );
    rebuildAllStudentsBasicCache();
    return;
  }

  const students = /** @type {Record<string, UserCore>} */ ({
    ...cache.students,
  });
  students[newStudent.studentId] = { ...newStudent };

  const headerMap =
    cache['headerMap'] && typeof cache['headerMap'] === 'object'
      ? /** @type {Record<string, number>} */ (cache['headerMap'])
      : undefined;

  persistStudentCache(students, headerMap);
}

/**
 * 指定したキャッシュキーのデータを削除する
 * @param {CacheKey | string} cacheKey - 削除対象のキャッシュキー
 */
export function deleteCache(cacheKey) {
  const cache = CacheService.getScriptCache();
  cache.remove(cacheKey);
  clearChunkedCache(cacheKey);
  cache.remove(`${cacheKey}_meta`);
}

/**
 * すべてのキャッシュを削除する（開発・デバッグ用途）
 */
export function deleteAllCache() {
  for (const key of Object.values(CACHE_KEYS)) {
    deleteCache(key);
  }
}

/**
 * 各キャッシュキーに対応するデータ件数取得関数
 * @param {object} parsedData - パース済みキャッシュデータ
 * @param {string} cacheKey - キャッシュキー
 * @returns {number} データ件数
 */
export function getDataCount(parsedData, cacheKey) {
  if (!parsedData || typeof parsedData !== 'object') return 0;

  /** @type {CacheDataStructure} */
  const data = /** @type {CacheDataStructure} */ (parsedData);

  switch (cacheKey) {
    case CACHE_KEYS.ALL_RESERVATIONS:
      return Array.isArray(data['reservations'])
        ? /** @type {any[]} */ (data['reservations']).length
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
          ? /** @type {any[]} */ (data['data']).length
          : 0
        : 0;
  }
}

/**
 * 生徒キャッシュを永続化する内部ヘルパー
 * @param {Record<string, UserCore>} studentsMap - 生徒情報マップ
 * @param {Record<string, number> | undefined} headerMap - ヘッダーマップ
 */
function persistStudentCache(studentsMap, headerMap) {
  const cache = CacheService.getScriptCache();
  const totalCount = Object.keys(studentsMap).length;
  const baseData = {
    version: new Date().getTime(),
    students: studentsMap,
    headerMap: headerMap || undefined,
    metadata: {
      totalCount,
      lastUpdated: new Date().toISOString(),
    },
  };

  const serialized = JSON.stringify(baseData);
  const sizeKB = Math.round(serialized.length / 1024);

  if (sizeKB >= CHUNK_SIZE_LIMIT_KB) {
    const studentArray = Object.values(studentsMap);
    /** @type {ChunkedCacheMetadata} */
    const chunkMetadata = /** @type {ChunkedCacheMetadata} */ ({
      version: baseData.version,
      totalCount,
      lastUpdated: baseData.metadata.lastUpdated,
      headerMap: baseData.headerMap || {},
      isChunked: true,
    });

    const chunks = splitDataIntoChunks(studentArray, CHUNK_SIZE_LIMIT_KB);
    const success = saveChunkedDataToCache(
      CACHE_KEYS.ALL_STUDENTS_BASIC,
      chunks,
      chunkMetadata,
    );

    if (!success) {
      Logger.log(
        'persistStudentCache: 分割キャッシュの保存に失敗しました。再構築を実行します。',
      );
      rebuildAllStudentsBasicCache();
    } else {
      cache.remove(CACHE_KEYS.ALL_STUDENTS_BASIC);
    }
    return;
  }

  clearChunkedCache(CACHE_KEYS.ALL_STUDENTS_BASIC);
  cache.put(
    CACHE_KEYS.ALL_STUDENTS_BASIC,
    serialized,
    CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
  );
}

/**
 * 予約IDを指定して、キャッシュから単一の予約データを取得する
 * @param {string} reservationId - 取得する予約のID
 * @returns {RawSheetRow | null} 予約データ配列、見つからない場合はnull
 */
export function getReservationByIdFromCache(reservationId) {
  if (!reservationId) return null;

  const cache = getTypedCachedData(CACHE_KEYS.ALL_RESERVATIONS, false); // autoRebuildはfalseで良い
  if (!cache || !cache.reservations || !cache.reservationIdIndexMap) {
    return null;
  }

  const index = cache.reservationIdIndexMap[reservationId];
  if (index === undefined) {
    return null;
  }

  return cache.reservations[index] || null;
}

/**
 * lessonIdでレッスン情報をキャッシュから取得（O(1)アクセス）
 *
 * @param {string} lessonId - 取得対象のレッスンID
 * @returns {LessonCore | null} レッスン情報、見つからない場合はnull
 *
 * @example
 * const lesson = getLessonByIdFromCache('c3e2a1b0-5b3a-4b9c-8b0a-0e1b0e1b0e1b');
 * if (lesson) {
 *   console.log(`教室: ${lesson.classroom}, 日付: ${lesson.date}`);
 * }
 */
export function getLessonByIdFromCache(lessonId) {
  if (!lessonId) return null;

  const scheduleCache = getTypedCachedData(
    CACHE_KEYS.MASTER_SCHEDULE_DATA,
    false,
  );
  if (!scheduleCache || !scheduleCache.schedule) {
    return null;
  }

  // lessonIdインデックスMapを構築（初回のみ、キャッシュに保存）
  if (!scheduleCache._lessonIdMap) {
    scheduleCache._lessonIdMap = new Map();
    for (const lesson of scheduleCache.schedule) {
      if (lesson.lessonId) {
        scheduleCache._lessonIdMap.set(lesson.lessonId, lesson);
      }
    }
  }

  return scheduleCache._lessonIdMap.get(lessonId) || null;
}

/**
 * 複数の予約IDから予約オブジェクトを一括取得
 *
 * @param {string[]} reservationIds - 取得対象の予約IDの配列
 * @returns {ReservationCore[]} 予約オブジェクトの配列（見つからないIDはスキップ）
 *
 * @example
 * const reservations = getReservationsByIdsFromCache(['R-001', 'R-002', 'R-003']);
 * console.log(`取得した予約数: ${reservations.length}`);
 */
export function getReservationsByIdsFromCache(reservationIds) {
  if (!Array.isArray(reservationIds) || reservationIds.length === 0) {
    return [];
  }

  const cache = getTypedCachedData(CACHE_KEYS.ALL_RESERVATIONS, false);
  if (!cache || !cache.reservations || !cache.reservationIdIndexMap) {
    return [];
  }

  const reservations = [];
  for (const id of reservationIds) {
    if (!id) continue; // 空文字やnullをスキップ

    const index = cache.reservationIdIndexMap[id];
    if (index !== undefined && cache.reservations[index]) {
      reservations.push(cache.reservations[index]);
    }
  }

  return reservations;
}

/**
 * Schedule Master キャッシュの診断・修復機能
 * シートの存在確認とキャッシュの整合性チェックを実行
 * GASエディタから直接実行可能（メニューからトリガー登録推奨）
 */
export function diagnoseAndFixScheduleMasterCache() {
  Logger.log('=== Schedule Master キャッシュ診断・修復開始 ===');

  try {
    // 1. シートの存在確認
    const sheet = SS_MANAGER.getSheet(CONSTANTS.SHEET_NAMES.SCHEDULE);
    if (!sheet) {
      Logger.log('⚠️ Schedule Masterシートが存在しません');
      return; // ここで処理を中断
    }

    Logger.log('✅ Schedule Masterシートは存在します。');

    // 2. キャッシュの存在と状態を確認
    const cacheInfo = getCacheInfo(CACHE_KEYS.MASTER_SCHEDULE_DATA);
    if (!cacheInfo.exists) {
      Logger.log('ℹ️ キャッシュが存在しません。再構築を試みます...');
      rebuildScheduleMasterCache();
      Logger.log('✅ キャッシュを再構築しました。');
      return;
    }

    Logger.log(
      `✅ キャッシュは存在します (Version: ${cacheInfo.version}, 件数: ${cacheInfo.dataCount})`,
    );

    // 3. キャッシュデータの整合性チェック（簡単な件数比較）
    const cachedData = getTypedCachedData(
      CACHE_KEYS.MASTER_SCHEDULE_DATA,
      false,
    );
    const sheetDataCount = sheet.getLastRow() - 1; // ヘッダー除く

    if (
      cachedData &&
      cachedData.schedule &&
      Array.isArray(cachedData.schedule) &&
      cachedData.schedule.length !== sheetDataCount
    ) {
      Logger.log(
        `⚠️ キャッシュとシートのデータ件数が不一致です (キャッシュ: ${cachedData.schedule.length}, シート: ${sheetDataCount})`,
      );
      Logger.log('ℹ️ キャッシュの再構築を推奨します。');
    } else {
      Logger.log('✅ キャッシュとシートのデータ件数は一致しています。');
    }

    Logger.log('=== 診断・修復完了 ===');
  } catch (error) {
    Logger.log(`❌ 診断中にエラーが発生しました: ${error.message}`);
    handleError(error, false);
  }
}
