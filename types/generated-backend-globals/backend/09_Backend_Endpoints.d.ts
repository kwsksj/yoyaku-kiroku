/**
 * @typedef {import('../../types/core/reservation').ReservationCoreWithAccounting} ReservationCoreWithAccounting
 */
/**
 * よやく操作後に最新データを取得して返す汎用関数
 * @param {Function} operationFunction - 実行する操作関数 (makeReservation, cancelReservationなど)
 * @param {ReservationCore|AccountingDetailsCore|any} operationParams - 操作関数に渡すパラメータ (Core型)
 * @param {string} studentId - 対象生徒のID
 * @param {string} successMessage - 操作成功時のメッセージ
 * @returns {ApiResponseGeneric} 操作結果と最新データを含むAPIレスポンス
 */
export function executeOperationAndGetLatestData(operationFunction: Function, operationParams: ReservationCore | AccountingDetailsCore | any, studentId: string, successMessage: string): ApiResponseGeneric;
/**
 * よやくを実行し、成功した場合に最新の全初期化データを返す。
 * @param {ReservationCore} reservationInfo - よやく情報。`reservationId`と`status`はバックエンドで生成するため未設定でOK。
 * @returns {ApiResponseGeneric} 処理結果と最新の初期化データ
 */
export function makeReservationAndGetLatestData(reservationInfo: ReservationCore): ApiResponseGeneric;
/**
 * よやくをキャンセルし、成功した場合に最新の全初期化データを返す。
 * @param {ReservationCore} cancelInfo - キャンセル情報（reservationId, studentId, cancelMessageを含む）
 * @returns {ApiResponseGeneric} 処理結果と最新の初期化データ
 */
export function cancelReservationAndGetLatestData(cancelInfo: ReservationCore): ApiResponseGeneric;
/**
 * よやく詳細を更新し、成功した場合に最新の全初期化データを返す。
 * @param {ReservationCore & {nextLessonGoal?: string}} details - 更新するよやく詳細。`reservationId`と更新したいフィールドのみを持つ。
 * @returns {ApiResponseGeneric} 処理結果と最新の初期化データ
 */
export function updateReservationDetailsAndGetLatestData(details: ReservationCore & {
    nextLessonGoal?: string;
}): ApiResponseGeneric;
/**
 * よやくの参加日を変更し、成功した場合に最新の全初期化データを返す。
 * 内部的には新規よやく作成と旧よやくキャンセルを実行します。
 * @param {ReservationCore} newReservationData - 新しいよやくデータ
 * @param {string} originalReservationId - キャンセルする元の予約ID
 * @returns {ApiResponseGeneric} 処理結果と最新の初期化データ
 */
export function changeReservationDateAndGetLatestData(newReservationData: ReservationCore, originalReservationId: string): ApiResponseGeneric;
/**
 * よやくのメモを更新し、成功した場合に最新の全初期化データを返す
 * @param {string} reservationId - 更新対象の予約ID
 * @param {string} studentId - 対象生徒のID
 * @param {string} newMemo - 新しいメモ内容
 * @returns {ApiResponseGeneric} 処理結果と最新の初期化データ
 */
export function updateReservationMemoAndGetLatestData(reservationId: string, studentId: string, newMemo: string): ApiResponseGeneric;
/**
 * 生徒のけいかく・もくひょうを更新する
 * @param {{ studentId: string, nextLessonGoal: string, _isConclusion?: boolean }} payload - 更新内容
 * @returns {ApiResponse} 処理結果
 */
export function updateNextLessonGoal(payload: {
    studentId: string;
    nextLessonGoal: string;
    _isConclusion?: boolean;
}): ApiResponse;
/**
 * 先生へのメッセージをログに記録する
 * @param {{ studentId: string, message: string }} payload - メッセージ内容
 * @returns {ApiResponse} 処理結果
 */
export function sendMessageToTeacher(payload: {
    studentId: string;
    message: string;
}): ApiResponse;
/**
 * 会計処理を実行し、成功した場合に最新の全初期化データを返す。
 * @param {ReservationCore} reservationWithAccounting - 会計情報が追加/更新されたよやくオブジェクト。
 * @returns {ApiResponseGeneric} 処理結果と最新の初期化データ
 */
export function saveAccountingDetailsAndGetLatestData(reservationWithAccounting: ReservationCore): ApiResponseGeneric;
/**
 * 会計修正を実行し、成功した場合に最新の全初期化データを返す。
 * @param {ReservationCore} reservationWithAccounting - 修正後の会計情報を含むよやくオブジェクト。
 * @returns {ApiResponseGeneric} 処理結果と最新の初期化データ
 */
export function updateAccountingDetailsAndGetLatestData(reservationWithAccounting: ReservationCore): ApiResponseGeneric;
/**
 * 統合ログインエンドポイント：認証 + 初期データ + 個人データを一括取得
 *
 * @param {string} phone - 電話番号（ユーザー認証用）
 * @param {boolean} [isDataRefresh=false] - データ再取得フラグ（リロード時はtrue）
 * @param {string} [restorationReason] - 復元理由（データ再取得時のみ）
 * @param {number} [elapsedSeconds] - リロードからの経過時間（秒）
 * @param {string} [restoredView] - 復元されたビュー名
 * @returns {AuthenticationResponse | ApiErrorResponse} 認証結果、初期データ、個人データを含む結果
 */
export function getLoginData(phone: string, isDataRefresh?: boolean, restorationReason?: string, elapsedSeconds?: number, restoredView?: string): AuthenticationResponse | ApiErrorResponse;
/**
 * 統合新規登録エンドポイント：ユーザー登録 + 初期データを一括取得
 *
 * @param {UserCore} userData - 登録するユーザー情報
 * @returns {AuthenticationResponse | ApiErrorResponse} 登録結果、初期データを含む結果
 */
