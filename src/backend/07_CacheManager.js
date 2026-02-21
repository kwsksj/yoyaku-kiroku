/**
 * =================================================================
 * 【ファイル名】  : 07_CacheManager.js
 * 【モジュール種別】: バックエンド（GAS）
 * 【役割】        : CacheService と PropertiesService を活用し、よやく・生徒などの大型データを統合管理する。
 *
 * 【主な責務】
 *   - `getCachedData` を中心に、キャッシュ取得・自動再構築を一元化
 *   - よやく／生徒／日程など各種キャッシュのインクリメンタル更新 API を提供
 *   - キャッシュメタ情報（バージョン、件数、更新時刻）の整合性を維持
 *
 * 【関連モジュール】
 *   - `00_SpreadsheetManager.js`: シートアクセスの基盤
 *   - `05-2_Backend_Write.js`: よやく操作後のキャッシュ更新で多数利用
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
  buildRowValuesMap,
  createHeaderMap,
  getCachedReservationsAsObjects,
  handleError,
  sortReservationRows,
  transformReservationArrayToObject,
  transformReservationArrayToObjectWithHeaders,
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
 * ヘッダーマップをMap型に復元するヘルパー関数
 * @param {HeaderMapType} headerMap - ヘッダーマップ（MapまたはRecord）
 * @returns {Map<string, number> | null} Map型のヘッダーマップ
 */
function toHeaderMapInstance(headerMap) {
  if (!headerMap) return null;
  if (headerMap instanceof Map) {
    return headerMap;
  }
  return new Map(
    Object.entries(/** @type {Record<string, number>} */ (headerMap)),
  );
}

/**
 * 日程シートの日付列候補
 * @type {string[]}
 */
const SCHEDULE_DATE_HEADER_CANDIDATES = [
  CONSTANTS.HEADERS.SCHEDULE.DATE,
  '開催日',
  'date',
];

/**
 * 日程シートの状態列候補
 * 既存シートとの互換性維持のため、旧ヘッダー名も許容します。
 * @type {string[]}
 */
const SCHEDULE_STATUS_HEADER_CANDIDATES = [
  CONSTANTS.HEADERS.SCHEDULE.STATUS,
  '状態',
  'status',
];

/**
 * 日程シートの売上転載状態列候補
 * @type {string[]}
 */
const SCHEDULE_SALES_TRANSFER_STATUS_HEADER_CANDIDATES = [
  CONSTANTS.HEADERS.SCHEDULE.SALES_TRANSFER_STATUS,
  '売上転記状態',
  '売上転送状態',
  'salesTransferStatus',
];

/**
 * 日程シートの売上転載日時列候補
 * @type {string[]}
 */
const SCHEDULE_SALES_TRANSFER_AT_HEADER_CANDIDATES = [
  CONSTANTS.HEADERS.SCHEDULE.SALES_TRANSFER_AT,
  '売上転記日時',
  '売上転送日時',
  'salesTransferredAt',
];

/**
 * ヘッダー候補から列インデックスを取得します。
 * @param {string[]} headers
 * @param {string[]} candidates
 * @returns {number}
 */
export function findHeaderIndexByCandidates(headers, candidates) {
  if (!Array.isArray(headers) || !Array.isArray(candidates)) return -1;

  /** @type {Map<string, number>} */
  const indexMap = new Map();
  headers.forEach((header, index) => {
    const normalized = String(header || '').trim();
    if (!normalized) return;
    if (!indexMap.has(normalized)) {
      indexMap.set(normalized, index);
    }
    const lower = normalized.toLowerCase();
    if (!indexMap.has(lower)) {
      indexMap.set(lower, index);
    }
  });

  for (const candidate of candidates) {
    const normalizedCandidate = String(candidate || '').trim();
    if (!normalizedCandidate) continue;
    if (indexMap.has(normalizedCandidate)) {
      return /** @type {number} */ (indexMap.get(normalizedCandidate));
    }
    const lower = normalizedCandidate.toLowerCase();
    if (indexMap.has(lower)) {
      return /** @type {number} */ (indexMap.get(lower));
    }
  }

  return -1;
}

/**
 * lessonId → LessonCore のインメモリインデックスを保持するためのキャッシュ
 * @type {{ version: string | number | null, map: Map<string, LessonCore> }}
 */
const lessonIdCacheState = {
  version: null,
  map: new Map(),
};

const CACHE_VERSION_SUFFIX = '__version';

/**
 * よやくキャッシュのインメモリスナップショット
 * @type {{ version: string | number | null, cache: ReservationCacheData | null }}
 */
const reservationCacheState = {
  version: null,
  cache: null,
};

/**
 * 生徒キャッシュのインメモリスナップショット
 * @type {{ version: string | number | null, cache: StudentCacheData | null }}
 */
const studentCacheState = {
  version: null,
  cache: null,
};

/**
 * キャッシュバージョンキーを返す
 * @param {string} cacheKey
 * @returns {string}
 */
function getCacheVersionKey(cacheKey) {
  return `${cacheKey}${CACHE_VERSION_SUFFIX}`;
}

/**
 * キャッシュのバージョンを更新する
 * @param {string} cacheKey
 * @param {string|number|null} version
 * @param {number} [expiry]
 */
function setCacheVersion(cacheKey, version, expiry) {
  if (version === undefined || version === null) return;
  try {
    CacheService.getScriptCache().put(
      getCacheVersionKey(cacheKey),
      String(version),
      expiry || CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
    );
  } catch (error) {
    Logger.log(`setCacheVersion Error (${cacheKey}): ${error.message}`);
  }
}

/**
 * 現在のキャッシュバージョンを取得する
 * @param {string} cacheKey
 * @returns {string|null}
 */
function getCacheVersion(cacheKey) {
  try {
    return CacheService.getScriptCache().get(getCacheVersionKey(cacheKey));
  } catch (error) {
    Logger.log(`getCacheVersion Error (${cacheKey}): ${error.message}`);
    return null;
  }
}

/**
 * キャッシュのバージョンキーを削除する
 * @param {string} cacheKey
 */
