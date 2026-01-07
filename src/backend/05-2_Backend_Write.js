/**
 * =================================================================
 * 【ファイル名】  : 05-2_Backend_Write.gs
 * 【モジュール種別】: バックエンド（GAS）
 * 【役割】        : WebApp からの書き込み系リクエスト（予約作成・更新・キャンセル等）を一括処理する。
 *
 * 【主な責務】
 *   - 予約情報の CRUD とキャッシュ更新（`addReservationToCache` / `updateReservationInCache` 連携）
 *   - 日程／定員チェック、キャンセル待ち繰り上げなどのビジネスルール適用
 *   - 会計情報の確定処理と売上ログ出力（別スプレッドシートへの書き込み）
 *   - 管理者通知・予約者メール送信など副作用の編成
 *
 * 【関連モジュール】
 *   - `07_CacheManager.js`: キャッシュ取得やヘッダー操作
 *   - `08_ErrorHandler.js`: API レスポンスの生成と統一的なエラーハンドリング
 *   - `05-3_Backend_AvailableSlots.js`: 空き枠再計算や予約者向けデータの再取得
 *   - `02-6_Notification_Admin.js` / `02-7_Notification_StudentReservation.js`: 通知系機能
 *
 * 【利用時の留意点】
 *   - 予約関連の公開関数はすべて `withTransaction` で排他制御される想定。呼び出し側は重複トランザクションを避ける
 *   - キャッシュ未整備時に備え、`getLessons()` などの戻り値は `success` と `data` を確認してから使用する
 *   - 追加の副作用（メール・通知）を拡張する場合は、例外が主処理へ影響しないよう try-catch で囲む
 * =================================================================
 */

// ================================================================
// 依存モジュール
// ================================================================
import { SALES_SPREADSHEET_ID, SS_MANAGER } from './00_SpreadsheetManager.js';
import {
  formatAdminUserDisplay,
  sendAdminNotification,
  sendAdminNotificationForReservation,
} from './02-6_Notification_Admin.js';
import { sendReservationEmailAsync } from './02-7_Notification_StudentReservation.js';
import {
  calculateAvailableSlots,
  getLessons,
  getUserReservations,
} from './05-3_Backend_AvailableSlots.js';
import {
  addReservationToCache,
  CACHE_KEYS,
  getCachedData,
  getHeaderIndex,
  getLessonByIdFromCache,
  getReservationsByIdsFromCache,
  getTypedCachedData,
  rebuildAllReservationsCache,
  updateLessonReservationIdsInCache,
  updateReservationInCache,
} from './07_CacheManager.js';
import { BackendErrorHandler, createApiResponse } from './08_ErrorHandler.js';
import {
  convertReservationToRow,
  createSalesRow,
  getCachedReservationsAsObjects,
  getCachedStudentById,
  getReservationCoreById,
  getSheetData,
  logActivity,
  PerformanceLog,
  validateUserOperation,
  withTransaction,
} from './08_Utilities.js';

/**
 * BackendErrorHandlerが返却するエラーレスポンスを
 * ApiResponseGeneric互換の構造へ正規化するヘルパー。
 * @param {ApiErrorResponse} errorResponse
 * @returns {ApiResponseGeneric<any>}
 */
function normalizeErrorResponse(errorResponse) {
  /** @type {ApiResponseGeneric<any>} */
  const baseResponse = {
    success: errorResponse.success,
    message: errorResponse.message,
    meta: /** @type {Record<string, unknown>} */ (errorResponse.meta || {}),
  };
  if (errorResponse.error) {
    baseResponse.error = errorResponse.error;
  }
  if (errorResponse.debug) {
    baseResponse.debug = /** @type {Record<string, unknown>} */ (
      errorResponse.debug
    );
  }
  return baseResponse;
}

/**
 * 指定したユーザーが同一日に予約を持っているかチェックする共通関数。
 * @param {string} studentId - 学生ID
 * @param {string} date - 日付（YYYY-MM-DD形式）
 * @returns {boolean} - 同一日に有効な予約がある場合true
 */
export function checkDuplicateReservationOnSameDay(studentId, date) {
  try {
    const scheduleCache = getTypedCachedData(
      CACHE_KEYS.MASTER_SCHEDULE_DATA,
      false,
    );
    const scheduleList = Array.isArray(scheduleCache?.schedule)
      ? /** @type {LessonCore[]} */ (scheduleCache.schedule)
      : [];

    const reservationIdSet = scheduleList.reduce((set, lesson) => {
      if (lesson?.date === date && Array.isArray(lesson.reservationIds)) {
        lesson.reservationIds
          .filter(Boolean)
          .forEach(id => set.add(String(id)));
      }
      return set;
    }, new Set());

    if (reservationIdSet.size > 0) {
      const reservations = getReservationsByIdsFromCache([...reservationIdSet]);
      const hasDuplicate = reservations.some(reservation => {
        if (
          !reservation ||
          reservation.studentId !== studentId ||
          String(reservation.date) !== String(date)
        ) {
          return false;
        }
        return (
          reservation.status === CONSTANTS.STATUS.CONFIRMED ||
          reservation.status === CONSTANTS.STATUS.WAITLISTED
        );
      });
      if (hasDuplicate) {
        return true;
      }
    }

    return _checkDuplicateReservationByScan(studentId, date);
  } catch (error) {
    Logger.log(`checkDuplicateReservationOnSameDay エラー: ${error.message}`);
    return false; // エラー時は重複なしと判断（保守的な動作）
  }
}

/**
 * 既存のキャッシュ走査ロジックを用いた重複確認（フォールバック用）
 * @param {string} studentId
 * @param {string} date
 * @returns {boolean}
 */
function _checkDuplicateReservationByScan(studentId, date) {
  const reservationsCache = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);
  if (!reservationsCache?.['reservations']) {
    Logger.log('予約キャッシュデータが見つかりません');
    return false;
  }

  /** @type {ReservationCore[]} */
  const allReservations = /** @type {ReservationCore[]} */ (
    reservationsCache['reservations']
  );
  const headerMap = /** @type {HeaderMapType} */ (
    reservationsCache['headerMap']
  );

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

  const duplicateReservation = allReservations.find(reservation => {
    if (!reservation || !Array.isArray(reservation)) return false;

    const reservationStudentId = String(reservation[studentIdColIdx] || '');
    const reservationDate = reservation[dateColIdx];
    const reservationStatus = String(reservation[statusColIdx] || '');

    if (reservationStudentId !== studentId) return false;
    if (String(reservationDate) !== String(date)) return false;

    return (
      reservationStatus === CONSTANTS.STATUS.CONFIRMED ||
      reservationStatus === CONSTANTS.STATUS.WAITLISTED
    );
  });

  return !!duplicateReservation;
}

/**
 * 指定日・教室の定員チェックを行う共通関数。
 * @param {string} classroom - 教室
 * @param {string} date - 日付
 * @param {string} startTime - 開始時間
 * @param {string} endTime - 終了時間
 * @param {boolean} [isFirstLecture=false] - 初回予約の場合true
 * @returns {boolean} - 定員超過の場合true
 */
