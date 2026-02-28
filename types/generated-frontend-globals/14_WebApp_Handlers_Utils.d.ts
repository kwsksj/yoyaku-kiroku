/**
 * 画面全体のスクロール位置を先頭にリセットします。
 * 埋め込み環境などでスクロール主体が異なる場合を考慮し、主要スクロール要素を同時にリセットします。
 */
export function resetAppScrollToTop(): void;
/**
 * ビューが変更されていない場合のみ、スクロール位置を復元します。
 * @param {number} scrollY
 * @param {ViewType} expectedView
 * @param {SimpleStateManager} stateManager
 */
export function restoreScrollPositionIfViewUnchanged(scrollY: number, expectedView: ViewType, stateManager: SimpleStateManager): void;
/**
 * 型安全なHTMLElement取得ヘルパー
 * @param {string} id - 要素のID
 * @returns {HTMLElement | null}
 */
export function getElementSafely(id: string): HTMLElement | null;
/**
 * 型安全なHTMLInputElement取得ヘルパー
 * @param {string} id - 要素のID
 * @returns {HTMLInputElement | null}
 */
export function getInputElementSafely(id: string): HTMLInputElement | null;
/**
 * 型安全なHTMLSelectElement取得ヘルパー
 * @param {string} id - 要素のID
 * @returns {HTMLSelectElement | null}
 */
export function getSelectElementSafely(id: string): HTMLSelectElement | null;
/**
 * 型安全なHTMLFormElement取得ヘルパー
 * @param {string} id - 要素のID
 * @returns {HTMLFormElement | null}
 */
export function getFormElementSafely(id: string): HTMLFormElement | null;
/**
 * 日付データの型安全性を確保するヘルパー関数
 * @param {string | Date} date - 日付データ
 * @returns {string} 文字列形式の日付
 */
export function ensureDateString(date: string | Date): string;
/**
 * ReservationObjectをReservationCoreに安全に変換する
 * @param {ReservationObject} reservationObj - よやくオブジェクト
 * @returns {ReservationCore} 変換されたよやくデータ
 */
export function convertToReservationData(reservationObj: ReservationObject): ReservationCore;
/**
 * 時刻データを適切に取得するヘルパー関数
 * @param {string} elementId - 時刻入力要素のID
 * @param {ReservationCore | null} reservationData - よやくデータ（フォールバック用）
 * @param {string} timeField - 時刻フィールド名（'startTime' or 'endTime'）
 * @returns {string} 時刻文字列（HH:mm形式）
 */
export function getTimeValue(elementId: string, reservationData: ReservationCore | null, timeField: string): string;
/**
 * 電話番号入力フィールドのリアルタイム整形処理
 * @param {HTMLInputElement} inputElement - 電話番号入力フィールド
 */
export function handlePhoneInputFormatting(inputElement: HTMLInputElement): void;
/**
 * 電話番号を表示用にフォーマットする（090 1234 5678 形式）
 * @param {string} phoneNumber - フォーマットする電話番号
 * @returns {string} フォーマットされた電話番号
 */
export function formatPhoneNumberForDisplay(phoneNumber: string): string;
/**
 * 現在のユーザーが管理者かどうかを判定（なりすまし中も判定可能）
 * @returns {boolean}
 */
export function isCurrentUserAdmin(): boolean;
/**
 * 管理者操作後のなりすまし終了と画面遷移を一括処理するヘルパー
 * @param {object} options
 * @param {any} [options.participantCacheUpdate] - updateParticipantViewCacheFromReservation の戻り値
 * @param {any} [options.response] - サーバーレスポンス（lessonsデータを含む）
 * @param {string} [options.message] - 表示するメッセージ
 * @param {string} [options.messageTitle] - メッセージタイトル
 * @returns {boolean} processed - 管理者操作として処理された場合はtrue
 */
export function handleAdminImpersonationAfterAction({ participantCacheUpdate, response, message, messageTitle, }?: {
    participantCacheUpdate?: any;
    response?: any;
    message?: string;
    messageTitle?: string;
}): boolean;
/**
 * バッチ処理でキャッシュから最新データを取得してappStateを更新
 * ユーザーのよやく・履歴・スロット情報を一括取得し、指定されたビューに遷移
 * @param {string} targetView - データ取得後に遷移したいビュー名
 */
export function updateAppStateFromCache(targetView: string): void;
/**
 * 今日かどうかを判定するヘルパー関数
 * @param {string} dateString - 日付文字列（YYYY-MM-DD形式）
 * @returns {boolean}
 */
export function isDateToday(dateString: string): boolean;
/**
 * 販売品マスタから物販チェックリスト（折り畳み可能）を生成する関数
 * @param {AccountingMasterItemCore[]} accountingMaster - 販売品マスタ
 * @param {string[]} checkedValues - チェック済み項目名配列（任意）
 * @param {string} [_title='販売品リスト'] - 見出しタイトル（未使用）
 * @returns {string} HTML文字列
 */
export function buildSalesChecklist(accountingMaster: AccountingMasterItemCore[], checkedValues?: string[], _title?: string): string;
/**
 * 物販リストをチェックボックスで表示するHTMLを返す（会計画面スタイル統一版）
 * @param {AccountingMasterItemCore[]} salesList - 物販アイテム配列
 * @param {string[]} checkedValues - チェック済み項目名配列（任意）
 * @returns {string} HTML文字列
 */
export function getSalesCheckboxListHtml(salesList: AccountingMasterItemCore[], checkedValues?: string[]): string;
/**
 * 管理者操作後に参加者リストキャッシュを部分更新する
 * @param {ReservationCore & {lessonId?: string}} reservation
 * @param {'remove'|'upsert'} [mode='upsert']
 * @param {Record<string, any[]>} [baseMap]
 * @param {LessonCore[] | null} [baseLessons]
 * @returns {Partial<UIState> | null}
 */
export function updateParticipantViewCacheFromReservation(reservation: ReservationCore & {
    lessonId?: string;
}, mode?: "remove" | "upsert", baseMap?: Record<string, any[]>, baseLessons?: LessonCore[] | null): Partial<UIState> | null;
/**
 * 管理者戻り用の参加者リストペイロードを作成（既存データを優先）
 * @param {LessonCore[] | null | undefined} responseLessons
 * @returns {Partial<UIState>}
 */
export function getParticipantPayloadForAdminView(responseLessons: LessonCore[] | null | undefined): Partial<UIState>;
/**
 * 管理者操作後に参加者ビューを最新化するヘルパー
 */
export function refreshParticipantsViewForAdmin(): void;
