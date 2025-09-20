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

// @ts-nocheck

/**
 * @typedef {Object} ClassifiedAccountingItems
 * @property {Object} tuition
 * @property {Array} tuition.baseItems
 * @property {Array} tuition.additionalItems
 * @property {Object} sales
 * @property {Array} sales.materialItems
 * @property {Array} sales.productItems
 */

// ================================================================================
// 【計算ロジック層】
// ================================================================================

/**
 * 会計マスタデータを項目種別に分類
 * @param {Array} masterData - 会計マスタデータ
 * @param {string} classroom - 教室名
 * @returns {ClassifiedAccountingItems} 分類済み会計項目
 */
function classifyAccountingItems(masterData, classroom) {
  const result = {
    tuition: { baseItems: [], additionalItems: [] },
    sales: { materialItems: [], productItems: [] },
  };

  masterData.forEach(item => {
    const type = item[CONSTANTS.HEADERS.ACCOUNTING.TYPE];
    const price = Number(item[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE]);
    const targetClassroom = item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM];

    // 教室対象チェック
    if (targetClassroom !== '共通' && !targetClassroom.includes(classroom))
      return;

    if (type === '授業料') {
      if (item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME].includes('授業料')) {
        result.tuition.baseItems.push(item);
      } else {
        result.tuition.additionalItems.push(item);
      }
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
function calculateTimeUnits(startTime, endTime, breakTime = 0) {
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
 * @param {AccountingFormData} formData - フォームデータ
 * @param {ClassifiedAccountingItems} classifiedItems - 分類済み会計項目
 * @param {string} classroom - 教室名
 * @returns {Object} 授業料計算結果
 */
function calculateTuitionSubtotal(formData, classifiedItems, classroom) {
  let subtotal = 0;
  const items = [];

  // 基本授業料計算（時間制 vs 回数制）
  const baseItem = classifiedItems.tuition.baseItems.find(item => {
    const targetClassroom = item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM];
    return targetClassroom === classroom || targetClassroom.includes(classroom);
  });

  if (baseItem) {
    const unit = baseItem[CONSTANTS.HEADERS.ACCOUNTING.UNIT];
    const unitPrice = Number(baseItem[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE]);

    if (unit === '30分') {
      // 時間制計算
      const timeUnits = calculateTimeUnits(
        formData.startTime,
        formData.endTime,
        formData.breakTime,
      );
      const price = timeUnits * unitPrice;
      items.push({
        name: `授業料 (${formData.startTime} - ${formData.endTime})`,
        price: price,
      });
      subtotal += price;
    } else if (unit === '回') {
      // 回数制計算
      items.push({
        name: baseItem[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME],
        price: unitPrice,
      });
      subtotal += unitPrice;
    }
  }

  // 追加項目（チェックボックス選択）- 正負の値段両方含む
  classifiedItems.tuition.additionalItems.forEach(item => {
    const itemName = item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME];
    if (formData.checkedItems?.[itemName]) {
      const price = Number(item[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE]);
      items.push({ name: itemName, price: price });
      subtotal += price;
    }
  });

  return { items, subtotal };
}

/**
 * 販売小計計算
 * @param {AccountingFormData} formData - フォームデータ
 * @param {ClassifiedAccountingItems} classifiedItems - 分類済み会計項目
 * @returns {Object} 販売計算結果
 */
function calculateSalesSubtotal(formData, classifiedItems) {
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

  // 物販（チェックボックス選択）
  classifiedItems.sales.productItems.forEach(item => {
    const itemName = item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME];
    if (formData.checkedItems?.[itemName]) {
      const price = Number(item[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE]);
      items.push({ name: itemName, price: price });
      subtotal += price;
    }
  });

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
 * @param {AccountingFormData} formData - フォームデータ
 * @param {Array} masterData - 会計マスタデータ
 * @param {string} classroom - 教室名
 * @returns {Object} 統合計算結果
 */
function calculateAccountingTotal(formData, masterData, classroom) {
  const classifiedItems = classifyAccountingItems(masterData, classroom);
  const tuition = calculateTuitionSubtotal(
    formData,
    classifiedItems,
    classroom,
  );
  const sales = calculateSalesSubtotal(formData, classifiedItems);

  return {
    tuition,
    sales,
    grandTotal: tuition.subtotal + sales.subtotal,
    paymentMethod: formData.paymentMethod || CONSTANTS.PAYMENT_DISPLAY.CASH,
  };
}

// ================================================================================
// 【UI生成層】（Components.js活用）
// ================================================================================

/**
 * 時刻選択オプション生成
 * @param {string} selectedValue - 選択済みの値
 * @returns {string} HTML文字列
 */
function generateTimeOptions(selectedValue = '') {
  return Components.timeOptions({
    startTime: '09:00',
    endTime: '17:00',
    interval: 30,
    selectedValue: selectedValue,
  });
}

/**
 * 授業料セクション生成（Components.js活用）
 * @param {ClassifiedAccountingItems} classifiedItems - 分類済み会計項目
 * @param {string} classroom - 教室名
 * @param {AccountingFormData} formData - フォームデータ
 * @returns {string} HTML文字列
 */
function generateTuitionSection(classifiedItems, classroom, formData = {}) {
  // 基本授業料項目を取得
  const baseItem = classifiedItems.tuition.baseItems.find(item => {
    const targetClassroom = item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM];
    return targetClassroom === classroom || targetClassroom.includes(classroom);
  });

  if (!baseItem) {
    return `<section class="tuition-section">
      ${Components.sectionHeader({ title: '授業料' })}
      <p class="text-gray-500">この教室の授業料設定が見つかりません。</p>
    </section>`;
  }

  const unit = baseItem[CONSTANTS.HEADERS.ACCOUNTING.UNIT];
  const unitPrice = Number(baseItem[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE]);
  const isTimeBased = unit === '30分';

  // 基本授業料UI
  let baseTuitionHtml = '';
  if (isTimeBased) {
    // 時間制の場合
    baseTuitionHtml = `
      <div class="base-tuition mb-4">
        ${Components.checkbox({
          id: 'base-tuition',
          label: '授業料',
          checked: true,
        })}
        <div class="time-controls mt-3 ml-6 space-y-3">
          ${Components.select({
            id: 'start-time',
            label: '開始時刻',
            options: generateTimeOptions(formData.startTime),
          })}
          ${Components.select({
            id: 'end-time',
            label: '終了時刻',
            options: generateTimeOptions(formData.endTime),
          })}
          ${Components.select({
            id: 'break-time',
            label: '休憩時間',
            options: `
              <option value="0" ${formData.breakTime === 0 ? 'selected' : ''}>0分</option>
              <option value="30" ${formData.breakTime === 30 ? 'selected' : ''}>30分</option>
              <option value="60" ${formData.breakTime === 60 ? 'selected' : ''}>60分</option>
            `,
          })}
          <div class="calculated-amount text-sm text-gray-600 mt-2">
            <span id="time-calculation">計算結果: 0時間 × ${Components.priceDisplay({ amount: unitPrice })} = ${Components.priceDisplay({ amount: 0 })}</span>
          </div>
        </div>
      </div>`;
  } else {
    // 回数制の場合
    baseTuitionHtml = `
      <div class="base-tuition mb-4">
        ${Components.checkbox({
          id: 'base-tuition',
          label: `授業料 (${Components.priceDisplay({ amount: unitPrice })})`,
          checked: true,
        })}
      </div>`;
  }

  // 追加項目UI生成（正負の値段両方含む）
  let additionalItemsHtml = '';
  if (classifiedItems.tuition.additionalItems.length > 0) {
    additionalItemsHtml = '<div class="additional-tuition mb-4 space-y-2">';
    classifiedItems.tuition.additionalItems.forEach(item => {
      const itemName = item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME];
      const price = Number(item[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE]);
      const isChecked = formData.checkedItems?.[itemName] || false;

      // 価格表示のスタイル設定
      const priceColor = price < 0 ? 'text-red-600' : '';
      const pricePrefix = price >= 0 ? '+' : '';

      additionalItemsHtml += Components.checkbox({
        id: `additional-${itemName.replace(/\s+/g, '-')}`,
        label: `${itemName} (<span class="${priceColor}">${pricePrefix}${Components.priceDisplay({ amount: price })}</span>)`,
        checked: isChecked,
        dynamicStyle: true,
      });
    });
    additionalItemsHtml += '</div>';
  }

  return `
    <section class="tuition-section mb-6">
      ${Components.sectionHeader({ title: '授業料' })}
      ${baseTuitionHtml}
      ${additionalItemsHtml}
      ${Components.subtotalSection({
        title: '授業料小計',
        amount: 0,
        id: 'tuition-subtotal-amount',
      })}
    </section>`;
}

