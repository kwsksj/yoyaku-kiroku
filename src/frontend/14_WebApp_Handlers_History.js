// @ts-check
/// <reference path="../../types/dev-environment.d.ts" />
/// <reference path="../../types/html-environment.d.ts" />
/// <reference path="../../types/api-types.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 14_WebApp_Handlers_History.js
 * 【バージョン】: 1.0
 * 【役割】: WebAppのフロントエンドにおける、履歴管理関連の
 * アクションハンドラーを集約します。
 * 【構成】: 14ファイル構成から分割された履歴管理ファイル
 * 【機能範囲】:
 * - 履歴カード操作（展開・折りたたみ）
 * - インライン編集（メモ保存）
 * - 履歴表示制御（追加読み込み）
 * =================================================================
 */

// =================================================================
// --- History Management Action Handlers ---
// -----------------------------------------------------------------
// 履歴管理関連のアクションハンドラー群
// =================================================================

/** 履歴管理関連のアクションハンドラー群 */
const historyActionHandlers = {
  /** きろくカードの確認/編集ボタン
   * @param {ActionHandlerData} d */
  expandHistoryCard: d => {
    // 履歴データを取得
    const item = stateManager
      .getState()
      .myReservations.find(h => h.reservationId === d.reservationId);
    if (!item) return;

    // 編集モード状態をトグル
    const isCurrentlyEditing = stateManager.isInEditMode();

    if (isCurrentlyEditing) {
      // 編集モード解除
      stateManager.endEditMode();
    } else {
      // 編集モード開始
      stateManager.startEditMode();
    }

    // 該当カードのみを部分更新（ちらつき防止）
    updateSingleHistoryCard(d.reservationId);
  },

  /** インライン編集のメモを保存
   * @param {ActionHandlerData} d */
  saveInlineMemo: d => {
    // textarea要素から直接値を取得
    /** @type {HTMLTextAreaElement | null} */
    const textarea = document.querySelector(
      `[data-reservation-id="${d.reservationId}"] .memo-edit-textarea`,
    );
    if (!textarea) return;

    const newMemo = textarea.value;

    // 楽観的UI: まずフロントの表示を更新
    const state = window.stateManager.getState();
    const newReservations = state.myReservations.map(h => {
      if (h.reservationId === d.reservationId) {
        return { ...h, workInProgress: newMemo };
      }
      return h;
    });
    window.stateManager.dispatch({
      type: 'UPDATE_STATE',
      payload: { myReservations: newReservations },
    });

    // 編集モードを解除
    stateManager.endEditMode();

    showInfo('メモを保存しました');

    // 該当カードのみを部分更新（ちらつき防止）
    updateSingleHistoryCard(d.reservationId);

    // サーバーに送信
    showLoading('booking');
    google.script.run['withSuccessHandler']((/** @type {any} */ r) => {
      hideLoading();
      if (!r.success) {
        showInfo(r.message || 'メモの保存に失敗しました');
        // フロント表示を元に戻す
        updateSingleHistoryCard(d.reservationId);
      }
    })
      ['withFailureHandler'](handleServerError)
      .updateReservationMemoAndGetLatestData(
        d.reservationId,
        stateManager.getState().currentUser.studentId,
        newMemo,
      );
  },

  /** 参加記録を追加で読み込みます（統合ホーム用） */
  loadMoreHistory: () => {
    const currentCount = stateManager.getState()['recordsToShow'] || 10;
    const newCount =
      Number(currentCount) + (CONSTANTS.UI.HISTORY_LOAD_MORE_RECORDS || 10);

    window.stateManager.dispatch({
      type: 'SET_STATE',
      payload: { recordsToShow: newCount },
    });
  },
};