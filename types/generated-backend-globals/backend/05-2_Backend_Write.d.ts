/**
 * 指定したユーザーが同一日によやくを持っているかチェックする共通関数。
 * @param {string} studentId - 学生ID
 * @param {string} date - 日付（YYYY-MM-DD形式）
 * @returns {boolean} - 同一日に有効なよやくがある場合true
 */
export function checkDuplicateReservationOnSameDay(studentId: string, date: string): boolean;
/**
 * 指定日・教室の定員チェックを行う共通関数。
 * @param {string} classroom - 教室
 * @param {string} date - 日付
 * @param {string} startTime - 開始時間
 * @param {string} endTime - 終了時間
 * @param {boolean} [isFirstLecture=false] - 初回よやくの場合true
 * @returns {boolean} - 定員超過の場合true
 */
export function checkCapacityFull(classroom: string, date: string, startTime: string, endTime: string, isFirstLecture?: boolean): boolean;
/**
 * 時間制よやくの時刻に関する検証を行うプライベートヘルパー関数。
 * @param {string} startTime - 開始時刻 (HH:mm)。
 * @param {string} endTime - 終了時刻 (HH:mm)。
 * @param {LessonCore} scheduleRule - 日程マスタから取得した日程情報。
 * @throws {Error} 検証に失敗した場合、理由を示すエラーをスローする。
 */
export function _validateTimeBasedReservation(startTime: string, endTime: string, scheduleRule: LessonCore): void;
/**
 * 【内部関数】ReservationCoreオブジェクトをシートに書き込み、キャッシュを更新する
 * @param {ReservationCore} reservation - 保存する完全なよやくオブジェクト
 * @param {'create' | 'update'} mode - 'create'なら新規追加、'update'なら上書き
 * @returns {{newRowData: RawSheetRow, headerMap: HeaderMapType}} 保存された行データとヘッダーマップ
 */
export function _saveReservationCoreToSheet(reservation: ReservationCore, mode: "create" | "update"): {
    newRowData: RawSheetRow;
    headerMap: HeaderMapType;
};
/**
 * よやくを実行します（Phase 8: Core型統一対応）
 *
 * @param {ReservationCore} reservationInfo - よやく作成リクエスト（Core型）。reservationId/statusはundefined可
 * @returns {ApiResponseGeneric<{ message: string }>} - 処理結果
 *
 * @example
 * makeReservation({
 *   studentId: 'S-001',
 *   classroom: '東京教室',
 *   date: '2025-10-15',
 *   startTime: '13:00',
 *   endTime: '16:00',
 *   chiselRental: true,
 *   firstLecture: false,
 * });
 */
export function makeReservation(reservationInfo: ReservationCore): ApiResponseGeneric<{
    message: string;
}>;
/**
 * よやくをキャンセルします（Core型オブジェクト中心設計）
 *
 * @param {import('../../types/core/reservation').CancelReservationParams} cancelInfo - よやくキャンセル情報。`reservationId`と`studentId`は必須。`cancelMessage`は任意。
 * @returns {ApiResponseGeneric<{ message: string }>} - 処理結果
 */
export function cancelReservation(cancelInfo: import("../../types/core/reservation").CancelReservationParams): ApiResponseGeneric<{
    message: string;
}>;
/**
 * キャンセル後の空き通知希望者への通知機能
 * @param {string} lessonId - レッスンID
 * @param {ReservationCore} _cancelledReservation - キャンセルされたよやくデータ（将来の拡張用）
 */
export function notifyAvailabilityToWaitlistedUsers(lessonId: string, _cancelledReservation: ReservationCore): void;
/**
 * 空き通知対象のユーザーリストを取得
 * @param {LessonCore} lessonWithSlots - 空き枠を含むレッスン情報
 * @param {ReservationCore[]} reservationsForLesson - 対象レッスンのよやく一覧
 * @returns {Array<{studentId: string, email: string, realName: string, isFirstTime: boolean}>}
 */
export function getWaitlistedUsersForNotification(lessonWithSlots: LessonCore, reservationsForLesson: ReservationCore[]): Array<{
    studentId: string;
    email: string;
    realName: string;
    isFirstTime: boolean;
}>;
/**
 * 空き通知メールの本文を生成
 * @param {{studentId: string, email: string, realName: string, isFirstTime: boolean}} recipient - 受信者情報
 * @param {LessonCore} lesson - レッスン情報
 * @returns {string} メール本文
 */
