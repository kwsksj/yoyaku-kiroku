/**
 * =================================================================
 * 【ファイル名】: types/constants.d.ts
 * 【役割】: CONSTANTS オブジェクトの TypeScript 型定義
 * 【目的】: VSCodeでの存在しない定数プロパティの検出
 * =================================================================
 */

// バックエンド（GAS）環境での型定義
declare const CONSTANTS: Constants;
declare const C: Constants;

// Window定義は types/index.d.ts で統合管理されています

// バックエンド（GAS）環境では実際の const 宣言を使用

// 教室名定数
interface ClassroomsConstants {
  readonly TOKYO: string;
  readonly NUMAZU: string;
  readonly TSUKUBA: string;
}

// 教室定員定数
interface ClassroomCapacitiesConstants {
  readonly 東京教室: number;
  readonly 沼津教室: number;
  readonly つくば教室: number;
}

// 項目名定数
interface ItemsConstants {
  readonly MAIN_LECTURE: string;
  readonly FIRST_LECTURE: string;
  readonly CHISEL_RENTAL: string;
  readonly TOOL_SET: string;
  readonly MATERIAL_FEE: string;
  readonly DISCOUNT: string;
}

// ステータス定数
interface StatusConstants {
  readonly CANCELED: string;
  readonly WAITLISTED: string;
  readonly CONFIRMED: string;
  readonly COMPLETED: string;
}

// 項目種別定数
interface ItemTypesConstants {
  readonly TUITION: string;
  readonly SALES: string;
  readonly MATERIAL: string;
}

// 単位定数
interface UnitsConstants {
  readonly THIRTY_MIN: string;
  readonly PIECE: string;
  readonly SET: string;
  readonly CM3: string;
}

// 支払い方法定数
interface PaymentMethodsConstants {
  readonly CASH: string;
  readonly CARD: string;
  readonly TRANSFER: string;
}

// UI定数
interface UIConstants {
  readonly HISTORY_INITIAL_RECORDS: number;
  readonly HISTORY_LOAD_MORE_RECORDS: number;
  readonly LOADING_MESSAGE_INTERVAL: number;
  readonly MODAL_FADE_DURATION: number;
}

// 制限・容量定数
interface LimitsConstants {
  readonly INTRO_LECTURE_CAPACITY: number;
  readonly TSUKUBA_MORNING_SESSION_END_HOUR: number;
  readonly LOCK_WAIT_TIME_MS: number;
  readonly MAX_RETRY_COUNT: number;
}

// シート名定数
interface SheetNamesConstants {
  readonly ROSTER: string;
  readonly ACCOUNTING: string;
  readonly LOG: string;
  readonly RESERVATIONS: string;
  readonly SCHEDULE: string;
}

// セッション定数
interface SessionsConstants {
  readonly MORNING: string;
  readonly AFTERNOON: string;
  readonly ALL_DAY: string;
}

// 支払い方法表示定数
interface PaymentDisplayConstants {
  readonly CASH: string;
  readonly COTRA: string;
  readonly BANK_TRANSFER: string;
}

// 銀行情報定数
interface BankInfoConstants {
  readonly COTRA_PHONE: string;
  readonly NAME: string;
  readonly BRANCH: string;
  readonly ACCOUNT: string;
}

// 割引オプション定数
interface DiscountOptionsConstants {
  readonly NONE: number;
  readonly THIRTY_MIN: number;
  readonly SIXTY_MIN: number;
}

// 時間設定定数
interface TimeSettingsConstants {
  readonly STEP_MINUTES: number;
  readonly END_BUFFER_HOURS: number;
}

// フロントエンドUI定数
interface FrontendUIConstants {
  readonly DISCOUNT_OPTIONS: DiscountOptionsConstants;
  readonly TIME_SETTINGS: TimeSettingsConstants;
}

// メッセージ定数
interface MessagesConstants {
  readonly PROCESSING_INTERRUPTED: string;
  readonly SHEET_INITIALIZATION: string;
  readonly EXISTING_SHEET_WARNING: string;
  readonly SUCCESS: string;
  readonly ERROR: string;
  readonly CANCEL: string;
  readonly SAVE: string;
  readonly EDIT: string;
}

// ログアクション定数
interface LogActionsConstants {
  readonly ROSTER_EDIT: string;
  readonly RESERVATION_EDIT: string;
  readonly ROW_INSERT: string;
  readonly RESERVATION_CANCEL: string;
}

// 表示色定数
interface ColorsConstants {
  readonly LIGHT_GREEN: string;
  readonly LIGHT_RED: string;
  readonly LIGHT_BLUE: string;
  readonly LIGHT_ORANGE: string;
  readonly HEADER_BACKGROUND: string;
}

// 教室タイプ定数
interface ClassroomTypesConstants {
  readonly SESSION_BASED: string;
  readonly TIME_DUAL: string;
  readonly TIME_FULL: string;
}

// スケジュールステータス定数
interface ScheduleStatusConstants {
  readonly SCHEDULED: string;
  readonly CANCELLED: string;
  readonly COMPLETED: string;
}

// 予約シートヘッダー定数
interface ReservationsHeaderConstants {
  readonly RESERVATION_ID: string;
  readonly STUDENT_ID: string;
  readonly DATE: string;
  readonly CLASSROOM: string;
  readonly VENUE: string;
  readonly START_TIME: string;
  readonly END_TIME: string;
  readonly STATUS: string;
  readonly CHISEL_RENTAL: string;
  readonly FIRST_LECTURE: string;
  readonly TRANSPORTATION: string;
  readonly PICKUP: string;
  readonly WORK_IN_PROGRESS: string;
  readonly ORDER: string;
  readonly MESSAGE_TO_TEACHER: string;
  readonly ACCOUNTING_DETAILS: string;
}

// ヘッダー定数（全シート統合）
interface HeadersConstants {
  readonly RESERVATIONS: ReservationsHeaderConstants;
  // 他のシートのヘッダーも必要に応じて追加可能
}

// プロジェクト全体で使用する統一定数オブジェクト
interface Constants {
  readonly CLASSROOMS: ClassroomsConstants;
  readonly TIMEZONE: string;
  readonly CLASSROOM_CAPACITIES: ClassroomCapacitiesConstants;
  readonly ITEMS: ItemsConstants;
  readonly STATUS: StatusConstants;
  readonly ITEM_TYPES: ItemTypesConstants;
  readonly UNITS: UnitsConstants;
  readonly PAYMENT_METHODS: PaymentMethodsConstants;
  readonly UI: UIConstants;
  readonly LIMITS: LimitsConstants;
  readonly SHEET_NAMES: SheetNamesConstants;
  readonly SESSIONS: SessionsConstants;
  readonly PAYMENT_DISPLAY: PaymentDisplayConstants;
  readonly BANK_INFO: BankInfoConstants;
  readonly FRONTEND_UI: FrontendUIConstants;
  readonly MESSAGES: MessagesConstants;
  readonly LOG_ACTIONS: LogActionsConstants;
  readonly COLORS: ColorsConstants;
  readonly CLASSROOM_TYPES: ClassroomTypesConstants;
  readonly SCHEDULE_STATUS: ScheduleStatusConstants;
  readonly HEADERS: HeadersConstants;
}

export {};