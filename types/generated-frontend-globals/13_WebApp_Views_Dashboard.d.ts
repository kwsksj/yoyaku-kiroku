/**
 * 特定の履歴カードのメモセクションとボタンのみを部分更新（ちらつき防止・スムーズ切替）
 * @param {string} reservationId - 更新対象の予約ID
 */
export function updateSingleHistoryCard(reservationId: string): void;
/**
 * メモセクションのみを更新（DOM直接操作）
 * @param {string} reservationId - 予約ID
 * @param {ReservationData} historyItem - 履歴データ
 * @param {boolean} isInEditMode - 編集モード状態
 */
export function _updateMemoSection(reservationId: string, historyItem: ReservationData, isInEditMode: boolean): void;
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
 * 履歴カードのボタンのみを部分更新（無限ループ防止）
 * @param {string} reservationId - 予約ID
 */
export function _updateHistoryCardButton(reservationId: string): void;
export function getDashboardView(): string;
export function _buildEditButtons(booking: ReservationData): Array<any>;
export function _buildAccountingButtons(booking: ReservationData): Array<any>;
export function _buildHistoryEditButtons(isInEditMode?: boolean, reservationId?: string): Array<any>;
export function _buildHistoryAccountingButtons(historyItem: ReservationData): Array<any>;
export function _buildBookingBadges(booking: ReservationData): Array<{
    type: string;
    text: string;
}>;
export function _checkIfLessonAvailable(booking: ReservationData): boolean;
