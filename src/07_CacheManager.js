/**
 * =================================================================
 * 【ファイル名】: 07_CacheManager.gs
 * 【バージョン】: 2.5
 * 【役割】: 生徒名簿シートのキャッシュ列（参加回数や最新の制作メモなど）を
 * 更新する、重く独立したバッチ処理。
 * 【構成】: 14ファイル構成のうちの8番目
 * 【v2.5での変更点】:
 * - migrateAllFutureBookingsToCacheを修正。先に全予約シートを一度だけ読み込み、
 * メモリ上でデータを処理することで、パフォーマンスを劇的に向上。
 * =================================================================
 */

/**
 * メニューから呼び出される、キャッシュ更新プロセスのエントリーポイント。
 */
function updateRosterCache() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'キャッシュ更新の確認',
    '全ての予約ログをスキャンして、生徒名簿のキャッシュ情報を更新します。処理には数分かかる場合があります。実行しますか？',
    ui.ButtonSet.YES_NO,
  );

  if (response !== ui.Button.YES) {
    ui.alert('処理を中断しました。');
    return;
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_TIME_MS)) {
    ui.alert('現在、他の重い処理が実行中です。しばらく経ってから再度お試しください。');
    return;
  }

  try {
    SpreadsheetApp.getActiveSpreadsheet().toast('キャッシュ更新処理を開始しました...', '処理状況');

    const rosterSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('生徒名簿');
    if (!rosterSheet) {
      throw new Error('シート「生徒名簿」が見つかりません。');
    }

    const allStudentNames = getAllStudentNames();
    updateRosterSheet(rosterSheet, allStudentNames);

    const allReservations = getAllReservations();

    updateRosterCacheColumns(rosterSheet, allReservations);

    SpreadsheetApp.getActiveSpreadsheet().toast('キャッシュの更新が完了しました。', '完了', 5);
    ui.alert('生徒名簿のキャッシュ更新が正常に完了しました。');
    logActivity(Session.getActiveUser().getEmail(), '名簿キャッシュ更新', '成功', '生徒名簿キャッシュを更新');
  } catch (e) {
    Logger.log(e);
    handleError(`キャッシュの更新中にエラーが発生しました。\n\n詳細: ${e.message}`, true);
  } finally {
    lock.releaseLock();
  }
}

/**
 * 全ての予約シート（oldシート含む）から、重複を除いた生徒名のリストを取得します。
 * @returns {Set<string>} 生徒名のセット
 */
function getAllStudentNames() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const studentNames = new Set();
  const sheetNames = [...CLASSROOM_SHEET_NAMES, ...ARCHIVE_SHEET_NAMES];

  sheetNames.forEach((sheetName) => {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet && sheet.getLastRow() > 1) {
      const data = sheet.getDataRange().getValues();
      const header = data.shift();
      const nameColIdx = header.indexOf(HEADER_NAME);

      if (nameColIdx !== -1) {
        data.forEach((row) => {
          const name = row[nameColIdx];
          if (name && typeof name === 'string' && name.trim() !== '') {
            studentNames.add(name.trim());
          }
        });
      }
    }
  });
  return studentNames;
}

/**
 * 生徒名簿シートに、まだ登録されていない生徒を追加します。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} rosterSheet - 生徒名簿シート
 * @param {Set<string>} allStudentNames - 全ての生徒名のセット
 */
