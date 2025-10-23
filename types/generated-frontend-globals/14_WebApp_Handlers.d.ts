/**
 * 現在のアプリケーションの状態に基づいて、適切なビューを描画する
 * データ更新の必要性を判定し、必要に応じて最新データ取得後に再描画
 * handlersStateManager.getState().viewの値に応じて対応するビュー関数を呼び出してUIを更新
 */
export function render(): void;
/**
 * 会計画面での入力変更を処理します。
 * 合計金額の再計算と、入力内容のキャッシュ保存を行います。
 */
export function handleAccountingFormChange(): void;
/** @type {ActionHandlers} */
export let actionHandlers: ActionHandlers;
/** @type {ClassifiedAccountingItemsCore} */
export const EMPTY_CLASSIFIED_ITEMS: ClassifiedAccountingItemsCore;
/**
 * フロントエンド専用のWindow拡張
 * 主要な会計データとフラグを型安全に扱うためのラッパー
 */
export const windowTyped: any;
export type SimpleStateManager = import("./12_WebApp_StateManager.js").SimpleStateManager;
