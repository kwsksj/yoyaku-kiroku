/// <reference path="../../types/frontend-index.d.ts" />
/**
 * 会計システム統合ファイル
 * 3ファイル（Core_Accounting, Views_Accounting, Handlers_Accounting）を1ファイルに統合
 *
 * アーキテクチャ：
 * - 計算ロジック層：会計計算の核心処理
 * - UI生成層：画面要素の生成
 * - イベント処理層：ユーザー操作の処理
 * - ユーティリティ層：共通処理
 */

// ================================================================================
// 【ユーティリティ層】
// ================================================================================

/**
 * 会計処理関連のローカルキャッシュをクリア
 */
export function clearAccountingCache() {
  // 一時的な支払いデータをクリア
  if (typeof window !== 'undefined' && window.tempPaymentData) {
    window.tempPaymentData = null;
  }

  // その他の会計関連の一時データがあればここでクリア
  console.log('会計キャッシュクリア完了');
}

// ================================================================================
// 【計算ロジック層】
// ================================================================================

/**
 * 会計マスタデータを項目種別に分類
 * @param {Array} masterData - 会計マスタデータ
 * @param {string} classroom - 教室名
 * @returns {ClassifiedAccountingItemsCore} 分類済み会計項目
 */
export function classifyAccountingItems(masterData, classroom) {
  const result = {
    tuition: { items: [] }, // 全ての授業料・割引を統一
    sales: { materialItems: [], productItems: [] },
  };

  masterData.forEach(item => {
    const type = item[CONSTANTS.HEADERS.ACCOUNTING.TYPE];
    const targetClassroom = item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM];

    // 教室対象チェック
    if (targetClassroom !== '共通' && !targetClassroom.includes(classroom))
      return;

    if (type === '授業料' || type === '割引') {
      // 全ての授業料・割引項目を統一して扱う
      result.tuition.items.push(item);
    } else if (type === '材料') {
      result.sales.materialItems.push(item);
    } else if (type === '物販') {
      result.sales.productItems.push(item);
    }
  });

  return result;
}

/**
 * 時間単位の計算（30分刻み）
 * @param {string} startTime - 開始時刻 (HH:MM形式)
 * @param {string} endTime - 終了時刻 (HH:MM形式)
 * @param {number} breakTime - 休憩時間（分）
 * @returns {number} 30分単位の数
 */
export function calculateTimeUnits(startTime, endTime, breakTime = 0) {
  if (!startTime || !endTime) return 0;

  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  const totalMinutes = endMinutes - startMinutes - breakTime;

  return Math.max(0, totalMinutes / 30);
}

/**
 * 授業料小計計算
 * @param {AccountingFormDto} formData - フォームデータ
 * @param {ClassifiedAccountingItemsCore} classifiedItems - 分類済み会計項目
 * @param {string} classroom - 教室名
 * @returns {Object} 授業料計算結果
 */
export function calculateTuitionSubtotal(formData, classifiedItems, classroom) {
  let subtotal = 0;
  const items = [];

  // デバッグ: 計算開始
  if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
    console.log('🔍 calculateTuitionSubtotal開始:', {
      classroom,
      checkedItems: formData.checkedItems,
      tuitionItemsCount: classifiedItems.tuition.items.length,
    });
  }

  // 全ての授業料・割引項目をチェック（チェックボックス選択）
  // 時刻パターンを含む項目（古いデータ）は除外
  const timePattern = /\(\d{2}:\d{2}\s*-\s*\d{2}:\d{2}\)/;
  classifiedItems.tuition.items.forEach(item => {
    const itemName = item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME];

    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      console.log('🔍 tuitionItem処理中:', {
        itemName,
        price: item[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE],
        isChecked: !!formData.checkedItems?.[itemName],
        hasTimePattern: timePattern.test(itemName),
      });
    }

    // 時刻パターンを含む項目は除外（レガシーデータ対応）
    if (timePattern.test(itemName)) {
      return; // スキップ
    }
    if (formData.checkedItems?.[itemName]) {
      const price = Number(item[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE]);
      items.push({ name: itemName, price: price });
      subtotal += price;

      if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
        console.log('✅ 項目追加:', { name: itemName, price });
      }
    }
  });

  if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
    console.log('🔍 calculateTuitionSubtotal結果:', { items, subtotal });
  }

  return { items, subtotal };
}

/**
 * 販売小計計算
 * @param {AccountingFormDto} formData - フォームデータ
 * @param {ClassifiedAccountingItemsCore} classifiedItems - 分類済み会計項目
 * @returns {Object} 販売計算結果
 */
export function calculateSalesSubtotal(formData, classifiedItems) {
  let subtotal = 0;
  const items = [];

  // 材料費計算
  if (formData.materials) {
    formData.materials.forEach(material => {
      const masterItem = classifiedItems.sales.materialItems.find(
        item => item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME] === material.type,
      );

      if (masterItem) {
        const unit = masterItem[CONSTANTS.HEADERS.ACCOUNTING.UNIT];
        const unitPrice = Number(
          masterItem[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE],
        );

        let price = 0;
        let itemName = material.type;

        if (unit === 'cm³') {
          // 体積計算（mm → cm変換）
          const volume =
            (material.l / 10) * (material.w / 10) * (material.h / 10);
          price = Math.round((volume * unitPrice) / 100) * 100; // ¥100単位
          price = Math.max(100, price); // 最低¥100
          itemName = `${material.type} (${material.l}×${material.w}×${material.h}mm)`;
        } else {
          // 固定価格
          price = unitPrice;
        }

        items.push({ name: itemName, price: price });
        subtotal += price;
      }
    });
  }

  // 物販（プルダウン選択式）
  if (formData.selectedProducts) {
    formData.selectedProducts.forEach(product => {
      items.push({ name: product.name, price: product.price });
      subtotal += product.price;
    });
  }

  // 自由入力物販
  if (formData.customSales) {
    formData.customSales.forEach(customItem => {
      if (customItem.name && customItem.price) {
        const price = Number(customItem.price);
        items.push({ name: customItem.name, price: price });
        subtotal += price;
      }
    });
  }

  return { items, subtotal };
}

/**
 * 統合計算
 * @param {AccountingFormDto} formData - フォームデータ
 * @param {Array} masterData - 会計マスタデータ
 * @param {string} classroom - 教室名
 * @returns {Object} 統合計算結果
 */