function updateRosterSheet(rosterSheet, allStudentNames) {
  const rosterData = rosterSheet.getDataRange().getValues();
  const rosterHeader = rosterData.shift();
  const nameColIdx = rosterHeader.indexOf(HEADER_REAL_NAME);
  const nicknameColIdx = rosterHeader.indexOf(HEADER_NICKNAME);

  const existingNames = new Set();
  rosterData.forEach((row) => {
    if (row[nameColIdx] && String(row[nameColIdx]).trim())
      existingNames.add(String(row[nameColIdx]).trim());
    if (row[nicknameColIdx] && String(row[nicknameColIdx]).trim())
      existingNames.add(String(row[nicknameColIdx]).trim());
  });

  const newStudents = [];
  allStudentNames.forEach((name) => {
    if (!existingNames.has(name)) {
      const newRow = new Array(rosterHeader.length).fill('');
      newRow[nameColIdx] = name; // 本名として登録
      newStudents.push(newRow);
    }
  });

  if (newStudents.length > 0) {
    rosterSheet
      .getRange(rosterSheet.getLastRow() + 1, 1, newStudents.length, newStudents[0].length)
      .setValues(newStudents);
    Logger.log(`${newStudents.length} 名の新しい生徒を生徒名簿に追加しました。`);
  }
}

/**
 * 全ての予約シートから、キャッシュ更新に必要なデータを取得・整形します。
 * @returns {Array<object>} 予約データの配列
 */
function getAllReservations() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reservations = [];
  const sheetNames = [...CLASSROOM_SHEET_NAMES, ...ARCHIVE_SHEET_NAMES];
  const cacheFields = [
    HEADER_VENUE,
    HEADER_WORK_IN_PROGRESS,
    HEADER_IN_THE_FUTURE,
    HEADER_NOTES,
    HEADER_FROM,
    HEADER_LINE,
  ];

  sheetNames.forEach((sheetName) => {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet && sheet.getLastRow() > 1) {
      const data = sheet.getDataRange().getValues();
      const header = data.shift();
      const nameColIdx = header.indexOf(HEADER_NAME);
      const dateColIdx = header.indexOf(HEADER_DATE);
      const countColIdx = header.indexOf(HEADER_PARTICIPANT_COUNT);
      const studentIdColIdx = header.indexOf(HEADER_STUDENT_ID);

      const fieldIndices = {};
      cacheFields.forEach((field) => {
        fieldIndices[field] = header.indexOf(field);
      });

      if (nameColIdx !== -1 && dateColIdx !== -1) {
        data.forEach((row) => {
          const name = row[nameColIdx];
          if (!name || String(name).trim() === '') return;

          const reservation = {
            studentId: row[studentIdColIdx],
            name: String(name).trim(),
            date: row[dateColIdx],
            classroom: sheetName.startsWith('old') ? `${sheetName.slice(3)}教室` : sheetName,
            isTokyo: sheetName.includes('東京'),
            isCancelled: String(row[countColIdx]).toLowerCase() === STATUS_CANCEL,
          };

          cacheFields.forEach((field) => {
            const idx = fieldIndices[field];
            if (idx !== -1 && row[idx]) {
              reservation[field] = row[idx];
            }
          });

          reservations.push(reservation);
        });
      }
    }
  });
  return reservations.sort((a, b) => {
    if (!(a.date instanceof Date)) return 1;
    if (!(b.date instanceof Date)) return -1;
    return b.date - a.date;
  });
}

/**
 * 生徒名簿のキャッシュ列を、集計したデータで更新します。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} rosterSheet - 生徒名簿シート
 * @param {Array<object>} allReservations - 全ての予約データ
 */
