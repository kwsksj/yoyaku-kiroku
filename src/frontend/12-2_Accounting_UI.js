/// <reference path="../../types/frontend-index.d.ts" />
/**
 * 会計システム - UI生成層
 *
 * 責務:
 * - 時刻選択オプション生成
 * - 授業料セクション生成
 * - 販売セクション生成（材料・物販）
 * - 支払い方法UI生成
 * - 会計画面全体のレイアウト生成
 */


// ================================================================================
// 【UI生成層】（Components.js活用）
// ================================================================================

/**
 * 時刻選択オプション生成
 * @param {string} selectedValue - 選択済みの値
 * @returns {string} HTML文字列
 */
export function generateTimeOptions(selectedValue = '') {
  return Components.timeOptions({
    startTime: '09:00',
    endTime: '19:00',
    interval: 30,
    selectedValue: selectedValue,
  });
}

/**
 * 授業料セクション生成（Components.js活用）
 * @param {ClassifiedAccountingItemsCore} classifiedItems - 分類済み会計項目
 * @param {string} classroom - 教室名
 * @param {AccountingFormDto} formData - フォームデータ
 * @returns {string} HTML文字列
 */
export function generateTuitionSection(
  classifiedItems,
  classroom,
  formData = {},
) {
  // 基本授業料の定数リスト
  const BASE_TUITION_ITEMS = [
    CONSTANTS.ITEMS.MAIN_LECTURE_COUNT,
    CONSTANTS.ITEMS.MAIN_LECTURE_TIME,
    CONSTANTS.ITEMS.MAIN_LECTURE, // 後方互換性のため残す
  ];

  // 基本授業料項目を取得
  const baseItem = classifiedItems.tuition.items.find(item => {
    const itemName = item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME];
    const targetClassroom = item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM];
    return (
      BASE_TUITION_ITEMS.includes(itemName) &&
      (targetClassroom === classroom || targetClassroom.includes(classroom))
    );
  });

  if (!baseItem) {
    return `<section class="tuition-section">
      ${Components.sectionHeader({ title: '授業料' })}
      <p class="text-gray-500">この教室の授業料設定が見つかりません。</p>
    </section>`;
  }

  const unit = baseItem[CONSTANTS.HEADERS.ACCOUNTING.UNIT];
  const unitPrice = Number(baseItem[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE]);
  const baseItemName = baseItem[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME];
  const isTimeBased = unit === '30分';

  // 基本授業料UI
  let baseTuitionHtml = '';
  if (isTimeBased) {
    // 時間制の場合
    baseTuitionHtml = `
      <div class="base-tuition mb-4">
        ${Components.checkbox({
          id: 'base-tuition',
          label: baseItemName,
          checked: true,
          dataAttributes: { 'item-name': baseItemName },
        })}
        <div class="time-controls mt-3 ml-2">
          <div class="flex items-center space-x-2 mb-3">
            <select id="start-time" class="time-select time-display flex-1 p-2 border-2 border-ui-border rounded focus:outline-none focus:ring-2 focus:ring-brand-text">
              ${generateTimeOptions(formData.startTime)}
            </select>
            <span class="text-sm text-brand-text">-</span>
            <select id="end-time" class="time-select time-display flex-1 p-2 border-2 border-ui-border rounded focus:outline-none focus:ring-2 focus:ring-brand-text">
              ${generateTimeOptions(formData.endTime)}
            </select>
            <span class="text-sm text-brand-text ml-2">休憩</span>
            <select id="break-time" class="time-select time-display w-14 p-2 border-2 border-ui-border rounded focus:outline-none focus:ring-2 focus:ring-brand-text">
              <option value="0" ${formData.breakTime === 0 ? 'selected' : ''}>0分</option>
              <option value="30" ${formData.breakTime === 30 ? 'selected' : ''}>30分</option>
              <option value="60" ${formData.breakTime === 60 ? 'selected' : ''}>60分</option>
              <option value="90" ${formData.breakTime === 90 ? 'selected' : ''}>90分</option>
            </select>
          </div>
          <div class="calculated-amount text-sm text-gray-600">
            <span id="time-calculation" class="font-mono-numbers">-- ×${Components.priceDisplay({ amount: unitPrice * 2 })} = <span class="font-bold text-brand-text text-right">--</span></span>
          </div>
        </div>
      </div>`;
  } else {
    // 回数制の場合
    baseTuitionHtml = `
      <div class="base-tuition  border-ui-border p-0 mb-2" data-checkbox-row>
        <div class="flex items-center space-x-3">
          <div class="flex-1">
            ${Components.checkbox({
              id: 'base-tuition',
              label: baseItemName,
              checked: true,
              dynamicStyle: true,
              dataAttributes: { 'item-name': baseItemName },
            })}
          </div>
          <div class="price-display">
            <span class="text-right">
              <span class="price-amount font-bold text-brand-text">¥${unitPrice.toLocaleString()}</span>
            </span>
          </div>
        </div>
      </div>`;
  }

  // その他の授業料・割引項目UI生成
  let otherItemsHtml = '';
  const otherItems = classifiedItems.tuition.items.filter(
    item =>
      !BASE_TUITION_ITEMS.includes(
        item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME],
      ),
  );

  if (otherItems.length > 0) {
    otherItemsHtml = '<div class="other-tuition mb-4 space-y-1">';
    otherItems.forEach(item => {
      const itemName = item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME];
      const price = Number(item[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE]);
      const isChecked = formData.checkedItems?.[itemName] || false;

      otherItemsHtml += `
        <div class=" border-ui-border p-0" data-checkbox-row>
          <div class="flex items-center space-x-3">
            <div class="flex-1">
              ${Components.checkbox({
                id: `other-${itemName.replace(/\s+/g, '-')}`,
                label: itemName,
                checked: isChecked,
                dynamicStyle: true,
                dataAttributes: {
                  'item-name': itemName,
                },
              })}
            </div>
            <div class="price-display">
              <span class="text-right">
                <span class="price-amount ${isChecked ? 'font-bold text-brand-text' : 'text-brand-muted'} ${price < 0 ? 'text-red-600' : ''}">¥${price.toLocaleString()}</span>
              </span>
            </div>
          </div>
        </div>`;
    });
    otherItemsHtml += '</div>';
  }

  return Components.cardContainer({
    variant: 'default',
    padding: 'spacious',

    content: `
      <section class="tuition-section">
        ${Components.sectionHeader({ title: '授業料' })}
        ${baseTuitionHtml}
        ${otherItemsHtml}
        ${Components.subtotalSection({
          title: '授業料小計',
          amount: 0,
          id: 'tuition-subtotal-amount',
        })}
      </section>
    `,
  });
}

