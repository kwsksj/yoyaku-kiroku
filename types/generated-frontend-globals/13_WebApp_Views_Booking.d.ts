/**
 * 編集モード対応の履歴カードを生成します
 * @param {ReservationCore} historyItem - 履歴データ
 * @param {Array<any>} editButtons - 編集ボタン配列
 * @param {Array<any>} accountingButtons - 会計ボタン配列
 * @param {boolean} isInEditMode - 編集モード状態
 * @returns {string} HTML文字列
 */
export function _buildHistoryCardWithEditMode(historyItem: ReservationCore, editButtons: Array<any>, accountingButtons: Array<any>, isInEditMode: boolean): string;
export function getBookingView(classroom: string): string;
export function getReservationFormView(): string;
export function renderBookingLessons(lessons: LessonCore[]): string;
export function getClassroomSelectionModalContent(): string;
export function getClassroomSelectionModal(): string;
