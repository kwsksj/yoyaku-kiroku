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

  // --- スロットに表示するレッスンを決定 ---
  // 優先順: 選択済み > おすすめ > なし
  const slotLesson = selectedLesson || recommendedLesson;

  // 時間制かどうか
  const isTimeBased =
    slotLesson && isTimeBasedClassroom(/** @type {any} */ (slotLesson));

  // 時間の初期値
  const startTime = state.nextStartTime || slotLesson?.firstStart || '';
  const endTime = state.nextEndTime || slotLesson?.firstEnd || '';

  // --- 時間選択オプション生成（レッスン範囲に制約、休憩時間除外） ---
  const MIN_DURATION = 120; // 最低2時間

  /**
   * 開始時間オプションを生成
   * - 2部制の場合は休憩時間（firstEnd〜secondStart）を除外
   * - 終了時刻から最低2時間前までしか選択不可
   */
  const generateStartTimeOptions = () => {
    if (!slotLesson) return '';

    const lessonStart = slotLesson.firstStart || '09:00';
    const lessonEnd = slotLesson.secondEnd || slotLesson.firstEnd || '18:00';
    const firstEnd = slotLesson.firstEnd || '';
    const secondStart = slotLesson.secondStart || '';
    const classroomType = slotLesson.classroomType || '';
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
      // 休憩時間中（firstEnd <= t < secondStart）は除外
      if (isDualSession && m >= breakStartMin && m < breakEndMin) {
        continue;
      }
      const h = Math.floor(m / 60);
      const mm = m % 60;
      const t = `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      const selected = t === startTime ? 'selected' : '';
      options.push(`<option value="${t}" ${selected}>${t}</option>`);
    }
    return options.join('');
  };

  /**
   * 終了時間オプションを生成
   * - 実質2時間以上の作業時間が確保できる終了時刻のみ表示
   * - 休憩をまたぐ場合は休憩時間を差し引いて計算
   * - 2部制の場合は休憩時間（firstEnd〜secondStart）を終了時刻として選択不可
   */
  const generateEndTimeOptions = () => {
    if (!slotLesson || !startTime) return '';

    const lessonEnd = slotLesson.secondEnd || slotLesson.firstEnd || '18:00';
    const firstEnd = slotLesson.firstEnd || '';
    const secondStart = slotLesson.secondStart || '';
    const classroomType = slotLesson.classroomType || '';
    const isDualSession = classroomType.includes('2部制');

    const [stH, stM] = startTime.split(':').map(Number);
    const [eH, eM] = lessonEnd.split(':').map(Number);
    const startMin = stH * 60 + stM;
    const maxEndMin = eH * 60 + eM;

    // 休憩時間の計算（2部制の場合）
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

    /**
     * 開始時刻から終了時刻までの実質作業時間を計算
     * @param {number} endMin - 終了時刻（分）
     * @returns {number} 実質作業時間（分）
     */
    const calculateActualWorkMinutes = endMin => {
      const totalMinutes = endMin - startMin;
      // 休憩をまたぐ場合は休憩時間を差し引く
      if (isDualSession && startMin < breakStartMin && endMin > breakEndMin) {
        return totalMinutes - breakDuration;
      }
      return totalMinutes;
    };

    const options = [];
    // 開始時刻の30分後から検索（最低単位）
    for (let m = startMin + 30; m <= maxEndMin; m += 30) {
      // 2部制の場合の禁止ルール:
      // 「休憩中(firstEnd) < t <= 2部開始(secondStart)」は選択不可
      if (isDualSession && m > breakStartMin && m <= breakEndMin) {
        continue;
      }

      // 実質2時間以上の作業時間が確保できるかチェック
      const actualWork = calculateActualWorkMinutes(m);
      if (actualWork < MIN_DURATION) {
        continue;
      }

      const h = Math.floor(m / 60);
      const mm = m % 60;
      const t = `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      const selected = t === endTime ? 'selected' : '';
      options.push(`<option value="${t}" ${selected}>${t}</option>`);
    }
    return options.join('');
  };

  // --- 統合スロットコンテナ：選択ビュー と リストビュー を切り替え ---
  const slotContentHtml = (() => {
    if (isSkipped) {
      return `
        <div class="slot-content-inner bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
          <p class="text-gray-400 text-sm mb-2">予約スロット</p>
          <p class="text-xl font-bold text-gray-500 mb-4">未定</p>
          <p class="text-sm text-gray-400">あとで予約してください</p>
        </div>
      `;
    } else if (existingReservation && !selectedLesson && !recommendedLesson) {
      const formattedDate = window.formatDate
        ? window.formatDate(existingReservation.date)
        : existingReservation.date;
      return `
        <div class="slot-content-inner bg-green-50 border-2 border-green-500 rounded-xl p-6 text-center">
          <p class="text-green-600 text-sm font-bold mb-2">予約 済み ✓</p>
          <p class="text-xl font-bold text-brand-text mb-1">${formattedDate}</p>
          <p class="text-sm text-brand-subtle">${escapeHTML(existingReservation.classroom)} ${existingReservation.venue ? escapeHTML(existingReservation.venue) : ''}</p>
          ${existingReservation.startTime ? `<p class="text-sm text-brand-subtle mt-1">${existingReservation.startTime} 〜 ${existingReservation.endTime || ''}</p>` : ''}
        </div>
      `;
    } else if (slotLesson) {
      const formattedDate = window.formatDate
        ? window.formatDate(slotLesson.date)
        : String(slotLesson.date);
      const venueText = `${escapeHTML(slotLesson.classroom)} ${slotLesson.venue ? escapeHTML(slotLesson.venue) : ''}`;
      const isSelected = Boolean(selectedLesson);
      const statusText = isWaitlist
        ? '空き通知 希望'
        : isSelected
          ? 'この日程で予約'
          : 'きょう と にた にってい';
      const borderColor = isWaitlist
        ? 'border-yellow-500'
        : 'border-action-primary-bg';
      const bgColor = isWaitlist ? 'bg-yellow-50' : 'bg-action-secondary-bg';
      const statusColor = isWaitlist
        ? 'text-yellow-700'
        : 'text-action-primary-bg';

      const timeSelectionHtml = isTimeBased
        ? `
          <div class="mt-4 pt-4 border-t border-dashed border-gray-300">
            <div class="flex items-center justify-center space-x-2">
              <select id="conclusion-next-start-time"
                      class="px-3 py-2 border-2 border-gray-300 rounded-lg font-bold text-lg text-center bg-white focus:border-action-primary-bg">
                ${generateStartTimeOptions()}
              </select>
              <span class="font-bold text-gray-400">〜</span>
              <select id="conclusion-next-end-time"
                      class="px-3 py-2 border-2 border-gray-300 rounded-lg font-bold text-lg text-center bg-white focus:border-action-primary-bg">
                ${generateEndTimeOptions()}
              </select>
            </div>
            <p class="text-xs text-gray-400 text-center mt-2">※最低2時間</p>
          </div>
        `
        : '';

      return `
        <div class="slot-content-inner ${bgColor} border-2 ${borderColor} rounded-xl overflow-hidden shadow-sm">
          <div class="p-5 text-center">
            <p class="text-xs font-bold ${statusColor} mb-2 uppercase tracking-wider">${statusText}</p>
            <h3 class="text-2xl font-bold text-brand-text mb-1">${formattedDate}</h3>
            <p class="text-sm text-brand-subtle font-medium">${venueText}</p>
            ${timeSelectionHtml}
          </div>
        </div>
      `;
    } else {
      return `
        <div class="slot-content-inner bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
          <p class="text-gray-400 text-sm mb-2">予約スロット</p>
          <p class="text-lg font-bold text-gray-500 mb-2">おすすめ日程がありません</p>
          <p class="text-sm text-gray-400">下のボタンから日程を選んでください</p>
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
      ? `<p class="text-center text-gray-500 py-4">予約可能な日程がありません</p>`
      : Object.entries(groupedLessons)
          .map(([month, lessons]) => {
            const cardsHtml = lessons
              .map(lesson => {
                const formattedDate = window.formatDate
                  ? window.formatDate(lesson.date)
                  : String(lesson.date);
                const slots = lesson.firstSlots || 0;
                const isFullyBooked = slots <= 0;
                const isRecommended =
                  recommendedLesson?.lessonId === lesson.lessonId;
                const classroomColor = getClassroomColorClass(lesson.classroom);

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
                      </div>
                      <span class="text-xs text-yellow-600 font-bold">キャンセル待ち</span>
                    </div>
                  </button>
                `;
                }

                return `
                <button type="button"
                        class="w-full text-left p-3 mb-2 bg-white border-2 border-gray-200 rounded-lg hover:border-action-primary-bg hover:shadow-sm"
                        data-action="selectLessonForConclusion"
                        data-lesson-id="${escapeHTML(lesson.lessonId)}">
                  <div class="flex justify-between items-center">
                    <div>
                      ${filterClassroom === 'all' ? `<span class="text-xs px-1 rounded border ${classroomColor} mr-1">${lesson.classroom}</span>` : ''}
                      <span class="font-bold">${formattedDate}</span>
                      ${isRecommended ? '<span class="ml-1 text-xs text-yellow-500">★おすすめ</span>' : ''}
                    </div>
                    <span class="text-sm text-action-primary-bg font-bold">空き${slots}</span>
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
  const filterHtml = `
    <div class="flex justify-center mb-4 bg-gray-100 p-1 rounded-full">
      <button type="button"
              class="flex-1 py-1 px-2 text-xs font-bold rounded-full ${filterClassroom === 'current' ? activeClass : inactiveClass}"
              data-action="setFilterClassroom"
              data-filter="current">
        今の教室
      </button>
      <button type="button"
              class="flex-1 py-1 px-2 text-xs font-bold rounded-full ${filterClassroom === 'all' ? activeClass : inactiveClass}"
              data-action="setFilterClassroom"
              data-filter="all">
        すべて
      </button>
    </div>
  `;

  // リストビュー (スロット内に表示)
  const lessonListViewHtml = `
    <div class="slot-list-view bg-white border-2 border-gray-200 rounded-xl p-4 shadow-sm ${isExpanded ? '' : 'hidden'}">
      <div class="flex items-center justify-between mb-4">
        <h4 class="font-bold text-gray-700">べつの にってい</h4>
        <button type="button" class="text-sm text-action-primary-bg font-bold" data-action="expandLessonList">✕ とじる</button>
      </div>
      ${filterHtml}
      <div class="max-h-64 overflow-y-auto">
        ${lessonListHtml}
      </div>
    </div>
  `;

  // 統合スロットコンテナ
  const unifiedSlotHtml = `
    <div class="slot-container mb-6">
      <div class="slot-content ${isExpanded ? 'hidden' : ''}">${slotContentHtml}</div>
      ${lessonListViewHtml}
    </div>
  `;

  // --- アクションボタン ---
  const canProceed = slotLesson || isSkipped;
  const proceedButtonHtml = canProceed
    ? Components.button({
        action: isSkipped ? 'conclusionNextStep' : 'confirmRecommendedLesson',
        text: 'これで すすむ！',
        style: 'primary',
        size: 'full',
        customClass: 'text-lg py-4 shadow-md font-bold mb-3',
        dataAttributes: isSkipped
          ? { 'target-step': STEPS.ACCOUNTING }
          : { 'lesson-id': slotLesson?.lessonId || '' },
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

  // --- 戻るボタン ---
  const backButtonHtml = Components.button({
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
