/**
 * =================================================================
 * ファイル概要
 * -----------------------------------------------------------------
 * 名称: 13_WebApp_Views_Booking.js
 * 目的: 予約枠一覧や予約フォームなど予約領域のビュー生成を担当する
 * 主な責務:
 *   - 教室単位のレッスンデータからビュー用HTMLを構築
 *   - 初心者モード切り替えや販売チェックリストなどの補助UIを提供
 *   - 予約フォームで必要なデータ整形ユーティリティを提供
 * AI向けメモ:
 *   - 新しい予約関連ビューは`Components`を活用しつつここに追加し、必要なデータ取得ロジックはCore層から参照する
 * =================================================================
 */

// ================================================================
// UI系モジュール
// ================================================================
import { Components } from './13_WebApp_Components.js';
import {
  _isToday,
  getClassroomColorClass,
  getTimeOptionsHtml,
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
  console.log('🎚️ handleBeginnerModeSelect called:', { isBeginner });
  bookingStateManager.setBeginnerModeOverride(isBeginner);
};

/**
 * 初心者モード選択ボタングループのHTMLを生成
 * 自動判定で初回者の場合のみ表示
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
  const selectedValue =
    override !== null
      ? override
      : resolveEffectiveBeginnerMode()
        ? 'true'
        : 'false';

  console.log('🎚️ BeginnerModeToggle:', {
    auto,
    override,
    selectedValue,
  });

  return `
      <p class="text-sm ${DesignConfig.colors.textSubtle} mb-2 text-center">参加枠の表示</p>
      <div class="flex justify-center mb-6">
        ${Components.buttonGroup({
          buttons: [
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
          className: 'max-w-md w-full',
        })}
      </div>
      <hr class="border-ui-border-light"/>
    `;
};
/**
 * 特定の教室の予約枠一覧画面のUIを生成します。
 * @param {string} classroom - 教室名
 * @returns {string} HTML文字列
 */
export const getBookingView = classroom => {
  const currentState = bookingStateManager.getState();
  const relevantLessons =
    currentState.lessons && Array.isArray(currentState.lessons)
      ? currentState.lessons.filter(
          (/** @type {LessonCore} */ lesson) => lesson.classroom === classroom,
        )
      : [];

  console.log('🏫 getBookingView:', {
    classroom,
    totalLessons: currentState.lessons?.length,
    relevantLessons: relevantLessons.length,
    override: localStorage.getItem('beginnerModeOverride'),
    isChangingDate: currentState['isChangingReservationDate'],
  });

  // 日程変更モードの場合はタイトルを変更
  const pageTitle = currentState['isChangingReservationDate']
    ? '参加日の変更'
    : classroom;

  const bookingLessonsHtml = renderBookingLessons(relevantLessons);

  if (!bookingLessonsHtml) {
    return `
      ${Components.pageHeader({ title: pageTitle })}
      ${Components.pageContainer({
        maxWidth: 'md',
        content: `
              <p class="${DesignConfig.colors.textSubtle} mb-6">現在、予約可能な日がありません。</p>
        `,
      })}
    `;
  } else {
    return `
      ${Components.pageHeader({ title: pageTitle })}
      ${Components.pageContainer({
        maxWidth: 'md',
        content: `
              ${renderBeginnerModeToggle()}
              <div class="${DesignConfig.cards.container}">${bookingLessonsHtml}</div>
        `,
      })}
    `;
  }
};

/**
 * 予約の詳細入力・編集画面のUIを生成します。
 * state.currentReservationFormContext からデータを取得して描画します。
 * @returns {string} HTML文字列
 */
