/**
 * =================================================================
 * 【ファイル名】: 05-2_Backend_Write.gs
 * 【バージョン】: 2.1
 * 【役割】: WebAppからのデータ書き込み・更新要求（Write）と、
 * それに付随する検証ロジックに特化したバックエンド機能。
 * 【構成】: 18ファイル構成のうちの7番目（00_Constants.js、08_ErrorHandler.jsを含む）
 * 【v2.1での変更点】:
 * - saveAccountingDetailsがレガシーな教室別シートではなく、統合予約シートのみを参照するように修正。
 * - _archiveSingleReservationが教室名を引数で受け取るようにし、シート名への依存を排除。
 * - saveAccountingDetails内の不要なレガシー関数呼び出しをコメントアウト。
 * =================================================================
 */

// =================================================================
// 統一定数ファイル（00_Constants.js）から定数を継承
// 基本的な定数は00_Constants.jsで統一管理されています
// =================================================================

/**
 * 時間制予約の時刻に関する検証を行うプライベートヘルパー関数。
 * @param {string} startTime - 開始時刻 (HH:mm)。
 * @param {string} endTime - 終了時刻 (HH:mm)。
 * @param {object} classroomRule - 会計マスタから取得した教室ルール。
 * @throws {Error} 検証に失敗した場合、理由を示すエラーをスローする。
 */
function _validateTimeBasedReservation(startTime, endTime, classroomRule) {
  if (!startTime || !endTime) throw new Error('開始時刻と終了時刻の両方を指定してください。');
  if (startTime >= endTime) throw new Error('終了時刻は開始時刻より後に設定する必要があります。');

  const start = new Date(`1970-01-01T${startTime}`);
  const end = new Date(`1970-01-01T${endTime}`);
  const durationMinutes = (end.getTime() - start.getTime()) / 60000;
  if (durationMinutes < 120) {
    throw new Error('最低予約時間は2時間です。');
  }

  const breakStart = classroomRule[HEADER_BREAK_START]
    ? new Date(`1970-01-01T${classroomRule[HEADER_BREAK_START]}`)
    : null;
  const breakEnd = classroomRule[HEADER_BREAK_END]
    ? new Date(`1970-01-01T${classroomRule[HEADER_BREAK_END]}`)
    : null;
  if (breakStart && breakEnd) {
    if (start >= breakStart && start < breakEnd)
      throw new Error(`予約の開始時刻（${startTime}）を休憩時間内に設定することはできません。`);
    if (end > breakStart && end <= breakEnd)
      throw new Error(`予約の終了時刻（${endTime}）を休憩時間内に設定することはできません。`);
  }
}

/**
 * 予約を実行します。
 * 新しい定員管理ロジック（予約シートの直接スキャン）で予約可否を判断します。
 * @param {object} reservationInfo - 予約情報。
 * @returns {object} - 処理結果。
 */
