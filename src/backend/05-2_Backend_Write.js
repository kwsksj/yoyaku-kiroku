/// <reference path="../../types/index.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 05-2_Backend_Write.gs
 * 【バージョン】: 3.1
 * 【役割】: WebAppからのデータ書き込み・更新要求（Write）と、
 * それに付随する検証ロジックに特化したバックエンド機能。
 * 【v3.1での変更点】:
 * - getReservationCoreById を活用してリファクタリング
 * - confirmWaitlistedReservation: 処理を大幅に簡素化
 * - cancelReservation: 冗長なシート検索を削除
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
    //todo: LessonCoreに、ReservationCoreかReservationIdを紐づけるフィールドを追加し、予約とレッスンを関連付けた場合、要改修
    // ★修正: キャッシュのプロパティを 'data' から 'reservations' に修正
    const reservationsCache = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);
    if (!reservationsCache?.['reservations']) {
      Logger.log('予約キャッシュデータが見つかりません');
      return false; // エラー時は重複なしと判断（保守的な動作）
    }

    /** @type {ReservationArrayData[]} */
    const allReservations = /** @type {ReservationArrayData[]} */ (
      reservationsCache['reservations']
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

    // ★改善: タイムゾーン問題を避けるため、日付は文字列(YYYY-MM-DD)のまま比較
    const targetDateString = date;

    // 同一ユーザーの同一日の有効な予約を検索
    const duplicateReservation = allReservations.find(
      /** @type {function(ReservationArrayData): boolean} */ reservation => {
        if (!reservation || !Array.isArray(reservation)) return false;

        const reservationStudentId = String(reservation[studentIdColIdx] || '');
        const reservationDate = reservation[dateColIdx];
        const reservationStatus = String(reservation[statusColIdx] || '');

        // 同一ユーザーかチェック
        if (reservationStudentId !== studentId) return false;

        // ★改善: キャッシュ内の日付は文字列形式なので、文字列で比較
        const isSameDay = String(reservationDate) === targetDateString;

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

    /** @type {LessonCore[]} */
    const lessons = /** @type {any} */ (availableSlotsResponse.data);
    const targetLesson = lessons.find(
      lesson => lesson.classroom === classroom && lesson.date === date,
    );

    if (!targetLesson) {
      Logger.log(`対象日程が見つかりません: ${date} ${classroom}`);
      return false; // 対象日程が見つからない場合は予約を通す
    }

    let isFull = false;

    // 教室タイプに応じた満席判定
    if (
      targetLesson.firstSlots !== undefined &&
      targetLesson.secondSlots !== undefined
    ) {
      // 時間制・2部制の場合
      const reqStart = startTime ? new Date(`1900-01-01T${startTime}`) : null;
      const reqEnd = endTime ? new Date(`1900-01-01T${endTime}`) : null;

      const firstEndTime = targetLesson.firstEnd
        ? new Date(`1900-01-01T${targetLesson.firstEnd}`)
        : null;
      const secondStartTime = targetLesson.secondStart
        ? new Date(`1900-01-01T${targetLesson.secondStart}`)
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
        // 両方のセッションにまたがる予約の場合、どちらか一方が満席ならNG
        isFull =
          (targetLesson.firstSlots || 0) <= 0 ||
          (targetLesson.secondSlots || 0) <= 0;
      } else if (isMorningRequest) {
        // 午前のみの予約
        isFull = (targetLesson.firstSlots || 0) <= 0;
      } else if (isAfternoonRequest) {
        // 午後のみの予約
        isFull = (targetLesson.secondSlots || 0) <= 0;
      } else {
        // 予約がセッション時間外の場合 (例: 休憩時間内)
        // この予約は不正だが、ここでは満席とは扱わず、後続のバリデーションに任せる
        isFull = false;
      }
    } else {
      // 通常教室（セッション制・全日時間制）の場合
      isFull = (targetLesson.firstSlots || 0) <= 0;
    }

    Logger.log(
      `[checkCapacityFull] ${date} ${classroom}: 満席=${isFull}, firstSlots=${targetLesson.firstSlots}, secondSlots=${targetLesson.secondSlots}`,
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
 * 【内部関数】ReservationCoreオブジェクトをシートに書き込み、キャッシュを更新する
 * @param {ReservationCore} reservation - 保存する完全な予約オブジェクト
 * @param {'create' | 'update'} mode - 'create'なら新規追加、'update'なら上書き
 * @returns {{newRowData: RawSheetRow, headerMap: HeaderMapType}} 保存された行データとヘッダーマップ
 */
function _saveReservationCoreToSheet(reservation, mode) {
  const sheet = getSheetByName(CONSTANTS.SHEET_NAMES.RESERVATIONS);
  if (!sheet) throw new Error('予約記録シートが見つかりません。');

  const { header, headerMap, dataRows } = getSheetData(sheet);

  // Coreオブジェクトを行データに変換
  const newRowData = convertReservationToRow(reservation, headerMap, header);

  if (mode === 'create') {
    // 新規行として追加
    sheet
      .getRange(sheet.getLastRow() + 1, 1, 1, newRowData.length)
      .setValues([newRowData]);
  } else {
    // mode === 'update'
    // 既存行を探して上書き
    const reservationIdColIdx = headerMap.get(
      CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID,
    );
    const targetRowIndex = dataRows.findIndex(
      row => row[reservationIdColIdx] === reservation.reservationId,
    );

    if (targetRowIndex !== -1) {
      sheet
        .getRange(targetRowIndex + 2, 1, 1, newRowData.length) // +2 for header and 0-based index
        .setValues([newRowData]);
    } else {
      throw new Error(
        `更新対象の予約が見つかりません: ${reservation.reservationId}`,
      );
    }
  }

  SpreadsheetApp.flush();

  // インクリメンタルキャッシュ更新
  try {
    /** @type {(string|number|Date)[]} */
    const rowForCache = newRowData.map(val =>
      typeof val === 'boolean' ? String(val).toUpperCase() : val,
    );
    if (mode === 'create') {
      //todo: 要確認
      addReservationToCache(rowForCache, headerMap);
    } else {
      updateReservationInCache(reservation.reservationId, rowForCache, headerMap);
    }
  } catch (e) {
    Logger.log(`インクリメンタル更新エラー: ${e.message} - フォールバック実行`);
    // エラー時は安全のため全体を再構築
    rebuildAllReservationsCache();
  }

  return { newRowData, headerMap };
}

/**
 * 予約を実行します（Phase 8: Core型統一対応）
 *
 * @param {ReservationCore} reservationInfo - 予約作成リクエスト（Core型）。reservationId/statusはundefined可
 * @returns {ApiResponseGeneric<{message: string}>} - 処理結果
 *
 * @example
 * const result = makeReservation({
 *   studentId: 'S-001',
 *   classroom: '東京教室',
 *   date: '2025-10-15',
 *   startTime: '13:00',
 *   endTime: '16:00',
 *   chiselRental: true,
 *   firstLecture: false,
 * });
 */
function makeReservation(reservationInfo) {
  return withTransaction(() => {
    try {
      // 日程マスタから該当日・教室の情報を取得
      const scheduleCache = getCachedData(CACHE_KEYS.MASTER_SCHEDULE_DATA);
      /** @type {ScheduleMasterData[]} */
      const scheduleData = scheduleCache
        ? /** @type {ScheduleMasterData[]} */ (scheduleCache['schedule'])
        : [];
      // 検索対象日付の標準化
      const targetDateForSearch = new Date(reservationInfo.date + 'T00:00:00+09:00');
      const targetDateStringForSearch = targetDateForSearch.toDateString();

      const scheduleRule = scheduleData.find(
        /** @param {ScheduleMasterData} item */ item => {
          const itemDate = item.date;
          if (!itemDate || !item.classroom) return false;
          const dateMatches =
            itemDate instanceof Date &&
            itemDate.toDateString() === targetDateStringForSearch;
          return dateMatches && item.classroom === reservationInfo.classroom;
        },
      );

      // 時間制予約（30分単位）の場合の検証
      if (scheduleRule && scheduleRule['type'] === CONSTANTS.UNITS.THIRTY_MIN) {
        _validateTimeBasedReservation(reservationInfo.startTime, reservationInfo.endTime, scheduleRule);
      }

      // 同一日重複予約チェック
      const hasDuplicateReservation = checkDuplicateReservationOnSameDay(
        reservationInfo.studentId,
        reservationInfo.date,
      );
      if (hasDuplicateReservation) {
        throw new Error(
          '同一日に既に予約が存在します。1日につき1つの予約のみ可能です。',
        );
      }
      Logger.log(
        `[makeReservation] 重複予約チェック完了: ${reservationInfo.studentId} ${reservationInfo.date} - 重複なし`,
      );

      // 【パフォーマンス対策】シートアクセス前に事前ウォームアップ
      Logger.log('[RESERVATION] 事前ウォームアップ実行');
      SS_MANAGER.warmupAsync();

      // 定員チェック（共通関数を使用）
      const isFull = checkCapacityFull(reservationInfo.classroom, reservationInfo.date, reservationInfo.startTime, reservationInfo.endTime);
      Logger.log(
        `[makeReservation] 定員チェック結果: ${reservationInfo.classroom} ${reservationInfo.date} - 満席=${isFull}`,
      );

      // 完全なReservationCoreオブジェクトを構築
      const createdReservationId = Utilities.getUuid();
      const status =
        isFull
          ? CONSTANTS.STATUS.WAITLISTED
          : CONSTANTS.STATUS.CONFIRMED;

      // 日付文字列をDateオブジェクトに変換（予約記録シートに適した形式）
      const targetDate = new Date(reservationInfo.date + 'T00:00:00+09:00');

      // 会場情報を取得（reservationInfoまたは同日同教室の既存予約から）
      let finalVenue = reservationInfo.venue || '';
      if (!finalVenue) {
        // 会場情報が未設定の場合、バックエンドでは無理に補完せず、空のまま保存する方針に変更。
        // 補完ロジックが必要な場合は、`_saveReservationCoreToSheet`の前で`getSheetData`を呼び出して`data`を取得する必要がある。
      }

      /** @type {ReservationCore} */
      const completeReservation = {
        ...reservationInfo,
        reservationId: createdReservationId,
        status: status,
        venue: finalVenue,
      };

      // 共通関数を呼び出して保存
      _saveReservationCoreToSheet(completeReservation, 'create');

      // userが自動付与された状態で取得
      const reservationWithUser = getReservationCoreById(createdReservationId);

      if (!reservationWithUser) {
        // キャッシュ再取得に失敗した場合でも、予約自体は成功している可能性があるため、
        // 限定的な情報でログを残し、処理は成功として終了する。
        Logger.log(
          `[makeReservation] 警告: キャッシュからの再取得に失敗。ReservationID: ${createdReservationId}`,
        );
        logActivity(
          reservationInfo.studentId,
          '予約作成',
          CONSTANTS.MESSAGES.SUCCESS,
          `ReservationID: ${createdReservationId} (詳細はシート確認)`,
        );
        // この場合、通知はスキップされる
        return createApiResponse(true, {
          message: isFull
            ? '満席のため、空き連絡希望で登録しました。'
            : '予約が完了しました。',
        });
      }

      // 取得した最新データに基づいてメッセージとログを生成
      const isNowWaiting =
        reservationWithUser.status === CONSTANTS.STATUS.WAITLISTED;
      const message =
        isNowWaiting
          ? '満席のため、空き連絡希望で登録しました。'
          : '予約が完了しました。';

      const messageLog = reservationWithUser.messageToTeacher
        ? `, Message: ${reservationWithUser.messageToTeacher}`
        : '';
      const actionType = isNowWaiting ? '空き連絡希望登録' : '予約作成';
      const logDetails = `Classroom: ${reservationWithUser.classroom}, Date: ${reservationWithUser.date}, Status: ${reservationWithUser.status}, ReservationID: ${reservationWithUser.reservationId}${messageLog}`;
      logActivity(
        reservationWithUser.studentId,
        actionType,
        CONSTANTS.MESSAGES.SUCCESS,
        logDetails,
      );

      // 管理者通知（統一関数使用）
      sendAdminNotificationForReservation(reservationWithUser, 'created');

      // 予約確定メール送信（統一インターフェース使用）
      if (reservationWithUser.user?.wantsEmail) {
        Utilities.sleep(100); // 短い待機
        try {
          sendReservationEmailAsync(reservationWithUser, 'confirmation');
        } catch (emailError) {
          Logger.log(`メール送信エラー（予約は成功）: ${emailError.message}`);
        }
      }

      return createApiResponse(true, {
        message: message,
      });
    } catch (err) {
      logActivity(
        reservationInfo.studentId,
        '予約作成',
        CONSTANTS.MESSAGES.ERROR,
        `Error: ${err.message}`,
      );
      Logger.log(`makeReservation Error: ${err.message}
${err.stack}`);
      return BackendErrorHandler.handle(err, 'makeReservation');
    }
  });
}

/**
 * 予約をキャンセルします（Core型オブジェクト中心設計）
 *
 * @param {ReservationCore} cancelInfo - 予約キャンセル情報。`reservationId`と`studentId`は必須。`cancelMessage`は任意。
 * @returns {ApiResponseGeneric<{message: string}>} - 処理結果
 */
function cancelReservation(cancelInfo) {
  return withTransaction(() => {
    try {
      const { reservationId, studentId, cancelMessage } = cancelInfo;

      const existingReservation = getReservationCoreById(reservationId);

      if (!existingReservation) {
        throw new Error(`予約が見つかりません: ID=${reservationId}`);
      }

      // 権限チェック
      if (existingReservation.studentId !== studentId) {
        throw new Error('この予約をキャンセルする権限がありません。');
      }

      // 2. キャンセル後の新しい予約オブジェクトを構築
      /** @type {ReservationCore} */
      const cancelledReservation = {
        ...existingReservation,
        status: CONSTANTS.STATUS.CANCELED,
        cancelMessage: cancelMessage || existingReservation.cancelMessage, // 新しいメッセージがあれば上書き
      };

      // 共通関数を呼び出して保存
      _saveReservationCoreToSheet(cancelledReservation, 'update');

      const messageLog = cancelMessage ? `, Message: ${cancelMessage}` : '';
      const logDetails = `Classroom: ${cancelledReservation.classroom}, ReservationID: ${cancelledReservation.reservationId}${messageLog}`;
      logActivity(
        studentId,
        CONSTANTS.LOG_ACTIONS.RESERVATION_CANCEL,
        CONSTANTS.MESSAGES.SUCCESS,
        logDetails,
      );

      //キャンセル後の空き通知処理
      try {
        // ★改善: 冗長なシート検索を削除し、既存のオブジェクトを利用
        notifyAvailabilityToWaitlistedUsers(
          cancelledReservation.classroom,
          cancelledReservation.date,
          existingReservation, // 元の予約データ
        );
      } catch (notificationError) {
        Logger.log(`空き通知エラー: ${notificationError.message}`);
      }

      // 管理者通知とキャンセルメール送信
      sendAdminNotificationForReservation(cancelledReservation, 'cancelled', {
        cancelMessage: cancelMessage,
      });

      if (cancelledReservation.user?.wantsEmail) {
        Utilities.sleep(100); // 短い待機
        try {
          sendReservationEmailAsync(
            cancelledReservation,
            'cancellation',
            cancelMessage,
          );
        } catch (emailError) {
          Logger.log(
            `キャンセルメール送信エラー（キャンセルは成功）: ${emailError.message}`,
          );
        }
      }

      return {
        success: true,
        message: '予約をキャンセルしました。',
      };
    } catch (err) {
      logActivity(
        cancelInfo.studentId || 'N/A', // エラー発生時はcancelInfoから取得を試みる
        CONSTANTS.LOG_ACTIONS.RESERVATION_CANCEL,
        CONSTANTS.MESSAGES.ERROR,
        `Error: ${err.message}`,
      );
      Logger.log(`cancelReservation Error: ${err.message}
${err.stack}`);
      return BackendErrorHandler.handle(err, 'cancelReservation');
    }
  });
}

/**
 * キャンセル後の空き連絡希望者への通知機能
 * @param {string} classroom - 教室名
 * @param {string} date - 日付（yyyy-MM-dd形式）
 * @param {ReservationCore} _cancelledReservation - キャンセルされた予約データ（将来の拡張用）
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
      lesson => lesson.classroom === classroom && lesson.date === date,
    );

    if (!targetLesson) {
      Logger.log(`対象日程が見つかりません: ${classroom} ${date}`);
      return;
    }

    // 空きがあるかチェック
    let hasAvailability = false;
    let availabilityType = ''; // 'general' or 'firstTime'

    // 通常参加者用の空きチェック
    if (
      targetLesson.secondSlots !== undefined &&
      targetLesson.firstSlots !== undefined
    ) {
      // 時間制・2部制の場合
      if (targetLesson.firstSlots > 0 || targetLesson.secondSlots > 0) {
        hasAvailability = true;
        availabilityType = 'general';
      }
    } else if (targetLesson.firstSlots !== undefined && targetLesson.firstSlots > 0) {
      // 通常教室の場合
      hasAvailability = true;
      availabilityType = 'general';
    }

    // 初回者専用枠の空きチェック
    if (
      targetLesson.beginnerSlots !== undefined &&
      targetLesson.beginnerSlots !== null &&
      targetLesson.beginnerSlots > 0
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
  // ★改善: getCachedReservationsAsObjects を使い、オブジェクトとして直接取得する
  const allReservations = getCachedReservationsAsObjects();
  const waitlistedReservations = allReservations.filter(
    r =>
      r.date === date &&
      r.classroom === classroom &&
      r.status === CONSTANTS.STATUS.WAITLISTED,
  );

  if (waitlistedReservations.length === 0) {
    Logger.log(`空き連絡希望者なし: ${classroom} ${date}`);
    return [];
  }

  /** @type {Array<{studentId: string, email: string, realName: string, isFirstTime: boolean}>} */
  const result = [];

  waitlistedReservations.forEach(reservation => {
    const studentId = reservation.studentId;
    const isFirstTime = reservation.firstLecture;

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
      const studentInfo = /** @type {UserCore} */ (
        getCachedStudentById(String(studentId))
      );

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
 * @param {Array<{studentId: string, email: string, realName: string, isFirstTime: boolean}>} users - 通知対象ユーザー
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
      const venue = lesson.venue || '';
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
 * @param {{studentId: string, email: string, realName: string, isFirstTime: boolean}} user - ユーザー情報
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
 * 予約の詳細情報を一括で更新します（Core型オブジェクト中心設計）
 *
 * @param {ReservationCore} details - 予約更新リクエスト。`reservationId`と更新したいフィールドのみを持つ部分的な`ReservationCore`オブジェクト。
 * @returns {ApiResponseGeneric<{message: string}>} - 処理結果
 */
function updateReservationDetails(details) {
  return withTransaction(() => {
    try {
      // 1. 既存の予約データをCore型オブジェクトとして取得
      const existingReservation = getReservationCoreById(details.reservationId);
      if (!existingReservation) {
        throw new Error(`予約ID「${details.reservationId}」が見つかりませんでした。`);
      }

      // 2. 更新内容をマージして、新しい予約オブジェクトを構築
      /** @type {ReservationCore} */
      const updatedReservation = {
        ...existingReservation,
        ...details,
      };

      // 3. バリデーション
      // 日程マスタから該当日・教室の情報を取得
      const scheduleRule = getScheduleInfoForDate(
        updatedReservation.date,
        updatedReservation.classroom,
      );

      // 時間制予約（30分単位）の場合の検証
      if (scheduleRule && scheduleRule['type'] === CONSTANTS.UNITS.THIRTY_MIN) {
        _validateTimeBasedReservation(
          updatedReservation.startTime,
          updatedReservation.endTime,
          /** @type {ScheduleMasterData} */ (scheduleRule),
        );
      }

      // --- 定員チェック（予約更新時） ---
      const lessonsResponse = getLessons();
      if (!lessonsResponse.success) {
        throw new Error('空き状況の取得に失敗し、予約を更新できません。');
      }
      const targetLesson = lessonsResponse.data.find(
        l => l.date === updatedReservation.date && l.classroom === updatedReservation.classroom,
      );

      if (
        targetLesson &&
        targetLesson.classroomType === CONSTANTS.CLASSROOM_TYPES.TIME_DUAL
      ) {
        // 自分自身の予約を除外して空き状況を計算
        let oldMorningOccupied = false;
        let oldAfternoonOccupied = false;
        if (
          existingReservation.startTime &&
          existingReservation.endTime &&
          targetLesson.firstEnd &&
          targetLesson.secondStart
        ) {
          if (existingReservation.startTime < targetLesson.firstEnd) oldMorningOccupied = true;
          if (existingReservation.endTime > targetLesson.secondStart) oldAfternoonOccupied = true;
        }

        let newMorningRequired = false;
        let newAfternoonRequired = false;
        if (
          updatedReservation.startTime &&
          updatedReservation.endTime &&
          targetLesson.firstEnd &&
          targetLesson.secondStart
        ) {
          if (updatedReservation.startTime < targetLesson.firstEnd) newMorningRequired = true;
          if (updatedReservation.endTime > targetLesson.secondStart) newAfternoonRequired = true;
        }

        let adjustedMorningSlots = targetLesson.firstSlots || 0;
        if (oldMorningOccupied) adjustedMorningSlots += 1;

        let adjustedAfternoonSlots = targetLesson.secondSlots || 0;
        if (oldAfternoonOccupied) adjustedAfternoonSlots += 1;

        const canFit =
          (!newMorningRequired || adjustedMorningSlots > 0) &&
          (!newAfternoonRequired || adjustedAfternoonSlots > 0);

        if (!canFit) {
          throw new Error(
            '満席のため、ご希望の時間帯に予約を変更することはできません。',
          );
        }
      }

      // 共通関数を呼び出して保存
      _saveReservationCoreToSheet(updatedReservation, 'update');

      // ログ記録
      const messageToTeacher = updatedReservation.messageToTeacher || '';
      const messageLog = messageToTeacher
        ? `, Message: ${messageToTeacher}`
        : '';
      const logDetails = `ReservationID: ${updatedReservation.reservationId}, Classroom: ${updatedReservation.classroom}${messageLog}`;
      logActivity(
        updatedReservation.studentId,
        '予約詳細更新',
        CONSTANTS.MESSAGES.SUCCESS,
        logDetails,
      );

      return createApiResponse(true, {
        message: '予約内容を更新しました。',
      });
    } catch (err) {
      Logger.log(
        `updateReservationDetails Error: ${err.message}
${err.stack}`,
      );
      // studentIdが取得できない場合もあるため、detailsから取得を試みる
      const studentIdForLog = details.studentId || '(不明)';
      logActivity(studentIdForLog, '予約詳細更新', CONSTANTS.MESSAGES.ERROR, `Error: ${err.message}`);
      return BackendErrorHandler.handle(err, 'updateReservationDetails');
    }
  });
}

/**
 * [設計思想] フロントエンドは「ユーザーが何を選択したか」という入力情報のみを渡し、
 * バックエンドが料金マスタと照合して金額を再計算・検証する責務を持つ。
 * この関数は、会計処理が完了したReservationCoreオブジェクトを受け取り、永続化する責務を持つ。
 * @param {ReservationCore} reservationWithAccounting - 会計情報が追加/更新された予約オブジェクト。
 * @returns {ApiResponseGeneric<{message: string}>} - 処理結果。
 */
function saveAccountingDetails(reservationWithAccounting) {
  return withTransaction(() => {
    try {
      const { reservationId, studentId, accountingDetails } = reservationWithAccounting;
      if (!reservationId || !studentId || !accountingDetails) {
        throw new Error('会計情報が不足しています。');
      }

      // 1. 既存の予約データをCore型オブジェクトとして取得
      const existingReservation = getReservationCoreById(reservationId);
      if (!existingReservation) {
        throw new Error(`予約ID「${reservationId}」が見つかりませんでした。`);
      }

      // 権限チェック
      if (existingReservation.studentId !== studentId) {
        throw new Error('この予約の会計処理を行う権限がありません。');
      }

      // TODO: バックエンドでの金額再計算・検証ロジックをここに追加することが望ましい
      // 現状はフロントエンドで計算された金額を信頼する形になっているが、
      // より堅牢にするには、userInputを別途受け取り、ここで再計算するべき。
      // 今回はAPIインターフェースの統一を優先する。

      // 3. 更新後の完全なReservationCoreオブジェクトを構築
      /** @type {ReservationCore} */
      const updatedReservation = {
        ...existingReservation,
        ...reservationWithAccounting, // フロントから送られてきた変更をマージ
        status: CONSTANTS.STATUS.COMPLETED, // ステータスは必ず「完了」に上書き
      };

      // 4. 共通関数を呼び出して保存
      _saveReservationCoreToSheet(updatedReservation, 'update');

      // 5. 売上ログの記録
      _logSalesForSingleReservation(updatedReservation, updatedReservation.accountingDetails);

      // ログと通知
      const logDetails = `Classroom: ${updatedReservation.classroom}, ReservationID: ${reservationId}, Total: ${accountingDetails.grandTotal}`;
      logActivity(
        studentId,
        '会計記録保存',
        CONSTANTS.MESSAGES.SUCCESS,
        logDetails,
      );

      const userInfo = updatedReservation.user || (
        getCachedStudentById(studentId)
      );

      const subject = `会計記録 (${updatedReservation.classroom}) ${userInfo.realName}: ${userInfo.displayName}様`;
      const body =
        `会計が記録されました。

` +
        `本名: ${userInfo.realName}
` +
        `ニックネーム: ${userInfo.displayName}

` +
        `教室: ${updatedReservation.classroom}
` +
        `予約ID: ${reservationId}
` +
        `生徒ID: ${studentId}
` +
        `合計金額: ¥${accountingDetails.grandTotal.toLocaleString()}

` +
        `詳細はスプレッドシートを確認してください。`;
      sendAdminNotification(subject, body);

      return createApiResponse(true, {
        message: '会計処理と関連データの更新がすべて完了しました。',
      });
    } catch (err) {
      logActivity(
        reservationWithAccounting.studentId,
        '会計記録保存',
        CONSTANTS.MESSAGES.ERROR,
        `Error: ${err.message}`,
      );
      Logger.log(`saveAccountingDetails Error: ${err.message}
${err.stack}`);
      return BackendErrorHandler.handle(err, 'saveAccountingDetails');
    }
  });
}

/**
 * [設計思想] 後続処理でエラーが発生してもメインの会計処理は成功と見なすため、
 * この関数内でのエラーはログに記録するに留め、上位にはスローしない。
 * @private
 * @param {ReservationCore} reservation - 売上ログを生成する対象の予約オブジェクト
 * @param {AccountingDetails} accountingDetails - 計算済みの会計詳細オブジェクト。
 */
function _logSalesForSingleReservation(reservation, accountingDetails) {
  try {
    // 生徒情報を取得
    const studentId = reservation.studentId;

    // 名前を「本名（ニックネーム）」形式で構築
    let displayNameForSales = '不明';
    if (reservation.user) {
      const realName = reservation.user.realName || '';
      const nickName = reservation.user.displayName || '';

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
      date: new Date(reservation.date), // YYYY-MM-DD形式の文字列をDateオブジェクトに変換
      studentId: studentId,
      // 生徒名を「本名（ニックネーム）」形式で表示
      name: displayNameForSales,
      classroom: reservation.classroom, // reservationオブジェクトから直接取得
      venue: reservation.venue || '', // ReservationCoreから直接取得
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
      const salesSheet = salesSpreadsheet.getSheetByName(
        CONSTANTS.SHEET_NAMES.SALES_LOG,
      );
      if (!salesSheet)
        throw new Error(
          `売上スプレッドシートに「${CONSTANTS.SHEET_NAMES.SALES_LOG}」シートが見つかりません。`,
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
      `_logSalesForSingleReservation Error: ${err.message}
${err.stack}`,
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
      const { reservationId, studentId, messageToTeacher } = confirmInfo;

      // ★改善: getReservationCoreByIdを使用して予約情報を一行で取得
      const targetReservation = getReservationCoreById(reservationId);

      if (!targetReservation) {
        throw new Error('対象の予約が見つかりません。');
      }

      // 権限チェック
      if (targetReservation.studentId !== studentId) {
        throw new Error('この予約を操作する権限がありません。');
      }

      // 現在のステータスが空席連絡希望（待機）かチェック
      if (targetReservation.status !== CONSTANTS.STATUS.WAITLISTED) {
        throw new Error('この予約は空席連絡希望ではありません。');
      }

      // 定員チェック（現在空席があるかチェック）
      const isFull = checkCapacityFull(
        targetReservation.classroom,
        targetReservation.date,
        targetReservation.startTime,
        targetReservation.endTime,
      );
      if (isFull) {
        throw new Error('現在満席のため確定できません。');
      }

      // 更新後の予約オブジェクトを構築
      /** @type {ReservationCore} */
      const updatedReservation = {
        ...targetReservation,
        status: CONSTANTS.STATUS.CONFIRMED,
        messageToTeacher:
          messageToTeacher || targetReservation.messageToTeacher || '',
      };

      // 共通関数を呼び出して保存
      _saveReservationCoreToSheet(updatedReservation, 'update');

      // ログ記録
      const messageLog = messageToTeacher
        ? `, Message: ${messageToTeacher}`
        : '';
      const logDetails = `Classroom: ${updatedReservation.classroom}, Date: ${updatedReservation.date}, ReservationID: ${reservationId}${messageLog}`;
      logActivity(
        studentId,
        '空席連絡希望確定',
        CONSTANTS.MESSAGES.SUCCESS,
        logDetails,
      );

      // 管理者通知
      sendAdminNotificationForReservation(updatedReservation, 'updated');

      // 最新の予約データを取得して返却
      const userReservationsResult = getUserReservations(studentId);
      const latestMyReservations = userReservationsResult.success
        ? userReservationsResult.data.myReservations
        : [];

      const latestLessons = getLessons().data || [];

      return createApiResponse(true, {
        message: '予約を確定しました。',
        data: {
          myReservations: latestMyReservations,
          lessons: latestLessons,
        },
      });
    } catch (err) {
      logActivity(
        confirmInfo.studentId,
        '空席連絡希望確定',
        CONSTANTS.MESSAGES.ERROR,
        `Error: ${err.message}`,
      );
      Logger.log(
        `confirmWaitlistedReservation Error: ${err.message}
${err.stack}`,
      );
      return BackendErrorHandler.handle(err, 'confirmWaitlistedReservation');
    }
  });
}