/**
 * =================================================================
 * 【ファイル名】: 05-1_Backend_Read.gs
 * 【バージョン】: 1.1
 * 【役割】: WebAppからのデータ取得要求（Read）に特化したバックエンド機能。
 * - 予約枠、ユーザー自身の予約、会計マスタ、参加履歴などの読み取り処理を担当します。
 * 【構成】: 14ファイル構成のうちの6番目
 * 【v1.1での変更点】:
 * - getParticipationHistory関数にvenueフィールドを追加。
 * - 履歴データで会場情報も表示されるよう改善。
 * =================================================================
 */

/**
 * WebAppに必要な予約枠と自分の予約情報を取得します。
 * @param {string} studentId - ログインしたユーザーの生徒ID
 * @returns {object} { success: boolean, availableSlots: Array, myBookings: Array, message?: string }
 */
function getSlotsAndMyBookings(studentId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const timezone = ss.getSpreadsheetTimeZone();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. サマリーシートから未来の予約枠情報を全て取得
    const summarySheet = ss.getSheetByName(SUMMARY_SHEET_NAME);
    let allSlots = [];
    if (summarySheet && summarySheet.getLastRow() > 1) {
      const summaryData = summarySheet
        .getRange(2, 1, summarySheet.getLastRow() - 1, summarySheet.getLastColumn())
        .getValues();
      const summaryHeader = summarySheet
        .getRange(1, 1, 1, summarySheet.getLastColumn())
        .getValues()[0];
      const summaryHeaderMap = createHeaderMap(summaryHeader);

      const dateIdx = summaryHeaderMap.get(HEADER_DATE);
      const classroomIdx = summaryHeaderMap.get(HEADER_SUMMARY_CLASSROOM);
      const sessionIdx = summaryHeaderMap.get(HEADER_SUMMARY_SESSION);
      const availableIdx = summaryHeaderMap.get(HEADER_SUMMARY_AVAILABLE_COUNT);
      const venueIdx = summaryHeaderMap.get(HEADER_SUMMARY_VENUE);

      const allSummarySlots = summaryData
        .map((row) => {
          const date = row[dateIdx];
          if (!(date instanceof Date) || date < today) return null;

          return {
            classroom: row[classroomIdx],
            session: row[sessionIdx],
            date: Utilities.formatDate(date, timezone, 'yyyy-MM-dd'),
            availableSlots: row[availableIdx],
            isFull: row[availableIdx] <= 0,
            venue: row[venueIdx] || '',
          };
        })
        .filter((s) => s !== null);

      const mainLectureKeys = new Set();
      allSummarySlots.forEach((slot) => {
        if (slot.session === '本講座') {
          mainLectureKeys.add(`${slot.date}_${slot.classroom}`);
        }
      });

      const filteredSlots = allSummarySlots.filter((slot) => {
        if (slot.session === '初回講習') {
          const key = `${slot.date}_${slot.classroom}`;
          return !mainLectureKeys.has(key);
        }
        return true;
      });

      const combinedSlots = {};
      filteredSlots.forEach((slot) => {
        const key = `${slot.date}_${slot.classroom}`;
        if (!combinedSlots[key]) {
          combinedSlots[key] = {
            classroom: slot.classroom,
            date: slot.date,
            venue: slot.venue,
          };
        }

        if (slot.session === SESSION_MORNING) {
          combinedSlots[key].morningSlots = slot.availableSlots;
        } else if (slot.session === SESSION_AFTERNOON) {
          combinedSlots[key].afternoonSlots = slot.availableSlots;
        } else {
          combinedSlots[key].availableSlots = slot.availableSlots;
          combinedSlots[key].isFull = slot.isFull;
        }
      });

      Object.values(combinedSlots).forEach((slot) => {
        if (typeof slot.morningSlots !== 'undefined') {
          slot.isFull = (slot.morningSlots || 0) <= 0 && (slot.afternoonSlots || 0) <= 0;
        }
      });

      allSlots = Object.values(combinedSlots);
    }

    // 2. 自分の予約情報のみ、各予約シートから取得
    const myBookings = [];
    CLASSROOM_SHEET_NAMES.forEach((sheetName) => {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet || sheet.getLastRow() < 2) return;
      const data = sheet.getDataRange().getValues();
      const header = data.shift();
      const headerMap = createHeaderMap(header);

      const timeToString = (date) =>
        date instanceof Date ? Utilities.formatDate(date, timezone, 'HH:mm') : null;

      data.forEach((row) => {
        const studentIdInRow = row[headerMap.get(HEADER_STUDENT_ID)];
        if (studentIdInRow !== studentId) return;

        const date = row[headerMap.get(HEADER_DATE)];
        const status = String(row[headerMap.get(HEADER_PARTICIPANT_COUNT)]).toLowerCase();
        if (!(date instanceof Date) || date < today || status === STATUS_CANCEL) return;

        myBookings.push({
          reservationId: row[headerMap.get(HEADER_RESERVATION_ID)],
          classroom: sheetName,
          date: Utilities.formatDate(date, timezone, 'yyyy-MM-dd'),
          isWaiting: status === STATUS_WAITING,
          venue: row[headerMap.get(HEADER_VENUE)] || '',
          startTime: timeToString(row[headerMap.get(HEADER_START_TIME)]),
          endTime: timeToString(row[headerMap.get(HEADER_END_TIME)]),
          earlyArrival: row[headerMap.get(HEADER_EARLY_ARRIVAL)] === true,
          firstLecture: row[headerMap.get(HEADER_FIRST_LECTURE)] === true,
          workInProgress: row[headerMap.get(HEADER_WORK_IN_PROGRESS)] || '',
          order: row[headerMap.get(HEADER_ORDER)] || '',
          accountingDone: !!row[headerMap.get(HEADER_ACCOUNTING_DETAILS)],
          accountingDetails: row[headerMap.get(HEADER_ACCOUNTING_DETAILS)] || '',
        });
      });
    });

    const sortedSlots = allSlots.sort(
      (a, b) => new Date(a.date) - new Date(b.date) || a.classroom.localeCompare(b.classroom),
    );
    const sortedBookings = myBookings.sort((a, b) => new Date(a.date) - new Date(b.date));

    return {
      success: true,
      availableSlots: sortedSlots,
      myBookings: sortedBookings,
    };
  } catch (err) {
    Logger.log(`getSlotsAndMyBookings Error: ${err.message}\n${err.stack}`);
    return {
      success: false,
      message: `予約情報の取得中にエラーが発生しました。`,
    };
  }
}

