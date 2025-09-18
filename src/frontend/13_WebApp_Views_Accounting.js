// @ts-check
/// <reference path="../../types/dev-environment.d.ts" />
/// <reference path="../../types/html-environment.d.ts" />
/// <reference path="../../types/api-types.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 13_WebApp_Views_Accounting.js
 * 【バージョン】: 1.0
 * 【役割】: 会計関連のビュー（会計画面、完了画面）
 * 【構成】: Views.jsから分割された会計機能
 * =================================================================
 */

/**
 * 会計画面のUIを生成します。
 * @returns {string} HTML文字列
 */
const getAccountingView = () => {
  // 基本データの確認
  const state = stateManager.getState();

  // デバッグ情報を表示（開発環境のみ）
  if (!window.isProduction) {
    console.log('🔍 会計画面デバッグ情報:', {
      accountingMaster: !!state.accountingMaster,
      accountingReservation: !!state.accountingReservation,
      accountingReservationDetails: !!state.accountingReservationDetails,
      accountingScheduleInfo: !!state.accountingScheduleInfo,
      // より詳細な情報
      masterLength: state.accountingMaster ? state.accountingMaster.length : 0,
      reservationId: state.accountingReservation
        ? state.accountingReservation.reservationId
        : 'なし',
      reservationDetailsKeys: state.accountingReservationDetails
        ? Object.keys(state.accountingReservationDetails)
        : [],
      scheduleInfoType: state.accountingScheduleInfo
        ? state.accountingScheduleInfo.classroomType
        : 'なし',
    });
  }

  // 最低限必要なデータの確認
  if (!state.accountingMaster || !state.accountingReservation) {
    return '<div class="flex justify-center items-center h-full"><div class="spinner"></div><p class="ml-3 text-brand-text">会計データを読み込んでいます...</p></div>';
  }

  const reservation = state.accountingReservation;
  const master = state.accountingMaster;
  const reservationDetails = state.accountingReservationDetails || {};
  const scheduleInfo = state.accountingScheduleInfo || null;

  // データが不完全な場合のエラー処理
  if (!reservationDetails || Object.keys(reservationDetails).length === 0) {
    console.warn('⚠️ reservationDetailsが空です');
  }

  if (!scheduleInfo) {
    console.warn('⚠️ scheduleInfoがnullです');
  }
  // 【修正】統一検索関数を使用してよやく・きろく両方から検索
  const bookingOrRecord = findReservationById(reservation.reservationId, state);
  if (!bookingOrRecord) {
    return `
        <div class="text-center py-8">
          <p class="text-red-600">予約・記録情報が見つかりませんでした</p>
          <button onclick="handleAction('goBackToDashboard')"
                  class="mt-4 px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
            戻る
          </button>
        </div>
      `;
  }

  // 会計済みの場合 - 完全分離（編集モードでない場合のみ）
  if (
    bookingOrRecord.status === CONSTANTS.STATUS.COMPLETED &&
    bookingOrRecord.accountingDetails &&
    !state.isEditingAccountingRecord
  ) {
    try {
      const details = JSON.parse(bookingOrRecord.accountingDetails);
      return `
          ${Components.accountingCompleted({ details, reservation })}
          <div class="mt-8 flex flex-col space-y-3">
            ${Components.button({
              text: '戻る',
              action: 'goBackToDashboard',
              style: 'secondary',
              size: 'full',
            })}
          </div>`;
    } catch (e) {
      return '<div class="text-center text-state-danger-text">会計詳細の表示に失敗しました。</div>';
    }
  }

  // 新規会計フォーム - 条件分岐の簡素化
  const tuitionItemRule = getTuitionItemRule(
    master,
    reservation.classroom,
    CONSTANTS.ITEMS.MAIN_LECTURE,
  );
  const isTimeBased =
    tuitionItemRule && tuitionItemRule['単位'] === CONSTANTS.UNITS.THIRTY_MIN;
  const formType = isTimeBased ? 'timeBased' : 'fixed';

  return `
      ${Components.navigationHeader({ title: '会計', backAction: 'goBackToDashboard' })}
      ${Components.accountingForm({
        type: formType,
        master,
        reservation,
        reservationDetails,
        scheduleInfo,
      })}
      <div class="mt-8 flex flex-col space-y-3">
        ${Components.button({
          text: '戻る',
          action: 'goBackToDashboard',
          style: 'secondary',
          size: 'full',
        })}
      </div>`;
};

/**
 * 完了画面のUIを生成します。
 * @param {string} msg - 表示するメッセージ
 * @returns {string} HTML文字列
 */
