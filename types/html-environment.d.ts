/**
 * HTML/フロントエンド環境用グローバル型定義
 * ブラウザ環境でのDOM API拡張と独自プロパティの定義
 */

// meta要素の content プロパティ
declare interface HTMLMetaElement {
  content: string;
}

// Tailwind CSS のグローバル定義
declare var tailwind: any;

// GAS WebApp 環境での server オブジェクト
declare var server: any;

// 会計システム関連のグローバル関数
declare function collectFormData(): any;
declare function saveAccountingCache(data: any): void;
declare function loadAccountingCache(): any;
declare function calculateAccountingTotal(formData: any, masterData: any, classroom: string): any;
declare function updateAccountingCalculation(): void;
declare function setupAccountingEventListeners(): void;
declare function generateAccountingView(classifiedItems: any, classroom: string, formData?: any): string;
declare function getPaymentInfoHtml(selectedPaymentMethod?: string): string;
declare function getPaymentOptionsHtml(selectedValue?: string): string;

// Window 拡張
declare global {
  interface Window {
    currentClassifiedItems?: ClassifiedAccountingItems;
    currentClassroom?: string;
    collectFormData?: () => AccountingFormData;
    accountingSystemCache?: Record<string, ClassifiedAccountingItems>;
  }
}

// ==================================================
// StateManager関連型定義 (フロントエンド状態管理)
// ==================================================

