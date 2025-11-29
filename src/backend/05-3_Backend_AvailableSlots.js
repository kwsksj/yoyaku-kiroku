/**
 * =================================================================
 * 【ファイル名】  : 05-3_Backend_AvailableSlots.js
 * 【モジュール種別】: バックエンド（GAS）
 * 【役割】        : レッスン空き枠 API を提供し、予約関連画面で必要となる最新スケジュールを計算する。
 *
 * 【主な責務】
 *   - `getLessons` で日程マスタ＋予約キャッシュを突合し、教室ごとの空き枠を算出
 *   - `getUserReservations` など、フロントエンドへ返却する ReservationCore 配列を整形
 *   - 予約確定や空き通知の補助データ（待機リスト抽出 等）を共通化
 *
 * 【関連モジュール】
 *   - `02-4_BusinessLogic_ScheduleMaster.js`: 日程マスタの読み出し
 *   - `07_CacheManager.js` / `08_Utilities.js`: 予約キャッシュからのデータ取得
 *   - `05-2_Backend_Write.js`: 予約確定・キャンセル後に呼び出され、最新データを返却
 *
 * 【利用時の留意点】
 *   - 返却値は `createApiResponse` でラップされるため、呼び出し側は `success` と `data` の存在確認が必須
 *   - 将来的に時間帯追加など仕様が変わる場合、空き枠判断ロジック（firstSlots/secondSlots 判定）を集中修正できる
 * =================================================================
 */

// ================================================================
// 依存モジュール
// ================================================================
import { getAllScheduledDates } from './02-4_BusinessLogic_ScheduleMaster.js';
import { getReservationsByIdsFromCache } from './07_CacheManager.js';
import { BackendErrorHandler, createApiResponse } from './08_ErrorHandler.js';
import { getCachedReservationsAsObjects } from './08_Utilities.js';

/**
 * 開催予定のレッスン情報（空き枠情報を含む）を計算して返す
 * @returns {ApiResponse<LessonCore[]>}
 */
