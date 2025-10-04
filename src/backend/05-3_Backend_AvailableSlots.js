/// <reference path="../../types/index.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 05-3_Backend_AvailableSlots.js
 * 【バージョン】: 1.5
 * 【役割】: キャッシュベース + 日程マスタを使用した予約枠計算機能
 * 【v1.5での変更点】:
 * - JSDocを修正し、グローバル関数呼び出しを修正
 * =================================================================
 */

/**
 * 開催予定の講座情報（空き枠情報を含む）を計算して返す
 * @returns {ApiResponse<any[]>}
 */
function getLessons() {
  try {
    Logger.log('=== getLessons 開始 ===');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayString = Utilities.formatDate(
      today,
      CONSTANTS.TIMEZONE,
      'yyyy-MM-dd',
    );
    Logger.log(
      `=== getLessons: today=${today}, todayString=${todayString} ===`,
    );

    /** @type {ScheduleMasterData[]} */
    const scheduledDates = getAllScheduledDates(todayString, null);
    Logger.log(
      `=== scheduledDates取得完了: ${scheduledDates ? scheduledDates.length : 0} 件 ===`,
    );

    const reservationsCache = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);
    /** @type {ReservationArrayData[]} */
    const allReservations = reservationsCache
      ? /** @type {ReservationArrayData[]} */ (
          reservationsCache['reservations'] || []
        )
      : [];
    /** @type {HeaderMapType | null} */
    const headerMap = reservationsCache
      ? /** @type {HeaderMapType} */ (reservationsCache['headerMap'])
      : null;
    Logger.log(
      `=== 予約キャッシュ取得: 予約数=${allReservations.length}件, ヘッダーマップ=${!!headerMap} ===`,
    );

    // 新しいヘルパー関数を使用してデータ変換を統一
    /** @type {RawReservationObject[]} */
    const convertedReservations = convertReservationsToObjects(
      allReservations,
      headerMap,
    );
    Logger.log(`=== 予約データ変換完了: ${convertedReservations.length}件 ===`);

    /** @type {Map<string, ReservationCore[]>} */
    const reservationsByDateClassroom = new Map();
    const validReservations = convertedReservations.filter(reservation => {
      const reservationDate =
        reservation.date instanceof Date
          ? reservation.date
          : new Date(reservation.date);
      return (
        reservationDate >= today &&
        reservation.status !== CONSTANTS.STATUS.CANCELED &&
        reservation.status !== CONSTANTS.STATUS.WAITLISTED
      );
    });

    validReservations.forEach(reservation => {
      const reservationDate =
        reservation.date instanceof Date
          ? reservation.date
          : new Date(reservation.date);
      const dateString = Utilities.formatDate(
        reservationDate,
        CONSTANTS.TIMEZONE,
        'yyyy-MM-dd',
      );
      const key = `${dateString}|${reservation.classroom}`;
      if (!reservationsByDateClassroom.has(key)) {
        reservationsByDateClassroom.set(key, []);
      }
      reservationsByDateClassroom
        .get(key)
        ?.push(/** @type {ReservationCore} */ (reservation));
    });

    /** @type {any[]} */
    const lessons = [];

    scheduledDates.forEach(schedule => {
      // 日程マスタの日付はDate型で正規化済み、キー生成時に文字列化
      const dateKey =
        schedule.date instanceof Date
          ? Utilities.formatDate(
              schedule.date,
              CONSTANTS.TIMEZONE,
              'yyyy-MM-dd',
            )
          : String(schedule.date);
      const key = `${dateKey}|${schedule.classroom}`;
      const reservationsForDate = reservationsByDateClassroom.get(key) || [];

      Logger.log(
        `計算開始: ${schedule.date} ${schedule.classroom} - 予約数: ${reservationsForDate.length}件`,
      );

      // 時間解析結果をキャッシュ
      const timeCache = {
        firstEndTime: schedule.firstEnd
          ? new Date(`1900-01-01T${schedule.firstEnd}`)
          : null,
        secondStartTime: schedule.secondStart
          ? new Date(`1900-01-01T${schedule.secondStart}`)
          : null,
        beginnerStartTime: schedule.beginnerStart
          ? new Date(`1900-01-01T${schedule.beginnerStart}`)
          : null,
      };

      // セッション別予約数をカウント
      const sessionCounts = new Map();

      reservationsForDate.forEach(
        /** @param {ReservationCore} reservation */ reservation => {
          // 教室形式別のセッション集計ロジック
          if (schedule.classroomType === CONSTANTS.CLASSROOM_TYPES.TIME_DUAL) {
            // ${CONSTANTS.CLASSROOMS.TSUKUBA}: 2部制時間制
            const startTime = reservation.startTime
              ? new Date(`1900-01-01T${reservation.startTime}`)
              : null;
            const endTime = reservation.endTime
              ? new Date(`1900-01-01T${reservation.endTime}`)
              : null;

            if (
              startTime &&
              endTime &&
              timeCache.firstEndTime &&
              timeCache.secondStartTime
            ) {
              // 1部（午前）：開始時刻が1部終了時刻以前
              if (startTime <= timeCache.firstEndTime) {
                sessionCounts.set(
                  CONSTANTS.TIME_SLOTS.MORNING,
                  (sessionCounts.get(CONSTANTS.TIME_SLOTS.MORNING) || 0) + 1,
                );
              }

              // 2部（午後）：終了時刻が2部開始時刻以降
              if (endTime >= timeCache.secondStartTime) {
                sessionCounts.set(
                  CONSTANTS.TIME_SLOTS.AFTERNOON,
                  (sessionCounts.get(CONSTANTS.TIME_SLOTS.AFTERNOON) || 0) + 1,
                );
              }
            }
          } else if (
            schedule.classroomType === CONSTANTS.CLASSROOM_TYPES.SESSION_BASED
          ) {
            // ${CONSTANTS.CLASSROOMS.TOKYO}: セッション制
            sessionCounts.set(
              CONSTANTS.ITEMS.MAIN_LECTURE,
              (sessionCounts.get(CONSTANTS.ITEMS.MAIN_LECTURE) || 0) + 1,
            );
          } else {
            // ${CONSTANTS.CLASSROOMS.NUMAZU}など: 全日時間制
            sessionCounts.set(
              CONSTANTS.TIME_SLOTS.ALL_DAY,
              (sessionCounts.get(CONSTANTS.TIME_SLOTS.ALL_DAY) || 0) + 1,
            );
          }

          // 初回者は独立して判定
          if (reservation.firstLecture && timeCache.beginnerStartTime) {
            const startTime = reservation.startTime
              ? new Date(`1900-01-01T${reservation.startTime}`)
              : null;
            const endTime = reservation.endTime
              ? new Date(`1900-01-01T${reservation.endTime}`)
              : null;

            // 予約時間が初回者開始時刻と重複するかチェック
            if (
              startTime &&
              endTime &&
              startTime <= timeCache.beginnerStartTime &&
              endTime >= timeCache.beginnerStartTime
            ) {
              sessionCounts.set(
                CONSTANTS.ITEMS.FIRST_LECTURE,
                (sessionCounts.get(CONSTANTS.ITEMS.FIRST_LECTURE) || 0) + 1,
              );
            }
          }
        },
      );

      // 6. この日程の予約枠データを生成
      // 日程マスタの定員値を数値として取得（文字列の場合は変換）
      /** @type {number} */
      let totalCapacity = 0;
      let totalCapacitySource = '日程マスタ';

      if (schedule.totalCapacity) {
        if (typeof schedule.totalCapacity === 'string') {
          totalCapacity = parseInt(schedule.totalCapacity, 10);
          if (isNaN(totalCapacity)) totalCapacity = 0;
        } else {
          totalCapacity = schedule.totalCapacity;
        }
      }

      // 日程マスタで全体定員が未設定の場合は0とする（システムデフォルト使用を廃止）
      if (!totalCapacity) {
        totalCapacity = 0;
        totalCapacitySource = '日程マスタ未設定により0';
      }

      /** @type {number} */
      let beginnerCapacity = 0;
      let beginnerCapacitySource = '日程マスタ';

      if (
        schedule.beginnerCapacity !== undefined &&
        schedule.beginnerCapacity !== null
      ) {
        if (typeof schedule.beginnerCapacity === 'string') {
          beginnerCapacity = parseInt(schedule.beginnerCapacity, 10);
          if (isNaN(beginnerCapacity)) beginnerCapacity = 0;
        } else {
          beginnerCapacity = schedule.beginnerCapacity;
        }
      } else {
        // 日程マスタで初回者定員が未設定の場合は0とする（システムデフォルト使用を廃止）
        beginnerCapacity = 0;
        beginnerCapacitySource = '日程マスタ未設定により0';
      }

      Logger.log(
        `定員設定 - ${schedule.date} ${schedule.classroom}: 全体定員=${totalCapacity}(${totalCapacitySource}), 初回者定員=${beginnerCapacity}(${beginnerCapacitySource})`,
      );

      if (schedule.classroomType === CONSTANTS.CLASSROOM_TYPES.TIME_DUAL) {
        // ${CONSTANTS.CLASSROOMS.TSUKUBA}: 午前・午後セッション
        const morningCount =
          sessionCounts.get(CONSTANTS.TIME_SLOTS.MORNING) || 0;
        const afternoonCount =
          sessionCounts.get(CONSTANTS.TIME_SLOTS.AFTERNOON) || 0;
        const introCount =
          sessionCounts.get(CONSTANTS.ITEMS.FIRST_LECTURE) || 0;

        const morningSlots = Math.max(0, totalCapacity - morningCount);
        const afternoonSlots = Math.max(0, totalCapacity - afternoonCount);
        const introSpecific = Math.max(0, beginnerCapacity - introCount);
        const introFinalAvailable = Math.min(afternoonSlots, introSpecific);

        const firstLectureIsFull =
          beginnerCapacity > 0 && introFinalAvailable === 0;

        lessons.push({
          schedule: {
            classroom: schedule.classroom,
            date:
              schedule.date instanceof Date
                ? Utilities.formatDate(
                    schedule.date,
                    CONSTANTS.TIMEZONE,
                    'yyyy-MM-dd',
                  )
                : String(schedule.date),
            venue: String(schedule.venue || ''),
            classroomType: schedule.classroomType,
            firstStart:
              typeof schedule.firstStart === 'object' &&
              schedule.firstStart instanceof Date
                ? Utilities.formatDate(
                    schedule.firstStart,
                    CONSTANTS.TIMEZONE,
                    'HH:mm',
                  )
                : schedule.firstStart,
            firstEnd:
              typeof schedule.firstEnd === 'object' &&
              schedule.firstEnd instanceof Date
                ? Utilities.formatDate(
                    schedule.firstEnd,
                    CONSTANTS.TIMEZONE,
                    'HH:mm',
                  )
                : schedule.firstEnd,
            secondStart:
              typeof schedule.secondStart === 'object' &&
              schedule.secondStart instanceof Date
                ? Utilities.formatDate(
                    schedule.secondStart,
                    CONSTANTS.TIMEZONE,
                    'HH:mm',
                  )
                : schedule.secondStart,
            secondEnd:
              typeof schedule.secondEnd === 'object' &&
              schedule.secondEnd instanceof Date
                ? Utilities.formatDate(
                    schedule.secondEnd,
                    CONSTANTS.TIMEZONE,
                    'HH:mm',
                  )
                : schedule.secondEnd,
            beginnerStart:
              typeof schedule.beginnerStart === 'object' &&
              schedule.beginnerStart instanceof Date
                ? Utilities.formatDate(
                    schedule.beginnerStart,
                    CONSTANTS.TIMEZONE,
                    'HH:mm',
                  )
                : schedule.beginnerStart,
            totalCapacity: totalCapacity,
            beginnerCapacity: beginnerCapacity,
          },
          status: {
            morningSlots: morningSlots,
            afternoonSlots: afternoonSlots,
            firstLectureSlots: introFinalAvailable,
            isFull: morningSlots <= 0 && afternoonSlots <= 0,
            firstLectureIsFull: firstLectureIsFull,
          },
        });
      } else if (
        schedule.classroomType === CONSTANTS.CLASSROOM_TYPES.SESSION_BASED
      ) {
        // 東京教室: 本講座と初回者
        const mainCount = sessionCounts.get(CONSTANTS.ITEMS.MAIN_LECTURE) || 0;
        const introCount =
          sessionCounts.get(CONSTANTS.ITEMS.FIRST_LECTURE) || 0;

        const mainAvailable = Math.max(0, totalCapacity - mainCount);
        const introSpecific = Math.max(0, beginnerCapacity - introCount);
        const introFinalAvailable = Math.min(mainAvailable, introSpecific);

        const firstLectureIsFull =
          beginnerCapacity > 0 && introFinalAvailable === 0;

        lessons.push({
          schedule: {
            classroom: schedule.classroom,
            date:
              schedule.date instanceof Date
                ? Utilities.formatDate(
                    schedule.date,
                    CONSTANTS.TIMEZONE,
                    'yyyy-MM-dd',
                  )
                : String(schedule.date),
            venue: String(schedule.venue || ''),
            classroomType: schedule.classroomType,
            firstStart:
              schedule.firstStart instanceof Date
                ? Utilities.formatDate(
                    schedule.firstStart,
                    CONSTANTS.TIMEZONE,
                    'HH:mm',
                  )
                : schedule.firstStart,
            firstEnd:
              schedule.firstEnd instanceof Date
                ? Utilities.formatDate(
                    schedule.firstEnd,
                    CONSTANTS.TIMEZONE,
                    'HH:mm',
                  )
                : schedule.firstEnd,
            beginnerStart:
              schedule.beginnerStart instanceof Date
                ? Utilities.formatDate(
                    schedule.beginnerStart,
                    CONSTANTS.TIMEZONE,
                    'HH:mm',
                  )
                : schedule.beginnerStart,
            totalCapacity: totalCapacity,
            beginnerCapacity: beginnerCapacity,
          },
          status: {
            availableSlots: mainAvailable,
            firstLectureSlots: introFinalAvailable,
            isFull: mainAvailable <= 0,
            firstLectureIsFull: firstLectureIsFull,
          },
        });
      } else {
        // 沼津教室など: 全日時間制
        const allDayCount =
          sessionCounts.get(CONSTANTS.TIME_SLOTS.ALL_DAY) || 0;
        const introCount =
          sessionCounts.get(CONSTANTS.ITEMS.FIRST_LECTURE) || 0;

        const available = Math.max(0, totalCapacity - allDayCount);
        const introSpecific = Math.max(0, beginnerCapacity - introCount);
        const introFinalAvailable = Math.min(available, introSpecific);

        const firstLectureIsFull =
          beginnerCapacity > 0 && introFinalAvailable === 0;

        lessons.push({
          schedule: {
            classroom: schedule.classroom,
            date:
              schedule.date instanceof Date
                ? Utilities.formatDate(
                    schedule.date,
                    CONSTANTS.TIMEZONE,
                    'yyyy-MM-dd',
                  )
                : String(schedule.date),
            venue: String(schedule.venue || ''),
            classroomType: schedule.classroomType,
            firstStart:
              schedule.firstStart instanceof Date
                ? Utilities.formatDate(
                    schedule.firstStart,
                    CONSTANTS.TIMEZONE,
                    'HH:mm',
                  )
                : schedule.firstStart,
            firstEnd:
              schedule.firstEnd instanceof Date
                ? Utilities.formatDate(
                    schedule.firstEnd,
                    CONSTANTS.TIMEZONE,
                    'HH:mm',
                  )
                : schedule.firstEnd,
            beginnerStart:
              schedule.beginnerStart instanceof Date
                ? Utilities.formatDate(
                    schedule.beginnerStart,
                    CONSTANTS.TIMEZONE,
                    'HH:mm',
                  )
                : schedule.beginnerStart,
            totalCapacity: totalCapacity,
            beginnerCapacity: beginnerCapacity,
          },
          status: {
            availableSlots: available,
            firstLectureSlots: introFinalAvailable,
            isFull: available <= 0,
            firstLectureIsFull: firstLectureIsFull,
          },
        });
      }
    });

    // 7. 当日講座の終了2時間前フィルター
    const now = new Date();
    const todayMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    /** @type {SessionCore[]} */
    const filteredLessons = lessons.filter(lesson => {
      const lessonDate = new Date(lesson.schedule.date);

      // 当日以外はそのまま表示
      if (lessonDate.getTime() !== todayMidnight.getTime()) {
        return true;
      }

      // 当日の場合、終了時刻をチェック
      if (lesson.schedule.firstEnd) {
        const [endHour, endMinute] = lesson.schedule.firstEnd
          .split(':')
          .map(Number);
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

        // 現在時刻が終了2時間前を過ぎている場合は非表示
        return now < twoHoursBefore;
      }

      return true; // 終了時刻が不明な場合は表示
    });

    // 8. 日付・教室順でソート
    filteredLessons.sort((a, b) => {
      // レッスンオブジェクトの日付は既に文字列化済み
      const aData = /** @type {any} */ (a);
      const bData = /** @type {any} */ (b);
      const dateA = new Date(aData.schedule?.date || aData.date);
      const dateB = new Date(bData.schedule?.date || bData.date);
      const dateComp = dateA.getTime() - dateB.getTime();
      if (dateComp !== 0) return dateComp;
      return (aData.schedule?.classroom || aData.classroom).localeCompare(
        bData.schedule?.classroom || bData.classroom,
      );
    });

    Logger.log(
      `=== 開催予定の講座情報を ${filteredLessons.length} 件計算しました（フィルター後） ===`,
    );
    Logger.log(
      `=== lessons サンプル: ${JSON.stringify(filteredLessons.slice(0, 2))} ===`,
    );
    Logger.log('=== getLessons 正常終了 ===');
    return /** @type {ApiResponse<any[]>} */ (
      createApiResponse(true, { data: filteredLessons })
    );
  } catch (error) {
    Logger.log(`getLessons エラー: ${error.message}\n${error.stack}`);
    return /** @type {ApiResponse<any[]>} */ (
      BackendErrorHandler.handle(error, 'getLessons', { data: [] })
    );
  }
}

