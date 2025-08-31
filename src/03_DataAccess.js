/**
 * =================================================================
 * 【ファイル名】: 03_DataAccess.js
 * 【バージョン】: 1.0
 * 【役割】: データアクセス層の完全抽象化
 * - スプレッドシート、キャッシュ、PropertiesServiceを統一インターフェースで管理
 * - ビジネスロジックからデータソースの詳細を隠蔽
 * - テスト用モック化を容易に
 * =================================================================
 */

/**
 * 予約データリポジトリ - 予約関連データの統一アクセスポイント
 */
class ReservationRepository {
  constructor() {
    this.cacheManager = new CacheDataAccess();
    this.sheetManager = new SheetDataAccess();
  }

  /**
   * 指定日・教室の予約データを取得
   * @param {string} date - 日付 (YYYY-MM-DD)
   * @param {string} classroom - 教室名
   * @param {string} status - ステータス (optional)
   * @returns {Array<Object>} 予約データ配列
   */
  getByDateAndClassroom(date, classroom, status = null) {
    const reservations = this.cacheManager.getReservations();

    return reservations.filter(reservation => {
      const matchDate = reservation.date === date;
      const matchClassroom = reservation.classroom === classroom;
      const matchStatus = status ? reservation.status === status : true;

      return matchDate && matchClassroom && matchStatus;
    });
  }

  /**
   * 予約IDで単一予約を取得
   * @param {string} reservationId - 予約ID
   * @returns {Object|null} 予約データ
   */
  getById(reservationId) {
    const reservations = this.cacheManager.getReservations();
    return reservations.find(r => r.reservationId === reservationId) || null;
  }

  /**
   * 学生IDで予約一覧を取得
   * @param {string} studentId - 学生ID
   * @returns {Array<Object>} 予約データ配列
   */
  getByStudentId(studentId) {
    const reservations = this.cacheManager.getReservations();
    return reservations.filter(r => r.studentId === studentId);
  }

  /**
   * 新規予約を作成
   * @param {Object} reservationData - 予約データ
   * @returns {Object} 作成された予約データ
   */
  create(reservationData) {
    return this.sheetManager.addReservation(reservationData);
  }

  /**
   * 予約を更新
   * @param {string} reservationId - 予約ID
   * @param {Object} updateData - 更新データ
   * @returns {Object} 更新された予約データ
   */
  update(reservationId, updateData) {
    return this.sheetManager.updateReservation(reservationId, updateData);
  }

  /**
   * 予約をキャンセル（ソフト削除）
   * @param {string} reservationId - 予約ID
   * @returns {boolean} 成功フラグ
   */
  cancel(reservationId) {
    return this.update(reservationId, {
      status: CONSTANTS.STATUS.CANCELED,
    });
  }
}

/**
 * 日程マスタリポジトリ - 日程マスタデータの統一アクセスポイント
 */
class ScheduleMasterRepository {
  constructor() {
    this.cacheManager = new CacheDataAccess();
    this.sheetManager = new SheetDataAccess();
  }

  /**
   * 指定日・教室の日程マスタを取得
   * @param {string} date - 日付 (YYYY-MM-DD)
   * @param {string} classroom - 教室名
   * @returns {Object|null} 日程マスタデータ
   */
  getByDateAndClassroom(date, classroom) {
    const schedules = this.cacheManager.getScheduleMaster();

    return (
      schedules.find(
        schedule => schedule.date === date && schedule.classroom === classroom,
      ) || null
    );
  }

  /**
   * 日付範囲で日程マスタを取得
   * @param {string} fromDate - 開始日付
   * @param {string} toDate - 終了日付
   * @returns {Array<Object>} 日程マスタ配列
   */
  getByDateRange(fromDate, toDate) {
    const schedules = this.cacheManager.getScheduleMaster();

    return schedules.filter(
      schedule => schedule.date >= fromDate && schedule.date <= toDate,
    );
  }

