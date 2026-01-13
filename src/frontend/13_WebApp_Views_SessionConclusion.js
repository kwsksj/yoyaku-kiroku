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
import { renderBookingLessons } from './13_WebApp_Views_Booking.js';
import {
  getClassroomColorClass,
  getVenueColorClass,
} from './13_WebApp_Views_Utils.js';

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

  /**
   * 日程の表示ステータスと予約情報を取得（統合版）
   * @param {LessonCore | null} lesson
   * @returns {{
   *   displayStatus: 'reserved' | 'waitlist' | 'full' | 'recommended' | 'available' | 'skip',
   *   isReserved: boolean,
   *   isWaitlisted: boolean
   * }}
   */
  const getLessonInfo = lesson => {
    if (!lesson) {
      return { displayStatus: 'skip', isReserved: false, isWaitlisted: false };
    }

    // myReservationsから該当レッスンの予約情報を検索
    // lessonId または date+classroom で一致を確認
    const reservationRecord = myReservations.find(
      (/** @type {ReservationCore} */ r) =>
        r.lessonId === lesson.lessonId ||
        (r.date === lesson.date && r.classroom === lesson.classroom),
    );

    const isReserved = reservationRecord?.status === CONSTANTS.STATUS.CONFIRMED;
    const isWaitlisted =
      reservationRecord?.status === CONSTANTS.STATUS.WAITLISTED;

    // 表示ステータスを判定（優先順位順）
    /** @type {'reserved' | 'waitlist' | 'full' | 'recommended' | 'available' | 'skip'} */
    let displayStatus = 'available';

    if (isReserved) {
      displayStatus = 'reserved';
    } else if (isWaitlisted) {
      displayStatus = 'waitlist';
    } else if (recommendedLesson?.lessonId === lesson.lessonId) {
      displayStatus = 'recommended';
    }
    // 満席判定は getSlotStatus で行うため、ここでは 'available' のまま

    return { displayStatus, isReserved, isWaitlisted };
  };
  // --- スロットに表示するレッスンを決定 ---
  // 優先順: selectedLesson > existingReservation > recommendedLesson
  // note: 表示ロジックはslotContentHtml内のrenderSlotCardで統一管理
  const slotLesson = selectedLesson || existingReservation || recommendedLesson;

  // 時間の初期値（slotLessonまたはexistingReservationから取得）
  const startTime =
    state.nextStartTime ||
    /** @type {any} */ (slotLesson)?.firstStart ||
    /** @type {any} */ (slotLesson)?.startTime ||
    '';
  const endTime =
    state.nextEndTime ||
    /** @type {any} */ (slotLesson)?.firstEnd ||
    /** @type {any} */ (slotLesson)?.endTime ||
    '';

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
      text = '満席';
    } else if (hasSecondSlots) {
      const morningLabel = window.CONSTANTS?.TIME_SLOTS?.MORNING || '午前';
      const afternoonLabel = window.CONSTANTS?.TIME_SLOTS?.AFTERNOON || '午後';
      text = `${morningLabel}${firstSlotsCount} ${afternoonLabel}${secondSlotsCount}`;
    } else {
      text = `空き${firstSlotsCount}`;
    }

    return { text, isFullyBooked, isExperiencedOnly, hasBeginnerSlot };
  };

  // --- スロットカード生成（改善版） ---

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
        <div class="flex items-center justify-center gap-2">
          <select id="${idPrefix}-start-time"
                  class="px-2 py-1 border-2 border-action-primary-bg ${DesignConfig.borderRadius.button} font-bold text-base text-center bg-white">
            ${generateStartTimeOptions(lesson, currentStartTime)}
          </select>
          <span class="font-bold text-brand-text">〜</span>
          <select id="${idPrefix}-end-time"
                  class="px-2 py-1 border-2 border-action-primary-bg ${DesignConfig.borderRadius.button} font-bold text-base text-center bg-white">
            ${generateEndTimeOptions(lesson, currentStartTime, currentEndTime)}
          </select>
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
      return '<span class="inline-block text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full mb-2">経験者のみ</span>';
    }
    return '';
  };

  /**
   * スロットカードHTMLを生成（統一レンダラー）
   * @param {LessonCore | ReservationCore} lessonOrReservation - 対象レッスン/予約
   * @param {'reserved' | 'waitlist' | 'full' | 'recommended' | 'available' | 'skip'} status - 表示ステータス
   * @param {Object} options - 追加オプション
   * @param {boolean} [options.isTimeBased] - 時間制かどうか
   * @param {string} [options.startTime] - 開始時間
   * @param {string} [options.endTime] - 終了時間
   * @param {string} [options.idPrefix] - ID接頭辞
   * @returns {string} HTML文字列
   */

  /**
   * スロットカード（日付・会場・時間）をレンダリング
   * @param {LessonCore | ReservationCore} lessonOrReservation
   * @param {'reserved' | 'waitlist' | 'full' | 'recommended' | 'available' | 'skip'} status
   * @param {Object} [options]
   * @param {boolean} [options.isTimeBased] - 時間制かどうか
   * @param {string} [options.startTime] - 開始時間
   * @param {string} [options.endTime] - 終了時間
   * @param {string} [options.idPrefix] - ID接頭辞
   * @returns {string} HTML文字列
   */
  const renderSlotCard = (lessonOrReservation, status, options = {}) => {
    const lesson = /** @type {any} */ (lessonOrReservation);
    const formattedDate = window.formatDate
      ? window.formatDate(lesson.date)
      : String(lesson.date);

    // バッジ生成（教室・会場）
    const classroomBadgeClass = getClassroomColorClass(
      lesson.classroom,
      'badgeClass',
    );
    const venueBadgeClass = lesson.venue
      ? getVenueColorClass(lesson.venue, 'badgeClass')
      : '';

    const badgesHtml = `
      <div class="flex items-center justify-center gap-1 mb-2 flex-wrap">
        <span class="px-2 py-0.5 rounded-full text-sm ${classroomBadgeClass}">${escapeHTML(lesson.classroom)}</span>
        ${lesson.venue ? `<span class="px-2 py-0.5 rounded-full text-sm ${venueBadgeClass}">${escapeHTML(lesson.venue)}</span>` : ''}
      </div>
    `;

    const lessonIsTimeBased =
      options.isTimeBased ?? isTimeBasedClassroom(lesson);
    const currentStartTime =
      options.startTime || lesson.firstStart || lesson.startTime || '';
    const currentEndTime =
      options.endTime || lesson.firstEnd || lesson.endTime || '';
    const idPrefix = options.idPrefix || 'conclusion-next';

    // ステータス別スタイル設定（BookingViewと統一）
    /** @type {Record<string, { badge: string, borderClass: string, bgClass: string }>} */
    const styleMap = {
      reserved: {
        badge:
          '<div class="inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold mb-3">✓ よやく済み</div>',
        borderClass: 'border-amber-200',
        bgClass: 'bg-amber-50', // BookingView: booked state
      },
      waitlist: {
        badge:
          '<div class="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-bold mb-3">空き通知 とうろく中</div>',
        borderClass: 'border-stone-200',
        bgClass: 'bg-stone-50', // BookingView: waitlist state
      },
      full: {
        badge:
          '<div class="inline-flex items-center gap-1 bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-bold mb-3">満席 → 空き通知 とうろく</div>',
        borderClass: 'border-stone-200',
        bgClass: 'bg-stone-50', // BookingView: waitlist state (full behaves like waitlist target)
      },
      recommended: {
        badge:
          '<div class="inline-flex items-center gap-1 bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-bold mb-3">こちらは いかがでしょうか？</div>',
        borderClass: 'border-blue-200',
        bgClass: 'bg-blue-50', // BookingView: available state (Recommended is essentially available)
      },
      available: {
        badge:
          '<div class="inline-flex items-center gap-1 bg-action-primary-bg text-white px-3 py-1 rounded-full text-sm font-bold mb-3">この にってい で よやく</div>',
        borderClass: 'border-blue-200',
        bgClass: 'bg-blue-50', // BookingView: available state
      },
      skip: {
        badge: '',
        borderClass: 'border-gray-200',
        bgClass: 'bg-white',
      },
    };
    const styleConfig = styleMap[status] || styleMap['skip'];

    // 時間表示（時間制: 選択UI、回数制: テキスト）
    const timeDisplayHtml = lessonIsTimeBased
      ? renderTimeSelectionUI(
          /** @type {any} */ (lesson),
          currentStartTime,
          currentEndTime,
          idPrefix,
        )
      : currentStartTime
        ? `<p class="text-sm text-brand-subtle mt-2">${currentStartTime} 〜 ${currentEndTime || ''}</p>`
        : '';

    // 経験者のみラベル（予約済みの場合はスロット情報がないためスキップ）
    const slotStatus =
      status !== 'reserved'
        ? getSlotStatus(/** @type {LessonCore} */ (lesson))
        : null;
    const experienceLabel = slotStatus
      ? renderExperienceLabel(slotStatus.isExperiencedOnly)
      : '';

    return `
      <div class="slot-content-inner text-center py-4 border-2 ${styleConfig.borderClass} ${DesignConfig.borderRadius.container} ${styleConfig.bgClass}">
        ${styleConfig.badge}
        <p class="text-2xl font-bold text-brand-text mb-1">${formattedDate}</p>
        ${badgesHtml}
        ${experienceLabel}
        ${timeDisplayHtml}
      </div>
    `;
  };

  // スロットカード本体（リファクタリング版）
  // displayStatus を外部で参照するため、IIFE から結果オブジェクトを返す
  /** @type {'reserved' | 'waitlist' | 'full' | 'recommended' | 'available' | 'skip'} */
  let slotDisplayStatus = 'skip';
  /** @type {LessonCore | ReservationCore | null} */
  let slotTargetLesson = null;

  const slotContentHtml = (() => {
    if (isSkipped) {
      slotDisplayStatus = 'skip';
      return `
        <div class="slot-content-inner text-center py-8 border-2 border-dashed border-gray-300 ${DesignConfig.borderRadius.container} bg-gray-50">
          <p class="text-3xl mb-3">📅</p>
          <p class="text-lg font-bold text-gray-500 mb-1">いまは きめない</p>
          <p class="text-sm text-gray-400">あとで よやく してね</p>
        </div>
      `;
    }

    // 表示対象レッスンを決定
    // 優先順: selectedLesson > existingReservation > recommendedLesson
    /** @type {LessonCore | ReservationCore | null} */
    let targetLesson = null;
    /** @type {'reserved' | 'waitlist' | 'full' | 'recommended' | 'available' | 'skip'} */
    let displayStatus = 'skip';

    if (selectedLesson) {
      targetLesson = selectedLesson;
      // 選択したレッスンのステータスを評価
      displayStatus = getLessonInfo(selectedLesson).displayStatus;
      // 満席チェックを追加
      if (displayStatus === 'available' || displayStatus === 'recommended') {
        const slotStatus = getSlotStatus(selectedLesson);
        if (slotStatus.isFullyBooked) {
          displayStatus = 'full';
        } else if (isWaitlist) {
          // ユーザーが空き通知希望を選択している場合
          displayStatus = 'full';
        }
      }
    } else if (existingReservation) {
      targetLesson = existingReservation;
      displayStatus = 'reserved';
    } else if (recommendedLesson) {
      targetLesson = recommendedLesson;
      displayStatus = 'recommended';
    }

    // 外部参照用に保存
    slotDisplayStatus = displayStatus;
    slotTargetLesson = targetLesson;

    if (!targetLesson) {
      slotDisplayStatus = 'skip';
      return `
        <div class="slot-content-inner text-center py-8 border-2 border-dashed border-gray-300 ${DesignConfig.borderRadius.container} bg-gray-50">
          <p class="text-3xl mb-3">🔍</p>

          <p class="text-sm text-gray-400">にってい いちらん から えらんでください</p>
        </div>
      `;
    }

    // 時間制かどうか
    const targetIsTimeBased = isTimeBasedClassroom(
      /** @type {any} */ (targetLesson),
    );
    const idPrefix =
      existingReservation && !selectedLesson
        ? 'existing-reservation'
        : 'conclusion-next';

    return renderSlotCard(targetLesson, displayStatus, {
      isTimeBased: targetIsTimeBased,
      startTime: startTime,
      endTime: endTime,
      idPrefix: idPrefix,
    });
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

  // レッスン一覧の生成（BookingViewと共通ロジックを利用）
  const lessonListHtml = renderBookingLessons(
    filteredLessons,
    filterClassroom,
    {
      reservations: myReservations,
      actions: {
        book: 'selectLessonForConclusion',
        waitlist: 'requestWaitlistForConclusion',
      },
      isChangingDate: false,
    },
  );

  // フィルター
  // フィルター
  const currentClassroomLabel = currentClassroom || 'いま の 教室';
  const filterHtml = `
    <div class="mb-4">
      ${Components.pillToggle({
        options: [
          {
            value: 'current',
            label: currentClassroomLabel,
            action: 'setFilterClassroom',
            dataAttributes: { 'data-filter': 'current' },
          },
          {
            value: 'all',
            label: 'すべての教室',
            action: 'setFilterClassroom',
            dataAttributes: { 'data-filter': 'all' },
          },
        ],
        selectedValue: filterClassroom,
        size: 'small',
      })}
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

  // 「ほか の にってい」ボタン（スロットコンテナ内に配置）
  const changeButtonHtml = Components.button({
    action: 'expandLessonList',
    text: 'ほか の にってい',
    style: 'secondary',
    size: 'full',
    customClass: 'mt-3',
  });

  // スロットビュー内容（「ほか の にってい」ボタン込み）
  const slotViewContentHtml = `
    <div class="slot-view-content ${isExpanded ? 'hidden' : ''}">
      <label class="block text-base font-bold text-brand-text mb-2">よやく</label>
      ${slotContentHtml}
      ${changeButtonHtml}
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
      <summary class="flex items-center justify-between cursor-pointer text-sm text-brand-subtle py-2 px-3 bg-gray-50 ${DesignConfig.borderRadius.container} hover:bg-gray-100">
        <span>📦 ざいりょう・ちゅうもん の きぼう</span>
        <span class="text-xs text-gray-400">▼</span>
      </summary>
      <div class="mt-2 p-3 bg-white border border-gray-200 ${DesignConfig.borderRadius.container}">
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

  // 新規予約を作成するかどうかの判定
  // slotDisplayStatus が 'reserved' (予約済み) または 'skip' (プレースホルダー) 以外なら新規予約を作成
  // 'recommended', 'available', 'full' は全て未予約の日程（予約を作成する）
  const willCreateNewReservation =
    slotDisplayStatus !== 'reserved' && slotDisplayStatus !== 'skip';

  const getProceedButtonConfig = () => {
    if (willCreateNewReservation && slotTargetLesson) {
      // 新規予約を作成する場合
      return {
        action: 'confirmRecommendedLesson',
        dataAttributes: {
          'lesson-id': /** @type {any} */ (slotTargetLesson).lessonId || '',
        },
      };
    }
    // 予約済みまたはスキップの場合
    return {
      action: 'conclusionNextStep',
      dataAttributes: { 'target-step': STEPS.ACCOUNTING },
    };
  };

  const proceedConfig = getProceedButtonConfig();
  // ボタン文言：新規予約を作成する場合 vs 既存予約のみ/スキップ
  const proceedButtonText = willCreateNewReservation
    ? 'よやく して<br>かいけい に すすむ'
    : 'かいけい に すすむ';
  const proceedButtonHtml = canProceed
    ? Components.button({
        action: proceedConfig.action,
        text: proceedButtonText,
        style: 'primary',
        size: 'full',
        customClass: 'text-lg py-4 shadow-md font-bold mb-3',
        dataAttributes: proceedConfig.dataAttributes,
      })
    : '';

  // 「ほか の にってい」ボタンは slotViewContentHtml 内に移動済み

  const skipButtonHtml = !isSkipped
    ? Components.button({
        action: 'skipReservation',
        text: 'いまは きめない',
        style: 'secondary',
        size: 'full',
      })
    : Components.button({
        action: 'undoReservationSkip',
        text: 'やっぱり えらぶ',
        style: 'secondary',
        size: 'full',
      });

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
  /**
   * @param {'confirmed' | 'waitlisted'} type
   * @param {boolean} [isNewlyCreated] - 今回新規作成された予約かどうか
   */
  const buildCompletionBadges = (type, isNewlyCreated = false) => {
    /** @type {{type: BadgeType, text: string}[]} */
    const badges = [];

    // 新規作成バッジ（最優先で表示）
    if (isNewlyCreated) {
      badges.push({ type: 'attention', text: '今回 よやく' });
    }

    // ステータスバッジ
    if (type === 'waitlisted') {
      badges.push({ type: 'warning', text: '空き通知 とうろく中' });
    } else {
      badges.push({ type: 'success', text: 'よやく済み' });
    }

    return badges;
  };

  /**
   * 予約カードを統一フォーマットで生成
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

    // === カード本体（タイプに応じて分岐） ===
    const buildCardHtml = () => {
      switch (type) {
        case 'reservation':
          if (!reservation) return '';

          const cardHtml = Components.listCard({
            item: reservation, // sessionNoteはlistCardで表示されないため設定不要
            badges: buildCompletionBadges(
              isWaitlisted ? 'waitlisted' : 'confirmed',
              isNewReservation,
            ),
            editButtons: [],
          });

          // listCardで表示されなくなった「けいかく・もくひょう」をカード外に表示
          if (goal) {
            return `
              <div class="mb-2 p-3 bg-blue-50 text-brand-text ${DesignConfig.borderRadius.container} border border-blue-100 text-left">
                <div class="text-xs font-bold text-blue-600 mb-1">けいかく・もくひょう</div>
                <div class="text-sm whitespace-pre-wrap">${escapeHTML(goal)}</div>
              </div>
              ${cardHtml}
            `;
          }

          return cardHtml;

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
        <div class="mt-2 p-2 bg-amber-50 ${DesignConfig.borderRadius.container}">
          <p class="text-sm text-amber-700 leading-relaxed">
            🔔 空きが でたら メールで おしらせします<br>
            このページから よやく してください（先着順です）
          </p>
        </div>
      `;
    };

    // === 統一フォーマットで出力（イントロメッセージなし） ===
    const mismatchHtml = mismatchNote
      ? `<div class="mb-3">${mismatchNote}</div>`
      : '';
    const cardHtml = buildCardHtml();
    const waitlistNoteHtml = buildWaitlistNote();

    return `
      <div class="mt-2 max-w-md mx-auto">
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
        <div class="bg-green-100 text-green-800 text-sm p-2 ${DesignConfig.borderRadius.container} flex items-center gap-2">
          <span>🎉</span>
          <span>空きが でたので よやく できました！</span>
        </div>
      `;
    }

    if (!expectedWaitlist && isActuallyWaitlisted) {
      return `
        <div class="bg-amber-100 text-amber-800 text-sm p-2 ${DesignConfig.borderRadius.button} flex items-center gap-2">
          <span>⚠️</span>
          <span>直前に よやく が入り 空き通知登録 になりました</span>
        </div>
      `;
    }

    return '';
  };

  // 予約メッセージHTML生成
  const buildReservationMessageHtml = () => {
    // ケース1: 翌日以降の予約がある場合（複数対応）
    if (futureReservations.length > 0) {
      const isNewReservation = !!nextResult?.created;
      // 新規作成された予約を正確に特定（date/classroomで判定）
      const createdDate = nextResult?.date || '';
      const createdClassroom = nextResult?.classroom || '';

      // 複数予約対応: すべての将来予約をカードとして表示
      const reservationCards = futureReservations.map((reservation, index) => {
        const isWaitlisted = reservation.status === CONSTANTS.STATUS.WAITLISTED;
        // この予約が今回新規作成されたものかどうかを判定
        const isThisNewlyCreated =
          isNewReservation &&
          reservation.date === createdDate &&
          reservation.classroom === createdClassroom;
        // けいかくは最初の予約のみに表示（重複表示を避ける）
        const goalToShow =
          (index === 0 && nextLessonGoal) || reservation.sessionNote || '';
        // ミスマッチノートは今回作成された予約のみ
        const mismatchNote = isThisNewlyCreated ? buildMismatchNote() : '';

        return renderNextReservationSection({
          type: 'reservation',
          reservation,
          isWaitlisted,
          isNewReservation: isThisNewlyCreated,
          goal: goalToShow,
          mismatchNote,
        });
      });

      // 統一ヘッダー付きで複数カードを表示
      return `
        <div class="mt-4 max-w-md mx-auto">
          <p class="text-base text-brand-text font-bold mb-2">📅 こんご の よやく</p>
          ${reservationCards.join('')}
        </div>
      `;
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
          <div class="session-conclusion-wizard">
            ${stepContent}
          </div>
        `,
      })}
    </div>
  `;
}
