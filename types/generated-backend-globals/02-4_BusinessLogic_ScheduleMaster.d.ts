/**
 * =================================================================
 * 【ファイル名】: 02-4_BusinessLogic_ScheduleMaster.js
 * 【バージョン】: 2.2
 * 【役割】: 日程マスタシートの管理機能
 * =================================================================
 */
/**
 * 全ての開催予定日程を取得する（キャッシュのみ利用）
 * フロントエンドから呼び出されるAPI関数
 * @param {string} fromDate - 取得開始日（YYYY-MM-DD形式）
 * @param {string} toDate - 取得終了日（YYYY-MM-DD形式、オプション）
 * @returns {ScheduleDataArray} 開催日程データの配列
 */
export function getAllScheduledDates(fromDate: string, toDate: string): ScheduleDataArray;
/**
 * キャッシュデータから日付範囲でフィルタリングする
 * @param {ScheduleDataArray} schedules - 日程データ配列
 * @param {string} fromDate - 開始日（YYYY-MM-DD形式）
 * @param {string} toDate - 終了日（YYYY-MM-DD形式、オプション）
 * @returns {ScheduleDataArray} フィルタリングされた日程データ配列
 */
export function filterSchedulesByDateRange(schedules: ScheduleDataArray, fromDate: string, toDate: string): ScheduleDataArray;
