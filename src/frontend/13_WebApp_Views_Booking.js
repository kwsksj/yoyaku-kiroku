// @ts-check
/// <reference path="../../types/dev-environment.d.ts" />
/// <reference path="../../types/html-environment.d.ts" />
/// <reference path="../../types/api-types.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 13_WebApp_Views_Booking.js
 * 【バージョン】: 1.0
 * 【役割】: 予約関連のビュー（予約枠一覧、予約フォーム、教室選択）
 * 【構成】: Views.jsから分割された予約機能
 * =================================================================
 */

/**
 * 特定の教室の予約枠一覧画面のUIを生成します。
 * @param {string} classroom - 教室名
 * @returns {string} HTML文字列
 */
const getBookingView = classroom => {
  // バックエンドで計算済みの空き情報を直接使用
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
 * @param {string} mode - 'new' または 'edit'
 * @returns {string} HTML文字列
 */
const getReservationFormView = (mode = 'new') => {
  const isEdit = mode === 'edit';

  // --- 1. データの準備 ---
  // 編集時は editingReservationDetails から、新規作成時は selectedLesson からデータを取得
  const sourceData = isEdit
    ? stateManager.getState().editingReservationDetails
    : stateManager.getState().selectedLesson;
  if (!sourceData) return 'エラー: 予約情報が見つかりません。';

  // データ構造に応じた取得方法の分岐
  const classroom = isEdit
    ? sourceData.classroom
    : sourceData.schedule?.classroom;
  const date = isEdit ? sourceData.date : sourceData.schedule?.date;
  const venue = isEdit ? sourceData.venue : sourceData.schedule?.venue;
  const {
    isWaiting,
    firstLecture,
    chiselRental,
    workInProgress,
    materialInfo,
    order,
    messageToTeacher,
  } = sourceData;

  // 時間情報は統合定数を使用して取得
  const startTime =
    sourceData[CONSTANTS.HEADERS.RESERVATIONS?.START_TIME] ||
    sourceData.startTime;
  const endTime =
    sourceData[CONSTANTS.HEADERS.RESERVATIONS?.END_TIME] || sourceData.endTime;
  const {
    currentUser,
    accountingMaster: master,
    isFirstTimeBooking,
  } = window.stateManager.getState();

  // 日程マスタベースの教室形式判定に変更
  const isTimeBased = isTimeBasedClassroom(sourceData);

  // デバッグ情報（開発時のみ）
  if (!window.isProduction) {
    console.log('🔍 getReservationFormView デバッグ情報:', {
      mode,
      isEdit,
      sourceData: sourceData
        ? {
            classroom: sourceData.classroom,
            date: sourceData.date,
            classroomType: sourceData.classroomType,
            firstStart: sourceData.firstStart,
            firstEnd: sourceData.firstEnd,
          }
        : null,
      isTimeBased,
      scheduleInfoExists: !!(sourceData?.firstStart && sourceData?.firstEnd),
    });
  }

  // 新規作成時のみ利用するデータ（階層構造から取得）
  const selectedLesson = stateManager.getState().selectedLesson;
  const {
    availableSlots,
    morningSlots,
    afternoonSlots,
    firstLectureSlots,
    isFull,
    firstLectureIsFull,
  } = selectedLesson?.status || {};

  // --- 2. モードに応じた設定 ---
  const title = isEdit
    ? '予約内容の編集'
    : isFull || (isFirstTimeBooking && firstLectureIsFull)
      ? 'キャンセル待ち申込み'
      : '予約詳細の入力';
  const submitAction = isEdit ? 'updateReservation' : 'confirmBooking';
  const submitButtonText = isEdit
    ? 'この内容で更新する'
    : isFull
      ? 'キャンセル待ちで登録する'
      : 'この内容で予約する';

  // --- 3. UI生成ヘルパー関数 ---
  /**
   * 予約状況の表示を生成します。
   */
  const _renderStatusHtml = () => {
    if (isEdit) {
      return sourceData.isWaiting ? 'キャンセル待ち' : '予約済み';
    }

    if (isFirstTimeBooking) {
      if (firstLectureIsFull) {
        return '初回者枠 満席（キャンセル待ち申込み）';
      }
      return `初回者枠 空き ${firstLectureSlots}`;
    }

    if (isFull) return '満席（キャンセル待ち申込み）';

    if (typeof morningSlots !== 'undefined') {
      const morningLabel = CONSTANTS.SESSIONS.MORNING || '午前';
      const afternoonLabel = CONSTANTS.SESSIONS.AFTERNOON || '午後';
      return `空き ${morningLabel} ${morningSlots} | ${afternoonLabel} ${afternoonSlots}`;
    }

    return `空き ${availableSlots}`;
  };

  /**
   * 授業料表示セクションを生成します。
   */
  const _renderTuitionDisplaySection = () => {
    // 教室形式の判定
    if (isTimeBased) {
      // 時間制の場合：基本授業料を表示
      const basicTuitionRule = master.find(
        item =>
          item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME] ===
            CONSTANTS.ITEMS.MAIN_LECTURE &&
          item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM] &&
          item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM].includes(
            classroom,
          ),
      );

      if (basicTuitionRule) {
        const price =
          basicTuitionRule[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE] || 0;
        return `
            <div class="mt-4 pt-4 border-t">
              <h4 class="font-bold ${DesignConfig.colors.text} mb-2">授業料</h4>
              <div class="mb-3 p-3 bg-blue-50 rounded border-l-4 border-blue-400">
                <div class="text-base text-blue-800">
                  <span class="font-semibold">${CONSTANTS.ITEMS.MAIN_LECTURE}:</span> ¥${price.toLocaleString()} / 30分
                </div>
              </div>
            </div>`;
      }
    } else {
      // 固定制の場合：初回授業料または基本授業料を表示
      const targetItemName = isFirstTimeBooking
        ? CONSTANTS.ITEMS.FIRST_LECTURE
        : CONSTANTS.ITEMS.MAIN_LECTURE;
      const tuitionItem = master.find(
        item =>
          item[CONSTANTS.HEADERS.ACCOUNTING.TYPE] ===
            CONSTANTS.ITEM_TYPES.TUITION &&
          item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME] === targetItemName &&
          (item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM] === '共通' ||
            item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM]?.includes(
              classroom,
            )),
      );

      if (tuitionItem) {
        const price = tuitionItem[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE] || 0;
        const bgColor = isFirstTimeBooking
          ? 'bg-green-50 border-green-400'
          : 'bg-blue-50 border-blue-400';
        const textColor = isFirstTimeBooking
          ? 'text-green-800'
          : 'text-blue-800';
        const label = targetItemName;

        return `
            <div class="mt-4 pt-4 border-t">
              <h4 class="font-bold ${DesignConfig.colors.text} mb-2">授業料</h4>
              <div class="mb-3 p-3 ${bgColor} rounded border-l-4">
                <div class="text-base ${textColor}">
                  <span class="font-semibold">${label}:</span> ¥${price.toLocaleString()}
                </div>
              </div>
            </div>`;
      }
    }
    return '';
  };

  /**
   * 予約時間選択のUIを生成します。
   */
  const _renderTimeOptionsSection = () => {
    // 時間制の教室の場合
    if (isTimeBased) {
      const scheduleData = isEdit ? sourceData : sourceData.schedule;
      if (!scheduleData || !scheduleData.firstStart || !scheduleData.firstEnd) {
        return `<div class="text-ui-error-text p-4 bg-ui-error-bg rounded-lg">エラー: この教室の時間設定が不正です</div>`;
      }

      const startParts = scheduleData.firstStart.split(':');
      const endParts =
        !scheduleData.secondStart || !scheduleData.secondEnd
          ? scheduleData.firstEnd.split(':') // 1部制の場合
          : scheduleData.secondEnd.split(':'); // 2部制の場合
      const classStartHour = parseInt(startParts[0] || '0');
      const classEndHour = parseInt(endParts[0] || '0');
      const classEndMinutes = parseInt(endParts[1] || '0');

      // 初回者の場合は開始時刻を固定（日程マスタのBEGINNER_START項目を使用）
      let fixedStartTime = startTime;
      let isTimeFixed = false;
      const beginnerStart = isEdit
        ? sourceData.beginnerStart
        : sourceData.schedule?.beginnerStart;
      if (isFirstTimeBooking && beginnerStart) {
        fixedStartTime = beginnerStart;
        isTimeFixed = true;
      }

      // デバッグ情報（開発時のみ）
      if (!window.isProduction && isFirstTimeBooking) {
        console.log('🔍 初回者用時刻設定:', {
          isFirstTimeBooking,
          isEdit,
          firstStart: scheduleData.firstStart,
          secondStart: scheduleData.secondStart,
          beginnerStart: beginnerStart,
          fixedStartTime,
          isTimeFixed,
        });
      }

      // 初回者の場合は固定時刻のオプションのみ、経験者は通常の選択肢
      let startTimeOptions;
      if (isTimeFixed) {
        // 初回者：固定時刻のオプションのみ
        startTimeOptions = `
            <option value="${fixedStartTime}"'selected'>
              ${fixedStartTime}
            </option>`;
      } else {
        // 経験者：通常の選択肢
        startTimeOptions = getTimeOptionsHtml(
          classStartHour,
          classEndHour,
          CONSTANTS.FRONTEND_UI.TIME_SETTINGS.STEP_MINUTES,
          startTime,
        );
      }
      let endTimeOptions = getTimeOptionsHtml(
        classStartHour,
        classEndHour,
        CONSTANTS.FRONTEND_UI.TIME_SETTINGS.STEP_MINUTES,
        endTime,
      );
      if (classEndMinutes > 0) {
        const finalEndTime = `${String(classEndHour).padStart(2, '0')}:${String(classEndMinutes).padStart(2, '0')}`;
        endTimeOptions += `<option value="${finalEndTime}">${finalEndTime}</option>`;
      }

      const discountRule = master.find(
        item =>
          item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME] ===
            CONSTANTS.ITEMS.DISCOUNT &&
          item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM] &&
          item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM].includes(
            classroom,
          ),
      );
      let discountHtml = '';
      if (discountRule && !isFirstTimeBooking) {
        discountHtml = `<p class="${DesignConfig.text.caption}">${discountRule[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME]}: 初回参加者と同時刻に参加の場合、¥500割引</p>`;
      }

      // 初回者の場合の開始時刻固定メッセージ
      const timeFixedMessage = isTimeFixed
        ? `<p class="${DesignConfig.text.caption} mb-2">初回の方は ${fixedStartTime} より開始です。昼をまたぐ場合は、1時間休憩を挟みます</p>`
        : '';

      return `
          <div class="mt-4 pt-4 border-t">
            <h4 class="font-bold ${DesignConfig.colors.text} mb-2">予約時間</h4>
            ${timeFixedMessage}
            <div class="grid grid-cols-2 gap-4 mb-2">
              ${Components.select({
                id: 'res-start-time',
                label: '開始予定',
                options: startTimeOptions,
              })}
              ${Components.select({
                id: 'res-end-time',
                label: '終了予定',
                options: endTimeOptions,
              })}
            </div>
            ${discountHtml}
          </div>`;
    }
    return ''; // 上記以外の場合は時間選択なし
  };

  /**
   * 予約オプションのUIを生成します。
   */
  const _renderBookingOptionsSection = () => {
    let optionsHtml = '';

    // 編集モード時は実際の予約データを反映、新規作成時は初回受講判定を使用
    const firstLectureChecked = isEdit
      ? firstLecture
        ? 'checked'
        : ''
      : firstLecture || isFirstTimeBooking
        ? 'checked'
        : '';
    const firstLectureDisabled = isEdit
      ? ''
      : isFirstTimeBooking
        ? 'disabled'
        : '';
    const chiselRentalChecked = chiselRental ? 'checked' : '';

    // デバッグ情報（開発時のみ）
    if (!window.isProduction) {
      console.log('🔍 オプションセクション - 教室タイプ判定:', {
        classroomType: sourceData.classroomType,
        expectedSessionBased: CONSTANTS.CLASSROOM_TYPES.SESSION_BASED,
        isMatch:
          sourceData.classroomType === CONSTANTS.CLASSROOM_TYPES.SESSION_BASED,
        CONSTANTSAvailable: !!CONSTANTS.CLASSROOM_TYPES,
      });
    }

    if (sourceData.classroomType === CONSTANTS.CLASSROOM_TYPES.SESSION_BASED) {
      const firstLectureLabel = isFirstTimeBooking
        ? `<span>${CONSTANTS.ITEMS.FIRST_LECTURE}</span><span class="${DesignConfig.text.caption} ml-2"></span>`
        : `<span>${CONSTANTS.ITEMS.FIRST_LECTURE}</span>`;
      optionsHtml += `<label class="flex items-center space-x-2"><input type="checkbox" id="option-first-lecture" ${firstLectureChecked} ${firstLectureDisabled}>${firstLectureLabel}</label>`;
    }
    optionsHtml += `<div class="mt-2"><label class="flex items-center space-x-2"><input type="checkbox" id="option-rental" ${chiselRentalChecked}><span>${CONSTANTS.ITEMS.CHISEL_RENTAL} 1回 ¥500</span></label></div>`;

    // 割引の説明を追加
    optionsHtml += `<div class="mt-3 pt-2 border-t border-ui-border-light"><p class="${DesignConfig.text.caption}">${CONSTANTS.ITEMS.DISCOUNT}: 初回参加者と同時刻に参加の場合、¥500割引</p></div>`;

    return `
        <div class="mt-4 pt-4 border-t">
          <h4 class="font-bold text-left mb-2">オプション</h4>
          ${optionsHtml}
        </div>`;
  };

  /**
   * 詳細入力欄のUIを生成します。
   * 購入希望欄を折り畳み物販チェックリスト＋自由記入欄に変更
   */
  const _renderDetailsInputSection = () => {
    // 物販チェックリスト（折り畳み）
    const salesChecklistHtml =
      typeof buildSalesChecklist === 'function'
        ? buildSalesChecklist(stateManager.getState().accountingMaster)
        : '';

    return `
        <div class="mt-4 pt-4 border-t space-y-4">
          ${Components.textarea({
            id: 'wip-input',
            label:
              isFirstTimeBooking && !isEdit
                ? '今回つくりたいもの/やりたいこと'
                : 'つくりたいもの/やりたいこと/作業予定',
            placeholder: 'あとからでも記入できます。当日に相談でも大丈夫！',
            value: workInProgress || '',
          })}
          ${Components.textarea({
            id: 'material-input',
            label: '材料のサイズや樹種の希望',
            placeholder:
              '例：30×30×40mmくらい」「高さが6cmくらい」「たまごぐらい」 など',
            value: materialInfo || '',
          })}
        </div>
        <div class="mt-4 pt-4 border-t space-y-4">
          ${salesChecklistHtml}
          ${Components.textarea({ id: 'order-input', label: '購入希望（自由記入）', placeholder: '（任意）例：彫刻刀セット、テキスト', value: order || '' })}
          ${Components.textarea({ id: 'message-input', label: 'その他の連絡事項や要望など', placeholder: '', value: messageToTeacher || '' })}
        </div>`;
  };
  // 予約送信時にチェックされた物販をorderに渡す処理を追加
  const _getSelectedSalesOrder = () => {
    const checked = Array.from(
      document.querySelectorAll('input[name="orderSales"]:checked'),
    );
    return checked.map(cb => cb.value).join(', ');
  };

  // 送信ボタンのクリック時にorder値をセット
  setTimeout(() => {
    const submitBtn = document.querySelector(
      '[data-action="confirmBooking"], [data-action="updateReservation"]',
    );
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        const selectedOrder = _getSelectedSalesOrder();
        const orderInput = document.getElementById('order-input');
        if (orderInput) {
          // 既存の自由記入とチェックリストを合成
          const freeText = orderInput.value.trim();
          orderInput.value = selectedOrder
            ? freeText
              ? selectedOrder + ', ' + freeText
              : selectedOrder
            : freeText;
        }
      });
    }
  }, 300);

  // --- 4. メインHTMLの組み立て ---
  let buttonsHtml = `
      ${Components.button({ text: submitButtonText, action: submitAction, style: 'primary', size: 'full' })}
    `;
  // 編集時のみキャンセルボタンを追加
  if (isEdit) {
    buttonsHtml += Components.button({
      text: 'この予約をキャンセルする',
      action: 'cancel',
      style: 'danger',
      size: 'full',
      dataAttributes: {
        reservationId: sourceData.reservationId,
        classroom: sourceData.classroom,
        date: sourceData.date,
        sheetName: sourceData.sheetName,
      },
    });
  }
  // 戻るボタン：編集時はホームへ、新規作成時は予約一覧へ
  buttonsHtml += Components.button({
    text: '戻る',
    action: isEdit ? 'goBackToDashboard' : 'goBackToBooking',
    style: 'secondary',
    size: 'full',
  });

  const venueDisplay = venue ? ` ${venue}` : '';

  const _renderOpeningHoursHtml = () => {
    const scheduleData = isEdit ? sourceData : sourceData.schedule;

    if (!scheduleData || !scheduleData.firstStart || !scheduleData.firstEnd) {
      return '<span class="text-ui-error-text">開講時間未設定</span>';
    }

    if (scheduleData.secondStart && scheduleData.secondEnd) {
      // 2部制の場合
      return `${scheduleData.firstStart} ~ ${scheduleData.firstEnd} , ${scheduleData.secondStart} ~ ${scheduleData.secondEnd}`;
    } else {
      // 1部制の場合
      return `${scheduleData.firstStart} ~ ${scheduleData.firstEnd}`;
    }
  };

  // --- Main View Assembly ---
  return `
      <h1 class="text-xl font-bold ${DesignConfig.colors.text} mb-4">${title}</h1>
      ${Components.cardContainer({
        variant: 'default',
        padding: 'spacious',
        content: `
          <div class="space-y-4 text-left">
            <p><span class="font-bold w-20 inline-block">お名前:</span> ${currentUser.displayName}さん</p>
            <p><span class="font-bold w-20 inline-block">教室:</span> ${classroom}${venueDisplay}</p>
            <p><span class="font-bold w-20 inline-block">日付:</span> ${formatDate(date)}</p>
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
 * @param {Array<object>} lessons - 表示する講座情報の配列
 * @returns {string} HTML文字列
 */