function makeReservation(reservationInfo) {
  const lock = LockService.getScriptLock();
  lock.waitLock(CONSTANTS.LIMITS.LOCK_WAIT_TIME_MS);
  try {
    const { classroom, date, user, options } = reservationInfo;
    const { startTime, endTime } = options;

    // 統合予約シートを取得
    const integratedSheet = getSheetByName(CONSTANTS.SHEET_NAMES.INTEGRATED_RESERVATIONS);
    if (!integratedSheet) throw new Error('統合予約シートが見つかりません。');

    const masterData = getAccountingMasterData().data;
    const classroomRule = masterData.find(
      item =>
        item['対象教室'] &&
        item['対象教室'].includes(classroom) &&
        item['種別'] === CONSTANTS.ITEM_TYPES.TUITION,
    );

    if (classroomRule && classroomRule['単位'] === CONSTANTS.UNITS.THIRTY_MIN) {
      _validateTimeBasedReservation(startTime, endTime, classroomRule);
    }

    // 統合予約シートから全データを取得
    const allSheetData = integratedSheet.getDataRange().getValues();
    if (allSheetData.length === 0) throw new Error('統合予約シートにデータがありません。');

    const header = allSheetData[0];
    const headerMap = createHeaderMap(header);
    const timezone = getSpreadsheetTimezone();

    // データ部分のみを抽出（ヘッダー行以降）
    const data = allSheetData.slice(1);

    // 統合予約シートの列インデックス（新しいデータモデル）
    const reservationIdColIdx = headerMap.get(CONSTANTS.HEADERS.RESERVATION_ID);
    const studentIdColIdx = headerMap.get(CONSTANTS.HEADERS.STUDENT_ID);
    const dateColIdx = headerMap.get(CONSTANTS.HEADERS.DATE);
    const classroomColIdx = headerMap.get(CONSTANTS.HEADERS.CLASSROOM);
    const startTimeColIdx = headerMap.get(CONSTANTS.HEADERS.START_TIME);
    const endTimeColIdx = headerMap.get(CONSTANTS.HEADERS.END_TIME);
    const statusColIdx = headerMap.get(CONSTANTS.HEADERS.STATUS);
    const venueColIdx = headerMap.get(CONSTANTS.HEADERS.VENUE);
    const chiselRentalColIdx = headerMap.get(CONSTANTS.HEADERS.CHISEL_RENTAL);
    const firstLectureColIdx = headerMap.get(CONSTANTS.HEADERS.FIRST_LECTURE);
    const wipColIdx = headerMap.get(CONSTANTS.HEADERS.WORK_IN_PROGRESS);
    const orderColIdx = headerMap.get(CONSTANTS.HEADERS.ORDER);
    const messageColIdx = headerMap.get(CONSTANTS.HEADERS.MESSAGE_TO_TEACHER);

    const capacity =
      CONSTANTS.CLASSROOM_CAPACITIES[classroom] ||
      CONSTANTS.CLASSROOM_CAPACITIES[CONSTANTS.CLASSROOMS.TOKYO];
    let isFull = false;

    // 同日同教室の予約をフィルタリング
    const dateFilter = row => {
      const rowDate = row[dateColIdx];
      const rowStatus = String(row[statusColIdx]).toLowerCase();
      const rowClassroom = row[classroomColIdx];
      return (
        rowDate instanceof Date &&
        Utilities.formatDate(rowDate, timezone, 'yyyy-MM-dd') === date &&
        rowClassroom === classroom &&
        rowStatus !== CONSTANTS.STATUS.CANCEL &&
        !!row[studentIdColIdx] // 生徒IDが存在する行のみ
      );
    };

    if (classroom === CONSTANTS.CLASSROOMS.TSUKUBA) {
      const reqStartHour = startTime ? new Date(`1970-01-01T${startTime}`).getHours() : 0;
      const reqEndHour = endTime ? new Date(`1970-01-01T${endTime}`).getHours() : 24;

      let morningCount = 0;
      let afternoonCount = 0;
      data.filter(dateFilter).forEach(row => {
        const rStart = row[startTimeColIdx];
        const rEnd = row[endTimeColIdx];
        const rStartHour = rStart instanceof Date ? rStart.getHours() : 0;
        const rEndHour = rEnd instanceof Date ? rEnd.getHours() : 24;

        if (rStartHour < CONSTANTS.LIMITS.TSUKUBA_MORNING_SESSION_END_HOUR) morningCount++;
        if (rEndHour >= CONSTANTS.LIMITS.TSUKUBA_MORNING_SESSION_END_HOUR) afternoonCount++;
      });

      const morningFull = morningCount >= capacity;
      const afternoonFull = afternoonCount >= capacity;

      if (reqStartHour < CONSTANTS.LIMITS.TSUKUBA_MORNING_SESSION_END_HOUR && morningFull)
        isFull = true;
      if (reqEndHour >= CONSTANTS.LIMITS.TSUKUBA_MORNING_SESSION_END_HOUR && afternoonFull)
        isFull = true;
    } else {
      const reservationsOnDate = data.filter(dateFilter).length;
      isFull = reservationsOnDate >= capacity;
    }

    // 新しい予約IDを生成
    const newReservationId = Utilities.getUuid();
    // 日付文字列をDateオブジェクトに変換（東京タイムゾーン指定）
    const targetDate = new Date(date + 'T00:00:00+09:00');

    // 会場情報を取得（同日同教室の既存予約から）
    let venue = '';
    const sameDateRow = data.find(row => {
      const rowDate = row[dateColIdx];
      return (
        rowDate instanceof Date &&
        Utilities.formatDate(rowDate, timezone, 'yyyy-MM-dd') === date &&
        row[classroomColIdx] === classroom &&
        row[venueColIdx]
      );
    });
    if (sameDateRow && sameDateRow[venueColIdx]) {
      venue = sameDateRow[venueColIdx];
    }

    // 新しい予約行のデータを作成（統合予約シートの形式）
    const newRowData = new Array(header.length).fill('');

    // 基本予約情報
    newRowData[reservationIdColIdx] = newReservationId;
    newRowData[studentIdColIdx] = user.studentId;
    newRowData[dateColIdx] = targetDate;
    newRowData[classroomColIdx] = classroom;
    newRowData[venueColIdx] = venue;
    newRowData[statusColIdx] = isFull ? CONSTANTS.STATUS.WAITING : CONSTANTS.STATUS.COMPLETED;

    // 時刻設定（教室別のロジック）
    if (classroom === CONSTANTS.CLASSROOMS.TOKYO) {
      const master = getAccountingMasterData().data;
      const tokyoRule = master.find(
        item =>
          item['項目名'] === CONSTANTS.ITEMS.MAIN_LECTURE &&
          item['対象教室'] === CONSTANTS.CLASSROOMS.TOKYO,
      );
      if (tokyoRule) {
        const finalStartTime = tokyoRule[CONSTANTS.HEADERS.CLASS_START];
        const finalEndTime = tokyoRule[CONSTANTS.HEADERS.CLASS_END];
        if (finalStartTime)
          newRowData[startTimeColIdx] = new Date(`1970-01-01T${finalStartTime}:00`);
        if (finalEndTime) newRowData[endTimeColIdx] = new Date(`1970-01-01T${finalEndTime}:00`);
      }
    } else {
      if (startTime) newRowData[startTimeColIdx] = new Date(`1970-01-01T${startTime}:00`);
      if (endTime) newRowData[endTimeColIdx] = new Date(`1970-01-01T${endTime}:00`);
    }

    // オプション設定
    if (chiselRentalColIdx !== undefined)
      newRowData[chiselRentalColIdx] = options.chiselRental || false;
    if (firstLectureColIdx !== undefined)
      newRowData[firstLectureColIdx] = options.firstLecture || false;

    // 制作メモ（材料情報を含む）
    let workInProgress = options.workInProgress || '';
    if (options.materialInfo) {
      workInProgress += CONSTANTS.SYSTEM.MATERIAL_INFO_PREFIX + options.materialInfo;
    }
    if (wipColIdx !== undefined) newRowData[wipColIdx] = workInProgress;

    // その他の情報
    if (orderColIdx !== undefined) newRowData[orderColIdx] = options.order || '';
    if (messageColIdx !== undefined) newRowData[messageColIdx] = options.messageToTeacher || '';

    // メモリ上のデータ配列に新しい行を追加
    data.push(newRowData);

    // 日付順でソート（メモリ上で実行）
    if (dateColIdx !== undefined) {
      data.sort((a, b) => {
        const dateA = a[dateColIdx] instanceof Date ? a[dateColIdx] : new Date(a[dateColIdx]);
        const dateB = b[dateColIdx] instanceof Date ? b[dateColIdx] : new Date(b[dateColIdx]);
        return dateA - dateB;
      });
    }

    // ソート済みデータを一括でシートに書き戻し
    const fullData = [header, ...data];
    integratedSheet.clear();
    integratedSheet.getRange(1, 1, fullData.length, header.length).setValues(fullData);

    // セルのフォーマット設定（新しい行の位置を特定）
    const newRowIndex = data.findIndex(row => row[reservationIdColIdx] === newReservationId) + 2; // ヘッダー行を考慮

    // 日付列のフォーマット（yyyy-mm-dd形式）
    if (dateColIdx !== undefined) {
      integratedSheet.getRange(newRowIndex, dateColIdx + 1).setNumberFormat('yyyy-mm-dd');
    }
    // 時刻セルのフォーマット設定
    if (startTimeColIdx !== undefined) {
      integratedSheet.getRange(newRowIndex, startTimeColIdx + 1).setNumberFormat('HH:mm');
    }
    if (endTimeColIdx !== undefined) {
      integratedSheet.getRange(newRowIndex, endTimeColIdx + 1).setNumberFormat('HH:mm');
    }

    SpreadsheetApp.flush(); // シート書き込み完了を保証

    // 統合予約シートの更新後、キャッシュを再構築
    rebuildAllReservationsCache();

    // ログと通知
    const message = !isFull ? '予約が完了しました。' : '満席のため、キャンセル待ちで登録しました。';
    const messageToTeacher = options.messageToTeacher || '';
    const messageLog = messageToTeacher ? `, Message: ${messageToTeacher}` : '';
    const logDetails = `Classroom: ${classroom}, Date: ${date}, Status: ${isFull ? 'Waiting' : 'Confirmed'}, ReservationID: ${newReservationId}${messageLog}`;
    logActivity(user.studentId, '予約作成', CONSTANTS.MESSAGES.SUCCESS, logDetails);

    const subject = `新規予約 (${classroom}) - ${user.displayName}様`;
    const messageSection = messageToTeacher ? `\n先生へのメッセージ: ${messageToTeacher}\n` : '';
    const body =
      `新しい予約が入りました。\n\n` +
      `本名: ${user.realName}\n` +
      `ニックネーム: ${user.displayName}\n\n` +
      `教室: ${classroom}\n` +
      `日付: ${date}\n` +
      `状態: ${isFull ? 'キャンセル待ち' : '確定'}${messageSection}\n` +
      `詳細はスプレッドシートを確認してください。`;
    sendAdminNotification(subject, body);

    return createApiResponse(true, {
      message: message,
    });
  } catch (err) {
    logActivity(
      reservationInfo.user.studentId,
      '予約作成',
      CONSTANTS.MESSAGES.ERROR,
      `Error: ${err.message}`,
    );
    Logger.log(`makeReservation Error: ${err.message}\n${err.stack}`);
    return BackendErrorHandler.handle(err, 'makeReservation');
  } finally {
    lock.releaseLock();
  }
}