export function checkCapacityFull(
  classroom,
  date,
  startTime,
  endTime,
  isFirstLecture = false,
) {
  try {
    const scheduleCache = getTypedCachedData(
      CACHE_KEYS.MASTER_SCHEDULE_DATA,
      false,
    );
    const scheduleList = Array.isArray(scheduleCache?.schedule)
      ? /** @type {LessonCore[]} */ (scheduleCache.schedule)
      : [];
    const targetLesson = scheduleList.find(
      lesson =>
        lesson &&
        lesson.classroom === classroom &&
        String(lesson.date) === String(date),
    );
    if (!targetLesson) {
      Logger.log(`対象日程が見つかりません: ${date} ${classroom}`);
      return _checkCapacityFullLegacy(
        classroom,
        date,
        startTime,
        endTime,
        isFirstLecture,
      );
    }

    const reservationIds = Array.isArray(targetLesson.reservationIds)
      ? targetLesson.reservationIds.filter(Boolean).map(id => String(id))
      : [];
    let reservations = reservationIds.length
      ? getReservationsByIdsFromCache(reservationIds)
      : [];

    // フォールバック: reservationIdsがあるのに予約が取得できない場合のみ、lessonIdで全予約を検索
    // （reservationIdsが空の場合は本当に予約がないので、フォールバック不要）
    if (
      reservations.length === 0 &&
      reservationIds.length > 0 &&
      targetLesson.lessonId
    ) {
      Logger.log(
        `[checkCapacityFull] reservationIds(${reservationIds.length}件)から予約取得失敗。lessonIdでフォールバック検索: ${targetLesson.lessonId}`,
      );
      const allReservations = getCachedReservationsAsObjects();
      reservations = allReservations.filter(
        (/** @type {ReservationCore} */ r) =>
          r.lessonId === targetLesson.lessonId,
      );
    }

    const activeReservations = reservations.filter(
      reservation =>
        reservation.status !== CONSTANTS.STATUS.CANCELED &&
        reservation.status !== CONSTANTS.STATUS.WAITLISTED,
    );
    const slots = calculateAvailableSlots(targetLesson, activeReservations);

    // 詳細ログ: 定員チェックのデバッグ
    Logger.log(
      `[checkCapacityFull][DEBUG] ${date} ${classroom}: ` +
        `reservationIds.length=${reservationIds.length}, ` +
        `activeReservations.length=${activeReservations.length}, ` +
        `totalCapacity=${targetLesson.totalCapacity}, ` +
        `slots.first=${slots.first}, slots.second=${slots.second}`,
    );

    let isFull = false;

    // 初回予約の場合は初回者枠をチェック
    if (
      isFirstLecture &&
      slots.beginner !== null &&
      slots.beginner !== undefined
    ) {
      isFull = (slots.beginner || 0) <= 0;
      Logger.log(
        `[checkCapacityFull] 初回者枠チェック: ${date} ${classroom}: 満席=${isFull}, beginnerSlots=${slots.beginner}`,
      );
    } else {
      // 教室タイプに応じた満席判定
      if (targetLesson.classroomType === CONSTANTS.CLASSROOM_TYPES.TIME_DUAL) {
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
          isFull = (slots.first || 0) <= 0 || (slots.second || 0) <= 0;
        } else if (isMorningRequest) {
          // 午前のみの予約
          isFull = (slots.first || 0) <= 0;
        } else if (isAfternoonRequest) {
          // 午後のみの予約
          isFull = (slots.second || 0) <= 0;
        } else {
          // 予約がセッション時間外の場合 (例: 休憩時間内)
          // この予約は不正だが、ここでは満席とは扱わず、後続のバリデーションに任せる
          isFull = false;
        }
      } else {
        // 通常教室（セッション制・全日時間制）の場合
        isFull = (slots.first || 0) <= 0;
      }
    }

    Logger.log(
      `[checkCapacityFull] ${date} ${classroom}: 満席=${isFull}, firstSlots=${slots.first}, secondSlots=${slots.second}`,
    );

    return isFull;
  } catch (error) {
    Logger.log(`checkCapacityFull エラー: ${error.message}`);
    return false; // エラー時は予約を通す（保守的な動作）
  }
}

/**
 * 旧来の定員判定ロジック（フォールバック用）
 * @param {string} classroom
 * @param {string} date
 * @param {string} [startTime]
 * @param {string} [endTime]
 * @param {boolean} [isFirstLecture]
 * @returns {boolean}
 */
function _checkCapacityFullLegacy(
  classroom,
  date,
  startTime,
  endTime,
  isFirstLecture,
) {
  const availableSlotsResponse = getLessons();
  if (!availableSlotsResponse.success || !availableSlotsResponse.data) {
    Logger.log('Available Slots APIからデータを取得できませんでした');
    return false;
  }

  /** @type {LessonCore[]} */
  const lessons = /** @type {any} */ (availableSlotsResponse.data);
  const targetLesson = lessons.find(
    lesson => lesson.classroom === classroom && lesson.date === date,
  );

  if (!targetLesson) {
    Logger.log(`対象日程が見つかりません: ${date} ${classroom}`);
    return false;
  }

  let isFull = false;
  if (
    isFirstLecture &&
    targetLesson.beginnerSlots !== null &&
    targetLesson.beginnerSlots !== undefined
  ) {
    isFull = (targetLesson.beginnerSlots || 0) <= 0;
  } else if (
    targetLesson.firstSlots !== undefined &&
    targetLesson.secondSlots !== undefined
  ) {
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
      isFull =
        (targetLesson.firstSlots || 0) <= 0 ||
        (targetLesson.secondSlots || 0) <= 0;
    } else if (isMorningRequest) {
      isFull = (targetLesson.firstSlots || 0) <= 0;
    } else if (isAfternoonRequest) {
      isFull = (targetLesson.secondSlots || 0) <= 0;
    } else {
      isFull = false;
    }
  } else {
    isFull = (targetLesson.firstSlots || 0) <= 0;
  }

  Logger.log(
    `[checkCapacityFull][legacy] ${date} ${classroom}: 満席=${isFull}, firstSlots=${targetLesson.firstSlots}, secondSlots=${targetLesson.secondSlots}`,
  );

  return isFull;
}

/**
 * 時間制予約の時刻に関する検証を行うプライベートヘルパー関数。
 * @param {string} startTime - 開始時刻 (HH:mm)。
 * @param {string} endTime - 終了時刻 (HH:mm)。
 * @param {LessonCore} scheduleRule - 日程マスタから取得した日程情報。
 * @throws {Error} 検証に失敗した場合、理由を示すエラーをスローする。
 */
