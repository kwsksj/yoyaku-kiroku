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
    // スクロール位置を保存
    const scrollY = window.scrollY;

    // 履歴データを取得
    const item = stateManager
      .getState()
      .myReservations.find(h => h.reservationId === d.reservationId);
    if (!item) return;

    // 編集モード開始（メモの初期値を設定）
    const currentMemo = item.workInProgress || '';
    stateManager.startEditMode(d.reservationId, currentMemo);

    // 該当カードのみを部分更新（ちらつき防止）
    updateSingleHistoryCard(d.reservationId);

    // スクロール位置を復元
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY);
    });
  },

  /** 編集モードを編集せずに閉じる
   * @param {ActionHandlerData} d */
  closeEditMode: d => {
    // スクロール位置を保存
    const scrollY = window.scrollY;

    // 編集モードを解除（変更を破棄）
    stateManager.endEditMode(d.reservationId);

    // 該当カードのみを部分更新（ちらつき防止）
    updateSingleHistoryCard(d.reservationId);

    // スクロール位置を復元
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY);
    });
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
    stateManager.endEditMode(d.reservationId);

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

  // 新しいアクション：保存と同時に編集モードを終了
  saveAndCloseMemo: function (d) {
    // ボタンからreservationIdが渡された場合
    if (d && d.reservationId) {
      // thisを使って同じオブジェクト内のsaveInlineMemoを呼び出し
      this.saveInlineMemo(d);
    } else {
      console.warn('保存対象のreservationIdが見つかりません');
    }
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
