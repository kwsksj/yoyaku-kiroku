/**
 * =================================================================
 * ファイル概要
 * -----------------------------------------------------------------
 * 名称: 13_WebApp_Views_SessionConclusion.js
 * 目的: セッション終了ウィザード（きろく→よやく→かいけい）のビュー生成
 * 主な責務:
 *   - 3ステップウィザードのレンダリング
 *   - ステップ1：今日の記録（制作メモ入力）
 *   - ステップ2：次回予約（おすすめ日程カード、時間変更、次回メモ）
 *   - ステップ3：会計（既存会計UIの再利用）
 * AI向けメモ:
 *   - 各ステップは独立した関数で描画し、Handlerからステップ遷移を管理する
 * =================================================================
 */

import {
  generateSalesSection,
  generateTuitionSection,
} from './12-2_Accounting_UI.js';
import { Components, escapeHTML } from './13_WebApp_Components.js';
import { getTimeOptionsHtml } from './13_WebApp_Views_Utils.js';

/**
 * @typedef {Object} SessionConclusionState
 * @property {string} currentStep - 現在のステップ ('1', '2a', '2b', '3')
 * @property {ReservationCore | null} currentReservation - 今日の予約データ
 * @property {LessonCore | null} recommendedNextLesson - おすすめの次回レッスン
 * @property {string} workInProgressToday - 今日の制作メモ
 * @property {string} nextLessonGoal - 次回やりたいこと（生徒名簿に保存）
 * @property {string} workInProgressNext - 次回予約へのメッセージ
 * @property {string} nextStartTime - 次回開始時間
 * @property {string} nextEndTime - 次回終了時間
 * @property {ClassifiedAccountingItemsCore | null} classifiedItems - 会計項目
 * @property {AccountingFormDto} accountingFormData - 会計フォームデータ
 */

/**
 * ウィザードの進行バーを生成
 * @param {number} currentStep - 現在のステップ (1, 2, or 3)
 * @returns {string} HTML文字列
 */
export function renderWizardProgressBar(currentStep) {
  const steps = [
    { num: 1, label: 'きろく' },
    { num: 2, label: 'けいかく' },
    { num: 3, label: 'よやく' },
    { num: 4, label: 'かいけい' },
  ];

  const stepsHtml = steps
    .map(step => {
      const isActive = step.num === currentStep;
      const isCompleted = step.num < currentStep;
      const circleClass = isActive
        ? 'bg-action-primary-bg text-white'
        : isCompleted
          ? 'bg-green-500 text-white'
          : 'bg-gray-200 text-gray-500';
      const labelClass = isActive
        ? 'text-brand-text font-bold'
        : isCompleted
          ? 'text-green-600'
          : 'text-gray-400';

      return `
        <div class="flex flex-col items-center flex-1">
          <div class="w-8 h-8 rounded-full flex items-center justify-center ${circleClass} text-sm font-bold">
            ${isCompleted ? '✓' : step.num}
          </div>
          <span class="text-xs mt-1 ${labelClass}">${step.label}</span>
        </div>
      `;
    })
    .join('');

  // ステップ間のコネクター線
  const connectorHtml = `
    <div class="absolute top-4 left-0 right-0 flex justify-center z-[-1]" style="padding: 0 12%;">
      <div class="h-0.5 bg-gray-200 flex-1"></div>
    </div>
  `;

  return `
    <div class="relative flex justify-between items-start mb-6">
      ${connectorHtml}
      ${stepsHtml}
    </div>
  `;
}

/**
 * ステップ1: 今日の記録画面を生成
 * @param {SessionConclusionState} state - 現在の状態
 * @returns {string} HTML文字列
 */
