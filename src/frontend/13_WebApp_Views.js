// @ts-check
/// <reference path="../types.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 13_WebApp_Views.js
 * 【バージョン】: 1.9
 * 【役割】: WebAppの各画面（ビュー）のHTML構造を生成する関数群を集約します。
 * - 各関数は特定の画面（ログイン、予約一覧など）のUI構築を担当します。
 * - appStateの現在の状態に基づき、動的にHTMLを生成します。
 * 【構成】: 14ファイル構成でのビュー管理
 * 【v1.9での変更点】:
 * - FE-14: 会計画面の入力保持機能を実装。
 *   - getAccountingViewでキャッシュされたデータをフォームの初期値として設定するよう修正。
 * =================================================================
 */

// =================================================================
// --- View Helper Components ---
// -----------------------------------------------------------------
// 各ビューを構成するための、より小さな部品を生成するヘルパー関数群。
// =================================================================

/**
 * 当日かどうかを判定します。
 * @param {string} dateString - 日付文字列 (YYYY-MM-DD)
 * @returns {boolean} 当日の場合true
 */
const _isToday = dateString => {
  const itemDate = new Date(dateString);
  const today = new Date();
  return itemDate.toDateString() === today.toDateString();
};

/**
 * 指定日が「今日もしくは過去」かどうかを判定します。
 * @param {string} dateString - 日付文字列 (YYYY-MM-DD)
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
 * @param {string | null} selectedValue - 事前に選択する時刻 (HH:mm)
 * @returns {string} HTMLの<option>タグ文字列
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
 * 割引選択用のUIを生成します。
 * @param {object} discountRule - 料金マスタから取得した割引ルールオブジェクト
 * @param {string} selectedValue - 選択済みの値
 * @returns {string} HTML文字列
 */
const getDiscountHtml = (discountRule, selectedValue) => {
  if (!discountRule) return '';
  const isChecked =
    selectedValue && parseInt(selectedValue, 10) > 0 ? 'checked' : '';
  return `
        <div class="mt-4 pt-4 border-t border-ui-border-light">
            <label class="flex items-center space-x-2">
                <input type="checkbox" id="discount-checkbox" name="discountApplied" ${isChecked} class="accounting-item accent-action-primary-bg">
                <span class="${DesignConfig.text.labelBlock}">${discountRule[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME]} (¥500引き)</span>
            </label>
        </div>`;
};

/**
 * 選択された支払方法に応じた支払い情報を動的に表示するUIを生成します。
 * @param {string} selectedPaymentMethod - 選択された支払方法
 * @returns {string} HTML文字列
 */
const getPaymentInfoHtml = (selectedPaymentMethod = '') => {
  let paymentInfoHtml = '';

  // ことら送金が選択された場合のみ電話番号を表示
  if (selectedPaymentMethod === CONSTANTS.PAYMENT_DISPLAY.COTRA) {
    paymentInfoHtml += `
        <div class="bg-ui-surface border border-ui-border p-3 rounded-md">
            <div class="flex justify-between items-center">
                <div class="${DesignConfig.text.body}"><span class="font-bold">${CONSTANTS.PAYMENT_DISPLAY.COTRA}:</span><span class="ml-2">${BANK.COTRA_PHONE}</span></div>
                <button data-action="copyToClipboard" data-copy-text="${BANK.COTRA_PHONE}" class="flex-shrink-0 text-sm bg-action-secondary-bg active:bg-action-secondary-hover text-action-secondary-text font-bold px-2 py-1 rounded mobile-button">コピー</button>
            </div>
        </div>`;
  }

  // 振込が選択された場合のみ口座情報を表示
  if (selectedPaymentMethod === CONSTANTS.PAYMENT_DISPLAY.BANK_TRANSFER) {
    paymentInfoHtml += `
        <div class="bg-ui-surface border border-ui-border p-3 rounded-md">
            <div class="text-brand-text"><span class="font-bold">振込先:</span><span class="ml-2">${BANK.NAME}</span></div>
            <div class="mt-1 flex justify-between items-center">
                <div class="text-base text-brand-text">店番: ${BANK.BRANCH}</div>
                <button data-action="copyToClipboard" data-copy-text="${BANK.BRANCH}" class="text-sm bg-action-secondary-bg active:bg-action-secondary-hover text-action-secondary-text font-bold px-2 py-1 rounded mobile-button">コピー</button>
            </div>
            <div class="mt-1 flex justify-between items-center">
                <div class="text-base text-brand-text">普通: ${BANK.ACCOUNT}</div>
                <button data-action="copyToClipboard" data-copy-text="${BANK.ACCOUNT}" class="text-sm bg-action-secondary-bg active:bg-action-secondary-hover text-action-secondary-text font-bold px-2 py-1 rounded mobile-button">コピー</button>
            </div>
        </div>`;
  }

  // 現金の場合は何も表示しない
  return paymentInfoHtml;
};

