/**
 * =================================================================
 * ファイル概要
 * -----------------------------------------------------------------
 * 名称: 14_WebApp_Handlers.js
 * 目的: フロントエンド全体のアクション制御とビュー遷移を統括する
 * 主な責務:
 *   - グローバル`actionHandlers`の生成と公開
 *   - 会計・よやく・認証など個別ハンドラーの集約と調整
 *   - UIレンダリング関数との連携ポイントを提供
 * AI向けメモ:
 *   - 新しい操作を追加する際は該当する分割ファイルに実装し、最後にこのファイルの統合処理へ登録する
 * =================================================================
 */

/**
 * @typedef {import('./12_WebApp_StateManager.js').SimpleStateManager} SimpleStateManager
 */

// ================================================================
// UI系モジュール
// ================================================================
import {
  generateAccountingView,
  getPaymentInfoHtml,
} from './12-2_Accounting_UI.js';
import { Components } from './13_WebApp_Components.js';
import {
  getEditProfileView,
  getLoginView,
  getRegisterView,
  getRegistrationStep2View,
  getRegistrationStep3View,
  getRegistrationStep4View,
} from './13_WebApp_Views_Auth.js';
import {
  getBookingView,
  getReservationFormView,
} from './13_WebApp_Views_Booking.js';
import { getDashboardView } from './13_WebApp_Views_Dashboard.js';
import { getLogView } from './13_WebApp_Views_Log.js';
import { getParticipantView } from './13_WebApp_Views_Participant.js';
import { getCompleteView } from './13_WebApp_Views_Utils.js';

// ================================================================
// ハンドラ系モジュール
// ================================================================
import {
  closePaymentConfirmModal,
  handleProcessPayment,
  initializePaymentMethodUI,
  processAccountingPayment,
  setupAccountingEventListeners,
  updateAccountingCalculation,
} from './12-3_Accounting_Handlers.js';
import { authActionHandlers } from './14_WebApp_Handlers_Auth.js';
import { historyActionHandlers } from './14_WebApp_Handlers_History.js';
import { messageActionHandlers } from './14_WebApp_Handlers_Message.js';
import { participantActionHandlers } from './14_WebApp_Handlers_Participant.js';
import { reservationActionHandlers } from './14_WebApp_Handlers_Reservation.js';
import {
  getCurrentSessionConclusionView,
  sessionConclusionActionHandlers,
  setupSessionConclusionUI,
  startSessionConclusion,
} from './14_WebApp_Handlers_SessionConclusion.js';

// ================================================================
// ユーティリティ系モジュール
// ================================================================
import { calculateAccountingTotal } from './12-1_Accounting_Calculation.js';
import {
  collectAccountingFormData,
  initializeAccountingSystem,
  saveAccountingCache,
} from './12-4_Accounting_Utilities.js';
import { findReservationById } from './12_WebApp_Core_Search.js';
import {
  handlePhoneInputFormatting,
  isCurrentUserAdmin,
  isDateToday,
  resetAppScrollToTop,
  refreshParticipantsViewForAdmin,
} from './14_WebApp_Handlers_Utils.js';

// =================================================================
// --- 分割ファイル統合パターン ---
// -----------------------------------------------------------------
// 本ファイルは分割された機能別ファイルのハンドラーを統合します
// ビルド時に各分割ファイルの内容が展開されます
// =================================================================

// =================================================================
// --- Action Handlers Integration ---
// -----------------------------------------------------------------
// 各分割ファイルで定義されたアクションハンドラーを統合
// =================================================================

// actionHandlersの定義は他のハンドラーが全て定義された後に行う
// （このファイルを最後に処理するため、その時点で他のハンドラーは利用可能）

/** @type {ActionHandlers} */
export let actionHandlers;

// =================================================================
// --- Application Core Functions ---
// -----------------------------------------------------------------
// アプリケーションの起動、状態管理、画面描画など、
// 全体を制御するコアとなる関数群です。
// =================================================================

/** @type {ClassifiedAccountingItemsCore} */
export const EMPTY_CLASSIFIED_ITEMS =
  /** @type {ClassifiedAccountingItemsCore} */ (
    /** @type {unknown} */ ({
      tuition: { baseItems: [], additionalItems: [] },
      sales: { materialItems: [], productItems: [] },
    })
  );

// Window型の拡張（型エラー回避のため）
/**
 * フロントエンド専用のWindow拡張
 * 主要な会計データとフラグを型安全に扱うためのラッパー
 */

export const windowTyped = /** @type {any} */ (window);

/** @type {SimpleStateManager} */
const handlersStateManager = windowTyped.stateManager;

/**
 * 現在のアプリケーションの状態に基づいて、適切なビューを描画する
 * データ更新の必要性を判定し、必要に応じて最新データ取得後に再描画
 * handlersStateManager.getState().viewの値に応じて対応するビュー関数を呼び出してUIを更新
 */
