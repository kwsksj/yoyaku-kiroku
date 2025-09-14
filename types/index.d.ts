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
/// <reference path="../gas-globals.d.ts" />
/// <reference path="../html-globals.d.ts" />
/// <reference path="../src/types.d.ts" />

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

// =================================================================
// GAS環境グローバル型定義（gas-globals.d.tsより統合）
// =================================================================

declare var SS_MANAGER: SpreadsheetManager;
declare var CONSTANTS: Constants;
declare var STATUS: StatusConstants;
declare var UI: UIConstants;
declare var CLASSROOMS: ClassroomsConstants;
declare var ITEMS: ItemsConstants;
declare var SCHEDULE_STATUS_CANCELLED: string;
declare var SCHEDULE_STATUS_COMPLETED: string;
declare var SCHEDULE_STATUS_SCHEDULED: string;
declare var DEBUG_ENABLED: boolean;

// SpreadsheetManagerクラス
declare class SpreadsheetManager {
  constructor();
  getSheet(sheetName: string): GoogleAppsScript.Spreadsheet.Sheet;
  getSpreadsheet(): GoogleAppsScript.Spreadsheet.Spreadsheet;
  clearCache(): void;
  static getInstance(): SpreadsheetManager;
}

// =================================================================
// 型定義の再エクスポート（型安全性確保）
// =================================================================

// API型定義（api-types.d.tsより）
export type {
  ReservationInfo,
  UserInfo,
  ReservationOptions,
  LessonSchedule,
  LessonStatus,
  Lesson,
  ApiResponse
} from './api-types.d.ts';

// アプリケーション型定義（src/types.d.tsより）
export type {
  AppState,
  StateManager
} from '../src/types.d.ts';

// 定数型定義（constants.d.tsより）
export type {
  Constants,
  ClassroomsConstants,
  StatusConstants,
  UIConstants,
  MessagesConstants,
  BankInfoConstants,
  PaymentDisplayConstants,
  HeadersConstants
} from './constants.d.ts';

// =================================================================
// 共通ユーティリティ型（プロジェクト全体で使用）
// =================================================================

/**
 * プロパティをオプショナルにする型ユーティリティ
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * プロパティを必須にする型ユーティリティ
 */
export type Required<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * API レスポンス型のジェネリック定義
 */
export interface ApiResponseGeneric<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

/**
 * エラー情報型
 */
export interface ErrorInfo {
  code: string;
  message: string;
  context?: string;
  timestamp?: Date;
}

// =================================================================
// 型ガード関数（ランタイム型チェック用）
// =================================================================

/**
 * ReservationInfo型ガード
 */
export function isReservationInfo(obj: any): obj is ReservationInfo {
  return obj && 
    typeof obj.date === 'string' &&
    typeof obj.startTime === 'string' &&
    typeof obj.endTime === 'string' &&
    typeof obj.classroom === 'string';
}

/**
 * ApiResponse型ガード
 */
export function isApiResponse(obj: any): obj is ApiResponse {
  return obj && typeof obj.success === 'boolean';
}

/**
 * Lesson型ガード
 */
export function isLesson(obj: any): obj is Lesson {
  return obj && 
    obj.schedule &&
    obj.status &&
    typeof obj.schedule.classroom === 'string' &&
    typeof obj.status.isFull === 'boolean';
}

// =================================================================
// 開発支援用型定義
// =================================================================

/**
 * デバッグ情報型
 */
export interface DebugInfo {
  enabled: boolean;
  level: 'error' | 'warn' | 'info' | 'debug';
  context?: string;
}

/**
 * 環境設定型
 */
export interface EnvironmentConfig {
  isDevelopment: boolean;
  isProduction: boolean;
  apiEndpoint?: string;
  debugLevel?: DebugInfo['level'];
}

// =================================================================
// モジュール拡張（既存ライブラリの型拡張）
// =================================================================

declare module 'google-apps-script' {
  namespace GoogleAppsScript {
    namespace Spreadsheet {
      interface Sheet {
        // カスタムメソッドの型定義（必要に応じて追加）
      }
    }
  }
}

export {};