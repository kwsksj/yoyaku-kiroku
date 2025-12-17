/**
 * =================================================================
 * ファイル概要
 * -----------------------------------------------------------------
 * 名称: 14_WebApp_Handlers_SessionConclusion.js
 * 目的: セッション終了ウィザードのイベントハンドリングと状態管理
 * 主な責務:
 *   - ウィザードの開始・ステップ遷移・完了処理
 *   - おすすめ次回レッスンの検索ロジック
 *   - 各ステップのデータ収集とサーバー送信
 * AI向けメモ:
 *   - state管理はappWindow.stateManagerを使用
 *   - サーバー通信はgoogle.script.runを使用
 * =================================================================
 */

import {
    calculateAccountingTotal,
    classifyAccountingItems,
} from './12-1_Accounting_Calculation.js';
import { getPaymentInfoHtml } from './12-2_Accounting_UI.js';
import {
    initializePaymentMethodUI,
    setupAccountingEventListeners,
    updateAccountingCalculation,
} from './12-3_Accounting_Handlers.js';
import { collectAccountingFormData } from './12-4_Accounting_Utilities.js';
import { getSessionConclusionView } from './13_WebApp_Views_SessionConclusion.js';
import { isCurrentUserAdmin } from './14_WebApp_Handlers_Utils.js';

const conclusionStateManager = appWindow.stateManager;

/**
 * @typedef {import('./13_WebApp_Views_SessionConclusion.js').SessionConclusionState} SessionConclusionState
 */

/** ウィザードの内部状態を保持 */
let wizardState = /** @type {SessionConclusionState} */ ({
  currentStep: '1',
  currentReservation: null,
  recommendedNextLesson: null,
  selectedLesson: null,
  existingFutureReservation: null,
  reservationSkipped: false,
  isLessonListExpanded: false,
  workInProgressToday: '',
  nextLessonGoal: '',
  workInProgressNext: '',
  nextStartTime: '',
  nextEndTime: '',
  classifiedItems: null,
  accountingFormData: {},
});

/**
 * おすすめの次回レッスンを検索
 * 3〜5週間後の同条件（教室・会場・曜日・開始時間）のレッスンを探す
 * @param {ReservationCore} currentReservation - 今日の予約データ
 * @returns {LessonCore | null} おすすめのレッスン、見つからなければnull
 */
function findRecommendedNextLesson(currentReservation) {
  const state = conclusionStateManager.getState();
  const lessons = state.lessons || [];

  if (!currentReservation || !currentReservation.date) {
    return null;
  }

  const currentDate = new Date(currentReservation.date);
  const currentDayOfWeek = currentDate.getDay();

  // 2週間後以降の範囲（上限なし）
  const minDate = new Date(currentDate);
  minDate.setDate(minDate.getDate() + 14); // 2週間後

  /** @type {LessonCore | null} */
  let bestMatch = null;

  for (const lesson of lessons) {
    const lessonDate = new Date(lesson.date);

    // 日付範囲チェック（2週間後以降）
    if (lessonDate < minDate) {
      continue;
    }

    // 同じ曜日チェック
    if (lessonDate.getDay() !== currentDayOfWeek) {
      continue;
    }

    // 同じ教室チェック
    if (lesson.classroom !== currentReservation.classroom) {
      continue;
    }

    // 同じ会場チェック（venue が存在する場合）
    if (currentReservation.venue && lesson.venue !== currentReservation.venue) {
      continue;
    }

    // 空き枠があるかチェック
    const hasAvailability =
      (lesson.firstSlots || 0) > 0 ||
      (typeof lesson.secondSlots !== 'undefined'
        ? (lesson.secondSlots || 0) > 0
        : false);

    if (!hasAvailability) {
      continue;
    }

    // 最も近い日程を選択
    if (!bestMatch || lessonDate < new Date(bestMatch.date)) {
      bestMatch = lesson;
    }
  }

  return bestMatch;
}

/**
 * ウィザードを開始する
 * @param {string} reservationId - 対象の予約ID
 */
