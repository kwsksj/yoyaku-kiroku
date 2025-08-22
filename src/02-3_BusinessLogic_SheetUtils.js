/**
 * =================================================================
 * 【ファイル名】: 02-3_BusinessLogic_SheetUtils.gs
 * 【バージョン】: 1.5
 * 【役割】: 予約シートや名簿シートを操作するための、より汎用的な
 * ヘルパー関数群を集約します。
 * - シートのソート、再採番、罫線描画
 * - データの自動入力や同期
 * 【v1.5での変更点】:
 * - NF-12: 指定された生徒IDの将来の予約情報を集約し、名簿シートのキャッシュを更新する
 * _updateFutureBookingsCache() 関数を新設。
 * =================================================================
 */

/**
 * シートのソートと再採番、および罫線描画を行う。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - 対象シート
 * @param {GoogleAppsScript.Spreadsheet.Range} editedRange - 編集された範囲
 * @param {*} oldValue - 編集前の値
 */
function updateAndSortSheet(sheet, editedRange, oldValue) {
  const headerMap = createHeaderMap(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
  const dateColIdx = headerMap.get(HEADER_DATE);
  if (dateColIdx === undefined) return;

  const formulas = new Map();
  if (editedRange) {
    for (let i = 1; i <= editedRange.getNumRows(); i++) {
      for (let j = 1; j <= editedRange.getNumColumns(); j++) {
        const cell = editedRange.getCell(i, j);
        const formula = cell.getFormula();
        if (formula) {
          formulas.set(cell.getA1Notation(), formula);
        }
      }
    }
  }

  const datesToUpdate = new Set();
  const addNormalizedDate = date => {
    if (date instanceof Date) {
      const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      datesToUpdate.add(normalized.getTime());
    }
  };

  if (editedRange) {
    const dateValuesFromEditedRows = sheet
      .getRange(editedRange.getRow(), dateColIdx + 1, editedRange.getNumRows(), 1)
      .getValues();
    dateValuesFromEditedRows.flat().forEach(date => addNormalizedDate(date));
  }

  if (oldValue && (oldValue instanceof Date || !isNaN(new Date(oldValue).getTime()))) {
    addNormalizedDate(new Date(oldValue));
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < RESERVATION_DATA_START_ROW) return;
  const fullRange = sheet.getRange(
    RESERVATION_DATA_START_ROW,
    1,
    lastRow - RESERVATION_DATA_START_ROW + 1,
    sheet.getLastColumn(),
  );
  fullRange.sort({ column: dateColIdx + 1, ascending: true });
  SpreadsheetApp.flush();

  datesToUpdate.forEach(dateInMillis => {
    if (dateInMillis > 0) {
      sortAndRenumberDateBlock(sheet, new Date(dateInMillis));
    }
  });

  if (formulas.size > 0) {
    formulas.forEach((formula, a1Notation) => {
      sheet.getRange(a1Notation).setFormula(formula);
    });
  }

  formatSheetWithBordersSafely(sheet);
}

/**
 * 特定の日付ブロックをソートし、人数列を再採番する。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - 対象シート
 * @param {Date} date - 対象の日付
 */
function sortAndRenumberDateBlock(sheet, date) {
  const timezone = getSpreadsheetTimezone();
  const targetDateString = Utilities.formatDate(date, timezone, 'yyyy-MM-dd');

  const allData = sheet
    .getRange(
      RESERVATION_DATA_START_ROW,
      1,
      sheet.getLastRow() - RESERVATION_DATA_START_ROW + 1,
      sheet.getLastColumn(),
    )
    .getValues();
  const headerMap = createHeaderMap(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
  const dateColIdx = headerMap.get(HEADER_DATE);
  const countColIdx = headerMap.get(HEADER_PARTICIPANT_COUNT);
  const nameColIdx = headerMap.get(HEADER_NAME);

  if (dateColIdx === undefined || countColIdx === undefined || nameColIdx === undefined) return;

  let firstRow = -1;
  let lastRow = -1;

  for (let i = 0; i < allData.length; i++) {
    const rowDate = allData[i][dateColIdx];
    if (
      rowDate instanceof Date &&
      Utilities.formatDate(rowDate, timezone, 'yyyy-MM-dd') === targetDateString
    ) {
      if (firstRow === -1) {
        firstRow = i + RESERVATION_DATA_START_ROW;
      }
      lastRow = i + RESERVATION_DATA_START_ROW;
    } else if (firstRow !== -1) {
      break;
    }
  }

  if (firstRow === -1) return;

  const dateBlockRange = sheet.getRange(firstRow, 1, lastRow - firstRow + 1, sheet.getLastColumn());
  const dateBlockData = dateBlockRange.getValues();

  const getSortPriority = (status, name) => {
    const s = String(status).toLowerCase();
    if (name && s !== STATUS_WAITING && s !== STATUS_CANCEL) return 1;
    if (!name) return 2;
    if (s === STATUS_WAITING) return 3;
    if (s === STATUS_CANCEL) return 4;
    return 5;
  };

  dateBlockData.sort((a, b) => {
    const priorityA = getSortPriority(a[countColIdx], a[nameColIdx]);
    const priorityB = getSortPriority(b[countColIdx], b[nameColIdx]);
    return priorityA - priorityB;
  });

  let currentCount = 1;
  dateBlockData.forEach(row => {
    const status = String(row[countColIdx]).toLowerCase();
    const name = row[nameColIdx];
    if (status !== STATUS_WAITING && status !== STATUS_CANCEL) {
      row[countColIdx] = currentCount++;
    }
  });

  dateBlockRange.setValues(dateBlockData);
}

/**
 * メニューからシート全体を手動でソート・採番する。
 */
function manuallyReSortAndNumberSheet() {
  const sheet = getActiveSpreadsheet().getActiveSheet();
  if (!CLASSROOM_SHEET_NAMES.includes(sheet.getName())) {
    handleError(`このシート (${sheet.getName()}) は手動ソートの対象外です。`, true);
    return;
  }

  try {
    getActiveSpreadsheet().toast('シート全体のソートと採番を開始します...', '処理中', 10);

    const lastRow = sheet.getLastRow();
    if (lastRow < RESERVATION_DATA_START_ROW) {
      handleError('処理するデータがありません。', false);
      return;
    }

    const dateColIdx =
      sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].indexOf(HEADER_DATE) + 1;
    if (dateColIdx === 0) {
      handleError('日付列が見つかりません。', true);
      return;
    }

    const fullRange = sheet.getRange(
      RESERVATION_DATA_START_ROW,
      1,
      lastRow - RESERVATION_DATA_START_ROW + 1,
      sheet.getLastColumn(),
    );
    fullRange.sort({ column: dateColIdx, ascending: true });
    SpreadsheetApp.flush();

    const dateColValues = sheet
      .getRange(RESERVATION_DATA_START_ROW, dateColIdx, lastRow - RESERVATION_DATA_START_ROW + 1, 1)
      .getValues();
    const uniqueDates = [
      ...new Set(
        dateColValues
          .flat()
          .map(d => (d instanceof Date ? d.getTime() : null))
          .filter(d => d !== null),
      ),
    ];

    uniqueDates.forEach(time => {
      sortAndRenumberDateBlock(sheet, new Date(time));
    });

    formatSheetWithBordersSafely(sheet);
    handleError('シート全体のソートと採番が完了しました。', false);
    logActivity(
      Session.getActiveUser().getEmail(),
      '手動ソート実行',
      '成功',
      `シート: ${sheet.getName()}`,
    );
  } catch (err) {
    handleError(`手動ソート処理中にエラーが発生しました: ${err.message}`, true);
  }
}

/**
 * 課金対象時間を計算し、「受講時間」列を更新する。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - 対象シート
 * @param {number} rowIndex - 対象行のインデックス
 */
function updateBillableTime(sheet, rowIndex) {
  try {
    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headerMap = createHeaderMap(header);

    const dateColIdx = headerMap.get(HEADER_DATE);
    const startTimeColIdx = headerMap.get(HEADER_START_TIME);
    const endTimeColIdx = headerMap.get(HEADER_END_TIME);
    const timeColIdx = headerMap.get(HEADER_TIME);

    if ([dateColIdx, startTimeColIdx, endTimeColIdx, timeColIdx].some(idx => idx === undefined))
      return;

    const row = sheet.getRange(rowIndex, 1, 1, header.length).getValues()[0];
    const reservationDate = row[dateColIdx];
    const startTimeFromCell = row[startTimeColIdx];
    const endTimeFromCell = row[endTimeColIdx];

    if (
      !(reservationDate instanceof Date) ||
      !(startTimeFromCell instanceof Date) ||
      !(endTimeFromCell instanceof Date)
    ) {
      sheet.getRange(rowIndex, timeColIdx + 1).setValue('');
      return;
    }

    const createFullDateTime = (date, time) => {
      const timezone = Session.getScriptTimeZone();
      const dateString = Utilities.formatDate(date, timezone, 'yyyy-MM-dd');
      const timeString = Utilities.formatDate(time, timezone, 'HH:mm:ss');
      return new Date(`${dateString}T${timeString}`);
    };

    const startDateTime = createFullDateTime(reservationDate, startTimeFromCell);
    const endDateTime = createFullDateTime(reservationDate, endTimeFromCell);

    if (endDateTime <= startDateTime) {
      sheet.getRange(rowIndex, timeColIdx + 1).setValue(0);
      return;
    }

    let totalMinutes = (endDateTime.getTime() - startDateTime.getTime()) / 60000;

    let breakStartTimeFromCell = row[headerMap.get(HEADER_BREAK_START)];
    let breakEndTimeFromCell = row[headerMap.get(HEADER_BREAK_END)];

    if (!(breakStartTimeFromCell instanceof Date) || !(breakEndTimeFromCell instanceof Date)) {
      const masterData = getAccountingMasterData().data;
      const classroomRule = masterData.find(
        item => item['対象教室'] === sheet.getName() && item['単位'] === UNIT_30_MIN,
      );
      if (classroomRule) {
        if (classroomRule[HEADER_BREAK_START])
          breakStartTimeFromCell = new Date(`1970-01-01T${classroomRule[HEADER_BREAK_START]}`);
        if (classroomRule[HEADER_BREAK_END])
          breakEndTimeFromCell = new Date(`1970-01-01T${classroomRule[HEADER_BREAK_END]}`);
      }
    }

    if (breakStartTimeFromCell instanceof Date && breakEndTimeFromCell instanceof Date) {
      const breakStartDateTime = createFullDateTime(reservationDate, breakStartTimeFromCell);
      const breakEndDateTime = createFullDateTime(reservationDate, breakEndTimeFromCell);

      const overlapStart = Math.max(startDateTime.getTime(), breakStartDateTime.getTime());
      const overlapEnd = Math.min(endDateTime.getTime(), breakEndDateTime.getTime());

      if (overlapEnd > overlapStart) {
        const overlapMinutes = (overlapEnd - overlapStart) / 60000;
        totalMinutes -= overlapMinutes;
      }
    }

    const billableHours = Math.ceil(totalMinutes / 30) * 0.5;
    sheet.getRange(rowIndex, timeColIdx + 1).setValue(billableHours > 0 ? billableHours : 0);
  } catch (err) {
    Logger.log(`Error in updateBillableTime for row ${rowIndex}: ${err.message}`);
  }
}

/**
 * 行が挿入された際に、日付と会場を上の行から自動入力する。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - 対象シート
 * @returns {Date | null} 挿入された日付。処理不要な場合はnull。
 */
function handleRowInsert(sheet) {
  const activeRange = sheet.getActiveRange();
  const insertedRow = activeRange.getRow();
  if (insertedRow <= RESERVATION_DATA_START_ROW) return null;

  const headerMap = createHeaderMap(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
  const reservationIdColIdx = headerMap.get(HEADER_RESERVATION_ID);
  const dateColIdx = headerMap.get(HEADER_DATE);
  const venueColIdx = headerMap.get(HEADER_VENUE);

  if (dateColIdx === undefined) return null;

  const firstDateCell = sheet.getRange(insertedRow, dateColIdx + 1);
  if (firstDateCell.getValue() instanceof Date) return null;

  const insertedRange = sheet.getRange(
    insertedRow,
    1,
    activeRange.getNumRows(),
    sheet.getLastColumn(),
  );
  const values = insertedRange.getValues();

  const dateFromAbove = sheet.getRange(insertedRow - 1, dateColIdx + 1).getValue();
  const venueFromAbove =
    venueColIdx !== undefined ? sheet.getRange(insertedRow - 1, venueColIdx + 1).getValue() : '';

  if (!(dateFromAbove instanceof Date)) return null;

  for (let i = 0; i < values.length; i++) {
    if (reservationIdColIdx !== undefined && !values[i][reservationIdColIdx]) {
      values[i][reservationIdColIdx] = Utilities.getUuid();
    }
    if (dateColIdx !== undefined && !values[i][dateColIdx]) {
      values[i][dateColIdx] = dateFromAbove;
    }
    if (venueColIdx !== undefined && !values[i][venueColIdx]) {
      values[i][venueColIdx] = venueFromAbove;
    }
  }

  insertedRange.setValues(values);
  return dateFromAbove;
}

/**
 * キャンセル処理時に、空の行を挿入する。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - 対象シート
 * @param {number} rowIndex - キャンセルされた行のインデックス
 * @param {Map<string, number>} headerMap - ヘッダーマップ
 */
function insertEmptyRowForCancellation(sheet, rowIndex, headerMap) {
  const dateColIdx = headerMap.get(HEADER_DATE);
  const venueColIdx = headerMap.get(HEADER_VENUE);
  const reservationIdColIdx = headerMap.get(HEADER_RESERVATION_ID);
  if (dateColIdx === undefined || reservationIdColIdx === undefined) return;

  const sourceValues = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
  const dateToCopy = sourceValues[dateColIdx];
  if (dateToCopy instanceof Date) {
    sheet.insertRowBefore(rowIndex);
    const newRowRange = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn());
    const newRowValues = new Array(sheet.getLastColumn()).fill('');
    newRowValues[reservationIdColIdx] = Utilities.getUuid();
    newRowValues[dateColIdx] = dateToCopy;
    if (venueColIdx !== undefined) {
      newRowValues[venueColIdx] = sourceValues[venueColIdx];
    }
    newRowRange.setValues([newRowValues]);
  }
}

/**
 * 予約者の名前がクリアされた際に、関連情報をクリアする。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - 対象シート
 * @param {number} rowIndex - 対象行のインデックス
 */
function handleReservationNameClear(sheet, rowIndex) {
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowRange = sheet.getRange(rowIndex, 1, 1, header.length);
  const columnsToKeep = [
    HEADER_RESERVATION_ID,
    HEADER_DATE,
    HEADER_VENUE,
    HEADER_CLASS_START,
    HEADER_CLASS_END,
    HEADER_BREAK_START,
    HEADER_BREAK_END,
  ];
  const newValues = rowRange.getValues()[0].map((value, index) => {
    return columnsToKeep.includes(header[index]) ? value : '';
  });
  rowRange.setValues([newValues]);
}

/**
 * 予約シートに名前が入力された際、生徒名簿のデータを参照して関連情報を自動入力する。
 * @param {string} studentId - 生徒ID
 * @param {GoogleAppsScript.Spreadsheet.Sheet} targetSheet - 対象の予約シート
 * @param {number} targetRowIndex - 対象行のインデックス
 */
function populateReservationWithRosterData(studentId, targetSheet, targetRowIndex) {
  if (!studentId) return;

  try {
    const rosterSheet = getSheetByName(ROSTER_SHEET_NAME);
    if (!rosterSheet) return;

    const rosterData = getRosterData(rosterSheet);
    const rosterIdColIdx = rosterData.headerMap.get(HEADER_STUDENT_ID);

    const userRosterRow = rosterData.data.find(row => row[rosterIdColIdx] === studentId);
    if (!userRosterRow) return;

    const targetHeader = targetSheet.getRange(1, 1, 1, targetSheet.getLastColumn()).getValues()[0];
    const targetHeaderMap = createHeaderMap(targetHeader);

    const targetRow = targetSheet.getRange(targetRowIndex, 1, 1, targetHeader.length);
    const targetValues = targetRow.getValues()[0];
    let valuesUpdated = false;

    const targetClassCountColIdx = targetHeaderMap.get(HEADER_CLASS_COUNT);
    const rosterUnifiedCountColIdx = rosterData.headerMap.get(HEADER_UNIFIED_CLASS_COUNT);

    if (targetClassCountColIdx !== undefined && rosterUnifiedCountColIdx !== undefined) {
      const currentCount = parseInt(userRosterRow[rosterUnifiedCountColIdx], 10) || 0;
      const nextCount = currentCount + 1;
      if (targetValues[targetClassCountColIdx] != nextCount) {
        targetValues[targetClassCountColIdx] = nextCount;
        valuesUpdated = true;
      }
    }

    SYNC_TARGET_HEADERS.forEach(headerName => {
      if (headerName === HEADER_CLASS_COUNT) return;
      const rosterColIdx = rosterData.headerMap.get(headerName);
      const targetColIdx = targetHeaderMap.get(headerName);
      if (rosterColIdx !== undefined && targetColIdx !== undefined && !targetValues[targetColIdx]) {
        const valueToSet = userRosterRow[rosterColIdx];
        if (valueToSet) {
          targetValues[targetColIdx] = valueToSet;
          valuesUpdated = true;
        }
      }
    });

    if (valuesUpdated) {
      targetRow.setValues([targetValues]);
    }
  } catch (e) {
    Logger.log(`名簿データ転記中にエラーが発生しました: ${e.message}`);
  }
}

/**
 * 生徒名簿の情報が更新された際、未来の予約にその情報を同期する。
 * @param {string} studentId - 生徒ID
 * @param {string} headerToUpdate - 更新された列のヘッダー名
 * @param {*} newValue - 新しい値
 */
function updateFutureReservations(studentId, headerToUpdate, newValue) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let updatedCount = 0;

  CLASSROOM_SHEET_NAMES.forEach(sheetName => {
    const sheet = getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < RESERVATION_DATA_START_ROW) return;

    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headerMap = createHeaderMap(header);
    const studentIdColIdx = headerMap.get(HEADER_STUDENT_ID);
    const dateColIdx = headerMap.get(HEADER_DATE);
    let targetColIdx = headerMap.get(headerToUpdate);

    if (headerToUpdate === HEADER_UNIFIED_CLASS_COUNT) {
      targetColIdx = headerMap.get(HEADER_CLASS_COUNT);
    }

    if (studentIdColIdx === undefined || dateColIdx === undefined || targetColIdx === undefined) {
      return;
    }

    const dataRange = sheet.getRange(
      RESERVATION_DATA_START_ROW,
      1,
      sheet.getLastRow() - RESERVATION_DATA_START_ROW + 1,
      sheet.getLastColumn(),
    );
    const values = dataRange.getValues();

    let sheetUpdated = false;
    values.forEach(row => {
      const reservationDate = row[dateColIdx];
      if (
        row[studentIdColIdx] === studentId &&
        reservationDate instanceof Date &&
        reservationDate.getTime() >= today.getTime()
      ) {
        if (headerToUpdate === HEADER_UNIFIED_CLASS_COUNT) {
          const newCount = (parseInt(newValue, 10) || 0) + 1;
          if (row[targetColIdx] != newCount) {
            row[targetColIdx] = newCount;
            sheetUpdated = true;
            updatedCount++;
          }
        } else if (row[targetColIdx] != newValue) {
          row[targetColIdx] = newValue;
          sheetUpdated = true;
          updatedCount++;
        }
      }
    });

    if (sheetUpdated) {
      dataRange.setValues(values);
    }
  });

  if (updatedCount > 0) {
    getActiveSpreadsheet().toast(`${updatedCount}件の将来の予約を更新しました。`, '予約データ同期');
  }
}

