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

// Window拡張はtypes/index.d.tsで統一管理されています
// HTML環境固有の拡張のみここで定義

// DOMクエリセレクタ結果の型安全性確保
declare interface Window {
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