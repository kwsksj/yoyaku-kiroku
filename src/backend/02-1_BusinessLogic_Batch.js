/**
 * =================================================================
 * 【ファイル名】  : 02-1_BusinessLogic_Batch.gs
 * 【モジュール種別】: バックエンド（GAS）
 * 【役割】        : 管理メニューから手動実行される重いバッチ処理（アーカイブ・集計）をまとめる。
 *
 * 【主な責務】
 *   - 予約記録のアーカイブ転送や売上ログの再集計など、定期実行では重過ぎる処理を提供
 *   - テスト環境構築や各種ベースデータ初期化のユーティリティ関数を提供
 *   - エラー時は `handleError` を通じて統一ログに記録
 *
 * 【関連モジュール】
 *   - `08_Utilities.js`: エラーハンドリング・共通処理で連携
 *   - `07_CacheManager.js`: バッチ後にキャッシュ整合性を保つための再構築を呼び出すケースがある
 *   - `05-2_Backend_Write.js`: アーカイブ対象のよやくデータフォーマットを共有
 *
 * 【利用時の留意点】
 *   - 本番環境での実行は手動確認が必要。データ破壊的操作が含まれるため十分にバックアップを取る
 *   - UI からの操作では進捗トーストを表示するが、長時間バッチの場合はログも併用する
 *   - 処理を分割したい場合は個別関数化してメニューから呼び出せるようにする
 * =================================================================
 */

// ================================================================
// 依存モジュール
// ================================================================
import { SS_MANAGER } from './00_SpreadsheetManager.js';
import { sendAdminNotification } from './02-6_Notification_Admin.js';
import { logSalesForSingleReservation } from './05-2_Backend_Write.js';
import {
  rebuildAllReservationsCache,
  rebuildAllStudentsCache,
  rebuildScheduleMasterCache,
  syncReservationIdsToSchedule,
  updateScheduleStatusToCompleted,
} from './07_CacheManager.js';
import {
  convertReservationToRow,
  convertUserToRow,
  getCachedReservationsAsObjects,
  getSheetData,
  handleError,
  logActivity,
  sortReservationRows,
} from './08_Utilities.js';

/**
 * 旧データ取り込み時の列指定で許可する型
 * - 文字列: 列名
 * - 数値: 0始まり列番号
 * - 配列: 候補列（優先順）
 * @typedef {string | number | ReadonlyArray<string | number>} LegacyFieldToken
 */

/**
 * 旧データ取り込み時のマッピング指定型
 * @typedef {LegacyFieldToken | ReadonlyArray<LegacyFieldToken>} LegacyFieldMappingSpec
 */

/**
 * 旧フォーマット取り込み結果
 * @typedef {{
 *   success: boolean;
 *   dryRun: boolean;
 *   processed: number;
 *   imported: number;
 *   skipped: number;
 *   errorCount: number;
 *   warnings: string[];
 *   errorMessages: string[];
 *   preview: Array<Record<string, unknown>>;
 *   resolvedFieldMap: Record<string, number | undefined>;
 *   supplementalApplicationEntryCount: number;
 *   createdStudentCount: number;
 *   createdStudentsPreview: Array<Record<string, unknown>>;
 * }} LegacyImportResult
 */

/**
 * 旧フォーマット取り込み時の自動ヘッダー推定候補
 * @type {Record<string, string[]>}
 */
const LEGACY_IMPORT_AUTO_HEADER_CANDIDATES = {
  reservationId: ['予約ID', 'reservationId', 'id', '予約番号'],
  lessonId: ['レッスンID', 'lessonId', 'scheduleId'],
  studentId: ['生徒ID', 'studentId', 'userId', '会員ID', '顧客ID'],
  studentName: ['名前', '氏名', 'お名前', 'name', 'ニックネーム', '受講者名'],
  date: ['日付', 'date', '予約日', 'lessonDate'],
  classroom: ['教室', 'classroom', 'class', '教室名'],
  venue: ['会場', 'venue', 'location'],
  startTime: ['開始時刻', 'startTime', '開始', '開始時間'],
  endTime: ['終了時刻', 'endTime', '終了', '終了時間'],
  status: ['ステータス', 'status', '状態'],
  chiselRental: ['彫刻刀レンタル', 'chiselRental', 'rental', 'レンタル'],
  firstLecture: ['初回', 'firstLecture', 'beginner', '初回講習'],
  transportation: ['来場手段', 'transportation', '交通手段'],
  pickup: ['送迎', 'pickup'],
  sessionNote: ['セッションノート', 'sessionNote', '制作メモ', 'memo'],
  order: ['order', '注文', '注文情報'],
  messageToTeacher: [
    'メッセージ',
    'messageToTeacher',
    '先生へのメッセージ',
    'message',
  ],
  accountingDetails: ['会計詳細', 'accountingDetails', 'accounting'],
};

/**
 * 旧つくば予約表（マトリクス）取り込みの既定設定
 * 必要に応じて sheetNames を追加してください。
 */
/**
 * スクリプトプロパティからレガシーインポート設定を取得する（未設定時はフォールバック値を返す）
 * @param {string} key - プロパティキー
 * @param {string} fallback - フォールバック値
 * @returns {string}
 */
function _getLegacyImportProperty(key, fallback) {
  try {
    const value = PropertiesService.getScriptProperties().getProperty(key);
    return value || fallback;
  } catch {
    return fallback;
  }
}

const TSUKUBA_LEGACY_GRID_IMPORT_DEFAULTS = Object.freeze({
  /** スクリプトプロパティ LEGACY_TSUKUBA_GRID_SPREADSHEET_ID で上書き可能 */
  get sourceSpreadsheetId() {
    return _getLegacyImportProperty(
      'LEGACY_TSUKUBA_GRID_SPREADSHEET_ID',
      '1frQ9oWzpxudi_u5n7UTQ6ZEwvXD4nbTr-bwyiW8Affo',
    );
  },
  sourceSheetNames: ['最新', '202409〜', '2024年', '2023年10〜12月'],
  defaultClassroom: CONSTANTS.CLASSROOMS.TSUKUBA,
  defaultStatus: CONSTANTS.STATUS.COMPLETED,
});

/**
 * 旧つくばCSV取り込みの既定設定
 */
const TSUKUBA_LEGACY_CSV_IMPORT_DEFAULTS = Object.freeze({
  sourceSpreadsheetId: '',
  sourceSheetNameCandidates: [
    'legacy-reservations-from2023_10_21-to2025_02_16つくば教室',
    'legacy-reservations-from2023_10_21-to2025_02_16つくば教室',
    'legacy-reservations-from2023_10_21-to2025_02_16つくば教室.csv',
    'legacy-reservations-from2023_10_21-to2025_02_16つくば教室.csv',
  ],
  defaultClassroom: CONSTANTS.CLASSROOMS.TSUKUBA,
  defaultStatus: CONSTANTS.STATUS.COMPLETED,
  defaultScheduleClassroomType: CONSTANTS.CLASSROOM_TYPES.TIME_FULL,
  defaultScheduleStatus: CONSTANTS.SCHEDULE_STATUS.COMPLETED,
  /** スクリプトプロパティ LEGACY_TSUKUBA_CSV_APP_SPREADSHEET_ID で上書き可能 */
  get matchingApplicationSpreadsheetId() {
    return _getLegacyImportProperty(
      'LEGACY_TSUKUBA_CSV_APP_SPREADSHEET_ID',
      '1oKBKnP4rfm7RVBlkkBYQe5zwaG9i0u8R2NzSH70LzsM',
    );
  },
  /** スクリプトプロパティ LEGACY_TSUKUBA_CSV_APP_SHEET_ID で上書き可能 */
  get matchingApplicationSheetId() {
    return Number(
      _getLegacyImportProperty('LEGACY_TSUKUBA_CSV_APP_SHEET_ID', '1759574996'),
    );
  },
});

/**
 * 旧沼津CSV取り込みの既定設定
 */
const NUMAZU_LEGACY_CSV_IMPORT_DEFAULTS = Object.freeze({
  sourceSpreadsheetId: '',
  sourceSheetNameCandidates: [
    'legacy-reservations-from2023_10_21-to2025_02_16沼津教室',
    'legacy-reservations-from2023_10_21-to2025_02_16沼津教室.csv',
    'legacy-reservations-from2023_01-to2023_09沼津教室',
    'legacy-reservations-from2023_01-to2023_09沼津教室.csv',
    'legacy-reservations-沼津教室',
    'legacy-reservations-沼津教室.csv',
    'legacy-reservations-numazu',
    'legacy-reservations-numazu.csv',
    '教室予約表 - 沼津教室',
    '教室予約表 - 沼津教室.csv',
  ],
  defaultClassroom: CONSTANTS.CLASSROOMS.NUMAZU,
  defaultStatus: CONSTANTS.STATUS.COMPLETED,
  defaultScheduleClassroomType: CONSTANTS.CLASSROOM_TYPES.TIME_FULL,
  defaultScheduleStatus: CONSTANTS.SCHEDULE_STATUS.COMPLETED,
});

/**
 * 2023年1〜9月分（申込み原票CSV整形後）取り込みの固定設定
 * - GASエディタから「引数なし実行」するための専用プリセット
 */
const TSUKUBA_LEGACY_CSV_IMPORT_2023_JAN_TO_SEP_PRESET = Object.freeze({
  sourceSpreadsheetId: '',
  sourceSheetNameCandidates: [
    'legacy-reservations-from2023_01-to2023_09つくば教室',
    'legacy-reservations-from2023_01-to2023_09つくば教室',
    'legacy-reservations-from2023_01-to2023_09つくば教室.csv',
    'legacy-reservations-from2023_01-to2023_09つくば教室.csv',
  ],
  defaultClassroom: CONSTANTS.CLASSROOMS.TSUKUBA,
  defaultStatus: CONSTANTS.STATUS.COMPLETED,
  reconcileTargetDateFrom: '2023-01-01',
  reconcileTargetDateTo: '2023-09-30',
  reconcileTargetClassroom: CONSTANTS.CLASSROOMS.TSUKUBA,
});

/**
 * 2023年1〜9月の元申込みシート（電話・メール等）を名簿補完するための固定設定
 */
const TSUKUBA_LEGACY_APPLICATION_ROSTER_2023_PRESET = Object.freeze({
  sourceSpreadsheetId: '',
  sourceSheetNameRegexes: [
    /from2023[_-]?0?1.*to2023[_-]?0?2/,
    /from2023[_-]?0?3.*to2023[_-]?0?9/,
  ],
});

/**
 * 予約重複除去（2023年1〜9月）の固定設定
 */
const TSUKUBA_RESERVATION_DEDUPE_2023_PRESET = Object.freeze({
  targetDateFrom: '2023-01-01',
  targetDateTo: '2023-09-30',
  keyFields: ['studentId', 'lessonId', 'date', 'status'],
});

/**
 * 予約重複除去（2023年10月21日〜2025年2月16日）の固定設定
 */
const TSUKUBA_RESERVATION_DEDUPE_2023_10_TO_2025_02_PRESET = Object.freeze({
  targetDateFrom: '2023-10-21',
  targetDateTo: '2025-02-16',
  keyFields: ['studentId', 'lessonId', 'date', 'status'],
});

/**
 * 予約重複除去（旧データ全期間）の固定設定
 */
const TSUKUBA_RESERVATION_DEDUPE_LEGACY_ALL_PRESET = Object.freeze({
  targetDateFrom: '2023-01-01',
  targetDateTo: '2025-02-16',
  keyFields: ['studentId', 'lessonId', 'date', 'status'],
});

/**
 * 警告/エラーメッセージの収集ユーティリティを作成する
 * 上限を超えたメッセージはLoggerに出力し、finalize() で切り詰め通知を付与する
 * @param {string} logPrefix - ログ出力時のプレフィックス（例: '[importLegacyReservations]'）
 * @param {number} [maxItems=200] - 保持する最大件数
 * @returns {{
 *   warnings: string[];
 *   errorMessages: string[];
 *   pushWarning: (message: string) => void;
 *   pushError: (message: string) => void;
 *   finalize: () => void;
 * }}
 */
function _createMessageCollector(logPrefix, maxItems = 200) {
  /** @type {string[]} */
  const warnings = [];
  /** @type {string[]} */
  const errorMessages = [];
  let droppedWarnings = 0;
  let droppedErrors = 0;
  return {
    warnings,
    errorMessages,
    pushWarning(message) {
      if (warnings.length < maxItems) {
        warnings.push(message);
      } else {
        droppedWarnings++;
      }
      Logger.log(`${logPrefix}[WARN] ${message}`);
    },
    pushError(message) {
      if (errorMessages.length < maxItems) {
        errorMessages.push(message);
      } else {
        droppedErrors++;
      }
      Logger.log(`${logPrefix}[ERROR] ${message}`);
    },
    finalize() {
      if (droppedWarnings > 0) {
        warnings.push(`（他 ${droppedWarnings} 件の警告は省略されました）`);
      }
      if (droppedErrors > 0) {
        errorMessages.push(
          `（他 ${droppedErrors} 件のエラーは省略されました）`,
        );
      }
    },
  };
}

/**
 * ヘッダー行をトリム済みのインデックスマップへ変換
 * @param {any[]} headerRow
 * @returns {Record<string, number>}
 */
function _createTrimmedHeaderMap(headerRow) {
  /** @type {Record<string, number>} */
  const headerMap = {};
  headerRow.forEach((cell, index) => {
    const trimmed = String(cell || '').trim();
    if (!trimmed) return;
    if (headerMap[trimmed] === undefined) {
      headerMap[trimmed] = index;
    }
    const lower = trimmed.toLowerCase();
    if (headerMap[lower] === undefined) {
      headerMap[lower] = index;
    }
  });
  return headerMap;
}

/**
 * 取り込みマッピング仕様（列名/列番号/候補配列）から列インデックスを解決
 * @param {LegacyFieldMappingSpec | null | undefined} mappingSpec
 * @param {Record<string, number>} sourceHeaderMap
 * @returns {number | undefined}
 */
function _resolveLegacyFieldIndex(mappingSpec, sourceHeaderMap) {
  if (Array.isArray(mappingSpec)) {
    for (const candidate of mappingSpec) {
      const resolved = _resolveLegacyFieldIndex(candidate, sourceHeaderMap);
      if (resolved !== undefined) return resolved;
    }
    return undefined;
  }

  if (typeof mappingSpec === 'number' && Number.isFinite(mappingSpec)) {
    return Math.max(0, Math.floor(mappingSpec));
  }

  if (typeof mappingSpec === 'string') {
    const trimmed = mappingSpec.trim();
    if (!trimmed) return undefined;

    if (sourceHeaderMap[trimmed] !== undefined) {
      return sourceHeaderMap[trimmed];
    }

    const lower = trimmed.toLowerCase();
    if (sourceHeaderMap[lower] !== undefined) {
      return sourceHeaderMap[lower];
    }

    if (/^\d+$/.test(trimmed)) {
      return Math.max(0, parseInt(trimmed, 10));
    }
  }

  return undefined;
}

/**
 * 指定マッピングから行データのセル値を取得
 * @param {RawSheetRow} row
 * @param {LegacyFieldMappingSpec | null | undefined} mappingSpec
 * @param {Record<string, number>} sourceHeaderMap
 * @returns {unknown}
 */
function _pickLegacyCellValue(row, mappingSpec, sourceHeaderMap) {
  const idx = _resolveLegacyFieldIndex(mappingSpec, sourceHeaderMap);
  if (idx === undefined || idx < 0 || idx >= row.length) {
    return undefined;
  }
  return row[idx];
}

/**
 * 空文字/undefined/nullを除いた最初の値を返す
 * @param {...unknown} values
 * @returns {unknown}
 */
function _firstNotEmpty(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    return value;
  }
  return undefined;
}

/**
 * 真偽値に正規化
 * @param {unknown} value
 * @param {boolean} [fallback=false]
 * @returns {boolean}
 */
function _normalizeLegacyBoolean(value, fallback = false) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return fallback;
  if (
    [
      'true',
      '1',
      'yes',
      'y',
      'on',
      'あり',
      '有',
      'はい',
      '○',
      '◯',
      '〇',
    ].includes(normalized)
  ) {
    return true;
  }
  if (
    [
      'false',
      '0',
      'no',
      'n',
      'off',
      'なし',
      '無',
      'いいえ',
      'x',
      '×',
      '✕',
    ].includes(normalized)
  ) {
    return false;
  }
  return fallback;
}

/**
 * 日付をYYYY-MM-DDへ正規化
 * @param {unknown} value
 * @returns {string}
 */
function _normalizeLegacyDate(value) {
  if (value === null || value === undefined || value === '') return '';

  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, CONSTANTS.TIMEZONE, 'yyyy-MM-dd');
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    // Excel/Sheetsのシリアル日付（1900-01-00起点）を吸収
    // シリアル日付はローカル時間のため、UTC経由ではなく直接日付部分を算出する
    if (value > 20000 && value < 80000) {
      const daysSinceEpoch = Math.floor(value) - 2;
      const baseDate = new Date(1900, 0, 1);
      baseDate.setDate(baseDate.getDate() + daysSinceEpoch);
      if (!isNaN(baseDate.getTime())) {
        const yyyy = baseDate.getFullYear();
        const mm = String(baseDate.getMonth() + 1).padStart(2, '0');
        const dd = String(baseDate.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
    }
  }

  const raw = String(value).trim();
  if (!raw) return '';

  const ymdMatch = raw.match(/^(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const compactMatch = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactMatch) {
    return `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`;
  }

  const parsed = new Date(raw.replace(/年|月/g, '/').replace(/日/g, ''));
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, CONSTANTS.TIMEZONE, 'yyyy-MM-dd');
  }

  return '';
}

/**
 * 時刻をHH:mmへ正規化
 * @param {unknown} value
 * @returns {string}
 */
function _normalizeLegacyTime(value) {
  if (value === null || value === undefined || value === '') return '';

  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, CONSTANTS.TIMEZONE, 'HH:mm');
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    // 0〜1の小数はシートの時刻シリアル値として扱う
    if (value >= 0 && value < 1) {
      const totalMinutes = Math.round(value * 24 * 60);
      const hours = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
      const minutes = String(totalMinutes % 60).padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    // 930 / 1330 のような数値表現にも対応
    const numeric = String(Math.floor(value));
    if (/^\d{3,4}$/.test(numeric)) {
      const hh = numeric.length === 3 ? `0${numeric[0]}` : numeric.slice(0, 2);
      const mm = numeric.length === 3 ? numeric.slice(1) : numeric.slice(2);
      if (Number(mm) < 60) {
        return `${hh}:${mm.padStart(2, '0')}`;
      }
    }
  }

  const raw = String(value).trim();
  if (!raw) return '';

  const colon = raw.match(/^(\d{1,2}):(\d{1,2})$/);
  if (colon) {
    const rawH = Number(colon[1]);
    const rawM = Number(colon[2]);
    if (rawH > 23 || rawM > 59) {
      Logger.log(
        `[_normalizeLegacyTime][WARN] 範囲外の時刻値をクランプ: "${raw}" → "${String(Math.min(23, rawH)).padStart(2, '0')}:${String(Math.min(59, rawM)).padStart(2, '0')}"`,
      );
    }
    const hh = String(Math.min(23, rawH)).padStart(2, '0');
    const mm = String(Math.min(59, rawM)).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  const japanese = raw.match(/^(\d{1,2})時(?:(\d{1,2})分?)?$/);
  if (japanese) {
    const rawH = Number(japanese[1]);
    const rawM = Number(japanese[2] || '0');
    if (rawH > 23 || rawM > 59) {
      Logger.log(
        `[_normalizeLegacyTime][WARN] 範囲外の時刻値をクランプ: "${raw}"`,
      );
    }
    const hh = String(Math.min(23, rawH)).padStart(2, '0');
    const mm = String(Math.min(59, rawM)).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  const compact = raw.match(/^(\d{3,4})$/);
  if (compact) {
    const digits = compact[1];
    const hh = digits.length === 3 ? `0${digits[0]}` : digits.slice(0, 2);
    const mm = digits.length === 3 ? digits.slice(1) : digits.slice(2);
    if (Number(mm) < 60) {
      return `${hh}:${mm.padStart(2, '0')}`;
    }
  }

  return '';
}

/**
 * ステータス値を現行定義へ寄せる
 * @param {unknown} value
 * @param {string} [fallbackStatus=CONSTANTS.STATUS.COMPLETED]
 * @returns {string}
 */
function _normalizeLegacyStatus(
  value,
  fallbackStatus = CONSTANTS.STATUS.COMPLETED,
) {
  const raw = String(value || '').trim();
  if (!raw) return fallbackStatus;

  const validStatuses = Object.values(CONSTANTS.STATUS);
  if (validStatuses.includes(raw)) return raw;

  /** @type {Record<string, string>} */
  const statusMap = {
    予約: CONSTANTS.STATUS.CONFIRMED,
    booked: CONSTANTS.STATUS.CONFIRMED,
    confirmed: CONSTANTS.STATUS.CONFIRMED,
    active: CONSTANTS.STATUS.CONFIRMED,
    待機中: CONSTANTS.STATUS.WAITLISTED,
    空き通知: CONSTANTS.STATUS.WAITLISTED,
    waitlist: CONSTANTS.STATUS.WAITLISTED,
    waiting: CONSTANTS.STATUS.WAITLISTED,
    キャンセル: CONSTANTS.STATUS.CANCELED,
    canceled: CONSTANTS.STATUS.CANCELED,
    cancelled: CONSTANTS.STATUS.CANCELED,
    cancel: CONSTANTS.STATUS.CANCELED,
    会計済み: CONSTANTS.STATUS.COMPLETED,
    履歴: CONSTANTS.STATUS.COMPLETED,
    completed: CONSTANTS.STATUS.COMPLETED,
    done: CONSTANTS.STATUS.COMPLETED,
  };

  const lower = raw.toLowerCase();
  return statusMap[raw] || statusMap[lower] || fallbackStatus;
}

/**
 * 会計詳細をオブジェクト化
 * @param {unknown} value
 * @returns {AccountingDetailsCore | undefined}
 */
function _parseLegacyAccountingDetails(value) {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'object') {
    return /** @type {AccountingDetailsCore} */ (value);
  }
  const raw = String(value).trim();
  if (!raw) return undefined;
  if (!raw.startsWith('{') && !raw.startsWith('[')) return undefined;
  try {
    return /** @type {AccountingDetailsCore} */ (JSON.parse(raw));
  } catch {
    return undefined;
  }
}

/**
 * fallback lessonId 生成時に使う教室キー
 * @param {string} classroom
 * @returns {string}
 */
function _sanitizeLegacyClassroomKey(classroom) {
  return String(classroom || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^\wぁ-んァ-ヶ一-龠々ー]/g, '_');
}

/**
 * 日程シートから日付+教室の逆引きマップを作る
 * @returns {Map<string, {lessonId: string, venue: string, startTime: string, endTime: string}>}
 */
function _buildScheduleLookupForLegacyImport() {
  /** @type {Map<string, {lessonId: string, venue: string, startTime: string, endTime: string}>} */
  const lookup = new Map();
  const sheet = SS_MANAGER.getSheet(CONSTANTS.SHEET_NAMES.SCHEDULE);
  if (!sheet) {
    return lookup;
  }

  const { header, dataRows } = getSheetData(sheet);
  if (!Array.isArray(header) || !Array.isArray(dataRows)) {
    return lookup;
  }

  const lessonIdCol = header.indexOf(CONSTANTS.HEADERS.SCHEDULE.LESSON_ID);
  const dateCol = header.indexOf(CONSTANTS.HEADERS.SCHEDULE.DATE);
  const classroomCol = header.indexOf(CONSTANTS.HEADERS.SCHEDULE.CLASSROOM);
  const venueCol = header.indexOf(CONSTANTS.HEADERS.SCHEDULE.VENUE);
  const firstStartCol = header.indexOf(CONSTANTS.HEADERS.SCHEDULE.FIRST_START);
  const firstEndCol = header.indexOf(CONSTANTS.HEADERS.SCHEDULE.FIRST_END);
  const secondEndCol = header.indexOf(CONSTANTS.HEADERS.SCHEDULE.SECOND_END);

  if (dateCol === -1 || classroomCol === -1) {
    return lookup;
  }

  dataRows.forEach(row => {
    const date = _normalizeLegacyDate(row[dateCol]);
    const classroom = String(row[classroomCol] || '').trim();
    if (!date || !classroom) return;

    const key = `${date}_${classroom}`;
    const lessonId =
      lessonIdCol >= 0 ? String(row[lessonIdCol] || '').trim() : '';
    const venue = venueCol >= 0 ? String(row[venueCol] || '').trim() : '';
    const startTime =
      firstStartCol >= 0 ? _normalizeLegacyTime(row[firstStartCol]) : '';
    const firstEnd =
      firstEndCol >= 0 ? _normalizeLegacyTime(row[firstEndCol]) : '';
    const secondEnd =
      secondEndCol >= 0 ? _normalizeLegacyTime(row[secondEndCol]) : '';
    const endTime = secondEnd || firstEnd;

    lookup.set(key, {
      lessonId,
      venue,
      startTime,
      endTime,
    });
  });

  return lookup;
}

/**
 * 日程重複判定キーを生成
 * @param {unknown} date
 * @param {unknown} classroom
 * @returns {string}
 */
function _createLegacyScheduleIdentityKey(date, classroom) {
  const normalizedDate = _normalizeLegacyDate(date);
  const normalizedClassroom = String(classroom || '').trim();
  if (!normalizedDate || !normalizedClassroom) return '';
  return `${normalizedDate}|${normalizedClassroom}`;
}

/**
 * 旧CSVから日程追加候補を抽出
 * @param {Record<string, any>} importConfig
 * @returns {{
 *   success: boolean;
 *   sourceSheetName: string;
 *   sourceSpreadsheetId: string;
 *   candidates: Array<{date: string; classroom: string; sourceRow: number}>;
 *   invalidCount: number;
 *   warnings: string[];
 *   errorMessage?: string;
 * }}
 */
