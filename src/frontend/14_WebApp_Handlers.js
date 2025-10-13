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
      tuition: { items: [] },
      sales: { materialItems: [], productItems: [] },
    })
  );

// Window型の拡張（型エラー回避のため）
/** @type {Window & { tempPaymentData?: TempPaymentData; isProduction?: boolean; }} */
export const windowTyped = window;

/**
 * 現在のアプリケーションの状態に基づいて、適切なビューを描画する
 * データ更新の必要性を判定し、必要に応じて最新データ取得後に再描画
 * stateManager.getState().viewの値に応じて対応するビュー関数を呼び出してUIを更新
 */
export function render() {
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
      v = getRegisterView(
        /** @type {string | undefined} */ (
          /** @type {any} */ (appState).registrationPhone
        ),
      );
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
    case 'reservationForm':
      v = getReservationFormView();
      break;
    case 'accounting':
      // 会計画面用のデータを取得
      const reservationData = appState.accountingReservation;
      const classroom = reservationData?.classroom || '';

      // 事前初期化されたキャッシュを優先使用
      const accountingCache = /** @type {any} */ (window).accountingSystemCache;
      let classifiedItems = null;

      if (accountingCache && classroom && accountingCache[classroom]) {
        // キャッシュから高速取得
        classifiedItems = accountingCache[classroom];
        if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
          console.log('✅ 会計システムキャッシュ使用:', classroom);
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
        window.currentClassifiedItems = classifiedItems;
        window.currentClassroom = classroom;

        // 会計画面HTML生成
        const formData = {};
        v = generateAccountingView(
          classifiedItems,
          classroom,
          formData,
          reservationData,
        );

        // キャッシュ使用時の初期化処理を予約
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
    case 'complete':
      v = getCompleteView(
        /** @type {string | undefined} */ (
          /** @type {any} */ (appState).completionMessage
        ),
      );
      break;
  }
  document.getElementById('view-container').innerHTML =
    `<div class="fade-in">${v}</div>`;

  // もどるボタンを動的に更新
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
      // 事前設定されたグローバル変数から取得（キャッシュ活用）
      const classifiedItems =
        window.currentClassifiedItems || EMPTY_CLASSIFIED_ITEMS;
      const classroom = window.currentClassroom || '';

      if (typeof setupAccountingEventListeners === 'function') {
        setupAccountingEventListeners(classifiedItems, classroom);
      }
      // 初期計算も実行
      if (typeof updateAccountingCalculation === 'function') {
        updateAccountingCalculation(classifiedItems, classroom);
      }
    });
  }

  window.scrollTo(0, 0);
}

/**
 * 会計画面での入力変更を処理します。
 * 合計金額の再計算と、入力内容のキャッシュ保存を行います。
 */
