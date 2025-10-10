/**
 * =================================================================
 * 【ファイル名】: 14_WebApp_Handlers_Utils.js
 * 【バージョン】: 1.0
 * 【役割】: WebAppのフロントエンドにおける、ユーティリティ関数と
 * ヘルパー関数を集約します。
 * 【構成】: 14ファイル構成から分割されたユーティリティファイル
 * 【新規作成理由】:
 * - メインハンドラーファイルの肥大化対策
 * - ユーティリティ関数の再利用性向上
 * - AIの作業効率向上のためのファイル分割
 * =================================================================
 */
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
 * ReservationObjectをReservationDataに安全に変換する
 * @param {ReservationObject} reservationObj - 予約オブジェクト
 * @returns {ReservationData} 変換された予約データ
 */
export function convertToReservationData(reservationObj: ReservationObject): ReservationData;
/**
 * 時刻データを適切に取得するヘルパー関数
 * @param {string} elementId - 時刻入力要素のID
 * @param {ReservationData | null} reservationData - 予約データ（フォールバック用）
 * @param {string} timeField - 時刻フィールド名（'startTime' or 'endTime'）
 * @returns {string} 時刻文字列（HH:mm形式）
 */
export function getTimeValue(elementId: string, reservationData: ReservationData | null, timeField: string): string;
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
 * バッチ処理でキャッシュから最新データを取得してappStateを更新
 * ユーザーの予約・履歴・スロット情報を一括取得し、指定されたビューに遷移
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
 * @param {string} [title='販売品リスト'] - 見出しタイトル
 * @returns {string} HTML文字列
 */
export function buildSalesChecklist(accountingMaster: AccountingMasterItemCore[], checkedValues?: string[], title?: string): string;
/**
 * 物販リストをチェックボックスで表示するHTMLを返す（再利用可能）
 * @param {AccountingMasterItemCore[]} salesList - 物販アイテム配列
 * @param {string[]} checkedValues - チェック済み項目名配列（任意）
 * @returns {string} HTML文字列
 */
export function getSalesCheckboxListHtml(salesList: AccountingMasterItemCore[], checkedValues?: string[]): string;