function _collectLegacyCsvScheduleCandidates(importConfig) {
  /** @type {Record<string, any>} */
  const input = /** @type {Record<string, any>} */ (importConfig || {});
  /** @type {string[]} */
  const warnings = [];
  /**
   * @param {string} message
   */
  const pushWarning = message => {
    if (warnings.length < 200) warnings.push(message);
    Logger.log(`[collectLegacyCsvScheduleCandidates][WARN] ${message}`);
  };

  try {
    const sourceSpreadsheetId = String(
      input['sourceSpreadsheetId'] || '',
    ).trim();
    const sourceSheetName = String(input['sourceSheetName'] || '').trim();
    if (!sourceSheetName) {
      return {
        success: false,
        sourceSheetName: '',
        sourceSpreadsheetId,
        candidates: [],
        invalidCount: 0,
        warnings,
        errorMessage: 'sourceSheetName が指定されていません。',
      };
    }

    const sourceSpreadsheet = sourceSpreadsheetId
      ? SpreadsheetApp.openById(sourceSpreadsheetId)
      : SpreadsheetApp.getActiveSpreadsheet();
    const sourceSheet = sourceSpreadsheet.getSheetByName(sourceSheetName);
    if (!sourceSheet) {
      return {
        success: false,
        sourceSheetName,
        sourceSpreadsheetId,
        candidates: [],
        invalidCount: 0,
        warnings,
        errorMessage: `取り込み元シートが見つかりません: ${sourceSheetName}`,
      };
    }

    const sourceHeaderRow = Math.max(1, Number(input['sourceHeaderRow'] || 1));
    const sourceDataStartRow = Math.max(
      sourceHeaderRow + 1,
      Number(input['sourceDataStartRow'] || sourceHeaderRow + 1),
    );
    const sourceLastRow = sourceSheet.getLastRow();
    const sourceLastColumn = sourceSheet.getLastColumn();
    if (sourceLastColumn <= 0 || sourceLastRow < sourceDataStartRow) {
      return {
        success: true,
        sourceSheetName,
        sourceSpreadsheetId,
        candidates: [],
        invalidCount: 0,
        warnings,
      };
    }

    const sourceHeader = sourceSheet
      .getRange(sourceHeaderRow, 1, 1, sourceLastColumn)
      .getValues()[0];
    const sourceHeaderMap = _createTrimmedHeaderMap(sourceHeader);
    const resolvedFieldMap = _createResolvedLegacyFieldMap(
      /** @type {Record<string, any>} */ (input['fieldMap'] || {}),
      sourceHeaderMap,
    );
    /** @type {Record<string, any>} */
    const defaults = /** @type {Record<string, any>} */ (
      input['defaults'] || {}
    );
    const skipEmptyRows = input['skipEmptyRows'] !== false;

    const rowCount = sourceLastRow - sourceDataStartRow + 1;
    const sourceRows = sourceSheet
      .getRange(sourceDataStartRow, 1, rowCount, sourceLastColumn)
      .getValues();

    /** @type {Map<string, {date: string; classroom: string; sourceRow: number}>} */
    const uniqueCandidates = new Map();
    let invalidCount = 0;

    sourceRows.forEach((sourceRow, index) => {
      if (
        skipEmptyRows &&
        sourceRow.every(
          cell => cell === '' || cell === null || cell === undefined,
        )
      ) {
        return;
      }

      const sourceRowNumber = sourceDataStartRow + index;
      const date = _normalizeLegacyDate(
        _firstNotEmpty(
          _pickLegacyCellValue(
            sourceRow,
            resolvedFieldMap['date'],
            sourceHeaderMap,
          ),
          defaults['date'],
        ),
      );
      const classroom = String(
        _firstNotEmpty(
          _pickLegacyCellValue(
            sourceRow,
            resolvedFieldMap['classroom'],
            sourceHeaderMap,
          ),
          defaults['classroom'],
        ) || '',
      ).trim();
      const key = _createLegacyScheduleIdentityKey(date, classroom);

      if (!key) {
        invalidCount += 1;
        pushWarning(
          `行${sourceRowNumber}: 日程追加に必要な日付/教室が不足のため除外（date=${date || '-'}, classroom=${classroom || '-'})`,
        );
        return;
      }
      if (!uniqueCandidates.has(key)) {
        uniqueCandidates.set(key, {
          date,
          classroom,
          sourceRow: sourceRowNumber,
        });
      }
    });

    return {
      success: true,
      sourceSheetName,
      sourceSpreadsheetId,
      candidates: Array.from(uniqueCandidates.values()),
      invalidCount,
      warnings,
    };
  } catch (error) {
    const message = `CSV日程候補抽出でエラー: ${error.message}`;
    Logger.log(`[collectLegacyCsvScheduleCandidates] ${message}`);
    return {
      success: false,
      sourceSheetName: String(input['sourceSheetName'] || '').trim(),
      sourceSpreadsheetId: String(input['sourceSpreadsheetId'] || '').trim(),
      candidates: [],
      invalidCount: 0,
      warnings,
      errorMessage: message,
    };
  }
}

/**
 * 旧CSVから日程マスタを補完（不足日付+教室のみ追加）
 * @param {Record<string, any>} importConfig
 * @param {boolean} [dryRun=true]
 * @returns {{
 *   success: boolean;
 *   dryRun: boolean;
 *   sourceSheetName: string;
 *   sourceSpreadsheetId: string;
 *   candidateCount: number;
 *   existingCount: number;
 *   addedCount: number;
 *   invalidCount: number;
 *   warnings: string[];
 *   errorMessages: string[];
 *   preview: Array<{date: string; classroom: string; sourceRow: number; action: 'add' | 'exists'}>;
 * }}
 */
function _ensureScheduleRowsForLegacyCsvImport(importConfig, dryRun = true) {
  const { warnings, errorMessages, pushError, finalize } =
    _createMessageCollector('[ensureScheduleRowsForLegacyCsvImport]');

  try {
    const collected = _collectLegacyCsvScheduleCandidates(importConfig);
    warnings.push(...collected.warnings);
    const sourceSheetName = collected.sourceSheetName;
    const sourceSpreadsheetId = collected.sourceSpreadsheetId;

    if (!collected.success) {
      if (collected.errorMessage) pushError(collected.errorMessage);
      return {
        success: false,
        dryRun,
        sourceSheetName,
        sourceSpreadsheetId,
        candidateCount: 0,
        existingCount: 0,
        addedCount: 0,
        invalidCount: collected.invalidCount,
        warnings,
        errorMessages,
        preview: [],
      };
    }

    const scheduleSheet = SS_MANAGER.getSheet(CONSTANTS.SHEET_NAMES.SCHEDULE);
    if (!scheduleSheet) {
      pushError('日程マスタシートが見つかりません。');
      return {
        success: false,
        dryRun,
        sourceSheetName,
        sourceSpreadsheetId,
        candidateCount: collected.candidates.length,
        existingCount: 0,
        addedCount: 0,
        invalidCount: collected.invalidCount,
        warnings,
        errorMessages,
        preview: [],
      };
    }

    const {
      header: scheduleHeader,
      headerMap: scheduleHeaderMap,
      dataRows: scheduleRows,
    } = getSheetData(scheduleSheet);
    const lessonIdCol = _getHeaderIndexFromAnyMap(
      scheduleHeaderMap,
      CONSTANTS.HEADERS.SCHEDULE.LESSON_ID,
    );
    const reservationIdsCol = _getHeaderIndexFromAnyMap(
      scheduleHeaderMap,
      CONSTANTS.HEADERS.SCHEDULE.RESERVATION_IDS,
    );
    const dateCol = _getHeaderIndexFromAnyMap(
      scheduleHeaderMap,
      CONSTANTS.HEADERS.SCHEDULE.DATE,
    );
    const classroomCol = _getHeaderIndexFromAnyMap(
      scheduleHeaderMap,
      CONSTANTS.HEADERS.SCHEDULE.CLASSROOM,
    );
    const venueCol = _getHeaderIndexFromAnyMap(
      scheduleHeaderMap,
      CONSTANTS.HEADERS.SCHEDULE.VENUE,
    );
    const typeCol = _getHeaderIndexFromAnyMap(
      scheduleHeaderMap,
      CONSTANTS.HEADERS.SCHEDULE.TYPE,
    );
    const firstStartCol = _getHeaderIndexFromAnyMap(
      scheduleHeaderMap,
      CONSTANTS.HEADERS.SCHEDULE.FIRST_START,
    );
    const firstEndCol = _getHeaderIndexFromAnyMap(
      scheduleHeaderMap,
      CONSTANTS.HEADERS.SCHEDULE.FIRST_END,
    );
    const secondStartCol = _getHeaderIndexFromAnyMap(
      scheduleHeaderMap,
      CONSTANTS.HEADERS.SCHEDULE.SECOND_START,
    );
    const secondEndCol = _getHeaderIndexFromAnyMap(
      scheduleHeaderMap,
      CONSTANTS.HEADERS.SCHEDULE.SECOND_END,
    );
    const beginnerStartCol = _getHeaderIndexFromAnyMap(
      scheduleHeaderMap,
      CONSTANTS.HEADERS.SCHEDULE.BEGINNER_START,
    );
    const totalCapacityCol = _getHeaderIndexFromAnyMap(
      scheduleHeaderMap,
      CONSTANTS.HEADERS.SCHEDULE.TOTAL_CAPACITY,
    );
    const beginnerCapacityCol = _getHeaderIndexFromAnyMap(
      scheduleHeaderMap,
      CONSTANTS.HEADERS.SCHEDULE.BEGINNER_CAPACITY,
    );
    const statusCol = _getHeaderIndexFromAnyMap(
      scheduleHeaderMap,
      CONSTANTS.HEADERS.SCHEDULE.STATUS,
    );
    const notesCol = _getHeaderIndexFromAnyMap(
      scheduleHeaderMap,
      CONSTANTS.HEADERS.SCHEDULE.NOTES,
    );

    if (dateCol === undefined || classroomCol === undefined) {
      pushError('日程マスタの必須列（日付/教室）が見つかりません。');
      return {
        success: false,
        dryRun,
        sourceSheetName,
        sourceSpreadsheetId,
        candidateCount: collected.candidates.length,
        existingCount: 0,
        addedCount: 0,
        invalidCount: collected.invalidCount,
        warnings,
        errorMessages,
        preview: [],
      };
    }

    /** @type {Record<string, any>} */
    const input = /** @type {Record<string, any>} */ (importConfig || {});
    const scheduleClassroomType =
      String(
        _firstNotEmpty(
          input['defaultScheduleClassroomType'],
          TSUKUBA_LEGACY_CSV_IMPORT_DEFAULTS.defaultScheduleClassroomType,
        ) || '',
      ).trim() || CONSTANTS.CLASSROOM_TYPES.TIME_FULL;
    const scheduleStatus =
      String(
        _firstNotEmpty(
          input['defaultScheduleStatus'],
          TSUKUBA_LEGACY_CSV_IMPORT_DEFAULTS.defaultScheduleStatus,
        ) || '',
      ).trim() || CONSTANTS.SCHEDULE_STATUS.COMPLETED;
    const scheduleVenue = String(
      _firstNotEmpty(input['defaultScheduleVenue']) || '',
    ).trim();
    const scheduleNote = String(
      _firstNotEmpty(input['defaultScheduleNote']) || '',
    ).trim();
    const firstStart = _normalizeLegacyTime(
      _firstNotEmpty(input['defaultFirstStart']),
    );
    const firstEnd = _normalizeLegacyTime(
      _firstNotEmpty(input['defaultFirstEnd']),
    );
    const secondStart = _normalizeLegacyTime(
      _firstNotEmpty(input['defaultSecondStart']),
    );
    const secondEnd = _normalizeLegacyTime(
      _firstNotEmpty(input['defaultSecondEnd']),
    );
    const beginnerStart = _normalizeLegacyTime(
      _firstNotEmpty(input['defaultBeginnerStart']),
    );
    const totalCapacity = _toFiniteNumber(
      _firstNotEmpty(input['defaultTotalCapacity']),
    );
    const beginnerCapacity = _toFiniteNumber(
      _firstNotEmpty(input['defaultBeginnerCapacity']),
    );

    const existingKeys = new Set();
    scheduleRows.forEach(row => {
      const key = _createLegacyScheduleIdentityKey(
        row[dateCol],
        row[classroomCol],
      );
      if (key) existingKeys.add(key);
    });

    /** @type {RawSheetRow[]} */
    const rowsToAppend = [];
    /** @type {Array<{date: string; classroom: string; sourceRow: number; action: 'add' | 'exists'}>} */
    const preview = [];
    let existingCount = 0;
    let addedCount = 0;

    collected.candidates.forEach(candidate => {
      const identityKey = _createLegacyScheduleIdentityKey(
        candidate.date,
        candidate.classroom,
      );
      if (!identityKey) return;

      if (existingKeys.has(identityKey)) {
        existingCount += 1;
        if (preview.length < 50) {
          preview.push({
            date: candidate.date,
            classroom: candidate.classroom,
            sourceRow: candidate.sourceRow,
            action: 'exists',
          });
        }
        return;
      }
      existingKeys.add(identityKey);
      addedCount += 1;

      const row = Array(scheduleHeader.length).fill('');
      if (lessonIdCol !== undefined) row[lessonIdCol] = Utilities.getUuid();
      if (reservationIdsCol !== undefined) row[reservationIdsCol] = '[]';
      row[dateCol] = candidate.date;
      row[classroomCol] = candidate.classroom;
      if (venueCol !== undefined && scheduleVenue)
        row[venueCol] = scheduleVenue;
      if (typeCol !== undefined) row[typeCol] = scheduleClassroomType;
      if (firstStartCol !== undefined && firstStart)
        row[firstStartCol] = firstStart;
      if (firstEndCol !== undefined && firstEnd) row[firstEndCol] = firstEnd;
      if (secondStartCol !== undefined && secondStart) {
        row[secondStartCol] = secondStart;
      }
      if (secondEndCol !== undefined && secondEnd)
        row[secondEndCol] = secondEnd;
      if (beginnerStartCol !== undefined && beginnerStart) {
        row[beginnerStartCol] = beginnerStart;
      }
      if (totalCapacityCol !== undefined && totalCapacity !== null) {
        row[totalCapacityCol] = totalCapacity;
      }
      if (beginnerCapacityCol !== undefined && beginnerCapacity !== null) {
        row[beginnerCapacityCol] = beginnerCapacity;
      }
      if (statusCol !== undefined) row[statusCol] = scheduleStatus;
      if (notesCol !== undefined && scheduleNote) row[notesCol] = scheduleNote;

      rowsToAppend.push(row);
      if (preview.length < 50) {
        preview.push({
          date: candidate.date,
          classroom: candidate.classroom,
          sourceRow: candidate.sourceRow,
          action: 'add',
        });
      }
    });

    if (!dryRun && rowsToAppend.length > 0) {
      const chunkSize = 200;
      let writeRow = scheduleSheet.getLastRow() + 1;
      for (let i = 0; i < rowsToAppend.length; i += chunkSize) {
        const chunk = rowsToAppend.slice(i, i + chunkSize);
        scheduleSheet
          .getRange(writeRow, 1, chunk.length, scheduleHeader.length)
          .setValues(chunk);
        writeRow += chunk.length;
      }
      SpreadsheetApp.flush();
      rebuildScheduleMasterCache();

      logActivity('SYSTEM', '日程マスタ補完', '成功', {
        message: `旧CSVから日程マスタへ追加（${addedCount}件）`,
        details: {
          sourceSheetName,
          sourceSpreadsheetId: sourceSpreadsheetId || 'current',
          candidateCount: collected.candidates.length,
          existingCount,
          addedCount,
          invalidCount: collected.invalidCount,
          warnings: warnings.length,
        },
      });
    }

    finalize();
    return {
      success: errorMessages.length === 0,
      dryRun,
      sourceSheetName,
      sourceSpreadsheetId,
      candidateCount: collected.candidates.length,
      existingCount,
      addedCount,
      invalidCount: collected.invalidCount,
      warnings,
      errorMessages,
      preview,
    };
  } catch (error) {
    const message = `CSV日程補完でエラー: ${error.message}`;
    pushError(message);
    finalize();
    return {
      success: false,
      dryRun,
      sourceSheetName: String(importConfig?.['sourceSheetName'] || ''),
      sourceSpreadsheetId: String(importConfig?.['sourceSpreadsheetId'] || ''),
      candidateCount: 0,
      existingCount: 0,
      addedCount: 0,
      invalidCount: 0,
      warnings,
      errorMessages,
      preview: [],
    };
  }
}

/**
 * 自動推定込みで取り込み用フィールドマップを解決
 * @param {Record<string, any>} userFieldMap
 * @param {Record<string, number>} sourceHeaderMap
 * @returns {Record<string, any>}
 */
function _createResolvedLegacyFieldMap(userFieldMap, sourceHeaderMap) {
  /** @type {Record<string, any>} */
  const resolved = {};
  Object.keys(LEGACY_IMPORT_AUTO_HEADER_CANDIDATES).forEach(field => {
    const userSpec = userFieldMap[field];
    const fallbackCandidates = LEGACY_IMPORT_AUTO_HEADER_CANDIDATES[field];
    const resolvedIndex = _resolveLegacyFieldIndex(
      userSpec !== undefined ? userSpec : fallbackCandidates,
      sourceHeaderMap,
    );
    resolved[field] = resolvedIndex;
  });
  return resolved;
}

/**
 * HeaderMapType(Map / Record) から列インデックスを取得
 * @param {HeaderMapType} headerMap
 * @param {string} headerName
 * @returns {number | undefined}
 */
function _getHeaderIndexFromAnyMap(headerMap, headerName) {
  if (!headerMap) return undefined;
  if (typeof headerMap.get === 'function') {
    return headerMap.get(headerName);
  }
  if (typeof headerMap === 'object' && headerName in headerMap) {
    return /** @type {Record<string, number>} */ (headerMap)[headerName];
  }
  return undefined;
}

/**
 * 名前照合用の正規化
 * - 全角半角/大文字小文字/空白差分を吸収
 * - 括弧内補足（例: 山田太郎（初回））は無視
 * - 敬称（様/さん）は末尾のみ除去
 *
 * @param {unknown} value
 * @returns {string}
 */
function _normalizeNameForMatching(value) {
  if (value === null || value === undefined) return '';
  const normalized = String(value)
    .normalize('NFKC')
    .replace(/\u3000/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/(様|さん)$/g, '')
    .replace(/[ ・･\s\-_.,，。]/g, '');
  return normalized;
}

/**
 * 電話番号照合用の正規化
 * @param {unknown} value
 * @returns {string}
 */
function _normalizeLegacyPhoneForMatching(value) {
  if (value === null || value === undefined) return '';
  let normalized = String(value).normalize('NFKC').trim();
  if (!normalized) return '';
  normalized = normalized.replace(/[-‐－—–\s\(\)\[\]\.\+]/g, '');
  if (!/^\d+$/.test(normalized)) return '';
  if (normalized.startsWith('81') && normalized.length >= 12) {
    normalized = `0${normalized.slice(2)}`;
  }
  return normalized;
}

/**
 * メール照合用の正規化
 * @param {unknown} value
 * @returns {string}
 */
function _normalizeLegacyEmailForMatching(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
}

/**
 * スプレッドシートからシート名/シートIDでシートを解決
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet
 * @param {string} sheetName
 * @param {number | null} sheetId
 * @returns {GoogleAppsScript.Spreadsheet.Sheet | null}
 */
function _resolveSheetByNameOrId(spreadsheet, sheetName, sheetId) {
  if (sheetName) {
    const sheetByName = spreadsheet.getSheetByName(sheetName);
    if (sheetByName) return sheetByName;
  }
  if (sheetId !== null) {
    const sheetById =
      spreadsheet.getSheets().find(sheet => sheet.getSheetId() === sheetId) ||
      null;
    if (sheetById) return sheetById;
  }
  return null;
}

/**
 * 元申込みシートから照合補助データを抽出
 * @param {Record<string, any>} config
 * @returns {{
 *   entries: Array<{normalizedName: string; phone: string; email: string}>;
 *   warnings: string[];
 * }}
 */
function _collectLegacyApplicationEntries(config) {
  /** @type {string[]} */
  const warnings = [];
  /** @type {Array<{normalizedName: string; phone: string; email: string}>} */
  const entries = [];

  const spreadsheetId = String(
    config['matchingApplicationSpreadsheetId'] || '',
  ).trim();
  const sheetName = String(config['matchingApplicationSheetName'] || '').trim();
  const sheetIdRaw = _toFiniteNumber(config['matchingApplicationSheetId']);
  const sheetId = sheetIdRaw !== null ? Math.floor(sheetIdRaw) : null;

  if (!spreadsheetId && !sheetName && sheetId === null) {
    return { entries, warnings };
  }

  try {
    const spreadsheet = spreadsheetId
      ? SpreadsheetApp.openById(spreadsheetId)
      : SpreadsheetApp.getActiveSpreadsheet();
    const sheet = _resolveSheetByNameOrId(spreadsheet, sheetName, sheetId);
    if (!sheet) {
      warnings.push(
        `元申込みシートが見つかりません（spreadsheetId=${spreadsheetId || 'current'}, sheetName=${sheetName || '-'}, sheetId=${sheetId ?? '-'})`,
      );
      return { entries, warnings };
    }

    const headerRow = Math.max(
      1,
      Number(config['matchingApplicationHeaderRow'] || 1),
    );
    const dataStartRow = Math.max(
      headerRow + 1,
      Number(config['matchingApplicationDataStartRow'] || headerRow + 1),
    );
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastCol <= 0 || lastRow < dataStartRow) {
      return { entries, warnings };
    }

    const header = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0];
    const headerMap = _createTrimmedHeaderMap(header);
    const nameCol = _resolveLegacyFieldIndex(
      config['matchingApplicationNameFieldMap'] || [
        '氏名',
        '名前',
        'お名前',
        '受講者名',
        'name',
      ],
      headerMap,
    );
    const phoneCol = _resolveLegacyFieldIndex(
      config['matchingApplicationPhoneFieldMap'] || [
        '電話番号',
        '電話',
        '携帯電話',
        '携帯',
        'tel',
        'phone',
      ],
      headerMap,
    );
    const emailCol = _resolveLegacyFieldIndex(
      config['matchingApplicationEmailFieldMap'] || [
        'メールアドレス',
        'メール',
        'e-mail',
        'email',
      ],
      headerMap,
    );

    if (nameCol === undefined) {
      warnings.push(
        `元申込みシート「${sheet.getName()}」に氏名列が見つからないため、補助照合をスキップします。`,
      );
      return { entries, warnings };
    }

    const rowCount = lastRow - dataStartRow + 1;
    const rows = sheet.getRange(dataStartRow, 1, rowCount, lastCol).getValues();
    rows.forEach(row => {
      const normalizedName = _normalizeNameForMatching(row[nameCol]);
      if (!normalizedName) return;
      const phone =
        phoneCol !== undefined
          ? _normalizeLegacyPhoneForMatching(row[phoneCol])
          : '';
      const email =
        emailCol !== undefined
          ? _normalizeLegacyEmailForMatching(row[emailCol])
          : '';
      if (!phone && !email) return;
      entries.push({ normalizedName, phone, email });
    });

    return { entries, warnings };
  } catch (error) {
    warnings.push(`元申込みシート読込エラー: ${error.message}`);
    return { entries, warnings };
  }
}

/**
 * シート名照合用の正規化
 * @param {unknown} value
 * @returns {string}
 */
