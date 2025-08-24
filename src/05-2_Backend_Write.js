/**
 * =================================================================
 * 【ファイル名】: 05-2_Backend_Write.gs
 * 【バージョン】: 2.0
 * 【役割】: WebAppからのデータ書き込み・更新要求（Write）と、
 * それに付随する検証ロジックに特化したバックエンド機能。
 * 【構成】: 18ファイル構成のうちの7番目（00_Constants.js、08_ErrorHandler.jsを含む）
 * 【v2.0での変更点】:
 * - フェーズ1リファクタリング: 統一定数ファイル（00_Constants.js）から定数を参照
 * - 旧定数（TOKYO_CLASSROOM_NAME等）を統一定数（CONSTANTS.CLASSROOMS.TOKYO等）に移行
 * - 定数の重複定義を削除し、保守性を向上
 * 【v1.9での変更点】:
 * - 設計の簡素化: 制作メモ更新時に統合「きろくキャッシュ」列を削除し、
 *   年別「きろく_YYYY」列のみを更新するよう修正。元の設計に戻す。
 * 【v1.8での変更点】:
 * - 制作メモ更新時の年別キャッシュ更新: updateMemoAndGetLatestHistory関数で、
 *   統合きろくキャッシュに加えて年別キャッシュ（きろく_YYYY）も同時に更新。
 * 【v1.7での変更点】:
 * - 制作メモ更新機能の強化: updateMemoAndGetLatestHistory関数で、
 *   予約シートと年別きろく_YYYYキャッシュの両方を同時に更新するよう改善。
 * - ログ記録の詳細化: 更新されたメモの文字数も記録。
 * 【v1.1での変更点】:
 * - FE-16: saveAccountingDetailsを修正。会計処理時に、時刻やオプションの値を
 * 予約シート本体に書き戻し、受講時間とガントチャートを再計算・再描画する機能を追加。
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
  lock.waitLock(LOCK_WAIT_TIME_MS);
  try {
    const { classroom, date, user, options } = reservationInfo;
    const { startTime, endTime } = options;

    // 統合予約シートを取得
    const integratedSheet = getSheetByName('統合予約シート');
    if (!integratedSheet) throw new Error('統合予約シートが見つかりません。');

    const masterData = getAccountingMasterData().data;
    const classroomRule = masterData.find(
      item =>
        item['対象教室'] &&
        item['対象教室'].includes(classroom) &&
        item['種別'] === ITEM_TYPE_TUITION,
    );

    if (classroomRule && classroomRule['単位'] === UNIT_30_MIN) {
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
    const reservationIdColIdx = headerMap.get('予約ID');
    const studentIdColIdx = headerMap.get('生徒ID');
    const dateColIdx = headerMap.get('日付');
    const classroomColIdx = headerMap.get('教室');
    const venueColIdx = headerMap.get('会場');
    const startTimeColIdx = headerMap.get('開始時刻');
    const endTimeColIdx = headerMap.get('終了時刻');
    const statusColIdx = headerMap.get('ステータス');
    const chiselRentalColIdx = headerMap.get('彫刻刻レンタル');
    const firstLectureColIdx = headerMap.get('初講');
    const wipColIdx = headerMap.get('制作メモ');
    const orderColIdx = headerMap.get('order');
    const messageColIdx = headerMap.get('メッセージ');

    const capacity = CLASSROOM_CAPACITIES[classroom] || CLASSROOM_CAPACITIES[CONSTANTS.CLASSROOMS.TOKYO];
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
        rowStatus !== STATUS_CANCEL &&
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

        if (rStartHour < TSUKUBA_MORNING_SESSION_END_HOUR) morningCount++;
        if (rEndHour >= TSUKUBA_MORNING_SESSION_END_HOUR) afternoonCount++;
      });

      const morningFull = morningCount >= capacity;
      const afternoonFull = afternoonCount >= capacity;

      if (reqStartHour < TSUKUBA_MORNING_SESSION_END_HOUR && morningFull) isFull = true;
      if (reqEndHour >= TSUKUBA_MORNING_SESSION_END_HOUR && afternoonFull) isFull = true;
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
    newRowData[statusColIdx] = isFull ? STATUS_WAITING : '確定';

    // 時刻設定（教室別のロジック）
    if (classroom === CONSTANTS.CLASSROOMS.TOKYO) {
      const master = getAccountingMasterData().data;
      const tokyoRule = master.find(
        item =>
          item['項目名'] === CONSTANTS.ITEMS.MAIN_LECTURE && item['対象教室'] === CONSTANTS.CLASSROOMS.TOKYO,
      );
      if (tokyoRule) {
        let finalStartTime = tokyoRule[HEADER_CLASS_START];
        let finalEndTime = tokyoRule[HEADER_CLASS_END];
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
      workInProgress += MATERIAL_INFO_PREFIX + options.materialInfo;
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

    // 【NF-12】Construct new booking object for cache (統合予約シート対応)
    const timeToString = date =>
      date instanceof Date ? Utilities.formatDate(date, getSpreadsheetTimezone(), 'HH:mm') : null;
    const newBookingObject = {
      reservationId: newReservationId,
      classroom: classroom,
      date: Utilities.formatDate(targetDate, getSpreadsheetTimezone(), 'yyyy-MM-dd'),
      status: isFull ? STATUS_WAITING : '確定',
      venue: venue,
      startTime: timeToString(newRowData[startTimeColIdx]),
      endTime: timeToString(newRowData[endTimeColIdx]),
      chiselRental: options.chiselRental || false,
      firstLecture: options.firstLecture || false,
      workInProgress: workInProgress,
      order: options.order || '',
      message: options.messageToTeacher || '',
      // レガシー互換性のため
      isWaiting: isFull,
      messageToTeacher: options.messageToTeacher || '',
      accountingDone: false,
      accountingDetails: '',
    };
    const newBookingsCache = _updateFutureBookingsCacheIncrementally(
      user.studentId,
      'add',
      newBookingObject,
    );

    // ログと通知
    const message = !isFull ? '予約が完了しました。' : '満席のため、キャンセル待ちで登録しました。';
    const messageToTeacher = options.messageToTeacher || '';
    const messageLog = messageToTeacher ? `, Message: ${messageToTeacher}` : '';
    const logDetails = `Classroom: ${classroom}, Date: ${date}, Status: ${isFull ? 'Waiting' : 'Confirmed'}, ReservationID: ${newReservationId}${messageLog}`;
    logActivity(user.studentId, '予約作成', '成功', logDetails);

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

    return { success: true, message: message, newBookingsCache: newBookingsCache };
  } catch (err) {
    logActivity(reservationInfo.user.studentId, '予約作成', 'エラー', `Error: ${err.message}`);
    Logger.log(`makeReservation Error: ${err.message}\n${err.stack}`);
    return { success: false, message: `予約処理中にエラーが発生しました。\n${err.message}` };
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
  lock.waitLock(LOCK_WAIT_TIME_MS);

  try {
    const { reservationId, classroom, studentId } = cancelInfo; // フロントエンドから渡される情報

    // 統合予約シートを取得
    const integratedSheet = getSheetByName('統合予約シート');
    if (!integratedSheet) throw new Error('統合予約シートが見つかりません。');

    // 1回のシート読み込みで全データを取得（効率化）
    const allData = integratedSheet.getDataRange().getValues();
    if (allData.length === 0) throw new Error('統合予約シートにデータがありません。');

    const header = allData[0];
    const headerMap = createHeaderMap(header);

    // 統合予約シートの列インデックス（新しいデータモデル）
    const reservationIdColIdx = headerMap.get('予約ID');
    const studentIdColIdx = headerMap.get('生徒ID');
    const dateColIdx = headerMap.get('日付');
    const statusColIdx = headerMap.get('ステータス');
    const classroomColIdx = headerMap.get('教室');
    const venueColIdx = headerMap.get('会場');

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
    const status = String(originalValues[statusColIdx]).toLowerCase();
    const targetDate = originalValues[dateColIdx]; // キャンセルされた予約の日付を取得

    // ユーザー情報を取得して、ログと通知をより具体的にする
    const rosterSheet = getSheetByName(ROSTER_SHEET_NAME);
    let userInfo = { realName: '(不明)', displayName: '(不明)' };
    if (rosterSheet) {
      // 効率化：生徒名簿も1回の読み込みで取得
      const rosterAllData = rosterSheet.getDataRange().getValues();
      if (rosterAllData.length > 1) {
        const rosterHeader = rosterAllData[0];
        const rosterHeaderMap = createHeaderMap(rosterHeader);
        const rosterStudentIdCol = rosterHeaderMap.get(HEADER_STUDENT_ID);

        if (rosterStudentIdCol !== undefined) {
          const userRow = rosterAllData.slice(1).find(row => row[rosterStudentIdCol] === studentId);
          if (userRow) {
            userInfo.realName = userRow[rosterHeaderMap.get(HEADER_REAL_NAME)] || '(不明)';
            userInfo.displayName =
              userRow[rosterHeaderMap.get(HEADER_NICKNAME)] || userInfo.realName;
          }
        }
      }
    }

    // メモリ上でステータスを「キャンセル」に更新
    const dataRowIndex = targetRowIndex - 2; // ヘッダー行を除く配列インデックス
    allData[targetRowIndex - 1][statusColIdx] = STATUS_CANCEL; // allDataの該当行を更新

    // 更新されたデータを一括でシートに書き戻し
    integratedSheet.clear();
    integratedSheet.getRange(1, 1, allData.length, allData[0].length).setValues(allData);

    SpreadsheetApp.flush();

    // 統合予約シートの更新後、キャッシュを再構築
    rebuildAllReservationsCache();

    // 【NF-12】Update cache incrementally
    const newBookingsCache = _updateFutureBookingsCacheIncrementally(studentId, 'remove', {
      reservationId,
    });

    // ログと通知
    const cancelMessage = cancelInfo.cancelMessage || '';
    const messageLog = cancelMessage ? `, Message: ${cancelMessage}` : '';
    const logDetails = `Classroom: ${classroom}, ReservationID: ${reservationId}${messageLog}`;
    logActivity(studentId, LOG_ACTION_RESERVATION_CANCEL, MSG_SUCCESS, logDetails);

    const subject = `予約キャンセル (${classroom}) - ${userInfo.displayName}様`;
    const messageSection = cancelMessage ? `\n先生へのメッセージ: ${cancelMessage}\n` : '';
    const body =
      `予約がキャンセルされました。\n\n` +
      `本名: ${userInfo.realName}\n` +
      `ニックネーム: ${userInfo.displayName}\n\n` +
      `教室: ${classroom}\n` +
      `日付: ${Utilities.formatDate(targetDate, getSpreadsheetTimezone(), 'yyyy/MM/dd')}\n` +
      `予約ID: ${reservationId}${messageSection}\n` +
      `詳細はスプレッドシートを確認してください。`;
    sendAdminNotification(subject, body);

    return {
      success: true,
      message: '予約をキャンセルしました。',
      newBookingsCache: newBookingsCache,
    };
  } catch (err) {
    logActivity(
      cancelInfo.studentId,
      LOG_ACTION_RESERVATION_CANCEL,
      MSG_ERROR,
      `Error: ${err.message}`,
    );
    Logger.log(`cancelReservation Error: ${err.message}\n${err.stack}`);
    return { success: false, message: `キャンセル処理中にエラーが発生しました。` };
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
  lock.waitLock(LOCK_WAIT_TIME_MS);
  try {
    const { reservationId, classroom } = details;
    const masterData = getAccountingMasterData().data;
    const classroomRule = masterData.find(
      item =>
        item['対象教室'] &&
        item['対象教室'].includes(classroom) &&
        item['種別'] === ITEM_TYPE_TUITION,
    );

    if (classroomRule && classroomRule['単位'] === UNIT_30_MIN) {
      _validateTimeBasedReservation(details.startTime, details.endTime, classroomRule);
    }

    // 統合予約シートを取得
    const integratedSheet = getSheetByName('統合予約シート');
    if (!integratedSheet) throw new Error('統合予約シートが見つかりません。');

    // 1回のシート読み込みで全データを取得（効率化）
    const allData = integratedSheet.getDataRange().getValues();
    if (allData.length === 0) throw new Error('統合予約シートにデータがありません。');

    const header = allData[0];
    const headerMap = createHeaderMap(header);

    // 統合予約シートの列インデックス（新しいデータモデル）
    const reservationIdColIdx = headerMap.get('予約ID');
    const studentIdColIdx = headerMap.get('生徒ID');
    const startTimeColIdx = headerMap.get('開始時刻');
    const endTimeColIdx = headerMap.get('終了時刻');
    const chiselRentalColIdx = headerMap.get('彫刻刻レンタル');
    const wipColIdx = headerMap.get('制作メモ');
    const orderColIdx = headerMap.get('order');
    const messageColIdx = headerMap.get('メッセージ');
    const firstLectureColIdx = headerMap.get('初回講習');

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
      rowData[wipColIdx] = details.workInProgress || '';
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
    const updatedBookingObject = {
      reservationId: reservationId,
      startTime: details.startTime || null,
      endTime: details.endTime || null,
      chiselRental: details.chiselRental || false,
      workInProgress: details.workInProgress || '',
      order: details.order || '',
      messageToTeacher: details.messageToTeacher || '',
    };
    const newBookingsCache = _updateFutureBookingsCacheIncrementally(
      studentId,
      'update',
      updatedBookingObject,
    );

    // ログ記録
    const messageToTeacher = details.messageToTeacher || '';
    const messageLog = messageToTeacher ? `, Message: ${messageToTeacher}` : '';
    const logDetails = `ReservationID: ${details.reservationId}, Classroom: ${details.classroom}${messageLog}`;
    logActivity(studentId, '予約詳細更新', '成功', logDetails);

    return { success: true, newBookingsCache: newBookingsCache };
  } catch (err) {
    logActivity(details.studentId || '(N/A)', '予約詳細更新', 'エラー', `Error: ${err.message}`);
    Logger.log(`updateReservationDetails Error: ${err.message}\n${err.stack}`);
    return { success: false, message: `詳細情報の更新中にエラーが発生しました。\n${err.message}` };
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
  lock.waitLock(LOCK_WAIT_TIME_MS);
  try {
    const { reservationId, classroom, studentId, userInput } = payload;
    if (!reservationId || !classroom || !studentId || !userInput) {
      throw new Error('会計情報が不足しています。');
    }

    const sheet = getSheetByName(classroom);
    if (!sheet) throw new Error(`予約シート「${classroom}」が見つかりません。`);

    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headerMap = createHeaderMap(header);
    const reservationIdColIdx = headerMap.get(HEADER_RESERVATION_ID);
    const studentIdColIdx = headerMap.get(HEADER_STUDENT_ID);

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
      paymentMethod: userInput.paymentMethod || '現金',
    };

    // 授業料の計算
    (userInput.tuitionItems || []).forEach(itemName => {
      const masterItem = masterData.find(
        m => m['項目名'] === itemName && m['種別'] === ITEM_TYPE_TUITION,
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
          item['種別'] === ITEM_TYPE_TUITION &&
          item['単位'] === UNIT_30_MIN,
      );
      if (classroomRule && startTime && endTime && startTime < endTime) {
        const start = new Date(`1970-01-01T${startTime}:00`);
        const end = new Date(`1970-01-01T${endTime}:00`);
        let diffMinutes = (end - start) / 60000 - (breakMinutes || 0);
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
        const discountRule = masterData.find(item => item['項目名'] === ITEM_NAME_DISCOUNT);
        if (discountRule) {
          const discountAmount = (discountMinutes / 30) * Math.abs(Number(discountRule['単価']));
          finalAccountingDetails.tuition.items.push({
            name: `${ITEM_NAME_DISCOUNT} (${discountMinutes}分)`,
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
          (m['種別'] === ITEM_TYPE_SALES || m['種別'] === ITEM_TYPE_MATERIAL),
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
      if (headerMap.has(HEADER_START_TIME))
        sheet
          .getRange(targetRowIndex, headerMap.get(HEADER_START_TIME) + 1)
          .setValue(startTime ? new Date(`1970-01-01T${startTime}`) : null)
          .setNumberFormat('HH:mm');
      if (headerMap.has(HEADER_END_TIME))
        sheet
          .getRange(targetRowIndex, headerMap.get(HEADER_END_TIME) + 1)
          .setValue(endTime ? new Date(`1970-01-01T${endTime}`) : null)
          .setNumberFormat('HH:mm');
    }

    // 2. 受講時間とガントチャートを再計算
    updateBillableTime(sheet, targetRowIndex);
    updateGanttChart(sheet, targetRowIndex);

    // 3. 検証済みの会計詳細JSONを保存
    const accountingDetailsColIdx = headerMap.get(HEADER_ACCOUNTING_DETAILS);
    if (accountingDetailsColIdx === undefined)
      throw new Error('ヘッダー「会計詳細」が見つかりません。');
    sheet
      .getRange(targetRowIndex, accountingDetailsColIdx + 1)
      .setValue(JSON.stringify(finalAccountingDetails));

    SpreadsheetApp.flush();

    // 4. 「よやくキャッシュ」から会計済みの予約を削除
    //    会計が完了した予約は「未来の予約」ではなく「過去の記録」となるため、
    //    よやくキャッシュからは削除し、年別きろく_YYYYキャッシュに責務を移管する。
    const newBookingsCache = _updateFutureBookingsCacheIncrementally(actualStudentId, 'remove', {
      reservationId,
    });

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
    const targetDate = reservationDataRow[headerMap.get(HEADER_DATE)];
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
      // 既にアクティブなスプレッドシートオブジェクトを渡して重複を避ける
      const ss = getActiveSpreadsheet();
      const slotsResult = getAvailableSlots();
      updatedSlotsForClassroom = slotsResult.success ? slotsResult.data : [];
    } catch (e) {
      Logger.log(`会計処理後の予約枠取得に失敗: ${e.message}`);
      updatedSlotsForClassroom = [];
    }

    // 9. 【NEW】会計済みの予約をアーカイブし、元の行を削除する
    _archiveSingleReservation(sheet, targetRowIndex, reservationDataRow);

    // ログと通知
    const logDetails = `Classroom: ${classroom}, ReservationID: ${reservationId}, Total: ${finalAccountingDetails.grandTotal}`;
    logActivity(studentId, '会計記録保存', '成功', logDetails);

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
    return {
      success: true,
      newBookingsCache: newBookingsCache,
      newHistory: historyResult.history,
      newHistoryTotal: historyResult.total,
      updatedSlots: updatedSlotsForClassroom, // <--- これを追加
      message: '会計処理と関連データの更新がすべて完了しました。',
    };
  } catch (err) {
    logActivity(payload.studentId, '会計記録保存', 'エラー', `Error: ${err.message}`);
    Logger.log(`saveAccountingDetails Error: ${err.message}\n${err.stack}`);
    return { success: false, message: `会計情報の保存中にエラーが発生しました。\n${err.message}` };
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
      date: reservationDataRow[headerMap.get(HEADER_DATE)],
      studentId: reservationDataRow[headerMap.get(HEADER_STUDENT_ID)],
      name: reservationDataRow[headerMap.get(HEADER_NAME)],
      classroom: classroomName,
      venue: reservationDataRow[headerMap.get(HEADER_VENUE)] || '',
      paymentMethod: accountingDetails.paymentMethod || '不明',
    };

    const rowsToTransfer = [];
    (accountingDetails.tuition?.items || []).forEach(item => {
      rowsToTransfer.push(createSalesRow(baseInfo, ITEM_TYPE_TUITION, item.name, item.price));
    });
    (accountingDetails.sales?.items || []).forEach(item => {
      rowsToTransfer.push(createSalesRow(baseInfo, ITEM_TYPE_SALES, item.name, item.price));
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
    const rosterSheet = getSheetByName(ROSTER_SHEET_NAME);
    if (!rosterSheet) return;

    const studentId = reservationDataRow[headerMap.get(HEADER_STUDENT_ID)];
    const date = reservationDataRow[headerMap.get(HEADER_DATE)];
    if (!studentId || !(date instanceof Date)) return;

    const rosterHeader = rosterSheet.getRange(1, 1, 1, rosterSheet.getLastColumn()).getValues()[0];
    const rosterHeaderMap = createHeaderMap(rosterHeader);
    const studentIdColRoster = rosterHeaderMap.get(HEADER_STUDENT_ID);
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

    const archiveSheetName = HEADER_ARCHIVE_PREFIX + classroomName.slice(0, -2);
    const newRecord = {
      reservationId: reservationDataRow[headerMap.get(HEADER_RESERVATION_ID)] || '',
      sheetName: archiveSheetName,
      date: Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      classroom: classroomName,
      venue: reservationDataRow[headerMap.get(HEADER_VENUE)] || '',
      workInProgress: reservationDataRow[headerMap.get(HEADER_WORK_IN_PROGRESS)] || '',
      accountingDetails: JSON.stringify(accountingDetails),
    };

    const cell = rosterSheet.getRange(targetRosterRow_1based, recordColIdx + 1);
    const existingJson = cell.getValue();
    let records = [];
    if (existingJson) {
      try {
        records = JSON.parse(existingJson);
      } catch (e) {
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
 */
