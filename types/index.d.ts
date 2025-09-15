/**
 * =================================================================
 * 【ファイル名】: types/index.d.ts
 * 【役割】: プロジェクト全体の統合型定義エントリポイント
 * 【目的】: 分散した型定義を統合し、開発体験とAI支援を最適化
 * =================================================================
 */

/// <reference types="google-apps-script" />

// 既存型定義ファイルの参照
/// <reference path="./constants.d.ts" />
/// <reference path="./api-types.d.ts" />
/// <reference path="./gas-environment.d.ts" />
/// <reference path="./html-environment.d.ts" />
/// <reference path="./dev-environment.d.ts" />

// =================================================================
// 統合Window インターフェース（重複定義の解消）
// =================================================================

declare global {
  interface Window {
    // 定数オブジェクト（constants.d.ts より統合）
    CONSTANTS: Constants;
    C: Constants;
    STATUS: StatusConstants;
    UI: UIConstants;
    MESSAGES: MessagesConstants;
    BANK: BankInfoConstants;
    PAYMENT: PaymentDisplayConstants;
    HEADERS: HeadersConstants;

    // フロントエンド固有のグローバル変数
    tailwind?: any;
    stateManager?: StateManager;
    server?: any;

    // 設計定数
    DesignConfig?: {
      colors: any;
      buttons: any;
      modal: any;
      form: any;
    };

    // Google Apps Script WebApp API
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

    // フロントエンド環境固有
    isProduction: boolean;
    render: () => void;
    pageTransitionManager: any;
    normalizePhoneNumberFrontend: (phone: string) => {
      normalized: string;
      isValid: boolean;
      error?: string;
    };

    // 状態管理初期化
    initializeStateManager?: () => void;
  }
}