  /**
   * 教室別の日程マスタを取得
   * @param {string} classroom - 教室名
   * @returns {Array<Object>} 日程マスタ配列
   */
  getByClassroom(classroom) {
    const schedules = this.cacheManager.getScheduleMaster();
    return schedules.filter(schedule => schedule.classroom === classroom);
  }

  /**
   * 教室の定員を取得（フォールバック処理含む）
   * @param {string} date - 日付
   * @param {string} classroom - 教室名
   * @returns {number} 定員数
   */
  getCapacity(date, classroom) {
    const schedule = this.getByDateAndClassroom(date, classroom);

    // 日程マスタの定員を最優先
    if (schedule && schedule.totalCapacity) {
      const capacity = parseInt(schedule.totalCapacity, 10);
      if (!isNaN(capacity)) return capacity;
    }

    // 教室固定定員をフォールバック
    return CONSTANTS.CLASSROOM_CAPACITIES[classroom] || 8;
  }
}

/**
 * ユーザーリポジトリ - ユーザー関連データの統一アクセスポイント
 */
class UserRepository {
  constructor() {
    this.cacheManager = new CacheDataAccess();
    this.sheetManager = new SheetDataAccess();
  }

  /**
   * 電話番号でユーザーを取得
   * @param {string} phone - 電話番号
   * @returns {Object|null} ユーザーデータ
   */
  getByPhone(phone) {
    const users = this.cacheManager.getStudentRoster();
    return users.find(user => user.phone === phone) || null;
  }

  /**
   * 学生IDでユーザーを取得
   * @param {string} studentId - 学生ID
   * @returns {Object|null} ユーザーデータ
   */
  getById(studentId) {
    const users = this.cacheManager.getStudentRoster();
    return users.find(user => user.studentId === studentId) || null;
  }

  /**
   * ユーザー検索（部分一致）
   * @param {string} searchText - 検索文字列
   * @returns {Array<Object>} マッチしたユーザー配列
   */
  search(searchText) {
    const users = this.cacheManager.getStudentRoster();
    const searchLower = searchText.toLowerCase();

    return users.filter(
      user =>
        user.realName?.toLowerCase().includes(searchLower) ||
        user.displayName?.toLowerCase().includes(searchLower) ||
        user.studentId?.toLowerCase().includes(searchLower),
    );
  }
}

/**
 * キャッシュデータアクセス - キャッシュ層への統一インターフェース
 */
class CacheDataAccess {
  /**
   * 予約データをキャッシュから取得
   * @returns {Array<Object>} 予約データ配列
   */
  getReservations() {
    const cache = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);
    if (!cache || !cache.reservations) {
      throw new Error('予約データのキャッシュが利用できません');
    }

    return this._convertToObjectArray(cache.reservations, cache.headerMap);
  }

  /**
   * 日程マスタをキャッシュから取得
   * @returns {Array<Object>} 日程マスタ配列
   */
  getScheduleMaster() {
    const cache = getCachedData(CACHE_KEYS.MASTER_SCHEDULE_DATA);
    if (!cache || !cache.schedule) {
      throw new Error('日程マスタのキャッシュが利用できません');
    }

    return cache.schedule;
  }

  /**
   * 学生名簿をキャッシュから取得
   * @returns {Array<Object>} 学生データ配列
   */
  getStudentRoster() {
    const cache = getCachedData(CACHE_KEYS.STUDENT_ROSTER_DATA);
    if (!cache || !cache.students) {
      throw new Error('学生名簿のキャッシュが利用できません');
    }

    return this._convertToObjectArray(cache.students, cache.headerMap);
  }

  /**
   * 生データを構造化オブジェクト配列に変換
   * @private
   */
  _convertToObjectArray(dataArray, headerMap) {
    return dataArray.map(row => {
      const obj = {};

      // ヘッダーマップを使用してプロパティを設定
      Object.entries(headerMap).forEach(([header, index]) => {
        let propertyName = header;

        // 日本語ヘッダーを英語プロパティ名に変換
        switch (header) {
          case CONSTANTS.HEADERS.RESERVATIONS.DATE:
            propertyName = 'date';
            break;
          case CONSTANTS.HEADERS.RESERVATIONS.CLASSROOM:
            propertyName = 'classroom';
            break;
          case CONSTANTS.HEADERS.RESERVATIONS.STUDENT_ID:
            propertyName = 'studentId';
            break;
          case CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID:
            propertyName = 'reservationId';
            break;
          case CONSTANTS.HEADERS.RESERVATIONS.STATUS:
            propertyName = 'status';
            break;
        }

        obj[propertyName] = row.data ? row.data[index] : row[index];
      });

      return obj;
    });
  }
}

