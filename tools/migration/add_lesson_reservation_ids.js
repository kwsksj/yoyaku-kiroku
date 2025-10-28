/**
 * @file add_lesson_reservation_ids.js
 * @description 【統合版】レッスン・予約ID関連のデータ整合性スクリプト
 *
 * このスクリプトは、以下の処理をまとめて実行します。
 * 1. 日程マスタの各レッスンに `lessonId` がなければ自動採番します。
 * 2. 予約記録の各予約に、対応する `lessonId` を設定します。
 * 3. 日程マスタの各レッスンに、関連する予約IDのリスト `reservationIds` を設定します。
 *
 * 何度実行しても問題ないように設計されています（冪等性）。
 * GASエディタから直接実行することを想定。
 */

function runUnifiedIdMigration() {
  try {
    Logger.log(
      'レッスンと予約のID関連付けを更新します。処理には数分かかる場合があります。',
    );

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const scheduleSheet = ss.getSheetByName(CONSTANTS.SHEET_NAMES.SCHEDULE);
    const reservationSheet = ss.getSheetByName(
      CONSTANTS.SHEET_NAMES.RESERVATIONS,
    );

    if (!scheduleSheet || !reservationSheet) {
      throw new Error(
        '必要なシート（日程マスタ or 予約記録）が見つかりません。',
      );
    }

    // --- 1. ヘッダー情報の取得と検証 ---
    const scheduleHeader = scheduleSheet
      .getRange(1, 1, 1, scheduleSheet.getLastColumn())
      .getValues()[0];
    const schLessonIdCol = scheduleHeader.indexOf(
      CONSTANTS.HEADERS.SCHEDULE.LESSON_ID,
    );
    const schDateCol = scheduleHeader.indexOf(CONSTANTS.HEADERS.SCHEDULE.DATE);
    const schClassroomCol = scheduleHeader.indexOf(
      CONSTANTS.HEADERS.SCHEDULE.CLASSROOM,
    );
    const schReservationIdsCol = scheduleHeader.indexOf(
      CONSTANTS.HEADERS.SCHEDULE.RESERVATION_IDS,
    );

    const reservationHeader = reservationSheet
      .getRange(1, 1, 1, reservationSheet.getLastColumn())
      .getValues()[0];
    const resLessonIdCol = reservationHeader.indexOf(
      CONSTANTS.HEADERS.RESERVATIONS.LESSON_ID,
    );
    const resReservationIdCol = reservationHeader.indexOf(
      CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID,
    );
    const resDateCol = reservationHeader.indexOf(
      CONSTANTS.HEADERS.RESERVATIONS.DATE,
    );
    const resClassroomCol = reservationHeader.indexOf(
      CONSTANTS.HEADERS.RESERVATIONS.CLASSROOM,
    );
    const resStatusCol = reservationHeader.indexOf(
      CONSTANTS.HEADERS.RESERVATIONS.STATUS,
    );

    if (
      [
        schLessonIdCol,
        schDateCol,
        schClassroomCol,
        schReservationIdsCol,
        resLessonIdCol,
        resReservationIdCol,
        resDateCol,
        resClassroomCol,
        resStatusCol,
      ].includes(-1)
    ) {
      throw new Error(
        '必要な列が見つかりません。シートのヘッダー名を確認してください。',
      );
    }

    const scheduleData =
      scheduleSheet.getLastRow() > 1
        ? scheduleSheet
            .getRange(
              2,
              1,
              scheduleSheet.getLastRow() - 1,
              scheduleSheet.getLastColumn(),
            )
            .getValues()
        : [];
    const reservationData =
      reservationSheet.getLastRow() > 1
        ? reservationSheet
            .getRange(
              2,
              1,
              reservationSheet.getLastRow() - 1,
              reservationSheet.getLastColumn(),
            )
            .getValues()
        : [];

    // --- 2. 日程マスタの lessonId を確認・採番 ---
    Logger.log('ステップ1: 日程マスタのlessonIdを確認・採番します...');
    const lessonDateClassroomMap = new Map(); // key: 'YYYY-MM-DD_教室名', value: lessonId
    const lessonIdUpdates = [];
    for (let i = 0; i < scheduleData.length; i++) {
      const row = scheduleData[i];
      let lessonId = row[schLessonIdCol];
      if (!lessonId) {
        lessonId = Utilities.getUuid();
        row[schLessonIdCol] = lessonId; // 後続処理のためにメモリ上のデータも更新
        lessonIdUpdates.push({
          row: i + 2,
          col: schLessonIdCol + 1,
          value: lessonId,
        });
      }
      const date = Utilities.formatDate(
        new Date(row[schDateCol]),
        CONSTANTS.TIMEZONE,
        'yyyy-MM-dd',
      );
      const classroom = row[schClassroomCol];
      lessonDateClassroomMap.set(`${date}_${classroom}`, lessonId);
    }
    if (lessonIdUpdates.length > 0) {
      const ranges = lessonIdUpdates.map(u => `R${u.row}C${u.col}`);
      scheduleSheet
        .getRangeList(ranges)
        .getRanges()
        .forEach((range, i) => range.setValue(lessonIdUpdates[i].value));
      Logger.log(
        `${lessonIdUpdates.length}件のレッスンに新しいIDを付与しました。`,
      );
    } else {
      Logger.log('日程マスタの全レッスンにIDは設定済みです。');
    }

    // --- 3. 予約記録の lessonId を確認・設定 ---
    Logger.log('ステップ2: 予約記録のlessonIdを確認・設定します...');
    const reservationLessonIdUpdates = [];
    const lessonToReservationsMap = new Map(); // key: lessonId, value: [reservationId, ...]
    for (let i = 0; i < reservationData.length; i++) {
      const row = reservationData[i];
      const date = Utilities.formatDate(
        new Date(row[resDateCol]),
        CONSTANTS.TIMEZONE,
        'yyyy-MM-dd',
      );
      const classroom = row[resClassroomCol];
      const expectedLessonId = lessonDateClassroomMap.get(
        `${date}_${classroom}`,
      );

      if (expectedLessonId && row[resLessonIdCol] !== expectedLessonId) {
        reservationLessonIdUpdates.push({
          row: i + 2,
          col: resLessonIdCol + 1,
          value: expectedLessonId,
        });
      }

      // reservationIdsマップを作成
      const status = row[resStatusCol];
      if (expectedLessonId && status !== CONSTANTS.STATUS.CANCELED) {
        const reservationId = row[resReservationIdCol];
        if (!lessonToReservationsMap.has(expectedLessonId)) {
          lessonToReservationsMap.set(expectedLessonId, []);
        }
        lessonToReservationsMap.get(expectedLessonId).push(reservationId);
      }
    }
    if (reservationLessonIdUpdates.length > 0) {
      const ranges = reservationLessonIdUpdates.map(u => `R${u.row}C${u.col}`);
      reservationSheet
        .getRangeList(ranges)
        .getRanges()
        .forEach((range, i) =>
          range.setValue(reservationLessonIdUpdates[i].value),
        );
      Logger.log(
        `${reservationLessonIdUpdates.length}件の予約に正しいlessonIdを設定しました。`,
      );
    } else {
      Logger.log('予約記録のlessonIdはすべて最新の状態です。');
    }

    // --- 4. 日程マスタの reservationIds を更新 ---
    Logger.log('ステップ3: 日程マスタのreservationIdsを更新します...');
    const scheduleReservationIdsUpdates = [];
    for (let i = 0; i < scheduleData.length; i++) {
      const row = scheduleData[i];
      const lessonId = row[schLessonIdCol];
      if (lessonId) {
        const newReservationIds = lessonToReservationsMap.get(lessonId) || [];
        const currentReservationIdsStr = row[schReservationIdsCol] || '[]';

        const newIdsSortedStr = JSON.stringify(newReservationIds.sort());
        const currentIdsSortedStr = JSON.stringify(
          JSON.parse(currentReservationIdsStr).sort(),
        );

        if (newIdsSortedStr !== currentIdsSortedStr) {
          scheduleReservationIdsUpdates.push({
            row: i + 2,
            col: schReservationIdsCol + 1,
            value: JSON.stringify(newReservationIds),
          });
        }
      }
    }
    if (scheduleReservationIdsUpdates.length > 0) {
      const ranges = scheduleReservationIdsUpdates.map(
        u => `R${u.row}C${u.col}`,
      );
      scheduleSheet
        .getRangeList(ranges)
        .getRanges()
        .forEach((range, i) =>
          range.setValue(scheduleReservationIdsUpdates[i].value),
        );
      Logger.log(
        `${scheduleReservationIdsUpdates.length}件の日程のreservationIdsを更新しました。`,
      );
    } else {
      Logger.log('日程マスタのreservationIdsはすべて最新の状態です。');
    }

    const totalUpdates =
      lessonIdUpdates.length +
      reservationLessonIdUpdates.length +
      scheduleReservationIdsUpdates.length;
    if (totalUpdates > 0) {
      Logger.log(
        `処理が完了しました.\n- 新規レッスンID採番: ${lessonIdUpdates.length}件\n- 予約のレッスンID更新: ${reservationLessonIdUpdates.length}件\n- 予約リスト更新: ${scheduleReservationIdsUpdates.length}件`,
      );
    } else {
      Logger.log('すべてのデータは最新の状態です。更新は不要でした。');
    }
  } catch (e) {
    Logger.log(`エラーが発生しました: ${e.stack}`);
  }
}
