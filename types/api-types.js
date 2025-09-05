/**
 * =================================================================
 * 【ファイル名】: types/api-types.js
 * 【役割】: フロントエンド・バックエンド間の型定義とインターフェース
 * =================================================================
 */

/**
 * @typedef {Object} ReservationInfo
 * @property {string} classroom - 教室名
 * @property {string} date - 日付 (YYYY-MM-DD形式)
 * @property {string} startTime - 開始時刻 (HH:mm形式)
 * @property {string} endTime - 終了時刻 (HH:mm形式)
 * @property {UserInfo} user - ユーザー情報
 * @property {ReservationOptions} options - 予約オプション
 */

/**
 * @typedef {Object} UserInfo
 * @property {string} studentId - 生徒ID
 * @property {string} displayName - 表示名
 * @property {string} realName - 本名
 */

/**
 * @typedef {Object} ReservationOptions
 * @property {boolean} chiselRental - 彫刻刀レンタル
 * @property {boolean} firstLecture - 初回講座
 * @property {string} workInProgress - 制作メモ
 * @property {string} materialInfo - 材料情報
 * @property {string} order - 注文
 * @property {string} messageToTeacher - 先生へのメッセージ
 */

/**
 * @typedef {Object} AvailableSlot
 * @property {string} classroom - 教室名
 * @property {string} date - 日付
 * @property {string} venue - 会場
 * @property {string} classroomType - 教室形式
 * @property {string} firstStart - 1部開始時刻
 * @property {string} firstEnd - 1部終了時刻
 * @property {string} secondStart - 2部開始時刻
 * @property {string} secondEnd - 2部終了時刻
 * @property {string} beginnerStart - 初回者開始時刻
 * @property {number} totalCapacity - 全体定員
 * @property {number} beginnerCapacity - 初回者定員
 * @property {number} availableSlots - 利用可能枠数
 * @property {number} firstLectureSlots - 初回講座枠数
 * @property {boolean} isFull - 満席かどうか
 * @property {boolean} firstLectureIsFull - 初回講座満席かどうか
 */

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success - 処理成功フラグ
 * @property {*} data - レスポンスデータ
 * @property {string} [message] - エラーメッセージ（エラー時）
 */

/**
 * フロントエンド・バックエンド共通のプロパティ名定数
 * これらの定数を使用することで、プロパティ名の不整合を防ぐ
 */
const API_PROPERTY_NAMES = {
  // ReservationInfo
  CLASSROOM: 'classroom',
  DATE: 'date',
  START_TIME: 'startTime',
  END_TIME: 'endTime',
  USER: 'user',
  OPTIONS: 'options',

  // UserInfo
  STUDENT_ID: 'studentId',
  DISPLAY_NAME: 'displayName',
  REAL_NAME: 'realName',

  // ReservationOptions
  CHISEL_RENTAL: 'chiselRental',
  FIRST_LECTURE: 'firstLecture',
  WORK_IN_PROGRESS: 'workInProgress',
  MATERIAL_INFO: 'materialInfo',
  ORDER: 'order',
  MESSAGE_TO_TEACHER: 'messageToTeacher',

  // AvailableSlot
  VENUE: 'venue',
  CLASSROOM_TYPE: 'classroomType',
  FIRST_START: 'firstStart',
  FIRST_END: 'firstEnd',
  SECOND_START: 'secondStart',
  SECOND_END: 'secondEnd',
  BEGINNER_START: 'beginnerStart',
  TOTAL_CAPACITY: 'totalCapacity',
  BEGINNER_CAPACITY: 'beginnerCapacity',
  AVAILABLE_SLOTS: 'availableSlots',
  FIRST_LECTURE_SLOTS: 'firstLectureSlots',
  IS_FULL: 'isFull',
  FIRST_LECTURE_IS_FULL: 'firstLectureIsFull',

  // ApiResponse
  SUCCESS: 'success',
  DATA: 'data',
  MESSAGE: 'message',
};

/**
 * プロパティアクセスヘルパー関数
 */
const PropertyAccessor = {
  // 安全なプロパティアクセス
  get: (obj, propName) => {
    if (!obj || typeof obj !== 'object') return undefined;
    return obj[API_PROPERTY_NAMES[propName]] || obj[propName];
  },

  // オブジェクト作成時の統一
  create: (data = {}) => {
    const result = {};
    Object.keys(data).forEach(key => {
      const standardKey = API_PROPERTY_NAMES[key.toUpperCase()] || key;
      result[standardKey] = data[key];
    });
    return result;
  },

  // 検証用
  validateSchema: (obj, requiredProps = []) => {
    const missing = requiredProps.filter(
      prop =>
        !obj.hasOwnProperty(API_PROPERTY_NAMES[prop]) &&
        !obj.hasOwnProperty(prop),
    );
    return { isValid: missing.length === 0, missing };
  },
};

// フロントエンドでも使用できるようにグローバルに定義
if (typeof globalThis !== 'undefined') {
  globalThis.API_PROPERTY_NAMES = API_PROPERTY_NAMES;
  globalThis.PropertyAccessor = PropertyAccessor;
}
