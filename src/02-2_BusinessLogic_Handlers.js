/**
 * =================================================================
 * 【ファイル名】: 02-2_BusinessLogic_Handlers.gs
 * 【バージョン】: 1.3
 * 【役割】: リアルタイムなシート操作に応答するイベントハンドラ群。
 * 【構成】: 14ファイル構成のうちの3番目
 * 【v1.3での変更点】:
 * - NF-12: handleReservationSheetEditを修正。シートの手動編集時に、
 * 関連する生徒の将来予約キャッシュを更新する _updateFutureBookingsCache() を呼び出すように変更。
 * =================================================================
 */

// --- トリガーからの処理実行 ---

/**
 * handleEditから呼び出され、セル編集イベントを統括する。
 * @param {Object} e - Google Sheets の編集イベントオブジェクト
 */
function processCellEdit(e) {
  const range = e.range;
  const sheet = range.getSheet();
  const sheetName = sheet.getName();
  const startRow = range.getRow();

  if (sheetName === ROSTER_SHEET_NAME && startRow > 1) {
    handleRosterEdit(e);
    logActivity(
      'user',
      Session.getActiveUser().getEmail(),
      'ROSTER_EDIT',
      'SUCCESS',
      `範囲: ${range.getA1Notation()}`,
    );
  } else if (CLASSROOM_SHEET_NAMES.includes(sheetName) && startRow >= RESERVATION_DATA_START_ROW) {
    handleReservationSheetEdit(e);
    logActivity(
      'user',
      Session.getActiveUser().getEmail(),
      'RESERVATION_EDIT',
      'SUCCESS',
      `シート: ${sheetName}, 範囲: ${range.getA1Notation()}`,
    );
  }
}

/**
 * handleOnChangeから呼び出され、行挿入などの変更イベントを処理する。
 * @param {string} changeType - e.changeType から渡される文字列 ('INSERT_ROW'など)
 */
function processChange(changeType) {
  if (changeType === 'INSERT_ROW') {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    if (!CLASSROOM_SHEET_NAMES.includes(sheet.getName())) return;

    const insertedDate = handleRowInsert(sheet);
    if (insertedDate) {
      SpreadsheetApp.flush();
      sortAndRenumberDateBlock(sheet, insertedDate);

      const pseudoEvent = {
        range: sheet.getActiveRange(),
        source: SpreadsheetApp.getActiveSpreadsheet(),
        changeType: changeType,
      };
      if (typeof triggerSummaryUpdateFromEdit !== 'undefined') {
        triggerSummaryUpdateFromEdit(pseudoEvent);
      }
    }
    logActivity(
      'user',
      Session.getActiveUser().getEmail(),
      'ROW_INSERT',
      'SUCCESS',
      `シート: ${sheet.getName()}, 日付: ${
        insertedDate
          ? Utilities.formatDate(
              insertedDate,
              SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(),
              'yyyy-MM-dd',
            )
          : 'N/A'
      }`,
    );
  }
}

// --- 編集イベントの個別処理 ---

/**
 * 予約シートでの編集イベントを統括し、適切な処理に振り分ける。
 * @param {Object} e - Google Sheets の編集イベントオブジェクト
 */
function handleReservationSheetEdit(e) {
  const range = e.range;
  const sheet = range.getSheet();
  const sheetName = sheet.getName();
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const editedHeader = header[range.getColumn() - 1];

  // 編集された列に応じて、それぞれの処理を呼び出す
  if (editedHeader === HEADER_NAME) {
    handleNameEdit(e, header);
  } else if ([HEADER_START_TIME, HEADER_END_TIME, HEADER_FIRST_LECTURE].includes(editedHeader)) {
    const startRow = range.getRow();
    for (let i = 0; i < range.getNumRows(); i++) {
      const currentRow = startRow + i;
      updateBillableTime(sheet, currentRow);
      updateGanttChart(sheet, currentRow);
    }
  } else if (editedHeader === HEADER_PARTICIPANT_COUNT) {
    _handleParticipantCountEditInReservation(range, header);
  }

  // 【NF-12】編集された行の生徒IDを取得し、予約キャッシュを更新
  const studentIdColIdx = header.indexOf(HEADER_STUDENT_ID);
  if (studentIdColIdx !== -1) {
    const studentId = range
      .getSheet()
      .getRange(range.getRow(), studentIdColIdx + 1)
      .getValue();
    if (studentId) _rebuildFutureBookingsCacheForStudent(studentId);
  }

  // 最後にソートを実行
  updateAndSortSheet(sheet, range, e.oldValue);

  // サマリー更新とフォーム選択肢更新を呼び出す
  if (typeof triggerSummaryUpdateFromEdit !== 'undefined') {
    triggerSummaryUpdateFromEdit(e);
  }
}