/**
 * 支払い方法の選択肢（ラジオボタン）UIを生成します。
 * @param {string} selectedValue - 選択済みの支払い方法
 * @returns {string} HTML文字列
 */
const getPaymentOptionsHtml = selectedValue => {
  const cotraDetails = `
        <details class="mt-2 ml-6">
            <summary class="inline-block px-2 py-1 bg-ui-warning-light text-ui-warning-text text-sm font-semibold rounded-md active:bg-ui-warning-bg">
                ことら送金とは？ <span class="arrow">▼</span>
            </summary>
            <p class="mt-2 p-2 bg-ui-warning-bg rounded-md text-sm text-left text-brand-subtle">
                電話番号だけで銀行口座間で送金できるサービスです。手数料無料。対応の銀行アプリから利用できます。<br>
                (例：ゆうちょ通帳アプリ、三井住友銀行アプリ、住信SBIネット銀行アプリなど)
                <a href="https://www.cotra.ne.jp/member/" target="_blank" class="text-ui-link-text">対応アプリ一覧</a>
            </p>
        </details>`;
  const options = [
    {
      value: CONSTANTS.PAYMENT_DISPLAY.CASH,
      text: CONSTANTS.PAYMENT_DISPLAY.CASH,
      details: '',
    },
    {
      value: CONSTANTS.PAYMENT_DISPLAY.COTRA,
      text: CONSTANTS.PAYMENT_DISPLAY.COTRA,
      details: cotraDetails,
    },
    {
      value: CONSTANTS.PAYMENT_DISPLAY.BANK_TRANSFER,
      text: CONSTANTS.PAYMENT_DISPLAY.BANK_TRANSFER,
      details: '',
    },
  ];
  return (
    options
      .map(
        (opt, i) => `
        <div>
            <label class="flex items-center space-x-2 text-brand-text">
                <input type="radio" name="payment-method" value="${opt.value}" class="accounting-item accent-action-primary-bg" ${opt.value === selectedValue ? 'checked' : ''}>
                <span>${opt.text}</span>
            </label>
            ${opt.details}
        </div>`,
      )
      .join('') +
    `
        <div class="mt-4 space-y-2 text-base" id="payment-info-container">
            <!-- 支払方法別情報がここに動的に表示されます -->
        </div>`
  );
};

// createReservationCard function removed - functionality moved to Components.listCard

/**
 * 時間制教室の授業料計算UIを生成します。
 * @param {object} rule - 料金マスタから取得した教室ルール
 * @param {object} reservationDetails - 予約固有情報（開始時刻、レンタル等）
 * @param {object} scheduleInfo - 講座固有情報（教室形式、開講時間等）
 * @returns {string} HTML文字列
 */
