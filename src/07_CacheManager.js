/**
 * =================================================================
 * 【ファイル名】: 07_CacheManager.gs
 * 【バージョン】: 3.0
 * 【役割】: 新しいキャッシュアーキテクチャに基づく高速データ管理システム
 * 【構成】: 14ファイル構成のうちの8番目
 * 【v3.0での変更点】:
 * - PropertiesService（永続キャッシュ）とCacheService（高速・揮発性キャッシュ）の実装
 * - 生徒データ: PropertiesServiceに基本情報+最新20件のきろく
 * - 予約サマリー: CacheServiceに全体集計データ
 * - 料金マスタ: PropertiesServiceに永続化
 * - 楽観的UI対応のためのキャッシュ即座更新機能
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
    getActiveSpreadsheet().toast('キャッシュ更新処理を開始しました...', '処理状況');

    const rosterSheet = getSheetByName('生徒名簿');
    if (!rosterSheet) {
      throw new Error('シート「生徒名簿」が見つかりません。');
    }

    const allStudentNames = getAllStudentNames();
    updateRosterSheet(rosterSheet, allStudentNames);

    const allReservations = getAllReservations();

    updateRosterCacheColumns(rosterSheet, allReservations);

    getActiveSpreadsheet().toast('キャッシュの更新が完了しました。', '完了', 5);
    ui.alert('生徒名簿のキャッシュ更新が正常に完了しました。');
    logActivity(
      Session.getActiveUser().getEmail(),
      '名簿キャッシュ更新',
      '成功',
      '生徒名簿キャッシュを更新',
    );
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
  const ss = getActiveSpreadsheet();
  const studentNames = new Set();
  const sheetNames = [...CLASSROOM_SHEET_NAMES, ...ARCHIVE_SHEET_NAMES];

  sheetNames.forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet && sheet.getLastRow() > 1) {
      const data = sheet.getDataRange().getValues();
      const header = data.shift();
      const nameColIdx = header.indexOf(HEADER_NAME);

      if (nameColIdx !== -1) {
        data.forEach(row => {
          const name = row[nameColIdx];
          if (name && typeof name === 'string' && name.trim() !== '') {
            studentNames.add(name.trim());
          }
        });
      }
    }
  });
  return studentNames; // Setを返す（元の仕様通り）
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
  rosterData.forEach(row => {
    if (row[nameColIdx] && String(row[nameColIdx]).trim())
      existingNames.add(String(row[nameColIdx]).trim());
    if (row[nicknameColIdx] && String(row[nicknameColIdx]).trim())
      existingNames.add(String(row[nicknameColIdx]).trim());
  });

  const newStudents = [];
  allStudentNames.forEach(name => {
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
  const ss = getActiveSpreadsheet();
  const reservations = [];
  const sheetNames = [...CLASSROOM_SHEET_NAMES, ...ARCHIVE_SHEET_NAMES];
  const cacheFields = [
    HEADER_VENUE,
    HEADER_WORK_IN_PROGRESS,
    HEADER_MESSAGE_TO_TEACHER,
    HEADER_IN_THE_FUTURE,
    HEADER_NOTES,
    HEADER_FROM,
    HEADER_LINE,
  ];

  sheetNames.forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet && sheet.getLastRow() > 1) {
      const data = sheet.getDataRange().getValues();
      const header = data.shift();
      const nameColIdx = header.indexOf(HEADER_NAME);
      const dateColIdx = header.indexOf(HEADER_DATE);
      const countColIdx = header.indexOf(HEADER_PARTICIPANT_COUNT);
      const studentIdColIdx = header.indexOf(HEADER_STUDENT_ID);
      const reservationIdColIdx = header.indexOf(HEADER_RESERVATION_ID);
      const accountingDetailsColIdx = header.indexOf(HEADER_ACCOUNTING_DETAILS);

      const fieldIndices = {};
      cacheFields.forEach(field => {
        fieldIndices[field] = header.indexOf(field);
      });

      if (nameColIdx !== -1 && dateColIdx !== -1) {
        data.forEach(row => {
          const name = row[nameColIdx];
          if (!name || String(name).trim() === '') return;

          const reservation = {
            studentId: row[studentIdColIdx],
            name: String(name).trim(),
            date: row[dateColIdx],
            classroom: sheetName.startsWith('old') ? `${sheetName.slice(3)}教室` : sheetName,
            sheetName: sheetName, // シート名を追加
            isTokyo: sheetName.includes('東京'),
            isCancelled: String(row[countColIdx]).toLowerCase() === STATUS_CANCEL,
            [HEADER_RESERVATION_ID]: row[reservationIdColIdx] || '',
            [HEADER_ACCOUNTING_DETAILS]: row[accountingDetailsColIdx] || null,
          };

          cacheFields.forEach(field => {
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
    allReservations.filter(r => r.date instanceof Date).map(r => r.date.getFullYear()),
  );
  let currentHeader = rosterSheet.getRange(1, 1, 1, rosterSheet.getLastColumn()).getValues()[0];
  let headerMap = createHeaderMap(currentHeader);

  const yearsToAdd = [];
  allYears.forEach(year => {
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
  allReservations.forEach(r => {
    if (!r.studentId || r.isCancelled || !(r.date instanceof Date)) return;
    const year = r.date.getFullYear();
    const studentKey = r.studentId;
    const yearKey = `${studentKey}_${year}`;

    if (!recordsByStudentYear.has(yearKey)) {
      recordsByStudentYear.set(yearKey, []);
    }

    // 現在の記録形式に合わせたフィールド構成
    recordsByStudentYear.get(yearKey).push({
      reservationId: r[HEADER_RESERVATION_ID] || '',
      sheetName: r.sheetName || '',
      date: Utilities.formatDate(r.date, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      classroom: r.classroom,
      venue: r[HEADER_VENUE] || '',
      workInProgress: r[HEADER_WORK_IN_PROGRESS] || '',
      accountingDetails: r[HEADER_ACCOUNTING_DETAILS] || null,
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
        .filter(r => r.studentId === studentId && r.date instanceof Date)
        .map(r => r.date.getFullYear()),
    );
    let totalParticipation = 0;

    // まず、この生徒の既存の「きろく」列をクリア
    finalHeaderMap.forEach((colIdx, headerName) => {
      if (headerName.startsWith('きろく_')) {
        rosterData[rowIndex][colIdx] = '';
      }
    });

    studentYears.forEach(year => {
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
  const ss = getActiveSpreadsheet();
  const reservations = [];
  const sheetNames = ARCHIVE_SHEET_NAMES;
  const cacheFields = [
    HEADER_VENUE,
    HEADER_WORK_IN_PROGRESS,
    HEADER_MESSAGE_TO_TEACHER,
    HEADER_IN_THE_FUTURE,
    HEADER_NOTES,
    HEADER_FROM,
    HEADER_LINE,
  ];

  sheetNames.forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet && sheet.getLastRow() > 1) {
      const data = sheet.getDataRange().getValues();
      const header = data.shift();
      const nameColIdx = header.indexOf(HEADER_NAME);
      const dateColIdx = header.indexOf(HEADER_DATE);
      const countColIdx = header.indexOf(HEADER_PARTICIPANT_COUNT);
      const studentIdColIdx = header.indexOf(HEADER_STUDENT_ID);
      const reservationIdColIdx = header.indexOf(HEADER_RESERVATION_ID);
      const accountingDetailsColIdx = header.indexOf(HEADER_ACCOUNTING_DETAILS);

      const fieldIndices = {};
      cacheFields.forEach(field => {
        fieldIndices[field] = header.indexOf(field);
      });

      if (nameColIdx !== -1 && dateColIdx !== -1) {
        data.forEach(row => {
          const name = row[nameColIdx];
          if (!name || String(name).trim() === '') return;

          const reservation = {
            studentId: row[studentIdColIdx],
            name: String(name).trim(),
            date: row[dateColIdx],
            classroom: sheetName.startsWith('old') ? `${sheetName.slice(3)}教室` : sheetName,
            sheetName: sheetName, // シート名を追加
            isTokyo: sheetName.includes('東京'),
            isCancelled: String(row[countColIdx]).toLowerCase() === STATUS_CANCEL,
            [HEADER_RESERVATION_ID]: row[reservationIdColIdx] || '',
            [HEADER_ACCOUNTING_DETAILS]: row[accountingDetailsColIdx] || null,
          };

          cacheFields.forEach(field => {
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
    getActiveSpreadsheet().toast(
      '全履歴のキャッシュ生成を開始しました...完了までしばらくお待ちください。',
      '処理中',
      -1,
    );

    const rosterSheet = getSheetByName(ROSTER_SHEET_NAME);
    if (!rosterSheet) throw new Error('シート「生徒名簿」が見つかりません。');

    const allArchivedReservations = getAllArchivedReservations();
    if (allArchivedReservations.length === 0) {
      handleError('処理対象のログデータが見つかりませんでした。', false);
      return;
    }

    updateRosterCacheColumns(rosterSheet, allArchivedReservations);

    getActiveSpreadsheet().toast('全履歴のキャッシュ生成が完了しました。', '完了', 10);
    ui.alert('全生徒の「きろく」キャッシュ生成が正常に完了しました。');
    logActivity(
      Session.getActiveUser().getEmail(),
      '履歴キャッシュ移行',
      '成功',
      '全履歴から「きろく」キャッシュを生成',
    );
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
    getActiveSpreadsheet().toast('全生徒の「よやくキャッシュ」更新を開始しました...', '処理中', -1);

    const rosterSheet = getSheetByName(ROSTER_SHEET_NAME);
    if (!rosterSheet) throw new Error('シート「生徒名簿」が見つかりません。');

    // --- STEP 1: 全ての現役予約シートから、一度だけデータを読み込む ---
    const allFutureReservations = getAllFutureReservations();

    // --- STEP 2: 読み込んだデータを生徒IDでグループ化 ---
    const bookingsByStudent = new Map();
    allFutureReservations.forEach(res => {
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

    rosterData.forEach(row => {
      const studentId = row[studentIdCol];
      const studentBookings = bookingsByStudent.get(studentId) || [];
      studentBookings.sort((a, b) => new Date(a.date) - new Date(b.date));
      row[cacheCol] = JSON.stringify(studentBookings);
    });

    // --- STEP 4: 更新したデータを一括で書き戻す ---
    rosterRange.setValues(rosterData);

    getActiveSpreadsheet().toast('「よやくキャッシュ」の更新が完了しました。', '完了', 10);
    ui.alert('全生徒の「よやくキャッシュ」更新が正常に完了しました。');
    logActivity(
      Session.getActiveUser().getEmail(),
      '予約キャッシュ移行',
      '成功',
      '全予約から「よやくキャッシュ」を生成',
    );
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
  const ss = getActiveSpreadsheet();
  const reservations = [];
  const sheetNames = CLASSROOM_SHEET_NAMES; // 現役シートのみを対象とする
  const timezone = getSpreadsheetTimezone();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  sheetNames.forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return;

    const data = sheet.getDataRange().getValues();
    const header = data.shift();
    const headerMap = createHeaderMap(header);

    const timeToString = date =>
      date instanceof Date ? Utilities.formatDate(date, timezone, 'HH:mm') : null;

    data.forEach(row => {
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
        messageToTeacher: row[headerMap.get(HEADER_MESSAGE_TO_TEACHER)] || '',
        accountingDone: !!row[headerMap.get(HEADER_ACCOUNTING_DETAILS)],
        accountingDetails: row[headerMap.get(HEADER_ACCOUNTING_DETAILS)] || '',
      });
    });
  });
  return reservations;
}

/**
 * 更新された予約データに基づいて、生徒名簿のキャッシュを更新します。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} rosterSheet - 生徒名簿シート
 * @param {Object} updatedRow - 更新された予約データの行
 */
