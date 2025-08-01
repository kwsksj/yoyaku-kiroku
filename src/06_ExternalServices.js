/**
 * =================================================================
 * 【ファイル名】: 06_ExternalServices.gs
 * 【バージョン】: 2.4
 * 【役割】: GoogleフォームやGoogleカレンダーといった、スプレッドシートの
 * 「外」にあるGoogleサービスとの連携に特化した機能。
 * 【v2.4 での変更点】
 * - createStringArrayFromCounts内の不要な空席数再計算ロジックを削除。
 * - サマリーシートから取得した値を直接信頼するよう修正。
 * =================================================================
 */

/**
 * Googleフォームの予約選択肢を、現在の予約状況に基づいて更新します。
 * @param {string} classroomName - 更新対象の教室名
 */
function setCheckboxChoices(classroomName) {
  const formId = GOOGLE_FORM_IDS[classroomName];
  const questionTitle = FORM_QUESTION_TITLES[classroomName];

  if (!formId) return;
  if (!questionTitle) return;

  try {
    const form = FormApp.openById(formId);
    const choices = createStringArrayFromCounts(classroomName);
    if (choices.length > 0) {
      const item = form
        .getItems(FormApp.ItemType.CHECKBOX)
        .find(i => i.getTitle() === questionTitle);
      if (item) {
        item.asCheckboxItem().setChoices(choices.map(c => item.asCheckboxItem().createChoice(c)));
      }
    }
  } catch (e) {
    logActivity(
      'system',
      'フォーム選択肢更新',
      'エラー',
      `教室: ${classroomName}, エラー: ${e.message}`,
    );
    Logger.log(`フォーム連携でエラー: ${e.message}`);
  }
}

/**
 * フォーム選択肢用の文字列配列を、新しい定員管理ロジックに基づいて生成します。
 * @param {string} classroomName - 選択肢を生成する対象の教室名
 * @returns {string[]} - Googleフォームの選択肢として表示する文字列の配列
 */
