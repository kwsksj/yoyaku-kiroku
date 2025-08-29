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
 * 指定日・教室の定員チェックを行う共通関数。
 * @param {string} classroom - 教室名。
 * @param {string} date - 対象日付（yyyy-MM-dd形式）。
 * @param {Array} reservationsData - 統合予約シートの全データ。
 * @param {Map} headerMap - ヘッダーマップ。
 * @param {string} startTime - 開始時刻（筑波教室の午前午後判定用、オプション）。
 * @param {string} endTime - 終了時刻（筑波教室の午前午後判定用、オプション）。
 * @returns {boolean} - true: 満席, false: 空きあり。
 */
function checkCapacityFull(
  classroom,
  date,
  reservationsData,
  headerMap,
  startTime,
  endTime,
) {
  const timezone = CONSTANTS.TIMEZONE;
  const capacity =
    CONSTANTS.CLASSROOM_CAPACITIES[classroom] ||
    CONSTANTS.CLASSROOM_CAPACITIES[CONSTANTS.CLASSROOMS.TOKYO];

  // 列インデックス取得
  const dateColIdx = headerMap.get(CONSTANTS.HEADERS.DATE);
  const classroomColIdx = headerMap.get(CONSTANTS.HEADERS.CLASSROOM);
  const statusColIdx = headerMap.get(CONSTANTS.HEADERS.STATUS);
  const studentIdColIdx = headerMap.get(CONSTANTS.HEADERS.STUDENT_ID);
  const startTimeColIdx = headerMap.get(CONSTANTS.HEADERS.START_TIME);
  const endTimeColIdx = headerMap.get(CONSTANTS.HEADERS.END_TIME);

  // 同日同教室の予約をフィルタリング
  const dateFilter = row => {
    const rowDate = row[dateColIdx];
    const rowStatus = String(row[statusColIdx]).toLowerCase();
    const rowClassroom = row[classroomColIdx];
    return (
      rowDate instanceof Date &&
      Utilities.formatDate(rowDate, timezone, 'yyyy-MM-dd') === date &&
      rowClassroom === classroom &&
      rowStatus !== CONSTANTS.STATUS.CANCELED &&
      !!row[studentIdColIdx] // 生徒IDが存在する行のみ
    );
  };

  if (classroom === CONSTANTS.CLASSROOMS.TSUKUBA) {
    const reqStartHour = startTime
      ? new Date(`1900-01-01T${startTime}`).getHours()
      : 0;
    const reqEndHour = endTime
      ? new Date(`1900-01-01T${endTime}`).getHours()
      : 24;

    let morningCount = 0;
    let afternoonCount = 0;
    reservationsData.filter(dateFilter).forEach(row => {
      const rStart = row[startTimeColIdx];
      const rEnd = row[endTimeColIdx];
      const rStartHour = rStart instanceof Date ? rStart.getHours() : 0;
      const rEndHour = rEnd instanceof Date ? rEnd.getHours() : 24;

      if (rStartHour < CONSTANTS.LIMITS.TSUKUBA_MORNING_SESSION_END_HOUR)
        morningCount++;
      if (rEndHour >= CONSTANTS.LIMITS.TSUKUBA_MORNING_SESSION_END_HOUR)
        afternoonCount++;
    });

    const morningFull = morningCount >= capacity;
    const afternoonFull = afternoonCount >= capacity;

    if (
      reqStartHour < CONSTANTS.LIMITS.TSUKUBA_MORNING_SESSION_END_HOUR &&
      morningFull
    )
      return true;
    if (
      reqEndHour >= CONSTANTS.LIMITS.TSUKUBA_MORNING_SESSION_END_HOUR &&
      afternoonFull
    )
      return true;

    return false;
  } else {
    const reservationsOnDate = reservationsData.filter(dateFilter).length;
    return reservationsOnDate >= capacity;
  }
}

/**
 * 時間制予約の時刻に関する検証を行うプライベートヘルパー関数。
 * @param {string} startTime - 開始時刻 (HH:mm)。
 * @param {string} endTime - 終了時刻 (HH:mm)。
 * @param {object} classroomRule - 会計マスタから取得した教室ルール。
 * @throws {Error} 検証に失敗した場合、理由を示すエラーをスローする。
 */
