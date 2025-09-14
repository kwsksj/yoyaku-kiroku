/**
 * =================================================================
 * 【ファイル名】: types/api-types.d.ts
 * 【役割】: フロントエンド・バックエンド間の型定義とインターフェース
 * =================================================================
 */

/**
 * 予約情報型定義
 */
export interface ReservationInfo {
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
export interface UserInfo {
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
export interface ReservationOptions {
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
export interface ApiResponse<T = any> {
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
export interface LessonSchedule {
  /** 教室名 */
  classroom: string;
  /** 日付 */
  date: string;
  /** 開始時刻 */
  startTime: string;
  /** 終了時刻 */
  endTime: string;
  /** セッション種別 */
  session?: string;
}

/**
 * レッスン状態型定義
 */
export interface LessonStatus {
  /** 満席状態フラグ */
  isFull: boolean;
  /** 現在の予約数 */
  currentReservations: number;
  /** 最大収容人数 */
  maxCapacity: number;
  /** キャンセル待ち数 */
  waitlistCount?: number;
}

/**
 * レッスン情報型定義（統合）
 */
export interface Lesson {
  /** スケジュール情報 */
  schedule: LessonSchedule;
  /** 状態情報 */
  status: LessonStatus;
  /** 教室名 */
  classroom: string;
  /** 日付 */
  date: string;
  /** 会場名 */
  venue: string;
  /** 教室形式 */
  classroomType: string;
  /** 満席フラグ */
  isFull: boolean;
  /** 開始時刻 */
  startTime: string;
  /** 終了時刻 */
  endTime: string;
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
export interface AppInitialData {
  allStudents: { [key: string]: any };
  accountingMaster: any[];
  today: string;
  cacheVersions: { [key: string]: number };
  lessons?: any[];
  classrooms?: string[];
}

/**
 * 登録フォームデータ型定義
 */
export interface RegistrationFormData {
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
export interface AuthenticationResponse {
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
export interface ApiResponseGeneric<T = any> {
  /** 処理成功フラグ */
  success: boolean;
  /** データ（成功時） */
  data?: T;
  /** メッセージ */
  message?: string;
}