export function startSessionConclusion(reservationId) {
  const state = conclusionStateManager.getState();

  // 今日の予約を検索
  /** @type {ReservationCore | undefined} */
  let currentReservation;

  // 管理者モードの場合はparticipantReservationsMapから検索
  if (isCurrentUserAdmin() && state.participantReservationsMap) {
    for (const lessonId in state.participantReservationsMap) {
      const reservations = state.participantReservationsMap[lessonId] || [];
      const found = reservations.find(
        (/** @type {ReservationCore} */ r) => r.reservationId === reservationId,
      );
      if (found) {
        currentReservation = found;
        break;
      }
    }
  } else {
    // 通常ユーザーはmyReservationsから検索
    currentReservation = (state.myReservations || []).find(
      (/** @type {ReservationCore} */ r) => r.reservationId === reservationId,
    );
  }

  if (!currentReservation) {
    window.showInfo?.('予約データが見つかりませんでした。', 'エラー');
    return;
  }

  // 会計用のマスターデータを分類
  const accountingMaster = state.accountingMaster || [];
  const classifiedItems = classifyAccountingItems(
    accountingMaster,
    currentReservation.classroom,
  );

  // おすすめレッスンを検索
  const recommendedNextLesson = findRecommendedNextLesson(currentReservation);

  // 既存の未来予約を検索（今日以降で確定済みのもの）
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const futureReservation = (state.myReservations || []).find(
    (/** @type {ReservationCore} */ r) => {
      const reservationDate = new Date(r.date);
      reservationDate.setHours(0, 0, 0, 0);
      return (
        reservationDate > today &&
        r.status === CONSTANTS.STATUS.CONFIRMED &&
        r.reservationId !== currentReservation.reservationId
      );
    },
  );

  // ウィザード状態を初期化
  wizardState = {
    currentStep: '1',
    currentReservation: currentReservation,
    recommendedNextLesson: recommendedNextLesson,
    selectedLesson: null,
    existingFutureReservation: futureReservation || null,
    reservationSkipped: false,
    isLessonListExpanded: false,
    workInProgressToday: currentReservation.workInProgress || '',
    nextLessonGoal: '',
    workInProgressNext: '',
    nextStartTime: recommendedNextLesson?.firstStart || '',
    nextEndTime: recommendedNextLesson?.firstEnd || '',
    classifiedItems: classifiedItems,
    accountingFormData: {},
  };

  // 履歴に現在の状態を保存（smartGoBackが機能するため）
  // NAVIGATEアクションを使用して履歴を管理

  // フルページViewとして表示
  // 手動でDOM更新せず、状態遷移で描画させる
  conclusionStateManager.dispatch({
    type: 'NAVIGATE',
    payload: {
      to: /** @type {any} */ ('sessionConclusion'),
    },
  });
}

/**
 * 現在の状態に基づいてウィザードViewを取得（14_WebApp_Handlers.jsから呼ばれる）
 * @returns {string} View HTML
 */
export function getCurrentSessionConclusionView() {
  return getSessionConclusionView(wizardState);
}

/**
 * ウィザードのUIセットアップ（14_WebApp_Handlers.jsから呼ばれる）
 * @param {string} [step] - 指定された場合、そのステップに強制同期
 */
export function setupSessionConclusionUI(step) {
  if (step && wizardState) {
    wizardState.currentStep = step;
  }
  setupConclusionEventListeners();
  if (wizardState.currentStep === '4') {
    setTimeout(() => setupAccountingStep(), 100);
  }
}

/**
 * ウィザードのステップを切り替える
 * @param {string} targetStep - 移動先のステップ ('1', '2a', '2b', '3', '4')
 */
function goToStep(targetStep) {
  // 現ステップのデータを保存
  saveCurrentStepData();

  // ステップ更新
  wizardState.currentStep = targetStep;

  // 状態マネージャー更新（再描画トリガー）
  // 履歴には追加せず、現在の状態を更新するのみ
  // note: 履歴を使わないシンプルなステップ遷移
  conclusionStateManager.dispatch({
    type: 'UPDATE_STATE',
    payload: {},
  });

  // DOMを直接更新
  const contentContainer = document.querySelector('.session-conclusion-wizard');
  if (contentContainer) {
    const viewHtml = getSessionConclusionView(wizardState);
    // 全体を置換するか、中身だけ置換するか
    // getSessionConclusionViewはフルページHTMLを返すため、main-contentを更新したほうが安全
    // しかしヘッダー周りは変えたくないため、view-containerの中身を更新する
    const viewContainer = document.getElementById('view-container');
    if (viewContainer) {
      viewContainer.innerHTML = `<div class="fade-in">${viewHtml}</div>`;
      setupSessionConclusionUI();
    }
  }
}