const renderBookingLessons = lessons => {
  if (!lessons || lessons.length === 0) {
    return '';
  }

  // 受け取ったalessonsを月別にグループ化
  const lessonsByMonth = lessons.reduce((acc, lesson) => {
    const month = new Date(lesson.schedule.date).getMonth() + 1;
    if (!acc[month]) acc[month] = [];
    acc[month].push(lesson);
    return acc;
  }, {});

  return Object.keys(lessonsByMonth)
    .sort((a, b) => a - b)
    .map(month => {
      const monthHeader = `<h4 class="text-lg font-medium ${DesignConfig.colors.textSubtle} mt-4 mb-2 text-center">${month}月</h4>`;

      const lessonsHtml = lessonsByMonth[month]
        .map(lesson => {
          const state = stateManager.getState();
          const iB = (state.myReservations || []).some(
            b =>
              b.date === lesson.schedule.date &&
              b.classroom === lesson.schedule.classroom,
          );
          let cC, sB, act;
          const tag = iB ? 'div' : 'button';

          // 初回者・経験者別の表示制御
          const isFirstTimeBooking = stateManager.getState().isFirstTimeBooking;
          let statusText;

          // デバッグ情報（開発時のみ）
          if (!window.isProduction && isFirstTimeBooking) {
            console.log('🔍 初回者講座情報:', {
              date: lesson.schedule.date,
              classroom: lesson.schedule.classroom,
              firstLectureSlots: lesson.status.firstLectureSlots,
              isFirstTimeBooking,
            });
          }

          if (isFirstTimeBooking) {
            // 初回者（はじめての方）の場合
            if (lesson.schedule.beginnerCapacity > 0) {
              // 初回者の定員が1以上の日程：初回者枠に基づく空席情報を提示
              statusText = `初回者 空き ${lesson.status.firstLectureSlots}`;
            } else {
              // 初回者の定員が0の日程：「経験者のみ」として表示
              statusText = '経験者のみ';
            }
          } else {
            // 経験者の場合：全体（本講座）の参加者数に基づく表示
            if (
              typeof lesson.status.morningSlots !== 'undefined' &&
              typeof lesson.status.afternoonSlots !== 'undefined'
            ) {
              // ２部制の場合の例「空き 午前3 午後 4」
              const morningLabel = CONSTANTS.SESSIONS.MORNING || '午前';
              const afternoonLabel = CONSTANTS.SESSIONS.AFTERNOON || '午後';
              statusText = `空き ${morningLabel}${lesson.status.morningSlots} ${afternoonLabel}${lesson.status.afternoonSlots}`;
            } else if (typeof lesson.status.availableSlots !== 'undefined') {
              // セッション制、全日制の場合の例「空き 3」
              statusText = `空き ${lesson.status.availableSlots}`;
            } else {
              // フォールバック
              statusText = '空き状況不明';
            }
            // 経験者には初回者の空き情報は提示しない（既存のコメントアウト）
          }

          if (iB) {
            // 【修正】予約済み・記録済みの場合（統一検索関数を使用）
            const reservationData = findReservationByDateAndClassroom(
              lesson.schedule.date,
              lesson.schedule.classroom,
            );

            console.log(
              `🔍 Lesson検索結果 - ${lesson.schedule.date} ${lesson.schedule.classroom}:`,
              reservationData
                ? {
                    status: reservationData.status,
                    type: reservationData.type,
                  }
                : 'なし',
            );

            if (
              reservationData &&
              reservationData.status === CONSTANTS.STATUS.COMPLETED
            ) {
              // 完了済みの記録の場合
              cC = `${DesignConfig.cards.base} ${DesignConfig.cards.state.booked.card}`;
              sB = `<span class="text-sm font-bold ${DesignConfig.cards.state.booked.text}">受講済み</span>`;
              act = '';
            } else if (
              reservationData &&
              reservationData.status === CONSTANTS.STATUS.WAITLISTED
            ) {
              // キャンセル待ちの場合
              cC = `${DesignConfig.cards.base} ${DesignConfig.cards.state.waitlist.card}`;
              sB = `<span class="text-sm font-bold ${DesignConfig.cards.state.waitlist.text}">キャンセル待ち 登録済</span>`;
              act = '';
            } else {
              // 確定予約の場合
              cC = `${DesignConfig.cards.base} ${DesignConfig.cards.state.booked.card}`;
              sB = `<span class="text-sm font-bold ${DesignConfig.cards.state.booked.text}">予約済み</span>`;
              act = '';
            }
          } else {
            // 初回者・経験者別の満席判定とUI状態決定
            let isSlotFull = false;
            let canBook = true;

            if (isFirstTimeBooking) {
              // 初回者の場合：初回者枠に基づく判定
              if (lesson.schedule.beginnerCapacity <= 0) {
                // 初回講習枠が0の場合は「経験者のみ」でクリック不可
                canBook = false;
              }
              // 初回講習枠が満席の場合はキャンセル待ち
              isSlotFull = lesson.status.firstLectureIsFull;
            } else {
              // 経験者の場合：全体枠に基づく判定
              isSlotFull = lesson.status.isFull;
            }

            if (!canBook) {
              // 初回者で初回講習枠が0の場合（経験者のみ）：クリック不可
              cC = `${DesignConfig.cards.base} ${DesignConfig.cards.state.waitlist.card} opacity-50`;
              sB = `<span class="text-sm font-bold ${DesignConfig.cards.state.waitlist.text}">${statusText}</span>`;
              act = '';
            } else if (isSlotFull) {
              // 満席（キャンセル待ち）の場合
              cC = `${DesignConfig.cards.base} ${DesignConfig.cards.state.waitlist.card}`;
              sB = `<span class="text-sm font-bold ${DesignConfig.cards.state.waitlist.text}">満席（キャンセル待ち申込み）</span>`;
              act = `data-action="bookLesson" data-classroom="${lesson.schedule.classroom}" data-date="${lesson.schedule.date}"`;
            } else {
              // 予約可能な場合
              cC = `${DesignConfig.cards.base} ${DesignConfig.cards.state.available.card}`;
              sB = `<span class="text-sm font-bold ${DesignConfig.cards.state.available.text}">${statusText}</span>`;
              act = `data-action="bookLesson" data-classroom="${lesson.schedule.classroom}" data-date="${lesson.schedule.date}"`;
            }
          }

          const venueDisplay = lesson.schedule.venue
            ? ` ${lesson.schedule.venue}`
            : '';
          const text = `<div class="flex justify-between items-center w-full"><span class="${DesignConfig.colors.text}">${formatDate(lesson.schedule.date)}${venueDisplay}</span>${sB}</div>`;

          // getBookingViewのロジックをベースに、buttonとdivを使い分ける
          return `<${tag} ${act} class="${cC}">${text}</${tag}>`;
        })
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

  // 指定された順序で教室を並べ替え（東京、つくば、沼津）
  const desiredOrder = ['東京教室', 'つくば教室', '沼津教室'];
  const sortedClassrooms = classrooms.sort((a, b) => {
    const indexA = desiredOrder.indexOf(a);
    const indexB = desiredOrder.indexOf(b);

    // 指定された順序にない教室は最後に配置
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;

    return indexA - indexB;
  });

  const classroomButtonsHtml = sortedClassrooms
    .map(classroomName => {
      const colorClass = getClassroomColorClass(classroomName);
      const fullButtonClass = `w-full h-16 text-center px-6 py-4 rounded-xl mobile-card touch-friendly flex items-center justify-center text-xl font-bold border-2 transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95 ${colorClass}`;

      const buttonHtml = Components.button({
        action: 'selectClassroom',
        text: classroomName,
        style: 'none', // デフォルトスタイルを無効化
        customClass: fullButtonClass,
        dataAttributes: {
          classroomName: classroomName,
          classroom: classroomName, // フォールバック用
        },
      });

      // デバッグ用: 生成されたHTMLを確認
      if (!window.isProduction && typeof console !== 'undefined') {
        console.log(
          `🔘 ${classroomName}ボタンHTML:`,
          buttonHtml.substring(0, 300),
        );
        console.log(`🔘 ${classroomName}カラークラス:`, colorClass);
      }

      return buttonHtml;
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
    maxWidth: 'max-w-md', // より大きなサイズに変更
  });
};

/**
 * 編集モード対応の履歴カードを生成します
 * @param {object} historyItem - 履歴データ
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
  const isHistory = true;
  const badges = [];

  // カード基本スタイル
  const cardColorClass = `record-card ${DesignConfig.cards.state.history.card}`;

  // 編集ボタンHTML生成
  const editButtonsHtml = editButtons
    .map(btn =>
      Components.button({
        action: btn.action,
        text: btn.text,
        style: btn.style || 'secondary',
        size: btn.size || 'xs',
        dataAttributes: {
          classroom: historyItem['classroom'],
          reservationId: historyItem['reservationId'],
          date: historyItem['date'],
          ...(btn.details && { details: JSON.stringify(btn.details) }),
        },
      }),
    )
    .join('');

  // 会計ボタンHTML生成（編集モード時に追加分を含む）
  let allAccountingButtons = [...accountingButtons];

  // 編集モード時は追加の会計詳細ボタンを含める（当日以外）
  if (isInEditMode) {
    const isToday = _isToday(historyItem['date']);
    if (historyItem['status'] === CONSTANTS.STATUS.COMPLETED && !isToday) {
      allAccountingButtons.push({
        action: 'showHistoryAccounting',
        text: '会計詳細',
        style: 'secondary',
        size: 'xs',
        details: historyItem['accountingDetails'],
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
          classroom: historyItem['classroom'],
          reservationId: historyItem['reservationId'],
          date: historyItem['date'],
          ...(btn.details && { details: JSON.stringify(btn.details) }),
        },
      }),
    )
    .join('');

  // 日時・会場表示
  const dateTimeDisplay = historyItem['startTime']
    ? ` ${historyItem['startTime']} ~ ${historyItem['endTime']}`.trim()
    : '';
  const classroomDisplay = historyItem['classroom']
    ? ` ${historyItem['classroom']}`
    : '';
  const venueDisplay = historyItem['venue'] ? ` ${historyItem['venue']}` : '';

  // 制作メモセクション（編集モード対応）
  const memoSection = Components.memoSection({
    reservationId: historyItem['reservationId'],
    workInProgress: historyItem['workInProgress'],
    isEditMode: isInEditMode,
  });

  return `
    <div class="w-full mb-4 px-0">
      <div class="${cardColorClass} p-2 rounded-lg shadow-sm" data-reservation-id="${historyItem['reservationId']}">
        <!-- 上部：教室情報+編集ボタン -->
        <div class="flex justify-between items-start mb-0">
          <div class="flex-1 min-w-0">
            <div class="flex items-center flex-wrap">
              <h3 class="font-bold text-brand-text">${formatDate(historyItem['date'])} <span class="font-normal text-brand-subtle">${dateTimeDisplay}</span></h3>
            </div>
            <h4 class="text-base text-brand-text font-bold mt-0">${escapeHTML(classroomDisplay)}${escapeHTML(venueDisplay)}</h4>
          </div>
          ${editButtonsHtml ? `<div class="flex-shrink-0 self-start">${editButtonsHtml}</div>` : ''}
        </div>

        ${memoSection}

        <!-- 会計ボタンセクション -->
        ${
          accountingButtonsHtml
            ? `
          <div class="flex justify-end">
            ${accountingButtonsHtml}
          </div>
        `
            : ''
        }
      </div>
    </div>
  `;
};