export function getLessons(includePast = false) {
  try {
    Logger.log('=== getLessons 開始 ===');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayString = Utilities.formatDate(
      today,
      CONSTANTS.TIMEZONE,
      'yyyy-MM-dd',
    );

    // スケジュールマスタデータ取得
    const fromDateForFilter = includePast ? '' : todayString;
    /** @type {LessonCore[]} */
    const scheduledDates = getAllScheduledDates(fromDateForFilter, '');
    Logger.log(`日程マスタ取得: ${scheduledDates.length}件`);

    /** @type {LessonCore[]} */
    const lessons = [];

    /** @type {Record<string, ReservationCore[]> | null} */
    let reservationsMapByLessonId = null;
    const buildReservationsMapByLessonId = () => {
      if (reservationsMapByLessonId) return reservationsMapByLessonId;
      // 予約IDsが欠落している場合のフォールバック用に、lessonId単位のマップを一度だけ構築
      const allReservations = getCachedReservationsAsObjects();
      reservationsMapByLessonId = allReservations.reduce(
        (acc, reservation) => {
          if (!reservation || !reservation.lessonId) return acc;
          const key = String(reservation.lessonId);
          if (!acc[key]) acc[key] = [];
          acc[key].push(reservation);
          return acc;
        },
        /** @type {Record<string, ReservationCore[]>} */ ({}),
      );
      return reservationsMapByLessonId;
    };

    // 未来の日程のみに絞り込み（includePastフラグで制御）
    const targetSchedules = includePast
      ? scheduledDates
      : scheduledDates.filter(schedule => {
          const scheduleDate =
            schedule.date instanceof Date
              ? schedule.date
              : new Date(schedule.date);
          return scheduleDate >= today;
        });

    Logger.log(`処理対象のレッスン数: ${targetSchedules.length}件`);

    targetSchedules.forEach(schedule => {
      const dateKey =
        schedule.date instanceof Date
          ? Utilities.formatDate(
              schedule.date,
              CONSTANTS.TIMEZONE,
              'yyyy-MM-dd',
            )
          : String(schedule.date);

      // ★最適化: reservationIdsから直接予約を取得（O(1)アクセス）
      const allReservationsForLesson = getReservationsByIdsFromCache(
        schedule.reservationIds || [],
      );

      // 予約IDsが空・欠落している場合はlessonId経由でフォールバック取得
      const lessonIdKey =
        schedule.lessonId && typeof schedule.lessonId === 'string'
          ? schedule.lessonId
          : '';
      const reservationsForLookup =
        (allReservationsForLesson && allReservationsForLesson.length > 0) ||
        !lessonIdKey
          ? allReservationsForLesson
          : buildReservationsMapByLessonId()[lessonIdKey] || [];

      // 有効な予約のみフィルタリング（キャンセル・待機中を除外）
      const reservationsForDate = reservationsForLookup.filter(
        r =>
          r.status !== CONSTANTS.STATUS.CANCELED &&
          r.status !== CONSTANTS.STATUS.WAITLISTED,
      );

      // 空き枠計算
      const slots = calculateAvailableSlots(schedule, reservationsForDate);

      // LessonCore形式で追加
      lessons.push({
        lessonId: schedule.lessonId, // ★ 追加
        reservationIds: schedule.reservationIds, // ★ 追加
        classroom: schedule.classroom,
        date: dateKey,
        venue: schedule.venue,
        classroomType: schedule.classroomType,
        notes: String(schedule.notes || ''),
        status: schedule.status,
        firstStart: formatTime(/** @type {any} */ (schedule.firstStart)),
        firstEnd: formatTime(/** @type {any} */ (schedule.firstEnd)),
        secondStart: formatTime(/** @type {any} */ (schedule.secondStart)),
        secondEnd: formatTime(/** @type {any} */ (schedule.secondEnd)),
        beginnerStart: formatTime(/** @type {any} */ (schedule.beginnerStart)),
        startTime: formatTime(/** @type {any} */ (schedule.startTime)),
        endTime: formatTime(/** @type {any} */ (schedule.endTime)),
        totalCapacity: parseCapacity(schedule.totalCapacity),
        beginnerCapacity: parseCapacity(schedule.beginnerCapacity),
        // 空き枠情報
        firstSlots: slots.first,
        secondSlots: slots.second,
        beginnerSlots: slots.beginner,
      });
    });

    // 当日講座の終了2時間前フィルター
    const now = new Date();
    const todayMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const filteredLessons = lessons.filter(lesson => {
      const lessonDate = new Date(lesson.date);

      // 当日以外はそのまま表示
      if (lessonDate.getTime() !== todayMidnight.getTime()) {
        return true;
      }

      // 当日の場合、終了時刻をチェック
      if (lesson.firstEnd) {
        const [endHour, endMinute] = lesson.firstEnd.split(':').map(Number);
        const endDateTime = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          endHour,
          endMinute,
        );
        const twoHoursBefore = new Date(
          endDateTime.getTime() - 2 * 60 * 60 * 1000,
        );

        return now < twoHoursBefore;
      }

      return true;
    });

    // 日付・教室順でソート
    filteredLessons.sort((a, b) => {
      const dateComp = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateComp !== 0) return dateComp;
      return a.classroom.localeCompare(b.classroom);
    });

    Logger.log(`レッスン情報計算完了: ${filteredLessons.length}件`);
    return /** @type {ApiResponse<LessonCore[]>} */ (
      createApiResponse(true, { data: filteredLessons })
    );
  } catch (error) {
    Logger.log(`getLessons エラー: ${error.message}\n${error.stack}`);
    return /** @type {ApiResponse<LessonCore[]>} */ (
      BackendErrorHandler.handle(error, 'getLessons', { data: [] })
    );
  }
}

/**
 * 空き枠を計算
 * @param {LessonCore} schedule
 * @param {ReservationCore[]} reservations
 * @returns {{first: number, second: number|undefined, beginner: number|null}}
 */
export function calculateAvailableSlots(schedule, reservations) {
  /** @type {{first: number, second: number|undefined, beginner: number|null}} */
  const result = {
    first: 0,
    second: undefined,
    beginner: null,
  };

  const totalCapacity = parseCapacity(schedule.totalCapacity);
  const beginnerCapacity = parseCapacity(schedule.beginnerCapacity);

  // 教室タイプ別の計算ロジック
  if (schedule.classroomType === CONSTANTS.CLASSROOM_TYPES.TIME_DUAL) {
    // 2部制の場合
    const firstReservations = reservations.filter(r =>
      isInTimeSlot(r, String(schedule.firstStart), String(schedule.firstEnd)),
    );
    const secondReservations = reservations.filter(r =>
      isInTimeSlot(r, String(schedule.secondStart), String(schedule.secondEnd)),
    );

    result.first = Math.max(0, totalCapacity - firstReservations.length);
    result.second = Math.max(0, totalCapacity - secondReservations.length);

    // 初回枠計算（2部に重なる初回者のみカウント）
    if (beginnerCapacity > 0 && schedule.beginnerStart) {
      const beginnerCount = secondReservations.filter(
        r => r.firstLecture,
      ).length;
      result.beginner = Math.max(
        0,
        Math.min(result.second, beginnerCapacity - beginnerCount),
      );
    }
  } else {
    // 全日制・セッション制
    result.first = Math.max(0, totalCapacity - reservations.length);

    // 初回枠計算
    if (beginnerCapacity > 0) {
      const beginnerCount = reservations.filter(r => r.firstLecture).length;
      result.beginner = Math.max(
        0,
        Math.min(result.first, beginnerCapacity - beginnerCount),
      );
    }
  }

  return result;
}

