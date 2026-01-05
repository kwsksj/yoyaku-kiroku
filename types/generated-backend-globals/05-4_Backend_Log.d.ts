/**
 * @typedef {Object} LogEntry
 * @property {string} timestamp - タイムスタンプ (ISO形式)
 * @property {string} userId - ユーザーID
 * @property {string} realName - 本名
 * @property {string} nickname - ニックネーム
 * @property {string} action - アクション
 * @property {string} result - 結果
 * @property {string} classroom - 教室名
 * @property {string} reservationId - 予約ID
 * @property {string} date - 日付
 * @property {string} message - メッセージ
 * @property {string} details - 詳細情報
 */
/**
 * ログシートから直近のログデータを取得します。
 * 管理者専用のエンドポイントから呼び出されます。
 *
 * @param {number} [daysBack=30] - 取得する日数（デフォルト30日）
 * @returns {ApiResponseGeneric<LogEntry[]>} ログデータの配列
 */
export function getRecentLogs(daysBack?: number): ApiResponseGeneric<LogEntry[]>;
export type LogEntry = {
    /**
     * - タイムスタンプ (ISO形式)
     */
    timestamp: string;
    /**
     * - ユーザーID
     */
    userId: string;
    /**
     * - 本名
     */
    realName: string;
    /**
     * - ニックネーム
     */
    nickname: string;
    /**
     * - アクション
     */
    action: string;
    /**
     * - 結果
     */
    result: string;
    /**
     * - 教室名
     */
    classroom: string;
    /**
     * - 予約ID
     */
    reservationId: string;
    /**
     * - 日付
     */
    date: string;
    /**
     * - メッセージ
     */
    message: string;
    /**
     * - 詳細情報
     */
    details: string;
};