export function _validateTimeBasedReservation(
  startTime,
  endTime,
  scheduleRule,
) {
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
export function _saveReservationCoreToSheet(reservation, mode) {
  const sheet = SS_MANAGER.getSheet(CONSTANTS.SHEET_NAMES.RESERVATIONS);
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
    const reservationIdColIdx = getHeaderIndex(
      headerMap,
      CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID,
    );
    if (reservationIdColIdx === undefined) {
      throw new Error('予約ID列が見つかりません。');
    }
    const targetRowIndex = dataRows.findIndex(
      /** @param {RawSheetRow} row */
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
    const rowForCache = newRowData.map(
      /** @param {string|number|Date|boolean} val */
      val => (typeof val === 'boolean' ? String(val).toUpperCase() : val),
    );
    if (mode === 'create') {
      //todo: 要確認
      addReservationToCache(rowForCache, headerMap);
    } else {
      updateReservationInCache(
        reservation.reservationId,
        rowForCache,
        headerMap,
      );
    }
  } catch (e) {
    Logger.log(`インクリメンタル更新エラー: ${e.message} - フォールバック実行`);
    // エラー時は安全のため全体を再構築
    rebuildAllReservationsCache();
  }

  return { newRowData, headerMap };
}

/**
 * 【内部関数】指定されたレッスンの reservationIds 配列を更新する
 * @param {string} lessonId - 対象のレッスンID
 * @param {string} reservationId - 追加または削除する予約ID
 * @param {'add' | 'remove'} mode - 操作モード
 */
function _updateReservationIdsInLesson(lessonId, reservationId, mode) {
  if (!lessonId || !reservationId) return;

  try {
    const sheet = SS_MANAGER.getSheet(CONSTANTS.SHEET_NAMES.SCHEDULE);
    if (!sheet) throw new Error('日程マスタシートが見つかりません。');

    const { header, dataRows } = getSheetData(sheet);
    const lessonIdColIdx = header.indexOf(CONSTANTS.HEADERS.SCHEDULE.LESSON_ID);
    const reservationIdsColIdx = header.indexOf(
      CONSTANTS.HEADERS.SCHEDULE.RESERVATION_IDS,
    );

    if (lessonIdColIdx === -1 || reservationIdsColIdx === -1) {
      throw new Error(
        '`lessonId` または `reservationIds` 列が見つかりません。',
      );
    }

    const targetRowIndex = dataRows.findIndex(
      row => row[lessonIdColIdx] === lessonId,
    );

    if (targetRowIndex !== -1) {
      const rowIndex = targetRowIndex + 2; // 1-based index + header
      const reservationIdsCell = sheet.getRange(
        rowIndex,
        reservationIdsColIdx + 1,
      );
      const currentIdsStr = reservationIdsCell.getValue() || '[]';
      let currentIds = [];
      try {
        currentIds = JSON.parse(currentIdsStr);
        // 配列であることを確認
        if (!Array.isArray(currentIds)) {
          Logger.log(
            `警告: reservationIdsが配列ではありません。lessonId: ${lessonId}, 値: ${currentIdsStr}`,
          );
          currentIds = [];
        }
      } catch (e) {
        // パース失敗時は空配列から開始（既存データが失われる可能性）
        Logger.log(
          `クリティカル: reservationIdsのパース失敗。既存データが失われる可能性があります。lessonId: ${lessonId}, 値: ${currentIdsStr}, エラー: ${e.message}`,
        );
        currentIds = [];
      }

      if (mode === 'add') {
        if (!currentIds.includes(reservationId)) {
          currentIds.push(reservationId);
        }
      } else if (mode === 'remove') {
        const indexToRemove = currentIds.indexOf(reservationId);
        if (indexToRemove > -1) {
          currentIds.splice(indexToRemove, 1);
        }
      }

      reservationIdsCell.setValue(JSON.stringify(currentIds));
      try {
        updateLessonReservationIdsInCache(lessonId, currentIds);
      } catch (syncError) {
        Logger.log(
          `_updateReservationIdsInLesson: キャッシュ同期に失敗しました。lessonId: ${lessonId}, Error: ${syncError.message}`,
        );
      }
    }
  } catch (error) {
    Logger.log(`_updateReservationIdsInLesson エラー: ${error.message}`);
    // このエラーは上位に伝播させ、トランザクションがロールバックされるようにする
    throw error;
  }
}

/**
 * 予約を実行します（Phase 8: Core型統一対応）
 *
 * @param {ReservationCore} reservationInfo - 予約作成リクエスト（Core型）。reservationId/statusはundefined可
 * @returns {ApiResponseGeneric<{ message: string }>} - 処理結果
 *
 * @example
 * makeReservation({
 *   studentId: 'S-001',
 *   classroom: '東京教室',
 *   date: '2025-10-15',
 *   startTime: '13:00',
 *   endTime: '16:00',
 *   chiselRental: true,
 *   firstLecture: false,
 * });
 */
export function makeReservation(reservationInfo) {
  return withTransaction(() => {
    try {
      // lessonId の検証を強化
      if (
        !reservationInfo.lessonId ||
        typeof reservationInfo.lessonId !== 'string'
      ) {
        throw new Error('無効なlessonIdが指定されました。');
      }

      // UUIDフォーマットの検証（警告のみ）
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(reservationInfo.lessonId)) {
        Logger.log(
          `警告: lessonIdの形式が不正です: ${reservationInfo.lessonId}`,
        );
      }

      // ★ lessonId を使って日程マスタから情報を取得
      const scheduleCache = getCachedData(CACHE_KEYS.MASTER_SCHEDULE_DATA);
      let scheduleData = /** @type {LessonCore[]} */ ([]);
      if (scheduleCache && scheduleCache['schedule']) {
        scheduleData = /** @type {LessonCore[]} */ (scheduleCache['schedule']);
      }

      const scheduleRule = scheduleData.find(
        item => item.lessonId === reservationInfo.lessonId,
      );

      if (!scheduleRule) {
        // ★ ガード節を追加
        throw new Error(
          `対象の日程情報が見つかりませんでした。lessonId: ${reservationInfo.lessonId}`,
        );
      }

      // 時間制予約（30分単位）の場合の検証
      if (
        scheduleRule &&
        scheduleRule.classroomType === CONSTANTS.UNITS.THIRTY_MIN
      ) {
        _validateTimeBasedReservation(
          reservationInfo.startTime || '',
          reservationInfo.endTime || '',
          scheduleRule,
        );
      }

      // 同一日重複予約チェック
      const hasDuplicateReservation = checkDuplicateReservationOnSameDay(
        reservationInfo.studentId,
        reservationInfo.date,
      );
      if (hasDuplicateReservation) {
        throw new Error(
          '同じ日には一つの予約しか登録できません。既存の予約を編集・削除してください。',
        );
      }
      Logger.log(
        `[makeReservation] 重複予約チェック完了: ${reservationInfo.studentId} ${reservationInfo.date} - 重複なし`,
      );

      // 【パフォーマンス対策】シートアクセス前に事前ウォームアップ
      Logger.log('[RESERVATION] 事前ウォームアップ実行');
      SS_MANAGER.warmupAsync();

      // 定員チェック（共通関数を使用）
      const isFull = checkCapacityFull(
        reservationInfo.classroom,
        reservationInfo.date,
        reservationInfo.startTime || '',
        reservationInfo.endTime || '',
        reservationInfo.firstLecture || false,
      );
      Logger.log(
        `[makeReservation] 定員チェック結果: ${reservationInfo.classroom} ${reservationInfo.date} - 満席=${isFull}, 初回=${reservationInfo.firstLecture}`,
      );

      // 完全なReservationCoreオブジェクトを構築
      const createdReservationId = Utilities.getUuid();
      // 処理時点の空き状況でステータスを決定（空きがあれば予約確定、なければ空き通知登録）
      const status = isFull
        ? CONSTANTS.STATUS.WAITLISTED
        : CONSTANTS.STATUS.CONFIRMED;

      /** @type {ReservationCore} */
      const completeReservation = {
        ...reservationInfo,
        reservationId: createdReservationId,
        status: status,
        lessonId: scheduleRule.lessonId, // ★ lessonId を追加
      };

      // 共通関数を呼び出して保存
      _saveReservationCoreToSheet(completeReservation, 'create');

      // ★ reservationIds を更新
      _updateReservationIdsInLesson(
        completeReservation.lessonId,
        completeReservation.reservationId,
        'add',
      );

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
          CONSTANTS.LOG_ACTIONS.RESERVATION_CREATE,
          CONSTANTS.MESSAGES.SUCCESS,
          {
            classroom: reservationInfo.classroom,
            reservationId: createdReservationId,
            date: reservationInfo.date,
            message: '予約が完了（キャッシュ再取得失敗）',
            details: {
              警告: 'キャッシュからの再取得に失敗',
              備考: '詳細はシート確認',
            },
          },
        );
        // この場合、通知はスキップされる
        return createApiResponse(true, {
          message: '予約は作成されましたが、通知処理中に問題が発生しました。',
        });
      }

      // 取得した最新データに基づいてメッセージとログを生成
      const isNowWaiting =
        reservationWithUser.status === CONSTANTS.STATUS.WAITLISTED;
      const message = isNowWaiting
        ? '満席のため、空き通知希望で登録しました。'
        : '予約が完了しました。';

      const actionType = isNowWaiting
        ? CONSTANTS.LOG_ACTIONS.RESERVATION_WAITLIST
        : /** @type {any} */ (reservationInfo)._isDateChange
          ? CONSTANTS.LOG_ACTIONS.RESERVATION_CREATE_DATE_CHANGE
          : CONSTANTS.LOG_ACTIONS.RESERVATION_CREATE;

      logActivity(
        reservationWithUser.studentId,
        actionType,
        CONSTANTS.MESSAGES.SUCCESS,
        {
          classroom: reservationWithUser.classroom,
          reservationId: reservationWithUser.reservationId,
          date: reservationWithUser.date,
          message: reservationWithUser.messageToTeacher || '',
          details: {
            ステータス: reservationWithUser.status,
            開始時間: reservationWithUser.startTime,
            終了時間: reservationWithUser.endTime,
            コース: /** @type {any} */ (reservationWithUser).course || '',
            レンタル: /** @type {any} */ (reservationInfo).rentalRequest
              ? 'あり'
              : 'なし',
            オプション: JSON.stringify(
              /** @type {any} */ (reservationInfo).options || {},
            ),
          },
        },
      );

      // 管理者通知（統一関数使用）
      sendAdminNotificationForReservation(reservationWithUser, 'created');

      // 予約確定メール送信（統一インターフェース使用）
      Utilities.sleep(100); // 短い待機
      try {
        sendReservationEmailAsync(reservationWithUser, 'confirmation');
      } catch (emailError) {
        Logger.log(`メール送信エラー（予約は成功）: ${emailError.message}`);
      }

      return createApiResponse(true, {
        message: message,
        status: reservationWithUser.status, // ★ステータスを明示的に返す
      });
    } catch (err) {
      logActivity(
        reservationInfo.studentId,
        CONSTANTS.LOG_ACTIONS.RESERVATION_CREATE,
        CONSTANTS.MESSAGES.ERROR,
        {
          classroom: reservationInfo.classroom,
          reservationId: '',
          date: reservationInfo.date,
          message: '予約作成に失敗しました',
          details: {
            エラー: err.message,
            スタック: err.stack,
          },
        },
      );
      Logger.log(`makeReservation Error: ${err.message}
${err.stack}`);
      const errorResponse = BackendErrorHandler.handle(
        /** @type {Error} */ (err),
        'makeReservation',
      );
      return normalizeErrorResponse(errorResponse);
    }
  });
}