export function calculateAccountingTotal(formData, masterData, classroom) {
  // デバッグ: 計算開始
  if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
    console.log('🔍 calculateAccountingTotal開始:', {
      formData,
      masterDataLength: masterData.length,
      classroom,
    });
  }

  try {
    // マスターデータを拡張（基本授業料を動的に追加）
    const extendedMasterData = [...masterData];

    // 基本授業料の定数リスト
    const BASE_TUITION_ITEMS = [
      CONSTANTS.ITEMS.MAIN_LECTURE_COUNT,
      CONSTANTS.ITEMS.MAIN_LECTURE_TIME,
      CONSTANTS.ITEMS.MAIN_LECTURE, // 後方互換性のため残す
    ];

    // 基本授業料項目を取得（定数リストから判定）
    const baseItem = masterData.find(item => {
      const type = item[CONSTANTS.HEADERS.ACCOUNTING.TYPE];
      const itemName = item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME];
      const targetClassroom =
        item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM];

      return (
        type === '授業料' &&
        BASE_TUITION_ITEMS.includes(itemName) &&
        (targetClassroom === classroom || targetClassroom.includes(classroom))
      );
    });

    if (baseItem) {
      const baseItemName = baseItem[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME];
      const unitPrice = Number(
        baseItem[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE],
      );
      const unit = baseItem[CONSTANTS.HEADERS.ACCOUNTING.UNIT];

      // 基本授業料がチェックされている場合のみ追加
      if (formData.checkedItems?.[baseItemName]) {
        let dynamicItem = null;

        if (unit === '30分') {
          // 時間制の場合：時間計算して動的項目を作成
          if (formData.startTime && formData.endTime) {
            const timeUnits = calculateTimeUnits(
              formData.startTime,
              formData.endTime,
              formData.breakTime || 0,
            );

            if (timeUnits > 0) {
              const hours = timeUnits / 2;
              const price = timeUnits * unitPrice;

              dynamicItem = {
                [CONSTANTS.HEADERS.ACCOUNTING.TYPE]: '授業料',
                [CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME]:
                  `${baseItemName} ${hours}時間`,
                [CONSTANTS.HEADERS.ACCOUNTING.UNIT]: '回',
                [CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE]: price,
                [CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM]:
                  baseItem[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM],
                _isDynamic: true, // 動的項目フラグ
              };
            }
          }
        } else if (unit === '回') {
          // 回数制の場合：基本授業料を動的項目として追加
          dynamicItem = {
            [CONSTANTS.HEADERS.ACCOUNTING.TYPE]: '授業料',
            [CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME]: baseItemName,
            [CONSTANTS.HEADERS.ACCOUNTING.UNIT]: '回',
            [CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE]: unitPrice,
            [CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM]:
              baseItem[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM],
            _isDynamic: true, // 動的項目フラグ
          };

          if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
            console.log('🔍 回数制動的項目作成:', dynamicItem);
          }
        }

        // 動的項目が作成された場合、マスターデータに追加
        if (dynamicItem) {
          extendedMasterData.push(dynamicItem);

          if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
            console.log('🔍 動的項目をextendedMasterDataに追加:', {
              itemName: dynamicItem[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME],
              price: dynamicItem[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE],
            });
          }

          // フォームデータにも追加（自動的にチェック済みとして扱う）
          if (!formData.checkedItems) {
            formData.checkedItems = {};
          }
          formData.checkedItems[
            dynamicItem[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME]
          ] = true;

          if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
            console.log('🔍 checkedItemsに追加:', {
              itemName: dynamicItem[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME],
              allCheckedItems: formData.checkedItems,
            });
          }

          // 元の基本授業料のチェックを外す（重複防止）
          delete formData.checkedItems[baseItemName];
        }
      }
    }

    const classifiedItems = classifyAccountingItems(
      extendedMasterData,
      classroom,
    );
    const tuition = calculateTuitionSubtotal(
      formData,
      classifiedItems,
      classroom,
    );
    const sales = calculateSalesSubtotal(formData, classifiedItems);

    const result = {
      tuition,
      sales,
      grandTotal: tuition.subtotal + sales.subtotal,
      paymentMethod: formData.paymentMethod || CONSTANTS.PAYMENT_DISPLAY.CASH,
    };

    // デバッグ: 計算結果
    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      console.log('🔍 calculateAccountingTotal結果:', result);
      console.log('🔍 授業料小計:', tuition.subtotal);
      console.log('🔍 販売小計:', sales.subtotal);
      console.log('🔍 総合計:', result.grandTotal);
    }

    return result;
  } catch (error) {
    console.error('🔍 calculateAccountingTotal エラー:', error);
    // エラー時は空の結果を返す
    return {
      tuition: { items: [], subtotal: 0 },
      sales: { items: [], subtotal: 0 },
      grandTotal: 0,
      paymentMethod: formData.paymentMethod || CONSTANTS.PAYMENT_DISPLAY.CASH,
    };
  }
}

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
export function generateTuitionSection(classifiedItems, classroom, formData = {}) {
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
            <span id="time-calculation" class="font-mono-numbers">0時間 ×${Components.priceDisplay({ amount: unitPrice * 2 })} = <span class="font-bold text-brand-text text-right">${Components.priceDisplay({ amount: 0 })}</span></span>
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
export function generateMaterialRow(materialItems, index = 0, materialData = {}) {
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
        value="${materialData.l || ''}"
        placeholder="x"
        class="w-12 p-0.5 border-2 border-ui-border rounded focus:outline-none focus:ring-2 focus:ring-brand-text text-right"
      >
      <span class="text-sm">×</span>
      <input
        type="number"
        id="material-width-${index}"
        value="${materialData.w || ''}"
        placeholder="y"
        class="w-12 p-0.5 border-2 border-ui-border rounded focus:outline-none focus:ring-2 focus:ring-brand-text text-right"
      >
      <span class="text-sm">×</span>
      <input
        type="number"
        id="material-height-${index}"
        value="${materialData.h || ''}"
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
            value="${itemData.price || ''}"
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
 * @param {Object} reservationData - 予約データ
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

// ================================================================================
// 【イベント処理層】
// ================================================================================

/**
 * 会計システムのイベントリスナー設定
 * @param {ClassifiedAccountingItemsCore} classifiedItems - 分類済み会計項目
 * @param {string} classroom - 教室名
 */
export function setupAccountingEventListeners(classifiedItems, classroom) {
  // 入力変更イベント（チェックボックス、セレクト、インプット）
  document.addEventListener('change', function (event) {
    const target = event.target;

    // 会計関連の入力要素の変更を検知
    if (target.closest('.accounting-container')) {
      handleAccountingInputChange(event, classifiedItems, classroom);
    }

    // 支払い方法変更
    if (target.name === 'payment-method') {
      handlePaymentMethodChange(target.value);
    }
  });

  // ボタンクリックイベント
  document.addEventListener('click', function (event) {
    const target = event.target;
    const action = target.getAttribute('data-action');

    if (!action) return;

    switch (action) {
      case 'removeMaterialRow':
        removeMaterialRow(target.getAttribute('data-index'));
        break;
      case 'removeProductRow':
        removeProductRow(target.getAttribute('data-index'));
        break;
      case 'showPaymentModal':
        // デバッグ: ボタンクリックを記録
        if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
          console.log('🔴 showPaymentModalボタンがクリックされました');
        }

        // イベントの伝播を停止
        event.preventDefault();
        event.stopPropagation();

        // ボタンが無効状態でないかチェック
        if (
          target.hasAttribute('disabled') ||
          target.style.pointerEvents === 'none'
        ) {
          if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
            console.log('⚠️ ボタンが無効状態のためクリックを無視');
          }
          return;
        }

        showPaymentConfirmModal(classifiedItems, classroom);
        break;
      case 'smartGoBack':
        handleBackToDashboard();
        break;
      case 'cancelPaymentConfirm':
        closePaymentConfirmModal();
        break;
      case 'processPayment':
        handleProcessPayment();
        break;
      case 'saveMemo':
        handleSaveMemo(target);
        break;
    }
  });

  // 材料タイプ変更時の特別処理
  document.addEventListener('change', function (event) {
    if (event.target.id && event.target.id.startsWith('material-type-')) {
      handleMaterialTypeChange(event, classifiedItems.sales.materialItems);
    }
  });

  // 物販タイプ変更時の特別処理
  document.addEventListener('change', function (event) {
    if (event.target.id && event.target.id.startsWith('product-type-')) {
      handleProductTypeChange(event, classifiedItems.sales.productItems);
    }
  });

  // 自由入力物販の入力変更時の特別処理
  document.addEventListener('input', function (event) {
    if (event.target.id && event.target.id.startsWith('custom-sales-')) {
      handleCustomSalesInputChange(event);
    }
  });
}

/**
 * 会計入力変更時の処理
 * @param {Event} event - 変更イベント
 * @param {ClassifiedAccountingItemsCore} classifiedItems - 分類済み会計項目
 * @param {string} classroom - 教室名
 */
export function handleAccountingInputChange(event, classifiedItems, classroom) {
  const target = event.target;

  // 動的スタイルのチェックボックスの更新
  if (target.type === 'checkbox' && target.hasAttribute('data-dynamic-style')) {
    updateCheckboxStyle(target);
  }

  // 短時間での連続計算を防ぐためのデバウンス
  clearTimeout(window.accountingCalculationTimeout);
  window.accountingCalculationTimeout = setTimeout(() => {
    updateAccountingCalculation(classifiedItems, classroom);
  }, 300);
}