function _validateTimeBasedReservation(startTime, endTime, classroomRule) {
  if (!startTime || !endTime)
    throw new Error('開始時刻と終了時刻の両方を指定してください。');
  if (startTime >= endTime)
    throw new Error('終了時刻は開始時刻より後に設定する必要があります。');

  const start = new Date(`1900-01-01T${startTime}`);
  const end = new Date(`1900-01-01T${endTime}`);
  const durationMinutes = (end.getTime() - start.getTime()) / 60000;
  if (durationMinutes < 120) {
    throw new Error('最低予約時間は2時間です。');
  }

  const breakStart = classroomRule[HEADER_BREAK_START]
    ? new Date(`1900-01-01T${classroomRule[HEADER_BREAK_START]}`)
    : null;
  const breakEnd = classroomRule[HEADER_BREAK_END]
    ? new Date(`1900-01-01T${classroomRule[HEADER_BREAK_END]}`)
    : null;
  if (breakStart && breakEnd) {
    if (start >= breakStart && start < breakEnd)
      throw new Error(
        `予約の開始時刻（${startTime}）を休憩時間内に設定することはできません。`,
      );
    if (end > breakStart && end <= breakEnd)
      throw new Error(
        `予約の終了時刻（${endTime}）を休憩時間内に設定することはできません。`,
      );
  }
}

/**
 * 予約を実行します。
 * 新しい定員管理ロジック（予約シートの直接スキャン）で予約可否を判断します。
 * @param {object} reservationInfo - 予約情報。
 * @returns {object} - 処理結果。
 */
function makeReservation(reservationInfo) {
  return withTransaction(() => {
    try {
      const { classroom, date, user, options } = reservationInfo;
      const { startTime, endTime } = options;

      // 統合予約シートを取得
      const integratedSheet = getSheetByName(
        CONSTANTS.SHEET_NAMES.INTEGRATED_RESERVATIONS,
      );
      if (!integratedSheet) throw new Error('統合予約シートが見つかりません。');

      const masterData = getAccountingMasterData().data;
      const classroomRule = masterData.find(
        item =>
          item['対象教室'] &&
          item['対象教室'].includes(classroom) &&
          item['種別'] === CONSTANTS.ITEM_TYPES.TUITION,
      );

      if (
        classroomRule &&
        classroomRule['単位'] === CONSTANTS.UNITS.THIRTY_MIN
      ) {
        _validateTimeBasedReservation(startTime, endTime, classroomRule);
      }

      // 統合予約シートから全データを取得
      const {
        header,
        headerMap,
        dataRows: data,
      } = getSheetData(integratedSheet);
      const timezone = CONSTANTS.TIMEZONE;

      // 統合予約シートの列インデックス（新しいデータモデル）
      const reservationIdColIdx = headerMap.get(
        CONSTANTS.HEADERS.RESERVATION_ID,
      );
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

      // 定員チェック（共通関数を使用）
      const isFull = checkCapacityFull(
        classroom,
        date,
        data,
        headerMap,
        startTime,
        endTime,
      );

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
      newRowData[statusColIdx] = isFull
        ? CONSTANTS.STATUS.WAITLISTED
        : CONSTANTS.STATUS.CONFIRMED;

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
            newRowData[startTimeColIdx] = new Date(
              `1900-01-01T${finalStartTime}:00`,
            );
          if (finalEndTime)
            newRowData[endTimeColIdx] = new Date(
              `1900-01-01T${finalEndTime}:00`,
            );
        }
      } else {
        if (startTime)
          newRowData[startTimeColIdx] = new Date(`1900-01-01T${startTime}:00`);
        if (endTime)
          newRowData[endTimeColIdx] = new Date(`1900-01-01T${endTime}:00`);
      }

      // オプション設定
      if (chiselRentalColIdx !== undefined)
        newRowData[chiselRentalColIdx] = options.chiselRental || false;
      if (firstLectureColIdx !== undefined)
        newRowData[firstLectureColIdx] = options.firstLecture || false;

      // 制作メモ（材料情報を含む）
      let workInProgress = options.workInProgress || '';
      if (options.materialInfo) {
        workInProgress +=
          CONSTANTS.SYSTEM.MATERIAL_INFO_PREFIX + options.materialInfo;
      }
      if (wipColIdx !== undefined) newRowData[wipColIdx] = workInProgress;

      // その他の情報
      if (orderColIdx !== undefined)
        newRowData[orderColIdx] = options.order || '';
      if (messageColIdx !== undefined)
        newRowData[messageColIdx] = options.messageToTeacher || '';

      // 新しい予約行を最下行に追加
      const lastRow = integratedSheet.getLastRow();
      integratedSheet
        .getRange(lastRow + 1, 1, 1, newRowData.length)
        .setValues([newRowData]);

      // シート側で日付・時刻列のフォーマットが事前設定済みのため、
      // ここでの個別フォーマット処理は不要

      SpreadsheetApp.flush(); // シート書き込み完了を保証

      // 統合予約シートの更新後、キャッシュを再構築
      rebuildAllReservationsCache();

      // ログと通知
      const message = !isFull
        ? '予約が完了しました。'
        : '満席のため、キャンセル待ちで登録しました。';
      const messageToTeacher = options.messageToTeacher || '';
      const messageLog = messageToTeacher
        ? `, Message: ${messageToTeacher}`
        : '';
      const logDetails = `Classroom: ${classroom}, Date: ${date}, Status: ${isFull ? 'Waiting' : 'Confirmed'}, ReservationID: ${newReservationId}${messageLog}`;
      logActivity(
        user.studentId,
        '予約作成',
        CONSTANTS.MESSAGES.SUCCESS,
        logDetails,
      );

      const subject = `新規予約 (${classroom}) - ${user.displayName}様`;
      const messageSection = messageToTeacher
        ? `\n先生へのメッセージ: ${messageToTeacher}\n`
        : '';
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
    }
  });
}

