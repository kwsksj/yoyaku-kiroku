/**
 * =================================================================
 * 【ファイル名】: 02-5_BusinessLogic_ReservationService.js
 * 【バージョン】: 1.0
 * 【役割】: 予約関連のピュアなビジネスロジック
 * - データアクセス層に依存しない純粋なビジネスルール
 * - テスタブルで再利用可能なサービス層
 * =================================================================
 */

/**
 * 予約ビジネスサービス - 予約に関する複雑なビジネスロジックを集約
 */
class ReservationService {
  constructor(reservationRepo, scheduleMasterRepo, userRepo) {
    this.reservationRepo = reservationRepo;
    this.scheduleMasterRepo = scheduleMasterRepo;
    this.userRepo = userRepo;
  }

  /**
   * 指定日・教室の定員チェックを行う
   * @param {string} classroom - 教室名
   * @param {string} date - 日付 (YYYY-MM-DD)
   * @param {string} startTime - 開始時刻 (HH:MM)
   * @param {string} endTime - 終了時刻 (HH:MM)
   * @returns {boolean} 定員満了フラグ
   */
  isCapacityFull(classroom, date, startTime, endTime) {
    // 1. 日程マスタから教室設定を取得
    const schedule = this.scheduleMasterRepo.getByDateAndClassroom(
      date,
      classroom,
    );

    // 2. 定員を取得（フォールバック処理込み）
    const capacity = this.scheduleMasterRepo.getCapacity(date, classroom);

    // 3. 確定予約を取得
    const confirmedReservations = this.reservationRepo
      .getByDateAndClassroom(date, classroom, CONSTANTS.STATUS.CONFIRMED)
      .filter(
        reservation =>
          reservation.studentId && reservation.studentId.trim() !== '',
      );

    // 4. 教室形式による判定ロジック
    if (!schedule || schedule.type !== CONSTANTS.CLASSROOM_TYPES.TIME_DUAL) {
      // セッション制または時間制・終日の場合
      return confirmedReservations.length >= capacity;
    }

    // 5. 時間制・2部制の場合の午前・午後判定
    return this._checkTimeDualCapacity(
      schedule,
      confirmedReservations,
      capacity,
      startTime,
      endTime,
    );
  }

  /**
   * 予約可能性を包括的にチェック
   * @param {Object} reservationRequest - 予約リクエスト
   * @returns {Object} バリデーション結果
   */
  validateReservationRequest(reservationRequest) {
    const { classroom, date, startTime, endTime, studentId } =
      reservationRequest;

    const errors = [];
    const warnings = [];

    // 1. 必須フィールドチェック
    if (!classroom || !date || !studentId) {
      errors.push('教室、日付、学生IDは必須です');
    }

    // 2. ユーザー存在チェック
    const user = this.userRepo.getById(studentId);
    if (!user) {
      errors.push(`学生ID ${studentId} は存在しません`);
    }

    // 3. 重複予約チェック
    const existingReservation = this.reservationRepo
      .getByDateAndClassroom(date, classroom, CONSTANTS.STATUS.CONFIRMED)
      .find(r => r.studentId === studentId);

    if (existingReservation) {
      errors.push('同じ日に同じ教室での予約が既に存在します');
    }

    // 4. 定員チェック
    if (this.isCapacityFull(classroom, date, startTime, endTime)) {
      errors.push('定員に達しているため予約できません');
    }

    // 5. 日程マスタ存在チェック
    const schedule = this.scheduleMasterRepo.getByDateAndClassroom(
      date,
      classroom,
    );
    if (!schedule) {
      warnings.push('日程マスタに該当する日程が見つかりません');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      schedule,
      user,
    };
  }

  /**
   * 予約を作成
   * @param {Object} reservationData - 予約データ
   * @returns {Object} 作成結果
   */
  createReservation(reservationData) {
    // 1. バリデーション実行
    const validation = this.validateReservationRequest(reservationData);

    if (!validation.isValid) {
      throw new Error(`予約作成エラー: ${validation.errors.join(', ')}`);
    }

    // 2. 予約IDを生成
    const reservationId = this._generateReservationId(
      reservationData.date,
      reservationData.classroom,
    );

    // 3. 予約データを拡張
    const fullReservationData = {
      ...reservationData,
      reservationId,
      status: CONSTANTS.STATUS.CONFIRMED,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };

    // 4. データストアに保存
    const createdReservation = this.reservationRepo.create(fullReservationData);

    // 5. アクティビティログに記録
    this._logReservationActivity('予約作成', createdReservation);

    return {
      success: true,
      reservation: createdReservation,
      warnings: validation.warnings,
    };
  }

