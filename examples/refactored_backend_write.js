/**
 * =================================================================
 * 【リファクタリング例】: 05-2_Backend_Write.js
 * 【変更点】: データアクセス層抽象化の適用
 * =================================================================
 */

/**
 * リファクタリング前のcheckCapacityFull関数
 */
function checkCapacityFull_OLD(classroom, date, startTime, endTime) {
  // 直接キャッシュアクセス - データソースが露出
  const reservationsCache = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);
  if (!reservationsCache || !reservationsCache.reservations) {
    throw new Error('予約データのキャッシュが利用できません。');
  }

  const scheduleCache = getCachedData(CACHE_KEYS.MASTER_SCHEDULE_DATA);
  if (!scheduleCache || !scheduleCache.schedule) {
    throw new Error('日程マスタのキャッシュが利用できません。');
  }

  // 複雑なデータ検索とマッピング処理
  const schedule = scheduleCache.schedule.find(
    s => s.date === date && s.classroom === classroom,
  );

  // フォールバック処理がビジネスロジックに混在
  let capacity = schedule ? schedule.totalCapacity : null;
  if (capacity && typeof capacity === 'string') {
    capacity = parseInt(capacity, 10);
    if (isNaN(capacity)) capacity = null;
  }
  capacity = capacity || CLASSROOM_CAPACITIES[classroom] || 8;

  // ヘッダーマッピング処理が露出
  const reservationsOnDate = getCachedReservationsFor(
    date,
    classroom,
    CONSTANTS.STATUS.CONFIRMED,
  ).filter(
    r =>
      !!r.data[
        getHeaderIndex(
          reservationsCache.headerMap,
          CONSTANTS.HEADERS.RESERVATIONS.STUDENT_ID,
        )
      ],
  );

  // 複雑な時間判定ロジック（100行以上継続...）
  // ...
}

/**
 * リファクタリング後 - データアクセス層抽象化適用
 */
function checkCapacityFull_NEW(classroom, date, startTime, endTime) {
  // ビジネスサービスに委譲 - シンプルで意図が明確
  return reservationService.isCapacityFull(classroom, date, startTime, endTime);
}

/**
 * 予約作成エンドポイント - リファクタリング前
 */
function makeReservation_OLD(reservationData) {
  try {
    // 複雑なバリデーションロジック（省略...）

    // 直接スプレッドシート操作
    const sheet = getSheetByName(CONSTANTS.SHEET_NAMES.RESERVATIONS);
    const rowData = [
      /* データ構築処理 */
    ];
    sheet.appendRow(rowData);

    // キャッシュ無効化
    CacheService.getScriptCache().remove(CACHE_KEYS.ALL_RESERVATIONS);

    // アクティビティログ
    logActivity(/* パラメータ */);

    return { success: true, reservation: reservationData };
  } catch (error) {
    // エラーハンドリング
    return { success: false, error: error.message };
  }
}

/**
 * 予約作成エンドポイント - リファクタリング後
 */
function makeReservation_NEW(reservationData) {
  try {
    // ビジネスロジックは完全にサービス層に委譲
    const result = reservationService.createReservation(reservationData);

    return {
      success: true,
      reservation: result.reservation,
      warnings: result.warnings,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 利用可能スロット取得 - リファクタリング前
 */
function getAvailableSlots_OLD() {
  const reservationsCache = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);
  const scheduleCache = getCachedData(CACHE_KEYS.MASTER_SCHEDULE_DATA);

  // 200行以上の複雑な計算処理...
  // キャッシュデータの直接操作
  // ヘッダーマッピング処理
  // 教室形式別の複雑な分岐処理
  // ...
}

/**
 * 利用可能スロット取得 - リファクタリング後
 */
function getAvailableSlots_NEW(
  classroom = null,
  fromDate = null,
  toDate = null,
) {
  try {
    if (classroom) {
      // 特定教室のスロット
      return availableSlotsService.calculateAvailableSlots(
        classroom,
        fromDate,
        toDate,
      );
    } else {
      // 全教室のスロット
      const allClassrooms = Object.values(CONSTANTS.CLASSROOMS);
      return allClassrooms.flatMap(classroom =>
        availableSlotsService.calculateAvailableSlots(
          classroom,
          fromDate,
          toDate,
        ),
      );
    }
  } catch (error) {
    Logger.log(`スロット計算エラー: ${error.message}`);
    throw error;
  }
}