/**
 * 生徒名簿のデータから、名前（本名・ニックネーム）をキー、生徒IDを値とするMapを作成します。
 * @param {Array<Array<string>>} data - 生徒名簿のデータ配列（ヘッダーなし）
 * @param {Map<string, number>} headerMap - 生徒名簿のヘッダーマップ
 * @returns {Map<string, string>} 名前をキー、生徒IDを値とするMap
 */
function _createNameToIdMap(data, headerMap) {
  const nameToId = new Map();
  const idColIdx = headerMap.get(HEADER_STUDENT_ID);
  const realNameColIdx = headerMap.get(HEADER_REAL_NAME);
  const nicknameColIdx = headerMap.get(HEADER_NICKNAME);

  data.forEach(row => {
    const id = row[idColIdx];
    const realName = row[realNameColIdx];
    const nickname = row[nicknameColIdx];
    if (id && realName) nameToId.set(String(realName).trim(), id);
    if (id && nickname) nameToId.set(String(nickname).trim(), id);
  });
  return nameToId;
}

/**
 * 生徒名簿シートからデータを取得し、整形して返す。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} rosterSheet - 生徒名簿シート
 * @returns {object} 整形された名簿データ
 */
function getRosterData(rosterSheet) {
  const data = rosterSheet.getDataRange().getValues();
  const header = data.shift();
  const headerMap = createHeaderMap(header);
  const idColIdx = headerMap.get(HEADER_STUDENT_ID);
  const unifiedCountColIdx = headerMap.get(HEADER_UNIFIED_CLASS_COUNT);

  const nameToId = _createNameToIdMap(data, headerMap);

  return {
    data: data,
    headerMap: headerMap,
    idColIdx: idColIdx,
    unifiedCountColIdx: unifiedCountColIdx,
    nameToId: nameToId,
  };
}