/**
 * 予約をキャンセルします。
 * @param {object} cancelInfo - { reservationId: string, classroom: string, studentId: string }
 * @returns {object} - 処理結果。
 */
function cancelReservation(cancelInfo) {
  const lock = LockService.getScriptLock();
  lock.waitLock(CONSTANTS.LIMITS.LOCK_WAIT_TIME_MS);

  try {
    const { reservationId, classroom, studentId } = cancelInfo; // フロントエンドから渡される情報

    // 統合予約シートを取得
    const integratedSheet = getSheetByName(CONSTANTS.SHEET_NAMES.INTEGRATED_RESERVATIONS);
    if (!integratedSheet) throw new Error('統合予約シートが見つかりません。');

    // 1回のシート読み込みで全データを取得（効率化）
    const allData = integratedSheet.getDataRange().getValues();
    if (allData.length === 0) throw new Error('統合予約シートにデータがありません。');

    const header = allData[0];
    const headerMap = createHeaderMap(header);

    // 統合予約シートの列インデックス（新しいデータモデル）
    const reservationIdColIdx = headerMap.get(CONSTANTS.HEADERS.RESERVATION_ID);
    const studentIdColIdx = headerMap.get(CONSTANTS.HEADERS.STUDENT_ID);
    const dateColIdx = headerMap.get(CONSTANTS.HEADERS.DATE);
    const statusColIdx = headerMap.get(CONSTANTS.HEADERS.STATUS);
    const classroomColIdx = headerMap.get(CONSTANTS.HEADERS.CLASSROOM);

    if (reservationIdColIdx === undefined || studentIdColIdx === undefined) {
      throw new Error('必要なヘッダー（予約ID, 生徒ID）が見つかりません。');
    }

    // データ行から対象の予約を検索
    const dataRows = allData.slice(1);
    const targetRowData = dataRows.find(
      row => row[reservationIdColIdx] === reservationId && row[classroomColIdx] === classroom,
    );
    if (!targetRowData) throw new Error('キャンセル対象の予約が見つかりませんでした。');

    const targetRowIndex = dataRows.indexOf(targetRowData) + 2; // 1-based + header row
    const ownerId = targetRowData[studentIdColIdx];
    if (ownerId !== studentId) {
      throw new Error('この予約をキャンセルする権限がありません。');
    }

    const originalValues = targetRowData;
    const targetDate = originalValues[dateColIdx]; // キャンセルされた予約の日付を取得

    // ユーザー情報を取得して、ログと通知をより具体的にする
    const rosterSheet = getSheetByName(CONSTANTS.SHEET_NAMES.ROSTER);
    const userInfo = { realName: '(不明)', displayName: '(不明)' };
    if (rosterSheet) {
      // 効率化：生徒名簿も1回の読み込みで取得
      const rosterAllData = rosterSheet.getDataRange().getValues();
      if (rosterAllData.length > 1) {
        const rosterHeader = rosterAllData[0];
        const rosterHeaderMap = createHeaderMap(rosterHeader);
        const rosterStudentIdCol = rosterHeaderMap.get(CONSTANTS.HEADERS.STUDENT_ID);

        if (rosterStudentIdCol !== undefined) {
          const userRow = rosterAllData.slice(1).find(row => row[rosterStudentIdCol] === studentId);
          if (userRow) {
            userInfo.realName =
              userRow[rosterHeaderMap.get(CONSTANTS.HEADERS.REAL_NAME)] || '(不明)';
            userInfo.displayName =
              userRow[rosterHeaderMap.get(CONSTANTS.HEADERS.NICKNAME)] || userInfo.realName;
          }
        }
      }
    }

    // メモリ上でステータスを「キャンセル」に更新
    allData[targetRowIndex - 1][statusColIdx] = CONSTANTS.STATUS.CANCEL; // allDataの該当行を更新

    // 更新されたデータを一括でシートに書き戻し
    integratedSheet.clear();
    integratedSheet.getRange(1, 1, allData.length, allData[0].length).setValues(allData);

    SpreadsheetApp.flush();

    // 統合予約シートの更新後、キャッシュを再構築
    rebuildAllReservationsCache();

    // ログと通知
    const cancelMessage = cancelInfo.cancelMessage || '';
    const messageLog = cancelMessage ? `, Message: ${cancelMessage}` : '';
    const logDetails = `Classroom: ${classroom}, ReservationID: ${reservationId}${messageLog}`;
    logActivity(
      studentId,
      CONSTANTS.LOG_ACTIONS.RESERVATION_CANCEL,
      CONSTANTS.MESSAGES.SUCCESS,
      logDetails,
    );

    const subject = `予約キャンセル (${classroom}) - ${userInfo.displayName}様`;
    const messageSection = cancelMessage ? `\n先生へのメッセージ: ${cancelMessage}\n` : '';
    const body =
      `予約がキャンセルされました。

` +
      `本名: ${userInfo.realName}
` +
      `ニックネーム: ${userInfo.displayName}

` +
      `教室: ${classroom}
` +
      `日付: ${Utilities.formatDate(targetDate, getSpreadsheetTimezone(), 'yyyy/MM/dd')}
` +
      `予約ID: ${reservationId}${messageSection}
` +
      `詳細はスプレッドシートを確認してください。`;
    sendAdminNotification(subject, body);

    return {
      success: true,
      message: '予約をキャンセルしました。',
    };
  } catch (err) {
    logActivity(
      cancelInfo.studentId,
      CONSTANTS.LOG_ACTIONS.RESERVATION_CANCEL,
      CONSTANTS.MESSAGES.ERROR,
      `Error: ${err.message}`,
    );
    Logger.log(`cancelReservation Error: ${err.message}\n${err.stack}`);
    return BackendErrorHandler.handle(err, 'cancelReservation');
  } finally {
    lock.releaseLock();
  }
}

