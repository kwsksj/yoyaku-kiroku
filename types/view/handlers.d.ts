/**
 * =================================================================
 * 【ファイル名】: types/view/handlers.d.ts
 * 【役割】: EventHandler・ActionHandler型定義
 * 【バージョン】: 1.0
 * =================================================================
 */

import type { AccountingFormDto } from './state';
import type { AccountingDetailsCore } from '../core/accounting';

export type AccountingCalculationResult = AccountingDetailsCore;

// =================================================================
// 基本型定義
// =================================================================

export type DateString = string; // YYYY-MM-DD or various date formats
export type TimeString = string; // HH:MM format
export type ReservationId = string;
export type ClassroomName = string;
export type StudentId = string;
export type PhoneNumber = string;

export type VoidCallback = () => void;
export type AsyncVoidCallback = () => Promise<void>;

// =================================================================
// Event型定義
// =================================================================

/**
 * UIイベントデータ
 */
export interface UIEventData {
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
export interface ClickEventHandler {
  (event: MouseEvent): void;
}

/**
 * 変更イベントハンドラー
 */
export interface ChangeEventHandler {
  (event: Event): void;
}

/**
 * 入力イベントハンドラー
 */
export interface InputEventHandler {
  (event: Event): void;
}

/**
 * フォームイベントハンドラー
 */
export interface FormEventHandler {
  (event: Event): void;
}

/**
 * イベントハンドラー共通型
 */
export interface EventHandler<T = Event> {
  (event: T): void;
}

/**
 * 非同期イベントハンドラー
 */
export interface AsyncEventHandler<T = Event> {
  (event: T): Promise<void>;
}

/**
 * イベントハンドラー関数
 */
export interface EventHandlerFunction {
  (event: Event): void;
}

// =================================================================
// Action型定義
// =================================================================

/**
 * アクションハンドラーデータ
 */
export interface ActionHandlerData {
  [key: string]: any;
  // 共通プロパティ（実際のdata-*属性に対応）
  lessonId?: string;
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
export interface ActionHandler {
  (data?: ActionHandlerData): void | Promise<void>;
}

/**
 * アクションハンドラーズ（グローバル）
 */
export interface ActionHandlers {
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

  // 参加者リスト関連アクションハンドラー（管理者機能）
  loadParticipantsView?: (forceReload?: boolean) => void;
  selectParticipantsLesson?: (lessonId: string) => void;
  selectParticipantsStudent?: (targetStudentId: string) => void;
  backToParticipantsList?: () => void;
  backToParticipantsReservations?: () => void;

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
export interface UserInteraction {
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
export interface ErrorHandler {
  (error: Error | unknown, context?: string): void;
}

/**
 * フロントエンドエラー情報
 */
export interface FrontendErrorInfo {
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
export interface FrontendErrorHandlerClass {
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
export interface GenericCallback<T> {
  (data: T): void;
}

/**
 * 非同期汎用コールバック
 */
export interface AsyncGenericCallback<T> {
  (data: T): Promise<void>;
}

// =================================================================
// グローバル宣言
// =================================================================

declare global {
  /**
   * Window拡張（ハンドラー関連）
   */
  export interface Window {
    actionHandlers?: ActionHandlers;
    handleServerError?: ErrorHandler;
    FrontendErrorHandler?: FrontendErrorHandlerClass;
  }

  /**
   * FrontendErrorHandlerグローバル変数
   */
  var FrontendErrorHandler: FrontendErrorHandlerClass;
}
