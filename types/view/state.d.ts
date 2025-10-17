/**
 * =================================================================
 * 【ファイル名】: types/view/state.d.ts
 * 【役割】: UI状態管理型定義（UIState, StateManager）
 * 【バージョン】: 1.0
 * =================================================================
 */

import type { LessonCore, ScheduleInfo } from '../core/lesson';
import type { ReservationCore } from '../core/reservation';
import type {
  AccountingDetailsCore,
  AccountingMasterItemCore,
} from '../core/accounting';
import type { UserCore } from '../core/user';

// =================================================================
// View Type定義
// =================================================================

/**
 * ビュー型定義
 */
export type ViewType =
  | 'login'
  | 'dashboard'
  | 'bookingLessons'
  | 'newReservation'
  | 'editReservation'
  | 'reservationForm' // 予約フォーム画面
  | 'accounting'
  | 'registration'
  | 'myReservations'
  | 'register'
  | 'registrationStep2'
  | 'registrationStep3'
  | 'registrationStep4'
  | 'editProfile'
  | 'complete'
  | 'userSearch';

/**
 * 統一検索結果型
 */
export interface ReservationSearchResult extends ReservationCore {
  type: 'booking' | 'record';
}

// =================================================================
// ナビゲーション関連型
// =================================================================

/**
 * ナビゲーション履歴エントリ
 */
export interface StateNavigationHistoryEntry {
  view: ViewType;
  context: NavigationContext;
}

/**
 * ナビゲーションコンテキスト
 */
export interface NavigationContext {
  selectedClassroom?: string | null;
  selectedLesson?: LessonCore;
  editingReservationDetails?: ReservationCore;
  accountingReservation?: ReservationCore;
  [key: string]: any;
}

// =================================================================
// フォームデータ型
// =================================================================

/**
 * 登録フォームデータ型
 */
export interface RegistrationFormData {
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
  futureCreations?: string;
  futureParticipation?: string;
  trigger?: string;
  firstMessage?: string;
  [key: string]: any;
}

/**
 * 予約フォーム専用コンテキスト
 */
export interface ReservationFormContext {
  lessonInfo: LessonCore;
  reservationInfo: Partial<ReservationCore>; // 新規の場合は初期値、編集の場合は既存データ
}

/**
 * 会計フォームデータ型（フロントエンド専用）
 */
export interface AccountingFormDto {
  /** 開始時刻 */
  startTime?: string;
  /** 終了時刻 */
  endTime?: string;
  /** 休憩時間（分） */
  breakTime?: number;
  /** チェック済み項目（授業料・物販） */
  checkedItems?: Record<string, boolean>;
  /** 材料データ */
  materials?: Array<{
    type: string;
    l?: number;
    w?: number;
    h?: number;
  }>;
  /** 物販データ */
  selectedProducts?: Array<{
    name: string;
    price: number;
  }>;
  /** 自由入力物販データ */
  customSales?: Array<{
    name: string;
    price: number;
  }>;
  /** 制作メモ */
  workInProgress?: string;
  /** 支払い方法 */
  paymentMethod?: string;
  /** その他フォームフィールド */
  [key: string]: any;
}

// =================================================================
// UI State（状態管理の中核）
// =================================================================

/**
 * UI状態管理の中核型定義
 */
export interface UIState {
    // --- User & Session Data ---
    currentUser: UserCore | null;
    loginPhone: string;
    isFirstTimeBooking: boolean;
    registrationData: RegistrationFormData;
    registrationPhone: string | null;

    // --- Core Application Data ---
    lessons: LessonCore[];
    myReservations: ReservationCore[];
    accountingMaster: AccountingMasterItemCore[];
    classrooms?: string[];

    // --- UI State ---
    view: ViewType;
    selectedClassroom: string | null;
    editingReservationIds: Set<string>;
    editingMemo: { reservationId: string; originalValue: string } | null;
    memoInputChanged: boolean;
    selectedLesson: LessonCore | null;
    editingReservationDetails: ReservationCore | null;
    accountingReservation: ReservationCore | null;
    accountingReservationDetails: AccountingDetailsCore;
    accountingScheduleInfo: ScheduleInfo | null;
    accountingDetails: AccountingDetailsCore | null;
    accountingCompleted?: boolean;
    isEditingAccountingRecord?: boolean;
    wasFirstTimeBooking?: boolean;
    completionMessage: string;
    recordsToShow: number;
    registrationStep: number;
    searchedUsers: UserCore[];
    searchAttempted: boolean;

