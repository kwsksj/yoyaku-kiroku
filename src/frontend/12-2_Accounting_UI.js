/**
 * =================================================================
 * ファイル概要
 * -----------------------------------------------------------------
 * 名称: 12-2_Accounting_UI.js
 * 目的: 会計画面のUIセクションを生成する
 * 主な責務:
 *   - 授業料/販売/支払いなど各セクションのHTML構築
 *   - `Components` を利用した統一デザインの適用
 *   - 会計フォーム入力値をUIに反映する補助ロジックの提供
 * AI向けメモ:
 *   - 会計画面に新しいUI要素を追加する場合はここでHTML生成を行い、イベント処理はハンドラー層に実装する
 * =================================================================
 */

/**
 * @typedef {{ type: string; l?: number; w?: number; h?: number; }} MaterialFormEntry
 * @typedef {{ name: string; price: number; }} ProductSelectionEntry
 * @typedef {{ name?: string; price?: number; }} CustomSalesEntry
 */

// ================================================================
// UI系モジュール
// ================================================================
import { Components, escapeHTML } from './13_WebApp_Components.js';

const ACCOUNTING_SELECT_CLASS =
  'w-full px-3 py-2.5 text-base border-2 border-ui-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-text bg-ui-input focus:bg-ui-input-focus mobile-input touch-friendly';
const ACCOUNTING_NUMBER_INPUT_CLASS =
  'px-3 py-2 text-base border-2 border-ui-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-text bg-ui-input focus:bg-ui-input-focus text-right';
const ACCOUNTING_TEXT_INPUT_CLASS =
  'px-3 py-2 text-base border-2 border-ui-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-text bg-ui-input focus:bg-ui-input-focus';
