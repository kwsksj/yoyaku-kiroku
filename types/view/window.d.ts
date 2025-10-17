/**
 * =================================================================
 * 【ファイル名】: types/view/window.d.ts
 * 【役割】: Window拡張とグローバル変数定義（フロントエンド固有）
 * 【バージョン】: 1.0
 * =================================================================
 */

import type { DesignSystemConfig } from './design-system';
import type {
  ModalDialogConfig,
  ConfirmDialogConfig,
} from './components';
import type { AccountingFormDto, SimpleStateManager, ViewType } from './state';
import type {
  AccountingDetailsCore,
  ClassifiedAccountingItemsCore,
} from '../core/accounting';
import type { ReservationCore } from '../core/reservation';

// =================================================================
// 共有定数型エイリアス
// =================================================================

export type Constants = typeof import('../generated-shared-globals/00_Constants').CONSTANTS;
export type StatusConstants = typeof import('../generated-shared-globals/00_Constants').CONSTANTS.STATUS;
export type UIConstants = typeof import('../generated-shared-globals/00_Constants').CONSTANTS.UI;
export type MessagesConstants = typeof import('../generated-shared-globals/00_Constants').CONSTANTS.MESSAGES;
export type BankInfoConstants = typeof import('../generated-shared-globals/00_Constants').CONSTANTS.BANK_INFO;
export type PaymentDisplayConstants = typeof import('../generated-shared-globals/00_Constants').CONSTANTS.PAYMENT_DISPLAY;
export type HeadersConstants = typeof import('../generated-shared-globals/00_Constants').CONSTANTS.HEADERS;

// =================================================================
// 一時データ型定義
// =================================================================

/**
 * 一時的な支払いデータ（会計確認フロー用）
 */
export interface TempPaymentData {
  formData: AccountingFormDto;
  result: AccountingDetailsCore;
  classifiedItems: ClassifiedAccountingItemsCore;
  classroom: string;
}

/**
 * Googleサイト埋め込み環境の設定
 */
export interface EmbedConfig {
  detectGoogleSiteOffset(): number;
  applyEmbedStyles(): void;
  saveOffset(offset: number): void;
  addOffsetControl(currentOffset: number): void;
  showOffsetAdjustment(): void;
  reapplyStyles(offset?: number): void;
}

/**
 * ページ遷移マネージャー
 */
export interface PageTransitionManager {
  goTo?(viewName: string, context?: any): void;
  back?(): void;
  getCurrentView?(): string;
  onPageTransition?(newView: ViewType): void;
  initializePage?(): void;
  onModalOpen?(): void;
  onModalClose?(): void;
  handleViewChange?(newView: string | null, isModalTransition: boolean): void;
  resetScrollPosition?(): void;
  setScrollPosition?(position: number): void;
  saveScrollPosition?(): void;
  restoreScrollPosition?(): void;
  [key: string]: any;
}

/**
 * モーダルマネージャー
 */
export interface ModalManager {
  onConfirmCallback: (() => void) | null;
  show(config: any): void;
  hide(): void;
  showConfirm(config: any): void;
  showInfo(message: string, title?: string): void;
  setCallback(callback: () => void): void;
  clearCallback(): void;
  executeCallback(): void;
}