/**
 * チェックボックスのスタイルを更新（項目名と金額の両方）
 * @param {HTMLInputElement} checkbox - チェックボックス要素
 */
export function updateCheckboxStyle(checkbox) {
  const label = checkbox.parentElement;
  if (!label) return;

  // ラベル（項目名）のスタイル更新
  if (checkbox.checked) {
    label.className = label.className.replace(
      'text-brand-muted',
      'font-bold text-brand-text',
    );
  } else {
    label.className = label.className.replace(
      'font-bold text-brand-text',
      'text-brand-muted',
    );
  }

  // 対応する金額表示のスタイル更新
  const checkboxRow = checkbox.closest('[data-checkbox-row]');
  if (checkboxRow) {
    const priceAmountElement = checkboxRow.querySelector('.price-amount');
    if (priceAmountElement) {
      // 赤字クラスは保持する
      const hasRedText = priceAmountElement.className.includes('text-red-600');
      const redClass = hasRedText ? ' text-red-600' : '';

      if (checkbox.checked) {
        // チェック済み: 濃い色、太字（赤字の場合は赤を優先）
        if (hasRedText) {
          priceAmountElement.className =
            priceAmountElement.className
              .replace(/text-brand-muted/g, '')
              .replace(/text-brand-text/g, '') + ' font-bold text-red-600';
        } else {
          priceAmountElement.className =
            priceAmountElement.className
              .replace(/text-brand-muted/g, '')
              .replace(/text-brand-text/g, '') + ' font-bold text-brand-text';
        }
      } else {
        // 未チェック: 薄い色（赤字の場合は薄い赤）
        if (hasRedText) {
          priceAmountElement.className =
            priceAmountElement.className
              .replace(/font-bold/g, '')
              .replace(/text-brand-text/g, '')
              .replace(/text-red-600/g, '') + ' text-red-400';
        } else {
          priceAmountElement.className =
            priceAmountElement.className
              .replace(/font-bold/g, '')
              .replace(/text-brand-text/g, '') + ' text-brand-muted';
        }
      }
    }
  }
}

/**
 * 材料タイプ変更時の処理
 * @param {Event} event - 変更イベント
 * @param {Array} materialItems - 材料項目配列
 */
export function handleMaterialTypeChange(event, materialItems) {
  const index = event.target.id.split('-')[2]; // material-type-0 -> 0
  const selectedType = event.target.value;
  const materialRow = document.querySelector(`[data-material-row="${index}"]`);

  if (!materialRow) return;

  // 選択された材料のマスタ情報を取得
  const selectedMaterial = materialItems.find(
    item => item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME] === selectedType,
  );

  // 既存のサイズ入力エリアを削除
  const existingSizeInputs = materialRow.querySelector('.size-inputs');
  if (existingSizeInputs) {
    existingSizeInputs.remove();
  }

  // 体積計算材料の場合、サイズ入力を追加
  if (
    selectedMaterial &&
    selectedMaterial[CONSTANTS.HEADERS.ACCOUNTING.UNIT] === 'cm³'
  ) {
    const sizeInputsHtml = `
      <div class="size-inputs flex items-center space-x-2 mt-2 pl-7">
        <input
          type="number"
          id="material-length-${index}"
          placeholder="x"
          class="w-10 p-0.5 border-2 border-ui-border rounded focus:outline-none focus:ring-2 focus:ring-brand-text text-right text-sm"
        >
        <span class="text-sm">×</span>
        <input
          type="number"
          id="material-width-${index}"
          placeholder="y"
          class="w-10 p-0.5 border-2 border-ui-border rounded focus:outline-none focus:ring-2 focus:ring-brand-text text-right text-sm"
        >
        <span class="text-sm">×</span>
        <input
          type="number"
          id="material-height-${index}"
          placeholder="z"
          class="w-10 p-0.5 border-2 border-ui-border rounded focus:outline-none focus:ring-2 focus:ring-brand-text text-right text-sm"
        >
        <span class="text-sm text-gray-600">mm</span>
      </div>`;

    materialRow.insertAdjacentHTML('beforeend', sizeInputsHtml);
  }

  // 価格をリセット
  const priceDisplay = materialRow.querySelector(`#material-price-${index}`);
  if (priceDisplay) {
    priceDisplay.innerHTML = Components.priceDisplay({ amount: 0 });
  }

  // 選択された場合、新しい行を自動追加
  if (selectedType) {
    const container = document.getElementById('materials-container');
    if (container) {
      const existingRows = container.querySelectorAll('.material-row');
      const lastRow = existingRows[existingRows.length - 1];
      const lastIndex = parseInt(lastRow.getAttribute('data-material-row'));

      // 最後の行が選択されている場合のみ新しい行を追加
      if (lastIndex === parseInt(index)) {
        const newIndex = existingRows.length;
        const newRowHtml = generateMaterialRow(materialItems, newIndex);
        container.insertAdjacentHTML('beforeend', newRowHtml);
      }
    }
  }

  // 計算を更新
  setTimeout(() => {
    const classifiedItems = window.currentClassifiedItems;
    const classroom = window.currentClassroom;
    if (classifiedItems && classroom) {
      updateAccountingCalculation(classifiedItems, classroom);
    }
  }, 100);
}

/**
 * 材料行追加
 * @param {Array} materialItems - 材料項目配列
 */
export function addMaterialRow(materialItems) {
  const container = document.getElementById('materials-container');
  if (!container) return;

  const existingRows = container.querySelectorAll('.material-row');
  const newIndex = existingRows.length;

  const newRowHtml = generateMaterialRow(materialItems, newIndex);
  container.insertAdjacentHTML('beforeend', newRowHtml);
}

/**
 * 材料行削除
 * @param {string} index - 削除する行のインデックス
 */
export function removeMaterialRow(index) {
  const row = document.querySelector(`[data-material-row="${index}"]`);
  if (row) {
    row.remove();
    // 計算を更新
    setTimeout(() => {
      const classifiedItems = window.currentClassifiedItems;
      const classroom = window.currentClassroom;
      if (classifiedItems && classroom) {
        updateAccountingCalculation(classifiedItems, classroom);
      }
    }, 100);
  }
}

/**
 * 物販タイプ変更時の処理
 * @param {Event} event - 変更イベント
 * @param {Array} productItems - 物販項目配列
 */
export function handleProductTypeChange(event, productItems) {
  const index = event.target.id.split('-')[2]; // product-type-0 -> 0
  const selectedType = event.target.value;
  const productRow = document.querySelector(`[data-product-row="${index}"]`);

  if (!productRow) return;

  // 選択された物販のマスタ情報を取得
  const selectedProduct = productItems.find(
    item => item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME] === selectedType,
  );

  // 価格を更新
  const priceDisplay = productRow.querySelector(`#product-price-${index}`);
  if (priceDisplay && selectedProduct) {
    const price = Number(
      selectedProduct[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE],
    );
    priceDisplay.innerHTML = Components.priceDisplay({ amount: price });

    // 選択後は商品名のみを表示（価格の2重表示を避ける）
    const selectElement = event.target;
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    if (selectedOption && selectedOption.value) {
      selectedOption.textContent = selectedType; // 商品名のみ
    }
  } else if (priceDisplay) {
    priceDisplay.innerHTML = Components.priceDisplay({ amount: 0 });

    // 未選択の場合、プルダウンの表示をリセット
    const selectElement = event.target;
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    if (selectedOption && selectedOption.value === '') {
      // 空の選択肢は元の表示のまま
      selectedOption.textContent = 'おえらびください';
    }
  }

  // 選択された場合、新しい行を自動追加
  if (selectedType) {
    const container = document.getElementById('products-container');
    if (container) {
      const existingRows = container.querySelectorAll('.product-row');
      const lastRow = existingRows[existingRows.length - 1];
      const lastIndex = parseInt(lastRow.getAttribute('data-product-row'));

      // 最後の行が選択されている場合のみ新しい行を追加
      if (lastIndex === parseInt(index)) {
        const newIndex = existingRows.length;
        const newRowHtml = generateProductRow(productItems, newIndex);
        container.insertAdjacentHTML('beforeend', newRowHtml);
      }
    }
  }

  // 計算を更新
  setTimeout(() => {
    const classifiedItems = window.currentClassifiedItems;
    const classroom = window.currentClassroom;
    if (classifiedItems && classroom) {
      updateAccountingCalculation(classifiedItems, classroom);
    }
  }, 100);
}