/**
 * 現在のステップのデータを保存
 */
function saveCurrentStepData() {
  switch (wizardState.currentStep) {
    case '1': {
      const wipInput = /** @type {HTMLTextAreaElement | null} */ (
        document.getElementById('conclusion-work-progress-today')
      );
      if (wipInput) {
        wizardState.workInProgressToday = wipInput.value;
      }
      break;
    }
    case '2': {
      // 次回やりたいこと（生徒名簿に保存される）
      const goalInput = /** @type {HTMLTextAreaElement | null} */ (
        document.getElementById('conclusion-next-lesson-goal')
      );
      if (goalInput) {
        wizardState.nextLessonGoal = goalInput.value;
      }
      break;
    }
    case '3': {
      const startTimeSelect = /** @type {HTMLSelectElement | null} */ (
        document.getElementById('conclusion-next-start-time')
      );
      if (startTimeSelect) {
        wizardState.nextStartTime = startTimeSelect.value;
      }
      const endTimeSelect = /** @type {HTMLSelectElement | null} */ (
        document.getElementById('conclusion-next-end-time')
      );
      if (endTimeSelect) {
        wizardState.nextEndTime = endTimeSelect.value;
      }
      break;
    }
    case '4': {
      // 会計データの収集（ユーティリティを利用）
      wizardState.accountingFormData = collectAccountingFormData();
      break;
    }
  }
}

/**
 * 外部からウィザードのステップを設定する（履歴ナビゲーション用）
 * @param {string} step
 */
export function setWizardStep(step) {
  if (wizardState) {
    wizardState.currentStep = step;
  }
}

/**
 * 会計ステップの追加設定（既存の会計ハンドラーを利用）
 */
function setupAccountingStep() {
  if (!wizardState.classifiedItems || !wizardState.currentReservation) return;

  const classifiedItems = wizardState.classifiedItems;
  const classroom = wizardState.currentReservation.classroom;

  // 1. 支払い方法UIを初期化（デフォルト選択なし）
  // ユーザーが明示的に選択するように変更
  initializePaymentMethodUI('');

  // 2. 会計イベントリスナーを設定
  setupAccountingEventListeners(classifiedItems, classroom);

  // 3. appWindowにデータを設定（既存の updateAccountingCalculation が参照する）
  appWindow.currentClassifiedItems = classifiedItems;
  appWindow.currentClassroom = classroom;

  // 4. 会計計算を実行してUI更新
  setTimeout(() => {
    // フォームデータの収集を確実に行うため、DOM更新を待つ
    updateAccountingCalculation(classifiedItems, classroom);
    // 確認ボタンの初期状態を設定
    updateConclusionConfirmButtonState();
  }, 200); // 100ms -> 200ms に少し延長して安全策
}

/**
 * きょうのまとめ専用の確認ボタン状態更新
 */
function updateConclusionConfirmButtonState() {
  const confirmButton = /** @type {HTMLButtonElement | null} */ (
    document.getElementById('conclusion-finalize-button')
  );
  const selectedPaymentMethod = /** @type {HTMLInputElement | null} */ (
    document.querySelector('input[name="payment-method"]:checked')
  );

  if (confirmButton) {
    if (selectedPaymentMethod) {
      // 有効状態
      confirmButton.removeAttribute('disabled');
      confirmButton.removeAttribute('style'); // インラインの無効化スタイル（背景グレー等）を削除
      confirmButton.className = confirmButton.className.replace(
        /\sopacity-\d+|\scursor-not-allowed/g,
        '',
      );
    } else {
      // 無効状態
      confirmButton.setAttribute('disabled', 'true');
      confirmButton.style.pointerEvents = 'none';
      if (!confirmButton.className.includes('opacity-60')) {
        confirmButton.className += ' opacity-60 cursor-not-allowed';
      }
    }
  }
}

/**
 * ウィザード完了処理
 */