/**
 * メニューからアクティブシートの罫線を手動で再描画する。
 */
function manuallyFormatActiveSheet() {
  const sheet = getActiveSpreadsheet().getActiveSheet();
  formatSheetWithBordersSafely(sheet);
}

/**
 * 指定された行のガントチャートを更新します。
 * 開始/終了時刻、初講オプションに基づき、時刻列に記号を描画します。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - 対象のシート
 * @param {number} rowIndex - 更新対象の行番号
 */
function updateGanttChart(sheet, rowIndex) {
  try {
    const sheetName = sheet.getName();
    // 時間制教室でない場合は処理を終了
    if (sheetName === TOKYO_CLASSROOM_NAME) return;

    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headerMap = createHeaderMap(header);
    const rowValues = sheet.getRange(rowIndex, 1, 1, header.length).getValues()[0];

    // 必要な列のインデックスを取得
    const startTimeIdx = headerMap.get(HEADER_START_TIME);
    const endTimeIdx = headerMap.get(HEADER_END_TIME);
    const firstLectureIdx = headerMap.get(HEADER_FIRST_LECTURE);

    if (startTimeIdx === undefined || endTimeIdx === undefined) return;

    // ガントチャートとして使用する時刻ヘッダーと列インデックスのマッピングを作成
    const timeHeaderMap = new Map();
    header.forEach((h, i) => {
      if (typeof h === 'string' && /^\d{1,2}:\d{2}$/.test(h)) {
        timeHeaderMap.set(h, i);
      }
    });
    if (timeHeaderMap.size === 0) return;

    // ガントチャート範囲を一度クリア
    const ganttCols = Array.from(timeHeaderMap.values());
    ganttCols.forEach(colIdx => {
      sheet.getRange(rowIndex, colIdx + 1).clearContent();
    });

    const startTime = rowValues[startTimeIdx];
    const endTime = rowValues[endTimeIdx];
    const isFirstLecture =
      firstLectureIdx !== undefined ? rowValues[firstLectureIdx] === true : false;

    // 料金マスタから教室ルールを取得
    const masterData = getAccountingMasterData().data;
    const classroomRule = masterData.find(
      item => item['対象教室'] === sheetName && item['単位'] === UNIT_30_MIN,
    );
    const firstLectureRule = masterData.find(
      item => item['項目名'] === ITEM_NAME_FIRST_LECTURE && item['対象教室'] === sheetName,
    );

    if (!classroomRule) return;

    // 休憩時間（分単位に変換）
    const breakStart = classroomRule[HEADER_BREAK_START]
      ? new Date(`1970-01-01T${classroomRule[HEADER_BREAK_START]}`).getHours() * 60 +
        new Date(`1970-01-01T${classroomRule[HEADER_BREAK_START]}`).getMinutes()
      : -1;
    const breakEnd = classroomRule[HEADER_BREAK_END]
      ? new Date(`1970-01-01T${classroomRule[HEADER_BREAK_END]}`).getHours() * 60 +
        new Date(`1970-01-01T${classroomRule[HEADER_BREAK_END]}`).getMinutes()
      : -1;

    // 描画する記号と範囲を格納するMap
    const ganttValues = new Map();

    // 1. 通常の予約時間を描画
    if (startTime instanceof Date && endTime instanceof Date && startTime < endTime) {
      const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
      const endMinutes = endTime.getHours() * 60 + endTime.getMinutes();

      for (let min = startMinutes; min < endMinutes; min += 30) {
        // 休憩時間はスキップ
        if (breakStart !== -1 && min >= breakStart && min < breakEnd) {
          continue;
        }
        const h = Math.floor(min / 60);
        const m = min % 60;
        const timeString = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        if (timeHeaderMap.has(timeString)) {
          ganttValues.set(timeHeaderMap.get(timeString), '●');
        }
      }
    }

    // 2. 初回講習の時間を上書き
    if (isFirstLecture && firstLectureRule) {
      const firstLectureStart = new Date(`1970-01-01T${firstLectureRule[HEADER_CLASS_START]}`);
      const firstLectureEnd = new Date(`1970-01-01T${firstLectureRule[HEADER_CLASS_END]}`);
      const startMinutes = firstLectureStart.getHours() * 60 + firstLectureStart.getMinutes();
      const endMinutes = firstLectureEnd.getHours() * 60 + firstLectureEnd.getMinutes();

      for (let min = startMinutes; min < endMinutes; min += 30) {
        const h = Math.floor(min / 60);
        const m = min % 60;
        const timeString = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        if (timeHeaderMap.has(timeString)) {
          ganttValues.set(timeHeaderMap.get(timeString), '初');
        }
      }
    }

    // 3. シートに一括書き込み
    ganttValues.forEach((symbol, colIdx) => {
      sheet.getRange(rowIndex, colIdx + 1).setValue(symbol);
    });
  } catch (err) {
    Logger.log(`ガントチャートの更新中にエラーが発生しました (行: ${rowIndex}): ${err.message}`);
  }
}

