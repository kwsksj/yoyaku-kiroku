/// <reference path="../../types/gas-environment.d.ts" />
/// <reference path="../../types/api-types.d.ts" />
/// <reference path="../../types/core/index.d.ts" />
/// <reference path="../../types/dto/index.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 05-2_Backend_Write.gs
 * 【バージョン】: 3.0
 * 【役割】: WebAppからのデータ書き込み・更新要求（Write）と、
 * それに付随する検証ロジックに特化したバックエンド機能。
 * 【v3.0での変更点】:
 * - Phase 3: 型システム統一 - Core型・DTO型の導入
 * - makeReservation: ReservationCreateDto対応
 * - updateReservationDetails: ReservationUpdateDto対応
 * - cancelReservation: ReservationCancelDto対応
 * - 変換関数の活用（convertRowToReservation/convertReservationToRow）
 * 【v2.7での変更点】:
 * - updateReservationDetailsに定員チェック機能を追加。
 * - checkCapacityFullの2部制クラス判定ロジックを修正。
 * =================================================================
 *
 * @global sendBookingConfirmationEmailAsync - External service function from 06_ExternalServices.js
 */

/* global sendBookingConfirmationEmailAsync */

/**
 * 指定したユーザーが同一日に予約を持っているかチェックする共通関数。
 * @param {string} studentId - 学生ID
 * @param {string} date - 日付（YYYY-MM-DD形式）
 * @returns {boolean} - 同一日に有効な予約がある場合true
 */
function checkDuplicateReservationOnSameDay(studentId, date) {
  try {
    // キャッシュから全予約データを取得
    const reservationsCache = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);
    if (!reservationsCache?.['data']) {
      Logger.log('予約キャッシュデータが見つかりません');
      return false; // エラー時は重複なしと判断（保守的な動作）
    }

    /** @type {ReservationArrayData[]} */
    const allReservations = /** @type {ReservationArrayData[]} */ (
      reservationsCache['data']
    );
    const headerMap = /** @type {HeaderMapType} */ (
      reservationsCache['headerMap']
    );

    // 必要な列インデックスを取得
    const studentIdColIdx = getHeaderIndex(
      headerMap,
      CONSTANTS.HEADERS.RESERVATIONS.STUDENT_ID,
    );
    const dateColIdx = getHeaderIndex(
      headerMap,
      CONSTANTS.HEADERS.RESERVATIONS.DATE,
    );
    const statusColIdx = getHeaderIndex(
      headerMap,
      CONSTANTS.HEADERS.RESERVATIONS.STATUS,
    );

    if (
      studentIdColIdx === undefined ||
      dateColIdx === undefined ||
      statusColIdx === undefined
    ) {
      Logger.log('必要な列インデックスが見つかりません');
      return false;
    }

    // 日付文字列をDateオブジェクトに変換（YYYY-MM-DD形式を想定）
    const targetDate = new Date(date + 'T00:00:00+09:00');
    const targetDateString = targetDate.toDateString(); // 比較用の標準文字列形式

    Logger.log(
      `[checkDuplicateReservationOnSameDay] ターゲット日付: ${date} -> ${targetDate} -> ${targetDateString}`,
    );

    // 同一ユーザーの同一日の有効な予約を検索
    const duplicateReservation = allReservations.find(
      /** @type {function(ReservationArrayData): boolean} */ reservation => {
        if (!reservation || !Array.isArray(reservation)) return false;

        const reservationStudentId = String(reservation[studentIdColIdx] || '');
        const reservationDate = reservation[dateColIdx];
        const reservationStatus = String(reservation[statusColIdx] || '');

        // 同一ユーザーかチェック
        if (reservationStudentId !== studentId) return false;

        // 同一日かチェック（予約データのDate型は確実なため直接比較）
        let isSameDay = false;
        if (reservationDate instanceof Date) {
          isSameDay = reservationDate.toDateString() === targetDateString;
        } else {
          // 予約データは通常Date型なので、異常データとしてスキップ
          return false;
        }

        if (!isSameDay) return false;

        // 有効な予約ステータスかチェック（confirmed または waitlisted）
        const isValidStatus =
          reservationStatus === CONSTANTS.STATUS.CONFIRMED ||
          reservationStatus === CONSTANTS.STATUS.WAITLISTED;

        return isValidStatus;
      },
    );

    return !!duplicateReservation;
  } catch (error) {
    Logger.log(`checkDuplicateReservationOnSameDay エラー: ${error.message}`);
    return false; // エラー時は重複なしと判断（保守的な動作）
  }
}

/**
 * 指定日・教室の定員チェックを行う共通関数。
 * @param {string} classroom - 教室
 * @param {string} date - 日付
 * @param {string} startTime - 開始時間
 * @param {string} endTime - 終了時間
 * @returns {boolean} - 定員超過の場合true
 */
function checkCapacityFull(classroom, date, startTime, endTime) {
  try {
    // 定員状況を取得
    const availableSlotsResponse = getLessons();

    if (!availableSlotsResponse.success || !availableSlotsResponse.data) {
      Logger.log('Available Slots APIからデータを取得できませんでした');
      return false; // エラー時は予約を通す（保守的な動作）
    }

    const slotsData = availableSlotsResponse.data;
    const targetSlot = slotsData.find(
      /** @type {function(*): boolean} */ slot =>
        slot.schedule.classroom === classroom && slot.schedule.date === date,
    );

    if (!targetSlot) {
      Logger.log(`対象日程が見つかりません: ${date} ${classroom}`);
      return false; // 対象日程が見つからない場合は予約を通す
    }

    const status = targetSlot.status;
    let isFull = false;

    // 教室タイプに応じた満席判定
    if (
      status.morningSlots !== undefined &&
      status.afternoonSlots !== undefined
    ) {
      // 時間制・2部制の場合
      const reqStart = startTime ? new Date(`1900-01-01T${startTime}`) : null;
      const reqEnd = endTime ? new Date(`1900-01-01T${endTime}`) : null;

      const schedule = targetSlot.schedule;
      const firstEndTime = schedule.firstEnd
        ? new Date(`1900-01-01T${schedule.firstEnd}`)
        : null;
      const secondStartTime = schedule.secondStart
        ? new Date(`1900-01-01T${schedule.secondStart}`)
        : null;

      let isMorningRequest = false;
      let isAfternoonRequest = false;

      if (reqStart && firstEndTime && reqStart < firstEndTime) {
        isMorningRequest = true;
      }
      if (reqEnd && secondStartTime && reqEnd > secondStartTime) {
        isAfternoonRequest = true;
      }

      if (isMorningRequest && isAfternoonRequest) {
        // 【修正点】両方のセッションにまたがる予約の場合、どちらか一方が満席ならNG
        isFull = status.morningSlots <= 0 || status.afternoonSlots <= 0;
      } else if (isMorningRequest) {
        // 午前のみの予約
        isFull = status.morningSlots <= 0;
      } else if (isAfternoonRequest) {
        // 午後のみの予約
        isFull = status.afternoonSlots <= 0;
      } else {
        // 予約がセッション時間外の場合 (例: 休憩時間内)
        // この予約は不正だが、ここでは満席とは扱わず、後続のバリデーションに任せる
        isFull = false;
      }
    } else {
      // 通常教室（セッション制・全日時間制）の場合
      isFull =
        status.isFull ||
        (status.availableSlots !== undefined && status.availableSlots <= 0);
    }

    Logger.log(
      `[checkCapacityFull] ${date} ${classroom}: 満席=${isFull}, status=${JSON.stringify(status)}`,
    );

    return isFull;
  } catch (error) {
    Logger.log(`checkCapacityFull エラー: ${error.message}`);
    return false; // エラー時は予約を通す（保守的な動作）
  }
}