function _normalizeSheetNameForMatching(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .normalize('NFKC')
    .replace(/\u3000/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

/**
 * CSV取り込み元のシート名を解決
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet
 * @param {unknown} preferredSheetName
 * @param {unknown[]} candidateNames
 * @returns {string}
 */
function _resolveLegacyCsvSourceSheetName(
  spreadsheet,
  preferredSheetName,
  candidateNames,
) {
  const sheets = spreadsheet.getSheets();
  /**
   * @param {string} name
   * @returns {string | null}
   */
  const findExistingSheetName = name => {
    if (!name) return null;
    const exact = spreadsheet.getSheetByName(name);
    if (exact) return exact.getName();

    const normalizedTarget = _normalizeSheetNameForMatching(name);
    if (!normalizedTarget) return null;
    for (const sheet of sheets) {
      if (
        _normalizeSheetNameForMatching(sheet.getName()) === normalizedTarget
      ) {
        return sheet.getName();
      }
    }
    return null;
  };

  const explicitName = String(preferredSheetName || '').trim();
  if (explicitName) {
    const matched = findExistingSheetName(explicitName);
    if (matched) return matched;
    throw new Error(`取り込み元シートが見つかりません: ${explicitName}`);
  }

  for (const candidate of candidateNames) {
    const matched = findExistingSheetName(String(candidate || '').trim());
    if (matched) return matched;
  }

  throw new Error(
    `取り込み元シートが見つかりません。sourceSheetName を指定してください。（利用可能シート: ${sheets
      .map(sheet => sheet.getName())
      .slice(0, 15)
      .join(', ')}）`,
  );
}

/**
 * 候補名のいずれかに「正確一致（正規化比較含む）」するシート名を厳密解決
 * - キーワードフォールバックは行わない
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet
 * @param {unknown[]} candidateNames
 * @returns {string}
 */
function _resolveLegacyCsvSourceSheetNameStrict(spreadsheet, candidateNames) {
  const sheets = spreadsheet.getSheets();
  const normalizedToActual = new Map(
    sheets.map(sheet => [
      _normalizeSheetNameForMatching(sheet.getName()),
      sheet.getName(),
    ]),
  );

  for (const candidate of candidateNames) {
    const name = String(candidate || '').trim();
    if (!name) continue;
    const exact = spreadsheet.getSheetByName(name);
    if (exact) return exact.getName();
    const normalized = _normalizeSheetNameForMatching(name);
    if (normalized && normalizedToActual.has(normalized)) {
      return String(normalizedToActual.get(normalized));
    }
  }

  throw new Error(
    `候補シートが見つかりません。候補=${candidateNames
      .map(value => String(value || '').trim())
      .filter(Boolean)
      .join(', ')} / 利用可能シート=${sheets
      .map(sheet => sheet.getName())
      .slice(0, 20)
      .join(', ')}`,
  );
}

/**
 * 2023年1〜9月の元申込みシート名を正規表現で解決
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet
 * @param {Array<RegExp | string>} regexes
 * @returns {string[]}
 */
function _resolveLegacyApplicationSourceSheetNames2023(spreadsheet, regexes) {
  const sheets = spreadsheet.getSheets();
  const normalizedSheets = sheets.map(sheet => ({
    sheetName: sheet.getName(),
    normalizedName: _normalizeSheetNameForMatching(sheet.getName()),
  }));

  /** @type {string[]} */
  const resolved = [];
  regexes.forEach((pattern, index) => {
    const regex =
      pattern instanceof RegExp
        ? new RegExp(
            pattern.source,
            pattern.flags.includes('i') ? pattern.flags : `${pattern.flags}i`,
          )
        : new RegExp(String(pattern), 'i');
    const found = normalizedSheets.find(item =>
      regex.test(item.normalizedName),
    );
    if (!found) {
      throw new Error(
        `元申込みシート候補が見つかりません（patternIndex=${index}, pattern=${regex}）`,
      );
    }
    if (!resolved.includes(found.sheetName)) {
      resolved.push(found.sheetName);
    }
  });

  return resolved;
}

/**
 * 元申込みシート1枚から名簿補完用プロフィールを抽出
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} [headerRow=1]
 * @param {number} [dataStartRow=2]
 * @returns {{
 *   entries: Array<{
 *     sheetName: string;
 *     sourceRow: number;
 *     date: string;
 *     name: string;
 *     normalizedName: string;
 *     phone: string;
 *     email: string;
 *     address: string;
 *     ageGroup: string;
 *     gender: string;
 *     dominantHand: string;
 *     experience: string;
 *     futureCreations: string;
 *     futureParticipation: string;
 *     transportation: string;
 *     pickup: string;
 *     chiselRental: string;
 *     order: string;
 *     firstMessage: string;
 *     companion: string;
 *   }>;
 *   warnings: string[];
 * }}
 */
function _collectLegacyApplicationProfilesFromSourceSheet(
  sheet,
  headerRow = 1,
  dataStartRow = 2,
) {
  /** @type {string[]} */
  const warnings = [];
  /** @type {Array<{
   *   sheetName: string;
   *   sourceRow: number;
   *   date: string;
   *   name: string;
   *   normalizedName: string;
   *   phone: string;
   *   email: string;
   *   address: string;
   *   ageGroup: string;
   *   gender: string;
   *   dominantHand: string;
   *   experience: string;
   *   futureCreations: string;
   *   futureParticipation: string;
   *   transportation: string;
   *   pickup: string;
   *   chiselRental: string;
   *   order: string;
   *   firstMessage: string;
   *   companion: string;
   * }>} */
  const entries = [];

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastCol <= 0 || lastRow < dataStartRow) {
    return { entries, warnings };
  }

  const header = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0];
  const headerMap = _createTrimmedHeaderMap(header);
  const rowCount = lastRow - dataStartRow + 1;
  const rows = sheet.getRange(dataStartRow, 1, rowCount, lastCol).getValues();

  const FIELD_MAP = {
    date: ['日付', 'date'],
    name: ['氏名', '名前', 'お名前'],
    phone: ['電話番号', '電話', 'tel', 'phone'],
    email: ['メールアドレス', 'メール', 'email', 'e-mail'],
    address: ['住所（市区町村）', '住所', 'address'],
    age: ['年齢', '年代', 'age'],
    gender: ['性別', 'gender'],
    dominantHand: ['利き手', 'dominantHand'],
    experience: ['参加経験', '参加\n経験', '経験', '木彫り経験'],
    futureCreations: ['制作したいもの', '制作希望', '将来制作したいもの'],
    futureParticipation: ['今後', 'アンケート', '想定参加頻度'],
    transportation: ['来場手段', 'transportation'],
    pickup: ['送迎の希望', '送迎', 'pickup'],
    chiselRental: ['彫刻刀', '彫刻刀レンタル'],
    order: ['道具類購入希望', '購入希望', 'order'],
    message: ['メッセージ', 'その他コメント', '初回メッセージ'],
    companion: ['複数名の場合', '同行者', 'companion'],
  };

  rows.forEach((row, index) => {
    const sourceRow = dataStartRow + index;
    const rawName = String(
      _pickLegacyCellValue(row, FIELD_MAP.name, headerMap) || '',
    ).trim();
    const date = _normalizeLegacyDate(
      _pickLegacyCellValue(row, FIELD_MAP.date, headerMap),
    );
    const phone = _normalizeLegacyPhoneForMatching(
      _pickLegacyCellValue(row, FIELD_MAP.phone, headerMap),
    );
    const email = _normalizeLegacyEmailForMatching(
      _pickLegacyCellValue(row, FIELD_MAP.email, headerMap),
    );

    const address = String(
      _pickLegacyCellValue(row, FIELD_MAP.address, headerMap) || '',
    ).trim();
    const ageGroup = String(
      _pickLegacyCellValue(row, FIELD_MAP.age, headerMap) || '',
    ).trim();
    const gender = String(
      _pickLegacyCellValue(row, FIELD_MAP.gender, headerMap) || '',
    ).trim();
    const dominantHand = String(
      _pickLegacyCellValue(row, FIELD_MAP.dominantHand, headerMap) || '',
    ).trim();
    const experience = String(
      _pickLegacyCellValue(row, FIELD_MAP.experience, headerMap) || '',
    ).trim();
    const futureCreations = String(
      _pickLegacyCellValue(row, FIELD_MAP.futureCreations, headerMap) || '',
    ).trim();
    const futureParticipation = String(
      _pickLegacyCellValue(row, FIELD_MAP.futureParticipation, headerMap) || '',
    ).trim();
    const transportation = String(
      _pickLegacyCellValue(row, FIELD_MAP.transportation, headerMap) || '',
    ).trim();
    const pickup = String(
      _pickLegacyCellValue(row, FIELD_MAP.pickup, headerMap) || '',
    ).trim();
    const chiselRaw = String(
      _pickLegacyCellValue(row, FIELD_MAP.chiselRental, headerMap) || '',
    ).trim();
    const order = String(
      _pickLegacyCellValue(row, FIELD_MAP.order, headerMap) || '',
    ).trim();
    const firstMessage = String(
      _pickLegacyCellValue(row, FIELD_MAP.message, headerMap) || '',
    ).trim();
    const companion = String(
      _pickLegacyCellValue(row, FIELD_MAP.companion, headerMap) || '',
    ).trim();

    const normalizedName = _normalizeNameForMatching(rawName);
    const chiselRental =
      _normalizeLegacyBoolean(chiselRaw, false) ||
      /レンタル|希望|有|あり|○|◯|〇|1|true/i.test(chiselRaw)
        ? 'TRUE'
        : '';

    const hasAnyData = Boolean(
      normalizedName ||
      phone ||
      email ||
      address ||
      ageGroup ||
      gender ||
      dominantHand ||
      experience ||
      futureCreations ||
      futureParticipation ||
      transportation ||
      pickup ||
      chiselRental ||
      order ||
      firstMessage ||
      companion,
    );
    if (!hasAnyData) return;
    if (!normalizedName && !phone && !email) {
      warnings.push(
        `${sheet.getName()}!R${sourceRow}: 氏名/電話/メールが空のためスキップ`,
      );
      return;
    }

    entries.push({
      sheetName: sheet.getName(),
      sourceRow,
      date,
      name: rawName,
      normalizedName,
      phone,
      email,
      address,
      ageGroup,
      gender,
      dominantHand,
      experience,
      futureCreations,
      futureParticipation,
      transportation,
      pickup,
      chiselRental,
      order,
      firstMessage,
      companion,
    });
  });

  return { entries, warnings };
}

/**
 * 数値変換ヘルパー
 * @param {unknown} value
 * @returns {number | null}
 */
function _toFiniteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * 分を HH:mm へ変換
 * @param {number} totalMinutes
 * @returns {string}
 */