/**
 * 予約をキャンセルします（Core型オブジェクト中心設計）
 *
 * @param {import('../../types/core/reservation').CancelReservationParams} cancelInfo - 予約キャンセル情報。`reservationId`と`studentId`は必須。`cancelMessage`は任意。
 * @returns {ApiResponseGeneric<{ message: string }>} - 処理結果
 */
export function cancelReservation(cancelInfo) {
  return withTransaction(() => {
    try {
      const {
        reservationId,
        studentId,
        cancelMessage,
        _isByAdmin,
        _adminToken,
        _isDateChange,
      } = cancelInfo;

      const existingReservation = getReservationCoreById(reservationId);

      validateUserOperation(
        existingReservation,
        studentId,
        _isByAdmin,
        _adminToken || null,
      );
      const validReservation = /** @type {ReservationCore} */ (
        existingReservation
      );

      // 2. キャンセル後の新しい予約オブジェクトを構築
      /** @type {ReservationCore} */
      const cancelledReservation = {
        ...validReservation,
        status: CONSTANTS.STATUS.CANCELED,
        cancelMessage: cancelMessage || validReservation.cancelMessage, // 新しいメッセージがあれば上書き
      };
      // 共通関数を呼び出して保存
      _saveReservationCoreToSheet(cancelledReservation, 'update');

      // ★ reservationIds を更新
      if (cancelledReservation.lessonId) {
        _updateReservationIdsInLesson(
          cancelledReservation.lessonId,
          cancelledReservation.reservationId,
          'remove',
        );
      }

      // ログ記録（管理者操作の場合は【管理者操作】を付与）
      const isAdminOp = !!_isByAdmin;
      const adminUserId = isAdminOp && _adminToken ? _adminToken : null;
      const logMessage = isAdminOp
        ? `【管理者操作】予約をキャンセルしました${adminUserId ? `（操作者: ${adminUserId}）` : ''}`
        : cancelMessage || '';

      // ログ記録用のアクションタイプを決定
      const cancelActionType = _isDateChange
        ? CONSTANTS.LOG_ACTIONS.RESERVATION_CANCEL_DATE_CHANGE
        : CONSTANTS.LOG_ACTIONS.RESERVATION_CANCEL;

      logActivity(studentId, cancelActionType, CONSTANTS.MESSAGES.SUCCESS, {
        classroom: cancelledReservation.classroom,
        reservationId: cancelledReservation.reservationId,
        date: cancelledReservation.date,
        message: logMessage,
        details: {
          ステータス: 'キャンセル済',
          LessonID: cancelledReservation.lessonId,
          ...(isAdminOp ? { 管理者操作: 'はい', 操作者: adminUserId } : {}),
        },
      });

      //キャンセル後の空き通知処理
      try {
        // ★改善: lessonIdを使って効率的に通知
        if (cancelledReservation.lessonId) {
          notifyAvailabilityToWaitlistedUsers(
            cancelledReservation.lessonId,
            validReservation, // 元の予約データ
          );
        } else {
          Logger.log(
            '警告: lessonIdが見つからないため、空き通知をスキップします。',
          );
        }
      } catch (notificationError) {
        Logger.log(`空き通知エラー: ${notificationError.message}`);
      }

      // 管理者通知とキャンセルメール送信
      const adminAdditionalInfo = cancelMessage ? { cancelMessage } : undefined;
      sendAdminNotificationForReservation(
        cancelledReservation,
        'cancelled',
        adminAdditionalInfo,
      );

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

      return createApiResponse(true, { message: '予約をキャンセルしました。' });
    } catch (err) {
      logActivity(
        cancelInfo.studentId || 'N/A', // エラー発生時はcancelInfoから取得を試みる
        CONSTANTS.LOG_ACTIONS.RESERVATION_CANCEL,
        CONSTANTS.MESSAGES.ERROR,
        {
          details: {
            エラー: err.message,
          },
        },
      );
      Logger.log(`cancelReservation Error: ${err.message}
${err.stack}`);
      const errorResponse = BackendErrorHandler.handle(
        /** @type {Error} */ (err),
        'cancelReservation',
      );
      return normalizeErrorResponse(errorResponse);
    }
  });
}

/**
 * キャンセル後の空き通知希望者への通知機能
 * @param {string} lessonId - レッスンID
 * @param {ReservationCore} _cancelledReservation - キャンセルされた予約データ（将来の拡張用）
 */
export function notifyAvailabilityToWaitlistedUsers(
  lessonId,
  _cancelledReservation,
) {
  const perfStart = Date.now();
  let availabilityTypeForLog = '(none)';
  let recipientsCount = 0;
  let cacheHit = false;
  let cachedReservationCount = 0;
  let validReservationCount = 0;
  try {
    // 1. lessonIdからレッスン情報を取得（O(1)アクセス）
    const targetLesson = getLessonByIdFromCache(lessonId);
    if (!targetLesson) {
      Logger.log(`該当レッスンが見つかりません。lessonId: ${lessonId}`);
      return;
    }
    cacheHit = true;

    // 1-2. 日付チェック: 過去のレッスンには通知しない
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lessonDate = new Date(targetLesson.date);
    lessonDate.setHours(0, 0, 0, 0);
    if (lessonDate < today) {
      PerformanceLog.debug(
        `[notifyAvailabilityToWaitlistedUsers] 過去のレッスンのためスキップ。lessonId=${lessonId}, date=${targetLesson.date}`,
      );
      return;
    }

    const reservationsForLesson = getReservationsByIdsFromCache(
      targetLesson.reservationIds || [],
    );
    cachedReservationCount = reservationsForLesson.length;
    const validReservations = reservationsForLesson.filter(
      r =>
        r.status !== CONSTANTS.STATUS.CANCELED &&
        r.status !== CONSTANTS.STATUS.WAITLISTED,
    );
    validReservationCount = validReservations.length;
    const slots = calculateAvailableSlots(targetLesson, validReservations);
    const lessonWithSlots = {
      ...targetLesson,
      firstSlots: slots.first,
      secondSlots: slots.second,
      beginnerSlots: slots.beginner,
    };

    // 2. 空きタイプを判定
    let availabilityType = null;
    const firstSlots =
      typeof lessonWithSlots.firstSlots === 'number'
        ? lessonWithSlots.firstSlots
        : null;
    const secondSlots =
      typeof lessonWithSlots.secondSlots === 'number'
        ? lessonWithSlots.secondSlots
        : null;

    if (
      firstSlots !== null &&
      secondSlots !== null &&
      firstSlots > 0 &&
      secondSlots > 0
    ) {
      availabilityType = 'all';
    } else if (firstSlots !== null && firstSlots > 0) {
      availabilityType = 'first';
    } else if (secondSlots !== null && secondSlots > 0) {
      availabilityType = 'second';
    }

    if (!availabilityType) {
      Logger.log('空きが発生しなかったため、通知は行いません。');
      return;
    }
    availabilityTypeForLog = availabilityType;

    // 3. 通知対象ユーザーを取得（スロット状況を考慮して判定）
    const recipients = getWaitlistedUsersForNotification(
      lessonWithSlots,
      reservationsForLesson,
    );
    recipientsCount = recipients.length;
    if (recipients.length === 0) {
      Logger.log('通知対象の空き通知希望ユーザーがいません。');
      return;
    }

    // 4. メール送信
    recipients.forEach(recipient => {
      const subject = `【きぼりのよやく】${targetLesson.classroom} ${targetLesson.date}に空きが出ました`;
      const body = createAvailabilityNotificationEmail(
        recipient,
        lessonWithSlots,
      );
      try {
        GmailApp.sendEmail(recipient.email, subject, body);
        logActivity(
          recipient.studentId,
          CONSTANTS.LOG_ACTIONS.EMAIL_VACANCY_NOTIFICATION,
          '成功',
          {
            details: {
              教室: targetLesson.classroom,
              日付: targetLesson.date,
            },
          },
        );
      } catch (e) {
        logActivity(
          recipient.studentId,
          CONSTANTS.LOG_ACTIONS.EMAIL_VACANCY_NOTIFICATION,
          '失敗',
          {
            details: {
              エラー: e.message,
            },
          },
        );
      }
    });
  } catch (error) {
    Logger.log(`notifyAvailabilityToWaitlistedUsers Error: ${error.message}`);
    // この関数は上位にエラーを伝播させない
  } finally {
    PerformanceLog.debug(
      `[notifyAvailabilityToWaitlistedUsers] lessonId=${lessonId}, cacheHit=${cacheHit}, cachedReservations=${cachedReservationCount}, validReservations=${validReservationCount}, availability=${availabilityTypeForLog}, notified=${recipientsCount}`,
    );
    PerformanceLog.performance(
      'notifyAvailabilityToWaitlistedUsers',
      perfStart,
    );
  }
}