/**
 * 【全スキャン更新】指定された生徒IDの将来の予約情報を全シートから再集計し、名簿のキャッシュを再構築する。信頼性が高いが重い処理。
 * @param {string} studentId - 対象の生徒ID
 */
function _rebuildFutureBookingsCacheForStudent(studentId) {
  if (!studentId) return;

  try {
    const ss = getActiveSpreadsheet();
    const rosterSheet = ss.getSheetByName(ROSTER_SHEET_NAME);
    if (!rosterSheet) return;

    const rosterHeader = rosterSheet.getRange(1, 1, 1, rosterSheet.getLastColumn()).getValues()[0];
    const rosterHeaderMap = createHeaderMap(rosterHeader);
    const studentIdColRoster = rosterHeaderMap.get(HEADER_STUDENT_ID);
    const cacheColRoster = rosterHeaderMap.get('よやくキャッシュ');

    if (studentIdColRoster === undefined || cacheColRoster === undefined) {
      Logger.log('生徒名簿に必要な列（生徒IDまたはよやくキャッシュ）が見つかりません。');
      return;
    }

    const rosterData = rosterSheet
      .getRange(2, 1, rosterSheet.getLastRow() - 1, rosterSheet.getLastColumn())
      .getValues();
    const targetRowIndex_0based = rosterData.findIndex(
      row => row[studentIdColRoster] === studentId,
    );

    if (targetRowIndex_0based === -1) return; // 生徒が見つからない

    const timezone = getSpreadsheetTimezone();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const futureBookings = [];

    CLASSROOM_SHEET_NAMES.forEach(sheetName => {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet || sheet.getLastRow() < 2) return;
      const data = sheet.getDataRange().getValues();
      const header = data.shift();
      const headerMap = createHeaderMap(header);

      const timeToString = date =>
        date instanceof Date ? Utilities.formatDate(date, timezone, 'HH:mm') : null;

      data.forEach(row => {
        if (row[headerMap.get(HEADER_STUDENT_ID)] !== studentId) return;

        const date = row[headerMap.get(HEADER_DATE)];
        const status = String(row[headerMap.get(HEADER_PARTICIPANT_COUNT)]).toLowerCase();
        if (!(date instanceof Date) || date < today || status === STATUS_CANCEL) return;

        futureBookings.push({
          reservationId: row[headerMap.get(HEADER_RESERVATION_ID)],
          classroom: sheetName,
          date: Utilities.formatDate(date, timezone, 'yyyy-MM-dd'),
          isWaiting: status === STATUS_WAITING,
          venue: row[headerMap.get(HEADER_VENUE)] || '',
          startTime: timeToString(row[headerMap.get(HEADER_START_TIME)]),
          endTime: timeToString(row[headerMap.get(HEADER_END_TIME)]),
          firstLecture: row[headerMap.get(HEADER_FIRST_LECTURE)] === true,
          workInProgress: row[headerMap.get(HEADER_WORK_IN_PROGRESS)] || '',
          order: row[headerMap.get(HEADER_ORDER)] || '',
          accountingDone: !!row[headerMap.get(HEADER_ACCOUNTING_DETAILS)],
          accountingDetails: row[headerMap.get(HEADER_ACCOUNTING_DETAILS)] || '',
        });
      });
    });

    futureBookings.sort((a, b) => new Date(a.date) - new Date(b.date));

    const cacheJson = JSON.stringify(futureBookings);
    rosterSheet.getRange(targetRowIndex_0based + 2, cacheColRoster + 1).setValue(cacheJson);
  } catch (err) {
    Logger.log(`将来の予約キャッシュ更新中にエラー (生徒ID: ${studentId}): ${err.message}`);
  }
}