/**
 * 予約をキャンセルします。
 * @param {object} cancelInfo - { reservationId: string, classroom: string, studentId: string }
 * @returns {object} - 処理結果。
 */
function cancelReservation(cancelInfo) {
  return withTransaction(() => {
    try {
      const { reservationId, classroom, studentId } = cancelInfo; // フロントエンドから渡される情報

      // 統合予約シートを取得
      const integratedSheet = getSheetByName(
        CONSTANTS.SHEET_NAMES.INTEGRATED_RESERVATIONS,
      );
      if (!integratedSheet) throw new Error('統合予約シートが見つかりません。');

      // 統合予約シートから対象の予約を検索
      const {
        headerMap,
        foundRow: targetRowData,
        rowIndex: targetRowIndex,
      } = getSheetDataWithSearch(
        integratedSheet,
        CONSTANTS.HEADERS.RESERVATION_ID,
        reservationId,
      );

      if (!targetRowData)
        throw new Error('キャンセル対象の予約が見つかりませんでした。');

      // 統合予約シートの列インデックス（新しいデータモデル）
      const studentIdColIdx = headerMap.get(CONSTANTS.HEADERS.STUDENT_ID);
      const dateColIdx = headerMap.get(CONSTANTS.HEADERS.DATE);
      const statusColIdx = headerMap.get(CONSTANTS.HEADERS.STATUS);
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
          const rosterStudentIdCol = rosterHeaderMap.get(
            CONSTANTS.HEADERS.STUDENT_ID,
          );

          if (rosterStudentIdCol !== undefined) {
            const userRow = rosterAllData
              .slice(1)
              .find(row => row[rosterStudentIdCol] === studentId);
            if (userRow) {
              userInfo.realName =
                userRow[rosterHeaderMap.get(CONSTANTS.HEADERS.REAL_NAME)] ||
                '(不明)';
              userInfo.displayName =
                userRow[rosterHeaderMap.get(CONSTANTS.HEADERS.NICKNAME)] ||
                userInfo.realName;
            }
          }
        }
      }

      // 該当行のステータスのみを「キャンセル」に更新
      const updatedRowData = [...targetRowData];
      updatedRowData[statusColIdx] = CONSTANTS.STATUS.CANCELED;

      // 該当行のみを書き戻し
      integratedSheet
        .getRange(targetRowIndex, 1, 1, updatedRowData.length)
        .setValues([updatedRowData]);

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
      const messageSection = cancelMessage
        ? `\n先生へのメッセージ: ${cancelMessage}\n`
        : '';
      const body =
        `予約がキャンセルされました。

` +
        `本名: ${userInfo.realName}
` +
        `ニックネーム: ${userInfo.displayName}

` +
        `教室: ${classroom}
` +
        `日付: ${Utilities.formatDate(targetDate, CONSTANTS.TIMEZONE, 'yyyy/MM/dd')}
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
    }
  });
}

/**
 * 予約の詳細情報を一括で更新します。
 * @param {object} details - 予約詳細情報。
 * @returns {object} - 処理結果。
 */
function updateReservationDetails(details) {
  return withTransaction(() => {
    try {
      const { reservationId, classroom } = details;
      const masterData = getAccountingMasterData().data;
      const classroomRule = masterData.find(
        item =>
          item['対象教室'] &&
          item['対象教室'].includes(classroom) &&
          item['種別'] === CONSTANTS.ITEM_TYPES.TUITION,
      );

      if (
        classroomRule &&
        classroomRule['単位'] === CONSTANTS.UNITS.THIRTY_MIN
      ) {
        _validateTimeBasedReservation(
          details.startTime,
          details.endTime,
          classroomRule,
        );
      }

      // 統合予約シートを取得
      const integratedSheet = getSheetByName(
        CONSTANTS.SHEET_NAMES.INTEGRATED_RESERVATIONS,
      );
      const {
        headerMap,
        foundRow: rowData,
        rowIndex: targetRowIndex,
      } = getSheetDataWithSearch(
        integratedSheet,
        CONSTANTS.HEADERS.RESERVATION_ID,
        reservationId,
      );

      if (!rowData)
        throw new Error(`予約ID「${reservationId}」が見つかりませんでした。`);

      const startTimeColIdx = headerMap.get(CONSTANTS.HEADERS.START_TIME);
      const endTimeColIdx = headerMap.get(CONSTANTS.HEADERS.END_TIME);
      const chiselRentalColIdx = headerMap.get(CONSTANTS.HEADERS.CHISEL_RENTAL);
      const wipColIdx = headerMap.get(CONSTANTS.HEADERS.WORK_IN_PROGRESS);
      const orderColIdx = headerMap.get(CONSTANTS.HEADERS.ORDER);
      const messageColIdx = headerMap.get(CONSTANTS.HEADERS.MESSAGE_TO_TEACHER);
      const firstLectureColIdx = headerMap.get(CONSTANTS.HEADERS.FIRST_LECTURE);

      // メモリ上で各列を更新（rowDataは既に取得済み）

      if (startTimeColIdx !== undefined && details.startTime) {
        rowData[startTimeColIdx] = new Date(
          `1900-01-01T${details.startTime}:00`,
        );
      }

      if (endTimeColIdx !== undefined && details.endTime) {
        rowData[endTimeColIdx] = new Date(`1900-01-01T${details.endTime}:00`);
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
          workInProgress +=
            CONSTANTS.SYSTEM.MATERIAL_INFO_PREFIX + details.materialInfo;
        }
        rowData[wipColIdx] = workInProgress;
      }

      if (orderColIdx !== undefined) {
        rowData[orderColIdx] = details.order || '';
      }

      if (messageColIdx !== undefined) {
        rowData[messageColIdx] = details.messageToTeacher || '';
      }

      // 該当行のみを書き戻し
      integratedSheet
        .getRange(targetRowIndex, 1, 1, rowData.length)
        .setValues([rowData]);

      // シート側で開始時刻・終了時刻列のフォーマットが事前設定済みのため、
      // ここでの個別フォーマット処理は不要

      SpreadsheetApp.flush();

      // 統合予約シートの更新後、キャッシュを再構築
      rebuildAllReservationsCache();

      // 【NF-12】Update cache incrementally (統合予約シート対応)
      const studentIdColIdx = headerMap.get(CONSTANTS.HEADERS.STUDENT_ID);
      const studentId = rowData[studentIdColIdx]; // メモリ上のデータから取得（シートアクセス不要）
      // 統合予約シートの更新はrebuildAllReservationsCache()で完了
      // 予約データは現在CacheServiceで一元管理されているため、個別キャッシュ更新は不要

      // ログ記録
      const messageToTeacher = details.messageToTeacher || '';
      const messageLog = messageToTeacher
        ? `, Message: ${messageToTeacher}`
        : '';
      const logDetails = `ReservationID: ${details.reservationId}, Classroom: ${details.classroom}${messageLog}`;
      logActivity(
        studentId,
        '予約詳細更新',
        CONSTANTS.MESSAGES.SUCCESS,
        logDetails,
      );

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
      Logger.log(
        `updateReservationDetails Error: ${err.message}\n${err.stack}`,
      );
      return BackendErrorHandler.handle(err, 'updateReservationDetails');
    }
  });
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
  return withTransaction(() => {
    try {
      const { reservationId, classroom, studentId, userInput } = payload;
      if (!reservationId || !classroom || !studentId || !userInput) {
        throw new Error('会計情報が不足しています。');
      }

      const sheet = getSheetByName(
        CONSTANTS.SHEET_NAMES.INTEGRATED_RESERVATIONS,
      );
      const {
        headerMap,
        foundRow: reservationDataRow,
        rowIndex: targetRowIndex,
      } = getSheetDataWithSearch(
        sheet,
        CONSTANTS.HEADERS.RESERVATION_ID,
        reservationId,
      );

      if (!reservationDataRow)
        throw new Error(`予約ID「${reservationId}」が見つかりませんでした。`);

      const studentIdColIdx = headerMap.get(CONSTANTS.HEADERS.STUDENT_ID);
      const actualStudentId = reservationDataRow[studentIdColIdx];
      if (actualStudentId !== studentId) {
        throw new Error('この予約の会計処理を行う権限がありません。');
      }

      // --- バックエンドでの再計算・検証ロジック ---
      const masterData = getAccountingMasterData().data;
      const finalAccountingDetails = {
        tuition: { items: [], subtotal: 0 },
        sales: { items: [], subtotal: 0 },
        grandTotal: 0,
        paymentMethod:
          userInput.paymentMethod || CONSTANTS.PAYMENT_DISPLAY.CASH,
      };

      // 授業料の計算
      (userInput.tuitionItems || []).forEach(itemName => {
        const masterItem = masterData.find(
          m =>
            m['項目名'] === itemName &&
            m['種別'] === CONSTANTS.ITEM_TYPES.TUITION,
        );
        if (masterItem) {
          const price = Number(masterItem['単価']);
          finalAccountingDetails.tuition.items.push({
            name: itemName,
            price: price,
          });
          finalAccountingDetails.tuition.subtotal += price;
        }
      });

      // 時間制授業料の計算
      if (userInput.timeBased) {
        const { startTime, endTime, breakMinutes, discountMinutes } =
          userInput.timeBased;
        const classroomRule = masterData.find(
          item =>
            item['対象教室'] &&
            item['対象教室'].includes(classroom) &&
            item['種別'] === CONSTANTS.ITEM_TYPES.TUITION &&
            item['単位'] === CONSTANTS.UNITS.THIRTY_MIN,
        );
        if (classroomRule && startTime && endTime && startTime < endTime) {
          const start = new Date(`1900-01-01T${startTime}:00`);
          const end = new Date(`1900-01-01T${endTime}:00`);
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
          const discountRule = masterData.find(
            item => item['項目名'] === CONSTANTS.ITEMS.DISCOUNT,
          );
          if (discountRule) {
            const discountAmount =
              (discountMinutes / 30) * Math.abs(Number(discountRule['単価']));
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
            (m['種別'] === CONSTANTS.ITEM_TYPES.SALES ||
              m['種別'] === CONSTANTS.ITEM_TYPES.MATERIAL),
        );
        if (masterItem) {
          // マスタに存在する商品
          const price = item.price || Number(masterItem['単価']); // 材料費のように価格が計算される場合を考慮
          finalAccountingDetails.sales.items.push({
            name: item.name,
            price: price,
          });
          finalAccountingDetails.sales.subtotal += price;
        } else if (item.price) {
          // 自由入力項目
          const price = Number(item.price);
          finalAccountingDetails.sales.items.push({
            name: item.name,
            price: price,
          });
          finalAccountingDetails.sales.subtotal += price;
        }
      });

      finalAccountingDetails.grandTotal =
        finalAccountingDetails.tuition.subtotal +
        finalAccountingDetails.sales.subtotal;
      // --- ここまで ---

      // 更新する行のデータを準備
      const updatedRowData = [...reservationDataRow]; // 元データのコピー

      // 1. 時刻などを更新（シート側フォーマット設定済み）
      if (userInput.timeBased) {
        const { startTime, endTime } = userInput.timeBased;
        const startTimeColIdx = headerMap.get(CONSTANTS.HEADERS.START_TIME);
        const endTimeColIdx = headerMap.get(CONSTANTS.HEADERS.END_TIME);

        if (startTimeColIdx !== undefined) {
          updatedRowData[startTimeColIdx] = startTime
            ? new Date(`1900-01-01T${startTime}`)
            : null;
        }
        if (endTimeColIdx !== undefined) {
          updatedRowData[endTimeColIdx] = endTime
            ? new Date(`1900-01-01T${endTime}`)
            : null;
        }
      }

      // 2. 受講時間とガントチャートを再計算 (レガシー機能のためコメントアウト)
      // updateBillableTime(sheet, targetRowIndex);
      // updateGanttChart(sheet, targetRowIndex);

      // 3. 検証済みの会計詳細JSONを保存
      const accountingDetailsColIdx = headerMap.get(
        CONSTANTS.HEADERS.ACCOUNTING_DETAILS,
      );
      if (accountingDetailsColIdx === undefined)
        throw new Error('ヘッダー「会計詳細」が見つかりません。');

      updatedRowData[accountingDetailsColIdx] = JSON.stringify(
        finalAccountingDetails,
      );

      // 4. 会計完了時のステータス更新 (confirmed → completed)
      const statusColIdx = headerMap.get(CONSTANTS.HEADERS.STATUS);
      if (statusColIdx !== undefined) {
        updatedRowData[statusColIdx] = CONSTANTS.STATUS.COMPLETED;
      }

      // 該当行のみを一括で書き戻し
      sheet
        .getRange(targetRowIndex, 1, 1, updatedRowData.length)
        .setValues([updatedRowData]);

      SpreadsheetApp.flush();

      // 5. 統合予約シートの更新後、全てのキャッシュを再構築
      //    会計が完了した予約は「未来の予約」ではなく「過去の記録」となるため、
      //    全キャッシュを再構築してデータの整合性を保つ。

      // --- ここからが追加の後続処理 ---
      // reservationDataRowは既に上記で取得済み

      // 6. 売上ログへの転記
      _logSalesForSingleReservation(
        reservationDataRow,
        headerMap,
        classroom,
        finalAccountingDetails,
      );

      // ログと通知
      const logDetails = `Classroom: ${classroom}, ReservationID: ${reservationId}, Total: ${finalAccountingDetails.grandTotal}`;
      logActivity(
        studentId,
        '会計記録保存',
        CONSTANTS.MESSAGES.SUCCESS,
        logDetails,
      );

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
    }
  });
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
      studentId:
        reservationDataRow[headerMap.get(CONSTANTS.HEADERS.STUDENT_ID)],
      name: reservationDataRow[headerMap.get(CONSTANTS.HEADERS.NAME)],
      classroom: classroomName,
      venue: reservationDataRow[headerMap.get(CONSTANTS.HEADERS.VENUE)] || '',
      paymentMethod: accountingDetails.paymentMethod || '不明',
    };

    const rowsToTransfer = [];
    (accountingDetails.tuition?.items || []).forEach(item => {
      rowsToTransfer.push(
        createSalesRow(
          baseInfo,
          CONSTANTS.ITEM_TYPES.TUITION,
          item.name,
          item.price,
        ),
      );
    });
    (accountingDetails.sales?.items || []).forEach(item => {
      rowsToTransfer.push(
        createSalesRow(
          baseInfo,
          CONSTANTS.ITEM_TYPES.SALES,
          item.name,
          item.price,
        ),
      );
    });

    if (rowsToTransfer.length > 0) {
      const salesSpreadsheet = SpreadsheetApp.openById(SALES_SPREADSHEET_ID);
      const salesSheet = salesSpreadsheet.getSheetByName('売上ログ');
      if (!salesSheet)
        throw new Error(
          '売上スプレッドシートに「売上ログ」シートが見つかりません。',
        );
      salesSheet
        .getRange(
          salesSheet.getLastRow() + 1,
          1,
          rowsToTransfer.length,
          rowsToTransfer[0].length,
        )
        .setValues(rowsToTransfer);
    }
  } catch (err) {
    Logger.log(
      `_logSalesForSingleReservation Error: ${err.message}\n${err.stack}`,
    );
  }
}
