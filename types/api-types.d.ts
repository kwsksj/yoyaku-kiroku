/**
 * =================================================================
 * 【ファイル名】: types/api-types.d.ts
 * 【役割】: フロントエンド・バックエンド間の型定義とインターフェース
 * =================================================================
 */

/**
 * 予約情報型定義
 */
declare interface ReservationInfo {
  /** 日付 (YYYY-MM-DD形式) */
  date: string;
  /** 開始時刻 (HH:mm形式) */
  startTime: string;
  /** 終了時刻 (HH:mm形式) */
  endTime: string;
  /** 教室名 */
  classroom: string;
  /** 会場名（予約時点のスナップショット） */
  venue: string;
  /** 教室形式（予約時点のスナップショット） */
  classroomType: string;
  /** ユーザー情報 */
  user: UserInfo;
  /** 予約オプション */
  options: ReservationOptions;
}

/**
 * ユーザー情報型定義
 */
declare interface UserInfo {
  /** 生徒ID */
  studentId: string;
  /** 表示名 */
  displayName: string;
  /** 本名 */
  realName: string;
}

/**
 * 予約オプション型定義
 */
declare interface ReservationOptions {
  /** 彫刻刀レンタル */
  chiselRental: boolean;
  /** 初回講座 */
  firstLecture: boolean;
  /** 制作メモ */
  workInProgress: string;
  /** 材料情報 */
  materialInfo: string;
  /** 注文 */
  order: string;
  /** 先生へのメッセージ */
  messageToTeacher: string;
}

/**
 * APIレスポンス基本型定義
 */
declare interface ApiResponse<T = unknown> {
  /** 処理成功フラグ */
  success: boolean;
  /** レスポンスデータ（成功時） */
  data?: T;
  /** エラーメッセージ（エラー時） */
  message?: string;
}

/**
 * レッスンスケジュール型定義
 */
declare interface LessonSchedule {
  /** 教室名 */
  classroom: string;
  /** 日付 */
  date: string;
  /** 開始時刻 */
  startTime?: string;
  /** 終了時刻 */
  endTime?: string;
  /** セッション種別 */
  session?: string;
  /** 会場名 */
  venue?: string;
  /** 教室形式 */
  classroomType?: string;
  /** 1部開始時刻 */
  firstStart?: string;
  /** 1部終了時刻 */
  firstEnd?: string;
  /** 2部開始時刻 */
  secondStart?: string;
  /** 2部終了時刻 */
  secondEnd?: string;
  /** 初回者開始時刻 */
  beginnerStart?: string;
  /** 全体定員 */
  totalCapacity?: number;
  /** 初回者定員 */
  beginnerCapacity?: number;
}

/**
 * レッスン状態型定義
 */
declare interface LessonStatus {
  /** 満席状態フラグ */
  isFull: boolean;
  /** 現在の予約数 */
  currentReservations?: number;
  /** 最大収容人数 */
  maxCapacity?: number;
  /** キャンセル待ち数 */
  waitlistCount?: number;
  /** 午前枠の空き数（時間制2部制用） */
  morningSlots?: number;
  /** 午後枠の空き数（時間制2部制用） */
  afternoonSlots?: number;
  /** 利用可能枠数（セッション制・全日時間制用） */
  availableSlots?: number;
  /** 初回講座の空き数 */
  firstLectureSlots?: number;
  /** 初回講座満席フラグ */
  firstLectureIsFull?: boolean;
}

/**
 * レッスン情報型定義（統合）
 */
declare interface Lesson {
  /** スケジュール情報 */
  schedule: LessonSchedule;
  /** 状態情報 */
  status: LessonStatus;
  /** 追加メタデータ */
  metadata?: {
    /** 作成日時 */
    createdAt?: Date;
    /** 更新日時 */
    updatedAt?: Date;
    /** 講師情報 */
    instructor?: string;
  };
}

/**
 * アプリ初期データ型定義
 */
declare interface AppInitialData {
  allStudents: { [key: string]: StudentRecord };
  accountingMaster: AccountingMasterItem[];
  today: string;
  cacheVersions: { [key: string]: number };
  lessons?: LessonSchedule[];
  classrooms?: string[];
  allReservationsCache?: {
    reservations: ReservationArrayData[];
    headerMap: HeaderMapType;
    version?: number;
  };
}

/**
 * 登録フォームデータ型定義
 */
declare interface RegistrationFormData {
  registrationData?: {
    phone?: string;
    realName?: string;
    nickname?: string;
    email?: string;
    wantsEmail?: boolean;
    ageGroup?: string;
    gender?: string;
    dominantHand?: string;
    address?: string;
    experience?: string;
    pastWork?: string;
    futureGoal?: string;
    futureParticipation?: string;
    trigger?: string;
    firstMessage?: string;
  };
  loginPhone?: string;
  isFirstTimeBooking?: boolean;
  action?: string;
  classroomName?: string;
  classroom?: string;
  recordsToShow?: number;
  registrationPhone?: string;
  completionMessage?: string;
  materialRowIndex?: string | number;
  itemName?: string;
}

/**
 * ユーザー認証レスポンス型定義
 */
declare interface AuthenticationResponse {
  /** 処理成功フラグ */
  success: boolean;
  /** 認証されたユーザー情報（成功時） */
  user?: {
    studentId: string;
    displayName: string;
    realName: string;
    phone: string;
  };
  /** 初期データ（成功時） */
  initialData?: AppInitialData;
  /** エラーメッセージ（失敗時） */
  message?: string;
  /** 登録用電話番号（失敗時） */
  registrationPhone?: string;
  /** 特殊コマンド認識フラグ（特殊ログイン時） */
  commandRecognized?: string;
}