/**
 * 【差分更新コア】キャッシュを差分更新し、その結果を返す。
 * @param {string} studentId - 対象の生徒ID
 * @param {'add' | 'remove' | 'update'} changeType - 変更の種類
 * @param {object} payload - 変更内容。add/update時は予約オブジェクト、remove時は { reservationId }
 * @returns {Array<object>} 更新後のキャッシュ配列
 */
function _updateFutureBookingsCacheIncrementally(studentId, changeType, payload) {
  try {
    let cache = _getExistingCache(studentId);

    switch (changeType) {
      case 'add':
        // 既に同じ予約IDがあれば更新、なければ追加
        const addIndex = cache.findIndex(b => b.reservationId === payload.reservationId);
        if (addIndex !== -1) {
          cache[addIndex] = payload;
        } else {
          cache.push(payload);
        }
        break;

      case 'remove':
        cache = cache.filter(b => b.reservationId !== payload.reservationId);
        break;

      case 'update':
        const updateIndex = cache.findIndex(b => b.reservationId === payload.reservationId);
        if (updateIndex !== -1) {
          // 既存のオブジェクトにペイロードのプロパティをマージ
          cache[updateIndex] = { ...cache[updateIndex], ...payload };
        }
        break;
    }

    // 日付の昇順でソート
    cache.sort((a, b) => new Date(a.date) - new Date(b.date));

    _writeCache(studentId, cache);
    return cache;
  } catch (err) {
    Logger.log(
      `キャッシュの差分更新中にエラー (生徒ID: ${studentId}, type: ${changeType}): ${err.message}`,
    );
    // エラー発生時は、信頼性のある全スキャン更新にフォールバックする
    return _rebuildFutureBookingsCacheForStudent(studentId);
  }
}