function updateRosterCacheByReservation(rosterSheet, updatedRow) {
  const studentId = updatedRow[HEADER_STUDENT_ID];
  if (!studentId) return;

  const rosterHeaders = rosterSheet.getRange(1, 1, 1, rosterSheet.getLastColumn()).getValues()[0];
  const rosterStudentIdCol = rosterHeaders.indexOf(HEADER_STUDENT_ID);
  if (rosterStudentIdCol === -1) return;

  // 生徒名簿の年別きろく_YYYYキャッシュを更新
  const reservationYear = new Date(updatedRow[dateCol]).getFullYear();
  const cacheColumnName = `きろく_${reservationYear}`;

  try {
    const studentRow = rosterSheet
      .getRange(1, 1, rosterSheet.getLastRow(), rosterSheet.getLastColumn())
      .getValues()
      .findIndex(row => row[rosterStudentIdCol] === studentId);

    if (studentRow !== -1) {
      const cacheCol = rosterHeaders.indexOf(cacheColumnName);
      if (cacheCol !== -1) {
        // 該当年の履歴のみを取得してキャッシュ更新
        const yearHistory = latestHistory.filter(
          h => new Date(h.date).getFullYear() === reservationYear,
        );
        const cacheValue = JSON.stringify(yearHistory);
        rosterSheet.getRange(studentRow + 1, cacheCol + 1).setValue(cacheValue);
      }
    }
  } catch (error) {
    console.error('年別きろく_YYYYキャッシュの更新でエラー:', error);
  }
}

