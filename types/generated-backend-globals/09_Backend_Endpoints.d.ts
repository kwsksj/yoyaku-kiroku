/**
 * 予約操作後に最新データを取得して返す汎用関数
 * @param {Function} operationFunction - 実行する操作関数 (makeReservation, cancelReservationなど)
 * @param {ReservationCore|AccountingDetailsCore|any} operationParams - 操作関数に渡すパラメータ (Core型)
 * @param {string} studentId - 対象生徒のID
 * @param {string} successMessage - 操作成功時のメッセージ
 * @returns {ApiResponseGeneric} 操作結果と最新データを含むAPIレスポンス
 */
export function executeOperationAndGetLatestData(operationFunction: Function, operationParams: ReservationCore | AccountingDetailsCore | any, studentId: string, successMessage: string): ApiResponseGeneric;
/**
 * 予約を実行し、成功した場合に最新の全初期化データを返す。
 * @param {ReservationCore} reservationInfo - 予約情報。`reservationId`と`status`はバックエンドで生成するため未設定でOK。
 * @returns {ApiResponseGeneric} 処理結果と最新の初期化データ
 */
export function makeReservationAndGetLatestData(reservationInfo: ReservationCore): ApiResponseGeneric;
/**
 * 予約をキャンセルし、成功した場合に最新の全初期化データを返す。
 * @param {ReservationCore} cancelInfo - キャンセル情報（reservationId, studentId, cancelMessageを含む）
 * @returns {ApiResponseGeneric} 処理結果と最新の初期化データ
 */
export function cancelReservationAndGetLatestData(cancelInfo: ReservationCore): ApiResponseGeneric;
/**
 * 予約詳細を更新し、成功した場合に最新の全初期化データを返す。
 * @param {ReservationCore} details - 更新する予約詳細。`reservationId`と更新したいフィールドのみを持つ。
 * @returns {ApiResponseGeneric} 処理結果と最新の初期化データ
 */
export function updateReservationDetailsAndGetLatestData(details: ReservationCore): ApiResponseGeneric;
/**
 * 予約のメモを更新し、成功した場合に最新の全初期化データを返す
 * @param {string} reservationId - 更新対象の予約ID
 * @param {string} studentId - 対象生徒のID
 * @param {string} newMemo - 新しいメモ内容
 * @returns {ApiResponseGeneric} 処理結果と最新の初期化データ
 */
export function updateReservationMemoAndGetLatestData(reservationId: string, studentId: string, newMemo: string): ApiResponseGeneric;
/**
 * 会計処理を実行し、成功した場合に最新の全初期化データを返す。
 * @param {ReservationCore} reservationWithAccounting - 会計情報が追加/更新された予約オブジェクト。
 * @returns {ApiResponseGeneric} 処理結果と最新の初期化データ
 */
export function saveAccountingDetailsAndGetLatestData(reservationWithAccounting: ReservationCore): ApiResponseGeneric;
/**
 * 統合ログインエンドポイント：認証 + 初期データ + 個人データを一括取得
 * @param {string} phone - 電話番号（ユーザー認証用）
 * @returns {ApiResponseGeneric} 認証結果、初期データ、個人データを含む結果
 */
export function getLoginData(phone: string): ApiResponseGeneric;
/**
 *軽量なキャッシュバージョンチェック用API
 * 空き枠データの更新有無を高速で判定
 * @returns {ApiResponseGeneric} - { success: boolean, versions: object }
 */
export function getCacheVersions(): ApiResponseGeneric;
/**
 * 複数のデータタイプを一度に取得するバッチ処理関数
 * @param {string[]} dataTypes - 取得するデータタイプの配列 ['accounting', 'lessons', 'reservations']
 * @param {string|null} phone - 電話番号（ユーザー特定用、任意）
 * @param {string|null} studentId - 生徒ID（個人データ取得用、任意）
 * @returns {BatchDataResult} 要求されたすべてのデータを含む統合レスポンス
 */
export function getBatchData(dataTypes?: string[], phone?: string | null, studentId?: string | null): BatchDataResult;
/**
 * 統一APIレスポンス形式のエラーハンドラ
 * @param {string} message - エラーメッセージ
 * @param {boolean} [log=false] - Loggerにエラーを記録するか
 * @returns {ApiResponseGeneric} 統一されたエラーレスポンス
 */
export function createApiErrorResponse(message: string, log?: boolean): ApiResponseGeneric;
/**
 * 指定した日付・教室の日程マスタ情報を取得するAPIエンドポイント
 * フロントエンドから呼び出され、時間設定や定員情報を提供
 * @param {ScheduleInfoParams} params - {date: string, classroom: string}
 * @returns {ApiResponseGeneric} APIレスポンス（日程マスタ情報）
 */
export function getScheduleInfo(params: ScheduleInfoParams): ApiResponseGeneric;
/**
 * 指定した予約の会計詳細データを予約シートから取得する
 * @param {string} reservationId - 予約ID
 * @returns {ApiResponseGeneric<AccountingDetails>} 会計詳細データ
 */
export function getAccountingDetailsFromSheet(reservationId: string): ApiResponseGeneric<AccountingDetails>;
/**
 * 空席連絡希望の予約を確定予約に変更し、最新データを返却します。
 * @param {{reservationId: string, studentId: string}} confirmInfo - 確定情報
 * @returns {ApiResponseGeneric} 処理結果と最新データ
 */
export function confirmWaitlistedReservationAndGetLatestData(confirmInfo: {
    reservationId: string;
    studentId: string;
}): ApiResponseGeneric;