function _minutesToTimeString(totalMinutes) {
  const safe = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMinutes)));
  const hh = String(Math.floor(safe / 60)).padStart(2, '0');
  const mm = String(safe % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * HH:mm を分に変換
 * @param {string} time
 * @returns {number}
 */
function _timeStringToMinutes(time) {
  const match = String(time || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 0;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  return hh * 60 + mm;
}

/**
 * 生徒名簿から「正規化名 -> 生徒ID候補」の索引を構築
 * 元申込みシートの電話・メール情報による補助照合にも対応
 *
 * @param {{
 *   supplementalApplicationEntries?: Array<{normalizedName: string; phone: string; email: string}>;
 * }} [options]
 * @returns {{
 *   indexedStudentCount: number;
 *   resolve: (rawName: string) => { status: 'matched'; studentId: string; normalizedName: string } | { status: 'unmatched'; normalizedName: string } | { status: 'ambiguous'; normalizedName: string; candidates: string[] };
 * }}
 */
function _buildStudentNameResolver(options = {}) {
  const rosterSheet = SS_MANAGER.getSheet(CONSTANTS.SHEET_NAMES.ROSTER);
  if (!rosterSheet) {
    throw new Error('生徒名簿シートが見つかりません。');
  }

  const { headerMap, dataRows } = getSheetData(rosterSheet);
  const studentIdCol = _getHeaderIndexFromAnyMap(
    headerMap,
    CONSTANTS.HEADERS.ROSTER.STUDENT_ID,
  );
  const realNameCol = _getHeaderIndexFromAnyMap(
    headerMap,
    CONSTANTS.HEADERS.ROSTER.REAL_NAME,
  );
  const nicknameCol = _getHeaderIndexFromAnyMap(
    headerMap,
    CONSTANTS.HEADERS.ROSTER.NICKNAME,
  );
  const phoneCol = _getHeaderIndexFromAnyMap(
    headerMap,
    CONSTANTS.HEADERS.ROSTER.PHONE,
  );
  const emailCol = _getHeaderIndexFromAnyMap(
    headerMap,
    CONSTANTS.HEADERS.ROSTER.EMAIL,
  );

  if (
    studentIdCol === undefined ||
    realNameCol === undefined ||
    nicknameCol === undefined
  ) {
    throw new Error(
      '生徒名簿の必須列（生徒ID/本名/ニックネーム）が見つかりません。',
    );
  }

  /** @type {Map<string, Set<string>>} */
  const nameToIds = new Map();
  /** @type {Map<string, Set<string>>} */
  const phoneToIds = new Map();
  /** @type {Map<string, Set<string>>} */
  const emailToIds = new Map();
  /**
   * @param {unknown} name
   * @param {string} studentId
   */
  const addEntry = (name, studentId) => {
    const normalized = _normalizeNameForMatching(name);
    if (!normalized) return;
    if (!nameToIds.has(normalized)) {
      nameToIds.set(normalized, new Set());
    }
    nameToIds.get(normalized)?.add(studentId);
  };
  /**
   * @param {unknown} phone
   * @param {string} studentId
   */
  const addPhoneEntry = (phone, studentId) => {
    const normalized = _normalizeLegacyPhoneForMatching(phone);
    if (!normalized) return;
    if (!phoneToIds.has(normalized)) {
      phoneToIds.set(normalized, new Set());
    }
    phoneToIds.get(normalized)?.add(studentId);
  };
  /**
   * @param {unknown} email
   * @param {string} studentId
   */
  const addEmailEntry = (email, studentId) => {
    const normalized = _normalizeLegacyEmailForMatching(email);
    if (!normalized) return;
    if (!emailToIds.has(normalized)) {
      emailToIds.set(normalized, new Set());
    }
    emailToIds.get(normalized)?.add(studentId);
  };

  const studentIdSet = new Set();
  dataRows.forEach(row => {
    const studentId = String(row[studentIdCol] || '').trim();
    if (!studentId) return;
    studentIdSet.add(studentId);
    addEntry(row[realNameCol], studentId);
    addEntry(row[nicknameCol], studentId);
    if (phoneCol !== undefined) addPhoneEntry(row[phoneCol], studentId);
    if (emailCol !== undefined) addEmailEntry(row[emailCol], studentId);
  });

  /** @type {Map<string, Set<string>>} */
  const supplementalNameToIds = new Map();
  const supplementalEntries = Array.isArray(
    options.supplementalApplicationEntries,
  )
    ? options.supplementalApplicationEntries
    : [];
  supplementalEntries.forEach(entry => {
    const normalizedName = _normalizeNameForMatching(
      entry.normalizedName || '',
    );
    if (!normalizedName) return;

    /** @type {Set<string>} */
    const candidateIds = new Set();
    const normalizedPhone = _normalizeLegacyPhoneForMatching(entry.phone);
    if (normalizedPhone) {
      const hit = phoneToIds.get(normalizedPhone);
      hit?.forEach(studentId => candidateIds.add(studentId));
    }
    const normalizedEmail = _normalizeLegacyEmailForMatching(entry.email);
    if (normalizedEmail) {
      const hit = emailToIds.get(normalizedEmail);
      hit?.forEach(studentId => candidateIds.add(studentId));
    }
    if (candidateIds.size === 0) return;

    if (!supplementalNameToIds.has(normalizedName)) {
      supplementalNameToIds.set(normalizedName, new Set());
    }
    const target = supplementalNameToIds.get(normalizedName);
    candidateIds.forEach(studentId => target?.add(studentId));
  });

  /**
   * @param {string} normalizedName
   * @returns {string[]}
   */
  const getSupplementalCandidates = normalizedName => {
    const supplemental = supplementalNameToIds.get(normalizedName);
    return supplemental ? Array.from(supplemental) : [];
  };

  return {
    indexedStudentCount: studentIdSet.size,
    resolve: rawName => {
      const normalizedName = _normalizeNameForMatching(rawName);
      if (!normalizedName) {
        return { status: 'unmatched', normalizedName };
      }

      const candidates = nameToIds.get(normalizedName);
      const supplementalCandidates = getSupplementalCandidates(normalizedName);
      if (!candidates || candidates.size === 0) {
        if (supplementalCandidates.length === 1) {
          return {
            status: 'matched',
            studentId: supplementalCandidates[0],
            normalizedName,
          };
        }
        if (supplementalCandidates.length > 1) {
          return {
            status: 'ambiguous',
            normalizedName,
            candidates: supplementalCandidates,
          };
        }
        return { status: 'unmatched', normalizedName };
      }

      const candidateList = Array.from(candidates);
      if (candidateList.length === 1) {
        return {
          status: 'matched',
          studentId: candidateList[0],
          normalizedName,
        };
      }

      if (supplementalCandidates.length === 1) {
        return {
          status: 'matched',
          studentId: supplementalCandidates[0],
          normalizedName,
        };
      }
      if (supplementalCandidates.length > 1) {
        return {
          status: 'ambiguous',
          normalizedName,
          candidates: supplementalCandidates,
        };
      }

      return {
        status: 'ambiguous',
        normalizedName,
        candidates: candidateList,
      };
    },
  };
}

/**
 * 予約マトリクスのタイトルから教室名を推定
 * @param {string} title
 * @param {string} fallbackClassroom
 * @returns {string}
 */
function _extractClassroomFromLegacyTitle(title, fallbackClassroom) {
  const raw = String(title || '');
  const knownClassrooms = Object.values(CONSTANTS.CLASSROOMS || {});
  const matched = knownClassrooms.find(classroom => raw.includes(classroom));
  return matched || fallbackClassroom;
}

/**
 * 旧予約マトリクスの時刻軸を解析
 * @param {unknown[]} timeRowValues
 * @param {string[]} timeRowDisplayValues
 * @param {number} lastSlotColumnIndex
 * @returns {{ minSlotCol: number; maxSlotCol: number; perColumnMinutes: number; toMinutes: (col: number) => number } | null}
 */
function _extractLegacyGridTimeConfig(
  timeRowValues,
  timeRowDisplayValues,
  lastSlotColumnIndex,
) {
  /** @type {Array<{col:number; minutes:number}>} */
  const labeled = [];

  for (let col = 0; col <= lastSlotColumnIndex; col += 1) {
    const raw = timeRowValues[col];
    const display = String(timeRowDisplayValues[col] || '').trim();

    let timeString = _normalizeLegacyTime(raw);
    if (!timeString && /^\d{1,2}:\d{2}$/.test(display)) {
      timeString = _normalizeLegacyTime(display);
    }

    if (!timeString) continue;
    labeled.push({ col, minutes: _timeStringToMinutes(timeString) });
  }

  if (labeled.length < 2) {
    return null;
  }

  let perColumnMinutes = 30;
  let minColDiff = Number.MAX_SAFE_INTEGER;
  const perColumnCandidates = [];

  for (let i = 1; i < labeled.length; i += 1) {
    const colDiff = labeled[i].col - labeled[i - 1].col;
    const minuteDiff = labeled[i].minutes - labeled[i - 1].minutes;
    if (colDiff <= 0 || minuteDiff <= 0) continue;
    minColDiff = Math.min(minColDiff, colDiff);
    const perCol = minuteDiff / colDiff;
    if (Number.isFinite(perCol) && perCol > 0) {
      perColumnCandidates.push(perCol);
    }
  }

  if (perColumnCandidates.length > 0) {
    perColumnMinutes = Math.round(
      Math.min(...perColumnCandidates.filter(v => Number.isFinite(v))),
    );
  }
  if (!Number.isFinite(perColumnMinutes) || perColumnMinutes <= 0) {
    perColumnMinutes = 30;
  }
  if (!Number.isFinite(minColDiff) || minColDiff <= 0) {
    minColDiff = 1;
  }

  const minSlotCol = labeled[0].col;
  const maxSlotCol = Math.min(
    lastSlotColumnIndex,
    labeled[labeled.length - 1].col + (minColDiff - 1),
  );
  const baseCol = minSlotCol;
  const baseMinutes = labeled[0].minutes;

  return {
    minSlotCol,
    maxSlotCol,
    perColumnMinutes,
    toMinutes: col => baseMinutes + (col - baseCol) * perColumnMinutes,
  };
}

/**
 * 既存予約の重複判定キーを作成
 * @param {Pick<ReservationCore, 'studentId' | 'date' | 'classroom' | 'startTime' | 'endTime'>} reservation
 * @returns {string}
 */
function _createReservationIdentityKey(reservation) {
  return [
    String(reservation.studentId || ''),
    String(reservation.date || ''),
    String(reservation.classroom || ''),
    String(reservation.startTime || ''),
    String(reservation.endTime || ''),
  ].join('|');
}

/**
 * 旧フォーマットの予約データを現行フォーマットへ変換して取り込みます。
 * `dryRun: true`（デフォルト）で実行すると、書き込みなしで結果のみ確認できます。
 *
 * @param {Object} [config={}] - 取り込み設定
 * @param {string} [config.sourceSheetName] - 取り込み元シート名
 * @param {string} [config.sourceSpreadsheetId] - 取り込み元スプレッドシートID（省略時は同一ブック）
 * @param {number} [config.sourceHeaderRow=1] - ヘッダー行番号
 * @param {number} [config.sourceDataStartRow=2] - データ開始行番号
 * @param {Record<string, LegacyFieldMappingSpec>} [config.fieldMap] - 現行項目名に対する列指定（列名/0始まり列番号/候補配列）
 * @param {Record<string, any>} [config.defaults] - 取り込み時のデフォルト値
 * @param {boolean} [config.dryRun=true] - true: 書き込まない
 * @param {number} [config.maxRows=0] - 処理件数上限（0は全件）
 * @param {'skip'|'regenerate'|'error'} [config.duplicateReservationIdStrategy='skip'] - 予約ID重複時の動作
 * @param {boolean} [config.skipEmptyRows=true] - 空行をスキップするか
 * @param {boolean} [config.stopOnError=false] - 行エラーで即中断するか
 * @param {boolean} [config.autoCreateStudentOnNameUnmatched=false] - 生徒名未一致時に名簿へ仮登録するか
 * @param {boolean} [config.autoCreateStudentOnNameAmbiguous=false] - 生徒名複数一致時に名簿へ仮登録するか
 * @returns {LegacyImportResult} 取り込み結果サマリー
 */
export function importLegacyReservations(config = {}) {
  /** @type {Record<string, any>} */
  const input = /** @type {Record<string, any>} */ (config || {});

  const sourceSheetName = String(input['sourceSheetName'] || '').trim();
  const sourceSpreadsheetId = String(input['sourceSpreadsheetId'] || '').trim();
  const sourceHeaderRow = Math.max(1, Number(input['sourceHeaderRow'] || 1));
  const sourceDataStartRow = Math.max(
    sourceHeaderRow + 1,
    Number(input['sourceDataStartRow'] || sourceHeaderRow + 1),
  );
  const dryRun = input['dryRun'] !== false;
  const maxRows = Math.max(0, Number(input['maxRows'] || 0));
  const skipEmptyRows = input['skipEmptyRows'] !== false;
  const stopOnError = input['stopOnError'] === true;
  const autoCreateStudentOnNameUnmatched =
    input['autoCreateStudentOnNameUnmatched'] === true;
  const autoCreateStudentOnNameAmbiguous =
    input['autoCreateStudentOnNameAmbiguous'] === true;
  const autoCreateStudentOnNameMismatch =
    autoCreateStudentOnNameUnmatched || autoCreateStudentOnNameAmbiguous;
  const duplicateStrategyInput = String(
    input['duplicateReservationIdStrategy'] || 'skip',
  );
  const duplicateReservationIdStrategy = [
    'skip',
    'regenerate',
    'error',
  ].includes(duplicateStrategyInput)
    ? duplicateStrategyInput
    : 'skip';

  /** @type {Record<string, any>} */
  const defaults = /** @type {Record<string, any>} */ (input['defaults'] || {});
  /** @type {Record<string, any>} */
  const userFieldMap = /** @type {Record<string, any>} */ (
    input['fieldMap'] || {}
  );

  const { warnings, errorMessages, pushWarning, pushError, finalize } =
    _createMessageCollector('[importLegacyReservations]');

  if (!sourceSheetName) {
    return {
      success: false,
      dryRun,
      processed: 0,
      imported: 0,
      skipped: 0,
      errorCount: 1,
      warnings,
      errorMessages: ['sourceSheetName を指定してください。'],
      preview: [],
      resolvedFieldMap: {},
      supplementalApplicationEntryCount: 0,
      createdStudentCount: 0,
      createdStudentsPreview: [],
    };
  }

  try {
    const sourceSpreadsheet = sourceSpreadsheetId
      ? SpreadsheetApp.openById(sourceSpreadsheetId)
      : SpreadsheetApp.getActiveSpreadsheet();
    const sourceSheet = sourceSpreadsheet.getSheetByName(sourceSheetName);
    if (!sourceSheet) {
      throw new Error(`取り込み元シートが見つかりません: ${sourceSheetName}`);
    }

    const sourceLastRow = sourceSheet.getLastRow();
    const sourceLastColumn = sourceSheet.getLastColumn();
    if (sourceLastRow < sourceDataStartRow || sourceLastColumn <= 0) {
      return {
        success: true,
        dryRun,
        processed: 0,
        imported: 0,
        skipped: 0,
        errorCount: 0,
        warnings,
        errorMessages,
        preview: [],
        resolvedFieldMap: {},
        supplementalApplicationEntryCount: 0,
        createdStudentCount: 0,
        createdStudentsPreview: [],
      };
    }

    const sourceHeader = sourceSheet
      .getRange(sourceHeaderRow, 1, 1, sourceLastColumn)
      .getValues()[0];
    const sourceHeaderMap = _createTrimmedHeaderMap(sourceHeader);
    const resolvedFieldMap = _createResolvedLegacyFieldMap(
      userFieldMap,
      sourceHeaderMap,
    );

    const studentIdConfigured =
      resolvedFieldMap['studentId'] !== undefined ||
      _firstNotEmpty(defaults['studentId']) !== undefined;
    const studentNameConfigured =
      resolvedFieldMap['studentName'] !== undefined ||
      _firstNotEmpty(defaults['studentName']) !== undefined;
    const dateConfigured =
      resolvedFieldMap['date'] !== undefined ||
      _firstNotEmpty(defaults['date']) !== undefined;
    const classroomConfigured =
      resolvedFieldMap['classroom'] !== undefined ||
      _firstNotEmpty(defaults['classroom']) !== undefined;

    if (
      (!studentIdConfigured && !studentNameConfigured) ||
      !dateConfigured ||
      !classroomConfigured
    ) {
      throw new Error(
        'fieldMap もしくは defaults に studentId または studentName、date、classroom の設定が必要です。',
      );
    }
    const supplementalApplicationEntriesResult =
      _collectLegacyApplicationEntries(input);
    supplementalApplicationEntriesResult.warnings.forEach(pushWarning);
    const fallbackNameResolver = studentNameConfigured
      ? _buildStudentNameResolver({
          supplementalApplicationEntries:
            supplementalApplicationEntriesResult.entries,
        })
      : null;

    /** @type {Array<{studentId: string; name: string; normalizedName: string; reason: 'unmatched' | 'ambiguous'; sourceRow: number; candidates?: string[]}>} */
    const createdStudents = [];
    /** @type {Map<string, {studentId: string}>} */
    const createdStudentByNormalizedName = new Map();
    /** @type {RawSheetRow[]} */
    const createdStudentRowsToAppend = [];
    /** @type {Set<string>} */
    const existingStudentIds = new Set();
    /** @type {GoogleAppsScript.Spreadsheet.Sheet | null} */
    let rosterSheetForAutoCreate = null;
    /** @type {RawSheetRow} */
    let rosterHeaderForAutoCreate = [];
    /** @type {HeaderMapType | null} */
    let rosterHeaderMapForAutoCreate = null;
    /** @type {number | undefined} */
    let rosterStudentIdColForAutoCreate;
    /** @type {number | undefined} */
    let rosterRegistrationDateColForAutoCreate;
    /** @type {number | undefined} */
    let rosterNotesColForAutoCreate;

    if (autoCreateStudentOnNameMismatch) {
      if (!fallbackNameResolver) {
        throw new Error(
          '名簿自動追加を有効にする場合、studentName を fieldMap/defaults で指定してください。',
        );
      }
      rosterSheetForAutoCreate =
        SS_MANAGER.getSheet(CONSTANTS.SHEET_NAMES.ROSTER) || null;
      if (!rosterSheetForAutoCreate) {
        throw new Error('生徒名簿シートが見つかりません。');
      }

      const {
        header: rosterHeader,
        headerMap: rosterHeaderMap,
        dataRows: rosterDataRows,
      } = getSheetData(rosterSheetForAutoCreate);
      if (!Array.isArray(rosterHeader)) {
        throw new Error('生徒名簿シートのヘッダー取得に失敗しました。');
      }

      rosterHeaderForAutoCreate = rosterHeader;
      rosterHeaderMapForAutoCreate = rosterHeaderMap;
      rosterStudentIdColForAutoCreate = _getHeaderIndexFromAnyMap(
        rosterHeaderMap,
        CONSTANTS.HEADERS.ROSTER.STUDENT_ID,
      );
      rosterRegistrationDateColForAutoCreate = _getHeaderIndexFromAnyMap(
        rosterHeaderMap,
        CONSTANTS.HEADERS.ROSTER.REGISTRATION_DATE,
      );
      rosterNotesColForAutoCreate = _getHeaderIndexFromAnyMap(
        rosterHeaderMap,
        CONSTANTS.HEADERS.ROSTER.NOTES,
      );

      if (rosterStudentIdColForAutoCreate === undefined) {
        throw new Error('生徒名簿シートの「生徒ID」列が見つかりません。');
      }
      const rosterStudentIdColIndex = rosterStudentIdColForAutoCreate;

      rosterDataRows.forEach(row => {
        const studentId = String(row[rosterStudentIdColIndex] || '').trim();
        if (studentId) existingStudentIds.add(studentId);
      });
    }

    const dataRowCount = sourceLastRow - sourceDataStartRow + 1;
    const fetchRowCount =
      maxRows > 0 ? Math.min(maxRows, dataRowCount) : dataRowCount;
    const sourceRows = sourceSheet
      .getRange(sourceDataStartRow, 1, fetchRowCount, sourceLastColumn)
      .getValues();

    const targetSheet = SS_MANAGER.getSheet(CONSTANTS.SHEET_NAMES.RESERVATIONS);
    if (!targetSheet) {
      throw new Error('予約記録シートが見つかりません。');
    }
    const {
      header: targetHeader,
      headerMap: targetHeaderMap,
      dataRows,
    } = getSheetData(targetSheet);

    const reservationIdCol = targetHeader.indexOf(
      CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID,
    );
    if (reservationIdCol === -1) {
      throw new Error('予約記録シートの「予約ID」列が見つかりません。');
    }

    const existingReservationIds = new Set(
      dataRows.map(row => String(row[reservationIdCol] || '')).filter(Boolean),
    );
    const scheduleLookup = _buildScheduleLookupForLegacyImport();

    /** @type {RawSheetRow[]} */
    const rowsToAppend = [];
    /** @type {Array<{sourceRow: number, reservationId: string, studentId: string, date: string, classroom: string, status: string}>} */
    const preview = [];

    let processed = 0;
    let imported = 0;
    let skipped = 0;

    /**
     * 名簿の仮登録生徒IDを作成（user_UUID）
     * @returns {string}
     */
    const generateCreatedStudentId = () => {
      let studentId = `user_${Utilities.getUuid()}`;
      while (existingStudentIds.has(studentId)) {
        studentId = `user_${Utilities.getUuid()}`;
      }
      existingStudentIds.add(studentId);
      return studentId;
    };

    /**
     * 未一致/複数一致の名前を名簿へ仮登録して生徒IDを返す
     * @param {{ studentName: string; normalizedName: string; reason: 'unmatched' | 'ambiguous'; candidates?: string[]; sourceRowNumber: number }} params
     * @returns {string}
     */
    const ensureCreatedStudent = params => {
      const normalizedName =
        params.normalizedName || _normalizeNameForMatching(params.studentName);
      const key = normalizedName || `raw:${params.studentName}`;
      const already = createdStudentByNormalizedName.get(key);
      if (already?.studentId) {
        return already.studentId;
      }

      const studentId = generateCreatedStudentId();
      const reasonLabel =
        params.reason === 'ambiguous' ? '名簿複数一致' : '名簿未一致';
      const noteSuffix =
        params.reason === 'ambiguous' && Array.isArray(params.candidates)
          ? ` 候補: ${params.candidates.slice(0, 20).join(',')}`
          : '';
      const note = `[legacy-import] ${reasonLabel}${noteSuffix} / 元名: ${params.studentName} / 正規化名: ${
        normalizedName || '-'
      } / 取り込み行: ${params.sourceRowNumber}`;

      createdStudentByNormalizedName.set(key, { studentId });
      /** @type {{studentId: string; name: string; normalizedName: string; reason: 'unmatched' | 'ambiguous'; sourceRow: number; candidates?: string[]}} */
      const createdStudent = {
        studentId,
        name: params.studentName,
        normalizedName,
        reason: params.reason,
        sourceRow: params.sourceRowNumber,
      };
      if (Array.isArray(params.candidates) && params.candidates.length > 0) {
        createdStudent.candidates = params.candidates;
      }
      createdStudents.push(createdStudent);

      if (!dryRun && rosterHeaderMapForAutoCreate) {
        /** @type {UserCore} */
        const provisionalUser = {
          studentId,
          phone: '',
          realName: params.studentName,
          nickname: params.studentName,
          notes: note,
        };
        const provisionalRow = convertUserToRow(
          provisionalUser,
          rosterHeaderMapForAutoCreate,
        );
        const rowToAppend = Array(rosterHeaderForAutoCreate.length).fill('');
        for (
          let colIndex = 0;
          colIndex < Math.min(provisionalRow.length, rowToAppend.length);
          colIndex += 1
        ) {
          rowToAppend[colIndex] = provisionalRow[colIndex];
        }
        if (rosterRegistrationDateColForAutoCreate !== undefined) {
          rowToAppend[rosterRegistrationDateColForAutoCreate] = new Date();
        }
        if (rosterNotesColForAutoCreate !== undefined) {
          rowToAppend[rosterNotesColForAutoCreate] = note;
        }
        createdStudentRowsToAppend.push(rowToAppend);
      }

      pushWarning(
        `行${params.sourceRowNumber}: 生徒名「${params.studentName}」を名簿に仮登録${
          dryRun ? '予定' : ''
        }（studentId=${studentId}, reason=${reasonLabel}）`,
      );
      return studentId;
    };

    sourceRows.forEach((sourceRow, index) => {
      const sourceRowNumber = sourceDataStartRow + index;

      if (
        skipEmptyRows &&
        sourceRow.every(
          cell => cell === '' || cell === null || cell === undefined,
        )
      ) {
        skipped++;
        return;
      }

      processed++;
      try {
        /**
         * @param {string} field
         * @returns {unknown}
         */
        const getValue = field =>
          _pickLegacyCellValue(
            sourceRow,
            resolvedFieldMap[field],
            sourceHeaderMap,
          );

        let studentId = String(
          _firstNotEmpty(getValue('studentId'), defaults['studentId']) || '',
        ).trim();
        const studentName = String(
          _firstNotEmpty(getValue('studentName'), defaults['studentName']) ||
            '',
        ).trim();
        if (!studentId && studentName && fallbackNameResolver) {
          const resolvedByName = fallbackNameResolver.resolve(studentName);
          if (resolvedByName.status === 'matched') {
            studentId = resolvedByName.studentId;
          } else if (resolvedByName.status === 'ambiguous') {
            if (autoCreateStudentOnNameAmbiguous) {
              studentId = ensureCreatedStudent({
                studentName,
                normalizedName: resolvedByName.normalizedName,
                reason: 'ambiguous',
                candidates: resolvedByName.candidates,
                sourceRowNumber,
              });
            } else {
              skipped++;
              pushWarning(
                `行${sourceRowNumber}: 生徒名が複数一致のためスキップ（name=${studentName}, candidates=${resolvedByName.candidates.join(',')})`,
              );
              return;
            }
          } else {
            if (autoCreateStudentOnNameUnmatched) {
              studentId = ensureCreatedStudent({
                studentName,
                normalizedName: resolvedByName.normalizedName,
                reason: 'unmatched',
                sourceRowNumber,
              });
            } else {
              skipped++;
              pushWarning(
                `行${sourceRowNumber}: 生徒名が名簿に見つからないためスキップ（name=${studentName})`,
              );
              return;
            }
          }
        }
        const date = _normalizeLegacyDate(
          _firstNotEmpty(getValue('date'), defaults['date']),
        );
        const classroom = String(
          _firstNotEmpty(getValue('classroom'), defaults['classroom']) || '',
        ).trim();

        if (!studentId || !date || !classroom) {
          skipped++;
          pushWarning(
            `行${sourceRowNumber}: 必須項目不足のためスキップ（studentId=${studentId || '-'}, studentName=${studentName || '-'}, date=${date || '-'}, classroom=${classroom || '-'})`,
          );
          return;
        }

        const scheduleKey = `${date}_${classroom}`;
        const scheduleInfo = scheduleLookup.get(scheduleKey);

        let reservationId = String(
          _firstNotEmpty(getValue('reservationId')) || '',
        ).trim();
        if (!reservationId) {
          reservationId = `legacy-${Utilities.getUuid()}`;
        }

        if (existingReservationIds.has(reservationId)) {
          if (duplicateReservationIdStrategy === 'skip') {
            skipped++;
            pushWarning(
              `行${sourceRowNumber}: 予約ID重複のためスキップ (${reservationId})`,
            );
            return;
          }
          if (duplicateReservationIdStrategy === 'error') {
            throw new Error(`予約IDが重複しています: ${reservationId}`);
          }
          reservationId = `legacy-${Utilities.getUuid()}`;
        }
        existingReservationIds.add(reservationId);

        let lessonId = String(
          _firstNotEmpty(
            getValue('lessonId'),
            defaults['lessonId'],
            scheduleInfo?.lessonId,
          ) || '',
        ).trim();
        if (!lessonId) {
          lessonId = `legacy_${date}_${_sanitizeLegacyClassroomKey(classroom) || 'classroom'}_${sourceRowNumber}`;
        }

        const startTime = _normalizeLegacyTime(
          _firstNotEmpty(
            getValue('startTime'),
            defaults['startTime'],
            scheduleInfo?.startTime,
          ),
        );
        const endTime = _normalizeLegacyTime(
          _firstNotEmpty(
            getValue('endTime'),
            defaults['endTime'],
            scheduleInfo?.endTime,
          ),
        );
        const status = _normalizeLegacyStatus(
          _firstNotEmpty(getValue('status'), defaults['status']),
          CONSTANTS.STATUS.COMPLETED,
        );
        const venue = String(
          _firstNotEmpty(
            getValue('venue'),
            defaults['venue'],
            scheduleInfo?.venue,
          ) || '',
        ).trim();
        const chiselRental = _normalizeLegacyBoolean(
          _firstNotEmpty(getValue('chiselRental'), defaults['chiselRental']),
          false,
        );
        const firstLecture = _normalizeLegacyBoolean(
          _firstNotEmpty(getValue('firstLecture'), defaults['firstLecture']),
          false,
        );
        const transportation = String(
          _firstNotEmpty(
            getValue('transportation'),
            defaults['transportation'],
          ) || '',
        ).trim();
        const pickup = String(
          _firstNotEmpty(getValue('pickup'), defaults['pickup']) || '',
        ).trim();
        const sessionNote = String(
          _firstNotEmpty(getValue('sessionNote'), defaults['sessionNote']) ||
            '',
        );
        const order = String(
          _firstNotEmpty(getValue('order'), defaults['order']) || '',
        );
        const messageToTeacher = String(
          _firstNotEmpty(
            getValue('messageToTeacher'),
            defaults['messageToTeacher'],
          ) || '',
        );
        const accountingSource = _firstNotEmpty(
          getValue('accountingDetails'),
          defaults['accountingDetails'],
        );
        const accountingDetails =
          _parseLegacyAccountingDetails(accountingSource);
        if (
          typeof accountingSource === 'string' &&
          accountingSource.trim() &&
          !accountingDetails
        ) {
          pushWarning(
            `行${sourceRowNumber}: 会計詳細のJSONパースに失敗したため空で取り込みます`,
          );
        }

        /** @type {ReservationCore} */
        const reservation = {
          reservationId,
          lessonId,
          studentId,
          date,
          classroom,
          status,
          venue: venue || undefined,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          chiselRental,
          firstLecture,
          transportation: transportation || undefined,
          pickup: pickup || undefined,
          sessionNote: sessionNote || undefined,
          order: order || undefined,
          messageToTeacher: messageToTeacher || undefined,
          accountingDetails,
        };

        const convertedRow = convertReservationToRow(
          reservation,
          targetHeaderMap,
          targetHeader,
        );
        rowsToAppend.push(convertedRow);
        imported++;

        if (preview.length < 20) {
          preview.push({
            sourceRow: sourceRowNumber,
            reservationId,
            studentId,
            date,
            classroom,
            status,
          });
        }
      } catch (error) {
        skipped++;
        pushError(`行${sourceRowNumber}: ${error.message}`);
        if (stopOnError) {
          throw error;
        }
      }
    });

    if (!dryRun && createdStudentRowsToAppend.length > 0) {
      if (
        !rosterSheetForAutoCreate ||
        !Array.isArray(rosterHeaderForAutoCreate)
      ) {
        throw new Error(
          '生徒名簿への追加準備に失敗したため処理を中断しました。',
        );
      }

      const chunkSize = 200;
      let writeRow = rosterSheetForAutoCreate.getLastRow() + 1;
      for (let i = 0; i < createdStudentRowsToAppend.length; i += chunkSize) {
        const chunk = createdStudentRowsToAppend.slice(i, i + chunkSize);
        rosterSheetForAutoCreate
          .getRange(writeRow, 1, chunk.length, rosterHeaderForAutoCreate.length)
          .setValues(chunk);
        writeRow += chunk.length;
      }
      SpreadsheetApp.flush();
      rebuildAllStudentsCache();
    }

    if (!dryRun && rowsToAppend.length > 0) {
      const chunkSize = 200;
      let writeRow = targetSheet.getLastRow() + 1;
      for (let i = 0; i < rowsToAppend.length; i += chunkSize) {
        const chunk = rowsToAppend.slice(i, i + chunkSize);
        targetSheet
          .getRange(writeRow, 1, chunk.length, targetHeader.length)
          .setValues(chunk);
        writeRow += chunk.length;
      }
      SpreadsheetApp.flush();

      rebuildAllReservationsCache();
      syncReservationIdsToSchedule();

      logActivity('SYSTEM', 'よやくキャッシュ移行', '成功', {
        message: `旧フォーマット取り込み完了（${imported}件）`,
        details: {
          sourceSheetName,
          sourceSpreadsheetId: sourceSpreadsheetId || 'current',
          processed,
          imported,
          skipped,
          warnings: warnings.length,
          errors: errorMessages.length,
        },
      });
    }

    finalize();
    return {
      success: errorMessages.length === 0,
      dryRun,
      processed,
      imported,
      skipped,
      errorCount: errorMessages.length,
      warnings,
      errorMessages,
      preview,
      resolvedFieldMap,
      supplementalApplicationEntryCount:
        supplementalApplicationEntriesResult.entries.length,
      createdStudentCount: createdStudents.length,
      createdStudentsPreview: createdStudents.slice(0, 200),
    };
  } catch (error) {
    const message = `旧フォーマット取り込みでエラー: ${error.message}`;
    Logger.log(`[importLegacyReservations] ${message}`);
    finalize();
    return {
      success: false,
      dryRun,
      processed: 0,
      imported: 0,
      skipped: 0,
      errorCount: 1,
      warnings,
      errorMessages: [...errorMessages, message],
      preview: [],
      resolvedFieldMap: {},
      supplementalApplicationEntryCount: 0,
      createdStudentCount: 0,
      createdStudentsPreview: [],
    };
  }
}

/**
 * 旧つくばCSV取り込みの実行リクエストを構築
 * @param {Object} [config={}]
 * @param {boolean} [dryRun=true]
 * @returns {{importConfig: Record<string, any>; sourceSheetName: string}}
 */
function _buildTsukubaLegacyCsvImportRequest(config = {}, dryRun = true) {
  /** @type {Record<string, any>} */
  const input = /** @type {Record<string, any>} */ (config || {});
  const sourceSpreadsheetId = String(
    _firstNotEmpty(
      input['sourceSpreadsheetId'],
      TSUKUBA_LEGACY_CSV_IMPORT_DEFAULTS.sourceSpreadsheetId,
    ) || '',
  ).trim();
  const sourceSpreadsheet = sourceSpreadsheetId
    ? SpreadsheetApp.openById(sourceSpreadsheetId)
    : SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheetNameCandidates = Array.isArray(
    input['sourceSheetNameCandidates'],
  )
    ? input['sourceSheetNameCandidates']
    : TSUKUBA_LEGACY_CSV_IMPORT_DEFAULTS.sourceSheetNameCandidates;
  const sourceSheetName = _resolveLegacyCsvSourceSheetName(
    sourceSpreadsheet,
    input['sourceSheetName'],
    sourceSheetNameCandidates,
  );

  const defaultClassroom =
    String(
      _firstNotEmpty(
        input['defaultClassroom'],
        TSUKUBA_LEGACY_CSV_IMPORT_DEFAULTS.defaultClassroom,
      ) || '',
    ).trim() || CONSTANTS.CLASSROOMS.TSUKUBA;
  const defaultStatus = _normalizeLegacyStatus(
    _firstNotEmpty(
      input['defaultStatus'],
      TSUKUBA_LEGACY_CSV_IMPORT_DEFAULTS.defaultStatus,
    ),
    CONSTANTS.STATUS.COMPLETED,
  );
  const defaultStartTime = _normalizeLegacyTime(
    _firstNotEmpty(input['defaultStartTime']),
  );
  const defaultEndTime = _normalizeLegacyTime(
    _firstNotEmpty(input['defaultEndTime']),
  );
  const defaultScheduleClassroomType =
    String(
      _firstNotEmpty(
        input['defaultScheduleClassroomType'],
        TSUKUBA_LEGACY_CSV_IMPORT_DEFAULTS.defaultScheduleClassroomType,
      ) || '',
    ).trim() || CONSTANTS.CLASSROOM_TYPES.TIME_FULL;
  const defaultScheduleStatus =
    String(
      _firstNotEmpty(
        input['defaultScheduleStatus'],
        TSUKUBA_LEGACY_CSV_IMPORT_DEFAULTS.defaultScheduleStatus,
      ) || '',
    ).trim() || CONSTANTS.SCHEDULE_STATUS.COMPLETED;
  const matchingApplicationSpreadsheetId = String(
    _firstNotEmpty(
      input['matchingApplicationSpreadsheetId'],
      TSUKUBA_LEGACY_CSV_IMPORT_DEFAULTS.matchingApplicationSpreadsheetId,
    ) || '',
  ).trim();
  const matchingApplicationSheetName = String(
    _firstNotEmpty(input['matchingApplicationSheetName']) || '',
  ).trim();
  const matchingApplicationSheetId = _firstNotEmpty(
    input['matchingApplicationSheetId'],
    TSUKUBA_LEGACY_CSV_IMPORT_DEFAULTS.matchingApplicationSheetId,
  );
  // CSV取り込みでは旧IDを再生成するのがデフォルト
  // （importLegacyReservations 本体のデフォルト 'skip' とは意図的に異なる）
  const duplicateReservationIdStrategyCandidate = String(
    input['duplicateReservationIdStrategy'] || 'regenerate',
  );
  const duplicateReservationIdStrategy = [
    'skip',
    'regenerate',
    'error',
  ].includes(duplicateReservationIdStrategyCandidate)
    ? duplicateReservationIdStrategyCandidate
    : 'regenerate';

  /** @type {Record<string, any>} */
  const defaults = {
    classroom: defaultClassroom,
    status: defaultStatus,
  };
  if (defaultStartTime) defaults['startTime'] = defaultStartTime;
  if (defaultEndTime) defaults['endTime'] = defaultEndTime;

  /** @type {Record<string, any>} */
  const fieldMap = {
    studentName: ['name', 'normalizedName', '氏名', '名前'],
    date: ['date', '日付'],
    classroom: ['classroom', '教室'],
    startTime: ['startTime', '開始時刻', '開始時間'],
    endTime: ['endTime', '終了時刻', '終了時間'],
    status: ['status', 'ステータス'],
    firstLecture: ['firstLecture', '初回'],
    chiselRental: ['chiselRental', '彫刻刀レンタル'],
    transportation: ['transportation', '来場手段'],
    pickup: ['pickup', '送迎'],
    sessionNote: ['note', 'sessionNote', '備考'],
    order: ['order', '注文'],
    messageToTeacher: ['messageToTeacher', 'メッセージ'],
  };
  const customFieldMap =
    typeof input['fieldMap'] === 'object' && input['fieldMap']
      ? /** @type {Record<string, any>} */ (input['fieldMap'])
      : {};
  Object.keys(customFieldMap).forEach(key => {
    fieldMap[key] = customFieldMap[key];
  });

  return {
    importConfig: {
      sourceSpreadsheetId,
      sourceSheetName,
      sourceHeaderRow: Math.max(1, Number(input['sourceHeaderRow'] || 1)),
      sourceDataStartRow: Math.max(2, Number(input['sourceDataStartRow'] || 2)),
      dryRun,
      maxRows: Math.max(0, Number(input['maxRows'] || 0)),
      duplicateReservationIdStrategy,
      skipEmptyRows: input['skipEmptyRows'] !== false,
      stopOnError: input['stopOnError'] === true,
      fieldMap,
      defaults,
      defaultScheduleClassroomType,
      defaultScheduleStatus,
      defaultScheduleVenue: String(input['defaultScheduleVenue'] || '').trim(),
      defaultScheduleNote: String(input['defaultScheduleNote'] || '').trim(),
      defaultFirstStart: _normalizeLegacyTime(
        _firstNotEmpty(input['defaultFirstStart']),
      ),
      defaultFirstEnd: _normalizeLegacyTime(
        _firstNotEmpty(input['defaultFirstEnd']),
      ),
      defaultSecondStart: _normalizeLegacyTime(
        _firstNotEmpty(input['defaultSecondStart']),
      ),
      defaultSecondEnd: _normalizeLegacyTime(
        _firstNotEmpty(input['defaultSecondEnd']),
      ),
      defaultBeginnerStart: _normalizeLegacyTime(
        _firstNotEmpty(input['defaultBeginnerStart']),
      ),
      defaultTotalCapacity: _firstNotEmpty(input['defaultTotalCapacity']),
      defaultBeginnerCapacity: _firstNotEmpty(input['defaultBeginnerCapacity']),
      matchingApplicationSpreadsheetId,
      matchingApplicationSheetName,
      matchingApplicationSheetId,
      matchingApplicationHeaderRow: Math.max(
        1,
        Number(input['matchingApplicationHeaderRow'] || 1),
      ),
      matchingApplicationDataStartRow: Math.max(
        2,
        Number(input['matchingApplicationDataStartRow'] || 2),
      ),
      matchingApplicationNameFieldMap: _firstNotEmpty(
        input['matchingApplicationNameFieldMap'],
      ),
      matchingApplicationPhoneFieldMap: _firstNotEmpty(
        input['matchingApplicationPhoneFieldMap'],
      ),
      matchingApplicationEmailFieldMap: _firstNotEmpty(
        input['matchingApplicationEmailFieldMap'],
      ),
      autoCreateStudentOnNameUnmatched: true,
      autoCreateStudentOnNameAmbiguous: true,
    },
    sourceSheetName,
  };
}

/**
 * 旧沼津CSV取り込みの実行リクエストを構築
 * - 候補シート名は厳密一致で解決し、誤シート取り込みを防ぐ
 * @param {Object} [config={}]
 * @param {boolean} [dryRun=true]
 * @returns {{importConfig: Record<string, any>; sourceSheetName: string}}
 */
function _buildNumazuLegacyCsvImportRequest(config = {}, dryRun = true) {
  /** @type {Record<string, any>} */
  const input = /** @type {Record<string, any>} */ (config || {});
  const sourceSpreadsheetId = String(
    _firstNotEmpty(
      input['sourceSpreadsheetId'],
      NUMAZU_LEGACY_CSV_IMPORT_DEFAULTS.sourceSpreadsheetId,
    ) || '',
  ).trim();
  const sourceSpreadsheet = sourceSpreadsheetId
    ? SpreadsheetApp.openById(sourceSpreadsheetId)
    : SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheetNameCandidates =
    Array.isArray(input['sourceSheetNameCandidates']) &&
    input['sourceSheetNameCandidates'].length > 0
      ? input['sourceSheetNameCandidates']
      : NUMAZU_LEGACY_CSV_IMPORT_DEFAULTS.sourceSheetNameCandidates;
  const sourceSheetName = String(input['sourceSheetName'] || '').trim()
    ? String(input['sourceSheetName'] || '').trim()
    : _resolveLegacyCsvSourceSheetNameStrict(
        sourceSpreadsheet,
        sourceSheetNameCandidates,
      );

  return _buildTsukubaLegacyCsvImportRequest(
    {
      ...NUMAZU_LEGACY_CSV_IMPORT_DEFAULTS,
      ...input,
      sourceSpreadsheetId,
      sourceSheetName,
      sourceSheetNameCandidates,
      defaultClassroom: String(
        _firstNotEmpty(
          input['defaultClassroom'],
          NUMAZU_LEGACY_CSV_IMPORT_DEFAULTS.defaultClassroom,
        ) || '',
      ).trim(),
      defaultStatus: _firstNotEmpty(
        input['defaultStatus'],
        NUMAZU_LEGACY_CSV_IMPORT_DEFAULTS.defaultStatus,
      ),
      defaultScheduleClassroomType: _firstNotEmpty(
        input['defaultScheduleClassroomType'],
        NUMAZU_LEGACY_CSV_IMPORT_DEFAULTS.defaultScheduleClassroomType,
      ),
      defaultScheduleStatus: _firstNotEmpty(
        input['defaultScheduleStatus'],
        NUMAZU_LEGACY_CSV_IMPORT_DEFAULTS.defaultScheduleStatus,
      ),
    },
    dryRun,
  );
}

/**
 * 旧つくばCSV（整形済み）を dry run で解析する
 * @param {Record<string, unknown>} [config={}]
 * @returns {Record<string, unknown>}
 */
export function dryRunTsukubaLegacyCsvImport(config = {}) {
  const request = _buildTsukubaLegacyCsvImportRequest(config, true);
  const scheduleSync = _ensureScheduleRowsForLegacyCsvImport(
    request.importConfig,
    true,
  );
  if (!scheduleSync.success) {
    return {
      success: false,
      dryRun: true,
      processed: 0,
      imported: 0,
      skipped: 0,
      errorCount: 1,
      warnings: scheduleSync.warnings || [],
      errorMessages: scheduleSync.errorMessages || [
        '日程マスタ補完のdry runに失敗しました。',
      ],
      preview: [],
      resolvedFieldMap: {},
      sourceSheetName: request.sourceSheetName,
      scheduleSync,
    };
  }

  const result = /** @type {Record<string, any>} */ (
    importLegacyReservations(request.importConfig)
  );
  result['sourceSheetName'] = request.sourceSheetName;
  result['scheduleSync'] = scheduleSync;
  Logger.log(
    `[dryRunTsukubaLegacyCsvImport] source=${request.sourceSheetName}`,
  );
  Logger.log(
    `[dryRunTsukubaLegacyCsvImport] ${JSON.stringify(result, null, 2)}`,
  );
  return result;
}

/**
 * 旧つくばCSV（整形済み）を本取り込みする
 * @param {Object} [config={}]
 * @returns {Record<string, unknown> | null}
 */
export function runTsukubaLegacyCsvImport(config = {}) {
  const request = _buildTsukubaLegacyCsvImportRequest(config, false);
  const schedulePreview = /** @type {Record<string, any>} */ (
    _ensureScheduleRowsForLegacyCsvImport(request.importConfig, true)
  );
  if (!schedulePreview['success']) {
    SpreadsheetApp.getUi().alert(
      `日程マスタ補完の事前確認に失敗しました。\n${(schedulePreview['errorMessages'] || []).join('\n')}`,
    );
    return schedulePreview;
  }

  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '旧CSV予約の取り込み',
    [
      `取り込み元: ${request.sourceSheetName}`,
      `日程追加予定: ${schedulePreview['addedCount']}件（既存: ${schedulePreview['existingCount']}件）`,
      '',
      'CSVの日付は先に日程マスタへ補完します（教室形式: 時間制・全日 / 時刻・定員は空欄可）。',
      '生徒名で名簿照合して予約記録へ追加します。',
      '先に dryRunTsukubaLegacyCsvImport を実行し、件数を確認してください。',
      '実行しますか？',
    ].join('\n'),
    ui.ButtonSet.OK_CANCEL,
  );
  if (response !== ui.Button.OK) {
    ui.alert('取り込みをキャンセルしました。');
    return null;
  }

  const scheduleSync = /** @type {Record<string, any>} */ (
    _ensureScheduleRowsForLegacyCsvImport(request.importConfig, false)
  );
  if (!scheduleSync['success']) {
    ui.alert(
      `日程マスタ補完に失敗したため、予約取り込みを中断しました。\n${(scheduleSync['errorMessages'] || []).join('\n')}`,
    );
    return scheduleSync;
  }

  const result = /** @type {Record<string, any>} */ (
    importLegacyReservations(request.importConfig)
  );
  result['sourceSheetName'] = request.sourceSheetName;
  result['scheduleSync'] = scheduleSync;
  Logger.log(`[runTsukubaLegacyCsvImport] ${JSON.stringify(result, null, 2)}`);
  ui.alert(
    `取り込み完了\n元シート: ${request.sourceSheetName}\n日程追加: ${scheduleSync['addedCount']}件（既存: ${scheduleSync['existingCount']}件）\n名簿仮登録: ${result['createdStudentCount']}件\n成功: ${result['success']}\n処理: ${result['processed']}件\n取り込み: ${result['imported']}件\nスキップ: ${result['skipped']}件\nエラー: ${result['errorCount']}件`,
  );
  return result;
}

/**
 * 旧沼津CSV（整形済み）を dry run で解析する（引数なし実行用）
 * @param {Object} [config={}]
 * @returns {Record<string, unknown>}
 */
export function dryRunNumazuLegacyCsvImportAuto(config = {}) {
  try {
    const request = _buildNumazuLegacyCsvImportRequest(config, true);
    const scheduleSync = _ensureScheduleRowsForLegacyCsvImport(
      request.importConfig,
      true,
    );
    const importResult = /** @type {Record<string, any>} */ (
      scheduleSync.success
        ? importLegacyReservations(request.importConfig)
        : {
            success: false,
            dryRun: true,
            processed: 0,
            imported: 0,
            skipped: 0,
            errorCount: 1,
            warnings: scheduleSync.warnings || [],
            errorMessages: scheduleSync.errorMessages || [
              '日程マスタ補完dry runに失敗したため、予約取り込みdry runをスキップしました。',
            ],
            preview: [],
            resolvedFieldMap: {},
          }
    );

    const result = {
      success:
        Boolean(scheduleSync.success) && Boolean(importResult['success']),
      mode: 'dryRun',
      sourceSheetName: request.sourceSheetName,
      scheduleSync,
      importResult,
    };
    Logger.log(
      `[dryRunNumazuLegacyCsvImportAuto] ${JSON.stringify(result, null, 2)}`,
    );
    return result;
  } catch (error) {
    const result = {
      success: false,
      mode: 'dryRun',
      errorMessages: [`沼津CSV取り込み dry run でエラー: ${error.message}`],
    };
    Logger.log(
      `[dryRunNumazuLegacyCsvImportAuto] ${JSON.stringify(result, null, 2)}`,
    );
    return result;
  }
}

/**
 * 旧沼津CSV（整形済み）を本取り込みする（引数なし実行用）
 * @param {Object} [config={}]
 * @returns {Record<string, unknown>}
 */
export function runNumazuLegacyCsvImportAuto(config = {}) {
  try {
    const request = _buildNumazuLegacyCsvImportRequest(config, false);
    const scheduleSync = _ensureScheduleRowsForLegacyCsvImport(
      request.importConfig,
      false,
    );
    if (!scheduleSync.success) {
      const result = {
        success: false,
        mode: 'run',
        sourceSheetName: request.sourceSheetName,
        scheduleSync,
        importResult: null,
      };
      Logger.log(
        `[runNumazuLegacyCsvImportAuto] ${JSON.stringify(result, null, 2)}`,
      );
      return result;
    }

    const importResult = /** @type {Record<string, any>} */ (
      importLegacyReservations(request.importConfig)
    );
    importResult['sourceSheetName'] = request.sourceSheetName;
    importResult['scheduleSync'] = scheduleSync;

    const result = {
      success:
        Boolean(scheduleSync.success) && Boolean(importResult['success']),
      mode: 'run',
      sourceSheetName: request.sourceSheetName,
      scheduleSync,
      importResult,
    };
    Logger.log(
      `[runNumazuLegacyCsvImportAuto] ${JSON.stringify(result, null, 2)}`,
    );
    return result;
  } catch (error) {
    const result = {
      success: false,
      mode: 'run',
      errorMessages: [`沼津CSV取り込み実行でエラー: ${error.message}`],
    };
    Logger.log(
      `[runNumazuLegacyCsvImportAuto] ${JSON.stringify(result, null, 2)}`,
    );
    return result;
  }
}

/**
 * 既に取り込み済みの旧CSV予約について、元申込みシート（電話/メール）を使って生徒IDを再照合します。
 * - 対象は原則「生徒名簿 notes に [legacy-import] がある仮登録生徒ID」の予約
 * - dryRun=true では更新せず、差し替え候補のみ返します
 *
 * @param {Object} [config={}]
 * @param {boolean} [config.dryRun=true]
 * @param {string} [config.matchingApplicationSpreadsheetId]
 * @param {string} [config.matchingApplicationSheetName]
 * @param {number} [config.matchingApplicationSheetId]
 * @param {number} [config.matchingApplicationHeaderRow=1]
 * @param {number} [config.matchingApplicationDataStartRow=2]
 * @param {LegacyFieldMappingSpec | ReadonlyArray<LegacyFieldMappingSpec>} [config.matchingApplicationNameFieldMap]
 * @param {LegacyFieldMappingSpec | ReadonlyArray<LegacyFieldMappingSpec>} [config.matchingApplicationPhoneFieldMap]
 * @param {LegacyFieldMappingSpec | ReadonlyArray<LegacyFieldMappingSpec>} [config.matchingApplicationEmailFieldMap]
 * @param {boolean} [config.onlyLegacyImportedStudents=true] - true の場合、[legacy-import] 付与生徒のみ再照合
 * @param {'skip'|'error'} [config.duplicateIdentityStrategy='skip'] - 生徒ID差し替え後の重複時の扱い
 * @param {boolean} [config.updateRosterNotes=true] - 本実行時に名簿notesへ再照合結果を追記するか
 * @param {string} [config.targetClassroom] - 指定時、その教室の予約のみ更新
 * @param {string} [config.targetDateFrom] - 指定時、この日付以上のみ更新（YYYY-MM-DD）
 * @param {string} [config.targetDateTo] - 指定時、この日付以下のみ更新（YYYY-MM-DD）
 * @returns {Record<string, unknown>}
 */
export function reconcileLegacyImportedReservationsByApplication(config = {}) {
  /** @type {Record<string, any>} */
  const input = /** @type {Record<string, any>} */ (config || {});
  const dryRun = input['dryRun'] !== false;
  const onlyLegacyImportedStudents =
    input['onlyLegacyImportedStudents'] !== false;
  const updateRosterNotes = input['updateRosterNotes'] !== false;
  const duplicateIdentityStrategy =
    String(input['duplicateIdentityStrategy'] || 'skip') === 'error'
      ? 'error'
      : 'skip';
  const targetClassroom = String(input['targetClassroom'] || '').trim();
  const targetDateFrom = _normalizeLegacyDate(input['targetDateFrom']);
  const targetDateTo = _normalizeLegacyDate(input['targetDateTo']);

  const { warnings, errorMessages, pushWarning, pushError, finalize } =
    _createMessageCollector(
      '[reconcileLegacyImportedReservationsByApplication]',
      300,
    );

  try {
    /** @type {Record<string, any>} */
    const applicationConfig = {
      matchingApplicationSpreadsheetId: String(
        _firstNotEmpty(
          input['matchingApplicationSpreadsheetId'],
          TSUKUBA_LEGACY_CSV_IMPORT_DEFAULTS.matchingApplicationSpreadsheetId,
        ) || '',
      ).trim(),
      matchingApplicationSheetName: String(
        _firstNotEmpty(input['matchingApplicationSheetName']) || '',
      ).trim(),
      matchingApplicationSheetId: _firstNotEmpty(
        input['matchingApplicationSheetId'],
        TSUKUBA_LEGACY_CSV_IMPORT_DEFAULTS.matchingApplicationSheetId,
      ),
      matchingApplicationHeaderRow: Math.max(
        1,
        Number(input['matchingApplicationHeaderRow'] || 1),
      ),
      matchingApplicationDataStartRow: Math.max(
        2,
        Number(input['matchingApplicationDataStartRow'] || 2),
      ),
      matchingApplicationNameFieldMap: _firstNotEmpty(
        input['matchingApplicationNameFieldMap'],
      ),
      matchingApplicationPhoneFieldMap: _firstNotEmpty(
        input['matchingApplicationPhoneFieldMap'],
      ),
      matchingApplicationEmailFieldMap: _firstNotEmpty(
        input['matchingApplicationEmailFieldMap'],
      ),
    };
    const applicationEntriesResult =
      _collectLegacyApplicationEntries(applicationConfig);
    applicationEntriesResult.warnings.forEach(pushWarning);
    const applicationEntries = applicationEntriesResult.entries;
    if (applicationEntries.length === 0) {
      pushWarning(
        '元申込みシートから照合用データ（氏名+電話/メール）を取得できませんでした。',
      );
    }

    const rosterSheet = SS_MANAGER.getSheet(CONSTANTS.SHEET_NAMES.ROSTER);
    if (!rosterSheet) {
      throw new Error('生徒名簿シートが見つかりません。');
    }
    const { headerMap: rosterHeaderMap, dataRows: rosterRows } =
      getSheetData(rosterSheet);
    const rosterStudentIdCol = _getHeaderIndexFromAnyMap(
      rosterHeaderMap,
      CONSTANTS.HEADERS.ROSTER.STUDENT_ID,
    );
    const rosterRealNameCol = _getHeaderIndexFromAnyMap(
      rosterHeaderMap,
      CONSTANTS.HEADERS.ROSTER.REAL_NAME,
    );
    const rosterNicknameCol = _getHeaderIndexFromAnyMap(
      rosterHeaderMap,
      CONSTANTS.HEADERS.ROSTER.NICKNAME,
    );
    const rosterPhoneCol = _getHeaderIndexFromAnyMap(
      rosterHeaderMap,
      CONSTANTS.HEADERS.ROSTER.PHONE,
    );
    const rosterEmailCol = _getHeaderIndexFromAnyMap(
      rosterHeaderMap,
      CONSTANTS.HEADERS.ROSTER.EMAIL,
    );
    const rosterNotesCol = _getHeaderIndexFromAnyMap(
      rosterHeaderMap,
      CONSTANTS.HEADERS.ROSTER.NOTES,
    );
    if (
      rosterStudentIdCol === undefined ||
      rosterRealNameCol === undefined ||
      rosterNicknameCol === undefined
    ) {
      throw new Error(
        '生徒名簿の必須列（生徒ID/本名/ニックネーム）が見つかりません。',
      );
    }

    /** @type {Map<string, {rowNumber: number; realName: string; nickname: string; notes: string; normalizedName: string; isLegacyImport: boolean}>} */
    const studentInfoById = new Map();
    /** @type {Map<string, Set<string>>} */
    const phoneToIds = new Map();
    /** @type {Map<string, Set<string>>} */
    const emailToIds = new Map();

    /**
     * @param {Map<string, Set<string>>} map
     * @param {string} key
     * @param {string} studentId
     */
    const addCandidate = (map, key, studentId) => {
      if (!key || !studentId) return;
      if (!map.has(key)) {
        map.set(key, new Set());
      }
      map.get(key)?.add(studentId);
    };

    rosterRows.forEach((row, index) => {
      const studentId = String(row[rosterStudentIdCol] || '').trim();
      if (!studentId) return;
      const realName = String(row[rosterRealNameCol] || '').trim();
      const nickname = String(row[rosterNicknameCol] || '').trim();
      const notes =
        rosterNotesCol !== undefined ? String(row[rosterNotesCol] || '') : '';
      const normalizedName =
        _normalizeNameForMatching(realName) ||
        _normalizeNameForMatching(nickname);
      const isLegacyImport = notes.includes('[legacy-import]');

      studentInfoById.set(studentId, {
        rowNumber: index + 2,
        realName,
        nickname,
        notes,
        normalizedName,
        isLegacyImport,
      });

      if (isLegacyImport) return;
      if (rosterPhoneCol !== undefined) {
        addCandidate(
          phoneToIds,
          _normalizeLegacyPhoneForMatching(row[rosterPhoneCol]),
          studentId,
        );
      }
      if (rosterEmailCol !== undefined) {
        addCandidate(
          emailToIds,
          _normalizeLegacyEmailForMatching(row[rosterEmailCol]),
          studentId,
        );
      }
    });

    /** @type {Map<string, Set<string>>} */
    const applicationCandidatesByName = new Map();
    applicationEntries.forEach(entry => {
      const normalizedName = _normalizeNameForMatching(entry.normalizedName);
      if (!normalizedName) return;
      const candidates = new Set();
      const normalizedPhone = _normalizeLegacyPhoneForMatching(entry.phone);
      if (normalizedPhone) {
        phoneToIds.get(normalizedPhone)?.forEach(id => candidates.add(id));
      }
      const normalizedEmail = _normalizeLegacyEmailForMatching(entry.email);
      if (normalizedEmail) {
        emailToIds.get(normalizedEmail)?.forEach(id => candidates.add(id));
      }
      if (candidates.size === 0) return;
      if (!applicationCandidatesByName.has(normalizedName)) {
        applicationCandidatesByName.set(normalizedName, new Set());
      }
      const target = applicationCandidatesByName.get(normalizedName);
      candidates.forEach(id => target?.add(id));
    });

    /** @type {Map<string, string>} */
    const remapByStudentId = new Map();
    /** @type {Array<{legacyStudentId: string; legacyName: string; normalizedName: string; matchedStudentId: string; matchedStudentName: string; reason: string}>} */
    const matchedMappings = [];
    /** @type {Array<{legacyStudentId: string; legacyName: string; normalizedName: string; candidates: string[]}>} */
    const ambiguousMappings = [];
    /** @type {Array<{legacyStudentId: string; legacyName: string; normalizedName: string}>} */
    const unmatchedMappings = [];

    studentInfoById.forEach((studentInfo, legacyStudentId) => {
      if (onlyLegacyImportedStudents && !studentInfo.isLegacyImport) return;
      const normalizedName = studentInfo.normalizedName;
      if (!normalizedName) {
        unmatchedMappings.push({
          legacyStudentId,
          legacyName: studentInfo.realName || studentInfo.nickname || '',
          normalizedName: '',
        });
        return;
      }
      const candidates = Array.from(
        applicationCandidatesByName.get(normalizedName) || [],
      ).filter(candidateId => candidateId !== legacyStudentId);
      if (candidates.length === 1) {
        const matchedStudentId = candidates[0];
        remapByStudentId.set(legacyStudentId, matchedStudentId);
        const matchedStudentInfo = studentInfoById.get(matchedStudentId);
        matchedMappings.push({
          legacyStudentId,
          legacyName: studentInfo.realName || studentInfo.nickname || '',
          normalizedName,
          matchedStudentId,
          matchedStudentName:
            matchedStudentInfo?.realName || matchedStudentInfo?.nickname || '',
          reason: 'application-phone-email',
        });
        return;
      }
      if (candidates.length > 1) {
        ambiguousMappings.push({
          legacyStudentId,
          legacyName: studentInfo.realName || studentInfo.nickname || '',
          normalizedName,
          candidates,
        });
        return;
      }
      unmatchedMappings.push({
        legacyStudentId,
        legacyName: studentInfo.realName || studentInfo.nickname || '',
        normalizedName,
      });
    });

    const reservationsSheet = SS_MANAGER.getSheet(
      CONSTANTS.SHEET_NAMES.RESERVATIONS,
    );
    if (!reservationsSheet) {
      throw new Error('予約記録シートが見つかりません。');
    }
    const { headerMap: reservationsHeaderMap, dataRows: reservationRows } =
      getSheetData(reservationsSheet);
    const reservationIdCol = _getHeaderIndexFromAnyMap(
      reservationsHeaderMap,
      CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID,
    );
    const reservationStudentIdCol = _getHeaderIndexFromAnyMap(
      reservationsHeaderMap,
      CONSTANTS.HEADERS.RESERVATIONS.STUDENT_ID,
    );
    const reservationDateCol = _getHeaderIndexFromAnyMap(
      reservationsHeaderMap,
      CONSTANTS.HEADERS.RESERVATIONS.DATE,
    );
    const reservationClassroomCol = _getHeaderIndexFromAnyMap(
      reservationsHeaderMap,
      CONSTANTS.HEADERS.RESERVATIONS.CLASSROOM,
    );
    const reservationStartTimeCol = _getHeaderIndexFromAnyMap(
      reservationsHeaderMap,
      CONSTANTS.HEADERS.RESERVATIONS.START_TIME,
    );
    const reservationEndTimeCol = _getHeaderIndexFromAnyMap(
      reservationsHeaderMap,
      CONSTANTS.HEADERS.RESERVATIONS.END_TIME,
    );
    if (
      reservationIdCol === undefined ||
      reservationStudentIdCol === undefined ||
      reservationDateCol === undefined ||
      reservationClassroomCol === undefined ||
      reservationStartTimeCol === undefined ||
      reservationEndTimeCol === undefined
    ) {
      throw new Error('予約記録シートの必須列が不足しています。');
    }

    /**
     * @param {RawSheetRow} row
     * @returns {string}
     */
    const buildIdentityFromRow = row =>
      _createReservationIdentityKey({
        studentId: String(row[reservationStudentIdCol] || '').trim(),
        date: _normalizeLegacyDate(row[reservationDateCol]),
        classroom: String(row[reservationClassroomCol] || '').trim(),
        startTime: _normalizeLegacyTime(row[reservationStartTimeCol]),
        endTime: _normalizeLegacyTime(row[reservationEndTimeCol]),
      });

    /** @type {Map<string, number>} */
    const identityCounts = new Map();
    reservationRows.forEach(row => {
      const key = buildIdentityFromRow(row);
      if (!key) return;
      identityCounts.set(key, (identityCounts.get(key) || 0) + 1);
    });

    /** @type {Array<{rowNumber: number; rowIndex: number; reservationId: string; fromStudentId: string; toStudentId: string; date: string; classroom: string; startTime: string; endTime: string; oldIdentityKey: string; newIdentityKey: string}>} */
    const reservationUpdates = [];
    /** @type {Array<{rowNumber: number; reservationId: string; fromStudentId: string; toStudentId: string; reason: string}>} */
    const skippedConflicts = [];

    reservationRows.forEach((row, index) => {
      const fromStudentId = String(row[reservationStudentIdCol] || '').trim();
      if (!fromStudentId) return;
      const toStudentId = remapByStudentId.get(fromStudentId);
      if (!toStudentId || fromStudentId === toStudentId) return;

      const date = _normalizeLegacyDate(row[reservationDateCol]);
      if (targetDateFrom && date && date < targetDateFrom) return;
      if (targetDateTo && date && date > targetDateTo) return;

      const classroom = String(row[reservationClassroomCol] || '').trim();
      if (targetClassroom && classroom !== targetClassroom) return;

      const startTime = _normalizeLegacyTime(row[reservationStartTimeCol]);
      const endTime = _normalizeLegacyTime(row[reservationEndTimeCol]);
      const reservationId = String(row[reservationIdCol] || '').trim();
      const oldIdentityKey = buildIdentityFromRow(row);
      const newIdentityKey = _createReservationIdentityKey({
        studentId: toStudentId,
        date,
        classroom,
        startTime,
        endTime,
      });

      if (oldIdentityKey) {
        identityCounts.set(
          oldIdentityKey,
          (identityCounts.get(oldIdentityKey) || 1) - 1,
        );
      }
      const conflictCount = newIdentityKey
        ? identityCounts.get(newIdentityKey) || 0
        : 0;
      if (newIdentityKey && conflictCount > 0) {
        if (oldIdentityKey) {
          identityCounts.set(
            oldIdentityKey,
            (identityCounts.get(oldIdentityKey) || 0) + 1,
          );
        }
        if (duplicateIdentityStrategy === 'error') {
          throw new Error(
            `行${index + 2}: 生徒ID差し替え後に重複予約になるため中断（reservationId=${reservationId}, from=${fromStudentId}, to=${toStudentId}）`,
          );
        }
        skippedConflicts.push({
          rowNumber: index + 2,
          reservationId,
          fromStudentId,
          toStudentId,
          reason: 'duplicateIdentity',
        });
        return;
      }
      if (newIdentityKey) {
        identityCounts.set(
          newIdentityKey,
          (identityCounts.get(newIdentityKey) || 0) + 1,
        );
      }

      reservationUpdates.push({
        rowNumber: index + 2,
        rowIndex: index,
        reservationId,
        fromStudentId,
        toStudentId,
        date,
        classroom,
        startTime,
        endTime,
        oldIdentityKey,
        newIdentityKey,
      });
    });

    if (!dryRun && reservationUpdates.length > 0) {
      const studentIdValues = reservationRows.map(row => [
        row[reservationStudentIdCol],
      ]);
      reservationUpdates.forEach(update => {
        studentIdValues[update.rowIndex][0] = update.toStudentId;
      });
      reservationsSheet
        .getRange(2, reservationStudentIdCol + 1, studentIdValues.length, 1)
        .setValues(studentIdValues);

      if (updateRosterNotes && rosterNotesCol !== undefined) {
        const notesValues = rosterRows.map(row => [row[rosterNotesCol] || '']);
        const now = Utilities.formatDate(
          new Date(),
          CONSTANTS.TIMEZONE,
          'yyyy-MM-dd HH:mm:ss',
        );
        const updatedLegacyIds = new Set(
          reservationUpdates.map(update => update.fromStudentId),
        );
        updatedLegacyIds.forEach(legacyStudentId => {
          const studentInfo = studentInfoById.get(legacyStudentId);
          const remappedStudentId = remapByStudentId.get(legacyStudentId);
          if (!studentInfo || !remappedStudentId) return;
          const rowIndex = studentInfo.rowNumber - 2;
          if (rowIndex < 0 || rowIndex >= notesValues.length) return;
          const current = String(notesValues[rowIndex][0] || '');
          const append = `[legacy-import] reassigned_to=${remappedStudentId} at=${now}`;
          notesValues[rowIndex][0] = current ? `${current}\n${append}` : append;
        });
        rosterSheet
          .getRange(2, rosterNotesCol + 1, notesValues.length, 1)
          .setValues(notesValues);
      }

      SpreadsheetApp.flush();
      rebuildAllReservationsCache();
      rebuildAllStudentsCache();
    }

    finalize();
    return {
      success: errorMessages.length === 0,
      dryRun,
      onlyLegacyImportedStudents,
      targetClassroom: targetClassroom || undefined,
      targetDateFrom: targetDateFrom || undefined,
      targetDateTo: targetDateTo || undefined,
      duplicateIdentityStrategy,
      applicationEntryCount: applicationEntries.length,
      provisionalStudentCount: onlyLegacyImportedStudents
        ? Array.from(studentInfoById.values()).filter(v => v.isLegacyImport)
            .length
        : studentInfoById.size,
      matchedStudentCount: matchedMappings.length,
      ambiguousStudentCount: ambiguousMappings.length,
      unmatchedStudentCount: unmatchedMappings.length,
      reservationUpdatedCount: reservationUpdates.length,
      skippedConflictCount: skippedConflicts.length,
      warnings,
      errorMessages,
      mappingPreview: matchedMappings.slice(0, 200),
      ambiguousMappings: ambiguousMappings.slice(0, 200),
      unmatchedMappings: unmatchedMappings.slice(0, 200),
      reservationUpdatePreview: reservationUpdates
        .slice(0, 200)
        .map(update => ({
          rowNumber: update.rowNumber,
          reservationId: update.reservationId,
          fromStudentId: update.fromStudentId,
          toStudentId: update.toStudentId,
          date: update.date,
          classroom: update.classroom,
          startTime: update.startTime,
          endTime: update.endTime,
        })),
      skippedConflicts: skippedConflicts.slice(0, 200),
    };
  } catch (error) {
    const message = `旧CSV取り込み済み予約の再照合でエラー: ${error.message}`;
    Logger.log(`[reconcileLegacyImportedReservationsByApplication] ${message}`);
    pushError(message);
    finalize();
    return {
      success: false,
      dryRun,
      applicationEntryCount: 0,
      provisionalStudentCount: 0,
      matchedStudentCount: 0,
      ambiguousStudentCount: 0,
      unmatchedStudentCount: 0,
      reservationUpdatedCount: 0,
      skippedConflictCount: 0,
      warnings,
      errorMessages,
      mappingPreview: [],
      ambiguousMappings: [],
      unmatchedMappings: [],
      reservationUpdatePreview: [],
      skippedConflicts: [],
    };
  }
}

/**
 * 取り込み済み旧CSV予約の生徒ID再照合を dry run で確認します。
 * @param {Record<string, unknown>} [config={}]
 * @returns {Record<string, unknown>}
 */
export function dryRunReconcileLegacyImportedReservationsByApplication(
  config = {},
) {
  const result = /** @type {Record<string, unknown>} */ (
    reconcileLegacyImportedReservationsByApplication({
      ...config,
      dryRun: true,
    })
  );
  Logger.log(
    `[dryRunReconcileLegacyImportedReservationsByApplication] ${JSON.stringify(result, null, 2)}`,
  );
  return result;
}

/**
 * 取り込み済み旧CSV予約の生徒ID再照合を実行します（確認ダイアログ付き）。
 * @param {Object} [config={}]
 * @returns {Object | null}
 */
export function runReconcileLegacyImportedReservationsByApplication(
  config = {},
) {
  const preview = /** @type {Record<string, any>} */ (
    reconcileLegacyImportedReservationsByApplication({
      ...config,
      dryRun: true,
    })
  );
  if (!preview['success']) {
    SpreadsheetApp.getUi().alert(
      `再照合の事前確認に失敗しました。\n${(preview['errorMessages'] || []).join('\n')}`,
    );
    return preview;
  }

  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '取り込み済み予約の再照合',
    [
      `照合候補（生徒）: ${preview['matchedStudentCount']}件`,
      `更新予定（予約）: ${preview['reservationUpdatedCount']}件`,
      `競合スキップ予定: ${preview['skippedConflictCount']}件`,
      '',
      '元申込みシート（電話/メール）を使って、予約記録の生徒IDを差し替えます。',
      '実行しますか？',
    ].join('\n'),
    ui.ButtonSet.OK_CANCEL,
  );
  if (response !== ui.Button.OK) {
    ui.alert('再照合をキャンセルしました。');
    return null;
  }

  const result = /** @type {Record<string, any>} */ (
    reconcileLegacyImportedReservationsByApplication({
      ...config,
      dryRun: false,
    })
  );
  Logger.log(
    `[runReconcileLegacyImportedReservationsByApplication] ${JSON.stringify(result, null, 2)}`,
  );
  ui.alert(
    `再照合完了\n成功: ${result['success']}\n照合候補（生徒）: ${result['matchedStudentCount']}件\n更新（予約）: ${result['reservationUpdatedCount']}件\n競合スキップ: ${result['skippedConflictCount']}件\n曖昧: ${result['ambiguousStudentCount']}件\n未一致: ${result['unmatchedStudentCount']}件`,
  );
  return result;
}