/**
 * 予約の詳細情報を一括で更新します。
 * @param {object} details - 予約詳細情報。
 * @returns {object} - 処理結果。
 */
function updateReservationDetails(details) {
  const lock = LockService.getScriptLock();
  lock.waitLock(CONSTANTS.LIMITS.LOCK_WAIT_TIME_MS);
  try {
    const { reservationId, classroom } = details;
    const masterData = getAccountingMasterData().data;
    const classroomRule = masterData.find(
      item =>
        item['対象教室'] &&
        item['対象教室'].includes(classroom) &&
        item['種別'] === CONSTANTS.ITEM_TYPES.TUITION,
    );

    if (classroomRule && classroomRule['単位'] === CONSTANTS.UNITS.THIRTY_MIN) {
      _validateTimeBasedReservation(details.startTime, details.endTime, classroomRule);
    }

    // 統合予約シートを取得
    const integratedSheet = getSheetByName(CONSTANTS.SHEET_NAMES.INTEGRATED_RESERVATIONS);
    if (!integratedSheet) throw new Error('統合予約シートが見つかりません。');

    // 1回のシート読み込みで全データを取得（効率化）
    const allData = integratedSheet.getDataRange().getValues();
    if (allData.length === 0) throw new Error('統合予約シートにデータがありません。');

    const header = allData[0];
    const headerMap = createHeaderMap(header);

    // 統合予約シートの列インデックス（新しいデータモデル）
    const reservationIdColIdx = headerMap.get(CONSTANTS.HEADERS.RESERVATION_ID);
    const studentIdColIdx = headerMap.get(CONSTANTS.HEADERS.STUDENT_ID);
    const startTimeColIdx = headerMap.get(CONSTANTS.HEADERS.START_TIME);
    const endTimeColIdx = headerMap.get(CONSTANTS.HEADERS.END_TIME);
    const chiselRentalColIdx = headerMap.get(CONSTANTS.HEADERS.CHISEL_RENTAL);
    const wipColIdx = headerMap.get(CONSTANTS.HEADERS.WORK_IN_PROGRESS);
    const orderColIdx = headerMap.get(CONSTANTS.HEADERS.ORDER);
    const messageColIdx = headerMap.get(CONSTANTS.HEADERS.MESSAGE_TO_TEACHER);
    const firstLectureColIdx = headerMap.get(CONSTANTS.HEADERS.FIRST_LECTURE);

    if (reservationIdColIdx === undefined) throw new Error('ヘッダー「予約ID」が見つかりません。');

    // 予約IDで対象行を検索
    const targetRowIndex = findRowIndexByValue(
      integratedSheet,
      reservationIdColIdx + 1,
      reservationId,
    );
    if (targetRowIndex === -1)
      throw new Error(`予約ID「${reservationId}」が見つかりませんでした。`);

    // メモリ上で各列を更新
    const rowData = allData[targetRowIndex - 1]; // allDataの該当行

    if (startTimeColIdx !== undefined && details.startTime) {
      rowData[startTimeColIdx] = new Date(`1970-01-01T${details.startTime}:00`);
    }

    if (endTimeColIdx !== undefined && details.endTime) {
      rowData[endTimeColIdx] = new Date(`1970-01-01T${details.endTime}:00`);
    }

    if (chiselRentalColIdx !== undefined) {
      rowData[chiselRentalColIdx] = details.chiselRental || false;
    }

    if (firstLectureColIdx !== undefined) {
      rowData[firstLectureColIdx] = details.firstLecture || false;
    }

    if (wipColIdx !== undefined) {
      let workInProgress = details.workInProgress || '';
      if (details.materialInfo) {
        workInProgress += CONSTANTS.SYSTEM.MATERIAL_INFO_PREFIX + details.materialInfo;
      }
      rowData[wipColIdx] = workInProgress;
    }

    if (orderColIdx !== undefined) {
      rowData[orderColIdx] = details.order || '';
    }

    if (messageColIdx !== undefined) {
      rowData[messageColIdx] = details.messageToTeacher || '';
    }

    // 更新されたデータを一括でシートに書き戻し
    integratedSheet.clear();
    integratedSheet.getRange(1, 1, allData.length, allData[0].length).setValues(allData);

    // フォーマット設定
    if (startTimeColIdx !== undefined && details.startTime) {
      integratedSheet.getRange(targetRowIndex, startTimeColIdx + 1).setNumberFormat('HH:mm');
    }
    if (endTimeColIdx !== undefined && details.endTime) {
      integratedSheet.getRange(targetRowIndex, endTimeColIdx + 1).setNumberFormat('HH:mm');
    }

    SpreadsheetApp.flush();

    // 統合予約シートの更新後、キャッシュを再構築
    rebuildAllReservationsCache();

    // 【NF-12】Update cache incrementally (統合予約シート対応)
    const studentId = integratedSheet.getRange(targetRowIndex, studentIdColIdx + 1).getValue();
    // 統合予約シートの更新はrebuildAllReservationsCache()で完了
    // 予約データは現在CacheServiceで一元管理されているため、個別キャッシュ更新は不要

    // ログ記録
    const messageToTeacher = details.messageToTeacher || '';
    const messageLog = messageToTeacher ? `, Message: ${messageToTeacher}` : '';
    const logDetails = `ReservationID: ${details.reservationId}, Classroom: ${details.classroom}${messageLog}`;
    logActivity(studentId, '予約詳細更新', CONSTANTS.MESSAGES.SUCCESS, logDetails);

    return createApiResponse(true, {
      message: '予約内容を更新しました。',
    });
  } catch (err) {
    logActivity(
      details.studentId || '(N/A)',
      '予約詳細更新',
      CONSTANTS.MESSAGES.ERROR,
      `Error: ${err.message}`,
    );
    Logger.log(`updateReservationDetails Error: ${err.message}\n${err.stack}`);
    return BackendErrorHandler.handle(err, 'updateReservationDetails');
  } finally {
    lock.releaseLock();
  }
}

