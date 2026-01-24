/**
 * @typedef {Object} NotionConfig
 * @property {string} token - Notion API トークン
 * @property {string} studentDbId - 生徒データベースID
 */
/**
 * @typedef {Object} NotionSyncResult
 * @property {boolean} success
 * @property {string | undefined} [pageId]
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
 * @returns {NotionSyncResult}
 */
export function syncStudentToNotion(studentId: string, action: "create" | "update" | "delete"): NotionSyncResult;
/**
 * 全生徒データを Notion に同期します（差分同期）
 * 時間トリガーで1日1回実行することを想定しています
 *
 * @returns {{success: boolean, created: number, updated: number, errors: number}}
 */
export function syncAllStudentsToNotion(): {
    success: boolean;
    created: number;
    updated: number;
    errors: number;
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
};
export type NotionSyncResult = {
    success: boolean;
    pageId?: string | undefined;
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
};
export type StudentData = {
    studentId?: string | undefined;
    nickname?: string | undefined;
    realName?: string | undefined;
    phone?: string | undefined;
    status?: string | undefined;
};
