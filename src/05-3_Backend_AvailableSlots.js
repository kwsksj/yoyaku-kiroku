/**
 * =================================================================
 * 【ファイル名】: 05-3_Backend_AvailableSlots.js
 * 【バージョン】: 1.0
 * 【役割】: キャッシュベース + 日程マスタを使用した予約枠計算機能
 * 【構成】: 14ファイル構成への追加ファイル
 * 【新機能】:
 * - サマリーシートを経由せず、キャッシュデータから直接計算
 * - 日程マスタとの統合で予約のない開催予定日も表示
 * - 日程マスタの教室形式と時間設定を使用した統一的な処理
 * - 予約枠計算の統一エンドポイント（旧getAvailableSlotsFromSummaryを置き換え）
 * =================================================================
 */

/**
 * 利用可能な予約枠を計算して返す
 * @returns {object} - { success: boolean, data: object[], message?: string }
 */
function getAvailableSlots() {
  try {
    Logger.log('=== getAvailableSlots 開始 ===');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const timezone = getSpreadsheetTimezone();
    const todayString = Utilities.formatDate(today, timezone, 'yyyy-MM-dd');
    Logger.log(`基準日: ${todayString}, タイムゾーン: ${timezone}`);

    // 1. 日程マスタから今日以降の開催予定を取得（最初に1回だけ読み込み）
    const scheduledDates = getAllScheduledDates(todayString);
    Logger.log(`日程マスタから取得した開催予定: ${scheduledDates.length} 件`);
    if (scheduledDates.length === 0) {
      Logger.log('警告: 開催予定が0件です');
    }

    // 2. キャッシュから全予約データを取得
    const reservationsCache = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);
    const allReservations = reservationsCache ? reservationsCache.reservations || [] : [];
    const headerMap = reservationsCache ? reservationsCache.headerMap : null;
    Logger.log(`全予約キャッシュから取得した予約データ: ${allReservations.length} 件`);

    if (allReservations.length === 0) {
      Logger.log(
        '警告: 全予約データが0件です - キャッシュまたはデータに問題がある可能性があります',
      );
    } else {
      Logger.log(`全予約データサンプル: ${JSON.stringify(allReservations[0])}`);
    }

    // 3. 配列形式の予約データをオブジェクト形式に変換
    const convertedReservations = allReservations
      .map(reservation => {
        // ヘッダーマップを使用した変換関数を使用
        if (Array.isArray(reservation)) {
          return transformReservationArrayToObjectWithHeaders(reservation, headerMap);
        }
        // 既にオブジェクト形式の場合はそのまま返す
        return reservation;
      })
      .filter(reservation => reservation !== null); // nullの場合は除外

    Logger.log(`全予約データ変換完了: ${convertedReservations.length} 件`);
    if (convertedReservations.length > 0) {
      Logger.log(`変換後サンプル: ${JSON.stringify(convertedReservations[0])}`);
    }

    // 4. 有効な予約のみを事前にフィルタリング＆日付文字列でマップ化
    const reservationsByDateClassroom = new Map();

    const validReservations = convertedReservations.filter(reservation => {
      const reservationDate = new Date(reservation.date);
      return (
        reservationDate >= today &&
        reservation.status !== STATUS_CANCEL &&
        reservation.status !== STATUS_WAITING
      );
    });

    Logger.log(
      `有効な予約データ（今日以降、キャンセル・キャンセル待ち除外）: ${validReservations.length} 件`,
    );
    if (validReservations.length === 0) {
      Logger.log('警告: 有効な予約データが0件です');
    }

    validReservations.forEach(reservation => {
      const reservationDate = new Date(reservation.date);
      const dateString = Utilities.formatDate(reservationDate, timezone, 'yyyy-MM-dd');
      const key = `${dateString}|${reservation.classroom}`;

      if (!reservationsByDateClassroom.has(key)) {
        reservationsByDateClassroom.set(key, []);
      }
      reservationsByDateClassroom.get(key).push(reservation);
    });

    // 5. 日程マスタをベースにして各日程の予約枠を計算
    const availableSlots = [];

    scheduledDates.forEach(schedule => {
      const key = `${schedule.date}|${schedule.classroom}`;
      const reservationsForDate = reservationsByDateClassroom.get(key) || [];

      Logger.log(
        `計算開始: ${schedule.date} ${schedule.classroom} - 予約数: ${reservationsForDate.length}件`,
      );

      // 時間解析結果をキャッシュ
      const timeCache = {
        firstEndTime: schedule.firstEnd ? new Date(`1970-01-01T${schedule.firstEnd}`) : null,
        secondStartTime: schedule.secondStart
          ? new Date(`1970-01-01T${schedule.secondStart}`)
          : null,
        beginnerStartTime: schedule.beginnerStart
          ? new Date(`1970-01-01T${schedule.beginnerStart}`)
          : null,
      };

      // セッション別予約数をカウント
      const sessionCounts = new Map();

      reservationsForDate.forEach(reservation => {
        // 教室形式別のセッション集計ロジック
        if (schedule.classroomType === CLASSROOM_TYPE_TIME_DUAL) {
          // ${CONSTANTS.CLASSROOMS.TSUKUBA}: 2部制時間制
          const startTime = reservation.startTime
            ? new Date(`1970-01-01T${reservation.startTime}`)
            : null;
          const endTime = reservation.endTime
            ? new Date(`1970-01-01T${reservation.endTime}`)
            : null;

          if (startTime && endTime && timeCache.firstEndTime && timeCache.secondStartTime) {
            // 1部（午前）：開始時刻が1部終了時刻以前
            if (startTime <= timeCache.firstEndTime) {
              sessionCounts.set(SESSION_MORNING, (sessionCounts.get(SESSION_MORNING) || 0) + 1);
            }

            // 2部（午後）：終了時刻が2部開始時刻以降
            if (endTime >= timeCache.secondStartTime) {
              sessionCounts.set(SESSION_AFTERNOON, (sessionCounts.get(SESSION_AFTERNOON) || 0) + 1);
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
          sessionCounts.set(SESSION_ALL_DAY, (sessionCounts.get(SESSION_ALL_DAY) || 0) + 1);
        }

        // 初回講習は独立して判定
        if (reservation.firstLecture && timeCache.beginnerStartTime) {
          const startTime = reservation.startTime
            ? new Date(`1970-01-01T${reservation.startTime}`)
            : null;
          const endTime = reservation.endTime
            ? new Date(`1970-01-01T${reservation.endTime}`)
            : null;

          // 予約時間が初心者開始時刻と重複するかチェック
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
      });

      // 6. この日程の予約枠データを生成
      const totalCapacity = schedule.totalCapacity || CLASSROOM_CAPACITIES[schedule.classroom] || 8;
      const beginnerCapacity = schedule.beginnerCapacity || INTRO_LECTURE_CAPACITY;

      if (schedule.classroomType === CLASSROOM_TYPE_TIME_DUAL) {
        // ${CONSTANTS.CLASSROOMS.TSUKUBA}: 午前・午後セッション
        const morningCount = sessionCounts.get(SESSION_MORNING) || 0;
        const afternoonCount = sessionCounts.get(SESSION_AFTERNOON) || 0;
        const introCount = sessionCounts.get(ITEM_NAME_FIRST_LECTURE) || 0;

        const morningSlots = Math.max(0, totalCapacity - morningCount);
        const afternoonSlots = Math.max(0, totalCapacity - afternoonCount);
        const introSpecific = Math.max(0, beginnerCapacity - introCount);
        const introFinalAvailable = Math.min(afternoonSlots, introSpecific);

        availableSlots.push({
          classroom: schedule.classroom,
          date: schedule.date,
          venue: schedule.venue,
          firstStart: schedule.firstStart,
          firstEnd: schedule.firstEnd,
          secondStart: schedule.secondStart,
          secondEnd: schedule.secondEnd,
          beginnerStart: schedule.beginnerStart,
          totalCapacity: totalCapacity,
          beginnerCapacity: beginnerCapacity,
          morningSlots: morningSlots,
          afternoonSlots: afternoonSlots,
          firstLectureSlots: introFinalAvailable,
          isFull: morningSlots <= 0 && afternoonSlots <= 0,
        });
      } else if (schedule.classroomType === CLASSROOM_TYPE_SESSION_BASED) {
        // 東京教室: 本講座と初回講習
        const mainCount = sessionCounts.get(ITEM_NAME_MAIN_LECTURE) || 0;
        const introCount = sessionCounts.get(ITEM_NAME_FIRST_LECTURE) || 0;

        const mainAvailable = Math.max(0, totalCapacity - mainCount);
        const introSpecific = Math.max(0, beginnerCapacity - introCount);
        const introFinalAvailable = Math.min(mainAvailable, introSpecific);

        availableSlots.push({
          classroom: schedule.classroom,
          date: schedule.date,
          venue: schedule.venue,
          firstStart: schedule.firstStart,
          firstEnd: schedule.firstEnd,
          beginnerStart: schedule.beginnerStart,
          totalCapacity: totalCapacity,
          beginnerCapacity: beginnerCapacity,
          availableSlots: mainAvailable,
          firstLectureSlots: introFinalAvailable,
          isFull: mainAvailable <= 0,
        });
      } else {
        // 沼津教室など: 全日時間制
        const allDayCount = sessionCounts.get(SESSION_ALL_DAY) || 0;
        const introCount = sessionCounts.get(ITEM_NAME_FIRST_LECTURE) || 0;

        const available = Math.max(0, totalCapacity - allDayCount);
        const introSpecific = Math.max(0, beginnerCapacity - introCount);
        const introFinalAvailable = Math.min(available, introSpecific);

        availableSlots.push({
          classroom: schedule.classroom,
          date: schedule.date,
          venue: schedule.venue,
          firstStart: schedule.firstStart,
          firstEnd: schedule.firstEnd,
          beginnerStart: schedule.beginnerStart,
          totalCapacity: totalCapacity,
          beginnerCapacity: beginnerCapacity,
          availableSlots: available,
          firstLectureSlots: introFinalAvailable,
          isFull: available <= 0,
        });
      }
    });

    // 7. 日付・教室順でソート
    availableSlots.sort((a, b) => {
      const dateComp = new Date(a.date) - new Date(b.date);
      if (dateComp !== 0) return dateComp;
      return a.classroom.localeCompare(b.classroom);
    });

    Logger.log(`利用可能な予約枠を ${availableSlots.length} 件計算しました`);
    Logger.log('=== getAvailableSlots 正常終了 ===');
    return createApiResponse(true, availableSlots);
  } catch (error) {
    Logger.log('=== getAvailableSlots エラー ===');
    Logger.log(`エラーメッセージ: ${error.message}`);
    Logger.log(`スタックトレース: ${error.stack}`);
    return BackendErrorHandler.handle(error, 'getAvailableSlots', { data: [] });
  }
}

/**
 * 特定の教室の利用可能枠のみを取得する
 * @param {string} classroom - 教室名
 * @returns {object} - { success: boolean, data: object[], message?: string }
 */
function getAvailableSlotsForClassroom(classroom) {
  const result = getAvailableSlots();
  if (!result.success) {
    return createApiResponse(false, { message: result.message, data: [] });
  }
  return createApiResponse(
    true,
    result.data.filter(slot => slot.classroom === classroom),
  );
}

/**
 * 特定の生徒の予約データを取得する
 * @param {string} studentId - 生徒ID
 * @returns {object} - { success: boolean, data: { myBookings: object[], myHistory: object[] }, message?: string }
 */
function getUserReservations(studentId) {
  try {
    const reservationsCache = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);
    const allReservations = reservationsCache ? reservationsCache.reservations || [] : [];
    const headerMap = reservationsCache ? reservationsCache.headerMap : null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const myBookings = [];
    const myHistory = [];

    // 配列形式のデータをオブジェクト形式に変換（ヘッダーマップを使用）
    const convertedReservations = allReservations
      .map(reservation => {
        if (Array.isArray(reservation)) {
          return transformReservationArrayToObjectWithHeaders(reservation, headerMap);
        }
        return reservation;
      })
      .filter(reservation => reservation !== null); // nullの場合は除外

    convertedReservations.forEach(reservation => {
      if (reservation.studentId !== studentId) return;

      const reservationDate = new Date(reservation.date);
      const isCancelled =
        reservation.status === STATUS_CANCEL ||
        reservation.status === 'キャンセル' ||
        reservation.status === 'キャンセル済み';

      if (!isCancelled) {
        if (reservationDate >= today) {
          myBookings.push(reservation);
        } else {
          myHistory.push(reservation);
        }
      }
    });

    // ソート
    myBookings.sort((a, b) => new Date(a.date) - new Date(b.date));
    myHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

    Logger.log(
      `生徒ID ${studentId} の予約を取得: 今後の予約 ${myBookings.length} 件、履歴 ${myHistory.length} 件`,
    );
    return createApiResponse(true, {
      myBookings: myBookings,
      myHistory: myHistory,
    });
  } catch (error) {
    Logger.log(`getUserReservations エラー: ${error.message}`);
    return BackendErrorHandler.handle(error, 'getUserReservations', {
      data: { myBookings: [], myHistory: [] },
    });
  }
}
