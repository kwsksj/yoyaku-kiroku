// @ts-check
/// <reference path="../../types/dev-environment.d.ts" />
/// <reference path="../../types/html-environment.d.ts" />
/// <reference path="../../types/api-types.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 13_WebApp_Views_Booking.js
 * 【バージョン】: 1.1
 * 【役割】: 予約関連のビュー（予約枠一覧、予約フォーム、教室選択）
 * 【構成】: Views.jsから分割された予約機能
 * 【v1.1での変更点】: JSDocの型定義を更新
 * =================================================================
 */

/**
 * 特定の教室の予約枠一覧画面のUIを生成します。
 * @param {string} classroom - 教室名
 * @returns {string} HTML文字列
 */
const getBookingView = classroom => {
  const relevantLessons = stateManager.getState().lessons
    ? stateManager
        .getState()
        .lessons.filter(lesson => lesson.schedule.classroom === classroom)
    : [];

  const bookingLessonsHtml = renderBookingLessons(relevantLessons);

  if (!bookingLessonsHtml) {
    return Components.pageContainer({
      maxWidth: 'md',
      content: `
            <h1 class="text-xl font-bold ${DesignConfig.colors.text} mb-2">${classroom}</h1>
            <p class="${DesignConfig.colors.textSubtle} mb-6">現在、予約可能な日がありません。</p>
            ${Components.actionButtonSection({
              primaryButton: {
                text: 'ホームに戻る',
                action: 'goBackToDashboard',
                style: 'secondary',
              },
            })}
      `,
    });
  } else {
    return Components.pageContainer({
      maxWidth: 'md',
      content: `
            <h1 class="text-xl font-bold ${DesignConfig.colors.text} mb-4">${classroom}</h1>
            <div class="${DesignConfig.cards.container}">${bookingLessonsHtml}</div>
            ${Components.actionButtonSection({
              primaryButton: {
                text: 'ホームに戻る',
                action: 'goBackToDashboard',
                style: 'secondary',
              },
            })}
      `,
    });
  }
};

/**
 * 予約の詳細入力・編集画面のUIを生成します。
 * state.currentReservationFormContext からデータを取得して描画します。
 * @returns {string} HTML文字列
 */