/**
 * API レスポンス（汎用）
 */
declare interface ApiResponseGeneric<T = unknown> {
  /** 処理成功フラグ */
  success: boolean;
  /** データ（成功時） */
  data?: T;
  /** メッセージ */
  message?: string;
}

/**
 * 新規ユーザー登録データ型定義
 */
declare interface NewUserRegistration {
  phone: string;
  realName: string;
  nickname?: string;
  email?: string;
  wantsEmail?: boolean;
  ageGroup?: string;
  gender?: string;
  dominantHand?: string;
  address?: string;
  experience?: string;
  pastWork?: string;
  futureGoal?: string;
  futureParticipation?: string;
  trigger?: string;
  firstMessage?: string;
}

/**
 * ユーザープロフィール更新データ型定義
 */
declare interface UserProfileUpdate {
  studentId?: string;
  displayName?: string;
  phone?: string;
  realName?: string;
  nickname?: string;
  email?: string;
  wantsEmail?: boolean;
  ageGroup?: string;
  gender?: string;
  dominantHand?: string;
  address?: string;
  experience?: string;
  pastWork?: string;
  futureGoal?: string;
  futureParticipation?: string;
}

/**
 * 予約リクエスト型定義
 */
declare interface ReservationRequest {
  /** 教室名 */
  classroom: string;
  /** 日付 (YYYY-MM-DD形式) */
  date: string;
  /** ユーザー情報 */
  user: UserInfo;
  /** 予約オプション */
  options: ReservationOptions;
  /** 開始時間 (HH:mm形式) */
  startTime?: string;
  /** 終了時間 (HH:mm形式) */
  endTime?: string;
  /** 会場名 */
  venue?: string;
}

/**
 * 予約作成結果型定義
 */
declare interface MakeReservationResult {
  /** 処理結果メッセージ */
  message: string;
}

/**
 * キャンセル情報型定義
 */
declare interface CancelReservationInfo {
  /** 予約ID */
  reservationId: string;
  /** 教室名 */
  classroom: string;
  /** 生徒ID */
  studentId: string;
  /** キャンセルメッセージ */
  cancelMessage?: string;
}

/**
 * 予約詳細更新情報型定義
 */
declare interface ReservationDetailsUpdate {
  /** 予約ID */
  reservationId: string;
  /** 教室名 */
  classroom: string;
  /** 開始時間 */
  startTime?: string;
  /** 終了時間 */
  endTime?: string;
  /** 彫刻刀レンタル */
  chiselRental?: boolean;
  /** 初回講座 */
  firstLecture?: boolean;
  /** 制作メモ */
  workInProgress?: string;
  /** 材料情報 */
  materialInfo?: string;
  /** 注文 */
  order?: string;
  /** 先生へのメッセージ */
  messageToTeacher?: string;
}

/**
 * 会計詳細保存ペイロード型定義
 */
declare interface AccountingDetailsPayload {
  /** 予約ID */
  reservationId: string;
  /** 教室名 */
  classroom: string;
  /** 生徒ID */
  studentId: string;
  /** ユーザー入力情報 */
  userInput: AccountingUserInput;
}

/**
 * 会計ユーザー入力型定義
 */
declare interface AccountingUserInput {
  /** 支払い方法 */
  paymentMethod?: string;
  /** 授業料項目 */
  tuitionItems?: string[];
  /** 時間ベース授業料 */
  timeBased?: {
    startTime: string;
    endTime: string;
    breakMinutes?: number;
    discountMinutes?: number;
  };
  /** 物販・材料費項目 */
  salesItems?: Array<{
    name: string;
    price?: number;
  }>;
}

/**
 * 会計詳細計算結果型定義
 */
declare interface AccountingDetails {
  /** 授業料 */
  tuition: {
    items: Array<{name: string, price: number}>;
    subtotal: number;
  };
  /** 物販・材料費 */
  sales: {
    items: Array<{name: string, price: number}>;
    subtotal: number;
  };
  /** 合計金額 */
  grandTotal: number;
  /** 支払い方法 */
  paymentMethod: string;
}

/**
 * 日程データ型定義（05-3_Backend_AvailableSlots.js用）
 */
declare interface Schedule {
  /** 日付 */
  date: string;
  /** 教室名 */
  classroom: string;
  /** 会場名 */
  venue?: string;
  /** 教室形式 */
  classroomType?: string;
  /** 1部開始時刻 */
  firstStart?: string;
  /** 1部終了時刻 */
  firstEnd?: string;
  /** 2部開始時刻 */
  secondStart?: string;
  /** 2部終了時刻 */
  secondEnd?: string;
  /** 初回者開始時刻 */
  beginnerStart?: string;
  /** 全体定員 */
  totalCapacity?: number;
  /** 初回者定員 */
  beginnerCapacity?: number;
}

/**
 * 予約データ型定義（05-3_Backend_AvailableSlots.js用）
 */
declare interface Reservation {
  /** 生徒ID */
  studentId: string;
  /** 日付 */
  date: string | Date;
  /** 教室名 */
  classroom: string;
  /** 開始時刻 */
  startTime?: string;
  /** 終了時刻 */
  endTime?: string;
  /** 予約状況 */
  status: string;
  /** 初回講座フラグ */
  firstLecture?: boolean;
}