/**
 * 元申込みシート（2023年1〜9月）から生徒名簿を補完します。
 * - 電話/メール/氏名で突き合わせ
 * - 既存名簿は空欄項目を優先して補完
 * - 一意に突き合わせできない場合はレポートに残す
 *
 * @param {Object} [config={}]
 * @param {boolean} [config.dryRun=true]
 * @param {string} [config.sourceSpreadsheetId]
 * @param {string[]} [config.sourceSheetNames]
 * @param {Array<RegExp | string>} [config.sourceSheetNameRegexes]
 * @param {number} [config.sourceHeaderRow=1]
 * @param {number} [config.sourceDataStartRow=2]
 * @param {boolean} [config.onlyFillEmpty=true]
 * @param {boolean} [config.createUnmatched=true]
 * @returns {Record<string, unknown>}
 */
export function syncLegacyApplicationProfilesToRoster(config = {}) {
  /** @type {Record<string, any>} */
  const input = /** @type {Record<string, any>} */ (config || {});
  const dryRun = input['dryRun'] !== false;
  const onlyFillEmpty = input['onlyFillEmpty'] !== false;
  const createUnmatched = input['createUnmatched'] !== false;
  const sourceHeaderRow = Math.max(1, Number(input['sourceHeaderRow'] || 1));
  const sourceDataStartRow = Math.max(
    sourceHeaderRow + 1,
    Number(input['sourceDataStartRow'] || sourceHeaderRow + 1),
  );

  const { warnings, errorMessages, pushWarning, pushError, finalize } =
    _createMessageCollector('[syncLegacyApplicationProfilesToRoster]', 300);

  try {
    const sourceSpreadsheetId = String(
      _firstNotEmpty(
        input['sourceSpreadsheetId'],
        TSUKUBA_LEGACY_APPLICATION_ROSTER_2023_PRESET.sourceSpreadsheetId,
      ) || '',
    ).trim();
    const sourceSpreadsheet = sourceSpreadsheetId
      ? SpreadsheetApp.openById(sourceSpreadsheetId)
      : SpreadsheetApp.getActiveSpreadsheet();

    /** @type {string[]} */
    let sourceSheetNames = [];
    const sourceSheetNamesInput = input['sourceSheetNames'];
    if (
      Array.isArray(sourceSheetNamesInput) &&
      sourceSheetNamesInput.length > 0
    ) {
      sourceSheetNames = sourceSheetNamesInput.map(name =>
        String(name || '').trim(),
      );
    } else {
      const regexes = Array.isArray(input['sourceSheetNameRegexes'])
        ? input['sourceSheetNameRegexes']
        : TSUKUBA_LEGACY_APPLICATION_ROSTER_2023_PRESET.sourceSheetNameRegexes;
      sourceSheetNames = _resolveLegacyApplicationSourceSheetNames2023(
        sourceSpreadsheet,
        regexes,
      );
    }
    if (sourceSheetNames.length === 0) {
      throw new Error('元申込みシートが解決できませんでした。');
    }

    /** @type {Array<{
     *   sheetName: string;
     *   sourceRow: number;
     *   date: string;
     *   name: string;
     *   normalizedName: string;
     *   phone: string;
     *   email: string;
     *   address: string;
     *   ageGroup: string;
     *   gender: string;
     *   dominantHand: string;
     *   experience: string;
     *   futureCreations: string;
     *   futureParticipation: string;
     *   transportation: string;
     *   pickup: string;
     *   chiselRental: string;
     *   order: string;
     *   firstMessage: string;
     *   companion: string;
     * }>} */
    const sourceEntries = [];
    sourceSheetNames.forEach(sheetName => {
      const sourceSheet = sourceSpreadsheet.getSheetByName(sheetName);
      if (!sourceSheet) {
        throw new Error(`元申込みシートが見つかりません: ${sheetName}`);
      }
      const collected = _collectLegacyApplicationProfilesFromSourceSheet(
        sourceSheet,
        sourceHeaderRow,
        sourceDataStartRow,
      );
      collected.warnings.forEach(pushWarning);
      sourceEntries.push(...collected.entries);
    });

    if (sourceEntries.length === 0) {
      return {
        success: true,
        dryRun,
        sourceSpreadsheetId: sourceSpreadsheetId || 'current',
        sourceSheetNames,
        sourceEntryCount: 0,
        matchedCount: 0,
        updatedStudentCount: 0,
        createdStudentCount: 0,
        ambiguousCount: 0,
        unmatchedCount: 0,
        possibleDuplicateCount: 0,
        warnings,
        errorMessages,
        preview: [],
        ambiguousEntries: [],
        unmatchedEntries: [],
        possibleDuplicates: [],
      };
    }

    const rosterSheet = SS_MANAGER.getSheet(CONSTANTS.SHEET_NAMES.ROSTER);
    if (!rosterSheet) {
      throw new Error('生徒名簿シートが見つかりません。');
    }
    const {
      header: rosterHeader,
      headerMap: rosterHeaderMap,
      dataRows: rosterRows,
    } = getSheetData(rosterSheet);
    const rosterStudentIdCol = _getHeaderIndexFromAnyMap(
      rosterHeaderMap,
      CONSTANTS.HEADERS.ROSTER.STUDENT_ID,
    );
    const rosterRealNameCol = _getHeaderIndexFromAnyMap(
      rosterHeaderMap,
      CONSTANTS.HEADERS.ROSTER.REAL_NAME,
    );
    const rosterNicknameCol = _getHeaderIndexFromAnyMap(
      rosterHeaderMap,
      CONSTANTS.HEADERS.ROSTER.NICKNAME,
    );
    const rosterPhoneCol = _getHeaderIndexFromAnyMap(
      rosterHeaderMap,
      CONSTANTS.HEADERS.ROSTER.PHONE,
    );
    const rosterEmailCol = _getHeaderIndexFromAnyMap(
      rosterHeaderMap,
      CONSTANTS.HEADERS.ROSTER.EMAIL,
    );
    const rosterAddressCol = _getHeaderIndexFromAnyMap(
      rosterHeaderMap,
      CONSTANTS.HEADERS.ROSTER.ADDRESS,
    );
    const rosterAgeGroupCol = _getHeaderIndexFromAnyMap(
      rosterHeaderMap,
      CONSTANTS.HEADERS.ROSTER.AGE_GROUP,
    );
    const rosterGenderCol = _getHeaderIndexFromAnyMap(
      rosterHeaderMap,
      CONSTANTS.HEADERS.ROSTER.GENDER,
    );
    const rosterDominantHandCol = _getHeaderIndexFromAnyMap(
      rosterHeaderMap,
      CONSTANTS.HEADERS.ROSTER.DOMINANT_HAND,
    );
    const rosterExperienceCol = _getHeaderIndexFromAnyMap(
      rosterHeaderMap,
      CONSTANTS.HEADERS.ROSTER.EXPERIENCE,
    );
    const rosterFutureCreationsCol = _getHeaderIndexFromAnyMap(
      rosterHeaderMap,
      CONSTANTS.HEADERS.ROSTER.FUTURE_CREATIONS,
    );
    const rosterFutureParticipationCol = _getHeaderIndexFromAnyMap(
      rosterHeaderMap,
      CONSTANTS.HEADERS.ROSTER.ATTENDANCE_INTENTION,
    );
    const rosterTransportationCol = _getHeaderIndexFromAnyMap(
      rosterHeaderMap,
      CONSTANTS.HEADERS.ROSTER.TRANSPORTATION,
    );
    const rosterPickupCol = _getHeaderIndexFromAnyMap(
      rosterHeaderMap,
      CONSTANTS.HEADERS.ROSTER.PICKUP,
    );
    const rosterChiselRentalCol = _getHeaderIndexFromAnyMap(
      rosterHeaderMap,
      CONSTANTS.HEADERS.ROSTER.CHISEL_RENTAL,
    );
    const rosterFirstMessageCol = _getHeaderIndexFromAnyMap(
      rosterHeaderMap,
      CONSTANTS.HEADERS.ROSTER.FIRST_MESSAGE,
    );
    const rosterCompanionCol = _getHeaderIndexFromAnyMap(
      rosterHeaderMap,
      CONSTANTS.HEADERS.ROSTER.COMPANION,
    );
    const rosterNotesCol = _getHeaderIndexFromAnyMap(
      rosterHeaderMap,
      CONSTANTS.HEADERS.ROSTER.NOTES,
    );
    const rosterRegistrationDateCol = _getHeaderIndexFromAnyMap(
      rosterHeaderMap,
      CONSTANTS.HEADERS.ROSTER.REGISTRATION_DATE,
    );

    if (
      rosterStudentIdCol === undefined ||
      rosterRealNameCol === undefined ||
      rosterNicknameCol === undefined
    ) {
      throw new Error(
        '生徒名簿の必須列（生徒ID/本名/ニックネーム）が見つかりません。',
      );
    }

    const mutableRosterRows = rosterRows.map(row => row.slice());
    const existingRosterRowCount = mutableRosterRows.length;
    /** @type {Map<string, number>} */
    const rosterRowIndexByStudentId = new Map();
    /** @type {Set<string>} */
    const existingStudentIds = new Set();
    /** @type {Map<string, Set<string>>} */
    const nameToIds = new Map();
    /** @type {Map<string, Set<string>>} */
    const phoneToIds = new Map();
    /** @type {Map<string, Set<string>>} */
    const emailToIds = new Map();

    /**
     * @param {Map<string, Set<string>>} map
     * @param {string} key
     * @param {string} studentId
     */
    const addMapEntry = (map, key, studentId) => {
      if (!key || !studentId) return;
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)?.add(studentId);
    };
    /**
     * @param {unknown} value
     * @returns {boolean}
     */
    const isBlank = value =>
      value === '' || value === null || value === undefined;
    /**
     * @param {string[]} values
     * @returns {string[]}
     */
    const uniq = values => Array.from(new Set(values.filter(Boolean)));
    /**
     * @returns {string}
     */
    const generateStudentId = () => {
      let studentId = `user_${Utilities.getUuid()}`;
      while (existingStudentIds.has(studentId)) {
        studentId = `user_${Utilities.getUuid()}`;
      }
      existingStudentIds.add(studentId);
      return studentId;
    };

    mutableRosterRows.forEach((row, rowIndex) => {
      const studentId = String(row[rosterStudentIdCol] || '').trim();
      if (!studentId) return;
      const realName = String(row[rosterRealNameCol] || '').trim();
      const nickname = String(row[rosterNicknameCol] || '').trim();

      existingStudentIds.add(studentId);
      rosterRowIndexByStudentId.set(studentId, rowIndex);
      addMapEntry(nameToIds, _normalizeNameForMatching(realName), studentId);
      addMapEntry(nameToIds, _normalizeNameForMatching(nickname), studentId);
      if (rosterPhoneCol !== undefined) {
        addMapEntry(
          phoneToIds,
          _normalizeLegacyPhoneForMatching(row[rosterPhoneCol]),
          studentId,
        );
      }
      if (rosterEmailCol !== undefined) {
        addMapEntry(
          emailToIds,
          _normalizeLegacyEmailForMatching(row[rosterEmailCol]),
          studentId,
        );
      }
    });

    /** @type {Set<number>} */
    const updatedRowIndexes = new Set();
    /** @type {RawSheetRow[]} */
    const newRowsToAppend = [];
    /** @type {Array<{studentId: string; name: string; source: string}>} */
    const createdStudents = [];
    /** @type {Array<{studentId: string; source: string; updatedFields: string[]}>} */
    const updatedStudents = [];
    /** @type {Array<{source: string; name: string; phone: string; email: string; candidates: string[]}>} */
    const ambiguousEntries = [];
    /** @type {Array<{source: string; name: string; phone: string; email: string; reason: string}>} */
    const unmatchedEntries = [];
    /** @type {Array<{source: string; targetStudentId: string; relatedStudentIds: string[]; reason: string}>} */
    const possibleDuplicates = [];

    sourceEntries.forEach(entry => {
      const normalizedName = entry.normalizedName;
      const nameIds = normalizedName
        ? Array.from(nameToIds.get(normalizedName) || [])
        : [];
      const phoneIds = entry.phone
        ? Array.from(phoneToIds.get(entry.phone) || [])
        : [];
      const emailIds = entry.email
        ? Array.from(emailToIds.get(entry.email) || [])
        : [];

      const phoneUnique = phoneIds.length === 1 ? phoneIds[0] : '';
      const emailUnique = emailIds.length === 1 ? emailIds[0] : '';
      let targetStudentId = '';
      let matchedBy = '';

      if (phoneUnique && emailUnique && phoneUnique === emailUnique) {
        targetStudentId = phoneUnique;
        matchedBy = 'phone+email';
      } else if (phoneUnique && (!emailUnique || emailUnique === phoneUnique)) {
        targetStudentId = phoneUnique;
        matchedBy = 'phone';
      } else if (emailUnique && (!phoneUnique || phoneUnique === emailUnique)) {
        targetStudentId = emailUnique;
        matchedBy = 'email';
      }

      if (!targetStudentId && nameIds.length === 1) {
        const nameOnlyId = nameIds[0];
        const phoneCompatible =
          phoneIds.length === 0 || phoneIds.includes(nameOnlyId);
        const emailCompatible =
          emailIds.length === 0 || emailIds.includes(nameOnlyId);
        if (phoneCompatible && emailCompatible) {
          targetStudentId = nameOnlyId;
          matchedBy = 'name';
        }
      }

      if (!targetStudentId) {
        const unionCandidates = uniq([...nameIds, ...phoneIds, ...emailIds]);
        if (unionCandidates.length > 1) {
          ambiguousEntries.push({
            source: `${entry.sheetName}!R${entry.sourceRow}`,
            name: entry.name,
            phone: entry.phone,
            email: entry.email,
            candidates: unionCandidates,
          });
          return;
        }
        if (unionCandidates.length === 1) {
          targetStudentId = unionCandidates[0];
          matchedBy = 'single-candidate';
        }
      }

      if (!targetStudentId) {
        const hasProfileData = Boolean(
          entry.phone ||
          entry.email ||
          entry.address ||
          entry.ageGroup ||
          entry.gender ||
          entry.dominantHand ||
          entry.experience ||
          entry.futureCreations ||
          entry.futureParticipation ||
          entry.transportation ||
          entry.pickup ||
          entry.chiselRental ||
          entry.order ||
          entry.firstMessage ||
          entry.companion,
        );
        if (!createUnmatched || !entry.name || !hasProfileData) {
          unmatchedEntries.push({
            source: `${entry.sheetName}!R${entry.sourceRow}`,
            name: entry.name,
            phone: entry.phone,
            email: entry.email,
            reason: 'no-match',
          });
          return;
        }

        const newStudentId = generateStudentId();
        const newRow = Array(rosterHeader.length).fill('');
        newRow[rosterStudentIdCol] = newStudentId;
        if (rosterPhoneCol !== undefined) newRow[rosterPhoneCol] = entry.phone;
        newRow[rosterRealNameCol] = entry.name;
        newRow[rosterNicknameCol] = entry.name;
        if (rosterEmailCol !== undefined) newRow[rosterEmailCol] = entry.email;
        if (rosterAddressCol !== undefined)
          newRow[rosterAddressCol] = entry.address;
        if (rosterAgeGroupCol !== undefined)
          newRow[rosterAgeGroupCol] = entry.ageGroup;
        if (rosterGenderCol !== undefined)
          newRow[rosterGenderCol] = entry.gender;
        if (rosterDominantHandCol !== undefined)
          newRow[rosterDominantHandCol] = entry.dominantHand;
        if (rosterExperienceCol !== undefined)
          newRow[rosterExperienceCol] = entry.experience;
        if (rosterFutureCreationsCol !== undefined)
          newRow[rosterFutureCreationsCol] = entry.futureCreations;
        if (rosterFutureParticipationCol !== undefined)
          newRow[rosterFutureParticipationCol] = entry.futureParticipation;
        if (rosterTransportationCol !== undefined)
          newRow[rosterTransportationCol] = entry.transportation;
        if (rosterPickupCol !== undefined)
          newRow[rosterPickupCol] = entry.pickup;
        if (rosterChiselRentalCol !== undefined)
          newRow[rosterChiselRentalCol] = entry.chiselRental;
        if (rosterFirstMessageCol !== undefined)
          newRow[rosterFirstMessageCol] = entry.firstMessage;
        if (rosterCompanionCol !== undefined)
          newRow[rosterCompanionCol] = entry.companion;
        if (rosterRegistrationDateCol !== undefined)
          newRow[rosterRegistrationDateCol] = new Date();
        if (rosterNotesCol !== undefined) {
          newRow[rosterNotesCol] =
            `[legacy-application-2023] created from ${entry.sheetName}!R${entry.sourceRow}`;
        }

        const appendedRowIndex = mutableRosterRows.length;
        mutableRosterRows.push(newRow);
        rosterRowIndexByStudentId.set(newStudentId, appendedRowIndex);
        newRowsToAppend.push(newRow);
        createdStudents.push({
          studentId: newStudentId,
          name: entry.name,
          source: `${entry.sheetName}!R${entry.sourceRow}`,
        });

        addMapEntry(nameToIds, normalizedName, newStudentId);
        addMapEntry(phoneToIds, entry.phone, newStudentId);
        addMapEntry(emailToIds, entry.email, newStudentId);
        return;
      }

      const targetRowIndex = rosterRowIndexByStudentId.get(targetStudentId);
      if (targetRowIndex === undefined) {
        unmatchedEntries.push({
          source: `${entry.sheetName}!R${entry.sourceRow}`,
          name: entry.name,
          phone: entry.phone,
          email: entry.email,
          reason: `target-not-found:${targetStudentId}`,
        });
        return;
      }

      const targetRow = mutableRosterRows[targetRowIndex];
      /** @type {string[]} */
      const updatedFields = [];
      /**
       * @param {number | undefined} colIndex
       * @param {string} value
       * @param {string} fieldName
       */
      const applyField = (colIndex, value, fieldName) => {
        if (colIndex === undefined) return;
        if (!value) return;
        const current = targetRow[colIndex];
        if (onlyFillEmpty && !isBlank(current)) return;
        if (!onlyFillEmpty && String(current || '') === value) return;
        targetRow[colIndex] = value;
        updatedRowIndexes.add(targetRowIndex);
        updatedFields.push(fieldName);
      };

      applyField(rosterPhoneCol, entry.phone, 'phone');
      applyField(rosterEmailCol, entry.email, 'email');
      applyField(rosterAddressCol, entry.address, 'address');
      applyField(rosterAgeGroupCol, entry.ageGroup, 'ageGroup');
      applyField(rosterGenderCol, entry.gender, 'gender');
      applyField(rosterDominantHandCol, entry.dominantHand, 'dominantHand');
      applyField(rosterExperienceCol, entry.experience, 'experience');
      applyField(
        rosterFutureCreationsCol,
        entry.futureCreations,
        'futureCreations',
      );
      applyField(
        rosterFutureParticipationCol,
        entry.futureParticipation,
        'futureParticipation',
      );
      applyField(
        rosterTransportationCol,
        entry.transportation,
        'transportation',
      );
      applyField(rosterPickupCol, entry.pickup, 'pickup');
      applyField(rosterChiselRentalCol, entry.chiselRental, 'chiselRental');
      applyField(rosterFirstMessageCol, entry.firstMessage, 'firstMessage');
      applyField(rosterCompanionCol, entry.companion, 'companion');

      if (updatedFields.length > 0) {
        updatedStudents.push({
          studentId: targetStudentId,
          source: `${entry.sheetName}!R${entry.sourceRow}`,
          updatedFields,
        });
      }

      const relatedByName = nameIds.filter(id => id !== targetStudentId);
      if (
        (matchedBy === 'phone' ||
          matchedBy === 'email' ||
          matchedBy === 'phone+email') &&
        relatedByName.length > 0
      ) {
        possibleDuplicates.push({
          source: `${entry.sheetName}!R${entry.sourceRow}`,
          targetStudentId,
          relatedStudentIds: relatedByName,
          reason: `matchedBy=${matchedBy}, nameConflict`,
        });
      }

      addMapEntry(nameToIds, normalizedName, targetStudentId);
      addMapEntry(phoneToIds, entry.phone, targetStudentId);
      addMapEntry(emailToIds, entry.email, targetStudentId);
    });

    if (!dryRun) {
      // 更新行をバッチ書き込み（行単位API呼び出しを回避）
      if (updatedRowIndexes.size > 0) {
        const sortedRowIndexes = Array.from(updatedRowIndexes)
          .filter(rowIndex => rowIndex < existingRosterRowCount)
          .sort((a, b) => a - b);
        if (sortedRowIndexes.length > 0) {
          // 連続する行をグループ化して一括書き込み
          let rangeStart = sortedRowIndexes[0];
          let rangeEnd = rangeStart;
          const writeRange = () => {
            const rows = mutableRosterRows.slice(rangeStart, rangeEnd + 1);
            rosterSheet
              .getRange(rangeStart + 2, 1, rows.length, rosterHeader.length)
              .setValues(rows);
          };
          for (let i = 1; i < sortedRowIndexes.length; i++) {
            if (sortedRowIndexes[i] === rangeEnd + 1) {
              rangeEnd = sortedRowIndexes[i];
            } else {
              writeRange();
              rangeStart = sortedRowIndexes[i];
              rangeEnd = rangeStart;
            }
          }
          writeRange();
        }
      }

      if (newRowsToAppend.length > 0) {
        const chunkSize = 200;
        let writeRow = rosterSheet.getLastRow() + 1;
        for (let i = 0; i < newRowsToAppend.length; i += chunkSize) {
          const chunk = newRowsToAppend.slice(i, i + chunkSize);
          rosterSheet
            .getRange(writeRow, 1, chunk.length, rosterHeader.length)
            .setValues(chunk);
          writeRow += chunk.length;
        }
      }

      if (updatedRowIndexes.size > 0 || newRowsToAppend.length > 0) {
        SpreadsheetApp.flush();
        rebuildAllStudentsCache();
      }
    }

    finalize();
    return {
      success: errorMessages.length === 0,
      dryRun,
      sourceSpreadsheetId: sourceSpreadsheetId || 'current',
      sourceSheetNames,
      sourceEntryCount: sourceEntries.length,
      matchedCount:
        sourceEntries.length -
        ambiguousEntries.length -
        unmatchedEntries.length,
      updatedStudentCount: uniq(updatedStudents.map(item => item.studentId))
        .length,
      createdStudentCount: createdStudents.length,
      ambiguousCount: ambiguousEntries.length,
      unmatchedCount: unmatchedEntries.length,
      possibleDuplicateCount: possibleDuplicates.length,
      warnings,
      errorMessages,
      preview: updatedStudents.slice(0, 200),
      createdStudents: createdStudents.slice(0, 200),
      ambiguousEntries: ambiguousEntries.slice(0, 200),
      unmatchedEntries: unmatchedEntries.slice(0, 200),
      possibleDuplicates: possibleDuplicates.slice(0, 200),
    };
  } catch (error) {
    const message = `元申込み名簿補完でエラー: ${error.message}`;
    pushError(message);
    finalize();
    return {
      success: false,
      dryRun,
      sourceSpreadsheetId: String(input['sourceSpreadsheetId'] || 'current'),
      sourceSheetNames: [],
      sourceEntryCount: 0,
      matchedCount: 0,
      updatedStudentCount: 0,
      createdStudentCount: 0,
      ambiguousCount: 0,
      unmatchedCount: 0,
      possibleDuplicateCount: 0,
      warnings,
      errorMessages,
      preview: [],
      createdStudents: [],
      ambiguousEntries: [],
      unmatchedEntries: [],
      possibleDuplicates: [],
    };
  }
}