declare global {

  // =================================================================
  // Window拡張
  // =================================================================

  interface Window {
    // --- 定数オブジェクト ---
    CONSTANTS: Constants;
    C: Constants;
    STATUS: StatusConstants;
    UI: UIConstants;
    MESSAGES: MessagesConstants;
    BANK: BankInfoConstants;
    PAYMENT: PaymentDisplayConstants;
    HEADERS: HeadersConstants;

    // --- 状態管理 ---
    stateManager: SimpleStateManager;
    render?: () => void;

    // --- デザイン設定 ---
    DesignConfig?: DesignSystemConfig;

    // --- グローバル関数 ---
    showLoading?: (category?: string) => void;
    hideLoading?: () => void;
    showInfo?: (message: string, title?: string, callback?: (() => void) | null) => void;
    showConfirm?: (config: ModalDialogConfig | ConfirmDialogConfig) => void;
    showModal?: (config: ModalDialogConfig) => void;
    hideModal?: () => void;
    escapeHTML?: (text: string) => string;
    debugLog?: (message: string, ...args: any[]) => void;
    updateView?: (viewName: string) => void;
    formatDate?: (date: string | Date, format?: string) => string;

    // --- ページ遷移 ---
    pageTransitionManager?: PageTransitionManager;
    normalizePhoneNumberFrontend?: (
      phone: string,
    ) => {
      normalized: string;
      isValid: boolean;
      error?: string;
    };

    // --- 会計システム ---
    currentClassifiedItems?: ClassifiedAccountingItemsCore | null;
    currentClassroom?: string | null;
    collectFormData?: () => AccountingFormDto;
    accountingSystemCache?: Record<string, ClassifiedAccountingItemsCore>;
    tempPaymentData?: TempPaymentData | null;
    paymentProcessing?: boolean;
    accountingCalculationTimeout?: any;

    // --- 埋め込み環境 ---
    EmbedConfig?: EmbedConfig;

    // --- 環境フラグ ---
    isProduction: boolean;

    // --- 状態管理初期化 ---
    initializeStateManager?: () => void;

    // --- パフォーマンスログ ---
    PerformanceLog?: {
      debug(message: string, ...args: any[]): void;
      info(message: string, ...args: any[]): void;
      error(message: string, ...args: any[]): void;
    };

    // --- エラーハンドラー ---
    FrontendErrorHandler?: {
      handle(error: Error): void;
      logError(error: Error): void;
      [key: string]: any;
    };

    // --- アクションハンドラー ---
    actionHandlers?: Record<string, (...args: any[]) => void>;

    // --- テストデータ ---
    MockData?: Record<string, unknown>;

    // --- Google Apps Script WebApp API ---
    google: {
      script: {
        run: {
          [key: string]: (...args: any[]) => any;
        };
        host: {
          close(): void;
          setWidth(width: number): void;
          setHeight(height: number): void;
        };
      };
    };

    // --- 外部ライブラリ ---
    tailwind?: any;
    server?: any;
    ModalManager?: ModalManager;
  }

  /**
   * Window と globalThis を統合した型
   */
  var tailwind: any;
  var server: any;
  const marked: {
    parse(markdown: string): string;
  };

  function collectFormData(): any;
  function saveAccountingCache(data: any): void;
  function loadAccountingCache(): any;
  function calculateAccountingTotal(
    formData: any,
    masterData: any,
    classroom: string,
  ): any;

  function escapeHTML(text: string): string;
  function debugLog(message: string, ...args: any[]): void;
  function updateView(viewName: string): void;
  function formatDate(date: string | Date, format?: string): void;
  function showInfo(
    message: string,
    title?: string,
    callback?: (() => void) | null,
  ): void;
  function showLoading(category?: string): void;
  function hideLoading(): void;
  function showConfirm(config: any): void;

  var stateManager: SimpleStateManager;
  var DesignConfig: DesignSystemConfig;

  const google: {
    script: {
      run: {
        withSuccessHandler(callback: (result: any) => void): any;
        withFailureHandler(callback: (error: Error) => void): any;
        withUserObject(userObject: any): any;
        [key: string]: any;
      };
      host: {
        close(): void;
        setWidth(width: number): void;
        setHeight(height: number): void;
      };
    };
  };

  function updateAccountingCalculation(
    classifiedItems: ClassifiedAccountingItemsCore,
    classroom: string,
  ): void;
  function setupAccountingEventListeners(
    classifiedItems: ClassifiedAccountingItemsCore,
    classroom: string,
  ): void;
  function generateAccountingView(
    classifiedItems: ClassifiedAccountingItemsCore,
    classroom: string,
    formData?: AccountingFormDto,
    reservationData?: ReservationCore | null,
  ): string;
  function getPaymentInfoHtml(selectedPaymentMethod?: string): string;
  function getPaymentOptionsHtml(selectedValue?: string): string;

  var appWindow: Window & typeof globalThis;
}

export type AppWindow = Window & typeof globalThis;

export {};