  /**
   * 予約をキャンセル
   * @param {string} reservationId - 予約ID
   * @param {string} cancelReason - キャンセル理由
   * @returns {Object} キャンセル結果
   */
  cancelReservation(reservationId, cancelReason = '') {
    // 1. 予約の存在確認
    const reservation = this.reservationRepo.getById(reservationId);
    if (!reservation) {
      throw new Error(`予約ID ${reservationId} は存在しません`);
    }

    // 2. キャンセル可能性チェック
    if (reservation.status === CONSTANTS.STATUS.CANCELED) {
      throw new Error('この予約は既にキャンセル済みです');
    }

    if (reservation.status === CONSTANTS.STATUS.COMPLETED) {
      throw new Error('完了済みの予約はキャンセルできません');
    }

    // 3. キャンセル実行
    const success = this.reservationRepo.cancel(reservationId);

    if (success) {
      // 4. キャンセル理由を記録（必要に応じて）
      if (cancelReason) {
        this.reservationRepo.update(reservationId, {
          cancelReason,
          cancelledAt: new Date().toISOString(),
        });
      }

      // 5. アクティビティログに記録
      this._logReservationActivity('予約キャンセル', reservation, {
        cancelReason,
      });
    }

    return {
      success,
      reservation: { ...reservation, status: CONSTANTS.STATUS.CANCELED },
    };
  }

  /**
   * 時間制・2部制の定員チェック
   * @private
   */
  _checkTimeDualCapacity(
    schedule,
    reservations,
    capacity,
    requestStartTime,
    requestEndTime,
  ) {
    const firstEndTime = schedule.firstEnd
      ? new Date(`1900-01-01T${schedule.firstEnd}`)
      : null;
    const secondStartTime = schedule.secondStart
      ? new Date(`1900-01-01T${schedule.secondStart}`)
      : null;

    if (!firstEndTime || !secondStartTime) {
      // 時間設定が不完全な場合は全体定員でチェック
      return reservations.length >= capacity;
    }

    const requestStart = new Date(`1900-01-01T${requestStartTime}`);
    const requestEnd = new Date(`1900-01-01T${requestEndTime}`);

    // 午前部 vs 午後部の判定
    const isRequestMorning = requestEnd <= firstEndTime;
    const isRequestAfternoon = requestStart >= secondStartTime;

    if (!isRequestMorning && !isRequestAfternoon) {
      // 跨ぎ予約は現在の仕様では全体定員でチェック
      return reservations.length >= capacity;
    }

    // 同じ部の予約をカウント
    const sameSlotReservations = reservations.filter(reservation => {
      const resStart = new Date(`1900-01-01T${reservation.startTime}`);
      const resEnd = new Date(`1900-01-01T${reservation.endTime}`);

      const isResMorning = resEnd <= firstEndTime;
      const isResAfternoon = resStart >= secondStartTime;

      return (
        (isRequestMorning && isResMorning) ||
        (isRequestAfternoon && isResAfternoon)
      );
    });

    return sameSlotReservations.length >= capacity;
  }

  /**
   * 予約IDを生成
   * @private
   */
  _generateReservationId(date, classroom) {
    const dateStr = date.replace(/-/g, '');
    const classroomCode = classroom.substring(0, 2);
    const timestamp = Date.now().toString().slice(-6);

    return `${dateStr}${classroomCode}${timestamp}`;
  }

  /**
   * アクティビティログに記録
   * @private
   */
  _logReservationActivity(action, reservation, details = {}) {
    try {
      logActivity(
        Session.getActiveUser().getEmail(),
        action,
        '成功',
        `予約ID: ${reservation.reservationId}, 学生ID: ${reservation.studentId}, 詳細: ${JSON.stringify(details)}`,
      );
    } catch (error) {
      Logger.log(`アクティビティログ記録エラー: ${error.message}`);
    }
  }
}

/**
 * 利用可能スロット計算サービス
 */
class AvailableSlotsService {
  constructor(reservationRepo, scheduleMasterRepo) {
    this.reservationRepo = reservationRepo;
    this.scheduleMasterRepo = scheduleMasterRepo;
  }

  /**
   * 指定教室の利用可能スロットを計算
   * @param {string} classroom - 教室名
   * @param {string} fromDate - 開始日付
   * @param {string} toDate - 終了日付
   * @returns {Array<Object>} 利用可能スロット配列
   */
  calculateAvailableSlots(classroom, fromDate = null, toDate = null) {
    // 1. 対象期間の日程マスタを取得
    const schedules =
      fromDate && toDate
        ? this.scheduleMasterRepo
            .getByDateRange(fromDate, toDate)
            .filter(s => s.classroom === classroom)
        : this.scheduleMasterRepo.getByClassroom(classroom);

    // 2. 各日程のスロット情報を計算
    return schedules.map(schedule => {
      const reservations = this.reservationRepo.getByDateAndClassroom(
        schedule.date,
        schedule.classroom,
        CONSTANTS.STATUS.CONFIRMED,
      );

      const capacity = this.scheduleMasterRepo.getCapacity(
        schedule.date,
        schedule.classroom,
      );

      const availableCount = Math.max(0, capacity - reservations.length);

      return {
        date: schedule.date,
        classroom: schedule.classroom,
        type: schedule.type,
        totalCapacity: capacity,
        reservedCount: reservations.length,
        availableCount,
        isAvailable: availableCount > 0,
        schedule,
      };
    });
  }
}

// サービスインスタンスをグローバル公開
const reservationService = new ReservationService(
  repositories.reservation,
  repositories.scheduleMaster,
  repositories.user,
);

const availableSlotsService = new AvailableSlotsService(
  repositories.reservation,
  repositories.scheduleMaster,
);

// グローバルアクセス用
window.ReservationService = ReservationService;
window.AvailableSlotsService = AvailableSlotsService;
window.reservationService = reservationService;
window.availableSlotsService = availableSlotsService;