export function getRegistrationData(userData: UserCore): AuthenticationResponse | ApiErrorResponse;
/**
 *軽量なキャッシュバージョンチェック用API
 * 空き枠データの更新有無を高速で判定
 * @returns {ApiResponseGeneric} - { success: boolean, versions: object }
 */
export function getCacheVersions(): ApiResponseGeneric;
/**
 * 複数のデータタイプを一度に取得するバッチ処理関数
 * @param {string[]} dataTypes - 取得するデータタイプの配列 ['accounting', 'lessons', 'reservations', 'cache-versions']
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
 * 指定したよやくの会計詳細データをよやくシートから取得する
 * @param {string} reservationId - 予約ID
 * @returns {ApiResponseGeneric<AccountingDetails>} 会計詳細データ
 */
export function getAccountingDetailsFromSheet(reservationId: string): ApiResponseGeneric<AccountingDetails>;
/**
 * 空席連絡希望のよやくを確定よやくに変更し、最新データを返却します。
 * @param {{reservationId: string, studentId: string}} confirmInfo - 確定情報
 * @returns {ApiResponseGeneric} 処理結果と最新データ
 */
export function confirmWaitlistedReservationAndGetLatestData(confirmInfo: {
    reservationId: string;
    studentId: string;
}): ApiResponseGeneric;
/**
 * 参加者リスト表示用のレッスン一覧を取得する
 * - キャッシュから過去〜未来のレッスン情報を取得
 * - 管理者・一般生徒を問わず、同じデータを返す（レッスン情報は公開情報）
 *
 * @param {string} studentId - リクエストしている生徒のID（将来の権限チェック用によやく）
 * @param {boolean} [includeHistory=true] - 過去のレッスンを含めるか（デフォルト: true）
 * @param {boolean} [includeReservations=false] - よやくデータを含めるか
 * @param {string} [adminLoginId=''] - 管理者用ログインID（PropertyServiceと突合する）
 * @returns {ApiResponseGeneric} レッスン一覧
 */
export function getLessonsForParticipantsView(studentId: string, includeHistory?: boolean, includeReservations?: boolean, adminLoginId?: string): ApiResponseGeneric;
/**
 * 参加者ビューの過去レッスンを、指定日より前から追加取得します。
 * データ量を抑えるため件数制限をかけ、同一日付は取りこぼし防止のためまとめて返します。
 *
 * @param {string} studentId - リクエストしている生徒ID
 * @param {string} beforeDate - この日付より古いデータを取得する基準日（YYYY-MM-DD）
 * @param {string} [adminLoginId=''] - 管理者用ログインID
 * @param {number} [limit] - 1回で取得する最大件数（同一日付分は上限超過して返却）
 * @returns {ApiResponseGeneric}
 */
export function getPastLessonsForParticipantsView(studentId: string, beforeDate: string, adminLoginId?: string, limit?: number): ApiResponseGeneric;
/**
 * 特定レッスンのよやく情報リストを取得する（権限に応じてフィルタリング）
 * - 管理者: 全項目を返す（本名、電話番号、メールアドレスなど）
 * - 一般生徒: 公開情報のみ（本名、電話番号、メールアドレスを除外）
 *
 * @param {string} lessonId - レッスンID
 * @param {string} studentId - リクエストしている生徒のID
 * @returns {ApiResponseGeneric} よやく情報リスト
 */
export function getReservationsForLesson(lessonId: string, studentId: string): ApiResponseGeneric;
/**
 * 特定生徒の詳細情報とよやく履歴を取得する（権限に応じてフィルタリング）
 * - 管理者: 全項目を返す
 * - 一般生徒（本人）: 自分の情報のみ閲覧可能
 * - 一般生徒（他人）: 公開情報のみ（ニックネーム、参加回数など）
 *
 * @param {string} targetStudentId - 表示対象の生徒ID
 * @param {string} requestingStudentId - リクエストしている生徒のID
 * @returns {ApiResponseGeneric} 生徒詳細情報とよやく履歴
 */
export function getStudentDetailsForParticipantsView(targetStudentId: string, requestingStudentId: string): ApiResponseGeneric;
/**
 * 会計処理を実行（売上転載オプション付き）
 * @param {any} formData - フォームデータ
 * @param {AccountingDetailsCore} calculationResult - 計算結果
 * @param {boolean} withSalesTransfer - 売上転載を即時実行するか
 * @returns {ApiResponseGeneric<{message: string}>} 処理結果
 */
export function processAccountingWithTransferOption(formData: any, calculationResult: AccountingDetailsCore, withSalesTransfer: boolean): ApiResponseGeneric<{
    message: string;
}>;
/**
 * 管理画面から売上転載を手動実行（または事前集計プレビュー）するエンドポイント
 * @param {{ targetDate?: string, previewOnly?: boolean, adminToken?: string, _adminToken?: string }} payload
 * @returns {ApiResponseGeneric<any>}
 */
export function runSalesTransferFromAdmin(payload?: {
    targetDate?: string;
    previewOnly?: boolean;
    adminToken?: string;
    _adminToken?: string;
}): ApiResponseGeneric<any>;
/**
 * セッション終了ウィザードの統合処理エンドポイント
 * 1. 今日の記録（sessionNote）を更新
 * 2. 会計処理を実行
 * 3. オプションで次回よやくを作成
 *
 * @param {any} payload - メイン処理データ
 * @param {any} nextReservationPayload - 次回よやくデータ（null = スキップ）
 * @returns {ApiResponseGeneric} 処理結果
 */
export function processSessionConclusion(payload: any, nextReservationPayload: any): ApiResponseGeneric;
export type ReservationCoreWithAccounting = import("../../types/core/reservation").ReservationCoreWithAccounting;