/**
 * 物販行削除
 * @param {string} index - 削除する行のインデックス
 */
export function removeProductRow(index) {
  const row = document.querySelector(`[data-product-row="${index}"]`);
  if (row) {
    row.remove();
    // 計算を更新
    setTimeout(() => {
      const classifiedItems = window.currentClassifiedItems;
      const classroom = window.currentClassroom;
      if (classifiedItems && classroom) {
        updateAccountingCalculation(classifiedItems, classroom);
      }
    }, 100);
  }
}

/**
 * 自由入力物販の入力変更処理
 * @param {Event} event - 入力変更イベント
 */
export function handleCustomSalesInputChange(event) {
  const target = event.target;
  const index = parseInt(target.id.split('-')[3]); // custom-sales-name-0 -> 0
  const container = document.getElementById('custom-sales-container');

  if (!container) return;

  // 価格フィールドの場合、価格表示を更新
  if (target.id.startsWith('custom-sales-price-')) {
    const priceDisplayElement = document.getElementById(
      `custom-sales-display-${index}`,
    );
    if (priceDisplayElement) {
      const price = Number(target.value) || 0;
      priceDisplayElement.innerHTML = Components.priceDisplay({
        amount: price,
      });
    }
  }

  // 最後の行で項目名または価格が入力されたら新しい行を追加
  const existingRows = container.querySelectorAll('.custom-sales-row');
  const isLastRow = index === existingRows.length - 1;

  if (isLastRow && target.value.trim()) {
    const nameInput = document.getElementById(`custom-sales-name-${index}`);
    const priceInput = document.getElementById(`custom-sales-price-${index}`);

    // 項目名または価格のどちらかが入力されている場合、新しい行を追加
    if (
      (nameInput && nameInput.value.trim()) ||
      (priceInput && priceInput.value.trim())
    ) {
      addCustomSalesRow();
    }
  }

  // 計算を更新
  setTimeout(() => {
    const classifiedItems = window.currentClassifiedItems;
    const classroom = window.currentClassroom;
    if (classifiedItems && classroom) {
      updateAccountingCalculation(classifiedItems, classroom);
    }
  }, 100);
}

/**
 * 自由入力物販行追加
 */
export function addCustomSalesRow() {
  const container = document.getElementById('custom-sales-container');
  if (!container) return;

  const existingRows = container.querySelectorAll('.custom-sales-row');
  const newIndex = existingRows.length;

  const newRowHtml = generateCustomSalesRow(newIndex);
  container.insertAdjacentHTML('beforeend', newRowHtml);
}

/**
 * 自由入力物販行削除
 * @param {string} index - 削除する行のインデックス
 */
export function removeCustomSalesRow(index) {
  const row = document.querySelector(`[data-custom-sales-row="${index}"]`);
  if (row) {
    row.remove();
    // 計算を更新
    setTimeout(() => {
      const classifiedItems = window.currentClassifiedItems;
      const classroom = window.currentClassroom;
      if (classifiedItems && classroom) {
        updateAccountingCalculation(classifiedItems, classroom);
      }
    }, 100);
  }
}

/**
 * 会計計算更新
 * @param {ClassifiedAccountingItemsCore} classifiedItems - 分類済み会計項目
 * @param {string} classroom - 教室名
 */
export function updateAccountingCalculation(classifiedItems, classroom) {
  try {
    // フォームデータ収集
    const formData = collectAccountingFormData();

    // 計算実行
    const result = calculateAccountingTotal(
      formData,
      [
        ...classifiedItems.tuition.items,
        ...classifiedItems.sales.materialItems,
        ...classifiedItems.sales.productItems,
      ],
      classroom,
    );

    // UI更新
    updateAccountingUI(result, classroom);
  } catch (error) {
    console.error('会計計算エラー:', error);
    // エラー時は0で表示
    updateAccountingUI(
      {
        tuition: { subtotal: 0 },
        sales: { subtotal: 0 },
        grandTotal: 0,
      },
      classroom,
    );
  }
}

/**
 * 会計UI更新
 * @param {Object} result - 計算結果
 * @param {string} classroom - 教室名
 */
export function updateAccountingUI(result, classroom) {
  // 授業料小計更新
  const tuitionSubtotal = document.getElementById('tuition-subtotal-amount');
  if (tuitionSubtotal) {
    tuitionSubtotal.innerHTML = Components.priceDisplay({
      amount: result.tuition.subtotal,
      size: 'large',
    });
  }

  // 販売小計更新
  const salesSubtotal = document.getElementById('sales-subtotal-amount');
  if (salesSubtotal) {
    salesSubtotal.innerHTML = Components.priceDisplay({
      amount: result.sales.subtotal,
      size: 'large',
    });
  }

  // 総合計更新
  const grandTotal = document.getElementById('grand-total-amount');
  if (grandTotal) {
    grandTotal.innerHTML = Components.priceDisplay({
      amount: result.grandTotal,
      size: 'large',
    });
  }

  // 時間制の場合の時間計算表示更新
  updateTimeCalculationDisplay(result, classroom);

  // 個別価格表示更新
  updateMaterialPricesDisplay(result);
  updateProductPricesDisplay(result);
  updateCustomSalesPricesDisplay(result);
}

/**
 * 時間計算表示更新
 * @param {Object} result - 計算結果
 * @param {string} classroom - 教室名
 */
export function updateTimeCalculationDisplay(result, classroom) {
  const timeCalculation = document.getElementById('time-calculation');
  if (!timeCalculation) return;

  const formData = collectAccountingFormData();
  if (!formData.startTime || !formData.endTime) return;

  const timeUnits = calculateTimeUnits(
    formData.startTime,
    formData.endTime,
    formData.breakTime || 0,
  );
  const hours = timeUnits / 2; // 30分単位を時間に変換

  // 基本授業料の単価を取得
  const classifiedItems = window.currentClassifiedItems;
  const BASE_TUITION_ITEMS = [
    CONSTANTS.ITEMS.MAIN_LECTURE_COUNT,
    CONSTANTS.ITEMS.MAIN_LECTURE_TIME,
    CONSTANTS.ITEMS.MAIN_LECTURE,
  ];
  const baseItem = classifiedItems?.tuition.items.find(item => {
    const itemName = item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME];
    const targetClassroom = item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM];
    return (
      BASE_TUITION_ITEMS.includes(itemName) &&
      (targetClassroom === classroom || targetClassroom.includes(classroom))
    );
  });

  if (baseItem && baseItem[CONSTANTS.HEADERS.ACCOUNTING.UNIT] === '30分') {
    const unitPrice = Number(baseItem[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE]);
    const tuitionAmount = timeUnits * unitPrice;

    timeCalculation.innerHTML = `${hours}時間 ×${Components.priceDisplay({ amount: unitPrice * 2 })} =${Components.priceDisplay({ amount: tuitionAmount })}`;
  }
}

/**
 * 材料価格個別表示更新
 * @param {Object} result - 計算結果
 */
export function updateMaterialPricesDisplay(result) {
  const materials = document.querySelectorAll('.material-row');
  const salesItems = result.sales?.items || [];

  materials.forEach((row, index) => {
    const priceDisplay = row.querySelector(`#material-price-${index}`);
    const typeSelect = row.querySelector(`#material-type-${index}`);

    if (priceDisplay && typeSelect) {
      const selectedType = typeSelect.value;
      if (selectedType) {
        // 選択された材料タイプに一致するアイテムを検索
        const materialItem = salesItems.find(item => {
          return (
            item.name === selectedType ||
            item.name.startsWith(selectedType + ' (')
          );
        });

        if (materialItem) {
          priceDisplay.innerHTML = Components.priceDisplay({
            amount: materialItem.price,
          });
        } else {
          priceDisplay.innerHTML = Components.priceDisplay({ amount: 0 });
        }
      } else {
        priceDisplay.innerHTML = Components.priceDisplay({ amount: 0 });
      }
    }
  });
}