async function finalizeConclusion() {
  const confirmButton = /** @type {HTMLButtonElement | null} */ (
    document.getElementById('conclusion-finalize-button')
  );

  // 処理中なら何もしない（ダブルサブミット防止）
  if (confirmButton && confirmButton.hasAttribute('data-processing')) {
    return;
  }

  saveCurrentStepData();

  const paymentMethod = wizardState.accountingFormData?.paymentMethod;
  if (!paymentMethod) {
    window.showInfo?.('支払い方法を選択してください。', 'エラー');
    return;
  }

  // 処理中フラグを設定（論理的なダブルサブミット防止のみ残す）
  if (confirmButton) {
    confirmButton.setAttribute('data-processing', 'true');
  }

  // 会計用のローディングメッセージを表示
  window.showLoading?.('accounting');

  const state = conclusionStateManager.getState();
  const currentUser = state.currentUser;
  const reservation = wizardState.currentReservation;

  if (!reservation || !currentUser) {
    if (confirmButton) {
      confirmButton.removeAttribute('data-processing');
    }
    window.hideLoading?.();
    window.showInfo?.('必要な情報が不足しています。', 'エラー');
    return;
  }

  try {
    // 会計詳細を計算して追加（バックエンドはこれをそのまま保存する設計のため）
    const accountingMaster = state.accountingMaster || [];
    const accountingDetails = calculateAccountingTotal(
      wizardState.accountingFormData || {},
      accountingMaster,
      reservation.classroom,
    );

    // 1. 今日の記録を更新 + 会計処理を同時に行う
    const payload = {
      reservationId: reservation.reservationId,
      studentId: currentUser.studentId,
      classroom: reservation.classroom,
      // 今日の記録
      workInProgress: wizardState.workInProgressToday,
      // 次回目標（生徒名簿に保存される）
      nextLessonGoal: wizardState.nextLessonGoal || null,
      // 会計データ（すべてのフィールドを展開）
      paymentMethod: paymentMethod,
      checkedItems: wizardState.accountingFormData?.checkedItems || {},
      materials: wizardState.accountingFormData?.materials || [],
      selectedProducts: wizardState.accountingFormData?.selectedProducts || [],
      customSales: wizardState.accountingFormData?.customSales || [],
      breakTime: wizardState.accountingFormData?.breakTime,
      startTime: reservation.startTime,
      endTime: reservation.endTime,
      // 管理者フラグ
      isAdminOperation: isCurrentUserAdmin(),
      // 計算済み会計詳細（明示的に含める）
      accountingDetails: accountingDetails,
    };

    // 2. 次回予約を作成（スキップしていない場合）
    /** @type {any} */
    let nextReservationPayload = null;
    if (wizardState.recommendedNextLesson) {
      nextReservationPayload = {
        lessonId: wizardState.recommendedNextLesson.lessonId,
        classroom: wizardState.recommendedNextLesson.classroom,
        date: wizardState.recommendedNextLesson.date,
        venue: wizardState.recommendedNextLesson.venue,
        startTime:
          wizardState.nextStartTime ||
          wizardState.recommendedNextLesson.firstStart,
        endTime:
          wizardState.nextEndTime || wizardState.recommendedNextLesson.firstEnd,
        user: currentUser,
        studentId: currentUser.studentId,
        workInProgress: wizardState.workInProgressNext,
      };
    }

    // サーバー呼び出し
    google.script.run
      .withSuccessHandler((/** @type {any} */ response) => {
        window.hideLoading?.();
        if (confirmButton) {
          confirmButton.removeAttribute('data-processing');
        }

        if (response.success) {
          // 完了画面へ
          goToStep('5');

          // stateを更新（myReservationsなど）
          if (response.data) {
            conclusionStateManager.dispatch({
              type: 'SET_STATE',
              payload: {
                myReservations:
                  response.data.myReservations || state.myReservations,
                // 参加者リストキャッシュをクリア
                participantLessons: null,
                participantReservationsMap: null,
              },
            });
          }
        } else {
          window.showInfo?.(
            response.message || '処理に失敗しました。',
            'エラー',
          );
        }
      })
      .withFailureHandler((/** @type {Error} */ error) => {
        window.hideLoading?.();
        if (confirmButton) {
          confirmButton.removeAttribute('data-processing');
        }
        console.error('Session conclusion error:', error);
        window.showInfo?.('処理中にエラーが発生しました。', 'エラー');
      })
      .processSessionConclusion(payload, nextReservationPayload);
  } catch (error) {
    console.error('Session conclusion error:', error);
    if (confirmButton) {
      confirmButton.removeAttribute('data-processing');
    }
    window.showInfo?.('処理中にエラーが発生しました。', 'エラー');
    window.hideLoading?.();
  }
}

