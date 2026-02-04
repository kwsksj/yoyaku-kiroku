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
 * Notion 接続設定を取得します
 * @returns {NotionConfig | null}
 */
export function getNotionConfig(): NotionConfig | null;
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
export function setNotionCredentials(token: string, studentDbId: string): void;
/**
 * Notion トークンのみ保存します（DB作成時に使用）
 * GASエディタから実行してください。
 *
 * @param {string} token - Notion Integration Token (secret_xxx)
 * @returns {void}
 */
export function setNotionToken(token: string): void;
/**
 * 予約記録DBのIDを保存します
 * GASエディタから実行してください。
 *
 * @param {string} reservationDbId - 予約記録データベースID
 * @returns {void}
 */
export function setNotionReservationDatabaseId(reservationDbId: string): void;
/**
 * 日程DBのIDを保存します
 * GASエディタから実行してください。
 *
 * @param {string} scheduleDbId - 日程データベースID
 * @returns {void}
 */
export function setNotionScheduleDatabaseId(scheduleDbId: string): void;
/**
 * Notion 側に同期用DBを作成します
 *
 * @param {string} parentPageIdOrUrl - 親ページIDまたはURL
 * @param {NotionDatabaseCreationOptions} [options]
 * @returns {{studentDbId?: string, reservationDbId?: string, scheduleDbId?: string}}
 */
export function createNotionDatabasesForSync(parentPageIdOrUrl: string, options?: NotionDatabaseCreationOptions): {
    studentDbId?: string;
    reservationDbId?: string;
    scheduleDbId?: string;
};
/**
 * Notion 接続設定を削除します（デバッグ用）
 * @returns {void}
 */
export function clearNotionCredentials(): void;
/**
 * 生徒データを Notion に同期します
 * 登録・更新・退会時に呼び出されます
 *
 * @param {string} studentId - 生徒ID
 * @param {'create' | 'update' | 'delete'} action - 同期アクション
 * @param {NotionStudentSyncOptions} [options]
 * @returns {NotionSyncResult}
 */
export function syncStudentToNotion(studentId: string, action: "create" | "update" | "delete", options?: NotionStudentSyncOptions): NotionSyncResult;
/**
 * 全生徒データを Notion に同期します（差分同期）
 * 時間トリガーで1日1回実行することを想定しています
 *
 * @returns {{success: boolean, created: number, updated: number, skipped: number, errors: number}}
 */
export function syncAllStudentsToNotion(): {
    success: boolean;
    created: number;
    updated: number;
    skipped: number;
    errors: number;
};
/**
 * 全生徒データを分割で Notion に同期します（途中再開可能）
 *
 * @param {number} [batchSize=50] - 1回で処理する件数
 * @returns {{success: boolean, created: number, updated: number, skipped: number, errors: number, processed: number, total: number, done: boolean, nextIndex: number}}
 */
export function syncAllStudentsToNotionChunk(batchSize?: number): {
    success: boolean;
    created: number;
    updated: number;
    skipped: number;
    errors: number;
    processed: number;
    total: number;
    done: boolean;
    nextIndex: number;
};
/**
 * 生徒一括同期のカーソルをリセットします
 * @returns {void}
 */
export function resetNotionStudentSyncCursor(): void;
/**
 * 予約一括同期のカーソルをリセットします
 * @returns {void}
 */
export function resetNotionReservationSyncCursor(): void;
/**
 * Notion分割同期を開始します（手動実行用）
 * 初回実行を即時に行い、残りは時間トリガーで継続します。
 *
 * @param {boolean} [resetCursor=true] - true の場合はカーソルをリセットして最初から同期します
 * @returns {{success: boolean, message: string, runResult?: any}}
 */
export function startNotionSyncBatch(resetCursor?: boolean): {
    success: boolean;
    message: string;
    runResult?: any;
};
/**
 * Notion分割同期を1バッチ実行します（時間トリガー用）
 * 生徒・予約記録が完了したら、最後に日程を一括同期してトリガーを停止します。
 *
 * @returns {{success: boolean, done: boolean, students: any, reservations: any, schedules: any, skippedByLock?: boolean, deletedTriggers?: number}}
 */
export function runNotionSyncBatch(): {
    success: boolean;
    done: boolean;
    students: any;
    reservations: any;
    schedules: any;
    skippedByLock?: boolean;
    deletedTriggers?: number;
};
/**
 * Notion分割同期トリガーを停止します
 *
 * @param {boolean} [resetCursor=false] - true の場合は同期カーソルも初期化します
 * @returns {{success: boolean, deletedTriggers: number}}
 */
export function stopNotionSyncBatch(resetCursor?: boolean): {
    success: boolean;
    deletedTriggers: number;
};
/**
 * 生徒IDを指定して Notion に同期します
 *
 * @param {string[] | string} studentIds - 生徒ID配列 またはカンマ/改行区切り文字列
 * @param {'create' | 'update' | 'delete'} [action='update']
 * @returns {{success: boolean, results: Array<{studentId: string, success: boolean, error?: string}>}}
 */
export function syncStudentsToNotionByIds(studentIds: string[] | string, action?: "create" | "update" | "delete"): {
    success: boolean;
    results: Array<{
        studentId: string;
        success: boolean;
        error?: string;
    }>;
};
/**
 * 予約記録を Notion に同期します
 *
 * @param {string} reservationId - 予約ID
 * @param {'create' | 'update' | 'delete'} [action='update'] - 同期アクション
 * @param {NotionReservationSyncOptions} [options]
 * @returns {NotionSyncResult}
 */
