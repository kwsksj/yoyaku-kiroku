/**
 * =================================================================
 * ファイル概要
 * -----------------------------------------------------------------
 * 名称: 13_WebApp_Views_Booking.js
 * 目的: よやく枠一覧やよやくフォームなどよやく領域のビュー生成を担当する
 * 主な責務:
 *   - 教室単位のレッスンデータからビュー用HTMLを構築
 *   - 初心者モード切り替えや販売チェックリストなどの補助UIを提供
 *   - よやくフォームで必要なデータ整形ユーティリティを提供
 * AI向けメモ:
 *   - 新しいよやく関連ビューは`Components`を活用しつつここに追加し、必要なデータ取得ロジックはCore層から参照する
 * =================================================================
 */

// ================================================================
// UI系モジュール
// ================================================================
import { Components } from './13_WebApp_Components.js';
import {
  getClassroomColorClass,
  renderClassroomVenueBadges,
} from './13_WebApp_Views_Utils.js';

// ================================================================
// ユーティリティ系モジュール
// ================================================================
import { isTimeBasedClassroom } from './12_WebApp_Core_Data.js';
import { findReservationByDateAndClassroom } from './12_WebApp_Core_Search.js';
import { buildSalesChecklist } from './14_WebApp_Handlers_Utils.js';

const bookingStateManager = appWindow.stateManager;

/**
 * スロット数を数値に整える
 * @param {number|string|null|undefined} value
 * @returns {number}
 */