/**
 * 材料行生成（Components.js活用）
 * @param {Array} materialItems - 材料項目配列
 * @param {number} index - 行インデックス
 * @param {Object} materialData - 既存の材料データ
 * @returns {string} HTML文字列
 */
export function generateMaterialRow(
  materialItems,
  index = 0,
  materialData = {},
) {
  // 材料選択肢を生成
  let materialOptions = '<option value="">おえらびください</option>';
  materialItems.forEach(item => {
    const itemName = item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME];
    const selected = materialData.type === itemName ? 'selected' : '';
    materialOptions += `<option value="${escapeHTML(itemName)}" ${selected}>${escapeHTML(itemName)}</option>`;
  });

  // 体積計算材料の場合のサイズ入力
  const showSizeInputs =
    materialData.type &&
    materialItems.find(
      item =>
        item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME] === materialData.type &&
        item[CONSTANTS.HEADERS.ACCOUNTING.UNIT] === 'cm³',
    );

  const sizeInputsHtml = showSizeInputs
    ? `
    <div class="size-inputs flex items-center space-x-0 mb-2 pl-7">
      <input
        type="number"
        id="material-length-${index}"
        value="${materialData.l ?? ''}"
        placeholder="x"
        class="w-12 p-0.5 border-2 border-ui-border rounded focus:outline-none focus:ring-2 focus:ring-brand-text text-right"
      >
      <span class="text-sm">×</span>
      <input
        type="number"
        id="material-width-${index}"
        value="${materialData.w ?? ''}"
        placeholder="y"
        class="w-12 p-0.5 border-2 border-ui-border rounded focus:outline-none focus:ring-2 focus:ring-brand-text text-right"
      >
      <span class="text-sm">×</span>
      <input
        type="number"
        id="material-height-${index}"
        value="${materialData.h ?? ''}"
        placeholder="z"
        class="w-12 p-0.5 border-2 border-ui-border rounded focus:outline-none focus:ring-2 focus:ring-brand-text text-right"
      >
      <span class="text-sm text-gray-600">mm</span>
    </div>`
    : '';

  return `
    <div class="material-row  border-ui-border p-0 ${index > 0 ? 'mt-2' : ''}" data-material-row="${index}">
      <div class="flex items-center space-x-3">
        <div class="flex-shrink-0 w-2 text-center">
          <span class="text-brand-text">•</span>
        </div>
        <div class="flex-1">
          <select id="material-type-${index}" class="material-select w-full p-0.5 border-2 border-ui-border rounded focus:outline-none focus:ring-2 focus:ring-brand-text">
            ${materialOptions}
          </select>
        </div>
        <div class="price-display">
          <span id="material-price-${index}" class="font-bold">${Components.priceDisplay({ amount: 0 })}</span>
        </div>
      </div>
      ${sizeInputsHtml}
    </div>`;
}

