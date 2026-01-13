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
import {
  getSessionConclusionView,
  STEPS,
} from './13_WebApp_Views_SessionConclusion.js';
import { isCurrentUserAdmin } from './14_WebApp_Handlers_Utils.js';

const conclusionStateManager = appWindow.stateManager;

/**
 * @typedef {import('./13_WebApp_Views_SessionConclusion.js').SessionConclusionState} SessionConclusionState
 */

/** ウィザードの内部状態を保持 */
let wizardState = /** @type {SessionConclusionState} */ ({
  currentStep: STEPS.RECORD,
  currentReservation: null,
  recommendedNextLesson: null,
  selectedLesson: null,
  existingFutureReservation: null,
  reservationSkipped: false,
  isWaitlistRequest: false,
  isLessonListExpanded: false,
  sessionNoteToday: '',
  nextLessonGoal: '',
  sessionNoteNext: '',
  nextStartTime: '',
  nextEndTime: '',
  classifiedItems: null,
  accountingFormData: {},
  filterClassroom: 'current', // 'current' | 'all'
  orderInput: '', // 材料希望
  materialInput: '', // 注文品希望
});

/**
 * 次回のおすすめレッスンを探す（3週間後以降、同じ曜日タイプ、同じ教室・会場）
 * @param {ReservationCore} currentReservation - 今日のよやくデータ
 * @returns {LessonCore | null} おすすめのレッスン、見つからなければnull
 */
function findRecommendedNextLesson(currentReservation) {
  if (!currentReservation || !currentReservation.date) {
    return null;
  }

  const allLessons = window.appWindow?.stateManager?.getState()?.lessons || [];
  const currentDate = new Date(currentReservation.date);
  currentDate.setHours(0, 0, 0, 0);

  // 1. 3週間後の日付を計算
  const targetStartDate = new Date(currentDate);
  targetStartDate.setDate(targetStartDate.getDate() + 21); // 3週間後

  // 2. 曜日タイプの判定 (0:日曜, 6:土曜 => 土日, 1-5 => 平日)
  const currentDay = currentDate.getDay();
  const isWeekend = currentDay === 0 || currentDay === 6;

  // 3. 検索
  const candidates = allLessons.filter((/** @type {LessonCore} */ lesson) => {
    const lessonDate = new Date(lesson.date);
    lessonDate.setHours(0, 0, 0, 0);

    // 未来の日程（3週間後以降）であること
    if (lessonDate < targetStartDate) return false;

    // 同じ教室であること
    if (lesson.classroom !== currentReservation.classroom) return false;

    // 同じ会場であること (null/undefined/空文字も考慮して比較)
    const currentVenue = currentReservation.venue || '';
    const lessonVenue = lesson.venue || '';
    if (currentVenue !== lessonVenue) return false;

    // 満席でないこと (first or second slots)
    const hasAvailability =
      (lesson.firstSlots || 0) > 0 ||
      (typeof lesson.secondSlots !== 'undefined'
        ? (lesson.secondSlots || 0) > 0
        : false);
    if (!hasAvailability) return false;

    // 曜日タイプの一致
    const lessonDay = lessonDate.getDay();
    const lessonIsWeekend = lessonDay === 0 || lessonDay === 6;

    return isWeekend === lessonIsWeekend;
  });

  // 日付順にソートして最短のものを選ぶ
  candidates.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  return candidates.length > 0 ? candidates[0] : null;
}

/**
 * ウィザードを開始する
 * @param {string} reservationId - 対象の予約ID
 */