//=================================================================
// v3.0: 新しいキャッシュアーキテクチャ - PropertiesService & CacheService
//=================================================================

//=================================================================
// PropertiesService（永続キャッシュ）ヘルパー関数
//=================================================================

/**
 * 生徒データをPropertiesServiceから取得
 * @param {string} studentId - 生徒ID
 * @returns {Object|null} 生徒データオブジェクト（基本情報+最新20件のきろく+全よやく）
 */
function getStudentDataFromProperties(studentId) {
  try {
    const key = `student_${studentId}`;
    const data = PropertiesService.getScriptProperties().getProperty(key);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    Logger.log(`生徒データの取得エラー [${studentId}]: ${e.message}`);
    return null;
  }
}

/**
 * 生徒データをPropertiesServiceに保存
 * @param {string} studentId - 生徒ID
 * @param {Object} studentData - 生徒データオブジェクト
 */
function setStudentDataToProperties(studentId, studentData) {
  try {
    const key = `student_${studentId}`;
    PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(studentData));
  } catch (e) {
    Logger.log(`生徒データの保存エラー [${studentId}]: ${e.message}`);
    throw e;
  }
}

/**
 * 料金・商品マスタデータをPropertiesServiceから取得
 * @returns {Object|null} マスタデータオブジェクト
 */
function getMasterDataFromProperties() {
  try {
    const data = PropertiesService.getScriptProperties().getProperty('master_data');
    return data ? JSON.parse(data) : null;
  } catch (e) {
    Logger.log(`マスタデータの取得エラー: ${e.message}`);
    return null;
  }
}

/**
 * 料金・商品マスタデータをPropertiesServiceに保存
 * @param {Object} masterData - マスタデータオブジェクト
 */
function setMasterDataToProperties(masterData) {
  try {
    PropertiesService.getScriptProperties().setProperty('master_data', JSON.stringify(masterData));
  } catch (e) {
    Logger.log(`マスタデータの保存エラー: ${e.message}`);
    throw e;
  }
}

//=================================================================
// CacheService（高速・揮発性キャッシュ）ヘルパー関数
//=================================================================

/**
 * 予約サマリーをCacheServiceから取得
 * @returns {Object|null} 予約サマリーオブジェクト
 */
function getReservationSummaryFromCache() {
  try {
    const data = CacheService.getScriptCache().get('reservation_summary');
    return data ? JSON.parse(data) : null;
  } catch (e) {
    Logger.log(`予約サマリーの取得エラー: ${e.message}`);
    return null;
  }
}

/**
 * 予約サマリーをCacheServiceに保存（有効期限: 1時間）
 * @param {Object} summaryData - 予約サマリーオブジェクト
 */
