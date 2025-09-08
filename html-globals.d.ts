/**
 * HTML/フロントエンド環境用グローバル型定義
 * ブラウザ環境でのDOM API拡張と独自プロパティの定義
 */

// DOM要素の型拡張
declare interface Element {
  style: CSSStyleDeclaration;
  content?: string;
}

// HTMLElement の追加プロパティ
declare interface HTMLElement {
  content?: string;
}

// Window オブジェクトの拡張
declare interface Window {
  // 既存の定数（constants.d.tsからの継承）
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
  stateManager?: any;
  server?: any;
  
  // 設計定数（重複許可）
  DesignConfig?: {
    colors: any;
    buttons: any;
    modal: any;
    form: any;
  };
  
  // DOMクエリセレクタ結果の型安全性確保
  querySelector: (selectors: string) => (HTMLElement & {
    style: CSSStyleDeclaration;
    content?: string;
  }) | null;
}

// meta要素の content プロパティ
declare interface HTMLMetaElement {
  content: string;
}

// Tailwind CSS のグローバル定義
declare var tailwind: any;

// GAS WebApp 環境での server オブジェクト
declare var server: any;

export {};