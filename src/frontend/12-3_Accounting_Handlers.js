/**
 * =================================================================
 * ファイル概要
 * -----------------------------------------------------------------
 * 名称: 12-3_Accounting_Handlers.js
 * 目的: 会計画面のイベント処理と状態更新を担当する
 * 主な責務:
 *   - 会計フォームのイベントリスナー登録と入力ハンドリング
 *   - 計算ロジックとUI更新の橋渡し
 *   - 支払いモーダルの表示/確定処理
 * AI向けメモ:
 *   - 新しい会計イベントを追加する際はここでハンドラーを定義し、UI生成や計算ロジックは対応するモジュールへ委譲する
 * =================================================================
 */

/**
 * @typedef {import('./12_WebApp_StateManager.js').SimpleStateManager} SimpleStateManager
 */
/**
 * @typedef {import('../../types/view/handlers').ActionHandlers} ActionHandlers
 */

// ================================================================
// UI系モジュール
// ================================================================
import { Components, escapeHTML } from './13_WebApp_Components.js';
import {
  generateCustomSalesRow,
  generateMaterialRow,
  generateProductRow,
  getPaymentInfoHtml,
  getPaymentOptionsHtml,
} from './12-2_Accounting_UI.js';

// ================================================================
// ユーティリティ系モジュール
// ================================================================
import {
  calculateAccountingTotal,
  calculateTimeUnits,
} from './12-1_Accounting_Calculation.js';
import {
  collectAccountingFormData,
  saveAccountingCache,
  clearAccountingCache,
} from './12-4_Accounting_Utilities.js';

// ================================================================================
// 【イベント処理層】
// ================================================================================

/**
 * イベントターゲットをHTMLElementとして取得
 * @param {EventTarget | null} target
 * @returns {HTMLElement | null}
 */
const toHTMLElement = target => (target instanceof HTMLElement ? target : null);

/**
 * イベントターゲットをHTMLInputElementとして取得
 * @param {EventTarget | null} target
 * @returns {HTMLInputElement | null}
 */
const toInputElement = target =>
  target instanceof HTMLInputElement ? target : null;

/**
 * イベントターゲットをHTMLSelectElementとして取得
 * @param {EventTarget | null} target
 * @returns {HTMLSelectElement | null}
 */
const toSelectElement = target =>
  target instanceof HTMLSelectElement ? target : null;

/**
 * 安全にstateManagerを取得するヘルパー
 * @returns {SimpleStateManager | null}
 */
const getAccountingStateManager = () => {
  const manager = appWindow.stateManager;
  if (!manager) {
    console.warn('accountingStateManager: stateManagerが未初期化です');
    return null;
  }
  return /** @type {SimpleStateManager} */ (manager);
};

/**
 * 会計システムのイベントリスナー設定
 * @param {ClassifiedAccountingItemsCore} classifiedItems - 分類済み会計項目
 * @param {string} classroom - 教室名
 */