const getReservationFormView = () => {
  const {
    currentUser,
    accountingMaster,
    isFirstTimeBooking,
    currentReservationFormContext,
  } = stateManager.getState();

  if (!currentReservationFormContext) {
    return 'エラー: 予約フォームのデータが見つかりません。';
  }

  const { lessonInfo, reservationInfo } = currentReservationFormContext;
  const isEdit = !!reservationInfo.reservationId;

  const { schedule, status } = lessonInfo;
  const { classroom, date, venue, classroomType, beginnerStart } = schedule;
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

  const isTimeBased = isTimeBasedClassroom(schedule);

  const title = isEdit
    ? '予約内容の編集'
    : status.isFull || (isFirstTimeBooking && status.firstLectureIsFull)
      ? 'キャンセル待ち申込み'
      : '予約詳細の入力';
  const submitAction = isEdit ? 'updateReservation' : 'confirmBooking';
  const submitButtonText = isEdit
    ? 'この内容で更新する'
    : status.isFull
      ? 'キャンセル待ちで登録する'
      : 'この内容で予約する';

  const _renderStatusHtml = () => {
    if (isEdit) {
      return isWaiting ? 'キャンセル待ち' : '予約済み';
    }
    if (isFirstTimeBooking) {
      return status.firstLectureIsFull
        ? '初回者枠 満席（キャンセル待ち申込み）'
        : `初回者枠 空き ${status.firstLectureSlots}`;
    }
    if (status.isFull) return '満席（キャンセル待ち申込み）';
    if (typeof status.morningSlots !== 'undefined') {
      const morningLabel = CONSTANTS.SESSIONS.MORNING || '午前';
      const afternoonLabel = CONSTANTS.SESSIONS.AFTERNOON || '午後';
      return `空き ${morningLabel} ${status.morningSlots} | ${afternoonLabel} ${status.afternoonSlots}`;
    }
    return `空き ${status.availableSlots}`;
  };

  const _renderTuitionDisplaySection = () => {
    if (isTimeBased) {
      const basicTuitionRule = accountingMaster.find(
        item =>
          item.item === CONSTANTS.ITEMS.MAIN_LECTURE &&
          item.classroom?.includes(classroom),
      );
      if (basicTuitionRule) {
        return Components.priceDisplay({
          amount: basicTuitionRule.price,
          label: `${CONSTANTS.ITEMS.MAIN_LECTURE} / 30分`,
          style: 'highlight',
        });
      }
    } else {
      const targetItemName = isFirstTimeBooking
        ? CONSTANTS.ITEMS.FIRST_LECTURE
        : CONSTANTS.ITEMS.MAIN_LECTURE;
      const tuitionItem = accountingMaster.find(
        item =>
          item.type === CONSTANTS.ITEM_TYPES.TUITION &&
          item.item === targetItemName &&
          (item.classroom === '共通' || item.classroom?.includes(classroom)),
      );
      if (tuitionItem) {
        return Components.priceDisplay({
          amount: tuitionItem.price,
          label: targetItemName,
          style: isFirstTimeBooking ? 'highlight' : 'default',
        });
      }
    }
    return '';
  };

  const _renderTimeOptionsSection = () => {
    if (!isTimeBased) return '';

    if (!schedule.firstStart || !schedule.firstEnd) {
      return `<div class="text-ui-error-text p-4 bg-ui-error-bg rounded-lg">エラー: この教室の時間設定が不正です</div>`;
    }

    const startHour = parseInt(schedule.firstStart.split(':')[0]);
    const endHour = parseInt(
      (schedule.secondEnd || schedule.firstEnd).split(':')[0],
    );
    const endMinutes = parseInt(
      (schedule.secondEnd || schedule.firstEnd).split(':')[1],
    );

    let fixedStartTime = startTime;
    let isTimeFixed = false;
    if (isFirstTimeBooking && beginnerStart) {
      fixedStartTime = beginnerStart;
      isTimeFixed = true;
    }

    const startTimeOptions = isTimeFixed
      ? `<option value="${fixedStartTime}" selected>${fixedStartTime}</option>`
      : getTimeOptionsHtml(
          startHour,
          endHour,
          CONSTANTS.FRONTEND_UI.TIME_SETTINGS.STEP_MINUTES,
          startTime,
        );
    let endTimeOptions = getTimeOptionsHtml(
      startHour,
      endHour,
      CONSTANTS.FRONTEND_UI.TIME_SETTINGS.STEP_MINUTES,
      endTime,
    );
    if (endMinutes > 0) {
      const finalEndTime = `${String(endHour).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
      endTimeOptions += `<option value="${finalEndTime}">${finalEndTime}</option>`;
    }

    const timeFixedMessage = isTimeFixed
      ? `<p class="${/** @type {any} */ (DesignConfig.text).caption} mb-2">初回の方は ${fixedStartTime} より開始です。昼をまたぐ場合は、1時間休憩を挟みます</p>`
      : '';

    return `
        <div class="mt-4 pt-4 border-t">
          <h4 class="font-bold ${DesignConfig.colors.text} mb-2">予約時間</h4>
          ${timeFixedMessage}
          <div class="grid grid-cols-2 gap-4 mb-2">
            ${Components.select({ id: 'res-start-time', label: '開始予定', options: startTimeOptions })}
            ${Components.select({ id: 'res-end-time', label: '終了予定', options: endTimeOptions })}
          </div>
        </div>`;
  };

  const _renderBookingOptionsSection = () => {
    const firstLectureChecked = firstLecture || (!isEdit && isFirstTimeBooking);
    const firstLectureDisabled = !isEdit && isFirstTimeBooking;

    if (classroomType === CONSTANTS.CLASSROOM_TYPES.SESSION_BASED) {
      return `
        <div class="mt-4 pt-4 border-t">
          <h4 class="font-bold text-left mb-2">オプション</h4>
          ${Components.checkbox({ id: 'option-first-lecture', label: CONSTANTS.ITEMS.FIRST_LECTURE, checked: firstLectureChecked, disabled: firstLectureDisabled })}
          <div class="mt-2">${Components.checkbox({ id: 'option-rental', label: `${CONSTANTS.ITEMS.CHISEL_RENTAL} 1回 ¥500`, checked: chiselRental })}</div>
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
        <div class="mt-4 pt-4 border-t space-y-4">
          ${Components.textarea({ id: 'wip-input', label: isFirstTimeBooking && !isEdit ? '今回つくりたいもの/やりたいこと' : 'つくりたいもの/やりたいこと/作業予定', placeholder: 'あとからでも記入できます。当日に相談でも大丈夫！', value: workInProgress || '' })}
          ${Components.textarea({ id: 'material-input', label: '材料のサイズや樹種の希望', placeholder: '例：30×30×40mmくらい」「高さが6cmくらい」「たまごぐらい」 など', value: materialInfo || '' })}
        </div>
        <div class="mt-4 pt-4 border-t space-y-4">
          ${salesChecklistHtml}
          ${Components.textarea({ id: 'order-input', label: '購入希望（自由記入）', placeholder: '（任意）例：彫刻刀セット、テキスト', value: order || '' })}
          ${Components.textarea({ id: 'message-input', label: 'その他の連絡事項や要望など', placeholder: '', value: messageToTeacher || '' })}
        </div>`;
  };

  const _getSelectedSalesOrder = () =>
    Array.from(document.querySelectorAll('input[name="orderSales"]:checked'))
      .map(cb => cb.value)
      .join(', ');

  setTimeout(() => {
    const submitBtn = document.querySelector(`[data-action="${submitAction}"]`);
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        const selectedOrder = _getSelectedSalesOrder();
        const orderInput = document.getElementById('order-input');
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
    buttonsHtml += Components.button({
      text: 'この予約をキャンセルする',
      action: 'cancel',
      style: 'danger',
      size: 'full',
      dataAttributes: {
        reservationId: reservationInfo.reservationId,
        classroom: reservationInfo.classroom,
        date: String(reservationInfo.date),
      },
    });
  }
  buttonsHtml += Components.button({
    text: '戻る',
    action: 'goBackToBooking',
    style: 'secondary',
    size: 'full',
  });

  const _renderOpeningHoursHtml = () => {
    if (!schedule.firstStart || !schedule.firstEnd)
      return '<span class="text-ui-error-text">開講時間未設定</span>';
    if (schedule.secondStart && schedule.secondEnd)
      return `${schedule.firstStart} ~ ${schedule.firstEnd} , ${schedule.secondStart} ~ ${schedule.secondEnd}`;
    return `${schedule.firstStart} ~ ${schedule.firstEnd}`;
  };

  return `
      <h1 class="text-xl font-bold ${DesignConfig.colors.text} mb-4">${title}</h1>
      ${Components.cardContainer({
        variant: 'default',
        padding: 'spacious',
        content: `
          <div class="space-y-4 text-left">
            <p><span class="font-bold w-20 inline-block">お名前:</span> ${currentUser.displayName}さん</p>
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
 * @param {LessonData[]} lessons - 表示する講座情報の配列
 * @returns {string} HTML文字列
 */
const renderBookingLessons = lessons => {
  if (!lessons || lessons.length === 0) {
    return '';
  }

  /** @type {Record<number, LessonData[]>} */
  const lessonsByMonth = lessons.reduce((acc, lesson) => {
    const month = new Date(lesson.schedule.date).getMonth() + 1;
    if (!acc[month]) acc[month] = [];
    acc[month].push(lesson);
    return acc;
  }, /** @type {Record<number, LessonData[]>} */ ({}));

  return Object.keys(lessonsByMonth)
    .sort((a, b) => Number(a) - Number(b))
    .map(monthStr => {
      const month = Number(monthStr);
      const monthHeader = `<h4 class="text-lg font-medium ${DesignConfig.colors.textSubtle} mt-4 mb-2 text-center">${month}月</h4>`;

      const lessonsHtml = lessonsByMonth[month]
        .map(
          /** @param {LessonData} lesson */ lesson => {
            const state = stateManager.getState();
            const isBooked = (state.myReservations || []).some(
              b =>
                String(b.date) === lesson.schedule.date &&
                b.classroom === lesson.schedule.classroom,
            );
            let cardClass, statusBadge, actionAttribute;
            const tag = isBooked ? 'div' : 'button';

            const isFirstTimeBooking =
              stateManager.getState().isFirstTimeBooking;
            let statusText;

            if (isFirstTimeBooking) {
              if (lesson.schedule.beginnerStart) {
                statusText = `初回者 空き ${lesson.status.firstLectureSlots}`;
              } else {
                statusText = '経験者のみ';
              }
            } else {
              if (typeof lesson.status.morningSlots !== 'undefined') {
                const morningLabel = CONSTANTS.SESSIONS.MORNING || '午前';
                const afternoonLabel = CONSTANTS.SESSIONS.AFTERNOON || '午後';
                statusText = `空き ${morningLabel}${lesson.status.morningSlots} ${afternoonLabel}${lesson.status.afternoonSlots}`;
              } else {
                statusText = `空き ${lesson.status.availableSlots}`;
              }
            }

            if (isBooked) {
              const reservationData = findReservationByDateAndClassroom(
                lesson.schedule.date,
                lesson.schedule.classroom,
              );
              if (reservationData?.status === CONSTANTS.STATUS.COMPLETED) {
                cardClass = `${DesignConfig.cards.base} ${DesignConfig.cards.state.booked.card}`;
                statusBadge = `<span class="text-sm font-bold ${DesignConfig.cards.state.booked.text}">受講済み</span>`;
                actionAttribute = '';
              } else if (
                reservationData?.status === CONSTANTS.STATUS.WAITLISTED
              ) {
                cardClass = `${DesignConfig.cards.base} ${DesignConfig.cards.state.waitlist.card}`;
                statusBadge = `<span class="text-sm font-bold ${DesignConfig.cards.state.waitlist.text}">キャンセル待ち 登録済</span>`;
                actionAttribute = '';
              } else {
                cardClass = `${DesignConfig.cards.base} ${DesignConfig.cards.state.booked.card}`;
                statusBadge = `<span class="text-sm font-bold ${DesignConfig.cards.state.booked.text}">予約済み</span>`;
                actionAttribute = '';
              }
            } else {
              let isSlotFull = false;
              let canBook = true;

              if (isFirstTimeBooking) {
                if (!lesson.schedule.beginnerStart) {
                  canBook = false;
                }
                isSlotFull = lesson.status.firstLectureIsFull;
              } else {
                isSlotFull = lesson.status.isFull;
              }

              if (!canBook) {
                cardClass = `${DesignConfig.cards.base} ${DesignConfig.cards.state.waitlist.card} opacity-50`;
                statusBadge = `<span class="text-sm font-bold ${DesignConfig.cards.state.waitlist.text}">${statusText}</span>`;
                actionAttribute = '';
              } else if (isSlotFull) {
                cardClass = `${DesignConfig.cards.base} ${DesignConfig.cards.state.waitlist.card}`;
                statusBadge = `<span class="text-sm font-bold ${DesignConfig.cards.state.waitlist.text}">満席（キャンセル待ち申込み）</span>`;
                actionAttribute = `data-action="bookLesson" data-classroom="${lesson.schedule.classroom}" data-date="${lesson.schedule.date}"`;
              } else {
                cardClass = `${DesignConfig.cards.base} ${DesignConfig.cards.state.available.card}`;
                statusBadge = `<span class="text-sm font-bold ${DesignConfig.cards.state.available.text}">${statusText}</span>`;
                actionAttribute = `data-action="bookLesson" data-classroom="${lesson.schedule.classroom}" data-date="${lesson.schedule.date}"`;
              }
            }

            const venueDisplay = lesson.schedule.venue
              ? ` ${lesson.schedule.venue}`
              : '';
            const text = `<div class="flex justify-between items-center w-full"><span class="${DesignConfig.colors.text}">${formatDate(lesson.schedule.date)}${venueDisplay}</span>${statusBadge}</div>`;

            return `<${tag} ${actionAttribute} class="${cardClass}">${text}</${tag}>`;
          },
        )
        .join('');

      return monthHeader + lessonsHtml;
    })
    .join('');
};

/**
 * 教室選択モーダル用のコンテンツを生成します。
 * @returns {string} HTML文字列
 */
const getClassroomSelectionModalContent = () => {
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
      <div class="text-center mb-6">
        <p class="text-brand-subtle text-lg mb-2">教室 を おえらびください</p>
      </div>
      <div class="space-y-4">
        ${classroomButtonsHtml}
      </div>
    `;
};

/**
 * 教室選択モーダル全体のHTMLを生成します。
 * @returns {string} HTML文字列
 */
const getClassroomSelectionModal = () => {
  return Components.modal({
    id: 'classroom-selection-modal',
    title: '',
    content: getClassroomSelectionModalContent(),
    maxWidth: 'max-w-md',
  });
};

/**
 * 編集モード対応の履歴カードを生成します
 * @param {ReservationData} historyItem - 履歴データ
 * @param {Array<any>} editButtons - 編集ボタン配列
 * @param {Array<any>} accountingButtons - 会計ボタン配列
 * @param {boolean} isInEditMode - 編集モード状態
 * @returns {string} HTML文字列
 */
const _buildHistoryCardWithEditMode = (
  historyItem,
  editButtons,
  accountingButtons,
  isInEditMode,
) => {
  const cardColorClass = `record-card ${DesignConfig.cards.state.history.card}`;

  const editButtonsHtml = editButtons
    .map(btn =>
      Components.button({
        action: btn.action,
        text: btn.text,
        style: btn.style || 'secondary',
        size: btn.size || 'xs',
        dataAttributes: {
          classroom: historyItem.classroom,
          reservationId: historyItem.reservationId,
          date: String(historyItem.date),
          ...(btn.details && { details: JSON.stringify(btn.details) }),
        },
      }),
    )
    .join('');

  let allAccountingButtons = [...accountingButtons];

  if (isInEditMode) {
    const isToday = _isToday(String(historyItem.date));
    if (historyItem.status === CONSTANTS.STATUS.COMPLETED && !isToday) {
      allAccountingButtons.push({
        action: 'showHistoryAccounting',
        text: '会計詳細',
        style: 'secondary',
        size: 'xs',
        details: historyItem.accountingDetails,
      });
    }
  }

  const accountingButtonsHtml = allAccountingButtons
    .map(btn =>
      Components.button({
        action: btn.action,
        text: btn.text,
        style: btn.style || 'primary',
        size: 'small',
        dataAttributes: {
          classroom: historyItem.classroom,
          reservationId: historyItem.reservationId,
          date: String(historyItem.date),
          ...(btn.details && { details: JSON.stringify(btn.details) }),
        },
      }),
    )
    .join('');

  const dateTimeDisplay = historyItem.startTime
    ? ` ${historyItem.startTime} ~ ${historyItem.endTime}`.trim()
    : '';
  const classroomDisplay = historyItem.classroom
    ? ` ${historyItem.classroom}`
    : '';
  const venueDisplay = historyItem.venue ? ` ${historyItem.venue}` : '';

  const memoSection = Components.memoSection({
    reservationId: historyItem.reservationId,
    workInProgress: historyItem.workInProgress,
    isEditMode: isInEditMode,
  });

  return `
    <div class="w-full mb-4 px-0">
      <div class="${cardColorClass} p-2 rounded-lg shadow-sm" data-reservation-id="${historyItem.reservationId}">
        <div class="flex justify-between items-start mb-0">
          <div class="flex-1 min-w-0">
            <div class="flex items-center flex-wrap">
              <h3 class="font-bold text-brand-text">${formatDate(String(historyItem.date))} <span class="font-normal text-brand-subtle">${dateTimeDisplay}</span></h3>
            </div>
            <h4 class="text-base text-brand-text font-bold mt-0">${escapeHTML(classroomDisplay)}${escapeHTML(venueDisplay)}</h4>
          </div>
          ${editButtonsHtml ? `<div class="flex-shrink-0 self-start">${editButtonsHtml}</div>` : ''}
        </div>

        ${memoSection}

        ${accountingButtonsHtml ? `<div class="flex justify-end">${accountingButtonsHtml}</div>` : ''}
      </div>
    </div>
  `;
};