export function renderStep1Record(state) {
  const currentMemo = state.workInProgressToday || '';

  return `
    <div class="session-conclusion-step1 session-conclusion-view">
      ${renderWizardProgressBar(1)}

      <div class="text-center mb-4">
      <p class="text-lg font-bold text-brand-text">きょう の きろく を つけましょう！</p>
      </div>

      ${Components.cardContainer({
        variant: 'default',
        padding: 'spacious',
        content: `
          ${Components.textarea({
            id: 'conclusion-work-progress-today',
            label: 'きろく・かんそう',
            value: currentMemo,
            placeholder:
              'つくったもの・やったさぎょう・しんちょく などや、 かんそう を メモしましょう',
            rows: 5,
            caption:
              'せんせい が あとで おもいだしやすく なります。よやく・きろく いちらん にのります（みんな にも みえます）。',
          })}
        `,
      })}

      <div class="mt-6 flex flex-col space-y-3">
        ${Components.button({
          action: 'conclusionNextStep',
          text: 'つぎへ',
          style: 'primary',
          size: 'full',
          dataAttributes: { 'target-step': '2' },
        })}
        ${Components.button({
          action: 'conclusionCancel',
          text: 'ホームへもどる',
          style: 'secondary',
          size: 'full',
        })}
      </div>
    </div>
  `;
}

/**
 * ステップ2A: 次回やりたいこと入力画面を生成
 * @param {SessionConclusionState} state - 現在の状態
 * @returns {string} HTML文字列
 */
export function renderStep2AGoalInput(state) {
  const nextGoal = state.nextLessonGoal || '';

  return `
    <div class="session-conclusion-step2a session-conclusion-view">
      ${renderWizardProgressBar(2)}

      <div class="text-center mb-4">
      <p class="text-lg font-bold text-brand-text">つぎに つくりたいもの、やりたいこと は ありますか？</p>
      </div>

      ${Components.cardContainer({
        variant: 'default',
        padding: 'spacious',
        content: `
          ${Components.textarea({
            id: 'conclusion-next-lesson-goal',
            label: 'けいかく・もくひょう',
            value: nextGoal,
            placeholder:
              'つくりたいもの、さぎょうよてい、けいかく、もくひょう など メモしましょう',
            rows: 5,
            caption:
              'よやく・きろく いちらん にのります（みんな にも みえます）。',
          })}
        `,
      })}

      <div class="mt-6 flex flex-col space-y-3">
        ${Components.button({
          action: 'conclusionNextStep',
          text: 'つぎへ',
          style: 'primary',
          size: 'full',
          dataAttributes: { 'target-step': '3' },
        })}
        ${Components.button({
          action: 'conclusionPrevStep',
          text: 'もどる',
          style: 'secondary',
          size: 'full',
          dataAttributes: { 'target-step': '1' },
        })}
      </div>
    </div>
  `;
}

/**
 * ステップ2B: 次回予約画面を生成
 * @param {SessionConclusionState} state - 現在の状態
 * @returns {string} HTML文字列
 */
export function renderStep2BReservation(state) {
  const lesson = state.recommendedNextLesson;
  const startTime = state.nextStartTime || lesson?.firstStart || '';
  const endTime = state.nextEndTime || lesson?.firstEnd || '';

  // おすすめレッスンカードの生成
  let recommendedCardHtml = '';
  if (lesson) {
    const formattedDate = window.formatDate
      ? window.formatDate(lesson.date)
      : lesson.date;

    recommendedCardHtml = `
      <div class="recommended-lesson-card border-2 border-action-primary-bg rounded-lg p-4 bg-action-secondary-bg mb-4 cursor-pointer hover:shadow-md transition-shadow"
           data-action="selectRecommendedLesson"
           data-lesson-id="${escapeHTML(lesson.lessonId)}">
        <div class="flex justify-between items-center">
          <div>
            <p class="text-sm text-brand-subtle">おすすめの日程</p>
            <p class="text-lg font-bold text-brand-text">${formattedDate}</p>
            <p class="text-sm text-brand-subtle">${escapeHTML(lesson.classroom)} ${lesson.venue ? escapeHTML(lesson.venue) : ''}</p>
          </div>
          <div class="text-action-primary-bg text-3xl">→</div>
        </div>
      </div>

      <!-- 時間変更トグル -->
      <div class="mb-4">
        <button type="button"
                class="text-sm text-action-primary underline"
                data-action="toggleTimeEdit"
                id="toggle-time-edit-btn">
          時間を変更する
        </button>
        <div id="time-edit-section" class="hidden mt-3 p-3 bg-ui-surface rounded-lg border border-ui-border">
          <div class="grid grid-cols-2 gap-4">
            ${Components.select({
              id: 'conclusion-next-start-time',
              label: '開始',
              options: getTimeOptionsHtml(9, 18, 30, startTime),
            })}
            ${Components.select({
              id: 'conclusion-next-end-time',
              label: '終了',
              options: getTimeOptionsHtml(9, 18, 30, endTime),
            })}
          </div>
        </div>
      </div>
    `;
  } else {
    recommendedCardHtml = `
      <div class="text-center p-4 bg-ui-surface rounded-lg border border-ui-border mb-4">
        <p class="text-brand-subtle">条件に合う次回の日程が見つかりませんでした。</p>
        <p class="text-brand-subtle text-sm">カレンダーから選択してください。</p>
      </div>
    `;
  }

  return `
    <div class="session-conclusion-step2b session-conclusion-view">
      ${renderWizardProgressBar(3)}

      <div class="text-center mb-4">
        <p class="text-lg font-bold text-brand-text">つぎは いつにしますか？</p>
      </div>

      ${Components.cardContainer({
        variant: 'default',
        padding: 'spacious',
        content: `
          ${recommendedCardHtml}

          <div class="mb-4">
            ${Components.button({
              action: 'goToCalendarSelection',
              text: '日程一覧から えらぶ',
              style: 'secondary',
              size: 'full',
            })}
          </div>
        `,
      })}

      <div class="mt-6 flex flex-col space-y-3">
        ${Components.button({
          action: 'conclusionNextStep',
          text: 'つぎへ（かいけい）',
          style: 'primary',
          size: 'full',
          dataAttributes: { 'target-step': '4' },
        })}
        ${Components.button({
          action: 'conclusionPrevStep',
          text: 'もどる',
          style: 'secondary',
          size: 'full',
          dataAttributes: { 'target-step': '2' },
        })}
      </div>
    </div>
  `;
}