declare global {
  // 🎨 UI状態管理の中核型定義
  interface UIState {
    // --- User & Session Data ---
    currentUser: UserData | null;
    loginPhone: string;
    isFirstTimeBooking: boolean;
    registrationData: RegistrationFormData;
    registrationPhone: string | null;

    // --- Core Application Data ---
    lessons: LessonData[];
    myReservations: ReservationData[];
    accountingMaster: AccountingMasterData[];
    classrooms?: string[];

    // --- UI State ---
    view: ViewType;
    selectedClassroom: string | null;
    editingReservationIds: Set<string>;
    selectedLesson: LessonData | null;
    editingReservationDetails: ReservationDetails | null;
    accountingReservation: ReservationData | null;
    accountingReservationDetails: AccountingReservationDetails;
    accountingScheduleInfo: ScheduleInfo | null;
    accountingDetails: AccountingCalculation | null;
    accountingCompleted?: boolean;
    isEditingAccountingRecord?: boolean;
    wasFirstTimeBooking?: boolean;
    completionMessage: string;
    recordsToShow: number;
    registrationStep: number;
    searchedUsers: UserData[];
    searchAttempted: boolean;

    // --- New Context for Forms ---
    currentReservationFormContext: ReservationFormContext | null;

    // --- Navigation History ---
    navigationHistory: StateNavigationHistoryEntry[];

    // --- System State ---
    isDataFresh: boolean;
    _dataUpdateInProgress: boolean;
    _lessonsVersion: string | null;
    _allStudents?: Record<string, UserData>;
    _cacheVersions?: Record<string, string>;
    today?: string;

    // --- Computed Data ---
    computed: ComputedStateData;

    // --- 実際のコードで使用される追加プロパティ ---
    targetElement?: HTMLElement | null;
    caption?: string;
    breakTime?: number;
  }

  // 🔄 後方互換性のための型エイリアス
  type AppState = UIState;

  // 🎭 アクション型定義
  interface StateAction {
    type: ActionType;
    payload?: StateActionPayload;
  }

  type ActionType = 'SET_STATE' | 'UPDATE_STATE' | 'CHANGE_VIEW' | 'NAVIGATE';

  interface StateActionPayload {
    [key: string]: any;
    view?: ViewType;
    to?: ViewType;
    context?: NavigationContext;
    saveHistory?: boolean;
  }

  // 📱 ビュー型定義
  type ViewType =
    | 'login'
    | 'dashboard'
    | 'bookingLessons'
    | 'newReservation'
    | 'editReservation'
    | 'reservationForm'  // 予約フォーム画面
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

  // 🔗 ナビゲーション関連型
  interface StateNavigationHistoryEntry {
    view: ViewType;
    context: NavigationContext;
  }

  interface NavigationContext {
    selectedClassroom?: string;
    selectedLesson?: LessonData;
    editingReservationDetails?: ReservationDetails;
    accountingReservation?: ReservationData;
    [key: string]: any;
  }

  // 👤 ユーザーデータ型
  interface UserData {
    studentId: string;
    realName: string;
    displayName: string;
    nickname?: string;
    phone: string;
    email?: string;
    wantsEmail?: boolean;
    ageGroup?: string;
    gender?: string;
    dominantHand?: string;
    address?: string;
  }

  // 📝 登録フォームデータ型
  interface RegistrationFormData {
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
    [key: string]: any;
  }

  // 📅 レッスンデータ型 (フロントエンド用、api-types.d.tsのLesson型と構造を統一)
  interface LessonData {
    // 不変な定義情報
    schedule: {
      classroom: string;
      date: string; // YYYY-MM-DD
      venue?: string;
      classroomType?: string;
      // 時間制またはセッション制の時間
      startTime?: string; // HH:mm
      endTime?: string; // HH:mm
      // 2部制の場合
      firstStart?: string; // HH:mm
      firstEnd?: string; // HH:mm
      secondStart?: string; // HH:mm
      secondEnd?: string; // HH:mm
      beginnerStart?: string; // HH:mm
    };
    // 可変な状態情報
    status: {
      isFull: boolean;
      availableSlots?: number;
      morningSlots?: number;
      afternoonSlots?: number;
      firstLectureSlots?: number;
      firstLectureIsFull?: boolean;
      currentReservations?: number;
      maxCapacity?: number;
    };
  }

  // 📋 予約データ型（統合・厳密化）
  interface ReservationData {
    reservationId: string;
    classroom: string;
    date: string;
    venue?: string;
    startTime?: string;
    endTime?: string;
    status?: string;
    studentId?: string;
    workInProgress?: string;
    order?: string;
    message?: string;
    messageToTeacher?: string;
    materialInfo?: string;
    chiselRental?: boolean;
    firstLecture?: boolean;
    accountingDetails?: AccountingDetails | null;

    // TODO: 以下の動的プロパティは将来的に配列（materials: MaterialItem[]）にリファクタリングする
    materialType0?: string;
    materialL0?: string;
    materialW0?: string;
    materialH0?: string;
    otherSalesName0?: string;
    otherSalesPrice0?: string;

    // 実際に使用される動的プロパティ（会計関連）
    discountApplied?: boolean | string;
    計算時間?: number;
    breakTime?: number;
    彫刻刀レンタル?: boolean;

    // 限定的な動的プロパティ（material/otherSales系のみ）
    [key: `material${string}`]: string | number | undefined;
    [key: `otherSales${string}`]: string | number | undefined;
  }

  // 📋 予約フォーム専用コンテキスト
  interface ReservationFormContext {
    lessonInfo: LessonData;
    reservationInfo: Partial<ReservationData>; // 新規の場合は初期値、編集の場合は既存データ
  }

  // 📊 会計マスターデータ型（実際のスプレッドシート構造に対応）
  interface AccountingMasterData {
    // 英語プロパティ（将来的に移行予定）
    item?: string;
    price?: number;
    unit?: string;
    type?: string;
    classroom?: string;

    // 日本語プロパティ（現在実際に使用されている - CONSTANTS.HEADERS.ACCOUNTINGに対応）
    '種別': string;        // CONSTANTS.HEADERS.ACCOUNTING.TYPE
    '項目名': string;      // CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME
    '対象教室': string;    // CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM
    '単価': number;       // CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE
    '単位': string;       // CONSTANTS.HEADERS.ACCOUNTING.UNIT
    '備考'?: string;      // CONSTANTS.HEADERS.ACCOUNTING.NOTES

    // インデックス シグネチャでCONSTANTS.HEADERS.ACCOUNTINGアクセスに対応
    [key: string]: any;
  }

  // 📋 予約詳細型 (編集時)
  type ReservationDetails = Partial<ReservationData>;

  // 💰 会計予約詳細型 (会計画面用) - 空オブジェクトも許可
  type AccountingReservationDetails = Partial<ReservationData>;

  // ⏰ スケジュール情報型（実際のスプレッドシート構造に対応）
  interface ScheduleInfo {
    // LessonData['schedule']からの継承
    classroom: string;
    date: string;
    venue?: string;
    classroomType?: string;
    startTime?: string;
    endTime?: string;
    firstStart?: string;
    firstEnd?: string;
    secondStart?: string;
    secondEnd?: string;
    beginnerStart?: string;

    // 実際のスプレッドシートで使用される日本語プロパティ
    '教室形式'?: string;
    '1部開始'?: string;
    '1部終了'?: string;
    '2部開始'?: string;
    '2部終了'?: string;

    // インデックス シグネチャで動的アクセスに対応
    [key: string]: any;
  }

  // 🧮 計算済み状態データ型
  interface ComputedStateData {}

  // 🔄 状態更新パターン型
  interface StateUpdatePattern {
    trigger: StateTrigger;
    changes: StateChange[];
    sideEffects: SideEffect[];
  }

  type StateTrigger = 'USER_ACTION' | 'DATA_FETCH' | 'NAVIGATION' | 'SYSTEM_EVENT';

  interface StateChange {
    path: string;
    oldValue: any;
    newValue: any;
  }

  interface SideEffect {
    type: 'RENDER' | 'NOTIFY_SUBSCRIBERS' | 'HIDE_LOADING' | 'SCROLL_MANAGEMENT';
    target?: string;
    data?: any;
  }

  // 📡 購読者コールバック型
  interface StateSubscriber {
    (newState: UIState, oldState: UIState): void;
  }

  // 🎯 StateManager クラス型定義
  interface SimpleStateManager {
    state: UIState;
    isUpdating: boolean;
    subscribers: StateSubscriber[];
    _renderScheduled?: boolean;
    _shouldHideLoadingAfterRender?: boolean;

    dispatch(action: StateAction): void;
    getState(): UIState;
    subscribe(callback: StateSubscriber): () => void;
    startEditMode(reservationId: string): void;
    endEditMode(reservationId: string): void;
    isInEditMode(reservationId: string): boolean;
    clearAllEditModes(): void;
    goBack(): UIState | null;
    updateComputed(): void;
  }

  // 🌐 Window拡張（StateManager関連）
  interface Window {
    stateManager: SimpleStateManager;
    render?: () => void;
    hideLoading?: () => void;
    pageTransitionManager?: {
      onPageTransition(view: ViewType): void;
    };
    isProduction?: boolean;
    showModal?: (config: ModalDialogConfig) => void;
    showConfirm?: (config: ModalDialogConfig) => void;
    showInfo?: (message: string, title?: string, callback?: (() => void) | null) => void;
    showLoading?: LoadingMessageFunction;
  }

  // ==================================================
  // データフロー型定義 (Handlers + Views 特化)
  // ==================================================

  // 🎯 イベント型定義
  interface UIEventData {
    type: 'click' | 'change' | 'input' | 'submit' | 'keydown' | 'keyup';
    target: HTMLElement;
    currentTarget: HTMLElement;
    action?: string;
    data?: ActionHandlerData;
    originalEvent: Event;
  }

  interface ClickEventHandler {
    (event: MouseEvent): void;
  }

  interface ChangeEventHandler {
    (event: Event): void;
  }

  interface InputEventHandler {
    (event: Event): void;
  }

  interface FormEventHandler {
    (event: Event): void;
  }

  // 🔄 日付データ型安全性確保のためのヘルパー型
  interface TypeSafeDateConverter {
    ensureDateString(date: string | Date): string;
    isValidDateString(date: string): boolean;
    toDateString(date: string | Date): string;
  }

  // 🔄 ReservationData の確実性を高める実用型
  interface SafeReservationData extends Omit<ReservationData, 'date'> {
    date: string; // 常に string として扱う
  }

  // 🎭 イベントハンドラー・アクション型定義
  interface ActionHandlerData {
    [key: string]: any;
    // 共通プロパティ（実際のdata-*属性に対応）
    reservationId?: string;
    classroom?: string;
    date?: string;
    studentId?: string;
    classroomName?: string;

    // 実際のコードで使用される具体的プロパティ
    action?: string;
    realName?: string;
    nickname?: string;
    itemName?: string;
    itemType?: string;
    materialRowIndex?: string;
    otherSalesRow?: string;
    copyText?: string;
    details?: string;
  }

  interface ActionHandler {
    (data?: ActionHandlerData): void | Promise<void>;
  }

  interface ActionHandlers {
    // 確実に実装されている必須関数のみ
    smartGoBack: ActionHandler;
    modalConfirm: ActionHandler;
    modalCancel: ActionHandler;

    // 会計関連アクションハンドラー
    goToAccounting: (data: { reservationId: string }) => void;
    goToAccountingHistory: (data: { reservationId: string }) => void;
    confirmPayment: () => void;
    confirmAndPay: () => void;
    showAccountingConfirmation: (result?: AccountingCalculationResult, formData?: AccountingFormData) => void;

    // 動的に取り込まれる関数（レガシー対応）
    [actionName: string]: ActionHandler | ((param: any) => void) | ((param1: any, param2: any) => void) | undefined;
  }

  // 📡 google.script.run 型安全性
  interface GoogleScriptRun {
    withSuccessHandler<T>(handler: (response: T) => void): GoogleScriptRun;
    withFailureHandler(handler: (error: Error) => void): GoogleScriptRun;

    // 実際のコードで使用されるサーバーサイドメソッド（型安全版）
    getLoginData(phone: string): void;
    registerNewUser(userData: RegistrationFormData): void;
    getBatchData(dataTypes: string[], phone?: string, studentId?: string): void;
    updateUserProfile(userData: UserData): void;
    searchUsersWithoutPhone(searchTerm: string): void;
    cancelReservationAndGetLatestData(cancelData: CancelReservationData): void;
    makeReservationAndGetLatestData(reservationData: ReservationSubmissionData): void;
    updateReservationDetailsAndGetLatestData(updateData: ReservationUpdateData): void;
    updateReservationMemoAndGetLatestData(reservationId: string, studentId: string, memo: string): void;
    saveAccountingDetailsAndGetLatestData(payload: AccountingSubmissionPayload): void;
    getAccountingDetailsFromSheet(reservationId: string): void;
    getCacheVersions(): void;
    getScheduleInfo(params: { date: string; classroom: string }): void;

    // 汎用フォールバック
    [methodName: string]: any;
  }

  // 📡 型安全なGoogle Script API呼び出し関数
  interface TypeSafeGoogleScriptAPI {
    // ログインデータ取得
    getLoginData(phone: string): Promise<LoginDataResponse>;

    // ユーザー登録
    registerNewUser(userData: RegistrationFormData): Promise<ServerResponse<{ message: string }>>;

    // バッチデータ取得
    getBatchData(dataTypes: string[], phone?: string, studentId?: string): Promise<BatchDataResponse>;

    // ユーザープロフィール更新
    updateUserProfile(userData: UserData): Promise<ServerResponse<{ message: string }>>;

    // ユーザー検索
    searchUsersWithoutPhone(searchTerm: string): Promise<ServerResponse<UserData[]>>;

    // 予約キャンセル
    cancelReservationAndGetLatestData(cancelData: CancelReservationData): Promise<BatchDataResponse>;

    // 予約作成
    makeReservationAndGetLatestData(reservationData: ReservationSubmissionData): Promise<BatchDataResponse>;

    // 予約詳細更新
    updateReservationDetailsAndGetLatestData(updateData: ReservationUpdateData): Promise<BatchDataResponse>;

    // 予約メモ更新
    updateReservationMemoAndGetLatestData(reservationId: string, studentId: string, memo: string): Promise<ServerResponse<{ reservation: ReservationData }>>;

    // 会計詳細保存
    saveAccountingDetailsAndGetLatestData(payload: AccountingSubmissionPayload): Promise<BatchDataResponse>;

    // 会計詳細取得
    getAccountingDetailsFromSheet(reservationId: string): Promise<ServerResponse<AccountingDetails>>;

    // キャッシュバージョン取得
    getCacheVersions(): Promise<ServerResponse<Record<string, string>>>;

    // スケジュール情報取得
    getScheduleInfo(params: { date: string; classroom: string }): Promise<ServerResponse<{ scheduleInfo: ScheduleInfo }>>;
  }

  interface GoogleScript {
    run: GoogleScriptRun;
  }

  interface Google {
    script: GoogleScript;
  }

  // 🌐 Google Apps Script API型拡張
  declare var google: Google;

  // 📝 フォームデータ型定義
  interface AccountingFormData {
    paymentMethod?: string;
    startTime?: string;
    endTime?: string;
    breakTime?: string;
    discountApplied?: boolean;
    materials?: MaterialItem[];
    tuitionItems?: string[];
    salesItems?: SalesItem[];
    [key: string]: any;
  }

  // 🔄 サーバー通信用データ型定義（実際のコードパターンに基づく）
  interface CancelReservationData extends ActionHandlerData {
    reservationId: string;
    classroom: string;
    date: string;
    studentId: string;
    cancelMessage?: string;
  }

  interface ReservationSubmissionData {
    // 基本情報
    classroom: string;
    date: string;
    venue?: string;
    startTime: string;
    endTime: string;

    // バックエンド互換性のためのヘッダー形式
    [headerKey: string]: any;

    // ユーザー情報
    user: UserData;
    studentId: string;

    // 予約オプション
    options: {
      chiselRental: boolean;
      firstLecture: boolean;
      workInProgress: string;
      order: string;
      messageToTeacher: string;
      materialInfo: string;
    };

    // スケジュール詳細
    schedule?: any;
    status?: string;
    isFull?: boolean;
  }

  interface ReservationUpdateData {
    reservationId: string;
    classroom: string;
    studentId: string;
    chiselRental: boolean;
    firstLecture: boolean;
    startTime: string;
    endTime: string;
    workInProgress: string;
    order: string;
    messageToTeacher: string;
    materialInfo: string;

    // バックエンド互換性のためのヘッダー形式
    [headerKey: string]: any;
  }

  interface AccountingSubmissionPayload {
    reservationId: string;
    classroom: string;
    studentId: string;
    userInput: {
      paymentMethod: string;
      tuitionItems: string[];
      salesItems: Array<{name: string; price?: number}>;
      timeBased?: {
        startTime: string;
        endTime: string;
        breakMinutes: number;
        discountApplied: boolean;
        [headerKey: string]: any;
      } | null;
    };
  }

  interface MaterialItem {
    name: string;
    price: number;
  }

  interface SalesItem {
    name: string;
    price?: number;
  }

  interface RegistrationFormData {
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
  }

  // 🏛️ DOM要素型安全性
  interface HTMLElementWithId extends HTMLElement {
    value?: string;
    checked?: boolean;
    textContent?: string;
    content?: string;
    disabled?: boolean;
    focus?: () => void;
    dataset: DOMStringMap & {
      action?: string;
      reservationId?: string;
      classroom?: string;
      date?: string;
      studentId?: string;
      classroomName?: string;
      itemName?: string;
      itemType?: string;
      materialRowIndex?: string;
      otherSalesRow?: string;
      copyText?: string;
      [key: string]: string | undefined;
    };
  }

  // 🎯 実用的なDOM要素アクセス型安全性
  interface TypedDocument extends Document {
    getElementById<T extends HTMLElement = HTMLElementWithId>(elementId: string): T | null;
    querySelector<T extends HTMLElement = HTMLElement>(selector: string): T | null;
    querySelectorAll<T extends HTMLElement = HTMLElement>(selector: string): NodeListOf<T>;
  }

  // 🎭 実際のコードで使用されるDOM要素型安全キャスト
  interface SafeElementGetter {
    <T extends HTMLInputElement>(id: string, type: 'input'): T | null;
    <T extends HTMLSelectElement>(id: string, type: 'select'): T | null;
    <T extends HTMLTextAreaElement>(id: string, type: 'textarea'): T | null;
    <T extends HTMLFormElement>(id: string, type: 'form'): T | null;
    <T extends HTMLButtonElement>(id: string, type: 'button'): T | null;
    <T extends HTMLElementWithId>(id: string): T | null;
  }

  // 🔍 実際のコードパターンに基づく型安全なDOM操作
  interface DOMElementSafeAccess {
    // 実際に多用されるパターンの型安全版
    getInputElement(id: string): HTMLInputElement | null;
    getSelectElement(id: string): HTMLSelectElement | null;
    getTextareaElement(id: string): HTMLTextAreaElement | null;
    getFormElement(id: string): HTMLFormElement | null;
    getButtonElement(id: string): HTMLButtonElement | null;

    // 汎用アクセサ
    getElement<T extends HTMLElement = HTMLElementWithId>(id: string): T | null;
    getElementByDataAction(action: string): HTMLElement | null;
    getElementsByDataAttribute(attribute: string, value: string): NodeListOf<HTMLElement>;
  }

  interface DocumentWithTypedElements extends Document {
    getElementById<T extends HTMLElement = HTMLElementWithId>(elementId: string): T | null;
  }

  // DOM要素型キャストヘルパー
  interface ElementWithCommonProperties {
    style: CSSStyleDeclaration;
    content?: string;
    focus?: () => void;
    disabled?: boolean;
    value?: string;
    checked?: boolean;
  }

  // より安全なDOM要素取得
  interface SafeElementAccess {
    getElementById(id: string): (HTMLElement & ElementWithCommonProperties) | null;
    querySelector(selector: string): (HTMLElement & ElementWithCommonProperties) | null;
    querySelectorAll(selector: string): NodeListOf<HTMLElement & ElementWithCommonProperties>;
  }

  // 📊 データ表示・UI生成型
  interface ViewFunction {
    (data?: ViewFunctionData): string;
  }

  interface ViewFunctionData {
    [key: string]: any;
  }

  // 🎭 よく使われる関数パラメータ型
  type HTMLString = string;
  type DateString = string; // YYYY-MM-DD or various date formats
  type TimeString = string; // HH:MM format
  type ReservationId = string;
  type ClassroomName = string;
  type StudentId = string;
  type PhoneNumber = string;

  // イベントハンドラー共通型
  interface EventHandler<T = Event> {
    (event: T): void;
  }

  interface AsyncEventHandler<T = Event> {
    (event: T): Promise<void>;
  }

  // エラーハンドラー型
  interface ErrorHandler {
    (error: Error | unknown, context?: string): void;
  }

  // コールバック関数型
  type VoidCallback = () => void;

  type AsyncVoidCallback = () => Promise<void>;

  interface GenericCallback<T> {
    (data: T): void;
  }

  interface AsyncGenericCallback<T> {
    (data: T): Promise<void>;
  }

  interface ComponentProps {
    [key: string]: any;
    id?: string;
    className?: string;
    action?: string;
    text?: string;
    style?: string;
    size?: string;
  }

  interface HTMLGeneratorFunction {
    (props?: ComponentProps): string;
  }

  // 🔄 サーバーレスポンス型定義
  interface ServerResponse<T = any> {
    success: boolean;
    message?: string;
    data?: T;
    userFound?: boolean;
    commandRecognized?: boolean;
  }

  interface LoginDataResponse {
    success: boolean;
    userFound: boolean;
    commandRecognized?: boolean;
    data?: {
      lessons?: LessonData[];
      myReservations?: ReservationData[];
      allStudents?: Record<string, UserData>;
      accountingMaster?: AccountingMasterData[];
      cacheVersions?: Record<string, string>;
      today?: string;
    };
    message?: string;
  }

  interface BatchDataResponse {
    success: boolean;
    data?: {
      initial?: any;
      lessons?: LessonData[];
      myReservations?: ReservationData[];
    };
    message?: string;
  }

  // 🎯 ユーザーアクション・操作型
  interface UserInteraction {
    type: 'click' | 'input' | 'change' | 'submit';
    target: HTMLElement;
    data?: ActionHandlerData;
    preventDefault?: boolean;
    stopPropagation?: boolean;
  }

  interface EventHandlerFunction {
    (event: Event): void;
  }

  // 📋 フォーム操作型定義
  interface FormProcessor {
    getData(): AccountingFormData | RegistrationFormData;
    validate(): ValidationResult;
    reset(): void;
    populate(data: any): void;
  }

  interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
  }

  // ==================================================
  // DOM操作・UI生成専用型定義
  // ==================================================

  // HTML エスケープ関数型
  interface HTMLEscapeFunction {
    (str: string | number | boolean | null | undefined): string;
  }

  // コンポーネント設定型定義
  interface ModalConfig {
    id: string;
    title: string;
    content: string;
    maxWidth?: string;
    showCloseButton?: boolean;
  }

  interface ButtonConfig {
    action?: string;
    text: string;
    style?: 'primary' | 'secondary' | 'danger' | 'none';
    size?: 'normal' | 'full' | 'small' | 'xs' | 'large';
    disabled?: boolean;
    customClass?: string;
    dataAttributes?: Record<string, string | number | boolean>;
  }

  interface InputConfig {
    id: string;
    label: string;
    type?: string;
    value?: string;
    placeholder?: string;
    required?: boolean;
  }

  interface SelectConfig {
    id: string;
    label: string;
    options: string;
  }

  interface TextareaConfig {
    id: string;
    label: string;
    value?: string;
    placeholder?: string;
  }

  interface CheckboxConfig {
    id: string;
    label: string;
    checked?: boolean;
  }

  interface PageContainerConfig {
    content: string;
    maxWidth?: string;
  }

  interface CardContainerConfig {
    content: string;
    variant?: 'default' | 'highlight' | 'success' | 'warning' | 'available' | 'waitlist' | 'booked' | 'history';
    padding?: 'compact' | 'normal' | 'spacious';
    touchFriendly?: boolean;
    customClass?: string;
    dataAttributes?: string;
  }

  interface StatusBadgeConfig {
    type: 'success' | 'warning' | 'error' | 'info';
    text: string;
  }

  interface PriceDisplayConfig {
    amount: number | string;
    label?: string;
    size?: 'small' | 'normal' | 'large';
    style?: 'default' | 'highlight' | 'subtotal' | 'total';
    showCurrency?: boolean;
    align?: 'left' | 'center' | 'right';
  }

  interface ActionButtonSectionConfig {
    primaryButton?: ButtonConfig;
    secondaryButton?: ButtonConfig;
    dangerButton?: ButtonConfig;
    layout?: 'vertical' | 'horizontal';
    spacing?: 'compact' | 'normal' | 'spacious';
  }

  interface AccountingRowConfig {
    name: string;
    itemType: string;
    price: number;
    checked?: boolean;
    disabled?: boolean;
  }

  interface MaterialRowConfig {
    index: number;
    values?: {
      type?: string;
      l?: string;
      w?: string;
      h?: string;
    };
  }

  interface OtherSalesRowConfig {
    index: number;
    values?: {
      name?: string;
      price?: string;
    };
  }

  interface AccountingCompletedConfig {
    details: AccountingCalculation;
    reservation: ReservationData;
  }

  interface DashboardSectionConfig {
    title: string;
    items: string[];
    showNewButton?: boolean;
    newAction?: string;
    showMoreButton?: boolean;
    moreAction?: string;
  }

  interface ListCardConfig {
    item: ReservationData;
    badges?: Array<{type: string; text: string}>;
    editButtons?: Array<{action: string; text: string; style?: string; size?: string; details?: any}>;
    accountingButtons?: Array<{action: string; text: string; style?: string; details?: any}>;
    type?: 'booking' | 'record';
  }

  interface MemoSectionConfig {
    reservationId: string;
    workInProgress?: string;
    isEditMode?: boolean;
  }

  // View生成関数の型定義
  interface ViewGenerator {
    (): HTMLString;
  }

  interface ViewGeneratorWithConfig<T = any> {
    (config: T): HTMLString;
  }

  interface UserFormConfig {
    mode: 'register' | 'edit';
    phone?: string;
  }

  // Views.js 関数の型定義
  type IsToday = (dateString: DateString) => boolean;
  type IsPastOrToday = (dateString: DateString) => boolean;
  type GetTimeOptionsHtml = (startHour: number, endHour: number, step: number, selectedValue: TimeString | null) => HTMLString;
  type GetDiscountHtml = (discountRule: AccountingMasterData, selectedValue: string) => HTMLString;
  type GetPaymentInfoHtml = (selectedPaymentMethod?: string) => HTMLString;
  type GetPaymentOptionsHtml = (selectedValue: string) => HTMLString;

  // Component関数の一般化された型
  type ComponentSize = 'normal' | 'full' | 'small' | 'xs' | 'large';
  type ComponentStyle = 'primary' | 'secondary' | 'danger' | 'none';

  interface ComponentFunction<T = ComponentProps> {
    (config: T): HTMLString;
  }

  interface ValidationError {
    field: string;
    message: string;
    code?: string;
  }

  // 🎨 UI状態・表示型
  interface RenderContext {
    view: ViewType;
    state: UIState;
    isLoading: boolean;
    error?: string;
  }

  interface ComponentRenderer {
    render(context: RenderContext): string;
    update(element: HTMLElement, newProps: ComponentProps): void;
  }

  // ===============================================
  // UI基盤ブロック特化型定義 (Components + Core)
  // ===============================================

  // 🔧 DOM操作型安全性強化
  interface SafeDOMElementAccess {
    getElementById<T extends HTMLElement = HTMLElement>(id: string): T | null;
    querySelector<T extends HTMLElement = HTMLElement>(selector: string): T | null;
    querySelectorAll<T extends HTMLElement = HTMLElement>(selector: string): NodeListOf<T>;
  }

  // 📝 型安全なフォーム要素アクセス
  interface TypedFormElements {
    getElementById(id: string): HTMLFormElement | null;
    querySelector(selector: string): HTMLFormElement | null;
    querySelectorAll(selector: string): NodeListOf<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;
  }

  // 🎯 UI基盤特化：コンポーネント関数型
  interface UIComponentFunction<TConfig = ComponentConfig> {
    (config: TConfig): HTMLString;
  }

  interface UIUtilityFunction<TInput = any, TOutput = any> {
    (input: TInput): TOutput;
  }

  interface UICalculationFunction<TResult = any> {
    (): TResult | null;
  }

  // 🧮 会計計算エンジン型定義
  interface AccountingCalculationEngine {
    calculateAccountingDetails: UICalculationFunction<AccountingCalculation>;
    calculateTimeBasedTuition: (rule: AccountingMasterData) => TimeBasedTuitionResult | null;
    calculateCheckboxItems: UICalculationFunction<CheckboxItemsCalculation>;
    calculateMaterials: UICalculationFunction<MaterialCalculation>;
    calculateOtherSales: UICalculationFunction<OtherSalesCalculation>;
    updateAccountingUI: (details: AccountingCalculation) => void;
  }

  // 🔍 統一検索エンジン型定義
  interface UnifiedSearchEngine {
    findReservationById: (reservationId: string, state?: UIState | null) => ReservationSearchResult | null;
    findReservationByDateAndClassroom: (date: string, classroom: string, state?: UIState | null) => ReservationSearchResult | null;
    findReservationsByStatus: (status: string, state?: UIState | null) => ReservationSearchResult[];
  }

  // 🎨 UI更新・レンダリング型定義
  interface UIRenderingEngine {
    updateSingleHistoryCard: (reservationId: string) => void;
    teardownAllListeners: () => void;
    setupViewListener: () => void;
    addTrackedListener: (element: HTMLElement | null, type: string, listener: EventListener, options?: AddEventListenerOptions) => void;
  }

  // 💾 データ変換・処理型定義
  interface DataProcessingEngine {
    processInitialData: (data: any, phone: string, lessons: LessonData[], myReservations?: ReservationData[] | null) => Partial<UIState>;
    normalizePhoneNumberFrontend: (phoneInput: string) => PhoneNumberNormalizationResult;
    detectEnvironment: () => 'test' | 'production';
    getEnvironmentData: (dataType: string, fallback?: any) => any;
  }

  // 🚨 型安全エラーハンドリング
  interface TypedErrorHandler {
    handle: (error: Error, context?: string, additionalInfo?: Record<string, any>) => void;
    getUserFriendlyMessage: (error: Error, context: string) => string;
    isCriticalError: (error: Error) => boolean;
    reportError: (errorInfo: FrontendErrorInfo) => void;
  }

  // ⏰ スケジュールデータ処理強化型
  interface ScheduleDataProcessor {
    getScheduleInfoFromCache: (date: string, classroom: string) => Promise<ScheduleInfo | null>;
    getScheduleDataFromLessons: (reservation: ReservationData) => ScheduleInfo | null;
    getClassroomTypeFromSchedule: (scheduleData: ScheduleInfo | null) => string | null;
    isTimeBasedClassroom: (scheduleData: ScheduleInfo | null) => boolean;
  }

  // 💰 型安全な会計キャッシュ管理
  interface AccountingCacheManager {
    saveAccountingCache: (reservationId: string, accountingData: AccountingFormData) => void;
    loadAccountingCache: (reservationId: string) => AccountingFormData | null;
    clearAccountingCache: (reservationId: string) => void;
  }

  // 🎛️ 詳細化された計算結果型
  interface TimeBasedTuitionResult {
    price: number;
    item: AccountingItem;
    billableUnits?: number;
    startTime?: string;
    endTime?: string;
    breakMinutes?: number;
  }

  interface CheckboxItemsCalculation {
    tuitionSubtotal: number;
    salesSubtotal: number;
    tuitionItems: AccountingItem[];
    salesItems: AccountingItem[];
    allItems: AccountingItem[];
  }

  interface MaterialCalculation {
    subtotal: number;
    items: AccountingItem[];
    materialRows?: Array<{
      type: string;
      dimensions?: { l: number; w: number; h: number };
      volume?: number;
    }>;
  }

  interface OtherSalesCalculation {
    subtotal: number;
    items: AccountingItem[];
    customItems?: Array<{ name: string; price: number }>;
  }

  interface DiscountCalculation {
    amount: number;
    item: AccountingItem;
    discountType?: string;
  }

  // 🧱 コンポーネント基本型
  interface ComponentConfig {
    [key: string]: any;
    // 共通プロパティ
    id?: string;
    action?: string;
    text?: string;
    style?: ComponentStyle;
    size?: ComponentSize;
    disabled?: boolean;
    customClass?: string;
    dataAttributes?: ComponentDataAttributes;
  }

  type ComponentStyle = 'primary' | 'secondary' | 'danger' | 'none';
  type ComponentSize = 'xs' | 'small' | 'normal' | 'large' | 'full';

  interface ComponentDataAttributes {
    [key: string]: string | number | boolean;
    reservationId?: string;
    classroom?: string;
    date?: string;
    details?: string;
  }

  // 🎯 各種コンポーネント設定型
  interface ButtonConfig extends ComponentConfig {
    text: string;
    action?: string;
    style?: ComponentStyle;
    size?: ComponentSize;
    disabled?: boolean;
    dataAttributes?: ComponentDataAttributes;
  }

  interface InputConfig extends ComponentConfig {
    id: string;
    label: string;
    type?: HTMLInputType;
    value?: string;
    placeholder?: string;
    required?: boolean;
  }

  interface SelectConfig extends ComponentConfig {
    id: string;
    label: string;
    options: string; // HTML文字列
  }

  interface TextareaConfig extends ComponentConfig {
    id: string;
    label: string;
    value?: string;
    placeholder?: string;
  }

  interface CheckboxConfig extends ComponentConfig {
    id: string;
    label: string;
    checked?: boolean;
  }

  // 🏗️ レイアウトコンポーネント型
  interface PageContainerConfig extends ComponentConfig {
    content: string;
    maxWidth?: ContainerMaxWidth;
  }

  type ContainerMaxWidth = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

  interface CardContainerConfig extends ComponentConfig {
    content: string;
    variant?: CardVariant;
    padding?: CardPadding;
    touchFriendly?: boolean;
    dataAttributes?: string;
  }

  type CardVariant = 'default' | 'highlight' | 'success' | 'warning' | 'available' | 'waitlist' | 'booked' | 'history';
  type CardPadding = 'compact' | 'normal' | 'spacious';

  // 🎨 UI要素型
  interface StatusBadgeConfig extends ComponentConfig {
    type: BadgeType;
    text: string;
  }

  type BadgeType = 'success' | 'warning' | 'error' | 'info';

  interface PriceDisplayConfig extends ComponentConfig {
    amount: number | string;
    label?: string;
    size?: PriceSize;
    style?: PriceStyle;
    showCurrency?: boolean;
    align?: Alignment;
  }

  type PriceSize = 'small' | 'normal' | 'large';
  type PriceStyle = 'default' | 'highlight' | 'subtotal' | 'total';
  type Alignment = 'left' | 'center' | 'right';

  interface ActionButtonSectionConfig extends ComponentConfig {
    primaryButton?: ButtonConfig;
    secondaryButton?: ButtonConfig;
    dangerButton?: ButtonConfig;
    layout?: ButtonLayout;
    spacing?: ButtonSpacing;
  }

  type ButtonLayout = 'vertical' | 'horizontal';
  type ButtonSpacing = 'compact' | 'normal' | 'spacious';

  // 🧾 会計系コンポーネント型
  interface AccountingRowConfig extends ComponentConfig {
    name: string;
    itemType: string;
    price: number;
    checked?: boolean;
    disabled?: boolean;
  }

  interface MaterialRowConfig extends ComponentConfig {
    index: number;
    values?: MaterialValues;
  }

  interface MaterialValues {
    type?: string;
    l?: string | number;
    w?: string | number;
    h?: string | number;
  }

  interface OtherSalesRowConfig extends ComponentConfig {
    index: number;
    values?: OtherSalesValues;
  }

  interface OtherSalesValues {
    name?: string;
    price?: string | number;
  }

  interface AccountingCompletedConfig extends ComponentConfig {
    details: AccountingDetails;
    reservation: ReservationData;
  }

  interface AccountingDetails {
    tuition: {
      items: AccountingItem[];
      subtotal: number;
    };
    sales: {
      items: AccountingItem[];
      subtotal: number;
    };
    grandTotal: number;
    paymentMethod: string;
  }

  // 📋 リストカード型
  interface ListCardConfig extends ComponentConfig {
    item: ListCardItem;
    badges?: ListCardBadge[];
    editButtons?: ListCardButton[];
    accountingButtons?: ListCardButton[];
    type?: 'booking' | 'history';
  }

  interface ListCardItem {
    reservationId: string;
    classroom: string;
    venue?: string;
    date: string;
    startTime?: string;
    endTime?: string;
    workInProgress?: string;
  }

  interface ListCardBadge {
    type: BadgeType;
    text: string;
  }

  interface ListCardButton {
    action: string;
    text: string;
    style?: ComponentStyle;
    size?: ComponentSize;
    details?: any;
  }

  // 📝 メモセクション型
  interface MemoSectionConfig extends ComponentConfig {
    reservationId: string;
    workInProgress?: string;
    isEditMode?: boolean;
  }

  // 🏠 ダッシュボードセクション型
  interface DashboardSectionConfig extends ComponentConfig {
    title: string;
    items: string[]; // HTML文字列の配列
    showNewButton?: boolean;
    newAction?: string;
    showMoreButton?: boolean;
    moreAction?: string;
  }

  // 🗂️ モーダル型
  interface ModalConfig {
    id: string;
    title: string;
    content: string;
    maxWidth?: string;
    showCloseButton?: boolean;
  }

  // 📐 デザインシステム型（11_WebApp_Config.js実際の構造に完全対応）
  interface DesignSystemConfig {
    colors: {
      text: string;
      textSubtle: string;
      caption: string;
      background: string;
      primary: string;
      secondary: string;
      accent: string;
      border: string;
      error: string;
      success: string;
      warning: string;
      info: string;
      [key: string]: string; // 後方互換性のため最小限のインデックスシグネチャ
    };
    buttons: {
      primary: string;
      secondary: string;
      action: string;
      disabled: string;
      small: string;
      large: string;
      [key: string]: string; // 後方互換性
    };
    inputs: {
      container: string;
      base: string;
      textarea: string;
    };
    cards: {
      base: string;
      container: string;
      background: string;
      state: {
        available: { card: string; text?: string };
        waitlist: { card: string; text?: string };
        booked: { card: string; text?: string };
        history: { card: string };
      };
    };
    text: Record<string, string>;
    classroomColors: {
      [key: string]: {
        button: string;
        colorClass: string;
      };
    };
    // 実際のDesignConfigで使用される必須プロパティ
    layout: Record<string, string>;
    utils: Record<string, string>;
  }

  // 🔄 ページ遷移管理型定義（11_WebApp_Config.js特化）
  interface PageTransitionManager {
    onPageTransition: (view: ViewType) => void;
    saveScrollPosition: () => void;
    restoreScrollPosition: () => void;
    getCurrentScrollPosition: () => number;
    setScrollPosition: (position: number) => void;
    resetScrollPosition: () => void;

    // 追加実装（内部使用）
    handleViewChange?: (newView: any, isModal?: boolean) => void;
    initializeContentVisibility?: () => void;
    stabilizeBackButtonPosition?: () => void;
    initializePage?: () => void;
    onModalOpen?: () => void;
    onModalClose?: () => void;
  }

  // 🎯 設定・初期化ブロック特化型定義
  interface ConfigurationInitialization {
    // モバイル最適化検出
    detectMobileOptimization: () => boolean;
    applyMobileOptimizations: () => void;

    // 埋め込み環境検出
    detectEmbeddedEnvironment: () => boolean;
    applyEmbeddedEnvironmentStyles: () => void;

    // TailwindCSS設定
    configureTailwindCSS: () => void;
    loadCustomFonts: () => void;

    // ページ遷移管理
    setupPageTransitionManagement: () => PageTransitionManager;
  }

  // 💄 視覚スタイル最適化型
  interface VisualOptimization {
    // モバイル視認性向上
    enhanceMobileVisibility: () => void;
    optimizeTouchTargets: () => void;

    // レスポンシブデザイン調整
    applyResponsiveAdjustments: () => void;
    optimizeScreenDensity: () => void;
  }

  // 🎨 動的スタイル管理型
  interface DynamicStyleManager {
    applyClassroomColorTheme: (classroom: string) => void;
    updateCardStateStyles: (element: HTMLElement, state: CardVariant) => void;
    toggleMobileOptimization: (enabled: boolean) => void;
  }

  // 🌐 グローバルコンポーネント関数（実際の戻り値型に修正）
  interface ComponentsObject {
    // 基本コンポーネント（HTML文字列を返す）
    button: (config: ButtonConfig) => string;
    input: (config: InputConfig) => string;
    select: (config: SelectConfig) => string;
    textarea: (config: TextareaConfig) => string;
    checkbox: (config: CheckboxConfig) => string;

    // レイアウトコンポーネント
    pageContainer: (config: PageContainerConfig) => string;
    cardContainer: (config: CardContainerConfig) => string;

    // UI要素
    statusBadge: (config: StatusBadgeConfig) => string;
    priceDisplay: (config: PriceDisplayConfig) => string;
    actionButtonSection: (config: ActionButtonSectionConfig) => string;

    // 会計系
    accountingRow: (config: AccountingRowConfig) => string;
    materialRow: (config: MaterialRowConfig) => string;
    otherSalesRow: (config: OtherSalesRowConfig) => string;
    accountingCompleted: (config: AccountingCompletedConfig) => string;
    accountingForm: (config: any) => string;
    salesSection: (config: any) => string;
    navigationHeader: (config: ComponentConfig & {title: string, backAction: string}) => string;

    // リスト・カード
    listCard: (config: ListCardConfig) => string;
    memoSection: (config: MemoSectionConfig) => string;
    dashboardSection: (config: DashboardSectionConfig) => string;
    newReservationCard: (config: ComponentConfig & {action: string}) => string;

    // モーダル（HTML文字列を返すもの）
    modal: (config: ModalConfig) => string;

    // モーダル操作（voidを返すもの）
    showModal: (modalId: string) => void;
    closeModal: (modalId: string) => void;
    closeModalOnBackdrop: (event: Event, modalId: string) => void;
    handleModalContentClick: (event: Event) => void;

    // ナビゲーション・バックボタン
    createBackButton: (action?: string, text?: string) => string;
    createSmartBackButton: (currentView: ViewType, appState?: UIState) => string;

    // インデックス シグネチャ（その他の関数）
    [key: string]: ((...args: any[]) => string) | ((...args: any[]) => void);
  }

  // 🎭 イベント処理型
  interface HTMLElementEventListeners {
    addEventListener<K extends keyof HTMLElementEventMap>(
      type: K,
      listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
      options?: boolean | AddEventListenerOptions
    ): void;
    removeEventListener<K extends keyof HTMLElementEventMap>(
      type: K,
      listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
      options?: boolean | EventListenerOptions
    ): void;
  }

  // 🔍 DOM要素検索型
  interface ComponentQuerySelector {
    <T extends HTMLElement = HTMLElement>(selector: string): T | null;
  }

  interface ComponentQuerySelectorAll {
    <T extends HTMLElement = HTMLElement>(selector: string): NodeListOf<T>;
  }

  // 💾 ユーティリティ関数型
  interface HTMLEscapeFunction {
    (str: string | number | boolean): string;
  }

  interface LoadingMessageFunction {
    (category?: string): void;
  }

  type HTMLInputType = 'text' | 'number' | 'email' | 'tel' | 'password' | 'checkbox' | 'radio' | 'file' | 'hidden';

  // 📞 電話番号処理型
  interface PhoneNumberNormalizationResult {
    isValid: boolean;
    normalized: string;
    error?: string;
  }

  interface PhoneNumberFormatter {
    format(input: string): string;
    normalize(input: string): PhoneNumberNormalizationResult;
  }

  // 💾 キャッシュ・ストレージ型
  interface CacheData {
    [key: string]: any;
    timestamp: number;
    version?: string;
  }

  interface StorageManager {
    save(key: string, data: CacheData): void;
    load(key: string): CacheData | null;
    remove(key: string): void;
    clear(): void;
  }

  // 🔍 検索・フィルタリング型
  interface SearchResult<T = any> {
    items: T[];
    totalCount: number;
    hasMore: boolean;
  }

  interface FilterOptions {
    searchTerm?: string;
    dateRange?: [string, string];
    status?: string[];
    classroom?: string[];
  }

  // 🎛️ 会計・計算型
  interface AccountingCalculation {
    tuition: {
      items: AccountingItem[];
      subtotal: number;
    };
    sales: {
      items: AccountingItem[];
      subtotal: number;
    };
    grandTotal: number;
    paymentMethod: string;
    items: AccountingItem[];
  }

  interface AccountingBreakdown {
    category: 'tuition' | 'sales' | 'discount';
    items: AccountingItem[];
    subtotal: number;
  }

  interface AccountingItem {
    name: string;
    price: number;
    quantity?: number;
  }

  // 📱 モーダル・ダイアログ型
  interface ModalDialogConfig {
    title?: string;
    message: string;
    showCancel?: boolean;
    confirmText?: string;
    cancelText?: string;
    confirmColorClass?: string;
    onConfirm?: VoidCallback;
    onCancel?: VoidCallback;
  }

  interface ModalManager {
    show(config: ModalDialogConfig): void;
    hide(): void;
    executeCallback(): void;
  }

  // ⏰ 時間処理型
  interface TimeSlot {
    start: string; // HH:mm format
    end: string;   // HH:mm format
    isAvailable: boolean;
    capacity?: number;
    reserved?: number;
  }

  interface TimeProcessor {
    parseTime(timeString: string): { hours: number; minutes: number } | null;
    formatTime(hours: number, minutes: number): string;
    calculateDuration(start: string, end: string): number; // minutes
    isValidTimeRange(start: string, end: string): boolean;
  }

  // 🌐 グローバル関数拡張
  interface Window {
    // データフロー関連グローバル関数
    actionHandlers?: ActionHandlers;
    showLoading?: LoadingMessageFunction;
    hideLoading?: VoidCallback;
    showInfo?: (message: string, title?: string) => void;
    showConfirm?: (config: ModalDialogConfig) => void;
    handleServerError?: ErrorHandler;
    normalizePhoneNumberFrontend?: (phone: PhoneNumber) => PhoneNumberNormalizationResult;
    calculateAccountingDetails?: () => AccountingCalculation | null;
    getAccountingFormData?: () => AccountingFormData;
    updateSingleHistoryCard?: (reservationId: ReservationId) => void;
    findReservationById?: (reservationId: ReservationId, state?: UIState) => ReservationData | null;

    // UI基盤ブロック特化関数
    Components?: ComponentsObject;
    escapeHTML?: HTMLEscapeFunction;
    DesignConfig?: DesignSystemConfig;
    formatDate?: (dateString: DateString) => string;
    showModal?: (config: ModalDialogConfig) => void;
    hideModal?: VoidCallback;
  }

  // ===============================================
  // UI基盤ブロック特化：Core.js関数群型定義
  // ===============================================

  // 🔍 統一検索関数型定義
  interface ReservationSearchResult extends ReservationData {
    type: 'record' | 'booking';
  }

  interface UnifiedSearchFunctions {
    findReservationById: (reservationId: string, state?: UIState | null) => ReservationSearchResult | null;
    findReservationByDateAndClassroom: (date: string, classroom: string, state?: UIState | null) => ReservationSearchResult | null;
    findReservationsByStatus: (status: string, state?: UIState | null) => ReservationSearchResult[];
  }

  // 🧮 詳細化された会計計算型
  interface TimeBasedTuitionResult {
    price: number;
    item: AccountingItem;
    billableUnits: number;
  }

  interface CheckboxItemsCalculation {
    tuitionSubtotal: number;
    salesSubtotal: number;
    tuitionItems: AccountingItem[];
    salesItems: AccountingItem[];
    allItems: AccountingItem[];
  }

  interface DiscountCalculation {
    amount: number;
    item: AccountingItem;
  }

  interface MaterialCalculation {
    subtotal: number;
    items: AccountingItem[];
  }

  interface OtherSalesCalculation {
    subtotal: number;
    items: AccountingItem[];
  }

  // 🎯 会計計算関数型定義
  interface AccountingCalculationFunctions {
    calculateAccountingDetails: () => AccountingCalculation | null;
    calculateAccountingDetailsFromForm: () => AccountingCalculation;
    calculateTimeBasedTuition: (tuitionItemRule: AccountingMasterData) => TimeBasedTuitionResult | null;
    calculateCheckboxItems: () => CheckboxItemsCalculation;
    calculateDiscount: () => DiscountCalculation | null;
    calculateMaterials: () => MaterialCalculation;
    calculateOtherSales: () => OtherSalesCalculation;
    updateAccountingUI: (details: AccountingCalculation) => void;
    updateAccountingCalculation: () => void;
    setupAccountingEventListeners: () => void;
  }

  // 🏛️ DOM操作型安全性強化
  interface TypedHTMLFormElement extends HTMLFormElement {
    querySelectorAll<T extends HTMLElement = HTMLElement>(selectors: string): NodeListOf<T>;
    querySelector<T extends HTMLElement = HTMLElement>(selectors: string): T | null;
  }

  interface TypedHTMLInputElement extends HTMLInputElement {
    value: string;
    checked: boolean;
    dataset: DOMStringMap & {
      itemName?: string;
      itemType?: string;
      action?: string;
      [key: string]: string | undefined;
    };
  }

  interface TypedHTMLSelectElement extends HTMLSelectElement {
    value: string;
  }

  interface TypedHTMLTextAreaElement extends HTMLTextAreaElement {
    value: string;
  }

  // 📱 状態管理型安全性強化
  interface StateManagerEditMode {
    startEditMode: (reservationId: string) => void;
    endEditMode: (reservationId: string) => void;
    isInEditMode: (reservationId: string) => boolean;
    clearAllEditModes: () => void;
  }

  // 🚨 エラーハンドリング型定義
  interface FrontendErrorInfo {
    message: string;
    stack?: string;
    context: string;
    timestamp: string;
    userId: string;
    userAgent: string;
    url: string;
    additionalInfo: Record<string, any>;
  }

  interface FrontendErrorHandlerClass {
    handle: (error: Error, context?: string, additionalInfo?: Record<string, any>) => void;
    getUserFriendlyMessage: (error: Error, context: string) => string;
    isCriticalError: (error: Error) => boolean;
    reportError: (errorInfo: FrontendErrorInfo) => void;
    handleServerError: (serverError: any) => void;
    createAsyncHandler: (context: string) => (error: Error) => void;
    handleMultiple: (errors: Error[], context: string) => void;
    getUserMessage: (error: Error, context: string) => string;
  }

  interface ModalManagerObject {
    onConfirmCallback: (() => void) | null;
    setCallback: (callback: () => void) => void;
    clearCallback: () => void;
    executeCallback: () => void;
  }

  // ⏰ スケジュールデータ処理型
  interface ScheduleDataFunctions {
    getScheduleInfoFromCache: (date: string, classroom: string) => Promise<ScheduleInfo | null>;
    getScheduleDataFromLessons: (reservation: ReservationData) => ScheduleInfo | null;
    getClassroomTypeFromSchedule: (scheduleData: ScheduleInfo | null) => string | null;
    isTimeBasedClassroom: (scheduleData: ScheduleInfo | null) => boolean;
  }

  // 🛠️ ユーティリティ関数型
  interface CoreUtilityFunctions {
    getTuitionItemRule: (master: AccountingMasterData[], classroom: string, itemName: string) => AccountingMasterData | undefined;
    getTimeValue: (elementId: string, fallbackObject: any, fallbackKey: string) => string | null;
    processInitialData: (data: any, phone: string, lessons: LessonData[], myReservations?: ReservationData[] | null) => Partial<UIState>;
    detectEnvironment: () => 'test' | 'production';
    getEnvironmentData: (dataType: string, fallback?: any) => any;
  }

  // 📊 データ表示・UI更新型
  interface UIUpdateFunctions {
    updateSingleHistoryCard: (reservationId: string) => void;
    teardownAllListeners: () => void;
    addTrackedListener: (element: HTMLElement | null, type: string, listener: EventListener, options?: AddEventListenerOptions) => void;
    setupViewListener: () => void;
  }

  // 💾 キャッシュ管理型
  interface AccountingCacheFunctions {
    saveAccountingCache: (reservationId: string, accountingData: AccountingFormData) => void;
    loadAccountingCache: (reservationId: string) => AccountingFormData | null;
    clearAccountingCache: (reservationId: string) => void;
  }

  // 📱 フロントエンド初期化型
  interface FrontendInitialization {
    initializeStateManager?: () => void;
    MockData?: Record<string, any>;
  }

  // 🌐 Window型拡張（UI基盤ブロック特化）
  interface Window extends
    UnifiedSearchEngine,
    AccountingCalculationEngine,
    ScheduleDataProcessor,
    DataProcessingEngine,
    UIRenderingEngine,
    AccountingCacheManager,
    FrontendInitialization,
    SafeDOMElementAccess,
    ConfigurationInitialization,
    VisualOptimization,
    DynamicStyleManager {

    // エラーハンドリング
    FrontendErrorHandler?: FrontendErrorHandlerClass;
    ModalManager?: ModalManagerObject;

    // UI基盤コンポーネント
    Components?: ComponentsObject;
    escapeHTML?: HTMLEscapeFunction;
    DesignConfig?: DesignSystemConfig;

    // ページ遷移管理（11_WebApp_Config.js特化）
    pageTransitionManager?: PageTransitionManager;

    // UI基盤ユーティリティ
    formatDate?: (dateString: DateString) => string;
    showModal?: (config: ModalDialogConfig) => void;
    hideModal?: VoidCallback;
    showInfo?: (message: string, title?: string) => void;
    showConfirm?: (config: ModalDialogConfig) => void;
    showLoading?: LoadingMessageFunction;
    hideLoading?: VoidCallback;

    // 会計システム
    calculateAccountingDetailsFromForm?: () => AccountingCalculation;
    updateAccountingCalculation?: () => void;
    setupAccountingEventListeners?: () => void;

    // DOM要素型安全アクセス（上位互換）
    getElementById: <T extends HTMLElement = HTMLElementWithId>(id: string) => T | null;
    querySelector: <T extends HTMLElement = HTMLElement>(selector: string) => T | null;
    querySelectorAll: <T extends HTMLElement = HTMLElement>(selector: string) => NodeListOf<T>;
  }

  // 🌍 グローバル変数型定義（UI基盤特化）
  declare var Components: ComponentsObject;
  declare var escapeHTML: HTMLEscapeFunction;
  declare var DesignConfig: DesignSystemConfig;
  declare var formatDate: (dateString: string) => string;
  declare var ModalManager: ModalManagerObject;

  // 🔧 UI基盤ヘルパー関数グローバル露出
  // findReservationById: 実装ファイルで直接宣言（重複回避）
  // calculateAccountingDetails: 実装ファイルで直接宣言（重複回避）
  declare var normalizePhoneNumberFrontend: (phoneInput: string) => PhoneNumberNormalizationResult;
  declare var updateSingleHistoryCard: (reservationId: string) => void;

  // 📡 型安全なAPI通信ヘルパー関数
  interface APICallHelper {
    // 型安全なgoogle.script.run呼び出し
    callWithTypeSafety<TResponse>(
      methodName: keyof TypeSafeGoogleScriptAPI,
      ...args: any[]
    ): Promise<TResponse>;

    // 成功ハンドラー付きAPI呼び出し
    callWithSuccessHandler<TResponse>(
      methodName: string,
      successHandler: (response: TResponse) => void,
      errorHandler?: (error: Error) => void,
      ...args: any[]
    ): void;

    // Promise化されたAPI呼び出し
    promiseCall<TResponse>(
      methodName: string,
      ...args: any[]
    ): Promise<TResponse>;
  }

  declare var apiHelper: APICallHelper;
}

export {};

// 開発環境用モックデータ型
declare interface DevLesson {
  isFull: boolean;
  classroom: string;
  classroomType: string;
  date: string;
  venue: string;
  firstStart: string;
  firstEnd: string;
  secondStart: string;
  secondEnd: string;
  availableSlots: number;
  morningSlots: number;
  afternoonSlots: number;
}

declare interface DevReservation {
  reservationId: string;
  classroom: string;
  date: string;
  venue: string;
  startTime: string;
  endTime: string;
  status: string;
  studentId: string;
  workInProgress: string;
  order: string;
  message: string;
  materialInfo: string;
  chiselRental: boolean;
  firstLecture: boolean;
}

declare interface DevStudent {
  studentId: string;
  realName: string;
  displayName: string;
  phone: string;
}