function setReservationSummaryToCache(summaryData) {
  try {
    const expirationInSeconds = 3600; // 1時間
    CacheService.getScriptCache().put('reservation_summary', JSON.stringify(summaryData), expirationInSeconds);
  } catch (e) {
    Logger.log(`予約サマリーの保存エラー: ${e.message}`);
    throw e;
  }
}

//=================================================================
// 生徒データ構築・更新関数
//=================================================================

/**
 * スプレッドシートから生徒の基本情報を取得してキャッシュに保存
 * @param {string} studentId - 生徒ID
 * @returns {Object} 生徒データオブジェクト
 */
function buildAndCacheStudentData(studentId) {
  const rosterSheet = SS_MANAGER.getSheet(ROSTER_SHEET_NAME);
  if (!rosterSheet) throw new Error('生徒名簿シートが見つかりません');

  // 基本情報取得
  const rosterData = rosterSheet.getDataRange().getValues();
  const rosterHeader = rosterData.shift();
  const headerMap = createHeaderMap(rosterHeader);
  
  const studentRow = rosterData.find(row => row[headerMap.get(HEADER_STUDENT_ID)] === studentId);
  if (!studentRow) throw new Error(`生徒ID: ${studentId} が見つかりません`);

  // 基本情報構築
  const basicInfo = {};
  rosterHeader.forEach((header, index) => {
    if (header && !header.startsWith('きろく_') && header !== 'よやくキャッシュ') {
      basicInfo[header] = studentRow[index];
    }
  });

  // 最新20件のきろく取得
  const recentRecords = getRecentRecordsForStudent(studentId, 20);
  
  // 全よやく取得
  const allReservations = getAllReservationsForStudent(studentId);

  const studentData = {
    basicInfo: basicInfo,
    recentRecords: recentRecords,
    allReservations: allReservations,
    lastUpdated: new Date().toISOString()
  };

  // PropertiesServiceに保存
  setStudentDataToProperties(studentId, studentData);
  
  return studentData;
}

/**
 * 指定生徒の最新N件のきろくを取得
 * @param {string} studentId - 生徒ID
 * @param {number} limit - 取得件数制限
 * @returns {Array} きろくの配列
 */
function getRecentRecordsForStudent(studentId, limit = 20) {
  const allRecords = [];
  const sheetNames = [...CLASSROOM_SHEET_NAMES, ...ARCHIVE_SHEET_NAMES];
  
  sheetNames.forEach(sheetName => {
    const sheet = SS_MANAGER.getSheet(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return;

    const data = sheet.getDataRange().getValues();
    const header = data.shift();
    const headerMap = createHeaderMap(header);

    data.forEach(row => {
      if (row[headerMap.get(HEADER_STUDENT_ID)] === studentId && 
          row[headerMap.get(HEADER_PARTICIPANT_COUNT)] !== STATUS_CANCEL &&
          row[headerMap.get(HEADER_DATE)] instanceof Date) {
        
        allRecords.push({
          reservationId: row[headerMap.get(HEADER_RESERVATION_ID)] || '',
          sheetName: sheetName,
          date: Utilities.formatDate(row[headerMap.get(HEADER_DATE)], SS_MANAGER.getTimezone(), 'yyyy-MM-dd'),
          classroom: sheetName,
          venue: row[headerMap.get(HEADER_VENUE)] || '',
          workInProgress: row[headerMap.get(HEADER_WORK_IN_PROGRESS)] || '',
          accountingDetails: row[headerMap.get(HEADER_ACCOUNTING_DETAILS)] || null
        });
      }
    });
  });

  return allRecords
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit);
}

/**
 * 指定生徒の全よやくを取得
 * @param {string} studentId - 生徒ID
 * @returns {Array} よやくの配列
 */