/**
 * 2023年1〜9月 元申込みデータの名簿補完 dry run（引数なし実行用）
 * @returns {Object}
 */
export function dryRunTsukubaLegacyApplicationRosterSync2023Auto() {
  const result = /** @type {Record<string, any>} */ (
    syncLegacyApplicationProfilesToRoster({
      ...TSUKUBA_LEGACY_APPLICATION_ROSTER_2023_PRESET,
      dryRun: true,
      onlyFillEmpty: true,
      createUnmatched: true,
    })
  );
  Logger.log(
    `[dryRunTsukubaLegacyApplicationRosterSync2023Auto] ${JSON.stringify(result, null, 2)}`,
  );
  return result;
}

/**
 * 2023年1〜9月 元申込みデータの名簿補完 実行（引数なし実行用）
 * @returns {Object}
 */
export function runTsukubaLegacyApplicationRosterSync2023Auto() {
  const result = /** @type {Record<string, any>} */ (
    syncLegacyApplicationProfilesToRoster({
      ...TSUKUBA_LEGACY_APPLICATION_ROSTER_2023_PRESET,
      dryRun: false,
      onlyFillEmpty: true,
      createUnmatched: true,
    })
  );
  Logger.log(
    `[runTsukubaLegacyApplicationRosterSync2023Auto] ${JSON.stringify(result, null, 2)}`,
  );
  return result;
}

/**
 * 予約記録の重複（同一キー）を除去します。
 * 既定キー: 生徒ID + レッスンID + 日付 + ステータス
 *
 * @param {Object} [config={}]
 * @param {boolean} [config.dryRun=true]
 * @param {string} [config.targetDateFrom] - YYYY-MM-DD（この日付以上）
 * @param {string} [config.targetDateTo] - YYYY-MM-DD（この日付以下）
 * @param {string[]} [config.keyFields] - 使用キー（studentId, lessonId, date, status）
 * @returns {Object}
 */
