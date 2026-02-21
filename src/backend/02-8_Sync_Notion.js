/**
 * =================================================================
 * 【ファイル名】  : 02-8_Sync_Notion.js
 * 【モジュール種別】: バックエンド（GAS）
 * 【概要】          Notion 生徒データベースとの同期モジュール
 *
 * 【機能】
 *   - 生徒名簿データを Notion に同期
 *   - リアルタイム同期（登録・更新・退会時）
 *   - バッチ同期（時間トリガーで定期実行）
 *
 * 【Notion API】
 *   - Database ID: 02-8_Sync_Notion.js 作成時に設定
 *   - API Version: 2022-06-28
 *   - Auth: Bearer Token (PropertiesService で管理)
 *
 * 【依存関係】
 *   - 07_CacheManager.js (getCachedAllStudents)
 *   - 08_Utilities.js (getCachedStudentById)
 * =================================================================
 */

// ================================================================
// 依存モジュール
// ================================================================
import { SS_MANAGER } from './00_SpreadsheetManager.js';
import { getCachedAllStudents } from './07_CacheManager.js';
import { getCachedStudentById } from './08_Utilities.js';

// ================================================================
// 定数
// ================================================================

/** Notion API エンドポイント */
const NOTION_API_BASE = 'https://api.notion.com/v1';

/** Notion API バージョン */
const NOTION_API_VERSION = '2022-06-28';

/** PropertiesService のキー */
const PROPS_KEY_NOTION_TOKEN = 'NOTION_API_TOKEN';
const PROPS_KEY_NOTION_STUDENT_DB_ID = 'NOTION_STUDENT_DATABASE_ID';
const PROPS_KEY_NOTION_RESERVATION_DB_ID = 'NOTION_RESERVATION_DATABASE_ID';
const PROPS_KEY_NOTION_SCHEDULE_DB_ID = 'NOTION_SCHEDULE_DATABASE_ID';
const PROPS_KEY_NOTION_STUDENT_SYNC_CURSOR = 'NOTION_STUDENT_SYNC_CURSOR';
const PROPS_KEY_NOTION_RESERVATION_SYNC_CURSOR =
  'NOTION_RESERVATION_SYNC_CURSOR';
const PROPS_KEY_NOTION_RESERVATION_SYNC_ORDER_HASH =
  'NOTION_RESERVATION_SYNC_ORDER_HASH';
const PROPS_KEY_NOTION_BATCH_TRIGGER_ID = 'NOTION_BATCH_TRIGGER_ID';
const PROPS_KEY_NOTION_SYNC_QUEUE = 'NOTION_SYNC_QUEUE';
const PROPS_KEY_NOTION_SYNC_QUEUE_TRIGGER_ID = 'NOTION_SYNC_QUEUE_TRIGGER_ID';
const PROPS_KEY_NOTION_SYNC_QUEUE_RUNNER_STATE =
  'NOTION_SYNC_QUEUE_RUNNER_STATE';

/** Notion分割同期のトリガー設定 */
const NOTION_BATCH_TRIGGER_HANDLER = 'runNotionSyncBatch';
const NOTION_BATCH_TRIGGER_INTERVAL_MINUTES = 1;
const NOTION_BATCH_STUDENT_BATCH_SIZE = 30;
const NOTION_BATCH_RESERVATION_BATCH_SIZE = 50;
const NOTION_SYNC_QUEUE_TRIGGER_HANDLER = 'runNotionSyncQueue';
const NOTION_SYNC_QUEUE_TRIGGER_INTERVAL_MINUTES = 1;
const NOTION_SYNC_QUEUE_BATCH_SIZE = 20;
const NOTION_SYNC_QUEUE_MAX_TASKS = 120;
const NOTION_SYNC_QUEUE_MAX_RETRY = 3;
const NOTION_SYNC_QUEUE_LOCK_WAIT_MS = 500;
const NOTION_SYNC_QUEUE_RUNNER_TTL_MS = 10 * 60 * 1000;

/** Notion同期キューのエンティティ種別 */
const NOTION_SYNC_QUEUE_ENTITY = /** @type {const} */ ({
  STUDENT: 'student',
  RESERVATION: 'reservation',
  SCHEDULE: 'schedule',
  UPCOMING_SCHEDULES: 'upcoming-schedules',
});

/** バッチ同期時のレート制限対策（ミリ秒） */
const RATE_LIMIT_DELAY_MS = 350;

/** Notion DB スキーマキャッシュ（実行中のみ） */
const NOTION_SCHEMA_CACHE = new Map();

/** Notion DB スキーマキャッシュの有効期限（ミリ秒） */
const NOTION_SCHEMA_CACHE_TTL_MS = 5 * 60 * 1000;

/** Notion側を手動編集しない前提で同期の問い合わせを省略する */
const NOTION_ASSUME_NO_MANUAL_EDITS = true;

/** Notion同期メタ情報シート名 */
const NOTION_SYNC_META_SHEET_NAME = 'Notion同期メタ';

/** Notion同期メタのヘッダー */
const NOTION_SYNC_META_HEADERS = [
  'entity',
  'sourceId',
  'pageId',
  'rowHash',
  'updatedAt',
];

/** Notion同期メタのエンティティ種別 */
const NOTION_SYNC_ENTITY = {
  STUDENT: 'student',
  RESERVATION: 'reservation',
  SCHEDULE: 'schedule',
};

/** Notion同期メタキャッシュ（実行中のみ） */
/** @type {{loaded: boolean, sheet: GoogleAppsScript.Spreadsheet.Sheet | null, headerMap: Map<string, number> | null, byKey: Map<string, NotionSyncMetaEntry>}} */
const NOTION_SYNC_META_STATE = {
  loaded: false,
  sheet: null,
  headerMap: null,
  byKey: new Map(),
};

/** Notion DB 初期作成時のデフォルト名 */
const DEFAULT_NOTION_DB_NAMES = {
  student: '生徒名簿',
  reservation: '予約記録',
  schedule: '日程',
};

/** Notion DB 初期作成時のタイトルプロパティ名 */
const DEFAULT_NOTION_TITLE_PROPERTY_NAME = 'タイトル';

// ================================================================
// 型定義
// ================================================================

/**
 * @typedef {Object} NotionConfig
 * @property {string} token - Notion API トークン
 * @property {string} studentDbId - 生徒データベースID
 * @property {string | null} [reservationDbId] - 予約記録データベースID
 * @property {string | null} [scheduleDbId] - 日程データベースID
 */

/**
 * @typedef {Object} NotionSyncResult
 * @property {boolean} success
 * @property {string | undefined} [pageId]
 * @property {boolean | undefined} [skipped]
 * @property {string | undefined} [error]
 */

/**
 * @typedef {Object} NotionPage
 * @property {string} id
 * @property {Record<string, any>} properties
 */

/**
 * @typedef {Object} NotionApiResponse
 * @property {string} [id]
 * @property {NotionPage[]} [results]
 * @property {boolean} [has_more]
 * @property {string} [next_cursor]
 * @property {Array<{plain_text: string}>} [title]
 * @property {Record<string, any>} [properties]
 */

/**
 * @typedef {Object} StudentData
 * @property {string | undefined} [studentId]
 * @property {string | undefined} [nickname]
 * @property {string | undefined} [realName]
 * @property {string | undefined} [phone]
 * @property {string | undefined} [status]
 */

/**
 * @typedef {Object} NotionDatabaseSchema
 * @property {string | null} titlePropertyName
 * @property {Record<string, {type: string}>} properties
 */

/**
 * @typedef {Object} SheetSnapshot
 * @property {string[]} headers
 * @property {number} idColIdx
 * @property {Map<string, {values: Record<string, any>, rowIndex: number}>} byId
 */

/**
 * @typedef {Object} NotionDatabaseCreationOptions
 * @property {string} [token]
 * @property {string} [studentDbName]
 * @property {string} [reservationDbName]
 * @property {string} [scheduleDbName]
 * @property {string} [titlePropertyName]
 */

/**
 * @typedef {Object} NotionSyncMetaEntry
 * @property {string} entity
 * @property {string} sourceId
 * @property {string} pageId
 * @property {string} rowHash
 * @property {number} rowIndex
 * @property {string} [updatedAt]
 */

/**
 * @typedef {Object} NotionStudentSyncOptions
 * @property {SheetSnapshot | null} [rosterSnapshot]
 * @property {Record<string, any> | null} [rosterValues]
 * @property {NotionDatabaseSchema | null} [schema]
 * @property {NotionPage | null} [existingPage]
 * @property {boolean} [skipSheetAccess]
 */

/**
 * @typedef {Object} NotionReservationSyncOptions
 * @property {SheetSnapshot | null} [reservationSnapshot]
 * @property {Record<string, any> | null} [reservationValues]
 * @property {NotionDatabaseSchema | null} [schema]
 * @property {NotionPage | null} [existingPage]
 * @property {boolean} [skipSheetAccess]
 */

/**
 * @typedef {Object} NotionScheduleSyncOptions
 * @property {SheetSnapshot | null} [scheduleSnapshot]
 * @property {Record<string, any> | null} [scheduleValues]
 * @property {NotionDatabaseSchema | null} [schema]
 * @property {NotionPage | null} [existingPage]
 * @property {boolean} [skipSheetAccess]
 */

/**
 * @typedef {'student' | 'reservation' | 'schedule' | 'upcoming-schedules'} NotionSyncQueueEntity
 */

/**
 * @typedef {Object} NotionSyncQueueTask
 * @property {string} taskKey
 * @property {NotionSyncQueueEntity} entity
 * @property {string} sourceId
 * @property {'create' | 'update' | 'delete'} [action]
 * @property {number} enqueuedAt
 * @property {number} retryCount
 * @property {number} [daysBack]
 */

/**
 * @typedef {Object} NotionSyncQueueRunnerState
 * @property {string} runnerId
 * @property {number} expiresAt
 */

// ================================================================
// ★★★ 設定管理 ★★★
// ================================================================

/**
 * Notion 接続設定を取得します
 * @returns {NotionConfig | null}
 */
export function getNotionConfig() {
  try {
    const props = PropertiesService.getScriptProperties();
    const token = props.getProperty(PROPS_KEY_NOTION_TOKEN);
    const studentDbId = props.getProperty(PROPS_KEY_NOTION_STUDENT_DB_ID);
    const reservationDbId = props.getProperty(
      PROPS_KEY_NOTION_RESERVATION_DB_ID,
    );
    const scheduleDbId = props.getProperty(PROPS_KEY_NOTION_SCHEDULE_DB_ID);

    if (!token || !studentDbId) {
      return null;
    }

    return { token, studentDbId, reservationDbId, scheduleDbId };
  } catch (error) {
    Logger.log(
      `getNotionConfig Error: ${/** @type {Error} */ (error).message}`,
    );
    return null;
  }
}

/**
 * Notion 接続設定を保存します（初回セットアップ用）
 * GASエディタから実行してください。
 *
 * @param {string} token - Notion Integration Token (secret_xxx)
 * @param {string} studentDbId - 生徒データベースID
 * @returns {void}
 *
 * @example
 * // GASエディタから実行
 * setNotionCredentials('secret_xxxxxx', '2f257846aac280cba2b9e971db618f8e');
 */
export function setNotionCredentials(token, studentDbId) {
  if (!token || !studentDbId) {
    throw new Error('token と studentDbId は必須です');
  }

  const props = PropertiesService.getScriptProperties();
  props.setProperty(PROPS_KEY_NOTION_TOKEN, token);
  props.setProperty(PROPS_KEY_NOTION_STUDENT_DB_ID, studentDbId);

  Logger.log('Notion認証情報を保存しました');
  Logger.log(`Database ID: ${studentDbId}`);
}

/**
 * Notion トークンのみ保存します（DB作成時に使用）
 * GASエディタから実行してください。
 *
 * @param {string} token - Notion Integration Token (secret_xxx)
 * @returns {void}
 */
export function setNotionToken(token) {
  if (!token) {
    throw new Error('token は必須です');
  }
  const props = PropertiesService.getScriptProperties();
  props.setProperty(PROPS_KEY_NOTION_TOKEN, token);
  Logger.log('Notionトークンを保存しました');
}

/**
 * 予約記録DBのIDを保存します
 * GASエディタから実行してください。
 *
 * @param {string} reservationDbId - 予約記録データベースID
 * @returns {void}
 */
export function setNotionReservationDatabaseId(reservationDbId) {
  if (!reservationDbId) {
    throw new Error('reservationDbId は必須です');
  }
  const props = PropertiesService.getScriptProperties();
  props.setProperty(PROPS_KEY_NOTION_RESERVATION_DB_ID, reservationDbId);
  Logger.log('Notion予約記録DB IDを保存しました');
  Logger.log(`Reservation DB ID: ${reservationDbId}`);
}

/**
 * 日程DBのIDを保存します
 * GASエディタから実行してください。
 *
 * @param {string} scheduleDbId - 日程データベースID
 * @returns {void}
 */
export function setNotionScheduleDatabaseId(scheduleDbId) {
  if (!scheduleDbId) {
    throw new Error('scheduleDbId は必須です');
  }
  const props = PropertiesService.getScriptProperties();
  props.setProperty(PROPS_KEY_NOTION_SCHEDULE_DB_ID, scheduleDbId);
  Logger.log('Notion日程DB IDを保存しました');
  Logger.log(`Schedule DB ID: ${scheduleDbId}`);
}

/**
 * Notion 側に同期用DBを作成します
 *
 * @param {string} parentPageIdOrUrl - 親ページIDまたはURL
 * @param {NotionDatabaseCreationOptions} [options]
 * @returns {{studentDbId?: string, reservationDbId?: string, scheduleDbId?: string}}
 */
export function createNotionDatabasesForSync(parentPageIdOrUrl, options = {}) {
  const token = options.token || _getNotionToken();
  if (!token) {
    throw new Error('Notionトークンが設定されていません');
  }

  const parentPageId = _normalizeNotionPageId(parentPageIdOrUrl);
  if (!parentPageId) {
    throw new Error('親ページIDが正しくありません');
  }

  const titlePropertyName =
    options.titlePropertyName || DEFAULT_NOTION_TITLE_PROPERTY_NAME;
  const studentDbName =
    options.studentDbName || DEFAULT_NOTION_DB_NAMES.student;
  const reservationDbName =
    options.reservationDbName || DEFAULT_NOTION_DB_NAMES.reservation;
  const scheduleDbName =
    options.scheduleDbName || DEFAULT_NOTION_DB_NAMES.schedule;

  /** @type {{studentDbId?: string, reservationDbId?: string, scheduleDbId?: string}} */
  const created = {};

  created.studentDbId = _createNotionDatabaseFromSheet(
    token,
    parentPageId,
    studentDbName,
    CONSTANTS.SHEET_NAMES.ROSTER,
    titlePropertyName,
  );
  created.reservationDbId = _createNotionDatabaseFromSheet(
    token,
    parentPageId,
    reservationDbName,
    CONSTANTS.SHEET_NAMES.RESERVATIONS,
    titlePropertyName,
  );
  created.scheduleDbId = _createNotionDatabaseFromSheet(
    token,
    parentPageId,
    scheduleDbName,
    CONSTANTS.SHEET_NAMES.SCHEDULE,
    titlePropertyName,
  );

  const props = PropertiesService.getScriptProperties();
  if (created.studentDbId) {
    props.setProperty(PROPS_KEY_NOTION_STUDENT_DB_ID, created.studentDbId);
  }
  if (created.reservationDbId) {
    props.setProperty(
      PROPS_KEY_NOTION_RESERVATION_DB_ID,
      created.reservationDbId,
    );
  }
  if (created.scheduleDbId) {
    props.setProperty(PROPS_KEY_NOTION_SCHEDULE_DB_ID, created.scheduleDbId);
  }

  Logger.log(`Notion同期DB作成完了: ${JSON.stringify(created)}`);
  return created;
}

/**
 * Notion 接続設定を削除します（デバッグ用）
 * @returns {void}
 */
export function clearNotionCredentials() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(PROPS_KEY_NOTION_TOKEN);
  props.deleteProperty(PROPS_KEY_NOTION_STUDENT_DB_ID);
  props.deleteProperty(PROPS_KEY_NOTION_RESERVATION_DB_ID);
  props.deleteProperty(PROPS_KEY_NOTION_SCHEDULE_DB_ID);
  props.deleteProperty(PROPS_KEY_NOTION_STUDENT_SYNC_CURSOR);
  props.deleteProperty(PROPS_KEY_NOTION_RESERVATION_SYNC_CURSOR);
  props.deleteProperty(PROPS_KEY_NOTION_RESERVATION_SYNC_ORDER_HASH);
  props.deleteProperty(PROPS_KEY_NOTION_SYNC_QUEUE);
  props.deleteProperty(PROPS_KEY_NOTION_SYNC_QUEUE_TRIGGER_ID);
  props.deleteProperty(PROPS_KEY_NOTION_SYNC_QUEUE_RUNNER_STATE);
  props.deleteProperty(PROPS_KEY_NOTION_BATCH_TRIGGER_ID);
  _deleteNotionSyncQueueTriggers();
  _deleteNotionBatchTriggers();
  Logger.log('Notion認証情報を削除しました');
}

// ================================================================
// ★★★ 個別同期（リアルタイム用） ★★★
// ================================================================