function removeCacheVersion(cacheKey) {
  try {
    CacheService.getScriptCache().remove(getCacheVersionKey(cacheKey));
  } catch (error) {
    Logger.log(`removeCacheVersion Error (${cacheKey}): ${error.message}`);
  }
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
 *   - 全よやくデータ（予約記録シート）
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
 * よやくキャッシュに新しいよやくデータを追加（インクリメンタル更新）
 * シート全体の再読み込みを避けて、パフォーマンスを大幅に向上
 * @param {(string|number|Date)[]} newReservationRow - 新しいよやく行データ
 * @param {HeaderMapType} headerMap - ヘッダーマッピング
 */
export function addReservationToCache(newReservationRow, headerMap) {
  try {
    Logger.log('[CACHE] インクリメンタルよやく追加開始');
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

    // キャッシュに新しいよやくを追加
    const currentReservations = /** @type {ReservationRawDataArray} */ (
      getCacheProperty(currentCache, 'reservations')
    );
    const updatedReservations = [formattedRow, ...currentReservations]; // 新しいよやくを先頭に追加

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
    setCacheVersion(
      CACHE_KEYS.ALL_RESERVATIONS,
      updatedCacheData.version,
      CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
    );
    invalidateReservationCacheSnapshot();
    setCacheVersion(
      CACHE_KEYS.ALL_RESERVATIONS,
      updatedCacheData.version,
      CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
    );
    invalidateReservationCacheSnapshot();

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    Logger.log(
      `[CACHE] インクリメンタルよやく追加完了: ${duration}ms, 総件数: ${updatedReservations.length}`,
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
 * キャッシュ内のよやくステータスを更新（インクリメンタル更新）
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
    setCacheVersion(
      CACHE_KEYS.ALL_RESERVATIONS,
      updatedCacheData.version,
      CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
    );
    invalidateReservationCacheSnapshot();

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
 * キャッシュ内のよやくデータを完全に更新（インクリメンタル更新）
 * よやく詳細更新処理などで使用し、シート全体の再読み込みを回避
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
    Logger.log('[CACHE] インクリメンタルよやく更新開始');
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
    setCacheVersion(
      CACHE_KEYS.ALL_RESERVATIONS,
      updatedCacheData.version,
      CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
    );
    invalidateReservationCacheSnapshot();

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    Logger.log(`[CACHE] インクリメンタルよやく更新完了: ${duration}ms`);
  } catch (error) {
    Logger.log(
      `[CACHE] インクリメンタルよやく更新エラー: ${error.message}, 通常の再構築実行`,
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
    setCacheVersion(
      CACHE_KEYS.ALL_RESERVATIONS,
      updatedCacheData.version,
      CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
    );
    invalidateReservationCacheSnapshot();

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
 * 生徒名簿からすべての情報を読み込み、CacheServiceに保存する
 * 生徒IDをキーとしたオブジェクト形式でキャッシュに保存します。
 *
 * @throws {Error} 生徒名簿シートが見つからない場合
 * @throws {Error} 必須ヘッダーが見つからない場合
 * @throws {Error} データ処理中にエラーが発生した場合
 */
export function rebuildAllStudentsCache() {
  try {
    const studentRosterSheet = SS_MANAGER.getSheet(
      CONSTANTS.SHEET_NAMES.ROSTER,
    );
    if (!studentRosterSheet || studentRosterSheet.getLastRow() < 2) {
      Logger.log('生徒名簿シートが見つからないか、データが空です。');
      const emptyCacheData = { version: new Date().getTime(), students: {} };
      CacheService.getScriptCache().put(
        CACHE_KEYS.ALL_STUDENTS,
        JSON.stringify(emptyCacheData),
        CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
      );
      setCacheVersion(
        CACHE_KEYS.ALL_STUDENTS,
        emptyCacheData.version,
        CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
      );
      return;
    }

    const headerRow = studentRosterSheet
      .getRange(1, 1, 1, studentRosterSheet.getLastColumn())
      .getValues()[0];
    const headerColumnMap = /** @type {Map<string, number>} */ (
      createHeaderMap(headerRow)
    );

    const studentIdColIdx = headerColumnMap.get(
      CONSTANTS.HEADERS.ROSTER.STUDENT_ID,
    );
    if (studentIdColIdx === undefined) {
      throw new Error('生徒名簿に必須の「生徒ID」列が見つかりません。');
    }

    const allStudentRows = studentRosterSheet
      .getRange(2, 1, studentRosterSheet.getLastRow() - 1, headerRow.length)
      .getValues();

    /** @type {{ [studentId: string]: UserCore }} */
    const studentsDataMap = {};
    allStudentRows.forEach((studentRow, index) => {
      const studentId = studentRow[studentIdColIdx];
      if (!studentId || !String(studentId).trim()) return;

      /** @type {Partial<UserCore>} */
      const studentData = {};
      headerRow.forEach((header, colIdx) => {
        let propName = ''; // マッピングされない場合は空
        let value = studentRow[colIdx];

        switch (header) {
          case CONSTANTS.HEADERS.ROSTER.STUDENT_ID:
            propName = 'studentId';
            break;
          case CONSTANTS.HEADERS.ROSTER.REAL_NAME:
            propName = 'realName';
            break;
          case CONSTANTS.HEADERS.ROSTER.NICKNAME:
            propName = 'nickname';
            break;
          case CONSTANTS.HEADERS.ROSTER.PHONE:
            propName = 'phone';
            break;
          case CONSTANTS.HEADERS.ROSTER.EMAIL:
            propName = 'email';
            break;
          case CONSTANTS.HEADERS.ROSTER.WANTS_RESERVATION_EMAIL:
            propName = 'wantsEmail';
            value =
              String(value).toUpperCase() === 'TRUE' || value === '希望する';
            break;
          case CONSTANTS.HEADERS.ROSTER.WANTS_SCHEDULE_INFO:
            propName = 'wantsScheduleNotification';
            value =
              String(value).toUpperCase() === 'TRUE' || value === '希望する';
            break;
          case CONSTANTS.HEADERS.ROSTER.NOTIFICATION_DAY:
            propName = 'notificationDay';
            break;
          case CONSTANTS.HEADERS.ROSTER.NOTIFICATION_HOUR:
            propName = 'notificationHour';
            break;
          case CONSTANTS.HEADERS.ROSTER.AGE_GROUP:
            propName = 'ageGroup';
            break;
          case CONSTANTS.HEADERS.ROSTER.GENDER:
            propName = 'gender';
            break;
          case CONSTANTS.HEADERS.ROSTER.DOMINANT_HAND:
            propName = 'dominantHand';
            break;
          case CONSTANTS.HEADERS.ROSTER.ADDRESS:
            propName = 'address';
            break;
          case CONSTANTS.HEADERS.ROSTER.EXPERIENCE:
            propName = 'experience';
            break;
          case CONSTANTS.HEADERS.ROSTER.PAST_WORK:
            propName = 'pastWork';
            break;
          case CONSTANTS.HEADERS.ROSTER.ATTENDANCE_INTENTION:
            propName = 'futureParticipation';
            break;
          case CONSTANTS.HEADERS.ROSTER.FUTURE_CREATIONS:
            propName = 'futureCreations';
            break;
          case CONSTANTS.HEADERS.ROSTER.TRIGGER:
            propName = 'trigger';
            break;
          case CONSTANTS.HEADERS.ROSTER.FIRST_MESSAGE:
            propName = 'firstMessage';
            break;
          case CONSTANTS.HEADERS.ROSTER.COMPANION:
            propName = 'companion';
            break;
          case CONSTANTS.HEADERS.ROSTER.TRANSPORTATION:
            propName = 'transportation';
            break;
          case CONSTANTS.HEADERS.ROSTER.PICKUP:
            propName = 'pickup';
            break;
          case CONSTANTS.HEADERS.ROSTER.CAR:
            propName = 'car';
            break;
          case CONSTANTS.HEADERS.ROSTER.NOTES:
            propName = 'notes';
            break;
          case CONSTANTS.HEADERS.ROSTER.NEXT_LESSON_GOAL:
            propName = 'nextLessonGoal';
            break;
        }
        if (propName) {
          studentData[propName] = value;
        }
      });

      if (!studentData.displayName) {
        studentData.displayName = studentData.nickname || studentData.realName;
      }

      studentData.rowIndex = index + 2;
      studentsDataMap[String(studentId)] = /** @type {UserCore} */ (
        studentData
      );
    });

    const studentsArray = Object.values(studentsDataMap);
    const cacheData = {
      version: new Date().getTime(),
      students: studentsDataMap,
      headerMap: Object.fromEntries(headerColumnMap),
      metadata: {
        totalCount: studentsArray.length,
        lastUpdated: new Date().toISOString(),
      },
    };

    const cacheDataJson = JSON.stringify(cacheData);
    const dataSizeKB = Math.round(getUtf8ByteLength(cacheDataJson) / 1024);

    Logger.log(
      `生徒全情報キャッシュデータサイズ: ${dataSizeKB}KB, 件数: ${studentsArray.length}`,
    );

    if (dataSizeKB >= CHUNK_SIZE_LIMIT_KB) {
      Logger.log(
        `データサイズが${CHUNK_SIZE_LIMIT_KB}KB以上のため、分割キャッシュシステムを使用します。`,
      );

      const dataChunks = splitDataIntoChunks(
        studentsArray,
        CHUNK_SIZE_LIMIT_KB,
      );
      /** @type {ChunkedCacheMetadata} */
      const metadata = {
        version: new Date().getTime(),
        totalCount: studentsArray.length,
        headerMap: Object.fromEntries(headerColumnMap),
        lastUpdated: new Date().toISOString(),
        isChunked: true,
        totalChunks: dataChunks.length,
      };

      const success = saveChunkedDataToCache(
        CACHE_KEYS.ALL_STUDENTS,
        dataChunks,
        metadata,
        CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
      );

      if (success) {
        Logger.log(
          `生徒全情報キャッシュを分割保存しました。件数: ${studentsArray.length}, チャンク数: ${dataChunks.length}`,
        );
      } else {
        throw new Error('生徒全情報の分割キャッシュ保存に失敗しました。');
      }
    } else {
      CacheService.getScriptCache().put(
        CACHE_KEYS.ALL_STUDENTS,
        cacheDataJson,
        CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
      );
      setCacheVersion(
        CACHE_KEYS.ALL_STUDENTS,
        cacheData.version,
        CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
      );
      Logger.log(
        `生徒全情報キャッシュを更新しました。件数: ${Object.keys(studentsDataMap).length}`,
      );
    }
  } catch (e) {
    BackendErrorHandler.handle(e, 'rebuildAllStudentsCache');
    throw e;
  }
}

/**
 * 全てのキャッシュデータを一括で再構築するエントリーポイント関数
 * UI確認ダイアログを表示してから、全種類のキャッシュを順次再構築します。
 * スプレッドシートのメニューから手動実行される場合に使用されます。
 *
 * 再構築対象:
 * - 統合よやくデータキャッシュ
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
    rebuildAllStudentsCache();
    rebuildAccountingMasterCache();
    rebuildScheduleMasterCache();

    // 予約IDsをよやくキャッシュから再構築（シート編集によるズレを修正）
    syncReservationIdsToSchedule();

    SS_MANAGER.getSpreadsheet().toast(
      'キャッシュデータの一括再構築が完了しました。',
      '成功',
      5,
    );

    Logger.log(
      'キャッシュ一括再構築: 全キャッシュ（よやく、生徒、会計マスター、日程マスター）を再構築完了',
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
 * 予約記録シートから全よやくデータを読み込み、CacheServiceに保存する
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
      setCacheVersion(
        CACHE_KEYS.ALL_RESERVATIONS,
        emptyCacheData.version,
        CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
      );
      invalidateReservationCacheSnapshot();
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
      setCacheVersion(
        CACHE_KEYS.ALL_RESERVATIONS,
        emptyCacheData.version,
        CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
      );
      invalidateReservationCacheSnapshot();
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
      throw new Error('よやくシートで日付列を特定できませんでした。');
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

    // 全データを多段階ソート（日付・ステータス・時間・参加回数）
    const sortedReservations = sortReservationRows(
      allReservationRows,
      headerColumnMap,
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
    const dataSizeKB = Math.round(getUtf8ByteLength(cacheDataJson) / 1024);

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
      invalidateReservationCacheSnapshot();
    } else {
      // 通常の単一キャッシュを使用
      PerformanceLog.debug('通常の単一キャッシュを使用します。');

      try {
        CacheService.getScriptCache().put(
          CACHE_KEYS.ALL_RESERVATIONS,
          cacheDataJson,
          CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
        );
        setCacheVersion(
          CACHE_KEYS.ALL_RESERVATIONS,
          testCacheData.version,
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
      invalidateReservationCacheSnapshot();
    }

    Logger.log(
      `全よやくデータキャッシュを更新しました。件数: ${sortedReservations.length}`,
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
 * @param {{ skipNotionSync?: boolean }} [options] - 追加オプション
 * @throws {Error} 日程データの取得や処理中にエラーが発生した場合
 */
export function rebuildScheduleMasterCache(fromDate, toDate, options = {}) {
  try {
    const skipNotionSync = options?.skipNotionSync === true;

    // デフォルトの日付範囲を設定
    // 変更履歴: 7日前 → 6ヶ月前 → 1年前（参加者リスト機能で過去データを表示するため）
    const today = new Date();

    // 1年前から（過去のレッスン履歴を表示するため）
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const startDate =
      fromDate ||
      Utilities.formatDate(oneYearAgo, CONSTANTS.TIMEZONE, 'yyyy-MM-dd');

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
    const statusColumn = findHeaderIndexByCandidates(
      headerRow,
      SCHEDULE_STATUS_HEADER_CANDIDATES,
    );
    const salesTransferStatusColumn = findHeaderIndexByCandidates(
      headerRow,
      SCHEDULE_SALES_TRANSFER_STATUS_HEADER_CANDIDATES,
    );
    const salesTransferAtColumn = findHeaderIndexByCandidates(
      headerRow,
      SCHEDULE_SALES_TRANSFER_AT_HEADER_CANDIDATES,
    );

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

    // filter内ではdateColumnを直接使用。行インデックスを保ったまま処理する
    /** @type {LessonCore[]} */
    const scheduleDataList = [];
    for (let i = 0; i < allData.length; i += 1) {
      const row = allData[i];
      const dateValue = row[dateColumn];
      if (!dateValue) continue;

      // Date オブジェクトを文字列形式に変換して比較
      const dateStr =
        dateValue instanceof Date
          ? Utilities.formatDate(dateValue, CONSTANTS.TIMEZONE, 'yyyy-MM-dd')
          : String(dateValue);

      if (dateStr < startDate || dateStr > endDate) continue;

      /** @type {LessonCore} */
      const scheduleObj = /** @type {LessonCore} */ ({});

      // ★ lessonId がない場合に自動採番して書き戻し準備
      let lessonId = row[lessonIdColumn];
      if (!lessonId) {
        lessonId = Utilities.getUuid();
        row[lessonIdColumn] = lessonId; // 後続の処理で使えるように
        updatesForSheet.push({
          row: i + 2, // allDataはヘッダーが除かれているので、+2でシート上の行番号
          col: lessonIdColumn + 1,
          value: lessonId,
        });
      }

      // 手編集で追加された日程の初期状態を補完
      if (statusColumn >= 0) {
        const currentStatus = String(row[statusColumn] || '').trim();
        if (!currentStatus) {
          row[statusColumn] = CONSTANTS.SCHEDULE_STATUS.SCHEDULED;
          updatesForSheet.push({
            row: i + 2,
            col: statusColumn + 1,
            value: CONSTANTS.SCHEDULE_STATUS.SCHEDULED,
          });
        }
      }
      if (salesTransferStatusColumn >= 0) {
        const currentTransferStatus = String(
          row[salesTransferStatusColumn] || '',
        ).trim();
        if (!currentTransferStatus) {
          row[salesTransferStatusColumn] =
            CONSTANTS.ACCOUNTING_SYSTEM.SALES_TRANSFER_STATUS.PENDING;
          updatesForSheet.push({
            row: i + 2,
            col: salesTransferStatusColumn + 1,
            value: CONSTANTS.ACCOUNTING_SYSTEM.SALES_TRANSFER_STATUS.PENDING,
          });
        }
      }

      let isValidRow = true;
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
                isValidRow = false;
                break;
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
              isValidRow = false;
              break;
            }
          } else if (value == null || value === '') {
            Logger.log(`無効な日付値: ${value}, 行をスキップ`);
            isValidRow = false;
            break;
          }
        } else if (
          SCHEDULE_SALES_TRANSFER_AT_HEADER_CANDIDATES.includes(
            String(header || '').trim(),
          ) &&
          value instanceof Date
        ) {
          value = Utilities.formatDate(
            value,
            CONSTANTS.TIMEZONE,
            'yyyy-MM-dd HH:mm:ss',
          );
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
          case '状態':
            propertyName = 'status';
            break;
          case CONSTANTS.HEADERS.SCHEDULE.SALES_TRANSFER_STATUS:
          case '売上転記状態':
          case '売上転送状態':
            propertyName = 'salesTransferStatus';
            break;
          case CONSTANTS.HEADERS.SCHEDULE.SALES_TRANSFER_AT:
          case '売上転記日時':
          case '売上転送日時':
          case 'salesTransferredAt':
            propertyName = 'salesTransferredAt';
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

      if (!isValidRow) continue;

      if (Array.isArray(scheduleObj.reservationIds)) {
        scheduleObj.reservationIds = scheduleObj.reservationIds
          .map(id => String(id || ''))
          .filter(id => id !== '');
      } else {
        scheduleObj.reservationIds = [];
      }

      if (!scheduleObj.status && statusColumn >= 0) {
        scheduleObj.status = String(row[statusColumn] || '').trim();
      }
      if (
        !scheduleObj['salesTransferStatus'] &&
        salesTransferStatusColumn >= 0
      ) {
        scheduleObj['salesTransferStatus'] = String(
          row[salesTransferStatusColumn] || '',
        ).trim();
      }
      if (!scheduleObj['salesTransferredAt'] && salesTransferAtColumn >= 0) {
        const rawTransferredAt = row[salesTransferAtColumn];
        scheduleObj['salesTransferredAt'] =
          rawTransferredAt instanceof Date
            ? Utilities.formatDate(
                rawTransferredAt,
                CONSTANTS.TIMEZONE,
                'yyyy-MM-dd HH:mm:ss',
              )
            : String(rawTransferredAt || '').trim();
      }

      scheduleDataList.push(scheduleObj);
    }

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

    // 日程キャッシュ更新後に Notion 同期（30日前以降）
    if (!skipNotionSync) {
      try {
        const syncFn = /** @type {any} */ (globalThis)
          .syncUpcomingSchedulesToNotion;
        if (typeof syncFn === 'function') {
          const syncResult = syncFn({ daysBack: 30 });
          if (syncResult?.success) {
            Logger.log(
              `[rebuildScheduleMasterCache] Notion日程同期完了: 作成${syncResult.created}, 更新${syncResult.updated}, スキップ${syncResult.skipped}, エラー${syncResult.errors}`,
            );
          }
        }
      } catch (syncError) {
        Logger.log(
          `[rebuildScheduleMasterCache] Notion日程同期エラー: ${syncError.message}`,
        );
      }
    } else {
      Logger.log(
        '[rebuildScheduleMasterCache] Notion日程同期をスキップしました',
      );
    }

    return cacheData;
  } catch (error) {
    Logger.log(`rebuildScheduleMasterCacheでエラー: ${error.message}`);
    throw new Error(
      `日程マスターのキャッシュ作成に失敗しました: ${error.message}`,
    );
  }
}

/**
 * よやくキャッシュからlessonIdを使ってreservationIdsを再構築し、日程シートとキャッシュを更新する
 * キャッシュ一括更新時に呼び出され、データの整合性を保証する
 */
export function syncReservationIdsToSchedule() {
  try {
    Logger.log('[syncReservationIdsToSchedule] 開始');

    // 1. よやくキャッシュから全よやくを取得
    const reservationCache = getReservationCacheSnapshot(true);
    if (!reservationCache || !reservationCache.reservations) {
      Logger.log(
        '[syncReservationIdsToSchedule] よやくキャッシュが見つかりません',
      );
      return;
    }

    // よやくデータをオブジェクト形式で取得
    const headerMap =
      toHeaderMapInstance(
        normalizeHeaderMap(reservationCache.headerMap || {}),
      ) || null;
    /** @type {Map<string, string[]>} */
    const lessonIdToReservationIds = new Map();

    // 2. lessonIdごとに予約IDをグループ化（キャンセル以外）
    for (const rawReservation of reservationCache.reservations) {
      if (!rawReservation) continue;

      /** @type {ReservationCore | null} */
      let reservation = null;
      if (Array.isArray(rawReservation)) {
        reservation = headerMap
          ? transformReservationArrayToObjectWithHeaders(
              rawReservation,
              headerMap,
              {},
            )
          : transformReservationArrayToObject(rawReservation);
      } else if (typeof rawReservation === 'object') {
        reservation = /** @type {ReservationCore} */ (rawReservation);
      }

      if (!reservation || !reservation.lessonId || !reservation.reservationId)
        continue;
      if (reservation.status === CONSTANTS.STATUS.CANCELED) continue;

      const lessonId = String(reservation.lessonId);
      const reservationId = String(reservation.reservationId);

      if (!lessonIdToReservationIds.has(lessonId)) {
        lessonIdToReservationIds.set(lessonId, []);
      }
      lessonIdToReservationIds.get(lessonId)?.push(reservationId);
    }

    Logger.log(
      `[syncReservationIdsToSchedule] ${lessonIdToReservationIds.size}件のレッスンに予約IDを再構築`,
    );

    // 3. 日程シートを更新
    const sheet = SS_MANAGER.getSheet(CONSTANTS.SHEET_NAMES.SCHEDULE);
    if (!sheet) {
      Logger.log('[syncReservationIdsToSchedule] 日程シートが見つかりません');
      return;
    }

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return;

    const headerRow = /** @type {string[]} */ (data[0]);
    const lessonIdCol = headerRow.indexOf(CONSTANTS.HEADERS.SCHEDULE.LESSON_ID);
    const reservationIdsCol = headerRow.indexOf(
      CONSTANTS.HEADERS.SCHEDULE.RESERVATION_IDS,
    );

    if (lessonIdCol === -1 || reservationIdsCol === -1) {
      Logger.log('[syncReservationIdsToSchedule] 必要な列が見つかりません');
      return;
    }

    let updatedCount = 0;
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const lessonId = String(row[lessonIdCol] || '');
      if (!lessonId) continue;

      const newReservationIds = lessonIdToReservationIds.get(lessonId) || [];
      const currentIdsStr = String(row[reservationIdsCol] || '[]');
      let currentIds = [];
      try {
        currentIds = JSON.parse(currentIdsStr);
        if (!Array.isArray(currentIds)) currentIds = [];
      } catch (_e) {
        currentIds = [];
      }

      // 差分がある場合のみ更新
      const newIdsStr = JSON.stringify(newReservationIds);
      const currentIdsSorted = [...currentIds].sort();
      const newIdsSorted = [...newReservationIds].sort();

      if (JSON.stringify(currentIdsSorted) !== JSON.stringify(newIdsSorted)) {
        sheet.getRange(i + 1, reservationIdsCol + 1).setValue(newIdsStr);
        updatedCount++;
      }
    }

    Logger.log(`[syncReservationIdsToSchedule] ${updatedCount}件の日程を更新`);

    // 4. 日程キャッシュも更新
    if (updatedCount > 0) {
      rebuildScheduleMasterCache();
      Logger.log(
        '[syncReservationIdsToSchedule] 日程キャッシュを再構築しました',
      );
    }

    Logger.log('[syncReservationIdsToSchedule] 完了');
  } catch (error) {
    Logger.log(`[syncReservationIdsToSchedule] エラー: ${error.message}`);
    // エラーが発生しても他のキャッシュ処理は続行
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
 * 日程マスタのステータスを自動更新（開催予定 → 開催済み）
 * 現在日時を基準に、過去の開催予定講座を開催済みに変更します。
 *
 * 判定基準:
 * - 日付が今日より前
 * - ステータスが「開催予定」
 *
 * @param {{ syncNotion?: boolean }} [options] - Notion同期設定
 * @returns {number} 更新した件数
 */
export function updateScheduleStatusToCompleted(options = {}) {
  try {
    const syncNotion = options?.syncNotion !== false;
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
    const dateColIndex = findHeaderIndexByCandidates(
      headers,
      SCHEDULE_DATE_HEADER_CANDIDATES,
    );
    const statusColIndex = findHeaderIndexByCandidates(
      headers,
      SCHEDULE_STATUS_HEADER_CANDIDATES,
    );
    const lessonIdColIndex = headers.indexOf(
      CONSTANTS.HEADERS.SCHEDULE.LESSON_ID,
    );

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
      const normalizedStatus = String(currentStatus || '').trim();

      // 開催予定のみを対象とする
      if (normalizedStatus !== CONSTANTS.SCHEDULE_STATUS.SCHEDULED) {
        continue;
      }

      // 日付チェック
      const parsedDate = _parseScheduleDateValue(scheduleDate);
      if (!parsedDate) {
        Logger.log(
          `[ScheduleStatus] 日付解析エラー: ${scheduleDate} (row=${i + 1})`,
        );
        continue;
      }
      const isDatePast = parsedDate < today;

      // 過去の日付の場合、開催済みに更新
      if (isDatePast) {
        sheet
          .getRange(i + 1, statusColIndex + 1)
          .setValue(CONSTANTS.SCHEDULE_STATUS.COMPLETED);
        row[statusColIndex] = CONSTANTS.SCHEDULE_STATUS.COMPLETED;
        updatedCount++;

        Logger.log(
          `[ScheduleStatus] 更新: ${scheduleDate} → ${CONSTANTS.SCHEDULE_STATUS.COMPLETED}`,
        );

        const lessonId = lessonIdColIndex >= 0 ? row[lessonIdColIndex] : null;
        if (lessonId && syncNotion) {
          try {
            const syncFn = /** @type {any} */ (globalThis).syncScheduleToNotion;
            if (typeof syncFn === 'function') {
              const scheduleValues = buildRowValuesMap(headers, row);
              syncFn(String(lessonId), 'update', {
                scheduleValues,
                skipSheetAccess: true,
              });
            }
          } catch (syncError) {
            Logger.log(
              `[ScheduleStatus] Notion日程同期エラー: ${syncError.message}`,
            );
          }
        }
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
 * 指定日の日程ステータスを開催済みに更新します。
 * 「教室完了 ⇢ 売上集計」実行時に、対象日のみ明示的に締めるために使用します。
 *
 * @param {string | Date} targetDate
 * @param {{ syncNotion?: boolean }} [options] - Notion同期設定
 * @returns {number} 更新した件数
 */
export function markScheduleStatusCompletedByDate(targetDate, options = {}) {
  try {
    const syncNotion = options?.syncNotion !== false;
    const parsedTargetDate = _parseScheduleDateValue(targetDate);
    if (!parsedTargetDate) {
      Logger.log(
        `[ScheduleStatusByDate] 対象日が不正です: ${String(targetDate || '')}`,
      );
      return 0;
    }

    const targetYmd = Utilities.formatDate(
      parsedTargetDate,
      CONSTANTS.TIMEZONE,
      'yyyy-MM-dd',
    );
    const sheet = SS_MANAGER.getSheet(CONSTANTS.SHEET_NAMES.SCHEDULE);
    if (!sheet) return 0;

    const allData = sheet.getDataRange().getValues();
    if (allData.length <= 1) return 0;

    const headers = allData[0];
    if (!Array.isArray(headers)) return 0;

    const dateColIndex = findHeaderIndexByCandidates(
      headers,
      SCHEDULE_DATE_HEADER_CANDIDATES,
    );
    const statusColIndex = findHeaderIndexByCandidates(
      headers,
      SCHEDULE_STATUS_HEADER_CANDIDATES,
    );
    const lessonIdColIndex = headers.indexOf(
      CONSTANTS.HEADERS.SCHEDULE.LESSON_ID,
    );

    if (dateColIndex === -1 || statusColIndex === -1) return 0;

    let updatedCount = 0;
    /** @type {string[]} */
    const updatedLessonIds = [];
    for (let i = 1; i < allData.length; i += 1) {
      const row = allData[i];
      const parsedDate = _parseScheduleDateValue(row[dateColIndex]);
      if (!parsedDate) continue;

      const rowYmd = Utilities.formatDate(
        parsedDate,
        CONSTANTS.TIMEZONE,
        'yyyy-MM-dd',
      );
      if (rowYmd !== targetYmd) continue;

      const currentStatus = String(row[statusColIndex] || '').trim();
      if (currentStatus !== CONSTANTS.SCHEDULE_STATUS.SCHEDULED) continue;

      sheet
        .getRange(i + 1, statusColIndex + 1)
        .setValue(CONSTANTS.SCHEDULE_STATUS.COMPLETED);
      row[statusColIndex] = CONSTANTS.SCHEDULE_STATUS.COMPLETED;
      updatedCount += 1;

      const lessonId = lessonIdColIndex >= 0 ? row[lessonIdColIndex] : null;
      if (lessonId) {
        updatedLessonIds.push(String(lessonId));
      }
      if (lessonId && syncNotion) {
        try {
          const syncFn = /** @type {any} */ (globalThis).syncScheduleToNotion;
          if (typeof syncFn === 'function') {
            const scheduleValues = buildRowValuesMap(headers, row);
            syncFn(String(lessonId), 'update', {
              scheduleValues,
              skipSheetAccess: true,
            });
          }
        } catch (syncError) {
          Logger.log(
            `[ScheduleStatusByDate] Notion日程同期エラー: ${syncError.message}`,
          );
        }
      }
    }

    if (updatedLessonIds.length > 0) {
      const cacheUpdatedCount = updateScheduleStatusInCacheByLessonIds(
        updatedLessonIds,
        CONSTANTS.SCHEDULE_STATUS.COMPLETED,
      );
      Logger.log(
        `[ScheduleStatusByDate] キャッシュ差分更新完了: ${cacheUpdatedCount}件`,
      );
    }

    Logger.log(
      `[ScheduleStatusByDate] ${targetYmd} の開催済み更新完了: ${updatedCount}件`,
    );
    return updatedCount;
  } catch (error) {
    Logger.log(`[ScheduleStatusByDate] エラー: ${error.message}`);
    return 0;
  }
}

/**
 * 日程シートの未設定状態を補完します。
 * 手編集で日程を追加したとき、状態=開催予定 / 売上転載状態=未転載 を自動で埋めます。
 *
 * @param {number[]} [targetRows=[]] - 補完対象の行番号（1始まり）。未指定時は全行。
 * @returns {number} 更新したセル数
 */
export function ensureScheduleStatusDefaults(targetRows = []) {
  try {
    const sheet = SS_MANAGER.getSheet(CONSTANTS.SHEET_NAMES.SCHEDULE);
    if (!sheet) return 0;

    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    if (lastRow <= 1 || lastColumn <= 0) return 0;

    const dataRange = sheet.getRange(1, 1, lastRow, lastColumn);
    const allValues = dataRange.getValues();
    const headerCandidate = allValues[0];
    if (!Array.isArray(headerCandidate)) return 0;
    const headers = /** @type {string[]} */ (headerCandidate);

    const dateColIndex = findHeaderIndexByCandidates(
      headers,
      SCHEDULE_DATE_HEADER_CANDIDATES,
    );
    const statusColIndex = findHeaderIndexByCandidates(
      headers,
      SCHEDULE_STATUS_HEADER_CANDIDATES,
    );
    const salesTransferStatusColIndex = findHeaderIndexByCandidates(
      headers,
      SCHEDULE_SALES_TRANSFER_STATUS_HEADER_CANDIDATES,
    );
    if (statusColIndex === -1) return 0;

    const normalizedRows = Array.isArray(targetRows)
      ? Array.from(
          new Set(
            targetRows
              .map(row => Number(row))
              .filter(
                row => Number.isFinite(row) && row >= 2 && row <= lastRow,
              ),
          ),
        )
      : [];

    /** @type {number[]} */
    const rowsToProcess =
      normalizedRows.length > 0
        ? normalizedRows
        : Array.from({ length: Math.max(lastRow - 1, 0) }, (_, i) => i + 2);

    let updatedCells = 0;
    let hasSheetUpdate = false;
    rowsToProcess.forEach(rowNumber => {
      const rowValues = allValues[rowNumber - 1];
      if (!Array.isArray(rowValues)) return;
      const hasDate = dateColIndex >= 0 ? rowValues[dateColIndex] !== '' : true;
      if (!hasDate) return;

      const currentStatus = String(rowValues[statusColIndex] || '').trim();
      if (!currentStatus) {
        rowValues[statusColIndex] = CONSTANTS.SCHEDULE_STATUS.SCHEDULED;
        updatedCells += 1;
        hasSheetUpdate = true;
      }

      if (salesTransferStatusColIndex >= 0) {
        const currentTransferStatus = String(
          rowValues[salesTransferStatusColIndex] || '',
        ).trim();
        if (!currentTransferStatus) {
          rowValues[salesTransferStatusColIndex] =
            CONSTANTS.ACCOUNTING_SYSTEM.SALES_TRANSFER_STATUS.PENDING;
          updatedCells += 1;
          hasSheetUpdate = true;
        }
      }
    });

    if (hasSheetUpdate) {
      dataRange.setValues(allValues);
      Logger.log(
        `[ensureScheduleStatusDefaults] 状態補完を実施: ${updatedCells}セル`,
      );
    }
    return updatedCells;
  } catch (error) {
    Logger.log(`[ensureScheduleStatusDefaults] エラー: ${error.message}`);
    return 0;
  }
}

/**
 * 日程のセル値を Date に変換します
 *
 * @param {any} value
 * @returns {Date | null}
 * @private
 */
function _parseScheduleDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value;

  if (typeof value === 'number' && Number.isFinite(value)) {
    // スプレッドシートのシリアル値を日付に変換
    const base = new Date(Date.UTC(1899, 11, 30));
    const millis = base.getTime() + value * 24 * 60 * 60 * 1000;
    const date = new Date(millis);
    if (!Number.isNaN(date.getTime())) return date;
  }

  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;

    const match = text.match(/(\d{4})[\\/.-](\d{1,2})[\\/.-](\d{1,2})/);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      if (
        Number.isFinite(year) &&
        Number.isFinite(month) &&
        Number.isFinite(day)
      ) {
        return new Date(year, month - 1, day);
      }
    }

    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
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
    rebuildAllStudentsCache();
    rebuildScheduleMasterCache(); // ステータス更新後にキャッシュも再構築
    rebuildAccountingMasterCache();

    // 3. 画像アップロードUI向けの参加者候補インデックスを更新（設定されている場合のみ）
    try {
      const pushResult = pushParticipantsIndexToWorker();
      if (!pushResult.success) {
        Logger.log(
          `参加者候補インデックス更新: 失敗/スキップ - ${pushResult.message || 'N/A'}`,
        );
      }
    } catch (pushError) {
      Logger.log(
        `参加者候補インデックス更新エラー: ${pushError.message || pushError}`,
      );
    }

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
// 画像アップロードUI向け: 参加者候補インデックス生成・配信
// =================================================================

/** ScriptProperties: 参加者候補インデックスの送信先URL */
const PROPS_KEY_UPLOAD_UI_PARTICIPANTS_INDEX_PUSH_URL =
  'UPLOAD_UI_PARTICIPANTS_INDEX_PUSH_URL';

/** ScriptProperties: 参加者候補インデックスの送信用トークン（Bearer） */
const PROPS_KEY_UPLOAD_UI_PARTICIPANTS_INDEX_PUSH_TOKEN =
  'UPLOAD_UI_PARTICIPANTS_INDEX_PUSH_TOKEN';

/** インデックスの対象期間（過去） */
const UPLOAD_UI_PARTICIPANTS_INDEX_PAST_DAYS = 730;

/** インデックスの対象期間（未来） */
const UPLOAD_UI_PARTICIPANTS_INDEX_FUTURE_DAYS = 60;

/**
 * 画像アップロードUI向けの参加者候補インデックスを生成します（副作用なし）
 * - 予約キャッシュ（CacheService）から生成
 * - 取消は除外
 * - `date -> [{ lesson_id, classroom, venue, participants[] }]` を返す
 *
 * @returns {{
 *   generated_at: string,
 *   timezone: string,
 *   source: { reservations_cache_version: number | null },
 *   dates: Record<string, Array<{ lesson_id: string, classroom: string, venue: string, participants: Array<{ student_id: string, display_name: string, session_note?: string }> }>>,
 * }}
 */
export function buildParticipantsIndexForUploadUi() {
  const now = new Date();
  const generatedAt = Utilities.formatDate(
    now,
    CONSTANTS.TIMEZONE,
    "yyyy-MM-dd'T'HH:mm:ssXXX",
  );

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const startDate = new Date(today);
  startDate.setDate(
    startDate.getDate() - UPLOAD_UI_PARTICIPANTS_INDEX_PAST_DAYS,
  );
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + UPLOAD_UI_PARTICIPANTS_INDEX_FUTURE_DAYS);

  const startYmd = Utilities.formatDate(
    startDate,
    CONSTANTS.TIMEZONE,
    'yyyy-MM-dd',
  );
  const endYmd = Utilities.formatDate(
    endDate,
    CONSTANTS.TIMEZONE,
    'yyyy-MM-dd',
  );

  const reservationCache = getReservationCacheSnapshot(false);
  const versionRaw = reservationCache?.version ?? null;
  const versionNum = Number(versionRaw);
  const reservationsCacheVersion = Number.isFinite(versionNum)
    ? versionNum
    : null;

  /** @type {Record<string, any[]>} */
  const datesObject = {};

  if (
    !reservationCache ||
    !Array.isArray(reservationCache.reservations) ||
    !reservationCache.headerMap
  ) {
    Logger.log(
      '参加者候補インデックス生成: 予約キャッシュが存在しないため空データで返します。',
    );
    return {
      generated_at: generatedAt,
      timezone: CONSTANTS.TIMEZONE,
      source: { reservations_cache_version: reservationsCacheVersion },
      dates: datesObject,
    };
  }

  const headerMap =
    toHeaderMapInstance(normalizeHeaderMap(reservationCache.headerMap || {})) ||
    null;
  const studentsCache = getStudentCacheSnapshot(false);
  /** @type {Record<string, UserCore>} */
  const studentsMap = studentsCache?.students || {};

  // lessonId未設定の予約（古いデータ等）でも、日程キャッシュの reservationIds から lessonId を補完する
  // （シートへはアクセスしない。キャッシュが無い場合は補完せずフォールバックキーでグルーピングする）
  /** @type {Map<string, {lessonId: string, classroom: string, venue: string}>} */
  const reservationIdToLessonMap = new Map();
  try {
    const scheduleCache = getTypedCachedData(
      CACHE_KEYS.MASTER_SCHEDULE_DATA,
      false,
    );
    const scheduleList = scheduleCache?.schedule;
    if (Array.isArray(scheduleList)) {
      scheduleList.forEach(lesson => {
        const lessonDate = _toTrimmedString(lesson?.date);
        if (lessonDate && (lessonDate < startYmd || lessonDate > endYmd)) {
          return;
        }

        const lessonId = _toTrimmedString(lesson?.lessonId);
        if (!lessonId) return;

        const lessonClassroom = _toTrimmedString(lesson?.classroom);
        const lessonVenue = _toTrimmedString(lesson?.venue);
        const reservationIds = Array.isArray(lesson?.reservationIds)
          ? lesson.reservationIds
          : [];

        reservationIds.forEach(reservationId => {
          const rid = _toTrimmedString(reservationId);
          if (!rid) return;
          if (reservationIdToLessonMap.has(rid)) return;
          reservationIdToLessonMap.set(rid, {
            lessonId,
            classroom: lessonClassroom,
            venue: lessonVenue,
          });
        });
      });
    }
  } catch (error) {
    Logger.log(
      `参加者候補インデックス生成: 日程キャッシュ参照でエラー - ${/** @type {Error} */ (error).message}`,
    );
  }

  /** @type {Map<string, Map<string, {lesson_id: string, classroom: string, venue: string, participantsMap: Map<string, {display_name: string, session_note: string}>}>>} */
  const byDate = new Map();

  reservationCache.reservations.forEach(row => {
    const reservation = Array.isArray(row)
      ? headerMap
        ? transformReservationArrayToObjectWithHeaders(
            row,
            headerMap,
            studentsMap,
          )
        : transformReservationArrayToObject(row)
      : /** @type {any} */ (row);
    if (!reservation) return;

    const date = _normalizeDateToYmd(reservation.date);
    if (!date) return;
    if (date < startYmd || date > endYmd) return;

    const status = _toTrimmedString(reservation.status);
    if (status === CONSTANTS.STATUS.CANCELED) return;

    const studentId = _toTrimmedString(reservation.studentId);
    if (!studentId) return;

    const student = studentsMap[studentId] || reservation.user || null;
    const nickname = _toTrimmedString(student?.nickname);
    const displayName =
      nickname || _toTrimmedString(student?.displayName || student?.realName);
    const sessionNote = _toTrimmedString(reservation.sessionNote);

    const reservationId = _toTrimmedString(reservation.reservationId);
    const rawLessonId = _toTrimmedString(reservation.lessonId);
    const mappedLesson =
      !rawLessonId && reservationId
        ? reservationIdToLessonMap.get(reservationId)
        : null;
    const lessonId = rawLessonId || mappedLesson?.lessonId || '';

    const classroom = _toTrimmedString(
      mappedLesson?.classroom || reservation.classroom,
    );
    const venue = _toTrimmedString(mappedLesson?.venue || reservation.venue);
    const startTime = _toTrimmedString(reservation.startTime);
    const endTime = _toTrimmedString(reservation.endTime);

    // lessonIdが無い場合は、時間帯もキーに含めて混在を避ける
    let groupKey = lessonId;
    if (!groupKey) {
      groupKey = `${date}__${classroom}__${venue}__${startTime || 'NA'}__${endTime || 'NA'}`;
      // 時刻も欠ける場合はreservationIdも含め、誤混在より「分かれすぎ」を優先する
      if (!startTime && !endTime && reservationId) {
        groupKey = `${groupKey}__${reservationId}`;
      }
    }

    let groupsByKey = byDate.get(date);
    if (!groupsByKey) {
      groupsByKey = new Map();
      byDate.set(date, groupsByKey);
    }

    let group = groupsByKey.get(groupKey);
    if (!group) {
      group = {
        lesson_id: lessonId || groupKey,
        classroom,
        venue,
        participantsMap: new Map(),
      };
      groupsByKey.set(groupKey, group);
    }

    // 同一生徒の重複を排除しつつ、display_name / session_note を補完・統合する
    const existingParticipant = group.participantsMap.get(studentId) || {
      display_name: '',
      session_note: '',
    };

    // display_name は最初に取得できた値を維持し、空値のみ補完する
    // （ニックネームが本名や別表記で上書きされることを防ぐ）
    const preferredDisplayName =
      existingParticipant.display_name || displayName;
    // 複数ノートが混在した場合は情報量が多い方（長い方）を優先
    const preferredSessionNote = _preferLongerString(
      existingParticipant.session_note,
      sessionNote,
    );

    group.participantsMap.set(studentId, {
      display_name: preferredDisplayName,
      session_note: preferredSessionNote,
    });
  });

  // 日付順に安定化して出力
  const sortedDates = Array.from(byDate.keys()).sort();
  sortedDates.forEach(date => {
    const groupsByKey = byDate.get(date);
    if (!groupsByKey) return;

    const groups = Array.from(groupsByKey.values()).map(group => {
      const participants = Array.from(group.participantsMap.entries()).map(
        ([studentId, participant]) => ({
          student_id: studentId,
          display_name: participant.display_name || '',
          ...(participant.session_note && {
            session_note: participant.session_note,
          }),
        }),
      );

      participants.sort((a, b) => {
        const nameCompare = a.display_name.localeCompare(b.display_name, 'ja');
        if (nameCompare !== 0) return nameCompare;
        return a.student_id.localeCompare(b.student_id, 'ja');
      });

      return {
        lesson_id: group.lesson_id,
        classroom: group.classroom,
        venue: group.venue,
        participants,
      };
    });

    groups.sort((a, b) => {
      const classroomCompare = a.classroom.localeCompare(b.classroom, 'ja');
      if (classroomCompare !== 0) return classroomCompare;
      const venueCompare = a.venue.localeCompare(b.venue, 'ja');
      if (venueCompare !== 0) return venueCompare;
      return a.lesson_id.localeCompare(b.lesson_id, 'ja');
    });

    datesObject[date] = groups;
  });

  return {
    generated_at: generatedAt,
    timezone: CONSTANTS.TIMEZONE,
    source: { reservations_cache_version: reservationsCacheVersion },
    dates: datesObject,
  };
}

/**
 * 画像アップロードUI向け参加者候補インデックスをCloudflare Workerへ送信します
 *
 * ScriptProperties:
 * - UPLOAD_UI_PARTICIPANTS_INDEX_PUSH_URL
 * - UPLOAD_UI_PARTICIPANTS_INDEX_PUSH_TOKEN
 *
 * @returns {{success: boolean, message: string, statusCode?: number, durationMs?: number, bytes?: number, datesCount?: number, groupsCount?: number, participantsCount?: number}}
 */
export function pushParticipantsIndexToWorker() {
  const startMs = Date.now();

  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty(
    PROPS_KEY_UPLOAD_UI_PARTICIPANTS_INDEX_PUSH_URL,
  );
  const token = props.getProperty(
    PROPS_KEY_UPLOAD_UI_PARTICIPANTS_INDEX_PUSH_TOKEN,
  );

  if (!url || !token) {
    const missing = [
      !url ? PROPS_KEY_UPLOAD_UI_PARTICIPANTS_INDEX_PUSH_URL : null,
      !token ? PROPS_KEY_UPLOAD_UI_PARTICIPANTS_INDEX_PUSH_TOKEN : null,
    ]
      .filter(Boolean)
      .join(', ');
    return {
      success: false,
      message: `設定が未完了のためスキップしました: ${missing}`,
    };
  }

  const index = buildParticipantsIndexForUploadUi();
  const reservationsCacheVersion = index?.source?.reservations_cache_version;
  if (
    reservationsCacheVersion === null ||
    reservationsCacheVersion === undefined
  ) {
    Logger.log(
      '参加者候補インデックス送信スキップ: 予約キャッシュが未構築の可能性があります。',
    );
    return {
      success: false,
      message: '予約キャッシュが未構築のためスキップしました',
    };
  }
  const payloadJson = JSON.stringify(index);
  const bytes = Utilities.newBlob(payloadJson).getBytes().length;

  const dates = index?.dates || {};
  const datesCount = Object.keys(dates).length;
  const { groupsCount, participantsCount } = Object.values(dates).reduce(
    (counts, groups) => {
      if (Array.isArray(groups)) {
        counts.groupsCount += groups.length;
        counts.participantsCount += groups.reduce(
          (pCount, group) =>
            pCount +
            (Array.isArray(group?.participants)
              ? group.participants.length
              : 0),
          0,
        );
      }
      return counts;
    },
    { groupsCount: 0, participantsCount: 0 },
  );

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: payloadJson,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    muteHttpExceptions: true,
    followRedirects: true,
  });

  const statusCode = response.getResponseCode();
  const ok = statusCode >= 200 && statusCode < 300;
  const durationMs = Date.now() - startMs;

  const baseResult = {
    statusCode,
    durationMs,
    bytes,
    datesCount,
    groupsCount,
    participantsCount,
  };

  if (ok) {
    Logger.log(
      `参加者候補インデックス送信成功: status=${statusCode}, bytes=${bytes}, dates=${datesCount}, groups=${groupsCount}, participants=${participantsCount}, durationMs=${durationMs}`,
    );
    return {
      ...baseResult,
      success: true,
      message: '送信しました',
    };
  }

  const responseText = response.getContentText() || '';
  const preview =
    responseText.length > 400
      ? `${responseText.slice(0, 400)}...`
      : responseText;
  Logger.log(
    `参加者候補インデックス送信失敗: status=${statusCode}, bytes=${bytes}, durationMs=${durationMs}, response=${preview}`,
  );
  return {
    ...baseResult,
    success: false,
    message: `送信に失敗しました: status=${statusCode}`,
  };
}

/**
 * 値をトリムした文字列へ正規化します
 *
 * @param {any} value
 * @returns {string}
 * @private
 */
function _toTrimmedString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * 既存値と新規値を比較して、空値補完 + 長い文字列優先で統合します
 *
 * @param {any} existing
 * @param {any} next
 * @returns {string}
 * @private
 */
function _preferLongerString(existing, next) {
  const current = _toTrimmedString(existing);
  const incoming = _toTrimmedString(next);

  if (!current) {
    return incoming;
  }

  if (incoming && incoming !== current) {
    return incoming.length >= current.length ? incoming : current;
  }

  return current;
}

/**
 * "YYYY-MM-DD" 形式に正規化します
 *
 * @param {any} value
 * @returns {string}
 * @private
 */
function _normalizeDateToYmd(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return Utilities.formatDate(value, CONSTANTS.TIMEZONE, 'yyyy-MM-dd');
  }

  const text = _toTrimmedString(value);
  if (!text) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  try {
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return '';
    return Utilities.formatDate(parsed, CONSTANTS.TIMEZONE, 'yyyy-MM-dd');
  } catch (_error) {
    return '';
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
  ALL_STUDENTS: 'all_students', // 生徒名簿の全情報
  MASTER_SCHEDULE_DATA: 'master_schedule_data',
  MASTER_ACCOUNTING_DATA: 'master_accounting_data',
});

/**
 * @typedef {typeof CACHE_KEYS[keyof typeof CACHE_KEYS]} CacheKey
 */

/**
 * @template {CacheKey} K
 * @typedef {K extends 'all_reservations' ? ReservationCacheData :
 *           K extends 'all_students' ? StudentCacheData :
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
          case CACHE_KEYS.ALL_STUDENTS:
            rebuildAllStudentsCache();
            break;
          case CACHE_KEYS.ALL_STUDENTS:
            rebuildAllStudentsCache();
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
 * UTF-8バイト長を取得
 * @param {unknown} value
 * @returns {number}
 */
function getUtf8ByteLength(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (!text) return 0;
  try {
    return Utilities.newBlob(text).getBytes().length;
  } catch {
    // フォールバック（GAS実行時は通常ここに来ない）
    return text.length;
  }
}

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
  const maxSizeBytes = maxSizeKB * 1024;

  // アイテムあたりの平均サイズを推定（全データの10%をサンプル）
  const sampleSize = Math.min(Math.ceil(data.length * 0.1), 50);
  const sampleItems = data.slice(0, sampleSize);
  const sampleTotalSizeBytes = getUtf8ByteLength(sampleItems);
  const avgItemSizeBytes = sampleTotalSizeBytes / Math.max(1, sampleSize);
  const estimatedItemsPerChunk = Math.max(
    1,
    Math.floor((maxSizeBytes / Math.max(1, avgItemSizeBytes)) * 0.8),
  ); // 80%の余裕を持つ

  Logger.log(
    `データ分割: 平均アイテムサイズ=${Math.round(
      avgItemSizeBytes,
    )}bytes, チャンクあたり推定=${estimatedItemsPerChunk}件`,
  );

  for (let i = 0; i < data.length; i += estimatedItemsPerChunk) {
    const initialChunkData = data.slice(i, i + estimatedItemsPerChunk);
    /** @type {Array<(string|number|Date)[][]|StudentData[]>} */
    const pending = [initialChunkData];

    while (pending.length > 0) {
      const chunkData = pending.pop();
      if (!chunkData || chunkData.length === 0) continue;

      const chunkSizeBytes = getUtf8ByteLength(chunkData);
      const chunkSizeKB = Math.round(chunkSizeBytes / 1024);

      if (chunkSizeBytes <= maxSizeBytes || chunkData.length === 1) {
        chunks.push(chunkData);
        Logger.log(
          `チャンク${chunks.length - 1}: ${chunkData.length}件, ${chunkSizeKB}KB`,
        );
        continue;
      }

      const halfSize = Math.floor(chunkData.length / 2);
      if (halfSize <= 0) {
        chunks.push(chunkData);
        Logger.log(
          `⚠️ チャンク${chunks.length - 1}をサイズ超過のまま保存候補に追加: ${chunkData.length}件, ${chunkSizeKB}KB`,
        );
        continue;
      }

      const firstHalf = chunkData.slice(0, halfSize);
      const secondHalf = chunkData.slice(halfSize);
      // LIFOのため逆順で積み、元の順序を維持する
      pending.push(secondHalf);
      pending.push(firstHalf);
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
    /** @type {Record<string, any>} */
    const metadataToSave = { ...metaData };
    // reservationIdIndexMapはサイズが大きいため、分割キャッシュ時は再構築に委ねる
    if (
      baseKey === CACHE_KEYS.ALL_RESERVATIONS &&
      metadataToSave['reservationIdIndexMap']
    ) {
      delete metadataToSave['reservationIdIndexMap'];
    }

    const metaJson = JSON.stringify(metadataToSave);
    const metaSizeBytes = getUtf8ByteLength(metaJson);
    const cachePutLimitBytes = 95 * 1024;
    if (metaSizeBytes > cachePutLimitBytes) {
      Logger.log(
        `⚠️ メタデータが大きすぎるため保存できません: ${Math.round(metaSizeBytes / 1024)}KB`,
      );
      return false;
    }
    cache.put(metaCacheKey, metaJson, expiry);

    // 各チャンクを保存
    for (let i = 0; i < dataChunks.length; i++) {
      const chunkKey = `${baseKey}_chunk_${i}`;
      const chunkData = {
        chunkIndex: i,
        data: dataChunks[i],
        version: metaData.version,
      };

      const chunkJson = JSON.stringify(chunkData);
      const chunkSizeBytes = getUtf8ByteLength(chunkJson);
      const chunkSizeKB = Math.round(chunkSizeBytes / 1024);

      if (chunkSizeBytes > cachePutLimitBytes) {
        Logger.log(`⚠️ チャンク${i}が大きすぎます: ${chunkSizeKB}KB`);
        return false;
      }

      cache.put(chunkKey, chunkJson, expiry);
      Logger.log(
        `チャンク${i}を保存しました: ${chunkSizeKB}KB, ${dataChunks[i].length}件`,
      );
    }

    setCacheVersion(baseKey, metaData.version, expiry);
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

    if (baseKey === CACHE_KEYS.ALL_STUDENTS) {
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
      // よやくデータなど他のキャッシュの場合
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
    removeCacheVersion(baseKey);
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
  const cache = getTypedCachedData(CACHE_KEYS.ALL_STUDENTS, autoRebuild);
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
    CACHE_KEYS.ALL_STUDENTS,
    /* autoRebuild */ false,
  );

  if (!cache || !cache.students) {
    Logger.log(
      'updateCachedStudent: 生徒キャッシュが存在しないため再構築を実行します',
    );
    rebuildAllStudentsCache();
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
    CACHE_KEYS.ALL_STUDENTS,
    /* autoRebuild */ false,
  );

  if (!cache || !cache.students) {
    Logger.log(
      'addCachedStudent: 生徒キャッシュが存在しないため再構築を実行します',
    );
    rebuildAllStudentsCache();
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
  removeCacheVersion(cacheKey);
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
    case CACHE_KEYS.ALL_STUDENTS:
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
  const sizeKB = Math.round(getUtf8ByteLength(serialized) / 1024);

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
      CACHE_KEYS.ALL_STUDENTS,
      chunks,
      chunkMetadata,
    );

    if (!success) {
      Logger.log(
        'persistStudentCache: 分割キャッシュの保存に失敗しました。再構築を実行します。',
      );
      rebuildAllStudentsCache();
    } else {
      cache.remove(CACHE_KEYS.ALL_STUDENTS);
      invalidateStudentCacheSnapshot();
    }
    return;
  }

  clearChunkedCache(CACHE_KEYS.ALL_STUDENTS);
  cache.put(
    CACHE_KEYS.ALL_STUDENTS,
    serialized,
    CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
  );
  setCacheVersion(
    CACHE_KEYS.ALL_STUDENTS,
    baseData.version,
    CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
  );
  invalidateStudentCacheSnapshot();
}

/**
 * よやくキャッシュのインメモリスナップショットを無効化する
 */
export function invalidateReservationCacheSnapshot() {
  reservationCacheState.version = null;
  reservationCacheState.cache = null;
}

/**
 * 生徒キャッシュのインメモリスナップショットを無効化する
 */
export function invalidateStudentCacheSnapshot() {
  studentCacheState.version = null;
  studentCacheState.cache = null;
}

/**
 * よやくキャッシュのスナップショットを取得（実行中はインメモリ再利用）
 * @param {boolean} [autoRebuild=true] - キャッシュ未存在時に再構築を許可するか
 * @returns {ReservationCacheData | null}
 */
export function getReservationCacheSnapshot(autoRebuild = true) {
  if (reservationCacheState.cache) {
    const currentVersion = getCacheVersion(CACHE_KEYS.ALL_RESERVATIONS);
    if (
      currentVersion &&
      String(currentVersion) === String(reservationCacheState.version || '')
    ) {
      return reservationCacheState.cache;
    }
  }

  invalidateReservationCacheSnapshot();
  const cache = getTypedCachedData(CACHE_KEYS.ALL_RESERVATIONS, autoRebuild);
  if (cache) {
    reservationCacheState.cache = cache;
    reservationCacheState.version =
      typeof cache.version === 'number' || typeof cache.version === 'string'
        ? cache.version
        : null;
  }
  return cache;
}

/**
 * 生徒キャッシュのスナップショットを取得（実行中はインメモリ再利用）
 * @param {boolean} [autoRebuild=true] - キャッシュ未存在時に再構築を許可するか
 * @returns {StudentCacheData | null}
 */
export function getStudentCacheSnapshot(autoRebuild = true) {
  if (studentCacheState.cache) {
    const currentVersion = getCacheVersion(CACHE_KEYS.ALL_STUDENTS);
    if (
      currentVersion &&
      String(currentVersion) === String(studentCacheState.version || '')
    ) {
      return studentCacheState.cache;
    }
  }

  invalidateStudentCacheSnapshot();
  const cache = getTypedCachedData(CACHE_KEYS.ALL_STUDENTS, autoRebuild);
  if (cache) {
    studentCacheState.cache = cache;
    studentCacheState.version =
      typeof cache.version === 'number' || typeof cache.version === 'string'
        ? cache.version
        : null;
  }
  return cache;
}

/**
 * 予約IDを指定して、キャッシュから単一のよやくデータを取得する
 * @param {string} reservationId - 取得するよやくのID
 * @returns {RawSheetRow | null} よやくデータ配列、見つからない場合はnull
 */
export function getReservationByIdFromCache(reservationId) {
  if (!reservationId) return null;

  let cache = getReservationCacheSnapshot(false); // autoRebuildはfalseで良い
  if (!cache || !cache.reservations || !cache.reservationIdIndexMap) {
    // フォールバック: キャッシュを再構築（以前の挙動と同等）
    cache = getReservationCacheSnapshot(true);
  }
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

  /** @type {ScheduleCacheData | null} */
  let scheduleCache = getTypedCachedData(
    CACHE_KEYS.MASTER_SCHEDULE_DATA,
    false,
  );

  if (!scheduleCache || !Array.isArray(scheduleCache.schedule)) {
    scheduleCache = getTypedCachedData(CACHE_KEYS.MASTER_SCHEDULE_DATA);
    if (!scheduleCache || !Array.isArray(scheduleCache.schedule)) {
      return null;
    }
  }

  const cacheVersion =
    scheduleCache.version ||
    scheduleCache?.dateRange?.cached ||
    `${scheduleCache.schedule.length}-${Date.now()}`;

  if (lessonIdCacheState.version !== cacheVersion) {
    const indexMap = new Map();
    for (const lesson of scheduleCache.schedule) {
      if (lesson && lesson.lessonId) {
        indexMap.set(String(lesson.lessonId), lesson);
      }
    }
    lessonIdCacheState.map = indexMap;
    lessonIdCacheState.version = cacheVersion;
  }

  return lessonIdCacheState.map.get(String(lessonId)) || null;
}

/**
 * 複数の予約IDからよやくオブジェクトを一括取得
 *
 * @param {string[]} reservationIds - 取得対象の予約IDの配列
 * @param {{ includeStudents?: boolean }=} options - 付加情報取得の挙動を制御するオプション
 * @returns {ReservationCore[]} よやくオブジェクトの配列（見つからないIDはスキップ）
 *
 * @example
 * const reservations = getReservationsByIdsFromCache(['R-001', 'R-002', 'R-003']);
 * console.log(`取得したよやく数: ${reservations.length}`);
 */
export function getReservationsByIdsFromCache(reservationIds, options = {}) {
  if (!Array.isArray(reservationIds) || reservationIds.length === 0) {
    return [];
  }

  const includeStudents =
    Object.prototype.hasOwnProperty.call(options, 'includeStudents') &&
    options.includeStudents === false
      ? false
      : true;

  let cache = getReservationCacheSnapshot(false);
  if (!cache || !cache.reservations || !cache.reservationIdIndexMap) {
    // フォールバック: 自動再構築を許可した取得を実行
    cache = getReservationCacheSnapshot(true);
  }
  if (!cache || !cache.reservations || !cache.reservationIdIndexMap) {
    // それでも取得できない場合は旧処理と同様に全件から抽出する
    const allReservations = getCachedReservationsAsObjects();
    if (!allReservations.length) {
      return [];
    }
    const reservationIdSet = new Set(reservationIds.map(id => String(id)));
    return allReservations.filter(reservation =>
      reservationIdSet.has(String(reservation.reservationId)),
    );
  }

  const headerMap =
    toHeaderMapInstance(normalizeHeaderMap(cache.headerMap || {})) || null;
  /** @type {Record<string, UserCore>} */
  let studentsMap = {};
  if (includeStudents) {
    const studentsCache = getStudentCacheSnapshot(false);
    studentsMap = studentsCache?.students || {};
  }

  /** @type {ReservationCore[]} */
  const reservations = [];
  for (const id of reservationIds) {
    if (!id) continue; // 空文字やnullをスキップ

    const index = cache.reservationIdIndexMap[id];
    if (index === undefined) continue;

    const rawReservation = cache.reservations[index];
    if (!rawReservation) continue;

    if (Array.isArray(rawReservation)) {
      const converted = headerMap
        ? transformReservationArrayToObjectWithHeaders(
            rawReservation,
            headerMap,
            studentsMap,
          )
        : transformReservationArrayToObject(rawReservation);
      if (converted) {
        reservations.push(converted);
      }
    } else if (typeof rawReservation === 'object') {
      reservations.push(/** @type {ReservationCore} */ (rawReservation));
    }
  }

  return reservations;
}

/**
 * 日程キャッシュを書き戻し、lessonIdインデックスを無効化します。
 * @param {ScheduleCacheData} scheduleCache
 */
function persistUpdatedScheduleCache(scheduleCache) {
  CacheService.getScriptCache().put(
    CACHE_KEYS.MASTER_SCHEDULE_DATA,
    JSON.stringify(scheduleCache),
    CONSTANTS.SYSTEM.CACHE_EXPIRY_SECONDS,
  );

  // lessonIdインデックスを再構築させるためバージョンをリセット
  lessonIdCacheState.version = null;
  lessonIdCacheState.map = new Map();
}

/**
 * 日程キャッシュ内の特定レッスンの状態を差分更新します。
 *
 * @param {string[]} lessonIds - 更新対象のレッスンID配列
 * @param {string} nextStatus - 次状態
 * @returns {number} 更新した件数
 */
export function updateScheduleStatusInCacheByLessonIds(lessonIds, nextStatus) {
  if (!Array.isArray(lessonIds) || lessonIds.length === 0) {
    return 0;
  }

  const normalizedStatus = String(nextStatus || '').trim();
  if (!normalizedStatus) {
    return 0;
  }

  try {
    /** @type {ScheduleCacheData | null} */
    const scheduleCache = getTypedCachedData(
      CACHE_KEYS.MASTER_SCHEDULE_DATA,
      false,
    );
    if (!scheduleCache || !Array.isArray(scheduleCache.schedule)) {
      return 0;
    }

    const lessonIdSet = new Set(
      lessonIds.map(id => String(id || '')).filter(id => id !== ''),
    );
    if (lessonIdSet.size === 0) return 0;

    let updatedCount = 0;
    scheduleCache.schedule.forEach(lesson => {
      if (!lesson) return;
      const lessonId = String(lesson.lessonId || '');
      if (!lessonIdSet.has(lessonId)) return;

      const currentStatus = String(lesson.status || '').trim();
      if (currentStatus === normalizedStatus) return;

      lesson.status = normalizedStatus;
      updatedCount += 1;
    });

    if (updatedCount <= 0) return 0;

    const updatedCache = {
      ...scheduleCache,
      schedule: scheduleCache.schedule,
      version: new Date().getTime(),
    };
    persistUpdatedScheduleCache(updatedCache);
    return updatedCount;
  } catch (error) {
    Logger.log(
      `updateScheduleStatusInCacheByLessonIds Error: ${error.message}`,
    );
    return 0;
  }
}

/**
 * 日程キャッシュ内の売上転載状態を差分更新します。
 *
 * @param {Map<string, { status: string; transferredAt: string }>} lessonTransferStatusMap
 * @returns {number} 更新した件数
 */
export function updateScheduleSalesTransferStatusInCache(
  lessonTransferStatusMap,
) {
  if (
    !lessonTransferStatusMap ||
    !(lessonTransferStatusMap instanceof Map) ||
    lessonTransferStatusMap.size === 0
  ) {
    return 0;
  }

  try {
    /** @type {ScheduleCacheData | null} */
    const scheduleCache = getTypedCachedData(
      CACHE_KEYS.MASTER_SCHEDULE_DATA,
      false,
    );
    if (!scheduleCache || !Array.isArray(scheduleCache.schedule)) {
      return 0;
    }

    let updatedCount = 0;
    scheduleCache.schedule.forEach(lesson => {
      if (!lesson) return;
      const lessonId = String(lesson.lessonId || '');
      if (!lessonId) return;

      const transferState = lessonTransferStatusMap.get(lessonId);
      if (!transferState) return;

      const nextStatus = String(transferState.status || '').trim();
      const nextTransferredAt = String(
        transferState.transferredAt || '',
      ).trim();
      const currentStatus = String(lesson['salesTransferStatus'] || '').trim();
      const currentTransferredAt = String(
        lesson['salesTransferredAt'] || '',
      ).trim();

      if (
        currentStatus === nextStatus &&
        currentTransferredAt === nextTransferredAt
      ) {
        return;
      }

      lesson['salesTransferStatus'] = nextStatus;
      lesson['salesTransferredAt'] = nextTransferredAt;
      updatedCount += 1;
    });

    if (updatedCount <= 0) return 0;

    const updatedCache = {
      ...scheduleCache,
      schedule: scheduleCache.schedule,
      version: new Date().getTime(),
    };
    persistUpdatedScheduleCache(updatedCache);
    return updatedCount;
  } catch (error) {
    Logger.log(
      `updateScheduleSalesTransferStatusInCache Error: ${error.message}`,
    );
    return 0;
  }
}

/**
 * 日程キャッシュ内の特定レッスンの予約ID配列を最新化する
 * @param {string} lessonId - レッスンID
 * @param {string[]} reservationIds - 最新の予約ID配列
 */
export function updateLessonReservationIdsInCache(lessonId, reservationIds) {
  if (!lessonId || !Array.isArray(reservationIds)) {
    return;
  }

  try {
    /** @type {ScheduleCacheData | null} */
    const scheduleCache = getTypedCachedData(
      CACHE_KEYS.MASTER_SCHEDULE_DATA,
      false,
    );
    if (!scheduleCache || !Array.isArray(scheduleCache.schedule)) {
      return;
    }

    const targetLesson = scheduleCache.schedule.find(
      lesson => lesson && String(lesson.lessonId) === String(lessonId),
    );
    if (!targetLesson) {
      return;
    }

    targetLesson.reservationIds = reservationIds.map(id => String(id));

    const updatedCache = {
      ...scheduleCache,
      schedule: scheduleCache.schedule,
      version: new Date().getTime(),
    };
    persistUpdatedScheduleCache(updatedCache);
  } catch (error) {
    Logger.log(`updateLessonReservationIdsInCache Error: ${error.message}`);
  }
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
