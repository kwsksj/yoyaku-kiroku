/**
 * 管理者にメールで通知を送信します。
 * @param {string} subject - メールの件名
 * @param {string} body - メールの本文
 */
export function sendAdminNotification(subject: string, body: string): void;
/**
 * よやく操作の管理者通知（統一インターフェース）
 * @param {ReservationCore} reservation - よやくデータ
 * @param {'created'|'cancelled'|'updated'} operationType - 操作種別
 * @param {{cancelMessage?: string, updateDetails?: string}} [additionalInfo] - 追加情報
 */
export function sendAdminNotificationForReservation(reservation: ReservationCore, operationType: "created" | "cancelled" | "updated", additionalInfo?: {
    cancelMessage?: string;
    updateDetails?: string;
}): void;
/**
 * 管理者通知のメッセージ内容を生成（操作種別に応じて）
 * @param {ReservationCore} reservation - よやくデータ
 * @param {UserCore | undefined} student - 生徒情報
 * @param {'created'|'cancelled'|'updated'} operationType - 操作種別
 * @param {{cancelMessage?: string | undefined, updateDetails?: string | undefined}} additionalInfo - 追加情報
 * @returns {{subject: string, body: string}} 件名と本文
 * @private
 */
export function _buildAdminNotificationContent(reservation: ReservationCore, student: UserCore | undefined, operationType: "created" | "cancelled" | "updated", additionalInfo: {
    cancelMessage?: string | undefined;
    updateDetails?: string | undefined;
}): {
    subject: string;
    body: string;
};
/**
 * ユーザー操作の管理者通知（統一インターフェース）
 * @param {UserCore & {registrationDate?: string, originalPhone?: string, newPhone?: string, withdrawalDate?: string}} userData - ユーザーデータ（UserCore + 操作固有の追加情報）
 * @param {'registered'|'withdrawn'} operationType - 操作種別
 */
export function sendAdminNotificationForUser(userData: UserCore & {
    registrationDate?: string;
    originalPhone?: string;
    newPhone?: string;
    withdrawalDate?: string;
}, operationType: "registered" | "withdrawn"): void;
/**
 * 管理者通知向けに表示名を生成（本名とニックネーム併記）
 * @param {UserCore | undefined} user
 * @returns {string}
 */
export function formatAdminUserDisplay(user: UserCore | undefined): string;
