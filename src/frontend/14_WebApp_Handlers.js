// @ts-check
/// <reference path="../../types/dev-environment.d.ts" />
/// <reference path="../../types/html-environment.d.ts" />
/// <reference path="../../types/api-types.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 14_WebApp_Handlers.js
 * 【バージョン】: 2.0
 * 【役割】: WebAppのフロントエンドにおける、ユーザーの操作に応じた
 * アクションと、アプリケーション全体の制御フローを集約します。
 * 【構成】: 14ファイル構成のうちの14番目（機能別分割済み）
 * 【v2.0での変更点】:
 * - ファイル分割によるメンテナンス性向上
 * - 機能別アクションハンドラーの統合管理
 * - AI作業効率向上のための構造最適化
 * =================================================================
 */

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

/** @type {ActionHandlers} */
const actionHandlers = {
  // =================================================================
  // --- Core Navigation Handlers ---
  // -----------------------------------------------------------------
  /** スマートナビゲーション: 前の画面に戻る */
  smartGoBack: () => {
    const backState = stateManager.goBack();
    stateManager.dispatch({
      type: 'SET_STATE',
      payload: backState,
    });
  },

  /** モーダルの確認ボタンを押したときの処理です */
  modalConfirm: () => {
    ModalManager.executeCallback();
    hideModal();
  },

  /** モーダルのキャンセルボタンを押したときの処理です */
  modalCancel: () => hideModal(),

  // =================================================================
  // --- Authentication Handlers (from 14_WebApp_Handlers_Auth.js) ---
  // -----------------------------------------------------------------
  ...authActionHandlers,

  // =================================================================
  // --- History Management Handlers (from 14_WebApp_Handlers_History.js) ---
  // -----------------------------------------------------------------
  ...historyActionHandlers,

  // =================================================================
  // --- Reservation Handlers (from 14_WebApp_Handlers_Reservation.js) ---
  // -----------------------------------------------------------------
  ...reservationActionHandlers,

  // =================================================================
  // --- Accounting Handlers (from 14_WebApp_Handlers_Accounting.js) ---
  // -----------------------------------------------------------------
  ...accountingActionHandlers,
};

// =================================================================
// --- Application Core Functions ---
// -----------------------------------------------------------------
// アプリケーションの起動、状態管理、画面描画など、
// 全体を制御するコアとなる関数群です。
// =================================================================

/**
 * 現在のアプリケーションの状態に基づいて、適切なビューを描画する
 * データ更新の必要性を判定し、必要に応じて最新データ取得後に再描画
 * stateManager.getState().viewの値に応じて対応するビュー関数を呼び出してUIを更新
 */
function render() {
  // appStateの安全な参照確認
  const appState = window.stateManager?.getState();
  if (!appState) {
    console.warn('render(): stateManagerが未初期化のため処理をスキップします');
    return;
  }

  console.log('🎨 render実行:', appState.view);

  // 無限ループを避けるため、データ更新処理は削除
  // 単純にビューを描画するだけ

  let v = '';
  switch (appState.view) {
    case 'login':
      v = getLoginView();
      break;
    case 'register':
      v = getRegisterView(/** @type {any} */ (appState)['registrationPhone']);
      break;
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
      v = getBookingView(appState.selectedClassroom);
      break;
    case 'newReservation':
      v = getReservationFormView('new');
      break;
    case 'editReservation':
      v = getReservationFormView('edit');
      break;
    case 'accounting':
      v = getAccountingView();
      break;
    case 'complete':
      v = getCompleteView(/** @type {any} */ (appState)['completionMessage']);
      break;
    case 'userSearch':
      v = getUserSearchView();
      break;
  }
  document.getElementById('view-container').innerHTML =
    `<div class="fade-in">${v}</div>`;

  // 戻るボタンを動的に更新
  const backButtonContainer = document.getElementById('back-button-container');
  if (backButtonContainer) {
    backButtonContainer.innerHTML = Components.createSmartBackButton(
      appState.view,
      appState,
    );
  }

  // 会計画面の場合、イベントリスナーを設定
  if (appState.view === 'accounting') {
    // DOM更新後にイベントリスナーを設定するため、次のフレームで実行
    requestAnimationFrame(() => {
      setupAccountingEventListeners();
      // 初期計算も実行
      updateAccountingCalculation();
    });
  }

  window.scrollTo(0, 0);
}