/**
 * 生徒データを Notion に同期します
 * 登録・更新・退会時に呼び出されます
 *
 * @param {string} studentId - 生徒ID
 * @param {'create' | 'update' | 'delete'} action - 同期アクション
 * @param {NotionStudentSyncOptions} [options]
 * @returns {NotionSyncResult}
 */
export function syncStudentToNotion(studentId, action, options = {}) {
  try {
    const config = getNotionConfig();
    if (!config) {
      Logger.log('Notion同期スキップ: 設定が未完了です');
      return { success: false, error: '設定未完了' };
    }

    // 生徒データを取得
    const student = getCachedStudentById(studentId);
    if (!student && action !== 'delete') {
      Logger.log(`Notion同期エラー: 生徒が見つかりません - ${studentId}`);
      return { success: false, error: '生徒が見つかりません' };
    }

    let rosterValues = options.rosterValues || null;
    let rosterSnapshot = options.rosterSnapshot || null;
    if (!rosterValues && !options.skipSheetAccess) {
      if (!rosterSnapshot) {
        rosterSnapshot = _getRosterSnapshot();
      }
      rosterValues = rosterSnapshot?.byId.get(studentId)?.values || null;
    }

    const schema =
      options.schema || _getNotionDatabaseSchema(config, config.studentDbId);

    /** @type {StudentData} */
    const studentData = student || { studentId };
    if (action === 'delete') {
      studentData.status = '退会済み';
    }

    const mergedValues = _mergeStudentValues(studentData, rosterValues);
    const titleValue = _getStudentTitle(mergedValues, studentData);
    const properties = _buildNotionPropertiesFromValues(
      mergedValues,
      schema,
      titleValue,
    );
    const normalized = _buildNormalizedValuesForHash(
      mergedValues,
      schema,
      titleValue,
    );
    const rowHash = _computeRowHash(normalized);
    const propertyNames = Object.keys(normalized);
    const meta = _getNotionSyncMeta(NOTION_SYNC_ENTITY.STUDENT, studentId);

    const metaResult = _trySyncNotionByMeta(
      config,
      meta,
      rowHash,
      properties,
      titleValue || '生徒',
      NOTION_SYNC_ENTITY.STUDENT,
      studentId,
    );
    if (metaResult) {
      return metaResult;
    }

    /** @type {NotionPage | null} */
    let existingPage = options.existingPage || null;
    if (!existingPage && !NOTION_ASSUME_NO_MANUAL_EDITS) {
      if (meta?.pageId) {
        existingPage = _getNotionPageById(config, meta.pageId);
        if (!existingPage) {
          _clearNotionSyncMeta(NOTION_SYNC_ENTITY.STUDENT, studentId);
        }
      }
    }

    if (!existingPage) {
      // 既存の Notion ページを検索
      existingPage = _findNotionPageByProperty(
        config,
        config.studentDbId,
        CONSTANTS.HEADERS.ROSTER.STUDENT_ID,
        studentId,
        schema,
      );
    }

    switch (action) {
      case 'create':
        if (existingPage) {
          // 既に存在する場合は更新
          if (
            _shouldSkipNotionUpdate(
              existingPage,
              schema,
              propertyNames,
              rowHash,
            )
          ) {
            _upsertNotionSyncMeta(
              NOTION_SYNC_ENTITY.STUDENT,
              studentId,
              existingPage.id,
              rowHash,
            );
            return { success: true, pageId: existingPage.id, skipped: true };
          }
          const result = _updateNotionPageInDatabase(
            config,
            existingPage.id,
            properties,
            titleValue || '生徒',
          );
          if (result.success) {
            _upsertNotionSyncMeta(
              NOTION_SYNC_ENTITY.STUDENT,
              studentId,
              result.pageId || existingPage.id,
              rowHash,
            );
          }
          return result;
        }
        {
          const result = _createNotionPageInDatabase(
            config,
            config.studentDbId,
            properties,
            titleValue || '生徒',
          );
          if (result.success && result.pageId) {
            _upsertNotionSyncMeta(
              NOTION_SYNC_ENTITY.STUDENT,
              studentId,
              result.pageId,
              rowHash,
            );
          }
          return result;
        }

      case 'update':
        if (existingPage) {
          if (
            _shouldSkipNotionUpdate(
              existingPage,
              schema,
              propertyNames,
              rowHash,
            )
          ) {
            _upsertNotionSyncMeta(
              NOTION_SYNC_ENTITY.STUDENT,
              studentId,
              existingPage.id,
              rowHash,
            );
            return { success: true, pageId: existingPage.id, skipped: true };
          }
          const result = _updateNotionPageInDatabase(
            config,
            existingPage.id,
            properties,
            titleValue || '生徒',
          );
          if (result.success) {
            _upsertNotionSyncMeta(
              NOTION_SYNC_ENTITY.STUDENT,
              studentId,
              result.pageId || existingPage.id,
              rowHash,
            );
          }
          return result;
        }
        // 存在しない場合は新規作成
        {
          const result = _createNotionPageInDatabase(
            config,
            config.studentDbId,
            properties,
            titleValue || '生徒',
          );
          if (result.success && result.pageId) {
            _upsertNotionSyncMeta(
              NOTION_SYNC_ENTITY.STUDENT,
              studentId,
              result.pageId,
              rowHash,
            );
          }
          return result;
        }

      case 'delete':
        if (existingPage) {
          if (
            _shouldSkipNotionUpdate(
              existingPage,
              schema,
              propertyNames,
              rowHash,
            )
          ) {
            _upsertNotionSyncMeta(
              NOTION_SYNC_ENTITY.STUDENT,
              studentId,
              existingPage.id,
              rowHash,
            );
            return { success: true, pageId: existingPage.id, skipped: true };
          }
          const result = _updateNotionPageInDatabase(
            config,
            existingPage.id,
            properties,
            titleValue || '生徒',
          );
          if (result.success) {
            _upsertNotionSyncMeta(
              NOTION_SYNC_ENTITY.STUDENT,
              studentId,
              result.pageId || existingPage.id,
              rowHash,
            );
          }
          return result;
        }
        return { success: true }; // 存在しなければ何もしない

      default:
        return { success: false, error: `不明なアクション: ${action}` };
    }
  } catch (error) {
    Logger.log(
      `syncStudentToNotion Error: ${/** @type {Error} */ (error).message}`,
    );
    return { success: false, error: /** @type {Error} */ (error).message };
  }
}

// ================================================================
// ★★★ バッチ同期（時間トリガー用） ★★★
// ================================================================

/**
 * 全生徒データを Notion に同期します（差分同期）
 * 時間トリガーで1日1回実行することを想定しています
 *
 * @returns {{success: boolean, created: number, updated: number, skipped: number, errors: number}}
 */
export function syncAllStudentsToNotion() {
  const startTime = new Date();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  try {
    const config = getNotionConfig();
    if (!config) {
      Logger.log('Notion一括同期スキップ: 設定が未完了です');
      return { success: false, created: 0, updated: 0, skipped: 0, errors: 0 };
    }

    // 全生徒データを取得
    const allStudents = getCachedAllStudents();
    if (!allStudents || Object.keys(allStudents).length === 0) {
      Logger.log('Notion一括同期: 生徒データがありません');
      return { success: true, created: 0, updated: 0, skipped: 0, errors: 0 };
    }

    const rosterSnapshot = _getRosterSnapshot();
    const schema = _getNotionDatabaseSchema(config, config.studentDbId);

    // Notion側の既存ページを全取得
    const existingPages = _getAllNotionPages(config, config.studentDbId);
    /** @type {Map<string | null, NotionPage>} */
    const existingPageMap = new Map(
      existingPages.map(page => [_extractStudentIdFromPage(page), page]),
    );

    Logger.log(
      `Notion一括同期開始: スプレッドシート ${Object.keys(allStudents).length}件, Notion ${existingPages.length}件`,
    );

    // 各生徒を同期
    for (const studentId in allStudents) {
      const student = allStudents[studentId];

      // 退会済みユーザーはスキップ（または「退会済み」ステータスで同期）
      const phoneText =
        student.phone === null || student.phone === undefined
          ? ''
          : String(student.phone);
      const isWithdrawn = phoneText.startsWith('_WITHDRAWN_');

      try {
        const existingPage = existingPageMap.get(studentId);

        /** @type {StudentData} */
        const studentData = {
          studentId: student.studentId,
          nickname: student.nickname,
          realName: student.realName,
          phone: student.phone,
          status: isWithdrawn ? '退会済み' : '在籍中',
        };

        const rosterValues =
          rosterSnapshot?.byId.get(studentId)?.values || null;
        const mergedValues = _mergeStudentValues(studentData, rosterValues);
        const titleValue = _getStudentTitle(mergedValues, studentData);
        const properties = _buildNotionPropertiesFromValues(
          mergedValues,
          schema,
          titleValue,
        );
        const normalized = _buildNormalizedValuesForHash(
          mergedValues,
          schema,
          titleValue,
        );
        const rowHash = _computeRowHash(normalized);
        const propertyNames = Object.keys(normalized);

        if (existingPage) {
          if (
            _shouldSkipNotionUpdate(
              existingPage,
              schema,
              propertyNames,
              rowHash,
            )
          ) {
            skipped++;
            _upsertNotionSyncMeta(
              NOTION_SYNC_ENTITY.STUDENT,
              studentId,
              existingPage.id,
              rowHash,
            );
          } else {
            const result = _updateNotionPageInDatabase(
              config,
              existingPage.id,
              properties,
              titleValue || '生徒',
            );
            if (result.success) {
              updated++;
              _upsertNotionSyncMeta(
                NOTION_SYNC_ENTITY.STUDENT,
                studentId,
                result.pageId || existingPage.id,
                rowHash,
              );
            } else {
              errors++;
            }
          }
        } else if (!isWithdrawn) {
          // 新規作成（退会済みは新規作成しない）
          const result = _createNotionPageInDatabase(
            config,
            config.studentDbId,
            properties,
            titleValue || '生徒',
          );
          if (result.success) {
            created++;
            if (result.pageId) {
              _upsertNotionSyncMeta(
                NOTION_SYNC_ENTITY.STUDENT,
                studentId,
                result.pageId,
                rowHash,
              );
            }
          } else {
            errors++;
          }
        }

        // レート制限対策
        Utilities.sleep(RATE_LIMIT_DELAY_MS);
      } catch (error) {
        Logger.log(
          `Notion同期エラー (${studentId}): ${/** @type {Error} */ (error).message}`,
        );
        errors++;
      }
    }

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;

    Logger.log(
      `Notion一括同期完了: 作成=${created}, 更新=${updated}, スキップ=${skipped}, エラー=${errors}, 所要時間=${duration}秒`,
    );

    return { success: true, created, updated, skipped, errors };
  } catch (error) {
    Logger.log(
      `syncAllStudentsToNotion Error: ${/** @type {Error} */ (error).message}`,
    );
    return { success: false, created, updated, skipped, errors: errors + 1 };
  }
}

/**
 * 全生徒データを分割で Notion に同期します（途中再開可能）
 *
 * @param {number} [batchSize=50] - 1回で処理する件数
 * @returns {{success: boolean, created: number, updated: number, skipped: number, errors: number, processed: number, total: number, done: boolean, nextIndex: number}}
 */
export function syncAllStudentsToNotionChunk(batchSize = 50) {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  try {
    const config = getNotionConfig();
    if (!config) {
      Logger.log('Notion一括同期スキップ: 設定が未完了です');
      return {
        success: false,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
        processed: 0,
        total: 0,
        done: true,
        nextIndex: 0,
      };
    }

    const allStudents = getCachedAllStudents();
    if (!allStudents || Object.keys(allStudents).length === 0) {
      Logger.log('Notion一括同期: 生徒データがありません');
      return {
        success: true,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
        processed: 0,
        total: 0,
        done: true,
        nextIndex: 0,
      };
    }

    const rosterSnapshot = _getRosterSnapshot();
    const orderedIds = rosterSnapshot
      ? _getOrderedIdsFromSnapshot(rosterSnapshot)
      : Object.keys(allStudents);
    const total = orderedIds.length;
    if (total === 0) {
      return {
        success: true,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
        processed: 0,
        total: 0,
        done: true,
        nextIndex: 0,
      };
    }

    const props = PropertiesService.getScriptProperties();
    const storedCursor = props.getProperty(
      PROPS_KEY_NOTION_STUDENT_SYNC_CURSOR,
    );
    const cursorIndex = storedCursor ? Number(storedCursor) : 0;
    const startIndex =
      Number.isFinite(cursorIndex) && cursorIndex > 0 ? cursorIndex : 0;

    if (startIndex >= total) {
      // 完了済みの場合は、次回以降に0から再実行されないようカーソルを保持する
      props.setProperty(PROPS_KEY_NOTION_STUDENT_SYNC_CURSOR, String(total));
      return {
        success: true,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
        processed: 0,
        total,
        done: true,
        nextIndex: 0,
      };
    }

    const safeBatchSize = Number(batchSize);
    const effectiveBatchSize =
      Number.isFinite(safeBatchSize) && safeBatchSize > 0
        ? Math.floor(safeBatchSize)
        : 50;
    const endIndex = Math.min(startIndex + effectiveBatchSize, total);

    const schema = _getNotionDatabaseSchema(config, config.studentDbId);
    const existingPages = _getAllNotionPages(config, config.studentDbId);
    /** @type {Map<string | null, NotionPage>} */
    const existingPageMap = new Map(
      existingPages.map(page => [_extractStudentIdFromPage(page), page]),
    );

    for (let idx = startIndex; idx < endIndex; idx++) {
      const studentId = orderedIds[idx];
      const student = allStudents[studentId] || getCachedStudentById(studentId);
      const rosterValues = rosterSnapshot?.byId.get(studentId)?.values || null;

      const phoneRaw =
        student?.phone ?? rosterValues?.[CONSTANTS.HEADERS.ROSTER.PHONE] ?? '';
      const phoneText =
        phoneRaw === null || phoneRaw === undefined ? '' : String(phoneRaw);
      const isWithdrawn = phoneText.startsWith('_WITHDRAWN_');

      /** @type {StudentData} */
      const studentData = {
        studentId: student?.studentId || studentId,
        nickname:
          student?.nickname ||
          _stringifyValue(rosterValues?.[CONSTANTS.HEADERS.ROSTER.NICKNAME]),
        realName:
          student?.realName ||
          _stringifyValue(rosterValues?.[CONSTANTS.HEADERS.ROSTER.REAL_NAME]),
        phone: phoneRaw,
        status: isWithdrawn ? '退会済み' : '在籍中',
      };

      try {
        const existingPage = existingPageMap.get(studentId);
        const mergedValues = _mergeStudentValues(studentData, rosterValues);
        const titleValue = _getStudentTitle(mergedValues, studentData);
        const properties = _buildNotionPropertiesFromValues(
          mergedValues,
          schema,
          titleValue,
        );
        const normalized = _buildNormalizedValuesForHash(
          mergedValues,
          schema,
          titleValue,
        );
        const rowHash = _computeRowHash(normalized);
        const propertyNames = Object.keys(normalized);

        if (existingPage) {
          if (
            _shouldSkipNotionUpdate(
              existingPage,
              schema,
              propertyNames,
              rowHash,
            )
          ) {
            skipped++;
            _upsertNotionSyncMeta(
              NOTION_SYNC_ENTITY.STUDENT,
              studentId,
              existingPage.id,
              rowHash,
            );
          } else {
            const result = _updateNotionPageInDatabase(
              config,
              existingPage.id,
              properties,
              titleValue || '生徒',
            );
            if (result.success) {
              updated++;
              _upsertNotionSyncMeta(
                NOTION_SYNC_ENTITY.STUDENT,
                studentId,
                result.pageId || existingPage.id,
                rowHash,
              );
            } else {
              errors++;
            }
          }
        } else if (!isWithdrawn) {
          const result = _createNotionPageInDatabase(
            config,
            config.studentDbId,
            properties,
            titleValue || '生徒',
          );
          if (result.success) {
            created++;
            if (result.pageId) {
              _upsertNotionSyncMeta(
                NOTION_SYNC_ENTITY.STUDENT,
                studentId,
                result.pageId,
                rowHash,
              );
            }
          } else {
            errors++;
          }
        }
      } catch (error) {
        Logger.log(
          `Notion同期エラー (${studentId}): ${/** @type {Error} */ (error).message}`,
        );
        errors++;
      }

      Utilities.sleep(RATE_LIMIT_DELAY_MS);
    }

    const processed = endIndex - startIndex;
    const done = endIndex >= total;
    // done のときもカーソルを保持し、次回以降の再実行を防止する
    props.setProperty(PROPS_KEY_NOTION_STUDENT_SYNC_CURSOR, String(endIndex));

    return {
      success: true,
      created,
      updated,
      skipped,
      errors,
      processed,
      total,
      done,
      nextIndex: done ? 0 : endIndex,
    };
  } catch (error) {
    Logger.log(
      `syncAllStudentsToNotionChunk Error: ${/** @type {Error} */ (error).message}`,
    );
    return {
      success: false,
      created,
      updated,
      skipped,
      errors: errors + 1,
      processed: 0,
      total: 0,
      done: false,
      nextIndex: 0,
    };
  }
}

/**
 * 生徒一括同期のカーソルをリセットします
 * @returns {void}
 */