export const getReservationFormView = () => {
  const {
    currentUser,
    accountingMaster,
    currentReservationFormContext,
    isFirstTimeBooking: autoFirstTime,
  } = bookingStateManager.getState();
  const isBeginnerMode = resolveEffectiveBeginnerMode();

  if (!currentReservationFormContext) {
    return 'エラー: 予約フォームのデータが見つかりません。';
  }

  const { lessonInfo, reservationInfo, source } = currentReservationFormContext;
  const isEdit = !!reservationInfo.reservationId;

  // lessonInfoは既にLessonCore型（統一済み）
  const { classroom, date, venue, classroomType, beginnerStart } = lessonInfo;
  const {
    firstLecture,
    chiselRental,
    workInProgress,
    materialInfo,
    order,
    messageToTeacher,
    startTime,
    endTime,
  } = reservationInfo;
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

  // 日程変更モードかどうかを判定
  const isChangingDate = /** @type {string} */ (source) === 'dateChange';

  const title = isChangingDate
    ? '新しい日程の予約詳細'
    : isEdit
      ? '予約内容の編集'
      : isFull || (isBeginnerMode && isBeginnerSlotFull)
        ? '空き通知希望'
        : '予約詳細の入力';
  const submitAction = isChangingDate
    ? 'confirmDateChange'
    : isEdit
      ? 'updateReservation'
      : 'confirmBooking';
  const submitButtonText = isChangingDate
    ? 'この日程に変更する'
    : isEdit
      ? 'この内容で更新する'
      : isFull
        ? '空き通知 登録'
        : 'この内容で予約する';

  const backAction = 'smartGoBack';

  const _renderStatusHtml = () => {
    if (isEdit) {
      return isWaiting ? '空き通知希望' : '予約済み';
    }
    if (isBeginnerMode) {
      return isBeginnerSlotFull
        ? '初回者枠 満席（空き通知希望）'
        : `初回者枠 空き <span class="font-mono-numbers">${beginnerSlotsCount}</span>`;
    }
    if (isFull) return '満席（空き通知希望）';
    if (hasSecondSlots) {
      const morningLabel = CONSTANTS.TIME_SLOTS.MORNING || '午前';
      const afternoonLabel = CONSTANTS.TIME_SLOTS.AFTERNOON || '午後';
      return `空き ${morningLabel} <span class="font-mono-numbers">${firstSlotsCount}</span> | ${afternoonLabel} <span class="font-mono-numbers">${secondSlotsCount}</span>`;
    }
    return `空き <span class="font-mono-numbers">${firstSlotsCount}</span>`;
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
        return `<div class="text-ui-error-text p-4 bg-ui-error-bg rounded-lg">エラー: この教室の時間設定が不正です</div>`;
      }
      return `
        <input type="hidden" id="res-start-time" value="${lessonInfo.firstStart}" />
        <input type="hidden" id="res-end-time" value="${lessonInfo.firstEnd}" />
      `;
    }

    if (!lessonInfo.firstStart || !lessonInfo.firstEnd) {
      return `<div class="text-ui-error-text p-4 bg-ui-error-bg rounded-lg">エラー: この教室の時間設定が不正です</div>`;
    }

    const startHour = parseInt(lessonInfo.firstStart.split(':')[0]);
    const endHour = parseInt(
      (lessonInfo.secondEnd || lessonInfo.firstEnd).split(':')[0],
    );
    const endMinutes = parseInt(
      (lessonInfo.secondEnd || lessonInfo.firstEnd).split(':')[1],
    );

    let fixedStartTime = startTime;
    let isTimeFixed = false;
    if (isBeginnerMode && beginnerStart && beginnerCapacityCount > 0) {
      fixedStartTime = beginnerStart;
      isTimeFixed = true;
    }

    const startTimeOptions = isTimeFixed
      ? `<option value="${fixedStartTime}" selected>${fixedStartTime}</option>`
      : getTimeOptionsHtml(
          startHour,
          endHour,
          CONSTANTS.FRONTEND_UI.TIME_SETTINGS.STEP_MINUTES,
          startTime ?? null,
        );
    let endTimeOptions = getTimeOptionsHtml(
      startHour,
      endHour,
      CONSTANTS.FRONTEND_UI.TIME_SETTINGS.STEP_MINUTES,
      endTime ?? null,
    );
    if (endMinutes > 0) {
      const finalEndTime = `${String(endHour).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
      endTimeOptions += `<option value="${finalEndTime}">${finalEndTime}</option>`;
    }

    const timeFixedMessage = isTimeFixed
      ? `<p class="${/** @type {any} */ (DesignConfig.text).caption} mb-2">初回の方は <span class="time-display">${fixedStartTime}</span> より開始です。${fixedStartTime}昼をまたぐ場合は、1時間休憩を挟みます</p>`
      : '';

    return `
        <div class="mt-4 pt-4 border-t-2">
          <h4 class="font-bold ${DesignConfig.colors.text} mb-2">予約時間</h4>
          ${timeFixedMessage}
          <div class="grid grid-cols-2 gap-4 mb-2">
            ${Components.select({ id: 'res-start-time', label: '開始予定', options: startTimeOptions })}
            ${Components.select({ id: 'res-end-time', label: '終了予定', options: endTimeOptions })}
          </div>
        </div>`;
  };

  const _renderBookingOptionsSection = () => {
    const firstLectureChecked = firstLecture || (!isEdit && isBeginnerMode);
    const firstLectureDisabled = !isEdit && isBeginnerMode;

    if (classroomType === CONSTANTS.CLASSROOM_TYPES.SESSION_BASED) {
      /** @type {CheckboxConfig} */
      const firstLectureCheckboxConfig = {
        id: 'option-first-lecture',
        label: CONSTANTS.ITEMS.FIRST_LECTURE,
        checked:
          firstLectureChecked !== undefined ? firstLectureChecked : false,
        disabled: firstLectureDisabled,
      };
      /** @type {CheckboxConfig} */
      const rentalCheckboxConfig = {
        id: 'option-rental',
        label: `${CONSTANTS.ITEMS.CHISEL_RENTAL} 1回 ¥500`,
        checked: chiselRental !== undefined ? chiselRental : false,
      };
      return `
        <div class="mt-4 pt-4 border-t-2">
          <h4 class="font-bold text-left mb-2">オプション</h4>
          ${Components.checkbox(firstLectureCheckboxConfig)}
          <div class="mt-2">${Components.checkbox(rentalCheckboxConfig)}</div>
        </div>`;
    }
    return '';
  };

  const _renderDetailsInputSection = () => {
    const salesChecklistHtml =
      typeof buildSalesChecklist === 'function'
        ? buildSalesChecklist(accountingMaster)
        : '';
    return `
        <div class="mt-4 pt-4 border-t-2 space-y-4">
          ${Components.textarea({ id: 'wip-input', label: autoFirstTime && !isEdit ? '今回つくりたいもの/やりたいこと' : 'つくりたいもの/やりたいこと/作業予定', placeholder: 'あとからでも記入できます。当日に相談でも大丈夫！', value: workInProgress || '' })}
          ${Components.textarea({ id: 'material-input', label: '材料のサイズや樹種の希望', placeholder: '例：30×30×40mmくらい」「高さが6cmくらい」「たまごぐらい」 など', value: materialInfo || '' })}
        </div>
        <div class="mt-4 pt-4 border-t-2 space-y-4">
          ${salesChecklistHtml}
          ${Components.textarea({ id: 'order-input', label: '購入希望（自由記入）', placeholder: '（任意）例：彫刻刀セット、テキスト', value: order || '' })}
          ${Components.textarea({ id: 'message-input', label: 'その他の連絡事項や要望など', placeholder: '', value: messageToTeacher || '' })}
        </div>`;
  };

  const _getSelectedSalesOrder = () =>
    Array.from(document.querySelectorAll('input[name="orderSales"]:checked'))
      .map(element => /** @type {HTMLInputElement} */ (element).value)
      .join(', ');

  setTimeout(() => {
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
    // 参加日を変更するボタン
    buttonsHtml += Components.button({
      text: '参加日を変更する',
      action: 'changeReservationDate',
      style: 'secondary',
      size: 'full',
      dataAttributes: {
        reservationId: reservationInfo.reservationId || '',
        classroom: reservationInfo.classroom || '',
      },
    });
    // キャンセルボタン
    buttonsHtml += Components.button({
      text: 'この予約をキャンセルする',
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
    if (!lessonInfo.firstStart || !lessonInfo.firstEnd)
      return '<span class="text-ui-error-text">開講時間未設定</span>';
    if (lessonInfo.secondStart && lessonInfo.secondEnd)
      return `<span class="time-display">${lessonInfo.firstStart}~${lessonInfo.firstEnd}</span> , <span class="time-display">${lessonInfo.secondStart}~${lessonInfo.secondEnd}</span>`;
    return `<span class="time-display">${lessonInfo.firstStart}~${lessonInfo.firstEnd}</span>`;
  };

  return `
      ${Components.pageHeader({ title: title, backAction: backAction })}
      ${Components.cardContainer({
        variant: 'default',
        padding: 'spacious',
        content: `
          <div class="space-y-4 text-left">
            <p><span class="font-bold w-20 inline-block">お名前:</span> ${currentUser ? currentUser.nickname : ''}さん</p>
            <p><span class="font-bold w-20 inline-block">教室:</span> ${classroom}${venue ? ` ${venue}` : ''}</p>
            <p><span class="font-bold w-20 inline-block">日付:</span> ${formatDate(String(date))}</p>
            <p><span class="font-bold w-20 inline-block">状況:</span> ${_renderStatusHtml()}</p>
            <p><span class="font-bold w-20 inline-block">開講時間:</span> ${_renderOpeningHoursHtml()}</p>
            ${_renderTuitionDisplaySection()}
            ${_renderTimeOptionsSection()}
            ${_renderBookingOptionsSection()}
            ${_renderDetailsInputSection()}
          </div>
        `,
      })}
      <div class="mt-8 flex flex-col space-y-3">
        ${buttonsHtml}
      </div>`;
};

/**
 * 予約スロットのリストからHTMLを生成します。
 * この関数は getBookingView と getCompleteView で共有されます。
 * @param {LessonCore[]} lessons - 表示する講座情報の配列
 * @returns {string} HTML文字列
 */
export const renderBookingLessons = lessons => {
  console.log('📚 renderBookingLessons called:', {
    lessonsCount: lessons?.length || 0,
    override: localStorage.getItem('beginnerModeOverride'),
  });

  if (!lessons || lessons.length === 0) {
    console.warn('⚠️ No lessons to render');
    return '';
  }

  /** @type {Record<number, LessonCore[]>} */
  const lessonsByMonth = lessons.reduce(
    (
      /** @type {Record<number, LessonCore[]>} */ acc,
      /** @type {LessonCore} */ lesson,
    ) => {
      // ガード節: lessonまたはlesson.dateがundefinedの場合はスキップ
      if (!lesson || !lesson.date) {
        console.warn('Invalid lesson data:', lesson);
        return acc;
      }
      const month = new Date(lesson.date).getMonth() + 1;
      if (!acc[month]) acc[month] = [];
      acc[month].push(lesson);
      return acc;
    },
    /** @type {Record<number, LessonCore[]>} */ ({}),
  );

  const result = Object.keys(lessonsByMonth)
    .sort((a, b) => Number(a) - Number(b))
    .map(monthStr => {
      const month = Number(monthStr);
      const monthHeader = `<h4 class="text-lg font-medium ${DesignConfig.colors.textSubtle} mt-4 mb-2 text-center">${month}月</h4>`;

      const lessonsHtml = lessonsByMonth[month]
        .map(
          /** @param {LessonCore} lesson */ lesson => {
            const state = bookingStateManager.getState();
            const isBooked = (state.myReservations || []).some(
              (/** @type {ReservationCore} */ b) =>
                String(b.date) === lesson.date &&
                b.classroom === lesson.classroom,
            );
            let cardClass, statusBadge, actionAttribute;
            const tag = isBooked ? 'div' : 'button';

            // 日程変更モードの場合は異なるアクションを使用
            const isChangingDate = state['isChangingReservationDate'];
            const bookAction = isChangingDate
              ? 'goToReservationFormForLesson'
              : 'bookLesson';

            const autoFirstTime =
              bookingStateManager.getState().isFirstTimeBooking;
            const isBeginnerMode = resolveEffectiveBeginnerMode();
            console.log('📋 Lesson render:', lesson.date, {
              autoFirstTime,
              isBeginnerMode,
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
                  statusText = `初回者 空き <span class="font-mono-numbers">${beginnerSlotsCount}</span>`;
                }
              } else {
                statusText = '経験者のみ';
              }
            } else {
              if (hasSecondSlots) {
                const morningLabel = CONSTANTS.TIME_SLOTS.MORNING || '午前';
                const afternoonLabel = CONSTANTS.TIME_SLOTS.AFTERNOON || '午後';
                statusText = `空き ${morningLabel}<span class="font-mono-numbers">${firstSlotsCount}</span> ${afternoonLabel}<span class="font-mono-numbers">${secondSlotsCount}</span>`;
              } else {
                statusText = `空き <span class="font-mono-numbers">${firstSlotsCount}</span>`;
              }
            }

            if (isBooked) {
              const reservationData = findReservationByDateAndClassroom(
                String(lesson.date),
                lesson.classroom,
              );
              if (reservationData?.status === CONSTANTS.STATUS.COMPLETED) {
                cardClass = `${DesignConfig.cards.base} ${DesignConfig.cards.state.booked.card}`;
                statusBadge = `<span class="text-sm font-bold ${DesignConfig.cards.state.booked.text}">受講済み</span>`;
                actionAttribute = '';
              } else if (
                reservationData?.status === CONSTANTS.STATUS.WAITLISTED
              ) {
                cardClass = `${DesignConfig.cards.base} ${DesignConfig.cards.state.waitlist.card}`;
                statusBadge = `<span class="text-sm font-bold ${DesignConfig.cards.state.waitlist.text}">空き通知 登録済</span>`;
                actionAttribute = '';
              } else {
                cardClass = `${DesignConfig.cards.base} ${DesignConfig.cards.state.booked.card}`;
                statusBadge = `<span class="text-sm font-bold ${DesignConfig.cards.state.booked.text}">予約済み</span>`;
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
                cardClass = `${DesignConfig.cards.base} ${DesignConfig.cards.state.waitlist.card} opacity-50`;
                statusBadge = `<span class="text-sm font-bold ${DesignConfig.cards.state.waitlist.text}">${statusText}</span>`;
                actionAttribute = '';
              } else if (isSlotFull) {
                cardClass = `${DesignConfig.cards.base} ${DesignConfig.cards.state.waitlist.card}`;
                statusBadge = `<span class="text-sm font-bold ${DesignConfig.cards.state.waitlist.text}">満席（空き通知希望）</span>`;
                actionAttribute = `data-action="${bookAction}" data-lesson-id="${lesson.lessonId}" data-classroom="${lesson.classroom}" data-date="${lesson.date}"`;
              } else {
                cardClass = `${DesignConfig.cards.base} ${DesignConfig.cards.state.available.card}`;
                statusBadge = `<span class="text-sm font-bold ${DesignConfig.cards.state.available.text}">${statusText}</span>`;
                actionAttribute = `data-action="${bookAction}" data-lesson-id="${lesson.lessonId}" data-classroom="${lesson.classroom}" data-date="${lesson.date}"`;
              }
            }

            const venueDisplay = lesson.venue ? ` ${lesson.venue}` : '';
            const text = `<div class="flex justify-between items-center w-full"><span class="${DesignConfig.colors.text}">${formatDate(lesson.date)}${venueDisplay}</span>${statusBadge}</div>`;

            return `<${tag} ${actionAttribute} class="${cardClass}">${text}</${tag}>`;
          },
        )
        .join('');

      return monthHeader + lessonsHtml;
    })
    .join('');

  console.log('✅ renderBookingLessons result:', {
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
    return `<div class="text-center"><p class="text-brand-subtle mb-4">現在、予約可能な教室がありません。</p></div>`;
  }

  const desiredOrder = ['東京教室', 'つくば教室', '沼津教室'];
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
 * @param {Array<any>} accountingButtons - 会計ボタン配列
 * @param {boolean} isInEditMode - 編集モード状態
 * @returns {string} HTML文字列
 */
export function _buildHistoryCardWithEditMode(
  historyItem,
  editButtons,
  accountingButtons,
  isInEditMode,
) {
  // 履歴カード特有の会計ボタン追加ロジック
  const allAccountingButtons = [...accountingButtons];

  if (isInEditMode) {
    const isToday = _isToday(String(historyItem.date));
    if (historyItem.status === CONSTANTS.STATUS.COMPLETED && !isToday) {
      // 重複チェック：既に「会計記録」ボタンが存在しない場合のみ追加
      const hasAccountingDetailsButton = allAccountingButtons.some(
        btn => btn.action === 'showHistoryAccounting',
      );

      if (!hasAccountingDetailsButton) {
        allAccountingButtons.push({
          action: 'showHistoryAccounting',
          text: '会計<br>記録',
          style: 'accounting',
          details: historyItem.accountingDetails,
        });
      }
    }
  }

  // listCard を使用してカードを生成
  return Components.listCard({
    item: historyItem,
    badges: [], // 履歴カードはバッジなし
    editButtons: editButtons,
    accountingButtons: allAccountingButtons,
    type: 'record',
    isEditMode: isInEditMode,
    showMemoSaveButton: true,
  });
}