function updateRosterCacheColumns(rosterSheet, allReservations) {
  if (rosterSheet.getLastRow() < 2) return;

  // --- STEP 1: 必要な「きろく_YYYY」列を特定し、不足分を追加 ---
  const allYears = new Set(
    allReservations.filter((r) => r.date instanceof Date).map((r) => r.date.getFullYear()),
  );
  let currentHeader = rosterSheet.getRange(1, 1, 1, rosterSheet.getLastColumn()).getValues()[0];
  let headerMap = createHeaderMap(currentHeader);

  const yearsToAdd = [];
  allYears.forEach((year) => {
    const colName = `きろく_${year}`;
    if (!headerMap.has(colName)) {
      yearsToAdd.push(colName);
    }
  });

  if (yearsToAdd.length > 0) {
    const lastCol = rosterSheet.getLastColumn();
    rosterSheet.insertColumnsAfter(lastCol, yearsToAdd.length);
    const startCol = lastCol + 1;
    rosterSheet.getRange(1, startCol, 1, yearsToAdd.length).setValues([yearsToAdd]);
  }
  // --- 構造変更ここまで ---

  // --- STEP 2: 列構造が確定した後に、再度ヘッダーとデータを読み込む ---
  const finalHeader = rosterSheet.getRange(1, 1, 1, rosterSheet.getLastColumn()).getValues()[0];
  const finalHeaderMap = createHeaderMap(finalHeader);
  const rosterRange = rosterSheet.getRange(
    2,
    1,
    rosterSheet.getLastRow() - 1,
    rosterSheet.getLastColumn(),
  );
  const rosterData = rosterRange.getValues();

  // --- STEP 3: 全予約データを生徒IDと年でグループ化 ---
  const recordsByStudentYear = new Map();
  allReservations.forEach((r) => {
    if (!r.studentId || r.isCancelled || !(r.date instanceof Date)) return;
    const year = r.date.getFullYear();
    const studentKey = r.studentId;
    const yearKey = `${studentKey}_${year}`;

    if (!recordsByStudentYear.has(yearKey)) {
      recordsByStudentYear.set(yearKey, []);
    }
    recordsByStudentYear.get(yearKey).push({
      date: Utilities.formatDate(r.date, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      classroom: r.classroom,
      venue: r[HEADER_VENUE] || '',
      workInProgress: r[HEADER_WORK_IN_PROGRESS] || '',
    });
  });

  // --- STEP 4: 生徒名簿の各行を更新 ---
  const studentIdColRoster = finalHeaderMap.get(HEADER_STUDENT_ID);
  const unifiedCountColIdx = finalHeaderMap.get(HEADER_UNIFIED_CLASS_COUNT);

  rosterData.forEach((rosterRow, rowIndex) => {
    const studentId = rosterRow[studentIdColRoster];
    if (!studentId) return;

    const studentYears = new Set(
      allReservations
        .filter((r) => r.studentId === studentId && r.date instanceof Date)
        .map((r) => r.date.getFullYear()),
    );
    let totalParticipation = 0;

    // まず、この生徒の既存の「きろく」列をクリア
    finalHeaderMap.forEach((colIdx, headerName) => {
      if (headerName.startsWith('きろく_')) {
        rosterData[rowIndex][colIdx] = '';
      }
    });

    studentYears.forEach((year) => {
      const colName = `きろく_${year}`;
      const recordColIdx_0based = finalHeaderMap.get(colName);

      const yearKey = `${studentId}_${year}`;
      const yearRecords = recordsByStudentYear.get(yearKey) || [];

      if (yearRecords.length > 0) {
        totalParticipation += yearRecords.length;
        yearRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
        rosterData[rowIndex][recordColIdx_0based] = JSON.stringify(yearRecords);
      }
    });

    if (unifiedCountColIdx !== undefined) {
      rosterData[rowIndex][unifiedCountColIdx] = totalParticipation;
    }
  });

  // --- STEP 5: 更新されたデータをシートに一括書き込み ---
  rosterRange.setValues(rosterData);
}

/**
 * 全ての【アーカイブ】シートから、キャッシュ更新に必要なデータを取得・整形します。
 * @returns {Array<object>} 予約データの配列
 */
function getAllArchivedReservations() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reservations = [];
  const sheetNames = ARCHIVE_SHEET_NAMES;
  const cacheFields = [
    HEADER_VENUE,
    HEADER_WORK_IN_PROGRESS,
    HEADER_IN_THE_FUTURE,
    HEADER_NOTES,
    HEADER_FROM,
    HEADER_LINE,
  ];

  sheetNames.forEach((sheetName) => {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet && sheet.getLastRow() > 1) {
      const data = sheet.getDataRange().getValues();
      const header = data.shift();
      const nameColIdx = header.indexOf(HEADER_NAME);
      const dateColIdx = header.indexOf(HEADER_DATE);
      const countColIdx = header.indexOf(HEADER_PARTICIPANT_COUNT);
      const studentIdColIdx = header.indexOf(HEADER_STUDENT_ID);

      const fieldIndices = {};
      cacheFields.forEach((field) => {
        fieldIndices[field] = header.indexOf(field);
      });

      if (nameColIdx !== -1 && dateColIdx !== -1) {
        data.forEach((row) => {
          const name = row[nameColIdx];
          if (!name || String(name).trim() === '') return;

          const reservation = {
            studentId: row[studentIdColIdx],
            name: String(name).trim(),
            date: row[dateColIdx],
            classroom: sheetName.startsWith('old') ? `${sheetName.slice(3)}教室` : sheetName,
            isTokyo: sheetName.includes('東京'),
            isCancelled: String(row[countColIdx]).toLowerCase() === STATUS_CANCEL,
          };

          cacheFields.forEach((field) => {
            const idx = fieldIndices[field];
            if (idx !== -1 && row[idx]) {
              reservation[field] = row[idx];
            }
          });

          reservations.push(reservation);
        });
      }
    }
  });
  return reservations.sort((a, b) => {
    if (!(a.date instanceof Date)) return 1;
    if (!(b.date instanceof Date)) return -1;
    return b.date - a.date;
  });
}