export function startSessionConclusion(reservationId) {
  const state = conclusionStateManager.getState();

  // 今日のよやくを検索
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
    window.showInfo?.('よやくデータが見つかりませんでした。', 'エラー');
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

  // 既存の未来よやくを検索（翌日以降で最も近い日程の確定済みよやく）
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const futureReservations = (state.myReservations || [])
    .filter((/** @type {ReservationCore} */ r) => {
      const reservationDate = new Date(r.date);
      reservationDate.setHours(0, 0, 0, 0);
      return (
        reservationDate > today &&
        r.status === CONSTANTS.STATUS.CONFIRMED &&
        r.reservationId !== currentReservation.reservationId
      );
    })
    .sort(
      (/** @type {ReservationCore} */ a, /** @type {ReservationCore} */ b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  const futureReservation =
    futureReservations.length > 0 ? futureReservations[0] : null;

  // 時間制クラスの場合、初期時間を「今日のよやく時間」に合わせる
  let initialStartTime = '';
  let initialEndTime = '';

  if (recommendedNextLesson && currentReservation) {
    // 今日のよやく時間があればそれを使う
    if (currentReservation.startTime && currentReservation.endTime) {
      initialStartTime = currentReservation.startTime;
      initialEndTime = currentReservation.endTime;
    } else {
      // なければレッスンの開始時間を使う（保険）
      initialStartTime = recommendedNextLesson.firstStart || '';
      initialEndTime = recommendedNextLesson.firstEnd || '';
    }
  }

  // ウィザード状態を初期化
  wizardState = {
    currentStep: STEPS.RECORD,
    currentReservation: currentReservation,
    recommendedNextLesson: recommendedNextLesson,
    selectedLesson: null,
    existingFutureReservation: futureReservation || null,
    reservationSkipped: false,
    isWaitlistRequest: false,
    isLessonListExpanded: false,
    sessionNoteToday: '', // 常に空でスタート（既存値をロードしない）
    nextLessonGoal: '', // 常に空でスタート（既存値をロードしない）
    sessionNoteNext: '',
    nextStartTime: initialStartTime,
    nextEndTime: initialEndTime,
    classifiedItems: classifiedItems,
    accountingFormData: {},
    filterClassroom: 'current',
  };

  // キャッシュから入力データを復元（リロード対応）
  if (currentReservation?.reservationId) {
    restoreWizardStateFromCache(currentReservation.reservationId);
  }

  // 履歴に現在の状態を保存（smartGoBackが機能するため）
  // NAVIGATEアクションを使用して履歴を管理

  // フルページViewとして表示
  // 手動でDOM更新せず、状態遷移で描画させる
  conclusionStateManager.dispatch({
    type: 'NAVIGATE',
    payload: {
      to: 'sessionConclusion',
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
  if (wizardState.currentStep === STEPS.ACCOUNTING) {
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

  // フェードアウト → フェードイン のシーケンスでビューを更新
  // note: 直接DOM更新のみで、dispatchによる二重描画を防ぐ
  const viewContainer = document.getElementById('view-container');
  if (viewContainer) {
    // 現在のコンテンツにフェードアウトを適用
    const currentContent = viewContainer.querySelector('.fade-in');
    if (currentContent) {
      currentContent.classList.remove('fade-in');
      currentContent.classList.add('fade-out');
    }

    // フェードアウト完了後に新コンテンツでフェードイン
    setTimeout(() => {
      const viewHtml = getSessionConclusionView(wizardState);
      viewContainer.innerHTML = `<div class="fade-in">${viewHtml}</div>`;
      setupSessionConclusionUI();
    }, 150); // フェードアウトのduration (0.15s) と同期
  }
}

/**
 * 現在のステップのデータを保存
 */
function saveCurrentStepData() {
  switch (wizardState.currentStep) {
    case STEPS.RECORD: {
      const wipInput = /** @type {HTMLTextAreaElement | null} */ (
        document.getElementById('conclusion-work-progress-today')
      );
      if (wipInput) {
        wizardState.sessionNoteToday = wipInput.value;
      }
      break;
    }
    case STEPS.GOAL: {
      // 次回やりたいこと（生徒名簿に保存される）
      const goalInput = /** @type {HTMLTextAreaElement | null} */ (
        document.getElementById('conclusion-next-lesson-goal')
      );
      if (goalInput) {
        wizardState.nextLessonGoal = goalInput.value;
      }
      break;
    }
    case STEPS.RESERVATION: {
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
      // 材料/注文品の希望を保存
      const orderInput = /** @type {HTMLTextAreaElement | null} */ (
        document.getElementById('conclusion-order-input')
      );
      if (orderInput) {
        wizardState.orderInput = orderInput.value;
      }
      const materialInput = /** @type {HTMLTextAreaElement | null} */ (
        document.getElementById('conclusion-material-input')
      );
      if (materialInput) {
        wizardState.materialInput = materialInput.value;
      }
      break;
    }
    case STEPS.ACCOUNTING: {
      // 会計データの収集（ユーティリティを利用）
      wizardState.accountingFormData = collectAccountingFormData();
      break;
    }
  }

  // ステップ移動ごとにキャッシュを更新（リロード対応）
  cacheWizardState();
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
      sessionNote: wizardState.sessionNoteToday,
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

    // 2. 次回よやくを作成（スキップしていない場合）
    /** @type {any} */
    let nextReservationPayload = null;

    // よやく対象のレッスン（ユーザー選択 > おすすめ）
    const nextLesson =
      wizardState.selectedLesson || wizardState.recommendedNextLesson;

    // よやくをスキップした場合、またはよやく対象がない場合は次回よやくを作成しない
    // 既存よやくがあってもnextLessonがあれば追加で作成する
    const shouldCreateReservation =
      !wizardState.reservationSkipped && nextLesson;

    if (shouldCreateReservation) {
      // 材料/注文品の希望をorder形式にまとめる
      const orderParts = [];
      if (wizardState.orderInput) {
        orderParts.push(`【材料希望】${wizardState.orderInput}`);
      }
      if (wizardState.materialInput) {
        orderParts.push(`【注文品】${wizardState.materialInput}`);
      }
      const orderValue = orderParts.join('\n');

      nextReservationPayload = {
        lessonId: nextLesson.lessonId,
        classroom: nextLesson.classroom,
        date: nextLesson.date,
        venue: nextLesson.venue,
        startTime: wizardState.nextStartTime || nextLesson.firstStart,
        endTime: wizardState.nextEndTime || nextLesson.firstEnd,
        user: currentUser,
        studentId: currentUser.studentId,
        sessionNote: wizardState.sessionNoteNext,
        order: orderValue, // 材料/注文品の希望
        // ユーザーの期待（よやく or 空き通知）を追跡（完了画面で差異を表示するため）
        expectedWaitlist: wizardState.isWaitlistRequest,
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
          // 次回よやく結果を保存
          if (response.data?.nextReservationResult) {
            /** @type {any} */ (wizardState).nextReservationResult =
              response.data.nextReservationResult;
          }

          // myReservationsをwizardStateに保存（完了画面でのカード表示用）
          if (response.data?.myReservations) {
            /** @type {any} */ (wizardState).myReservations =
              response.data.myReservations;
          }

          // stateを更新（myReservationsなど）- 完了画面へ遷移する前に更新
          if (response.data) {
            const currentState = conclusionStateManager.getState();
            conclusionStateManager.dispatch({
              type: 'SET_STATE',
              payload: {
                myReservations:
                  response.data.myReservations || currentState.myReservations,
                // currentUserのnextLessonGoalを更新（ダッシュボードで反映されるように）
                currentUser: currentState.currentUser
                  ? {
                      ...currentState.currentUser,
                      nextLessonGoal: wizardState.nextLessonGoal || '',
                    }
                  : currentState.currentUser,
                // 参加者リストキャッシュをクリア
                participantLessons: null,
                participantReservationsMap: null,
              },
            });
          }

          // 完了したのでキャッシュをクリア
          clearWizardStateCache();

          // 完了画面へ
          goToStep(STEPS.COMPLETE);
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
  // キャンセルなのでキャッシュをクリア
  clearWizardStateCache();

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
      const targetStep =
        actionElement.getAttribute('data-target-step') || STEPS.RECORD;
      goToStep(targetStep);
      break;
    }
    case 'conclusionPrevStep': {
      const targetStep =
        actionElement.getAttribute('data-target-step') || STEPS.RECORD;
      goToStep(targetStep);
      break;
    }
    case 'conclusionSkipReservation':
      // よやくをスキップして会計へ
      wizardState.recommendedNextLesson = null;
      goToStep(STEPS.ACCOUNTING);
      break;
    case 'conclusionFinalize':
      finalizeConclusion();
      break;
    case 'navigateToBooking': {
      // 完了画面からよやく画面へ遷移
      const classroom = actionElement.getAttribute('data-classroom') || '';
      closeConclusion();
      conclusionStateManager.dispatch({
        type: 'SET_STATE',
        payload: {
          selectedClassroom: classroom,
          view: 'bookingLessons',
        },
      });
      break;
    }
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
        goToStep(STEPS.RESERVATION);
      }
      break;
    case 'toggleLessonListDOM': {
      // アコーディオン開閉（DOM直接操作）
      const accordion = document.getElementById('lesson-list-accordion');
      const arrow = document.getElementById('accordion-arrow');
      const toggleText = document.getElementById('accordion-toggle-text');
      if (accordion) {
        // hidden クラスではなく、display スタイルを直接操作
        const isHidden =
          accordion.style.display === 'none' ||
          accordion.classList.contains('hidden');

        if (isHidden) {
          accordion.classList.remove('hidden');
          accordion.style.display = 'block';
        } else {
          accordion.classList.add('hidden');
          accordion.style.display = 'none';
        }
        if (arrow) arrow.textContent = isHidden ? '▲' : '▼';
        if (toggleText) {
          toggleText.textContent = isHidden
            ? 'にってい を とじる'
            : 'にってい いちらん から えらぶ';
        }
        wizardState.isLessonListExpanded = isHidden;
      } else {
        console.warn('⚠️ lesson-list-accordion element not found!');
      }
      break;
    }
    case 'selectLessonForConclusion': {
      // 日程選択（通常よやく）— DOM操作でちらつき防止
      const lessonId = actionElement.getAttribute('data-lesson-id');
      if (lessonId) {
        const state = conclusionStateManager.getState();
        const lessons = state.lessons || [];
        const selectedLesson = lessons.find(
          (/** @type {LessonCore} */ l) => l.lessonId === lessonId,
        );
        if (selectedLesson) {
          wizardState.selectedLesson = selectedLesson;
          wizardState.isWaitlistRequest = false;
          wizardState.reservationSkipped = false;
          wizardState.isLessonListExpanded = false;

          // DOM操作でスロット表示を更新
          const slotViewContent = document.querySelector('.slot-view-content');
          const slotListContent = document.querySelector('.slot-list-content');
          const actionButtons = document.querySelector('.action-buttons');

          if (slotViewContent && slotListContent && actionButtons) {
            // スロット内容を更新（再描画用のHTMLを生成）
            const viewHtml = getSessionConclusionView(wizardState);
            const temp = document.createElement('div');
            temp.innerHTML = viewHtml;
            const newSlotViewContent = temp.querySelector('.slot-view-content');
            if (newSlotViewContent) {
              slotViewContent.innerHTML = newSlotViewContent.innerHTML;
            }
            const newActionButtons = temp.querySelector('.action-buttons');
            if (newActionButtons) {
              actionButtons.innerHTML = newActionButtons.innerHTML;
            }

            // 表示を切り替え
            slotViewContent.classList.remove('hidden');
            slotListContent.classList.add('hidden');
            actionButtons.classList.remove('hidden');
          } else {
            // フォールバック: goToStepを使用
            goToStep('3');
          }
        }
      }
      break;
    }
    case 'requestWaitlistForConclusion': {
      // 空き通知希望 — DOM操作でちらつき防止
      const lessonId = actionElement.getAttribute('data-lesson-id');
      if (lessonId) {
        const state = conclusionStateManager.getState();
        const lessons = state.lessons || [];
        const selectedLesson = lessons.find(
          (/** @type {LessonCore} */ l) => l.lessonId === lessonId,
        );
        if (selectedLesson) {
          wizardState.selectedLesson = selectedLesson;
          wizardState.isWaitlistRequest = true;
          wizardState.reservationSkipped = false;
          wizardState.isLessonListExpanded = false;

          // DOM操作でスロット表示を更新
          const slotViewContent = document.querySelector('.slot-view-content');
          const slotListContent = document.querySelector('.slot-list-content');
          const actionButtons = document.querySelector('.action-buttons');

          if (slotViewContent && slotListContent && actionButtons) {
            const viewHtml = getSessionConclusionView(wizardState);
            const temp = document.createElement('div');
            temp.innerHTML = viewHtml;
            const newSlotViewContent = temp.querySelector('.slot-view-content');
            if (newSlotViewContent) {
              slotViewContent.innerHTML = newSlotViewContent.innerHTML;
            }
            const newActionButtons = temp.querySelector('.action-buttons');
            if (newActionButtons) {
              actionButtons.innerHTML = newActionButtons.innerHTML;
            }

            slotViewContent.classList.remove('hidden');
            slotListContent.classList.add('hidden');
            actionButtons.classList.remove('hidden');
          } else {
            goToStep('3');
          }
        }
      }
      break;
    }
    case 'skipReservation':
      // いまはきめない
      wizardState.reservationSkipped = true;
      wizardState.selectedLesson = null;
      goToStep(STEPS.RESERVATION);
      break;
    case 'setFilterClassroom': {
      const filter = actionElement.getAttribute('data-filter');
      if (filter && (filter === 'current' || filter === 'all')) {
        // DOM操作によるクラス切り替えは削除（全再描画で対応）

        // 状態を更新してリスト再生成
        wizardState.filterClassroom = filter;

        // リストの再生成（slot-list-contentの内容を更新）
        const viewHtml = getSessionConclusionView(wizardState);
        const listContentEl = document.querySelector('.slot-list-content');
        if (listContentEl) {
          // 一時的なコンテナでHTMLをパース
          const temp = document.createElement('div');
          temp.innerHTML = viewHtml;
          const newListContent = temp.querySelector('.slot-list-content');
          if (newListContent) {
            listContentEl.innerHTML = newListContent.innerHTML;
          }
        }
      }
      break;
    }
    case 'confirmRecommendedLesson': {
      const lessonId = actionElement.getAttribute('data-lesson-id');
      const lesson = (
        window.appWindow?.stateManager?.getState()?.lessons || []
      ).find(l => String(l.lessonId) === lessonId);
      if (lesson) {
        // レッスン選択
        wizardState.selectedLesson = lesson;
        wizardState.isWaitlistRequest = false;

        // 時間制の場合は、現在セットされているnextStartTimeなどをそのまま使う
        // （変更されているかもしれないし、初期値のままかもしれない）
        //
        // 即座に会計ステップへ進む
        goToStep(STEPS.ACCOUNTING);
      }
      break;
    }
    case 'expandLessonList': {
      // 展開/折りたたみを切り替えて再描画（戻るボタンの動作も更新される）
      wizardState.isLessonListExpanded = !wizardState.isLessonListExpanded;
      goToStep(STEPS.RESERVATION);
      break;
    }
    case 'undoReservationSkip':
      // やっぱりえらぶ
      wizardState.reservationSkipped = false;
      goToStep(STEPS.RESERVATION);
      break;
    case 'clearSelectedLesson':
      // 選択解除（変更する）
      wizardState.selectedLesson = null;
      wizardState.isWaitlistRequest = false;

      // 変更ボタンを押したときは、時間選択もリセットするほうが自然だが、
      // ユーザーが「日時だけ変えたい」場合もあるかもしれない。
      // 一旦、よやく状態をクリアしてリストを表示する。

      goToStep(STEPS.RESERVATION);
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

  // 開始時間の変更（終了時間の選択肢を更新）
  if (target.id === 'conclusion-next-start-time') {
    const startSelect = /** @type {HTMLSelectElement} */ (
      /** @type {unknown} */ (target)
    );
    const endSelect = /** @type {HTMLSelectElement | null} */ (
      document.getElementById('conclusion-next-end-time')
    );

    if (endSelect) {
      const startTimeVal = startSelect.value;
      const lesson =
        wizardState.selectedLesson || wizardState.recommendedNextLesson;

      if (startTimeVal && lesson) {
        const [sH, sM] = startTimeVal.split(':').map(Number);
        const startTotalM = sH * 60 + sM;
        const MIN_DURATION = 120; // 実質2時間

        // レッスン終了時刻を取得
        let limitEndM = 18 * 60 + 30; // デフォルト18:30
        if (lesson.secondEnd) {
          const [h, m] = lesson.secondEnd.split(':').map(Number);
          limitEndM = h * 60 + m;
        } else if (lesson.firstEnd) {
          const [h, m] = lesson.firstEnd.split(':').map(Number);
          limitEndM = h * 60 + m;
        }

        // 2部制の判定と休憩時間計算
        const classroomType = lesson.classroomType || '';
        const isDualSession = classroomType.includes('2部制');
        let breakStartM = 9999;
        let breakEndM = 0;
        let breakDuration = 0;

        if (isDualSession && lesson.firstEnd && lesson.secondStart) {
          const [feH, feM] = lesson.firstEnd.split(':').map(Number);
          const [ssH, ssM] = lesson.secondStart.split(':').map(Number);
          breakStartM = feH * 60 + feM;
          breakEndM = ssH * 60 + ssM;
          breakDuration = breakEndM - breakStartM;
        }

        /**
         * 実質作業時間を計算（休憩をまたぐ場合は差し引く）
         * @param {number} endM
         * @returns {number}
         */
        const calcActualWork = endM => {
          const total = endM - startTotalM;
          if (isDualSession && startTotalM < breakStartM && endM > breakEndM) {
            return total - breakDuration;
          }
          return total;
        };

        const validEndTimes = [];
        let curr = startTotalM + 30; // 30分後から開始

        while (curr <= limitEndM) {
          // 休憩中(firstEnd < t <= secondStart)は選択不可
          if (isDualSession && curr > breakStartM && curr <= breakEndM) {
            curr += 30;
            continue;
          }

          // 実質2時間以上の作業時間が確保できるか
          const actualWork = calcActualWork(curr);
          if (actualWork >= MIN_DURATION) {
            const h = Math.floor(curr / 60);
            const m = curr % 60;
            validEndTimes.push(
              `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
            );
          }
          curr += 30; // 30分刻み
        }

        // 現在の選択値を維持できるか確認
        const currentEndVal = endSelect.value;

        // オプション再生成
        if (validEndTimes.length === 0) {
          endSelect.innerHTML = '<option value="">選択不可</option>';
        } else {
          endSelect.innerHTML = validEndTimes
            .map(
              t =>
                `<option value="${t}" ${t === currentEndVal ? 'selected' : ''}>${t}</option>`,
            )
            .join('');

          // 値が不正になったら先頭を選択
          if (!validEndTimes.includes(currentEndVal)) {
            endSelect.value = validEndTimes[0];
          }
        }

        // stateも更新
        wizardState.nextStartTime = startTimeVal;
        wizardState.nextEndTime = endSelect.value;
      }
    }
  }

  // 終了時間の変更
  if (target.id === 'conclusion-next-end-time') {
    wizardState.nextEndTime = target.value;
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
    const step = String(d['target-step'] || d['targetStep'] || STEPS.RECORD);
    goToStep(step);
  },
  conclusionPrevStep: (/** @type {ActionHandlerData} */ d) => {
    const step = String(d['target-step'] || d['targetStep'] || STEPS.RECORD);
    goToStep(step);
  },
  conclusionSkipReservation: () => {
    wizardState.recommendedNextLesson = null;
    goToStep(STEPS.ACCOUNTING);
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
      goToStep(STEPS.RESERVATION);
    }
  },
  // 「いまはきめない」
  skipReservation: () => {
    wizardState.reservationSkipped = true;
    wizardState.selectedLesson = null;
    // 再描画
    goToStep(STEPS.RESERVATION);
  },
  // 「やっぱりえらぶ」
  undoReservationSkip: () => {
    wizardState.reservationSkipped = false;
    // 再描画
    goToStep(STEPS.RESERVATION);
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
      goToStep(STEPS.RESERVATION);
    }
  },
  // 選択解除
  clearSelectedLesson: () => {
    wizardState.selectedLesson = null;
    // 再描画
    goToStep(STEPS.RESERVATION);
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
      // 空き通知希望登録はfinalizeConclusion→makeReservationで自動判定される
      window.showInfo?.(
        `${window.formatDate?.(selectedLesson.date) || selectedLesson.date} の空き通知希望を登録します`,
        '空き通知',
      );
      // 再描画してスロット表示を更新
      goToStep(STEPS.RESERVATION);
    }
  },
};

// =================================================================
// --- Wizard State Cache (リロード時入力保持用) ---
// =================================================================

/**
 * ウィザードの入力状態をformInputCacheに保存
 * 各ステップ移動時に呼び出される
 */
function cacheWizardState() {
  if (!conclusionStateManager) return;

  // 保存対象：ユーザー入力データのみ（システムデータは除外）
  const cacheData = {
    currentStep: wizardState.currentStep,
    currentReservationId: wizardState.currentReservation?.reservationId,
    sessionNoteToday: wizardState.sessionNoteToday,
    nextLessonGoal: wizardState.nextLessonGoal,
    nextStartTime: wizardState.nextStartTime,
    nextEndTime: wizardState.nextEndTime,
    orderInput: wizardState.orderInput || '',
    materialInput: wizardState.materialInput || '',
    accountingFormData: wizardState.accountingFormData || {},
    filterClassroom: wizardState.filterClassroom,
    reservationSkipped: wizardState.reservationSkipped,
    selectedLessonId: wizardState.selectedLesson?.lessonId || null,
  };

  conclusionStateManager['cacheFormInput']('wizardState', cacheData);
}

/**
 * formInputCacheからウィザード状態を復元
 * セッション終了フロー開始時に呼び出される
 * @param {string} reservationId - 現在の予約ID
 * @returns {boolean} 復元できた場合true
 */
function restoreWizardStateFromCache(reservationId) {
  const stateManager = window.appWindow?.stateManager;
  if (!stateManager) return false;

  const cached = stateManager['getFormInputCache']('wizardState');
  if (!cached) return false;

  // 同じよやくに対する編集中の状態か確認
  if (cached.currentReservationId !== reservationId) {
    // 別のよやくのキャッシュなのでクリア
    stateManager['clearFormInputCache']('wizardState');
    return false;
  }

  // 入力データを復元
  wizardState.currentStep = cached.currentStep || STEPS.RECORD;
  wizardState.sessionNoteToday = cached.sessionNoteToday || '';
  wizardState.nextLessonGoal = cached.nextLessonGoal || '';
  wizardState.nextStartTime = cached.nextStartTime || '';
  wizardState.nextEndTime = cached.nextEndTime || '';
  wizardState.orderInput = cached.orderInput || '';
  wizardState.materialInput = cached.materialInput || '';
  wizardState.accountingFormData = cached.accountingFormData || {};
  wizardState.filterClassroom = cached.filterClassroom || 'current';
  wizardState.reservationSkipped = cached.reservationSkipped || false;

  // 選択済みレッスンの復元（lessonIdから検索）
  if (cached.selectedLessonId) {
    const lessons = stateManager.getState().lessons || [];
    const selectedLesson = lessons.find(
      (/** @type {LessonCore} */ l) => l.lessonId === cached.selectedLessonId,
    );
    if (selectedLesson) {
      wizardState.selectedLesson = selectedLesson;
    }
  }

  return true;
}

/**
 * ウィザード状態キャッシュをクリア
 * 完了・キャンセル時に呼び出される
 */
function clearWizardStateCache() {
  if (conclusionStateManager) {
    conclusionStateManager['clearFormInputCache']('wizardState');
  }
}

/**
 * リロード後にウィザード状態を復元できるかチェックし、可能なら復元
 * window.onload から呼び出される
 * @returns {boolean} 復元できた場合true
 */
export function tryRestoreWizardFromCache() {
  if (!conclusionStateManager) return false;

  const cached = conclusionStateManager['getFormInputCache']('wizardState');
  if (!cached || !cached.currentReservationId) return false;

  // キャッシュされた予約IDからよやくを検索
  const state = stateManager.getState();
  const myReservations = state.myReservations || [];
  const reservation = myReservations.find(
    (/** @type {ReservationCore} */ r) =>
      r.reservationId === cached.currentReservationId,
  );

  if (!reservation) {
    // よやくが見つからない場合はキャッシュをクリア
    clearWizardStateCache();
    return false;
  }

  // よやくが見つかった場合、ウィザードを再開
  console.log('🔄 ウィザード状態をキャッシュから復元します');

  // initializeWizardState を使わず、直接 wizardState を設定してビューに遷移
  const classifiedItems = classifyAccountingItems(
    state.accountingMaster || [],
    reservation.classroom,
  );
  const futureReservation = myReservations.find(
    (/** @type {ReservationCore} */ r) =>
      r.date > reservation.date &&
      r.status !== CONSTANTS.STATUS.COMPLETED &&
      r.status !== CONSTANTS.STATUS.CANCELED,
  );
  const recommendedNextLesson = findRecommendedNextLesson(reservation);

  // ウィザード状態を初期化
  wizardState = {
    currentStep: cached.currentStep || STEPS.RECORD,
    currentReservation: reservation,
    recommendedNextLesson: recommendedNextLesson,
    selectedLesson: null,
    existingFutureReservation: futureReservation || null,
    reservationSkipped: cached.reservationSkipped || false,
    isWaitlistRequest: false,
    isLessonListExpanded: false,
    sessionNoteToday: cached.sessionNoteToday || '',
    nextLessonGoal: cached.nextLessonGoal || '',
    sessionNoteNext: '',
    nextStartTime: cached.nextStartTime || '',
    nextEndTime: cached.nextEndTime || '',
    classifiedItems: classifiedItems,
    accountingFormData: cached.accountingFormData || {},
    filterClassroom: cached.filterClassroom || 'current',
    orderInput: cached.orderInput || '',
    materialInput: cached.materialInput || '',
  };

  // 選択済みレッスンの復元
  if (cached.selectedLessonId) {
    const lessons = state.lessons || [];
    const selectedLesson = lessons.find(
      (/** @type {LessonCore} */ l) => l.lessonId === cached.selectedLessonId,
    );
    if (selectedLesson) {
      wizardState.selectedLesson = selectedLesson;
    }
  }

  // ビューを sessionConclusion に遷移
  conclusionStateManager.dispatch({
    type: 'SET_STATE',
    payload: { view: 'sessionConclusion' },
  });

  return true;
}
