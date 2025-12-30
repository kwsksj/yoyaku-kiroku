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
 *   - ステップ3：予約（次回日程選択）
 *   - ステップ4：会計（既存会計UIの再利用）
 * AI向けメモ:
 *   - 各ステップは独立した関数で描画し、Handlerからステップ遷移を管理する
 * =================================================================
 */

import {
  generateSalesSection,
  generateTuitionSection,
} from './12-2_Accounting_UI.js';
import { isTimeBasedClassroom } from './12_WebApp_Core_Data.js';
import { Components, escapeHTML } from './13_WebApp_Components.js';
import { getClassroomColorClass } from './13_WebApp_Views_Utils.js';

/**
 * ウィザードのステップID定義
 */
export const STEPS = {
  RECORD: '1',
  GOAL: '2',
  RESERVATION: '3',
  ACCOUNTING: '4',
  COMPLETE: '5',
};

/**
 * @typedef {Object} SessionConclusionState
 * @property {string} currentStep - 現在のステップ (STEPS定数参照)
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
 * @property {string} filterClassroom - 教室フィルター ('current' | 'all')
 * @property {string} [orderInput] - 材料希望入力
 * @property {string} [materialInput] - 注文品希望入力
 */

/**
 * ウィザードの進行バーを生成
 * @param {string} currentStep - 現在のステップID
 * @returns {string} HTML文字列
 */
export function renderWizardProgressBar(currentStep) {
  const steps = [
    { id: STEPS.RECORD, num: 1, label: 'きろく' },
    { id: STEPS.GOAL, num: 2, label: 'けいかく' },
    { id: STEPS.RESERVATION, num: 3, label: 'よやく' },
    { id: STEPS.ACCOUNTING, num: 4, label: 'かいけい' },
  ];

  const currentStepNum = steps.find(s => s.id === currentStep)?.num || 1;

  const stepsHtml = steps
    .map(step => {
      const isActive = step.id === currentStep;
      const isCompleted = step.num < currentStepNum;
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
      ${renderWizardProgressBar(STEPS.RECORD)}

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
              'せんせい が あとで おもいだしやすく なります。「みんな の よやく・きろく」にも のります。',
          })}
        `,
      })}

      <div class="mt-6 flex flex-col space-y-3">
        ${Components.button({
          action: 'conclusionNextStep',
          text: 'つぎへ',
          style: 'primary',
          size: 'full',
          dataAttributes: { 'target-step': STEPS.GOAL },
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
 * ステップ2: けいかく・もくひょう入力画面を生成
 * @param {SessionConclusionState} state - 現在の状態
 * @returns {string} HTML文字列
 */
export function renderStep2GoalInput(state) {
  const nextGoal = state.nextLessonGoal || '';

  return `
    <div class="session-conclusion-step2 session-conclusion-view">
      ${renderWizardProgressBar(STEPS.GOAL)}

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
            caption: '「みんな の よやく・きろく」にも のります。',
          })}
        `,
      })}

      <div class="mt-6 flex flex-col space-y-3">
        ${Components.button({
          action: 'conclusionNextStep',
          text: 'つぎへ',
          style: 'primary',
          size: 'full',
          dataAttributes: { 'target-step': STEPS.RESERVATION },
        })}
        ${Components.button({
          action: 'conclusionPrevStep',
          text: 'もどる',
          style: 'secondary',
          size: 'full',
          dataAttributes: { 'target-step': STEPS.RECORD },
        })}
      </div>
    </div>
  `;
}

/**
 * ステップ3: 次回予約画面を生成（よやく）- スロット型UI
 * @param {SessionConclusionState} state - 現在の状態
 * @returns {string} HTML文字列
 */