/**
 * [設計思想] フロントエンドは「ユーザーが何を選択したか」という入力情報のみを渡し、
 * バックエンドが料金マスタと照合して金額を再計算・検証する責務を持つ。
 * これにより、フロントエンドのバグが誤った会計データを生成することを防ぎ、システムの堅牢性を高める。
 * @param {object} payload - フロントエンドから渡される会計情報ペイロード。
 * @param {string} payload.reservationId - 予約ID。
 * @param {string} payload.classroom - 教室名。
 * @param {string} payload.studentId - 生徒ID。
 * @param {object} payload.userInput - ユーザーの入力内容。
 * @returns {object} - 処理結果。
 */
function saveAccountingDetails(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(CONSTANTS.LIMITS.LOCK_WAIT_TIME_MS);
  try {
    const { reservationId, classroom, studentId, userInput } = payload;
    if (!reservationId || !classroom || !studentId || !userInput) {
      throw new Error('会計情報が不足しています。');
    }

    const sheet = getSheetByName(CONSTANTS.SHEET_NAMES.INTEGRATED_RESERVATIONS);
    if (!sheet) throw new Error(`統合予約シートが見つかりません。`);

    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headerMap = createHeaderMap(header);
    const reservationIdColIdx = headerMap.get(CONSTANTS.HEADERS.RESERVATION_ID);
    const studentIdColIdx = headerMap.get(CONSTANTS.HEADERS.STUDENT_ID);

    const targetRowIndex = findRowIndexByValue(sheet, reservationIdColIdx + 1, reservationId);
    if (targetRowIndex === -1)
      throw new Error(`予約ID「${reservationId}」が見つかりませんでした。`);

    const actualStudentId = sheet.getRange(targetRowIndex, studentIdColIdx + 1).getValue();
    if (actualStudentId !== studentId) {
      throw new Error('この予約の会計処理を行う権限がありません。');
    }

    // --- バックエンドでの再計算・検証ロジック ---
    const masterData = getAccountingMasterData().data;
    const finalAccountingDetails = {
      tuition: { items: [], subtotal: 0 },
      sales: { items: [], subtotal: 0 },
      grandTotal: 0,
      paymentMethod: userInput.paymentMethod || CONSTANTS.PAYMENT_DISPLAY.CASH,
    };

    // 授業料の計算
    (userInput.tuitionItems || []).forEach(itemName => {
      const masterItem = masterData.find(
        m => m['項目名'] === itemName && m['種別'] === CONSTANTS.ITEM_TYPES.TUITION,
      );
      if (masterItem) {
        const price = Number(masterItem['単価']);
        finalAccountingDetails.tuition.items.push({ name: itemName, price: price });
        finalAccountingDetails.tuition.subtotal += price;
      }
    });

    // 時間制授業料の計算
    if (userInput.timeBased) {
      const { startTime, endTime, breakMinutes, discountMinutes } = userInput.timeBased;
      const classroomRule = masterData.find(
        item =>
          item['対象教室'] &&
          item['対象教室'].includes(classroom) &&
          item['種別'] === CONSTANTS.ITEM_TYPES.TUITION &&
          item['単位'] === CONSTANTS.UNITS.THIRTY_MIN,
      );
      if (classroomRule && startTime && endTime && startTime < endTime) {
        const start = new Date(`1970-01-01T${startTime}:00`);
        const end = new Date(`1970-01-01T${endTime}:00`);
        const diffMinutes = (end - start) / 60000 - (breakMinutes || 0);
        if (diffMinutes > 0) {
          const billableUnits = Math.ceil(diffMinutes / 30);
          const price = billableUnits * Number(classroomRule['単価']);
          finalAccountingDetails.tuition.items.push({
            name: `授業料 (${startTime} - ${endTime})`,
            price: price,
          });
          finalAccountingDetails.tuition.subtotal += price;
        }
      }
      // 割引の計算
      if (discountMinutes > 0) {
        const discountRule = masterData.find(item => item['項目名'] === CONSTANTS.ITEMS.DISCOUNT);
        if (discountRule) {
          const discountAmount = (discountMinutes / 30) * Math.abs(Number(discountRule['単価']));
          finalAccountingDetails.tuition.items.push({
            name: `${CONSTANTS.ITEMS.DISCOUNT} (${discountMinutes}分)`,
            price: -discountAmount,
          });
          finalAccountingDetails.tuition.subtotal -= discountAmount;
        }
      }
    }

    // 物販・材料費の計算
    (userInput.salesItems || []).forEach(item => {
      const masterItem = masterData.find(
        m =>
          m['項目名'] === item.name &&
          (m['種別'] === CONSTANTS.ITEM_TYPES.SALES || m['種別'] === CONSTANTS.ITEM_TYPES.MATERIAL),
      );
      if (masterItem) {
        // マスタに存在する商品
        const price = item.price || Number(masterItem['単価']); // 材料費のように価格が計算される場合を考慮
        finalAccountingDetails.sales.items.push({ name: item.name, price: price });
        finalAccountingDetails.sales.subtotal += price;
      } else if (item.price) {
        // 自由入力項目
        const price = Number(item.price);
        finalAccountingDetails.sales.items.push({ name: item.name, price: price });
        finalAccountingDetails.sales.subtotal += price;
      }
    });

    finalAccountingDetails.grandTotal =
      finalAccountingDetails.tuition.subtotal + finalAccountingDetails.sales.subtotal;
    // --- ここまで ---

    // 1. 時刻などをシートに書き戻す
    if (userInput.timeBased) {
      const { startTime, endTime } = userInput.timeBased;
      if (headerMap.has(CONSTANTS.HEADERS.START_TIME))
        sheet
          .getRange(targetRowIndex, headerMap.get(CONSTANTS.HEADERS.START_TIME) + 1)
          .setValue(startTime ? new Date(`1970-01-01T${startTime}`) : null)
          .setNumberFormat('HH:mm');
      if (headerMap.has(CONSTANTS.HEADERS.END_TIME))
        sheet
          .getRange(targetRowIndex, headerMap.get(CONSTANTS.HEADERS.END_TIME) + 1)
          .setValue(endTime ? new Date(`1970-01-01T${endTime}`) : null)
          .setNumberFormat('HH:mm');
    }

    // 2. 受講時間とガントチャートを再計算 (レガシー機能のためコメントアウト)
    // updateBillableTime(sheet, targetRowIndex);
    // updateGanttChart(sheet, targetRowIndex);

    // 3. 検証済みの会計詳細JSONを保存
    const accountingDetailsColIdx = headerMap.get(CONSTANTS.HEADERS.ACCOUNTING_DETAILS);
    if (accountingDetailsColIdx === undefined)
      throw new Error('ヘッダー「会計詳細」が見つかりません。');
    sheet
      .getRange(targetRowIndex, accountingDetailsColIdx + 1)
      .setValue(JSON.stringify(finalAccountingDetails));

    SpreadsheetApp.flush();

    // 4. 統合予約シートの更新後、全てのキャッシュを再構築
    //    会計が完了した予約は「未来の予約」ではなく「過去の記録」となるため、
    //    全キャッシュを再構築してデータの整合性を保つ。

    // --- ここからが追加の後続処理 ---
    const reservationDataRow = sheet
      .getRange(targetRowIndex, 1, 1, sheet.getLastColumn())
      .getValues()[0];

    // 5. 売上ログへの転記
    _logSalesForSingleReservation(reservationDataRow, headerMap, classroom, finalAccountingDetails);

    // 6. 年別「きろく_YYYY」キャッシュに会計情報を含めて追加
    _updateRecordCacheForSingleReservation(
      reservationDataRow,
      headerMap,
      classroom,
      finalAccountingDetails,
    );

    // 7. サマリーの更新
    const targetDate = reservationDataRow[headerMap.get(CONSTANTS.HEADERS.DATE)];
    if (targetDate instanceof Date) {
      // サマリーシート更新は廃止 (05-3_Backend_AvailableSlots.jsに置き換え)
      // updateSummaryAndForm(classroom, targetDate);
    }

    // 8. 最新の参加履歴を取得して返す
    const historyResult = getParticipationHistory(actualStudentId, null, null);
    if (!historyResult.success) {
      // 履歴取得に失敗しても、メインの会計処理は成功として扱う
      Logger.log(`会計処理後の履歴取得に失敗: ${historyResult.message}`);
    }

    // [追加] 9. 更新されたサマリーから、最新の空き枠情報を取得する
    let updatedSlotsForClassroom = [];
    try {
      const slotsResult = getAvailableSlots();
      updatedSlotsForClassroom = slotsResult.success ? slotsResult.data : [];
    } catch (e) {
      Logger.log(`会計処理後の予約枠取得に失敗: ${e.message}`);
      updatedSlotsForClassroom = [];
    }

    // 9. 【NEW】会計済みの予約をアーカイブし、元の行を削除する
    _archiveSingleReservation(sheet, targetRowIndex, reservationDataRow, classroom);

    // ログと通知
    const logDetails = `Classroom: ${classroom}, ReservationID: ${reservationId}, Total: ${finalAccountingDetails.grandTotal}`;
    logActivity(studentId, '会計記録保存', CONSTANTS.MESSAGES.SUCCESS, logDetails);

    const subject = `会計記録 (${classroom})`;
    const body =
      `会計が記録されました。

` +
      `教室: ${classroom}
` +
      `予約ID: ${reservationId}
` +
      `生徒ID: ${studentId}
` +
      `合計金額: ${finalAccountingDetails.grandTotal.toLocaleString()} 円

` +
      `詳細はスプレッドシートを確認してください。`;
    sendAdminNotification(subject, body);

    rebuildAllReservationsCache();

    // [変更] 戻り値に updatedSlots を追加
    return createApiResponse(true, {
      newHistory: historyResult.history,
      newHistoryTotal: historyResult.total,
      updatedSlots: updatedSlotsForClassroom, // <--- これを追加
      message: '会計処理と関連データの更新がすべて完了しました。',
    });
  } catch (err) {
    logActivity(
      payload.studentId,
      '会計記録保存',
      CONSTANTS.MESSAGES.ERROR,
      `Error: ${err.message}`,
    );
    Logger.log(`saveAccountingDetails Error: ${err.message}\n${err.stack}`);
    return BackendErrorHandler.handle(err, 'saveAccountingDetails');
  } finally {
    lock.releaseLock();
  }
}