/**
 * ステップ3: 会計画面を生成
 * @param {SessionConclusionState} state - 現在の状態
 * @returns {string} HTML文字列
 */
export function renderStep3Accounting(state) {
  const classifiedItems = state.classifiedItems;
  const classroom = state.currentReservation?.classroom || '';
  const formData = state.accountingFormData || {};

  if (!classifiedItems) {
    return `
      <div class="session-conclusion-step3">
        ${renderWizardProgressBar(4)}
        ${Components.cardContainer({
          variant: 'default',
          padding: 'spacious',
          content: `<p class="text-center text-brand-subtle">会計データの読み込み中...</p>`,
        })}
      </div>
    `;
  }

  return `
    <div class="session-conclusion-step3 session-conclusion-view">
      ${renderWizardProgressBar(4)}

      <div class="text-center mb-4">
        <p class="text-lg font-bold text-brand-text">きょう の おかいけい</p>
        <p class="text-sm font-normal text-brand-subtle">りょうきん を けいさん します。 にゅうりょく してください。</p>
      </div>

      <div class="accounting-container space-y-4">
        <!-- 授業料セクション -->
        ${generateTuitionSection(classifiedItems, classroom, formData)}

        <!-- 販売セクション -->
        ${generateSalesSection(classifiedItems, formData)}

        <!-- 合計セクション -->
        ${Components.cardContainer({
          variant: 'default',
          padding: 'spacious',
          content: `
            <section class="total-section">
              <div class="grand-total text-center">
                <span class="text-2xl font-bold text-brand-text">総合計: </span>
                <span id="grand-total-amount" class="text-2xl font-bold text-brand-text">${Components.priceDisplay({ amount: 0, size: 'large' })}</span>
              </div>
            </section>
          `,
        })}

        <!-- 支払い方法セクション -->
        ${Components.cardContainer({
          variant: 'default',
          padding: 'spacious',
          content: `
            <section class="payment-section">
              ${Components.sectionHeader({ title: '支払方法' })}
              <p class="text-sm text-brand-subtle mb-3">しはらいほうほう を おしえてください。</p>
              <div id="payment-options-container" class="flex flex-wrap gap-3 md:gap-4">
                <!-- getPaymentOptionsHtml()で生成される -->
              </div>
              <div id="payment-info-container" class="mt-3"></div>
            </section>
          `,
        })}
      </div>

      <div class="mt-6 flex flex-col space-y-3">
        ${Components.button({
          action: 'conclusionFinalize',
          text: 'せんせい に<br>かくにん と しはらい<br>を しました！',
          style: 'accounting',
          size: 'full',
          id: 'conclusion-finalize-button',
          disabled: true,
          customClass: 'h-auto py-3 leading-relaxed',
        })}
        ${Components.button({
          action: 'conclusionPrevStep',
          text: 'もどる',
          style: 'secondary',
          size: 'full',
          dataAttributes: { targetStep: 3 },
        })}
      </div>
    </div>
  `;
}