export function dedupeReservationsByStudentLessonDateStatus(config = {}) {
  /** @type {Record<string, any>} */
  const input = /** @type {Record<string, any>} */ (config || {});
  const dryRun = input['dryRun'] !== false;
  const targetDateFrom = _normalizeLegacyDate(
    _firstNotEmpty(
      input['targetDateFrom'],
      TSUKUBA_RESERVATION_DEDUPE_2023_PRESET.targetDateFrom,
    ),
  );
  const targetDateTo = _normalizeLegacyDate(
    _firstNotEmpty(
      input['targetDateTo'],
      TSUKUBA_RESERVATION_DEDUPE_2023_PRESET.targetDateTo,
    ),
  );
  const keyFields =
    Array.isArray(input['keyFields']) && input['keyFields'].length > 0
      ? input['keyFields'].map(value => String(value || '').trim())
      : TSUKUBA_RESERVATION_DEDUPE_2023_PRESET.keyFields;

  const { warnings, errorMessages, pushError, finalize } =
    _createMessageCollector('[dedupeReservationsByStudentLessonDateStatus]');

  try {
    const reservationsSheet = SS_MANAGER.getSheet(
      CONSTANTS.SHEET_NAMES.RESERVATIONS,
    );
    if (!reservationsSheet) {
      throw new Error('予約記録シートが見つかりません。');
    }
    const { headerMap: reservationHeaderMap, dataRows: reservationRows } =
      getSheetData(reservationsSheet);

    const reservationIdCol = _getHeaderIndexFromAnyMap(
      reservationHeaderMap,
      CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID,
    );
    const studentIdCol = _getHeaderIndexFromAnyMap(
      reservationHeaderMap,
      CONSTANTS.HEADERS.RESERVATIONS.STUDENT_ID,
    );
    const lessonIdCol = _getHeaderIndexFromAnyMap(
      reservationHeaderMap,
      CONSTANTS.HEADERS.RESERVATIONS.LESSON_ID,
    );
    const dateCol = _getHeaderIndexFromAnyMap(
      reservationHeaderMap,
      CONSTANTS.HEADERS.RESERVATIONS.DATE,
    );
    const statusCol = _getHeaderIndexFromAnyMap(
      reservationHeaderMap,
      CONSTANTS.HEADERS.RESERVATIONS.STATUS,
    );

    if (
      reservationIdCol === undefined ||
      studentIdCol === undefined ||
      lessonIdCol === undefined ||
      dateCol === undefined ||
      statusCol === undefined
    ) {
      throw new Error(
        '予約記録シートの必須列（予約ID/生徒ID/レッスンID/日付/ステータス）が不足しています。',
      );
    }

    /**
     * @param {RawSheetRow} row
     * @param {string} field
     * @returns {string}
     */
    const getFieldValue = (row, field) => {
      if (field === 'studentId') return String(row[studentIdCol] || '').trim();
      if (field === 'lessonId') return String(row[lessonIdCol] || '').trim();
      if (field === 'date') return _normalizeLegacyDate(row[dateCol]);
      if (field === 'status') return String(row[statusCol] || '').trim();
      return '';
    };

    /** @type {Map<string, {rowIndex: number; rowNumber: number; reservationId: string}>} */
    const firstByKey = new Map();
    /** @type {Array<{duplicateRowNumber: number; duplicateReservationId: string; keepRowNumber: number; keepReservationId: string; studentId: string; lessonId: string; date: string; status: string; key: string}>} */
    const duplicates = [];
    /** @type {Set<number>} */
    const duplicateRowIndexes = new Set();

    let skippedByDate = 0;
    let skippedByMissingKey = 0;

    reservationRows.forEach((row, rowIndex) => {
      const rowNumber = rowIndex + 2;
      const date = _normalizeLegacyDate(row[dateCol]);
      if (targetDateFrom && date && date < targetDateFrom) {
        skippedByDate += 1;
        return;
      }
      if (targetDateTo && date && date > targetDateTo) {
        skippedByDate += 1;
        return;
      }

      const keyParts = keyFields.map(field => getFieldValue(row, field));
      if (keyParts.some(value => !value)) {
        skippedByMissingKey += 1;
        return;
      }
      const key = keyParts.join('|');
      const reservationId = String(row[reservationIdCol] || '').trim();
      const studentId = String(row[studentIdCol] || '').trim();
      const lessonId = String(row[lessonIdCol] || '').trim();
      const status = String(row[statusCol] || '').trim();

      const first = firstByKey.get(key);
      if (!first) {
        firstByKey.set(key, { rowIndex, rowNumber, reservationId });
        return;
      }

      duplicateRowIndexes.add(rowIndex);
      duplicates.push({
        duplicateRowNumber: rowNumber,
        duplicateReservationId: reservationId,
        keepRowNumber: first.rowNumber,
        keepReservationId: first.reservationId,
        studentId,
        lessonId,
        date,
        status,
        key,
      });
    });

    if (!dryRun && duplicateRowIndexes.size > 0) {
      // 非重複行のみを残してシートを一括書き換え（行単位削除はGAS実行時間制限リスクが高い）
      const headerRow = reservationsSheet
        .getRange(1, 1, 1, reservationsSheet.getLastColumn())
        .getValues()[0];
      const survivingRows = reservationRows.filter(
        (_row, idx) => !duplicateRowIndexes.has(idx),
      );
      const totalCurrentRows = reservationsSheet.getLastRow();
      // ヘッダー行 + 残行を書き込み
      if (survivingRows.length > 0) {
        reservationsSheet
          .getRange(2, 1, survivingRows.length, headerRow.length)
          .setValues(survivingRows);
      }
      // 余剰行をクリア
      const excessRows = totalCurrentRows - 1 - survivingRows.length;
      if (excessRows > 0) {
        reservationsSheet
          .getRange(survivingRows.length + 2, 1, excessRows, headerRow.length)
          .clearContent();
      }
      SpreadsheetApp.flush();
      rebuildAllReservationsCache();
      syncReservationIdsToSchedule();

      const deletedCount = duplicates.length;
      logActivity('SYSTEM', 'よやく重複削除', '成功', {
        message: `重複予約削除完了（${deletedCount}件）`,
        details: {
          targetDateFrom: targetDateFrom || '-',
          targetDateTo: targetDateTo || '-',
          keyFields,
          deletedCount,
          skippedByDate,
          skippedByMissingKey,
        },
      });
    }

    finalize();
    return {
      success: errorMessages.length === 0,
      dryRun,
      keyFields,
      targetDateFrom: targetDateFrom || undefined,
      targetDateTo: targetDateTo || undefined,
      scannedCount: reservationRows.length,
      duplicateCount: duplicates.length,
      deletedCount: dryRun ? 0 : duplicates.length,
      skippedByDate,
      skippedByMissingKey,
      warnings,
      errorMessages,
      duplicatesPreview: duplicates.slice(0, 200),
    };
  } catch (error) {
    pushError(`予約重複削除でエラー: ${error.message}`);
    finalize();
    return {
      success: false,
      dryRun,
      keyFields,
      targetDateFrom: targetDateFrom || undefined,
      targetDateTo: targetDateTo || undefined,
      scannedCount: 0,
      duplicateCount: 0,
      deletedCount: 0,
      skippedByDate: 0,
      skippedByMissingKey: 0,
      warnings,
      errorMessages,
      duplicatesPreview: [],
    };
  }
}

/**
 * 2023年分の予約重複を dry run で確認（引数なし実行用）
 * @returns {Object}
 */
export function dryRunTsukubaReservationDedupe2023Auto() {
  const result = /** @type {Record<string, any>} */ (
    dedupeReservationsByStudentLessonDateStatus({
      ...TSUKUBA_RESERVATION_DEDUPE_2023_PRESET,
      dryRun: true,
    })
  );
  Logger.log(
    `[dryRunTsukubaReservationDedupe2023Auto] ${JSON.stringify(result, null, 2)}`,
  );
  return result;
}

/**
 * 2023年分の予約重複を削除実行（引数なし実行用）
 * @returns {Object}
 */
export function runTsukubaReservationDedupe2023Auto() {
  const result = /** @type {Record<string, any>} */ (
    dedupeReservationsByStudentLessonDateStatus({
      ...TSUKUBA_RESERVATION_DEDUPE_2023_PRESET,
      dryRun: false,
    })
  );
  Logger.log(
    `[runTsukubaReservationDedupe2023Auto] ${JSON.stringify(result, null, 2)}`,
  );
  return result;
}

/**
 * 2023年10月21日〜2025年2月16日分の予約重複を dry run で確認（引数なし実行用）
 * @returns {Object}
 */
export function dryRunTsukubaReservationDedupe2023OctTo2025FebAuto() {
  const result = /** @type {Record<string, any>} */ (
    dedupeReservationsByStudentLessonDateStatus({
      ...TSUKUBA_RESERVATION_DEDUPE_2023_10_TO_2025_02_PRESET,
      dryRun: true,
    })
  );
  Logger.log(
    `[dryRunTsukubaReservationDedupe2023OctTo2025FebAuto] ${JSON.stringify(result, null, 2)}`,
  );
  return result;
}

/**
 * 2023年10月21日〜2025年2月16日分の予約重複を削除実行（引数なし実行用）
 * @returns {Object}
 */
export function runTsukubaReservationDedupe2023OctTo2025FebAuto() {
  const result = /** @type {Record<string, any>} */ (
    dedupeReservationsByStudentLessonDateStatus({
      ...TSUKUBA_RESERVATION_DEDUPE_2023_10_TO_2025_02_PRESET,
      dryRun: false,
    })
  );
  Logger.log(
    `[runTsukubaReservationDedupe2023OctTo2025FebAuto] ${JSON.stringify(result, null, 2)}`,
  );
  return result;
}

/**
 * 旧データ全期間（2023-01-01〜2025-02-16）の予約重複を dry run で確認（引数なし実行用）
 * @returns {Object}
 */
export function dryRunTsukubaReservationDedupeLegacyAllAuto() {
  const result = /** @type {Record<string, any>} */ (
    dedupeReservationsByStudentLessonDateStatus({
      ...TSUKUBA_RESERVATION_DEDUPE_LEGACY_ALL_PRESET,
      dryRun: true,
    })
  );
  Logger.log(
    `[dryRunTsukubaReservationDedupeLegacyAllAuto] ${JSON.stringify(result, null, 2)}`,
  );
  return result;
}

/**
 * 旧データ全期間（2023-01-01〜2025-02-16）の予約重複を削除実行（引数なし実行用）
 * @returns {Object}
 */
export function runTsukubaReservationDedupeLegacyAllAuto() {
  const result = /** @type {Record<string, any>} */ (
    dedupeReservationsByStudentLessonDateStatus({
      ...TSUKUBA_RESERVATION_DEDUPE_LEGACY_ALL_PRESET,
      dryRun: false,
    })
  );
  Logger.log(
    `[runTsukubaReservationDedupeLegacyAllAuto] ${JSON.stringify(result, null, 2)}`,
  );
  return result;
}

/**
 * 2023年1〜9月CSV取り込み専用の実行設定を構築
 * @returns {Record<string, any>}
 */
function _buildTsukubaLegacyCsvImport2023JanToSepConfig() {
  const sourceSpreadsheetId =
    TSUKUBA_LEGACY_CSV_IMPORT_2023_JAN_TO_SEP_PRESET.sourceSpreadsheetId;
  const sourceSpreadsheet = sourceSpreadsheetId
    ? SpreadsheetApp.openById(sourceSpreadsheetId)
    : SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheetName = _resolveLegacyCsvSourceSheetNameStrict(
    sourceSpreadsheet,
    TSUKUBA_LEGACY_CSV_IMPORT_2023_JAN_TO_SEP_PRESET.sourceSheetNameCandidates,
  );

  return {
    sourceSpreadsheetId,
    sourceSheetName,
    sourceSheetNameCandidates:
      TSUKUBA_LEGACY_CSV_IMPORT_2023_JAN_TO_SEP_PRESET.sourceSheetNameCandidates,
    defaultClassroom:
      TSUKUBA_LEGACY_CSV_IMPORT_2023_JAN_TO_SEP_PRESET.defaultClassroom,
    defaultStatus:
      TSUKUBA_LEGACY_CSV_IMPORT_2023_JAN_TO_SEP_PRESET.defaultStatus,
    defaultScheduleClassroomType:
      TSUKUBA_LEGACY_CSV_IMPORT_DEFAULTS.defaultScheduleClassroomType,
    defaultScheduleStatus:
      TSUKUBA_LEGACY_CSV_IMPORT_DEFAULTS.defaultScheduleStatus,
    matchingApplicationSpreadsheetId:
      TSUKUBA_LEGACY_CSV_IMPORT_DEFAULTS.matchingApplicationSpreadsheetId,
    matchingApplicationSheetId:
      TSUKUBA_LEGACY_CSV_IMPORT_DEFAULTS.matchingApplicationSheetId,
  };
}

/**
 * 2023年1〜9月CSV（整形済み）を「取り込み + 突き合わせ」込みで dry run します。
 * - GASエディタから引数なしで実行する専用関数
 * @returns {Object}
 */
export function dryRunTsukubaLegacyCsvImport2023JanToSepAuto() {
  try {
    const importConfig = _buildTsukubaLegacyCsvImport2023JanToSepConfig();
    const request = _buildTsukubaLegacyCsvImportRequest(importConfig, true);
    const scheduleSync = _ensureScheduleRowsForLegacyCsvImport(
      request.importConfig,
      true,
    );
    const importPreview = /** @type {Record<string, any>} */ (
      scheduleSync.success
        ? importLegacyReservations(request.importConfig)
        : {
            success: false,
            dryRun: true,
            processed: 0,
            imported: 0,
            skipped: 0,
            errorCount: 1,
            warnings: scheduleSync.warnings || [],
            errorMessages: scheduleSync.errorMessages || [
              '日程マスタ補完dry runに失敗したため、予約取り込みdry runをスキップしました。',
            ],
          }
    );
    const reconcilePreview = /** @type {Record<string, any>} */ (
      reconcileLegacyImportedReservationsByApplication({
        dryRun: true,
        targetDateFrom:
          TSUKUBA_LEGACY_CSV_IMPORT_2023_JAN_TO_SEP_PRESET.reconcileTargetDateFrom,
        targetDateTo:
          TSUKUBA_LEGACY_CSV_IMPORT_2023_JAN_TO_SEP_PRESET.reconcileTargetDateTo,
        targetClassroom:
          TSUKUBA_LEGACY_CSV_IMPORT_2023_JAN_TO_SEP_PRESET.reconcileTargetClassroom,
      })
    );

    const result = {
      success:
        Boolean(scheduleSync.success) &&
        Boolean(importPreview['success']) &&
        Boolean(reconcilePreview['success']),
      mode: 'dryRun',
      sourceSheetName: request.sourceSheetName,
      scheduleSync,
      importResult: importPreview,
      reconcileResult: reconcilePreview,
    };
    Logger.log(
      `[dryRunTsukubaLegacyCsvImport2023JanToSepAuto] ${JSON.stringify(result, null, 2)}`,
    );
    return result;
  } catch (error) {
    const result = {
      success: false,
      mode: 'dryRun',
      errorMessages: [
        `2023年1〜9月CSV 取り込み+突き合わせ dry run でエラー: ${error.message}`,
      ],
    };
    Logger.log(
      `[dryRunTsukubaLegacyCsvImport2023JanToSepAuto] ${JSON.stringify(result, null, 2)}`,
    );
    return result;
  }
}

/**
 * 2023年1〜9月CSV（整形済み）を「取り込み + 突き合わせ」込みで実行します。
 * - GASエディタから引数なしで実行する専用関数
 * - UIダイアログを使わず、実行結果はログと返却値で確認
 * @returns {Object}
 */
export function runTsukubaLegacyCsvImport2023JanToSepAuto() {
  try {
    const importConfig = _buildTsukubaLegacyCsvImport2023JanToSepConfig();
    const request = _buildTsukubaLegacyCsvImportRequest(importConfig, false);
    const scheduleSync = _ensureScheduleRowsForLegacyCsvImport(
      request.importConfig,
      false,
    );
    if (!scheduleSync.success) {
      const result = {
        success: false,
        mode: 'run',
        sourceSheetName: request.sourceSheetName,
        scheduleSync,
        importResult: null,
        reconcileResult: null,
      };
      Logger.log(
        `[runTsukubaLegacyCsvImport2023JanToSepAuto] ${JSON.stringify(result, null, 2)}`,
      );
      return result;
    }

    const importResult = /** @type {Record<string, any>} */ (
      importLegacyReservations(request.importConfig)
    );
    importResult['sourceSheetName'] = request.sourceSheetName;
    importResult['scheduleSync'] = scheduleSync;

    const shouldRunReconcile =
      Number(importResult['processed'] || 0) > 0 ||
      Number(importResult['imported'] || 0) > 0;
    const reconcileResult = /** @type {Record<string, any>} */ (
      shouldRunReconcile
        ? reconcileLegacyImportedReservationsByApplication({
            dryRun: false,
            targetDateFrom:
              TSUKUBA_LEGACY_CSV_IMPORT_2023_JAN_TO_SEP_PRESET.reconcileTargetDateFrom,
            targetDateTo:
              TSUKUBA_LEGACY_CSV_IMPORT_2023_JAN_TO_SEP_PRESET.reconcileTargetDateTo,
            targetClassroom:
              TSUKUBA_LEGACY_CSV_IMPORT_2023_JAN_TO_SEP_PRESET.reconcileTargetClassroom,
          })
        : {
            success: false,
            skipped: true,
            reason: '取り込み処理が0件のため突き合わせをスキップしました。',
          }
    );

    const result = {
      success:
        Boolean(scheduleSync.success) &&
        Boolean(importResult['success']) &&
        Boolean(reconcileResult['success']),
      mode: 'run',
      sourceSheetName: request.sourceSheetName,
      scheduleSync,
      importResult,
      reconcileResult,
    };
    Logger.log(
      `[runTsukubaLegacyCsvImport2023JanToSepAuto] ${JSON.stringify(result, null, 2)}`,
    );
    return result;
  } catch (error) {
    const result = {
      success: false,
      mode: 'run',
      errorMessages: [
        `2023年1〜9月CSV 取り込み+突き合わせ実行でエラー: ${error.message}`,
      ],
    };
    Logger.log(
      `[runTsukubaLegacyCsvImport2023JanToSepAuto] ${JSON.stringify(result, null, 2)}`,
    );
    return result;
  }
}

/**
 * 旧「予約表（マトリクス）」形式を解析し、生徒名から生徒IDを照合して予約記録へ取り込みます。
 *
 * 対象レイアウト例:
 * - 左側: 時刻グリッド（▨ / 初 など）
 * - 右側: 名前、車、刀、備考、from、注文
 *
 * @param {Object} [config={}]
 * @param {string} [config.sourceSpreadsheetId] - 取り込み元スプレッドシートID。省略時は同一ブック
 * @param {string[]|string} [config.sourceSheetNames] - 対象シート名（省略時は全シート）
 * @param {boolean} [config.dryRun=true] - true: 書き込まずプレビューのみ
 * @param {string} [config.defaultClassroom='つくば教室'] - タイトルから推定できない場合の教室
 * @param {string} [config.defaultStatus='完了'] - 取り込み時のステータス既定値
 * @param {number} [config.maxRowsPerSheet=0] - シートごとの最大処理行数（0は無制限）
 * @param {'skip'|'error'} [config.duplicateIdentityStrategy='skip'] - 同一予約（生徒ID+日時+教室+時間）重複時の扱い
 * @param {boolean} [config.stopOnError=false] - 行エラーで即中断するか
 * @returns {Object} 取り込み結果
 */
export function importLegacyGridReservationsByName(config = {}) {
  /** @type {Record<string, any>} */
  const input = /** @type {Record<string, any>} */ (config || {});

  const sourceSpreadsheetId = String(input['sourceSpreadsheetId'] || '').trim();
  const dryRun = input['dryRun'] !== false;
  const defaultClassroom =
    String(input['defaultClassroom'] || '').trim() ||
    CONSTANTS.CLASSROOMS.TSUKUBA;
  const defaultStatus = _normalizeLegacyStatus(
    input['defaultStatus'],
    CONSTANTS.STATUS.COMPLETED,
  );
  const maxRowsPerSheet = Math.max(0, Number(input['maxRowsPerSheet'] || 0));
  const stopOnError = input['stopOnError'] === true;
  const duplicateIdentityStrategy =
    String(input['duplicateIdentityStrategy'] || 'skip') === 'error'
      ? 'error'
      : 'skip';

  const { warnings, errorMessages, pushWarning, pushError, finalize } =
    _createMessageCollector('[importLegacyGridReservationsByName]', 300);
  /** @type {Array<{sheetName: string; row: number; name: string; normalizedName: string}>} */
  const unmatchedNames = [];
  /** @type {Array<{sheetName: string; row: number; name: string; normalizedName: string; candidates: string[]}>} */
  const ambiguousNames = [];
  /** @type {Array<{sheetName: string; row: number; name: string; studentId: string; date: string; classroom: string; startTime: string; endTime: string}>} */
  const preview = [];

  try {
    const sourceSpreadsheet = sourceSpreadsheetId
      ? SpreadsheetApp.openById(sourceSpreadsheetId)
      : SpreadsheetApp.getActiveSpreadsheet();

    /** @type {GoogleAppsScript.Spreadsheet.Sheet[]} */
    let sourceSheets = [];
    const sourceSheetNamesInput = input['sourceSheetNames'];
    if (Array.isArray(sourceSheetNamesInput)) {
      sourceSheetNamesInput.forEach(name => {
        const sheet = sourceSpreadsheet.getSheetByName(String(name));
        if (!sheet) {
          pushWarning(`対象シートが見つかりません: ${name}`);
          return;
        }
        sourceSheets.push(sheet);
      });
    } else if (
      typeof sourceSheetNamesInput === 'string' &&
      sourceSheetNamesInput.trim()
    ) {
      const sheet = sourceSpreadsheet.getSheetByName(sourceSheetNamesInput);
      if (!sheet) {
        throw new Error(`対象シートが見つかりません: ${sourceSheetNamesInput}`);
      }
      sourceSheets = [sheet];
    } else {
      sourceSheets = sourceSpreadsheet.getSheets();
    }

    if (sourceSheets.length === 0) {
      throw new Error('取り込み対象シートがありません。');
    }

    const targetSheet = SS_MANAGER.getSheet(CONSTANTS.SHEET_NAMES.RESERVATIONS);
    if (!targetSheet) {
      throw new Error('予約記録シートが見つかりません。');
    }
    const {
      header: targetHeader,
      headerMap: targetHeaderMap,
      dataRows: existingRows,
    } = getSheetData(targetSheet);

    const reservationIdCol = _getHeaderIndexFromAnyMap(
      targetHeaderMap,
      CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID,
    );
    const studentIdCol = _getHeaderIndexFromAnyMap(
      targetHeaderMap,
      CONSTANTS.HEADERS.RESERVATIONS.STUDENT_ID,
    );
    const dateCol = _getHeaderIndexFromAnyMap(
      targetHeaderMap,
      CONSTANTS.HEADERS.RESERVATIONS.DATE,
    );
    const classroomCol = _getHeaderIndexFromAnyMap(
      targetHeaderMap,
      CONSTANTS.HEADERS.RESERVATIONS.CLASSROOM,
    );
    const startTimeCol = _getHeaderIndexFromAnyMap(
      targetHeaderMap,
      CONSTANTS.HEADERS.RESERVATIONS.START_TIME,
    );
    const endTimeCol = _getHeaderIndexFromAnyMap(
      targetHeaderMap,
      CONSTANTS.HEADERS.RESERVATIONS.END_TIME,
    );

    if (
      reservationIdCol === undefined ||
      studentIdCol === undefined ||
      dateCol === undefined ||
      classroomCol === undefined ||
      startTimeCol === undefined ||
      endTimeCol === undefined
    ) {
      throw new Error('予約記録シートの必須列が不足しています。');
    }

    const existingReservationIds = new Set(
      existingRows
        .map(row => String(row[reservationIdCol] || '').trim())
        .filter(Boolean),
    );
    const existingIdentityKeys = new Set(
      existingRows.map(row =>
        _createReservationIdentityKey({
          studentId: String(row[studentIdCol] || '').trim(),
          date: _normalizeLegacyDate(row[dateCol]),
          classroom: String(row[classroomCol] || '').trim(),
          startTime: _normalizeLegacyTime(row[startTimeCol]),
          endTime: _normalizeLegacyTime(row[endTimeCol]),
        }),
      ),
    );

    const scheduleLookup = _buildScheduleLookupForLegacyImport();
    const nameResolver = _buildStudentNameResolver();

    let processed = 0;
    let imported = 0;
    let skipped = 0;
    let duplicated = 0;

    /** @type {RawSheetRow[]} */
    const rowsToAppend = [];

    sourceSheets.forEach(sourceSheet => {
      try {
        const range = sourceSheet.getDataRange();
        const values = range.getValues();
        const displayValues = range.getDisplayValues();
        if (values.length === 0) return;

        /** @type {number[]} */
        const blockTitleRows = [];
        for (let r = 0; r < displayValues.length; r += 1) {
          const colB = String(displayValues[r]?.[1] || '').trim();
          if (colB.includes('予約状況')) {
            blockTitleRows.push(r);
          }
        }
        if (blockTitleRows.length === 0) {
          return;
        }

        for (
          let blockIndex = 0;
          blockIndex < blockTitleRows.length;
          blockIndex += 1
        ) {
          const titleRow = blockTitleRows[blockIndex];
          const nextTitleRow =
            blockTitleRows[blockIndex + 1] ?? displayValues.length;
          const dateRow = titleRow + 1;
          const timeRow = titleRow + 2;
          if (timeRow >= displayValues.length) continue;

          const titleText = String(displayValues[titleRow]?.[1] || '').trim();
          const classroom = _extractClassroomFromLegacyTitle(
            titleText,
            defaultClassroom,
          );
          const date = _normalizeLegacyDate(
            values[dateRow]?.[1] ?? displayValues[dateRow]?.[1],
          );
          if (!date) {
            pushWarning(
              `${sourceSheet.getName()}!R${dateRow + 1}: 日付が解釈できないためブロックをスキップ`,
            );
            continue;
          }

          const titleHeaderRow = displayValues[titleRow] || [];
          /**
           * @param {string[]} labels
           * @returns {number}
           */
          const findCol = labels =>
            titleHeaderRow.findIndex(cell =>
              labels.includes(String(cell || '').trim()),
            );

          const NAME_COL_FALLBACK = 22; // W列
          const nameCol = (() => {
            const found = findCol(['名前', '氏名', 'お名前']);
            if (found >= 0) return found;
            pushWarning(
              `${sourceSheet.getName()}!R${titleRow + 1}: 名前列ヘッダーが見つからないため列${NAME_COL_FALLBACK}(W列)をフォールバックとして使用`,
            );
            return NAME_COL_FALLBACK;
          })();
          const iconCol = Math.max(0, nameCol - 1); // V列想定（🚗/グループ記号）
          const durationCol = nameCol + 1; // X列想定（時間）
          const carCol = findCol(['車']);
          const chiselCol = findCol(['刀', '彫刻刀']);
          const noteCol = findCol(['作るもの・備考', '備考', '作るもの']);
          const fromCol = findCol(['from', 'FROM']);
          const orderCol = findCol(['注文など', '注文']);

          const timeConfig = _extractLegacyGridTimeConfig(
            values[timeRow] || [],
            displayValues[timeRow] || [],
            Math.max(0, nameCol - 3),
          );
          if (!timeConfig) {
            pushWarning(
              `${sourceSheet.getName()}!R${timeRow + 1}: 時刻軸を解釈できないためブロックをスキップ`,
            );
            continue;
          }

          const dataStartRow = timeRow + 1;
          const dataEndRow = Math.max(dataStartRow, nextTitleRow - 1);
          let sheetProcessedRows = 0;

          for (let r = dataStartRow; r <= dataEndRow; r += 1) {
            if (maxRowsPerSheet > 0 && sheetProcessedRows >= maxRowsPerSheet) {
              break;
            }

            const rawName = String(displayValues[r]?.[nameCol] || '').trim();
            if (!rawName) continue;
            if (['名前', '不足品メモ', '合計', 'memo'].includes(rawName)) {
              continue;
            }

            /** @type {number[]} */
            const occupiedColumns = [];
            let firstLectureDetected = false;
            for (
              let col = timeConfig.minSlotCol;
              col <= timeConfig.maxSlotCol;
              col += 1
            ) {
              const symbol = String(displayValues[r]?.[col] || '').trim();
              if (!symbol) continue;
              if (symbol.includes('初')) firstLectureDetected = true;
              if (/[▨初▷■◼]/.test(symbol)) {
                occupiedColumns.push(col);
              }
            }
            if (occupiedColumns.length === 0) {
              continue;
            }

            sheetProcessedRows += 1;
            processed += 1;

            const resolved = nameResolver.resolve(rawName);
            if (resolved.status === 'unmatched') {
              skipped += 1;
              unmatchedNames.push({
                sheetName: sourceSheet.getName(),
                row: r + 1,
                name: rawName,
                normalizedName: resolved.normalizedName,
              });
              continue;
            }
            if (resolved.status === 'ambiguous') {
              skipped += 1;
              ambiguousNames.push({
                sheetName: sourceSheet.getName(),
                row: r + 1,
                name: rawName,
                normalizedName: resolved.normalizedName,
                candidates: resolved.candidates,
              });
              continue;
            }

            const startMinutes = timeConfig.toMinutes(occupiedColumns[0]);
            let endMinutes =
              timeConfig.toMinutes(
                occupiedColumns[occupiedColumns.length - 1],
              ) + timeConfig.perColumnMinutes;

            const durationHours = _toFiniteNumber(
              values[r]?.[durationCol] ?? displayValues[r]?.[durationCol],
            );
            if (
              durationHours !== null &&
              durationHours > 0 &&
              durationHours <= 12
            ) {
              endMinutes = startMinutes + Math.round(durationHours * 60);
            }
            if (endMinutes <= startMinutes) {
              endMinutes = startMinutes + timeConfig.perColumnMinutes;
            }

            const startTime = _minutesToTimeString(startMinutes);
            const endTime = _minutesToTimeString(endMinutes);
            const identityKey = _createReservationIdentityKey({
              studentId: resolved.studentId,
              date,
              classroom,
              startTime,
              endTime,
            });

            if (existingIdentityKeys.has(identityKey)) {
              if (duplicateIdentityStrategy === 'error') {
                throw new Error(
                  `重複予約を検出しました: ${rawName} ${date} ${startTime}-${endTime}`,
                );
              }
              duplicated += 1;
              skipped += 1;
              continue;
            }
            existingIdentityKeys.add(identityKey);

            const carMark =
              carCol >= 0
                ? String(displayValues[r]?.[carCol] || '').trim()
                : '';
            const chiselMark =
              chiselCol >= 0
                ? String(displayValues[r]?.[chiselCol] || '').trim()
                : '';
            const iconMark =
              iconCol >= 0
                ? String(displayValues[r]?.[iconCol] || '').trim()
                : '';
            const transportation =
              /^(◯|○|有|あり|1|true)$/i.test(carMark) ||
              /車/.test(carMark) ||
              iconMark.includes('🚗')
                ? '車'
                : undefined;
            const chiselRental =
              /^(レ|◯|○|有|あり|1|true)$/i.test(chiselMark) ||
              chiselMark.includes('レ');
            const pickup = iconMark.includes('🚗') ? '送迎あり' : undefined;
            const sessionNote =
              noteCol >= 0
                ? String(displayValues[r]?.[noteCol] || '').trim()
                : '';
            const fromValue =
              fromCol >= 0
                ? String(displayValues[r]?.[fromCol] || '').trim()
                : '';
            const orderValue =
              orderCol >= 0
                ? String(displayValues[r]?.[orderCol] || '').trim()
                : '';
            const messageToTeacher = fromValue
              ? `from: ${fromValue}`
              : undefined;

            let reservationId = `legacy-${Utilities.getUuid()}`;
            while (existingReservationIds.has(reservationId)) {
              reservationId = `legacy-${Utilities.getUuid()}`;
            }
            existingReservationIds.add(reservationId);

            const scheduleInfo = scheduleLookup.get(`${date}_${classroom}`);
            const lessonId =
              String(scheduleInfo?.lessonId || '').trim() ||
              `legacy_${date}_${_sanitizeLegacyClassroomKey(classroom)}_${sourceSheet.getSheetId()}_${r + 1}`;

            /** @type {ReservationCore} */
            const reservation = {
              reservationId,
              lessonId,
              studentId: resolved.studentId,
              date,
              classroom,
              status: defaultStatus,
              venue: String(scheduleInfo?.venue || '').trim() || undefined,
              startTime,
              endTime,
              chiselRental,
              firstLecture: firstLectureDetected,
              transportation,
              pickup,
              sessionNote: sessionNote || undefined,
              order: orderValue || undefined,
              messageToTeacher,
            };

            rowsToAppend.push(
              convertReservationToRow(
                reservation,
                targetHeaderMap,
                targetHeader,
              ),
            );
            imported += 1;
            if (preview.length < 30) {
              preview.push({
                sheetName: sourceSheet.getName(),
                row: r + 1,
                name: rawName,
                studentId: resolved.studentId,
                date,
                classroom,
                startTime,
                endTime,
              });
            }
          }
        }
      } catch (sheetError) {
        pushError(
          `${sourceSheet.getName()}: シート解析エラー: ${sheetError.message}`,
        );
        if (stopOnError) {
          throw sheetError;
        }
      }
    });

    if (!dryRun && rowsToAppend.length > 0) {
      const chunkSize = 200;
      let writeRow = targetSheet.getLastRow() + 1;
      for (let i = 0; i < rowsToAppend.length; i += chunkSize) {
        const chunk = rowsToAppend.slice(i, i + chunkSize);
        targetSheet
          .getRange(writeRow, 1, chunk.length, targetHeader.length)
          .setValues(chunk);
        writeRow += chunk.length;
      }
      SpreadsheetApp.flush();

      rebuildAllReservationsCache();
      syncReservationIdsToSchedule();

      logActivity('SYSTEM', 'よやくキャッシュ移行', '成功', {
        message: `旧予約表（マトリクス）取り込み完了（${imported}件）`,
        details: {
          sourceSpreadsheetId: sourceSpreadsheetId || 'current',
          sheets: sourceSheets.map(sheet => sheet.getName()),
          processed,
          imported,
          skipped,
          duplicated,
          unmatched: unmatchedNames.length,
          ambiguous: ambiguousNames.length,
          warnings: warnings.length,
          errors: errorMessages.length,
        },
      });
    }

    finalize();
    return {
      success: errorMessages.length === 0,
      dryRun,
      processed,
      imported,
      skipped,
      duplicated,
      unmatchedNameCount: unmatchedNames.length,
      ambiguousNameCount: ambiguousNames.length,
      indexedStudentCount: nameResolver.indexedStudentCount,
      warnings,
      errorMessages,
      unmatchedNames: unmatchedNames.slice(0, 200),
      ambiguousNames: ambiguousNames.slice(0, 200),
      preview,
    };
  } catch (error) {
    const message = `旧予約表（マトリクス）取り込みでエラー: ${error.message}`;
    Logger.log(`[importLegacyGridReservationsByName] ${message}`);
    finalize();
    return {
      success: false,
      dryRun,
      processed: 0,
      imported: 0,
      skipped: 0,
      duplicated: 0,
      unmatchedNameCount: unmatchedNames.length,
      ambiguousNameCount: ambiguousNames.length,
      indexedStudentCount: 0,
      warnings,
      errorMessages: [...errorMessages, message],
      unmatchedNames: unmatchedNames.slice(0, 200),
      ambiguousNames: ambiguousNames.slice(0, 200),
      preview: [],
    };
  }
}

