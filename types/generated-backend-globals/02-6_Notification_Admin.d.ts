/**
 * =================================================================
 * 【ファイル名】: 02-6_Notification_Admin.js
 * 【バージョン】: 1.0
 * 【役割】: 管理者への予約操作通知メール
 * - 予約操作の管理者通知を統一的に処理
 * - 操作種別に応じたメッセージ生成を一元管理
 * - メール送信基盤機能を提供
 * =================================================================
 */
/**
 * 管理者にメールで通知を送信します。
 * @param {string} subject - メールの件名
 * @param {string} body - メールの本文
 */
export function sendAdminNotification(subject: string, body: string): void;
/**
 * 予約操作の管理者通知（統一インターフェース）
 * @param {ReservationCore} reservation - 予約データ
 * @param {'created'|'cancelled'|'updated'} operationType - 操作種別
 * @param {{cancelMessage?: string, updateDetails?: string}} [additionalInfo] - 追加情報
 */
export function sendAdminNotificationForReservation(reservation: ReservationCore, operationType: "created" | "cancelled" | "updated", additionalInfo?: {
    cancelMessage?: string;
    updateDetails?: string;
}): void;
/**
 * 管理者通知のメッセージ内容を生成（操作種別に応じて）
 * @param {ReservationCore} reservation - 予約データ
 * @param {{realName: string, displayName: string}} student - 生徒情報
 * @param {'created'|'cancelled'|'updated'} operationType - 操作種別
 * @param {{cancelMessage?: string | undefined, updateDetails?: string | undefined}} additionalInfo - 追加情報
 * @returns {{subject: string, body: string}} 件名と本文
 * @private
 */
export function _buildAdminNotificationContent(reservation: ReservationCore, student: {
    realName: string;
    displayName: string;
}, operationType: "created" | "cancelled" | "updated", additionalInfo: {
    cancelMessage?: string | undefined;
    updateDetails?: string | undefined;
}): {
    subject: string;
    body: string;
};