/**
 * 【ヘルパー】生徒名簿から既存の「よやくキャッシュ」を取得し、パースして返す。
 * @param {string} studentId - 対象の生徒ID
 * @returns {Array<object>} パースされたキャッシュ配列。失敗時は空配列。
 */
function _getExistingCache(studentId) {
  const rosterSheet = getSheetByName(ROSTER_SHEET_NAME);
  if (!rosterSheet) return [];

  const headerMap = createHeaderMap(
    rosterSheet.getRange(1, 1, 1, rosterSheet.getLastColumn()).getValues()[0],
  );
  const studentIdCol = headerMap.get(HEADER_STUDENT_ID);
  const cacheCol = headerMap.get('よやくキャッシュ');

  if (studentIdCol === undefined || cacheCol === undefined) return [];

  const rosterData = rosterSheet
    .getRange(2, 1, rosterSheet.getLastRow() - 1, rosterSheet.getLastColumn())
    .getValues();
  const userRow = rosterData.find(row => row[studentIdCol] === studentId);

  if (userRow && userRow[cacheCol]) {
    try {
      return JSON.parse(userRow[cacheCol]);
    } catch (e) {
      Logger.log(`既存キャッシュのJSON解析に失敗 (生徒ID: ${studentId}): ${e.message}`);
    }
  }
  return [];
}