export function resetNotionStudentSyncCursor() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(PROPS_KEY_NOTION_STUDENT_SYNC_CURSOR);
  Logger.log('Notion生徒一括同期カーソルをリセットしました');
}

/**
 * 予約一括同期のカーソルをリセットします
 * @returns {void}
 */
export function resetNotionReservationSyncCursor() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(PROPS_KEY_NOTION_RESERVATION_SYNC_CURSOR);
  props.deleteProperty(PROPS_KEY_NOTION_RESERVATION_SYNC_ORDER_HASH);
  Logger.log('Notion予約一括同期カーソルをリセットしました');
}

/**
 * Notion分割同期を開始します（手動実行用）
 * 初回実行を即時に行い、残りは時間トリガーで継続します。
 *
 * @param {boolean} [resetCursor=true] - true の場合はカーソルをリセットして最初から同期します
 * @returns {{success: boolean, message: string, runResult?: any}}
 */
export function startNotionSyncBatch(resetCursor = true) {
  const scriptLock = LockService.getScriptLock();
  if (!scriptLock.tryLock(CONSTANTS.LIMITS.LOCK_WAIT_TIME_MS)) {
    Logger.log(
      'Notion分割同期開始: 他の処理が実行中のため開始をスキップしました。',
    );
    return {
      success: false,
      message: '他の処理が実行中のため開始できませんでした',
    };
  }

  try {
    if (resetCursor) {
      resetNotionStudentSyncCursor();
      resetNotionReservationSyncCursor();
    }
    _ensureNotionBatchTrigger();
  } catch (error) {
    Logger.log(
      `Notion分割同期開始エラー: ${/** @type {Error} */ (error).message}`,
    );
    return {
      success: false,
      message: /** @type {Error} */ (error).message,
    };
  } finally {
    scriptLock.releaseLock();
  }

  const runResult = runNotionSyncBatch();
  return {
    success: true,
    message: 'Notion分割同期を開始しました',
    runResult,
  };
}

/**
 * Notion分割同期を1バッチ実行します（時間トリガー用）
 * 生徒・予約記録が完了したら、最後に日程を一括同期してトリガーを停止します。
 *
 * @returns {{success: boolean, done: boolean, students: any, reservations: any, schedules: any, skippedByLock?: boolean, deletedTriggers?: number}}
 */
export function runNotionSyncBatch() {
  const scriptLock = LockService.getScriptLock();
  if (!scriptLock.tryLock(CONSTANTS.LIMITS.LOCK_WAIT_TIME_MS)) {
    Logger.log(
      'Notion分割同期: 他の処理が実行中のため、このバッチ実行をスキップしました。',
    );
    return {
      success: false,
      done: false,
      students: null,
      reservations: null,
      schedules: null,
      skippedByLock: true,
    };
  }

  try {
    // 手動実行でも継続できるよう、未作成ならトリガーを作成しておく
    _ensureNotionBatchTrigger();

    const students = syncAllStudentsToNotionChunk(
      NOTION_BATCH_STUDENT_BATCH_SIZE,
    );
    const reservations = syncAllReservationsToNotionChunk(
      NOTION_BATCH_RESERVATION_BATCH_SIZE,
    );
    const done = students.done && reservations.done;

    if (!done) {
      return {
        success: students.success && reservations.success,
        done: false,
        students,
        reservations,
        schedules: null,
      };
    }

    const schedules = syncAllSchedulesToNotion();
    const deletedTriggers = _deleteNotionBatchTriggers();
    Logger.log(
      `Notion分割同期が完了したためトリガーを停止しました（削除: ${deletedTriggers}件）。`,
    );
    return {
      success: students.success && reservations.success && schedules.success,
      done: true,
      students,
      reservations,
      schedules,
      deletedTriggers,
    };
  } catch (error) {
    Logger.log(
      `runNotionSyncBatch Error: ${/** @type {Error} */ (error).message}`,
    );
    return {
      success: false,
      done: false,
      students: null,
      reservations: null,
      schedules: null,
    };
  } finally {
    scriptLock.releaseLock();
  }
}

/**
 * Notion分割同期トリガーを停止します
 *
 * @param {boolean} [resetCursor=false] - true の場合は同期カーソルも初期化します
 * @returns {{success: boolean, deletedTriggers: number}}
 */
export function stopNotionSyncBatch(resetCursor = false) {
  const scriptLock = LockService.getScriptLock();
  if (!scriptLock.tryLock(CONSTANTS.LIMITS.LOCK_WAIT_TIME_MS)) {
    Logger.log(
      'Notion分割同期停止: ロック取得に失敗したためスキップしました。',
    );
    return { success: false, deletedTriggers: 0 };
  }

  try {
    const deletedTriggers = _deleteNotionBatchTriggers();
    if (resetCursor) {
      resetNotionStudentSyncCursor();
      resetNotionReservationSyncCursor();
    }
    Logger.log(
      `Notion分割同期トリガーを停止しました（削除: ${deletedTriggers}件）。`,
    );
    return { success: true, deletedTriggers };
  } catch (error) {
    Logger.log(
      `stopNotionSyncBatch Error: ${/** @type {Error} */ (error).message}`,
    );
    return { success: false, deletedTriggers: 0 };
  } finally {
    scriptLock.releaseLock();
  }
}

/**
 * 生徒IDを指定して Notion に同期します
 *
 * @param {string[] | string} studentIds - 生徒ID配列 またはカンマ/改行区切り文字列
 * @param {'create' | 'update' | 'delete'} [action='update']
 * @returns {{success: boolean, results: Array<{studentId: string, success: boolean, error?: string}>}}
 */
export function syncStudentsToNotionByIds(studentIds, action = 'update') {
  const ids = _normalizeIdList(studentIds);
  /** @type {Array<{studentId: string, success: boolean, error?: string}>} */
  const results = [];

  ids.forEach(id => {
    const result = syncStudentToNotion(id, action);
    if (result.error) {
      results.push({
        studentId: id,
        success: result.success,
        error: result.error,
      });
      return;
    }
    results.push({ studentId: id, success: result.success });
  });

  return {
    success: results.every(item => item.success),
    results,
  };
}

// ================================================================
// ★★★ 予約記録・日程の同期 ★★★
// ================================================================

/**
 * 予約記録を Notion に同期します
 *
 * @param {string} reservationId - 予約ID
 * @param {'create' | 'update' | 'delete'} [action='update'] - 同期アクション
 * @param {NotionReservationSyncOptions} [options]
 * @returns {NotionSyncResult}
 */
export function syncReservationToNotion(
  reservationId,
  action = 'update',
  options = {},
) {
  try {
    const config = getNotionConfig();
    const reservationDbId = config?.reservationDbId;
    if (!reservationDbId) {
      Logger.log('Notion予約同期スキップ: 予約DBが未設定です');
      return { success: false, error: '予約DB未設定' };
    }
    if (!reservationId) {
      return { success: false, error: 'reservationId が必要です' };
    }

    let rowValues = options.reservationValues || null;
    let snapshot = options.reservationSnapshot || null;
    if (!rowValues && !options.skipSheetAccess) {
      if (!snapshot) {
        snapshot = _getReservationSnapshot();
      }
      rowValues = snapshot?.byId.get(String(reservationId))?.values || null;
    }
    if (!rowValues) {
      Logger.log(
        `Notion予約同期スキップ: 予約が見つかりません - ${reservationId}`,
      );
      return { success: false, error: '予約が見つかりません' };
    }

    const schema =
      options.schema || _getNotionDatabaseSchema(config, reservationDbId);
    const titleValue = _getReservationTitle(rowValues);
    const properties = _buildNotionPropertiesFromValues(
      rowValues,
      schema,
      titleValue,
    );
    const normalized = _buildNormalizedValuesForHash(
      rowValues,
      schema,
      titleValue,
    );
    const rowHash = _computeRowHash(normalized);
    const propertyNames = Object.keys(normalized);
    const meta = _getNotionSyncMeta(
      NOTION_SYNC_ENTITY.RESERVATION,
      String(reservationId),
    );

    const metaResult = _trySyncNotionByMeta(
      config,
      meta,
      rowHash,
      properties,
      titleValue,
      NOTION_SYNC_ENTITY.RESERVATION,
      String(reservationId),
    );
    if (metaResult) {
      return metaResult;
    }

    /** @type {NotionPage | null} */
    let existingPage = options.existingPage || null;
    if (!existingPage && !NOTION_ASSUME_NO_MANUAL_EDITS) {
      if (meta?.pageId) {
        existingPage = _getNotionPageById(config, meta.pageId);
        if (!existingPage) {
          _clearNotionSyncMeta(
            NOTION_SYNC_ENTITY.RESERVATION,
            String(reservationId),
          );
        }
      }
    }
    if (!existingPage) {
      existingPage = _findNotionPageByProperty(
        config,
        reservationDbId,
        CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID,
        String(reservationId),
        schema,
      );
    }

    if (existingPage) {
      if (
        _shouldSkipNotionUpdate(existingPage, schema, propertyNames, rowHash)
      ) {
        _upsertNotionSyncMeta(
          NOTION_SYNC_ENTITY.RESERVATION,
          String(reservationId),
          existingPage.id,
          rowHash,
        );
        return { success: true, pageId: existingPage.id, skipped: true };
      }
      const result = _updateNotionPageInDatabase(
        config,
        existingPage.id,
        properties,
        titleValue,
      );
      if (result.success) {
        _upsertNotionSyncMeta(
          NOTION_SYNC_ENTITY.RESERVATION,
          String(reservationId),
          result.pageId || existingPage.id,
          rowHash,
        );
      }
      return result;
    }

    if (action === 'delete') {
      return { success: true };
    }

    {
      const result = _createNotionPageInDatabase(
        config,
        reservationDbId,
        properties,
        titleValue,
      );
      if (result.success && result.pageId) {
        _upsertNotionSyncMeta(
          NOTION_SYNC_ENTITY.RESERVATION,
          String(reservationId),
          result.pageId,
          rowHash,
        );
      }
      return result;
    }
  } catch (error) {
    Logger.log(
      `syncReservationToNotion Error: ${/** @type {Error} */ (error).message}`,
    );
    return { success: false, error: /** @type {Error} */ (error).message };
  }
}

/**
 * 日程を Notion に同期します
 *
 * @param {string} lessonId - レッスンID
 * @param {'create' | 'update' | 'delete'} [action='update'] - 同期アクション
 * @param {NotionScheduleSyncOptions} [options]
 * @returns {NotionSyncResult}
 */
export function syncScheduleToNotion(
  lessonId,
  action = 'update',
  options = {},
) {
  try {
    const config = getNotionConfig();
    const scheduleDbId = config?.scheduleDbId;
    if (!scheduleDbId) {
      Logger.log('Notion日程同期スキップ: 日程DBが未設定です');
      return { success: false, error: '日程DB未設定' };
    }
    if (!lessonId) {
      return { success: false, error: 'lessonId が必要です' };
    }

    let rowValues = options.scheduleValues || null;
    let snapshot = options.scheduleSnapshot || null;
    if (!rowValues && !options.skipSheetAccess) {
      if (!snapshot) {
        snapshot = _getScheduleSnapshot();
      }
      rowValues = snapshot?.byId.get(String(lessonId))?.values || null;
    }
    if (!rowValues) {
      Logger.log(`Notion日程同期スキップ: 日程が見つかりません - ${lessonId}`);
      return { success: false, error: '日程が見つかりません' };
    }

    const schema =
      options.schema || _getNotionDatabaseSchema(config, scheduleDbId);
    const titleValue = _getScheduleTitle(rowValues);
    const properties = _buildNotionPropertiesFromValues(
      rowValues,
      schema,
      titleValue,
    );
    const normalized = _buildNormalizedValuesForHash(
      rowValues,
      schema,
      titleValue,
    );
    const rowHash = _computeRowHash(normalized);
    const propertyNames = Object.keys(normalized);
    const meta = _getNotionSyncMeta(
      NOTION_SYNC_ENTITY.SCHEDULE,
      String(lessonId),
    );

    const metaResult = _trySyncNotionByMeta(
      config,
      meta,
      rowHash,
      properties,
      titleValue,
      NOTION_SYNC_ENTITY.SCHEDULE,
      String(lessonId),
    );
    if (metaResult) {
      return metaResult;
    }

    /** @type {NotionPage | null} */
    let existingPage = options.existingPage || null;
    if (!existingPage && !NOTION_ASSUME_NO_MANUAL_EDITS) {
      if (meta?.pageId) {
        existingPage = _getNotionPageById(config, meta.pageId);
        if (!existingPage) {
          _clearNotionSyncMeta(NOTION_SYNC_ENTITY.SCHEDULE, String(lessonId));
        }
      }
    }
    if (!existingPage) {
      existingPage = _findNotionPageByProperty(
        config,
        scheduleDbId,
        CONSTANTS.HEADERS.SCHEDULE.LESSON_ID,
        String(lessonId),
        schema,
      );
    }

    if (existingPage) {
      if (
        _shouldSkipNotionUpdate(existingPage, schema, propertyNames, rowHash)
      ) {
        _upsertNotionSyncMeta(
          NOTION_SYNC_ENTITY.SCHEDULE,
          String(lessonId),
          existingPage.id,
          rowHash,
        );
        return { success: true, pageId: existingPage.id, skipped: true };
      }
      const result = _updateNotionPageInDatabase(
        config,
        existingPage.id,
        properties,
        titleValue,
      );
      if (result.success) {
        _upsertNotionSyncMeta(
          NOTION_SYNC_ENTITY.SCHEDULE,
          String(lessonId),
          result.pageId || existingPage.id,
          rowHash,
        );
      }
      return result;
    }

    if (action === 'delete') {
      return { success: true };
    }

    {
      const result = _createNotionPageInDatabase(
        config,
        scheduleDbId,
        properties,
        titleValue,
      );
      if (result.success && result.pageId) {
        _upsertNotionSyncMeta(
          NOTION_SYNC_ENTITY.SCHEDULE,
          String(lessonId),
          result.pageId,
          rowHash,
        );
      }
      return result;
    }
  } catch (error) {
    Logger.log(
      `syncScheduleToNotion Error: ${/** @type {Error} */ (error).message}`,
    );
    return { success: false, error: /** @type {Error} */ (error).message };
  }
}

/**
 * 生徒同期をキューに登録します（非同期実行）。
 * @param {string} studentId
 * @param {'create' | 'update' | 'delete'} [action='update']
 * @returns {{success: boolean, queued: boolean, queueLength?: number, message?: string}}
 */
export function enqueueStudentSyncToNotion(studentId, action = 'update') {
  if (!studentId) {
    return { success: false, queued: false, message: 'studentId が必要です' };
  }
  return _enqueueNotionSyncTask({
    entity: NOTION_SYNC_QUEUE_ENTITY.STUDENT,
    sourceId: String(studentId),
    action,
  });
}

/**
 * 予約同期をキューに登録します（非同期実行）。
 * @param {string} reservationId
 * @param {'create' | 'update' | 'delete'} [action='update']
 * @returns {{success: boolean, queued: boolean, queueLength?: number, message?: string}}
 */
export function enqueueReservationSyncToNotion(
  reservationId,
  action = 'update',
) {
  if (!reservationId) {
    return {
      success: false,
      queued: false,
      message: 'reservationId が必要です',
    };
  }
  return _enqueueNotionSyncTask({
    entity: NOTION_SYNC_QUEUE_ENTITY.RESERVATION,
    sourceId: String(reservationId),
    action,
  });
}

/**
 * 日程同期をキューに登録します（非同期実行）。
 * @param {string} lessonId
 * @param {'create' | 'update' | 'delete'} [action='update']
 * @returns {{success: boolean, queued: boolean, queueLength?: number, message?: string}}
 */
export function enqueueScheduleSyncToNotion(lessonId, action = 'update') {
  if (!lessonId) {
    return { success: false, queued: false, message: 'lessonId が必要です' };
  }
  return _enqueueNotionSyncTask({
    entity: NOTION_SYNC_QUEUE_ENTITY.SCHEDULE,
    sourceId: String(lessonId),
    action,
  });
}

/**
 * 直近日程の一括同期をキューに登録します（非同期実行）。
 * @param {number} [daysBack=30]
 * @returns {{success: boolean, queued: boolean, queueLength?: number, message?: string}}
 */
export function enqueueUpcomingSchedulesSyncToNotion(daysBack = 30) {
  const parsedDaysBack = Number(daysBack);
  const normalizedDaysBack =
    Number.isFinite(parsedDaysBack) && parsedDaysBack > 0
      ? Math.floor(parsedDaysBack)
      : 30;

  return _enqueueNotionSyncTask({
    entity: NOTION_SYNC_QUEUE_ENTITY.UPCOMING_SCHEDULES,
    sourceId: 'upcoming',
    action: 'update',
    daysBack: normalizedDaysBack,
  });
}

/**
 * Notion同期キューを1バッチ処理します（時間トリガー用）。
 * @returns {{success: boolean, done: boolean, processed: number, failed: number, retried: number, dropped: number, remaining: number, skippedByLock?: boolean}}
 */