/**
 * 【NF-11】メニューから実行: 過去の全データをスキャンし、全生徒の「きろく」キャッシュを生成・更新する。
 * 既存のデータ移行のために使用します。
 */
function migrateAllRecordsToCache() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '全履歴キャッシュ生成の確認',
    '全ての【アーカイブ】シートをスキャンして、全生徒の「きろく」列を生成・更新します。処理には数分以上かかる場合があります。この操作は通常、一度だけ実行すれば十分です。実行しますか？',
    ui.ButtonSet.YES_NO,
  );

  if (response !== ui.Button.YES) {
    ui.alert('処理を中断しました。');
    return;
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(300000)) {
    ui.alert('現在、他の重い処理が実行中です。しばらく経ってから再度お試しください。');
    return;
  }

  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      '全履歴のキャッシュ生成を開始しました...完了までしばらくお待ちください。',
      '処理中',
      -1,
    );

    const rosterSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ROSTER_SHEET_NAME);
    if (!rosterSheet) throw new Error('シート「生徒名簿」が見つかりません。');

    const allArchivedReservations = getAllArchivedReservations();
    if (allArchivedReservations.length === 0) {
      handleError('処理対象のログデータが見つかりませんでした。', false);
      return;
    }

    updateRosterCacheColumns(rosterSheet, allArchivedReservations);

    SpreadsheetApp.getActiveSpreadsheet().toast(
      '全履歴のキャッシュ生成が完了しました。',
      '完了',
      10,
    );
    ui.alert('全生徒の「きろく」キャッシュ生成が正常に完了しました。');
    logActivity(Session.getActiveUser().getEmail(), '履歴キャッシュ移行', '成功', '全履歴から「きろく」キャッシュを生成');
  } catch (e) {
    Logger.log(e);
    handleError(`全履歴のキャッシュ生成中にエラーが発生しました。\n\n詳細: ${e.message}`, true);
  } finally {
    lock.releaseLock();
  }
}

/**
 * 【NF-12】メニューから実行: 現在の全予約シートから、全生徒の「よやくキャッシュ」を生成・更新する。
 * データ構造の変更後や、手動での大規模な予約変更後に整合性を保つために使用します。
 */
