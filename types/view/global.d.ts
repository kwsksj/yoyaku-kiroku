/**
 * =================================================================
 * 【ファイル名】: types/view/global.d.ts
 * 【役割】: フロントエンド グローバル型定義
 * 【目的】: Windowオブジェクトの拡張とグローバル関数の型定義
 * 【バージョン】: 1.0
 * =================================================================
 */

import type { ActionHandlers } from './handlers';

declare global {
  /**
   * Window オブジェクトの拡張
   * フロントエンド固有のグローバル関数とオブジェクトを定義
   */
  interface Window {
    /**
     * アプリケーション全体のメイン描画関数
     * stateManagerの現在の状態に基づいて適切なビューをレンダリングする
     */
    render: () => void;

    /**
     * アクションハンドラーオブジェクト
     * ユーザーアクションに対応する各種ハンドラー関数を含む
     */
    actionHandlers: ActionHandlers;
  }

  /**
   * グローバル関数：render
   * アプリケーション全体のメイン描画関数
   */
  function render(): void;

  /**
   * グローバル変数：actionHandlers
   * アクションハンドラーオブジェクト
   */
  const actionHandlers: ActionHandlers;
}

export {};