/**
 * 旧つくば予約表（マトリクス）を dry run で解析する簡易エントリー
 * - Apps Script エディタから手動実行し、ログで結果を確認する用途
 * @returns {Object}
 */
export function dryRunTsukubaLegacyGridImport() {
  const result = /** @type {Record<string, any>} */ (
    importLegacyGridReservationsByName({
      ...TSUKUBA_LEGACY_GRID_IMPORT_DEFAULTS,
      dryRun: true,
    })
  );
  Logger.log(
    `[dryRunTsukubaLegacyGridImport] ${JSON.stringify(result, null, 2)}`,
  );
  return result;
}

/**
 * 旧つくば予約表（マトリクス）を本取り込みする簡易エントリー
 * - 実行前に確認ダイアログを表示
 * @returns {Object | null}
 */
export function runTsukubaLegacyGridImport() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '旧予約表の取り込み',
    [
      '旧予約表（つくば）の取り込みを実行します。',
      '生徒名照合できないデータはスキップされます。',
      '',
      '先に dryRunTsukubaLegacyGridImport を実行し、件数を確認してください。',
      '実行しますか？',
    ].join('\n'),
    ui.ButtonSet.OK_CANCEL,
  );

  if (response !== ui.Button.OK) {
    ui.alert('取り込みをキャンセルしました。');
    return null;
  }

  const result = /** @type {Record<string, any>} */ (
    importLegacyGridReservationsByName({
      ...TSUKUBA_LEGACY_GRID_IMPORT_DEFAULTS,
      dryRun: false,
    })
  );
  Logger.log(`[runTsukubaLegacyGridImport] ${JSON.stringify(result, null, 2)}`);
  ui.alert(
    `取り込み完了\n成功: ${result['success']}\n処理: ${result['processed']}件\n取り込み: ${result['imported']}件\nスキップ: ${result['skipped']}件\n未一致名: ${result['unmatchedNameCount']}件\n複数一致名: ${result['ambiguousNameCount']}件`,
  );
  return result;
}

/**
 * 【開発用】テスト環境をセットアップします。
 * 現在のスプレッドシートをコピーし、テスト用の新しい環境を作成します。
 */
export function setupTestEnvironment() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'テスト環境の作成',
    '現在のスプレッドシートの完全なコピーを作成し、テスト環境としてセットアップします。よろしいですか？',
    ui.ButtonSet.OK_CANCEL,
  );

  if (response !== ui.Button.OK) {
    ui.alert('処理を中断しました。');
    return;
  }

  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'テスト環境を作成中です...',
      '処理中',
      -1,
    );

    const sourceSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sourceFile = DriveApp.getFileById(sourceSpreadsheet.getId());

    // 1. スプレッドシートをコピー
    const newFileName = `【テスト用】${sourceSpreadsheet.getName()}`;
    const copiedFile = sourceFile.makeCopy(newFileName);
    const copiedSpreadsheet = SpreadsheetApp.openById(copiedFile.getId());

    // 2. コピーしたスプレッドシートの情報を取得
    const newUrl = copiedSpreadsheet.getUrl();
    const newId = copiedSpreadsheet.getId();

    SpreadsheetApp.getActiveSpreadsheet().toast(
      'テスト環境の作成が完了しました。',
      '完了',
      5,
    );

    // 3. ユーザーに情報を提示
    const htmlOutput = HtmlService.createHtmlOutput(
      `<h4>テスト環境のセットアップが完了しました</h4>
       <p>新しいテスト用スプレッドシートと、それに紐づくApps Scriptプロジェクトが作成されました。</p>
       <p><b>ファイル名:</b> ${newFileName}</p>
       <p><b>スプレッドシートURL:</b> <a href="${newUrl}" target="_blank">ここをクリックして開く</a></p>
       <p><b>スプレッドシートID:</b> <code>${newId}</code></p>
       <hr>
       <h4>次のステップ: ローカル開発環境の接続とトリガー設定</h4>
       <ol style="text-align: left; padding-left: 20px;">
           <li>
               <b>新しいスクリプトIDの確認:</b>
               上記URLから新しいスプレッドシートを開き、拡張機能 &gt; Apps Script からスクリプトエディタを開いてください。
               開いたら、左側の「プロジェクトの設定」（歯車のアイコン）をクリックし、<b>「スクリプトID」</b>をコピーしてください。
           </li>
           <li>
               <b>ローカル環境（.clasp.json）の更新:</b>
               ターミナルで以下のコマンドを実行し、<code>.clasp.json</code>の<code>scriptId</code>をコピーした<b>スクリプトID</b>に更新してください。<br>
               <pre style="background-color:#f0f0f0; padding: 8px; border-radius: 4px; overflow-x: auto; font-size: 0.9em;"><code>clasp setting scriptId &lt;ここにコピーしたスクリプトIDをペースト&gt;</code></pre>
           </li>
           <li>
               <b>コードのプッシュ:</b>
               その後、<code>clasp push</code>でコードをデプロイしてください。
           </li>
           <li>
               <b>トリガーの再設定:</b>
               新しいスクリプトプロジェクトのエディタで、左側の「トリガー」（時計のアイコン）をクリックし、<code>handleOnChange</code>と<code>handleEdit</code>のトリガーを再設定してください。<br>
               (イベントの種類: <code>変更時</code> と <code>編集時</code>)
           </li>
       </ol>
       <br>
       <input type="button" value="閉じる" onclick="google.script.host.close()" style="background-color: #f0f0f0; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold;">`,
    )
      .setWidth(600)
      .setHeight(400);

    ui.showModalDialog(htmlOutput, 'セットアップ完了');
  } catch (err) {
    handleError(
      `テスト環境の作成中にエラーが発生しました: ${err.message}`,
      true,
    );
  }
}

/**
 * 直近60日間の会計済みよやく日を取得する
 * @returns {string[]} 日付文字列の配列（YYYY-MM-DD形式、降順）
 */
export function getRecentCompletedReservationDates() {
  try {
    const reservations = getCachedReservationsAsObjects();
    if (!reservations || reservations.length === 0) {
      return [];
    }

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const completedReservations = reservations.filter(reservation => {
      if (!reservation) return false;
      if (reservation.status !== CONSTANTS.STATUS.COMPLETED) return false;
      return typeof reservation.reservationId === 'string';
    });

    const reservationIds = completedReservations
      .map(reservation => reservation.reservationId)
      .filter(id => typeof id === 'string' && id !== '');
    const accountingDetailsMap = getAccountingDetailsMap(reservationIds);

    // 会計済みよやくの日付を収集
    const dateSet = new Set();
    completedReservations.forEach(reservation => {
      if (!reservation.date) return;
      if (!accountingDetailsMap.has(reservation.reservationId)) return;
      const dateCandidate = new Date(`${reservation.date}T00:00:00+09:00`);
      if (!isNaN(dateCandidate.getTime()) && dateCandidate >= sixtyDaysAgo) {
        dateSet.add(reservation.date);
      }
    });

    // 配列に変換して降順ソート
    return Array.from(dateSet).sort((a, b) => b.localeCompare(a));
  } catch (err) {
    Logger.log(`[getRecentCompletedReservationDates] Error: ${err.message}`);
    return [];
  }
}

/**
 * 指定した日付の予約記録から売上ログを再転載する（ダイアログ表示版）
 * カスタムメニューから手動実行する想定
 */
export function repostSalesLogByDate() {
  const ui = SpreadsheetApp.getUi();

  // HTMLダイアログを表示
  const htmlOutput = HtmlService.createHtmlOutputFromFile('dialog_repost_sales')
    .setWidth(450)
    .setHeight(300);

  ui.showModalDialog(htmlOutput, '売上記録の再転載');
}

/**
 * 指定した予約ID群の会計詳細をシートから取得してマップで返す
 * @param {string[]} reservationIds
 * @returns {Map<string, AccountingDetailsCore>}
 */
function getAccountingDetailsMap(reservationIds) {
  const resultMap = new Map();
  if (!Array.isArray(reservationIds) || reservationIds.length === 0) {
    return resultMap;
  }

  const reservationIdSet = new Set(
    reservationIds.map(id => String(id || '')).filter(id => id !== ''),
  );
  if (reservationIdSet.size === 0) {
    return resultMap;
  }

  const sheet = SS_MANAGER.getSheet(CONSTANTS.SHEET_NAMES.RESERVATIONS);
  if (!sheet) {
    Logger.log(
      '[getAccountingDetailsMap] よやくシートが取得できなかったため、会計詳細を取得できません。',
    );
    return resultMap;
  }

  const headerRow = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0];
  const reservationIdColIndex = headerRow.indexOf(
    CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID,
  );
  const accountingColIndex = headerRow.indexOf(
    CONSTANTS.HEADERS.RESERVATIONS.ACCOUNTING_DETAILS,
  );

  if (reservationIdColIndex === -1 || accountingColIndex === -1) {
    Logger.log(
      '[getAccountingDetailsMap] 必要な列が見つからないため、会計詳細を取得できません。',
    );
    return resultMap;
  }

  const dataRowCount = sheet.getLastRow() - 1;
  if (dataRowCount <= 0) {
    return resultMap;
  }

  const allValues = sheet
    .getRange(2, 1, dataRowCount, sheet.getLastColumn())
    .getValues();

  for (const row of allValues) {
    const rawId = row[reservationIdColIndex];
    const reservationId = String(rawId || '');
    if (!reservationIdSet.has(reservationId)) continue;

    let accountingDetails = row[accountingColIndex] || null;
    if (
      typeof accountingDetails === 'string' &&
      accountingDetails.trim().startsWith('{')
    ) {
      try {
        accountingDetails = JSON.parse(accountingDetails);
      } catch (error) {
        Logger.log(
          `[getAccountingDetailsMap] 会計詳細のJSONパースに失敗しました (reservationId=${reservationId}): ${error.message}`,
        );
        accountingDetails = null;
      }
    }

    if (accountingDetails && typeof accountingDetails === 'object') {
      resultMap.set(
        reservationId,
        /** @type {AccountingDetailsCore} */ (accountingDetails),
      );
    }
  }

  return resultMap;
}

/**
 * 指定した日付の予約記録から売上ログを転載する
 * HTMLダイアログ（手動再転載）またはバッチ処理（日次転載）から呼び出される
 * @param {string} [targetDate] - 対象日付（YYYY-MM-DD形式）。省略時は当日。
 * @returns {{ success: boolean, totalCount: number, successCount: number }} 転載結果
 */
export function transferSalesLogByDate(targetDate) {
  // 日付が指定されていない場合は当日を使用
  if (!targetDate) {
    const today = new Date();
    targetDate = Utilities.formatDate(today, CONSTANTS.TIMEZONE, 'yyyy-MM-dd');
  }
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      `${targetDate}の売上記録を転載中...`,
      '処理中',
      -1,
    );

    const reservations = getCachedReservationsAsObjects();
    if (!reservations || reservations.length === 0) {
      SpreadsheetApp.getActiveSpreadsheet().toast('', '', 1);
      Logger.log(
        `[transferSalesLogByDate] 対象なし: ${targetDate}のよやくデータがキャッシュに存在しません`,
      );
      return {
        success: true,
        totalCount: 0,
        successCount: 0,
      };
    }

    /** @type {ReservationCore[]} */
    const targetReservations = reservations.filter(reservation => {
      if (!reservation) return false;
      if (reservation.date !== targetDate) return false;
      if (reservation.status !== CONSTANTS.STATUS.COMPLETED) return false;
      return true;
    });

    if (targetReservations.length === 0) {
      SpreadsheetApp.getActiveSpreadsheet().toast('', '', 1);
      Logger.log(
        `[transferSalesLogByDate] 対象なし: ${targetDate}の会計済みよやくはありません`,
      );
      return {
        success: true,
        totalCount: 0,
        successCount: 0,
      };
    }

    const reservationIdList = targetReservations
      .map(reservation => reservation.reservationId)
      .filter(id => typeof id === 'string' && id !== '');
    const accountingDetailsMap = getAccountingDetailsMap(reservationIdList);

    // 各よやくから売上記録を書き込み（既存の関数を再利用）
    let successCount = 0;
    for (const targetReservation of targetReservations) {
      try {
        let accountingDetails = targetReservation.accountingDetails;
        if (!accountingDetails) {
          accountingDetails = accountingDetailsMap.get(
            targetReservation.reservationId,
          );
        }
        if (!accountingDetails || typeof accountingDetails !== 'object') {
          Logger.log(
            `[transferSalesLogByDate] 会計詳細が不正なためスキップ: ${targetReservation.reservationId}`,
          );
          continue;
        }

        // 既存の売上記録書き込み関数を呼び出し
        const result = logSalesForSingleReservation(
          targetReservation,
          /** @type {AccountingDetailsCore} */ (accountingDetails),
        );

        if (result.success) {
          successCount++;
        } else {
          Logger.log(
            `[transferSalesLogByDate] 失敗: よやく ${targetReservation.reservationId} - ${result.error?.message}`,
          );
        }
      } catch (err) {
        Logger.log(
          `[transferSalesLogByDate] よやく ${targetReservation.reservationId} の処理で予期せぬエラー: ${err.message}`,
        );
      }
    }

    SpreadsheetApp.getActiveSpreadsheet().toast('', '', 1);

    Logger.log(
      `[transferSalesLogByDate] 完了: ${targetDate}, よやく${targetReservations.length}件, 成功${successCount}件`,
    );

    return {
      success: true,
      totalCount: targetReservations.length,
      successCount: successCount,
    };
  } catch (err) {
    SpreadsheetApp.getActiveSpreadsheet().toast('', '', 1);

    const errorMessage = `売上記録の転載中にエラーが発生しました: ${err.message}`;
    Logger.log(`[transferSalesLogByDate] エラー: ${errorMessage}`);

    // エラーをスロー（HTMLダイアログ側でキャッチ）
    throw new Error(errorMessage);
  }
}

/**
 * よやくシート全体をソートします（バッチ処理用）
 *
 * @description
 * よやくシートのデータを以下の順序でソートします:
 * 1. 日付順（降順: 新しい日付が上）
 * 2. ステータス順（完了=確定 > 待機 > 取消）
 * 3. 開始時間順（昇順）
 * 4. 終了時間順（昇順）
 * 5. 初回順（初回=true > 空白/false）
 *
 * @returns {{success: boolean, message: string, sortedCount: number}}
 */
export function sortReservationSheet() {
  try {
    Logger.log('[sortReservationSheet] 開始');

    const sheet = SS_MANAGER.getSheet(CONSTANTS.SHEET_NAMES.RESERVATIONS);
    if (!sheet) {
      const errorMsg = 'よやくシートが取得できませんでした';
      Logger.log(`[sortReservationSheet] エラー: ${errorMsg}`);
      return { success: false, message: errorMsg, sortedCount: 0 };
    }

    const { header, headerMap, dataRows } = getSheetData(sheet);

    if (!dataRows || dataRows.length === 0) {
      Logger.log('[sortReservationSheet] ソート対象データなし');
      return { success: true, message: 'ソート対象データなし', sortedCount: 0 };
    }

    // ソート実行（RawSheetRowをキャスト）
    const sortedRows = sortReservationRows(
      /** @type {Array<Array<string|number|Date>>} */ (dataRows),
      headerMap,
    );

    // シート全体を上書き（ヘッダー + データ）
    const allData = [header, ...sortedRows];
    sheet.getRange(1, 1, allData.length, header.length).setValues(allData);
    SpreadsheetApp.flush();

    Logger.log(`[sortReservationSheet] 完了: ${sortedRows.length}件`);

    return {
      success: true,
      message: `よやくシートをソートしました（${sortedRows.length}件）`,
      sortedCount: sortedRows.length,
    };
  } catch (err) {
    Logger.log(`[sortReservationSheet] エラー: ${err.message}`);
    return {
      success: false,
      message: `ソート処理でエラーが発生: ${err.message}`,
      sortedCount: 0,
    };
  }
}

/**
 * 【トリガー関数】毎日20時に実行: 当日の会計済みよやくを売上表に転載する
 * スクリプトのトリガー設定から呼び出される
 *
 * @description
 * このバッチ処理により、会計修正は当日20時まで可能となり、
 * 20時以降は確定された会計データが売上表に転載される。
 * これにより、会計処理時の売上ログ記録が不要になり、
 * 何度修正しても売上表に影響がない運用が実現できる。
 */
export function dailySalesTransferBatch() {
  const today = new Date();
  const targetDate = Utilities.formatDate(
    today,
    CONSTANTS.TIMEZONE,
    'yyyy-MM-dd',
  );

  try {
    Logger.log(`[dailySalesTransferBatch] 開始: ${new Date().toISOString()}`);

    // LOGシートにバッチ開始を記録
    logActivity(
      'SYSTEM',
      CONSTANTS.LOG_ACTIONS.BATCH_SALES_TRANSFER_START,
      '実行中',
      `対象日: ${targetDate}`,
    );

    // 引数なしで呼び出すと当日の売上を転載
    const result = transferSalesLogByDate();

    Logger.log(
      `[dailySalesTransferBatch] 完了: よやく${result.totalCount}件, 成功${result.successCount}件`,
    );

    // LOGシートにバッチ完了を記録
    logActivity(
      'SYSTEM',
      CONSTANTS.LOG_ACTIONS.BATCH_SALES_TRANSFER_SUCCESS,
      '成功',
      `対象日: ${targetDate}, 処理件数: ${result.totalCount}件, 成功: ${result.successCount}件`,
    );

    // 管理者にメール通知
    const emailSubject = `売上転載バッチ処理完了 (${targetDate})`;
    const emailBody =
      `売上転載バッチ処理が完了しました。\n\n` +
      `対象日: ${targetDate}\n` +
      `処理件数: ${result.totalCount}件\n` +
      `成功: ${result.successCount}件\n` +
      `失敗: ${result.totalCount - result.successCount}件\n\n` +
      `処理時刻: ${Utilities.formatDate(today, CONSTANTS.TIMEZONE, 'yyyy-MM-dd HH:mm:ss')}\n\n` +
      `詳細はスプレッドシートのLOGシートを確認してください。`;

    sendAdminNotification(emailSubject, emailBody);

    // 売上転載のタイミングで日程ステータスを更新
    const updatedStatusCount = updateScheduleStatusToCompleted();
    if (updatedStatusCount > 0) {
      Logger.log(
        `[dailySalesTransferBatch] 日程ステータス更新: ${updatedStatusCount}件を開催済みに更新`,
      );
      rebuildScheduleMasterCache();
    }

    // 売上転載後によやくシート全体をソート
    Logger.log('[dailySalesTransferBatch] よやくシートソート開始');
    const sortResult = sortReservationSheet();

    if (sortResult.success) {
      Logger.log(
        `[dailySalesTransferBatch] ソート完了: ${sortResult.sortedCount}件`,
      );
      logActivity(
        'SYSTEM',
        CONSTANTS.LOG_ACTIONS.BATCH_SORT_SUCCESS,
        '成功',
        sortResult.message,
      );
    } else {
      Logger.log(`[dailySalesTransferBatch] ソート失敗: ${sortResult.message}`);
      logActivity(
        'SYSTEM',
        CONSTANTS.LOG_ACTIONS.BATCH_SORT_ERROR,
        '失敗',
        sortResult.message,
      );
      // ソート失敗してもバッチ全体は継続
    }
  } catch (err) {
    const errorMessage = `売上表転載バッチ処理でエラーが発生しました: ${err.message}`;
    Logger.log(`[dailySalesTransferBatch] エラー: ${errorMessage}`);

    // LOGシートにエラーを記録
    logActivity(
      'SYSTEM',
      CONSTANTS.LOG_ACTIONS.BATCH_SALES_TRANSFER_ERROR,
      '失敗',
      `対象日: ${targetDate}, エラー: ${err.message}`,
    );

    // 管理者にエラーメール通知
    const errorEmailSubject = `【エラー】売上転載バッチ処理失敗 (${targetDate})`;
    const errorEmailBody =
      `売上転載バッチ処理でエラーが発生しました。\n\n` +
      `対象日: ${targetDate}\n` +
      `エラー内容: ${err.message}\n\n` +
      `処理時刻: ${Utilities.formatDate(today, CONSTANTS.TIMEZONE, 'yyyy-MM-dd HH:mm:ss')}\n\n` +
      `詳細はスプレッドシートのLOGシートおよびApps Scriptのログを確認してください。`;

    sendAdminNotification(errorEmailSubject, errorEmailBody);

    handleError(errorMessage, false);
  }
}