function migrateAllFutureBookingsToCache() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '将来の予約キャッシュ全更新の確認',
    '全ての現役予約シートをスキャンして、全生徒の「よやくキャッシュ」列を更新します。処理には数分かかる場合があります。実行しますか？',
    ui.ButtonSet.YES_NO,
  );

  if (response !== ui.Button.YES) {
    ui.alert('処理を中断しました。');
    return;
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(300000)) {
    // 5分間ロックを試行
    ui.alert('現在、他の重い処理が実行中です。しばらく経ってから再度お試しください。');
    return;
  }

  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      '全生徒の「よやくキャッシュ」更新を開始しました...',
      '処理中',
      -1,
    );

    const rosterSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ROSTER_SHEET_NAME);
    if (!rosterSheet) throw new Error('シート「生徒名簿」が見つかりません。');

    // --- STEP 1: 全ての現役予約シートから、一度だけデータを読み込む ---
    const allFutureReservations = getAllFutureReservations();

    // --- STEP 2: 読み込んだデータを生徒IDでグループ化 ---
    const bookingsByStudent = new Map();
    allFutureReservations.forEach((res) => {
      if (!bookingsByStudent.has(res.studentId)) {
        bookingsByStudent.set(res.studentId, []);
      }
      bookingsByStudent.get(res.studentId).push(res);
    });

    // --- STEP 3: 生徒名簿を一度だけ読み込み、キャッシュを書き換える ---
    const rosterHeaderMap = createHeaderMap(
      rosterSheet.getRange(1, 1, 1, rosterSheet.getLastColumn()).getValues()[0],
    );
    const studentIdCol = rosterHeaderMap.get(HEADER_STUDENT_ID);
    const cacheCol = rosterHeaderMap.get('よやくキャッシュ');
    if (studentIdCol === undefined || cacheCol === undefined) {
      throw new Error('生徒名簿に「生徒ID」または「よやくキャッシュ」列が見つかりません。');
    }

    const rosterRange = rosterSheet.getRange(
      2,
      1,
      rosterSheet.getLastRow() - 1,
      rosterSheet.getLastColumn(),
    );
    const rosterData = rosterRange.getValues();

    rosterData.forEach((row) => {
      const studentId = row[studentIdCol];
      const studentBookings = bookingsByStudent.get(studentId) || [];
      studentBookings.sort((a, b) => new Date(a.date) - new Date(b.date));
      row[cacheCol] = JSON.stringify(studentBookings);
    });

    // --- STEP 4: 更新したデータを一括で書き戻す ---
    rosterRange.setValues(rosterData);

    SpreadsheetApp.getActiveSpreadsheet().toast(
      '「よやくキャッシュ」の更新が完了しました。',
      '完了',
      10,
    );
    ui.alert('全生徒の「よやくキャッシュ」更新が正常に完了しました。');
    logActivity(Session.getActiveUser().getEmail(), '予約キャッシュ移行', '成功', '全予約から「よやくキャッシュ」を生成');
  } catch (e) {
    Logger.log(e);
    handleError(
      `「よやくキャッシュ」の一括更新中にエラーが発生しました。\n\n詳細: ${e.message}`,
      true,
    );
  } finally {
    lock.releaseLock();
  }
}

/**
 * 【NF-12】全ての【現役】予約シートから、将来の予約データを取得するヘルパー関数。
 * @returns {Array<object>} 将来の予約データの配列
 */
function getAllFutureReservations() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reservations = [];
  const sheetNames = CLASSROOM_SHEET_NAMES; // 現役シートのみを対象とする
  const timezone = ss.getSpreadsheetTimeZone();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  sheetNames.forEach((sheetName) => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return;

    const data = sheet.getDataRange().getValues();
    const header = data.shift();
    const headerMap = createHeaderMap(header);

    const timeToString = (date) =>
      date instanceof Date ? Utilities.formatDate(date, timezone, 'HH:mm') : null;

    data.forEach((row) => {
      const studentId = row[headerMap.get(HEADER_STUDENT_ID)];
      if (!studentId) return;

      const date = row[headerMap.get(HEADER_DATE)];
      const status = String(row[headerMap.get(HEADER_PARTICIPANT_COUNT)]).toLowerCase();

      if (!(date instanceof Date) || date < today || status === STATUS_CANCEL) return;

      reservations.push({
        studentId: studentId,
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
  return reservations;
}
