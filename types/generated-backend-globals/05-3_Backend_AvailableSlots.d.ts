/**
 * 開催予定のレッスン情報（空き枠情報を含む）を計算して返す
 * @returns {ApiResponse<LessonCore[]>}
 */
export function getLessons(includePast?: boolean): ApiResponse<LessonCore[]>;
/**
 * 空き枠を計算
 * @param {LessonCore} schedule
 * @param {ReservationCore[]} reservations
 * @returns {{first: number, second: number|undefined, beginner: number|null}}
 */
export function calculateAvailableSlots(schedule: LessonCore, reservations: ReservationCore[]): {
    first: number;
    second: number | undefined;
    beginner: number | null;
};
/**
 * 予約が指定時間枠内にあるか判定
 * @param {ReservationCore} reservation
 * @param {string} slotStart
 * @param {string} slotEnd
 * @returns {boolean}
 */
export function isInTimeSlot(reservation: ReservationCore, slotStart: string, slotEnd: string): boolean;
/**
 * 時刻フォーマット統一
 * @param {string|Date|undefined} time
 * @returns {string|undefined}
 */
export function formatTime(time: string | Date | undefined): string | undefined;
/**
 * 定員パース
 * @param {number|string|undefined} capacity
 * @returns {number}
 */
export function parseCapacity(capacity: number | string | undefined): number;
/**
 * 特定の教室のレッスン情報のみを取得する
 * @param {string} classroom - 教室名
 * @returns {ApiResponse<LessonCore[]>}
 */
export function getLessonsForClassroom(classroom: string): ApiResponse<LessonCore[]>;
/**
 * 特定の生徒の予約データを取得する
 * @param {string} studentId - 生徒ID
 * @returns {ApiResponse<{ myReservations: ReservationCore[] }>}
 */
export function getUserReservations(studentId: string): ApiResponse<{
    myReservations: ReservationCore[];
}>;