/**
 * ウィザードを閉じてダッシュボードに戻る
 */
function closeConclusion() {
  // stateManager経由でダッシュボードへ戻る
  conclusionStateManager.dispatch({
    type: 'SET_STATE',
    payload: { view: 'dashboard' },
  });

  // View再レンダリングのためにイベント発火
  const event = new CustomEvent('app-render-view');
  document.dispatchEvent(event);
}

/**
 * イベントリスナーを設定
 */
function setupConclusionEventListeners() {
  // フルページコンテナを検索
  const container =
    document.querySelector('.session-conclusion-view') ||
    document.getElementById('main-content');
  if (!container) return;

  // 既存のリスナーを削除して重複防止
  const containerEl = /** @type {HTMLElement} */ (container);
  const anyContainer = /** @type {any} */ (containerEl);
  if (anyContainer._conclusionClickHandler) {
    containerEl.removeEventListener(
      'click',
      anyContainer._conclusionClickHandler,
    );
  }
  if (anyContainer._conclusionChangeHandler) {
    containerEl.removeEventListener(
      'change',
      anyContainer._conclusionChangeHandler,
    );
  }

  // クリックイベントのデリゲーション
  anyContainer._conclusionClickHandler = handleConclusionClick;
  anyContainer._conclusionChangeHandler = handleConclusionChange;
  containerEl.addEventListener('click', anyContainer._conclusionClickHandler);
  containerEl.addEventListener('change', anyContainer._conclusionChangeHandler);
}

/**
 * クリックイベントハンドラー
 * @param {Event} event
 */