function createStringArrayFromCounts(classroomName) {
  const ss = getActiveSpreadsheet();
  const summarySheet = ss.getSheetByName(SUMMARY_SHEET_NAME);
  if (!summarySheet || summarySheet.getLastRow() < 2) {
    return [];
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const timezone = getSpreadsheetTimezone();
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

  const summaryData = summarySheet
    .getRange(2, 1, summarySheet.getLastRow() - 1, summarySheet.getLastColumn())
    .getValues();
  const headerMap = createHeaderMap(
    summarySheet.getRange(1, 1, 1, summarySheet.getLastColumn()).getValues()[0],
  );

  const dateIdx = headerMap.get(HEADER_DATE);
  const classroomIdx = headerMap.get(HEADER_SUMMARY_CLASSROOM);
  const sessionIdx = headerMap.get(HEADER_SUMMARY_SESSION);
  const availableIdx = headerMap.get(HEADER_SUMMARY_AVAILABLE_COUNT);
  const venueIdx = headerMap.get(HEADER_SUMMARY_VENUE);

  const choiceData = summaryData
    .filter(row => {
      const classroom = row[classroomIdx];
      const session = row[sessionIdx];
      const date = row[dateIdx];
      // フィルタリング条件: 指定された教室で、未来の日付の「初回講習」セッションのみ
      return (
        classroom === classroomName &&
        session === ITEM_NAME_FIRST_LECTURE &&
        date instanceof Date &&
        date >= today
      );
    })
    .map(row => ({
      dateObj: row[dateIdx],
      venue: row[venueIdx] || '',
      available: row[availableIdx],
    }))
    .sort((a, b) => a.dateObj - b.dateObj);

  const resultArray = [];
  let currentMonth = null;

  choiceData.forEach(data => {
    const month = data.dateObj.getMonth() + 1;
    if (currentMonth !== month) {
      resultArray.push(`-- ${month}月 --`);
      currentMonth = month;
    }
    const dateStr = `${data.dateObj.getMonth() + 1}/${data.dateObj.getDate()}(${weekdays[data.dateObj.getDay()]})`;
    const availabilityLabel = data.available > 0 ? `空き ${data.available} 席` : 'キャンセル待ち';
    const label = `${dateStr} ${data.venue}    ${availabilityLabel}`;
    resultArray.push(label);
  });

  return resultArray;
}

/**
 * Googleカレンダーから予定を取得し、各教室の予約シートに新しい日付の予約枠を追加します。
 */
function addCalendarEventsToSheetWithSpecifics() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_TIME_MS)) {
    try {
      handleError('現在、他の処理が実行中です。しばらく経ってから再度お試しください。', true);
    } catch (e) {
      Logger.log('現在、他の処理が実行中です。');
    }
    return;
  }
  try {
    const CLASSROOM_SETTINGS = [
      {
        sheetName: TOKYO_CLASSROOM_NAME,
        calendarId: CALENDAR_IDS[TOKYO_CLASSROOM_NAME],
        includeEventTitle: true,
      },
      {
        sheetName: NUMAZU_CLASSROOM_NAME,
        calendarId: CALENDAR_IDS[NUMAZU_CLASSROOM_NAME],
        includeEventTitle: false,
      },
      {
        sheetName: TSUKUBA_CLASSROOM_NAME,
        calendarId: CALENDAR_IDS[TSUKUBA_CLASSROOM_NAME],
        includeEventTitle: false,
      },
    ];

    const ss = SpreadsheetApp.openById(RESERVATION_SPREADSHEET_ID);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const oneYearLater = new Date();
    oneYearLater.setFullYear(tomorrow.getFullYear() + 1);

    Logger.log(
      `カレンダーから予定を取得する期間: ${Utilities.formatDate(tomorrow, Session.getScriptTimeZone(), 'yyyy/MM/dd')} から ${Utilities.formatDate(oneYearLater, Session.getScriptTimeZone(), 'yyyy/MM/dd')} まで`,
    );

    CLASSROOM_SETTINGS.forEach(setting => {
      const { sheetName, calendarId, includeEventTitle } = setting;
      Logger.log(`\n--- 処理開始: シート "${sheetName}" / カレンダー "${calendarId}" ---`);

      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        Logger.log(
          `エラー: シート "${sheetName}" が見つかりません。この教室の処理をスキップします。`,
        );
        return;
      }

      const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const headerMap = createHeaderMap(header);
      const reservationIdColIdx = headerMap.get(HEADER_RESERVATION_ID);
      const dateColIdx = headerMap.get(HEADER_DATE);
      const venueColIdx = headerMap.get(HEADER_VENUE);

      if (!calendarId) {
        Logger.log(
          `エラー: シート "${sheetName}" のカレンダーIDが設定されていません。スキップします。`,
        );
        return;
      }
      const calendar = CalendarApp.getCalendarById(calendarId);
      if (!calendar) {
        Logger.log(
          `エラー: カレンダー "${calendarId}" が見つかりません。この教室の処理をスキップします。`,
        );
        return;
      }

      const events = calendar.getEvents(tomorrow, oneYearLater);
      if (events.length === 0) {
        Logger.log(`シート "${sheetName}" の指定期間内に予定が見つかりませんでした。`);
        return;
      }

      events.sort((a, b) => a.getStartTime().getTime() - b.getStartTime().getTime());

      const existingDates = new Set();
      if (sheet.getLastRow() > 1) {
        const datesInSheet = sheet
          .getRange(2, dateColIdx + 1, sheet.getLastRow() - 1, 1)
          .getValues();
        datesInSheet.forEach(row => {
          if (row[0] instanceof Date) {
            existingDates.add(
              Utilities.formatDate(row[0], Session.getScriptTimeZone(), 'yyyy-MM-dd'),
            );
          }
        });
      }

      const newRows = [];
      events.forEach(event => {
        const eventTitle = event.getTitle();
        let currentDay = new Date(event.getStartTime());
        currentDay.setHours(0, 0, 0, 0);
        let effectiveEndDate = new Date(event.getEndTime());
        effectiveEndDate.setHours(0, 0, 0, 0);

        if (event.isAllDayEvent()) {
          effectiveEndDate.setDate(effectiveEndDate.getDate() - 1);
        } else {
          const normalizedStartTime = new Date(event.getStartTime());
          normalizedStartTime.setHours(0, 0, 0, 0);
          if (
            event.getEndTime().getHours() === 0 &&
            event.getEndTime().getMinutes() === 0 &&
            event.getEndTime().getSeconds() === 0 &&
            event.getEndTime().getMilliseconds() === 0 &&
            normalizedStartTime.getTime() !== effectiveEndDate.getTime()
          ) {
            effectiveEndDate.setDate(effectiveEndDate.getDate() - 1);
          }
        }

        if (effectiveEndDate.getTime() < currentDay.getTime()) {
          effectiveEndDate = new Date(currentDay);
        }

        while (currentDay.getTime() <= effectiveEndDate.getTime()) {
          const dateForComparison = Utilities.formatDate(
            currentDay,
            Session.getScriptTimeZone(),
            'yyyy-MM-dd',
          );
          if (!existingDates.has(dateForComparison)) {
            const capacity = CLASSROOM_CAPACITIES[sheetName] || 8;
            for (let i = 0; i < capacity; i++) {
              const rowData = new Array(header.length).fill('');
              rowData[reservationIdColIdx] = Utilities.getUuid();
              rowData[dateColIdx] = new Date(currentDay);
              if (includeEventTitle && venueColIdx !== undefined) {
                rowData[venueColIdx] = eventTitle;
              }
              newRows.push(rowData);
            }
            existingDates.add(dateForComparison);
          }
          currentDay.setDate(currentDay.getDate() + 1);
        }
      });

      if (newRows.length > 0) {
        sheet
          .getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length)
          .setValues(newRows);
        Logger.log(`シート "${sheetName}" に ${newRows.length} 行を追加しました。`);
        logActivity(
          'system',
          'カレンダー同期',
          '成功',
          `シート: ${sheetName}, 追加件数: ${newRows.length}`,
        );
      }
    });

    handleError('全てのカレンダーとシートの処理が完了しました。', false);
    sendAdminNotification(
      'カレンダー連携 完了',
      'カレンダー連携処理が完了しました。スプレッドシートを確認してください。',
    );
  } catch (err) {
    handleError(`カレンダーからの予定追加中にエラーが発生しました。\n詳細: ${err.message}`, true);
  } finally {
    lock.releaseLock();
  }
}
