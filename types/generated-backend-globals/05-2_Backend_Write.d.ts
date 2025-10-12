/**
 * =================================================================
 * 【ファイル名】: 05-2_Backend_Write.gs
 * 【バージョン】: 3.3
 * 【役割】: WebAppからのデータ書き込み・更新要求（Write）と、
 * それに付随する検証ロジックに特化したバックエンド機能。
 * 【v3.3での変更点】:
 * - updateReservationDetailsのバグ修正（オプション・材料情報が反映されない問題）
 * - 誤って削除された checkCapacityFull 関数を復元
 * =================================================================
 *
 * @global sendBookingConfirmationEmailAsync - External service function from 06_ExternalServices.js
 */
/**
 * 指定したユーザーが同一日に予約を持っているかチェックする共通関数。
 * @param {string} studentId - 学生ID
 * @param {string} date - 日付（YYYY-MM-DD形式）
 * @returns {boolean} - 同一日に有効な予約がある場合true
 */
export function checkDuplicateReservationOnSameDay(studentId: string, date: string): boolean;
/**
 * 指定日・教室の定員チェックを行う共通関数。
 * @param {string} classroom - 教室
 * @param {string} date - 日付
 * @param {string} startTime - 開始時間
 * @param {string} endTime - 終了時間
 * @param {boolean} [isFirstLecture=false] - 初回予約の場合true
 * @returns {boolean} - 定員超過の場合true
 */
export function checkCapacityFull(classroom: string, date: string, startTime: string, endTime: string, isFirstLecture?: boolean): boolean;
/**
 * 時間制予約の時刻に関する検証を行うプライベートヘルパー関数。
 * @param {string} startTime - 開始時刻 (HH:mm)。
 * @param {string} endTime - 終了時刻 (HH:mm)。
 * @param {ScheduleMasterData} scheduleRule - 日程マスタから取得した日程情報。
 * @throws {Error} 検証に失敗した場合、理由を示すエラーをスローする。
 */
export function _validateTimeBasedReservation(startTime: string, endTime: string, scheduleRule: ScheduleMasterData): void;
/**
 * 【内部関数】ReservationCoreオブジェクトをシートに書き込み、キャッシュを更新する
 * @param {ReservationCore} reservation - 保存する完全な予約オブジェクト
 * @param {'create' | 'update'} mode - 'create'なら新規追加、'update'なら上書き
 * @returns {{newRowData: RawSheetRow, headerMap: HeaderMapType}} 保存された行データとヘッダーマップ
 */
export function _saveReservationCoreToSheet(reservation: ReservationCore, mode: "create" | "update"): {
    newRowData: RawSheetRow;
    headerMap: HeaderMapType;
};
/**
 * 予約を実行します（Phase 8: Core型統一対応）
 *
 * @param {ReservationCore} reservationInfo - 予約作成リクエスト（Core型）。reservationId/statusはundefined可
 * @returns {ApiResponseGeneric<{message: string}>} - 処理結果
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
 * 予約をキャンセルします（Core型オブジェクト中心設計）
 *
 * @param {ReservationCore} cancelInfo - 予約キャンセル情報。`reservationId`と`studentId`は必須。`cancelMessage`は任意。
 * @returns {ApiResponseGeneric<{message: string}>} - 処理結果
 */
export function cancelReservation(cancelInfo: ReservationCore): ApiResponseGeneric<{
    message: string;
}>;
/**
 * キャンセル後の空き連絡希望者への通知機能
 * @param {string} classroom - 教室名
 * @param {string} date - 日付（yyyy-MM-dd形式）
 * @param {ReservationCore} _cancelledReservation - キャンセルされた予約データ（将来の拡張用）
 */
export function notifyAvailabilityToWaitlistedUsers(classroom: string, date: string, _cancelledReservation: ReservationCore): void;
/**
 * 空き通知対象のユーザーリストを取得
 * @param {string} classroom - 教室名
 * @param {string} date - 日付（yyyy-MM-dd形式）
 * @param {string} availabilityType - 空きタイプ ('first', 'second', 'all')
 * @returns {Array<{studentId: string, email: string, realName: string, isFirstTime: boolean}>}
 */
export function getWaitlistedUsersForNotification(classroom: string, date: string, availabilityType: string): Array<{
    studentId: string;
    email: string;
    realName: string;
    isFirstTime: boolean;
}>;
/**
 * 空き通知メールの本文を生成
 * @param {object} recipient - 受信者情報
 * @param {LessonCore} lesson - レッスン情報
 * @returns {string} メール本文
 */
export function createAvailabilityNotificationEmail(recipient: object, lesson: LessonCore): string;
/**
 * 予約の詳細情報を一括で更新します（Core型オブジェクト中心設計）
 *
 * @param {ReservationCore} details - 予約更新リクエスト。`reservationId`と更新したいフィールドのみを持つ部分的な`ReservationCore`オブジェクト。
 * @returns {ApiResponseGeneric<{message: string}>} - 処理結果
 */
export function updateReservationDetails(details: ReservationCore): ApiResponseGeneric<{
    message: string;
}>;
/**
 * [設計思想] フロントエンドは「ユーザーが何を選択したか」という入力情報のみを渡し、
 * バックエンドが料金マスタと照合して金額を再計算・検証する責務を持つ。
 * この関数は、会計処理が完了したReservationCoreオブジェクトを受け取り、永続化する責務を持つ。
 * @param {ReservationCore} reservationWithAccounting - 会計情報が追加/更新された予約オブジェクト。
 * @returns {ApiResponseGeneric<{message: string}>} - 処理結果。
 */
export function saveAccountingDetails(reservationWithAccounting: ReservationCore): ApiResponseGeneric<{
    message: string;
}>;
/**
 * [設計思想] 後続処理でエラーが発生してもメインの会計処理は成功と見なすため、
 * この関数内でのエラーはログに記録するに留め、上位にはスローしない。
 * @private
 * @param {ReservationCore} reservation - 売上ログを生成する対象の予約オブジェクト
 * @param {AccountingDetails} accountingDetails - 計算済みの会計詳細オブジェクト。
 */
export function _logSalesForSingleReservation(reservation: ReservationCore, accountingDetails: AccountingDetails): void;
/**
 * 日程マスタから特定の日付・教室のルールを取得する
 * @param {string} date - 日付 (YYYY-MM-DD)
 * @param {string} classroom - 教室名
 * @returns {ScheduleMasterData | undefined} 日程マスタのルール
 */
export function getScheduleInfoForDate(date: string, classroom: string): ScheduleMasterData | undefined;
/**
 * 空席連絡希望の予約を確定する
 * @param {object} confirmInfo - { reservationId, studentId, messageToTeacher }
 * @returns {ApiResponseGeneric<any>} 処理結果と最新データ
 */
export function confirmWaitlistedReservation(confirmInfo: object): ApiResponseGeneric<any>;