/**
 * [設計思想] 後続処理でエラーが発生してもメインの会計処理は成功と見なすため、
 * この関数内でのエラーはログに記録するに留め、上位にはスローしない。
 * @private
 * @param {Array} reservationDataRow - 売上ログを生成する対象の予約データ行。
 * @param {Map<string, number>} headerMap - 予約シートのヘッダーマップ。
 * @param {string} classroomName - 教室名。
 * @param {object} accountingDetails - 計算済みの会計詳細オブジェクト。
 */
function _logSalesForSingleReservation(
  reservationDataRow,
  headerMap,
  classroomName,
  accountingDetails,
) {
  try {
    const baseInfo = {
      date: reservationDataRow[headerMap.get(CONSTANTS.HEADERS.DATE)],
      studentId: reservationDataRow[headerMap.get(CONSTANTS.HEADERS.STUDENT_ID)],
      name: reservationDataRow[headerMap.get(CONSTANTS.HEADERS.NAME)],
      classroom: classroomName,
      venue: reservationDataRow[headerMap.get(CONSTANTS.HEADERS.VENUE)] || '',
      paymentMethod: accountingDetails.paymentMethod || '不明',
    };

    const rowsToTransfer = [];
    (accountingDetails.tuition?.items || []).forEach(item => {
      rowsToTransfer.push(
        createSalesRow(baseInfo, CONSTANTS.ITEM_TYPES.TUITION, item.name, item.price),
      );
    });
    (accountingDetails.sales?.items || []).forEach(item => {
      rowsToTransfer.push(
        createSalesRow(baseInfo, CONSTANTS.ITEM_TYPES.SALES, item.name, item.price),
      );
    });

    if (rowsToTransfer.length > 0) {
      const salesSpreadsheet = SpreadsheetApp.openById(SALES_SPREADSHEET_ID);
      const salesSheet = salesSpreadsheet.getSheetByName('売上ログ');
      if (!salesSheet)
        throw new Error('売上スプレッドシートに「売上ログ」シートが見つかりません。');
      salesSheet
        .getRange(salesSheet.getLastRow() + 1, 1, rowsToTransfer.length, rowsToTransfer[0].length)
        .setValues(rowsToTransfer);
    }
  } catch (err) {
    Logger.log(`_logSalesForSingleReservation Error: ${err.message}\n${err.stack}`);
  }
}

