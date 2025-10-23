/**
 * =================================================================
 * ファイル概要
 * -----------------------------------------------------------------
 * 名称: 12_WebApp_Core_Modal.js
 * 目的: フロントエンド共通のモーダル制御ロジックを提供する
 * 主な責務:
 *   - 汎用モーダルの表示/非表示とボタン生成
 *   - ページ遷移マネージャーとの連携（モーダル開閉時の通知）
 *   - 情報/確認モーダルの共通ユーティリティ提供
 * AI向けメモ:
 *   - 新しいモーダルバリエーションを追加する場合は`ModalManager`のAPIを拡張し、UI生成は`Components`を経由する
 * =================================================================
 */

// ================================================================
// UI系モジュール
// ================================================================
import { Components } from './13_WebApp_Components.js';

// グローバルオブジェクトに完全なModalManagerを割り当て
appWindow.ModalManager =
  /** @type {import('../../types/view/window').ModalManager} */ ({
    onConfirmCallback: null,

    /**
     * モーダル確認時のコールバック関数を設定
     * @param {() => void} callback - 確認ボタン押下時に実行する関数
     */
    setCallback: function (callback) {
      this.onConfirmCallback = callback;
    },

    /**
     * 設定されたコールバック関数をクリア
     */
    clearCallback: function () {
      this.onConfirmCallback = null;
    },

    /**
     * 設定されたコールバック関数を実行し、自動でクリアする
     */
    executeCallback: function () {
      if (this.onConfirmCallback) {
        this.onConfirmCallback();
        this.clearCallback();
      }
    },

    /**
     * 汎用モーダル表示
     * @param {ModalDialogConfig} c - モーダル設定
     */
    show: function (c) {
      if (
        appWindow.pageTransitionManager &&
        /** @type {any} */ (appWindow.pageTransitionManager).onModalOpen
      ) {
        /** @type {any} */ (appWindow.pageTransitionManager).onModalOpen();
      }

      const m = document.getElementById('custom-modal');
      const b = document.getElementById('modal-buttons');
      if (!m || !b) return;

      b.innerHTML = '';
      if (c.showCancel) {
        b.innerHTML += Components.button({
          text: c.cancelText || CONSTANTS.MESSAGES.CANCEL || 'キャンセル',
          action: 'modalCancel',
          style: 'secondary',
          size: 'normal',
        });
      }
      if (c.confirmText) {
        b.innerHTML += `<div class="w-3"></div>${Components.button({
          text: c.confirmText,
          action: 'modalConfirm',
          style: c.confirmColorClass?.includes('danger') ? 'danger' : 'primary',
          size: 'normal',
          disabled: /** @type {any} */ (c).disableConfirm,
        })}`;
      }

      if (this.setCallback && c.onConfirm) {
        this.setCallback(c.onConfirm);
      }

      const modalTitle = document.getElementById('modal-title');
      const modalMessage = document.getElementById('modal-message');

      if (modalTitle) modalTitle.textContent = c.title ?? null;
      if (modalMessage) modalMessage.innerHTML = c.message;
      m.classList.add('active');
    },

    /**
     * モーダル非表示
     */
    hide: function () {
      const modal = document.getElementById('custom-modal');
      if (modal) modal.classList.remove('active');
      this.clearCallback?.();

      if (
        appWindow.pageTransitionManager &&
        /** @type {any} */ (appWindow.pageTransitionManager).onModalClose
      ) {
        /** @type {any} */ (appWindow.pageTransitionManager).onModalClose();
      }
    },

    /**
     * 情報モーダル表示
     * @param {string} msg - メッセージ
     * @param {string} [t] - タイトル
     * @param {VoidCallback | null} [cb] - コールバック
     */
    showInfo: function (msg, t = '情報', cb = null) {
      /** @type {ModalDialogConfig} */
      const config = {
        title: t,
        message: msg,
        confirmText: 'OK',
        confirmColorClass: appWindow.DesignConfig?.colors?.['primary'],
      };
      if (cb) {
        config.onConfirm = cb;
      }
      this.show(config);
    },

    /**
     * 確認モーダル表示
     * @param {ModalDialogConfig} c - モーダル設定
     */
    showConfirm: function (c) {
      this.show({ ...c, showCancel: true });
    },
  });

// 下位互換性のために、グローバル関数も維持
if (appWindow.ModalManager) {
  appWindow.showModal = appWindow.ModalManager.show.bind(
    appWindow.ModalManager,
  );
  appWindow.hideModal = appWindow.ModalManager.hide.bind(
    appWindow.ModalManager,
  );
  appWindow.showInfo = appWindow.ModalManager.showInfo.bind(
    appWindow.ModalManager,
  );
  appWindow.showConfirm = appWindow.ModalManager.showConfirm.bind(
    appWindow.ModalManager,
  );
}