const normalizeSlotValue = value => {
  if (value === null || typeof value === 'undefined') {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * 開室時間の表示文字列を生成します。
 * @param {Pick<LessonCore, 'firstStart' | 'firstEnd' | 'secondStart' | 'secondEnd' | 'startTime' | 'endTime'>} lesson
 * @returns {string}
 */
const buildOpeningHoursText = lesson => {
  const primaryStart = lesson.firstStart || lesson.startTime || '';
  const primaryEnd = lesson.firstEnd || lesson.endTime || '';
  if (!primaryStart || !primaryEnd) {
    return '';
  }
  if (lesson.secondStart && lesson.secondEnd) {
    return `${primaryStart}~${primaryEnd} / ${lesson.secondStart}~${lesson.secondEnd}`;
  }
  return `${primaryStart}~${primaryEnd}`;
};

/**
 * 時刻文字列（HH:mm）を分に変換します。
 * @param {string | undefined} timeStr
 * @returns {number | null}
 */
const parseTimeToMinutes = timeStr => {
  if (!timeStr) return null;
  const [hourStr, minuteStr] = timeStr.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr || '0');
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
};

/**
 * 夜教室判定（開始時刻が夕方以降）
 * @param {Pick<LessonCore, 'firstStart' | 'secondStart' | 'startTime'>} lesson
 * @returns {boolean}
 */
const isNightLesson = lesson => {
  const startTime =
    lesson.firstStart || lesson.startTime || lesson.secondStart || '';
  const startMinutes = parseTimeToMinutes(startTime);
  return startMinutes !== null && startMinutes >= 17 * 60;
};

/**
 * lessonオブジェクトから正規化されたスロット数を取得します。
 * @param {LessonCore} lesson
 * @returns {{ hasSecondSlots: boolean; firstSlotsCount: number; secondSlotsCount: number; beginnerSlotsCount: number; beginnerCapacityCount: number; }}
 */
const getNormalizedSlotCounts = lesson => {
  const hasSecondSlots = typeof lesson.secondSlots !== 'undefined';
  return {
    hasSecondSlots,
    firstSlotsCount: normalizeSlotValue(lesson.firstSlots),
    secondSlotsCount: hasSecondSlots
      ? normalizeSlotValue(lesson.secondSlots)
      : 0,
    beginnerSlotsCount: normalizeSlotValue(lesson.beginnerSlots),
    beginnerCapacityCount: normalizeSlotValue(lesson.beginnerCapacity),
  };
};

const resolveEffectiveBeginnerMode = () => {
  const getter = /** @type {any} */ (
    bookingStateManager['getEffectiveBeginnerMode']
  );
  if (typeof getter === 'function') {
    return Boolean(getter.call(bookingStateManager));
  }
  return bookingStateManager.getState().isFirstTimeBooking;
};

/**
 * グローバルに公開する初心者モード選択ハンドラ
 * @param {boolean} isBeginner - true: はじめて, false: 経験者
 */
window.handleBeginnerModeSelect = function (isBeginner) {
  debugLog('🎚️ handleBeginnerModeSelect called:', { isBeginner });
  bookingStateManager.setBeginnerModeOverride(isBeginner);
};

/**
 * 初心者モード選択ボタングループのHTMLを生成
 * 自動判定で初回者の場合のみ表示（ピル型トグルスイッチ形式）
 * @returns {string} HTML文字列
 */
const renderBeginnerModeToggle = () => {
  const auto = bookingStateManager.getState().isFirstTimeBooking;

  // 経験者の場合は何も表示しない
  if (!auto) {
    return '';
  }

  const override =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('beginnerModeOverride')
      : null;
  // 初期値は「初回」。ユーザーが明示的に変更した場合のみoverride値を使用
  const selectedValue = override !== null ? override : 'true';

  debugLog('🎚️ BeginnerModeToggle:', {
    auto,
    override,
    selectedValue,
  });

  return `
      <p class="text-sm font-bold text-gray-500 mb-2 border-l-2 border-gray-300 pl-2">参加枠</p>
      <div class="flex justify-center mb-6">
        ${Components.pillToggle({
          options: [
            {
              value: 'true',
              label: '初回',
              onclick: 'window.handleBeginnerModeSelect(true)',
            },
            {
              value: 'false',
              label: '２回目以降',
              onclick: 'window.handleBeginnerModeSelect(false)',
            },
          ],
          selectedValue: selectedValue,
          className: 'max-w-xs w-full',
        })}
      </div>
    `;
};
/**
 * 教室選択ピル型トグルを生成
 * @param {string} selectedClassroom - 現在選択されている教室（'all'で全教室）
 * @returns {string} HTML文字列
 */
const renderClassroomToggle = selectedClassroom => {
  const classrooms = Object.values(CONSTANTS.CLASSROOMS || {});
  if (!classrooms.length) return '';

  // 表示順を定義（DesignConfigで一元管理）
  const desiredOrder = DesignConfig.classroomOrder || [
    '東京教室',
    'つくば教室',
    '沼津教室',
  ];
  const sortedClassrooms = [...classrooms].sort((a, b) => {
    const indexA = desiredOrder.indexOf(a);
    const indexB = desiredOrder.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  // ボタン表示用に「教室」を除去
  /** @param {string} name */
  const formatClassroomName = name => name.replace('教室', '');

  // pillToggle用のオプション配列を生成
  /** @type {Array<{value: string, label: string, action: string, dataAttributes: Record<string, string>}>} */
  const options = [
    ...sortedClassrooms.map(c => ({
      value: c,
      label: formatClassroomName(c),
      action: 'filterBookingClassroom',
      dataAttributes: { 'data-classroom': c },
    })),
    {
      value: 'all',
      label: 'すべて',
      action: 'filterBookingClassroom',
      dataAttributes: { 'data-classroom': 'all' },
    },
  ];

  return `
    <div class="mb-4">
      <p class="text-sm font-bold text-gray-500 mb-2 border-l-2 border-gray-300 pl-2">教室</p>
      ${Components.pillToggle({
        options,
        selectedValue: selectedClassroom,
        size: 'normal',
      })}
    </div>
  `;
};

/**
 * よやく枠一覧画面のUIを生成します（全教室対応）
 * @param {string} classroom - 教室名（'all'で全教室表示）
 * @returns {string} HTML文字列
 */
export const getBookingView = classroom => {
  const currentState = bookingStateManager.getState();
  const selectedClassroom = classroom || 'all';

  // レッスンをフィルタリング
  const allLessons =
    currentState.lessons && Array.isArray(currentState.lessons)
      ? currentState.lessons
      : [];

  const relevantLessons =
    selectedClassroom === 'all'
      ? allLessons
      : allLessons.filter(
          (/** @type {LessonCore} */ lesson) =>
            lesson.classroom === selectedClassroom,
        );

  debugLog('🏫 getBookingView:', {
    classroom: selectedClassroom,
    totalLessons: allLessons.length,
    relevantLessons: relevantLessons.length,
    override: localStorage.getItem('beginnerModeOverride'),
    isChangingDate: currentState['isChangingReservationDate'],
  });

  // 日程変更モードの場合はタイトルを変更
  const isChangingDate = currentState['isChangingReservationDate'];
  const pageTitle = isChangingDate ? 'よやく日の変更' : 'にってい いちらん';

  // 日程変更モード時は教室フィルターを非表示
  const classroomToggleHtml = isChangingDate
    ? ''
    : renderClassroomToggle(selectedClassroom);

  const bookingLessonsHtml = renderBookingLessons(
    relevantLessons,
    selectedClassroom,
  );

  if (!bookingLessonsHtml) {
    return `
      ${Components.pageHeader({ title: pageTitle, backAction: 'smartGoBack' })}
      ${Components.pageContainer({
        maxWidth: 'md',
        content: `
          ${classroomToggleHtml}
          ${renderBeginnerModeToggle()}
          <div class="text-center py-4">
            <p class="${DesignConfig.colors.textSubtle} mb-6">現在、よやく可能な日がありません。</p>
            <div class="mt-6 p-4 bg-ui-surface border-2 border-ui-border ${DesignConfig.borderRadius.container} text-center">
            <p class="${DesignConfig.text.caption} mb-3">
              今後の教室日程のメール連絡登録は、プロフィール編集でおこなえます！
            </p>
            ${Components.button({
              text: 'プロフィール編集',
              action: 'showEditProfile',
              style: 'secondary',
              size: 'normal',
            })}
          </div>
          <div class="mt-4">
            ${Components.button({
              text: 'ホームへもどる',
              action: 'goToDashboard',
              style: 'secondary',
              size: 'normal',
            })}
          </div>
        `,
      })}
    `;
  } else {
    return `
      ${Components.pageHeader({ title: pageTitle, backAction: 'smartGoBack' })}
      ${Components.pageContainer({
        maxWidth: 'md',
        content: `
              ${classroomToggleHtml}
              ${renderBeginnerModeToggle()}
              <div class="${DesignConfig.cards.container}">${bookingLessonsHtml}</div>

              <div class="mt-6 p-4 bg-ui-surface border-2 border-ui-border ${DesignConfig.borderRadius.container} text-center">
                <p class="${DesignConfig.text.caption} mb-3">
                  今後の教室日程のメール連絡登録は、プロフィール編集でおこなえます！
                </p>
                ${Components.button({
                  text: 'プロフィール編集',
                  action: 'showEditProfile',
                  style: 'secondary',
                  size: 'normal',
                })}
              </div>
              <div class="mt-4 text-center">
                ${Components.button({
                  text: 'ホームへもどる',
                  action: 'goToDashboard',
                  style: 'secondary',
                  size: 'normal',
                })}
              </div>
        `,
      })}
    `;
  }
};

/**
 * よやくの詳細入力・編集画面のUIを生成します。
 * state.currentReservationFormContext からデータを取得して描画します。
 * @returns {string} HTML文字列
 */
export const getReservationFormView = () => {
  const { currentUser, accountingMaster, currentReservationFormContext } =
    bookingStateManager.getState();
  const isBeginnerMode = resolveEffectiveBeginnerMode();

  if (!currentReservationFormContext) {
    // リカバリーオプションを提供するエラービュー
    return `
      ${Components.pageHeader({ title: 'エラー', backAction: 'smartGoBack' })}
      ${Components.pageContainer({
        maxWidth: 'md',
        content: `
          ${Components.cardContainer({
            variant: 'default',
            padding: 'spacious',
            content: `
              <div class="text-center py-6">
                <p class="text-4xl mb-4">⚠️</p>
                <p class="text-lg font-bold text-brand-text mb-2">よやくフォームのデータが見つかりません</p>
                <p class="text-sm text-brand-subtle mb-6">操作の途中でエラーが発生したか、セッションが切れた可能性があります。</p>
              </div>
            `,
          })}

          <div class="mt-6 flex flex-col space-y-3">
            ${Components.button({
              text: 'ホームへもどる',
              action: 'goToDashboard',
              style: 'primary',
              size: 'full',
            })}
            ${Components.button({
              text: 'ログアウトしてやりなおす',
              action: 'logoutAndRestart',
              style: 'secondary',
              size: 'full',
            })}
          </div>
        `,
      })}
    `;
  }

  const { lessonInfo, reservationInfo, source } = currentReservationFormContext;
  const isEdit = !!reservationInfo.reservationId;

  // lessonInfoは既にLessonCore型（統一済み）
  const { classroom, date, venue, classroomType, beginnerStart } = lessonInfo;
  const {
    firstLecture,
    chiselRental,
    materialInfo,
    order,
    startTime,
    endTime,
  } = reservationInfo;
  const isFirstTime = isEdit ? firstLecture : isBeginnerMode;
  const isWaiting = reservationInfo.status === CONSTANTS.STATUS.WAITLISTED;

  const isTimeBased = isTimeBasedClassroom(lessonInfo);
  const {
    hasSecondSlots,
    firstSlotsCount,
    secondSlotsCount,
    beginnerSlotsCount,
    beginnerCapacityCount,
  } = getNormalizedSlotCounts(lessonInfo);

  // 満席判定
  const isFull = hasSecondSlots
    ? firstSlotsCount === 0 && secondSlotsCount === 0
    : firstSlotsCount === 0;
  const isBeginnerSlotFull = beginnerSlotsCount === 0;

  // よやく日変更モードかどうかを判定
  const isChangingDate = String(source) === 'dateChange';

  const title = isChangingDate
    ? '新しい日程の よやく詳細'
    : isEdit
      ? 'よやく内容 の へんしゅう'
      : isFull || (isBeginnerMode && isBeginnerSlotFull)
        ? '空き通知 希望'
        : 'よやく詳細 にゅうりょく';
  const submitAction = isChangingDate
    ? 'confirmDateChange'
    : isEdit
      ? 'updateReservation'
      : 'confirmBooking';
  const submitButtonText = isChangingDate
    ? 'この日程に へんこう する'
    : isEdit
      ? 'この内容で こうしん する'
      : isFull
        ? '空き通知 とうろく'
        : 'この内容で よやく する';

  const backAction = 'smartGoBack';

  const _renderStatusHtml = () => {
    if (isEdit) {
      return isWaiting ? '空き通知希望' : 'よやく済み';
    }
    if (isBeginnerMode) {
      return isBeginnerSlotFull
        ? '初回者枠 満席（空き通知希望）'
        : `初回者枠 空き ${beginnerSlotsCount}`;
    }
    if (isFull) return '満席（空き通知希望）';
    if (hasSecondSlots) {
      const morningLabel = CONSTANTS.TIME_SLOTS.MORNING || '午前';
      const afternoonLabel = CONSTANTS.TIME_SLOTS.AFTERNOON || '午後';
      return `空き ${morningLabel} ${firstSlotsCount} | ${afternoonLabel} ${secondSlotsCount}`;
    }
    return `空き ${firstSlotsCount}`;
  };

  const _renderTuitionDisplaySection = () => {
    if (isTimeBased) {
      const basicTuitionRule = accountingMaster.find(
        (/** @type {AccountingMasterItemCore} */ item) =>
          item['item'] === CONSTANTS.ITEMS.MAIN_LECTURE &&
          item['classroom']?.includes(classroom),
      );
      if (basicTuitionRule) {
        const basicTuitionPrice = Number(basicTuitionRule['price'] ?? 0);
        return Components.priceDisplay({
          amount: basicTuitionPrice,
          label: `${CONSTANTS.ITEMS.MAIN_LECTURE} / 30分`,
          style: 'highlight',
        });
      }
    } else {
      const targetItemName = isBeginnerMode
        ? CONSTANTS.ITEMS.FIRST_LECTURE
        : CONSTANTS.ITEMS.MAIN_LECTURE;
      const tuitionItem = accountingMaster.find(
        (/** @type {AccountingMasterItemCore} */ item) =>
          item['type'] === CONSTANTS.ITEM_TYPES.TUITION &&
          item['item'] === targetItemName &&
          (item['classroom'] === '共通' ||
            item['classroom']?.includes(classroom)),
      );
      if (tuitionItem) {
        const tuitionPrice = Number(tuitionItem['price'] ?? 0);
        return Components.priceDisplay({
          amount: tuitionPrice,
          label: targetItemName,
          style: isBeginnerMode ? 'highlight' : 'default',
        });
      }
    }
    return '';
  };

  const _renderTimeOptionsSection = () => {
    // セッション制教室の場合、隠し入力として時刻を設定
    if (!isTimeBased) {
      if (!lessonInfo.firstStart || !lessonInfo.firstEnd) {
        return `<div class="text-ui-error-text p-4 bg-ui-error-bg ${DesignConfig.borderRadius.container}">エラー: この教室の時間設定が不正です</div>`;
      }
      return `
        <input type="hidden" id="res-start-time" value="${lessonInfo.firstStart}" />
        <input type="hidden" id="res-end-time" value="${lessonInfo.firstEnd}" />
      `;
    }

    if (!lessonInfo.firstStart || !lessonInfo.firstEnd) {
      return `<div class="text-ui-error-text p-4 bg-ui-error-bg ${DesignConfig.borderRadius.container}">エラー: この教室の時間設定が不正です</div>`;
    }

    // --- 時間生成ヘルパー関数 ---
    /**
     * 時間リストを生成
     * @param {string} start "HH:MM"
     * @param {string} end "HH:MM"
     * @param {number} minDurationMinutes 最低利用時間（分）- 開始時間リスト生成時は「終了時刻の何分前まで選べるか」に使用
     * @returns {string[]} "HH:MM"の配列
     */
    const generateTimeSlots = (start, end, minDurationMinutes = 0) => {
      const slots = [];
      const [sH, sM] = start.split(':').map(Number);
      const [eH, eM] = end.split(':').map(Number);

      let currentMin = sH * 60 + sM;
      const endMin = eH * 60 + eM;
      // limitMin: 最終終了時刻から最低利用時間を引いた時刻
      const limitMin = endMin - minDurationMinutes;

      while (currentMin <= limitMin) {
        const h = Math.floor(currentMin / 60);
        const m = currentMin % 60;
        slots.push(
          `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
        );
        currentMin += CONSTANTS.FRONTEND_UI.TIME_SETTINGS.STEP_MINUTES;
      }
      return slots;
    };

    // --- 選択肢生成ロジック ---
    const MIN_DURATION = 120; // 最低2時間
    let startTimeOptionsHtml = '';

    // 初回講習の固定時間ロジック
    let fixedStartTime = startTime;
    let isTimeFixed = false;
    const isFirstTime = isEdit ? firstLecture : isBeginnerMode;

    if (isFirstTime && beginnerStart && beginnerCapacityCount > 0) {
      fixedStartTime = beginnerStart;
      isTimeFixed = true;
      startTimeOptionsHtml = `<option value="${fixedStartTime}" selected>${fixedStartTime}</option>`;
    } else {
      // 経験者（または初回固定枠なし）: 自由選択
      const isDual = classroomType === CONSTANTS.CLASSROOM_TYPES.TIME_DUAL;
      /** @type {string[]} */
      let validStartTimes = [];

      if (!isDual) {
        // 全日: firstStart 〜 firstEnd (MIN_DURATION考慮)
        validStartTimes = generateTimeSlots(
          lessonInfo.firstStart,
          lessonInfo.firstEnd,
          MIN_DURATION,
        );
      } else {
        // 2部制: 休憩またぎ許可。開始可能な時間は「休憩中」を除く
        // 全体の開始可能範囲: firstStart 〜 secondEnd (MIN_DURATION考慮)
        // ただし generateTimeSlots は単純な範囲生成なので、まずは全体範囲（あるいは部ごとの範囲）を考える
        // ここでは「1部開始〜1部終了前」と「2部開始〜2部終了(MIN_DURATION考慮)」の2ブロックを生成し連結するアプローチが安全かつ確実

        const s2End = lessonInfo.secondEnd || lessonInfo.firstEnd; // 安全策

        // 1. 第1部ブロック: firstStart 〜 (firstEnd - 30m)
        // ただし、もし休憩またぎで第2部終了まで使えるなら、第1部の開始リミットは「firstEnd - 30m」ではない。
        // リミットはあくまで「全体の終了時間(secondEnd) - 2h」である。

        // なので方針転換: 全体範囲をループで回し、NGな時間を除外する
        const [fsH, fsM] = lessonInfo.firstStart.split(':').map(Number);
        const [seH, seM] = s2End.split(':').map(Number);
        const [feH, feM] = lessonInfo.firstEnd.split(':').map(Number);
        // secondStartは必須
        const [ssH, ssM] = (lessonInfo.secondStart || '99:99')
          .split(':')
          .map(Number);

        let currentMin = fsH * 60 + fsM;
        const limitMin = seH * 60 + seM - MIN_DURATION; // 全体の最終リミット

        const firstEndMin = feH * 60 + feM;
        const secondStartMin = ssH * 60 + ssM;

        while (currentMin <= limitMin) {
          // 禁止ルール: 「1部終了時刻(firstEnd) と 休憩中(firstEnd < t < secondStart)」は選択不可
          // つまり t >= firstEnd && t < secondStart はNG
          if (currentMin >= firstEndMin && currentMin < secondStartMin) {
            // スキップ
          } else {
            const h = Math.floor(currentMin / 60);
            const m = currentMin % 60;
            validStartTimes.push(
              `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
            );
          }
          currentMin += CONSTANTS.FRONTEND_UI.TIME_SETTINGS.STEP_MINUTES;
        }
      }

      startTimeOptionsHtml = validStartTimes
        .map(t => {
          const selected = t === startTime ? 'selected' : '';
          return `<option value="${t}" ${selected}>${t}</option>`;
        })
        .join('');
    }

    // 終了時間はJSで制御するため初期は空（または現在値）
    const endTimeOptionsHtml = endTime
      ? `<option value="${endTime}" selected>${endTime}</option>`
      : '';

    const timeFixedMessage = isTimeFixed
      ? `<p class="${/** @type {any} */ (DesignConfig.text).caption} mb-2">初回の方は ${fixedStartTime} より開始です。</p>`
      : '';

    // 会計画面と同じスタイル
    const timeSelectClass = `w-full px-3 py-2.5 text-base text-center border-2 border-ui-border ${DesignConfig.borderRadius.button} focus:outline-none focus:ring-2 focus:ring-brand-text bg-ui-input focus:bg-ui-input-focus mobile-input touch-friendly font-bold`;

    return `
        <div class="mt-4 pt-4 border-t-2">
          <h4 class="font-bold ${DesignConfig.colors.text} mb-2">よやく時間</h4>
          ${timeFixedMessage}
          <div class="flex items-center space-x-2 mb-2">
            <div class="flex-1">
              <label class="block text-sm font-bold mb-1">開始予定</label>
              <select id="res-start-time" class="${timeSelectClass}">
                ${startTimeOptionsHtml}
              </select>
            </div>
            <span class="pt-6 font-bold">~</span>
            <div class="flex-1">
              <label class="block text-sm font-bold mb-1">終了予定</label>
              <select id="res-end-time" class="${timeSelectClass}">
                ${endTimeOptionsHtml}
              </select>
            </div>
          </div>
          <p class="text-sm text-gray-500 text-right">※最低2時間からよやく可能です</p>
        </div>`;
  };

  const _renderBookingOptionsSection = () => {
    // 初回講習チェックボックスは廃止 - 基本情報欄にバッジで表示
    // 彫刻刀レンタルのみ表示（全教室タイプ共通）

    // 料金をマスタから取得
    const rentalItem =
      accountingMaster &&
      accountingMaster.find(
        (/** @type {AccountingMasterItemCore} */ item) =>
          item['item'] === CONSTANTS.ITEMS.CHISEL_RENTAL &&
          (item['classroom'] === '共通' ||
            item['classroom']?.includes(classroom)),
      );
    const rentalPrice = rentalItem ? Number(rentalItem['price']) : 500;

    /** @type {CheckboxConfig} */
    const rentalCheckboxConfig = {
      id: 'option-rental',
      label: `${CONSTANTS.ITEMS.CHISEL_RENTAL} 1回 ${Components.priceDisplay({ amount: rentalPrice })}`,
      checked: chiselRental !== undefined ? chiselRental : false,
    };
    return `
      <div class="mt-4 pt-4 border-t-2">
        <span class="font-bold text-left mb-2">オプション</span>${Components.checkbox(rentalCheckboxConfig)}
      </div>`;
  };

  const _renderPlanSection = () => {
    // nextLessonGoalはcurrentUserから取得（生徒名簿の継続的な目標）
    const nextLessonGoal = currentUser?.['nextLessonGoal'] || '';

    // 初回講習の値を隠しフィールドで保持（新規よやく時: isBeginnerMode、編集時: reservationInfo.firstLecture）
    const firstLectureValue = isEdit ? firstLecture || false : isBeginnerMode;
    const hiddenFirstLectureInput = `<input type="hidden" id="hidden-first-lecture" value="${firstLectureValue}" />`;

    return `
        ${hiddenFirstLectureInput}
        <h4 class="font-bold text-left mb-2">けいかく・もくひょう</h4>
        ${Components.textarea({
          id: 'wip-input',
          label: '',
          placeholder:
            'つくりたいもの、さぎょうよてい、けいかく、もくひょう など メモしましょう',
          value: nextLessonGoal,
          rows: 5,
          caption: '「みんな の よやく・きろく」にも のります。',
        })}`;
  };

  const _renderSalesAndContactSection = () => {
    const salesChecklistHtml =
      typeof buildSalesChecklist === 'function'
        ? buildSalesChecklist(accountingMaster)
        : '';
    return `
        <!-- 購入品セクション全体を折りたたみ -->
        <details>
          ${Components.sectionHeader({ title: '購入品 の きぼう', asSummary: true })}
          <div class="pt-4 space-y-4">
            <p class="text-sm text-brand-subtle">※在庫がない場合もあります</p>
            ${Components.textarea({ id: 'material-input', label: '材料 の きぼう', placeholder: '例：「30×30×40mmくらい」「高さが6cmくらい」「たまごぐらい」 など', value: materialInfo || '' })}
            ${salesChecklistHtml}
            ${Components.textarea({ id: 'order-input', label: 'その他購入 の きぼう', placeholder: '（任意）', value: order || '' })}
          </div>
        </details>`;
  };

  const _getSelectedSalesOrder = () =>
    Array.from(document.querySelectorAll('input[name="orderSales"]:checked'))
      .map(element => /** @type {HTMLInputElement} */ (element).value)
      .join(', ');

  setTimeout(() => {
    // 終了時間の動的制御（最低2時間ルール & セッション境界考慮）
    const startSelect = /** @type {HTMLSelectElement} */ (
      document.getElementById('res-start-time')
    );
    const endSelect = /** @type {HTMLSelectElement} */ (
      document.getElementById('res-end-time')
    );

    if (startSelect && endSelect) {
      const updateEndTimeOptions = () => {
        const startTimeVal = startSelect.value;
        if (!startTimeVal) return;

        // 現在の終了時間（選択がある場合維持を試みる）
        const currentEndTimeVal = endSelect.value;

        const isDual = classroomType === CONSTANTS.CLASSROOM_TYPES.TIME_DUAL;
        const [sH, sM] = startTimeVal.split(':').map(Number);
        const startTotalM = sH * 60 + sM;
        const MIN_DURATION = 120; // 最低2時間

        // セッション境界の取得
        let fEndM = 0;
        let sStartM = 9999;
        let sEndM = 0;

        if (lessonInfo.firstEnd) {
          const [feh, fem] = lessonInfo.firstEnd.split(':').map(Number);
          fEndM = feh * 60 + fem;
        }

        if (isDual && lessonInfo.secondStart && lessonInfo.secondEnd) {
          const [sh, sm] = lessonInfo.secondStart.split(':').map(Number);
          sStartM = sh * 60 + sm;
          const [seh, sem] = lessonInfo.secondEnd.split(':').map(Number);
          sEndM = seh * 60 + sem;
        }

        // ターゲット終了時刻の決定
        // 休憩またぎOKなので、2部制なら第2部終了まで、全日なら第1部終了(firstEnd)まで
        let limitEndM = fEndM;
        if (isDual) {
          limitEndM = sEndM;
        }

        // 休憩時間（分）を計算
        const breakDuration = isDual ? sStartM - fEndM : 0;

        /**
         * 開始時刻から終了時刻までの実質作業時間を計算
         * @param {number} endM - 終了時刻（分）
         * @returns {number} 実質作業時間（分）
         */
        const calculateActualWorkMinutes = endM => {
          const totalMinutes = endM - startTotalM;
          // 休憩をまたぐ場合は休憩時間を差し引く
          if (isDual && startTotalM < fEndM && endM > sStartM) {
            return totalMinutes - breakDuration;
          }
          return totalMinutes;
        };

        // 終了時間の候補生成（実質2時間以上の作業時間を確保）
        /** @type {string[]} */
        const validEndTimes = [];

        // 開始時刻の30分後から検索
        let curr =
          startTotalM + CONSTANTS.FRONTEND_UI.TIME_SETTINGS.STEP_MINUTES;
        while (curr <= limitEndM) {
          let isExcluded = false;
          // 2部制の場合の禁止ルール:
          // 「休憩中(firstEnd) < t <= 2部開始(secondStart)」は選択不可
          // ※2部開始時刻ジャストも選択不可
          if (isDual) {
            if (curr > fEndM && curr <= sStartM) {
              isExcluded = true;
            }
          }

          // 実質2時間以上の作業時間が確保できるかチェック
          if (!isExcluded) {
            const actualWork = calculateActualWorkMinutes(curr);
            if (actualWork < MIN_DURATION) {
              isExcluded = true;
            }
          }

          if (!isExcluded) {
            const h = Math.floor(curr / 60);
            const m = curr % 60;
            validEndTimes.push(
              `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
            );
          }
          curr += CONSTANTS.FRONTEND_UI.TIME_SETTINGS.STEP_MINUTES;
        }

        // プルダウン再構築
        if (validEndTimes.length === 0) {
          endSelect.innerHTML =
            '<option value="">選択可能な時間がありません</option>';
        } else {
          const newOptionsHtml = validEndTimes
            .map(t => {
              const selected = t === currentEndTimeVal ? 'selected' : '';
              return `<option value="${t}" ${selected}>${t}</option>`;
            })
            .join('');
          endSelect.innerHTML = newOptionsHtml;

          // 値の整合性チェック
          if (currentEndTimeVal && !validEndTimes.includes(currentEndTimeVal)) {
            endSelect.value = validEndTimes[0];
          } else if (!currentEndTimeVal && validEndTimes.length > 0) {
            endSelect.value = validEndTimes[0];
          }
        }
      };

      startSelect.addEventListener('change', updateEndTimeOptions);
      // 初期化時にも実行
      // 初期レンダリング直後は endSelect は空（または一部）かもしれないので、
      // 必ず一度実行して正しいリストを作成する
      updateEndTimeOptions();
    }

    const submitBtn = document.querySelector(`[data-action="${submitAction}"]`);
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        const selectedOrder = _getSelectedSalesOrder();
        const orderInput = /** @type {HTMLTextAreaElement | null} */ (
          document.getElementById('order-input')
        );
        if (orderInput) {
          const freeText = orderInput.value.trim();
          orderInput.value = selectedOrder
            ? freeText
              ? `${selectedOrder}, ${freeText}`
              : selectedOrder
            : freeText;
        }
      });
    }
  }, 300);

  let buttonsHtml = Components.button({
    text: submitButtonText,
    action: submitAction,
    style: 'primary',
    size: 'full',
  });
  if (isEdit) {
    // キャンセルボタン
    buttonsHtml += Components.button({
      text: 'このよやくをキャンセルする',
      action: 'cancel',
      style: 'danger',
      size: 'full',
      dataAttributes: {
        reservationId: reservationInfo.reservationId || '',
        classroom: reservationInfo.classroom || '',
        date: reservationInfo.date ? String(reservationInfo.date) : '',
      },
    });
  }
  buttonsHtml += Components.button({
    text: 'もどる',
    action: backAction,
    style: 'secondary',
    size: 'full',
  });

  const _renderOpeningHoursHtml = () => {
    const openingHoursText = buildOpeningHoursText(lessonInfo);
    if (!openingHoursText) {
      return '<span class="text-ui-error-text text-sm">開室時間未設定</span>';
    }
    return openingHoursText;
  };

  const _renderOpeningHoursNoteHtml = () => {
    const captionClass =
      /** @type {any} */ (DesignConfig.text)?.caption ||
      'text-sm text-brand-subtle';
    const notes = [];
    if (isFirstTime) {
      const beginnerStartTime =
        beginnerStart || lessonInfo.firstStart || lessonInfo.startTime || '';
      if (beginnerStartTime) {
        notes.push(
          `<p class="${captionClass}">初回開始: ${beginnerStartTime}</p>`,
        );
      }
      notes.push(
        `<p class="${captionClass}">初回に参加しやすくなるように、開始時刻をずらしてあります。早く来て見学もOK</p>`,
      );
    }
    if (
      classroomType === CONSTANTS.CLASSROOM_TYPES.SESSION_BASED &&
      !isFirstTime
    ) {
      notes.push(`<p class="${captionClass}">時間内、出入り自由</p>`);
    }
    if (notes.length === 0) return '';
    return `<div class="mt-1 space-y-1">${notes.join('')}</div>`;
  };

  return `
      ${Components.pageHeader({ title: title, backAction: backAction })}
      <div class="space-y-6">
        <!-- 1. 計画・目標 -->
        ${Components.cardContainer({
          variant: 'default',
          padding: 'spacious',
          content: _renderPlanSection(),
        })}

        <!-- 2. よやく基本情報 -->
        ${Components.cardContainer({
          variant: 'default',
          padding: 'spacious',
          content: `
            <div class="space-y-2 text-left">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-bold w-20 flex-shrink-0">教室　　：</span>
                ${renderClassroomVenueBadges(classroom, venue)}
                ${(isEdit ? firstLecture : isBeginnerMode) ? Components.statusBadge({ type: 'beginner', text: '初回' }) : ''}
              </div>
              <div class="flex items-center justify-between gap-2">
                <p class="flex-1"><span class="font-bold w-20 inline-block">日付　　：</span> ${formatDate(String(date))}</p>
                ${
                  isEdit
                    ? `<button
                  class="px-3 text-sm rounded-lg ${DesignConfig.buttons.secondary}"
                  data-action="changeReservationDate"
                  data-reservation-id="${reservationInfo.reservationId || ''}"
                  data-classroom="${reservationInfo.classroom || ''}"
                >よやく日の変更</button>`
                    : ''
                }
              </div>
              <p><span class="font-bold w-20 inline-block">状況　　：</span> ${_renderStatusHtml()}</p>
              <div class="flex flex-wrap items-start"><span class="font-bold w-20 flex-shrink-0">開室時間：</span><span class="flex-1">${_renderOpeningHoursHtml()}${_renderOpeningHoursNoteHtml()}</span></div>
              ${_renderTuitionDisplaySection()}
              ${_renderTimeOptionsSection()}
              ${_renderBookingOptionsSection()}
            </div>
          `,
        })}

        <!-- 3. 販売品・連絡事項 -->
        ${Components.cardContainer({
          variant: 'default',
          padding: 'spacious',
          content: _renderSalesAndContactSection(),
        })}

        <!-- アクションボタン -->
        <div class="mt-8 flex flex-col space-y-3">
          ${buttonsHtml}
        </div>
      </div>`;
};

/**
 * よやくスロットのリストからHTMLを生成します。
 * この関数は getBookingView と getCompleteView で共有されます。
 * @param {LessonCore[]} lessons - 表示する講座情報の配列
 * @param {string} [selectedClassroom=''] - 選択中の教室（'all'または教室名）
 * @returns {string} HTML文字列
 */
/**
 * よやくスロットのリストからHTMLを生成します。
 * この関数は getBookingView と getCompleteView で共有されます。
 * @param {LessonCore[]} lessons - 表示する講座情報の配列
 * @param {string} [selectedClassroom=''] - 選択中の教室（'all'または教室名）
 * @param {Object} [options={}] - オプション設定
 * @param {ReservationCore[]} [options.reservations] - よやく情報の配列（指定がない場合はStoreから取得）
 * @param {Object} [options.actions] - アクション名のマップ
 * @param {string} [options.actions.book] - よやくアクション名
 * @param {string} [options.actions.waitlist] - 空き通知アクション名
 * @param {string} [options.actions.changeDate] - 日程変更アクション名
 * @param {boolean} [options.isChangingDate] - 日程変更モードかどうか（指定がない場合はStoreから取得）
 * @param {boolean} [options.isBeginnerMode] - 初回者モードかどうか（指定がない場合は自動判定）
 * @returns {string} HTML文字列
 */
export const renderBookingLessons = (
  lessons,
  selectedClassroom = '',
  options = {},
) => {
  const showClassroomLabel = selectedClassroom === 'all';

  // デフォルトのアクション設定
  const actions = {
    book: 'bookLesson',
    waitlist: options.actions?.waitlist || 'bookLesson', // デフォルトはbookLesson（既存動作維持）
    changeDate: 'goToReservationFormForLesson',
    ...options.actions,
  };

  const state = bookingStateManager.getState();
  // オプションで指定があればそちらを優先、なければStoreから取得
  const isChangingDate =
    options.isChangingDate ?? Boolean(state['isChangingReservationDate']);

  debugLog('📚 renderBookingLessons called:', {
    lessonsCount: lessons?.length || 0,
    selectedClassroom,
    showClassroomLabel,
    override: localStorage.getItem('beginnerModeOverride'),
    isChangingDate,
  });

  const targetStudentId =
    state.currentReservationFormContext?.reservationInfo?.studentId || '';

  // 変更時は過去レッスンを除外 + 当日の終了時間チェック
  /**
   * @param {string | Date | null | undefined} value
   * @returns {string}
   */
  const normalizeLessonDate = value => {
    if (!value) return '';
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
      }
      const dateObj = new Date(value);
      if (Number.isNaN(dateObj.getTime())) return '';
      return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    }
    if (value instanceof Date) {
      return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    }
    return '';
  };

  const now = new Date();
  const todayDateStr = normalizeLessonDate(now);
  const currentTimeMin = now.getHours() * 60 + now.getMinutes();

  /** @type {LessonCore[]} */
  const lessonsToRender = (lessons || []).filter(lesson => {
    if (!lesson || !lesson.date) return false;
    const lessonDateStr = normalizeLessonDate(lesson.date);
    if (!lessonDateStr) return false;
    if (!isChangingDate) {
      // 通常表示時も当日のレッスンは終了時間チェック
      if (lessonDateStr === todayDateStr) {
        // 終了時間を取得（secondEnd > firstEnd > endTime の優先順）
        const endTimeStr =
          lesson.secondEnd || lesson.firstEnd || lesson.endTime || '23:59';
        const [endH, endM] = endTimeStr.split(':').map(Number);
        const lessonEndMin = endH * 60 + (endM || 0);
        // 現在時刻が終了時間を過ぎていれば除外
        if (currentTimeMin >= lessonEndMin) {
          return false;
        }
      }
      return true;
    }
    const today = todayDateStr;
    // 日程変更時は当日以降を表示（当日はさらに終了時間チェック）
    if (lessonDateStr < today) return false;
    if (lessonDateStr === today) {
      const endTimeStr =
        lesson.secondEnd || lesson.firstEnd || lesson.endTime || '23:59';
      const [endH, endM] = endTimeStr.split(':').map(Number);
      const lessonEndMin = endH * 60 + (endM || 0);
      if (currentTimeMin >= lessonEndMin) {
        return false;
      }
    }
    return true;
  });

  // よやく情報の取得（オプション優先）
  let effectiveReservations = /** @type {ReservationCore[]} */ (
    options.reservations || state.myReservations || []
  );

  // 管理者による日程変更の場合の特殊処理（options.reservationsが明示的に渡されている場合はスキップしても良いが、既存ロジック維持）
  if (!options.reservations && isChangingDate && targetStudentId) {
    const map = state.participantReservationsMap || {};
    const gathered = Object.keys(map).reduce((acc, key) => {
      const list = map[key] || [];
      list.forEach((/** @type {ReservationCore} */ r) => {
        if (r.studentId === targetStudentId) {
          acc.push(r);
        }
      });
      return acc;
    }, /** @type {ReservationCore[]} */ ([]));
    if (gathered.length > 0) {
      effectiveReservations = gathered;
    } else if (state.currentReservationFormContext?.reservationInfo) {
      effectiveReservations = [
        /** @type {ReservationCore} */ (
          state.currentReservationFormContext.reservationInfo
        ),
      ];
    }
  }

  if (!lessonsToRender || lessonsToRender.length === 0) {
    console.warn('⚠️ No lessons to render');
    return '';
  }

  /** @type {Record<string, LessonCore[]>} */
  const lessonsByMonth = lessonsToRender.reduce(
    (
      /** @type {Record<string, LessonCore[]>} */ acc,
      /** @type {LessonCore} */ lesson,
    ) => {
      // ガード節: lessonまたはlesson.dateがundefinedの場合はスキップ
      if (!lesson || !lesson.date) {
        console.warn('Invalid lesson data:', lesson);
        return acc;
      }
      const lessonDate = new Date(lesson.date);
      if (Number.isNaN(lessonDate.getTime())) {
        console.warn('Invalid lesson date:', lesson.date);
        return acc;
      }
      const monthKey = `${lessonDate.getFullYear()}-${String(
        lessonDate.getMonth() + 1,
      ).padStart(2, '0')}`;
      if (!acc[monthKey]) acc[monthKey] = [];
      acc[monthKey].push(lesson);
      return acc;
    },
    /** @type {Record<string, LessonCore[]>} */ ({}),
  );

  const sortedMonthKeys = Object.keys(lessonsByMonth).sort((a, b) =>
    a.localeCompare(b),
  );
  const currentYear = new Date().getFullYear();
  /** @type {number | null} */
  let lastYear = null;

  const result = sortedMonthKeys
    .map(monthKey => {
      const [yearStr, monthStr] = monthKey.split('-');
      const month = Number(monthStr);
      const year = Number(yearStr);
      // 年ヘッダは翌年以降のみ表示（左寄せスタイル）
      const yearHeader =
        lastYear !== year && year > currentYear
          ? `<p class="text-sm font-bold text-gray-500 mt-4 mb-2 border-l-2 border-gray-300 pl-2">${year}年</p>`
          : '';
      lastYear = year;
      // 月ヘッダ（左寄せスタイル）
      const monthHeader = `<p class="text-sm font-bold text-gray-500 mt-2 mb-2 border-l-2 border-gray-300 pl-2">${month}月</p>`;

      const lessonsHtml = lessonsByMonth[monthKey]
        .slice()
        .sort(
          (/** @type {LessonCore} */ a, /** @type {LessonCore} */ b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime(),
        )
        .map(
          /** @param {LessonCore} lesson */ lesson => {
            // 管理者でも通常のよやく画面として機能させる（よやく日変更時などに必要）
            const isBooked = (effectiveReservations || []).some(
              (/** @type {ReservationCore} */ b) =>
                String(b.date) === lesson.date &&
                b.classroom === lesson.classroom,
            );
            let cardClass, statusBadge, actionAttribute;
            const tag = isBooked ? 'div' : 'button';

            const bookAction = isChangingDate
              ? actions.changeDate
              : actions.book;

            const autoFirstTime =
              bookingStateManager.getState().isFirstTimeBooking;
            // 日程変更モード時は元のよやくの初回講習フラグを優先
            let isBeginnerMode =
              options.isBeginnerMode ?? resolveEffectiveBeginnerMode();
            if (isChangingDate && options.isBeginnerMode === undefined) {
              try {
                const storedJson = sessionStorage.getItem(
                  'changingReservation',
                );
                if (storedJson) {
                  const originalRes = JSON.parse(storedJson);
                  if (originalRes.firstLecture) {
                    isBeginnerMode = true;
                  }
                }
              } catch (e) {
                console.warn('sessionStorage読み取りエラー:', e);
              }
            }
            debugLog('📋 Lesson render:', lesson.date, {
              autoFirstTime,
              isBeginnerMode,
              isChangingDate,
            });
            let statusText;
            const {
              hasSecondSlots,
              firstSlotsCount,
              secondSlotsCount,
              beginnerSlotsCount,
              beginnerCapacityCount,
            } = getNormalizedSlotCounts(lesson);

            if (isBeginnerMode) {
              if (lesson.beginnerStart && beginnerCapacityCount > 0) {
                // 初回者枠が満席かチェック
                if (beginnerSlotsCount <= 0) {
                  statusText = '初回者 満席（空き通知希望）';
                } else {
                  statusText = `初回者 空き ${beginnerSlotsCount}`;
                }
              } else {
                statusText = '経験者のみ';
              }
            } else {
              if (hasSecondSlots) {
                const morningLabel = CONSTANTS.TIME_SLOTS.MORNING || '午前';
                const afternoonLabel = CONSTANTS.TIME_SLOTS.AFTERNOON || '午後';
                statusText = `空き ${morningLabel}${firstSlotsCount} ${afternoonLabel}${secondSlotsCount}`;
              } else {
                statusText = `空き ${firstSlotsCount}`;
              }
            }

            if (isBooked) {
              const reservationData = findReservationByDateAndClassroom(
                String(lesson.date),
                lesson.classroom,
                /** @type {any} */ ({
                  ...state,
                  myReservations: effectiveReservations,
                }),
              );
              if (reservationData?.status === CONSTANTS.STATUS.COMPLETED) {
                // 受講済み（グリーン系、非インタラクティブ）
                cardClass = `w-full text-left p-3 mb-2 bg-green-50 border-2 border-green-300 ${DesignConfig.borderRadius.container} opacity-50`;
                statusBadge = `<span class="text-xs text-green-600 font-bold">受講済み</span>`;
                actionAttribute = '';
              } else if (
                reservationData?.status === CONSTANTS.STATUS.WAITLISTED
              ) {
                // 空き通知済（Config参照）
                cardClass = `w-full text-left p-3 mb-2 ${DesignConfig.borderRadius.container} ${DesignConfig.cards.state.waitlist.card}`;
                statusBadge = `<span class="text-xs ${DesignConfig.cards.state.waitlist.text} font-bold">空き通知 登録済</span>`;
                actionAttribute = '';
              } else {
                // よやく済み（Config参照）
                cardClass = `w-full text-left p-3 mb-2 ${DesignConfig.borderRadius.container} ${DesignConfig.cards.state.booked.card}`;
                statusBadge = `<span class="text-sm ${DesignConfig.cards.state.booked.text} font-bold">よやく済み</span>`;
                actionAttribute = '';
              }
            } else {
              let isSlotFull = false;
              let canBook = true;

              if (isBeginnerMode) {
                if (!lesson.beginnerStart || beginnerCapacityCount <= 0) {
                  canBook = false;
                }
                isSlotFull = beginnerSlotsCount === 0;
              } else {
                // 満席判定：2部制の場合は両方満席、それ以外は1部満席
                if (hasSecondSlots) {
                  isSlotFull = firstSlotsCount === 0 && secondSlotsCount === 0;
                } else {
                  isSlotFull = firstSlotsCount === 0;
                }
              }

              if (!canBook) {
                // よやく不可（グレー薄い、非インタラクティブ）
                cardClass = `w-full text-left p-3 mb-2 bg-gray-100 border-2 border-gray-200 ${DesignConfig.borderRadius.container} opacity-50`;
                statusBadge = `<span class="text-xs text-gray-400 font-bold">${statusText}</span>`;
                actionAttribute = '';
              } else if (isSlotFull) {
                // 満席（グレー濃い、空き通知登録可能）
                cardClass = `w-full text-left p-3 mb-2 bg-gray-200 border-2 border-gray-300 ${DesignConfig.borderRadius.container}`;
                statusBadge = `<span class="text-xs text-gray-500 font-bold">満席（空き通知希望）</span>`;
                actionAttribute = `data-action="${actions.waitlist}" data-lesson-id="${lesson.lessonId}" data-classroom="${lesson.classroom}" data-date="${lesson.date}"`;
              } else {
                // 空きあり（テラコッタボーダー、よやく可能）
                cardClass = `w-full text-left p-3 mb-2 bg-white border-2 border-action-primary-bg ${DesignConfig.borderRadius.container}`;
                statusBadge = `<span class="text-sm text-action-primary-bg font-bold">${statusText}</span>`;
                actionAttribute = `data-action="${bookAction}" data-lesson-id="${lesson.lessonId}" data-classroom="${lesson.classroom}" data-date="${lesson.date}"`;
              }
            }

            const venueDisplay = lesson.venue ? lesson.venue : '';
            // 「すべて」表示時は教室+会場、個別表示時は会場のみ（統合関数を使用してピル型連結）
            const badges = showClassroomLabel
              ? renderClassroomVenueBadges(lesson.classroom, venueDisplay)
              : renderClassroomVenueBadges(null, venueDisplay);
            const nightBadgeHtml = isNightLesson(lesson)
              ? Components.badge({ text: '夜', color: 'blue', size: 'xs' })
              : '';
            const badgeGroup = [badges, nightBadgeHtml]
              .filter(Boolean)
              .join('');
            const badgeGroupHtml = badgeGroup
              ? `<span class="text-sm whitespace-nowrap flex gap-1 items-center">${badgeGroup}</span>`
              : '';
            const openingHoursText = buildOpeningHoursText(lesson);
            const openingHoursHtml = openingHoursText
              ? `<div class="text-xs text-gray-500 mt-1">開室時間 ${openingHoursText}</div>`
              : '';
            // 区切りの良いところで改行: 日付 | 教室+会場 | ステータス（常に右端）
            const text = `
              <div class="flex flex-wrap justify-between items-center gap-1">
                <div class="flex flex-wrap items-center gap-1 flex-1 min-w-0">
                  <span class="whitespace-nowrap">${formatDate(lesson.date)}</span>
                  ${badgeGroupHtml}
                </div>
                <div class="ml-auto flex-shrink-0">${statusBadge}</div>
              </div>`;

            return `<${tag} ${actionAttribute} class="${cardClass}">${text}${openingHoursHtml}</${tag}>`;
          },
        )
        .join('');

      return yearHeader + monthHeader + lessonsHtml;
    })
    .join('');

  debugLog('✅ renderBookingLessons result:', {
    resultLength: result.length,
    isEmpty: !result,
    monthsCount: Object.keys(lessonsByMonth).length,
  });

  return result;
};

/**
 * 教室選択モーダル用のコンテンツを生成します。
 * @returns {string} HTML文字列
 */
export const getClassroomSelectionModalContent = () => {
  const classrooms = Object.values(CONSTANTS.CLASSROOMS || {});

  if (!classrooms.length) {
    return `<div class="text-center"><p class="text-brand-subtle mb-4">現在、よやく可能な教室がありません。</p></div>`;
  }

  const desiredOrder = DesignConfig.classroomOrder || [
    '東京教室',
    'つくば教室',
    '沼津教室',
  ];
  const sortedClassrooms = classrooms.sort((a, b) => {
    const indexA = desiredOrder.indexOf(a);
    const indexB = desiredOrder.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  const classroomButtonsHtml = sortedClassrooms
    .map(classroomName => {
      const colorClass = getClassroomColorClass(classroomName);
      const fullButtonClass = `w-full h-16 text-center px-6 py-4 rounded-xl mobile-card touch-friendly flex items-center justify-center text-xl font-bold border-2 transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95 ${colorClass}`;

      return Components.button({
        action: 'selectClassroom',
        text: classroomName,
        style: 'none',
        customClass: fullButtonClass,
        dataAttributes: {
          classroomName: classroomName,
          classroom: classroomName,
        },
      });
    })
    .join('');

  return `
      <div class="space-y-4">
        ${classroomButtonsHtml}
      </div>
    `;
};

/**
 * 教室選択モーダル全体のHTMLを生成します。
 * @returns {string} HTML文字列
 */
export const getClassroomSelectionModal = () => {
  return Components.modal({
    id: 'classroom-selection-modal',
    title: 'おえらびください',
    content: getClassroomSelectionModalContent(),
    maxWidth: 'max-w-md',
  });
};

/**
 * 編集モード対応の履歴カードを生成します
 * @param {ReservationCore} historyItem - 履歴データ
 * @param {Array<any>} editButtons - 編集ボタン配列
 * @returns {string} HTML文字列
 */
export const _buildHistoryCardWithEditMode = (historyItem, editButtons) => {
  // listCard を使用してカードを生成
  return Components.listCard({
    item: historyItem,
    badges: [], // 履歴カードはバッジなし
    editButtons: editButtons,
  });
};