/**
 * 販売セクション生成（Components.js活用）
 * @param {ClassifiedAccountingItemsCore} classifiedItems - 分類済み会計項目
 * @param {AccountingFormDto} formData - フォームデータ
 * @returns {string} HTML文字列
 */
export function generateSalesSection(classifiedItems, formData = {}) {
  // 材料代セクション
  let materialsHtml = '';
  if (classifiedItems.sales.materialItems.length > 0) {
    materialsHtml = `
      <div class="materials mb-6">
        <h4 class="font-medium text-brand-text mb-3">材料</h4>
        <div id="materials-container">
          ${generateMaterialRow(classifiedItems.sales.materialItems, 0, formData.materials?.[0] || {})}
        </div>
      </div>`;
  }

  // 物販セクション（プルダウン選択式 + 自由入力）
  let productsHtml = '';
  if (classifiedItems.sales.productItems.length > 0) {
    // 自由入力物販の初期行を生成
    const customSalesRows = generateCustomSalesRows(
      formData.customSales || [{}],
    );

    productsHtml = `
      <div class="products mb-6">
        <h4 class="font-medium text-brand-text mb-3">物販</h4>
        <div id="products-container">
          ${generateProductRow(classifiedItems.sales.productItems, 0, formData.selectedProducts?.[0] || {})}
        </div>
        <div class="custom-sales-divider mb-2">
        </div>
        <div id="custom-sales-container">
          ${customSalesRows}
        </div>
      </div>`;
  }

  return Components.cardContainer({
    variant: 'default',
    padding: 'spacious',
    content: `
      <section class="sales-section">
        <details>
          ${Components.sectionHeader({ title: '販売', asSummary: true })}
          <div class="mt-3">
            ${materialsHtml}
            ${productsHtml}
          </div>
        </details>
        ${Components.subtotalSection({
          title: '販売小計',
          amount: 0,
          id: 'sales-subtotal-amount',
        })}
      </section>
    `,
  });
}

/**
 * 物販行生成（Components.js活用）
 * @param {Array} productItems - 物販項目配列
 * @param {number} index - 行インデックス
 * @param {Object} productData - 既存の物販データ
 * @returns {string} HTML文字列
 */
export function generateProductRow(productItems, index = 0, productData = {}) {
  // 物販選択肢を生成
  let productOptions = '<option value="">おえらびください</option>';
  productItems.forEach(item => {
    const itemName = item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME];
    const price = Number(item[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE]);
    const selected = productData.name === itemName ? 'selected' : '';
    productOptions += `<option value="${escapeHTML(itemName)}" data-price="${price}" ${selected}>${escapeHTML(itemName)} ${Components.priceDisplay({ amount: price })}</option>`;
  });

  return `
    <div class="product-row  border-ui-border p-0 ${index > 0 ? 'mt-2' : ''}" data-product-row="${index}">
      <div class="flex items-center space-x-3">
        <div class="flex-shrink-0 w-2 text-center">
          <span class="text-brand-text">•</span>
        </div>
        <div class="flex-1">
          <select id="product-type-${index}" class="product-select w-full p-0.5 border-2 border-ui-border rounded focus:outline-none focus:ring-2 focus:ring-brand-text">
            ${productOptions}
          </select>
        </div>
        <div class="price-display">
          <span id="product-price-${index}" class="font-bold">${Components.priceDisplay({ amount: productData.price || 0 })}</span>
        </div>
      </div>
    </div>`;
}

/**
 * 自由入力物販行群生成
 * @param {Array} customSalesData - 自由入力物販データ配列
 * @returns {string} HTML文字列
 */
export function generateCustomSalesRows(customSalesData = [{}]) {
  return customSalesData
    .map((itemData, index) => generateCustomSalesRow(index, itemData))
    .join('');
}

/**
 * 自由入力物販行生成（物販行と同じデザイン）
 * @param {number} index - 行インデックス
 * @param {Object} itemData - 既存のアイテムデータ
 * @returns {string} HTML文字列
 */