export const ACCOUNTING_COMPACT_NUMBER_INPUT_CLASS =
  'w-16 px-2 py-1.5 text-base border-2 border-ui-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-text bg-ui-input focus:bg-ui-input-focus text-right';

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
  const { baseItems, additionalItems } = classifiedItems.tuition;

  // 基本授業料項目を取得
  const baseItem = baseItems.find(
    (/** @type {AccountingMasterItemCore} */ item) => {
      const targetClassroom =
        item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM];
      return (
        targetClassroom === classroom || targetClassroom.includes(classroom)
      );
    },
  );

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
          size: 'large',
          dataAttributes: { 'item-name': baseItemName },
        })}
        <div class="time-controls mt-3 ml-2">
          <div class="flex items-center space-x-2 mb-3">
            <select id="start-time" class="time-select time-display flex-1 p-2 border-2 border-ui-border rounded focus:outline-none focus:ring-2 focus:ring-brand-text">
              ${generateTimeOptions(formData.startTime)}
            </select>
            <span class="font-mono-numbers text-brand-text">~</span>
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
          <div class="calculated-amount font-mono-numbers text-gray-600 w-full flex justify-end">
            <span id="time-calculation">-- ×${Components.priceDisplay({ amount: unitPrice * 2 })} = <span class="font-bold text-brand-text text-right">--</span></span>
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
              size: 'large',
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
  const otherItems = additionalItems;

  if (otherItems.length > 0) {
    otherItemsHtml = '<div class="other-tuition mb-4 space-y-1">';
    otherItems.forEach((/** @type {AccountingMasterItemCore} */ item) => {
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
                size: 'large',
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
 * @param {AccountingMasterItemCore[]} materialItems - 材料項目配列
 * @param {number} index - 行インデックス
 * @param {MaterialFormEntry=} materialData - 既存の材料データ
 * @returns {string} HTML文字列
 */
export function generateMaterialRow(materialItems, index = 0, materialData) {
  /** @type {MaterialFormEntry | undefined} */
  const data = materialData;

  // 材料選択肢を生成
  let materialOptions = '<option value="">おえらびください</option>';
  materialItems.forEach((/** @type {AccountingMasterItemCore} */ item) => {
    const itemName = item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME];
    const selected = data?.type === itemName ? 'selected' : '';
    materialOptions += `<option value="${escapeHTML(itemName)}" ${selected}>${escapeHTML(itemName)}</option>`;
  });

  // 体積計算材料の場合のサイズ入力
  const showSizeInputs =
    data?.type &&
    materialItems.find(
      item =>
        item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME] === data.type &&
        item[CONSTANTS.HEADERS.ACCOUNTING.UNIT] === 'cm³',
    );

  const sizeInputsHtml = showSizeInputs
    ? `
    <div class="size-inputs flex items-center space-x-1 mb-2 pl-5">
      <input
        type="number"
        id="material-length-${index}"
        value="${data?.l ?? ''}"
        placeholder="x"
        class="${ACCOUNTING_COMPACT_NUMBER_INPUT_CLASS}"
      >
      <span class="text-sm">×</span>
      <input
        type="number"
        id="material-width-${index}"
        value="${data?.w ?? ''}"
        placeholder="y"
        class="${ACCOUNTING_COMPACT_NUMBER_INPUT_CLASS}"
      >
      <span class="text-sm">×</span>
      <input
        type="number"
        id="material-height-${index}"
        value="${data?.h ?? ''}"
        placeholder="z"
        class="${ACCOUNTING_COMPACT_NUMBER_INPUT_CLASS}"
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
          <select id="material-type-${index}" class="material-select ${ACCOUNTING_SELECT_CLASS}">
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
  const form = /** @type {AccountingFormDto} */ (formData || {});

  // 材料代セクション
  let materialsHtml = '';
  if (classifiedItems.sales.materialItems.length > 0) {
    const existingMaterials = Array.isArray(form.materials)
      ? form.materials
      : [];
    let materialRows = existingMaterials
      .map((material, index) =>
        generateMaterialRow(
          classifiedItems.sales.materialItems,
          index,
          material,
        ),
      )
      .join('');

    // 新規追加用の空行を追加
    const newMaterialIndex = existingMaterials.length;
    materialRows += generateMaterialRow(
      classifiedItems.sales.materialItems,
      newMaterialIndex,
      undefined,
    );

    materialsHtml = `
      <div class="materials mb-6">
        <h4 class="font-medium text-brand-text mb-3">材料</h4>
        <div id="materials-container">
          ${materialRows}
        </div>
      </div>`;
  }

  // 物販セクション（プルダウン選択式 + 自由入力）
  let productsHtml = '';
  if (classifiedItems.sales.productItems.length > 0) {
    // 自由入力物販の初期行を生成
    const customSalesSource = Array.isArray(form.customSales)
      ? form.customSales
      : [];
    const customSalesRows = generateCustomSalesRows(
      customSalesSource.length > 0
        ? customSalesSource
        : [/** @type {CustomSalesEntry} */ ({})],
    );

    const existingProducts = Array.isArray(form.selectedProducts)
      ? form.selectedProducts
      : [];
    let productRows = existingProducts
      .map((product, index) =>
        generateProductRow(classifiedItems.sales.productItems, index, product),
      )
      .join('');

    // 新規追加用の空行を追加
    const newProductIndex = existingProducts.length;
    productRows += generateProductRow(
      classifiedItems.sales.productItems,
      newProductIndex,
      undefined,
    );

    productsHtml = `
      <div class="products mb-6">
        <h4 class="font-medium text-brand-text mb-3">物販</h4>
        <div id="products-container">
          ${productRows}
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
          ${Components.sectionHeader({ title: '販売（材料・物販）', asSummary: true })}
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
 * @param {AccountingMasterItemCore[]} productItems - 物販項目配列
 * @param {number} index - 行インデックス
 * @param {ProductSelectionEntry=} productData - 既存の物販データ
 * @returns {string} HTML文字列
 */
export function generateProductRow(productItems, index = 0, productData) {
  /** @type {ProductSelectionEntry | undefined} */
  const data = productData;
  // 物販選択肢を生成
  let productOptions = '<option value="">おえらびください</option>';
  productItems.forEach((/** @type {AccountingMasterItemCore} */ item) => {
    const itemName = item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME];
    const price = Number(item[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE]);
    const selected = data?.name === itemName ? 'selected' : '';
    productOptions += `<option value="${escapeHTML(itemName)}" data-price="${price}" ${selected}>${escapeHTML(itemName)} ${Components.priceDisplay({ amount: price })}</option>`;
  });

  return `
    <div class="product-row  border-ui-border p-0 ${index > 0 ? 'mt-2' : ''}" data-product-row="${index}">
      <div class="flex items-center space-x-3">
        <div class="flex-shrink-0 w-2 text-center">
          <span class="text-brand-text">•</span>
        </div>
        <div class="flex-1">
          <select id="product-type-${index}" class="product-select ${ACCOUNTING_SELECT_CLASS}">
            ${productOptions}
          </select>
        </div>
        <div class="price-display">
          <span id="product-price-${index}" class="font-bold">${Components.priceDisplay({ amount: data?.price || 0 })}</span>
        </div>
      </div>
    </div>`;
}

/**
 * 自由入力物販行群生成
 * @param {CustomSalesEntry[]} customSalesData - 自由入力物販データ配列
 * @returns {string} HTML文字列
 */
export function generateCustomSalesRows(customSalesData = []) {
  const rows =
    customSalesData.length > 0
      ? customSalesData
      : [/** @type {CustomSalesEntry} */ ({})];

  return rows
    .map((itemData, index) =>
      generateCustomSalesRow(index, /** @type {CustomSalesEntry} */ (itemData)),
    )
    .join('');
}

/**
 * 自由入力物販行生成（物販行と同じデザイン）
 * @param {number} index - 行インデックス
 * @param {CustomSalesEntry} [itemData={}] - 既存のアイテムデータ
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
            class="w-full ${ACCOUNTING_TEXT_INPUT_CLASS}"
          >
        </div>
        <div class="w-24">
          <input
            type="number"
            id="custom-sales-price-${index}"
            value="${itemData.price ?? ''}"
            placeholder="金額"
            class="w-full ${ACCOUNTING_NUMBER_INPUT_CLASS}"
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
 * @param {ReservationCore | null} reservationData - 予約データ
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
      lessonId: reservationData.lessonId || '',
      studentId: reservationData.studentId || '',
      status: reservationData.status || '',
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
 * @param {ReservationCore | null} reservationData - 予約データ（講座基本情報表示用）
 * @returns {string} HTML文字列
 */
export function generateAccountingView(
  classifiedItems,
  classroom,
  formData = {},
  reservationData = null,
) {
  return `
    ${Components.pageHeader({ title: '会計', backAction: 'smartGoBack' })}
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
            <div id="payment-options-container" class="flex flex-wrap gap-3 md:gap-4">
              <!-- getPaymentOptionsHtml()で生成される -->
            </div>
            <div id="payment-info-container" class="mt-3"></div>
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
              action: 'confirmAndPay',
              text: '先生に確認&支払い しました！',
              style: 'primary',
              size: 'large',
              customClass: 'w-full transition-all duration-200 hover:shadow-md',
              disabled: true, // 支払方法選択までは無効
              id: 'confirm-payment-button',
              disabledStyle: 'auto',
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
  const options = [
    {
      value: CONSTANTS.PAYMENT_DISPLAY.CASH,
      text: CONSTANTS.PAYMENT_DISPLAY.CASH,
    },
    {
      value: CONSTANTS.PAYMENT_DISPLAY.BANK_TRANSFER,
      text: CONSTANTS.PAYMENT_DISPLAY.BANK_TRANSFER,
    },
    {
      value: CONSTANTS.PAYMENT_DISPLAY.COTRA,
      text: CONSTANTS.PAYMENT_DISPLAY.COTRA,
    },
  ];
  const optionCards = options
    .map(opt => {
      const isSelected = selectedValue === opt.value;
      const baseClass =
        'flex items-center gap-2 px-3 py-2 border-2 rounded-lg min-w-[160px] transition-all duration-150';
      const selectedClass =
        'border-action-attention bg-action-secondary-bg font-bold text-brand-text shadow-sm';
      const unselectedClass = 'border-ui-border bg-ui-surface text-brand-muted';

      return `<label class="${baseClass} ${isSelected ? selectedClass : unselectedClass} cursor-pointer">
          <input type="radio" name="payment-method" value="${opt.value}" class="accent-action-primary-bg" ${isSelected ? 'checked' : ''}>
          <span class="text-base">${opt.text}</span>
        </label>`;
    })
    .join('');

  return `<div class="flex flex-wrap gap-2">${optionCards}</div>`;
};

/**
 * 選択された支払方法に応じた支払い情報を動的に表示するUIを生成します。
 * @param {string} selectedPaymentMethod - 選択された支払方法
 * @returns {string} HTML文字列
 */
export const getPaymentInfoHtml = (selectedPaymentMethod = '') => {
  const baseWrapperStart =
    '<div class="bg-ui-surface border-2 border-ui-border p-3 rounded-md space-y-2">';
  const wrapperEnd = '</div>';

  if (!selectedPaymentMethod) {
    return `<p class="text-brand-muted text-sm">支払方法をえらんでください。</p>`;
  }

  if (selectedPaymentMethod === CONSTANTS.PAYMENT_DISPLAY.COTRA) {
    return `
      ${baseWrapperStart}
        <div class="${DesignConfig.text['body']} font-bold">ことら送金のご案内</div>
        <div class="${DesignConfig.text['body']} flex justify-between items-center">
          <span class="font-bold">送金先 電話番号:</span>
          <span class="ml-2 font-mono">${CONSTANTS.BANK_INFO.COTRA_PHONE}</span>
          <button data-action="copyToClipboard" data-copy-text="${CONSTANTS.BANK_INFO.COTRA_PHONE}" class="flex-shrink-0 text-sm bg-action-secondary-bg active:bg-action-secondary-hover text-action-secondary-text font-bold px-2 py-1 rounded mobile-button">コピー</button>
        </div>
        <p class="text-sm text-brand-subtle">
          電話番号だけで銀行口座間で送金できるサービスです。手数料無料。対応アプリ一覧は
          <a href="https://www.cotra.ne.jp/member/" target="_blank" class="text-ui-link-text underline">こちら</a>。
        </p>
      ${wrapperEnd}
    `;
  }

  if (selectedPaymentMethod === CONSTANTS.PAYMENT_DISPLAY.BANK_TRANSFER) {
    return `
      ${baseWrapperStart}
        <div class="${DesignConfig.text['body']} font-bold">振込先</div>
        <div class="flex justify-between items-center">
          <div class="text-base text-brand-text">${CONSTANTS.BANK_INFO.NAME}</div>
        </div>
        <div class="flex justify-between items-center">
          <div class="text-base text-brand-text">店番: ${CONSTANTS.BANK_INFO.BRANCH}</div>
          <button data-action="copyToClipboard" data-copy-text="${CONSTANTS.BANK_INFO.BRANCH}" class="text-sm bg-action-secondary-bg active:bg-action-secondary-hover text-action-secondary-text font-bold px-2 py-1 rounded mobile-button">コピー</button>
        </div>
        <div class="flex justify-between items-center">
          <div class="text-base text-brand-text">普通: ${CONSTANTS.BANK_INFO.ACCOUNT}</div>
          <button data-action="copyToClipboard" data-copy-text="${CONSTANTS.BANK_INFO.ACCOUNT}" class="text-sm bg-action-secondary-bg active:bg-action-secondary-hover text-action-secondary-text font-bold px-2 py-1 rounded mobile-button">コピー</button>
        </div>
      ${wrapperEnd}
    `;
  }

  // 現金の場合
  return `
    ${baseWrapperStart}
      <div class="${DesignConfig.text['body']} text-brand-text">現金でお支払いください。</div>
    ${wrapperEnd}
  `;
};