export function createAvailabilityNotificationEmail(recipient: {
    studentId: string;
    email: string;
    realName: string;
    isFirstTime: boolean;
}, lesson: LessonCore): string;
/**
 * よやくの詳細情報を一括で更新します（Core型オブジェクト中心設計）
 *
 * @param {ReservationCore} details - よやく更新リクエスト。`reservationId`と更新したいフィールドのみを持つ部分的な`ReservationCore`オブジェクト。
 * @returns {ApiResponseGeneric<{ message: string }>} - 処理結果
 */
export function updateReservationDetails(details: ReservationCore): ApiResponseGeneric<{
    message: string;
}>;
/**
 * [設計思想] フロントエンドは「ユーザーが何を選択したか」という入力情報のみを渡し、
 * バックエンドが料金マスタと照合して金額を再計算・検証する責務を持つ。
 * この関数は、会計処理が完了したReservationCoreオブジェクトを受け取り、永続化する責務を持つ。
 * @param {ReservationCore} reservationWithAccounting - 会計情報が追加/更新されたよやくオブジェクト。
 * @returns {ApiResponseGeneric<{ message: string }>} - 処理結果。
 */
export function saveAccountingDetails(reservationWithAccounting: ReservationCore): ApiResponseGeneric<{
    message: string;
}>;
/**
 * 会計情報を修正します（当日20時まで可能）
 *
 * @param {ReservationCore} reservationWithUpdatedAccounting - 修正後の会計情報を含むよやくオブジェクト。
 * @returns {ApiResponseGeneric<{ message: string }>} - 処理結果。
 *
 * @description
 * 既存の会計データを修正する機能。修正締切（20時）までのみ実行可能。
 * 売上表への転載は20時のバッチ処理で行われるため、ここではよやくシートの更新のみを行う。
 * これにより、何度修正しても売上表に影響を与えずに修正が可能。
 */
export function updateAccountingDetails(reservationWithUpdatedAccounting: ReservationCore): ApiResponseGeneric<{
    message: string;
}>;
/**
 * [設計思想] 後続処理でエラーが発生してもメインの会計処理は成功と見なすため、
 * この関数内でのエラーはログに記録するに留め、上位にはスローしない。
 * ただし、バッチ処理等で成否を知る必要があるため、戻り値で結果を返す。
 *
 * @private
 * @param {ReservationCore} reservation - 売上ログを生成する対象のよやくオブジェクト
 * @param {AccountingDetailsCore} accountingDetails - 計算済みの会計詳細オブジェクト。
 * @returns {{ success: boolean, error?: Error }} 処理結果
 */
export function logSalesForSingleReservation(reservation: ReservationCore, accountingDetails: AccountingDetailsCore): {
    success: boolean;
    error?: Error;
};
/**
 * 日程マスタから特定の日付・教室のルールを取得する
 * @param {string} date - 日付 (YYYY-MM-DD)
 * @param {string} classroom - 教室名
 * @returns {LessonCore | undefined} 日程マスタのルール
 */
export function getScheduleInfoForDate(date: string, classroom: string): LessonCore | undefined;
/**
 * 空き通知希望のよやくを確定する
 * @param {{reservationId: string, studentId: string, messageToTeacher?: string, _isByAdmin?: boolean, _adminToken?: string | null}} confirmInfo - 確定情報
 * @returns {ApiResponseGeneric<any>} 処理結果と最新データ
 */
export function confirmWaitlistedReservation(confirmInfo: {
    reservationId: string;
    studentId: string;
    messageToTeacher?: string;
    _isByAdmin?: boolean;
    _adminToken?: string | null;
}): ApiResponseGeneric<any>;
/**
 * 指定した予約IDと日付の売上ログが既に記録されているか確認
 * @param {string} reservationId - 予約ID
 * @param {string} _date - よやく日（YYYY-MM-DD形式）※未使用（将来の拡張用）
 * @returns {boolean} 既に記録されている場合はtrue
 */
export function checkIfSalesAlreadyLogged(reservationId: string, _date: string): boolean;
/**
 * 初回講習完了時の自動処理
 * 未来の「初回」ステータスのよやくを「経験者」に変更し、必要な通知を行う
 * @param {string} studentId - 生徒ID
 */
export function processFirstTimeCompletion(studentId: string): void;