function getAllReservationsForStudent(studentId) {
  const reservations = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  CLASSROOM_SHEET_NAMES.forEach(sheetName => {
    const sheet = SS_MANAGER.getSheet(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return;

    const data = sheet.getDataRange().getValues();
    const header = data.shift();
    const headerMap = createHeaderMap(header);

    data.forEach(row => {
      if (row[headerMap.get(HEADER_STUDENT_ID)] === studentId &&
          row[headerMap.get(HEADER_DATE)] instanceof Date &&
          row[headerMap.get(HEADER_DATE)] >= today &&
          row[headerMap.get(HEADER_PARTICIPANT_COUNT)] !== STATUS_CANCEL) {
        
        reservations.push({
          reservationId: row[headerMap.get(HEADER_RESERVATION_ID)],
          classroom: sheetName,
          date: Utilities.formatDate(row[headerMap.get(HEADER_DATE)], SS_MANAGER.getTimezone(), 'yyyy-MM-dd'),
          isWaiting: row[headerMap.get(HEADER_PARTICIPANT_COUNT)] === STATUS_WAITING,
          venue: row[headerMap.get(HEADER_VENUE)] || '',
          startTime: row[headerMap.get(HEADER_START_TIME)] || '',
          endTime: row[headerMap.get(HEADER_END_TIME)] || '',
          workInProgress: row[headerMap.get(HEADER_WORK_IN_PROGRESS)] || '',
          messageToTeacher: row[headerMap.get(HEADER_MESSAGE_TO_TEACHER)] || ''
        });
      }
    });
  });

  return reservations.sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * 指定生徒の全記録をスプレッドシートから取得（20件制限なし・オンデマンド用）
 * @param {string} studentId - 生徒ID
 * @returns {Array} 全記録の配列
 */
function getAllRecordsForStudent(studentId) {
  return getRecentRecordsForStudent(studentId, Number.MAX_SAFE_INTEGER);
}

//=================================================================
// 予約サマリー構築・更新関数
//=================================================================

/**
 * 全予約シートをスキャンして予約サマリーを構築・キャッシュに保存
 * @returns {Object} 予約サマリーオブジェクト
 */
function buildAndCacheReservationSummary() {
  const summary = {
    classrooms: {},
    totalReservations: 0,
    lastUpdated: new Date().toISOString()
  };

  CLASSROOM_SHEET_NAMES.forEach(sheetName => {
    const sheet = SS_MANAGER.getSheet(sheetName);
    if (!sheet || sheet.getLastRow() < 2) {
      summary.classrooms[sheetName] = { reservationCount: 0, sessions: {} };
      return;
    }

    const data = sheet.getDataRange().getValues();
    const header = data.shift();
    const headerMap = createHeaderMap(header);

    const classroomSummary = { reservationCount: 0, sessions: {} };
    
    data.forEach(row => {
      const date = row[headerMap.get(HEADER_DATE)];
      const status = row[headerMap.get(HEADER_PARTICIPANT_COUNT)];
      
      if (date instanceof Date && status !== STATUS_CANCEL) {
        const dateKey = Utilities.formatDate(date, SS_MANAGER.getTimezone(), 'yyyy-MM-dd');
        const venue = row[headerMap.get(HEADER_VENUE)] || '';
        const sessionKey = `${dateKey}_${venue}`;
        
        if (!classroomSummary.sessions[sessionKey]) {
          classroomSummary.sessions[sessionKey] = {
            date: dateKey,
            venue: venue,
            reservationCount: 0,
            waitingCount: 0
          };
        }
        
        classroomSummary.sessions[sessionKey].reservationCount++;
        if (status === STATUS_WAITING) {
          classroomSummary.sessions[sessionKey].waitingCount++;
        }
        
        classroomSummary.reservationCount++;
        summary.totalReservations++;
      }
    });
    
    summary.classrooms[sheetName] = classroomSummary;
  });

  // CacheServiceに保存
  setReservationSummaryToCache(summary);
  
  return summary;
}

//=================================================================
// 料金・商品マスタ構築・更新関数
//=================================================================

/**
 * 料金・商品マスタシートから情報を取得してキャッシュに保存
 * @returns {Object} マスタデータオブジェクト
 */
function buildAndCacheMasterData() {
  const masterSheet = SS_MANAGER.getSheet(ACCOUNTING_MASTER_SHEET_NAME);
  if (!masterSheet) throw new Error('料金・商品マスタシートが見つかりません');

  const data = masterSheet.getDataRange().getValues();
  const header = data.shift();
  const headerMap = createHeaderMap(header);

  const masterData = {
    items: [],
    lastUpdated: new Date().toISOString()
  };

  data.forEach(row => {
    if (row[0]) { // 最初の列が空でない場合のみ処理
      const item = {};
      header.forEach((colHeader, index) => {
        if (colHeader) {
          item[colHeader] = row[index];
        }
      });
      masterData.items.push(item);
    }
  });

  // PropertiesServiceに保存
  setMasterDataToProperties(masterData);
  
  return masterData;
}

//=================================================================
// キャッシュ更新関数（書き込み時の自動更新用）
//=================================================================

/**
 * 予約の追加・更新・削除時にキャッシュを更新する統合関数
 * @param {string} studentId - 対象の生徒ID
 * @param {string} classroom - 対象の教室名
 * @param {Date} date - 対象の日付
 */
function updateCachesOnReservationChange(studentId, classroom, date) {
  try {
    // 1. 生徒データキャッシュの更新
    if (studentId) {
      buildAndCacheStudentData(studentId);
    }

    // 2. 予約サマリーキャッシュの更新
    buildAndCacheReservationSummary();

    // 3. 従来のサマリーシート更新（既存システムとの互換性のため）
    if (classroom && date) {
      updateSummaryAndForm(classroom, date);
    }

    Logger.log(`キャッシュ更新完了 - 生徒: ${studentId}, 教室: ${classroom}, 日付: ${date}`);
  } catch (e) {
    Logger.log(`キャッシュ更新エラー: ${e.message}`);
    // エラーが発生してもメイン処理は続行させる
  }
}

/**
 * メモ更新時にキャッシュを更新する関数
 * @param {string} studentId - 対象の生徒ID
 */
function updateCachesOnMemoChange(studentId) {
  try {
    if (studentId) {
      buildAndCacheStudentData(studentId);
    }
    Logger.log(`メモ更新時のキャッシュ更新完了 - 生徒: ${studentId}`);
  } catch (e) {
    Logger.log(`メモ更新時のキャッシュ更新エラー: ${e.message}`);
  }
}

/**
 * 会計情報更新時にキャッシュを更新する関数
 * @param {string} studentId - 対象の生徒ID
 */
function updateCachesOnAccountingChange(studentId) {
  try {
    if (studentId) {
      buildAndCacheStudentData(studentId);
    }
    Logger.log(`会計更新時のキャッシュ更新完了 - 生徒: ${studentId}`);
  } catch (e) {
    Logger.log(`会計更新時のキャッシュ更新エラー: ${e.message}`);
  }
}

//=================================================================
// キャッシュ一括更新・初期化関数
//=================================================================

/**
 * 全キャッシュを一括で更新（初期化やメンテナンス用）
 * パフォーマンス最適化版：全シートを一度だけ読み込んで処理
 */
function rebuildAllCaches() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '全キャッシュ一括更新の確認',
    '全ての新しいキャッシュ（PropertiesService、CacheService）を一括で更新します。処理には時間がかかる場合があります。実行しますか？',
    ui.ButtonSet.YES_NO
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
    getActiveSpreadsheet().toast('全キャッシュの一括更新を開始しました...', '処理中', -1);

    // 1. 料金・商品マスタキャッシュの更新
    buildAndCacheMasterData();
    getActiveSpreadsheet().toast('料金・商品マスタキャッシュ完了...', '処理中', -1);

    // 2. 予約サマリーキャッシュの更新
    buildAndCacheReservationSummary();
    getActiveSpreadsheet().toast('予約サマリーキャッシュ完了...', '処理中', -1);

    // 3. 全生徒データキャッシュの更新（最適化版）
    buildAndCacheAllStudentDataOptimized();
    getActiveSpreadsheet().toast('全生徒データキャッシュ完了...', '処理中', -1);

    getActiveSpreadsheet().toast('全キャッシュの一括更新が完了しました。', '完了', 5);
    ui.alert('全キャッシュの一括更新が正常に完了しました。');
    logActivity(
      Session.getActiveUser().getEmail(),
      '全キャッシュ一括更新',
      '成功',
      '新しいキャッシュシステムの全データを更新'
    );
  } catch (e) {
    Logger.log(e);
    handleError(`全キャッシュの一括更新中にエラーが発生しました。\n\n詳細: ${e.message}`, true);
  } finally {
    lock.releaseLock();
  }
}