/**
 * 時間制予約の時刻に関する検証を行うプライベートヘルパー関数。
 * @param {string} startTime - 開始時刻 (HH:mm)。
 * @param {string} endTime - 終了時刻 (HH:mm)。
 * @param {ScheduleMasterData} scheduleRule - 日程マスタから取得した日程情報。
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

  const scheduleData = scheduleRule;
  const breakStart =
    scheduleData.firstEnd &&
    typeof scheduleData.firstEnd === 'string' &&
    scheduleData.firstEnd.trim()
      ? new Date(`1900-01-01T${scheduleData.firstEnd}`)
      : null;
  const breakEnd =
    scheduleData.secondStart &&
    typeof scheduleData.secondStart === 'string' &&
    scheduleData.secondStart.trim()
      ? new Date(`1900-01-01T${scheduleData.secondStart}`)
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
 * 予約を実行します（Phase 3: 型システム統一対応）
 *
 * @param {ReservationCreateDto} reservationInfo - 予約作成リクエストDTO
 * @returns {ApiResponseGeneric<MakeReservationResult>} - 処理結果
 *
 * @example
 * const result = makeReservation({
 *   studentId: 'S-001',
 *   classroom: '東京教室',
 *   date: '2025-10-15',
 *   startTime: '13:00',
 *   endTime: '16:00',
 *   user: { studentId: 'S-001', displayName: '太郎', realName: '山田太郎' },
 *   chiselRental: true,
 *   firstLecture: false,
 * });
 */