/**
 * 空き通知対象のユーザーリストを取得
 * @param {LessonCore} lessonWithSlots - 空き枠を含むレッスン情報
 * @param {ReservationCore[]} reservationsForLesson - 対象レッスンの予約一覧
 * @returns {Array<{studentId: string, email: string, realName: string, isFirstTime: boolean}>}
 */
export function getWaitlistedUsersForNotification(
  lessonWithSlots,
  reservationsForLesson,
) {
  // lesson情報が取得できない場合は即終了
  if (!lessonWithSlots || !lessonWithSlots.lessonId) {
    Logger.log('レッスン情報が見つからないため空き通知をスキップします。');
    return [];
  }

  // 予約一覧から待機中のもののみフィルタリング
  const waitlistedReservations = reservationsForLesson.filter(
    r => r.status === CONSTANTS.STATUS.WAITLISTED,
  );

  if (waitlistedReservations.length === 0) {
    Logger.log('待機リストに予約がありません。');
    return [];
  }

  /** @type {Array<{studentId: string, email: string, realName: string, isFirstTime: boolean}>} */
  const result = [];

  waitlistedReservations.forEach(
    /** @param {ReservationCore} reservation */
    reservation => {
      const studentId = reservation.studentId;
      const isFirstTime = reservation.firstLecture;

      // 予約内容と現在の空き枠を突き合わせて通知対象か判定
      if (_canNotifyWaitlistedReservation(reservation, lessonWithSlots)) {
        // 生徒情報を取得
        const studentInfo = /** @type {UserCore} */ (
          getCachedStudentById(String(studentId))
        );

        if (
          studentInfo &&
          studentInfo.email &&
          studentInfo.email.trim() !== ''
        ) {
          result.push({
            studentId: studentId,
            email: studentInfo.email,
            realName: studentInfo.realName,
            isFirstTime: isFirstTime || false,
          });
        }
      }
    },
  );

  return result;
}

/**
 * 待機中予約が現在の枠で予約可能かを判定
 * @param {ReservationCore} reservation
 * @param {LessonCore} lessonWithSlots
 * @returns {boolean}
 */
function _canNotifyWaitlistedReservation(reservation, lessonWithSlots) {
  const firstSlots =
    typeof lessonWithSlots.firstSlots === 'number' &&
    !isNaN(lessonWithSlots.firstSlots)
      ? lessonWithSlots.firstSlots
      : 0;
  const secondSlots =
    typeof lessonWithSlots.secondSlots === 'number' &&
    !isNaN(lessonWithSlots.secondSlots)
      ? lessonWithSlots.secondSlots
      : 0;
  const beginnerSlots =
    typeof lessonWithSlots.beginnerSlots === 'number' &&
    !isNaN(lessonWithSlots.beginnerSlots)
      ? lessonWithSlots.beginnerSlots
      : null;

  const isFirstTime = reservation.firstLecture === true;

  // 初回枠が設定されている場合はそれを優先的にチェック
  if (isFirstTime && beginnerSlots !== null) {
    return beginnerSlots > 0;
  }

  // 2部制の場合は予約時間帯に応じて判定
  if (lessonWithSlots.classroomType === CONSTANTS.CLASSROOM_TYPES.TIME_DUAL) {
    const reqStart = reservation.startTime
      ? new Date(`1900-01-01T${reservation.startTime}`)
      : null;
    const reqEnd = reservation.endTime
      ? new Date(`1900-01-01T${reservation.endTime}`)
      : null;

    const firstEndTime = lessonWithSlots.firstEnd
      ? new Date(`1900-01-01T${lessonWithSlots.firstEnd}`)
      : null;
    const secondStartTime = lessonWithSlots.secondStart
      ? new Date(`1900-01-01T${lessonWithSlots.secondStart}`)
      : null;

    // 必須情報が欠けている場合は、空きがあれば通知する
    if (!reqStart || !reqEnd || !firstEndTime || !secondStartTime) {
      return firstSlots > 0 || secondSlots > 0;
    }

    const needsMorning = reqStart < firstEndTime;
    const needsAfternoon = reqEnd > secondStartTime;

    if (needsMorning && needsAfternoon) {
      return firstSlots > 0 && secondSlots > 0;
    }
    if (needsMorning) {
      return firstSlots > 0;
    }
    if (needsAfternoon) {
      return secondSlots > 0;
    }

    // どちらのセッションにも属さない場合は通知対象外
    return false;
  }

  // 通常枠は経験者枠の空きで判定
  return firstSlots > 0;
}

/**
 * 空き通知メールの本文を生成
 * @param {{studentId: string, email: string, realName: string, isFirstTime: boolean}} recipient - 受信者情報
 * @param {LessonCore} lesson - レッスン情報
 * @returns {string} メール本文
 */
export function createAvailabilityNotificationEmail(recipient, lesson) {
  const appUrl = CONSTANTS.WEB_APP_URL.PRODUCTION;
  const dateFormatted = Utilities.formatDate(
    new Date(lesson.date),
    'JST',
    'M月d日（E）',
  );

  let body = `${recipient.realName}様\n\n`;
  body += `ご希望の ${dateFormatted} ${lesson.classroom} の予約に空きが出ましたのでお知らせいたします。\n\n`;
  body += `下記URLよりログインし、予約の確定をお願いいたします。\n`;
  body += `${appUrl}\n\n`;
  body += `※このメールは空席の確保を保証するものではありません。他の方が先に予約を確定された場合、再度満席となることがございますのでご了承ください。\n\n`;
  body += `--------------------\n`;
  body += `きぼりのよやく・きろく\n`;
  body += `川崎 誠二\n`;
  body += `Tel: 09013755977\n`;
  body += `--------------------\n`;

  return body;
}

/**
 * 予約の詳細情報を一括で更新します（Core型オブジェクト中心設計）
 *
 * @param {ReservationCore} details - 予約更新リクエスト。`reservationId`と更新したいフィールドのみを持つ部分的な`ReservationCore`オブジェクト。
 * @returns {ApiResponseGeneric<{ message: string }>} - 処理結果
 */