function handleConclusionClick(event) {
  const target = /** @type {HTMLElement} */ (event.target);
  const actionElement = target.closest('[data-action]');

  if (!actionElement) return;

  const action = actionElement.getAttribute('data-action');

  switch (action) {
    case 'conclusionNextStep': {
      const targetStep = actionElement.getAttribute('data-target-step') || '1';
      goToStep(targetStep);
      break;
    }
    case 'conclusionPrevStep': {
      const targetStep = actionElement.getAttribute('data-target-step') || '1';
      goToStep(targetStep);
      break;
    }
    case 'conclusionSkipReservation':
      // 予約をスキップして会計へ
      wizardState.recommendedNextLesson = null;
      goToStep('4');
      break;
    case 'conclusionFinalize':
      finalizeConclusion();
      break;
    case 'conclusionCancel':
    case 'conclusionDone':
      closeConclusion();
      break;
    case 'toggleTimeEdit': {
      const timeSection = document.getElementById('time-edit-section');
      if (timeSection) {
        timeSection.classList.toggle('hidden');
      }
      break;
    }
    case 'selectRecommendedLesson':
      // おすすめレッスンを選択した場合
      if (wizardState.recommendedNextLesson) {
        wizardState.selectedLesson = wizardState.recommendedNextLesson;
        wizardState.reservationSkipped = false;
        goToStep('3');
      }
      break;
    case 'toggleLessonListDOM': {
      // アコーディオン開閉（DOM直接操作）
      const accordion = document.getElementById('lesson-list-accordion');
      const arrow = document.getElementById('accordion-arrow');
      const toggleText = document.getElementById('accordion-toggle-text');
      console.log('🔄 toggleLessonListDOM:', {
        accordionFound: !!accordion,
        arrowFound: !!arrow,
        toggleTextFound: !!toggleText,
      });
      if (accordion) {
        const isHiddenBefore = accordion.classList.contains('hidden');
        console.log('🔄 Before toggle - isHidden:', isHiddenBefore);
        accordion.classList.toggle('hidden');
        const isHiddenAfter = accordion.classList.contains('hidden');
        console.log('🔄 After toggle - isHidden:', isHiddenAfter);
        console.log('🔄 Accordion innerHTML length:', accordion.innerHTML.length);
        if (arrow) arrow.textContent = isHiddenBefore ? '▲' : '▼';
        if (toggleText) {
          toggleText.textContent = isHiddenBefore
            ? 'にってい を とじる'
            : 'にってい いちらん から えらぶ';
        }
        wizardState.isLessonListExpanded = isHiddenBefore;
      } else {
        console.warn('⚠️ lesson-list-accordion element not found!');
      }
      break;
    }
    case 'selectLessonForConclusion': {
      // 日程選択
      const lessonId = actionElement.getAttribute('data-lesson-id');
      if (lessonId) {
        const state = conclusionStateManager.getState();
        const lessons = state.lessons || [];
        const selectedLesson = lessons.find(
          (/** @type {LessonCore} */ l) => l.lessonId === lessonId,
        );
        if (selectedLesson) {
          wizardState.selectedLesson = selectedLesson;
          wizardState.reservationSkipped = false;
          wizardState.isLessonListExpanded = false;
          goToStep('3');
        }
      }
      break;
    }
    case 'requestWaitlistForConclusion': {
      // 空き通知希望
      const lessonId = actionElement.getAttribute('data-lesson-id');
      if (lessonId) {
        const state = conclusionStateManager.getState();
        const lessons = state.lessons || [];
        const selectedLesson = lessons.find(
          (/** @type {LessonCore} */ l) => l.lessonId === lessonId,
        );
        if (selectedLesson) {
          wizardState.selectedLesson = selectedLesson;
          wizardState.reservationSkipped = false;
          wizardState.isLessonListExpanded = false;
          window.showInfo?.(
            `${window.formatDate?.(selectedLesson.date) || selectedLesson.date} の空き通知希望を登録します`,
            '空き通知',
          );
          goToStep('3');
        }
      }
      break;
    }
    case 'skipReservation':
      // いまはきめない
      wizardState.reservationSkipped = true;
      wizardState.selectedLesson = null;
      goToStep('3');
      break;
    case 'undoReservationSkip':
      // やっぱりえらぶ
      wizardState.reservationSkipped = false;
      goToStep('3');
      break;
    case 'clearSelectedLesson':
      // 選択解除
      wizardState.selectedLesson = null;
      goToStep('3');
      break;
    case 'goToCalendarSelection':
      // カレンダー選択画面への遷移
      window.showInfo?.('カレンダー選択機能は準備中です。', 'お知らせ');
      break;
    default:
      console.log('Unknown action:', action);
  }
}

/**
 * 変更イベントハンドラー
 * @param {Event} event
 */
function handleConclusionChange(event) {
  const target = /** @type {HTMLInputElement} */ (event.target);

  // 支払い方法の変更
  if (target.name === 'payment-method') {
    const paymentInfoContainer = document.getElementById(
      'payment-info-container',
    );
    if (paymentInfoContainer) {
      paymentInfoContainer.innerHTML = getPaymentInfoHtml(target.value);
    }
    // 確定ボタンを有効化
    updateConclusionConfirmButtonState();
    // 会計再計算
    if (wizardState.classifiedItems && wizardState.currentReservation) {
      updateAccountingCalculation(
        wizardState.classifiedItems,
        wizardState.currentReservation.classroom,
      );
    }
  }
}