export function runNotionSyncQueue() {
  const runnerId = Utilities.getUuid();
  /** @type {NotionSyncQueueTask[]} */
  let processing = [];

  // 1) キュー取得フェーズ（短時間ロック）
  const startLock = LockService.getScriptLock();
  if (!startLock.tryLock(CONSTANTS.LIMITS.LOCK_WAIT_TIME_MS)) {
    Logger.log(
      'Notion同期キュー: 他の処理が実行中のため、このバッチ実行をスキップしました。',
    );
    return {
      success: false,
      done: false,
      processed: 0,
      failed: 0,
      retried: 0,
      dropped: 0,
      remaining: 0,
      skippedByLock: true,
    };
  }

  try {
    const now = Date.now();
    const currentRunner = _getNotionSyncQueueRunnerState();
    if (currentRunner && currentRunner.expiresAt > now) {
      Logger.log(
        'Notion同期キュー: 別ランナーが実行中のため、このバッチ実行をスキップしました。',
      );
      return {
        success: false,
        done: false,
        processed: 0,
        failed: 0,
        retried: 0,
        dropped: 0,
        remaining: _getNotionSyncQueue().length,
        skippedByLock: true,
      };
    }
    _setNotionSyncQueueRunnerState(
      runnerId,
      now + NOTION_SYNC_QUEUE_RUNNER_TTL_MS,
    );

    const queue = _getNotionSyncQueue();
    if (queue.length === 0) {
      const deletedTriggers = _deleteNotionSyncQueueTriggers();
      _clearNotionSyncQueueRunnerState(runnerId);
      if (deletedTriggers > 0) {
        Logger.log(
          `Notion同期キューが空のためトリガーを停止しました（削除: ${deletedTriggers}件）。`,
        );
      }
      return {
        success: true,
        done: true,
        processed: 0,
        failed: 0,
        retried: 0,
        dropped: 0,
        remaining: 0,
      };
    }

    const processingCount = Math.min(
      queue.length,
      NOTION_SYNC_QUEUE_BATCH_SIZE,
    );
    processing = queue.slice(0, processingCount);
  } catch (error) {
    _clearNotionSyncQueueRunnerState(runnerId);
    Logger.log(
      `runNotionSyncQueue 初期化エラー: ${/** @type {Error} */ (error).message}`,
    );
    return {
      success: false,
      done: false,
      processed: 0,
      failed: 0,
      retried: 0,
      dropped: 0,
      remaining: _getNotionSyncQueue().length,
    };
  } finally {
    startLock.releaseLock();
  }

  // 2) Notion同期実行フェーズ（ロックなし）
  /** @type {Array<{taskKey: string, enqueuedAt: number, success: boolean}>} */
  const executionResults = [];
  processing.forEach(task => {
    try {
      const result = _executeNotionSyncQueueTask(task);
      executionResults.push({
        taskKey: task.taskKey,
        enqueuedAt: Number(task.enqueuedAt || 0),
        success: !!result.success,
      });
      if (!result.success) {
        Logger.log(
          `Notion同期キュー: 同期失敗 ${task.taskKey} (${result.error || 'unknown'})`,
        );
      }
    } catch (error) {
      executionResults.push({
        taskKey: task.taskKey,
        enqueuedAt: Number(task.enqueuedAt || 0),
        success: false,
      });
      Logger.log(
        `Notion同期キュー処理エラー (${task.taskKey}): ${/** @type {Error} */ (error).message}`,
      );
    }
  });

  // 3) キュー反映フェーズ（短時間ロック）
  const commitLock = LockService.getScriptLock();
  try {
    commitLock.waitLock(CONSTANTS.LIMITS.LOCK_WAIT_TIME_MS);
  } catch (lockError) {
    _clearNotionSyncQueueRunnerState(runnerId);
    Logger.log(
      `runNotionSyncQueue 反映ロック取得エラー: ${/** @type {Error} */ (lockError).message}`,
    );
    return {
      success: false,
      done: false,
      processed: 0,
      failed: 0,
      retried: 0,
      dropped: 0,
      remaining: _getNotionSyncQueue().length,
      skippedByLock: true,
    };
  }

  try {
    const currentRunner = _getNotionSyncQueueRunnerState();
    if (!currentRunner || currentRunner.runnerId !== runnerId) {
      Logger.log(
        'Notion同期キュー: 実行権が無効化されたため結果反映をスキップしました。',
      );
      return {
        success: false,
        done: false,
        processed: 0,
        failed: 0,
        retried: 0,
        dropped: 0,
        remaining: _getNotionSyncQueue().length,
        skippedByLock: true,
      };
    }

    /** @type {NotionSyncQueueTask[]} */
    const nextQueue = _getNotionSyncQueue();
    let processed = 0;
    let failed = 0;
    let retried = 0;
    let dropped = 0;

    executionResults.forEach(result => {
      const index = nextQueue.findIndex(
        task => task.taskKey === result.taskKey,
      );
      if (index < 0) return;
      const currentTask = nextQueue[index];
      if (Number(currentTask.enqueuedAt || 0) !== result.enqueuedAt) {
        // 実行中に同一キーの新しいタスクが上書き登録された場合は触らない
        return;
      }

      if (result.success) {
        nextQueue.splice(index, 1);
        processed += 1;
        return;
      }

      failed += 1;
      const retryCount = Number(currentTask.retryCount || 0);
      if (retryCount < NOTION_SYNC_QUEUE_MAX_RETRY) {
        nextQueue[index] = {
          ...currentTask,
          retryCount: retryCount + 1,
          enqueuedAt: Date.now(),
        };
        retried += 1;
        Logger.log(
          `Notion同期キュー: リトライ登録 ${currentTask.taskKey} (${retryCount + 1}/${NOTION_SYNC_QUEUE_MAX_RETRY})`,
        );
        return;
      }

      nextQueue.splice(index, 1);
      dropped += 1;
      Logger.log(
        `Notion同期キュー: 最大リトライ超過で破棄 ${currentTask.taskKey}`,
      );
    });

    const trimmedQueue = _trimNotionSyncQueue(nextQueue);
    _setNotionSyncQueue(trimmedQueue);
    if (trimmedQueue.length === 0) {
      _deleteNotionSyncQueueTriggers();
    }

    return {
      success: failed === 0,
      done: trimmedQueue.length === 0,
      processed,
      failed,
      retried,
      dropped,
      remaining: trimmedQueue.length,
    };
  } catch (error) {
    Logger.log(
      `runNotionSyncQueue Error: ${/** @type {Error} */ (error).message}`,
    );
    return {
      success: false,
      done: false,
      processed: 0,
      failed: 0,
      retried: 0,
      dropped: 0,
      remaining: _getNotionSyncQueue().length,
    };
  } finally {
    _clearNotionSyncQueueRunnerState(runnerId);
    commitLock.releaseLock();
  }
}

/**
 * 同期タスクを実行します。
 * @param {NotionSyncQueueTask} task
 * @returns {NotionSyncResult}
 * @private
 */
function _executeNotionSyncQueueTask(task) {
  const action =
    task.action === 'create' || task.action === 'delete'
      ? task.action
      : 'update';

  switch (task.entity) {
    case NOTION_SYNC_QUEUE_ENTITY.STUDENT:
      return syncStudentToNotion(task.sourceId, action);
    case NOTION_SYNC_QUEUE_ENTITY.RESERVATION:
      return syncReservationToNotion(task.sourceId, action);
    case NOTION_SYNC_QUEUE_ENTITY.SCHEDULE:
      return syncScheduleToNotion(task.sourceId, action);
    case NOTION_SYNC_QUEUE_ENTITY.UPCOMING_SCHEDULES: {
      const result = syncUpcomingSchedulesToNotion({
        daysBack:
          Number.isFinite(Number(task.daysBack)) && Number(task.daysBack) > 0
            ? Math.floor(Number(task.daysBack))
            : 30,
      });
      return result.success
        ? { success: true }
        : { success: false, error: '直近日程同期に失敗しました' };
    }
    default:
      return { success: false, error: `未知のentity: ${String(task.entity)}` };
  }
}

/**
 * 同期タスクをキューに追加します（同一キーは上書き）。
 * @param {{entity: NotionSyncQueueEntity, sourceId: string, action?: 'create' | 'update' | 'delete', daysBack?: number}} payload
 * @returns {{success: boolean, queued: boolean, queueLength?: number, message?: string}}
 * @private
 */
function _enqueueNotionSyncTask(payload) {
  const entity = payload?.entity;
  const sourceId = String(payload?.sourceId || '').trim();
  if (!_isValidNotionSyncQueueEntity(entity) || !sourceId) {
    return {
      success: false,
      queued: false,
      message: 'キュー登録パラメータが不正です',
    };
  }

  const scriptLock = LockService.getScriptLock();
  if (!scriptLock.tryLock(NOTION_SYNC_QUEUE_LOCK_WAIT_MS)) {
    Logger.log(
      'Notion同期キュー: ロック取得失敗のため登録をスキップしました。',
    );
    return {
      success: false,
      queued: false,
      message: 'ロック取得に失敗したためキュー登録できませんでした',
    };
  }

  try {
    const taskKey = _buildNotionSyncQueueTaskKey(entity, sourceId);
    const queue = _getNotionSyncQueue();
    /** @type {NotionSyncQueueTask} */
    const task = {
      taskKey,
      entity,
      sourceId,
      action: payload.action || 'update',
      enqueuedAt: Date.now(),
      retryCount: 0,
      ...(entity === NOTION_SYNC_QUEUE_ENTITY.UPCOMING_SCHEDULES
        ? {
            daysBack:
              Number.isFinite(Number(payload.daysBack)) &&
              Number(payload.daysBack) > 0
                ? Math.floor(Number(payload.daysBack))
                : 30,
          }
        : {}),
    };

    const existingIndex = queue.findIndex(item => item.taskKey === taskKey);
    if (existingIndex >= 0) {
      queue[existingIndex] = {
        ...queue[existingIndex],
        ...task,
        retryCount: 0,
        enqueuedAt: Date.now(),
      };
    } else {
      queue.push(task);
    }

    const trimmedQueue = _trimNotionSyncQueue(queue);
    _setNotionSyncQueue(trimmedQueue);
    _ensureNotionSyncQueueTrigger();

    return {
      success: true,
      queued: true,
      queueLength: trimmedQueue.length,
    };
  } catch (error) {
    Logger.log(
      `Notion同期キュー登録エラー: ${/** @type {Error} */ (error).message}`,
    );
    return {
      success: false,
      queued: false,
      message: /** @type {Error} */ (error).message,
    };
  } finally {
    scriptLock.releaseLock();
  }
}

/**
 * 同期キューを取得します。
 * @returns {NotionSyncQueueTask[]}
 * @private
 */
function _getNotionSyncQueue() {
  try {
    const queueJson = PropertiesService.getScriptProperties().getProperty(
      PROPS_KEY_NOTION_SYNC_QUEUE,
    );
    if (!queueJson) return [];

    const parsed = JSON.parse(queueJson);
    if (!Array.isArray(parsed)) return [];

    /** @type {NotionSyncQueueTask[]} */
    const normalizedQueue = [];
    parsed.forEach(item => {
      const entity = item?.entity;
      const sourceId = String(item?.sourceId || '').trim();
      if (!_isValidNotionSyncQueueEntity(entity) || !sourceId) {
        return;
      }
      const action =
        item?.action === 'create' ||
        item?.action === 'delete' ||
        item?.action === 'update'
          ? item.action
          : 'update';
      normalizedQueue.push({
        taskKey:
          String(item?.taskKey || '').trim() ||
          _buildNotionSyncQueueTaskKey(entity, sourceId),
        entity,
        sourceId,
        action,
        enqueuedAt: Number(item?.enqueuedAt || Date.now()),
        retryCount: Number(item?.retryCount || 0),
        ...(entity === NOTION_SYNC_QUEUE_ENTITY.UPCOMING_SCHEDULES
          ? {
              daysBack:
                Number.isFinite(Number(item?.daysBack)) &&
                Number(item?.daysBack) > 0
                  ? Math.floor(Number(item.daysBack))
                  : 30,
            }
          : {}),
      });
    });
    return normalizedQueue;
  } catch (error) {
    Logger.log(
      `Notion同期キュー読み込みエラー: ${/** @type {Error} */ (error).message}`,
    );
    return [];
  }
}

/**
 * 同期キューを保存します。
 * @param {NotionSyncQueueTask[]} queue
 * @private
 */
function _setNotionSyncQueue(queue) {
  const props = PropertiesService.getScriptProperties();
  if (!queue || queue.length === 0) {
    props.deleteProperty(PROPS_KEY_NOTION_SYNC_QUEUE);
    return;
  }
  props.setProperty(PROPS_KEY_NOTION_SYNC_QUEUE, JSON.stringify(queue));
}

/**
 * 同期キュー実行状態を取得します。
 * @returns {NotionSyncQueueRunnerState | null}
 * @private
 */
function _getNotionSyncQueueRunnerState() {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty(
      PROPS_KEY_NOTION_SYNC_QUEUE_RUNNER_STATE,
    );
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const runnerId = String(parsed?.runnerId || '').trim();
    const expiresAt = Number(parsed?.expiresAt || 0);
    if (!runnerId || !Number.isFinite(expiresAt) || expiresAt <= 0) {
      return null;
    }
    return { runnerId, expiresAt };
  } catch (_error) {
    return null;
  }
}

/**
 * 同期キュー実行状態を設定します。
 * @param {string} runnerId
 * @param {number} expiresAt
 * @private
 */
function _setNotionSyncQueueRunnerState(runnerId, expiresAt) {
  PropertiesService.getScriptProperties().setProperty(
    PROPS_KEY_NOTION_SYNC_QUEUE_RUNNER_STATE,
    JSON.stringify({ runnerId, expiresAt }),
  );
}

/**
 * 同期キュー実行状態をクリアします。
 * @param {string} expectedRunnerId
 * @private
 */
function _clearNotionSyncQueueRunnerState(expectedRunnerId) {
  const props = PropertiesService.getScriptProperties();
  const current = _getNotionSyncQueueRunnerState();
  if (
    current &&
    expectedRunnerId &&
    current.runnerId &&
    current.runnerId !== expectedRunnerId
  ) {
    return;
  }
  props.deleteProperty(PROPS_KEY_NOTION_SYNC_QUEUE_RUNNER_STATE);
}

/**
 * 同期キューの件数を上限内に丸めます。
 * @param {NotionSyncQueueTask[]} queue
 * @returns {NotionSyncQueueTask[]}
 * @private
 */
function _trimNotionSyncQueue(queue) {
  if (!Array.isArray(queue)) return [];
  if (queue.length <= NOTION_SYNC_QUEUE_MAX_TASKS) return queue;

  Logger.log(
    `Notion同期キューが上限(${NOTION_SYNC_QUEUE_MAX_TASKS})を超過したため古いタスクを破棄します: ${queue.length}件`,
  );
  return [...queue]
    .sort((a, b) => Number(b.enqueuedAt || 0) - Number(a.enqueuedAt || 0))
    .slice(0, NOTION_SYNC_QUEUE_MAX_TASKS)
    .sort((a, b) => Number(a.enqueuedAt || 0) - Number(b.enqueuedAt || 0));
}

/**
 * キュータスクキーを作成します。
 * @param {NotionSyncQueueEntity} entity
 * @param {string} sourceId
 * @returns {string}
 * @private
 */
function _buildNotionSyncQueueTaskKey(entity, sourceId) {
  return `${entity}:${sourceId}`;
}

/**
 * キューエンティティの妥当性を判定します。
 * @param {any} entity
 * @returns {entity is NotionSyncQueueEntity}
 * @private
 */
function _isValidNotionSyncQueueEntity(entity) {
  return (
    entity === NOTION_SYNC_QUEUE_ENTITY.STUDENT ||
    entity === NOTION_SYNC_QUEUE_ENTITY.RESERVATION ||
    entity === NOTION_SYNC_QUEUE_ENTITY.SCHEDULE ||
    entity === NOTION_SYNC_QUEUE_ENTITY.UPCOMING_SCHEDULES
  );
}

/**
 * 予約記録を一括で Notion に同期します
 *
 * @returns {{success: boolean, created: number, updated: number, skipped: number, errors: number}}
 */
