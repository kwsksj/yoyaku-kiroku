/**
 * @typedef {{ type: string; l?: number; w?: number; h?: number; }} MaterialFormEntry
 * @typedef {{ name: string; price: number; }} ProductSelectionEntry
 */

/**
 * 会計システム - ユーティリティ層
 *
 * 責務:
 * - キャッシュ管理（clearAccountingCache, saveAccountingCache, loadAccountingCache）
 * - データ収集（collectMemoData, collectAccountingFormData）
 * - システム初期化・クリーンアップ（initializeAccountingSystem, cleanupAccountingSystem）
 */

// ================================================================================
// 【ユーティリティ層】
// ================================================================================

/**
 * 会計処理関連のローカルキャッシュをクリア
 */
export function clearAccountingCache() {
  // 一時的な支払いデータをクリア
  if (typeof window !== 'undefined' && appWindow.tempPaymentData) {
    appWindow.tempPaymentData = null;
  }

  // その他の会計関連の一時データがあればここでクリア
  console.log('会計キャッシュクリア完了');
}

/**
 * 制作メモのデータを収集
 * @returns {{ reservationId?: string; workInProgress?: string }} 制作メモデータ
 */
export function collectMemoData() {
  /** @type {{ reservationId?: string; workInProgress?: string }} */
  const memoData = {};

  // 会計画面の制作メモテキストエリアを探す
  const textareas = document.querySelectorAll('.memo-edit-textarea');
  textareas.forEach(textareaElement => {
    const textarea = /** @type {HTMLTextAreaElement} */ (textareaElement);
    // テキストエリアのIDからreservationIdを推測
    const id = textarea.id;
    if (id && id.includes('memo-edit-textarea-')) {
      const reservationId = id.replace('memo-edit-textarea-', '');
      memoData.reservationId = reservationId;
      memoData.workInProgress = textarea.value;
    } else {
      // IDパターンが違う場合、親要素から予約IDを取得
      const card = /** @type {HTMLElement | null} */ (
        textarea.closest('[data-reservation-id]')
      );
      if (card) {
        const reservationId = card.getAttribute('data-reservation-id');
        if (reservationId) {
          memoData.reservationId = reservationId;
        }
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
  /** @type {AccountingFormDto} */
  const formData = {};

  // デバッグ: フォームデータ収集開始
  if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
    console.log('🔍 collectAccountingFormData開始');
  }

  // 時刻データ収集
  const startTimeEl = /** @type {HTMLInputElement | null} */ (
    document.getElementById('start-time')
  );
  const endTimeEl = /** @type {HTMLInputElement | null} */ (
    document.getElementById('end-time')
  );
  const breakTimeEl = /** @type {HTMLInputElement | null} */ (
    document.getElementById('break-time')
  );

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
  /** @type {Record<string, boolean>} */
  const checkedItems = {};

  // 全チェックボックスを収集（base-tuitionも含む）
  const checkboxes = document.querySelectorAll(
    '.accounting-container input[type="checkbox"]',
  );

  checkboxes.forEach(checkboxElement => {
    const checkbox = /** @type {HTMLInputElement} */ (checkboxElement);
    if (checkbox.checked) {
      // data属性から項目名を取得（優先）
      const itemName = checkbox.getAttribute('data-item-name');
      if (itemName) {
        checkedItems[itemName] = true;
      } else {
        // フォールバック: ラベルテキストから項目名を抽出
        const parent = checkbox.parentElement;
        if (parent) {
          const labelElement = parent.querySelector('span');
          if (labelElement) {
            const fallbackItemName = labelElement.textContent?.trim();
            if (fallbackItemName) {
              checkedItems[fallbackItemName] = true;
            }
          }
        }
      }
    }
  });

  if (Object.keys(checkedItems).length > 0) {
    formData.checkedItems = checkedItems;
  }

  // 材料データ収集
  /** @type {MaterialFormEntry[]} */
  const materials = [];
  const materialRows = document.querySelectorAll('.material-row');

  materialRows.forEach((row, index) => {
    const typeSelect = /** @type {HTMLSelectElement | null} */ (
      row.querySelector(`#material-type-${index}`)
    );
    if (typeSelect && typeSelect.value) {
      /** @type {MaterialFormEntry} */
      const material = { type: typeSelect.value };

      // サイズデータがある場合
      const lengthInput = /** @type {HTMLInputElement | null} */ (
        row.querySelector(`#material-length-${index}`)
      );
      const widthInput = /** @type {HTMLInputElement | null} */ (
        row.querySelector(`#material-width-${index}`)
      );
      const heightInput = /** @type {HTMLInputElement | null} */ (
        row.querySelector(`#material-height-${index}`)
      );

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
  /** @type {ProductSelectionEntry[]} */
  const selectedProducts = [];
  const productRows = document.querySelectorAll('.product-row');

  productRows.forEach((row, index) => {
    const typeSelect = /** @type {HTMLSelectElement | null} */ (
      row.querySelector(`#product-type-${index}`)
    );
    if (typeSelect && typeSelect.value) {
      const selectedOption = /** @type {HTMLOptionElement} */ (
        typeSelect.options[typeSelect.selectedIndex]
      );
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
  /** @type {Array<{ name: string; price: number }>} */
  const customSales = [];
  const customSalesRows = document.querySelectorAll('.custom-sales-row');

  customSalesRows.forEach((row, index) => {
    const nameInput = /** @type {HTMLInputElement | null} */ (
      row.querySelector(`#custom-sales-name-${index}`)
    );
    const priceInput = /** @type {HTMLInputElement | null} */ (
      row.querySelector(`#custom-sales-price-${index}`)
    );

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
  const paymentMethodRadio = /** @type {HTMLInputElement | null} */ (
    document.querySelector('input[name="payment-method"]:checked')
  );
  if (paymentMethodRadio) {
    formData.paymentMethod = paymentMethodRadio.value;
  }
  // 支払い方法が選択されていない場合は undefined のまま（必須チェックで弾く）

  // 制作メモ収集（会計処理時の保存に利用）
  const memoData = collectMemoData();
  if (memoData && 'workInProgress' in memoData) {
    formData.workInProgress = memoData.workInProgress;
  }

  // デバッグ: 収集されたフォームデータを出力
  if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
    console.log('🔍 collectAccountingFormData結果:', formData);
    const baseTuitionCheckbox = /** @type {HTMLInputElement | null} */ (
      document.getElementById('base-tuition')
    );
    console.log('🔍 基本授業料チェック状態:', baseTuitionCheckbox?.checked);
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

    if (!cached) return /** @type {AccountingFormDto} */ ({});

    const cacheData = JSON.parse(cached);
    const maxAge = 24 * 60 * 60 * 1000; // 24時間

    // キャッシュが古い場合は削除
    if (Date.now() - cacheData.timestamp > maxAge) {
      localStorage.removeItem(cacheKey);
      return /** @type {AccountingFormDto} */ ({});
    }

    return /** @type {AccountingFormDto} */ (cacheData.data || {});
  } catch (error) {
    console.error('会計キャッシュ読込エラー:', error);
    return /** @type {AccountingFormDto} */ ({});
  }
}

/**
 * 会計システム初期化関数
 * @param {AccountingMasterItemCore[]} masterData - 会計マスタデータ
 * @param {string} classroom - 教室名
 * @param {AccountingFormDto} initialFormData - 初期フォームデータ
 * @param {ReservationCore | null} reservationData - 予約データ（講座基本情報表示用）
 * @returns {string} 生成された会計画面HTML
 */
export function initializeAccountingSystem(
  masterData,
  classroom,
  initialFormData = /** @type {AccountingFormDto} */ ({}),
  reservationData = null,
) {
  // グローバル変数に保存（イベント処理で使用）
  const classifiedItems = classifyAccountingItems(masterData, classroom);
  appWindow.currentClassifiedItems = classifiedItems;
  appWindow.currentClassroom = classroom;

  // キャッシュから既存データを読み込み、初期データとマージ
  const cachedData = loadAccountingCache();
  const formData = /** @type {AccountingFormDto} */ ({
    ...cachedData,
    ...initialFormData,
  });

  const createAccountingView =
    /** @type {(items: ClassifiedAccountingItemsCore, room: string, data: AccountingFormDto, reservation: ReservationCore | null) => string} */ (
      generateAccountingView
    );
  const setupListeners =
    /** @type {(items: ClassifiedAccountingItemsCore, room: string) => void} */ (
      setupAccountingEventListeners
    );
  const updateCalculation =
    /** @type {(items: ClassifiedAccountingItemsCore, room: string) => void} */ (
      updateAccountingCalculation
    );
  const initPaymentUI = /** @type {(method: string) => void} */ (
    initializePaymentMethodUI
  );

  // 会計画面HTML生成
  const accountingHtml = createAccountingView(
    classifiedItems,
    classroom,
    formData,
    reservationData,
  );

  // DOMに挿入後の初期化処理を予約
  setTimeout(() => {
    // 支払い方法UI初期化（初期状態では何も選択しない）
    initPaymentUI('');

    // イベントリスナー設定
    setupListeners(classifiedItems, classroom);

    // 初期計算実行
    updateCalculation(classifiedItems, classroom);

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
  if (appWindow.accountingCalculationTimeout) {
    window.clearTimeout(appWindow.accountingCalculationTimeout);
    appWindow.accountingCalculationTimeout = undefined;
  }

  // グローバル変数をクリア
  appWindow.currentClassifiedItems = null;
  appWindow.currentClassroom = null;

  // 最終的なキャッシュ保存
  try {
    const currentFormData = collectAccountingFormData();
    saveAccountingCache(currentFormData);
  } catch (error) {
    console.error('クリーンアップ時のキャッシュ保存エラー:', error);
  }
}