export function setupAccountingEventListeners(classifiedItems, classroom) {
  // 入力変更イベント（チェックボックス、セレクト、インプット）
  document.addEventListener('change', function (event) {
    const target = toHTMLElement(event.target);
    if (!target) return;

    // 会計関連の入力要素の変更を検知
    if (target.closest('.accounting-container')) {
      handleAccountingInputChange(event, classifiedItems, classroom);
    }

    // 支払い方法変更
    if (
      target instanceof HTMLInputElement &&
      target.name === 'payment-method'
    ) {
      handlePaymentMethodChange(target.value);
    }
  });

  // ボタンクリックイベント
  document.addEventListener('click', function (event) {
    const target = toHTMLElement(event.target);
    if (!target) return;

    const action = target.getAttribute('data-action');

    if (!action) return;

    switch (action) {
      case 'removeMaterialRow':
        {
          const indexAttr = target.getAttribute('data-index');
          if (indexAttr) {
            removeMaterialRow(indexAttr);
          }
        }
        break;
      case 'removeProductRow':
        {
          const indexAttr = target.getAttribute('data-index');
          if (indexAttr) {
            removeProductRow(indexAttr);
          }
        }
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
    const target = toHTMLElement(event.target);
    if (!target) return;
    if (target.id && target.id.startsWith('material-type-')) {
      handleMaterialTypeChange(event, classifiedItems.sales.materialItems);
    }
  });

  // 物販タイプ変更時の特別処理
  document.addEventListener('change', function (event) {
    const target = toHTMLElement(event.target);
    if (!target) return;
    if (target.id && target.id.startsWith('product-type-')) {
      handleProductTypeChange(event, classifiedItems.sales.productItems);
    }
  });

  // 自由入力物販の入力変更時の特別処理
  document.addEventListener('input', function (event) {
    const target = toHTMLElement(event.target);
    if (!target) return;
    if (target.id && target.id.startsWith('custom-sales-')) {
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
  const target = toHTMLElement(event.target);
  if (!target) return;

  // 動的スタイルのチェックボックスの更新
  if (
    target instanceof HTMLInputElement &&
    target.type === 'checkbox' &&
    target.hasAttribute('data-dynamic-style')
  ) {
    updateCheckboxStyle(target);
  }

  // 短時間での連続計算を防ぐためのデバウンス
  if (appWindow.accountingCalculationTimeout) {
    window.clearTimeout(appWindow.accountingCalculationTimeout);
  }
  appWindow.accountingCalculationTimeout = window.setTimeout(() => {
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
 * @param {AccountingMasterItemCore[]} materialItems - 材料項目配列
 */
export function handleMaterialTypeChange(event, materialItems) {
  const selectElement = toSelectElement(event.target);
  if (!selectElement) return;

  const index = selectElement.id.split('-')[2]; // material-type-0 -> 0
  const selectedType = selectElement.value;
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
      const lastIndexAttr = lastRow.getAttribute('data-material-row');
      if (!lastIndexAttr) {
        return;
      }
      const lastIndex = Number.parseInt(lastIndexAttr, 10);

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
    const classifiedItems = appWindow.currentClassifiedItems;
    const classroom = appWindow.currentClassroom;
    if (classifiedItems && classroom) {
      updateAccountingCalculation(classifiedItems, classroom);
    }
  }, 100);
}

/**
 * 材料行追加
 * @param {AccountingMasterItemCore[]} materialItems - 材料項目配列
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
      const classifiedItems = appWindow.currentClassifiedItems;
      const classroom = appWindow.currentClassroom;
      if (classifiedItems && classroom) {
        updateAccountingCalculation(classifiedItems, classroom);
      }
    }, 100);
  }
}

/**
 * 物販タイプ変更時の処理
 * @param {Event} event - 変更イベント
 * @param {AccountingMasterItemCore[]} productItems - 物販項目配列
 */
export function handleProductTypeChange(event, productItems) {
  const selectElement = toSelectElement(event.target);
  if (!selectElement) return;

  const index = selectElement.id.split('-')[2]; // product-type-0 -> 0
  const selectedType = selectElement.value;
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
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    if (selectedOption && selectedOption.value) {
      selectedOption.textContent = selectedType; // 商品名のみ
    }
  } else if (priceDisplay) {
    priceDisplay.innerHTML = Components.priceDisplay({ amount: 0 });

    // 未選択の場合、プルダウンの表示をリセット
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
      const lastIndexAttr = lastRow.getAttribute('data-product-row');
      if (!lastIndexAttr) {
        return;
      }
      const lastIndex = Number.parseInt(lastIndexAttr, 10);

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
    const classifiedItems = appWindow.currentClassifiedItems;
    const classroom = appWindow.currentClassroom;
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
      const classifiedItems = appWindow.currentClassifiedItems;
      const classroom = appWindow.currentClassroom;
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
  const target = toInputElement(event.target);
  if (!target) return;
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
    const nameInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById(`custom-sales-name-${index}`)
    );
    const priceInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById(`custom-sales-price-${index}`)
    );

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
    const classifiedItems = appWindow.currentClassifiedItems;
    const classroom = appWindow.currentClassroom;
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
      const classifiedItems = appWindow.currentClassifiedItems;
      const classroom = appWindow.currentClassroom;
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
  void classifiedItems;
  try {
    // フォームデータ収集
    const formData = collectAccountingFormData();

    // 元のマスターデータを取得（回数制の基本授業料を含む）
    const stateManager = getAccountingStateManager();
    if (!stateManager) return;
    const masterData = stateManager.getState().accountingMaster || [];

    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      console.log('🔍 updateAccountingCalculation: マスターデータ使用', {
        masterDataLength: masterData.length,
      });
    }

    // 計算実行
    const result = calculateAccountingTotal(formData, masterData, classroom);

    // UI更新
    updateAccountingUI(result, classroom);
  } catch (error) {
    console.error('会計計算エラー:', error);
    // エラー時は0で表示
    const emptyResult = /** @type {AccountingDetailsCore} */ ({
      tuition: { items: [], subtotal: 0 },
      sales: { items: [], subtotal: 0 },
      grandTotal: 0,
      paymentMethod: CONSTANTS.PAYMENT_DISPLAY.CASH,
    });
    updateAccountingUI(emptyResult, classroom);
  }
}

/**
 * 会計UI更新
 * @param {AccountingDetailsCore} result - 計算結果
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
  updateTimeCalculationDisplay(classroom);

  // 個別価格表示更新
  updateMaterialPricesDisplay(result);
  updateProductPricesDisplay(result);
  updateCustomSalesPricesDisplay(result);
}

/**
 * 時間計算表示更新
 * @param {string} classroom - 教室名
 */
export function updateTimeCalculationDisplay(classroom) {
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
  const classifiedItems = appWindow.currentClassifiedItems;
  const BASE_TUITION_ITEMS = [
    CONSTANTS.ITEMS.MAIN_LECTURE_COUNT,
    CONSTANTS.ITEMS.MAIN_LECTURE_TIME,
    CONSTANTS.ITEMS.MAIN_LECTURE,
  ];
  const baseItem = classifiedItems?.tuition.baseItems.find(
    (/** @type {AccountingMasterItemCore} */ item) => {
      const itemName = item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME];
      const targetClassroom =
        item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM];
      return (
        BASE_TUITION_ITEMS.includes(itemName) &&
        (targetClassroom === classroom || targetClassroom.includes(classroom))
      );
    },
  );

  if (baseItem && baseItem[CONSTANTS.HEADERS.ACCOUNTING.UNIT] === '30分') {
    const unitPrice = Number(baseItem[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE]);
    const tuitionAmount = timeUnits * unitPrice;

    timeCalculation.innerHTML = `${hours}時間 ×${Components.priceDisplay({ amount: unitPrice * 2 })} =${Components.priceDisplay({ amount: tuitionAmount })}`;
  }
}