/**
 * 名簿シートでの編集イベントを処理する。
 * @param {Object} e - Google Sheets の編集イベントオブジェクト
 */
function handleRosterEdit(e) {
  const range = e.range;
  const sheet = range.getSheet();
  const startRow = range.getRow();
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const editedHeader = header[range.getColumn() - 1];
  const idColIdx = header.indexOf(HEADER_STUDENT_ID);
  const realNameColIdx = header.indexOf(HEADER_REAL_NAME);
  const nicknameColIdx = header.indexOf(HEADER_NICKNAME);

  for (let i = 0; i < range.getNumRows(); i++) {
    const currentRow = startRow + i;
    const idCell = sheet.getRange(currentRow, idColIdx + 1);

    if (!idCell.getValue()) {
      const realName = sheet.getRange(currentRow, realNameColIdx + 1).getValue();
      const nickname = sheet.getRange(currentRow, nicknameColIdx + 1).getValue();
      if (realName || nickname) {
        idCell.setValue(`user_${Utilities.getUuid()}`);
      }
    }

    const studentId = idCell.getValue();
    if (
      studentId &&
      (SYNC_TARGET_HEADERS.includes(editedHeader) || editedHeader === HEADER_UNIFIED_CLASS_COUNT)
    ) {
      const valueToSync = range.getCell(i + 1, 1).getValue();
      updateFutureReservations(studentId, editedHeader, valueToSync);
    }
  }
}

/**
 * 予約シートで名前列が編集された際の処理。
 * @param {Object} e - Google Sheets の編集イベントオブジェクト
 * @param {string[]} header - 予約シートのヘッダー配列
 */
function handleNameEdit(e, header) {
  const range = e.range;
  const sheet = range.getSheet();
  const startRow = range.getRow();

  const rosterSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ROSTER_SHEET_NAME);
  if (!rosterSheet) return;

  const rosterData = getRosterData(rosterSheet);
  const studentIdColIdx = header.indexOf(HEADER_STUDENT_ID);

  for (let i = 0; i < range.getNumRows(); i++) {
    const currentRow = startRow + i;
    const nameCell = range.getCell(i + 1, 1);
    const name = nameCell.getValue();

    if (name) {
      let studentId = rosterData.nameToId.get(name.trim());
      if (!studentId) {
        studentId = `user_${Utilities.getUuid()}`;
        rosterSheet.appendRow([studentId, '', name.trim(), name.trim(), '']);
        rosterData.nameToId.set(name.trim(), studentId);
      }
      sheet.getRange(currentRow, studentIdColIdx + 1).setValue(studentId);
      populateReservationWithRosterData(studentId, sheet, currentRow);
    } else {
      handleReservationNameClear(sheet, currentRow);
    }
  }
}

// --- プライベートヘルパー関数 ---

/**
 * 人数列が編集され、キャンセルが入力された際の処理。
 * @param {GoogleAppsScript.Spreadsheet.Range} range - 編集されたセル範囲
 * @param {string[]} header - 予約シートのヘッダー配列
 */
function _handleParticipantCountEditInReservation(range, header) {
  const sheet = range.getSheet();
  const startRow = range.getRow();
  for (let i = 0; i < range.getNumRows(); i++) {
    const cell = range.getCell(i + 1, 1);
    if (String(cell.getValue()).toLowerCase() === STATUS_CANCEL) {
      insertEmptyRowForCancellation(sheet, startRow + i, createHeaderMap(header));
    }
  }
}