/**
 * [設計思想] 後続処理でエラーが発生してもメインの会計処理は成功と見なすため、
 * この関数内でのエラーはログに記録するに留め、上位にはスローしない。
 * @private
 * @param {Array} reservationDataRow - 年別きろく_YYYYキャッシュを更新する対象の予約データ行。
 * @param {Map<string, number>} headerMap - 予約シートのヘッダーマップ。
 * @param {string} classroomName - 教室名。
 * @param {object} accountingDetails - 追加する会計詳細オブジェクト。
 */
function _updateRecordCacheForSingleReservation(
  reservationDataRow,
  headerMap,
  classroomName,
  accountingDetails,
) {
  try {
    const rosterSheet = getSheetByName(CONSTANTS.SHEET_NAMES.ROSTER);
    if (!rosterSheet) return;

    const studentId = reservationDataRow[headerMap.get(CONSTANTS.HEADERS.STUDENT_ID)];
    const date = reservationDataRow[headerMap.get(CONSTANTS.HEADERS.DATE)];
    if (!studentId || !(date instanceof Date)) return;

    const rosterHeader = rosterSheet.getRange(1, 1, 1, rosterSheet.getLastColumn()).getValues()[0];
    const rosterHeaderMap = createHeaderMap(rosterHeader);
    const studentIdColRoster = rosterHeaderMap.get(CONSTANTS.HEADERS.STUDENT_ID);
    if (studentIdColRoster === undefined) return;

    const rosterData = rosterSheet.getRange(2, 1, rosterSheet.getLastRow() - 1, 1).getValues();
    const targetRosterRow_0based = rosterData.findIndex(row => row[0] === studentId);
    if (targetRosterRow_0based === -1) return;
    const targetRosterRow_1based = targetRosterRow_0based + 2;

    const year = date.getFullYear();
    const colName = `きろく_${year}`;
    let recordColIdx = rosterHeaderMap.get(colName);

    if (recordColIdx === undefined) {
      const lastCol = rosterSheet.getLastColumn();
      rosterSheet.insertColumnAfter(lastCol);
      recordColIdx = lastCol;
      rosterSheet.getRange(1, recordColIdx + 1).setValue(colName);
    }

    const archiveSheetName = CONSTANTS.SYSTEM.ARCHIVE_PREFIX + classroomName.slice(0, -2);
    const newRecord = {
      reservationId: reservationDataRow[headerMap.get(CONSTANTS.HEADERS.RESERVATION_ID)] || '',
      sheetName: archiveSheetName,
      date: Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      classroom: classroomName,
      venue: reservationDataRow[headerMap.get(CONSTANTS.HEADERS.VENUE)] || '',
      workInProgress: reservationDataRow[headerMap.get(CONSTANTS.HEADERS.WORK_IN_PROGRESS)] || '',
      accountingDetails: JSON.stringify(accountingDetails),
    };

    const cell = rosterSheet.getRange(targetRosterRow_1based, recordColIdx + 1);
    const existingJson = cell.getValue();
    let records = [];
    if (existingJson) {
      try {
        records = JSON.parse(existingJson);
      } catch {
        /* 不正なJSONは上書き */
      }
    }

    const recordExists = records.some(r => r.reservationId === newRecord.reservationId);
    if (!recordExists) {
      records.push(newRecord);
      records.sort((a, b) => new Date(b.date) - new Date(a.date));
      cell.setValue(JSON.stringify(records));
    }
  } catch (err) {
    Logger.log(`_updateRecordCacheForSingleReservation Error: ${err.message}\n${err.stack}`);
  }
}

