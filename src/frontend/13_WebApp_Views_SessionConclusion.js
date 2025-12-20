/**
 * =================================================================
 * ファイル概要
 * -----------------------------------------------------------------
 * 名称: 13_WebApp_Views_SessionConclusion.js
 * 目的: セッション終了ウィザード（きろく→よやく→かいけい）のビュー生成
 * 主な責務:
 *   - 3ステップウィザードのレンダリング
 *   - ステップ1：今日のきろく（セッションノート入力）
 *   - ステップ2：けいかく・もくひょう（次回目標入力）
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
 * @property {string} currentStep - 現在のステップ ('1', '2', '3', '4', '5')
 * @property {ReservationCore | null} currentReservation - 今日の予約データ
 * @property {LessonCore | null} recommendedNextLesson - おすすめの次回レッスン
 * @property {LessonCore | null} selectedLesson - ユーザーが選択したレッスン
 * @property {ReservationCore | null} existingFutureReservation - 既存の未来予約
 * @property {boolean} reservationSkipped - 「いまはきめない」を選択
 * @property {boolean} isWaitlistRequest - 空き通知希望として選択
 * @property {boolean} isLessonListExpanded - 日程一覧アコーディオン展開状態
 * @property {string} sessionNoteToday - 今日のきろく（セッションノート）
 * @property {string} nextLessonGoal - けいかく・もくひょう（生徒名簿に保存）
 * @property {string} sessionNoteNext - 次回予約へのメッセージ
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
  const currentMemo = state.sessionNoteToday || '';

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
 * ステップ2A: けいかく・もくひょう入力画面を生成
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
 * ステップ3: 次回予約画面を生成（よやく）
 * @param {SessionConclusionState} state - 現在の状態
 * @returns {string} HTML文字列
 */
