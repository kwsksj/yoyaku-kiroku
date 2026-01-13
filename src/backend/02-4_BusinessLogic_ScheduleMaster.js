/**
 * =================================================================
 * 【ファイル名】  : 02-4_BusinessLogic_ScheduleMaster.js
 * 【モジュール種別】: バックエンド（GAS）
 * 【役割】        : 日程マスタシートをキャッシュ経由で扱い、各種処理に最新スケジュールを供給する。
 *
 * 【主な責務】
 *   - `getAllScheduledDates` でキャッシュから LessonCore 配列を取得・フィルタリング
 *   - 日付範囲指定などのユーティリティを提供し、フロントエンド／他モジュールの実装をシンプルにする
 *   - よやく判定ロジック（`05-2_Backend_Write.js` 等）で再利用される共通データを返す
 *
 * 【関連モジュール】
 *   - `07_CacheManager.js`: MASTER_SCHEDULE_DATA キャッシュを参照
 *   - `05-3_Backend_AvailableSlots.js`: 空き枠計算時の元データとして利用
 *   - `02-5_Notification_StudentSchedule.js`: 定期通知メールで日程情報を列挙
 *
 * 【利用時の留意点】
 *   - キャッシュは Date 型を保持しない場合があるため、本モジュールで Date オブジェクトへ正規化している
 *   - フィルタは文字列（YYYY-MM-DD）基準のため、タイムゾーンが変わる場合は整合を確認する
 * =================================================================
 */

// ================================================================
// 依存モジュール
// ================================================================
import { CACHE_KEYS, getCachedData } from './07_CacheManager.js';

/**
 * 全ての開催予定日程を取得する（キャッシュのみ利用）
 * フロントエンドから呼び出されるAPI関数
 * @param {string} fromDate - 取得開始日（YYYY-MM-DD形式）
 * @param {string} toDate - 取得終了日（YYYY-MM-DD形式、オプション）
 * @returns {LessonCore[]} 開催日程データの配列
 */
export function getAllScheduledDates(fromDate, toDate) {
  try {
    const scheduleCache = getCachedData(CACHE_KEYS.MASTER_SCHEDULE_DATA);
    /** @type {LessonCore[] | null} */
    const scheduleData = scheduleCache?.['schedule']
      ? /** @type {LessonCore[]} */ (scheduleCache['schedule'])
      : null;

    Logger.log(
      `scheduleCache: ${JSON.stringify(scheduleCache ? { version: scheduleCache.version, hasSchedule: !!scheduleData, scheduleLength: scheduleData?.length } : null)}`,
    );

    const cachedSchedules = scheduleData || [];
    Logger.log(
      `キャッシュから日程マスタデータを取得: ${cachedSchedules.length} 件`,
    );

    // キャッシュから取得したデータの日付をDate型に復元
    const schedulesWithDateObjects = cachedSchedules.map(schedule => {
      return {
        ...schedule,
        date:
          schedule.date instanceof Date
            ? schedule.date
            : new Date(schedule.date),
      };
    });

    Logger.log(
      `=== 日付フィルタリング: fromDate=${fromDate}, toDate=${toDate} ===`,
    );
    const filtered = filterSchedulesByDateRange(
      schedulesWithDateObjects,
      fromDate,
      toDate,
    );
    Logger.log(`=== フィルタリング結果: ${filtered.length} 件 ===`);
    return filtered;
  } catch (error) {
    Logger.log(`getAllScheduledDates エラー: ${error.message}`);
    // エラーが発生した場合は、フロントエンドに空の配列を返す
    return [];
  }
}

/**
 * キャッシュデータから日付範囲でフィルタリングする
 * @param {LessonCore[]} schedules - 日程データ配列
 * @param {string} fromDate - 開始日（YYYY-MM-DD形式）
 * @param {string} toDate - 終了日（YYYY-MM-DD形式、オプション）
 * @returns {LessonCore[]} フィルタリングされた日程データ配列
 */
export function filterSchedulesByDateRange(schedules, fromDate, toDate) {
  if (!schedules || schedules.length === 0) {
    return [];
  }

  const fromDateTime = fromDate ? new Date(fromDate).getTime() : 0;
  const toDateTime = toDate
    ? new Date(toDate).getTime()
    : Number.MAX_SAFE_INTEGER;

  const results = [];
  for (let i = 0; i < schedules.length; i++) {
    const schedule = schedules[i];
    // 日程マスタの日付はキャッシュ構築時にDate型で正規化済み
    const scheduleDate = schedule.date;
    const dateTime =
      scheduleDate instanceof Date
        ? scheduleDate.getTime()
        : new Date(scheduleDate).getTime();
    const isInRange = dateTime >= fromDateTime && dateTime <= toDateTime;

    if (i < 3) {
      // 最初の3件のデバッグ情報
      Logger.log(
        `=== schedule[${i}]: date=${schedule.date}, scheduleDate=${scheduleDate}, dateTime=${dateTime}, fromDateTime=${fromDateTime}, toDateTime=${toDateTime}, inRange=${isInRange} ===`,
      );
    }

    if (isInRange) {
      results.push(schedule);
    }
  }

  return results;
}