export function renderStep3Reservation(state) {
  const existingReservation = state.existingFutureReservation;
  const selectedLesson = state.selectedLesson;
  const recommendedLesson = state.recommendedNextLesson;
  const isSkipped = state.reservationSkipped;
  const isWaitlist = state.isWaitlistRequest;
  const isExpanded = state.isLessonListExpanded;
  const filterClassroom = state.filterClassroom || 'current';

  // ユーザーの既存予約・空き通知情報を取得（日程リストのマーク表示用）
  const myReservations =
    window.appWindow?.stateManager?.getState()?.myReservations || [];

  // --- スロットに表示するレッスンを決定 ---
  // 優先順:
  // 1. ユーザーが明示的に選択したレッスン（既存予約があっても上書き）
  // 2. 既存予約がある場合 → おすすめは不要（既存予約表示へ）
  // 3. 既存予約がない場合 → おすすめを表示
  const slotLesson =
    selectedLesson || (!existingReservation ? recommendedLesson : null);

  // 時間制かどうか
  const isTimeBased =
    slotLesson && isTimeBasedClassroom(/** @type {any} */ (slotLesson));

  // 既存予約が時間制かどうか
  const existingIsTimeBased =
    existingReservation &&
    isTimeBasedClassroom(/** @type {any} */ (existingReservation));

  // 時間の初期値
  const startTime = state.nextStartTime || slotLesson?.firstStart || '';
  const endTime = state.nextEndTime || slotLesson?.firstEnd || '';

  // --- 時間選択オプション生成（レッスン範囲に制約、休憩時間除外） ---
  const MIN_DURATION = 120; // 最低2時間

  /**
   * 開始時間オプションを生成
   * @param {LessonCore} lesson - 対象レッスン
   * @param {string} selectedStartTime - 選択中の開始時間
   * @returns {string} optionタグのHTML
   */
  const generateStartTimeOptions = (lesson, selectedStartTime) => {
    if (!lesson) return '';

    const lessonStart = lesson.firstStart || '09:00';
    const lessonEnd = lesson.secondEnd || lesson.firstEnd || '18:00';
    const firstEnd = lesson.firstEnd || '';
    const secondStart = lesson.secondStart || '';
    const classroomType = lesson.classroomType || '';
    const isDualSession = classroomType.includes('2部制');

    const [sH, sM] = lessonStart.split(':').map(Number);
    const [eH, eM] = lessonEnd.split(':').map(Number);
    const startMin = sH * 60 + sM;
    const limitMin = eH * 60 + eM - MIN_DURATION;

    // 休憩時間の計算（2部制の場合）
    let breakStartMin = 9999;
    let breakEndMin = 0;
    if (isDualSession && firstEnd && secondStart) {
      const [feH, feM] = firstEnd.split(':').map(Number);
      const [ssH, ssM] = secondStart.split(':').map(Number);
      breakStartMin = feH * 60 + feM;
      breakEndMin = ssH * 60 + ssM;
    }

    const options = [];
    for (let m = startMin; m <= limitMin; m += 30) {
      // 休憩時間中は除外
      if (isDualSession && m >= breakStartMin && m < breakEndMin) {
        continue;
      }
      const h = Math.floor(m / 60);
      const mm = m % 60;
      const t = `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      const selected = t === selectedStartTime ? 'selected' : '';
      options.push(`<option value="${t}" ${selected}>${t}</option>`);
    }
    return options.join('');
  };

  /**
   * 終了時間オプションを生成
   * @param {LessonCore} lesson - 対象レッスン
   * @param {string} selectedStartTime - 選択中の開始時間
   * @param {string} selectedEndTime - 選択中の終了時間
   * @returns {string} optionタグのHTML
   */
  const generateEndTimeOptions = (
    lesson,
    selectedStartTime,
    selectedEndTime,
  ) => {
    if (!lesson || !selectedStartTime) return '';

    const lessonEnd = lesson.secondEnd || lesson.firstEnd || '18:00';
    const firstEnd = lesson.firstEnd || '';
    const secondStart = lesson.secondStart || '';
    const classroomType = lesson.classroomType || '';
    const isDualSession = classroomType.includes('2部制');

    const [stH, stM] = selectedStartTime.split(':').map(Number);
    const [eH, eM] = lessonEnd.split(':').map(Number);
    const startMin = stH * 60 + stM;
    const maxEndMin = eH * 60 + eM;

    // 休憩時間の計算
    let breakStartMin = 9999;
    let breakEndMin = 0;
    let breakDuration = 0;
    if (isDualSession && firstEnd && secondStart) {
      const [feH, feM] = firstEnd.split(':').map(Number);
      const [ssH, ssM] = secondStart.split(':').map(Number);
      breakStartMin = feH * 60 + feM;
      breakEndMin = ssH * 60 + ssM;
      breakDuration = breakEndMin - breakStartMin;
    }

    const calculateActualWorkMinutes = (/** @type {number} */ endMin) => {
      const totalMinutes = endMin - startMin;
      if (isDualSession && startMin < breakStartMin && endMin > breakEndMin) {
        return totalMinutes - breakDuration;
      }
      return totalMinutes;
    };

    const options = [];
    for (let m = startMin + 30; m <= maxEndMin; m += 30) {
      if (isDualSession && m > breakStartMin && m <= breakEndMin) {
        continue;
      }
      const actualWork = calculateActualWorkMinutes(m);
      if (actualWork < MIN_DURATION) {
        continue;
      }
      const h = Math.floor(m / 60);
      const mm = m % 60;
      const t = `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      const selected = t === selectedEndTime ? 'selected' : '';
      options.push(`<option value="${t}" ${selected}>${t}</option>`);
    }
    return options.join('');
  };

  /**
   * スロット値を正規化
   * @param {number | string | undefined} value
   * @returns {number}
   */
  const normalizeSlotValue = value => {
    if (value === undefined || value === null || value === '') return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  /**
   * スロット状態を取得
   * @param {LessonCore} lesson
   * @returns {{ text: string, isFullyBooked: boolean, isExperiencedOnly: boolean, hasBeginnerSlot: boolean }}
   */
  const getSlotStatus = lesson => {
    const hasSecondSlots = typeof lesson.secondSlots !== 'undefined';
    const firstSlotsCount = normalizeSlotValue(lesson.firstSlots);
    const secondSlotsCount = hasSecondSlots
      ? normalizeSlotValue(lesson.secondSlots)
      : 0;
    const beginnerCapacity = normalizeSlotValue(lesson.beginnerCapacity);

    const isFullyBooked = hasSecondSlots
      ? firstSlotsCount === 0 && secondSlotsCount === 0
      : firstSlotsCount === 0;

    const isExperiencedOnly = !lesson.beginnerStart || beginnerCapacity === 0;
    const hasBeginnerSlot = !isExperiencedOnly;

    let text;
    if (isFullyBooked) {
      text = '満席（空き通知登録）';
    } else if (hasSecondSlots) {
      const morningLabel = window.CONSTANTS?.TIME_SLOTS?.MORNING || '午前';
      const afternoonLabel = window.CONSTANTS?.TIME_SLOTS?.AFTERNOON || '午後';
      text = `${morningLabel}${firstSlotsCount} ${afternoonLabel}${secondSlotsCount}`;
    } else {
      text = `空き${firstSlotsCount}`;
    }

    return { text, isFullyBooked, isExperiencedOnly, hasBeginnerSlot };
  };

  /**
   * 日程の予約状態を取得
   * @param {LessonCore} lesson
   * @returns {{ isReserved: boolean, isWaitlisted: boolean }}
   */
  const getReservationStatus = lesson => {
    const found = myReservations.find(
      (/** @type {ReservationCore} */ r) =>
        r.lessonId === lesson.lessonId ||
        (r.date === lesson.date && r.classroom === lesson.classroom),
    );
    return {
      isReserved: found?.status === CONSTANTS.STATUS.CONFIRMED,
      isWaitlisted: found?.status === CONSTANTS.STATUS.WAITLISTED,
    };
  };

  // --- スロットカード生成（改善版） ---
  /**
   * スロットカードの説明テキストを生成
   * @returns {string} HTML文字列
   */
  const getSlotDescriptionText = () => {
    if (isSkipped) return '';
    if (existingReservation && !selectedLesson) {
      return 'つぎ の よやく';
    }
    if (slotLesson) {
      const isSelected = Boolean(selectedLesson);
      if (isWaitlist) {
        return 'まんせき です（あき が でたら れんらく します）';
      } else if (isSelected) {
        return 'えらんだ にってい';
      } else {
        return 'おすすめ の にってい（きょう と にた にってい）';
      }
    }
    return '';
  };

  /**
   * 時間選択UIを生成
   * @param {LessonCore} lesson - 対象レッスン
   * @param {string} currentStartTime - 現在の開始時間
   * @param {string} currentEndTime - 現在の終了時間
   * @param {string} idPrefix - IDプレフィックス（既存予約用）
   * @returns {string} HTML文字列
   */
  const renderTimeSelectionUI = (
    lesson,
    currentStartTime,
    currentEndTime,
    idPrefix = 'conclusion-next',
  ) => {
    return `
      <div class="mt-3 pt-2 border-t border-gray-200">
        <div class="flex items-center justify-center gap-2">
          <select id="${idPrefix}-start-time"
                  class="px-2 py-1 border-2 border-action-primary-bg rounded-lg font-bold text-base text-center bg-white">
            ${generateStartTimeOptions(lesson, currentStartTime)}
          </select>
          <span class="font-bold text-brand-text">〜</span>
          <select id="${idPrefix}-end-time"
                  class="px-2 py-1 border-2 border-action-primary-bg rounded-lg font-bold text-base text-center bg-white">
            ${generateEndTimeOptions(lesson, currentStartTime, currentEndTime)}
          </select>
        </div>
        <p class="text-xs text-brand-subtle text-center mt-1">* さいてい 2じかん</p>
      </div>
    `;
  };

  /**
   * 経験者のみラベルを生成
   * @param {boolean} isExperiencedOnly
   * @returns {string} HTML文字列
   */
  const renderExperienceLabel = isExperiencedOnly => {
    if (isExperiencedOnly) {
      return '<span class="inline-block text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">経験者のみ</span>';
    }
    return '';
  };

  // スロットカード本体
  const slotContentHtml = (() => {
    if (isSkipped) {
      return `
        <div class="slot-content-inner text-center py-8 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50">
          <p class="text-3xl mb-3">📅</p>
          <p class="text-lg font-bold text-gray-500 mb-1">いまは きめない</p>
          <p class="text-sm text-gray-400">あとで よやく してね</p>
        </div>
      `;
    } else if (existingReservation && !selectedLesson) {
      const formattedDate = window.formatDate
        ? window.formatDate(existingReservation.date)
        : existingReservation.date;

      // 時間制既存予約の時間選択UI
      const existingTimeHtml = existingIsTimeBased
        ? renderTimeSelectionUI(
            /** @type {any} */ (existingReservation),
            existingReservation.startTime || '',
            existingReservation.endTime || '',
            'existing-reservation',
          )
        : existingReservation.startTime
          ? `<p class="text-sm text-brand-subtle mt-2">${existingReservation.startTime} 〜 ${existingReservation.endTime || ''}</p>`
          : '';

      return `
        <div class="slot-content-inner text-center py-4 border-2 border-green-400 rounded-xl bg-green-50">
          <div class="inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold mb-3">
            <span>✓</span>
            <span>よやくずみ</span>
          </div>
          <p class="text-2xl font-bold text-brand-text mb-1">${formattedDate}</p>
          <p class="text-sm text-brand-subtle">${escapeHTML(existingReservation.classroom)} ${existingReservation.venue ? escapeHTML(existingReservation.venue) : ''}</p>
          ${existingTimeHtml}
        </div>
      `;
    } else if (slotLesson) {
      const formattedDate = window.formatDate
        ? window.formatDate(slotLesson.date)
        : String(slotLesson.date);
      const venueText = `${escapeHTML(slotLesson.classroom)} ${slotLesson.venue ? escapeHTML(slotLesson.venue) : ''}`;
      const isSelected = Boolean(selectedLesson);
      const { isExperiencedOnly } = getSlotStatus(slotLesson);

      // ステータスバッジ
      let statusBadge = '';
      let cardBorderClass = 'border-action-primary-bg';
      let cardBgClass = 'bg-action-secondary-bg';

      if (isWaitlist) {
        statusBadge =
          '<div class="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-bold mb-3">空き通知 きぼう</div>';
        cardBorderClass = 'border-yellow-400';
        cardBgClass = 'bg-yellow-50';
      } else if (isSelected) {
        statusBadge =
          '<div class="inline-flex items-center gap-1 bg-action-primary-bg text-white px-3 py-1 rounded-full text-sm font-bold mb-3">この にってい で よやく</div>';
      } else {
        statusBadge =
          '<div class="inline-flex items-center gap-1 bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-bold mb-3">★ おすすめ（きょうと にた にってい）</div>';
      }

      const experienceLabel = renderExperienceLabel(isExperiencedOnly);
      const timeSelectionHtml = isTimeBased
        ? renderTimeSelectionUI(slotLesson, startTime, endTime)
        : '';

      return `
        <div class="slot-content-inner text-center py-4 border-2 ${cardBorderClass} rounded-xl ${cardBgClass}">
          ${statusBadge}
          <p class="text-2xl font-bold text-brand-text mb-1">${formattedDate}</p>
          <p class="text-sm text-brand-subtle mb-2">${venueText}</p>
          ${experienceLabel}
          ${timeSelectionHtml}
        </div>
      `;
    } else {
      return `
        <div class="slot-content-inner text-center py-8 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50">
          <p class="text-3xl mb-3">🔍</p>
          <p class="text-lg font-bold text-gray-500 mb-1">おすすめが ありません</p>
          <p class="text-sm text-gray-400">にってい いちらん から えらんでください</p>
        </div>
      `;
    }
  })();

  // --- レッスン一覧の生成 ---
  const currentClassroom = state.currentReservation?.classroom || '';
  const allLessons = window.appWindow?.stateManager?.getState()?.lessons || [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filteredLessons = allLessons.filter((/** @type {LessonCore} */ l) => {
    const lessonDate = new Date(l.date);
    lessonDate.setHours(0, 0, 0, 0);
    if (lessonDate <= today) return false;
    if (filterClassroom === 'current') {
      return l.classroom === currentClassroom;
    }
    return true;
  });

  filteredLessons.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  /** @type {Record<string, LessonCore[]>} */
  const groupedLessons = {};
  filteredLessons.forEach(lesson => {
    const d = new Date(lesson.date);
    const monthKey = `${d.getMonth() + 1}月`;
    if (!groupedLessons[monthKey]) {
      groupedLessons[monthKey] = [];
    }
    groupedLessons[monthKey].push(lesson);
  });

  const lessonListHtml =
    filteredLessons.length === 0
      ? `<p class="text-center text-gray-500 py-4">よやく かのう な にってい が ありません</p>`
      : Object.entries(groupedLessons)
          .map(([month, lessons]) => {
            const cardsHtml = lessons
              .map(lesson => {
                const formattedDate = window.formatDate
                  ? window.formatDate(lesson.date)
                  : String(lesson.date);
                const isRecommended =
                  recommendedLesson?.lessonId === lesson.lessonId;
                const classroomColor = getClassroomColorClass(lesson.classroom);
                const {
                  text: slotText,
                  isFullyBooked,
                  isExperiencedOnly,
                } = getSlotStatus(lesson);
                const { isReserved, isWaitlisted: isWaitlistedStatus } =
                  getReservationStatus(lesson);

                // 予約済み/空き通知バッジ
                let reservationBadge = '';
                if (isReserved) {
                  reservationBadge =
                    '<span class="text-xs bg-green-100 text-green-600 px-1.5 py-0.5 rounded ml-1">予約済み</span>';
                } else if (isWaitlistedStatus) {
                  reservationBadge =
                    '<span class="text-xs bg-yellow-100 text-yellow-600 px-1.5 py-0.5 rounded ml-1">通知登録中</span>';
                }

                const experiencedOnlyBadge =
                  isExperiencedOnly && !isFullyBooked
                    ? '<span class="text-xs text-gray-400 ml-1">経験者のみ</span>'
                    : '';

                if (isFullyBooked) {
                  return `
                  <button type="button"
                          class="w-full text-left p-3 mb-2 bg-yellow-50 border-2 border-yellow-200 rounded-lg hover:bg-yellow-100"
                          data-action="requestWaitlistForConclusion"
                          data-lesson-id="${escapeHTML(lesson.lessonId)}">
                    <div class="flex justify-between items-center">
                      <div>
                        ${filterClassroom === 'all' ? `<span class="text-xs px-1 rounded border ${classroomColor} mr-1">${lesson.classroom}</span>` : ''}
                        <span class="font-bold">${formattedDate}</span>
                        ${isRecommended ? '<span class="ml-1 text-xs text-yellow-600">★</span>' : ''}
                        ${reservationBadge}
                      </div>
                      <span class="text-xs text-yellow-600 font-bold">${slotText}</span>
                    </div>
                  </button>
                `;
                }

                return `
                <button type="button"
                        class="w-full text-left p-3 mb-2 bg-white border-2 border-gray-200 rounded-lg hover:border-action-primary-bg hover:shadow-sm ${isReserved ? 'opacity-60' : ''}"
                        data-action="selectLessonForConclusion"
                        data-lesson-id="${escapeHTML(lesson.lessonId)}">
                  <div class="flex justify-between items-center">
                    <div>
                      ${filterClassroom === 'all' ? `<span class="text-xs px-1 rounded border ${classroomColor} mr-1">${lesson.classroom}</span>` : ''}
                      <span class="font-bold">${formattedDate}</span>
                      ${isRecommended ? '<span class="ml-1 text-xs text-yellow-500">★おすすめ</span>' : ''}
                      ${reservationBadge}
                      ${experiencedOnlyBadge}
                    </div>
                    <span class="text-sm text-action-primary-bg font-bold">${slotText}</span>
                  </div>
                </button>
              `;
              })
              .join('');

            return `
            <div class="mb-4">
              <p class="text-xs font-bold text-gray-500 mb-2 border-l-2 border-gray-300 pl-2">${month}</p>
              ${cardsHtml}
            </div>
          `;
          })
          .join('');

  // フィルター
  const activeClass = 'bg-action-primary-bg text-white';
  const inactiveClass = 'bg-gray-100 text-gray-500';
  const currentClassroomLabel = currentClassroom || 'いま の きょうしつ';
  const filterHtml = `
    <div class="lesson-filter flex justify-center mb-4 bg-gray-100 p-1 rounded-full">
      <button type="button"
              class="flex-1 py-1 px-2 text-xs font-bold rounded-full filter-btn-current ${filterClassroom === 'current' ? activeClass : inactiveClass}"
              data-action="setFilterClassroom"
              data-filter="current">
        ${escapeHTML(currentClassroomLabel)}
      </button>
      <button type="button"
              class="flex-1 py-1 px-2 text-xs font-bold rounded-full filter-btn-all ${filterClassroom === 'all' ? activeClass : inactiveClass}"
              data-action="setFilterClassroom"
              data-filter="all">
        すべての教室
      </button>
    </div>
  `;

  // リストビュー説明テキスト
  const listDescriptionText = 'きぼう の にってい を えらんでください';

  // リストビュー内容
  const lessonListContentHtml = `
    <div class="slot-list-content ${isExpanded ? '' : 'hidden'}">
      <label class="block text-base font-bold text-brand-text mb-3">にってい いちらん</label>
      <p class="text-sm text-brand-subtle mb-3">${listDescriptionText}</p>
      <div class="mb-3">
        ${filterHtml}
      </div>
      <div class="max-h-64 overflow-y-auto lesson-list-scroll -mx-2 px-2">
        ${lessonListHtml}
      </div>
    </div>
  `;

  // スロット説明テキスト（スロット上部外に配置）
  const slotDescriptionHtml = getSlotDescriptionText()
    ? `<p class="text-sm text-brand-subtle mb-3">${getSlotDescriptionText()}</p>`
    : '';

  // スロットビュー内容
  const slotViewContentHtml = `
    <div class="slot-view-content ${isExpanded ? 'hidden' : ''}">
      <label class="block text-base font-bold text-brand-text mb-2">よやく</label>
      ${slotDescriptionHtml}
      ${slotContentHtml}
    </div>
  `;

  // 統合スロットコンテナ
  const unifiedSlotHtml = Components.cardContainer({
    variant: 'default',
    padding: 'spacious',
    customClass: 'slot-container mb-4',
    content: `${slotViewContentHtml}${lessonListContentHtml}`,
  });

  // --- 材料/注文品入力セクション ---
  const orderInputHtml = !isSkipped
    ? `
    <details class="mb-4">
      <summary class="flex items-center justify-between cursor-pointer text-sm text-brand-subtle py-2 px-3 bg-gray-50 rounded-lg hover:bg-gray-100">
        <span>📦 ざいりょう・ちゅうもん の きぼう</span>
        <span class="text-xs text-gray-400">▼</span>
      </summary>
      <div class="mt-2 p-3 bg-white border border-gray-200 rounded-lg">
        ${Components.textarea({
          id: 'conclusion-order-input',
          label: 'ざいりょう の きぼう',
          placeholder: '例：「30×30×40mmくらい」「高さが6cmくらい」など',
          value: state.orderInput || '',
          rows: 2,
        })}
        <div class="mt-3">
          ${Components.textarea({
            id: 'conclusion-material-input',
            label: 'ちゅうもん の きぼう',
            placeholder: '例：「彫刻刀セット」「木槌」など',
            value: state.materialInput || '',
            rows: 2,
          })}
        </div>
      </div>
    </details>
  `
    : '';

  // --- アクションボタン ---
  const canProceed = slotLesson || isSkipped || existingReservation;

  const getProceedButtonConfig = () => {
    if (isSkipped || existingReservation) {
      return {
        action: 'conclusionNextStep',
        dataAttributes: { 'target-step': STEPS.ACCOUNTING },
      };
    }
    return {
      action: 'confirmRecommendedLesson',
      dataAttributes: { 'lesson-id': slotLesson?.lessonId || '' },
    };
  };

  const proceedConfig = getProceedButtonConfig();
  const proceedButtonHtml = canProceed
    ? Components.button({
        action: proceedConfig.action,
        text: 'これで すすむ！',
        style: 'primary',
        size: 'full',
        customClass: 'text-lg py-4 shadow-md font-bold mb-3',
        dataAttributes: proceedConfig.dataAttributes,
      })
    : '';

  const changeButtonHtml = !isExpanded
    ? Components.button({
        action: 'expandLessonList',
        text: 'にってい へんこう',
        style: 'secondary',
        size: 'full',
        customClass: 'mb-3',
      })
    : '';

  const skipButtonHtml = !isSkipped
    ? `
      <div class="text-center">
        <button type="button"
                class="text-sm text-gray-400 underline"
                data-action="skipReservation">
          いまは きめない
        </button>
      </div>
    `
    : `
      <div class="text-center">
        <button type="button"
                class="text-sm text-action-primary underline font-bold"
                data-action="undoReservationSkip">
          やっぱり えらぶ
        </button>
      </div>
    `;

  // もどるボタン（日程リスト展開時はスロット表示に戻る、そうでなければ前のステップへ）
  const backButtonHtml = isExpanded
    ? Components.button({
        action: 'expandLessonList',
        text: 'もどる',
        style: 'secondary',
        size: 'full',
        customClass: 'mt-4',
      })
    : Components.button({
        action: 'conclusionPrevStep',
        text: 'もどる',
        style: 'secondary',
        size: 'full',
        customClass: 'mt-4',
        dataAttributes: { 'target-step': STEPS.GOAL },
      });

  // --- メインHTMLの組み立て ---
  return `
    <div class="session-conclusion-step3 session-conclusion-view pb-12">
      ${renderWizardProgressBar(STEPS.RESERVATION)}

      <div class="text-center mb-6">
        <p class="text-xl font-bold text-brand-text">つぎは いつに しますか？</p>
      </div>

      ${unifiedSlotHtml}

      ${orderInputHtml}

      <div class="action-buttons ${isExpanded ? 'hidden' : ''}">
        ${proceedButtonHtml}
        ${changeButtonHtml}
        ${skipButtonHtml}
      </div>

      ${backButtonHtml}
    </div>
  `;
}

/**
 * ステップ4: 会計画面を生成
 * @param {SessionConclusionState} state - 現在の状態
 * @returns {string} HTML文字列
 */
export function renderStep4Accounting(state) {
  const classifiedItems = state.classifiedItems;
  const classroom = state.currentReservation?.classroom || '';
  const formData = state.accountingFormData || {};

  if (!classifiedItems) {
    return `
      <div class="session-conclusion-step4">
        ${renderWizardProgressBar(STEPS.ACCOUNTING)}
        ${Components.cardContainer({
          variant: 'default',
          padding: 'spacious',
          content: `<p class="text-center text-brand-subtle">会計データの読み込み中...</p>`,
        })}
      </div>
    `;
  }

  return `
    <div class="session-conclusion-step4 session-conclusion-view">
      ${renderWizardProgressBar(STEPS.ACCOUNTING)}

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
                <span class="text-2xl font-bold text-brand-text">総合計：</span>
                <span id="grand-total-amount" class="text-2xl font-bold text-brand-text">${Components.priceDisplay({ amount: 0, size: 'extraLarge' })}</span>
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
          dataAttributes: { targetStep: STEPS.RESERVATION },
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
    case STEPS.RECORD:
      stepContent = renderStep1Record(state);
      break;
    case STEPS.GOAL:
      stepContent = renderStep2GoalInput(state);
      break;
    case STEPS.RESERVATION:
      stepContent = renderStep3Reservation(state);
      break;
    case STEPS.ACCOUNTING:
      stepContent = renderStep4Accounting(state);
      break;
    case STEPS.COMPLETE: // 完了
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
          <div class="session-conclusion-wizard fade-in">
            ${stepContent}
          </div>
        `,
      })}
    </div>
  `;
}