export function renderStep2BReservation(state) {
  const existingReservation = state.existingFutureReservation;
  const selectedLesson = state.selectedLesson;
  const recommendedLesson = state.recommendedNextLesson;
  const isSkipped = state.reservationSkipped;
  const isWaitlist = state.isWaitlistRequest;
  const isExpanded = state.isLessonListExpanded;

  // 表示するレッスン（優先順: 選択 > 予約済み > おすすめ）
  const displayLesson =
    selectedLesson || existingReservation || recommendedLesson;

  // 時間情報を取得（型に応じてフィールドが異なる）
  const getFirstStart = () => {
    if (selectedLesson?.firstStart) return selectedLesson.firstStart;
    if (recommendedLesson?.firstStart) return recommendedLesson.firstStart;
    if (existingReservation?.startTime) return existingReservation.startTime;
    return '';
  };
  const getFirstEnd = () => {
    if (selectedLesson?.firstEnd) return selectedLesson.firstEnd;
    if (recommendedLesson?.firstEnd) return recommendedLesson.firstEnd;
    if (existingReservation?.endTime) return existingReservation.endTime;
    return '';
  };

  const startTime = state.nextStartTime || getFirstStart();
  const endTime = state.nextEndTime || getFirstEnd();

  // 時間選択を表示するかどうか（時間情報がある場合のみ）
  const showTimeSelection = Boolean(getFirstStart());

  // スロット表示エリアの生成
  let slotDisplayHtml = '';

  if (isSkipped) {
    // スキップ状態
    slotDisplayHtml = `
      <div class="border-2 border-gray-300 rounded-lg p-4 bg-gray-50 mb-4">
        <div class="flex justify-between items-center">
          <div>
            <p class="text-sm text-brand-subtle">よやく</p>
            <p class="text-lg font-bold text-gray-500">いまは きめない</p>
          </div>
          <button type="button"
                  class="text-sm text-action-primary underline"
                  data-action="undoReservationSkip">
            やっぱり えらぶ
          </button>
        </div>
      </div>
    `;
  } else if (existingReservation && !selectedLesson) {
    // 既存の予約がある場合
    const formattedDate = window.formatDate
      ? window.formatDate(existingReservation.date)
      : existingReservation.date;

    slotDisplayHtml = `
      <div class="border-2 border-green-500 rounded-lg p-4 bg-green-50 mb-4">
        <div class="flex justify-between items-center">
          <div>
            <p class="text-sm font-bold text-green-700">よやく ずみ</p>
            <p class="text-lg font-bold text-brand-text">${formattedDate}</p>
            <p class="text-sm text-brand-subtle">${escapeHTML(existingReservation.classroom)} ${existingReservation.venue ? escapeHTML(existingReservation.venue) : ''}</p>
            ${existingReservation.startTime ? `<p class="text-sm text-brand-subtle">${existingReservation.startTime} 〜 ${existingReservation.endTime || ''}</p>` : ''}
          </div>
          <div class="text-green-500 text-3xl">✓</div>
        </div>
      </div>
    `;
  } else if (selectedLesson) {
    // ユーザーが選択したレッスン
    const formattedDate = window.formatDate
      ? window.formatDate(selectedLesson.date)
      : selectedLesson.date;

    if (isWaitlist) {
      // 空き通知希望
      slotDisplayHtml = `
        <div class="border-2 border-yellow-500 rounded-lg p-4 bg-yellow-50 mb-4">
          <div class="flex justify-between items-center">
            <div>
              <p class="text-sm font-bold text-yellow-700">空き つうち きぼう</p>
              <p class="text-lg font-bold text-brand-text">${formattedDate}</p>
              <p class="text-sm text-brand-subtle">${escapeHTML(selectedLesson.classroom)} ${selectedLesson.venue ? escapeHTML(selectedLesson.venue) : ''}</p>
            </div>
            <button type="button"
                    class="text-sm text-action-primary underline"
                    data-action="clearSelectedLesson">
              べつの ひを えらぶ
            </button>
          </div>
        </div>
      `;
    } else {
      // 通常予約
      slotDisplayHtml = `
        <div class="border-2 border-action-primary-bg rounded-lg p-4 bg-action-secondary-bg mb-4">
          <div class="flex justify-between items-center">
            <div>
              <p class="text-sm text-action-primary-bg font-bold">せんたく ずみ</p>
              <p class="text-lg font-bold text-brand-text">${formattedDate}</p>
              <p class="text-sm text-brand-subtle">${escapeHTML(selectedLesson.classroom)} ${selectedLesson.venue ? escapeHTML(selectedLesson.venue) : ''}</p>
            </div>
            <button type="button"
                    class="text-sm text-action-primary underline"
                    data-action="clearSelectedLesson">
              べつの ひを えらぶ
            </button>
          </div>
        </div>
      `;
    }
  } else if (recommendedLesson) {
    // おすすめ日程
    const formattedDate = window.formatDate
      ? window.formatDate(recommendedLesson.date)
      : recommendedLesson.date;

    slotDisplayHtml = `
      <div class="recommended-lesson-card border-2 border-action-primary-bg rounded-lg p-4 bg-action-secondary-bg mb-4 cursor-pointer hover:shadow-md transition-shadow"
           data-action="selectRecommendedLesson"
           data-lesson-id="${escapeHTML(recommendedLesson.lessonId)}">
        <div class="flex justify-between items-center">
          <div>
            <p class="text-sm text-brand-subtle">おすすめの にってい</p>
            <p class="text-lg font-bold text-brand-text">${formattedDate}</p>
            <p class="text-sm text-brand-subtle">${escapeHTML(recommendedLesson.classroom)} ${recommendedLesson.venue ? escapeHTML(recommendedLesson.venue) : ''}</p>
          </div>
          <div class="text-action-primary-bg text-3xl">→</div>
        </div>
      </div>
    `;
  } else {
    // おすすめなし
    slotDisplayHtml = `
      <div class="text-center p-4 bg-ui-surface rounded-lg border border-ui-border mb-4">
        <p class="text-brand-subtle">おすすめの にってい が みつかりませんでした</p>
        <p class="text-brand-subtle text-sm">した から えらんでください</p>
      </div>
    `;
  }

  // 時間選択セクション（時間制の場合のみ）
  const timeSelectionHtml =
    showTimeSelection && !isSkipped && displayLesson
      ? `
    <div class="mb-4">
      <button type="button"
              class="text-sm text-action-primary underline"
              data-action="toggleTimeEdit"
              id="toggle-time-edit-btn">
        じかん を へんこう する
      </button>
      <div id="time-edit-section" class="hidden mt-3 p-3 bg-ui-surface rounded-lg border border-ui-border">
        <div class="grid grid-cols-2 gap-4">
          ${Components.select({
            id: 'conclusion-next-start-time',
            label: 'かいし',
            options: getTimeOptionsHtml(9, 18, 30, startTime),
          })}
          ${Components.select({
            id: 'conclusion-next-end-time',
            label: 'しゅうりょう',
            options: getTimeOptionsHtml(9, 18, 30, endTime),
          })}
        </div>
      </div>
    </div>
  `
      : '';

  // アコーディオン式日程一覧
  // 現在の教室と同じレッスンをフィルタ（未来日程のみ）
  const currentClassroom = state.currentReservation?.classroom || '';
  const allLessons = window.appWindow?.stateManager?.getState()?.lessons || [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const filteredLessons = allLessons.filter((/** @type {LessonCore} */ l) => {
    const lessonDate = new Date(l.date);
    lessonDate.setHours(0, 0, 0, 0);
    return lessonDate > today && l.classroom === currentClassroom;
  });

  // ウィザード専用のレッスンカードを生成
  const wizardLessonCards = filteredLessons
    .slice()
    .sort(
      (/** @type {LessonCore} */ a, /** @type {LessonCore} */ b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime(),
    )
    .map((/** @type {LessonCore} */ lesson) => {
      const formattedDate = window.formatDate
        ? window.formatDate(lesson.date)
        : lesson.date;
      const slots = lesson.firstSlots || 0;
      const isFullyBooked = slots <= 0;
      const slotText = isFullyBooked
        ? '満席'
        : `空き <span class="font-mono-numbers">${slots}</span>`;
      const slotClass = isFullyBooked ? 'text-red-500' : 'text-green-600';

      // 満席の場合は空き通知希望として選択可能
      if (isFullyBooked) {
        return `
          <button type="button"
                  class="w-full text-left p-3 mb-2 bg-yellow-50 border border-yellow-300 rounded-lg hover:bg-yellow-100 transition-colors"
                  data-action="requestWaitlistForConclusion"
                  data-lesson-id="${escapeHTML(lesson.lessonId)}">
            <div class="flex justify-between items-center">
              <div>
                <p class="font-bold text-brand-text">${formattedDate}</p>
                <p class="text-sm text-brand-subtle">${escapeHTML(lesson.venue || '')}</p>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-sm ${slotClass}">${slotText}</span>
                <span class="text-xs px-2 py-1 bg-yellow-200 text-yellow-800 rounded">
                  空き通知
                </span>
              </div>
            </div>
          </button>
        `;
      }

      return `
        <button type="button"
                class="w-full text-left p-3 mb-2 bg-ui-surface border border-ui-border rounded-lg hover:bg-action-secondary-bg transition-colors"
                data-action="selectLessonForConclusion"
                data-lesson-id="${escapeHTML(lesson.lessonId)}">
          <div class="flex justify-between items-center">
            <div>
              <p class="font-bold text-brand-text">${formattedDate}</p>
              <p class="text-sm text-brand-subtle">${escapeHTML(lesson.venue || '')}</p>
            </div>
            <span class="text-sm ${slotClass}">${slotText}</span>
          </div>
        </button>
      `;
    })
    .join('');

  // アコーディオンはDOMで開閉する（再描画しない）
  const lessonListHtml = `
    <div class="mb-4">
      <button type="button"
              class="w-full py-3 px-4 bg-ui-surface border border-ui-border rounded-lg text-brand-text font-medium text-center hover:bg-action-secondary-bg transition-colors"
              data-action="toggleLessonListDOM">
        <span id="accordion-toggle-text">にってい いちらん から えらぶ</span>
        <span id="accordion-arrow" class="ml-2">▼</span>
      </button>
    </div>
    <div id="lesson-list-accordion" class="${isExpanded ? '' : 'hidden'}">
      <div class="lesson-list-content max-h-80 overflow-y-auto pb-2">
        ${wizardLessonCards || '<p class="text-center text-brand-subtle p-4">日程がありません</p>'}
      </div>
    </div>
  `;

  return `
    <div class="session-conclusion-step2b session-conclusion-view">
      ${renderWizardProgressBar(3)}

      <div class="text-center mb-4">
        <p class="text-lg font-bold text-brand-text">つぎは いつに しますか？</p>
      </div>

      ${Components.cardContainer({
        variant: 'default',
        padding: 'spacious',
        content: `
          ${slotDisplayHtml}
          ${timeSelectionHtml}
          ${lessonListHtml}
        `,
      })}

      <div class="mt-6 flex flex-col space-y-3">
        ${
          !isSkipped
            ? `
          ${Components.button({
            action: 'skipReservation',
            text: 'いまは きめない',
            style: 'secondary',
            size: 'full',
          })}
        `
            : ''
        }
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
 * @param {SessionConclusionState} state - 現在の状態
 * @returns {string} HTML文字列
 */
export function renderConclusionComplete(state) {
  // 次回予約結果を取得（作成された場合のメタデータ用）
  const nextResult = /** @type {any} */ (state).nextReservationResult;
  const nextLessonGoal = state.nextLessonGoal || '';

  // 今日の日付（翌日以降の予約を探すため）
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // myReservationsから翌日以降の最も近い有効な予約を探す
  const myReservations =
    /** @type {ReservationCore[]} */ (
      /** @type {any} */ (state).myReservations
    ) || [];
  const futureReservations = myReservations
    .filter(
      (/** @type {ReservationCore} */ r) =>
        (r.status === CONSTANTS.STATUS.CONFIRMED ||
          r.status === CONSTANTS.STATUS.WAITLISTED) &&
        new Date(r.date) > today,
    )
    .sort(
      (/** @type {ReservationCore} */ a, /** @type {ReservationCore} */ b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

  /** @type {ReservationCore | null} */
  const nearestFutureReservation =
    futureReservations.length > 0 ? futureReservations[0] : null;

  // Components.listCard用のバッジを生成
  /** @param {'confirmed' | 'waitlisted'} type */
  const buildCompletionBadges = type => {
    if (type === 'waitlisted') {
      return /** @type {{type: BadgeType, text: string}[]} */ ([
        { type: 'warning', text: '空き通知 登録済み' },
      ]);
    }
    return /** @type {{type: BadgeType, text: string}[]} */ ([
      { type: 'success', text: '予約確定 済み' },
    ]);
  };

  /**
   * 次回予約セクションを統一フォーマットで生成
   * @param {{
   *   type: 'reservation' | 'goal-only' | 'reminder',
   *   reservation?: ReservationCore,
   *   isWaitlisted?: boolean,
   *   isNewReservation?: boolean,
   *   goal?: string,
   *   mismatchNote?: string
   * }} config - 設定オブジェクト
   * @returns {string} HTML文字列
   */
  const renderNextReservationSection = config => {
    const {
      type,
      reservation,
      isWaitlisted,
      isNewReservation,
      goal,
      mismatchNote,
    } = config;

    // === イントロメッセージ（状況に応じて分岐） ===
    const buildIntroMessage = () => {
      switch (type) {
        case 'reservation':
          if (isNewReservation) {
            return isWaitlisted
              ? 'じかいについては こちらで 空き通知 とうろく しました！'
              : 'じかいの よやく は こちらで かくてい しました！';
          }
          return 'じかいの よてい は こちらです！';

        case 'goal-only':
        case 'reminder':
          return 'つぎの よやく は あとで えらんでね！';

        default:
          return '';
      }
    };

    // === カード本体（タイプに応じて分岐） ===
    const buildCardHtml = () => {
      switch (type) {
        case 'reservation':
          if (!reservation) return '';
          const cardReservation = {
            ...reservation,
            sessionNote: goal || '',
          };
          return Components.listCard({
            type: 'booking',
            item: cardReservation,
            badges: buildCompletionBadges(
              isWaitlisted ? 'waitlisted' : 'confirmed',
            ),
            editButtons: [],
            accountingButtons: [],
            isEditMode: false,
            showMemoSaveButton: false,
          });

        case 'goal-only':
          return Components.placeholderCard({
            badge: {
              type: /** @type {BadgeType} */ ('info'),
              text: '日程未定',
            },
            memoContent: goal || '',
          });

        case 'reminder':
          return Components.placeholderCard({
            badge: {
              type: /** @type {BadgeType} */ ('neutral'),
              text: '日程未定',
            },
            dimmed: true,
          });

        default:
          return '';
      }
    };

    // === 補足ノート（空き通知の場合のみ） ===
    const buildWaitlistNote = () => {
      if (type !== 'reservation' || !isWaitlisted) return '';
      return `
        <div class="mt-2 p-2 bg-amber-50 rounded-lg">
          <p class="text-sm text-amber-700 leading-relaxed">
            🔔 空きが でたら メールで おしらせします<br>
            このページから よやく してください（先着順です）
          </p>
        </div>
      `;
    };

    // === 統一フォーマットで出力 ===
    const introMessage = buildIntroMessage();
    const mismatchHtml = mismatchNote
      ? `<div class="mb-3">${mismatchNote}</div>`
      : '';
    const cardHtml = buildCardHtml();
    const waitlistNoteHtml = buildWaitlistNote();

    return `
      <div class="mt-4 max-w-md mx-auto">
        <p class="text-base text-brand-text mb-3">${introMessage}</p>
        ${mismatchHtml}
        ${cardHtml}
        ${waitlistNoteHtml}
      </div>
    `;
  };

  // ミスマッチノート生成（期待と結果の差分表示）
  const buildMismatchNote = () => {
    if (!nextResult?.created) return '';

    const isActuallyWaitlisted =
      nearestFutureReservation?.status === CONSTANTS.STATUS.WAITLISTED;
    const expectedWaitlist = !!nextResult.expectedWaitlist;

    if (expectedWaitlist && !isActuallyWaitlisted) {
      return `
        <div class="bg-green-100 text-green-800 text-sm p-2 rounded-lg flex items-center gap-2">
          <span>🎉</span>
          <span>空きが でたので よやく できました！</span>
        </div>
      `;
    }

    if (!expectedWaitlist && isActuallyWaitlisted) {
      return `
        <div class="bg-amber-100 text-amber-800 text-sm p-2 rounded-lg flex items-center gap-2">
          <span>⚠️</span>
          <span>直前に よやく が入り 空き通知登録 になりました</span>
        </div>
      `;
    }

    return '';
  };

  // 予約メッセージHTML生成
  const buildReservationMessageHtml = () => {
    // ケース1: 翌日以降の予約がある場合
    if (nearestFutureReservation) {
      const isWaitlisted =
        nearestFutureReservation.status === CONSTANTS.STATUS.WAITLISTED;
      const goalToShow =
        nextLessonGoal || nearestFutureReservation.sessionNote || '';
      const isNewReservation = !!nextResult?.created;

      return renderNextReservationSection({
        type: 'reservation',
        reservation: nearestFutureReservation,
        isWaitlisted,
        isNewReservation,
        goal: goalToShow,
        mismatchNote: buildMismatchNote(),
      });
    }

    // ケース2: 予約なし + けいかくあり
    if (nextLessonGoal) {
      return renderNextReservationSection({
        type: 'goal-only',
        goal: nextLessonGoal,
      });
    }

    // ケース3: 予約なし + けいかくなし（リマインダー）
    return renderNextReservationSection({ type: 'reminder' });
  };

  const reservationMessageHtml = buildReservationMessageHtml();

  // 予約がない場合のクイック予約ボタン
  const hasNoFutureReservation = !nearestFutureReservation;
  const currentClassroom = state.currentReservation?.classroom || '';
  const quickBookingButtonHtml = hasNoFutureReservation
    ? `
      <div class="mt-4">
        ${Components.button({
          action: 'navigateToBooking',
          text: 'やっぱり よやく する！',
          style: 'secondary',
          size: 'full',
          dataAttributes: {
            classroom: currentClassroom,
          },
        })}
      </div>
    `
    : '';

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

      ${reservationMessageHtml}

      <p class="text-brand-text mb-4">
        また おあいできるのを<br>
        たのしみに しています。
      </p>

      <div class="mt-8 max-w-md mx-auto">
        ${quickBookingButtonHtml}
        <div class="${hasNoFutureReservation ? 'mt-2' : ''}">
          ${Components.button({
            action: 'conclusionDone',
            text: 'ホームへもどる',
            style: 'primary',
            size: 'full',
          })}
        </div>
      </div>
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
      stepContent = renderConclusionComplete(state);
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
      stepContent = renderConclusionComplete(state);
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