/**
 * 材料行生成（Components.js活用）
 * @param {Array} materialItems - 材料項目配列
 * @param {number} index - 行インデックス
 * @param {Object} materialData - 既存の材料データ
 * @returns {string} HTML文字列
 */
function generateMaterialRow(materialItems, index = 0, materialData = {}) {
  // 材料選択肢を生成
  let materialOptions = '<option value="">材料を選択してください</option>';
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
    <div class="size-inputs flex items-center space-x-2 mt-2">
      <span>サイズ:</span>
      ${Components.input({
        id: `material-length-${index}`,
        label: '',
        type: 'number',
        value: materialData.l || '',
        placeholder: '長さ(mm)',
      })}
      <span>×</span>
      ${Components.input({
        id: `material-width-${index}`,
        label: '',
        type: 'number',
        value: materialData.w || '',
        placeholder: '幅(mm)',
      })}
      <span>×</span>
      ${Components.input({
        id: `material-height-${index}`,
        label: '',
        type: 'number',
        value: materialData.h || '',
        placeholder: '高さ(mm)',
      })}
      <span>mm</span>
    </div>`
    : '';

  const deleteButton =
    index > 0
      ? Components.button({
          action: 'removeMaterialRow',
          text: '削除',
          style: 'danger',
          size: 'small',
          dataAttributes: { index: index },
        })
      : '';

  return `
    <div class="material-row border border-ui-border p-3 rounded-md ${index > 0 ? 'mt-3' : ''}" data-material-row="${index}">
      <div class="flex items-center space-x-3">
        <div class="flex-1">
          ${Components.select({
            id: `material-type-${index}`,
            label: '材料',
            options: materialOptions,
          })}
        </div>
        <div class="price-display">
          価格: <span id="material-price-${index}" class="font-bold">${Components.priceDisplay({ amount: 0 })}</span>
        </div>
        ${deleteButton}
      </div>
      ${sizeInputsHtml}
    </div>`;
}

/**
 * 販売セクション生成（Components.js活用）
 * @param {ClassifiedAccountingItems} classifiedItems - 分類済み会計項目
 * @param {AccountingFormData} formData - フォームデータ
 * @returns {string} HTML文字列
 */
function generateSalesSection(classifiedItems, formData = {}) {
  // 材料代セクション
  let materialsHtml = '';
  if (classifiedItems.sales.materialItems.length > 0) {
    materialsHtml = `
      <div class="materials mb-6">
        <h4 class="font-medium text-brand-text mb-3">材料代</h4>
        <div id="materials-container">
          ${generateMaterialRow(classifiedItems.sales.materialItems, 0, formData.materials?.[0] || {})}
        </div>
        ${Components.button({
          action: 'addMaterialRow',
          text: '+ 材料追加',
          style: 'secondary',
          size: 'small',
          customClass: 'mt-3',
        })}
      </div>`;
  }

  // 物販セクション
  let productsHtml = '';
  if (classifiedItems.sales.productItems.length > 0) {
    productsHtml = '<div class="products mb-6">';
    productsHtml += '<h4 class="font-medium text-brand-text mb-3">物販</h4>';
    productsHtml += '<div class="space-y-2">';

    classifiedItems.sales.productItems.forEach(item => {
      const itemName = item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME];
      const price = Number(item[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE]);
      const isChecked = formData.checkedItems?.[itemName] || false;

      productsHtml += Components.checkbox({
        id: `product-${itemName.replace(/\s+/g, '-')}`,
        label: `${itemName} (+${Components.priceDisplay({ amount: price })})`,
        checked: isChecked,
        dynamicStyle: true,
      });
    });

    productsHtml += '</div></div>';
  }

  return `
    <section class="sales-section mb-6">
      ${Components.sectionHeader({ title: '販売' })}
      ${materialsHtml}
      ${productsHtml}
      ${Components.subtotalSection({
        title: '販売小計',
        amount: 0,
        id: 'sales-subtotal-amount',
      })}
    </section>`;
}

/**
 * 自由入力物販セクション生成（Components.js活用）
 * @param {AccountingFormData} formData - フォームデータ
 * @returns {string} HTML文字列
 */
function generateCustomSalesSection(formData = {}) {
  return `
    <section class="custom-sales-section mb-6">
      <h4 class="font-medium text-brand-text mb-3">その他物販</h4>
      <div id="custom-sales-container">
        ${generateCustomSalesRow(0, formData.customSales?.[0] || {})}
      </div>
      ${Components.button({
        action: 'addCustomSalesRow',
        text: '+ 項目追加',
        style: 'secondary',
        size: 'small',
        customClass: 'mt-3',
      })}
    </section>`;
}

/**
 * 自由入力物販行生成（Components.js活用）
 * @param {number} index - 行インデックス
 * @param {Object} itemData - 既存のアイテムデータ
 * @returns {string} HTML文字列
 */
function generateCustomSalesRow(index = 0, itemData = {}) {
  const deleteButton =
    index > 0
      ? Components.button({
          action: 'removeCustomSalesRow',
          text: '削除',
          style: 'danger',
          size: 'small',
          dataAttributes: { index: index },
        })
      : '';

  return `
    <div class="custom-sales-row border border-ui-border p-3 rounded-md ${index > 0 ? 'mt-3' : ''}" data-custom-sales-row="${index}">
      <div class="flex items-center space-x-3">
        <div class="flex-1">
          ${Components.input({
            id: `custom-sales-name-${index}`,
            label: '項目名',
            type: 'text',
            value: itemData.name || '',
            placeholder: '商品名を入力',
          })}
        </div>
        <div class="w-32">
          <label class="block text-sm font-medium text-brand-text mb-1">金額</label>
          <div class="flex items-center">
            <span class="mr-1">¥</span>
            <input
              type="number"
              id="custom-sales-price-${index}"
              value="${itemData.price || ''}"
              placeholder="金額"
              class="${DesignConfig.inputs['base']}"
            >
          </div>
        </div>
        ${deleteButton}
      </div>
    </div>`;
}

/**
 * メイン会計画面生成（Components.js活用）
 * @param {ClassifiedAccountingItems} classifiedItems - 分類済み会計項目
 * @param {string} classroom - 教室名
 * @param {AccountingFormData} formData - フォームデータ
 * @returns {string} HTML文字列
 */
function generateAccountingView(classifiedItems, classroom, formData = {}) {
  return `
    <div class="accounting-container max-w-4xl mx-auto p-4">
      <!-- 授業料セクション -->
      ${generateTuitionSection(classifiedItems, classroom, formData)}

      <!-- 販売セクション -->
      ${generateSalesSection(classifiedItems, formData)}

      <!-- 自由入力物販セクション -->
      ${generateCustomSalesSection(formData)}

      <!-- 合計セクション -->
      <section class="total-section mb-6">
        <div class="grand-total bg-ui-surface border border-ui-border p-4 rounded-lg">
          <div class="text-center">
            <span class="text-2xl font-bold text-brand-text">総合計: </span>
            <span id="grand-total-amount" class="text-2xl font-bold text-brand-text">${Components.priceDisplay({ amount: 0, size: 'large' })}</span>
          </div>
        </div>
      </section>

      <!-- 支払い方法セクション -->
      <section class="payment-section mb-6">
        <h4 class="font-medium text-brand-text mb-3">支払方法</h4>
        <div id="payment-options-container">
          <!-- getPaymentOptionsHtml()で生成される -->
        </div>
        <div id="payment-info-container" class="mt-3">
          <!-- getPaymentInfoHtml()で生成される -->
        </div>
      </section>

      <!-- 確認ボタン -->
      <div class="text-center">
        ${Components.button({
          action: 'confirmPayment',
          text: '支払い確認',
          style: 'primary',
          size: 'large',
          customClass: 'w-full',
        })}
      </div>
    </div>`;
}

/**
 * 支払い方法の選択肢（ラジオボタン）UIを生成（13_WebApp_Views_Utils.jsから移設）
 * @param {string} selectedValue - 選択済みの支払い方法
 * @returns {string} HTML文字列
 */
// getPaymentOptionsHtmlは13_WebApp_Views_Utils.jsで定義済み

// getPaymentInfoHtmlは13_WebApp_Views_Utils.jsで定義済み

// ================================================================================
// 【イベント処理層】
// ================================================================================

/**
 * 会計システムのイベントリスナー設定
 * @param {ClassifiedAccountingItems} classifiedItems - 分類済み会計項目
 * @param {string} classroom - 教室名
 */
function setupAccountingEventListeners(classifiedItems, classroom) {
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
      case 'addMaterialRow':
        addMaterialRow(classifiedItems.sales.materialItems);
        break;
      case 'removeMaterialRow':
        removeMaterialRow(target.getAttribute('data-index'));
        break;
      case 'addCustomSalesRow':
        addCustomSalesRow();
        break;
      case 'removeCustomSalesRow':
        removeCustomSalesRow(target.getAttribute('data-index'));
        break;
      case 'confirmPayment':
        confirmAndPay(classifiedItems, classroom);
        break;
    }
  });

  // 材料タイプ変更時の特別処理
  document.addEventListener('change', function (event) {
    if (event.target.id && event.target.id.startsWith('material-type-')) {
      handleMaterialTypeChange(event, classifiedItems.sales.materialItems);
    }
  });
}

/**
 * 会計入力変更時の処理
 * @param {Event} event - 変更イベント
 * @param {ClassifiedAccountingItems} classifiedItems - 分類済み会計項目
 * @param {string} classroom - 教室名
 */
function handleAccountingInputChange(event, classifiedItems, classroom) {
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
 * チェックボックスのスタイルを更新
 * @param {HTMLInputElement} checkbox - チェックボックス要素
 */
function updateCheckboxStyle(checkbox) {
  const label = checkbox.parentElement;
  if (!label) return;

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
}

/**
 * 材料タイプ変更時の処理
 * @param {Event} event - 変更イベント
 * @param {Array} materialItems - 材料項目配列
 */
function handleMaterialTypeChange(event, materialItems) {
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
      <div class="size-inputs flex items-center space-x-2 mt-2">
        <span>サイズ:</span>
        ${Components.input({
          id: `material-length-${index}`,
          label: '',
          type: 'number',
          placeholder: '長さ(mm)',
        })}
        <span>×</span>
        ${Components.input({
          id: `material-width-${index}`,
          label: '',
          type: 'number',
          placeholder: '幅(mm)',
        })}
        <span>×</span>
        ${Components.input({
          id: `material-height-${index}`,
          label: '',
          type: 'number',
          placeholder: '高さ(mm)',
        })}
        <span>mm</span>
      </div>`;

    materialRow.insertAdjacentHTML('beforeend', sizeInputsHtml);
  }

  // 価格をリセット
  const priceDisplay = materialRow.querySelector(`#material-price-${index}`);
  if (priceDisplay) {
    priceDisplay.innerHTML = Components.priceDisplay({ amount: 0 });
  }
}

