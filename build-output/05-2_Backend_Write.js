/**
 * =================================================================
 * 【ファイル名】: 05-2_Backend_Write.gs
 * 【バージョン】: 2.6
 * 【役割】: WebAppからのデータ書き込み・更新要求（Write）と、
 * それに付随する検証ロジックに特化したバックエンド機能。
 * 【v2.6での変更点】:
 * - checkCapacityFullの定員情報を日程マスタに一本化。
 * =================================================================
 *
 * @global sendBookingConfirmationEmailAsync - External service function from 06_ExternalServices.js
 */

/* global sendBookingConfirmationEmailAsync */

/**
 * 指定日・教室の定員チェックを行う共通関数。
 * @param {string} classroom - 教室
 * @param {string} date - 日付
 * @param {string} startTime - 開始時間
 * @param {string} endTime - 終了時間
 * @returns {boolean} - 定員超過の場合true
 */
function checkCapacityFull(classroom, date, startTime, endTime) {
  const reservationsCache = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);
  if (!reservationsCache || !reservationsCache['reservations']) {
    throw new Error('予約データのキャッシュが利用できません。');
  }

  const scheduleCache = getCachedData(CACHE_KEYS.MASTER_SCHEDULE_DATA);
  if (!scheduleCache || !scheduleCache['schedule']) {
    throw new Error('日程マスタのキャッシュが利用できません。');
  }

  const schedule = scheduleCache['schedule'].find(
    (/** @type {any} */ s) => s.date === date && s.classroom === classroom,
  );

  // 日程マスタから定員を取得。存在しない場合はデフォルト値8をフォールバックとして使用。
  let capacity = schedule ? schedule.totalCapacity : null;
  if (capacity && typeof capacity === 'string') {
    capacity = parseInt(capacity, 10);
    if (isNaN(capacity)) capacity = null;
  }
  capacity = capacity || 8; // デフォルト定員

  Logger.log(
    `定員チェック - ${date} ${classroom}: 日程マスタ定員=${
      schedule ? schedule.totalCapacity : 'なし'
    }→最終定員=${capacity}`,
  );

  // 新しいヘルパー関数を使用して特定日・教室の確定予約を取得
  const reservationsOnDate = getCachedReservationsFor(
    date,
    classroom,
    CONSTANTS.STATUS.CONFIRMED,
  ).filter(r => {
    // 防御的プログラミング: データの存在確認
    if (!r.data || !Array.isArray(r.data)) {
      return false;
    }
    const studentIdIdx = getHeaderIndex(
      reservationsCache['headerMap'],
      CONSTANTS.HEADERS.RESERVATIONS.STUDENT_ID,
    );
    return !!r.data[studentIdIdx];
  });

  // 教室形式に基づく判定ロジック
  if (!schedule || schedule.type !== CONSTANTS.CLASSROOM_TYPES.TIME_DUAL) {
    return reservationsOnDate.length >= capacity;
  }

  // --- 時間制・2部制の午前・午後判定ロジック ---
  const timeCache = {
    firstEndTime: schedule.firstEnd
      ? new Date(`1900-01-01T${schedule.firstEnd}`)
      : null,
    secondStartTime: schedule.secondStart
      ? new Date(`1900-01-01T${schedule.secondStart}`)
      : null,
  };

  if (!timeCache.firstEndTime || !timeCache.secondStartTime) {
    return reservationsOnDate.length >= capacity;
  }

  const startTimeColIdx = getHeaderIndex(
    reservationsCache['headerMap'],
    CONSTANTS.HEADERS.RESERVATIONS.START_TIME,
  );
  const endTimeColIdx = getHeaderIndex(
    reservationsCache['headerMap'],
    CONSTANTS.HEADERS.RESERVATIONS.END_TIME,
  );
  let morningCount = 0;
  let afternoonCount = 0;

  reservationsOnDate.forEach(r => {
    const row = r.data;
    // 防御的プログラミング: データの存在確認
    if (!row || !Array.isArray(row)) {
      Logger.log(`⚠️ 無効な予約データをスキップ: ${JSON.stringify(r)}`);
      return;
    }

    const rStart = row[startTimeColIdx]
      ? new Date(`1900-01-01T${row[startTimeColIdx]}`)
      : null;
    const rEnd = row[endTimeColIdx]
      ? new Date(`1900-01-01T${row[endTimeColIdx]}`)
      : null;

    if (rStart && rStart <= timeCache.firstEndTime) {
      morningCount++;
    }
    if (rEnd && rEnd >= timeCache.secondStartTime) {
      afternoonCount++;
    }
  });

  const reqStart = startTime ? new Date(`1900-01-01T${startTime}`) : null;
  const reqEnd = endTime ? new Date(`1900-01-01T${endTime}`) : null;

  if (
    reqStart &&
    reqStart <= timeCache.firstEndTime &&
    morningCount >= capacity
  ) {
    return true; // 午前枠が満席
  }
  if (
    reqEnd &&
    reqEnd >= timeCache.secondStartTime &&
    afternoonCount >= capacity
  ) {
    return true; // 午後枠が満席
  }

  return false;
}