/**
 * 会計画面での入力変更を処理します。
 * 合計金額の再計算と、入力内容のキャッシュ保存を行います。
 */
function handleAccountingFormChange() {
  // リアルタイムで合計金額を再計算
  calculateAccountingDetails();

  // フォーム内容が変更されたら、キャッシュに保存する
  const reservationId =
    stateManager.getState().accountingReservation?.reservationId;
  if (reservationId) {
    const accountingData = getAccountingFormData();
    saveAccountingCache(reservationId, accountingData);
  }
}

/**
 * アプリケーションの起動点です。
 * ページ読み込み完了時に実行され、イベントリスナーを設定します。
 */
window.onload = function () {
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
    const targetElement = e.target.closest('button, [data-action]');
    if (targetElement?.dataset?.['action']) {
      const action = targetElement.dataset['action'];
      const { action: _, ...data } = targetElement.dataset;

      // デバッグ情報を追加
      if (!window.isProduction) {
        console.log('🔘 クリックイベント:', {
          action,
          data,
          element: targetElement,
          tagName: targetElement.tagName,
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
        targetElement.dataset['action']
      ) {
        // イベント伝播を停止しない（モーダル内のボタンを有効にする）
      }

      if (/** @type {any} */ (actionHandlers)[action]) {
        // 特殊なハンドラー（copyToClipboard, copyGrandTotal）はtargetElementを渡す
        if (action === 'copyToClipboard' || action === 'copyGrandTotal') {
          /** @type {any} */ (actionHandlers)[action]({ ...data, targetElement });
        } else {
          /** @type {any} */ (actionHandlers)[action](data);
        }
      } else {
        // ハンドラーが見つからない場合のデバッグ
        if (!window.isProduction) {
          console.warn('⚠️ アクションハンドラーが見つかりません:', action);
        }
      }
    }
  };

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

    // 会計モーダルでの支払い方法選択
    if (
      e.target.matches('#modal-accounting-form input[name="payment-method"]')
    ) {
      /** @type {HTMLButtonElement | null} */
      const confirmButton = /** @type {HTMLButtonElement | null} */ (
        document.getElementById('confirm-payment-button')
      );
      confirmButton?.removeAttribute('disabled');

      // 選択された支払方法に応じて情報を動的に更新
      const selectedPaymentMethod = /** @type {HTMLInputElement} */ (e.target)
        .value;
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
    const accountingForm = e.target.closest('#accounting-form');
    if (stateManager.getState().view === 'accounting' && accountingForm) {
      handleAccountingFormChange();

      // デバッグログ
      if (!window.isProduction) {
        const target = /** @type {HTMLInputElement} */ (e.target);
        console.log('🔄 会計フォーム変更イベント:', {
          element: target.name || target.id,
          value: target.value,
          checked: target.checked,
        });
      }
    }

    // 新規登録Step3での経験有無による表示切り替え
    const inputTarget = /** @type {HTMLInputElement} */ (e.target);
    if (inputTarget.name === 'experience') {
      /** @type {HTMLElement | null} */
      const pastWorkContainer = document.getElementById('past-work-container');
      if (pastWorkContainer) {
        pastWorkContainer.classList.toggle(
          'hidden',
          inputTarget.value === 'はじめて！',
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
    if (stateManager.getState().view === 'accounting' && accountingForm) {
      handleAccountingFormChange();
    }

    // 電話番号入力のリアルタイム整形
    const target = /** @type {HTMLInputElement} */ (e.target);
    if (target.id === 'phone' || target.id === 'edit-phone') {
      handlePhoneInputFormatting(target);
    }
  };

  app.addEventListener('input', handleInput);

  // 初期画面を描画
  render();

  // 初期画面の描画が完了したらローディング画面を非表示にする
  hideLoading();
};