export function syncAllReservationsToNotion() {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  try {
    const config = getNotionConfig();
    const reservationDbId = config?.reservationDbId;
    if (!reservationDbId) {
      Logger.log('Notion予約一括同期スキップ: 予約DBが未設定です');
      return { success: false, created: 0, updated: 0, skipped: 0, errors: 0 };
    }

    const snapshot = _getReservationSnapshot();
    if (!snapshot) {
      Logger.log('Notion予約一括同期: 予約データがありません');
      return { success: true, created: 0, updated: 0, skipped: 0, errors: 0 };
    }

    const schema = _getNotionDatabaseSchema(config, reservationDbId);
    const existingPages = _getAllNotionPages(config, reservationDbId);
    const pageMap = _mapNotionPagesByProperty(
      existingPages,
      CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID,
    );

    snapshot.byId.forEach((entry, reservationId) => {
      try {
        const titleValue = _getReservationTitle(entry.values);
        const properties = _buildNotionPropertiesFromValues(
          entry.values,
          schema,
          titleValue,
        );

        const normalized = _buildNormalizedValuesForHash(
          entry.values,
          schema,
          titleValue,
        );
        const rowHash = _computeRowHash(normalized);
        const propertyNames = Object.keys(normalized);

        const existingPage = pageMap.get(String(reservationId));
        if (existingPage) {
          if (
            _shouldSkipNotionUpdate(
              existingPage,
              schema,
              propertyNames,
              rowHash,
            )
          ) {
            skipped++;
            _upsertNotionSyncMeta(
              NOTION_SYNC_ENTITY.RESERVATION,
              String(reservationId),
              existingPage.id,
              rowHash,
            );
          } else {
            const result = _updateNotionPageInDatabase(
              config,
              existingPage.id,
              properties,
              titleValue,
            );
            if (result.success) {
              updated++;
              _upsertNotionSyncMeta(
                NOTION_SYNC_ENTITY.RESERVATION,
                String(reservationId),
                result.pageId || existingPage.id,
                rowHash,
              );
            } else {
              errors++;
            }
          }
        } else {
          const result = _createNotionPageInDatabase(
            config,
            reservationDbId,
            properties,
            titleValue,
          );
          if (result.success) {
            created++;
            if (result.pageId) {
              _upsertNotionSyncMeta(
                NOTION_SYNC_ENTITY.RESERVATION,
                String(reservationId),
                result.pageId,
                rowHash,
              );
            }
          } else {
            errors++;
          }
        }
      } catch (error) {
        Logger.log(
          `Notion予約一括同期エラー (${reservationId}): ${/** @type {Error} */ (error).message}`,
        );
        errors++;
      }

      Utilities.sleep(RATE_LIMIT_DELAY_MS);
    });

    return { success: true, created, updated, skipped, errors };
  } catch (error) {
    Logger.log(
      `syncAllReservationsToNotion Error: ${/** @type {Error} */ (error).message}`,
    );
    return { success: false, created, updated, skipped, errors: errors + 1 };
  }
}

/**
 * 予約記録を分割で Notion に同期します（途中再開可能）
 *
 * @param {number} [batchSize=100] - 1回で処理する件数
 * @returns {{success: boolean, created: number, updated: number, skipped: number, errors: number, processed: number, total: number, done: boolean, nextIndex: number}}
 */
export function syncAllReservationsToNotionChunk(batchSize = 100) {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  try {
    const config = getNotionConfig();
    const reservationDbId = config?.reservationDbId;
    if (!reservationDbId) {
      Logger.log('Notion予約一括同期スキップ: 予約DBが未設定です');
      return {
        success: false,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
        processed: 0,
        total: 0,
        done: true,
        nextIndex: 0,
      };
    }

    const snapshot = _getReservationSnapshot();
    if (!snapshot) {
      Logger.log('Notion予約一括同期: 予約データがありません');
      return {
        success: true,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
        processed: 0,
        total: 0,
        done: true,
        nextIndex: 0,
      };
    }

    const orderedIds = _getOrderedIdsFromSnapshot(snapshot);
    const total = orderedIds.length;
    if (total === 0) {
      return {
        success: true,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
        processed: 0,
        total: 0,
        done: true,
        nextIndex: 0,
      };
    }

    const props = PropertiesService.getScriptProperties();
    const storedCursor = props.getProperty(
      PROPS_KEY_NOTION_RESERVATION_SYNC_CURSOR,
    );
    const cursorIndex = storedCursor ? Number(storedCursor) : 0;
    let startIndex =
      Number.isFinite(cursorIndex) && cursorIndex > 0 ? cursorIndex : 0;
    const orderHash = _computeStringArrayHash(orderedIds);
    const storedOrderHash = props.getProperty(
      PROPS_KEY_NOTION_RESERVATION_SYNC_ORDER_HASH,
    );
    if (startIndex > 0 && !storedOrderHash) {
      Logger.log(
        'Notion予約一括同期: 順序ハッシュが未初期化のため、カーソルを先頭に戻して全件確認します。',
      );
      startIndex = 0;
    } else if (
      startIndex > 0 &&
      storedOrderHash &&
      storedOrderHash !== orderHash
    ) {
      Logger.log(
        `Notion予約一括同期: 並び順変更を検知したためカーソルを先頭に戻します（旧=${storedOrderHash.slice(0, 8)}..., 新=${orderHash.slice(0, 8)}...）`,
      );
      startIndex = 0;
    }

    if (startIndex >= total) {
      // 完了済みの場合は、次回以降に0から再実行されないようカーソルを保持する
      props.setProperty(
        PROPS_KEY_NOTION_RESERVATION_SYNC_CURSOR,
        String(total),
      );
      props.setProperty(
        PROPS_KEY_NOTION_RESERVATION_SYNC_ORDER_HASH,
        orderHash,
      );
      return {
        success: true,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
        processed: 0,
        total,
        done: true,
        nextIndex: 0,
      };
    }

    const safeBatchSize = Number(batchSize);
    const effectiveBatchSize =
      Number.isFinite(safeBatchSize) && safeBatchSize > 0
        ? Math.floor(safeBatchSize)
        : 100;
    const endIndex = Math.min(startIndex + effectiveBatchSize, total);

    const schema = _getNotionDatabaseSchema(config, reservationDbId);
    const existingPages = _getAllNotionPages(config, reservationDbId);
    const pageMap = _mapNotionPagesByProperty(
      existingPages,
      CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID,
    );

    for (let idx = startIndex; idx < endIndex; idx++) {
      const reservationId = orderedIds[idx];
      const entry = snapshot.byId.get(reservationId);
      if (!entry) continue;

      try {
        const titleValue = _getReservationTitle(entry.values);
        const properties = _buildNotionPropertiesFromValues(
          entry.values,
          schema,
          titleValue,
        );

        const normalized = _buildNormalizedValuesForHash(
          entry.values,
          schema,
          titleValue,
        );
        const rowHash = _computeRowHash(normalized);
        const propertyNames = Object.keys(normalized);

        const existingPage = pageMap.get(String(reservationId));
        if (existingPage) {
          if (
            _shouldSkipNotionUpdate(
              existingPage,
              schema,
              propertyNames,
              rowHash,
            )
          ) {
            skipped++;
            _upsertNotionSyncMeta(
              NOTION_SYNC_ENTITY.RESERVATION,
              String(reservationId),
              existingPage.id,
              rowHash,
            );
          } else {
            const result = _updateNotionPageInDatabase(
              config,
              existingPage.id,
              properties,
              titleValue,
            );
            if (result.success) {
              updated++;
              _upsertNotionSyncMeta(
                NOTION_SYNC_ENTITY.RESERVATION,
                String(reservationId),
                result.pageId || existingPage.id,
                rowHash,
              );
            } else {
              errors++;
            }
          }
        } else {
          const result = _createNotionPageInDatabase(
            config,
            reservationDbId,
            properties,
            titleValue,
          );
          if (result.success) {
            created++;
            if (result.pageId) {
              _upsertNotionSyncMeta(
                NOTION_SYNC_ENTITY.RESERVATION,
                String(reservationId),
                result.pageId,
                rowHash,
              );
            }
          } else {
            errors++;
          }
        }
      } catch (error) {
        Logger.log(
          `Notion予約一括同期エラー (${reservationId}): ${/** @type {Error} */ (error).message}`,
        );
        errors++;
      }

      Utilities.sleep(RATE_LIMIT_DELAY_MS);
    }

    const processed = endIndex - startIndex;
    const done = endIndex >= total;
    // done のときもカーソルを保持し、次回以降の再実行を防止する
    props.setProperty(
      PROPS_KEY_NOTION_RESERVATION_SYNC_CURSOR,
      String(endIndex),
    );
    props.setProperty(PROPS_KEY_NOTION_RESERVATION_SYNC_ORDER_HASH, orderHash);

    return {
      success: true,
      created,
      updated,
      skipped,
      errors,
      processed,
      total,
      done,
      nextIndex: done ? 0 : endIndex,
    };
  } catch (error) {
    Logger.log(
      `syncAllReservationsToNotionChunk Error: ${/** @type {Error} */ (error).message}`,
    );
    return {
      success: false,
      created,
      updated,
      skipped,
      errors: errors + 1,
      processed: 0,
      total: 0,
      done: false,
      nextIndex: 0,
    };
  }
}

/**
 * 日程を一括で Notion に同期します
 *
 * @returns {{success: boolean, created: number, updated: number, skipped: number, errors: number}}
 */
export function syncAllSchedulesToNotion() {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  try {
    const config = getNotionConfig();
    const scheduleDbId = config?.scheduleDbId;
    if (!scheduleDbId) {
      Logger.log('Notion日程一括同期スキップ: 日程DBが未設定です');
      return { success: false, created: 0, updated: 0, skipped: 0, errors: 0 };
    }

    const snapshot = _getScheduleSnapshot();
    if (!snapshot) {
      Logger.log('Notion日程一括同期: 日程データがありません');
      return { success: true, created: 0, updated: 0, skipped: 0, errors: 0 };
    }

    const schema = _getNotionDatabaseSchema(config, scheduleDbId);
    const existingPages = _getAllNotionPages(config, scheduleDbId);
    const pageMap = _mapNotionPagesByProperty(
      existingPages,
      CONSTANTS.HEADERS.SCHEDULE.LESSON_ID,
    );

    snapshot.byId.forEach((entry, lessonId) => {
      try {
        const titleValue = _getScheduleTitle(entry.values);
        const properties = _buildNotionPropertiesFromValues(
          entry.values,
          schema,
          titleValue,
        );

        const normalized = _buildNormalizedValuesForHash(
          entry.values,
          schema,
          titleValue,
        );
        const rowHash = _computeRowHash(normalized);
        const propertyNames = Object.keys(normalized);
        const sourceId = String(lessonId);
        const existingPage = pageMap.get(sourceId);

        const meta = _getNotionSyncMeta(NOTION_SYNC_ENTITY.SCHEDULE, sourceId);
        // メタ rowHash だけでのスキップは、対象DB上にページが確認できる場合のみ許可する
        if (existingPage && meta?.rowHash && meta.rowHash === rowHash) {
          skipped++;
          _upsertNotionSyncMeta(
            NOTION_SYNC_ENTITY.SCHEDULE,
            sourceId,
            existingPage.id,
            rowHash,
          );
          return;
        }

        if (existingPage) {
          if (
            _shouldSkipNotionUpdate(
              existingPage,
              schema,
              propertyNames,
              rowHash,
            )
          ) {
            skipped++;
            _upsertNotionSyncMeta(
              NOTION_SYNC_ENTITY.SCHEDULE,
              sourceId,
              existingPage.id,
              rowHash,
            );
          } else {
            const result = _updateNotionPageInDatabase(
              config,
              existingPage.id,
              properties,
              titleValue,
            );
            if (result.success) {
              updated++;
              _upsertNotionSyncMeta(
                NOTION_SYNC_ENTITY.SCHEDULE,
                sourceId,
                result.pageId || existingPage.id,
                rowHash,
              );
            } else {
              errors++;
            }
          }
        } else {
          const result = _createNotionPageInDatabase(
            config,
            scheduleDbId,
            properties,
            titleValue,
          );
          if (result.success) {
            created++;
            if (result.pageId) {
              _upsertNotionSyncMeta(
                NOTION_SYNC_ENTITY.SCHEDULE,
                sourceId,
                result.pageId,
                rowHash,
              );
            }
          } else {
            errors++;
          }
        }
      } catch (error) {
        Logger.log(
          `Notion日程一括同期エラー (${lessonId}): ${/** @type {Error} */ (error).message}`,
        );
        errors++;
      }

      Utilities.sleep(RATE_LIMIT_DELAY_MS);
    });

    return { success: true, created, updated, skipped, errors };
  } catch (error) {
    Logger.log(
      `syncAllSchedulesToNotion Error: ${/** @type {Error} */ (error).message}`,
    );
    return { success: false, created, updated, skipped, errors: errors + 1 };
  }
}

/**
 * 指定日以降の日程を Notion に同期します。
 * 既定では当日以降、`daysBack` を指定すると「当日 - daysBack」以降を同期します。
 *
 * @param {{ daysBack?: number }} [options]
 * @returns {{success: boolean, created: number, updated: number, errors: number, skipped: number}}
 */
export function syncUpcomingSchedulesToNotion(options = {}) {
  let created = 0;
  let updated = 0;
  let errors = 0;
  let skipped = 0;

  try {
    const config = getNotionConfig();
    const scheduleDbId = config?.scheduleDbId;
    if (!scheduleDbId) {
      Logger.log('Notion日程同期スキップ: 日程DBが未設定です');
      return { success: false, created: 0, updated: 0, errors: 0, skipped: 0 };
    }

    const snapshot = _getScheduleSnapshot();
    if (!snapshot) {
      Logger.log('Notion日程同期: 日程データがありません');
      return { success: true, created: 0, updated: 0, errors: 0, skipped: 0 };
    }

    const schema = _getNotionDatabaseSchema(config, scheduleDbId);
    const existingPages = _getAllNotionPages(config, scheduleDbId);
    const pageMap = _mapNotionPagesByProperty(
      existingPages,
      CONSTANTS.HEADERS.SCHEDULE.LESSON_ID,
    );

    const rawDaysBack = Number(options?.daysBack);
    const daysBack =
      Number.isFinite(rawDaysBack) && rawDaysBack > 0
        ? Math.floor(rawDaysBack)
        : 0;
    const lowerBoundDate = _getTodayStart();
    if (daysBack > 0) {
      lowerBoundDate.setDate(lowerBoundDate.getDate() - daysBack);
    }

    snapshot.byId.forEach((entry, lessonId) => {
      try {
        const dateValue = entry.values[CONSTANTS.HEADERS.SCHEDULE.DATE];
        const parsedDate = _parseScheduleDateForComparison(dateValue);
        if (!parsedDate) {
          skipped++;
          return;
        }
        if (parsedDate < lowerBoundDate) {
          skipped++;
          return;
        }

        const titleValue = _getScheduleTitle(entry.values);
        const properties = _buildNotionPropertiesFromValues(
          entry.values,
          schema,
          titleValue,
        );

        const normalized = _buildNormalizedValuesForHash(
          entry.values,
          schema,
          titleValue,
        );
        const rowHash = _computeRowHash(normalized);
        const propertyNames = Object.keys(normalized);

        const existingPage = pageMap.get(String(lessonId));
        if (existingPage) {
          if (
            _shouldSkipNotionUpdate(
              existingPage,
              schema,
              propertyNames,
              rowHash,
            )
          ) {
            skipped++;
            _upsertNotionSyncMeta(
              NOTION_SYNC_ENTITY.SCHEDULE,
              String(lessonId),
              existingPage.id,
              rowHash,
            );
          } else {
            const result = _updateNotionPageInDatabase(
              config,
              existingPage.id,
              properties,
              titleValue,
            );
            if (result.success) {
              updated++;
              _upsertNotionSyncMeta(
                NOTION_SYNC_ENTITY.SCHEDULE,
                String(lessonId),
                result.pageId || existingPage.id,
                rowHash,
              );
            } else {
              errors++;
            }
          }
        } else {
          const result = _createNotionPageInDatabase(
            config,
            scheduleDbId,
            properties,
            titleValue,
          );
          if (result.success) {
            created++;
            if (result.pageId) {
              _upsertNotionSyncMeta(
                NOTION_SYNC_ENTITY.SCHEDULE,
                String(lessonId),
                result.pageId,
                rowHash,
              );
            }
          } else {
            errors++;
          }
        }
      } catch (error) {
        Logger.log(
          `Notion日程同期エラー (${lessonId}): ${/** @type {Error} */ (error).message}`,
        );
        errors++;
      }

      Utilities.sleep(RATE_LIMIT_DELAY_MS);
    });

    return { success: true, created, updated, errors, skipped };
  } catch (error) {
    Logger.log(
      `syncUpcomingSchedulesToNotion Error: ${/** @type {Error} */ (error).message}`,
    );
    return { success: false, created, updated, errors: errors + 1, skipped };
  }
}

// ================================================================
// ★★★ Notion API ラッパー ★★★
// ================================================================

/**
 * Notion API にリクエストを送信します
 *
 * @param {string} token - Notion API トークン
 * @param {string} endpoint - APIエンドポイント（/databases/xxx など）
 * @param {GoogleAppsScript.URL_Fetch.HttpMethod} method - HTTPメソッド
 * @param {Object | null} [payload] - リクエストボディ
 * @returns {NotionApiResponse} レスポンス
 * @private
 */
function _notionRequest(token, endpoint, method, payload = null) {
  /** @type {GoogleAppsScript.URL_Fetch.URLFetchRequestOptions} */
  const options = {
    method: method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_API_VERSION,
      'Content-Type': 'application/json',
    },
    muteHttpExceptions: true,
  };

  if (payload) {
    options.payload = JSON.stringify(payload);
  }

  const response = UrlFetchApp.fetch(`${NOTION_API_BASE}${endpoint}`, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode >= 400) {
    throw new Error(`Notion API Error (${responseCode}): ${responseText}`);
  }

  return /** @type {NotionApiResponse} */ (JSON.parse(responseText));
}

/**
 * Notionトークンを取得します
 *
 * @returns {string | null}
 * @private
 */
function _getNotionToken() {
  try {
    const props = PropertiesService.getScriptProperties();
    return props.getProperty(PROPS_KEY_NOTION_TOKEN);
  } catch (error) {
    Logger.log(
      `Notionトークン取得エラー: ${/** @type {Error} */ (error).message}`,
    );
    return null;
  }
}