function _archiveSingleReservation(sourceSheet, rowIndex, reservationDataRow) {
  try {
    const classroomName = sourceSheet.getName();
    const archiveSheetName = HEADER_ARCHIVE_PREFIX + classroomName.slice(0, -2);
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
  lock.waitLock(LOCK_WAIT_TIME_MS);
  try {
    const ss = getActiveSpreadsheet();

    // 1. 予約シートの制作メモを更新
    const sheet = getSheetByName(sheetName);
    if (!sheet) throw new Error(`シート「${sheetName}」が見つかりません。`);

    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headerMap = createHeaderMap(header);
    const reservationIdColIdx = headerMap.get(HEADER_RESERVATION_ID);
    const wipColIdx = headerMap.get(HEADER_WORK_IN_PROGRESS);

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
    const rosterSheet = getSheetByName(ROSTER_SHEET_NAME);
    if (rosterSheet) {
      const rosterHeader = rosterSheet
        .getRange(1, 1, 1, rosterSheet.getLastColumn())
        .getValues()[0];
      const rosterHeaderMap = createHeaderMap(rosterHeader);
      const studentIdCol = rosterHeaderMap.get(HEADER_STUDENT_ID);

      if (studentIdCol !== undefined) {
        const rosterData = rosterSheet
          .getRange(2, 1, rosterSheet.getLastRow() - 1, rosterSheet.getLastColumn())
          .getValues();
        const userRowIndex = rosterData.findIndex(row => row[studentIdCol] === studentId);

        if (userRowIndex !== -1) {
          // 更新された予約の年を取得
          const updatedDate = new Date(
            sheet.getRange(targetRowIndex, headerMap.get(HEADER_DATE) + 1).getValue(),
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
      '成功',
      `ResID: ${reservationId}, Sheet: ${sheetName}, Memo: ${newMemo.length}文字`,
    );
    return getParticipationHistory(studentId, null, null);
  } catch (err) {
    const details = `ResID: ${reservationId}, Sheet: ${sheetName}, Error: ${err.message}`;
    logActivity(studentId, '制作メモ更新', 'エラー', details);
    Logger.log(`updateMemo Error: ${err.message}\n${err.stack}`);
    return { success: false, message: `制作メモの更新中にエラーが発生しました。\n${err.message}` };
  } finally {
    lock.releaseLock();
  }
}