/**
 * 全生徒データを効率的に一括更新（最適化版）
 * 全シートを一度だけ読み込んで、メモリ上で処理
 */
function buildAndCacheAllStudentDataOptimized() {
  Logger.log('=== 最適化版：全生徒データキャッシュ構築開始 ===');
  
  // 1. 生徒名簿の読み込み
  const rosterSheet = SS_MANAGER.getSheet(ROSTER_SHEET_NAME);
  if (!rosterSheet || rosterSheet.getLastRow() < 2) {
    Logger.log('生徒名簿が見つからないか、データが空です');
    return;
  }

  const rosterData = rosterSheet.getDataRange().getValues();
  const rosterHeader = rosterData.shift();
  const rosterHeaderMap = createHeaderMap(rosterHeader);
  const studentIdCol = rosterHeaderMap.get(HEADER_STUDENT_ID);

  // 2. 全シートのデータを一度に読み込み
  const allSheetData = new Map();
  const sheetNames = [...CLASSROOM_SHEET_NAMES, ...ARCHIVE_SHEET_NAMES];
  
  sheetNames.forEach(sheetName => {
    const sheet = SS_MANAGER.getSheet(sheetName);
    if (sheet && sheet.getLastRow() > 1) {
      const data = sheet.getDataRange().getValues();
      const header = data.shift();
      allSheetData.set(sheetName, { header, data });
    }
  });

  Logger.log(`全シート読み込み完了: ${allSheetData.size}シート`);

  // 3. 各生徒のデータを構築（メモリ上で処理）
  let processedCount = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  rosterData.forEach(row => {
    const studentId = row[studentIdCol];
    if (!studentId) return;

    try {
      // 基本情報構築
      const basicInfo = {};
      rosterHeader.forEach((header, index) => {
        if (header && !header.startsWith('きろく_') && header !== 'よやくキャッシュ') {
          basicInfo[header] = row[index];
        }
      });

      // 各シートから該当生徒のデータを抽出
      const studentRecords = [];
      const studentReservations = [];

      allSheetData.forEach(({ header, data }, sheetName) => {
        const headerMap = createHeaderMap(header);
        const nameColIdx = headerMap.get(HEADER_STUDENT_ID);
        const dateColIdx = headerMap.get(HEADER_DATE);
        const statusColIdx = headerMap.get(HEADER_PARTICIPANT_COUNT);

        if (nameColIdx !== undefined && dateColIdx !== undefined) {
          data.forEach(dataRow => {
            if (dataRow[nameColIdx] === studentId && dataRow[dateColIdx] instanceof Date) {
              const status = dataRow[statusColIdx];
              const date = dataRow[dateColIdx];

              if (status !== STATUS_CANCEL) {
                // きろく（過去の記録）
                if (date < today && status !== STATUS_WAITING) {
                  studentRecords.push({
                    reservationId: dataRow[headerMap.get(HEADER_RESERVATION_ID)] || '',
                    sheetName: sheetName,
                    date: Utilities.formatDate(date, SS_MANAGER.getTimezone(), 'yyyy-MM-dd'),
                    classroom: sheetName,
                    venue: dataRow[headerMap.get(HEADER_VENUE)] || '',
                    workInProgress: dataRow[headerMap.get(HEADER_WORK_IN_PROGRESS)] || '',
                    accountingDetails: dataRow[headerMap.get(HEADER_ACCOUNTING_DETAILS)] || null
                  });
                }
                // よやく（将来の予約）
                else if (date >= today) {
                  studentReservations.push({
                    reservationId: dataRow[headerMap.get(HEADER_RESERVATION_ID)],
                    classroom: sheetName,
                    date: Utilities.formatDate(date, SS_MANAGER.getTimezone(), 'yyyy-MM-dd'),
                    isWaiting: status === STATUS_WAITING,
                    venue: dataRow[headerMap.get(HEADER_VENUE)] || '',
                    startTime: dataRow[headerMap.get(HEADER_START_TIME)] || '',
                    endTime: dataRow[headerMap.get(HEADER_END_TIME)] || '',
                    workInProgress: dataRow[headerMap.get(HEADER_WORK_IN_PROGRESS)] || '',
                    messageToTeacher: dataRow[headerMap.get(HEADER_MESSAGE_TO_TEACHER)] || ''
                  });
                }
              }
            }
          });
        }
      });

      // 最新20件のきろくのみ保持
      studentRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
      const recentRecords = studentRecords.slice(0, 20);

      // よやくを日付順にソート
      studentReservations.sort((a, b) => new Date(a.date) - new Date(b.date));

      // 生徒データを構築して保存
      const studentData = {
        basicInfo: basicInfo,
        recentRecords: recentRecords,
        allReservations: studentReservations,
        lastUpdated: new Date().toISOString()
      };

      setStudentDataToProperties(studentId, studentData);
      processedCount++;

      if (processedCount % 10 === 0) {
        getActiveSpreadsheet().toast(`生徒データキャッシュ: ${processedCount}件完了...`, '処理中', -1);
        Logger.log(`進捗: ${processedCount}件完了`);
      }

    } catch (e) {
      Logger.log(`生徒 ${studentId} のデータ構築でエラー: ${e.message}`);
    }
  });

  Logger.log(`=== 最適化版：全生徒データキャッシュ構築完了 (${processedCount}件) ===`);
}

