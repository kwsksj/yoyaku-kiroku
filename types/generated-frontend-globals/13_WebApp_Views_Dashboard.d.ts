/**
 * 特定の履歴カードのメモセクションとボタンのみを部分更新（ちらつき防止・スムーズ切替）
 * @param {string} reservationId - 更新対象の予約ID
 */
export function updateSingleHistoryCard(reservationId: string): void;
/**
 * メモセクションのみを更新（DOM直接操作）
 * @param {string} reservationId - 予約ID
 * @param {ReservationCore} historyItem - 履歴データ
 * @param {boolean} isInEditMode - 編集モード状態
 */
export function _updateMemoSection(reservationId: string, historyItem: ReservationCore, isInEditMode: boolean): void;
/**
 * 統一されたテキストエリアID生成
 * @param {string} reservationId - 予約ID
 * @returns {string} テキストエリアID
 */
export function _getMemoTextareaId(reservationId: string): string;
/**
 * メモテキストエリアにイベントリスナーを設定
 * @param {string} reservationId - 予約ID
 */
export function _attachMemoEventListeners(reservationId: string): void;
/**
 * 履歴カードのボタンのみを部分更新
 * 【廃止】ボタンはmemoSection内に移動したため、この関数は空実装になりました。
 * 将来削除予定ですが、呼び出し元との互換性のため空関数として残しています。
 * @param {string} _reservationId - 予約ID（未使用）
 */
export function _updateHistoryCardButton(_reservationId: string): void;
export function getDashboardView(): string;
export function _buildEditButtons(booking: ReservationCore): Array<any>;
export function _buildBookingBadges(booking: ReservationCore): Array<{
    type: BadgeType;
    text: string;
}>;
export function _checkIfLessonAvailable(booking: ReservationCore): boolean;