/**
 * シートデータアクセス - スプレッドシート層への統一インターフェース
 */
class SheetDataAccess {
  constructor() {
    this.ss = getActiveSpreadsheet();
  }

  /**
   * 予約をシートに追加
   * @param {Object} reservationData - 予約データ
   * @returns {Object} 作成された予約データ
   */
  addReservation(reservationData) {
    const sheet = getSheetByName(CONSTANTS.SHEET_NAMES.RESERVATIONS);

    // データ行を構築
    const rowData = this._buildReservationRow(reservationData);

    // シートに追加
    sheet.appendRow(rowData);

    // キャッシュを無効化
    invalidateCache(CACHE_KEYS.ALL_RESERVATIONS);

    return reservationData;
  }

  /**
   * 予約をシートで更新
   * @param {string} reservationId - 予約ID
   * @param {Object} updateData - 更新データ
   * @returns {Object} 更新された予約データ
   */
  updateReservation(reservationId, updateData) {
    const sheet = getSheetByName(CONSTANTS.SHEET_NAMES.RESERVATIONS);

    // 予約IDで行を検索
    const rowIndex = this._findReservationRow(sheet, reservationId);
    if (!rowIndex) {
      throw new Error(`予約ID ${reservationId} が見つかりません`);
    }

    // 更新データを適用
    this._updateReservationRow(sheet, rowIndex, updateData);

    // キャッシュを無効化
    invalidateCache(CACHE_KEYS.ALL_RESERVATIONS);

    return { reservationId, ...updateData };
  }

  /**
   * 予約行をデータから構築
   * @private
   */
  _buildReservationRow(data) {
    const headers = CONSTANTS.HEADERS.RESERVATIONS;
    const row = new Array(headers.length).fill('');

    // 各ヘッダーに対応する値を設定
    if (data.date) row[0] = data.date;
    if (data.classroom) row[1] = data.classroom;
    if (data.studentId) row[2] = data.studentId;
    // ... 他のフィールドも同様に

    return row;
  }

  /**
   * 予約IDで行番号を検索
   * @private
   */
  _findReservationRow(sheet, reservationId) {
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      // ヘッダー行をスキップ
      const reservationIdIndex = 2; // 予約IDの列インデックス
      if (data[i][reservationIdIndex] === reservationId) {
        return i + 1; // 1ベースの行番号
      }
    }

    return null;
  }

  /**
   * 予約行を更新
   * @private
   */
  _updateReservationRow(sheet, rowIndex, updateData) {
    const range = sheet.getRange(
      rowIndex,
      1,
      1,
      CONSTANTS.HEADERS.RESERVATIONS.length,
    );
    const currentData = range.getValues()[0];

    // 更新データを現在のデータにマージ
    Object.entries(updateData).forEach(([key, value]) => {
      let columnIndex;

      switch (key) {
        case 'status':
          columnIndex = 6; // ステータス列のインデックス
          break;
        // ... 他のフィールドも同様に
      }

      if (columnIndex !== undefined) {
        currentData[columnIndex] = value;
      }
    });

    range.setValues([currentData]);
  }
}

// グローバルリポジトリインスタンスを作成
const repositories = {
  reservation: new ReservationRepository(),
  scheduleMaster: new ScheduleMasterRepository(),
  user: new UserRepository(),
};

// 後方互換性のためのグローバル公開
window.ReservationRepository = ReservationRepository;
window.ScheduleMasterRepository = ScheduleMasterRepository;
window.UserRepository = UserRepository;
window.repositories = repositories;