export function syncReservationToNotion(reservationId: string, action?: "create" | "update" | "delete", options?: NotionReservationSyncOptions): NotionSyncResult;
/**
 * 日程を Notion に同期します
 *
 * @param {string} lessonId - レッスンID
 * @param {'create' | 'update' | 'delete'} [action='update'] - 同期アクション
 * @param {NotionScheduleSyncOptions} [options]
 * @returns {NotionSyncResult}
 */
export function syncScheduleToNotion(lessonId: string, action?: "create" | "update" | "delete", options?: NotionScheduleSyncOptions): NotionSyncResult;
/**
 * 予約記録を一括で Notion に同期します
 *
 * @returns {{success: boolean, created: number, updated: number, skipped: number, errors: number}}
 */
export function syncAllReservationsToNotion(): {
    success: boolean;
    created: number;
    updated: number;
    skipped: number;
    errors: number;
};
/**
 * 予約記録を分割で Notion に同期します（途中再開可能）
 *
 * @param {number} [batchSize=100] - 1回で処理する件数
 * @returns {{success: boolean, created: number, updated: number, skipped: number, errors: number, processed: number, total: number, done: boolean, nextIndex: number}}
 */
export function syncAllReservationsToNotionChunk(batchSize?: number): {
    success: boolean;
    created: number;
    updated: number;
    skipped: number;
    errors: number;
    processed: number;
    total: number;
    done: boolean;
    nextIndex: number;
};
/**
 * 日程を一括で Notion に同期します
 *
 * @returns {{success: boolean, created: number, updated: number, skipped: number, errors: number}}
 */
export function syncAllSchedulesToNotion(): {
    success: boolean;
    created: number;
    updated: number;
    skipped: number;
    errors: number;
};
/**
 * 当日以降の日程を Notion に同期します
 *
 * @returns {{success: boolean, created: number, updated: number, errors: number, skipped: number}}
 */
export function syncUpcomingSchedulesToNotion(): {
    success: boolean;
    created: number;
    updated: number;
    errors: number;
    skipped: number;
};
/**
 * 【手動実行用】設定状態を確認します
 * GASエディタから実行してください
 */
export function checkNotionConfig_DEV(): void;
/**
 * 【手動実行用】Notion API 接続テスト
 * GASエディタから実行してください
 */
export function testNotionConnection_DEV(): void;
/**
 * 【手動実行用】特定の生徒を Notion に同期します
 * GASエディタから実行してください
 *
 * @param {string} studentId - 同期する生徒ID
 */
export function syncSingleStudent_DEV(studentId: string): void;
export type NotionConfig = {
    /**
     * - Notion API トークン
     */
    token: string;
    /**
     * - 生徒データベースID
     */
    studentDbId: string;
    /**
     * - 予約記録データベースID
     */
    reservationDbId?: string | null;
    /**
     * - 日程データベースID
     */
    scheduleDbId?: string | null;
};
export type NotionSyncResult = {
    success: boolean;
    pageId?: string | undefined;
    skipped?: boolean | undefined;
    error?: string | undefined;
};
export type NotionPage = {
    id: string;
    properties: Record<string, any>;
};
export type NotionApiResponse = {
    id?: string;
    results?: NotionPage[];
    has_more?: boolean;
    next_cursor?: string;
    title?: Array<{
        plain_text: string;
    }>;
    properties?: Record<string, any>;
};
export type StudentData = {
    studentId?: string | undefined;
    nickname?: string | undefined;
    realName?: string | undefined;
    phone?: string | undefined;
    status?: string | undefined;
};
export type NotionDatabaseSchema = {
    titlePropertyName: string | null;
    properties: Record<string, {
        type: string;
    }>;
};
export type SheetSnapshot = {
    headers: string[];
    idColIdx: number;
    byId: Map<string, {
        values: Record<string, any>;
        rowIndex: number;
    }>;
};
export type NotionDatabaseCreationOptions = {
    token?: string;
    studentDbName?: string;
    reservationDbName?: string;
    scheduleDbName?: string;
    titlePropertyName?: string;
};
export type NotionSyncMetaEntry = {
    entity: string;
    sourceId: string;
    pageId: string;
    rowHash: string;
    rowIndex: number;
    updatedAt?: string;
};
export type NotionStudentSyncOptions = {
    rosterSnapshot?: SheetSnapshot | null;
    rosterValues?: Record<string, any> | null;
    schema?: NotionDatabaseSchema | null;
    existingPage?: NotionPage | null;
    skipSheetAccess?: boolean;
};
export type NotionReservationSyncOptions = {
    reservationSnapshot?: SheetSnapshot | null;
    reservationValues?: Record<string, any> | null;
    schema?: NotionDatabaseSchema | null;
    existingPage?: NotionPage | null;
    skipSheetAccess?: boolean;
};
export type NotionScheduleSyncOptions = {
    scheduleSnapshot?: SheetSnapshot | null;
    scheduleValues?: Record<string, any> | null;
    schema?: NotionDatabaseSchema | null;
    existingPage?: NotionPage | null;
    skipSheetAccess?: boolean;
};
