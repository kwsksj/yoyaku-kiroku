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

import { classifyAccountingItems } from './12-1_Accounting_Calculation.js';
import {
  getPaymentInfoHtml,
  getPaymentOptionsHtml,
} from './12-2_Accounting_UI.js';
import {
  getSessionConclusionView,
  renderConclusionComplete,
  renderStep1Record,
  renderStep2Reservation,
  renderStep3Accounting,
} from './13_WebApp_Views_SessionConclusion.js';
import { isCurrentUserAdmin } from './14_WebApp_Handlers_Utils.js';

const conclusionStateManager = appWindow.stateManager;

/**
 * @typedef {import('./13_WebApp_Views_SessionConclusion.js').SessionConclusionState} SessionConclusionState
 */

/** ウィザードの内部状態を保持 */
let wizardState = /** @type {SessionConclusionState} */ ({
  currentStep: 1,
  currentReservation: null,
  recommendedNextLesson: null,
  workInProgressToday: '',
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

  // 3週間後〜5週間後の範囲
  const minDate = new Date(currentDate);
  minDate.setDate(minDate.getDate() + 21); // 3週間後
  const maxDate = new Date(currentDate);
  maxDate.setDate(maxDate.getDate() + 35); // 5週間後

  /** @type {LessonCore | null} */
  let bestMatch = null;

  for (const lesson of lessons) {
    const lessonDate = new Date(lesson.date);

    // 日付範囲チェック
    if (lessonDate < minDate || lessonDate > maxDate) {
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

  // ウィザード状態を初期化
  wizardState = {
    currentStep: 1,
    currentReservation: currentReservation,
    recommendedNextLesson: recommendedNextLesson,
    workInProgressToday: currentReservation.workInProgress || '',
    workInProgressNext: '',
    nextStartTime: recommendedNextLesson?.firstStart || '',
    nextEndTime: recommendedNextLesson?.firstEnd || '',
    classifiedItems: classifiedItems,
    accountingFormData: {},
  };

  // フルページViewとして表示
  const viewHtml = getSessionConclusionView(wizardState);
  const mainContent = document.getElementById('main-content');
  if (mainContent) {
    mainContent.innerHTML = viewHtml;
  }

  // イベントリスナーを設定
  setupConclusionEventListeners();
}

/**
 * ウィザードのステップを切り替える
 * @param {number} targetStep - 移動先のステップ番号
 */
function goToStep(targetStep) {
  // 現ステップのデータを保存
  saveCurrentStepData();

  wizardState.currentStep = targetStep;

  // フルページのコンテンツを更新
  const contentContainer = document.querySelector('.session-conclusion-wizard');
  if (!contentContainer) {
    // コンテナがない場合は全体を再レンダリング
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.innerHTML = getSessionConclusionView(wizardState);
      setupConclusionEventListeners();
      if (targetStep === 3) {
        setTimeout(() => setupAccountingStep(), 100);
      }
    }
    return;
  }

  let newContent = '';
  switch (targetStep) {
    case 1:
      newContent = renderStep1Record(wizardState);
      break;
    case 2:
      newContent = renderStep2Reservation(wizardState);
      break;
    case 3:
      newContent = renderStep3Accounting(wizardState);
      // 会計画面の追加設定が必要
      setTimeout(() => setupAccountingStep(), 100);
      break;
    case 4:
      newContent = renderConclusionComplete();
      break;
    default:
      newContent = renderStep1Record(wizardState);
  }

  contentContainer.innerHTML = newContent;

  // イベントリスナーを再設定
  setupConclusionEventListeners();
}

/**
 * 現在のステップのデータを保存
 */
function saveCurrentStepData() {
  switch (wizardState.currentStep) {
    case 1: {
      const wipInput = /** @type {HTMLTextAreaElement | null} */ (
        document.getElementById('conclusion-work-progress-today')
      );
      if (wipInput) {
        wizardState.workInProgressToday = wipInput.value;
      }
      break;
    }
    case 2: {
      const nextWipInput = /** @type {HTMLTextAreaElement | null} */ (
        document.getElementById('conclusion-work-progress-next')
      );
      if (nextWipInput) {
        wizardState.workInProgressNext = nextWipInput.value;
      }
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
    case 3: {
      // 会計データの収集（別関数で処理）
      collectAccountingData();
      break;
    }
  }
}

/**
 * 会計データを収集
 * 既存の12-4_Accounting_Utilities.jsのcollectAccountingFormDataを活用
 */
function collectAccountingData() {
  // モーダル内の会計UIからデータを収集
  /** @type {AccountingFormDto} */
  const formData = {};

  // 支払い方法収集
  const paymentMethodRadio = /** @type {HTMLInputElement | null} */ (
    document.querySelector(
      '#session-conclusion-modal input[name="payment-method"]:checked',
    )
  );
  if (paymentMethodRadio) {
    formData.paymentMethod = paymentMethodRadio.value;
  }

  // チェックボックス項目収集
  /** @type {Record<string, boolean>} */
  const checkedItems = {};
  const checkboxes = document.querySelectorAll(
    '#session-conclusion-modal .accounting-container input[type="checkbox"]',
  );
  checkboxes.forEach(checkboxElement => {
    const checkbox = /** @type {HTMLInputElement} */ (checkboxElement);
    if (checkbox.checked) {
      const itemName = checkbox.getAttribute('data-item-name');
      if (itemName) {
        checkedItems[itemName] = true;
      }
    }
  });
  if (Object.keys(checkedItems).length > 0) {
    formData.checkedItems = checkedItems;
  }

  wizardState.accountingFormData = formData;
}

/**
 * 会計ステップの追加設定（支払い方法の表示など）
 */
function setupAccountingStep() {
  const paymentOptionsContainer = document.getElementById(
    'payment-options-container',
  );
  const paymentInfoContainer = document.getElementById(
    'payment-info-container',
  );

  if (paymentOptionsContainer) {
    paymentOptionsContainer.innerHTML = getPaymentOptionsHtml('');
  }
  if (paymentInfoContainer) {
    paymentInfoContainer.innerHTML = getPaymentInfoHtml('');
  }

  // 会計計算を実行
  updateAccountingCalculation();
}

/**
 * 会計の再計算
 */
function updateAccountingCalculation() {
  if (!wizardState.classifiedItems || !wizardState.currentReservation) return;

  // 基本授業料は時間で自動計算されるため、ここでは合計表示を更新
  let total = 0;

  // 授業料セクションのチェック済み項目から金額を計算
  const checkedItemElements = document.querySelectorAll(
    '#session-conclusion-modal .accounting-container input[type="checkbox"]:checked',
  );
  checkedItemElements.forEach(el => {
    const priceAttr = el.getAttribute('data-price');
    if (priceAttr) {
      total += parseInt(priceAttr, 10) || 0;
    }
  });

  // 基本授業料（教室ごと固定 or 時間計算）
  // 既存のclassifiedItemsから取得
  const baseItem = wizardState.classifiedItems?.tuition?.baseItems?.[0];
  if (baseItem) {
    // 授業料は通常チェック済みとして加算
    total += baseItem['price'] || 0;
  }

  const totalDisplay = document.getElementById('grand-total-amount');
  if (totalDisplay) {
    totalDisplay.innerHTML = `¥${total.toLocaleString()}`;
  }
}

/**
 * ウィザード完了処理
 */
async function finalizeConclusion() {
  saveCurrentStepData();

  const paymentMethod = wizardState.accountingFormData?.paymentMethod;
  if (!paymentMethod) {
    window.showInfo?.('支払い方法を選択してください。', 'エラー');
    return;
  }

  window.showLoading?.('processing');

  const state = conclusionStateManager.getState();
  const currentUser = state.currentUser;
  const reservation = wizardState.currentReservation;

  if (!reservation || !currentUser) {
    window.hideLoading?.();
    window.showInfo?.('必要な情報が不足しています。', 'エラー');
    return;
  }

  try {
    // 1. 今日の記録を更新 + 会計処理を同時に行う
    const payload = {
      reservationId: reservation.reservationId,
      studentId: currentUser.studentId,
      classroom: reservation.classroom,
      // 今日の記録
      workInProgress: wizardState.workInProgressToday,
      // 会計データ
      paymentMethod: paymentMethod,
      checkedItems: wizardState.accountingFormData?.checkedItems || {},
      startTime: reservation.startTime,
      endTime: reservation.endTime,
      // 管理者フラグ
      isAdminOperation: isCurrentUserAdmin(),
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

        if (response.success) {
          // 完了画面へ
          goToStep(4);

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
        console.error('Session conclusion error:', error);
        window.showInfo?.('処理中にエラーが発生しました。', 'エラー');
      })
      .processSessionConclusion(payload, nextReservationPayload);
  } catch (error) {
    console.error('Session conclusion error:', error);
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
    payload: { currentView: 'dashboard' },
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
      const targetStep = parseInt(
        actionElement.getAttribute('data-target-step') || '1',
        10,
      );
      goToStep(targetStep);
      break;
    }
    case 'conclusionPrevStep': {
      const targetStep = parseInt(
        actionElement.getAttribute('data-target-step') || '1',
        10,
      );
      goToStep(targetStep);
      break;
    }
    case 'conclusionSkipReservation':
      // 予約をスキップして会計へ
      wizardState.recommendedNextLesson = null;
      goToStep(3);
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
      // おすすめレッスンを選択した場合の視覚的フィードバック
      actionElement.classList.add('ring-2', 'ring-action-primary-bg');
      break;
    case 'goToCalendarSelection':
      // カレンダー選択画面への遷移
      // TODO: 別途実装
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
    const finalizeBtn = /** @type {HTMLButtonElement | null} */ (
      document.getElementById('conclusion-finalize-button')
    );
    if (finalizeBtn) {
      finalizeBtn.disabled = false;
      finalizeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
    // 会計再計算
    updateAccountingCalculation();
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
    const step = parseInt(
      String(d['target-step'] || d['targetStep'] || '1'),
      10,
    );
    goToStep(step);
  },
  conclusionPrevStep: (/** @type {ActionHandlerData} */ d) => {
    const step = parseInt(
      String(d['target-step'] || d['targetStep'] || '1'),
      10,
    );
    goToStep(step);
  },
  conclusionSkipReservation: () => {
    wizardState.recommendedNextLesson = null;
    goToStep(3);
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
};