    // --- New Context for Forms ---
    currentReservationFormContext: ReservationFormContext | null;

    // --- Navigation History ---
    navigationHistory: StateNavigationHistoryEntry[];

    // --- System State ---
    isDataFresh: boolean;
    _dataUpdateInProgress: boolean;
    _dataFetchInProgress: Record<string, boolean>;
    _lessonsVersion: string | null;
    _allStudents?: Record<string, UserCore>;
    _cacheVersions?: Record<string, string>;
    today?: string;
    savedAt?: string;

    // --- Computed Data ---
    computed: ComputedStateData;

    // --- 実際のコードで使用される追加プロパティ ---
    targetElement?: HTMLElement | null;
    caption?: string;
    breakTime?: number;

    // --- 動的プロパティ（データ管理用） ---
    _dataLastUpdated?: Record<string, number>;

    // --- AI開発最適化：完全に動的アクセスを許可 ---
    [key: string]: any;
  }

/**
 * 後方互換性のための型エイリアス
 */
export type AppState = UIState;

/**
 * 計算済み状態データ型
 */
export interface ComputedStateData {}

// =================================================================
// State Action（状態更新）
// =================================================================

/**
 * アクション型定義
 */
export interface StateAction {
  type: ActionType;
  payload?: StateActionPayload;
}

export type ActionType = 'SET_STATE' | 'UPDATE_STATE' | 'CHANGE_VIEW' | 'NAVIGATE' | 'LOGOUT';

export interface StateActionPayload {
  to?: ViewType;
  context?: NavigationContext;
  saveHistory?: boolean;
  // AI開発最適化：完全に動的アクセスを許可
  [key: string]: any;
}

/**
 * 状態更新パターン型
 */
export interface StateUpdatePattern {
  trigger: StateTrigger;
  changes: StateChange[];
  sideEffects: SideEffect[];
}

export type StateTrigger =
  | 'USER_ACTION'
  | 'DATA_FETCH'
  | 'NAVIGATION'
  | 'SYSTEM_EVENT';

export interface StateChange {
  path: string;
  oldValue: any;
  newValue: any;
}

export interface SideEffect {
  type:
    | 'RENDER'
    | 'NOTIFY_SUBSCRIBERS'
    | 'HIDE_LOADING'
    | 'SCROLL_MANAGEMENT';
  target?: string;
  data?: any;
}

/**
 * 購読者コールバック型
 */
export interface StateSubscriber {
  (newState: UIState, oldState: UIState): void;
}

// =================================================================
// StateManager
// =================================================================

/**
 * StateManager クラス型定義（AI開発最適化版）
 */
export interface SimpleStateManager {
  state: UIState;
  isUpdating: boolean;
  subscribers: StateSubscriber[];
  _renderScheduled: boolean | undefined;
  _shouldHideLoadingAfterRender: boolean | undefined;

  dispatch(action: StateAction): void;
  getState(): UIState;
  subscribe(callback: StateSubscriber): () => void;
  startEditMode(reservationId: string, originalMemo?: string): void;
  updateMemoInputChanged(reservationId: string, currentValue: string): void;
  endEditMode(reservationId: string): void;
  isInEditMode(reservationId: string): boolean;
  clearAllEditModes(): void;
  goBack(): Partial<UIState> | null;
  updateComputed(): void;

  // データフェッチ進行状況管理
  setDataFetchProgress(key: string, inProgress: boolean): void;
  isDataFetchInProgress(key: string): boolean;

  // レッスン更新管理
  needsLessonsUpdate(cacheExpirationMinutes?: number): boolean;
  updateLessonsVersion(newVersion?: string): void;

  // AI開発最適化：動的プロパティアクセスを許可
  [key: string]: any;
}