const getCompleteView = msg => {
  // 教室情報を取得（会計処理時は accountingReservation から、予約作成時は selectedLesson から）
  const classroom =
    stateManager.getState().accountingReservation?.classroom ||
    stateManager.getState().selectedLesson?.classroom;

  // 初回予約者かどうかを判定
  const wasFirstTimeBooking =
    stateManager.getState().wasFirstTimeBooking || false;
  const currentUser = stateManager.getState().currentUser;
  const studentHasEmail = currentUser && currentUser.email;
  const emailPreference = currentUser && currentUser.wantsEmail;

  // 予約完了か会計完了かを判定
  const isReservationComplete = msg !== '会計情報を記録しました。';

  // メール送信に関する案内メッセージ（予約完了時のみ表示）
  let emailNoticeHtml = '';
  if (wasFirstTimeBooking && isReservationComplete) {
    emailNoticeHtml = `
        <div class="bg-ui-info-bg border border-ui-info-border rounded-lg p-4 mt-4">
          <div class="flex items-start">
            <svg class="flex-shrink-0 h-5 w-5 text-ui-info-text mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
            </svg>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-ui-info-text">予約受付完了のメールをお送りしました！</h3>
              <p class="mt-1 text-sm text-ui-info-text">
                会場の住所や駐車場情報なども記載しています。メールが届かない場合は、迷惑メールフォルダもご確認ください。<br>
                予約の確認やキャンセルは、このページ（Webアプリ上）でおこなえます<br>
                <br>
                送信元アドレス: shiawasenehito3000@gmail.com
              </p>
            </div>
          </div>
        </div>
      `;
  } else if (studentHasEmail && emailPreference && isReservationComplete) {
    emailNoticeHtml = `
        <div class="bg-ui-surface rounded-lg p-3 mt-4">
          <p class="text-sm text-brand-subtle text-center">
          予約受付完了のメールをお送りしました！<br>
          （会場の住所や駐車場情報なども記載）<br>
          <br>
          送信元アドレス: shiawasenehito3000@gmail.com
        </p>
        </div>
      `;
  }

  let nextBookingHtml = '';

  // 該当教室の未来の予約枠が存在する場合
  if (classroom && stateManager.getState().lessons) {
    // バックエンドで計算済みの空き情報を直接使用
    const relevantLessons = stateManager
      .getState()
      .lessons.filter(lesson => lesson.schedule.classroom === classroom);
    const bookingLessonsHtml = renderBookingLessons(relevantLessons);

    if (bookingLessonsHtml) {
      // 予約完了時と会計完了時で表記を変更
      const sectionTitle = isReservationComplete
        ? '↓ さらに よやく をする！'
        : '↓ つぎの よやく をする！';

      nextBookingHtml = `
          <div class="mt-10 pt-6 border-t border-gray-200">
              <h3 class="text-xl font-bold text-brand-text text-center mb-4">${sectionTitle}</h3>
              <div class="${DesignConfig.cards.container}">
              ${bookingLessonsHtml}
              </div>
          </div>`;
    }
  }

  return `
    <div class="text-center py-8">
        <svg class="w-12 h-12 mx-auto text-state-available-text" fill="none" viewBox= "2 2 20 20" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <h1 class="text-2xl font-bold ${DesignConfig.colors.text} mt-4 mb-2">ありがとうございました</h1>
        <p class="${DesignConfig.colors.textSubtle} mb-6">${msg}</p>

        ${emailNoticeHtml}

        <div class="max-w-xs mx-auto mt-8">
             ${Components.button({
               text: 'ホームへ戻る',
               action: 'goToDashboard',
               style: 'secondary',
               size: 'full',
             })}
        </div>

        ${nextBookingHtml}

    </div>`;
};

/**
 * 時間制教室の授業料計算UIを生成します。
 * @param {AccountingMasterData} rule - 料金マスタから取得した教室ルール
 * @param {ReservationData} reservationDetails - 予約固有情報（開始時刻、レンタル等）
 * @param {ScheduleInfo} scheduleInfo - 講座固有情報（教室形式、開講時間等）
 * @returns {string} HTML文字列
 */