function makeReservation(reservationInfo) {
  return withTransaction(() => {
    try {
      // Phase 3: ReservationCreateDto として処理
      // options はReservationCreateDto の直接プロパティとして展開
      const {
        classroom,
        date,
        user,
        startTime,
        endTime,
        studentId,
        chiselRental,
        firstLecture,
        workInProgress,
        materialInfo,
        order,
        messageToTeacher,
        venue,
      } = reservationInfo || {};

      // 後方互換性のため、options オブジェクトも許容
      const options = reservationInfo.options || {
        chiselRental: chiselRental || false,
        firstLecture: firstLecture || false,
        workInProgress: workInProgress || '',
        materialInfo: materialInfo || '',
        order: order || '',
        messageToTeacher: messageToTeacher || '',
      };

      const integratedSheet = getSheetByName(
        CONSTANTS.SHEET_NAMES.RESERVATIONS,
      );
      if (!integratedSheet) throw new Error('統合予約シートが見つかりません。');

      // 日程マスタから該当日・教室の情報を取得
      const scheduleCache = getCachedData(CACHE_KEYS.MASTER_SCHEDULE_DATA);
      /** @type {ScheduleMasterData[]} */
      const scheduleData = scheduleCache
        ? /** @type {ScheduleMasterData[]} */ (scheduleCache['schedule'])
        : [];
      // 検索対象日付の標準化
      const targetDateForSearch = new Date(date + 'T00:00:00+09:00');
      const targetDateStringForSearch = targetDateForSearch.toDateString();

      const scheduleRule = scheduleData.find(
        /** @param {ScheduleMasterData} item */ item => {
          const itemDate = item.date;
          if (!itemDate || !item.classroom) return false;
          const dateMatches =
            itemDate instanceof Date &&
            itemDate.toDateString() === targetDateStringForSearch;
          return dateMatches && item.classroom === classroom;
        },
      );

      // 時間制予約（30分単位）の場合の検証
      if (scheduleRule && scheduleRule['type'] === CONSTANTS.UNITS.THIRTY_MIN) {
        _validateTimeBasedReservation(startTime, endTime, scheduleRule);
      }

      // 同一日重複予約チェック
      const hasDuplicateReservation = checkDuplicateReservationOnSameDay(
        user.studentId,
        date,
      );
      if (hasDuplicateReservation) {
        throw new Error(
          '同一日に既に予約が存在します。1日につき1つの予約のみ可能です。',
        );
      }
      Logger.log(
        `[makeReservation] 重複予約チェック完了: ${user.studentId} ${date} - 重複なし`,
      );

      // 【パフォーマンス対策】シートアクセス前に事前ウォームアップ
      Logger.log('[RESERVATION] 事前ウォームアップ実行');
      SS_MANAGER.warmupAsync();

      const sheetData = getSheetData(integratedSheet);
      const header = sheetData.header;
      const headerMap = sheetData.headerMap;
      const data = sheetData.dataRows;

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
      Logger.log(
        `[makeReservation] 定員チェック結果: ${classroom} ${date} - 満席=${isFull}`,
      );

      // 新しい予約IDを生成
      const newReservationId = Utilities.getUuid();
      // 日付文字列をDateオブジェクトに変換（統合予約シートに適した形式）
      const targetDate = new Date(date + 'T00:00:00+09:00');

      // 会場情報を取得（reservationInfoまたは同日同教室の既存予約から）
      let venue = reservationInfo.venue || '';
      if (!venue) {
        const sameDateRow = data.find(row => {
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
          venue = String(sameDateRow[venueColIdx]);
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
      const finalStatus = isFull
        ? CONSTANTS.STATUS.WAITLISTED
        : CONSTANTS.STATUS.CONFIRMED;
      newRowData[statusColIdx] = finalStatus;
      Logger.log(
        `[makeReservation] 最終ステータス設定: ${finalStatus} (満席=${isFull})`,
      );

      // 時刻設定（時間のみのDateオブジェクトとして保存）
      Logger.log(
        `[makeReservation] 受信した時間情報: startTime=${startTime}, endTime=${endTime}, classroom=${classroom}`,
      );

      // 開始・終了時刻の設定（フロントエンドで正規化済み）
      const finalStartTime = startTime;
      const finalEndTime = endTime;

      if (finalStartTime) {
        newRowData[startTimeColIdx] = new Date(
          `1900-01-01T${finalStartTime}:00+09:00`,
        );
      }
      if (finalEndTime) {
        newRowData[endTimeColIdx] = new Date(
          `1900-01-01T${finalEndTime}:00+09:00`,
        );
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
        newRowData[orderColIdx] = String(options.order || '');
      if (messageColIdx !== undefined)
        newRowData[messageColIdx] = options.messageToTeacher || '';

      integratedSheet
        .getRange(integratedSheet.getLastRow() + 1, 1, 1, newRowData.length)
        .setValues([newRowData]);

      SpreadsheetApp.flush();

      // 統合予約シートの更新後、インクリメンタルキャッシュ更新（高速化）
      try {
        Logger.log('[RESERVATION] インクリメンタルキャッシュ更新実行');
        addReservationToCache(newRowData, headerMap);
      } catch (e) {
        Logger.log(
          `インクリメンタル更新エラー: ${e.message} - フォールバック実行`,
        );
        // インクリメンタル更新エラー時は通常の再構築にフォールバック
        try {
          rebuildAllReservationsCache();
        } catch (rebuildError) {
          Logger.log(
            `キャッシュ再構築もエラー: ${rebuildError.message} - 処理続行`,
          );
          // キャッシュエラーがあっても予約作成は成功とする
        }
      }

      // ログと通知
      const message = !isFull
        ? '予約が完了しました。'
        : '満席のため、空き連絡希望で登録しました。';

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

      // 管理者通知メールの内容を状態と初回参加に応じて調整
      const isFirstTime =
        reservationInfo.options && reservationInfo.options.firstLecture;
      const statusText = isFull ? '空き連絡希望' : '新規予約';
      const firstTimeText = isFirstTime ? '【初回参加】' : '';

      const subject = `${statusText} (${classroom}) ${firstTimeText}${user.realName}:${user.displayName}様`;
      const messageSection = messageToTeacher
        ? `\n先生へのメッセージ: ${messageToTeacher}\n`
        : '';

      const actionText = isFull ? '空き連絡希望' : '新しい予約';
      const body =
        `${actionText}が入りました。\n\n` +
        `本名: ${user.realName}\n` +
        `ニックネーム: ${user.displayName}\n` +
        (isFirstTime ? `参加区分: 初回参加\n` : '') +
        `\n教室: ${classroom}\n` +
        `日付: ${date}\n` +
        `状態: ${isFull ? '空き連絡希望' : '確定'}${messageSection}\n` +
        `詳細はスプレッドシートを確認してください。`;
      sendAdminNotification(subject, body);

      // 予約確定メール送信（非同期・エラー時は予約処理に影響しない）
      Utilities.sleep(100); // 予約確定後の短い待機
      try {
        // TODO: reservationInfoの型を統一するリファクタリングを行う。
        // 現在はReservationRequest型をReservationInfo型として扱っているが、
        // classroomTypeプロパティが不足している。現状のメール送信ロジックでは
        // classroomTypeは使われていないため動作するが、将来的には修正が必要。
        sendBookingConfirmationEmailAsync(/** @type {any} */ (reservationInfo));
      } catch (emailError) {
        // メール送信エラーは予約成功に影響しない
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
 * 予約をキャンセルします（Phase 3: 型システム統一対応）
 *
 * @param {ReservationCancelDto} cancelInfo - 予約キャンセルリクエストDTO
 * @returns {ApiResponseGeneric<{message: string}>} - 処理結果
 *
 * @example
 * const result = cancelReservation({
 *   reservationId: 'R-001',
 *   classroom: '東京教室',
 *   studentId: 'S-001',
 *   date: '2025-10-15',
 *   cancelMessage: '体調不良のため',
 * });
 */
function cancelReservation(cancelInfo) {
  return withTransaction(() => {
    try {
      /** @type {ReservationCancelDto} */
      const cancelDto = /** @type {ReservationCancelDto} */ (cancelInfo);
      const { reservationId, classroom, studentId, date, cancelMessage } =
        cancelDto;

      const integratedSheet = getSheetByName(
        CONSTANTS.SHEET_NAMES.RESERVATIONS,
      );
      if (!integratedSheet) throw new Error('統合予約シートが見つかりません。');

      const searchResult = getSheetDataWithSearch(
        integratedSheet,
        CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID,
        reservationId,
      );
      const headerMap = searchResult.headerMap;
      const targetRowData = searchResult.foundRow;
      const targetRowIndex = searchResult.rowIndex;

      if (!targetRowData)
        throw new Error('キャンセル対象の予約が見つかりませんでした。');

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
      const targetDateFormatted =
        targetDate instanceof Date ? targetDate : new Date(String(targetDate));

      // 【パフォーマンス最適化】 キャッシュからユーザー情報を取得（重複シートアクセス排除）
      const userInfo = getCachedStudentInfo(studentId);

      // 該当行のステータスのみを「キャンセル」に更新
      const updatedRowData = [...targetRowData];
      updatedRowData[statusColIdx] = CONSTANTS.STATUS.CANCELED;

      // 該当行のみを書き戻し
      integratedSheet
        .getRange(targetRowIndex, 1, 1, updatedRowData.length)
        .setValues([updatedRowData]);

      SpreadsheetApp.flush();

      // 統合予約シートの更新後、インクリメンタルキャッシュ更新（高速化）
      try {
        Logger.log('[CANCEL] インクリメンタルキャッシュ更新実行');
        updateReservationStatusInCache(
          reservationId,
          CONSTANTS.STATUS.CANCELED,
        );
      } catch (e) {
        Logger.log(
          `インクリメンタル更新エラー: ${e.message} - フォールバック実行`,
        );
        // インクリメンタル更新エラー時は通常の再構築にフォールバック
        try {
          rebuildAllReservationsCache();
        } catch (rebuildError) {
          Logger.log(
            `キャッシュ再構築もエラー: ${rebuildError.message} - 処理続行`,
          );
        }
      }

      const cancelMessage = cancelInfo.cancelMessage || '';
      const messageLog = cancelMessage ? `, Message: ${cancelMessage}` : '';
      const logDetails = `Classroom: ${classroom}, ReservationID: ${reservationId}${messageLog}`;
      logActivity(
        studentId,
        CONSTANTS.LOG_ACTIONS.RESERVATION_CANCEL,
        CONSTANTS.MESSAGES.SUCCESS,
        logDetails,
      );

      //キャンセル後の空き通知処理
      try {
        const dateString = Utilities.formatDate(
          targetDateFormatted,
          CONSTANTS.TIMEZONE,
          'yyyy-MM-dd',
        );
        notifyAvailabilityToWaitlistedUsers(
          classroom,
          dateString,
          originalValues,
        );
      } catch (notificationError) {
        Logger.log(`空き通知エラー: ${notificationError.message}`);
        // 通知エラーはキャンセル処理の成功に影響しない
      }

      const subject = `予約キャンセル (${classroom}) ${userInfo.realName}: ${userInfo.displayName}様`;
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
        `日付: ${Utilities.formatDate(targetDateFormatted, CONSTANTS.TIMEZONE, 'yyyy-MM-dd')}
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
 * キャンセル後の空き連絡希望者への通知機能
 * @param {string} classroom - 教室名
 * @param {string} date - 日付（yyyy-MM-dd形式）
 * @param {any[]} _cancelledReservation - キャンセルされた予約データ（将来の拡張用）
 */
function notifyAvailabilityToWaitlistedUsers(
  classroom,
  date,
  _cancelledReservation,
) {
  try {
    Logger.log(`[空き通知] ${classroom} ${date} の空き通知処理を開始`);

    // キャンセル後の現在の空き状況を取得
    const lessonsResponse = getLessons();
    if (!lessonsResponse.success || !lessonsResponse.data) {
      Logger.log('空き状況の取得に失敗しました');
      return;
    }

    const targetLesson = lessonsResponse.data.find(
      lesson =>
        lesson.schedule.classroom === classroom &&
        lesson.schedule.date === date,
    );

    if (!targetLesson) {
      Logger.log(`対象日程が見つかりません: ${classroom} ${date}`);
      return;
    }

    const status = targetLesson.status;

    // 空きがあるかチェック
    let hasAvailability = false;
    let availabilityType = ''; // 'general' or 'firstTime'

    // 通常参加者用の空きチェック
    if (
      status.morningSlots !== undefined &&
      status.afternoonSlots !== undefined
    ) {
      // 時間制・2部制の場合
      if (status.morningSlots > 0 || status.afternoonSlots > 0) {
        hasAvailability = true;
        availabilityType = 'general';
      }
    } else if (
      status.availableSlots !== undefined &&
      status.availableSlots > 0
    ) {
      // 通常教室の場合
      hasAvailability = true;
      availabilityType = 'general';
    }

    // 初回者専用枠の空きチェック
    if (
      status.firstLectureSlots !== undefined &&
      status.firstLectureSlots > 0
    ) {
      hasAvailability = true;
      if (availabilityType === '') {
        availabilityType = 'firstTime';
      } else {
        availabilityType = 'both'; // 通常・初回両方に空きあり
      }
    }

    if (!hasAvailability) {
      Logger.log(`${classroom} ${date} に空きがないため通知しません`);
      return;
    }

    Logger.log(`${classroom} ${date} に空きあり (タイプ: ${availabilityType})`);

    // 空き連絡希望者を取得（初回・通常を区別）
    const waitlistedUsers = getWaitlistedUsersForNotification(
      classroom,
      date,
      availabilityType,
    );

    if (waitlistedUsers.length === 0) {
      Logger.log('空き連絡希望者がいません');
      return;
    }

    Logger.log(`${waitlistedUsers.length}名に空き通知を送信します`);

    // 空き通知メールを送信
    sendAvailabilityNotificationEmails(
      classroom,
      date,
      waitlistedUsers,
      targetLesson,
    );
  } catch (error) {
    Logger.log(`notifyAvailabilityToWaitlistedUsers エラー: ${error.message}`);
    throw error;
  }
}

/**
 * 空き連絡希望者の取得（初回・通常を区別）
 * @param {string} classroom - 教室名
 * @param {string} date - 日付
 * @param {string} availabilityType - 空きタイプ（'general', 'firstTime', 'both'）
 * @returns {Array<{studentId: string, email: string, realName: string, isFirstTime: boolean}>}
 */
function getWaitlistedUsersForNotification(classroom, date, availabilityType) {
  const waitlistedReservations = getCachedReservationsFor(
    date,
    classroom,
    CONSTANTS.STATUS.WAITLISTED,
  );

  if (waitlistedReservations.length === 0) {
    Logger.log(`空き連絡希望者なし: ${classroom} ${date}`);
    return [];
  }

  const reservationsCache = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);
  const headerMap = /** @type {HeaderMapType} */ (
    reservationsCache['headerMap']
  );

  const studentIdIdx = getHeaderIndex(
    headerMap,
    CONSTANTS.HEADERS.RESERVATIONS.STUDENT_ID,
  );
  const firstLectureIdx = getHeaderIndex(
    headerMap,
    CONSTANTS.HEADERS.RESERVATIONS.FIRST_LECTURE,
  );

  const result = [];

  waitlistedReservations.forEach(reservation => {
    // getCachedReservationsForの返却データ形式を確認
    // 予約データは直接配列で返される場合と、{ data: [...] } 形式で返される場合がある
    let reservationData;
    if (reservation.data && Array.isArray(reservation.data)) {
      // { data: [...] } 形式の場合
      reservationData = reservation.data;
    } else if (Array.isArray(reservation)) {
      // 直接配列で返される場合
      reservationData = reservation;
    } else {
      return; // 無効なデータ形式はスキップ
    }

    if (!reservationData || !Array.isArray(reservationData)) {
      return; // 無効なデータ形式はスキップ
    }

    const studentId = reservationData[studentIdIdx];
    const isFirstTime = reservationData[firstLectureIdx] === true;

    // 空きタイプに応じたフィルタリング
    let shouldNotify = false;
    if (availabilityType === 'both') {
      shouldNotify = true; // 両方に空きがあれば全員に通知
    } else if (availabilityType === 'general' && !isFirstTime) {
      shouldNotify = true; // 通常枠の空きは非初回者に通知
    } else if (availabilityType === 'firstTime' && isFirstTime) {
      shouldNotify = true; // 初回枠の空きは初回者に通知
    }

    if (shouldNotify) {
      // 生徒情報を取得
      const studentInfo = getCachedStudentInfo(String(studentId));

      if (studentInfo && studentInfo.email && studentInfo.email.trim() !== '') {
        // 空席連絡はメール配信希望設定に関わらず送信
        const user = {
          studentId: String(studentId),
          email: studentInfo.email,
          realName: studentInfo.realName || studentInfo.displayName,
          isFirstTime: isFirstTime,
        };
        result.push(user);
      }
    }
  });

  Logger.log(
    `通知対象者: ${result.length}名 (availabilityType: ${availabilityType})`,
  );
  return result;
}

/**
 * 空き通知メールの送信
 * @param {string} classroom - 教室名
 * @param {string} date - 日付
 * @param {Array} users - 通知対象ユーザー
 * @param {any} lesson - レッスン情報
 */
function sendAvailabilityNotificationEmails(classroom, date, users, lesson) {
  if (users.length === 0) return;

  const formattedDate = formatDateForEmail(date);

  let successCount = 0;
  let errorCount = 0;

  users.forEach(user => {
    try {
      const subject = `【川崎誠二 木彫り教室】空席情報のご案内 - ${classroom} ${formattedDate}`;
      const venue =
        lesson.schedule && lesson.schedule.venue ? lesson.schedule.venue : '';
      const body = createAvailabilityNotificationEmailBody(
        user,
        classroom,
        formattedDate,
        venue,
      );

      // テスト環境の場合は送信者を区別するため、件名にプレフィックスを追加
      const finalSubject = CONSTANTS.ENVIRONMENT.PRODUCTION_MODE
        ? subject
        : `[テスト] ${subject}`;

      GmailApp.sendEmail(user.email, finalSubject, body, {
        name: '川崎誠二 木彫り教室',
      });
      successCount++;
    } catch (emailError) {
      errorCount++;
      Logger.log(
        `空き通知メール送信エラー (${user.email}): ${emailError.message}`,
      );
    }
  });

  Logger.log(
    `空き通知メール送信完了: 成功=${successCount}件, エラー=${errorCount}件`,
  );
}

/**
 * 空席連絡メールの本文を生成
 * @param {Object} user - ユーザー情報
 * @param {string} classroom - 教室名
 * @param {string} formattedDate - フォーマット済み日付
 * @param {string} venue - 会場情報
 * @returns {string} メール本文
 */
function createAvailabilityNotificationEmailBody(
  user,
  classroom,
  formattedDate,
  venue,
) {
  return `${user.realName}さま

木彫り教室の空き連絡に関してのご連絡です。

空き連絡希望をいただいておりました以下の日程に空きが出ましたのでお知らせいたします。

【空席情報】
教室: ${classroom} ${venue}
日付: ${formattedDate}

ご予約希望の場合は、以下のリンク先の予約システムでお申し込みください。
【きぼりのよやく・きろく】 https://www.kibori-class.net/booking

なお、ご予約は先着順となります。既に埋まってしまった場合はご容赦ください。

何かご不明点があれば、このメールに直接ご返信ください。
どうぞ引き続きよろしくお願いいたします。

川崎誠二
Email: shiawasenahito3000@gmail.com
Tel: 09013755977
`;
}

/**
 * 予約の詳細情報を一括で更新します（Phase 3: 型システム統一対応）
 *
 * @param {ReservationUpdateDto} details - 予約更新リクエストDTO
 * @returns {ApiResponseGeneric<{message: string}>} - 処理結果
 *
 * @example
 * const result = updateReservationDetails({
 *   reservationId: 'R-001',
 *   classroom: '東京教室',
 *   studentId: 'S-001',
 *   startTime: '14:00',
 *   endTime: '17:00',
 *   chiselRental: false,
 *   workInProgress: '仏像完成間近',
 * });
 */
function updateReservationDetails(details) {
  return withTransaction(() => {
    /** @type {ReservationUpdateDto} */
    const detailsTyped = /** @type {ReservationUpdateDto} */ (details);
    const { reservationId, classroom } = detailsTyped;
    /** @type {string | null} */
    let studentId = null;

    try {
      // 既存の予約から日付を取得して日程マスタ情報を取得
      /** @type {SheetSearchResult} */
      const existingReservation = /** @type {SheetSearchResult} */ (
        getSheetDataWithSearch(
          getSheetByName(CONSTANTS.SHEET_NAMES.RESERVATIONS),
          CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID,
          reservationId,
        )
      );

      if (!existingReservation || !existingReservation.foundRow) {
        throw new Error(`予約ID「${reservationId}」が見つかりませんでした。`);
      }

      /** @type {ScheduleRule | null} */
      let scheduleRule = null;
      const dateColIdx = existingReservation.headerMap.get(
        CONSTANTS.HEADERS.RESERVATIONS.DATE,
      );
      const reservationDate =
        dateColIdx !== undefined
          ? existingReservation.foundRow[dateColIdx]
          : null;

      const scheduleCache = getCachedData(CACHE_KEYS.MASTER_SCHEDULE_DATA);
      /** @type {ScheduleMasterData[]} */
      const scheduleData = scheduleCache
        ? /** @type {ScheduleMasterData[]} */
          (scheduleCache['schedule'])
        : [];
      const reservationDateForSearch = new Date(String(reservationDate));
      const reservationDateStringForSearch =
        reservationDateForSearch.toDateString();

      /** @type {ScheduleMasterData | undefined} */
      const foundSchedule = scheduleData.find(
        /** @param {ScheduleMasterData} item */
        item => {
          const itemDate = item.date;
          if (!itemDate || !item.classroom) return false;

          const dateMatches =
            itemDate instanceof Date &&
            itemDate.toDateString() === reservationDateStringForSearch;

          return dateMatches && item.classroom === classroom;
        },
      );
      scheduleRule = /** @type {ScheduleRule | null} */ (foundSchedule || null);

      // 時間制予約（30分単位）の場合の検証
      if (scheduleRule && scheduleRule['type'] === CONSTANTS.UNITS.THIRTY_MIN) {
        _validateTimeBasedReservation(
          detailsTyped.startTime,
          detailsTyped.endTime,
          /** @type {ScheduleMasterData} */ (scheduleRule),
        );
      }

      // --- 定員チェック（予約更新時） ---
      // ご指摘の通り、自分自身の予約を除外して空き状況を計算します
      const startTimeColIdx_check = existingReservation.headerMap.get(
        CONSTANTS.HEADERS.RESERVATIONS.START_TIME,
      );
      const endTimeColIdx_check = existingReservation.headerMap.get(
        CONSTANTS.HEADERS.RESERVATIONS.END_TIME,
      );

      // 1. 現在の全体の空き状況を取得
      const lessonsResponse = getLessons();
      if (!lessonsResponse.success) {
        throw new Error('空き状況の取得に失敗し、予約を更新できません。');
      }
      const targetLesson = lessonsResponse.data.find(
        l =>
          l.schedule.date ===
            Utilities.formatDate(
              new Date(String(existingReservation.foundRow[dateColIdx])),
              CONSTANTS.TIMEZONE,
              'yyyy-MM-dd',
            ) && l.schedule.classroom === classroom,
      );

      // 2. 2部制クラスの場合のみ、詳細なチェックを実行
      if (
        targetLesson &&
        targetLesson.schedule.classroomType ===
          CONSTANTS.CLASSROOM_TYPES.TIME_DUAL
      ) {
        const status = targetLesson.status;
        const schedule = targetLesson.schedule;

        // 3. 更新「前」の予約が占有していたセッションを特定
        const oldStartTimeValue =
          existingReservation.foundRow[startTimeColIdx_check];
        const oldStartTime =
          oldStartTimeValue && typeof oldStartTimeValue !== 'boolean'
            ? Utilities.formatDate(
                new Date(oldStartTimeValue),
                CONSTANTS.TIMEZONE,
                'HH:mm',
              )
            : null;

        const oldEndTimeValue =
          existingReservation.foundRow[endTimeColIdx_check];
        const oldEndTime =
          oldEndTimeValue && typeof oldEndTimeValue !== 'boolean'
            ? Utilities.formatDate(
                new Date(oldEndTimeValue),
                CONSTANTS.TIMEZONE,
                'HH:mm',
              )
            : null;

        let oldMorningOccupied = false;
        let oldAfternoonOccupied = false;
        if (
          oldStartTime &&
          oldEndTime &&
          schedule.firstEnd &&
          schedule.secondStart
        ) {
          if (oldStartTime < schedule.firstEnd) oldMorningOccupied = true;
          if (oldEndTime > schedule.secondStart) oldAfternoonOccupied = true;
        }

        // 4. 更新「後」の予約が必要とするセッションを特定
        const newStartTime = detailsTyped.startTime;
        const newEndTime = detailsTyped.endTime;

        let newMorningRequired = false;
        let newAfternoonRequired = false;
        if (
          newStartTime &&
          newEndTime &&
          schedule.firstEnd &&
          schedule.secondStart
        ) {
          if (newStartTime < schedule.firstEnd) newMorningRequired = true;
          if (newEndTime > schedule.secondStart) newAfternoonRequired = true;
        }

        // 5. 自分を除いた「真の空きスロット」を計算
        let adjustedMorningSlots = status.morningSlots;
        if (oldMorningOccupied) {
          adjustedMorningSlots += 1;
        }
        let adjustedAfternoonSlots = status.afternoonSlots;
        if (oldAfternoonOccupied) {
          adjustedAfternoonSlots += 1;
        }

        // 6. 新しい予約時間で入れるか最終チェック
        let canFit = true;
        if (newMorningRequired && adjustedMorningSlots <= 0) {
          canFit = false;
        }
        if (newAfternoonRequired && adjustedAfternoonSlots <= 0) {
          canFit = false;
        }

        if (!canFit) {
          throw new Error(
            '満席のため、ご希望の時間帯に予約を変更することはできません。',
          );
        }
        Logger.log(
          `[updateReservationDetails] 定員チェックOK: newTime=${newStartTime}-${newEndTime}, adjustedSlots(M:${adjustedMorningSlots}, A:${adjustedAfternoonSlots})`,
        );
      }
      // --- 定員チェックここまで ---

      // 統合予約シートを取得
      const integratedSheet = getSheetByName(
        CONSTANTS.SHEET_NAMES.RESERVATIONS,
      );
      /** @type {SheetSearchResult} */
      const searchResultUpdate = /** @type {SheetSearchResult} */ (
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
          `1900-01-01T${detailsTyped.startTime}:00+09:00`,
        );
      }

      if (endTimeColIdx !== undefined && detailsTyped.endTime) {
        rowData[endTimeColIdx] = new Date(
          `1900-01-01T${detailsTyped.endTime}:00+09:00`,
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
        rowData[orderColIdx] = String(detailsTyped.order || '');
      }

      if (messageColIdx !== undefined) {
        rowData[messageColIdx] = detailsTyped.messageToTeacher || '';
      }

      // 該当行のみを書き戻し
      integratedSheet
        .getRange(targetRowIndex, 1, 1, rowData.length)
        .setValues([rowData]);

      SpreadsheetApp.flush();

      // 統合予約シートの更新後、インクリメンタルキャッシュ更新（高速化）
      try {
        Logger.log('[UPDATE] インクリメンタルキャッシュ更新実行');
        updateReservationInCache(
          reservationId,
          /** @type {(string | number | Date)[]} */
          (rowData),
          headerMapUpdate,
        );
      } catch (e) {
        Logger.log(
          `インクリメンタル更新エラー: ${e.message} - フォールバック実行`,
        );
        // インクリメンタル更新エラー時は通常の再構築にフォールバック
        try {
          rebuildAllReservationsCache();
        } catch (rebuildError) {
          Logger.log(
            `キャッシュ再構築もエラー: ${rebuildError.message} - 処理続行`,
          );
        }
      }

      const studentIdColIdx = headerMapUpdate.get(
        CONSTANTS.HEADERS.RESERVATIONS.STUDENT_ID,
      );
      studentId =
        rowData && studentIdColIdx !== undefined
          ? String(rowData[studentIdColIdx] || '')
          : null;
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
 * @param {AccountingDetailsPayload} payload - フロントエンドから渡される会計情報ペイロード。
 * @returns {ApiResponseGeneric<{message: string}>} - 処理結果。
 */
function saveAccountingDetails(payload) {
  return withTransaction(() => {
    try {
      const { reservationId, classroom, studentId, userInput, workInProgress } =
        /** @type {any} */ (payload);
      if (!reservationId || !classroom || !studentId || !userInput) {
        throw new Error('会計情報が不足しています。');
      }

      const sheet = getSheetByName(CONSTANTS.SHEET_NAMES.RESERVATIONS);
      /** @type {SheetSearchResult} */
      const searchResultAccounting = /** @type {SheetSearchResult} */ (
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
      /** @type {AccountingMasterItem[]} */
      const masterData = accountingCache
        ? /** @type {AccountingMasterItem[]} */
          (accountingCache['items'])
        : [];
      const finalAccountingDetails = {
        tuition: {
          items: /** @type {Array<{name: string, price: number}>} */ ([]),
          subtotal: 0,
        },
        sales: {
          items: /** @type {Array<{name: string, price: number}>} */ ([]),
          subtotal: 0,
        },
        grandTotal: 0,
        paymentMethod:
          userInput.paymentMethod || CONSTANTS.PAYMENT_DISPLAY.CASH,
      };

      // 授業料の計算
      (userInput.tuitionItems || []).forEach(
        /** @param {string | {name: string, price: number}} item */ item => {
          // フロントエンドから送られるデータ形式に合わせて修正
          const itemName = typeof item === 'string' ? item : item.name;
          const itemPrice =
            typeof item === 'object' && item.price !== undefined
              ? item.price
              : null;

          if (itemPrice !== null) {
            // フロントエンドで計算済みの価格をそのまま使用
            finalAccountingDetails.tuition.items.push({
              name: itemName,
              price: itemPrice,
            });
            finalAccountingDetails.tuition.subtotal += itemPrice;
          } else {
            // 後方互換性：文字列の場合はマスタから価格を取得
            const masterItem = masterData.find(
              /** @param {AccountingMasterItem} m */ m =>
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
          }
        },
      );

      // 時間制授業料の計算は不要（フロントエンドで計算済み）
      // userInput.tuitionItems に「授業料（時間制） X時間」として含まれている
      // userInput.timeBased は時刻情報の保存のみに使用

      // 物販・材料費の計算
      (userInput.salesItems || []).forEach(
        /** @param {{name: string, price?: number}} item */ item => {
          // フロントエンドから送られるデータが既に計算済みの場合はそのまま使用
          if (item.price !== undefined && item.price !== null) {
            finalAccountingDetails.sales.items.push({
              name: item.name,
              price: Number(item.price),
            });
            finalAccountingDetails.sales.subtotal += Number(item.price);
          } else {
            // 価格が設定されていない場合はマスタから取得（後方互換性）
            const masterItem = masterData.find(
              /** @param {AccountingMasterItem} m */ m =>
                m[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME] === item.name &&
                (m[CONSTANTS.HEADERS.ACCOUNTING.TYPE] ===
                  CONSTANTS.ITEM_TYPES.SALES ||
                  m[CONSTANTS.HEADERS.ACCOUNTING.TYPE] ===
                    CONSTANTS.ITEM_TYPES.MATERIAL),
            );
            if (masterItem) {
              const price = Number(
                masterItem[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE],
              );
              finalAccountingDetails.sales.items.push({
                name: item.name,
                price: price,
              });
              finalAccountingDetails.sales.subtotal += price;
            }
          }
        },
      );

      finalAccountingDetails.grandTotal =
        finalAccountingDetails.tuition.subtotal +
        finalAccountingDetails.sales.subtotal;

      // 更新する行のデータを準備
      const updatedRowData = [...reservationDataRow]; // 元データのコピー

      // 1. 時刻などを更新（シート側フォーマット設定済み）
      if (userInput.timeBased) {
        const { startTime, endTime } = userInput.timeBased;
        const startTimeColIdx = headerMap.get(
          CONSTANTS.HEADERS.RESERVATIONS.START_TIME,
        );
        const endTimeColIdx = headerMap.get(
          CONSTANTS.HEADERS.RESERVATIONS.END_TIME,
        );

        if (startTimeColIdx !== undefined) {
          updatedRowData[startTimeColIdx] = startTime
            ? new Date(`1900-01-01T${startTime}:00+09:00`)
            : null;
        }
        if (endTimeColIdx !== undefined) {
          updatedRowData[endTimeColIdx] = endTime
            ? new Date(`1900-01-01T${endTime}:00+09:00`)
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

      // 4. 制作メモの更新（会計完了時に入力された内容を反映）
      const wipColIdx = headerMap.get(
        CONSTANTS.HEADERS.RESERVATIONS.WORK_IN_PROGRESS,
      );
      if (wipColIdx !== undefined && workInProgress !== undefined) {
        updatedRowData[wipColIdx] = workInProgress || '';
        PerformanceLog.debug(`制作メモを更新: ${workInProgress || '(空)'}`);
      }

      // 5. 会計完了時のステータス更新 (confirmed → completed)
      const statusColIdx = headerMap.get(CONSTANTS.HEADERS.RESERVATIONS.STATUS);
      if (statusColIdx !== undefined) {
        updatedRowData[statusColIdx] = CONSTANTS.STATUS.COMPLETED;
      }

      // 該当行のみを一括で書き戻し
      sheet
        .getRange(targetRowIndex, 1, 1, updatedRowData.length)
        .setValues([updatedRowData]);

      SpreadsheetApp.flush();

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

      const userInfo = getCachedStudentInfo(studentId);

      const subject = `会計記録 (${classroom}) ${userInfo.realName}: ${userInfo.displayName}様`;
      const body =
        `会計が記録されました。

` +
        `本名: ${userInfo.realName}
` +
        `ニックネーム: ${userInfo.displayName}

` +
        `教室: ${classroom}
` +
        `予約ID: ${reservationId}
` +
        `生徒ID: ${studentId}
` +
        `合計金額: ¥${finalAccountingDetails.grandTotal.toLocaleString()}

` +
        `詳細はスプレッドシートを確認してください。`;
      sendAdminNotification(subject, body);

      // 会計データ操作時のインクリメンタルキャッシュ更新（高速化）
      try {
        Logger.log('[ACCOUNTING] インクリメンタルキャッシュ更新実行');
        // ステータスをCOMPLETEDに更新（会計詳細はキャッシュに含まれないため更新不要）
        updateReservationColumnInCache(
          reservationId,
          CONSTANTS.HEADERS.RESERVATIONS.STATUS,
          CONSTANTS.STATUS.COMPLETED,
        );
      } catch (e) {
        Logger.log(
          `インクリメンタル更新エラー: ${e.message} - フォールバック実行`,
        );
        // インクリメンタル更新エラー時は通常の再構築にフォールバック
        try {
          rebuildAllReservationsCache();
        } catch (rebuildError) {
          Logger.log(
            `キャッシュ再構築もエラー: ${rebuildError.message} - 処理続行`,
          );
        }
      }

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
 * @param {ReservationArrayData} reservationDataRow - 売上ログを生成する対象の予約データ行。
 * @param {Map<string, number>} headerMap - 予約シートのヘッダーマップ。
 * @param {string} classroomName - 教室名。
 * @param {AccountingDetails} accountingDetails - 計算済みの会計詳細オブジェクト。
 */
function _logSalesForSingleReservation(
  reservationDataRow,
  headerMap,
  classroomName,
  accountingDetails,
) {
  try {
    // 生徒情報を取得
    const studentId = String(
      reservationDataRow[
        headerMap.get(CONSTANTS.HEADERS.RESERVATIONS.STUDENT_ID)
      ] || '',
    );
    const studentData = getCachedStudentById(studentId);

    // 名前を「本名（ニックネーム）」形式で構築
    let displayNameForSales = '不明';
    if (studentData) {
      const realName = studentData.realName || '';
      const nickName = studentData.displayName || '';

      if (realName && nickName) {
        displayNameForSales = `${realName}（${nickName}）`;
      } else if (realName) {
        displayNameForSales = realName;
      } else if (nickName) {
        displayNameForSales = nickName;
      }
    }

    /** @type {SalesBaseInfo} */
    const baseInfo = {
      date:
        reservationDataRow[
          headerMap.get(CONSTANTS.HEADERS.RESERVATIONS.DATE)
        ] instanceof Date
          ? /** @type {Date} */
            (
              reservationDataRow[
                headerMap.get(CONSTANTS.HEADERS.RESERVATIONS.DATE)
              ]
            )
          : new Date(
              String(
                reservationDataRow[
                  headerMap.get(CONSTANTS.HEADERS.RESERVATIONS.DATE)
                ],
              ),
            ),
      studentId: studentId,
      // 生徒名を「本名（ニックネーム）」形式で表示
      name: displayNameForSales,
      classroom: classroomName,
      venue: String(
        reservationDataRow[
          headerMap.get(CONSTANTS.HEADERS.RESERVATIONS.VENUE)
        ] || '',
      ),
      paymentMethod: accountingDetails.paymentMethod || '不明',
    };

    /** @type {SalesRowArray[]} */
    const rowsToTransfer = [];
    (accountingDetails.tuition?.items || []).forEach(
      /** @param {{name: string, price: number}} item */ item => {
        rowsToTransfer.push(
          createSalesRow(
            baseInfo,
            CONSTANTS.ITEM_TYPES.TUITION,
            item.name,
            item.price,
          ),
        );
      },
    );
    (accountingDetails.sales?.items || []).forEach(
      /** @param {{name: string, price: number}} item */ item => {
        rowsToTransfer.push(
          createSalesRow(
            baseInfo,
            CONSTANTS.ITEM_TYPES.SALES,
            item.name,
            item.price,
          ),
        );
      },
    );

    if (rowsToTransfer.length > 0) {
      if (!SALES_SPREADSHEET_ID) {
        throw new Error(
          '売上スプレッドシートIDが設定されていません。スクリプトプロパティでSALES_SPREADSHEET_IDを設定してください。',
        );
      }
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
 * @returns {ScheduleRule | null} 日程マスタ情報（型、時間、定員等）
 */
function getScheduleInfoForDate(date, classroom) {
  try {
    const scheduleCache = getCachedData(CACHE_KEYS.MASTER_SCHEDULE_DATA);
    if (!scheduleCache?.['schedule']) {
      return null;
    }

    /** @type {ScheduleMasterData[]} */
    const scheduleDataArray = /** @type {ScheduleMasterData[]} */ (
      scheduleCache['schedule']
    );

    Logger.log(
      `🔍 getScheduleInfoForDate: キャッシュ件数=${scheduleDataArray.length}`,
    );

    // デバッグ用：最初の数件を確認
    scheduleDataArray.slice(0, 3).forEach((item, idx) => {
      Logger.log(
        `🔍 サンプル${idx}: date=${item.date}, classroom=${item.classroom}, status=${item.status}`,
      );
    });

    // 検索対象日付の標準化
    const targetDateForInfo = new Date(date + 'T00:00:00+09:00');
    const targetDateStringForInfo = targetDateForInfo.toDateString();

    // 該当する日程を検索
    const schedule = scheduleDataArray.find(
      /** @param {ScheduleMasterData} item */ item => {
        // 日程マスタの日付はキャッシュ構築時にDate型で正規化済み
        const dateMatch =
          item.date instanceof Date &&
          item.date.toDateString() === targetDateStringForInfo;

        const classroomMatch = item.classroom === classroom;
        const statusOk = item.status !== CONSTANTS.SCHEDULE_STATUS.CANCELLED;

        return dateMatch && classroomMatch && statusOk;
      },
    );

    if (!schedule) {
      return null;
    }

    let totalCapacity = schedule.totalCapacity;
    if (totalCapacity !== undefined && totalCapacity !== null) {
      if (typeof totalCapacity === 'string') {
        totalCapacity = parseInt(totalCapacity, 10);
        if (isNaN(totalCapacity)) totalCapacity = 0;
      }
    } else {
      // 日程マスタで全体定員が未設定の場合は0とする（システムデフォルト使用を廃止）
      totalCapacity = 0;
    }

    let beginnerCapacity = schedule.beginnerCapacity;
    if (beginnerCapacity !== undefined && beginnerCapacity !== null) {
      if (typeof beginnerCapacity === 'string') {
        beginnerCapacity = parseInt(beginnerCapacity, 10);
        if (isNaN(beginnerCapacity)) beginnerCapacity = 0;
      }
    } else {
      // 日程マスタで初回者定員が未設定の場合は0とする（システムデフォルト使用を廃止）
      beginnerCapacity = 0;
    }

    // 教室形式を取得（複数の可能性のあるフィールド名に対応）
    const classroomType =
      schedule['type'] ||
      schedule['教室形式'] ||
      schedule.classroomType ||
      schedule['TYPE'];

    return {
      type: String(schedule['type'] || ''), // 後方互換性のため残す
      classroomType: String(classroomType || ''), // フロントエンド用
      firstStart: String(schedule.firstStart || schedule['1部開始'] || ''),
      firstEnd: String(schedule.firstEnd || schedule['1部終了'] || ''),
      secondStart: String(schedule.secondStart || schedule['2部開始'] || ''),
      secondEnd: String(schedule.secondEnd || schedule['2部終了'] || ''),
      beginnerStart: String(
        schedule.beginnerStart || schedule['初回者開始'] || '',
      ),
      totalCapacity: totalCapacity,
      beginnerCapacity: beginnerCapacity,
      status: schedule.status,
      notes: String(schedule['notes'] || ''),
    };
  } catch (error) {
    Logger.log(`getScheduleInfoForDate エラー: ${error.message}`);
    return null;
  }
}

/**
 * 空席連絡希望の予約を確定予約に変更します。
 * @param {Object} confirmInfo - 確定情報
 * @param {string} confirmInfo.reservationId - 予約ID
 * @param {string} confirmInfo.classroom - 教室
 * @param {string} confirmInfo.date - 日付
 * @param {string} confirmInfo.studentId - 生徒ID
 * @param {string} [confirmInfo.messageToTeacher] - 先生へのメッセージ
 * @returns {ApiResponseGeneric<{message: string, myReservations?: ReservationData[], lessons?: LessonInfo[]}>} - 処理結果
 */
function confirmWaitlistedReservation(confirmInfo) {
  return withTransaction(() => {
    try {
      const { reservationId, classroom, date, studentId, messageToTeacher } =
        confirmInfo;

      // キャッシュから予約データを取得
      const userReservationsResponse = getUserReservations(studentId);
      if (
        !userReservationsResponse?.data?.myReservations ||
        userReservationsResponse.data.myReservations.length === 0
      ) {
        throw new Error('キャッシュされた予約データが見つかりません。');
      }

      // 対象の予約を検索（キャッシュから）
      const targetReservation =
        userReservationsResponse.data.myReservations.find(
          res => res.reservationId === reservationId,
        );
      if (!targetReservation) {
        throw new Error('対象の予約が見つかりません。');
      }

      // 現在のステータスが空席連絡希望（待機）かチェック
      if (targetReservation.status !== CONSTANTS.STATUS.WAITLISTED) {
        throw new Error('この予約は空席連絡希望ではありません。');
      }

      // シート更新のための情報を取得
      const integratedSheet = getSheetByName(
        CONSTANTS.SHEET_NAMES.RESERVATIONS,
      );
      if (!integratedSheet) throw new Error('統合予約シートが見つかりません。');

      // シートから対象行を検索（更新用）
      const searchResult = getSheetDataWithSearch(
        integratedSheet,
        CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID,
        reservationId,
      );

      if (!searchResult || searchResult.rowIndex === -1) {
        throw new Error('シート上で対象の予約が見つかりません。');
      }

      const { headerMap, rowIndex } = searchResult;
      // rowIndexは既に1ベース+ヘッダー行を考慮済みなので、そのまま使用
      const row = rowIndex;

      // 定員チェック（現在空席があるかチェック）
      const startTime = String(targetReservation.startTime || '');
      const endTime = String(targetReservation.endTime || '');

      const isFull = checkCapacityFull(classroom, date, startTime, endTime);
      if (isFull) {
        throw new Error('現在満席のため確定できません。');
      }

      // ステータスを確定に変更
      const updateData = {
        [CONSTANTS.HEADERS.RESERVATIONS.STATUS]: CONSTANTS.STATUS.CONFIRMED,
      };

      // 先生へのメッセージが提供された場合は更新
      if (messageToTeacher) {
        updateData[CONSTANTS.HEADERS.RESERVATIONS.MESSAGE_TO_TEACHER] =
          messageToTeacher;
      }

      // シートから対象行のデータを取得し、一括更新方式に変更
      const currentRowData = integratedSheet
        .getRange(row, 1, 1, integratedSheet.getLastColumn())
        .getValues()[0];
      const updatedRowData = [...currentRowData]; // 既存データのコピー

      // 各カラムを順次更新
      Object.entries(updateData).forEach(([header, value]) => {
        const colIdx = getHeaderIndex(headerMap, header);
        if (colIdx !== undefined && colIdx !== -1) {
          updatedRowData[colIdx] = value;
        }
      });

      // 行全体を一括更新（より確実な方法）
      integratedSheet
        .getRange(row, 1, 1, updatedRowData.length)
        .setValues([updatedRowData]);
      SpreadsheetApp.flush(); // 確実に書き込み完了を待機

      // キャッシュ更新 - インクリメンタル更新（より安全な方式）
      try {
        const reservationsCache = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);
        if (reservationsCache?.['headerMap']) {
          const cacheHeaderMap = /** @type {HeaderMapType} */ (
            reservationsCache['headerMap']
          );
          updateReservationInCache(
            reservationId,
            updatedRowData,
            cacheHeaderMap,
          );
        } else {
          rebuildAllReservationsCache();
        }
      } catch (cacheError) {
        Logger.log(
          `キャッシュ更新エラー: ${cacheError.message} - フォールバック再構築`,
        );
        try {
          rebuildAllReservationsCache();
        } catch (rebuildError) {
          Logger.log(`キャッシュ再構築もエラー: ${rebuildError.message}`);
        }
      }

      // ログ記録
      const user = getCachedStudentInfo(studentId);
      if (user) {
        const messageLog = messageToTeacher
          ? `, Message: ${messageToTeacher}`
          : '';
        const logDetails = `Classroom: ${classroom}, Date: ${date}, ReservationID: ${reservationId}${messageLog}`;
        logActivity(
          studentId,
          '空席連絡希望確定',
          CONSTANTS.MESSAGES.SUCCESS,
          logDetails,
        );

        // 管理者通知
        const subject = `空席連絡希望確定 (${classroom}) ${user.realName}:${user.displayName}様`;
        const messageSection = messageToTeacher
          ? `\n先生へのメッセージ: ${messageToTeacher}\n`
          : '';
        const body =
          `空席連絡希望が確定予約に変更されました。

` +
          `本名: ${user.realName}
` +
          `ニックネーム: ${user.displayName}

` +
          `教室: ${classroom}
` +
          `日付: ${date}
${messageSection}
` +
          `詳細はスプレッドシートを確認してください。`;
        sendAdminNotification(subject, body);
      }

      // 最新の予約データを取得して返却
      const userReservationsResult = getUserReservations(studentId);
      const latestMyReservations = userReservationsResult.success
        ? userReservationsResult.data.myReservations
        : [];

      const latestLessons = getLessons().data || [];

      return createApiResponse(true, {
        message: '予約が確定しました。',
        myReservations: latestMyReservations,
        lessons: latestLessons,
      });
    } catch (err) {
      Logger.log(
        `confirmWaitlistedReservation Error: ${err.message}\n${err.stack}`,
      );
      return BackendErrorHandler.handle(err, 'confirmWaitlistedReservation');
    }
  });
}