/**
 * 材料行追加
 * @param {Array} materialItems - 材料項目配列
 */
function addMaterialRow(materialItems) {
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
function removeMaterialRow(index) {
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
 * 自由入力物販行追加
 */
function addCustomSalesRow() {
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
function removeCustomSalesRow(index) {
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
 * @param {ClassifiedAccountingItems} classifiedItems - 分類済み会計項目
 * @param {string} classroom - 教室名
 */
function updateAccountingCalculation(classifiedItems, classroom) {
  try {
    // フォームデータ収集
    const formData = collectAccountingFormData();

    // 計算実行
    const result = calculateAccountingTotal(
      formData,
      [
        ...classifiedItems.tuition.baseItems,
        ...classifiedItems.tuition.additionalItems,
        ...classifiedItems.tuition.discountItems,
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
function updateAccountingUI(result, classroom) {
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

  // 材料価格個別更新
  updateMaterialPricesDisplay(result);
}

/**
 * 時間計算表示更新
 * @param {Object} result - 計算結果
 * @param {string} classroom - 教室名
 */
function updateTimeCalculationDisplay(result, classroom) {
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
  const baseItem = classifiedItems?.tuition.baseItems.find(item => {
    const targetClassroom = item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM];
    return targetClassroom === classroom || targetClassroom.includes(classroom);
  });

  if (baseItem && baseItem[CONSTANTS.HEADERS.ACCOUNTING.UNIT] === '30分') {
    const unitPrice = Number(baseItem[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE]);
    const tuitionAmount = timeUnits * unitPrice;

    timeCalculation.innerHTML = `計算結果: ${hours}時間 × ${Components.priceDisplay({ amount: unitPrice })} = ${Components.priceDisplay({ amount: tuitionAmount })}`;
  }
}

/**
 * 材料価格個別表示更新
 * @param {Object} result - 計算結果
 */
function updateMaterialPricesDisplay(result) {
  const materials = document.querySelectorAll('.material-row');

  materials.forEach((row, index) => {
    const priceDisplay = row.querySelector(`#material-price-${index}`);
    if (priceDisplay) {
      // result.sales.itemsから該当する材料の価格を取得
      const materialItem = result.sales.items.find(
        item =>
          item.name.includes('(') &&
          item.name.includes('×') &&
          item.name.includes('mm)'),
      );

      if (materialItem) {
        priceDisplay.innerHTML = Components.priceDisplay({
          amount: materialItem.price,
        });
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
function initializePaymentMethodUI(
  selectedPaymentMethod = CONSTANTS.PAYMENT_DISPLAY.CASH,
) {
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
}

/**
 * 支払い方法変更時の処理（既存関数を活用）
 * @param {string} selectedMethod - 選択された支払い方法
 */
function handlePaymentMethodChange(selectedMethod) {
  const paymentInfoContainer = document.getElementById(
    'payment-info-container',
  );

  if (paymentInfoContainer) {
    paymentInfoContainer.innerHTML = getPaymentInfoHtml(selectedMethod);
  }
}

/**
 * 新フォームデータを既存バックエンド形式に変換
 * @param {AccountingFormData} formData - 新フォームデータ
 * @param {Object} result - 計算結果
 * @param {ClassifiedAccountingItems} classifiedItems - 分類済み会計項目
 * @returns {Object} 既存バックエンド形式のuserInput
 */
function convertToLegacyFormat(formData, result, classifiedItems) {
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

  return userInput;
}

/**
 * 支払い確認処理
 * @param {ClassifiedAccountingItems} classifiedItems - 分類済み会計項目
 * @param {string} classroom - 教室名
 */
function confirmAndPay(classifiedItems, classroom) {
  try {
    const formData = collectAccountingFormData();
    const result = calculateAccountingTotal(
      formData,
      [
        ...classifiedItems.tuition.baseItems,
        ...classifiedItems.tuition.additionalItems,
        ...classifiedItems.tuition.discountItems,
        ...classifiedItems.sales.materialItems,
        ...classifiedItems.sales.productItems,
      ],
      classroom,
    );

    // 既存バックエンド形式に変換
    const legacyUserInput = convertToLegacyFormat(
      formData,
      result,
      classifiedItems,
    );

    // 既存形式のpayload作成
    const payload = {
      reservationId:
        window.stateManager?.getState()?.accountingReservation?.reservationId,
      classroom:
        window.stateManager?.getState()?.accountingReservation?.classroom,
      studentId: window.stateManager?.getState()?.currentUser?.studentId,
      userInput: legacyUserInput,
    };

    // 支払い確認モーダルを表示
    if (typeof showAccountingConfirmation === 'function') {
      showAccountingConfirmation(result, formData);
    } else {
      console.error('showAccountingConfirmation関数が見つかりません');
      showInfo(
        '支払い確認機能の初期化に失敗しました。ページを再読み込みしてください。',
      );
    }
  } catch (error) {
    console.error('支払い確認エラー:', error);
    alert('エラーが発生しました。もう一度お試しください。');
  }
}

// ================================================================================
// 【ユーティリティ層】
// ================================================================================

/**
 * フォームデータ収集
 * @returns {AccountingFormData} 収集されたフォームデータ
 */
function collectAccountingFormData() {
  const formData = {};

  // 時刻データ収集
  const startTimeEl = document.getElementById('start-time');
  const endTimeEl = document.getElementById('end-time');
  const breakTimeEl = document.getElementById('break-time');

  if (startTimeEl) formData.startTime = startTimeEl.value;
  if (endTimeEl) formData.endTime = endTimeEl.value;
  if (breakTimeEl) formData.breakTime = Number(breakTimeEl.value) || 0;

  // チェックボックス項目収集
  const checkedItems = {};
  const checkboxes = document.querySelectorAll(
    '.accounting-container input[type="checkbox"]:not(#base-tuition)',
  );

  checkboxes.forEach(checkbox => {
    if (checkbox.checked) {
      // ラベルテキストから項目名を抽出
      const label = checkbox.parentElement.querySelector('span');
      if (label) {
        const labelText = label.textContent.trim();
        // (+¥1,000) のような価格表示を除いて項目名のみ抽出
        const itemName = labelText.replace(/\s*\([+\-]¥[\d,]+\).*$/, '').trim();
        checkedItems[itemName] = true;
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
  } else {
    formData.paymentMethod = CONSTANTS.PAYMENT_DISPLAY.CASH;
  }

  return formData;
}

/**
 * 会計キャッシュ保存
 * @param {AccountingFormData} formData - 保存するフォームデータ
 */
function saveAccountingCache(formData) {
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
 * @returns {AccountingFormData} 読み込まれたフォームデータ
 */
function loadAccountingCache() {
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
 * @param {AccountingFormData} initialFormData - 初期フォームデータ
 * @returns {string} 生成された会計画面HTML
 */
function initializeAccountingSystem(
  masterData,
  classroom,
  initialFormData = {},
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
  );

  // DOMに挿入後の初期化処理を予約
  setTimeout(() => {
    // 支払い方法UI初期化
    initializePaymentMethodUI(formData.paymentMethod);

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
function cleanupAccountingSystem() {
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