/**
 * Notion DB をシート定義から作成します
 *
 * @param {string} token
 * @param {string} parentPageId
 * @param {string} dbName
 * @param {string} sheetName
 * @param {string} titlePropertyName
 * @returns {string}
 * @private
 */
function _createNotionDatabaseFromSheet(
  token,
  parentPageId,
  dbName,
  sheetName,
  titlePropertyName,
) {
  const sheet = SS_MANAGER.getSheet(sheetName);
  if (!sheet) {
    throw new Error(`シートが見つかりません: ${sheetName}`);
  }
  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .filter(header => header);

  /** @type {Record<string, any>} */
  const properties = {
    [titlePropertyName]: { title: {} },
  };

  headers.forEach(header => {
    if (header === titlePropertyName) return;
    properties[header] = { rich_text: {} };
  });

  const response = _notionRequest(token, '/databases', 'post', {
    parent: { type: 'page_id', page_id: parentPageId },
    title: [{ text: { content: dbName } }],
    properties,
  });

  if (!response?.id) {
    throw new Error(`Notion DB作成に失敗しました: ${dbName}`);
  }

  Logger.log(`Notion DB作成成功: ${dbName} (${response.id})`);
  return response.id;
}

/**
 * NotionページIDを正規化します
 *
 * @param {string} input
 * @returns {string | null}
 * @private
 */
function _normalizeNotionPageId(input) {
  if (!input) return null;
  const trimmed = String(input).trim();
  const idMatch = trimmed.match(/[0-9a-fA-F]{32}/);
  if (idMatch) return idMatch[0];
  const hyphenatedMatch = trimmed.match(
    /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/,
  );
  if (hyphenatedMatch) {
    return hyphenatedMatch[0].replace(/-/g, '');
  }
  return null;
}

/**
 * 任意DBにNotionページを作成します
 *
 * @param {NotionConfig} config
 * @param {string} databaseId
 * @param {Record<string, any>} properties
 * @param {string} label
 * @returns {NotionSyncResult}
 * @private
 */
function _createNotionPageInDatabase(config, databaseId, properties, label) {
  try {
    const response = _notionRequest(config.token, '/pages', 'post', {
      parent: { database_id: databaseId },
      properties: properties,
    });

    Logger.log(`Notionページ作成成功: ${response.id} (${label})`);
    return { success: true, pageId: response.id };
  } catch (error) {
    Logger.log(
      `Notionページ作成エラー: ${/** @type {Error} */ (error).message}`,
    );
    return { success: false, error: /** @type {Error} */ (error).message };
  }
}

/**
 * 任意DBのNotionページを更新します
 *
 * @param {NotionConfig} config
 * @param {string} pageId
 * @param {Record<string, any>} properties
 * @param {string} label
 * @returns {NotionSyncResult}
 * @private
 */
function _updateNotionPageInDatabase(config, pageId, properties, label) {
  try {
    const response = _notionRequest(config.token, `/pages/${pageId}`, 'patch', {
      properties: properties,
    });

    Logger.log(`Notionページ更新成功: ${response.id} (${label})`);
    return { success: true, pageId: response.id };
  } catch (error) {
    Logger.log(
      `Notionページ更新エラー: ${/** @type {Error} */ (error).message}`,
    );
    return { success: false, error: /** @type {Error} */ (error).message };
  }
}

/**
 * 任意のキーで Notion ページを検索します
 *
 * @param {NotionConfig} config
 * @param {string} databaseId
 * @param {string} propertyName
 * @param {string} value
 * @param {NotionDatabaseSchema | null} schema
 * @returns {NotionPage | null}
 * @private
 */
function _findNotionPageByProperty(
  config,
  databaseId,
  propertyName,
  value,
  schema,
) {
  try {
    const filter = _buildNotionFilter(propertyName, value, schema);
    if (!filter) return null;

    const response = _notionRequest(
      config.token,
      `/databases/${databaseId}/query`,
      'post',
      {
        filter,
      },
    );

    if (response.results && response.results.length > 0) {
      return response.results[0];
    }

    return null;
  } catch (error) {
    Logger.log(
      `Notionページ検索エラー: ${/** @type {Error} */ (error).message}`,
    );
    return null;
  }
}

/**
 * NotionページIDからページ情報を取得します
 *
 * @param {NotionConfig} config
 * @param {string} pageId
 * @returns {NotionPage | null}
 * @private
 */
function _getNotionPageById(config, pageId) {
  if (!pageId) return null;
  try {
    const response = _notionRequest(config.token, `/pages/${pageId}`, 'get');
    if (!response?.id) return null;
    return /** @type {NotionPage} */ (response);
  } catch (error) {
    Logger.log(
      `Notionページ取得エラー: ${/** @type {Error} */ (error).message}`,
    );
    return null;
  }
}

/**
 * フィルタ条件を構築します
 *
 * @param {string} propertyName
 * @param {string} value
 * @param {NotionDatabaseSchema | null} schema
 * @returns {Object | null}
 * @private
 */
function _buildNotionFilter(propertyName, value, schema) {
  if (!propertyName || value === undefined || value === null) return null;
  const valueText = String(value);
  const propertyType = schema?.properties?.[propertyName]?.type;

  switch (propertyType) {
    case 'title':
      return { property: propertyName, title: { equals: valueText } };
    case 'rich_text':
      return { property: propertyName, rich_text: { equals: valueText } };
    case 'number': {
      const numberValue = Number(valueText);
      if (Number.isNaN(numberValue)) return null;
      return { property: propertyName, number: { equals: numberValue } };
    }
    case 'select':
      return { property: propertyName, select: { equals: valueText } };
    default:
      return { property: propertyName, rich_text: { equals: valueText } };
  }
}

/**
 * Notion データベースの全ページを取得します
 *
 * @param {NotionConfig} config
 * @param {string} databaseId
 * @returns {NotionPage[]}
 * @private
 */
function _getAllNotionPages(config, databaseId) {
  /** @type {NotionPage[]} */
  const allPages = [];
  let hasMore = true;
  /** @type {string | undefined} */
  let startCursor = undefined;

  try {
    while (hasMore) {
      /** @type {{start_cursor?: string}} */
      const payload = {};
      if (startCursor) {
        payload.start_cursor = startCursor;
      }

      const response = _notionRequest(
        config.token,
        `/databases/${databaseId}/query`,
        'post',
        payload,
      );

      if (response.results) {
        allPages.push(...response.results);
      }

      hasMore = response.has_more || false;
      startCursor = response.next_cursor || undefined;
    }

    return allPages;
  } catch (error) {
    Logger.log(
      `Notion全ページ取得エラー: ${/** @type {Error} */ (error).message}`,
    );
    return allPages;
  }
}

/**
 * Notion ページから生徒IDを抽出します
 *
 * @param {NotionPage} page - Notionページオブジェクト
 * @returns {string | null}
 * @private
 */
function _extractStudentIdFromPage(page) {
  try {
    return _extractPropertyValueFromPage(
      page,
      CONSTANTS.HEADERS.ROSTER.STUDENT_ID,
    );
  } catch (_error) {
    return null;
  }
}

/**
 * Notionページから指定プロパティの値を抽出します
 *
 * @param {NotionPage} page
 * @param {string} propertyName
 * @returns {string | null}
 * @private
 */
function _extractPropertyValueFromPage(page, propertyName) {
  const prop = page.properties?.[propertyName];
  if (!prop) return null;

  switch (prop.type) {
    case 'rich_text':
      return prop.rich_text && prop.rich_text[0]
        ? prop.rich_text[0].plain_text
        : null;
    case 'title':
      return prop.title && prop.title[0] ? prop.title[0].plain_text : null;
    case 'number':
      return prop.number !== null && prop.number !== undefined
        ? String(prop.number)
        : null;
    case 'select':
      return prop.select?.name || null;
    default:
      return null;
  }
}

/**
 * Notionページ配列をキーでマッピングします
 *
 * @param {NotionPage[]} pages
 * @param {string} propertyName
 * @returns {Map<string, NotionPage>}
 * @private
 */
function _mapNotionPagesByProperty(pages, propertyName) {
  const map = new Map();
  pages.forEach(page => {
    const value = _extractPropertyValueFromPage(page, propertyName);
    if (value) {
      map.set(String(value), page);
    }
  });
  return map;
}

/**
 * 生徒データと名簿値をマージします
 *
 * @param {StudentData} student
 * @param {Record<string, any> | null} rosterValues
 * @returns {Record<string, any>}
 * @private
 */
function _mergeStudentValues(student, rosterValues) {
  const values = { ...(rosterValues || {}) };
  if (student.studentId && values['生徒ID'] == null) {
    values['生徒ID'] = student.studentId;
  }
  if (student.nickname && values['ニックネーム'] == null) {
    values['ニックネーム'] = student.nickname;
  }
  if (student.realName && values['本名'] == null) {
    values['本名'] = student.realName;
  }
  if (student.phone && values['電話番号'] == null) {
    values['電話番号'] = student.phone;
  }
  if (student.status && values['ステータス'] == null) {
    values['ステータス'] = student.status;
  }
  const normalizedNickname = _normalizeNicknameForNotion(
    _stringifyValue(values['ニックネーム']),
    _stringifyValue(values['本名']),
  );
  if (
    Object.prototype.hasOwnProperty.call(values, 'ニックネーム') ||
    normalizedNickname
  ) {
    values['ニックネーム'] = normalizedNickname;
  }
  return values;
}

/**
 * 任意の値マップから Notion プロパティを構築します
 *
 * @param {Record<string, any>} values
 * @param {NotionDatabaseSchema | null} schema
 * @param {string} titleValue
 * @returns {Record<string, any>}
 * @private
 */
function _buildNotionPropertiesFromValues(values, schema, titleValue) {
  /** @type {Record<string, any>} */
  const properties = {};

  const schemaInfo = schema || null;
  const titlePropertyName = schemaInfo?.titlePropertyName || 'タイトル';

  properties[titlePropertyName] = {
    title: [{ text: { content: titleValue || '名称未設定' } }],
  };

  const propertyMap = schemaInfo?.properties || {};
  const hasSchema = !!schemaInfo;

  Object.entries(values).forEach(([propertyName, value]) => {
    if (propertyName === titlePropertyName) return;

    const propSchema = propertyMap[propertyName];
    if (!propSchema) {
      if (!hasSchema) {
        properties[propertyName] = {
          rich_text: _buildRichTextValue(value),
        };
      }
      return;
    }

    let normalizedValue = value;
    if (_shouldFormatTimeAsSelect(propertyName, propSchema.type)) {
      normalizedValue = _formatTimeValue(value);
    }

    const propertyValue = _buildNotionPropertyValue(
      propSchema.type,
      normalizedValue,
    );
    if (propertyValue) {
      properties[propertyName] = propertyValue;
    }
  });

  return properties;
}

// ================================================================
// ★★★ Notion同期ハッシュ ★★★
// ================================================================

/**
 * 同期用の正規化値マップを作成します
 *
 * @param {Record<string, any>} values
 * @param {NotionDatabaseSchema | null} schema
 * @param {string} titleValue
 * @returns {Record<string, string>}
 * @private
 */
function _buildNormalizedValuesForHash(values, schema, titleValue) {
  /** @type {Record<string, string>} */
  const normalized = {};
  const schemaInfo = schema || null;
  const titlePropertyName = schemaInfo?.titlePropertyName || 'タイトル';

  normalized[titlePropertyName] = _normalizeValueForHash(
    titleValue,
    titlePropertyName,
    'title',
  );

  const propertyMap = schemaInfo?.properties || {};
  const hasSchema = !!schemaInfo;

  Object.entries(values).forEach(([propertyName, value]) => {
    if (propertyName === titlePropertyName) return;

    const propSchema = propertyMap[propertyName];
    if (hasSchema && !propSchema) {
      return;
    }

    const propType = propSchema?.type || 'rich_text';
    let normalizedValue = value;
    if (_shouldFormatTimeAsSelect(propertyName, propType)) {
      normalizedValue = _formatTimeValue(value);
    }

    normalized[propertyName] = _normalizeValueForHash(
      normalizedValue,
      propertyName,
      propType,
    );
  });

  return normalized;
}

/**
 * Notionページから正規化値マップを作成します
 *
 * @param {NotionPage} page
 * @param {NotionDatabaseSchema | null} schema
 * @param {string[]} propertyNames
 * @returns {Record<string, string> | null}
 * @private
 */
function _buildNormalizedValuesFromNotionPage(page, schema, propertyNames) {
  if (!page || !schema) return null;
  const properties = page.properties || {};

  /** @type {Record<string, string>} */
  const normalized = {};

  propertyNames.forEach(propertyName => {
    const propSchema = schema.properties?.[propertyName];
    const propType = propSchema?.type || 'rich_text';
    const prop = properties[propertyName];
    const rawValue = _extractRawValueFromNotionProperty(prop, propType);
    const maybeFormatted = _shouldFormatTimeAsSelect(propertyName, propType)
      ? _formatTimeValue(rawValue)
      : rawValue;

    normalized[propertyName] = _normalizeValueForHash(
      maybeFormatted,
      propertyName,
      propType,
    );
  });

  return normalized;
}

/**
 * Notionプロパティから生値を抽出します
 *
 * @param {any} prop
 * @param {string} propType
 * @returns {any}
 * @private
 */
function _extractRawValueFromNotionProperty(prop, propType) {
  if (!prop) return '';

  switch (propType) {
    case 'title':
      return Array.isArray(prop.title)
        ? prop.title
            .map(
              /** @param {{plain_text?: string}} item */ item =>
                item.plain_text || '',
            )
            .join('')
        : '';
    case 'rich_text':
      return Array.isArray(prop.rich_text)
        ? prop.rich_text
            .map(
              /** @param {{plain_text?: string}} item */ item =>
                item.plain_text || '',
            )
            .join('')
        : '';
    case 'number':
      return prop.number ?? '';
    case 'select':
      return prop.select?.name || '';
    case 'status':
      return prop.status?.name || '';
    case 'multi_select':
      return Array.isArray(prop.multi_select)
        ? prop.multi_select
            .map(/** @param {{name?: string}} item */ item => item.name || '')
            .filter(Boolean)
        : [];
    case 'date':
      return prop.date?.start || '';
    case 'checkbox':
      return prop.checkbox === true;
    case 'url':
      return prop.url || '';
    case 'email':
      return prop.email || '';
    case 'phone_number':
      return prop.phone_number || '';
    default:
      return '';
  }
}

/**
 * 正規化した値をハッシュ用に整形します
 *
 * @param {any} value
 * @param {string} _propertyName
 * @param {string} type
 * @returns {string}
 * @private
 */
function _normalizeValueForHash(value, _propertyName, type) {
  switch (type) {
    case 'number': {
      const numberValue = _toNumberValue(value);
      return numberValue === null ? '' : String(numberValue);
    }
    case 'select':
    case 'status': {
      const name = _sanitizeSelectOptionName(_stringifyValue(value));
      return name || '';
    }
    case 'multi_select': {
      const names = _toMultiSelectValues(value)
        .map(name => _sanitizeSelectOptionName(name))
        .filter(Boolean)
        .sort();
      return names.join('|');
    }
    case 'date':
      return _normalizeDateForHash(value);
    case 'checkbox':
      return _toBooleanValue(value) ? 'TRUE' : 'FALSE';
    case 'url':
    case 'email':
    case 'phone_number':
    case 'title':
    case 'rich_text':
    default:
      return _stringifyValue(value);
  }
}

/**
 * 日付をハッシュ比較用に正規化します
 *
 * @param {any} value
 * @returns {string}
 * @private
 */
function _normalizeDateForHash(value) {
  if (!value) return '';

  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      return text;
    }
    if (text.includes('T')) {
      const parsedText = new Date(text);
      if (!Number.isNaN(parsedText.getTime())) {
        return Utilities.formatDate(
          parsedText,
          CONSTANTS.TIMEZONE,
          "yyyy-MM-dd'T'HH:mm:ssXXX",
        );
      }
      return text;
    }
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const hours = value.getHours();
    const minutes = value.getMinutes();
    const seconds = value.getSeconds();
    if (hours === 0 && minutes === 0 && seconds === 0) {
      return Utilities.formatDate(value, CONSTANTS.TIMEZONE, 'yyyy-MM-dd');
    }
    return Utilities.formatDate(
      value,
      CONSTANTS.TIMEZONE,
      "yyyy-MM-dd'T'HH:mm:ssXXX",
    );
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    const hours = parsed.getHours();
    const minutes = parsed.getMinutes();
    const seconds = parsed.getSeconds();
    if (hours === 0 && minutes === 0 && seconds === 0) {
      return Utilities.formatDate(parsed, CONSTANTS.TIMEZONE, 'yyyy-MM-dd');
    }
    return Utilities.formatDate(
      parsed,
      CONSTANTS.TIMEZONE,
      "yyyy-MM-dd'T'HH:mm:ssXXX",
    );
  }

  return _stringifyValue(value);
}

/**
 * 正規化値マップからハッシュを生成します
 *
 * @param {Record<string, string>} normalized
 * @returns {string}
 * @private
 */
function _computeRowHash(normalized) {
  const sortedKeys = Object.keys(normalized).sort();
  /** @type {Record<string, string>} */
  const sorted = {};
  sortedKeys.forEach(key => {
    sorted[key] = normalized[key];
  });

  const json = JSON.stringify(sorted);
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    json,
    Utilities.Charset.UTF_8,
  );
  return digest
    .map(byte => `0${(byte & 0xff).toString(16)}`.slice(-2))
    .join('');
}