/**
 * 時間制予約の時刻に関する検証を行うプライベートヘルパー関数。
 * @param {string} startTime - 開始時刻 (HH:mm)。
 * @param {string} endTime - 終了時刻 (HH:mm)。
 * @param {object} scheduleRule - 日程マスタから取得した日程情報。
 * @throws {Error} 検証に失敗した場合、理由を示すエラーをスローする。
 */
function _validateTimeBasedReservation(startTime, endTime, scheduleRule) {
  if (!startTime || !endTime)
    throw new Error('開始時刻と終了時刻の両方を指定してください。');
  const start = new Date(`1900-01-01T${startTime}`);
  const end = new Date(`1900-01-01T${endTime}`);

  if (start >= end)
    throw new Error('終了時刻は開始時刻より後に設定する必要があります。');

  const durationMinutes = (end.getTime() - start.getTime()) / 60000;
  if (durationMinutes < 120) {
    throw new Error('最低予約時間は2時間です。');
  }

  // 日程マスタの1部終了時刻と2部開始時刻を休憩時間として扱う
  /** @type {any} */ const scheduleRuleAny = scheduleRule;
  const breakStart =
    scheduleRuleAny[CONSTANTS.HEADERS.SCHEDULE.FIRST_END] &&
    typeof scheduleRuleAny[CONSTANTS.HEADERS.SCHEDULE.FIRST_END] === 'string' &&
    scheduleRuleAny[CONSTANTS.HEADERS.SCHEDULE.FIRST_END].trim()
      ? new Date(
          `1900-01-01T${scheduleRuleAny[CONSTANTS.HEADERS.SCHEDULE.FIRST_END]}`,
        )
      : null;
  const breakEnd =
    scheduleRuleAny[CONSTANTS.HEADERS.SCHEDULE.SECOND_START] &&
    typeof scheduleRuleAny[CONSTANTS.HEADERS.SCHEDULE.SECOND_START] ===
      'string' &&
    scheduleRuleAny[CONSTANTS.HEADERS.SCHEDULE.SECOND_START].trim()
      ? new Date(
          `1900-01-01T${scheduleRuleAny[CONSTANTS.HEADERS.SCHEDULE.SECOND_START]}`,
        )
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
 * @param {import('../../types/index.d.ts').ReservationRequest} reservationInfo - 予約情報
 * @returns {import('../../types/index.d.ts').ApiResponseGeneric<any>} - 処理結果
 */
function makeReservation(reservationInfo) {
  return withTransaction(() => {
    try {
      const { classroom, date, user, options, startTime, endTime } =
        reservationInfo || {};

      // デバッグ情報: 受信したデータを確認
      Logger.log(
        `[makeReservation] 受信した時間情報: startTime=${startTime}, endTime=${endTime}, classroom=${classroom}`,
      );
      Logger.log(
        `[makeReservation] reservationInfo全体: ${JSON.stringify(reservationInfo)}`,
      );

      // 統合予約シートを取得
      const integratedSheet = getSheetByName(
        CONSTANTS.SHEET_NAMES.RESERVATIONS,
      );
      if (!integratedSheet) throw new Error('統合予約シートが見つかりません。');

      // 日程マスタから該当日・教室の情報を取得
      const scheduleCache = getCachedData(CACHE_KEYS.MASTER_SCHEDULE_DATA);
      const scheduleData = scheduleCache ? scheduleCache['schedule'] : [];
      const scheduleRule = scheduleData.find(
        /** @param {any} item */
        item =>
          item[CONSTANTS.HEADERS.SCHEDULE.DATE] &&
          item[CONSTANTS.HEADERS.SCHEDULE.DATE].toDateString() ===
            new Date(date).toDateString() &&
          item[CONSTANTS.HEADERS.SCHEDULE.CLASSROOM] === classroom,
      );

      // 時間制予約（30分単位）の場合の検証
      if (
        scheduleRule &&
        scheduleRule[CONSTANTS.HEADERS.SCHEDULE.TYPE] ===
          CONSTANTS.UNITS.THIRTY_MIN
      ) {
        _validateTimeBasedReservation(startTime, endTime, scheduleRule);
      }

      // 統合予約シートから全データを取得
      /** @type {{header: any[], headerMap: Map<string, number>, allData: any[][], dataRows: any[][]}} */
      const sheetData =
        /** @type {{header: any[], headerMap: Map<string, number>, allData: any[][], dataRows: any[][]}} */ (
          getSheetData(integratedSheet)
        );
      const header = sheetData.header;
      const headerMap = sheetData.headerMap;
      const data = sheetData.dataRows;

      // 統合予約シートの列インデックス（新しいデータモデル）
      const reservationIdColIdx = headerMap.get(
        CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID,
      );
      const studentIdColIdx = headerMap.get(
        CONSTANTS.HEADERS.RESERVATIONS.STUDENT_ID,
      );
      const dateColIdx = headerMap.get(CONSTANTS.HEADERS.RESERVATIONS.DATE);
      const classroomColIdx = headerMap.get(
        CONSTANTS.HEADERS.RESERVATIONS.CLASSROOM,
      );
      const startTimeColIdx = headerMap.get(
        CONSTANTS.HEADERS.RESERVATIONS.START_TIME,
      );
      const endTimeColIdx = headerMap.get(
        CONSTANTS.HEADERS.RESERVATIONS.END_TIME,
      );
      const statusColIdx = headerMap.get(CONSTANTS.HEADERS.RESERVATIONS.STATUS);
      const venueColIdx = headerMap.get(CONSTANTS.HEADERS.RESERVATIONS.VENUE);
      const chiselRentalColIdx = headerMap.get(
        CONSTANTS.HEADERS.RESERVATIONS.CHISEL_RENTAL,
      );
      const firstLectureColIdx = headerMap.get(
        CONSTANTS.HEADERS.RESERVATIONS.FIRST_LECTURE,
      );
      const wipColIdx = headerMap.get(
        CONSTANTS.HEADERS.RESERVATIONS.WORK_IN_PROGRESS,
      );
      const orderColIdx = headerMap.get(CONSTANTS.HEADERS.RESERVATIONS.ORDER);
      const messageColIdx = headerMap.get(
        CONSTANTS.HEADERS.RESERVATIONS.MESSAGE_TO_TEACHER,
      );

      // 定員チェック（共通関数を使用）
      const isFull = checkCapacityFull(classroom, date, startTime, endTime);

      // 新しい予約IDを生成
      const newReservationId = Utilities.getUuid();
      // 日付文字列をDateオブジェクトに変換（東京タイムゾーン指定）
      const targetDate = new Date(date + 'T00:00:00+09:00');

      // 会場情報を取得（reservationInfoまたは同日同教室の既存予約から）
      let venue = reservationInfo.venue || '';
      if (!venue) {
        const sameDateRow = data.find((/** @type {any} */ row) => {
          // 防御的プログラミング: 行データの存在確認
          if (!row || !Array.isArray(row)) {
            return false;
          }

          const rowDate = row[dateColIdx];
          return (
            rowDate instanceof Date &&
            Utilities.formatDate(rowDate, CONSTANTS.TIMEZONE, 'yyyy-MM-dd') ===
              date &&
            row[classroomColIdx] === classroom &&
            row[venueColIdx]
          );
        });
        if (sameDateRow && sameDateRow[venueColIdx]) {
          venue = sameDateRow[venueColIdx];
        }
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

      // 時刻設定（フロントエンドで調整済みの時間を使用）
      Logger.log(
        `[makeReservation] 受信した時間情報: startTime=${startTime}, endTime=${endTime}, classroom=${classroom}`,
      );

      if (startTime)
        newRowData[startTimeColIdx] = new Date(`1900-01-01T${startTime}:00`);
      if (endTime)
        newRowData[endTimeColIdx] = new Date(`1900-01-01T${endTime}:00`);

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

      // 統合予約シートの更新後、予約キャッシュのみを再構築
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

      // 予約確定メール送信（非同期・エラー時は予約処理に影響しない）
      Utilities.sleep(100); // 予約確定後の短い待機
      try {
        // フロントエンドで調整済みの reservationInfo をそのまま使用
        sendBookingConfirmationEmailAsync(reservationInfo);
      } catch (emailError) {
        // メール送信エラーは予約成功に影響させない
        Logger.log(`メール送信エラー（予約は成功）: ${emailError.message}`);
      }

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
 * @param {{reservationId: string, classroom: string, studentId: string, cancelMessage?: string}} cancelInfo - キャンセル情報
 * @returns {object} - 処理結果。
 */
function cancelReservation(cancelInfo) {
  return withTransaction(() => {
    try {
      /** @type {{reservationId: string, classroom: string, studentId: string, cancelMessage?: string}} */
      const cancelInfoTyped = cancelInfo;
      const { reservationId, classroom, studentId } = cancelInfoTyped; // フロントエンドから渡される情報

      // 統合予約シートを取得
      const integratedSheet = getSheetByName(
        CONSTANTS.SHEET_NAMES.RESERVATIONS,
      );
      if (!integratedSheet) throw new Error('統合予約シートが見つかりません。');

      // 統合予約シートから対象の予約を検索
      /** @type {{header: any[], headerMap: Map<string, number>, allData: any[][], dataRows: any[][], foundRow: any[] | undefined, rowIndex: number, searchColIdx: number}} */
      const searchResult =
        /** @type {{header: any[], headerMap: Map<string, number>, allData: any[][], dataRows: any[][], foundRow: any[] | undefined, rowIndex: number, searchColIdx: number}} */ (
          getSheetDataWithSearch(
            integratedSheet,
            CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID,
            reservationId,
          )
        );
      const headerMap = searchResult.headerMap;
      const targetRowData = searchResult.foundRow;
      const targetRowIndex = searchResult.rowIndex;

      if (!targetRowData)
        throw new Error('キャンセル対象の予約が見つかりませんでした。');

      // 統合予約シートの列インデックス（新しいデータモデル）
      const studentIdColIdx = headerMap.get(
        CONSTANTS.HEADERS.RESERVATIONS.STUDENT_ID,
      );
      const dateColIdx = headerMap.get(CONSTANTS.HEADERS.RESERVATIONS.DATE);
      const statusColIdx = headerMap.get(CONSTANTS.HEADERS.RESERVATIONS.STATUS);
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
            CONSTANTS.HEADERS.ROSTER.STUDENT_ID,
          );

          if (rosterStudentIdCol !== undefined) {
            const userRow = rosterAllData
              .slice(1)
              .find(row => row[rosterStudentIdCol] === studentId);
            if (userRow) {
              userInfo.realName =
                userRow[
                  rosterHeaderMap.get(CONSTANTS.HEADERS.ROSTER.REAL_NAME)
                ] || '(不明)';
              userInfo.displayName =
                userRow[
                  rosterHeaderMap.get(CONSTANTS.HEADERS.ROSTER.NICKNAME)
                ] || userInfo.realName;
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
      const cancelMessage = cancelInfoTyped.cancelMessage || '';
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
        `日付: ${Utilities.formatDate(targetDate, CONSTANTS.TIMEZONE, 'yyyy-MM-dd')}
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
    /** @type {{reservationId: string, classroom: string, startTime?: string, endTime?: string, chiselRental?: boolean, firstLecture?: boolean, workInProgress?: string, materialInfo?: string, order?: string, messageToTeacher?: string}} */
    const detailsTyped =
      /** @type {{reservationId: string, classroom: string, startTime?: string, endTime?: string, chiselRental?: boolean, firstLecture?: boolean, workInProgress?: string, materialInfo?: string, order?: string, messageToTeacher?: string}} */ (
        details
      );
    const { reservationId, classroom } = detailsTyped;
    /** @type {string | null} */
    let studentId = null;

    try {
      // 既存の予約から日付を取得して日程マスタ情報を取得
      /** @type {{header: any[], headerMap: Map<string, number>, allData: any[][], dataRows: any[][], foundRow: any[] | undefined, rowIndex: number, searchColIdx: number}} */
      const existingReservation =
        /** @type {{header: any[], headerMap: Map<string, number>, allData: any[][], dataRows: any[][], foundRow: any[] | undefined, rowIndex: number, searchColIdx: number}} */ (
          getSheetDataWithSearch(
            getSheetByName(CONSTANTS.SHEET_NAMES.RESERVATIONS),
            CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID,
            reservationId,
          )
        );

      /** @type {any} */
      let scheduleRule = null;
      if (existingReservation && existingReservation.foundRow) {
        const dateColIdx = existingReservation.headerMap.get(
          CONSTANTS.HEADERS.RESERVATIONS.DATE,
        );
        const reservationDate =
          dateColIdx !== undefined
            ? existingReservation.foundRow[dateColIdx]
            : null;

        const scheduleCache = getCachedData(CACHE_KEYS.MASTER_SCHEDULE_DATA);
        const scheduleData = scheduleCache ? scheduleCache['schedule'] : [];
        scheduleRule = scheduleData.find(
          /** @param {any} item */
          item =>
            item[CONSTANTS.HEADERS.SCHEDULE.DATE] &&
            item[CONSTANTS.HEADERS.SCHEDULE.DATE].toDateString() ===
              new Date(reservationDate).toDateString() &&
            item[CONSTANTS.HEADERS.SCHEDULE.CLASSROOM] === classroom,
        );
      }

      // 時間制予約（30分単位）の場合の検証
      if (
        scheduleRule &&
        scheduleRule[CONSTANTS.HEADERS.SCHEDULE.TYPE] ===
          CONSTANTS.UNITS.THIRTY_MIN
      ) {
        _validateTimeBasedReservation(
          detailsTyped.startTime,
          detailsTyped.endTime,
          scheduleRule,
        );
      }

      // 統合予約シートを取得
      const integratedSheet = getSheetByName(
        CONSTANTS.SHEET_NAMES.RESERVATIONS,
      );
      /** @type {{header: any[], headerMap: Map<string, number>, allData: any[][], dataRows: any[][], foundRow: any[] | undefined, rowIndex: number, searchColIdx: number}} */
      const searchResultUpdate =
        /** @type {{header: any[], headerMap: Map<string, number>, allData: any[][], dataRows: any[][], foundRow: any[] | undefined, rowIndex: number, searchColIdx: number}} */ (
          getSheetDataWithSearch(
            integratedSheet,
            CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID,
            reservationId,
          )
        );
      const headerMapUpdate = searchResultUpdate.headerMap;
      const rowData = searchResultUpdate.foundRow;
      const targetRowIndex = searchResultUpdate.rowIndex;

      if (!rowData)
        throw new Error(`予約ID「${reservationId}」が見つかりませんでした。`);

      const startTimeColIdx = headerMapUpdate.get(
        CONSTANTS.HEADERS.RESERVATIONS.START_TIME,
      );
      const endTimeColIdx = headerMapUpdate.get(
        CONSTANTS.HEADERS.RESERVATIONS.END_TIME,
      );
      const chiselRentalColIdx = headerMapUpdate.get(
        CONSTANTS.HEADERS.RESERVATIONS.CHISEL_RENTAL,
      );
      const wipColIdx = headerMapUpdate.get(
        CONSTANTS.HEADERS.RESERVATIONS.WORK_IN_PROGRESS,
      );
      const orderColIdx = headerMapUpdate.get(
        CONSTANTS.HEADERS.RESERVATIONS.ORDER,
      );
      const messageColIdx = headerMapUpdate.get(
        CONSTANTS.HEADERS.RESERVATIONS.MESSAGE_TO_TEACHER,
      );
      const firstLectureColIdx = headerMapUpdate.get(
        CONSTANTS.HEADERS.RESERVATIONS.FIRST_LECTURE,
      );

      // メモリ上で各列を更新（rowDataは既に取得済み）

      if (startTimeColIdx !== undefined && detailsTyped.startTime) {
        rowData[startTimeColIdx] = new Date(
          `1900-01-01T${detailsTyped.startTime}:00`,
        );
      }

      if (endTimeColIdx !== undefined && detailsTyped.endTime) {
        rowData[endTimeColIdx] = new Date(
          `1900-01-01T${detailsTyped.endTime}:00`,
        );
      }

      if (chiselRentalColIdx !== undefined) {
        rowData[chiselRentalColIdx] = detailsTyped.chiselRental || false;
      }

      if (firstLectureColIdx !== undefined) {
        rowData[firstLectureColIdx] = detailsTyped.firstLecture || false;
      }

      if (wipColIdx !== undefined) {
        let workInProgress = detailsTyped.workInProgress || '';
        if (detailsTyped.materialInfo) {
          workInProgress +=
            CONSTANTS.SYSTEM.MATERIAL_INFO_PREFIX + detailsTyped.materialInfo;
        }
        rowData[wipColIdx] = workInProgress;
      }

      if (orderColIdx !== undefined) {
        rowData[orderColIdx] = detailsTyped.order || '';
      }

      if (messageColIdx !== undefined) {
        rowData[messageColIdx] = detailsTyped.messageToTeacher || '';
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
      const studentIdColIdx = headerMapUpdate.get(
        CONSTANTS.HEADERS.RESERVATIONS.STUDENT_ID,
      );
      studentId =
        rowData && studentIdColIdx !== undefined
          ? rowData[studentIdColIdx]
          : null; // メモリ上のデータから取得（シートアクセス不要）
      // 統合予約シートの更新はrebuildAllReservationsCache()で完了
      // 予約データは現在CacheServiceで一元管理されているため、個別キャッシュ更新は不要

      // ログ記録
      const messageToTeacher = detailsTyped.messageToTeacher || '';
      const messageLog = messageToTeacher
        ? `, Message: ${messageToTeacher}`
        : '';
      const logDetails = `ReservationID: ${detailsTyped.reservationId}, Classroom: ${detailsTyped.classroom}${messageLog}`;
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
        studentId || '(N/A)',
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

      const sheet = getSheetByName(CONSTANTS.SHEET_NAMES.RESERVATIONS);
      /** @type {{header: any[], headerMap: Map<string, number>, allData: any[][], dataRows: any[][], foundRow: any[] | undefined, rowIndex: number, searchColIdx: number}} */
      const searchResultAccounting =
        /** @type {{header: any[], headerMap: Map<string, number>, allData: any[][], dataRows: any[][], foundRow: any[] | undefined, rowIndex: number, searchColIdx: number}} */ (
          getSheetDataWithSearch(
            sheet,
            CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID,
            reservationId,
          )
        );
      const headerMap = searchResultAccounting.headerMap;
      const reservationDataRow = searchResultAccounting.foundRow;
      const targetRowIndex = searchResultAccounting.rowIndex;

      if (!reservationDataRow)
        throw new Error(`予約ID「${reservationId}」が見つかりませんでした。`);

      const studentIdColIdx = headerMap.get(
        CONSTANTS.HEADERS.RESERVATIONS.STUDENT_ID,
      );
      const actualStudentId = reservationDataRow[studentIdColIdx];
      if (actualStudentId !== studentId) {
        throw new Error('この予約の会計処理を行う権限がありません。');
      }

      // --- バックエンドでの再計算・検証ロジック ---
      const accountingCache = getCachedData(CACHE_KEYS.MASTER_ACCOUNTING_DATA);
      const masterData = accountingCache ? accountingCache['items'] : [];
      const finalAccountingDetails = {
        tuition: { items: /** @type {any[]} */ ([]), subtotal: 0 },
        sales: { items: /** @type {any[]} */ ([]), subtotal: 0 },
        grandTotal: 0,
        paymentMethod:
          /** @type {any} */ (userInput).paymentMethod || CONSTANTS.PAYMENT_DISPLAY.CASH,
      };

      // 授業料の計算
      (/** @type {any} */ (userInput).tuitionItems || []).forEach(/** @param {any} itemName */ itemName => {
        const masterItem = masterData.find(
          /** @param {any} m */ m =>
            m[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME] === itemName &&
            m[CONSTANTS.HEADERS.ACCOUNTING.TYPE] ===
              CONSTANTS.ITEM_TYPES.TUITION,
        );
        if (masterItem) {
          const price = Number(
            masterItem[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE],
          );
          finalAccountingDetails.tuition.items.push({
            name: itemName,
            price: price,
          });
          finalAccountingDetails.tuition.subtotal += price;
        }
      });

      // 時間制授業料の計算
      if (/** @type {any} */ (userInput).timeBased) {
        const { startTime, endTime, breakMinutes, discountMinutes } =
          /** @type {any} */ (userInput).timeBased;
        const classroomRule = masterData.find(
          /** @param {any} item */ item =>
            item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM] &&
            item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM].includes(
              classroom,
            ) &&
            item[CONSTANTS.HEADERS.ACCOUNTING.TYPE] ===
              CONSTANTS.ITEM_TYPES.TUITION &&
            item[CONSTANTS.HEADERS.ACCOUNTING.UNIT] ===
              CONSTANTS.UNITS.THIRTY_MIN,
        );
        if (classroomRule && startTime && endTime && startTime < endTime) {
          const start = new Date(`1900-01-01T${startTime}:00`);
          const end = new Date(`1900-01-01T${endTime}:00`);
          const diffMinutes =
            (end.getTime() - start.getTime()) / 60000 - (breakMinutes || 0);
          if (diffMinutes > 0) {
            const billableUnits = Math.ceil(diffMinutes / 30);
            const price =
              billableUnits *
              Number(classroomRule[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE]);
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
            /** @param {any} item */ item =>
              item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME] ===
              CONSTANTS.ITEMS.DISCOUNT,
          );
          if (discountRule) {
            const discountAmount =
              (discountMinutes / 30) *
              Math.abs(
                Number(discountRule[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE]),
              );
            finalAccountingDetails.tuition.items.push({
              name: `${CONSTANTS.ITEMS.DISCOUNT} (${discountMinutes}分)`,
              price: -discountAmount,
            });
            finalAccountingDetails.tuition.subtotal -= discountAmount;
          }
        }
      }

      // 物販・材料費の計算
      (/** @type {any} */ (userInput).salesItems || []).forEach(/** @param {any} item */ item => {
        const masterItem = masterData.find(
          /** @param {any} m */ m =>
            m[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME] === item.name &&
            (m[CONSTANTS.HEADERS.ACCOUNTING.TYPE] ===
              CONSTANTS.ITEM_TYPES.SALES ||
              m[CONSTANTS.HEADERS.ACCOUNTING.TYPE] ===
                CONSTANTS.ITEM_TYPES.MATERIAL),
        );
        if (masterItem) {
          // マスタに存在する商品
          const price =
            item.price ||
            Number(masterItem[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE]); // 材料費のように価格が計算される場合を考慮
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
      if (/** @type {any} */ (userInput).timeBased) {
        const { startTime, endTime } = /** @type {any} */ (userInput).timeBased;
        const startTimeColIdx = headerMap.get(
          CONSTANTS.HEADERS.RESERVATIONS.START_TIME,
        );
        const endTimeColIdx = headerMap.get(
          CONSTANTS.HEADERS.RESERVATIONS.END_TIME,
        );

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

      // 3. 検証済みの会計詳細JSONを保存
      const accountingDetailsColIdx = headerMap.get(
        CONSTANTS.HEADERS.RESERVATIONS.ACCOUNTING_DETAILS,
      );
      if (accountingDetailsColIdx === undefined)
        throw new Error('ヘッダー「会計詳細」が見つかりません。');

      updatedRowData[accountingDetailsColIdx] = JSON.stringify(
        finalAccountingDetails,
      );

      // 4. 会計完了時のステータス更新 (confirmed → completed)
      const statusColIdx = headerMap.get(CONSTANTS.HEADERS.RESERVATIONS.STATUS);
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
 * @param {Array<any>} reservationDataRow - 売上ログを生成する対象の予約データ行。
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
      date: reservationDataRow[
        headerMap.get(CONSTANTS.HEADERS.RESERVATIONS.DATE)
      ],
      studentId:
        reservationDataRow[
          headerMap.get(CONSTANTS.HEADERS.RESERVATIONS.STUDENT_ID)
        ],
      // 生徒名を生徒IDから取得（キャッシュから）
      name:
        /** @type {any} */(getCachedStudentById(
          reservationDataRow[
            headerMap.get(CONSTANTS.HEADERS.RESERVATIONS.STUDENT_ID)
          ],
        ))?.name || '不明',
      classroom: classroomName,
      venue:
        reservationDataRow[
          headerMap.get(CONSTANTS.HEADERS.RESERVATIONS.VENUE)
        ] || '',
      paymentMethod: /** @type {any} */ (accountingDetails).paymentMethod || '不明',
    };

    /** @type {any[]} */
    const rowsToTransfer = [];
    (/** @type {any} */ (accountingDetails).tuition?.items || []).forEach(/** @param {any} item */ item => {
      rowsToTransfer.push(
        createSalesRow(
          baseInfo,
          CONSTANTS.ITEM_TYPES.TUITION,
          item.name,
          item.price,
        ),
      );
    });
    (/** @type {any} */ (accountingDetails).sales?.items || []).forEach(/** @param {any} item */ item => {
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
      if (rowsToTransfer.length > 0) {
        salesSheet
          .getRange(
            salesSheet.getLastRow() + 1,
            1,
            rowsToTransfer.length,
            rowsToTransfer[0].length,
          )
          .setValues(rowsToTransfer);
      }
    }
  } catch (err) {
    Logger.log(
      `_logSalesForSingleReservation Error: ${err.message}\n${err.stack}`,
    );
  }
}

/**
 * 指定した日付・教室の日程マスタ情報を取得
 * @param {string} date - 日付（YYYY-MM-DD形式）
 * @param {string} classroom - 教室名
 * @returns {Object|null} 日程マスタ情報（型、時間、定員等）
 */
function getScheduleInfoForDate(date, classroom) {
  try {
    Logger.log(
      `🔍 getScheduleInfoForDate: 検索開始 date=${date}, classroom=${classroom}`,
    );

    const scheduleCache = getCachedData(CACHE_KEYS.MASTER_SCHEDULE_DATA);
    if (!scheduleCache?.['schedule']) {
      Logger.log('❌ getScheduleInfoForDate: scheduleCache.scheduleが空です');
      return null;
    }

    Logger.log(
      `🔍 getScheduleInfoForDate: キャッシュ件数=${scheduleCache['schedule'].length}`,
    );

    // デバッグ用：最初の数件を確認
    /** @type {any[]} */(scheduleCache['schedule']).slice(0, 3).forEach((item, idx) => {
      Logger.log(
        `🔍 サンプル${idx}: date=${item.date}, classroom=${item.classroom}, status=${item.status}`,
      );
    });

    // 該当する日程を検索
    const schedule = scheduleCache['schedule'].find(/** @param {any} item */ item => {
      const dateMatch = item.date === date;
      const classroomMatch = item.classroom === classroom;
      const statusOk = item.status !== CONSTANTS.SCHEDULE_STATUS.CANCELLED;

      Logger.log(
        `🔍 検索中: ${item.date}==${date}? ${dateMatch}, ${item.classroom}==${classroom}? ${classroomMatch}, status=${item.status} ok? ${statusOk}`,
      );

      return dateMatch && classroomMatch && statusOk;
    });

    if (!schedule) {
      Logger.log('❌ getScheduleInfoForDate: 該当する日程が見つかりません');
      return null;
    }

    Logger.log('✅ getScheduleInfoForDate: 該当日程を発見', schedule);

    // 定員値の数値変換処理
    let totalCapacity = schedule.totalCapacity;
    if (totalCapacity && typeof totalCapacity === 'string') {
      totalCapacity = parseInt(totalCapacity, 10);
      if (isNaN(totalCapacity)) totalCapacity = null;
    }
    totalCapacity = totalCapacity || /** @type {any} */ (CONSTANTS.CLASSROOM_CAPACITIES)[classroom] || 8;

    let beginnerCapacity = schedule.beginnerCapacity;
    if (beginnerCapacity && typeof beginnerCapacity === 'string') {
      beginnerCapacity = parseInt(beginnerCapacity, 10);
      if (isNaN(beginnerCapacity)) beginnerCapacity = null;
    }
    beginnerCapacity =
      beginnerCapacity || CONSTANTS.LIMITS.INTRO_LECTURE_CAPACITY;

    // 教室形式を取得（複数の可能性のあるフィールド名に対応）
    const classroomType =
      schedule.type ||
      schedule['教室形式'] ||
      schedule.classroomType ||
      schedule.TYPE;

    return {
      type: schedule.type, // 後方互換性のため残す
      classroomType: classroomType, // フロントエンド用
      firstStart: schedule.firstStart || schedule['1部開始'],
      firstEnd: schedule.firstEnd || schedule['1部終了'],
      secondStart: schedule.secondStart || schedule['2部開始'],
      secondEnd: schedule.secondEnd || schedule['2部終了'],
      beginnerStart: schedule.beginnerStart || schedule['初回者開始'],
      totalCapacity: totalCapacity,
      beginnerCapacity: beginnerCapacity,
      status: schedule.status,
      notes: schedule.notes,
    };
  } catch (error) {
    Logger.log(`getScheduleInfoForDate エラー: ${error.message}`);
    return null;
  }
}