/**
 * 【ヘルパー】指定された配列をJSON化し、生徒名簿の「よやくキャッシュ」列に書き込む。
 * @param {string} studentId - 対象の生徒ID
 * @param {Array<object>} bookingsArray - 書き込む予約情報の配列
 */
function _writeCache(studentId, bookingsArray) {
  const rosterSheet = getSheetByName(ROSTER_SHEET_NAME);
  if (!rosterSheet) return;

  const headerMap = createHeaderMap(
    rosterSheet.getRange(1, 1, 1, rosterSheet.getLastColumn()).getValues()[0],
  );
  const studentIdCol = headerMap.get(HEADER_STUDENT_ID);
  const cacheCol = headerMap.get('よやくキャッシュ');

  if (studentIdCol === undefined || cacheCol === undefined) return;

  // findRowIndexByValueは予約シートを前提としているため、ここでは使わない
  const rosterData = rosterSheet.getRange(2, 1, rosterSheet.getLastRow() - 1, 1).getValues();
  const targetRowIndex_0based = rosterData.findIndex(row => row[0] === studentId);

  if (targetRowIndex_0based !== -1) {
    const targetRow_1based = targetRowIndex_0based + 2;
    const cacheJson = JSON.stringify(bookingsArray);
    rosterSheet.getRange(targetRow_1based, cacheCol + 1).setValue(cacheJson);
  } else {
    Logger.log(`キャッシュ書き込みエラー: 生徒ID ${studentId} が名簿に見つかりません。`);
  }
}
