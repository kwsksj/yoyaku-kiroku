/**
 * =================================================================
 * 【ファイル名】: 02-7_Notification_StudentReservation.js
 * 【バージョン】: 1.0
 * 【役割】: 生徒への予約関連メール通知
 * - 予約確定メール送信
 * - 予約キャンセルメール送信
 * - 統一メール送信インターフェース
 * =================================================================
 */
/**
 * 予約確定メール送信機能（ReservationCore対応）
 * @param {ReservationCore} reservation - ユーザー情報を含む予約データ
 * @returns {boolean} 送信成功・失敗
 */
export function sendBookingConfirmationEmail(reservation: ReservationCore): boolean;
/**
 * メールテンプレート生成（初回者・経験者対応）
 * @param {ReservationCore} reservation - 予約情報
 * @returns {{subject: string, textBody: string}}
 */
export function createBookingConfirmationTemplate(reservation: ReservationCore): {
    subject: string;
    textBody: string;
};
/**
 * 初回者向けテキストメール生成
 * @param {ReservationCore} reservation - 予約情報
 * @param {UserCore} student - ユーザー情報
 * @param {string} formattedDate - フォーマット済み日付
 * @param {string} statusText - ステータステキスト
 * @returns {string} メール本文テキスト
 */
export function createFirstTimeEmailText(reservation: ReservationCore, student: UserCore, formattedDate: string, statusText: string): string;
/**
 * 経験者向けテキストメール生成
 * @param {ReservationCore} reservation - 予約情報
 * @param {UserCore} student - ユーザー情報
 * @param {string} formattedDate - フォーマット済み日付
 * @param {string} statusText - ステータステキスト
 * @returns {string} メール本文テキスト
 */
export function createRegularEmailText(reservation: ReservationCore, student: UserCore, formattedDate: string, statusText: string): string;
/**
 * ヘルパー関数群
 */
/**
 * 授業料金額を取得
 * @param {string} classroom - 教室名
 * @returns {string} 授業料テキスト（複数行、例:"授業料（時間制）: ¥600 （30分あたり）\n初回参加費: ¥800"）
 */
export function getTuitionDisplayText(classroom: string): string;
/**
 * 共通の申込み内容セクション生成（テキスト版）
 * @param {ReservationCore} reservation - 予約情報
 * @param {string} formattedDate - フォーマット済み日付
 * @param {string} statusText - ステータステキスト
 * @returns {string} 申込み内容テキスト
 */
export function createBookingDetailsText(reservation: ReservationCore, formattedDate: string, statusText: string): string;
/**
 * 日付をメール用にフォーマット
 * @param {string|Date} dateInput - 日付（文字列またはDateオブジェクト）
 */
export function formatDateForEmail(dateInput: string | Date): string;
/**
 * 連絡事項・会場情報（テキスト版）
 */
export function getContactAndVenueInfoText(): string;
/**
 * 予約関連メール送信（統一インターフェース）
 * @param {ReservationCore} reservation - 予約データ
 * @param {'confirmation'|'cancellation'} emailType - メール種別
 * @param {string} [cancelMessage] - キャンセル理由（cancellationの場合のみ）
 */
export function sendReservationEmailAsync(reservation: ReservationCore, emailType: "confirmation" | "cancellation", cancelMessage?: string): void;
/**
 *キャンセル確認メール送信（実装）
 * @param {ReservationCore} reservation - 予約情報
 * @param {string} [cancelMessage] - キャンセル理由
 * @returns {boolean} 送信成功・失敗
 */
export function sendCancellationEmail(reservation: ReservationCore, cancelMessage?: string): boolean;
/**
 *キャンセル確認メール本文生成
 * @param {ReservationCore} reservation - 予約情報
 * @param {string} formattedDate - フォーマット済み日付
 * @param {string} [cancelMessage] - キャンセル理由
 * @returns {string} メール本文テキスト
 * @private
 */
export function _createCancellationEmailText(reservation: ReservationCore, formattedDate: string, cancelMessage?: string): string;
