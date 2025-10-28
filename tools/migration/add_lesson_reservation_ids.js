/**
 * @file add_lesson_reservation_ids.js
 * @description 1回限りのマイグレーションスクリプト。
 * 既存の「日程マスタ」と「予約記録」シートに `lessonId` と `reservationIds` を付与する。
 * GASエディタにコピー＆ペーストして実行することを想定。
 */

/**
 * =================================================================
 * マイグレーション実行関数
 * =================================================================
 * 1. 日程マスタに `lessonId` を追加
 * 2. 予約記録に `lessonId` を追加
 * 3. 日程マスタに `reservationIds` を追加
 */
function runMigrationAddLessonReservationIds() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const scheduleSheet = ss.getSheetByName(CONSTANTS.SHEET_NAMES.SCHEDULE);
  const reservationSheet = ss.getSheetByName(
    CONSTANTS.SHEET_NAMES.RESERVATIONS,
  );

  try {
    // ステップ1: 日程マスタに lessonId を付与
    Logger.log('ステップ1: 日程マスタへの lessonId 付与を開始');
    const scheduleHeader = scheduleSheet
      .getRange(1, 1, 1, scheduleSheet.getLastColumn())
      .getValues()[0];
    const scheduleLessonIdCol =
      scheduleHeader.indexOf(CONSTANTS.HEADERS.SCHEDULE.LESSON_ID) + 1;
    const scheduleDateCol =
      scheduleHeader.indexOf(CONSTANTS.HEADERS.SCHEDULE.DATE) + 1;
    const scheduleClassroomCol =
      scheduleHeader.indexOf(CONSTANTS.HEADERS.SCHEDULE.CLASSROOM) + 1;

    if (scheduleLessonIdCol === 0) {
      throw new Error('日程マスタに「レッスンID」列が見つかりません。');
    }

    const scheduleData = scheduleSheet
      .getRange(
        2,
        1,
        scheduleSheet.getLastRow() - 1,
        scheduleSheet.getLastColumn(),
      )
      .getValues();
    const lessonIdUpdates = [];
    const lessonMap = {}; // { [date_classroom]: lessonId }

    scheduleData.forEach((row, index) => {
      let lessonId = row[scheduleLessonIdCol - 1];
      if (!lessonId) {
        lessonId = Utilities.getUuid();
        lessonIdUpdates.push({
          range: scheduleSheet.getRange(index + 2, scheduleLessonIdCol),
          value: lessonId,
        });
      }
      const date = new Date(row[scheduleDateCol - 1])
        .toISOString()
        .slice(0, 10);
      const classroom = row[scheduleClassroomCol - 1];
      lessonMap[`${date}_${classroom}`] = lessonId;
    });

    lessonIdUpdates.forEach(update => update.range.setValue(update.value));
    Logger.log(
      `ステップ1: 日程マスタに ${lessonIdUpdates.length} 件の lessonId を付与しました。`,
    );

    // ステップ2: 予約記録に lessonId を付与
    Logger.log('ステップ2: 予約記録への lessonId 付与を開始');
    const reservationHeader = reservationSheet
      .getRange(1, 1, 1, reservationSheet.getLastColumn())
      .getValues()[0];
    const reservationLessonIdCol =
      reservationHeader.indexOf(CONSTANTS.HEADERS.RESERVATIONS.LESSON_ID) + 1;
    const reservationDateCol =
      reservationHeader.indexOf(CONSTANTS.HEADERS.RESERVATIONS.DATE) + 1;
    const reservationClassroomCol =
      reservationHeader.indexOf(CONSTANTS.HEADERS.RESERVATIONS.CLASSROOM) + 1;
    const reservationIdCol =
      reservationHeader.indexOf(CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID) +
      1;

    if (reservationLessonIdCol === 0) {
      throw new Error('予約記録に「レッスンID」列が見つかりません。');
    }

    const reservationData = reservationSheet
      .getRange(
        2,
        1,
        reservationSheet.getLastRow() - 1,
        reservationSheet.getLastColumn(),
      )
      .getValues();
    const reservationUpdates = [];
    const lessonToReservationsMap = {}; // { [lessonId]: [reservationId, ...] }

    reservationData.forEach((row, index) => {
      const date = new Date(row[reservationDateCol - 1])
        .toISOString()
        .slice(0, 10);
      const classroom = row[reservationClassroomCol - 1];
      const lessonId = lessonMap[`${date}_${classroom}`];
      const reservationId = row[reservationIdCol - 1];

      if (lessonId) {
        reservationUpdates.push({
          range: reservationSheet.getRange(index + 2, reservationLessonIdCol),
          value: lessonId,
        });

        if (!lessonToReservationsMap[lessonId]) {
          lessonToReservationsMap[lessonId] = [];
        }
        lessonToReservationsMap[lessonId].push(reservationId);
      }
    });

    reservationUpdates.forEach(update => update.range.setValue(update.value));
    Logger.log(
      `ステップ2: 予約記録に ${reservationUpdates.length} 件の lessonId を付与しました。`,
    );

    // ステップ3: 日程マスタに reservationIds を付与
    Logger.log('ステップ3: 日程マスタへの reservationIds 付与を開始');
    // reservationIds 列は存在しない前提で、ヘッダーから探さずに固定の場所に書き込むか、
    // もしくは手動で列を追加してもらう前提とする。今回は手動追加を前提とする。
    const scheduleReservationIdsColName = 'reservationIds'; // 仮の列名
    const scheduleReservationIdsCol =
      scheduleHeader.indexOf(scheduleReservationIdsColName) + 1;
    if (scheduleReservationIdsCol === 0) {
      Logger.log(
        '日程マスタに `reservationIds` 列が見つからないため、スキップします。手動で列を追加してください。',
      );
    } else {
      const reservationIdsUpdates = [];
      scheduleData.forEach((row, index) => {
        const lessonId = row[scheduleLessonIdCol - 1];
        const reservationIds = lessonToReservationsMap[lessonId] || [];
        reservationIdsUpdates.push({
          range: scheduleSheet.getRange(index + 2, scheduleReservationIdsCol),
          value: JSON.stringify(reservationIds), // GASでは配列を直接セルに入れるとCSVになるためJSON文字列化
        });
      });

      reservationIdsUpdates.forEach(update =>
        update.range.setValue(update.value),
      );
      Logger.log(
        `ステップ3: 日程マスタに ${reservationIdsUpdates.length} 件の reservationIds を設定しました。`,
      );
    }
  } catch (e) {
    Logger.log('マイグレーション中にエラーが発生しました: %s', e.stack);
  }
}