/**
 * 特定の教室の講座情報のみを取得する
 * @param {string} classroom - 教室名
 * @returns {ApiResponse<SessionCore[]>}
 */
function getLessonsForClassroom(classroom) {
  const result = getLessons();
  if (!result.success) {
    // @ts-ignore
    return createApiResponse(false, { message: result.message, data: [] });
  }
  return /** @type {ApiResponse<SessionCore[]>} */ (
    createApiResponse(
      true,
      // @ts-ignore
      result.data.filter(lesson => lesson.schedule.classroom === classroom),
    )
  );
}

/**
 * 特定の生徒の予約データを取得する
 * @param {string} studentId - 生徒ID
 * @returns {ApiResponse<{ myReservations: ReservationCore[] }>}
 */
function getUserReservations(studentId) {
  try {
    const reservationsCache = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);
    Logger.log(`🔍 getUserReservations - studentId: ${studentId}`);
    Logger.log(`🔍 キャッシュ取得結果: ${reservationsCache ? 'あり' : 'なし'}`);
    if (reservationsCache) {
      Logger.log(
        `🔍 キャッシュのキー: ${Object.keys(reservationsCache).join(', ')}`,
      );
    }

    /** @type {ReservationArrayData[]} */
    const allReservations = reservationsCache
      ? /** @type {ReservationArrayData[]} */ (
          reservationsCache['reservations'] || []
        )
      : [];
    Logger.log(`🔍 allReservations件数: ${allReservations.length}`);

    /** @type {HeaderMapType | null} */
    const headerMap = reservationsCache
      ? /** @type {HeaderMapType} */ (reservationsCache['headerMap'])
      : null;

    /** @type {ReservationCore[]} */
    const myReservations = [];

    // 新しいヘルパー関数を使用してデータ変換を統一
    /** @type {RawReservationObject[]} */
    const convertedReservations = convertReservationsToObjects(
      allReservations,
      headerMap,
    );
    Logger.log(`🔍 変換後の予約件数: ${convertedReservations.length}`);

    convertedReservations.forEach(reservation => {
      if (reservation.studentId !== studentId) return;

      // キャンセル以外の予約のみを含める
      if (reservation.status !== CONSTANTS.STATUS.CANCELED) {
        myReservations.push(/** @type {ReservationCore} */ (reservation));
      }
    });

    // 日付でソート（新しい順）
    myReservations.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    Logger.log(`生徒ID ${studentId} の予約を取得: ${myReservations.length} 件`);
    return /** @type {ApiResponse<{ myReservations: ReservationCore[]; }>} */ (
      createApiResponse(true, {
        myReservations: myReservations,
      })
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
