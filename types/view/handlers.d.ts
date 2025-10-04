/**
 * =================================================================
 * 【ファイル名】: types/view/handlers.d.ts
 * 【役割】: EventHandler・ActionHandler型定義
 * 【バージョン】: 1.0
 * =================================================================
 */

// =================================================================
// 基本型定義
// =================================================================

type DateString = string; // YYYY-MM-DD or various date formats
type TimeString = string; // HH:MM format
type ReservationId = string;
type ClassroomName = string;
type StudentId = string;
type PhoneNumber = string;

type VoidCallback = () => void;
type AsyncVoidCallback = () => Promise<void>;

// =================================================================
// Event型定義
// =================================================================

/**
 * UIイベントデータ
 */
interface UIEventData {
  type: 'click' | 'change' | 'input' | 'submit' | 'keydown' | 'keyup';
  target: HTMLElement;
  currentTarget: HTMLElement;
  action?: string;
  data?: ActionHandlerData;
  originalEvent: Event;
}

/**
 * クリックイベントハンドラー
 */
interface ClickEventHandler {
  (event: MouseEvent): void;
}

/**
 * 変更イベントハンドラー
 */
interface ChangeEventHandler {
  (event: Event): void;
}

/**
 * 入力イベントハンドラー
 */
interface InputEventHandler {
  (event: Event): void;
}

/**
 * フォームイベントハンドラー
 */
interface FormEventHandler {
  (event: Event): void;
}

/**
 * イベントハンドラー共通型
 */
interface EventHandler<T = Event> {
  (event: T): void;
}

/**
 * 非同期イベントハンドラー
 */
interface AsyncEventHandler<T = Event> {
  (event: T): Promise<void>;
}

/**
 * イベントハンドラー関数
 */
interface EventHandlerFunction {
  (event: Event): void;
}

// =================================================================
// Action型定義
// =================================================================

/**
 * アクションハンドラーデータ
 */
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

/**
 * アクションハンドラー
 */
interface ActionHandler {
  (data?: ActionHandlerData): void | Promise<void>;
}

/**
 * アクションハンドラーズ（グローバル）
 */
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
  showAccountingConfirmation: (
    result?: AccountingCalculationResult,
    formData?: AccountingFormDto,
  ) => void;

  // 動的に取り込まれる関数（レガシー対応）
  [actionName: string]:
    | ActionHandler
    | ((param: any) => void)
    | ((param1: any, param2: any) => void)
    | undefined;
}

// =================================================================
// ユーザーインタラクション
// =================================================================

/**
 * ユーザーアクション・操作型
 */
interface UserInteraction {
  type: 'click' | 'input' | 'change' | 'submit';
  target: HTMLElement;
  data?: ActionHandlerData;
  preventDefault?: boolean;
  stopPropagation?: boolean;
}

// =================================================================
// エラーハンドラー
// =================================================================

/**
 * エラーハンドラー型
 */
interface ErrorHandler {
  (error: Error | unknown, context?: string): void;
}

/**
 * フロントエンドエラー情報
 */
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

/**
 * フロントエンドエラーハンドラークラス
 */
interface FrontendErrorHandlerClass {
  handle: (
    error: Error,
    context?: string,
    additionalInfo?: Record<string, any>,
  ) => void;
  getUserFriendlyMessage: (error: Error, context: string) => string;
  isCriticalError: (error: Error) => boolean;
  reportError: (errorInfo: FrontendErrorInfo) => void;
  handleServerError: (serverError: any) => void;
  createAsyncHandler: (context: string) => (error: Error) => void;
  handleMultiple: (errors: Error[], context: string) => void;
  getUserMessage: (error: Error, context: string) => string;
}

// =================================================================
// コールバック型
// =================================================================

/**
 * 汎用コールバック
 */
interface GenericCallback<T> {
  (data: T): void;
}

/**
 * 非同期汎用コールバック
 */
interface AsyncGenericCallback<T> {
  (data: T): Promise<void>;
}

// =================================================================
// グローバル宣言
// =================================================================

declare global {
  /**
   * Window拡張（ハンドラー関連）
   */
  interface Window {
    actionHandlers?: ActionHandlers;
    handleServerError?: ErrorHandler;
    FrontendErrorHandler?: FrontendErrorHandlerClass;
  }

  /**
   * FrontendErrorHandlerグローバル変数
   */
  var FrontendErrorHandler: FrontendErrorHandlerClass;
}
