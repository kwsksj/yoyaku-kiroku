/**
 * =================================================================
 * ファイル概要
 * -----------------------------------------------------------------
 * 名称: 14_WebApp_Handlers_Message.js
 * 目的: 先生へのメッセージ送信機能を処理する
 * 主な責務:
 *   - ダッシュボードからの「先生へ連絡」モーダル表示
 *   - メッセージ送信処理とバックエンドへの記録
 * =================================================================
 */

// ================================================================
// ユーティリティ系モジュール
// ================================================================
import { handleServerError } from './12_WebApp_Core_ErrorHandler.js';

// =================================================================
// --- Message Action Handlers ---
// -----------------------------------------------------------------
// 先生へのメッセージ送信に関するアクションハンドラー群
// =================================================================

const messageHandlersStateManager = appWindow.stateManager;

/**
 * 先生へのメッセージ送信に関するアクションハンドラー
 */
export const messageActionHandlers = {
  /**
   * 先生へメッセージを送信するモーダルを表示
   */
  showMessageToTeacherModal: () => {
    const confirmMessage = `
      <div class="text-left space-y-4">
        <p class="text-center font-bold">先生へのメッセージ</p>
        <p class="text-sm text-brand-subtle text-center">質問や連絡事項があればお書きください</p>
        <div class="pt-2">
          <textarea id="teacher-message-input" class="w-full p-3 border-2 border-ui-border rounded" rows="5" placeholder="メッセージを入力してください"></textarea>
        </div>
      </div>
    `;

    showConfirm({
      title: 'せんせいへ れんらく',
      message: confirmMessage,
      confirmText: '送信する',
      cancelText: 'やめる',
      onConfirm: () => {
        const messageInput = /** @type {HTMLTextAreaElement | null} */ (
          document.getElementById('teacher-message-input')
        );
        const messageText = messageInput?.value?.trim() || '';

        if (!messageText) {
          showInfo('メッセージを入力してください。', 'エラー');
          return;
        }

        // 状態マネージャからユーザー情報を取得
        const currentUser =
          messageHandlersStateManager?.getState()?.currentUser;

        if (!currentUser || !currentUser.studentId) {
          showInfo('ユーザー情報が見つかりません。', 'エラー');
          return;
        }

        showLoading('message');

        const params = {
          studentId: currentUser.studentId,
          message: messageText,
        };

        google.script.run['withSuccessHandler'](
          (/** @type {any} */ response) => {
            hideLoading();

            if (response.success) {
              showInfo(
                `<h3 class="font-bold mb-3">送信完了</h3>${response.message || 'メッセージを送信しました。'}`,
              );
            } else {
              showInfo(
                response.message || 'メッセージの送信に失敗しました。',
                'エラー',
              );
            }
          },
        )
          .withFailureHandler((/** @type {Error} */ error) => {
            hideLoading();
            handleServerError(error);
          })
          .sendMessageToTeacher(params);
      },
    });
  },
};