const getTimeBasedTuitionHtml = (rule, reservationDetails, scheduleInfo) => {
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
        `<option value="${i * 30}" ${String(i * 30) === (reservationDetails.breakTime || '0') ? 'selected' : ''}>${i * 30}分</option>`,
    )
    .join('');

  const startTimeOptions = getTimeOptionsHtml(
    classStart,
    classEnd + endBuffer,
    30,
    reservationDetails[CONSTANTS.HEADERS.RESERVATIONS?.START_TIME] ||
      reservationDetails.startTime,
  );
  const endTimeOptions = getTimeOptionsHtml(
    classStart,
    classEnd + endBuffer,
    30,
    reservationDetails[CONSTANTS.HEADERS.RESERVATIONS?.END_TIME] ||
      reservationDetails.endTime,
  );

  const rentalChecked =
    reservationDetails.chiselRental ||
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
  const discountHtml = `<div class="mt-4 pt-4 border-t border-gray-200">${getDiscountHtml({ 項目名: CONSTANTS.ITEMS.DISCOUNT }, reservationDetails.discountApplied ? '1' : '0')}<p class="text-sm ${DesignConfig.colors.textSubtle} mt-2 text-left">初回参加者と同時刻に参加の場合、¥500割引</p></div>`;

  // 基本授業料の表示を追加
  const basicTuitionRule = stateManager
    .getState()
    .accountingMaster.find(
      item =>
        item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME] ===
          CONSTANTS.ITEMS.MAIN_LECTURE &&
        item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM] &&
        item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM].includes(
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
            <h3 class="${DesignConfig.text.heading} mb-2">授業料</h3>
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
            <div id="calculated-hours" class="text-left text-base ${DesignConfig.colors.textSubtle} mt-2"></div>
            <div class="pt-3 mt-3 border-t border-gray-200">
                <label class="flex items-center justify-between">
                    <span class="text-brand-text">${CONSTANTS.ITEMS.CHISEL_RENTAL}</span>
                    <input type="checkbox" name="chiselRental" data-item-type="${CONSTANTS.ITEM_TYPES.TUITION}" data-item-name="${CONSTANTS.ITEMS.CHISEL_RENTAL}" class="accounting-item h-5 w-5 rounded border-ui-border text-brand-text focus:ring-brand-text" ${rentalChecked}>
                </label>
            </div>
            ${discountHtml}
            <div id="tuition-breakdown" class="mt-4 pt-4 border-t border-ui-border space-y-1 text-base ${DesignConfig.colors.textSubtle}"></div>
            <div class="text-right font-bold mt-2" id="tuition-subtotal">小計: 0円</div>
        </div>
    `,
  });
};

// =================================================================
// --- Main Application Views ---
// -----------------------------------------------------------------
// アプリケーションの各画面の完全なHTML構造を生成する関数群。
// =================================================================

/**
 * ログイン画面のUIを生成します。
 * @returns {string} HTML文字列
 */
const getLoginView = () => {
  const phoneValue = stateManager.getState().loginPhone || '';
  return Components.pageContainer({
    maxWidth: 'md',
    content: `
      <div class="text-center pt-8 pb-4">
          <h1 class="text-3xl font-bold text-brand-text tracking-tight">きぼりの<br>よやく・きろく</h1>
          <h2 class="text-xl text-brand-subtle mt-2 mb-10">川崎誠二 木彫り教室</h2>
      </div>
      <div class="${DesignConfig.inputs.container}">
        <label for="phone" class="block text-brand-subtle text-sm text-center mb-1">電話番号</label>
        <input
          type="tel"
          id="phone"
          value="${phoneValue}"
          class="${DesignConfig.inputs.base} text-center"
          placeholder="090 1234 5678"
          autocomplete="tel"
          inputmode="numeric"
          pattern="[0-9]*"
        >
      </div>
      ${Components.actionButtonSection({
        primaryButton: {
          action: 'login',
          text: 'ログイン または 新規登録',
          style: 'primary',
        },
        spacing: 'normal',
      })}
    `,
  });
};

/**
 * ユーザー情報入力フォーム（新規登録・プロフィール編集共通）
 * 【統合設計】新規登録と編集を1つの関数で処理する効率的な実装
 * @param {Object} config - 設定オブジェクト
 * @param {string} config.mode - 'register'（新規登録）または 'edit'（編集）
 * @param {string} [config.phone] - 電話番号（新規登録時のみ）
 * @returns {string} HTML文字列
 */
const getUserFormView = config => {
  const { mode, phone } = config;
  const isEdit = mode === 'edit';
  const u = stateManager.getState().currentUser || {};

  // 入力値の保持: 新規登録Step1ではstateManager.getState().registrationDataを参照
  let regData = stateManager.getState().registrationData || {};
  const realNameValue = isEdit ? u.realName || '' : regData.realName || '';
  const nicknameValue = isEdit ? u.displayName || '' : regData.nickname || '';
  const phoneValue = isEdit
    ? stateManager.getState().registrationPhone || u.phone || ''
    : regData.phone || phone || '';

  // 電話番号表示の判定
  const isPhoneInputNeeded =
    isEdit && (stateManager.getState().registrationPhone || !u.phone);

  // タイトルと説明文
  const title = isEdit ? 'プロフィール編集' : '新規登録';
  const description = isEdit
    ? ''
    : '<p class="text-brand-subtle mb-6">お名前を登録してください。</p>';

  // 電話番号セクション
  let phoneSection = '';
  if (!isEdit) {
    // 新規登録時：電話番号を表示のみ
    phoneSection = `
        <div class="mb-4">
            <label class="block text-brand-text text-base font-bold mb-2">電話番号</label>
            <input type="tel" id="reg-phone" value="${phoneValue}" class="${DesignConfig.inputs.base}" placeholder="090 1234 5678" autocomplete="tel" inputmode="numeric" pattern="[0-9]*">
        </div>`;
  } else if (isPhoneInputNeeded) {
    // プロフィール編集時：電話番号入力が必要
    phoneSection = `
        <div class="mb-4">
            <label for="edit-phone" class="block text-brand-text text-base font-bold mb-2">電話番号</label>
            <input type="tel" id="edit-phone" value="${phoneValue}"
                   class="${DesignConfig.inputs.base}" placeholder="090 1234 5678"
                   autocomplete="tel" inputmode="numeric" pattern="[0-9]*">
            <p class="text-sm text-brand-subtle mt-1">電話番号を登録すると次回からスムーズにログインできます。</p>
        </div>`;
  } else {
    // プロフィール編集時：電話番号表示のみ
    phoneSection = `
        <div class="mb-4">
            <label class="block text-brand-text text-base font-bold mb-2">電話番号</label>
            <p class="font-semibold p-3 bg-ui-surface text-brand-text rounded-lg w-auto inline-block">${phoneValue}</p>
        </div>`;
  }

  // メール設定セクション（プロフィール編集時のみ）
  const emailSection = isEdit
    ? `
        <div class="space-y-4">
          ${Components.input({
            id: 'edit-email',
            label: 'メールアドレス',
            type: 'email',
            value: u.email || '',
            placeholder: 'example@email.com',
          })}
          <div class="p-3 bg-ui-surface rounded-md">
            <label class="flex items-center space-x-3">
              <input type="checkbox" id="edit-wants-email"
                     class="h-5 w-5 accent-action-primary-bg"
                     ${u.wantsEmail ? 'checked' : ''}>
              <span class="text-brand-text text-sm">メール連絡を希望します（教室日程、予約受付、など）**初回予約時は、すべての方へ連絡します**</span>
            </label>
          </div>
        </div>
      `
    : '';

  // ボタン設定
  // ボタン設定を統一フォーマットで定義
  const buttonConfig = isEdit
    ? {
        secondaryButton: {
          text: 'もどる',
          action: 'smartGoBack',
          style: 'secondary',
        },
        primaryButton: {
          text: 'この内容で更新',
          action: 'saveProfile',
          style: 'primary',
        },
      }
    : {
        secondaryButton: {
          text: 'もどる',
          action: 'goBackToLogin',
          style: 'secondary',
        },
        primaryButton: {
          text: 'すすむ',
          action: 'goToStep2',
          style: 'primary',
        },
      };

  const nameIdPrefix = isEdit ? 'edit' : 'reg';

  return `
        <div class="max-w-md mx-auto">
            <h1 class="text-xl font-bold text-brand-text mb-4">${title}</h1>
            ${description}
            <div class="space-y-4">
              ${Components.input({
                id: `${nameIdPrefix}-realname`,
                label: 'お名前 *必須項目*',
                type: 'text',
                required: true,
                value: realNameValue,
                containerClass: '',
                autocomplete: 'name',
              })}
              ${Components.input({
                id: `${nameIdPrefix}-nickname`,
                label: 'ニックネーム（表示名）',
                caption: '他の生徒さんにも表示されます',
                type: 'text',
                value: nicknameValue,
                placeholder: '空欄の場合はお名前',
                containerClass: '',
              })}
              ${phoneSection}
              ${emailSection}
            </div>

            ${Components.actionButtonSection({
              ...buttonConfig,
              layout: 'horizontal',
            })}
        </div>`;
};

/**
 * 新規登録画面のUIを生成します。
 * @param {string} p - ログイン試行時に入力された電話番号
 * @returns {string} HTML文字列
 */
const getRegisterView = p => getUserFormView({ mode: 'register', phone: p });

/**
 * 新規登録フローのステップ2（プロフィール詳細）
 * 【設計方針】ステップ式登録により、ユーザー負担を軽減
 * @returns {string} プロフィール詳細フォームのHTML文字列
 */
const getRegistrationStep2View = () => {
  const data = stateManager.getState().registrationData;
  const genderOptions = ['女性', '男性', 'その他']
    .map(
      opt =>
        `<label class="flex items-center space-x-2"><input type="radio" name="gender" value="${opt}" ${data.gender === opt ? 'checked' : ''}><span class="text-brand-text">${opt}</span></label>`,
    )
    .join('');
  const handOptions = ['右利き', '左利き', '両利き']
    .map(
      opt =>
        `<label class="flex items-center space-x-2"><input type="radio" name="dominantHand" value="${opt}" ${data.dominantHand === opt ? 'checked' : ''}><span class="text-brand-text">${opt}</span></label>`,
    )
    .join('');
  const ageOptions = [
    '----',
    '10代（16歳以上）',
    '20代',
    '30代',
    '40代',
    '50代',
    '60代',
    '70代',
    '80代以上',
    'ひみつ',
  ]
    .map(
      opt =>
        `<option value="${opt}" ${data.ageGroup === opt ? 'selected' : ''}>${opt}</option>`,
    )
    .join('');

  return Components.pageContainer({
    maxWidth: 'md',
    content: `
      <h1 class="text-xl font-bold text-brand-text mb-4 text-center">プロフィール</h1>
      <form id="step2-form" class="space-y-6">
        ${Components.input({ id: 'q-email', label: 'メールアドレス *必須項目*', type: 'email', value: data.email || '', required: true })}
        <div class="p-3 bg-ui-surface rounded-md">
          <label class="flex items-center space-x-3">
            <input type="checkbox" id="q-wants-email" name="wantsEmail" class="h-5 w-5 accent-action-primary-bg" ${data.wantsEmail ? 'checked' : ''}>
            <span class="text-brand-text text-sm">メール連絡を希望します（教室日程、予約受付、など）</span>
          </label>
        </div>
        ${Components.select({ id: 'q-age-group', label: 'お年頃', options: ageOptions })}
        <div><label class="block text-brand-text text-base font-bold mb-2">性別</label><div class="flex space-x-4">${genderOptions}</div></div>
        <div><label class="block text-brand-text text-base font-bold mb-2">利き手</label><div class="flex space-x-4">${handOptions}</div></div>
        ${Components.input({ id: 'q-address', label: '住所（市区町村まででOK！）', type: 'text', value: data.address || '' })}
      </form>
      ${Components.actionButtonSection({
        secondaryButton: {
          text: 'もどる',
          action: 'backToStep1',
          style: 'secondary',
        },
        primaryButton: {
          text: 'すすむ',
          action: 'goToStep3',
          style: 'primary',
        },
        layout: 'horizontal',
      })}
    `,
  });
};

/**
 * 新規登録フローのステップ3（木彫り関連情報）
 * 【UX配慮】動的表示制御により、経験者には詳細質問を表示
 * @returns {string} 木彫りアンケートフォームのHTML文字列
 */
const getRegistrationStep3View = () => {
  const data = stateManager.getState().registrationData;
  const experienceOptions = ['はじめて！', 'ちょっと', 'そこそこ', 'かなり！']
    .map(
      opt =>
        `<label class="flex items-center space-x-2"><input type="radio" name="experience" value="${opt}" ${data.experience === opt ? 'checked' : ''}><span class="text-brand-text">${opt}</span></label>`,
    )
    .join('');

  return `
    <div class="max-w-md mx-auto text-left">
      <h1 class="text-xl font-bold text-brand-text mb-4 text-center">木彫りについて</h1>
      <form id="step3-form" class="space-y-6">
        <div>
          <label class="block text-brand-text text-base font-bold mb-2">木彫りの経験はありますか？</label>
          <div class="space-y-2" id="experience-radio-group">${experienceOptions}</div>
        </div>
        <div id="past-work-container" class="${data.experience === 'はじめて！' ? 'hidden' : ''}">
          ${Components.textarea({
            id: 'q-past-work',
            label: 'いつ頃、どこで、何を作りましたか？',
            value: data.pastWork || '',
            placeholder: 'だいたいでOK！',
          })}
        </div>
        ${Components.textarea({
          id: 'q-future-goal',
          label: '将来的に制作したいものはありますか？',
          value: data.futureGoal || '',
          placeholder: '曖昧な内容でも大丈夫！',
        })}
      </form>
      ${Components.actionButtonSection({
        secondaryButton: {
          text: 'もどる',
          action: 'backToStep2',
          style: 'secondary',
        },
        primaryButton: {
          text: 'すすむ',
          action: 'proceedToStep4',
          style: 'primary',
        },
        layout: 'horizontal',
      })}
    </div>
  `;
};

/**
 * 新規登録フローのステップ4（アンケート）
 * 【設計方針】最終ステップでユーザーの参加意向とフィードバックを収集
 * @returns {string} アンケートフォームのHTML文字列
 */
const getRegistrationStep4View = () => {
  const data = stateManager.getState().registrationData;
  const participationOptions = [
    '毎月通いたい！',
    '2,3ヶ月ごとくらいで通いたい！',
    'これるときにたまに通いたい！',
    '1回やってみたい！',
    '通いたいがむずかしい…',
  ]
    .map(
      opt =>
        `<label class="flex items-center space-x-2 p-2 rounded hover:bg-ui-surface cursor-pointer">
            <input type="radio" name="futureParticipation" value="${opt}" ${data.futureParticipation === opt ? 'checked' : ''} class="text-action-primary-bg focus:ring-action-primary-bg">
            <span class="text-brand-text">${opt}</span>
          </label>`,
    )
    .join('');

  return `
    <div class="max-w-md mx-auto text-left">
      <h1 class="text-xl font-bold text-brand-text mb-4 text-center">アンケート</h1>
      <form id="step4-form" class="space-y-6">
        <div>
          <label class="block text-brand-text text-base font-bold mb-3">今後のご参加について</label>
          <div class="space-y-2" id="participation-radio-group">${participationOptions}</div>
        </div>

        ${Components.textarea({
          id: 'q-trigger',
          label: 'この教室を知ったきっかけは？参加しようと思ったきっかけは？',
          value: data.trigger || '',
        })}

        ${Components.textarea({
          id: 'q-first-message',
          label: 'メッセージ',
          value: data.firstMessage || '',
          placeholder: 'その他コメント・要望・意見など、あればどうぞ〜',
        })}
      </form>
      ${Components.actionButtonSection({
        secondaryButton: {
          text: 'もどる',
          action: 'backToStep3',
          style: 'secondary',
        },
        primaryButton: {
          text: 'とうろく する！',
          action: 'submitRegistration',
          style: 'primary',
        },
        layout: 'horizontal',
      })}
    </div>
  `;
};

/**
 * 電話番号未登録ユーザーの検索・選択画面
 * 【機能】NF-01 対応：名前検索によるアカウント発見機能
 * @returns {string} HTML文字列
 */
const getUserSearchView = () => {
  const users = stateManager.getState().searchedUsers;
  // NF-01: 検索が実行され、結果が0件の場合にメッセージを表示
  const hasSearchedAndNoResults =
    stateManager.getState().searchAttempted && users.length === 0;

  return Components.pageContainer({
    maxWidth: 'md',
    content: `
        <h1 class="text-xl font-bold text-brand-text mb-4">アカウントを探す</h1>
        <p class="text-brand-subtle mb-6">お名前（本名）またはニックネームを入力して、あなたのアカウントを見つけてください。<br>
        <span class="text-sm text-brand-muted">（漢字が異なる場合や、姓と名の間が開いている場合でも、スペースを入れずに、苗字だけでも試してみてください）</span></p>

        <div class="${DesignConfig.inputs.container} mb-4">
            ${Components.input({
              id: 'nickname-search-input',
              label: 'お名前（本名）またはニックネーム',
              type: 'text',
              placeholder: 'お名前またはニックネーム',
              inputClass: 'text-center',
              autocomplete: 'off',
            })}
            <div class="mt-4 flex justify-center">
                ${Components.button({
                  text: '検索',
                  action: 'searchUserByName',
                  style: 'primary',
                  size: 'full',
                })}
            </div>
        </div>

        <div class="mt-8 space-y-3">
            ${
              users.length > 0
                ? `
                <h2 class="text-lg font-bold ${DesignConfig.colors.text} text-center mb-2">見つかったアカウント</h2>
                ${users
                  .map(user =>
                    Components.cardContainer({
                      variant: 'default',
                      padding: 'normal',
                      content: `
                        <div class="flex justify-between items-center">
                          <p class="text-base font-semibold">${user.realName}（${user.nickname}）</p>
                          ${Components.button({
                            text: 'これだ！',
                            action: 'selectSearchedUser',
                            customClass:
                              'bg-state-success-bg text-state-success-text',
                            size: 'small',
                            dataAttributes: {
                              studentId: user.studentId,
                              realName: user.realName,
                              nickname: user.nickname,
                            },
                          })}
                        </div>
                      `,
                    }),
                  )
                  .join('')}
            `
                : hasSearchedAndNoResults
                  ? `
                <p class="text-center ${DesignConfig.colors.textSubtle}">一致するアカウントが見つかりませんでした。</p>
            `
                  : ''
            }
        </div>

        <div class="mt-8 pt-4 border-t border-gray-200 flex flex-col space-y-3">
            <h2 class="text-lg font-bold ${DesignConfig.colors.text} text-center mb-2">見つからない場合</h2>
            ${Components.button({
              text: '自分のアカウントが見つからないので、新規登録する',
              action: 'goToRegisterFromUserSearch',
              style: 'primary',
              size: 'full',
            })}
            ${Components.button({
              text: 'ログイン画面に戻る',
              action: 'goBackToLogin',
              style: 'secondary',
              size: 'full',
            })}
        </div>
    `,
  });
};

/**
 * 予約カードの編集ボタン配列を生成します。
 * @param {object} booking - 予約データ
 * @returns {Array} 編集ボタン設定配列
 */
const _buildEditButtons = booking => {
  const buttons = [];

  // 確認/編集ボタン
  if (
    booking.status === CONSTANTS.STATUS.CONFIRMED ||
    booking.status === CONSTANTS.STATUS.WAITLISTED
  ) {
    buttons.push({
      action: 'goToEditReservation',
      text: '確認/編集',
      style: 'secondary',
    });
  }

  return buttons;
};

/**
 * 予約カードの会計ボタン配列を生成します。
 * @param {object} booking - 予約データ
 * @returns {Array} 会計ボタン設定配列
 */
const _buildAccountingButtons = booking => {
  const buttons = [];

  // 会計ボタン（予約日以降のみ）
  const isBookingPastOrToday = _isPastOrToday(booking.date);
  if (booking.status === CONSTANTS.STATUS.CONFIRMED && isBookingPastOrToday) {
    buttons.push({
      action: 'goToAccounting',
      text: '会計',
      style: 'primary',
    });
  }

  return buttons;
};

/**
 * 編集モード対応の履歴カードを生成します
 * @param {object} historyItem - 履歴データ
 * @param {Array} editButtons - 編集ボタン配列
 * @param {Array} accountingButtons - 会計ボタン配列
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
          classroom: historyItem.classroom,
          reservationId: historyItem.reservationId,
          date: historyItem.date,
          ...(btn.details && { details: JSON.stringify(btn.details) }),
        },
      }),
    )
    .join('');

  // 会計ボタンHTML生成（編集モード時に追加分を含む）
  let allAccountingButtons = [...accountingButtons];

  // 編集モード時は追加の会計詳細ボタンを含める（当日以外）
  if (isInEditMode) {
    const isToday = _isToday(historyItem.date);
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
          date: historyItem.date,
          ...(btn.details && { details: JSON.stringify(btn.details) }),
        },
      }),
    )
    .join('');

  // 日時・会場表示
  const dateTimeDisplay = historyItem.startTime
    ? ` ${historyItem.startTime} ~ ${historyItem.endTime}`.trim()
    : '';
  const venueDisplay = `${HEADERS[historyItem.classroom] || historyItem.classroom}`;

  // 制作メモセクション（編集モード対応）
  const memoSection = Components.memoSection({
    reservationId: historyItem.reservationId,
    workInProgress: historyItem.workInProgress,
    isEditMode: isInEditMode,
  });

  return `
    <div class="w-full mb-4 px-0">
      <div class="${cardColorClass} p-2 rounded-lg shadow-sm" data-reservation-id="${historyItem.reservationId}">
        <!-- 上部：教室情報+編集ボタン -->
        <div class="flex justify-between items-start mb-0">
          <div class="flex-1 min-w-0">
            <div class="flex items-center flex-wrap">
              <h3 class="font-bold text-brand-text">${formatDate(historyItem.date)} <span class="font-normal text-brand-subtle">${dateTimeDisplay}</span></h3>
            </div>
            <h4 class="text-base text-brand-text font-bold mt-0">${escapeHTML(venueDisplay)}</h4>
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

/**
 * 履歴カードの編集ボタン配列を生成します。
 * @param {object} historyItem - 履歴データ
 * @returns {Array} 編集ボタン設定配列
 */
const _buildHistoryEditButtons = (historyItem, isInEditMode = false) => {
  const buttons = [];

  // 編集モード状態に応じてボタンテキストを変更
  const buttonText = isInEditMode ? 'とじる' : '確認/編集';
  buttons.push({
    action: 'expandHistoryCard',
    text: buttonText,
    style: 'secondary',
    size: 'xs',
  });

  return buttons;
};

/**
 * 履歴カードの会計ボタン配列を生成します。
 * @param {object} historyItem - 履歴データ
 * @returns {Array} 会計ボタン設定配列
 */
const _buildHistoryAccountingButtons = historyItem => {
  const buttons = [];

  if (historyItem.status === CONSTANTS.STATUS.COMPLETED) {
    const isHistoryToday = _isToday(historyItem.date);

    if (isHistoryToday) {
      // きろく かつ 教室の当日 → 「会計を修正」ボタンは維持
      buttons.push({
        action: 'editAccountingRecord',
        text: '会計を修正',
        style: 'primary',
      });
    }
    // 「会計詳細」ボタンは展開部に移植するため、カードからは除去
  }

  return buttons;
};

/**
 * 予約カードのバッジ配列を生成します。
 * @param {object} booking - 予約データ
 * @returns {Array} バッジ設定配列
 */
const _buildBookingBadges = booking => {
  const badges = [];

  if (booking.firstLecture) {
    badges.push({ type: 'info', text: '初回' });
  }

  if (booking.status === CONSTANTS.STATUS.WAITLISTED || booking.isWaiting) {
    badges.push({ type: 'warning', text: 'キャンセル待ち' });
  }

  return badges;
};

/**
 * メインのホーム画面のUIを生成します。
 * 【改善】ビジネスロジックをヘルパー関数に分離して可読性向上
 * @returns {string} HTML文字列
 */
const getDashboardView = () => {
  // myReservationsから直接フィルタリングして表示（シンプル化）
  const state = stateManager.getState();
  const myReservations = state.myReservations || [];

  // 予約セクション用のカード配列を構築：確定・待機ステータスのみ表示
  const activeReservations = myReservations
    .filter(
      res =>
        res.status === CONSTANTS.STATUS.CONFIRMED ||
        res.status === CONSTANTS.STATUS.WAITLISTED,
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date)); // 新しい順ソート

  const bookingCards = activeReservations.map(b => {
    const badges = _buildBookingBadges(b);
    const editButtons = _buildEditButtons(b);
    const accountingButtons = _buildAccountingButtons(b);

    return Components.listCard({
      type: 'booking',
      item: b,
      badges: badges,
      editButtons: editButtons,
      accountingButtons: accountingButtons,
    });
  });

  // 予約セクションを生成（Componentsに構造生成を委任）
  const yourBookingsHtml = Components.dashboardSection({
    title: 'よやく',
    items: bookingCards,
    showNewButton: true,
    newAction: 'showClassroomModal',
  });

  // 履歴セクション用のカード配列を構築：完了ステータスのみ表示
  let historyHtml = '';
  const completedReservations = myReservations
    .filter(res => res.status === CONSTANTS.STATUS.COMPLETED)
    .sort((a, b) => new Date(b.date) - new Date(a.date)); // 新しい順ソート

  const recordsToShow = state.recordsToShow;
  const completedRecords = completedReservations.slice(0, recordsToShow);

  if (completedRecords.length > 0) {
    // 「きろく」は COMPLETED ステータスのみ表示
    const historyCards = completedRecords.map(h => {
      // 編集モード状態を取得
      const isInEditMode = stateManager.isInEditMode(h.reservationId);

      const editButtons = _buildHistoryEditButtons(h, isInEditMode);
      const accountingButtons = _buildHistoryAccountingButtons(h);

      return _buildHistoryCardWithEditMode(
        h,
        editButtons,
        accountingButtons,
        isInEditMode,
      );
    });

    const showMore = recordsToShow < completedReservations.length;

    // Componentsに構造生成を委任
    historyHtml = Components.dashboardSection({
      title: 'きろく',
      items: historyCards,
      showMoreButton: showMore,
      moreAction: 'loadMoreHistory',
    });
  }

  return `
        <div class="flex flex-col sm:flex-row justify-between sm:items-center mb-2">
            <h1 class="text-base sm:text-xl font-bold ${DesignConfig.colors.text} mr-4 mb-1 sm:mb-0">ようこそ <span class="text-xl whitespace-nowrap">${stateManager.getState().currentUser.displayName} <span class="text-base">さん</span></span></h1>
            <button data-action="goToEditProfile" class="${DesignConfig.colors.info} self-end sm:self-auto text-sm text-action-secondary-text px-3 py-0.5 rounded-md active:bg-action-secondary-hover">Profile 編集</button>
        </div>
        ${yourBookingsHtml}
        ${historyHtml}
    `;
};

/**
 * 教室名に応じた色クラスを取得します
 * @param {string} classroomName - 教室名
 * @returns {string} 色クラス文字列
 */
const getClassroomColorClass = classroomName => {
  if (classroomName.includes('東京')) {
    return DesignConfig.classroomColors.tokyo.colorClass;
  } else if (classroomName.includes('沼津')) {
    return DesignConfig.classroomColors.numazu.colorClass;
  } else if (classroomName.includes('つくば')) {
    return DesignConfig.classroomColors.tsukuba.colorClass;
  } else {
    return DesignConfig.classroomColors.default.colorClass;
  }
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
 * プロフィール編集画面のUIを生成します。
 * @returns {string} HTML文字列
 */
const getEditProfileView = () => getUserFormView({ mode: 'edit' });

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