/**
 * 【旧・詳細取得】会計画面に表示する詳細情報を取得します。
 * @param {object} params - { reservationId: string, classroom: string }
 * @returns {object} - { success: boolean, details: object }
 */
function getReservationDetails(params) {
  try {
    const { reservationId, classroom } = params;
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(classroom);
    if (!sheet) throw new Error(`予約シート「${classroom}」が見つかりません。`);

    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headerMap = createHeaderMap(header);

    const targetRowIndex = findRowIndexByValue(
      sheet,
      headerMap.get(HEADER_RESERVATION_ID) + 1,
      reservationId,
    );
    if (targetRowIndex === -1)
      throw new Error(`予約ID「${reservationId}」が見つかりませんでした。`);

    const rowData = sheet.getRange(targetRowIndex, 1, 1, header.length).getValues()[0];
    const timezone = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();

    const details = {
      firstLecture: headerMap.has(HEADER_FIRST_LECTURE)
        ? rowData[headerMap.get(HEADER_FIRST_LECTURE)] === true
        : false,
      earlyArrival: headerMap.has(HEADER_EARLY_ARRIVAL)
        ? rowData[headerMap.get(HEADER_EARLY_ARRIVAL)] === true
        : false,
      chiselRental: headerMap.has(HEADER_CHISEL_RENTAL)
        ? rowData[headerMap.get(HEADER_CHISEL_RENTAL)] === true
        : false,
      startTime:
        headerMap.has(HEADER_START_TIME) &&
        rowData[headerMap.get(HEADER_START_TIME)] instanceof Date
          ? Utilities.formatDate(rowData[headerMap.get(HEADER_START_TIME)], timezone, 'HH:mm')
          : null,
      endTime:
        headerMap.has(HEADER_END_TIME) && rowData[headerMap.get(HEADER_END_TIME)] instanceof Date
          ? Utilities.formatDate(rowData[headerMap.get(HEADER_END_TIME)], timezone, 'HH:mm')
          : null,
    };

    return { success: true, details: details };
  } catch (err) {
    Logger.log(`getReservationDetails Error: ${err.message}\n${err.stack}`);
    return {
      success: false,
      message: `予約詳細情報の取得中にエラーが発生しました。`,
    };
  }
}