/**
 * 完了画面を生成
 * @returns {string} HTML文字列
 */
export function renderConclusionComplete() {
  return `
    <div class="session-conclusion-complete text-center py-12 animate-fade-in">
      <div class="mb-6 flex justify-center">
        <div class="relative">
          <div class="absolute inset-0 bg-green-500 rounded-full opacity-20 animate-ping"></div>
          <div class="relative bg-white rounded-full p-4 ring-8 ring-green-50">
            <svg class="w-16 h-16 text-green-500 check-params" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" class="animate-check-stroke"></path>
            </svg>
          </div>
        </div>
      </div>
      <h3 class="text-2xl font-bold text-brand-text mb-4">おつかれさまでした！</h3>
      <p class="text-brand-text mb-2">
        きょう の きろく と かいけい が<br>
        かんりょうしました。
      </p>
      <p class="text-brand-text mb-8">
        また おあいできるのを<br>
        たのしみに しています。
      </p>


      ${Components.button({
        action: 'conclusionDone',
        text: 'ホームへもどる',
        style: 'primary',
        size: 'full',
      })}
    </div>

    <style>
      .check-params {
        stroke-dasharray: 24;
        stroke-dashoffset: 24;
        animation: check-draw 0.6s cubic-bezier(0.65, 0, 0.45, 1) 0.3s forwards;
      }
      @keyframes check-draw {
        to {
          stroke-dashoffset: 0;
        }
      }
    </style>
  `;
}

/**
 * セッション終了ウィザード全体のフルページViewを生成
 * @param {SessionConclusionState} state - 現在の状態
 * @returns {string} HTML文字列
 */
export function getSessionConclusionView(state) {
  let stepContent = '';

  switch (state.currentStep) {
    case '1':
      stepContent = renderStep1Record(state);
      break;
    case '2':
      stepContent = renderStep2AGoalInput(state);
      break;
    case '3':
      stepContent = renderStep2BReservation(state);
      break;
    case '4':
      stepContent = renderStep3Accounting(state);
      break;
    case '5': // 完了
      stepContent = renderConclusionComplete();
      break;
    default:
      stepContent = renderStep1Record(state);
  }

  // 予約情報サマリー（ステップ共通で上部に表示）
  const reservation = state.currentReservation;
  const summaryHtml = reservation
    ? `
    <div class="text-center mb-4 text-sm text-brand-subtle">
      <span>${reservation.classroom}</span>
      ${reservation.venue ? `<span class="mx-1">|</span><span>${reservation.venue}</span>` : ''}
    </div>
  `
    : '';

  return `
    <div class="session-conclusion-view">
      ${Components.pageHeader({
        title: 'きょう の まとめ',
        showBackButton: false,
      })}
      ${Components.pageContainer({
        content: `
          ${summaryHtml}
          <div class="session-conclusion-wizard p-2 fade-in">
            ${stepContent}
          </div>
        `,
      })}
    </div>
  `;
}

/**
 * セッション終了ウィザード全体のモーダルを生成（後方互換用）
 * @param {SessionConclusionState} state - 現在の状態
 * @returns {string} HTML文字列
 * @deprecated getSessionConclusionView を使用してください
 */
export function generateSessionConclusionModal(state) {
  let stepContent = '';

  switch (state.currentStep) {
    case '1':
      stepContent = renderStep1Record(state);
      break;
    case '2':
      stepContent = renderStep2AGoalInput(state);
      break;
    case '3':
      stepContent = renderStep2BReservation(state);
      break;
    case '4':
      stepContent = renderStep3Accounting(state);
      break;
    case '5': // 完了
      stepContent = renderConclusionComplete();
      break;
    default:
      stepContent = renderStep1Record(state);
  }

  return Components.modal({
    id: 'session-conclusion-modal',
    title: 'きょう の まとめ',
    content: `
      <div class="session-conclusion-wizard p-2">
        ${stepContent}
      </div>
    `,
    maxWidth: 'max-w-lg',
    showCloseButton: false, // ウィザードなので閉じるボタンは表示しない
  });
}