/**
 * [設計思想] 後続処理でエラーが発生してもメインの会計処理は成功と見なすため、
 * この関数内でのエラーはログに記録するに留め、上位にはスローしない。
 * @private
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sourceSheet - 予約シート
 * @param {number} rowIndex - アーカイブ対象の行番号
 * @param {Array} reservationDataRow - アーカイブ対象の行データ
 * @param {string} classroomName - アーカイブ先の教室名
 */
function _archiveSingleReservation(sourceSheet, rowIndex, reservationDataRow, classroomName) {
  try {
    const archiveSheetName = CONSTANTS.SYSTEM.ARCHIVE_PREFIX + classroomName.slice(0, -2);
    const archiveSheet = getSheetByName(archiveSheetName);

    if (!archiveSheet) {
      Logger.log(
        `アーカイブシート「${archiveSheetName}」が見つかりません。アーカイブ処理をスキップします。`,
      );
      return;
    }

    // 1. アーカイブシートに転記
    archiveSheet
      .getRange(archiveSheet.getLastRow() + 1, 1, 1, reservationDataRow.length)
      .setValues([reservationDataRow]);
    formatSheetWithBordersSafely(archiveSheet);

    // 2. 元の予約シートから行を削除
    sourceSheet.deleteRow(rowIndex);
  } catch (err) {
    Logger.log(`_archiveSingleReservation Error: ${err.message}\n${err.stack}`);
  }
}

/**
 * 【改修】指定された予約の制作メモを更新し、最新の参加履歴を返す。
 * @param {string} reservationId - 予約ID
 * @param {string} sheetName - 予約が記録されているシート名
 * @param {string} newMemo - 新しい制作メモの内容
 * @param {string} studentId - メモを更新する対象の生徒ID
 * @returns {object} - { success: boolean, history?: object[], total?: number, message?: string }
 */
function updateMemoAndGetLatestHistory(reservationId, sheetName, newMemo, studentId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(CONSTANTS.LIMITS.LOCK_WAIT_TIME_MS);
  try {
    // 1. 予約シートの制作メモを更新
    const sheet = getSheetByName(sheetName);
    if (!sheet) throw new Error(`シート「${sheetName}」が見つかりません。`);

    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headerMap = createHeaderMap(header);
    const reservationIdColIdx = headerMap.get(CONSTANTS.HEADERS.RESERVATION_ID);
    const wipColIdx = headerMap.get(CONSTANTS.HEADERS.WORK_IN_PROGRESS);

    if (reservationIdColIdx === undefined || wipColIdx === undefined) {
      throw new Error(`必要なヘッダー（予約ID, 制作メモ）が見つかりません。`);
    }

    const targetRowIndex = findRowIndexByValue(sheet, reservationIdColIdx + 1, reservationId);
    if (targetRowIndex === -1) {
      throw new Error(`予約ID「${reservationId}」がシート「${sheetName}」で見つかりませんでした。`);
    }

    sheet.getRange(targetRowIndex, wipColIdx + 1).setValue(newMemo);
    SpreadsheetApp.flush();

    // 2. 生徒名簿の年別きろくキャッシュを更新
    const rosterSheet = getSheetByName(CONSTANTS.SHEET_NAMES.ROSTER);
    if (rosterSheet) {
      const rosterHeader = rosterSheet
        .getRange(1, 1, 1, rosterSheet.getLastColumn())
        .getValues()[0];
      const rosterHeaderMap = createHeaderMap(rosterHeader);
      const studentIdCol = rosterHeaderMap.get(CONSTANTS.HEADERS.STUDENT_ID);

      if (studentIdCol !== undefined) {
        const rosterData = rosterSheet
          .getRange(2, 1, rosterSheet.getLastRow() - 1, rosterSheet.getLastColumn())
          .getValues();
        const userRowIndex = rosterData.findIndex(row => row[studentIdCol] === studentId);

        if (userRowIndex !== -1) {
          // 更新された予約の年を取得
          const updatedDate = new Date(
            sheet.getRange(targetRowIndex, headerMap.get(CONSTANTS.HEADERS.DATE) + 1).getValue(),
          );
          const year = updatedDate.getFullYear();
          const yearCacheCol = rosterHeaderMap.get(`きろく_${year}`);

          if (yearCacheCol !== undefined) {
            // 最新の履歴を取得し、該当年の履歴のみフィルタリング
            const historyResult = getParticipationHistory(studentId, null, null);
            if (historyResult.success) {
              const yearHistory = (historyResult.history || []).filter(h => {
                const historyDate = new Date(h.date);
                return historyDate.getFullYear() === year;
              });
              const yearHistoryCache = JSON.stringify(yearHistory);
              rosterSheet.getRange(userRowIndex + 2, yearCacheCol + 1).setValue(yearHistoryCache);
            }
          }
        }
      }
    }

    logActivity(
      studentId,
      '制作メモ更新',
      CONSTANTS.MESSAGES.SUCCESS,
      `ResID: ${reservationId}, Sheet: ${sheetName}, Memo: ${newMemo.length}文字`,
    );
    return getParticipationHistory(studentId, null, null);
  } catch (err) {
    const details = `ResID: ${reservationId}, Sheet: ${sheetName}, Error: ${err.message}`;
    logActivity(studentId, '制作メモ更新', CONSTANTS.MESSAGES.ERROR, details);
    Logger.log(`updateMemo Error: ${err.message}\n${err.stack}`);
    return BackendErrorHandler.handle(err, 'updateMemo');
  } finally {
    lock.releaseLock();
  }
}