export function render() {
  // appStateの安全な参照確認
  const appState = handlersStateManager?.getState();
  if (!appState) {
    console.warn('render(): stateManagerが未初期化のため処理をスキップします');
    return;
  }

  debugLog('🎨 render実行:', appState.view);

  // 無限ループを避けるため、データ更新処理は削除
  // 単純にビューを描画するだけ

  let v = '';
  switch (appState.view) {
    case 'login':
      v = getLoginView();
      break;
    case 'register': {
      const registrationPhone =
        /** @type {string | undefined} */ (
          /** @type {any} */ (appState).registrationPhone
        ) ?? '';
      v = getRegisterView(registrationPhone);
      break;
    }
    case 'registrationStep2':
      v = getRegistrationStep2View();
      break;
    case 'registrationStep3':
      v = getRegistrationStep3View();
      break;
    case 'registrationStep4':
      v = getRegistrationStep4View();
      break;
    case 'dashboard':
      v = getDashboardView();
      break;
    case 'editProfile':
      v = getEditProfileView();
      break;
    case 'bookingLessons':
      v = getBookingView(appState.selectedClassroom ?? '');
      break;
    case 'reservationForm':
      // コンテキストがない場合（リロード後など）はダッシュボードへリダイレクト
      if (!appState.currentReservationFormContext) {
        console.warn(
          'reservationFormコンテキストがないためダッシュボードへリダイレクト',
        );
        v = getDashboardView();
        // 状態も更新して次回render時にダッシュボードを表示
        handlersStateManager.dispatch({
          type: 'SET_STATE',
          payload: { view: 'dashboard' },
        });
        break;
      }
      v = getReservationFormView();
      break;
    case 'accounting':
      // 会計画面用のデータを取得
      const reservationData = appState.accountingReservation;
      const classroom = reservationData?.classroom
        ? String(reservationData.classroom)
        : '';

      // 事前初期化されたキャッシュを優先使用
      const accountingCache = windowTyped.accountingSystemCache;
      /** @type {ClassifiedAccountingItemsCore | null} */
      let classifiedItems = null;

      if (accountingCache && classroom && accountingCache[classroom]) {
        // キャッシュから高速取得
        classifiedItems = accountingCache[classroom];
        if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
          debugLog('✅ 会計システムキャッシュ使用:', classroom);
        }
      } else {
        // フォールバック: リアルタイム初期化
        const masterData = appState.accountingMaster || [];
        if (
          typeof initializeAccountingSystem === 'function' &&
          masterData.length > 0 &&
          classroom
        ) {
          v = initializeAccountingSystem(
            masterData,
            classroom,
            {},
            reservationData,
          );
          break;
        } else {
          classifiedItems = EMPTY_CLASSIFIED_ITEMS;
        }
      }

      // キャッシュされたデータでHTML生成
      if (classifiedItems) {
        // グローバル変数に設定（イベント処理で使用）
        windowTyped.currentClassifiedItems = classifiedItems;
        windowTyped.currentClassroom = classroom;

        // 会計画面HTML生成
        /** @type {AccountingFormDto} */
        const formData = {};
        v = generateAccountingView(
          classifiedItems,
          classroom,
          formData,
          reservationData,
        );

        // キャッシュ使用時の初期化処理をよやく
        setTimeout(() => {
          // 支払い方法UI初期化
          if (typeof initializePaymentMethodUI === 'function') {
            initializePaymentMethodUI('');
          }

          // イベントリスナー設定
          if (typeof setupAccountingEventListeners === 'function') {
            setupAccountingEventListeners(classifiedItems, classroom);
          }

          // 初期計算実行
          if (typeof updateAccountingCalculation === 'function') {
            updateAccountingCalculation(classifiedItems, classroom);
          }
        }, 100);
      }
      break;
    case 'complete': {
      const completionMessage =
        /** @type {string | undefined} */ (
          /** @type {any} */ (appState).completionMessage
        ) ?? '';
      v = getCompleteView(completionMessage);
      break;
    }
    case 'participants':
      v = getParticipantView();
      break;
    case 'adminLog':
      v = getLogView();
      break;
    case 'sessionConclusion':
      // ウィザード状態はデータ取得後に復元されるため、ここでは呼び出さない
      v = getCurrentSessionConclusionView();
      break;
  }
  const viewContainer = document.getElementById('view-container');
  if (viewContainer) {
    viewContainer.innerHTML = `<div class="fade-in">${v}</div>`;
  }

  // 参加者画面の場合、横スクロール同期を設定
  if (appState.view === 'participants') {
    requestAnimationFrame(() => {
      if (typeof setupParticipantsScrollSync === 'function') {
        setupParticipantsScrollSync();
      }
    });
  }

  // もどるボタンを動的に更新
  const backButtonContainer = document.getElementById('back-button-container');
  if (backButtonContainer) {
    if (appState.view === 'sessionConclusion') {
      backButtonContainer.innerHTML = ''; // ヘッダー戻るボタン非表示
    } else {
      backButtonContainer.innerHTML = Components.createSmartBackButton(
        appState.view,
        appState,
      );
    }
  }

  // 会計画面の場合、イベントリスナーを設定
  if (appState.view === 'accounting') {
    // DOM更新後にイベントリスナーを設定するため、次のフレームで実行
    requestAnimationFrame(() => {
      // 事前設定されたグローバル変数から取得（キャッシュ活用）
      const classifiedItems =
        windowTyped.currentClassifiedItems || EMPTY_CLASSIFIED_ITEMS;
      const classroom = windowTyped.currentClassroom || '';

      if (typeof setupAccountingEventListeners === 'function') {
        setupAccountingEventListeners(classifiedItems, classroom);
      }
      // 初期計算も実行
      if (typeof updateAccountingCalculation === 'function') {
        updateAccountingCalculation(
          classifiedItems,
          classroom, // 第2引数として教室名を渡す
        );
      }
    });
  }

  // セッション終了ウィザードの場合、UIセットアップを実行
  if (appState.view === 'sessionConclusion') {
    // コンテキストからステップを同期（ブラウザバック対応）
    const context = /** @type {any} */ (appState);
    if (context.step) {
      // 動的インポートされた関数を使用（循環参照回避のためHandlers内でimport済み）
      setupSessionConclusionUI(context.step);
    } else {
      requestAnimationFrame(() => {
        setupSessionConclusionUI();
      });
    }
  }

  resetAppScrollToTop();
}

windowTyped.render = render;

/**
 * 会計画面での入力変更を処理します。
 * 合計金額の再計算と、入力内容のキャッシュ保存を行います。
 */
export function handleAccountingFormChange() {
  // リアルタイムで合計金額を再計算
  if (typeof updateAccountingCalculation === 'function') {
    // 会計画面用のデータを取得
    const classifiedItems =
      windowTyped.currentClassifiedItems || EMPTY_CLASSIFIED_ITEMS;
    const classroom = windowTyped.currentClassroom || '';
    updateAccountingCalculation(classifiedItems, classroom);
  }

  // フォーム内容が変更されたら、キャッシュに保存する
  const reservationId =
    handlersStateManager.getState().accountingReservation?.reservationId;
  if (reservationId) {
    const accountingData =
      typeof collectAccountingFormData === 'function'
        ? collectAccountingFormData()
        : {};
    saveAccountingCache(accountingData);
  }
}

/**
 * アプリケーションの起動点です。
 * ページ読み込み完了時に実行され、イベントリスナーを設定します。
 */