const getTimeBasedTuitionHtmlLocal = (
  rule,
  reservationDetails,
  scheduleInfo,
) => {
  // デバッグ用ログ
  console.log('🔍 getTimeBasedTuitionHtml: scheduleInfo =', scheduleInfo);
  console.log(
    '🔍 getTimeBasedTuitionHtml: reservationDetails =',
    reservationDetails,
  );

  // 講座固有情報から時間設定を取得
  let classStart, classEnd;

  if (scheduleInfo && scheduleInfo.firstStart && scheduleInfo.firstEnd) {
    // 日程マスタから時間を取得
    const startParts = scheduleInfo.firstStart.split(':');
    const endParts = scheduleInfo.firstEnd.split(':');
    classStart = parseInt(startParts[0] || '0');
    classEnd = parseInt(endParts[0] || '0');

    console.log('🔍 getTimeBasedTuitionHtml: 時間設定取得成功', {
      firstStart: scheduleInfo.firstStart,
      firstEnd: scheduleInfo.firstEnd,
      classStart,
      classEnd,
    });
  } else {
    console.error('❌ getTimeBasedTuitionHtml: scheduleInfo検証失敗', {
      scheduleInfo,
      hasScheduleInfo: !!scheduleInfo,
      hasFirstStart: scheduleInfo ? !!scheduleInfo.firstStart : false,
      hasFirstEnd: scheduleInfo ? !!scheduleInfo.firstEnd : false,
    });
    return `<div class="text-ui-error-text p-4 bg-ui-error-bg rounded-lg">エラー: この教室の講座時間が設定されていません。<br><small>デバッグ情報: scheduleInfo=${JSON.stringify(scheduleInfo)}</small></div>`;
  }
  const endBuffer = 3;

  const breakOptions = [...Array(5).keys()]
    .map(
      i =>
        `<option value="${i * 30}" ${String(i * 30) === (reservationDetails['breakTime'] || '0') ? 'selected' : ''}>${i * 30}分</option>`,
    )
    .join('');

  const startTimeValue =
    reservationDetails[CONSTANTS.HEADERS.RESERVATIONS?.START_TIME] ||
    reservationDetails.startTime ||
    '';
  const endTimeValue =
    reservationDetails[CONSTANTS.HEADERS.RESERVATIONS?.END_TIME] ||
    reservationDetails.endTime ||
    '';

  const startTimeOptions = getTimeOptionsHtml(
    classStart,
    classEnd + endBuffer,
    30,
    typeof startTimeValue === 'string' ? startTimeValue : '',
  );
  const endTimeOptions = getTimeOptionsHtml(
    classStart,
    classEnd + endBuffer,
    30,
    typeof endTimeValue === 'string' ? endTimeValue : '',
  );

  const rentalChecked =
    reservationDetails['chiselRental'] ||
    reservationDetails['彫刻刀レンタル'] === true
      ? 'checked'
      : '';

  const discountRule = stateManager
    .getState()
    .accountingMaster.find(
      item =>
        item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME] ===
        CONSTANTS.ITEMS.DISCOUNT,
    );
  // 割引ルールが見つからない場合でも、常に割引チェックボックスを表示
  const discountHtml = `<div class="mt-4 pt-4 border-t border-gray-200">${getDiscountHtml({ 項目名: CONSTANTS.ITEMS.DISCOUNT }, reservationDetails['discountApplied'] ? '1' : '0')}<p class="text-sm ${DesignConfig.colors['textSubtle']} mt-2 text-left">初回参加者と同時刻に参加の場合、¥500割引</p></div>`;

  // 基本授業料の表示を追加
  const basicTuitionRule = stateManager
    .getState()
    .accountingMaster.find(
      item =>
        item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME] ===
          CONSTANTS.ITEMS.MAIN_LECTURE &&
        item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM] &&
        String(item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM]).includes(
          scheduleInfo.classroom || reservationDetails.classroom,
        ),
    );

  const basicTuitionDisplay = basicTuitionRule
    ? `<div class="mb-3 p-3 bg-blue-50 rounded border-l-4 border-blue-400">
           <div class="text-base text-blue-800">
             <span class="font-semibold">${CONSTANTS.ITEMS.MAIN_LECTURE}:</span> ¥${basicTuitionRule[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE]?.toLocaleString() || 0} / 30分
           </div>
         </div>`
    : '';

  return Components.cardContainer({
    variant: 'default',
    padding: 'spacious',
    content: `
        <div class="space-y-3">
            <h3 class="${DesignConfig.text['heading']} mb-2">授業料</h3>
            ${basicTuitionDisplay}
            <div class="grid grid-cols-3 gap-2 items-end">
                <div class="col-span-1">
                  ${Components.select({
                    id: 'start-time',
                    label: '開始時刻',
                    options: startTimeOptions,
                  })}
                </div>
                <div class="col-span-1">
                  ${Components.select({
                    id: 'end-time',
                    label: '終了時刻',
                    options: endTimeOptions,
                  })}
                </div>
                <div class="col-span-1">
                  ${Components.select({
                    id: 'break-time',
                    label: '休憩時間',
                    options: breakOptions,
                  })}
                </div>
            </div>
            <div id="calculated-hours" class="text-left text-base ${DesignConfig.colors['textSubtle']} mt-2"></div>
            <div class="pt-3 mt-3 border-t border-gray-200">
                <label class="flex items-center justify-between">
                    <span class="text-brand-text">${CONSTANTS.ITEMS.CHISEL_RENTAL}</span>
                    <input type="checkbox" name="chiselRental" data-item-type="${CONSTANTS.ITEM_TYPES.TUITION}" data-item-name="${CONSTANTS.ITEMS.CHISEL_RENTAL}" class="accounting-item h-5 w-5 rounded border-ui-border text-brand-text focus:ring-brand-text" ${rentalChecked}>
                </label>
            </div>
            ${discountHtml}
            <div id="tuition-breakdown" class="mt-4 pt-4 border-t border-ui-border space-y-1 text-base ${DesignConfig.colors['textSubtle']}"></div>
            <div class="text-right font-bold mt-2" id="tuition-subtotal">小計: 0円</div>
        </div>
    `,
  });
};
