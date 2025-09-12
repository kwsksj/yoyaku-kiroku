/**
 * =================================================================
 * 【ファイル名】: 05-3_Backend_AvailableSlots.js
 * 【バージョン】: 1.3
 * 【役割】: キャッシュベース + 日程マスタを使用した予約枠計算機能
 * 【v1.3での変更点】:
 * - 不要なソート処理を削除（キャッシュ構築時にソート済みの前提）
 * =================================================================
 */

/**
 * 開催予定の講座情報（空き枠情報を含む）を計算して返す
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

    const scheduledDates = getAllScheduledDates(todayString, null);
    Logger.log(
      `=== scheduledDates取得完了: ${scheduledDates ? scheduledDates.length : 0} 件 ===`,
    );

    const reservationsCache = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);
    const allReservations = reservationsCache
      ? reservationsCache.reservations || []
      : [];
    const headerMap = reservationsCache ? reservationsCache.headerMap : null;
    Logger.log(
      `=== 予約キャッシュ取得: 予約数=${allReservations.length}件, ヘッダーマップ=${!!headerMap} ===`,
    );

    // 新しいヘルパー関数を使用してデータ変換を統一
    const convertedReservations = convertReservationsToObjects(
      allReservations,
      headerMap,
    );
    Logger.log(`=== 予約データ変換完了: ${convertedReservations.length}件 ===`);

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
      reservationsByDateClassroom.get(key).push(reservation);
    });

    const lessons = [];

    scheduledDates.forEach(schedule => {
      const key = `${schedule.date}|${schedule.classroom}`;
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
        /** @param {any} reservation */ reservation => {
          // 教室形式別のセッション集計ロジック
          if (schedule.classroomType === CLASSROOM_TYPE_TIME_DUAL) {
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
                  SESSION_MORNING,
                  (sessionCounts.get(SESSION_MORNING) || 0) + 1,
                );
              }

              // 2部（午後）：終了時刻が2部開始時刻以降
              if (endTime >= timeCache.secondStartTime) {
                sessionCounts.set(
                  SESSION_AFTERNOON,
                  (sessionCounts.get(SESSION_AFTERNOON) || 0) + 1,
                );
              }
            }
          } else if (schedule.classroomType === CLASSROOM_TYPE_SESSION_BASED) {
            // ${CONSTANTS.CLASSROOMS.TOKYO}: セッション制
            sessionCounts.set(
              ITEM_NAME_MAIN_LECTURE,
              (sessionCounts.get(ITEM_NAME_MAIN_LECTURE) || 0) + 1,
            );
          } else {
            // ${CONSTANTS.CLASSROOMS.NUMAZU}など: 全日時間制
            sessionCounts.set(
              SESSION_ALL_DAY,
              (sessionCounts.get(SESSION_ALL_DAY) || 0) + 1,
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
                ITEM_NAME_FIRST_LECTURE,
                (sessionCounts.get(ITEM_NAME_FIRST_LECTURE) || 0) + 1,
              );
            }
          }
        },
      );

      // 6. この日程の予約枠データを生成
      // 日程マスタの定員値を数値として取得（文字列の場合は変換）
      let totalCapacity = schedule.totalCapacity;
      let totalCapacitySource = '日程マスタ';
      if (totalCapacity && typeof totalCapacity === 'string') {
        totalCapacity = parseInt(totalCapacity, 10);
        if (isNaN(totalCapacity)) totalCapacity = null;
      }

      // 定員のフォールバック処理（明示的な優先順位）
      if (!totalCapacity) {
        totalCapacity = CLASSROOM_CAPACITIES[schedule.classroom];
        totalCapacitySource = 'クラス固定定員';
        if (!totalCapacity) {
          totalCapacity = 8;
          totalCapacitySource = 'システムデフォルト';
        }
      }

      let beginnerCapacity = schedule.beginnerCapacity;
      let beginnerCapacitySource = '日程マスタ';
      if (beginnerCapacity && typeof beginnerCapacity === 'string') {
        beginnerCapacity = parseInt(beginnerCapacity, 10);
        if (isNaN(beginnerCapacity)) beginnerCapacity = null;
      }

      if (beginnerCapacity == null) {
        beginnerCapacity = INTRO_LECTURE_CAPACITY;
        beginnerCapacitySource = 'システムデフォルト';
      }

      Logger.log(
        `定員設定 - ${schedule.date} ${schedule.classroom}: 全体定員=${totalCapacity}(${totalCapacitySource}), 初回者定員=${beginnerCapacity}(${beginnerCapacitySource})`,
      );

      if (schedule.classroomType === CLASSROOM_TYPE_TIME_DUAL) {
        // ${CONSTANTS.CLASSROOMS.TSUKUBA}: 午前・午後セッション
        const morningCount = sessionCounts.get(SESSION_MORNING) || 0;
        const afternoonCount = sessionCounts.get(SESSION_AFTERNOON) || 0;
        const introCount = sessionCounts.get(ITEM_NAME_FIRST_LECTURE) || 0;

        const morningSlots = Math.max(0, totalCapacity - morningCount);
        const afternoonSlots = Math.max(0, totalCapacity - afternoonCount);
        const introSpecific = Math.max(0, beginnerCapacity - introCount);
        const introFinalAvailable = Math.min(afternoonSlots, introSpecific);

        const firstLectureIsFull =
          beginnerCapacity > 0 && introFinalAvailable === 0;

        lessons.push({
          schedule: {
            classroom: schedule.classroom,
            date: schedule.date,
            venue: schedule.venue,
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
            secondStart:
              schedule.secondStart instanceof Date
                ? Utilities.formatDate(
                    schedule.secondStart,
                    CONSTANTS.TIMEZONE,
                    'HH:mm',
                  )
                : schedule.secondStart,
            secondEnd:
              schedule.secondEnd instanceof Date
                ? Utilities.formatDate(
                    schedule.secondEnd,
                    CONSTANTS.TIMEZONE,
                    'HH:mm',
                  )
                : schedule.secondEnd,
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
            morningSlots: morningSlots,
            afternoonSlots: afternoonSlots,
            firstLectureSlots: introFinalAvailable,
            isFull: morningSlots <= 0 && afternoonSlots <= 0,
            firstLectureIsFull: firstLectureIsFull,
          },
        });
      } else if (schedule.classroomType === CLASSROOM_TYPE_SESSION_BASED) {
        // 東京教室: 本講座と初回者
        const mainCount = sessionCounts.get(ITEM_NAME_MAIN_LECTURE) || 0;
        const introCount = sessionCounts.get(ITEM_NAME_FIRST_LECTURE) || 0;

        const mainAvailable = Math.max(0, totalCapacity - mainCount);
        const introSpecific = Math.max(0, beginnerCapacity - introCount);
        const introFinalAvailable = Math.min(mainAvailable, introSpecific);

        const firstLectureIsFull =
          beginnerCapacity > 0 && introFinalAvailable === 0;

        lessons.push({
          schedule: {
            classroom: schedule.classroom,
            date: schedule.date,
            venue: schedule.venue,
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
        const allDayCount = sessionCounts.get(SESSION_ALL_DAY) || 0;
        const introCount = sessionCounts.get(ITEM_NAME_FIRST_LECTURE) || 0;

        const available = Math.max(0, totalCapacity - allDayCount);
        const introSpecific = Math.max(0, beginnerCapacity - introCount);
        const introFinalAvailable = Math.min(available, introSpecific);

        const firstLectureIsFull =
          beginnerCapacity > 0 && introFinalAvailable === 0;

        lessons.push({
          schedule: {
            classroom: schedule.classroom,
            date: schedule.date,
            venue: schedule.venue,
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
      const dateComp =
        new Date(a.schedule.date).getTime() -
        new Date(b.schedule.date).getTime();
      if (dateComp !== 0) return dateComp;
      return a.schedule.classroom.localeCompare(b.schedule.classroom);
    });

    Logger.log(
      `=== 開催予定の講座情報を ${filteredLessons.length} 件計算しました（フィルター後） ===`,
    );
    Logger.log(
      `=== lessons サンプル: ${JSON.stringify(filteredLessons.slice(0, 2))} ===`,
    );
    Logger.log('=== getLessons 正常終了 ===');
    return createApiResponse(true, filteredLessons);
  } catch (error) {
    Logger.log(`getLessons エラー: ${error.message}\n${error.stack}`);
    return BackendErrorHandler.handle(error, 'getLessons', { data: [] });
  }
}

/**
 * 特定の教室の講座情報のみを取得する
 * @param {string} classroom - 教室名
 * @returns {object} - { success: boolean, data: object[], message?: string }
 */
function getLessonsForClassroom(classroom) {
  const result = getLessons();
  if (!result.success) {
    return createApiResponse(false, { message: result.message, data: [] });
  }
  return createApiResponse(
    true,
    result.data.filter(lesson => lesson.schedule.classroom === classroom),
  );
}

/**
 * 特定の生徒の予約データを取得する
 * @param {string} studentId - 生徒ID
 * @returns {object} - { success: boolean, data: { myReservations: object[] }, message?: string }
 */
function getUserReservations(studentId) {
  try {
    const reservationsCache = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);
    const allReservations = reservationsCache
      ? reservationsCache.reservations || []
      : [];
    const headerMap = reservationsCache ? reservationsCache.headerMap : null;

    const myReservations = [];

    // 新しいヘルパー関数を使用してデータ変換を統一
    const convertedReservations = convertReservationsToObjects(
      allReservations,
      headerMap,
    );

    convertedReservations.forEach(reservation => {
      if (reservation.studentId !== studentId) return;

      // キャンセル以外の予約のみを含める
      if (reservation.status !== CONSTANTS.STATUS.CANCELED) {
        myReservations.push(reservation);
      }
    });

    // 日付でソート（新しい順）
    myReservations.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    Logger.log(`生徒ID ${studentId} の予約を取得: ${myReservations.length} 件`);
    return createApiResponse(true, {
      myReservations: myReservations,
    });
  } catch (error) {
    Logger.log(`getUserReservations エラー: ${error.message}`);
    return BackendErrorHandler.handle(error, 'getUserReservations', {
      data: { myReservations: [] },
    });
  }
}