/**
 * 物販価格個別表示更新
 * @param {Object} result - 計算結果
 */
export function updateProductPricesDisplay(result) {
  const products = document.querySelectorAll('.product-row');
  const salesItems = result.sales?.items || [];

  products.forEach((row, index) => {
    const priceDisplay = row.querySelector(`#product-price-${index}`);
    const typeSelect = row.querySelector(`#product-type-${index}`);

    if (priceDisplay && typeSelect) {
      const selectedType = typeSelect.value;
      if (selectedType) {
        // 選択された物販タイプに一致するアイテムを検索
        const productItem = salesItems.find(item => item.name === selectedType);

        if (productItem) {
          priceDisplay.innerHTML = Components.priceDisplay({
            amount: productItem.price,
          });
        } else {
          priceDisplay.innerHTML = Components.priceDisplay({ amount: 0 });
        }
      } else {
        priceDisplay.innerHTML = Components.priceDisplay({ amount: 0 });
      }
    }
  });
}

/**
 * 自由入力物販価格個別表示更新
 * @param {Object} result - 計算結果
 */
export function updateCustomSalesPricesDisplay(result) {
  const customSales = document.querySelectorAll('.custom-sales-row');
  const salesItems = result.sales?.items || [];

  customSales.forEach((row, index) => {
    const priceDisplay = row.querySelector(`#custom-sales-display-${index}`);
    const nameInput = row.querySelector(`#custom-sales-name-${index}`);

    if (priceDisplay && nameInput) {
      const itemName = nameInput.value.trim();
      if (itemName) {
        // 入力された名前に一致するアイテムを検索
        const customItem = salesItems.find(item => item.name === itemName);

        if (customItem) {
          priceDisplay.innerHTML = Components.priceDisplay({
            amount: customItem.price,
          });
        } else {
          priceDisplay.innerHTML = Components.priceDisplay({ amount: 0 });
        }
      } else {
        priceDisplay.innerHTML = Components.priceDisplay({ amount: 0 });
      }
    }
  });
}

/**
 * 支払い方法UI初期化（既存関数を活用）
 * @param {string} selectedPaymentMethod - 選択済みの支払い方法
 */
export function initializePaymentMethodUI(selectedPaymentMethod = '') {
  const paymentOptionsContainer = document.getElementById(
    'payment-options-container',
  );
  const paymentInfoContainer = document.getElementById(
    'payment-info-container',
  );

  if (paymentOptionsContainer) {
    paymentOptionsContainer.innerHTML = getPaymentOptionsHtml(
      selectedPaymentMethod,
    );
  }

  if (paymentInfoContainer) {
    paymentInfoContainer.innerHTML = getPaymentInfoHtml(selectedPaymentMethod);
  }

  // 確認ボタンの初期状態設定
  updateConfirmButtonState();
}

/**
 * 支払い方法変更時の処理（既存関数を活用）
 * @param {string} selectedMethod - 選択された支払い方法
 */
export function handlePaymentMethodChange(selectedMethod) {
  const paymentInfoContainer = document.getElementById(
    'payment-info-container',
  );

  if (paymentInfoContainer) {
    paymentInfoContainer.innerHTML = getPaymentInfoHtml(selectedMethod);
  }

  // 支払い方法のスタイルを更新
  updatePaymentMethodStyles(selectedMethod);

  // 確認ボタンの状態を更新
  updateConfirmButtonState();
}

/**
 * 支払い方法のラベルスタイルを動的に更新
 * @param {string} selectedMethod - 選択された支払い方法
 */
export function updatePaymentMethodStyles(selectedMethod) {
  const paymentMethodRadios = document.querySelectorAll(
    'input[name="payment-method"]',
  );

  paymentMethodRadios.forEach(radio => {
    const label = radio.closest('label');
    if (label) {
      const span = label.querySelector('span');
      if (span) {
        // 選択されている場合は太字・濃い色、未選択は薄い色
        if (radio.value === selectedMethod) {
          label.className = label.className.replace(
            /text-brand-muted/,
            'font-bold text-brand-text',
          );
        } else {
          label.className = label.className.replace(
            /font-bold text-brand-text/,
            'text-brand-muted',
          );
        }
      }
    }
  });
}

/**
 * 確認ボタンの有効/無効状態を更新
 */
export function updateConfirmButtonState() {
  const confirmButton = document.getElementById('confirm-payment-button');
  const selectedPaymentMethod = document.querySelector(
    'input[name="payment-method"]:checked',
  );

  if (confirmButton) {
    if (selectedPaymentMethod) {
      // 有効状態：明示的にaccountingスタイルを復元
      confirmButton.removeAttribute('disabled');
      confirmButton.removeAttribute('style');
      confirmButton.style.pointerEvents = '';
      confirmButton.className = confirmButton.className.replace(
        /\sopacity-\d+|\scursor-not-allowed/g,
        '',
      );
    } else {
      // 無効状態：明示的に無効スタイルを適用
      confirmButton.setAttribute('disabled', 'true');
      confirmButton.style.pointerEvents = 'none';
      // 既存のクラスに無効状態のクラスを追加
      if (!confirmButton.className.includes('opacity-60')) {
        confirmButton.className += ' opacity-60 cursor-not-allowed';
      }
    }
  }
}

/**
 * 新フォームデータを既存バックエンド形式に変換
 * @param {AccountingFormDto} formData - 新フォームデータ
 * @param {Object} result - 計算結果
 * @param {ClassifiedAccountingItemsCore} classifiedItems - 分類済み会計項目
 * @returns {Object} 既存バックエンド形式のuserInput
 */
export function convertToLegacyFormat(formData, result, classifiedItems) {
  // デバッグログ追加
  if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
    console.log('🔍 convertToLegacyFormat入力データ:', {
      formData,
      result,
      'result.tuition.items': result.tuition.items,
      'result.sales.items': result.sales.items,
    });
  }

  const userInput = {
    paymentMethod: formData.paymentMethod || CONSTANTS.PAYMENT_DISPLAY.CASH,
    tuitionItems: result.tuition.items || [],
    salesItems: result.sales.items || [],
    timeBased:
      formData.startTime && formData.endTime
        ? {
            startTime: formData.startTime,
            endTime: formData.endTime,
            breakMinutes: formData.breakTime || 0,
            discountApplied: result.tuition.items.some(item => item.price < 0),
          }
        : null,
  };

  // デバッグログ追加
  if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
    console.log('🔍 convertToLegacyFormat出力データ:', userInput);
  }

  return userInput;
}

/**
 * ダッシュボード画面にもどる処理
 */
export function handleBackToDashboard() {
  try {
    // 現在のフォームデータをキャッシュに保存
    const currentFormData = collectAccountingFormData();
    saveAccountingCache(currentFormData);

    // スマートナビゲーションで前の画面にもどる
    if (typeof actionHandlers !== 'undefined' && actionHandlers.smartGoBack) {
      actionHandlers.smartGoBack();
    } else {
      // フォールバック: StateManagerを使用
      if (
        window.stateManager &&
        typeof window.stateManager.dispatch === 'function'
      ) {
        window.stateManager.dispatch({
          type: 'CHANGE_VIEW',
          payload: { view: 'dashboard' },
        });
      } else if (typeof updateView === 'function') {
        // 直接ビュー更新を試行
        updateView('dashboard');
      } else {
        // 最終フォールバック: ページリロード
        window.location.reload();
      }
    }
  } catch (error) {
    console.error('ダッシュボード画面への遷移エラー:', error);
    showInfo('画面遷移に失敗しました。もう一度お試しください。', 'エラー');
  }
}