export function updateReservationDetails(details) {
  const perfStart = Date.now();
  return withTransaction(() => {
    let availabilityLookupMode = 'cache';
    let cachedReservationsCount = 0;
    /** @type {LessonCore | null} */
    let availabilityLesson = null;
    /** @type {string | null} */
    let effectiveLessonId = null;
    try {
      // 1. 既存の予約データをCore型オブジェクトとして取得
      const existingReservation = getReservationCoreById(details.reservationId);

      const { _isByAdmin, _adminToken } = details;
      validateUserOperation(
        existingReservation,
        details.studentId,
        _isByAdmin,
        _adminToken || null,
      );
      const validReservation = /** @type {ReservationCore} */ (
        existingReservation
      );

      // 2. 更新内容をマージして、新しい予約オブジェクトを構築
      /** @type {ReservationCore} */
      const updatedReservation = {
        ...validReservation,
        ...details,
      };

      // ★ バグ修正: 材料情報が指定されている場合、制作メモに追記する
      if (details.materialInfo) {
        const baseWip = updatedReservation.sessionNote || '';
        updatedReservation.sessionNote =
          baseWip +
          (baseWip ? '\n' : '') + // 既存メモがあれば改行を挟む
          CONSTANTS.SYSTEM.MATERIAL_INFO_PREFIX +
          details.materialInfo;
      }

      // 3. バリデーション
      // 日程マスタから該当日・教室の情報を取得
      const scheduleRule = getScheduleInfoForDate(
        updatedReservation.date,
        updatedReservation.classroom,
      );

      // 時間制予約（30分単位）の場合の検証
      if (
        scheduleRule &&
        scheduleRule.classroomType === CONSTANTS.UNITS.THIRTY_MIN
      ) {
        _validateTimeBasedReservation(
          updatedReservation.startTime || '',
          updatedReservation.endTime || '',
          /** @type {LessonCore} */ (scheduleRule),
        );
      }

      // --- 定員チェック（予約更新時） ---
      const lessonIdFromDetails =
        typeof details.lessonId === 'string' ? details.lessonId : undefined;
      const lessonIdFromSchedule =
        scheduleRule && typeof scheduleRule.lessonId === 'string'
          ? scheduleRule.lessonId
          : undefined;
      const lessonIdFromExisting =
        typeof validReservation.lessonId === 'string'
          ? validReservation.lessonId
          : undefined;

      effectiveLessonId =
        lessonIdFromDetails ||
        lessonIdFromSchedule ||
        lessonIdFromExisting ||
        null;

      if (effectiveLessonId) {
        const cachedLesson = getLessonByIdFromCache(effectiveLessonId);
        if (cachedLesson) {
          const reservationsForLesson = getReservationsByIdsFromCache(
            Array.isArray(cachedLesson.reservationIds)
              ? cachedLesson.reservationIds
              : [],
          );
          cachedReservationsCount = reservationsForLesson.length;
          const validReservations = reservationsForLesson.filter(
            r =>
              r.status !== CONSTANTS.STATUS.CANCELED &&
              r.status !== CONSTANTS.STATUS.WAITLISTED,
          );
          const slots = calculateAvailableSlots(
            cachedLesson,
            validReservations,
          );
          availabilityLesson = {
            ...cachedLesson,
            firstSlots: slots.first,
            secondSlots:
              typeof slots.second === 'number' ? slots.second : undefined,
            beginnerSlots:
              typeof slots.beginner === 'number'
                ? slots.beginner
                : (cachedLesson.beginnerSlots ?? null),
          };
        }
      }

      if (!availabilityLesson) {
        availabilityLookupMode = 'fallback-getLessons';
        const lessonsResponse = getLessons();
        if (!lessonsResponse.success || !lessonsResponse.data) {
          throw new Error('空き状況の取得に失敗し、予約を更新できません。');
        }
        /** @type {LessonCore[]} */
        const lessonsData = /** @type {LessonCore[]} */ (lessonsResponse.data);
        const fallbackLesson = lessonsData.find(
          /** @param {LessonCore} l */
          l =>
            l.date === updatedReservation.date &&
            l.classroom === updatedReservation.classroom,
        );
        if (fallbackLesson) {
          availabilityLesson = fallbackLesson;
        }
      }

      const targetLesson = availabilityLesson;

      if (
        targetLesson &&
        targetLesson.classroomType === CONSTANTS.CLASSROOM_TYPES.TIME_DUAL
      ) {
        // 自分自身の予約を除外して空き状況を計算
        let oldMorningOccupied = false;
        let oldAfternoonOccupied = false;
        if (
          validReservation.startTime &&
          validReservation.endTime &&
          targetLesson.firstEnd &&
          targetLesson.secondStart
        ) {
          if (validReservation.startTime < targetLesson.firstEnd)
            oldMorningOccupied = true;
          if (validReservation.endTime > targetLesson.secondStart)
            oldAfternoonOccupied = true;
        }

        let newMorningRequired = false;
        let newAfternoonRequired = false;
        if (
          updatedReservation.startTime &&
          updatedReservation.endTime &&
          targetLesson.firstEnd &&
          targetLesson.secondStart
        ) {
          if (updatedReservation.startTime < targetLesson.firstEnd)
            newMorningRequired = true;
          if (updatedReservation.endTime > targetLesson.secondStart)
            newAfternoonRequired = true;
        }

        const originalFirstSlots =
          typeof targetLesson.firstSlots === 'number'
            ? targetLesson.firstSlots
            : 0;
        const originalSecondSlots =
          typeof targetLesson.secondSlots === 'number'
            ? targetLesson.secondSlots
            : 0;
        let adjustedMorningSlots = originalFirstSlots;
        if (oldMorningOccupied) adjustedMorningSlots += 1;

        let adjustedAfternoonSlots = originalSecondSlots;
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
      logActivity(
        updatedReservation.studentId,
        CONSTANTS.LOG_ACTIONS.RESERVATION_UPDATE,
        CONSTANTS.MESSAGES.SUCCESS,
        {
          classroom: updatedReservation.classroom,
          reservationId: updatedReservation.reservationId,
          date: updatedReservation.date,
          message: updatedReservation.messageToTeacher || '',
          details: {
            ステータス: updatedReservation.status,
            LessonID: updatedReservation.lessonId,
          },
        },
      );

      // 管理者通知
      const messageToTeacher = updatedReservation.messageToTeacher || '';
      const updateDetails = messageToTeacher
        ? `メッセージが更新されました: ${messageToTeacher}`
        : '予約詳細が更新されました';
      sendAdminNotificationForReservation(updatedReservation, 'updated', {
        updateDetails,
      });

      // ★ フロントエンドに返す最新データを取得
      /** @type {ApiResponse<{ myReservations: ReservationCore[] }>} */
      const userReservationsResult = getUserReservations(
        updatedReservation.studentId,
      );
      const latestMyReservations =
        userReservationsResult.success &&
        userReservationsResult.data &&
        Array.isArray(userReservationsResult.data.myReservations)
          ? userReservationsResult.data.myReservations
          : [];

      const latestLessonsResponse = getLessons();
      const latestLessons =
        latestLessonsResponse.success &&
        Array.isArray(latestLessonsResponse.data)
          ? /** @type {LessonCore[]} */ (latestLessonsResponse.data)
          : [];

      PerformanceLog.debug(
        `[updateReservationDetails] availabilityLookup=${availabilityLookupMode}, lessonId=${
          effectiveLessonId || '(unknown)'
        }, cacheReservationCount=${cachedReservationsCount}, targetLessonFound=${Boolean(
          targetLesson,
        )}`,
      );

      return createApiResponse(true, {
        message: '予約内容を更新しました。',
        data: {
          myReservations: latestMyReservations,
          lessons: latestLessons,
        },
      });
    } catch (err) {
      Logger.log(
        `updateReservationDetails Error: ${err.message}
${err.stack}`,
      );
      // studentIdが取得できない場合もあるため、detailsから取得を試みる
      const studentIdForLog = details.studentId || '(不明)';
      logActivity(studentIdForLog, '予約詳細更新', CONSTANTS.MESSAGES.ERROR, {
        details: {
          エラー: err.message,
        },
      });
      const errorResponse = BackendErrorHandler.handle(
        /** @type {Error} */ (err),
        'updateReservationDetails',
      );
      return normalizeErrorResponse(errorResponse);
    } finally {
      PerformanceLog.performance('updateReservationDetails', perfStart);
    }
  });
}

/**
 * [設計思想] フロントエンドは「ユーザーが何を選択したか」という入力情報のみを渡し、
 * バックエンドが料金マスタと照合して金額を再計算・検証する責務を持つ。
 * この関数は、会計処理が完了したReservationCoreオブジェクトを受け取り、永続化する責務を持つ。
 * @param {ReservationCore} reservationWithAccounting - 会計情報が追加/更新された予約オブジェクト。
 * @returns {ApiResponseGeneric<{ message: string }>} - 処理結果。
 */
export function saveAccountingDetails(reservationWithAccounting) {
  return withTransaction(() => {
    try {
      const { reservationId, studentId, accountingDetails } =
        reservationWithAccounting;

      const missingFields = [];
      if (!reservationId) missingFields.push('reservationId');
      if (!studentId) missingFields.push('studentId');
      if (!accountingDetails) missingFields.push('accountingDetails');
      else if (accountingDetails.grandTotal === undefined)
        missingFields.push('accountingDetails.grandTotal');

      if (missingFields.length > 0) {
        throw new Error(
          `会計情報が不足しています: ${missingFields.join(', ')}`,
        );
      }

      // 1. 既存の予約データをCore型オブジェクトとして取得
      const existingReservation = getReservationCoreById(reservationId);

      const { _isByAdmin, _adminToken } = reservationWithAccounting;
      validateUserOperation(
        existingReservation,
        studentId,
        _isByAdmin,
        _adminToken || null,
      );

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

      // 5. 売上ログの記録は20時のバッチ処理で実行されるためここでは行わない

      // ログと通知
      // 管理者操作の場合はログにその旨を記録
      const formDataAny = /** @type {any} */ (reservationWithAccounting);
      const isAdminOp = formDataAny.isAdminOperation;
      const adminUserId = formDataAny.adminUserId;
      const logMessage = isAdminOp
        ? `【管理者操作】会計記録を保存しました（操作者: ${adminUserId}）`
        : '会計記録を保存しました';

      logActivity(
        studentId,
        CONSTANTS.LOG_ACTIONS.ACCOUNTING_SAVE,
        CONSTANTS.MESSAGES.SUCCESS,
        {
          classroom: updatedReservation.classroom,
          reservationId: reservationId,
          date: updatedReservation.date,
          message: logMessage,
          details: accountingDetails
            ? {
                grandTotal: accountingDetails.grandTotal,
                tuitionSubtotal: accountingDetails.tuition?.subtotal || 0,
                salesSubtotal: accountingDetails.sales?.subtotal || 0,
                paymentMethod: accountingDetails.paymentMethod,
                ...(isAdminOp ? { isAdminOperation: true, adminUserId } : {}),
              }
            : {},
        },
      );

      const userInfo =
        updatedReservation.user || getCachedStudentById(studentId);
      if (!userInfo) {
        throw new Error(`生徒情報が取得できませんでした: ${String(studentId)}`);
      }

      const userDisplay = formatAdminUserDisplay(userInfo);
      const subject = `会計記録 (${updatedReservation.classroom}) ${userDisplay}様`;
      const body =
        `会計が記録されました。

` +
        `表示名: ${userDisplay}
` +
        `本名: ${userInfo.realName}
` +
        `ニックネーム: ${userInfo.nickname}

` +
        `教室: ${updatedReservation.classroom}
` +
        `予約ID: ${reservationId}
` +
        `生徒ID: ${studentId}
` +
        `合計金額: ¥${(accountingDetails?.grandTotal || 0).toLocaleString()}

` +
        `詳細はスプレッドシートを確認してください。`;
      sendAdminNotification(subject, body);

      return createApiResponse(true, {
        message: '会計処理と関連データの更新がすべて完了しました。',
      });
    } catch (err) {
      logActivity(
        reservationWithAccounting.studentId,
        CONSTANTS.LOG_ACTIONS.ACCOUNTING_SAVE,
        CONSTANTS.MESSAGES.ERROR,
        {
          classroom: reservationWithAccounting.classroom || '',
          reservationId: reservationWithAccounting.reservationId || '',
          date: reservationWithAccounting.date || '',
          message: '会計記録の保存に失敗しました',
          details: {
            エラー: err.message,
            スタック: err.stack,
          },
        },
      );
      Logger.log(`saveAccountingDetails Error: ${err.message}
${err.stack}`);
      const errorResponse = BackendErrorHandler.handle(
        /** @type {Error} */ (err),
        'saveAccountingDetails',
      );
      return normalizeErrorResponse(errorResponse);
    }
  });
}

/**
 * 会計情報を修正します（当日20時まで可能）
 *
 * @param {ReservationCore} reservationWithUpdatedAccounting - 修正後の会計情報を含む予約オブジェクト。
 * @returns {ApiResponseGeneric<{ message: string }>} - 処理結果。
 *
 * @description
 * 既存の会計データを修正する機能。修正締切（20時）までのみ実行可能。
 * 売上表への転載は20時のバッチ処理で行われるため、ここでは予約シートの更新のみを行う。
 * これにより、何度修正しても売上表に影響を与えずに修正が可能。
 */
export function updateAccountingDetails(reservationWithUpdatedAccounting) {
  return withTransaction(() => {
    try {
      const { reservationId, studentId, accountingDetails, date } =
        reservationWithUpdatedAccounting;

      if (!reservationId || !studentId || !accountingDetails) {
        throw new Error('会計修正に必要な情報が不足しています。');
      }

      // 1. 既存の予約データをCore型オブジェクトとして取得
      const existingReservation = getReservationCoreById(reservationId);

      // 2. 権限チェック (共通関数を使用)
      const { _isByAdmin, _adminToken } = reservationWithUpdatedAccounting;
      validateUserOperation(
        existingReservation,
        studentId,
        _isByAdmin,
        _adminToken || null,
      );
      const validReservation = /** @type {ReservationCore} */ (
        existingReservation
      );

      // 3. ステータスチェック：会計済み（完了）のみ修正可能
      if (validReservation.status !== CONSTANTS.STATUS.COMPLETED) {
        throw new Error('会計処理が完了していない予約は修正できません。');
      }

      // 4. 時刻チェック：当日20時までのみ修正可能（管理者は例外）
      const deadlineHour =
        CONSTANTS.ACCOUNTING_SYSTEM.MODIFICATION_DEADLINE_HOUR;

      // _isByAdminフラグがある場合はチェックをスキップ
      if (!(/** @type {any} */ (reservationWithUpdatedAccounting)._isByAdmin)) {
        const reservationDate = new Date(date || validReservation.date);
        const now = new Date();

        // 予約日が今日でない場合はエラー
        const todayStr = Utilities.formatDate(
          now,
          CONSTANTS.TIMEZONE,
          'yyyy-MM-dd',
        );
        const reservationDateStr = Utilities.formatDate(
          reservationDate,
          CONSTANTS.TIMEZONE,
          'yyyy-MM-dd',
        );

        if (reservationDateStr !== todayStr) {
          throw new Error(
            '会計修正は教室当日のみ可能です。翌日以降は修正できません。',
          );
        }

        // 現在時刻が締切時刻を過ぎている場合はエラー
        const currentHour = now.getHours();
        if (currentHour >= deadlineHour) {
          throw new Error(
            `会計修正の締切時刻（${deadlineHour}時）を過ぎています。修正できません。`,
          );
        }
      }

      // 5. 更新後の完全なReservationCoreオブジェクトを構築
      /** @type {ReservationCore} */
      const updatedReservation = {
        ...validReservation,
        accountingDetails: accountingDetails, // 会計情報を更新
        // ステータスは「完了」のまま維持
      };

      // 6. 予約シートに保存（売上表への転載は20時のバッチ処理で行う）
      _saveReservationCoreToSheet(updatedReservation, 'update');

      // 7. ログと通知
      logActivity(
        studentId,
        CONSTANTS.LOG_ACTIONS.ACCOUNTING_MODIFY,
        CONSTANTS.MESSAGES.SUCCESS,
        {
          classroom: updatedReservation.classroom,
          reservationId: reservationId,
          date: updatedReservation.date,
          details: {
            合計金額: accountingDetails.grandTotal,
            修正済み: 'はい',
          },
        },
      );

      const userInfo =
        updatedReservation.user || getCachedStudentById(studentId);
      if (!userInfo) {
        throw new Error(`生徒情報が取得できませんでした: ${String(studentId)}`);
      }

      const userDisplay = formatAdminUserDisplay(userInfo);
      const subject = `会計記録修正 (${updatedReservation.classroom}) ${userDisplay}様`;
      const body =
        `会計が修正されました。

` +
        `表示名: ${userDisplay}
` +
        `本名: ${userInfo.realName}
` +
        `ニックネーム: ${userInfo.nickname}

` +
        `教室: ${updatedReservation.classroom}
` +
        `予約ID: ${reservationId}
` +
        `生徒ID: ${studentId}
` +
        `合計金額: ¥${accountingDetails.grandTotal.toLocaleString()}

` +
        `※売上表への転載は${deadlineHour}時のバッチ処理で自動的に行われます。
` +
        `詳細はスプレッドシートを確認してください。`;
      sendAdminNotification(subject, body);

      return createApiResponse(true, {
        message:
          '会計情報を修正しました。売上表への転載は20時に自動で行われます。',
      });
    } catch (err) {
      logActivity(
        reservationWithUpdatedAccounting.studentId,
        CONSTANTS.LOG_ACTIONS.ACCOUNTING_MODIFY,
        CONSTANTS.MESSAGES.ERROR,
        `Error: ${err.message}`,
      );
      Logger.log(`updateAccountingDetails Error: ${err.message}
${err.stack}`);
      const errorResponse = BackendErrorHandler.handle(
        /** @type {Error} */ (err),
        'updateAccountingDetails',
      );
      return normalizeErrorResponse(errorResponse);
    }
  });
}

/**
 * [設計思想] 後続処理でエラーが発生してもメインの会計処理は成功と見なすため、
 * この関数内でのエラーはログに記録するに留め、上位にはスローしない。
 * ただし、バッチ処理等で成否を知る必要があるため、戻り値で結果を返す。
 *
 * @private
 * @param {ReservationCore} reservation - 売上ログを生成する対象の予約オブジェクト
 * @param {AccountingDetailsCore} accountingDetails - 計算済みの会計詳細オブジェクト。
 * @returns {{ success: boolean, error?: Error }} 処理結果
 */
export function logSalesForSingleReservation(reservation, accountingDetails) {
  try {
    // 生徒情報を取得
    const studentId = reservation.studentId;

    // 名前を「本名（ニックネーム）」形式で構築
    let nicknameForSales = '不明';
    if (reservation.user) {
      const realName = reservation.user.realName || '';
      const nickName = reservation.user.nickname || '';

      if (realName && nickName) {
        nicknameForSales = `${realName}（${nickName}）`;
      } else {
        nicknameForSales = realName || nickName;
      }
    }

    /** @type {SalesBaseInfo} */
    const baseInfo = {
      date: new Date(reservation.date), // YYYY-MM-DD形式の文字列をDateオブジェクトに変換
      studentId: studentId,
      // 生徒名を「本名（ニックネーム）」形式で表示
      name: nicknameForSales,
      classroom: reservation.classroom, // reservationオブジェクトから直接取得
      venue: reservation.venue || '', // ReservationCoreから直接取得
      paymentMethod: accountingDetails.paymentMethod || '不明',
    };

    /** @type {SalesRowArray[]} */
    const salesRows = [];

    // 授業料ログ
    if (accountingDetails.tuition && accountingDetails.tuition.subtotal > 0) {
      accountingDetails.tuition.items.forEach(item => {
        // アイテムオブジェクトを直接渡す（unitPrice, quantityがあれば含まれる）
        const salesRow = createSalesRow(baseInfo, '授業料', item);
        salesRows.push(salesRow);
      });
    }

    // 物販ログ
    if (accountingDetails.sales && accountingDetails.sales.subtotal > 0) {
      accountingDetails.sales.items.forEach(item => {
        // アイテムオブジェクトを直接渡す
        const salesRow = createSalesRow(baseInfo, '物販', item);
        salesRows.push(salesRow);
      });
    }

    if (salesRows.length > 0) {
      if (!SALES_SPREADSHEET_ID) {
        throw new Error('SALES_SPREADSHEET_IDが設定されていません。');
      }

      const salesSheet = SS_MANAGER.getExternalSheet(
        SALES_SPREADSHEET_ID,
        CONSTANTS.SHEET_NAMES.SALES_LOG,
      );

      if (!salesSheet) {
        throw new Error(
          `${CONSTANTS.SHEET_NAMES.SALES_LOG}シートが見つかりませんでした。`,
        );
      }

      salesRows.forEach(row => salesSheet.appendRow(row));
    }

    return { success: true };
  } catch (err) {
    Logger.log(
      `logSalesForSingleReservation Error: ${err.message}\n${err.stack}`,
    );
    console.error(
      `[logSalesForSingleReservation] Error: ${err.message}`,
      err.stack,
    );
    return { success: false, error: err };
  }
}

/**
 * 日程マスタから特定の日付・教室のルールを取得する
 * @param {string} date - 日付 (YYYY-MM-DD)
 * @param {string} classroom - 教室名
 * @returns {LessonCore | undefined} 日程マスタのルール
 */
export function getScheduleInfoForDate(date, classroom) {
  const scheduleCache = /** @type {ScheduleCacheData | null | undefined} */ (
    getCachedData(CACHE_KEYS.MASTER_SCHEDULE_DATA)
  );
  const scheduleList = Array.isArray(scheduleCache?.['schedule'])
    ? /** @type {LessonCore[]} */ (scheduleCache['schedule'])
    : undefined;
  if (!scheduleList) return undefined;

  return scheduleList.find(
    /** @param {LessonCore} item */
    item => item.date === date && item.classroom === classroom,
  );
}

/**
 * 空き通知希望の予約を確定する
 * @param {{reservationId: string, studentId: string, messageToTeacher?: string, _isByAdmin?: boolean, _adminToken?: string | null}} confirmInfo - 確定情報
 * @returns {ApiResponseGeneric<any>} 処理結果と最新データ
 */
export function confirmWaitlistedReservation(confirmInfo) {
  return withTransaction(() => {
    try {
      const { reservationId, studentId, messageToTeacher } = confirmInfo;

      // ★改善: getReservationCoreByIdを使用して予約情報を一行で取得
      const targetReservation = getReservationCoreById(reservationId);

      const { _isByAdmin, _adminToken } = confirmInfo;
      validateUserOperation(
        targetReservation,
        studentId,
        _isByAdmin,
        _adminToken || null,
      );
      const validReservation = /** @type {ReservationCore} */ (
        targetReservation
      );

      // 現在のステータスが空き通知希望（待機）かチェック
      if (validReservation.status !== CONSTANTS.STATUS.WAITLISTED) {
        throw new Error('この予約は空き通知希望ではありません。');
      }

      // 定員チェック（現在空席があるかチェック）
      const isFull = checkCapacityFull(
        validReservation.classroom,
        validReservation.date,
        validReservation.startTime || '',
        validReservation.endTime || '',
        validReservation.firstLecture || false,
      );
      if (isFull) {
        throw new Error('現在満席のため確定できません。');
      }

      // 更新後の予約オブジェクトを構築
      /** @type {ReservationCore} */
      const updatedReservation = {
        ...validReservation,
        status: CONSTANTS.STATUS.CONFIRMED,
        messageToTeacher:
          messageToTeacher || validReservation.messageToTeacher || '',
      };

      // 共通関数を呼び出して保存
      _saveReservationCoreToSheet(updatedReservation, 'update');

      // ログ記録

      logActivity(
        studentId,
        CONSTANTS.LOG_ACTIONS.RESERVATION_CONFIRM,
        CONSTANTS.MESSAGES.SUCCESS,
        {
          classroom: updatedReservation.classroom,
          reservationId: reservationId,
          date: updatedReservation.date,
          message: messageToTeacher
            ? `空き待ち確定: ${messageToTeacher}`
            : '空き待ちから確定しました',
          details: {
            ステータス: '確定済',
            LessonID: updatedReservation.lessonId,
          },
        },
      );

      // 管理者通知
      sendAdminNotificationForReservation(updatedReservation, 'updated');

      // 最新の予約データを取得して返却
      /** @type {ApiResponse<{ myReservations: ReservationCore[] }>} */
      const userReservationsResult = getUserReservations(studentId);
      const latestMyReservations =
        userReservationsResult.success &&
        userReservationsResult.data &&
        Array.isArray(userReservationsResult.data.myReservations)
          ? userReservationsResult.data.myReservations
          : [];

      const latestLessonsResponse = getLessons();
      const latestLessons =
        latestLessonsResponse.success &&
        Array.isArray(latestLessonsResponse.data)
          ? /** @type {LessonCore[]} */ (latestLessonsResponse.data)
          : [];

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
        CONSTANTS.LOG_ACTIONS.RESERVATION_CONFIRM,
        CONSTANTS.MESSAGES.ERROR,
        `Error: ${err.message}`,
      );
      Logger.log(
        `confirmWaitlistedReservation Error: ${err.message}
${err.stack}`,
      );
      const errorResponse = BackendErrorHandler.handle(
        /** @type {Error} */ (err),
        'confirmWaitlistedReservation',
      );
      return normalizeErrorResponse(errorResponse);
    }
  });
}