/**
 * 【新・詳細取得】予約編集画面に必要な、予約の全詳細情報を取得します。
 * @param {string} reservationId - 予約ID。
 * @param {string} classroom - 教室名。
 * @returns {object} - { success: boolean, details: object }
 */
function getReservationDetailsForEdit(reservationId, classroom) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(classroom);
    if (!sheet) throw new Error(`予約シート「${classroom}」が見つかりません。`);

    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headerMap = createHeaderMap(header);
    const timezone = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();

    const reservationIdColIdx = headerMap.get(HEADER_RESERVATION_ID);
    if (reservationIdColIdx === undefined) throw new Error('ヘッダー「予約ID」が見つかりません。');

    const targetRowIndex = findRowIndexByValue(sheet, reservationIdColIdx + 1, reservationId);
    if (targetRowIndex === -1)
      throw new Error(`予約ID「${reservationId}」が見つかりませんでした。`);

    const row = sheet.getRange(targetRowIndex, 1, 1, header.length).getValues()[0];

    const timeToString = (date) =>
      date instanceof Date ? Utilities.formatDate(date, timezone, 'HH:mm') : '';

    const details = {
      reservationId: reservationId,
      classroom: classroom,
      date:
        headerMap.has(HEADER_DATE) && row[headerMap.get(HEADER_DATE)] instanceof Date
          ? Utilities.formatDate(row[headerMap.get(HEADER_DATE)], timezone, 'yyyy-MM-dd')
          : '',
      venue: headerMap.has(HEADER_VENUE) ? row[headerMap.get(HEADER_VENUE)] : '',
      earlyArrival: headerMap.has(HEADER_EARLY_ARRIVAL)
        ? row[headerMap.get(HEADER_EARLY_ARRIVAL)] === true
        : false,
      chiselRental: headerMap.has(HEADER_CHISEL_RENTAL)
        ? row[headerMap.get(HEADER_CHISEL_RENTAL)] === true
        : false,
      startTime: headerMap.has(HEADER_START_TIME)
        ? timeToString(row[headerMap.get(HEADER_START_TIME)])
        : '',
      endTime: headerMap.has(HEADER_END_TIME)
        ? timeToString(row[headerMap.get(HEADER_END_TIME)])
        : '',
      workInProgress: headerMap.has(HEADER_WORK_IN_PROGRESS)
        ? row[headerMap.get(HEADER_WORK_IN_PROGRESS)]
        : '',
      order: headerMap.has(HEADER_ORDER) ? row[headerMap.get(HEADER_ORDER)] : '',
      messageToTeacher: headerMap.has(HEADER_MESSAGE_TO_TEACHER)
        ? row[headerMap.get(HEADER_MESSAGE_TO_TEACHER)]
        : '',
    };

    return { success: true, details: details };
  } catch (err) {
    Logger.log(`getReservationDetailsForEdit Error: ${err.message}\n${err.stack}`);
    return {
      success: false,
      message: `予約詳細の取得中にエラーが発生しました。`,
    };
  }
}