/** 外部からアクションハンドラーとして登録 */
export const sessionConclusionActionHandlers = {
  startSessionConclusion: (/** @type {ActionHandlerData} */ d) => {
    if (d.reservationId) {
      startSessionConclusion(String(d.reservationId));
    }
  },
  conclusionNextStep: (/** @type {ActionHandlerData} */ d) => {
    const step = String(d['target-step'] || d['targetStep'] || '1');
    goToStep(step);
  },
  conclusionPrevStep: (/** @type {ActionHandlerData} */ d) => {
    const step = String(d['target-step'] || d['targetStep'] || '1');
    goToStep(step);
  },
  conclusionSkipReservation: () => {
    wizardState.recommendedNextLesson = null;
    goToStep('4');
  },
  conclusionFinalize: () => {
    finalizeConclusion();
  },
  conclusionCancel: () => {
    closeConclusion();
  },
  conclusionDone: () => {
    closeConclusion();
  },
  selectRecommendedLesson: (
    /** @type {any} */ _d,
    /** @type {HTMLElement} */ target,
  ) => {
    // おすすめ日程を選択済みとしてマーク
    const lessonId = target?.getAttribute('data-lesson-id');
    if (lessonId && wizardState.recommendedNextLesson) {
      wizardState.selectedLesson = wizardState.recommendedNextLesson;
      wizardState.reservationSkipped = false;
      // 再描画
      goToStep('3');
    }
  },
  // 「いまはきめない」
  skipReservation: () => {
    wizardState.reservationSkipped = true;
    wizardState.selectedLesson = null;
    // 再描画
    goToStep('3');
  },
  // 「やっぱりえらぶ」
  undoReservationSkip: () => {
    wizardState.reservationSkipped = false;
    // 再描画
    goToStep('3');
  },
  // 日程一覧アコーディオン開閉（再描画あり - 旧版、削除予定）
  toggleLessonList: () => {
    wizardState.isLessonListExpanded = !wizardState.isLessonListExpanded;
    // 再描画
    goToStep('3');
  },
  // 日程一覧アコーディオン開閉（DOM直接操作）
  toggleLessonListDOM: () => {
    const accordion = document.getElementById('lesson-list-accordion');
    const arrow = document.getElementById('accordion-arrow');
    const toggleText = document.getElementById('accordion-toggle-text');
    if (accordion) {
      const isHidden = accordion.classList.contains('hidden');
      accordion.classList.toggle('hidden');
      if (arrow) {
        arrow.textContent = isHidden ? '▲' : '▼';
      }
      if (toggleText) {
        toggleText.textContent = isHidden
          ? 'にってい を とじる'
          : 'にってい いちらん から えらぶ';
      }
      // stateも同期（再描画時用）
      wizardState.isLessonListExpanded = isHidden;
    }
  },
  // ウィザード内での日程選択
  selectLessonForConclusion: (
    /** @type {any} */ _d,
    /** @type {HTMLElement} */ target,
  ) => {
    const lessonId = target?.getAttribute('data-lesson-id');
    if (!lessonId) return;

    // lessonsからlessonIdで検索
    const state = conclusionStateManager.getState();
    const lessons = state.lessons || [];
    const selectedLesson = lessons.find(
      (/** @type {LessonCore} */ l) => l.lessonId === lessonId,
    );

    if (selectedLesson) {
      wizardState.selectedLesson = selectedLesson;
      wizardState.reservationSkipped = false;
      wizardState.isLessonListExpanded = false;
      // 再描画してスロット表示を更新
      goToStep('3');
    }
  },
  // 選択解除
  clearSelectedLesson: () => {
    wizardState.selectedLesson = null;
    // 再描画
    goToStep('3');
  },
  // 時間編集セクション開閉
  toggleTimeEdit: () => {
    const timeSection = document.getElementById('time-edit-section');
    if (timeSection) {
      timeSection.classList.toggle('hidden');
    }
  },
  // 空き通知希望（ウィザード内）
  requestWaitlistForConclusion: (
    /** @type {any} */ _d,
    /** @type {HTMLElement} */ target,
  ) => {
    const lessonId = target?.getAttribute('data-lesson-id');
    if (!lessonId) return;

    // lessonsからlessonIdで検索
    const state = conclusionStateManager.getState();
    const lessons = state.lessons || [];
    const selectedLesson = lessons.find(
      (/** @type {LessonCore} */ l) => l.lessonId === lessonId,
    );

    if (selectedLesson) {
      // 空き通知希望として選択
      wizardState.selectedLesson = selectedLesson;
      wizardState.reservationSkipped = false;
      wizardState.isLessonListExpanded = false;
      // TODO: 実際の空き通知希望登録はfinalizeConclusion時に行う
      window.showInfo?.(
        `${window.formatDate?.(selectedLesson.date) || selectedLesson.date} の空き通知希望を登録します`,
        '空き通知',
      );
      // 再描画してスロット表示を更新
      goToStep('3');
    }
  },
};