/**
 * 支払い確認モーダルHTML生成
 * @param {Object} result - 計算結果
 * @param {string} paymentMethod - 支払い方法
 * @returns {string} モーダルHTML
 */
export function generatePaymentConfirmModal(result, paymentMethod) {
  // 支払い方法に応じた支払先情報
  const paymentInfoHtml =
    typeof getPaymentInfoHtml === 'function'
      ? getPaymentInfoHtml(paymentMethod)
      : '';

  // 金額表示のヘルパー
  const formatPrice = amount => {
    if (typeof Components !== 'undefined' && Components.priceDisplay) {
      return Components.priceDisplay({ amount });
    }
    return `¥${amount.toLocaleString()}`;
  };

  const formatPriceLarge = amount => {
    if (typeof Components !== 'undefined' && Components.priceDisplay) {
      return Components.priceDisplay({ amount, size: 'large' });
    }
    return `¥${amount.toLocaleString()}`;
  };

  // ボタン生成のヘルパー
  const generateButton = (action, text, style, customClass = '') => {
    if (typeof Components !== 'undefined' && Components.button) {
      return Components.button({
        action,
        text,
        style,
        size: 'large',
        customClass: `flex-1 ${customClass}`,
        disabledStyle: 'auto', // 自動無効状態スタイル対応
      });
    }
    const styleClass =
      style === 'primary'
        ? 'bg-action-primary-bg text-action-primary-text hover:bg-action-primary-hover'
        : 'bg-action-secondary-bg text-action-secondary-text hover:bg-action-secondary-hover';
    return `<button data-action="${action}" class="${styleClass} px-4 py-2 rounded font-bold flex-1 ${customClass}">${text}</button>`;
  };

  // 授業料セクションHTML生成
  let tuitionSectionHtml = '';
  if (result.tuition.items && result.tuition.items.length > 0) {
    const itemsHtml = result.tuition.items
      .map(
        item => `
      <div class="flex justify-between text-sm">
        <span class="text-brand-subtle">${escapeHTML(item.name)}</span>
        <span class="font-mono-numbers">${formatPrice(item.price)}</span>
      </div>
    `,
      )
      .join('');
    tuitionSectionHtml = `
      <div class="space-y-1">
        ${itemsHtml}
        <div class="flex justify-between text-sm border-t border-ui-border pt-1 mt-1">
          <span class="text-brand-text font-medium">授業料小計:</span>
          <span class="font-mono-numbers font-medium">${formatPrice(result.tuition.subtotal)}</span>
        </div>
      </div>
    `;
  }

  // 販売セクションHTML生成
  let salesSectionHtml = '';
  if (result.sales.items && result.sales.items.length > 0) {
    const itemsHtml = result.sales.items
      .map(
        item => `
      <div class="flex justify-between text-sm">
        <span class="text-brand-subtle">${escapeHTML(item.name)}</span>
        <span class="font-mono-numbers">${formatPrice(item.price)}</span>
      </div>
    `,
      )
      .join('');
    salesSectionHtml = `
      <div class="space-y-1 ${tuitionSectionHtml ? 'mt-3' : ''}">
        ${itemsHtml}
        <div class="flex justify-between text-sm border-t border-ui-border pt-1 mt-1">
          <span class="text-brand-text font-medium">販売小計:</span>
          <span class="font-mono-numbers font-medium">${formatPrice(result.sales.subtotal)}</span>
        </div>
      </div>
    `;
  }

  return `
    <div id="payment-confirm-modal" class="fixed inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg mx-4 max-w-md w-full max-h-screen overflow-y-auto">

        <!-- モーダルヘッダー -->
        <div class="p-6 border-b-2 border-gray-200">
          <h3 class="text-xl font-bold text-brand-text">支払い確認</h3>
        </div>

        <!-- モーダルボディ -->
        <div class="p-4 space-y-4">

          <!-- 合計金額セクション -->
          <div class="bg-ui-surface rounded-lg p-4">
            <h4 class="font-medium text-brand-text mb-3">金額</h4>
            <div class="space-y-2">
              ${tuitionSectionHtml}
              ${salesSectionHtml}
              <div class="border-t-2 border-ui-border pt-2 mt-2">
                <div class="flex justify-between">
                  <span class="font-bold text-brand-text">総合計:</span>
                  <span class="font-bold text-xl text-brand-text font-mono-numbers">${formatPriceLarge(result.grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 支払い方法セクション -->
          <div class="bg-ui-surface rounded-lg p-4">
            <h4 class="font-medium text-brand-text mb-3">支払い方法</h4>
            <div class="text-lg font-bold text-brand-text mb-3">${paymentMethod}</div>
            ${paymentInfoHtml ? `<div class="mt-3">${paymentInfoHtml}</div>` : ''}
          </div>
        </div>
        <!-- モーダルフッター -->
        <div class="p-6 border-t-2 border-gray-200 flex gap-3">
          ${generateButton('cancelPaymentConfirm', '修正する', 'secondary')}
          ${generateButton('processPayment', '支払いました', 'primary')}
        </div>

      </div>
    </div>
  `;
}

/**
 * 支払い確認モーダルを表示する処理
 * @param {ClassifiedAccountingItemsCore} classifiedItems - 分類済み会計項目
 * @param {string} classroom - 教室名
 */
export function showPaymentConfirmModal(classifiedItems, classroom) {
  // デバッグ: 関数呼び出しを記録
  if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
    console.log('🔵 showPaymentConfirmModal関数が呼び出されました');
  }

  try {
    const formData = collectAccountingFormData();

    // 支払い方法の選択チェック
    if (!formData.paymentMethod) {
      showInfo('支払い方法を選択してください。', '入力エラー');
      return;
    }

    // デバッグ：計算前の情報
    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      console.log('🔍 支払い確認モーダル: 計算前データ確認', {
        classifiedItems存在: !!classifiedItems,
        tuitionItemsLength: classifiedItems?.tuition?.items?.length || 0,
        materialItemsLength: classifiedItems?.sales?.materialItems?.length || 0,
        productItemsLength: classifiedItems?.sales?.productItems?.length || 0,
        classroom,
      });
    }

    const result = calculateAccountingTotal(
      formData,
      [
        ...classifiedItems.tuition.items,
        ...classifiedItems.sales.materialItems,
        ...classifiedItems.sales.productItems,
      ],
      classroom,
    );

    // デバッグログ
    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      console.log('🔍 支払い確認モーダル生成開始', { formData, result });
    }

    // モーダルHTML生成
    const modalHtml = generatePaymentConfirmModal(
      result,
      formData.paymentMethod,
    );

    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      console.log('モーダルHTML生成完了:', modalHtml.substring(0, 200) + '...');
    }

    // 既存のモーダルがあれば削除
    const existingModal = document.getElementById('payment-confirm-modal');
    if (existingModal) {
      existingModal.remove();
    }

    // モーダルを表示
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      console.log('モーダル挿入完了');
    }

    // データを一時保存（後で処理時に使用）
    window.tempPaymentData = {
      formData,
      result,
      classifiedItems,
      classroom,
    };
  } catch (error) {
    console.error('支払い確認エラー:', error);
    console.error('エラースタック:', error.stack);

    // デバッグ情報
    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      console.log('エラー発生時の状態:', {
        formData: formData || 'undefined',
        classifiedItems: classifiedItems || 'undefined',
        classroom: classroom || 'undefined',
      });
    }

    showInfo(error.message, 'エラー');
  }
}

/**
 * 支払い確認モーダルを閉じる
 */
export function closePaymentConfirmModal() {
  const modal = document.getElementById('payment-confirm-modal');
  if (modal) {
    modal.remove();
  }

  // 支払い処理が完了していない場合のみデータをクリア
  // 「修正する」ボタンでキャンセルされた場合
  if (window.tempPaymentData) {
    window.tempPaymentData = null;
  }
}

/**
 * 支払い処理を実行（モーダルから呼び出し）
 */
