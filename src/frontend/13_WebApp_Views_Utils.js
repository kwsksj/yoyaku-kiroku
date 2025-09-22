// @ts-check
/// <reference path="../../types/dev-environment.d.ts" />
/// <reference path="../../types/html-environment.d.ts" />
/// <reference path="../../types/api-types.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 13_WebApp_Views_Utils.js
 * 【バージョン】: 1.0
 * 【役割】: Views関連のユーティリティ関数群
 * 【構成】: Views.jsから分割されたヘルパー関数
 * =================================================================
 */

// =================================================================
// --- View Helper Components ---
// -----------------------------------------------------------------
// 各ビューを構成するための、より小さな部品を生成するヘルパー関数群。
// =================================================================

/**
 * 当日かどうかを判定します。
 * @param {DateString} dateString - 日付文字列 (YYYY-MM-DD)
 * @returns {boolean} 当日の場合true
 */
const _isToday = dateString => {
  const itemDate = new Date(dateString);
  const today = new Date();
  return itemDate.toDateString() === today.toDateString();
};

/**
 * 指定日が「今日もしくは過去」かどうかを判定します。
 * @param {DateString} dateString - 日付文字列 (YYYY-MM-DD)
 * @returns {boolean} 「今日もしくは過去」の場合true
 */
const _isPastOrToday = dateString => {
  const itemDate = new Date(dateString);
  const today = new Date();
  // 時間を00:00:00にリセットして日付のみで比較
  itemDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return itemDate <= today;
};

/**
 * 時刻選択用の<option>タグ群を生成します。
 * @param {number} startHour - 開始時刻（時）
 * @param {number} endHour - 終了時刻（時）
 * @param {number} step - 間隔（分）
 * @param {TimeString | null} selectedValue - 事前に選択する時刻 (HH:mm)
 * @returns {HTMLString} HTMLの<option>タグ文字列
 */
const getTimeOptionsHtml = (startHour, endHour, step, selectedValue) => {
  let options = [];
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += step) {
      const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      options.push(
        `<option value="${time}" ${time === selectedValue ? 'selected' : ''}>${time}</option>`,
      );
    }
  }
  return options.join('');
};

/**
 * 教室名に基づいてTailwindCSSのカラークラスを返します。
 * @param {ClassroomName} classroomName - 教室名
 * @returns {string} Tailwindカラークラス
 */
const getClassroomColorClass = classroomName => {
  switch (classroomName) {
    //TODO: 内容が間違っています！！要修正！！！！
    case 'アトリエ':
      return 'bg-ui-atelier text-white';
    case 'はじめて':
      return 'bg-ui-hajimete text-white';
    case 'みんなの':
      return 'bg-ui-minnano text-white';
    case 'こども':
      return 'bg-ui-kodomo text-white';
    default:
      return 'bg-ui-surface text-brand-text';
  }
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
    stateManager.getState().selectedLesson?.schedule?.classroom;

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
        ? '↓ さらに よやく をする ↓'
        : '↓ つぎの よやく をする ↓';

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