//=================================================================
// テスト・デバッグ関数
//=================================================================

/**
 * 新しいキャッシュシステムのテスト関数
 */
function testNewCacheSystem() {
  try {
    Logger.log('=== 新しいキャッシュシステムのテスト開始 ===');
    
    // 1. 料金・商品マスタのテスト
    Logger.log('--- 料金・商品マスタのテスト ---');
    const masterData = buildAndCacheMasterData();
    Logger.log(`マスタデータ構築完了: ${masterData.items.length}件`);
    
    const retrievedMaster = getMasterDataFromProperties();
    Logger.log(`マスタデータ取得完了: ${retrievedMaster ? retrievedMaster.items.length : 0}件`);
    
    // 2. 予約サマリーのテスト
    Logger.log('--- 予約サマリーのテスト ---');
    const summaryData = buildAndCacheReservationSummary();
    Logger.log(`サマリーデータ構築完了: ${summaryData.totalReservations}件の予約`);
    
    const retrievedSummary = getReservationSummaryFromCache();
    Logger.log(`サマリーデータ取得完了: ${retrievedSummary ? retrievedSummary.totalReservations : 0}件の予約`);
    
    // 3. 生徒データのテスト（最初の生徒で試行）
    Logger.log('--- 生徒データのテスト ---');
    const rosterSheet = SS_MANAGER.getSheet(ROSTER_SHEET_NAME);
    let testStudentId = null;
    
    if (rosterSheet && rosterSheet.getLastRow() > 1) {
      const rosterData = rosterSheet.getDataRange().getValues();
      const rosterHeader = rosterData.shift();
      const headerMap = createHeaderMap(rosterHeader);
      const studentIdCol = headerMap.get(HEADER_STUDENT_ID);
      
      const firstStudentRow = rosterData.find(row => row[studentIdCol]);
      if (firstStudentRow) {
        testStudentId = firstStudentRow[studentIdCol];
        Logger.log(`テスト対象生徒ID: ${testStudentId}`);
        
        const studentData = buildAndCacheStudentData(testStudentId);
        Logger.log(`生徒データ構築完了: きろく${studentData.recentRecords.length}件、よやく${studentData.allReservations.length}件`);
        
        const retrievedStudent = getStudentDataFromProperties(testStudentId);
        Logger.log(`生徒データ取得完了: きろく${retrievedStudent ? retrievedStudent.recentRecords.length : 0}件、よやく${retrievedStudent ? retrievedStudent.allReservations.length : 0}件`);
        
        // 4. オンデマンド全記録取得のテスト
        Logger.log('--- オンデマンド全記録取得のテスト ---');
        const allRecords = getAllRecordsForStudent(testStudentId);
        Logger.log(`全記録取得完了: ${allRecords.length}件`);
      }
    }
    
    // 5. 新しいエンドポイント関数のテスト
    Logger.log('--- 新しいエンドポイント関数のテスト ---');
    if (testStudentId) {
      const initialData = getInitialWebApp_DataOptimized(testStudentId);
      if (initialData.success) {
        Logger.log(`エンドポイントテスト成功:`);
        Logger.log(`- 予約枠: ${initialData.availableSlots.length}件`);
        Logger.log(`- 自分の予約: ${initialData.myBookings.length}件`);
        Logger.log(`- 参加履歴: ${initialData.myHistory.length}件`);
        Logger.log(`- 会計マスタ: ${initialData.accountingMaster.length}件`);
        Logger.log(`- キャッシュ情報: ${JSON.stringify(initialData.cacheInfo)}`);
      } else {
        Logger.log(`エンドポイントテスト失敗: ${initialData.message}`);
      }
    }
    
    Logger.log('=== 新しいキャッシュシステムのテスト完了 ===');
    return { success: true, message: 'すべてのテストが完了しました' };
    
  } catch (e) {
    Logger.log(`新しいキャッシュシステムのテストでエラー: ${e.message}`);
    Logger.log(e.stack);
    return { success: false, message: e.message };
  }
}