export function handleAccountingFormChange() {
  // リアルタイムで合計金額を再計算
  if (typeof updateAccountingCalculation === 'function') {
    // 会計画面用のデータを取得
    const classifiedItems =
      window.currentClassifiedItems || EMPTY_CLASSIFIED_ITEMS;
    const classroom = window.currentClassroom || '';
    updateAccountingCalculation(classifiedItems, classroom);
  }

  // フォーム内容が変更されたら、キャッシュに保存する
  const reservationId =
    stateManager.getState().accountingReservation?.reservationId;
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
    console.log('🔧 reservationActionHandlers確認:', {
      defined: typeof reservationActionHandlers !== 'undefined',
      hasCancel: typeof reservationActionHandlers?.cancel === 'function',
      keys:
        typeof reservationActionHandlers !== 'undefined'
          ? Object.keys(reservationActionHandlers)
          : [],
    });
  }

  actionHandlers = {
    // =================================================================
    // --- Core Navigation Handlers ---
    // -----------------------------------------------------------------
    /** スマートナビゲーション: 前の画面にもどる */
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
    // --- Accounting Handlers (整理済み) ---
    // -----------------------------------------------------------------

    /** 会計画面に遷移（新システム対応版） */
    goToAccounting: (/** @type {{ reservationId: string }} */ d) => {
      showLoading('accounting');
      const reservationId = d.reservationId;

      // 統一検索関数を使用して予約データを取得
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
        // 会計マスタデータを取得
        const state = stateManager.getState();
        const accountingMaster = state.accountingMaster || [];

        // 予約データを状態に設定して会計画面に遷移
        stateManager.dispatch({
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
        showInfo('予約・記録情報が見つかりませんでした。', 'エラー');
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

    /** 支払い確認モーダルを表示 */
    showPaymentModal: () => {
      // 会計画面から支払い確認モーダルを表示する
      const state = stateManager.getState();
      const classroom = state.accountingReservation?.classroom;
      const classifiedItems = window.currentClassifiedItems;

      if (classifiedItems && classroom) {
        // 12_WebApp_Core_Accounting.jsの関数を呼び出し
        if (typeof showPaymentConfirmModal === 'function') {
          showPaymentConfirmModal(classifiedItems, classroom);
        } else {
          console.error('showPaymentConfirmModal関数が見つかりません');
          showInfo('支払い確認モーダルの表示に失敗しました。', 'エラー');
        }
      } else {
        showInfo('会計データが不足しています。', 'エラー');
      }
    },

    /** 支払い完了処理（ローディング→完了画面の流れ） */
    confirmAndPay: () => {
      // window.tempPaymentDataが存在する場合はそれを使用（支払い確認モーダルから呼び出された場合）
      if (windowTyped.tempPaymentData) {
        if (!windowTyped.isProduction) {
          console.log(
            '🔍 confirmAndPay: tempPaymentDataを使用',
            windowTyped.tempPaymentData,
          );
        }
        const { formData, result, classifiedItems, classroom } =
          windowTyped.tempPaymentData;

        // processAccountingPayment関数を直接呼び出し
        if (typeof processAccountingPayment === 'function') {
          processAccountingPayment(
            formData,
            result,
            classifiedItems,
            classroom,
          );
        } else {
          console.error('processAccountingPayment関数が見つかりません');
        }
        return;
      }

      // 従来の処理（tempPaymentDataがない場合のフォールバック）
      const state = stateManager.getState();
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
      const payload = {
        reservationId,
        classroom,
        studentId,
        userInput: formData,
      };

      // モーダルを閉じてローディング開始
      hideModal();
      showLoading('accounting');

      // バックエンド送信
      if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run['withSuccessHandler'](
          (/** @type {ServerResponse<any>} */ response) => {
            hideLoading();
            if (response.success) {
              // データを最新に更新
              if (response.data) {
                stateManager.dispatch({
                  type: 'SET_STATE',
                  payload: response.data,
                });
              }

              // 成功時：完了画面を表示
              const completionMessage = `会計情報を記録しました。`;
              const currentState = stateManager.getState();
              stateManager.dispatch({
                type: 'SET_STATE',
                payload: {
                  view: 'complete',
                  completionMessage: completionMessage,
                  selectedClassroom:
                    currentState.accountingReservation?.classroom,
                },
              });
            } else {
              showInfo('会計処理に失敗しました: ' + (response.message || ''));
            }
          },
        )
          ['withFailureHandler']((/** @type {Error} */ error) => {
            hideLoading();
            console.error('会計処理エラー:', error);
            showInfo('会計処理に失敗しました。', 'エラー');
          })
          .saveAccountingDetailsAndGetLatestData(payload);
      } else {
        hideLoading();
        showInfo(
          'システムエラー：Google Apps Scriptとの通信ができません。',
          'システムエラー',
        );
      }
    },

    // --- モーダル関連アクション ---

    /** 支払い確認モーダルをキャンセル */
    cancelPaymentConfirm: () => {
      if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
        console.log('🔵 cancelPaymentConfirm実行');
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
        console.log('🔵 showAccountingConfirmation実行');
      }
      // 現在のconfirmAndPayと同じ動作
      actionHandlers.confirmAndPay();
    },

    /** 支払い処理を実行 */
    processPayment: () => {
      if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
        console.log('🔵 processPayment実行（グローバルハンドラー）');
      }

      if (typeof handleProcessPayment === 'function') {
        handleProcessPayment();
      } else {
        console.warn('handleProcessPayment関数が見つかりません');
      }
    },
  };

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
      if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
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
            targetElement,
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
    console.log('🔧 actionHandlers構築完了:', {
      hasCancel: typeof actionHandlers['cancel'] === 'function',
      totalHandlers: Object.keys(actionHandlers).length,
      reservationHandlers: Object.keys(actionHandlers).filter(key =>
        ['cancel', 'confirmBooking', 'goToEditReservation'].includes(key),
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
      if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
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

    // 電話番号入力のリアルタイム整形（type="tel"のすべての入力フィールド）
    const target = /** @type {HTMLInputElement} */ (e.target);
    if (target.type === 'tel') {
      handlePhoneInputFormatting(target);
    }
  };

  app.addEventListener('input', handleInput);

  // 初期画面を描画
  render();

  // 初期画面の描画が完了したらローディング画面を非表示にする
  hideLoading();
};