/**
 * 材料価格個別表示更新
 * @param {AccountingDetailsCore} result - 計算結果
 */
export function updateMaterialPricesDisplay(result) {
  const materials = document.querySelectorAll('.material-row');
  const salesItems = result.sales.items;

  materials.forEach(row => {
    // data-material-row属性から実際のインデックスを取得
    const rowIndex = row.getAttribute('data-material-row');
    if (!rowIndex) return;

    const priceDisplay = /** @type {HTMLElement | null} */ (
      row.querySelector(`#material-price-${rowIndex}`)
    );
    const typeSelect = /** @type {HTMLSelectElement | null} */ (
      row.querySelector(`#material-type-${rowIndex}`)
    );

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
 * @param {AccountingDetailsCore} result - 計算結果
 */
export function updateProductPricesDisplay(result) {
  const products = document.querySelectorAll('.product-row');
  const salesItems = result.sales.items;

  products.forEach(row => {
    // data-product-row属性から実際のインデックスを取得
    const rowIndex = row.getAttribute('data-product-row');
    if (!rowIndex) return;

    const priceDisplay = /** @type {HTMLElement | null} */ (
      row.querySelector(`#product-price-${rowIndex}`)
    );
    const typeSelect = /** @type {HTMLSelectElement | null} */ (
      row.querySelector(`#product-type-${rowIndex}`)
    );

    if (priceDisplay && typeSelect) {
      const selectedType = typeSelect.value;
      if (selectedType) {
        // 選択された物販タイプに一致するアイテムを検索
        const productItem = salesItems.find(
          (/** @type {any} */ item) => item.name === selectedType,
        );

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
 * @param {AccountingDetailsCore} result - 計算結果
 */
export function updateCustomSalesPricesDisplay(result) {
  const customSales = document.querySelectorAll('.custom-sales-row');
  const salesItems = result.sales.items;

  customSales.forEach(row => {
    // data-custom-sales-row属性から実際のインデックスを取得
    const rowIndex = row.getAttribute('data-custom-sales-row');
    if (!rowIndex) return;

    const priceDisplay = /** @type {HTMLElement | null} */ (
      row.querySelector(`#custom-sales-display-${rowIndex}`)
    );
    const nameInput = /** @type {HTMLInputElement | null} */ (
      row.querySelector(`#custom-sales-name-${rowIndex}`)
    );

    if (priceDisplay && nameInput) {
      const itemName = nameInput.value.trim();
      if (itemName) {
        // 入力された名前に一致するアイテムを検索
        const customItem = salesItems.find(
          (/** @type {any} */ item) => item.name === itemName,
        );

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

  paymentMethodRadios.forEach(radioElement => {
    const radio = /** @type {HTMLInputElement} */ (radioElement);
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
  const confirmButton = /** @type {HTMLButtonElement | null} */ (
    document.getElementById('confirm-payment-button')
  );
  const selectedPaymentMethod = /** @type {HTMLInputElement | null} */ (
    document.querySelector('input[name="payment-method"]:checked')
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
 * @param {AccountingDetailsCore} result - 計算結果
 * @param {ClassifiedAccountingItemsCore} classifiedItems - 分類済み会計項目
 * @returns {Object} 既存バックエンド形式のuserInput
 */
export function convertToLegacyFormat(formData, result, classifiedItems) {
  void classifiedItems;
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
    const globalActionHandlers = /** @type {ActionHandlers | undefined} */ (
      appWindow.actionHandlers
    );

    if (globalActionHandlers?.smartGoBack) {
      globalActionHandlers.smartGoBack();
    } else {
      // フォールバック: StateManagerを使用
      const stateManager = getAccountingStateManager();
      if (stateManager && typeof stateManager.dispatch === 'function') {
        stateManager.dispatch({
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
 * @param {AccountingDetailsCore} result - 計算結果
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
  const formatPrice = (/** @type {number} */ amount) => {
    if (typeof Components !== 'undefined' && Components.priceDisplay) {
      return Components.priceDisplay({ amount });
    }
    return `¥${amount.toLocaleString()}`;
  };

  const formatPriceLarge = (/** @type {number} */ amount) => {
    if (typeof Components !== 'undefined' && Components.priceDisplay) {
      return Components.priceDisplay({ amount, size: 'large' });
    }
    return `¥${amount.toLocaleString()}`;
  };

  // ボタン生成のヘルパー
  const generateButton = (
    /** @type {string} */ action,
    /** @type {string} */ text,
    /** @type {ComponentStyle} */ style,
    customClass = '',
  ) => {
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
        (/** @type {any} */ item) => `
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
        (/** @type {any} */ item) => `
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
      <div class="bg-white rounded-lg mx-4 max-w-md w-full max-h-[80vh] flex flex-col">

        <!-- モーダルヘッダー（固定） -->
        <div class="p-6 border-b-2 border-ui-border flex-shrink-0">
          <h3 class="text-xl font-bold text-brand-text">支払い確認</h3>
        </div>

        <!-- モーダルボディ（スクロール可能） -->
        <div class="p-4 space-y-4 overflow-y-auto flex-1">

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
        <!-- モーダルフッター（固定） -->
        <div class="p-6 border-t-2 border-ui-border flex gap-3 flex-shrink-0">
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

  /** @type {AccountingFormDto | null} */
  let debugFormData = null;
  /** @type {AccountingDetailsCore | null} */
  let debugResult = null;

  try {
    const collectedFormData = collectAccountingFormData();
    debugFormData = collectedFormData;

    const paymentMethod = collectedFormData.paymentMethod;
    // 支払い方法の選択チェック
    if (!paymentMethod) {
      showInfo('支払い方法を選択してください。', '入力エラー');
      return;
    }
    const ensuredPaymentMethod = paymentMethod;

    // 元のマスターデータを取得（回数制の基本授業料を含む）
    const stateManager = getAccountingStateManager();
    if (!stateManager) return;
    const masterData = stateManager.getState().accountingMaster || [];

    // デバッグ：計算前の情報
    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      console.log('🔍 支払い確認モーダル: 計算前データ確認', {
        masterDataLength: masterData.length,
        classroom,
      });
    }

    const computedResult = calculateAccountingTotal(
      collectedFormData,
      masterData,
      classroom,
    );
    debugResult = computedResult;

    // デバッグログ
    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      console.log('🔍 支払い確認モーダル生成開始', {
        formData: collectedFormData,
        result: computedResult,
      });
    }

    // モーダルHTML生成
    const modalHtml = generatePaymentConfirmModal(
      computedResult,
      ensuredPaymentMethod,
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
    appWindow.tempPaymentData = {
      formData: collectedFormData,
      result: computedResult,
      classifiedItems,
      classroom,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('支払い確認エラー:', err);
    if (err.stack) {
      console.error('エラースタック:', err.stack);
    }

    // デバッグ情報
    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      console.log('エラー発生時の状態:', {
        formData: debugFormData || 'undefined',
        result: debugResult || 'undefined',
        classifiedItems: classifiedItems || 'undefined',
        classroom: classroom || 'undefined',
      });
    }

    showInfo(err.message, 'エラー');
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
  if (appWindow.tempPaymentData) {
    appWindow.tempPaymentData = null;
  }
}

/**
 * 支払い処理を実行（モーダルから呼び出し）
 */
export function handleProcessPayment() {
  // 重複実行防止チェック
  if (appWindow.paymentProcessing) {
    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      console.log('⚠️ 支払い処理は既に実行中です');
    }
    return;
  }

  if (!appWindow.tempPaymentData) {
    console.error('支払いデータが見つかりません');
    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      console.log('デバッグ: tempPaymentData =', appWindow.tempPaymentData);
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
  appWindow.paymentProcessing = true;

  const { formData, result, classifiedItems, classroom } =
    appWindow.tempPaymentData;

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
    const globalActionHandlers = /** @type {ActionHandlers | undefined} */ (
      appWindow.actionHandlers
    );

    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      console.log('🔍 handleProcessPayment: 処理方法を判定中', {
        actionHandlers存在: typeof globalActionHandlers !== 'undefined',
        confirmAndPay存在:
          typeof globalActionHandlers !== 'undefined' &&
          globalActionHandlers?.confirmAndPay,
      });
    }

    if (globalActionHandlers?.confirmAndPay) {
      if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
        console.log(
          '🔍 handleProcessPayment: actionHandlers.confirmAndPay()を実行',
        );
      }
      globalActionHandlers.confirmAndPay();
    } else {
      if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
        console.log('🔍 handleProcessPayment: フォールバック処理を実行');
      }
      // フォールバック: 直接処理
      processAccountingPayment(formData, result);
    }
  } finally {
    // 支払い処理完了後にデータとフラグをクリア
    appWindow.tempPaymentData = null;
    appWindow.paymentProcessing = false;
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
  const textarea = /** @type {HTMLTextAreaElement | null} */ (
    document.getElementById(textareaId)
  );
  if (!textarea) {
    console.error('制作メモのテキストエリアが見つかりません');
    return;
  }

  const newMemoText = textarea.value;

  // ローディング表示
  if (typeof showLoading === 'function') {
    showLoading('memo');
  }

  // ユーザーIDを取得
  const stateManager = getAccountingStateManager();
  if (!stateManager) {
    if (typeof hideLoading === 'function') {
      hideLoading();
    }
    showInfo('アプリケーションの初期化が完了していません。', 'エラー');
    return;
  }
  const studentId = stateManager.getState().currentUser?.studentId;
  if (!studentId) {
    if (typeof hideLoading === 'function') {
      hideLoading();
    }
    showInfo('ユーザー情報が見つかりません。', 'エラー');
    return;
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

          // 最新データで状態を更新（予約リストも更新される）
          if (response.data) {
            stateManager.dispatch({
              type: 'UPDATE_STATE',
              payload: {
                myReservations: response.data.myReservations || [],
                lessons: response.data.lessons || [],
              },
            });
          }
        } else {
          showInfo(
            '制作メモの更新に失敗しました: ' + (response.message || ''),
            'エラー',
          );
        }
      })
      .withFailureHandler((/** @type {Error} */ error) => {
        if (typeof hideLoading === 'function') {
          hideLoading();
        }
        console.error('制作メモ更新エラー:', error);
        showInfo('制作メモの更新に失敗しました。', 'エラー');
      })
      .updateReservationMemoAndGetLatestData(
        reservationId,
        studentId,
        newMemoText,
      );
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
 * @param {AccountingDetailsCore} result - 計算結果
 */
export function processAccountingPayment(formData, result) {
  try {
    // ローディング表示
    if (typeof showLoading === 'function') {
      showLoading('accounting');
    }

    const stateManager = getAccountingStateManager();
    if (!stateManager) {
      hideLoading();
      showInfo('アプリケーションの初期化が完了していません。', '計算エラー');
      return;
    }
    const state = stateManager.getState();
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
            if (response.data) {
              stateManager.dispatch({
                type: 'UPDATE_STATE',
                payload: {
                  myReservations: response.data.myReservations || [],
                  lessons: response.data.lessons || [],
                },
              });
            }

            // 完了画面に遷移（会計完了として認識されるメッセージを使用）
            stateManager.dispatch({
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
        .withFailureHandler((/** @type {Error} */ error) => {
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