/**
 * 料金・商品マスタのデータを取得します。
 * @returns {object} - { success: boolean, data: object[] }
 */
function getAccountingMasterData() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
      ACCOUNTING_MASTER_SHEET_NAME,
    );
    if (!sheet) throw new Error('シート「料金・商品マスタ」が見つかりません。');

    if (sheet.getLastRow() < 2) {
      return { success: true, data: [] };
    }

    const data = sheet.getDataRange().getValues();
    const header = data.shift();
    const timezone = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();

    const timeColumns = [
      HEADER_CLASS_START,
      HEADER_CLASS_END,
      HEADER_BREAK_START,
      HEADER_BREAK_END,
    ];
    const timeColumnIndices = timeColumns.map((h) => header.indexOf(h));

    return {
      success: true,
      data: data.map((row) => {
        let item = {};
        header.forEach((key, index) => {
          if (timeColumnIndices.includes(index) && row[index] instanceof Date) {
            item[key] = Utilities.formatDate(row[index], timezone, 'HH:mm');
          } else {
            item[key] = row[index];
          }
        });
        return item;
      }),
    };
  } catch (err) {
    Logger.log(`getAccountingMasterData Error: ${err.message}\n${err.stack}`);
    return {
      success: false,
      message: '料金・商品マスタの取得中にエラーが発生しました。',
    };
  }
}

/**
 * 【改修】指定された生徒の過去の参加履歴を、件数と開始位置を指定して取得します。
 * 全ての予約シートとアーカイブシートを横断的に検索します。
 * @param {string} studentId - 生徒ID。
 * @param {number | null} limit - 取得する件数。nullの場合は全件取得。
 * @param {number | null} offset - 取得を開始する位置。
 * @returns {object} - { success: boolean, history: object[], total: number }
 */
function getParticipationHistory(studentId, limit, offset) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const timezone = ss.getSpreadsheetTimeZone();
    const allSheetNames = [...CLASSROOM_SHEET_NAMES, ...ARCHIVE_SHEET_NAMES];
    let history = [];

    allSheetNames.forEach((sheetName) => {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet || sheet.getLastRow() < 2) return;

      const data = sheet.getDataRange().getValues();
      const header = data.shift();
      const headerMap = createHeaderMap(header);

      const idCol = headerMap.get(HEADER_STUDENT_ID);
      const dateCol = headerMap.get(HEADER_DATE);
      const statusCol = headerMap.get(HEADER_PARTICIPANT_COUNT);
      const wipCol = headerMap.get(HEADER_WORK_IN_PROGRESS);
      const accCol = headerMap.get(HEADER_ACCOUNTING_DETAILS);
      const resIdCol = headerMap.get(HEADER_RESERVATION_ID);
      const venueCol = headerMap.get(HEADER_VENUE);

      if (idCol === undefined || dateCol === undefined) return;

      data.forEach((row) => {
        const status = String(row[statusCol]).toLowerCase();
        if (row[idCol] === studentId && status !== STATUS_CANCEL && status !== STATUS_WAITING) {
          history.push({
            reservationId: row[resIdCol] || '',
            sheetName: sheetName,
            date: Utilities.formatDate(row[dateCol], timezone, 'yyyy-MM-dd'),
            classroom: sheetName.startsWith('old') ? `${sheetName.slice(3)}教室` : sheetName,
            venue: row[venueCol] || '',
            workInProgress: row[wipCol] || '',
            accountingDetails: row[accCol] || null,
          });
        }
      });
    });

    history.sort((a, b) => new Date(b.date) - new Date(a.date));

    const total = history.length;
    const limitedHistory =
      limit && offset !== null ? history.slice(offset, offset + limit) : history;

    return { success: true, history: limitedHistory, total: total };
  } catch (err) {
    Logger.log(`getParticipationHistory Error: ${err.message}\n${err.stack}`);
    return {
      success: false,
      message: '過去の参加履歴の取得中にエラーが発生しました。',
    };
  }
}
