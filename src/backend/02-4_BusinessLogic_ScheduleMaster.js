/// <reference path="../../types/gas-environment.d.ts" />

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
function getAllScheduledDates(fromDate, toDate) {
  try {
    const scheduleCache = getCachedData(CACHE_KEYS.MASTER_SCHEDULE_DATA);
    /** @type {ScheduleMasterData[] | null} */
    const scheduleData = scheduleCache?.['schedule']
      ? /** @type {ScheduleMasterData[]} */ (scheduleCache['schedule'])
      : null;

    Logger.log(
      `scheduleCache: ${JSON.stringify(scheduleCache ? { version: scheduleCache.version, hasSchedule: !!scheduleData, scheduleLength: scheduleData?.length } : null)}`,
    );

    const cachedSchedules = scheduleData || [];
    Logger.log(
      `キャッシュから日程マスタデータを取得: ${cachedSchedules.length} 件`,
    );
    Logger.log(
      `=== 日付フィルタリング: fromDate=${fromDate}, toDate=${toDate} ===`,
    );
    const filtered = filterSchedulesByDateRange(
      cachedSchedules,
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
 * @param {ScheduleDataArray} schedules - 日程データ配列
 * @param {string} fromDate - 開始日（YYYY-MM-DD形式）
 * @param {string} toDate - 終了日（YYYY-MM-DD形式、オプション）
 * @returns {ScheduleDataArray} フィルタリングされた日程データ配列
 */
function filterSchedulesByDateRange(schedules, fromDate, toDate) {
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
    const scheduleDate =
      schedule.date instanceof Date ? schedule.date : new Date(schedule.date);
    const dateTime = scheduleDate.getTime();
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