/**
 * 指定した予約IDと日付の売上ログが既に記録されているか確認
 * @param {string} reservationId - 予約ID
 * @param {string} _date - 予約日（YYYY-MM-DD形式）※未使用（将来の拡張用）
 * @returns {boolean} 既に記録されている場合はtrue
 */
export function checkIfSalesAlreadyLogged(reservationId, _date) {
  try {
    if (!SALES_SPREADSHEET_ID) {
      Logger.log(
        `[checkIfSalesAlreadyLogged] SALES_SPREADSHEET_IDが設定されていません`,
      );
      return false;
    }

    const salesLogSheet = SS_MANAGER.getExternalSheet(
      SALES_SPREADSHEET_ID,
      CONSTANTS.SHEET_NAMES.SALES_LOG,
    );

    if (!salesLogSheet) {
      Logger.log(`[checkIfSalesAlreadyLogged] 売上ログシートが見つかりません`);
      return false;
    }

    const lastRow = salesLogSheet.getLastRow();
    if (lastRow < 2) {
      return false;
    }

    const data = salesLogSheet.getRange(2, 1, lastRow - 1, 10).getValues();

    // 予約IDで重複チェック
    for (const row of data) {
      const logReservationId = String(row[9] || ''); // J列: 予約ID
      const logDate = row[0]; // A列: 日付

      if (logReservationId === reservationId) {
        Logger.log(
          `[checkIfSalesAlreadyLogged] 重複検出: ${reservationId}, 既存日付: ${logDate}`,
        );
        return true;
      }
    }

    return false;
  } catch (error) {
    Logger.log(`[checkIfSalesAlreadyLogged] エラー: ${error.message}`);
    return false; // エラー時は重複なしとして処理継続
  }
}