/**
 * 予約が指定時間枠内にあるか判定
 * @param {ReservationCore} reservation
 * @param {string} slotStart
 * @param {string} slotEnd
 * @returns {boolean}
 */
export function isInTimeSlot(reservation, slotStart, slotEnd) {
  if (
    !reservation.startTime ||
    !reservation.endTime ||
    !slotStart ||
    !slotEnd
  ) {
    return false;
  }

  const resStart = new Date(`1900-01-01T${reservation.startTime}`);
  const resEnd = new Date(`1900-01-01T${reservation.endTime}`);
  const slotStartTime = new Date(`1900-01-01T${slotStart}`);
  const slotEndTime = new Date(`1900-01-01T${slotEnd}`);

  // 予約開始時刻が枠終了時刻以前 AND 予約終了時刻が枠開始時刻以降
  return resStart <= slotEndTime && resEnd >= slotStartTime;
}

/**
 * 時刻フォーマット統一
 * @param {string|Date|undefined} time
 * @returns {string|undefined}
 */
export function formatTime(time) {
  if (!time) return undefined;
  if (time instanceof Date) {
    return Utilities.formatDate(time, CONSTANTS.TIMEZONE, 'HH:mm');
  }
  return String(time);
}

/**
 * 定員パース
 * @param {number|string|undefined} capacity
 * @returns {number}
 */
export function parseCapacity(capacity) {
  if (!capacity) return 0;
  if (typeof capacity === 'string') {
    const parsed = parseInt(capacity, 10);
    return isNaN(parsed) ? 0 : parsed;
  }
  return capacity;
}

/**
 * 特定の教室のレッスン情報のみを取得する
 * @param {string} classroom - 教室名
 * @returns {ApiResponse<LessonCore[]>}
 */
export function getLessonsForClassroom(classroom) {
  const result = getLessons();
  if (!result.success || !result.data) {
    return /** @type {ApiResponse<LessonCore[]>} */ (
      createApiResponse(false, { message: result.message, data: [] })
    );
  }
  const filteredData = result.data.filter(
    lesson => lesson.classroom === classroom,
  );
  return /** @type {ApiResponse<LessonCore[]>} */ (
    createApiResponse(true, { data: filteredData })
  );
}

/**
 * 特定の生徒の予約データを取得する
 * @param {string} studentId - 生徒ID
 * @returns {ApiResponse<{ myReservations: ReservationCore[] }>}
 */
export function getUserReservations(studentId) {
  try {
    Logger.log(`getUserReservations - studentId: ${studentId}`);

    // ★改善: 新しいヘルパー関数で予約データをオブジェクトとして直接取得
    const convertedReservations = getCachedReservationsAsObjects();

    /** @type {ReservationCore[]} */
    const myReservations = convertedReservations
      .filter(
        /** @param {ReservationCore} reservation */
        reservation =>
          reservation.studentId === studentId &&
          reservation.status !== CONSTANTS.STATUS.CANCELED,
      )
      .sort(
        /**
         * @param {ReservationCore} a
         * @param {ReservationCore} b
         */
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

    // ユーザー情報はtransformReservationArrayToObjectWithHeaders()で自動付与される

    Logger.log(`生徒ID ${studentId} の予約: ${myReservations.length}件`);
    return /** @type {ApiResponse<{ myReservations: ReservationCore[] }>} */ (
      createApiResponse(true, { myReservations })
    );
  } catch (error) {
    Logger.log(`getUserReservations エラー: ${error.message}`);
    return /** @type {ApiResponse<{ myReservations: ReservationCore[] }>} */ (
      BackendErrorHandler.handle(error, 'getUserReservations', {
        data: { myReservations: [] },
      })
    );
  }
}