window.onload = function () {
  // 全てのハンドラーが定義された後でactionHandlersを構築

  // デバッグ：reservationActionHandlersの状態確認
  if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
    debugLog('🔧 reservationActionHandlers確認:', {
      defined: typeof reservationActionHandlers !== 'undefined',
      hasCancel: typeof reservationActionHandlers?.cancel === 'function',
      keys:
        typeof reservationActionHandlers !== 'undefined'
          ? Object.keys(reservationActionHandlers)
          : [],
    });
  }

  /**
   * 会計処理を実行するヘルパー関数
   * @param {boolean} withSalesTransfer - 売上転載を即時実行するか
   */
  const proceedWithPaymentHelper = withSalesTransfer => {
    // フォームデータを収集
    const state = handlersStateManager.getState();
    const reservationId = state.accountingReservation?.reservationId;
    const classroom = state.accountingReservation?.classroom;
    const studentId = state.currentUser?.studentId;

    if (!reservationId || !classroom || !studentId) {
      showInfo('必要な情報が不足しています。', 'エラー');
      return;
    }

    const formData =
      typeof collectAccountingFormData === 'function'
        ? collectAccountingFormData()
        : {};

    if (!formData.paymentMethod) {
      showInfo('支払い方法を選択してください。', '入力エラー');
      return;
    }

    const masterData = state.accountingMaster || [];
    if (!Array.isArray(masterData) || masterData.length === 0) {
      showInfo(
        '会計マスタが読み込まれていません。リロードして再度お試しください。',
        'エラー',
      );
      return;
    }

    const result =
      typeof calculateAccountingTotal === 'function'
        ? calculateAccountingTotal(formData, masterData, classroom)
        : null;

    if (!result) {
      showInfo(
        '会計計算に失敗しました。入力内容を確認してください。',
        'エラー',
      );
      return;
    }

    // ローディング表示
    if (typeof showLoading === 'function') {
      showLoading('payment');
    }

    // フォームデータに必須IDを明示的に注入
    // これによりバックエンドのチェックを確実にパスする
    formData['reservationId'] = reservationId;
    formData['studentId'] = studentId;
    formData['classroom'] = classroom;

    // 管理者操作フラグを追加（なりすまし中＝管理者が他人のデータを操作中）
    const isAdminOperation = !!state.adminImpersonationOriginalUser;
    formData['isAdminOperation'] = isAdminOperation;
    if (isAdminOperation) {
      formData['adminUserId'] =
        state.adminImpersonationOriginalUser?.studentId || '';
    }

    // バックエンドに送信（withSalesTransferフラグを追加）
    google.script.run
      .withSuccessHandler(
        /** @param {any} response */
        response => {
          if (typeof hideLoading === 'function') {
            hideLoading();
          }

          if (response.success) {
            // 管理者操作かどうかをなりすまし終了前に記録
            const wasAdminOperation = isAdminOperation;

            // 成功時はなりすましを終了して戻る
            handlersStateManager.endImpersonation();

            showInfo(
              withSalesTransfer
                ? response.message || '会計処理と売上転載が完了しました'
                : response.message ||
                    '会計処理が完了しました（売上転載は管理画面から実行できます）',
              '完了',
            );

            // 管理者操作の場合は最新データを取得してから participants へ遷移
            if (wasAdminOperation) {
              // participants ビューに遷移してから最新データを読み込む
              handlersStateManager.dispatch({
                type: 'SET_STATE',
                payload: {
                  view: 'participants',
                },
              });
              refreshParticipantsViewForAdmin();
            } else {
              // 一般ユーザーはダッシュボードへ
              handlersStateManager.dispatch({
                type: 'SET_STATE',
                payload: {
                  view: 'dashboard',
                },
              });
            }
          } else {
            showInfo(response.error || 'エラーが発生しました', 'エラー');
          }
        },
      )
      .withFailureHandler(
        /** @param {any} error */
        error => {
          if (typeof hideLoading === 'function') {
            hideLoading();
          }
          showInfo(`エラーが発生しました: ${error.message}`, 'エラー');
        },
      )
      .processAccountingWithTransferOption(formData, result, withSalesTransfer);
  };

  /**
   * @param {HTMLButtonElement | null} buttonElement
   */
  const showCopySuccessFeedback = buttonElement => {
    if (!buttonElement) {
      showInfo('コピーしました。');
      return;
    }

    const originalText = buttonElement.textContent || 'コピー';
    buttonElement.textContent = 'コピーしました!';
    window.setTimeout(() => {
      buttonElement.textContent = originalText;
    }, 2000);
  };

  /**
   * @param {string} textToCopy
   * @returns {boolean}
   */
  const fallbackCopyText = textToCopy => {
    const textArea = document.createElement('textarea');
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    textArea.value = textToCopy;
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch (error) {
      copied = false;
      if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
        console.warn('フォールバックコピーに失敗しました:', error);
      }
    } finally {
      document.body.removeChild(textArea);
    }

    return copied;
  };

  /**
   * @param {string} textToCopy
   * @returns {Promise<boolean>}
   */
  const copyTextToClipboard = async textToCopy => {
    const canUseClipboardApi =
      typeof navigator !== 'undefined' &&
      !!navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function' &&
      window.isSecureContext;

    if (canUseClipboardApi) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        return true;
      } catch (error) {
        if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
          console.warn(
            'Clipboard APIでのコピーに失敗したためフォールバックします:',
            error,
          );
        }
      }
    }

    return fallbackCopyText(textToCopy);
  };

  /**
   * @param {ActionHandlerData | undefined} data
   * @returns {Promise<void>}
   */
  const executeCopyToClipboardAction = async data => {
    const targetElement = data?.['targetElement'];
    const buttonElement =
      targetElement instanceof HTMLButtonElement ? targetElement : null;
    const dataCopyText =
      targetElement instanceof HTMLElement
        ? targetElement.dataset?.['copyText']
        : '';
    const rawText = data?.copyText || dataCopyText || '';
    const textToCopy = String(rawText).replace(/,/g, '').trim();

    if (!textToCopy) {
      showInfo('コピーする内容が見つかりません。', 'エラー');
      return;
    }

    try {
      const copied = await copyTextToClipboard(textToCopy);
      if (!copied) {
        showInfo('コピーに失敗しました。', 'エラー');
        return;
      }
      showCopySuccessFeedback(buttonElement);
    } catch (error) {
      if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
        console.error('コピー処理エラー:', error);
      }
      showInfo('コピーに失敗しました。', 'エラー');
    }
  };

  actionHandlers = {
    // =================================================================
    // --- Core Navigation Handlers ---
    // -----------------------------------------------------------------
    /** スマートナビゲーション: 前の画面にもどる */
    smartGoBack: () => {
      const state = handlersStateManager.getState();
      const wasImpersonating = !!state.adminImpersonationOriginalUser;

      // ナビゲーションでもどる際はなりすまし解除を試みる
      // （もしなりすまし中なら、元の管理者に戻る）
      handlersStateManager.endImpersonation();

      // 通常の履歴ベースの戻る処理
      const backState = handlersStateManager.goBack();
      if (backState) {
        // なりすまし中で履歴がなく dashboard に戻ろうとした場合は participants に変更
        if (wasImpersonating && backState.view === 'dashboard') {
          backState.view = 'participants';
        }
        handlersStateManager.dispatch({
          type: 'SET_STATE',
          payload: backState,
        });
      }
    },

    // =================================================================
    // --- Error Recovery Handlers ---
    // -----------------------------------------------------------------
    /** ダッシュボードへ遷移（エラーリカバリー用） */
    goToDashboard: () => {
      handlersStateManager.dispatch({
        type: 'SET_STATE',
        payload: { view: 'dashboard' },
      });
    },

    /** ログアウトしてLocalStorageもクリア（エラーリカバリー用） */
    logoutAndRestart: () => {
      // LocalStorageをクリア
      if (typeof localStorage !== 'undefined') {
        localStorage.clear();
      }
      // ログアウト処理（stateをクリア）してログイン画面へ
      handlersStateManager.dispatch({ type: 'LOGOUT' });
      handlersStateManager.dispatch({
        type: 'NAVIGATE',
        payload: { to: 'login' },
      });
    },

    /** モーダルの確認ボタンを押したときの処理です */
    modalConfirm: () => {
      const modalManager = windowTyped.ModalManager;
      if (modalManager && typeof modalManager.executeCallback === 'function') {
        modalManager.executeCallback();
      }
      windowTyped.ModalManager.hide();
    },

    /** モーダルのキャンセルボタンを押したときの処理です */
    modalCancel: () => windowTyped.ModalManager.hide(),

    /** 任意のモーダルを閉じる */
    closeModal: (/** @type {any} */ data) => {
      const modalId = data?.modalId || data?.['modalId'] || null;
      if (modalId) {
        Components.closeModal(modalId);
      }
    },

    /** 指定されたテキストをクリップボードにコピーします */
    copyToClipboard: (/** @type {ActionHandlerData | undefined} */ data) => {
      void executeCopyToClipboardAction(data);
    },

    /** 合計金額の表示値から数値だけを抽出してコピーします */
    copyGrandTotal: (/** @type {ActionHandlerData | undefined} */ data) => {
      const totalText =
        document.getElementById('grand-total-amount')?.textContent || '';
      const numericTotal = totalText.replace(/[^0-9-]/g, '');
      const nextData = { ...data, copyText: numericTotal };
      void executeCopyToClipboardAction(nextData);
    },

    // =================================================================
    // --- Authentication Handlers (from 14_WebApp_Handlers_Auth.js) ---
    // -----------------------------------------------------------------
    ...(typeof authActionHandlers !== 'undefined' ? authActionHandlers : {}),

    // =================================================================
    // --- History Management Handlers (from 14_WebApp_Handlers_History.js) ---
    // -----------------------------------------------------------------
    ...(typeof historyActionHandlers !== 'undefined'
      ? historyActionHandlers
      : {}),

    // =================================================================
    // --- Reservation Handlers (from 14_WebApp_Handlers_Reservation.js) ---
    // -----------------------------------------------------------------
    ...(typeof reservationActionHandlers !== 'undefined'
      ? reservationActionHandlers
      : {}),

    // =================================================================
    // --- Participants Handlers (from 14_WebApp_Handlers_Participants.js) ---
    // -----------------------------------------------------------------
    ...(typeof participantActionHandlers !== 'undefined'
      ? participantActionHandlers
      : {}),

    // =================================================================
    // --- Session Conclusion Handlers (from 14_WebApp_Handlers_SessionConclusion.js) ---
    // -----------------------------------------------------------------
    ...(typeof sessionConclusionActionHandlers !== 'undefined'
      ? sessionConclusionActionHandlers
      : {}),

    // =================================================================
    // --- Message Handlers (from 14_WebApp_Handlers_Message.js) ---
    // -----------------------------------------------------------------
    ...(typeof messageActionHandlers !== 'undefined'
      ? messageActionHandlers
      : {}),

    // =================================================================
    // --- Goal Editing Handlers (けいかく・もくひょう) ---
    // -----------------------------------------------------------------

    /** けいかく・もくひょうの編集モードに切り替え */
    editGoal: () => {
      const displayMode = document.getElementById('goal-display-mode');
      const editMode = document.getElementById('goal-edit-mode');
      if (displayMode && editMode) {
        displayMode.classList.add('hidden');
        editMode.classList.remove('hidden');
        const textarea = /** @type {HTMLTextAreaElement | null} */ (
          document.getElementById('goal-edit-textarea')
        );
        if (textarea) {
          // 共通メソッドを使用してキャッシュとイベントリスナーを設定
          handlersStateManager.setupTextareaCache(textarea, 'goalEdit');
        }
      }
    },

    /** けいかく・もくひょうの編集をキャンセル */
    cancelEditGoal: () => {
      const displayMode = document.getElementById('goal-display-mode');
      const editMode = document.getElementById('goal-edit-mode');
      if (displayMode && editMode) {
        displayMode.classList.remove('hidden');
        editMode.classList.add('hidden');
      }
      // キャッシュをクリア
      handlersStateManager.clearFormInputCache('goalEdit');
    },

    /** けいかく・もくひょうを保存 */
    saveGoal: () => {
      const textarea = /** @type {HTMLTextAreaElement | null} */ (
        document.getElementById('goal-edit-textarea')
      );
      if (!textarea) {
        console.error('ゴールテキストエリアが見つかりません');
        return;
      }

      const newGoal = textarea.value.trim();
      const studentId = handlersStateManager.getState().currentUser?.studentId;
      if (!studentId) {
        showInfo('ユーザー情報が見つかりません。', 'エラー');
        return;
      }

      const state = handlersStateManager.getState();
      const currentGoal = state.currentUser?.nextLessonGoal || '';

      // 変更がない場合はバックエンド処理をスキップ
      if (newGoal === currentGoal) {
        actionHandlers.cancelEditGoal();
        return;
      }

      // ローディング表示
      showLoading('goal');

      if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run
          .withSuccessHandler(
            /** @param {ApiResponse} result */ result => {
              hideLoading();
              if (result.success) {
                // 状態を更新（dispatchで永続化）＆参加者キャッシュをクリア
                const state = handlersStateManager.getState();
                if (state.currentUser) {
                  handlersStateManager.dispatch({
                    type: 'UPDATE_STATE',
                    payload: {
                      currentUser: {
                        ...state.currentUser,
                        nextLessonGoal: newGoal,
                      },
                      // 参加者ビューのキャッシュをクリア（次回アクセス時に再取得）
                      participantReservationsMap: null,
                      participantLessons: null,
                    },
                  });
                }
                // 表示モードに切り替え＆テキスト更新
                const displayMode =
                  document.getElementById('goal-display-mode');
                const editMode = document.getElementById('goal-edit-mode');
                const displayText =
                  document.getElementById('goal-display-text');
                if (displayMode && editMode) {
                  if (newGoal) {
                    displayMode.classList.remove('hidden');
                    editMode.classList.add('hidden');
                    if (displayText) {
                      displayText.textContent = newGoal;
                    }
                  } else {
                    // 空の場合は編集モードのまま
                    displayMode.classList.add('hidden');
                    editMode.classList.remove('hidden');
                  }
                }
                showInfo('けいかく・もくひょうを保存しました。', 'success');
                // キャッシュをクリア
                handlersStateManager.clearFormInputCache('goalEdit');
              } else {
                showInfo(result.message || '保存に失敗しました。', 'エラー');
              }
            },
          )
          .withFailureHandler(
            /** @param {Error} error */ error => {
              hideLoading();
              console.error('ゴール保存エラー:', error);
              showInfo(`保存に失敗しました: ${error.message}`, 'エラー');
            },
          )
          .updateNextLessonGoal({ studentId, nextLessonGoal: newGoal });
      }
    },

    /** 作品集ページを新しいタブで開く */
    openPhotoGallery: () => {
      const state = handlersStateManager.getState();
      /** @type {UserCore | null} */
      const currentUser = state.currentUser || null;
      const galleryBaseUrl = /** @type {any} */ (
        CONSTANTS.WEB_APP_URL.GALLERY || ''
      ).trim();

      if (!galleryBaseUrl) {
        showInfo('作品集URLが未設定です。', 'エラー');
        return;
      }

      const studentId = `${currentUser?.studentId || ''}`.trim();
      const nickname = `${currentUser?.nickname || ''}`.trim();
      const displayName =
        `${currentUser?.displayName || currentUser?.realName || ''}`.trim();

      /** @type {string} */
      let targetUrl = galleryBaseUrl;
      try {
        const url = new URL(galleryBaseUrl);
        url.searchParams.set('logged_in', '1');
        if (studentId) url.searchParams.set('student_id', studentId);
        if (nickname) url.searchParams.set('nickname', nickname);
        if (displayName) url.searchParams.set('display_name', displayName);
        targetUrl = url.toString();
      } catch (error) {
        console.warn(
          '作品集URLの組み立てに失敗したため、ベースURLで開きます。',
          error,
        );
      }

      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    },

    // =================================================================
    // --- Accounting Handlers (整理済み) ---
    // -----------------------------------------------------------------

    /** きょうの まとめ画面へ遷移 */
    goToSessionConclusion: () => {
      const state = handlersStateManager.getState();
      const reservations = state.myReservations || [];

      // 本日の確定済みよやくを検索
      const todayCandidates = reservations.filter(reservation => {
        const dateValue = reservation?.date
          ? String(reservation.date).split('T')[0]
          : '';
        if (!dateValue) return false;

        const status = reservation.status;
        return status === CONSTANTS.STATUS.CONFIRMED && isDateToday(dateValue);
      });

      if (todayCandidates.length === 0) {
        showInfo('本日のよやくがありません。', 'お知らせ');
        return;
      }

      // 最も早い開始時刻のよやくを選択
      const toSortableTime = (
        /** @type {string | null | undefined} */ value,
      ) => (value ? value.toString() : '99:99');
      const sortedCandidates = [...todayCandidates].sort((a, b) =>
        toSortableTime(a.startTime).localeCompare(toSortableTime(b.startTime)),
      );

      const candidate = sortedCandidates[0];

      if (candidate?.reservationId) {
        // セッション終了ウィザードを開始
        startSessionConclusion(candidate.reservationId);
      } else {
        showInfo('本日のよやくが見つかりませんでした。', 'お知らせ');
      }
    },

    /** 今日のよやくを開いて会計画面へ遷移（レガシー） */
    goToTodayAccounting: () => {
      const state = handlersStateManager.getState();
      const reservations = state.myReservations || [];

      const todayCandidates = reservations.filter(reservation => {
        const dateValue = reservation?.date
          ? String(reservation.date).split('T')[0]
          : '';
        if (!dateValue) return false;

        const status = reservation.status;
        const isAccountingStatus =
          status === CONSTANTS.STATUS.CONFIRMED ||
          status === CONSTANTS.STATUS.COMPLETED;

        return isAccountingStatus && isDateToday(dateValue);
      });

      if (todayCandidates.length === 0) {
        showInfo('本日の会計対象のよやくがありません。', 'お知らせ');
        return;
      }

      const toSortableTime = (
        /** @type {string | null | undefined} */ value,
      ) => (value ? value.toString() : '99:99');
      const sortedCandidates = [...todayCandidates].sort((a, b) =>
        toSortableTime(a.startTime).localeCompare(toSortableTime(b.startTime)),
      );

      const candidate =
        sortedCandidates.find(
          res => res.status === CONSTANTS.STATUS.CONFIRMED,
        ) || sortedCandidates[0];

      if (candidate?.reservationId) {
        actionHandlers.goToAccounting({
          reservationId: candidate.reservationId,
        });
      } else {
        showInfo('本日の会計対象のよやくが見つかりませんでした。', 'お知らせ');
      }
    },

    /** 会計画面に遷移（新システム対応版） */
    goToAccounting: (/** @type {{ reservationId: string }} */ d) => {
      showLoading('accounting');
      const reservationId = d.reservationId;

      // 統一検索関数を使用してよやくデータを取得
      const reservationResult = findReservationById(reservationId);
      const reservationData = reservationResult
        ? {
            ...reservationResult,
            date: reservationResult.date
              ? String(reservationResult.date).split('T')[0]
              : '',
          }
        : null;

      if (reservationData) {
        // 管理者操作のなりすましロジック
        if (isCurrentUserAdmin()) {
          const state = handlersStateManager.getState();
          const targetStudentId = reservationData.studentId;
          const currentAdminId = state.currentUser?.studentId;

          if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
            debugLog('👮 Admin Impersonation Check:', {
              isAdmin: true,
              target: targetStudentId,
              current: currentAdminId,
            });
          }

          if (
            targetStudentId &&
            targetStudentId !== currentAdminId &&
            state.currentUser // ensure logged in
          ) {
            // 生徒情報を検索（検索済みユーザーリストから）
            // 見つからない場合は最低限の情報でオブジェクトを作成
            const targetUser =
              state.searchedUsers?.find(u => u.studentId === targetStudentId) ||
              /** @type {UserCore} */ ({
                studentId: targetStudentId,
                realName:
                  /** @type {any} */ (reservationData)['studentName'] || '生徒', // reservationDataに名前が含まれていると仮定
                nickname:
                  /** @type {any} */ (reservationData)['studentName'] || '生徒',
                isAdmin: false,
                email: '',
              });

            handlersStateManager.startImpersonation(targetUser);
          }
        }

        // 会計マスタデータを取得
        const state = handlersStateManager.getState();
        const accountingMaster = state.accountingMaster || [];

        // よやくデータを状態に設定して会計画面に遷移
        handlersStateManager.dispatch({
          type: 'SET_STATE',
          payload: {
            view: 'accounting',
            accountingReservation: reservationData,
            accountingMaster: accountingMaster,
          },
        });

        hideLoading();
      } else {
        hideLoading();
        showInfo('よやく・記録情報が見つかりませんでした。', 'エラー');
      }
    },

    /** 履歴から会計処理（簡素版） */
    goToAccountingHistory: (/** @type {{ reservationId: string }} */ d) => {
      // 通常の会計画面遷移と同じ処理
      actionHandlers.goToAccounting(d);
    },

    /** 会計を修正（きろくカードの会計修正ボタン） */
    editAccountingRecord: (/** @type {{ reservationId: string }} */ d) => {
      // 会計画面遷移と同じ処理
      actionHandlers.goToAccounting(d);
    },

    /** 支払い確認モーダルを廃止し、直接処理 */
    showPaymentModal: () => {
      actionHandlers.confirmAndPay();
    },

    /** 支払い完了処理（ローディング→完了画面の流れ） */
    confirmAndPay: () => {
      // 管理者の場合は売上転載確認モーダルを表示
      if (isCurrentUserAdmin()) {
        if (actionHandlers['showSalesTransferConfirmModal']) {
          actionHandlers['showSalesTransferConfirmModal'](null, null);
        }
        return;
      }

      // window.tempPaymentDataが存在する場合はそれを使用（支払い確認モーダルから呼び出された場合）
      if (windowTyped.tempPaymentData) {
        if (!windowTyped.isProduction) {
          debugLog(
            '🔍 confirmAndPay: tempPaymentDataを使用',
            windowTyped.tempPaymentData,
          );
        }
        const { formData, result } = windowTyped.tempPaymentData;

        // 生徒の場合は売上転載なしで会計処理のみ実行
        if (typeof processAccountingPayment === 'function') {
          processAccountingPayment(formData, result);
        } else {
          console.error('processAccountingPayment関数が見つかりません');
        }
        windowTyped.tempPaymentData = null;
        return;
      }

      // 従来の処理（tempPaymentDataがない場合のフォールバック）
      const state = handlersStateManager.getState();
      const reservationId = state.accountingReservation?.reservationId;
      const classroom = state.accountingReservation?.classroom;
      const studentId = state.currentUser?.studentId;

      if (!reservationId || !classroom || !studentId) {
        showInfo('必要な情報が不足しています。', 'エラー');
        return;
      }

      // フォームデータを収集（統合会計ファイルの関数を使用）
      const formData =
        typeof collectAccountingFormData === 'function'
          ? collectAccountingFormData()
          : {};

      // 支払い方法が選択されていない場合はエラー
      if (!formData.paymentMethod) {
        showInfo('支払い方法を選択してください。', '入力エラー');
        return;
      }

      // ペイロード準備
      const masterData = state.accountingMaster || [];
      if (!Array.isArray(masterData) || masterData.length === 0) {
        showInfo(
          '会計マスタが読み込まれていません。リロードして再度お試しください。',
          'エラー',
        );
        return;
      }

      const result =
        typeof calculateAccountingTotal === 'function'
          ? calculateAccountingTotal(formData, masterData, classroom)
          : null;

      if (!result) {
        showInfo(
          '会計計算に失敗しました。入力内容を確認してください。',
          'エラー',
        );
        return;
      }

      if (typeof processAccountingPayment === 'function') {
        processAccountingPayment(formData, result);
      } else {
        showInfo('会計処理の開始に失敗しました。', 'エラー');
      }
    },

    /** 売上転載確認モーダルを表示（管理者専用） */
    showSalesTransferConfirmModal: () => {
      const modalId = 'salesTransferModal';
      const modalContent = `
        <p class="mb-6">会計処理と同時に売上ログへの転載を行いますか？</p>
        <div class="flex flex-col space-y-3">
          ${Components.button({
            text: '転載する（即時反映）',
            action: 'confirmPaymentWithTransfer',
            style: 'primary',
            size: 'full',
          })}
          ${Components.button({
            text: '転載しない（後で管理画面から実行）',
            action: 'confirmPaymentWithoutTransfer',
            style: 'secondary',
            size: 'full',
          })}
          ${Components.button({
            text: 'キャンセル',
            action: 'closeSalesTransferModal',
            style: 'secondary',
            size: 'full',
          })}
        </div>
      `;

      // モーダルHTMLを生成して挿入
      const modalHtml = Components.modal({
        id: modalId,
        title: '売上ログへの転載について',
        content: modalContent,
        showCloseButton: true,
      });

      // 既存のモーダルがあれば削除
      const existingModal = document.getElementById(modalId);
      if (existingModal) {
        existingModal.remove();
      }

      // モーダルをDOMに追加
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = modalHtml;
      const modalElement = tempDiv.firstElementChild;
      if (modalElement) {
        document.body.appendChild(modalElement);
      }

      // モーダルを表示
      Components.showModal(modalId);
    },

    /** 売上転載モーダルを閉じる */
    closeSalesTransferModal: () => {
      Components.closeModal('salesTransferModal');
    },

    /** 会計処理を実行（売上転載あり） */
    confirmPaymentWithTransfer: () => {
      Components.closeModal('salesTransferModal');
      // proceedWithPaymentヘルパー関数を呼び出す
      proceedWithPaymentHelper(true);
    },

    /** 会計処理を実行（売上転載なし） */
    confirmPaymentWithoutTransfer: () => {
      Components.closeModal('salesTransferModal');
      // proceedWithPaymentヘルパー関数を呼び出す
      proceedWithPaymentHelper(false);
    },

    // --- モーダル関連アクション ---

    /** 支払い確認モーダルをキャンセル */
    cancelPaymentConfirm: () => {
      if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
        debugLog('🔵 cancelPaymentConfirm実行');
      }

      if (typeof closePaymentConfirmModal === 'function') {
        closePaymentConfirmModal();
      } else {
        console.warn('closePaymentConfirmModal関数が見つかりません');
      }
    },

    /** 支払い確定処理（confirmAndPayのエイリアス） */
    confirmPayment: () => {
      actionHandlers.confirmAndPay();
    },

    /** 会計確認画面表示 */
    showAccountingConfirmation: () => {
      if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
        debugLog('🔵 showAccountingConfirmation実行');
      }
      // 現在のconfirmAndPayと同じ動作
      actionHandlers.confirmAndPay();
    },

    /** 支払い処理を実行 */
    processPayment: () => {
      if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
        debugLog('🔵 processPayment実行（グローバルハンドラー）');
      }

      if (typeof handleProcessPayment === 'function') {
        handleProcessPayment();
      } else {
        console.warn('handleProcessPayment関数が見つかりません');
      }
    },
  };

  windowTyped.actionHandlers = actionHandlers;

  // アプリケーションの初期化が完了するまでローディング画面を表示
  showLoading('default');

  /** @type {HTMLElement | null} */
  const app = document.getElementById('app');

  if (!app) {
    console.error('アプリケーション要素が見つかりません');
    return;
  }

  // イベントハンドラー関数を定義
  /** @type {ClickEventHandler} */
  const handleClick = e => {
    // DOM要素の型安全性を確保
    if (!e.target || !(e.target instanceof Element)) {
      return;
    }

    // 【修正】buttonまたはdata-action属性を持つ要素を対象にする
    const matched = e.target.closest('button, [data-action]');
    if (!matched || !(matched instanceof HTMLElement)) {
      return;
    }

    if (matched.dataset?.['action']) {
      const action = matched.dataset['action'];
      const { action: _action, ...data } = matched.dataset;

      // デバッグ情報を追加
      if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
        debugLog('🔘 クリックイベント:', {
          action,
          data,
          element: matched,
          tagName: matched.tagName,
          modalContext: e.target.closest('[data-modal-content]')
            ? 'モーダル内'
            : '通常',
          timestamp: new Date().getTime(),
          eventPhase: e.eventPhase,
        });
      }

      // モーダル内の場合は、イベント伝播を継続する
      if (
        e.target.closest('[data-modal-content]') &&
        matched.dataset['action']
      ) {
        // イベント伝播を停止しない（モーダル内のボタンを有効にする）
      }

      if (typeof actionHandlers[action] === 'function') {
        // モーダル関連のアクションとスクロール防止が必要なアクションは重複実行を防ぐためイベント伝播を停止
        if (
          action === 'processPayment' ||
          action === 'cancelPaymentConfirm' ||
          action === 'expandHistoryCard' ||
          action === 'closeEditMode' ||
          action === 'saveAndCloseMemo' ||
          action === 'saveInlineMemo'
        ) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        }

        // 特殊なハンドラー（copyToClipboard, copyGrandTotal）はtargetElementを渡す
        if (action === 'copyToClipboard' || action === 'copyGrandTotal') {
          /** @type {(data: any) => void} */ (actionHandlers[action])({
            ...data,
            targetElement: matched,
          });
        } else {
          /** @type {(data: any) => void} */ (actionHandlers[action])(data);
        }
      } else {
        // ハンドラーが見つからない場合のデバッグ
        if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
          console.warn('⚠️ アクションハンドラーが見つかりません:', action);
        }
      }
    }
  };

  // デバッグ：actionHandlers構築後の確認
  if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
    debugLog('🔧 actionHandlers構築完了:', {
      hasCancel: typeof actionHandlers['cancel'] === 'function',
      hasChangeReservationDate:
        typeof actionHandlers['changeReservationDate'] === 'function',
      hasConfirmDateChange:
        typeof actionHandlers['confirmDateChange'] === 'function',
      totalHandlers: Object.keys(actionHandlers).length,
      reservationHandlers: Object.keys(actionHandlers).filter(key =>
        [
          'cancel',
          'confirmBooking',
          'goToEditReservation',
          'changeReservationDate',
          'confirmDateChange',
        ].includes(key),
      ),
    });
  }

  // アプリ要素とdocument両方でクリックイベントを捕捉（モーダル対応）
  // 重複を避けるため、documentレベルのみでイベントを処理
  document.addEventListener('click', handleClick);

  // アプリ全体の入力・変更イベントを捕捉
  /** @type {ChangeEventHandler} */
  const handleChange = e => {
    // DOM要素の型安全性を確保
    if (!e.target || !(e.target instanceof Element)) {
      return;
    }

    const element = /** @type {Element} */ (e.target);

    // 会計モーダルでの支払い方法選択
    if (
      element.matches('#modal-accounting-form input[name="payment-method"]')
    ) {
      /** @type {HTMLButtonElement | null} */
      const confirmButton = /** @type {HTMLButtonElement | null} */ (
        document.getElementById('confirm-payment-button')
      );
      confirmButton?.removeAttribute('disabled');

      // 選択された支払方法に応じて情報を動的に更新
      const selectedPaymentMethod =
        element instanceof HTMLInputElement ? element.value : '';
      /** @type {HTMLElement | null} */
      const paymentInfoContainer = document.getElementById(
        'payment-info-container',
      );
      if (paymentInfoContainer) {
        paymentInfoContainer.innerHTML = getPaymentInfoHtml(
          selectedPaymentMethod,
        );
      }
    }

    // 会計画面での変更（主に select や checkbox）
    const accountingForm = element.closest('#accounting-form');
    if (
      handlersStateManager.getState().view === 'accounting' &&
      accountingForm
    ) {
      handleAccountingFormChange();

      // デバッグログ
      if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
        if (element instanceof HTMLInputElement) {
          debugLog('🔄 会計フォーム変更イベント:', {
            element: element.name || element.id,
            value: element.value,
            checked: element.checked,
          });
        }
      }
    }

    // 新規登録Step3での経験有無による表示切り替え
    if (element instanceof HTMLInputElement && element.name === 'experience') {
      /** @type {HTMLElement | null} */
      const pastWorkContainer = document.getElementById('past-work-container');
      if (pastWorkContainer) {
        pastWorkContainer.classList.toggle(
          'hidden',
          element.value === 'はじめて！',
        );
      }
    }
  };

  app.addEventListener('change', handleChange);

  // アプリ全体の入力イベントを捕捉（主に text や textarea）
  /** @type {InputEventHandler} */
  const handleInput = e => {
    // DOM要素の型安全性を確保
    if (!e.target || !(e.target instanceof Element)) {
      return;
    }

    // 会計画面での変更
    const accountingForm = e.target.closest('#accounting-form');
    if (
      handlersStateManager.getState().view === 'accounting' &&
      accountingForm
    ) {
      handleAccountingFormChange();
    }

    // 電話番号入力のリアルタイム整形（type="tel"のすべての入力フィールド）
    const target = /** @type {HTMLInputElement} */ (e.target);
    if (target.type === 'tel') {
      handlePhoneInputFormatting(target);
    }
  };

  app.addEventListener('input', handleInput);

  /**
   * 管理者ビュー表示中にタブ復帰した際の自動更新を試行します。
   */
  const triggerAdminAutoRefreshOnTabResume = () => {
    if (
      typeof participantActionHandlers.autoRefreshAdminViewsOnTabResume ===
      'function'
    ) {
      participantActionHandlers.autoRefreshAdminViewsOnTabResume();
    }
  };

  // タブを開きっぱなしで復帰したときに最新化（ローディング画面は表示しない）
  let wasTabHidden = document.visibilityState === 'hidden';
  /** @type {number} */
  let lastTabResumeTriggeredAt = 0;
  const TAB_RESUME_EVENT_DEBOUNCE_MS = 100;
  const triggerAdminAutoRefreshDebounced = () => {
    const now = Date.now();
    if (now - lastTabResumeTriggeredAt < TAB_RESUME_EVENT_DEBOUNCE_MS) {
      return;
    }
    lastTabResumeTriggeredAt = now;
    triggerAdminAutoRefreshOnTabResume();
  };
  document.addEventListener('visibilitychange', () => {
    const isHiddenNow = document.visibilityState === 'hidden';
    if (wasTabHidden && !isHiddenNow) {
      triggerAdminAutoRefreshDebounced();
    }
    wasTabHidden = isHiddenNow;
  });
  window.addEventListener('focus', () => {
    if (document.visibilityState === 'visible') {
      triggerAdminAutoRefreshDebounced();
    }
  });
  window.addEventListener('pageshow', () => {
    if (document.visibilityState === 'visible') {
      triggerAdminAutoRefreshDebounced();
    }
  });

  // =================================================================
  // --- リロード時のデータ再取得処理 ---
  // -----------------------------------------------------------------
  // sessionStorageから復元されたがデータがない場合、
  // ログインと同様のフローでデータを再取得する
  // ========================================================
  // リロード時のデータ再取得処理
  // ========================================================
  const restorationInfo = handlersStateManager.getRestorationInfo();

  if (
    restorationInfo.state === 'RESTORED_NEEDS_REFRESH' &&
    restorationInfo.phone
  ) {
    debugLog(
      `🔄 リロード復元: データ再取得を開始します（理由: ${restorationInfo.reason}、経過時間: ${restorationInfo.elapsedSeconds}秒、復元ビュー: ${restorationInfo.restoredView}）`,
    );

    // タイムアウト設定（15秒）
    const RELOAD_TIMEOUT_MS = 15000;
    /** @type {ReturnType<typeof setTimeout> | null} */
    let timeoutId = null;
    let isCompleted = false;

    // タイムアウトハンドラ
    const handleTimeout = () => {
      if (isCompleted) return; // 既に完了している場合は何もしない

      console.error('❌ リロード復元: データ再取得がタイムアウトしました');

      // ユーザーに通知
      showInfo(
        'データの読み込みに時間がかかっています。再度ログインしてください。',
        'タイムアウト',
      );

      // ログイン画面へ遷移
      handlersStateManager.dispatch({
        type: 'NAVIGATE',
        payload: { to: 'login' },
      });

      hideLoading();
      render();
    };

    // タイムアウトを設定
    timeoutId = setTimeout(handleTimeout, RELOAD_TIMEOUT_MS);

    // データ取得中はview-containerをクリアしてローディング画面のみ表示
    const viewContainer = document.getElementById('view-container');
    if (viewContainer) {
      viewContainer.innerHTML = '';
    }
    showLoading('dataFetch');

    google.script.run['withSuccessHandler'](
      /** @param {any} response */
      response => {
        // 完了フラグを設定（タイムアウト処理を防ぐ）
        isCompleted = true;
        if (timeoutId) clearTimeout(timeoutId);

        if (response.success && response.userFound) {
          debugLog('✅ リロード復元: データ再取得成功');

          // 状態を更新（既存の状態を保持しつつ、データのみ更新）
          const participantData = response.data.participantData;
          const now = new Date().toISOString();
          handlersStateManager.dispatch({
            type: 'UPDATE_STATE',
            payload: {
              currentUser: response.user,
              loginPhone: restorationInfo.phone,
              view: restorationInfo.restoredView || 'dashboard', // 復元されたビューを保持
              lessons: response.data.lessons || [],
              myReservations: response.data.myReservations || [],
              accountingMaster: response.data.accountingMaster || [],
              cacheVersions: response.data.cacheVersions || {},
              isAdmin: response.isAdmin || false,
              adminLogs: response.data.adminLogs || [],
              adminLogsDaysBack: CONSTANTS.UI.ADMIN_LOG_INITIAL_DAYS,
              // 参加者ビュー用データ
              participantLessons: participantData?.lessons || [],
              participantReservationsMap:
                participantData?.reservationsMap || {},
              participantAllStudents: participantData?.allStudents || {},
              participantIsAdmin: response.isAdmin || false,
              participantHasPastLessonsLoaded: true,
              participantHasMorePastLessons:
                participantData?.hasMorePastLessons === true,
              // データ取得日時
              participantDataFetchedAt: now,
              adminLogsFetchedAt: now,
              dataFetchedAt: now,
            },
          });

          // データ再取得完了をマーク
          handlersStateManager.markDataRefreshComplete();
        } else {
          // ユーザーが見つからない場合はログイン画面へ
          console.warn('⚠️ リロード復元: ユーザーが見つかりません');
          handlersStateManager.dispatch({
            type: 'NAVIGATE',
            payload: { to: 'login' },
          });
        }

        hideLoading();
        render();
      },
    )
      ['withFailureHandler'](
        /** @param {Error} error */
        error => {
          // 完了フラグを設定
          isCompleted = true;
          if (timeoutId) clearTimeout(timeoutId);

          console.error('❌ リロード復元: データ再取得エラー:', error);

          // ユーザーにエラーを通知
          showInfo(
            'データの読み込みに失敗しました。再度ログインしてください。',
            'エラー',
          );

          // エラー時はログイン画面へ
          handlersStateManager.dispatch({
            type: 'NAVIGATE',
            payload: { to: 'login' },
          });
          hideLoading();
          render();
        },
      )
      .getLoginData(
        restorationInfo.phone,
        true,
        restorationInfo.reason,
        restorationInfo.elapsedSeconds,
        restorationInfo.restoredView,
      );
  } else {
    // リロード復元不要の場合は通常通り描画
    render();
    hideLoading();

    // 管理者ビュー（participants/adminLog）のリロード時はバックグラウンド更新をトリガー
    const state = handlersStateManager.getState();
    const isAdminView =
      state.view === 'participants' || state.view === 'adminLog';
    const isAdmin = state.currentUser?.isAdmin === true;
    const needsBackgroundRefresh =
      restorationInfo.needsBackgroundRefresh === true;

    if (isAdmin && isAdminView && needsBackgroundRefresh) {
      // フラグをクリア
      /** @type {any} */ (handlersStateManager)._needsBackgroundRefresh = false;

      // バックグラウンド更新を開始（更新ボタンと同じ挙動）
      debugLog('🔄 リロード復元: バックグラウンド更新を開始');
      if (
        typeof participantActionHandlers.refreshParticipantView === 'function'
      ) {
        // 少し遅延させて描画完了後に実行
        setTimeout(() => {
          participantActionHandlers.refreshParticipantView();
        }, 500);
      }
    }
  }
};