export function handleProcessPayment() {
  // 重複実行防止チェック
  if (window.paymentProcessing) {
    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      console.log('⚠️ 支払い処理は既に実行中です');
    }
    return;
  }

  if (!window.tempPaymentData) {
    console.error('支払いデータが見つかりません');
    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      console.log('デバッグ: window.tempPaymentData =', window.tempPaymentData);
    }

    showInfo(
      '支払いデータが見つかりません。会計画面から再度お試しください。',
      'エラー',
    );

    // モーダルを閉じる
    const modal = document.getElementById('payment-confirm-modal');
    if (modal) {
      modal.remove();
    }
    return;
  }

  // 処理中フラグを設定
  window.paymentProcessing = true;

  const { formData, result, classifiedItems, classroom } =
    window.tempPaymentData;

  // デバッグログ
  if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
    console.log('🟢 支払い処理開始:', {
      formData,
      result,
      classifiedItems,
      classroom,
    });
  }

  // モーダルを閉じる（データクリアなし）
  const modal = document.getElementById('payment-confirm-modal');
  if (modal) {
    modal.remove();
  }

  // 実際の会計処理を実行（14_WebApp_Handlers.jsのconfirmAndPay関数を呼び出し）
  try {
    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      console.log('🔍 handleProcessPayment: 処理方法を判定中', {
        actionHandlers存在: typeof actionHandlers !== 'undefined',
        confirmAndPay存在:
          typeof actionHandlers !== 'undefined' && actionHandlers.confirmAndPay,
      });
    }

    if (typeof actionHandlers !== 'undefined' && actionHandlers.confirmAndPay) {
      if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
        console.log(
          '🔍 handleProcessPayment: actionHandlers.confirmAndPay()を実行',
        );
      }
      actionHandlers.confirmAndPay();
    } else {
      if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
        console.log('🔍 handleProcessPayment: フォールバック処理を実行');
      }
      // フォールバック: 直接処理
      processAccountingPayment(formData, result, classifiedItems, classroom);
    }
  } finally {
    // 支払い処理完了後にデータとフラグをクリア
    window.tempPaymentData = null;
    window.paymentProcessing = false;
  }
}

/**
 * 制作メモ保存処理
 * @param {HTMLElement} target - ボタン要素
 */
export function handleSaveMemo(target) {
  const reservationId = target.getAttribute('data-reservation-id');
  if (!reservationId) {
    console.error('予約IDが見つかりません');
    return;
  }

  const textareaId = `memo-edit-textarea-${reservationId}`;
  const textarea = document.getElementById(textareaId);
  if (!textarea) {
    console.error('制作メモのテキストエリアが見つかりません');
    return;
  }

  const newMemoText = textarea.value;

  // ローディング表示
  if (typeof showLoading === 'function') {
    showLoading('memo');
  }

  // バックエンドAPIコール
  if (typeof google !== 'undefined' && google.script && google.script.run) {
    google.script.run
      .withSuccessHandler(response => {
        if (typeof hideLoading === 'function') {
          hideLoading();
        }

        if (response.success) {
          // 成功メッセージ表示
          showInfo('制作メモを更新しました。', '成功');

          // テキストエリアの値を更新
          textarea.value = newMemoText;
        } else {
          showInfo(
            '制作メモの更新に失敗しました: ' + (response.message || ''),
            'エラー',
          );
        }
      })
      .withFailureHandler(error => {
        if (typeof hideLoading === 'function') {
          hideLoading();
        }
        console.error('制作メモ更新エラー:', error);
        showInfo('制作メモの更新に失敗しました。', 'エラー');
      })
      .updateWorkInProgress({
        reservationId: reservationId,
        workInProgress: newMemoText,
      });
  } else {
    // Google Apps Script環境でない場合のフォールバック
    if (typeof hideLoading === 'function') {
      hideLoading();
    }
    alert('システムエラー：Google Apps Scriptとの通信ができません。');
  }
}

/**
 * 実際の会計処理を実行
 * @param {AccountingFormDto} formData - フォームデータ
 * @param {Object} result - 計算結果
 */
export function processAccountingPayment(formData, result) {
  try {
    // ローディング表示
    if (typeof showLoading === 'function') {
      showLoading('accounting');
    }

    const state = window.stateManager.getState();
    const selectedReservation = state.accountingReservation;

    if (!selectedReservation) {
      showInfo('会計対象の予約が見つかりません。', 'エラー');
      hideLoading();
      return;
    }

    // 1. フロントエンドで計算された会計詳細(result)を取得
    const calculatedAccountingDetails = {
      tuition: result.tuition,
      sales: result.sales,
      grandTotal: result.grandTotal,
      paymentMethod: result.paymentMethod,
    };

    // 2. 現在の予約情報と会計詳細、フォームの更新内容をマージして、新しいReservationCoreを構築
    /** @type {ReservationCore} */
    const reservationWithAccounting = {
      ...selectedReservation, // 既存の予約情報
      accountingDetails: calculatedAccountingDetails, // 計算した会計詳細
      workInProgress: formData.workInProgress, // フォームから更新された制作メモ
      startTime: formData.startTime, // フォームから更新された時間
      endTime: formData.endTime,
    };

    // デバッグログ：最終ペイロード
    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      console.log(
        '🔍 最終送信ペイロード (ReservationCore):',
        reservationWithAccounting,
      );
    }

    // バックエンドAPIコール
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler(response => {
          if (typeof hideLoading === 'function') {
            hideLoading();
          }

          if (response.success) {
            if (typeof clearAccountingCache === 'function') {
              clearAccountingCache();
            }

            // データを最新に更新
            if (response.data && window.stateManager) {
              window.stateManager.dispatch({
                type: 'UPDATE_STATE',
                payload: {
                  myReservations: response.data.myReservations || [],
                  lessons: response.data.lessons || [],
                },
              });
            }

            // 完了画面に遷移（会計完了として認識されるメッセージを使用）
            window.stateManager.dispatch({
              type: 'SET_STATE',
              payload: {
                view: 'complete',
                completionMessage: '会計情報を記録しました。',
              },
            });
          } else {
            showInfo(
              '会計処理に失敗しました: ' + (response.message || ''),
              'エラー',
            );
          }
        })
        .withFailureHandler(error => {
          if (typeof hideLoading === 'function') {
            hideLoading();
          }
          console.error('会計処理エラー:', error);
          showInfo('会計処理に失敗しました。', 'エラー');
        })
        .saveAccountingDetailsAndGetLatestData(reservationWithAccounting);
    } else {
      // Google Apps Script環境でない場合のフォールバック
      if (typeof hideLoading === 'function') {
        hideLoading();
      }
      alert('システムエラー：Google Apps Scriptとの通信ができません。');
    }
  } catch (error) {
    if (typeof hideLoading === 'function') {
      hideLoading();
    }
    console.error('支払い処理エラー:', error);
    alert('エラーが発生しました。もう一度お試しください。');
  }
}

// ================================================================================
// 【ユーティリティ層】
// ================================================================================

/**
 * 制作メモのデータを収集
 * @returns {Object} 制作メモデータ
 */
export function collectMemoData() {
  const memoData = {};

  // 会計画面の制作メモテキストエリアを探す
  const textareas = document.querySelectorAll('.memo-edit-textarea');
  textareas.forEach(textarea => {
    // テキストエリアのIDからreservationIdを推測
    const id = textarea.id;
    if (id && id.includes('memo-edit-textarea-')) {
      const reservationId = id.replace('memo-edit-textarea-', '');
      memoData.reservationId = reservationId;
      memoData.workInProgress = textarea.value;
    } else {
      // IDパターンが違う場合、親要素から予約IDを取得
      const card = textarea.closest('[data-reservation-id]');
      if (card) {
        const reservationId = card.getAttribute('data-reservation-id');
        memoData.reservationId = reservationId;
        memoData.workInProgress = textarea.value;
      }
    }
  });

  return memoData;
}

/**
 * フォームデータ収集
 * @returns {AccountingFormDto} 収集されたフォームデータ
 */