/**
 * 文字列配列から順序依存ハッシュを生成します
 *
 * @param {string[]} values
 * @returns {string}
 * @private
 */
function _computeStringArrayHash(values) {
  const normalized = Array.isArray(values)
    ? values.map(value => String(value || ''))
    : [];
  const json = JSON.stringify(normalized);
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    json,
    Utilities.Charset.UTF_8,
  );
  return digest
    .map(byte => `0${(byte & 0xff).toString(16)}`.slice(-2))
    .join('');
}

/**
 * Notionページの値からハッシュを生成します
 *
 * @param {NotionPage} page
 * @param {NotionDatabaseSchema | null} schema
 * @param {string[]} propertyNames
 * @returns {string | null}
 * @private
 */
function _computeRowHashFromNotionPage(page, schema, propertyNames) {
  if (!page || !schema) return null;
  const normalized = _buildNormalizedValuesFromNotionPage(
    page,
    schema,
    propertyNames,
  );
  if (!normalized) return null;
  return _computeRowHash(normalized);
}

/**
 * 更新スキップ判定を行います
 *
 * @param {NotionPage | null} page
 * @param {NotionDatabaseSchema | null} schema
 * @param {string[]} propertyNames
 * @param {string} desiredHash
 * @returns {boolean}
 * @private
 */
function _shouldSkipNotionUpdate(page, schema, propertyNames, desiredHash) {
  if (!page || !schema) return false;
  const currentHash = _computeRowHashFromNotionPage(
    page,
    schema,
    propertyNames,
  );
  if (!currentHash) return false;
  return currentHash === desiredHash;
}

/**
 * Notion DB スキーマを取得します（キャッシュ付き）
 *
 * @param {NotionConfig} config
 * @param {string} databaseId
 * @returns {NotionDatabaseSchema | null}
 * @private
 */
function _getNotionDatabaseSchema(config, databaseId) {
  if (!databaseId) return null;

  const now = Date.now();
  const cacheEntry = NOTION_SCHEMA_CACHE.get(databaseId);
  if (cacheEntry && now - cacheEntry.fetchedAt < NOTION_SCHEMA_CACHE_TTL_MS) {
    return cacheEntry.schema;
  }

  try {
    const response = _notionRequest(
      config.token,
      `/databases/${databaseId}`,
      'get',
    );
    const properties = response?.properties || {};
    /** @type {string | null} */
    let titlePropertyName = null;

    Object.entries(properties).forEach(([propertyName, propertyDef]) => {
      if (propertyDef?.type === 'title') {
        titlePropertyName = propertyName;
      }
    });

    /** @type {NotionDatabaseSchema} */
    const schema = {
      titlePropertyName,
      properties: /** @type {Record<string, {type: string}>} */ (properties),
    };

    NOTION_SCHEMA_CACHE.set(databaseId, { schema, fetchedAt: now });
    return schema;
  } catch (error) {
    Logger.log(
      `Notionスキーマ取得エラー: ${/** @type {Error} */ (error).message}`,
    );
    return null;
  }
}

// ================================================================
// ★★★ Notion同期キュートリガー管理 ★★★
// ================================================================

/**
 * Notion同期キュートリガーを取得します
 *
 * @returns {GoogleAppsScript.Script.Trigger | null}
 * @private
 */
function _getNotionSyncQueueTrigger() {
  const props = PropertiesService.getScriptProperties();
  const storedTriggerId = props.getProperty(
    PROPS_KEY_NOTION_SYNC_QUEUE_TRIGGER_ID,
  );
  const triggers = ScriptApp.getProjectTriggers();

  if (storedTriggerId) {
    const matchedById = triggers.find(trigger => {
      return _getTriggerUniqueId(trigger) === storedTriggerId;
    });
    if (matchedById) {
      return matchedById;
    }
  }

  const matchedByHandler = triggers.find(trigger => {
    return trigger.getHandlerFunction() === NOTION_SYNC_QUEUE_TRIGGER_HANDLER;
  });
  if (!matchedByHandler) {
    props.deleteProperty(PROPS_KEY_NOTION_SYNC_QUEUE_TRIGGER_ID);
    return null;
  }

  const triggerId = _getTriggerUniqueId(matchedByHandler);
  if (triggerId) {
    props.setProperty(PROPS_KEY_NOTION_SYNC_QUEUE_TRIGGER_ID, triggerId);
  }
  return matchedByHandler;
}

/**
 * Notion同期キュートリガーを作成または再利用します
 *
 * @returns {GoogleAppsScript.Script.Trigger}
 * @private
 */
function _ensureNotionSyncQueueTrigger() {
  const existingTrigger = _getNotionSyncQueueTrigger();
  if (existingTrigger) {
    return existingTrigger;
  }

  const trigger = ScriptApp.newTrigger(NOTION_SYNC_QUEUE_TRIGGER_HANDLER)
    .timeBased()
    .everyMinutes(NOTION_SYNC_QUEUE_TRIGGER_INTERVAL_MINUTES)
    .create();
  const triggerId = _getTriggerUniqueId(trigger);
  if (triggerId) {
    PropertiesService.getScriptProperties().setProperty(
      PROPS_KEY_NOTION_SYNC_QUEUE_TRIGGER_ID,
      triggerId,
    );
  }
  Logger.log(
    `Notion同期キュートリガーを作成しました（間隔: ${NOTION_SYNC_QUEUE_TRIGGER_INTERVAL_MINUTES}分）。`,
  );
  return trigger;
}

/**
 * Notion同期キュートリガーを削除します
 *
 * @returns {number} - 削除件数
 * @private
 */
function _deleteNotionSyncQueueTriggers() {
  const props = PropertiesService.getScriptProperties();
  const storedTriggerId = props.getProperty(
    PROPS_KEY_NOTION_SYNC_QUEUE_TRIGGER_ID,
  );
  const triggers = ScriptApp.getProjectTriggers();
  let deleted = 0;

  triggers.forEach(trigger => {
    const shouldDeleteByHandler =
      trigger.getHandlerFunction() === NOTION_SYNC_QUEUE_TRIGGER_HANDLER;
    const shouldDeleteById =
      !!storedTriggerId && _getTriggerUniqueId(trigger) === storedTriggerId;
    if (!shouldDeleteByHandler && !shouldDeleteById) {
      return;
    }
    ScriptApp.deleteTrigger(trigger);
    deleted++;
  });

  props.deleteProperty(PROPS_KEY_NOTION_SYNC_QUEUE_TRIGGER_ID);
  return deleted;
}

// ================================================================
// ★★★ Notion分割同期トリガー管理 ★★★
// ================================================================

/**
 * Notion分割同期トリガーを取得します
 *
 * @returns {GoogleAppsScript.Script.Trigger | null}
 * @private
 */
function _getNotionBatchTrigger() {
  const props = PropertiesService.getScriptProperties();
  const storedTriggerId = props.getProperty(PROPS_KEY_NOTION_BATCH_TRIGGER_ID);
  const triggers = ScriptApp.getProjectTriggers();

  if (storedTriggerId) {
    const matchedById = triggers.find(trigger => {
      return _getTriggerUniqueId(trigger) === storedTriggerId;
    });
    if (matchedById) {
      return matchedById;
    }
  }

  const matchedByHandler = triggers.find(trigger => {
    return trigger.getHandlerFunction() === NOTION_BATCH_TRIGGER_HANDLER;
  });
  if (!matchedByHandler) {
    props.deleteProperty(PROPS_KEY_NOTION_BATCH_TRIGGER_ID);
    return null;
  }

  const triggerId = _getTriggerUniqueId(matchedByHandler);
  if (triggerId) {
    props.setProperty(PROPS_KEY_NOTION_BATCH_TRIGGER_ID, triggerId);
  }
  return matchedByHandler;
}

/**
 * Notion分割同期トリガーを作成または再利用します
 *
 * @returns {GoogleAppsScript.Script.Trigger}
 * @private
 */
function _ensureNotionBatchTrigger() {
  const existingTrigger = _getNotionBatchTrigger();
  if (existingTrigger) {
    return existingTrigger;
  }

  const trigger = ScriptApp.newTrigger(NOTION_BATCH_TRIGGER_HANDLER)
    .timeBased()
    .everyMinutes(NOTION_BATCH_TRIGGER_INTERVAL_MINUTES)
    .create();
  const triggerId = _getTriggerUniqueId(trigger);
  if (triggerId) {
    PropertiesService.getScriptProperties().setProperty(
      PROPS_KEY_NOTION_BATCH_TRIGGER_ID,
      triggerId,
    );
  }
  Logger.log(
    `Notion分割同期トリガーを作成しました（間隔: ${NOTION_BATCH_TRIGGER_INTERVAL_MINUTES}分）。`,
  );
  return trigger;
}

/**
 * Notion分割同期トリガーを削除します
 *
 * @returns {number} - 削除件数
 * @private
 */
function _deleteNotionBatchTriggers() {
  const props = PropertiesService.getScriptProperties();
  const storedTriggerId = props.getProperty(PROPS_KEY_NOTION_BATCH_TRIGGER_ID);
  const triggers = ScriptApp.getProjectTriggers();
  let deleted = 0;

  triggers.forEach(trigger => {
    const shouldDeleteByHandler =
      trigger.getHandlerFunction() === NOTION_BATCH_TRIGGER_HANDLER;
    const shouldDeleteById =
      !!storedTriggerId && _getTriggerUniqueId(trigger) === storedTriggerId;
    if (!shouldDeleteByHandler && !shouldDeleteById) {
      return;
    }
    ScriptApp.deleteTrigger(trigger);
    deleted++;
  });

  props.deleteProperty(PROPS_KEY_NOTION_BATCH_TRIGGER_ID);
  return deleted;
}

/**
 * Triggerの一意IDを安全に取得します
 *
 * @param {GoogleAppsScript.Script.Trigger} trigger
 * @returns {string}
 * @private
 */
function _getTriggerUniqueId(trigger) {
  try {
    return trigger.getUniqueId() || '';
  } catch (_error) {
    return '';
  }
}

// ================================================================
// ★★★ Notion同期メタ（page_id/rowHash） ★★★
// ================================================================

/**
 * Notion同期メタシートを取得します（必要なら作成）
 *
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 * @private
 */
function _getNotionSyncMetaSheet() {
  const spreadsheet = SS_MANAGER.getSpreadsheet();
  let sheet = spreadsheet.getSheetByName(NOTION_SYNC_META_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(NOTION_SYNC_META_SHEET_NAME);
    sheet
      .getRange(1, 1, 1, NOTION_SYNC_META_HEADERS.length)
      .setValues([NOTION_SYNC_META_HEADERS]);
    sheet.setFrozenRows(1);
    sheet.hideSheet();
    return sheet;
  }

  _ensureNotionSyncMetaHeaders(sheet);
  if (!sheet.isSheetHidden()) {
    sheet.hideSheet();
  }
  return sheet;
}

/**
 * Notion同期メタシートのヘッダーを整備します
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {void}
 * @private
 */
function _ensureNotionSyncMetaHeaders(sheet) {
  const lastColumn = sheet.getLastColumn();
  const headerRow =
    lastColumn > 0 ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0] : [];
  const existingHeaders = headerRow.map(header => String(header || '').trim());

  let updated = false;
  const nextHeaders = existingHeaders.slice();
  NOTION_SYNC_META_HEADERS.forEach(header => {
    if (!existingHeaders.includes(header)) {
      nextHeaders.push(header);
      updated = true;
    }
  });

  if (updated) {
    sheet.getRange(1, 1, 1, nextHeaders.length).setValues([nextHeaders]);
  }

  if (sheet.getFrozenRows() === 0) {
    sheet.setFrozenRows(1);
  }
}

/**
 * Notion同期メタの状態を取得します（実行内キャッシュ）
 *
 * @returns {{
 *   sheet: GoogleAppsScript.Spreadsheet.Sheet,
 *   headerMap: Map<string, number>,
 *   byKey: Map<string, NotionSyncMetaEntry>,
 * }}
 * @private
 */
function _getNotionSyncMetaState() {
  if (NOTION_SYNC_META_STATE.loaded) {
    return /** @type {any} */ (NOTION_SYNC_META_STATE);
  }

  const sheet = _getNotionSyncMetaSheet();
  const lastColumn = sheet.getLastColumn();
  const headerRow =
    lastColumn > 0 ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0] : [];

  /** @type {Map<string, number>} */
  const headerMap = new Map();
  headerRow.forEach((header, index) => {
    if (!header) return;
    headerMap.set(String(header).trim(), index);
  });

  /** @type {Map<string, NotionSyncMetaEntry>} */
  const byKey = new Map();
  const lastRow = sheet.getLastRow();
  if (lastRow > 1 && lastColumn > 0) {
    const rows = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
    const entityIdx = headerMap.get('entity');
    const sourceIdIdx = headerMap.get('sourceId');
    const pageIdIdx = headerMap.get('pageId');
    const rowHashIdx = headerMap.get('rowHash');
    const updatedAtIdx = headerMap.get('updatedAt');

    rows.forEach((row, idx) => {
      const entity =
        entityIdx !== undefined ? String(row[entityIdx] || '').trim() : '';
      const sourceId =
        sourceIdIdx !== undefined ? String(row[sourceIdIdx] || '').trim() : '';
      if (!entity || !sourceId) return;

      const pageId =
        pageIdIdx !== undefined ? String(row[pageIdIdx] || '').trim() : '';
      const rowHash =
        rowHashIdx !== undefined ? String(row[rowHashIdx] || '').trim() : '';
      const updatedAt =
        updatedAtIdx !== undefined ? String(row[updatedAtIdx] || '') : '';

      const key = _buildNotionSyncMetaKey(entity, sourceId);
      byKey.set(key, {
        entity,
        sourceId,
        pageId,
        rowHash,
        rowIndex: idx + 2,
        updatedAt,
      });
    });
  }

  NOTION_SYNC_META_STATE.loaded = true;
  NOTION_SYNC_META_STATE.sheet = sheet;
  NOTION_SYNC_META_STATE.headerMap = headerMap;
  NOTION_SYNC_META_STATE.byKey = byKey;

  return /** @type {any} */ (NOTION_SYNC_META_STATE);
}

/**
 * Notion同期メタのキーを生成します
 *
 * @param {string} entity
 * @param {string} sourceId
 * @returns {string}
 * @private
 */
function _buildNotionSyncMetaKey(entity, sourceId) {
  return `${entity}::${sourceId}`;
}

/**
 * Notion同期メタを取得します
 *
 * @param {string} entity
 * @param {string} sourceId
 * @returns {NotionSyncMetaEntry | null}
 * @private
 */
function _getNotionSyncMeta(entity, sourceId) {
  if (!entity || !sourceId) return null;
  const state = _getNotionSyncMetaState();
  const key = _buildNotionSyncMetaKey(entity, sourceId);
  return state.byKey.get(key) || null;
}

/**
 * Notion同期メタを更新または追加します
 *
 * @param {string} entity
 * @param {string} sourceId
 * @param {string} pageId
 * @param {string} rowHash
 * @returns {void}
 * @private
 */
function _upsertNotionSyncMeta(entity, sourceId, pageId, rowHash) {
  if (!entity || !sourceId) return;
  const state = _getNotionSyncMetaState();
  const key = _buildNotionSyncMetaKey(entity, sourceId);
  const now = new Date().toISOString();

  const payload = {
    entity,
    sourceId,
    pageId: pageId || '',
    rowHash: rowHash || '',
    updatedAt: now,
  };

  const existing = state.byKey.get(key);
  if (existing?.rowIndex) {
    _writeNotionSyncMetaValues(
      state.sheet,
      state.headerMap,
      existing.rowIndex,
      payload,
    );
    existing.pageId = payload.pageId;
    existing.rowHash = payload.rowHash;
    existing.updatedAt = payload.updatedAt;
    return;
  }

  const nextRow = state.sheet.getLastRow() + 1;
  _writeNotionSyncMetaValues(state.sheet, state.headerMap, nextRow, payload);
  state.byKey.set(key, {
    entity,
    sourceId,
    pageId: payload.pageId,
    rowHash: payload.rowHash,
    rowIndex: nextRow,
    updatedAt: payload.updatedAt,
  });
}

/**
 * Notion同期メタを無効化します（pageId/rowHashをクリア）
 *
 * @param {string} entity
 * @param {string} sourceId
 * @returns {void}
 * @private
 */
function _clearNotionSyncMeta(entity, sourceId) {
  if (!entity || !sourceId) return;
  const state = _getNotionSyncMetaState();
  const key = _buildNotionSyncMetaKey(entity, sourceId);
  const existing = state.byKey.get(key);
  if (!existing?.rowIndex) return;

  const now = new Date().toISOString();
  _writeNotionSyncMetaValues(state.sheet, state.headerMap, existing.rowIndex, {
    pageId: '',
    rowHash: '',
    updatedAt: now,
  });

  existing.pageId = '';
  existing.rowHash = '';
  existing.updatedAt = now;
}

/**
 * Notion同期メタシートへ値を書き込みます
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Map<string, number>} headerMap
 * @param {number} rowIndex
 * @param {Record<string, any>} values
 * @returns {void}
 * @private
 */
