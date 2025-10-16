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

const historyStateManager = appWindow.stateManager;

/** 履歴管理関連のアクションハンドラー群 */
export const historyActionHandlers = {
  /** きろくカードの確認/編集ボタン
   * @param {ActionHandlerData} d */
  expandHistoryCard: d => {
    // スクロール位置を保存
    const scrollY = window.scrollY;

    // 履歴データを取得
    const item = historyStateManager
      .getState()
      .myReservations.find(
        (/** @type {ReservationCore} */ h) =>
          h.reservationId === d.reservationId,
      );
    if (!item) return;

    // 編集モード開始（メモの初期値を設定）
    const currentMemo = item.workInProgress || '';
    if (d.reservationId) {
      historyStateManager.startEditMode(d.reservationId, currentMemo);
    }

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
    if (d.reservationId) {
      historyStateManager.endEditMode(d.reservationId);
    }

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
    const state = historyStateManager.getState();
    const newReservations = state.myReservations.map(
      (/** @type {ReservationCore} */ h) => {
        if (h.reservationId === d.reservationId) {
          return { ...h, workInProgress: newMemo };
        }
        return h;
      },
    );
    historyStateManager.dispatch({
      type: 'UPDATE_STATE',
      payload: { myReservations: newReservations },
    });

    // 編集モードを解除
    if (d.reservationId) {
      historyStateManager.endEditMode(d.reservationId);
    }

    showInfo('メモを保存しました', '保存完了');

    // 該当カードのみを部分更新（ちらつき防止）
    if (d.reservationId) {
      updateSingleHistoryCard(d.reservationId);
    }

    // サーバーに送信
    const currentUser = historyStateManager.getState().currentUser;
    if (!currentUser || !d.reservationId) {
      return showInfo('ユーザー情報が見つかりません', 'エラー');
    }

    showLoading('booking');
    google.script.run['withSuccessHandler']((/** @type {any} */ r) => {
      hideLoading();
      if (!r.success) {
        showInfo(r.message || 'メモの保存に失敗しました', 'エラー');
        // フロント表示を元に戻す
        if (d.reservationId) {
          updateSingleHistoryCard(d.reservationId);
        }
      }
    })
      ['withFailureHandler'](handleServerError)
      .updateReservationMemoAndGetLatestData(
        d.reservationId,
        currentUser.studentId,
        newMemo,
      );
  },

  // 新しいアクション：保存と同時に編集モードを終了
  saveAndCloseMemo: function (/** @type {any} */ d) {
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
    const currentCount = historyStateManager.getState()['recordsToShow'] || 10;
    const newCount =
      Number(currentCount) + (CONSTANTS.UI.HISTORY_LOAD_MORE_RECORDS || 10);

    historyStateManager.dispatch({
      type: 'SET_STATE',
      payload: { recordsToShow: newCount },
    });
  },

  /** 会計記録を表示するモーダル
   * @param {ActionHandlerData} d */
  showHistoryAccounting: d => {
    // 予約データを取得
    const state = historyStateManager.getState();
    const reservation = state.myReservations.find(
      (/** @type {ReservationCore} */ r) => r.reservationId === d.reservationId,
    );

    if (!reservation) {
      showInfo('予約データが見つかりません', 'エラー');
      return;
    }

    // 会計詳細データを予約シートから取得
    showLoading('会計記録を読み込み中...');
    google.script.run['withSuccessHandler']((/** @type {any} */ response) => {
      hideLoading();
      if (response.success) {
        // 会計詳細をモーダルで表示
        let details = response.data.accountingDetails || '';

        // JSONオブジェクトの場合は整形してHTML表示
        if (typeof details === 'object' && details !== null) {
          const accounting = details;
          let formattedHtml = '';

          // 授業料情報
          if (accounting.tuition && accounting.tuition.items) {
            formattedHtml += '<div class="mb-4">';
            formattedHtml +=
              '<h4 class="font-medium text-brand-text mb-2">【授業料】</h4>';
            formattedHtml += '<div class="text-sm space-y-1">';
            accounting.tuition.items.forEach((/** @type {any} */ item) => {
              formattedHtml += `<div>・${item.name}: ¥${item.price?.toLocaleString() || 0}</div>`;
            });
            formattedHtml += `<div class="font-medium">小計: ¥${accounting.tuition.subtotal?.toLocaleString() || 0}</div>`;
            formattedHtml += '</div></div>';
          }

          // 販売情報
          if (
            accounting.sales &&
            accounting.sales.items &&
            accounting.sales.items.length > 0
          ) {
            formattedHtml += '<div class="mb-4">';
            formattedHtml +=
              '<h4 class="font-medium text-brand-text mb-2">【販売】</h4>';
            formattedHtml += '<div class="text-sm space-y-1">';
            accounting.sales.items.forEach((/** @type {any} */ item) => {
              formattedHtml += `<div>・${item.name}: ¥${item.price?.toLocaleString() || 0}</div>`;
            });
            formattedHtml += `<div class="font-medium">小計: ¥${accounting.sales.subtotal?.toLocaleString() || 0}</div>`;
            formattedHtml += '</div></div>';
          }

          // 合計と支払方法
          formattedHtml += '<div class="border-t pt-3 mt-3">';
          if (accounting.grandTotal !== undefined) {
            formattedHtml += `<div class="text-lg font-bold text-brand-text">【合計】¥${accounting.grandTotal?.toLocaleString() || 0}</div>`;
          }
          if (accounting.paymentMethod) {
            formattedHtml += `<div class="text-sm text-brand-subtle mt-2">【支払方法】${accounting.paymentMethod}</div>`;
          }
          formattedHtml += '</div>';

          details =
            formattedHtml ||
            '<div class="text-gray-500">会計記録の詳細情報がありません</div>';
        } else if (typeof details === 'string' && details.trim() === '') {
          details = '<div class="text-gray-500">会計記録がありません</div>';
        } else {
          // 文字列の場合は改行をHTMLの<br>に変換
          details = `<div class="whitespace-pre-wrap text-sm">${details.replace(/\n/g, '<br>')}</div>`;
        }

        const headerInfo = `<div class="text-sm text-brand-subtle mb-4">
            <div><strong>日付:</strong> ${formatDate(String(reservation.date))}</div>
            <div><strong>教室:</strong> ${reservation.classroom}</div>
          </div>`;

        // モーダルを動的に作成して表示
        const modalId = 'accounting-details-modal';
        const modalHtml = Components.modal({
          id: modalId,
          title: '会計記録',
          content: headerInfo + details,
          maxWidth: 'max-w-lg',
        });

        // 既存のモーダルがあれば削除
        const existingModal = document.getElementById(modalId);
        if (existingModal) {
          existingModal.remove();
        }

        // モーダルをDOMに追加
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // モーダルを表示
        Components.showModal(modalId);
      } else {
        showInfo(response.message || '会計記録の取得に失敗しました', 'エラー');
      }
    })
      ['withFailureHandler']((/** @type {Error} */ error) => {
        hideLoading();
        handleServerError(error);
      })
      .getAccountingDetailsFromSheet(d.reservationId);
  },
};
