/// <reference path="../../types/frontend-index.d.ts" />
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
  if (typeof window !== 'undefined' && window.tempPaymentData) {
    window.tempPaymentData = null;
  }

  // その他の会計関連の一時データがあればここでクリア
  console.log('会計キャッシュクリア完了');
}

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