export function generateCustomSalesRow(index = 0, itemData = {}) {
  return `
    <div class="custom-sales-row  border-ui-border p-0 ${index > 0 ? 'mt-1' : ''}" data-custom-sales-row="${index}">
      <div class="flex items-center space-x-3">
        <div class="flex-shrink-0 w-2 text-center">
          <span class="text-brand-text">•</span>
        </div>
        <div class="flex-1">
          <input
            type="text"
            id="custom-sales-name-${index}"
            value="${itemData.name || ''}"
            placeholder="自由入力"
            class="w-full p-0.5 border-2 border-ui-border rounded focus:outline-none focus:ring-2 focus:ring-brand-text"
          >
        </div>
        <div class="w-20">
          <input
            type="number"
            id="custom-sales-price-${index}"
            value="${itemData.price ?? ''}"
            placeholder="金額"
            class="w-full p-0.5 border-2 border-ui-border rounded focus:outline-none focus:ring-2 focus:ring-brand-text text-right"
          >
        </div>
        <div class="price-display">
          <span id="custom-sales-display-${index}" class="font-bold">${Components.priceDisplay({ amount: itemData.price || 0 })}</span>
        </div>
      </div>
    </div>`;
}

/**
 * 会計画面用よやくカード生成（ボタン非表示、制作メモ編集モード）
 * @param {ReservationCore} reservationData - 予約データ
 * @returns {string} HTML文字列
 */
export function generateAccountingReservationCard(reservationData) {
  if (!reservationData) {
    return '';
  }

  // 予約カードを生成（ボタンなし、制作メモ編集モード、メモ保存ボタン非表示）
  return Components.listCard({
    item: {
      reservationId: reservationData.reservationId || '',
      date: reservationData.date || '',
      startTime: reservationData.startTime || '',
      endTime: reservationData.endTime || '',
      classroom: reservationData.classroom || '',
      venue: reservationData.venue || '',
      workInProgress: reservationData.workInProgress || '',
    },
    badges: [], // ステータスバッジは表示しない
    editButtons: [], // 編集ボタンは表示しない
    accountingButtons: [], // 会計ボタンは表示しない
    type: 'booking', // 予約カードタイプ
    isEditMode: true, // 制作メモを編集モードに設定
    showMemoSaveButton: false, // 制作メモ保存ボタンは非表示
  });
}

/**
 * メイン会計画面生成（Components.js活用）
 * @param {ClassifiedAccountingItemsCore} classifiedItems - 分類済み会計項目
 * @param {string} classroom - 教室名
 * @param {AccountingFormDto} formData - フォームデータ
 * @param {Object} reservationData - 予約データ（講座基本情報表示用）
 * @returns {string} HTML文字列
 */
export function generateAccountingView(
  classifiedItems,
  classroom,
  formData = {},
  reservationData = null,
) {
  return `
    ${Components.pageHeader({ title: '会計' })}
    <div class="accounting-container max-w-4xl mx-auto p-2 space-y-6">
      <!-- よやくカード（ボタン非表示、制作メモ編集モード） -->
      ${generateAccountingReservationCard(reservationData)}

      <!-- 授業料セクション -->
      ${generateTuitionSection(classifiedItems, classroom, formData)}

      <!-- 販売セクション（物販+自由入力物販統合） -->
      ${generateSalesSection(classifiedItems, formData)}

      <!-- 合計セクション -->
      ${Components.cardContainer({
        variant: 'default',
        padding: 'spacious',
        content: `
          <section class="total-section">
            <div class="grand-total text-center">
              <span class="text-2xl font-bold text-brand-text">総合計: </span>
              <span id="grand-total-amount" class="text-2xl font-bold text-brand-text">${Components.priceDisplay({ amount: 0, size: 'large' })}</span>
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
            <div id="payment-options-container">
              <!-- getPaymentOptionsHtml()で生成される -->
            </div>
          </section>
        `,
      })}

      <!-- 確認ボタン -->
      ${Components.cardContainer({
        variant: 'default',
        padding: 'spacious',
        content: `
          <div class="space-y-3">
            ${Components.button({
              action: 'showPaymentModal',
              text: '先生が確認しました',
              style: 'primary',
              size: 'large',
              customClass:
                'w-full transition-all duration-200 hover:shadow-md opacity-60 cursor-not-allowed',
              disabled: true,
              id: 'confirm-payment-button',
              disabledStyle: 'none', // カスタムスタイルで制御
            })}
            ${Components.button({
              action: 'smartGoBack',
              text: 'もどる',
              style: 'secondary',
              size: 'large',
              customClass: 'w-full',
            })}
          </div>
        `,
      })}
    </div>`;
}