/**
 * PropertiesServiceとCacheServiceの容量チェック
 */
function checkCacheCapacity() {
  try {
    Logger.log('=== キャッシュ容量チェック開始 ===');
    
    // PropertiesServiceの使用量チェック
    const properties = PropertiesService.getScriptProperties().getProperties();
    const propertiesKeys = Object.keys(properties);
    let totalPropertiesSize = 0;
    let studentDataCount = 0;
    
    propertiesKeys.forEach(key => {
      const value = properties[key];
      const size = JSON.stringify(value).length;
      totalPropertiesSize += size;
      
      if (key.startsWith('student_')) {
        studentDataCount++;
      }
      
      if (size > 5000) { // 5KB以上の大きなプロパティを報告
        Logger.log(`大きなプロパティ検出: ${key} (${size}バイト)`);
      }
    });
    
    Logger.log(`PropertiesService使用状況:`);
    Logger.log(`- 総キー数: ${propertiesKeys.length}`);
    Logger.log(`- 生徒データ数: ${studentDataCount}`);
    Logger.log(`- 概算サイズ: ${totalPropertiesSize}バイト`);
    Logger.log(`- 制限まで: ${512000 - totalPropertiesSize}バイト残り`); // 512KBが制限
    
    // CacheServiceの使用量チェック
    const reservationSummary = CacheService.getScriptCache().get('reservation_summary');
    if (reservationSummary) {
      const summarySize = reservationSummary.length;
      Logger.log(`CacheService使用状況:`);
      Logger.log(`- 予約サマリーサイズ: ${summarySize}バイト`);
    }
    
    // 容量警告
    const warningThreshold = 400000; // 400KB
    if (totalPropertiesSize > warningThreshold) {
      Logger.log('⚠️ 警告: PropertiesServiceの使用量が400KBを超えています');
    }
    
    // 古いキャッシュの検出
    const oldCacheKeys = propertiesKeys.filter(key => 
      key.includes('roster:') || 
      key.includes('profiles') || 
      key.includes('cache:') ||
      (key.includes('booking') && !key.startsWith('student_'))
    );
    
    if (oldCacheKeys.length > 0) {
      let oldCacheSize = 0;
      oldCacheKeys.forEach(key => {
        oldCacheSize += JSON.stringify(properties[key]).length;
      });
      Logger.log(`⚠️ 注意: 古いキャッシュが ${oldCacheKeys.length}件、${oldCacheSize}バイト検出されました`);
      Logger.log('古いキャッシュのクリーンアップを検討してください（cleanupOldCaches関数）');
    }
    
    Logger.log('=== キャッシュ容量チェック完了 ===');
    return { 
      success: true,
      totalSize: totalPropertiesSize,
      remaining: 512000 - totalPropertiesSize,
      needsCleanup: oldCacheKeys.length > 0
    };
    
  } catch (e) {
    Logger.log(`キャッシュ容量チェックでエラー: ${e.message}`);
    return { success: false, message: e.message };
  }
}

/**
 * 古いキャッシュをクリーンアップする関数
 */
function cleanupOldCaches() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '古いキャッシュのクリーンアップ',
    '古いキャッシュ形式のデータ（roster:profiles等）を削除します。新しいキャッシュシステムには影響しません。実行しますか？',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    ui.alert('処理を中断しました。');
    return;
  }

  try {
    const properties = PropertiesService.getScriptProperties();
    const allProperties = properties.getProperties();
    const keysToDelete = [];
    let deletedSize = 0;

    Object.keys(allProperties).forEach(key => {
      // 古いキャッシュ形式を特定
      if (key.includes('roster:') || 
          key.includes('profiles') || 
          key.includes('cache:') ||
          (key.includes('booking') && !key.startsWith('student_'))) {
        keysToDelete.push(key);
        deletedSize += JSON.stringify(allProperties[key]).length;
      }
    });

    if (keysToDelete.length > 0) {
      keysToDelete.forEach(key => {
        properties.deleteProperty(key);
      });
      
      Logger.log(`古いキャッシュクリーンアップ完了: ${keysToDelete.length}件のキーを削除、${deletedSize}バイト節約`);
      ui.alert(`古いキャッシュクリーンアップが完了しました。\n削除キー数: ${keysToDelete.length}\n節約容量: ${deletedSize}バイト`);
      
      logActivity(
        Session.getActiveUser().getEmail(),
        '古いキャッシュクリーンアップ',
        '成功',
        `${keysToDelete.length}件のキーを削除、${deletedSize}バイト節約`
      );
    } else {
      ui.alert('削除対象の古いキャッシュが見つかりませんでした。');
    }
    
  } catch (e) {
    Logger.log(`古いキャッシュクリーンアップでエラー: ${e.message}`);
    handleError(`古いキャッシュのクリーンアップ中にエラーが発生しました。\n\n詳細: ${e.message}`, true);
  }
}
