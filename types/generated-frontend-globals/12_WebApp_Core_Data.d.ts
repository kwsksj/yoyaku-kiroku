/**
 * シンプルなダッシュボード状態を構築する（簡素化版）
 * @param {any} currentUser - 軽量認証から取得したユーザー情報
 * @param {ReservationCore[]} myReservations - 個人のよやくデータ
 * @returns {Partial<UIState>} シンプルなダッシュボード状態
 */
export function createSimpleDashboardState(currentUser: any, myReservations: ReservationCore[]): Partial<UIState>;
/**
 * 会計システムの事前初期化（アプリ起動時）
 * 全教室分の会計データを分類してキャッシュし、会計画面への高速遷移を実現
 * @param {Array<any>} accountingMaster - 会計マスタデータ
 */
export function preInitializeAccountingSystem(accountingMaster: Array<any>): void;
/**
 * 日程マスタから教室形式を取得します
 * @param {ScheduleInfo} scheduleData - 日程マスタのデータオブジェクト
 * @returns {string | null} 教室形式 ('時間制' | '回数制' | '材料制') またはnull
 */
export function getClassroomTypeFromSchedule(scheduleData: ScheduleInfo): string | null;
/**
 * 教室形式が時間制かどうかを判定します
 * @param {ScheduleInfo} scheduleData - 日程マスタのデータオブジェクト
 * @returns {boolean} 時間制の場合true
 */
export function isTimeBasedClassroom(scheduleData: ScheduleInfo): boolean;
/**
 * バックエンドから特定の日程マスタ情報を取得
 * @param {string} date - 日付 (YYYY-MM-DD)
 * @param {string} classroom - 教室名
 * @returns {Promise<ScheduleInfo | null>} 日程マスタ情報またはnull
 */
export function getScheduleInfoFromCache(date: string, classroom: string): Promise<ScheduleInfo | null>;
/**
 * よやくデータから対応する日程マスタ情報を取得
 * @param {ReservationCore} reservation - よやくデータ (date, classroom を含む)
 * @returns {ScheduleInfo | null} 日程マスタ情報またはnull (lessons経由の場合)
 */
export function getScheduleDataFromLessons(reservation: ReservationCore): ScheduleInfo | null;
export function detectEnvironment(): string;
export function getEnvironmentData(dataType: string, fallback?: unknown): unknown;