export function collectAccountingFormData() {
  const formData = {};

  // デバッグ: フォームデータ収集開始
  if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
    console.log('🔍 collectAccountingFormData開始');
  }

  // 時刻データ収集
  const startTimeEl = document.getElementById('start-time');
  const endTimeEl = document.getElementById('end-time');
  const breakTimeEl = document.getElementById('break-time');

  // デバッグ: 時刻要素の存在確認
  if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
    console.log('🔍 時刻要素チェック:', {
      startTimeEl: !!startTimeEl,
      endTimeEl: !!endTimeEl,
      breakTimeEl: !!breakTimeEl,
      startTimeValue: startTimeEl?.value,
      endTimeValue: endTimeEl?.value,
      breakTimeValue: breakTimeEl?.value,
    });
  }

  if (startTimeEl) formData.startTime = startTimeEl.value;
  if (endTimeEl) formData.endTime = endTimeEl.value;
  if (breakTimeEl) formData.breakTime = Number(breakTimeEl.value) || 0;

  // チェックボックス項目収集
  const checkedItems = {};

  // 全チェックボックスを収集（base-tuitionも含む）
  const checkboxes = document.querySelectorAll(
    '.accounting-container input[type="checkbox"]',
  );

  checkboxes.forEach(checkbox => {
    if (checkbox.checked) {
      // data属性から項目名を取得（優先）
      const itemName = checkbox.getAttribute('data-item-name');
      if (itemName) {
        checkedItems[itemName] = true;
      } else {
        // フォールバック: ラベルテキストから項目名を抽出
        const labelElement = checkbox.parentElement.querySelector('span');
        if (labelElement) {
          const fallbackItemName = labelElement.textContent.trim();
          checkedItems[fallbackItemName] = true;
        }
      }
    }
  });

  if (Object.keys(checkedItems).length > 0) {
    formData.checkedItems = checkedItems;
  }

  // 材料データ収集
  const materials = [];
  const materialRows = document.querySelectorAll('.material-row');

  materialRows.forEach((row, index) => {
    const typeSelect = row.querySelector(`#material-type-${index}`);
    if (typeSelect && typeSelect.value) {
      const material = { type: typeSelect.value };

      // サイズデータがある場合
      const lengthInput = row.querySelector(`#material-length-${index}`);
      const widthInput = row.querySelector(`#material-width-${index}`);
      const heightInput = row.querySelector(`#material-height-${index}`);

      if (lengthInput && widthInput && heightInput) {
        material.l = Number(lengthInput.value) || 0;
        material.w = Number(widthInput.value) || 0;
        material.h = Number(heightInput.value) || 0;
      }

      materials.push(material);
    }
  });

  if (materials.length > 0) {
    formData.materials = materials;
  }

  // 物販データ収集（プルダウン選択式）
  const selectedProducts = [];
  const productRows = document.querySelectorAll('.product-row');

  productRows.forEach((row, index) => {
    const typeSelect = row.querySelector(`#product-type-${index}`);
    if (typeSelect && typeSelect.value) {
      const selectedOption = typeSelect.options[typeSelect.selectedIndex];
      const price = selectedOption.getAttribute('data-price');
      selectedProducts.push({
        name: typeSelect.value,
        price: Number(price) || 0,
      });
    }
  });

  if (selectedProducts.length > 0) {
    formData.selectedProducts = selectedProducts;
  }

  // 自由入力物販データ収集
  const customSales = [];
  const customSalesRows = document.querySelectorAll('.custom-sales-row');

  customSalesRows.forEach((row, index) => {
    const nameInput = row.querySelector(`#custom-sales-name-${index}`);
    const priceInput = row.querySelector(`#custom-sales-price-${index}`);

    if (nameInput && priceInput && nameInput.value && priceInput.value) {
      customSales.push({
        name: nameInput.value.trim(),
        price: Number(priceInput.value) || 0,
      });
    }
  });

  if (customSales.length > 0) {
    formData.customSales = customSales;
  }

  // 支払い方法収集
  const paymentMethodRadio = document.querySelector(
    'input[name="payment-method"]:checked',
  );
  if (paymentMethodRadio) {
    formData.paymentMethod = paymentMethodRadio.value;
  }
  // 支払い方法が選択されていない場合は undefined のまま（必須チェックで弾く）

  // デバッグ: 収集されたフォームデータを出力
  if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
    console.log('🔍 collectAccountingFormData結果:', formData);
    console.log(
      '🔍 基本授業料チェック状態:',
      document.getElementById('base-tuition')?.checked,
    );
    console.log('🔍 支払い方法:', formData.paymentMethod);
    console.log('🔍 チェック済み項目:', formData.checkedItems);
  }

  return formData;
}

/**
 * 会計キャッシュ保存
 * @param {AccountingFormDto} formData - 保存するフォームデータ
 */
export function saveAccountingCache(formData) {
  try {
    const cacheKey = 'accounting_form_data';
    const cacheData = {
      data: formData,
      timestamp: Date.now(),
      version: '1.0',
    };

    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (error) {
    console.error('会計キャッシュ保存エラー:', error);
  }
}

/**
 * 会計キャッシュ読込
 * @returns {AccountingFormDto} 読み込まれたフォームデータ
 */
export function loadAccountingCache() {
  try {
    const cacheKey = 'accounting_form_data';
    const cached = localStorage.getItem(cacheKey);

    if (!cached) return {};

    const cacheData = JSON.parse(cached);
    const maxAge = 24 * 60 * 60 * 1000; // 24時間

    // キャッシュが古い場合は削除
    if (Date.now() - cacheData.timestamp > maxAge) {
      localStorage.removeItem(cacheKey);
      return {};
    }

    return cacheData.data || {};
  } catch (error) {
    console.error('会計キャッシュ読込エラー:', error);
    return {};
  }
}

/**
 * 会計システム初期化関数
 * @param {Array} masterData - 会計マスタデータ
 * @param {string} classroom - 教室名
 * @param {AccountingFormDto} initialFormData - 初期フォームデータ
 * @param {Object} reservationData - 予約データ（講座基本情報表示用）
 * @returns {string} 生成された会計画面HTML
 */
export function initializeAccountingSystem(
  masterData,
  classroom,
  initialFormData = {},
  reservationData = null,
) {
  // グローバル変数に保存（イベント処理で使用）
  const classifiedItems = classifyAccountingItems(masterData, classroom);
  window.currentClassifiedItems = classifiedItems;
  window.currentClassroom = classroom;

  // キャッシュから既存データを読み込み、初期データとマージ
  const cachedData = loadAccountingCache();
  const formData = { ...cachedData, ...initialFormData };

  // 会計画面HTML生成
  const accountingHtml = generateAccountingView(
    classifiedItems,
    classroom,
    formData,
    reservationData,
  );

  // DOMに挿入後の初期化処理を予約
  setTimeout(() => {
    // 支払い方法UI初期化（初期状態では何も選択しない）
    initializePaymentMethodUI('');

    // イベントリスナー設定
    setupAccountingEventListeners(classifiedItems, classroom);

    // 初期計算実行
    updateAccountingCalculation(classifiedItems, classroom);

    // キャッシュ保存の定期実行
    setInterval(() => {
      const currentFormData = collectAccountingFormData();
      saveAccountingCache(currentFormData);
    }, 30000); // 30秒ごと
  }, 100);

  return accountingHtml;
}

/**
 * 会計システムクリーンアップ
 */
export function cleanupAccountingSystem() {
  // タイマーをクリア
  if (window.accountingCalculationTimeout) {
    clearTimeout(window.accountingCalculationTimeout);
    window.accountingCalculationTimeout = null;
  }

  // グローバル変数をクリア
  window.currentClassifiedItems = null;
  window.currentClassroom = null;

  // 最終的なキャッシュ保存
  try {
    const currentFormData = collectAccountingFormData();
    saveAccountingCache(currentFormData);
  } catch (error) {
    console.error('クリーンアップ時のキャッシュ保存エラー:', error);
  }
}
