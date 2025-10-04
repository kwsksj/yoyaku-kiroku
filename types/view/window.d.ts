/**
 * =================================================================
 * 【ファイル名】: types/view/window.d.ts
 * 【役割】: Window拡張とグローバル変数定義（フロントエンド固有）
 * 【バージョン】: 1.0
 * =================================================================
 */

/// <reference path="../core/index.d.ts" />
/// <reference path="../dto/index.d.ts" />

// =================================================================
// 一時データ型定義
// =================================================================

/**
 * 一時的な支払いデータ（会計確認フロー用）
 */
interface TempPaymentData {
  formData: AccountingFormDto;
  result: AccountingDetailsCore;
  classifiedItems: ClassifiedAccountingItemsCore;
  classroom: string;
}

/**
 * Googleサイト埋め込み環境の設定
 */
interface EmbedConfig {
  detectGoogleSiteOffset(): number;
  applyEmbedStyles(): void;
  saveOffset(offset: number): void;
  addOffsetControl(currentOffset: number): void;
  showOffsetAdjustment(): void;
  reapplyStyles(offset: number): void;
}

// =================================================================
// Window拡張
// =================================================================

declare global {
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
    DesignConfig?: {
      colors: any;
      buttons: any;
      modal: any;
      form: any;
    };

    // --- グローバル関数 ---
    showLoading?: (category?: string) => void;
    hideLoading?: () => void;
    showInfo?: (message: string, title?: string, callback?: (() => void) | null) => void;
    showConfirm?: (config: ModalDialogConfig | ConfirmDialogConfig) => void;
    showModal?: (config: ModalDialogConfig) => void;
    hideModal?: () => void;

    // --- ページ遷移 ---
    pageTransitionManager?: any;
    normalizePhoneNumberFrontend?: (
      phone: string,
    ) => {
      normalized: string;
      isValid: boolean;
      error?: string;
    };

    // --- 会計システム ---
    currentClassifiedItems?: ClassifiedAccountingItemsCore;
    currentClassroom?: string;
    collectFormData?: () => AccountingFormDto;
    accountingSystemCache?: Record<string, ClassifiedAccountingItemsCore>;
    tempPaymentData?: TempPaymentData;

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
  }
}

// =================================================================
// グローバル変数・関数宣言
// =================================================================

/** Tailwind CSS のグローバル定義 */
declare var tailwind: any;

/** GAS WebApp 環境での server オブジェクト */
declare var server: any;

/** marked.js ライブラリのグローバル宣言 */
declare const marked: {
  parse(markdown: string): string;
};

// 会計システム関連のグローバル関数
declare function collectFormData(): any;
declare function saveAccountingCache(data: any): void;
declare function loadAccountingCache(): any;
declare function calculateAccountingTotal(
  formData: any,
  masterData: any,
  classroom: string,
): any;
declare function updateAccountingCalculation(): void;
declare function setupAccountingEventListeners(): void;
declare function generateAccountingView(
  classifiedItems: any,
  classroom: string,
  formData?: any,
): string;
declare function getPaymentInfoHtml(selectedPaymentMethod?: string): string;
declare function getPaymentOptionsHtml(selectedValue?: string): string;