/**
 * 支払い方法の選択肢（ラジオボタン）UIを生成します。
 * @param {string} selectedValue - 選択済みの支払い方法
 * @returns {string} HTML文字列
 */
export const getPaymentOptionsHtml = selectedValue => {
  const cotraDetails = `
        <details class="mt-0 ml-4">
            <summary class="inline-block px-0 py-0 bg-ui-warning-light text-ui-warning-text text-sm font-semibold rounded-md active:bg-ui-warning-bg">
            <span class="arrow">▶</span> ことら送金とは？
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
      value: CONSTANTS.PAYMENT_DISPLAY.BANK_TRANSFER,
      text: CONSTANTS.PAYMENT_DISPLAY.BANK_TRANSFER,
      details: '',
    },
    {
      value: CONSTANTS.PAYMENT_DISPLAY.COTRA,
      text: CONSTANTS.PAYMENT_DISPLAY.COTRA,
      details: cotraDetails,
    },
  ];
  return options
    .map(
      opt => `
        <div class="mb-2">
            <label class="flex items-center space-x-2 ${selectedValue === opt.value ? 'font-bold text-brand-text' : 'text-brand-muted'} cursor-pointer transition-all duration-150">
                <input type="radio" name="payment-method" value="${opt.value}" class="accent-action-primary-bg" ${selectedValue === opt.value ? 'checked' : ''}>
                <span>${opt.text}</span>
            </label>
            ${opt.details}
        </div>`,
    )
    .join('');
};

/**
 * 選択された支払方法に応じた支払い情報を動的に表示するUIを生成します。
 * @param {string} selectedPaymentMethod - 選択された支払方法
 * @returns {string} HTML文字列
 */
export const getPaymentInfoHtml = (selectedPaymentMethod = '') => {
  let paymentInfoHtml = '';

  // ことら送金が選択された場合のみ電話番号を表示
  if (selectedPaymentMethod === CONSTANTS.PAYMENT_DISPLAY.COTRA) {
    paymentInfoHtml += `
        <div class="bg-ui-surface border-2 border-ui-border p-3 rounded-md">
            <div class="flex justify-between items-center">
                <div class="${DesignConfig.text['body']}"><span class="font-bold">送金先 電話番号:</span><span class="ml-2 font-mono">${CONSTANTS.BANK_INFO.COTRA_PHONE}</span></div>
                <button data-action="copyToClipboard" data-copy-text="${CONSTANTS.BANK_INFO.COTRA_PHONE}" class="flex-shrink-0 text-sm bg-action-secondary-bg active:bg-action-secondary-hover text-action-secondary-text font-bold px-2 py-1 rounded mobile-button">コピー</button>
            </div>
        </div>`;
  }

  // 振込が選択された場合のみ口座情報を表示
  if (selectedPaymentMethod === CONSTANTS.PAYMENT_DISPLAY.BANK_TRANSFER) {
    paymentInfoHtml += `
        <div class="bg-ui-surface border-2 border-ui-border p-3 rounded-md">
            <div class="text-brand-text"><span class="font-bold">振込先:</span><span class="ml-2">${CONSTANTS.BANK_INFO.NAME}</span></div>
            <div class="mt-1 flex justify-between items-center">
                <div class="text-base text-brand-text">店番: ${CONSTANTS.BANK_INFO.BRANCH}</div>
                <button data-action="copyToClipboard" data-copy-text="${CONSTANTS.BANK_INFO.BRANCH}" class="text-sm bg-action-secondary-bg active:bg-action-secondary-hover text-action-secondary-text font-bold px-2 py-1 rounded mobile-button">コピー</button>
            </div>
            <div class="mt-1 flex justify-between items-center">
                <div class="text-base text-brand-text">普通: ${CONSTANTS.BANK_INFO.ACCOUNT}</div>
                <button data-action="copyToClipboard" data-copy-text="${CONSTANTS.BANK_INFO.ACCOUNT}" class="text-sm bg-action-secondary-bg active:bg-action-secondary-hover text-action-secondary-text font-bold px-2 py-1 rounded mobile-button">コピー</button>
            </div>
        </div>`;
  }

  // 現金の場合は何も表示しない
  return paymentInfoHtml;
};
