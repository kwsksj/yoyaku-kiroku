/**
 * =================================================================
 * 【ファイル名】: types/view/dom.d.ts
 * 【役割】: DOM型拡張とHTML要素型定義
 * 【バージョン】: 1.0
 * =================================================================
 */

// =================================================================
// HTML要素拡張
// =================================================================

/**
 * meta要素の content プロパティ
 */
declare interface HTMLMetaElement {
  content: string;
}

/**
 * ID付きHTML要素（拡張）
 */
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
    details?: string;
    [key: string]: string | undefined;
  };
}

/**
 * 共通プロパティ付き要素
 */
interface ElementWithCommonProperties {
  style: CSSStyleDeclaration;
  content?: string;
  focus?: () => void;
  disabled?: boolean;
  value?: string;
  checked?: boolean;
}

// =================================================================
// 型安全なDOM操作
// =================================================================

/**
 * 型安全なDOM要素アクセス
 */
interface SafeDOMElementAccess {
  getElementById<T extends HTMLElement = HTMLElement>(id: string): T | null;
  querySelector<T extends HTMLElement = HTMLElement>(
    selector: string,
  ): T | null;
  querySelectorAll<T extends HTMLElement = HTMLElement>(
    selector: string,
  ): NodeListOf<T>;
}

/**
 * 型安全なフォーム要素アクセス
 */
interface TypedFormElements {
  getElementById(id: string): HTMLFormElement | null;
  querySelector(selector: string): HTMLFormElement | null;
  querySelectorAll(
    selector: string,
  ): NodeListOf<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;
}

/**
 * 型付きDocument
 */
interface TypedDocument extends Document {
  getElementById<T extends HTMLElement = HTMLElementWithId>(
    elementId: string,
  ): T | null;
  querySelector<T extends HTMLElement = HTMLElement>(
    selector: string,
  ): T | null;
  querySelectorAll<T extends HTMLElement = HTMLElement>(
    selector: string,
  ): NodeListOf<T>;
}

/**
 * 型付き要素を持つDocument
 */
interface DocumentWithTypedElements extends Document {
  getElementById<T extends HTMLElement = HTMLElementWithId>(
    elementId: string,
  ): T | null;
}

/**
 * 安全な要素取得
 */
interface SafeElementGetter {
  <T extends HTMLInputElement>(id: string, type: 'input'): T | null;
  <T extends HTMLSelectElement>(id: string, type: 'select'): T | null;
  <T extends HTMLTextAreaElement>(id: string, type: 'textarea'): T | null;
  <T extends HTMLFormElement>(id: string, type: 'form'): T | null;
  <T extends HTMLButtonElement>(id: string, type: 'button'): T | null;
  <T extends HTMLElementWithId>(id: string): T | null;
}

/**
 * DOM要素安全アクセス
 */
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
  getElementsByDataAttribute(
    attribute: string,
    value: string,
  ): NodeListOf<HTMLElement>;
}

/**
 * 安全な要素アクセス
 */
interface SafeElementAccess {
  getElementById(
    id: string,
  ): (HTMLElement & ElementWithCommonProperties) | null;
  querySelector(
    selector: string,
  ): (HTMLElement & ElementWithCommonProperties) | null;
  querySelectorAll(
    selector: string,
  ): NodeListOf<HTMLElement & ElementWithCommonProperties>;
}

// =================================================================
// 型付きHTML要素
// =================================================================

/**
 * 型付きHTMLフォーム要素
 */
interface TypedHTMLFormElement extends HTMLFormElement {
  querySelectorAll<T extends HTMLElement = HTMLElement>(
    selectors: string,
  ): NodeListOf<T>;
  querySelector<T extends HTMLElement = HTMLElement>(
    selectors: string,
  ): T | null;
}

/**
 * 型付きHTMLインプット要素
 */
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

/**
 * 型付きHTMLセレクト要素
 */
interface TypedHTMLSelectElement extends HTMLSelectElement {
  value: string;
}

/**
 * 型付きHTMLテキストエリア要素
 */
interface TypedHTMLTextAreaElement extends HTMLTextAreaElement {
  value: string;
}

// =================================================================
// イベントリスナー型
// =================================================================

/**
 * HTML要素イベントリスナー
 */
interface HTMLElementEventListeners {
  addEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
    options?: boolean | EventListenerOptions,
  ): void;
}

// =================================================================
// クエリセレクター型
// =================================================================

/**
 * コンポーネントクエリセレクター
 */
interface ComponentQuerySelector {
  <T extends HTMLElement = HTMLElement>(selector: string): T | null;
}

/**
 * コンポーネントクエリセレクターAll
 */
interface ComponentQuerySelectorAll {
  <T extends HTMLElement = HTMLElement>(selector: string): NodeListOf<T>;
}