function _writeNotionSyncMetaValues(sheet, headerMap, rowIndex, values) {
  /** @type {number[]} */
  const cols = [];
  /** @type {Record<number, any>} */
  const valueByCol = {};

  Object.entries(values).forEach(([key, value]) => {
    const colIdx = headerMap.get(key);
    if (colIdx === undefined) return;
    cols.push(colIdx);
    valueByCol[colIdx] = value;
  });

  if (cols.length === 0) return;

  const uniqueCols = Array.from(new Set(cols)).sort((a, b) => a - b);
  const isContiguous = uniqueCols.every(
    (col, idx) => col === uniqueCols[0] + idx,
  );

  if (isContiguous) {
    const rowValues = uniqueCols.map(col => valueByCol[col] ?? '');
    sheet
      .getRange(rowIndex, uniqueCols[0] + 1, 1, rowValues.length)
      .setValues([rowValues]);
    return;
  }

  uniqueCols.forEach(colIdx => {
    sheet.getRange(rowIndex, colIdx + 1).setValue(valueByCol[colIdx] ?? '');
  });
}

/**
 * Notion同期メタで完結できる場合は更新を行います
 *
 * @param {NotionConfig} config
 * @param {NotionSyncMetaEntry | null} meta
 * @param {string} rowHash
 * @param {Record<string, any>} properties
 * @param {string} label
 * @param {string} entity
 * @param {string} sourceId
 * @returns {NotionSyncResult | null}
 * @private
 */
function _trySyncNotionByMeta(
  config,
  meta,
  rowHash,
  properties,
  label,
  entity,
  sourceId,
) {
  if (!NOTION_ASSUME_NO_MANUAL_EDITS) return null;
  if (!meta?.pageId) return null;

  if (meta.rowHash && meta.rowHash === rowHash) {
    return { success: true, pageId: meta.pageId, skipped: true };
  }

  const result = _updateNotionPageInDatabase(
    config,
    meta.pageId,
    properties,
    label,
  );
  if (result.success) {
    _upsertNotionSyncMeta(
      entity,
      sourceId,
      result.pageId || meta.pageId,
      rowHash,
    );
    return result;
  }

  _clearNotionSyncMeta(entity, sourceId);
  return null;
}

/**
 * 生徒名簿シートのスナップショットを取得します
 *
 * @returns {SheetSnapshot | null}
 * @private
 */
function _getRosterSnapshot() {
  return _getSheetSnapshot(
    CONSTANTS.SHEET_NAMES.ROSTER,
    CONSTANTS.HEADERS.ROSTER.STUDENT_ID,
    '生徒名簿',
  );
}

/**
 * スナップショットから行順のIDリストを作成します
 *
 * @param {SheetSnapshot} snapshot
 * @returns {string[]}
 * @private
 */
function _getOrderedIdsFromSnapshot(snapshot) {
  return Array.from(snapshot.byId.entries())
    .map(([id, entry]) => ({ id, rowIndex: entry.rowIndex }))
    .sort((a, b) => a.rowIndex - b.rowIndex)
    .map(item => item.id);
}

/**
 * 予約記録シートのスナップショットを取得します
 *
 * @returns {SheetSnapshot | null}
 * @private
 */
function _getReservationSnapshot() {
  return _getSheetSnapshot(
    CONSTANTS.SHEET_NAMES.RESERVATIONS,
    CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID,
    '予約記録',
  );
}

/**
 * 日程シートのスナップショットを取得します
 *
 * @returns {SheetSnapshot | null}
 * @private
 */
function _getScheduleSnapshot() {
  return _getSheetSnapshot(
    CONSTANTS.SHEET_NAMES.SCHEDULE,
    CONSTANTS.HEADERS.SCHEDULE.LESSON_ID,
    '日程',
  );
}

/**
 * 任意シートのスナップショットを取得します
 *
 * @param {string} sheetName
 * @param {string} idHeaderName
 * @param {string} label
 * @returns {SheetSnapshot | null}
 * @private
 */
function _getSheetSnapshot(sheetName, idHeaderName, label) {
  try {
    const sheet = SS_MANAGER.getSheet(sheetName);
    if (!sheet || sheet.getLastRow() < 2) {
      return null;
    }

    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0];
    const idColIdx = headers.indexOf(idHeaderName);
    if (idColIdx < 0) {
      throw new Error(
        `${label}に必須の「${idHeaderName}」列が見つかりません。`,
      );
    }

    const rows = sheet
      .getRange(2, 1, sheet.getLastRow() - 1, headers.length)
      .getValues();

    /** @type {Map<string, {values: Record<string, any>, rowIndex: number}>} */
    const byId = new Map();

    rows.forEach((row, index) => {
      const idValue = row[idColIdx];
      if (!idValue || !String(idValue).trim()) return;

      /** @type {Record<string, any>} */
      const values = {};
      headers.forEach((header, colIdx) => {
        values[header] = row[colIdx];
      });
      byId.set(String(idValue), { values, rowIndex: index + 2 });
    });

    return {
      headers,
      idColIdx,
      byId,
    };
  } catch (error) {
    Logger.log(
      `${label}スナップショット取得エラー: ${/** @type {Error} */ (error).message}`,
    );
    return null;
  }
}

/**
 * 表示名を決定します
 *
 * @param {Record<string, any>} values
 * @param {StudentData} student
 * @returns {string}
 * @private
 */
function _getStudentTitle(values, student) {
  const nickname = _normalizeNicknameForNotion(
    _stringifyValue(values['ニックネーム']) || student.nickname || '',
    _stringifyValue(values['本名']) || student.realName || '',
  );
  const realName = _stringifyValue(values['本名']) || student.realName || '';

  if (nickname && realName) {
    return `${nickname} ｜ ${realName}`;
  }
  if (nickname) return nickname;
  if (realName) return realName;
  return '名前なし';
}

/**
 * Notion同期用のニックネームを正規化します
 * - 本名と同一なら空白を除去した本名の先頭2文字へ置換
 *
 * @param {string} nickname
 * @param {string} realName
 * @returns {string}
 * @private
 */
function _normalizeNicknameForNotion(nickname, realName) {
  const nick = _stringifyValue(nickname).trim();
  const real = _stringifyValue(realName).trim();
  if (!nick) return '';
  if (!real || nick !== real) return nick;
  const realWithoutSpaces = real.replace(/\s+/g, '');
  const short = Array.from(realWithoutSpaces).slice(0, 2).join('');
  return short;
}

/**
 * 日程タイトルを生成します
 *
 * @param {Record<string, any>} values
 * @returns {string}
 * @private
 */
function _getScheduleTitle(values) {
  const dateValue = values[CONSTANTS.HEADERS.SCHEDULE.DATE];
  const classroomValue = _stringifyValue(
    values[CONSTANTS.HEADERS.SCHEDULE.CLASSROOM],
  );
  const venueValue = _stringifyValue(values[CONSTANTS.HEADERS.SCHEDULE.VENUE]);

  const dateLabel = _formatDateForTitle(dateValue);
  const classroomLabel = _stripClassroomSuffix(classroomValue);

  const parts = [dateLabel, classroomLabel].filter(Boolean);
  if (venueValue) {
    parts.push(venueValue);
  }

  return parts.length > 0 ? parts.join('｜') : '日程';
}

/**
 * 予約記録タイトルを生成します
 *
 * @param {Record<string, any>} values
 * @returns {string}
 * @private
 */
function _getReservationTitle(values) {
  const reservationId = _stringifyValue(
    values[CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID],
  );
  if (reservationId) return reservationId;

  const dateLabel = _formatDateForTitle(
    values[CONSTANTS.HEADERS.RESERVATIONS.DATE],
  );
  return dateLabel || '予約';
}

/**
 * 時刻系プロパティか判定します
 *
 * @param {string} propertyName
 * @returns {boolean}
 * @private
 */
function _isTimePropertyName(propertyName) {
  return (
    propertyName === CONSTANTS.HEADERS.SCHEDULE.FIRST_START ||
    propertyName === CONSTANTS.HEADERS.SCHEDULE.FIRST_END ||
    propertyName === CONSTANTS.HEADERS.SCHEDULE.SECOND_START ||
    propertyName === CONSTANTS.HEADERS.SCHEDULE.SECOND_END ||
    propertyName === CONSTANTS.HEADERS.SCHEDULE.BEGINNER_START ||
    propertyName === CONSTANTS.HEADERS.RESERVATIONS.START_TIME ||
    propertyName === CONSTANTS.HEADERS.RESERVATIONS.END_TIME
  );
}

/**
 * Select/Status で時刻を扱うべきか判定します
 *
 * @param {string} propertyName
 * @param {string} type
 * @returns {boolean}
 * @private
 */
function _shouldFormatTimeAsSelect(propertyName, type) {
  if (!propertyName) return false;
  if (type !== 'select' && type !== 'status' && type !== 'multi_select') {
    return false;
  }
  return _isTimePropertyName(propertyName);
}

/**
 * 時刻値を "HH:mm" 形式に整形します
 *
 * @param {any} value
 * @returns {string}
 * @private
 */
function _formatTimeValue(value) {
  if (value === null || value === undefined || value === '') return '';

  if (value instanceof Date) {
    return Utilities.formatDate(value, CONSTANTS.TIMEZONE, 'HH:mm');
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const totalMinutes = Math.round(value * 24 * 60);
    if (!Number.isFinite(totalMinutes)) return '';
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  const text = String(value).trim();
  if (!text) return '';

  const timeMatch = text.match(/(\d{1,2})[:時](\d{2})/);
  if (timeMatch) {
    const hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);
    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
  }

  const dateLike = new Date(text);
  if (!Number.isNaN(dateLike.getTime())) {
    return Utilities.formatDate(dateLike, CONSTANTS.TIMEZONE, 'HH:mm');
  }

  return text;
}

/**
 * 教室名から末尾の「教室」を除去します
 *
 * @param {string} classroom
 * @returns {string}
 * @private
 */
function _stripClassroomSuffix(classroom) {
  if (!classroom) return '';
  return classroom.replace(/教室$/, '');
}

/**
 * タイトル用の日付表記に変換します
 *
 * @param {any} value
 * @returns {string}
 * @private
 */
function _formatDateForTitle(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return Utilities.formatDate(value, CONSTANTS.TIMEZONE, 'yyyy-MM-dd');
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return _stringifyValue(value);
  return Utilities.formatDate(parsed, CONSTANTS.TIMEZONE, 'yyyy-MM-dd');
}

/**
 * 今日の0時（ローカル）を取得します
 *
 * @returns {Date}
 * @private
 */
function _getTodayStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * 日程の日付セルを比較用 Date に変換します
 *
 * @param {any} value
 * @returns {Date | null}
 * @private
 */
function _parseScheduleDateForComparison(value) {
  if (!value) return null;
  if (value instanceof Date) return value;

  if (typeof value === 'number' && Number.isFinite(value)) {
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
 * Notionのプロパティ値を構築します
 *
 * @param {string} type
 * @param {any} value
 * @returns {Object | null}
 * @private
 */
function _buildNotionPropertyValue(type, value) {
  switch (type) {
    case 'title':
      return {
        title: _buildRichTextValue(value),
      };
    case 'rich_text':
      return {
        rich_text: _buildRichTextValue(value),
      };
    case 'number': {
      const numberValue = _toNumberValue(value);
      return { number: numberValue };
    }
    case 'select': {
      const name = _sanitizeSelectOptionName(_stringifyValue(value));
      return { select: name ? { name } : null };
    }
    case 'status': {
      const name = _sanitizeSelectOptionName(_stringifyValue(value));
      return { status: name ? { name } : null };
    }
    case 'multi_select': {
      const names = _toMultiSelectValues(value)
        .map(name => _sanitizeSelectOptionName(name))
        .filter(Boolean);
      return { multi_select: names.map(name => ({ name })) };
    }
    case 'date': {
      const dateValue = _formatDateValue(value);
      return { date: dateValue ? { start: dateValue } : null };
    }
    case 'checkbox':
      return { checkbox: _toBooleanValue(value) };
    case 'url': {
      const urlValue = _stringifyValue(value);
      return { url: urlValue || null };
    }
    case 'email': {
      const emailValue = _stringifyValue(value);
      return { email: emailValue || null };
    }
    case 'phone_number': {
      const phoneValue = _stringifyValue(value);
      return { phone_number: phoneValue || null };
    }
    default:
      return null;
  }
}

/**
 * リッチテキスト値を構築します
 *
 * @param {any} value
 * @returns {Array<{text: {content: string}}>}
 * @private
 */
function _buildRichTextValue(value) {
  const text = _stringifyValue(value);
  if (!text) return [];
  return [{ text: { content: text } }];
}

/**
 * セレクト/ステータス用の文字列を整形します
 *
 * @param {string} name
 * @returns {string}
 * @private
 */
function _sanitizeSelectOptionName(name) {
  if (!name) return '';
  const sanitized = name.replace(/[，,]/g, '、');
  if (sanitized !== name) {
    Logger.log(`Notionセレクト値のカンマを置換: "${name}" -> "${sanitized}"`);
  }
  return sanitized;
}

/**
 * 値を文字列化します
 *
 * @param {any} value
 * @returns {string}
 * @private
 */
function _stringifyValue(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    return Utilities.formatDate(
      value,
      CONSTANTS.TIMEZONE,
      'yyyy-MM-dd HH:mm:ss',
    );
  }
  if (Array.isArray(value)) {
    return value
      .map(item => _stringifyValue(item))
      .filter(Boolean)
      .join(', ');
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  return String(value).trim();
}

/**
 * 数値変換
 *
 * @param {any} value
 * @returns {number | null}
 * @private
 */
function _toNumberValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) return null;
  return numberValue;
}

/**
 * マルチセレクト用の配列に変換
 *
 * @param {any} value
 * @returns {string[]}
 * @private
 */
function _toMultiSelectValues(value) {
  if (Array.isArray(value)) {
    return value.map(item => _stringifyValue(item)).filter(Boolean);
  }
  const text = _stringifyValue(value);
  if (!text) return [];
  return text
    .split(/[、,]/)
    .map(item => item.trim())
    .filter(Boolean);
}

/**
 * 日付をNotion形式に変換
 *
 * @param {any} value
 * @returns {string | null}
 * @private
 */
function _formatDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Utilities.formatDate(
      value,
      CONSTANTS.TIMEZONE,
      "yyyy-MM-dd'T'HH:mm:ssXXX",
    );
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return Utilities.formatDate(
    parsed,
    CONSTANTS.TIMEZONE,
    "yyyy-MM-dd'T'HH:mm:ssXXX",
  );
}

/**
 * 真偽値に変換
 *
 * @param {any} value
 * @returns {boolean}
 * @private
 */
function _toBooleanValue(value) {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  if (typeof value === 'number') return value !== 0;
  const text = String(value).trim().toLowerCase();
  return (
    text === 'true' || text === '1' || text === '希望する' || text === 'yes'
  );
}

/**
 * IDリストを正規化します
 *
 * @param {string[] | string} ids
 * @returns {string[]}
 * @private
 */
function _normalizeIdList(ids) {
  if (Array.isArray(ids)) {
    return ids.map(id => String(id).trim()).filter(Boolean);
  }
  const text = _stringifyValue(ids);
  if (!text) return [];
  return text
    .split(/[\n,，]/)
    .map(id => id.trim())
    .filter(Boolean);
}

// ================================================================
// ★★★ 手動実行・テスト用関数 ★★★
// ================================================================

/**
 * 【手動実行用】設定状態を確認します
 * GASエディタから実行してください
 */
export function checkNotionConfig_DEV() {
  const config = getNotionConfig();
  if (config) {
    Logger.log('Notion設定: 完了');
    Logger.log(`Database ID: ${config.studentDbId}`);
    if (config.reservationDbId) {
      Logger.log(`Reservation DB ID: ${config.reservationDbId}`);
    }
    if (config.scheduleDbId) {
      Logger.log(`Schedule DB ID: ${config.scheduleDbId}`);
    }
    Logger.log(`Token: ${config.token.substring(0, 15)}...`);
  } else {
    Logger.log('Notion設定: 未完了');
    Logger.log('setNotionCredentials(token, dbId) を実行してください');
  }
}

/**
 * 【手動実行用】Notion API 接続テスト
 * GASエディタから実行してください
 */
export function testNotionConnection_DEV() {
  const config = getNotionConfig();
  if (!config) {
    Logger.log('設定が未完了です');
    return;
  }

  try {
    const response = _notionRequest(
      config.token,
      `/databases/${config.studentDbId}`,
      'get',
    );
    Logger.log('接続成功!');
    const title =
      response.title && response.title[0]
        ? response.title[0].plain_text
        : '(タイトルなし)';
    Logger.log(`データベース名: ${title}`);
  } catch (error) {
    Logger.log(`接続失敗: ${/** @type {Error} */ (error).message}`);
  }
}

/**
 * 【手動実行用】特定の生徒を Notion に同期します
 * GASエディタから実行してください
 *
 * @param {string} studentId - 同期する生徒ID
 */
export function syncSingleStudent_DEV(studentId) {
  if (!studentId) {
    Logger.log('studentId を指定してください');
    return;
  }

  const result = syncStudentToNotion(studentId, 'update');
  Logger.log(`同期結果: ${JSON.stringify(result)}`);
}

/**
 * 【一時実行用】Notion同期DBを作成します
 * 実行後は削除してください。
 */
