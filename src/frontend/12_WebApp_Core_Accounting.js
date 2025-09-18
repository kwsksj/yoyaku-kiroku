// @ts-check
/// <reference path="../../types/dev-environment.d.ts" />
/// <reference path="../../types/html-environment.d.ts" />
/// <reference path="../../types/api-types.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 12_WebApp_Core_Accounting.js
 * 【バージョン】: 1.0
 * 【役割】: WebAppのフロントエンドにおける、会計計算ロジックを
 * 集約します。複雑な料金計算、UI更新処理など。
 * 【構成】: 12_WebApp_Core.jsから分割された会計計算ファイル
 * 【新規作成理由】:
 * - メインコアファイルの肥大化対策
 * - 会計計算機能の独立性向上
 * - AIの作業効率向上のためのファイル分割
 * =================================================================
 */

// =================================================================
// --- Accounting Cache Utilities ---
// -----------------------------------------------------------------
// FE-14: 会計入力内容をlocalStorageに一時保存する機能
// =================================================================

/**
 * 会計入力のキャッシュデータをlocalStorageに保存する
 * @param {string} reservationId - 予約ID
 * @param {AccountingFormData} accountingData - 保存する会計データオブジェクト
 */
function saveAccountingCache(reservationId, accountingData) {
  if (!reservationId || !accountingData) return;
  const cacheKey = `accounting_cache_${reservationId}`;
  try {
    localStorage.setItem(cacheKey, JSON.stringify(accountingData));
  } catch (e) {
    console.error('Failed to save accounting cache:', e);
  }
}

/**
 * localStorageから会計入力のキャッシュデータを読み込む
 * @param {string} reservationId - 予約ID
 * @returns {AccountingFormData | null} 読み込んだ会計データオブジェクト、またはnull
 */
function loadAccountingCache(reservationId) {
  if (!reservationId) return null;

  const cacheKey = `accounting_cache_${reservationId}`;
  try {
    const cachedData = localStorage.getItem(cacheKey);
    if (!cachedData) return null;

    const parsed = JSON.parse(cachedData);

    // 現在のマスターデータと照合して、存在しない項目を除外
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch (e) {
    console.error('Failed to load accounting cache:', e);
    return null;
  }
}

/**
 * localStorageから会計入力のキャッシュデータを削除する
 * @param {string} reservationId - 予約ID
 */
function clearAccountingCache(reservationId) {
  if (!reservationId) return;
  const cacheKey = `accounting_cache_${reservationId}`;
  try {
    localStorage.removeItem(cacheKey);
  } catch (e) {
    console.error('Failed to clear accounting cache:', e);
  }
}

// =================================================================
// --- Accounting Utilities ---
// -----------------------------------------------------------------

/**
 * 料金マスタから、指定された教室と項目名に合致する授業料ルールを取得します。
 * @param {AccountingMasterData[]} master - 料金マスタ (stateManager.getState().accountingMaster)
 * @param {string} classroom - 教室名
 * @param {string} itemName - 項目名
 * @returns {AccountingMasterData | undefined} 該当する授業料ルールオブジェクト
 */
window.getTuitionItemRule =
  window.getTuitionItemRule ||
  /** @type {(master: AccountingMasterData[], classroom: string, itemName: string) => AccountingMasterData | undefined} */ (
    (master, classroom, itemName) => {
      if (!master || !classroom || !itemName) return undefined;
      return master.find(
        item =>
          item['種別'] === CONSTANTS.ITEM_TYPES.TUITION &&
          item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME] === itemName &&
          item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM] &&
          item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM].includes(
            classroom,
          ),
      );
    }
  );

// =================================================================
// --- Accounting Calculation Logic ---
// -----------------------------------------------------------------
// 会計画面での複雑な料金計算ロジックです。
// 授業料、材料費、割引などを動的に計算し、合計金額を算出します。
// =================================================================

/**
 * 会計計算を実行し、結果を返します。
 * @returns {AccountingCalculation | null} 計算結果詳細またはnull
 */
function calculateAccountingDetails() {
  if (!stateManager.getState().accountingMaster) return null;

  const details = calculateAccountingDetailsFromForm();

  // 計算結果を直接使用（computed不要）

  // UI要素の更新
  updateAccountingUI(details);

  return details;
}

/**
 * フォームの内容から会計計算を実行します（appState独立）。
 * @returns {AccountingCalculation} 計算結果詳細
 */
function calculateAccountingDetailsFromForm() {
  let tuitionSubtotal = 0;
  let salesSubtotal = 0;
  /** @type {AccountingCalculation} */
  const details = {
    tuition: { items: [], subtotal: 0 },
    sales: { items: [], subtotal: 0 },
    grandTotal: 0,
    paymentMethod: '',
    items: [],
  };
  const form = document.getElementById('accounting-form');
  if (!form) return details;

  const r = stateManager.getState().accountingReservation;
  const tuitionItemRule = getTuitionItemRule(
    stateManager.getState().accountingMaster,
    r.classroom,
    CONSTANTS.ITEMS.MAIN_LECTURE,
  );
  const isTimeBased =
    tuitionItemRule && tuitionItemRule['単位'] === CONSTANTS.UNITS.THIRTY_MIN;

  // 時間制授業料計算
  if (isTimeBased) {
    const timeBasedResult = calculateTimeBasedTuition(tuitionItemRule);
    if (timeBasedResult) {
      tuitionSubtotal += timeBasedResult.price;
      details.tuition.items.push(timeBasedResult.item);
    }
  }

  // チェックボックス項目計算
  const checkboxResult = calculateCheckboxItems();
  tuitionSubtotal += checkboxResult.tuitionSubtotal;
  salesSubtotal += checkboxResult.salesSubtotal;
  details.tuition.items.push(...checkboxResult.tuitionItems);
  details.sales.items.push(...checkboxResult.salesItems);
  details.items.push(...checkboxResult.allItems);

  // 割引計算
  const discountResult = calculateDiscount();
  if (discountResult) {
    tuitionSubtotal -= discountResult.amount;
    details.tuition.items.push(discountResult.item);
  }

  // 材料費計算
  const materialResult = calculateMaterials();
  salesSubtotal += materialResult.subtotal;
  details.sales.items.push(...materialResult.items);

  // その他販売品計算
  const otherSalesResult = calculateOtherSales();
  salesSubtotal += otherSalesResult.subtotal;
  details.sales.items.push(...otherSalesResult.items);

  // 合計計算
  details.tuition.subtotal = tuitionSubtotal;
  details.sales.subtotal = salesSubtotal;
  details.grandTotal = tuitionSubtotal + salesSubtotal;
  details.paymentMethod =
    form.querySelector('input[name="payment-method"]:checked')?.value || '現金';

  return details;
}

/**
 * 時間制授業料を計算する
 * 開始時間・終了時間・休憩時間から実際の受講時間を算出し、30分単位で料金を計算
 * @param {AccountingMasterData} tuitionItemRule - 会計マスタの授業料ルールオブジェクト（単価を含む）
 * @returns {{price: number, item: AccountingItem} | null} 計算結果 { price: number, item: {name: string, price: number} } または null
 */
function calculateTimeBasedTuition(tuitionItemRule) {
  // 時刻データを適切に取得（ヘルパー関数使用）
  const accountingReservation = stateManager.getState().accountingReservation;
  const startTime = getTimeValue(
    'start-time',
    /** @type {ReservationData | null} */ (accountingReservation),
    'startTime',
  );
  const endTime = getTimeValue(
    'end-time',
    /** @type {ReservationData | null} */ (accountingReservation),
    'endTime',
  );
  const breakMinutes = parseInt(
    document.getElementById('break-time')?.value || '0',
    10,
  );

  if (startTime && endTime && startTime < endTime) {
    const start = new Date(`1900-01-01T${startTime}:00`);
    const end = new Date(`1900-01-01T${endTime}:00`);
    let diffMinutes = (end.getTime() - start.getTime()) / 60000 - breakMinutes;

    if (diffMinutes > 0) {
      const billableUnits = Math.ceil(diffMinutes / 30);
      const price =
        billableUnits *
          Number(tuitionItemRule[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE]) || 0;
      return {
        price: price,
        item: { name: `授業料 (${startTime} - ${endTime})`, price: price },
      };
    }
  }
  return null;
}

/**
 * 会計画面で時刻変更時に計算を更新する
 */
function updateAccountingCalculation() {
  // 会計合計を再計算
  const accountingResult = calculateAccountingDetailsFromForm();

  // 合計金額表示を更新
  const totalElement = document.getElementById('total-amount');
  if (totalElement && accountingResult) {
    totalElement.textContent = `¥${accountingResult.grandTotal.toLocaleString()}`;
  }

  // 詳細表示も更新（存在する場合）
  const detailsElement = document.getElementById('calculation-details');
  if (detailsElement && accountingResult) {
    // 詳細計算結果を表示
    detailsElement.innerHTML = `
      <div class="text-sm text-gray-600 space-y-1">
        <div>授業料小計: ¥${accountingResult.tuition.subtotal.toLocaleString()}</div>
        <div>物販小計: ¥${accountingResult.sales.subtotal.toLocaleString()}</div>
        <div class="font-semibold border-t pt-1">合計: ¥${accountingResult.grandTotal.toLocaleString()}</div>
      </div>`;
  }
}

/**
 * 会計画面の時刻選択にイベントリスナーを追加する
 */
function setupAccountingEventListeners() {
  // 時刻選択要素にchangeイベントを追加
  ['start-time', 'end-time', 'break-time'].forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('change', updateAccountingCalculation);
    }
  });

  // チェックボックス項目にもchangeイベントを追加
  document
    .querySelectorAll('input[type="checkbox"].accounting-item')
    .forEach(checkbox => {
      checkbox.addEventListener('change', updateAccountingCalculation);
    });

  // 割引チェックボックスにもchangeイベントを追加
  const discountCheckbox = document.getElementById('discount-checkbox');
  if (discountCheckbox) {
    discountCheckbox.addEventListener('change', updateAccountingCalculation);
  }
}

/**
 * フォーム内のチェックボックス項目の料金を計算する
 * 授業料項目と物販項目を区別して集計し、両方の小計を算出
 * @returns {{tuitionSubtotal: number, salesSubtotal: number, tuitionItems: AccountingItem[], salesItems: AccountingItem[], allItems: AccountingItem[]}} 計算結果
 */
function calculateCheckboxItems() {
  let tuitionSubtotal = 0;
  let salesSubtotal = 0;
  /** @type {AccountingItem[]} */
  const tuitionItems = [];
  /** @type {AccountingItem[]} */
  const salesItems = [];
  /** @type {AccountingItem[]} */
  const allItems = [];

  const form = document.getElementById('accounting-form');
  if (!form)
    return {
      tuitionSubtotal: 0,
      salesSubtotal: 0,
      tuitionItems: [],
      salesItems: [],
      allItems: [],
    };

  form.querySelectorAll('input[type="checkbox"].accounting-item').forEach(
    /** @param {HTMLInputElement} cb */ cb => {
      if (cb.checked || cb.disabled) {
        const itemName = /** @type {string} */ (cb.dataset['itemName']);
        const itemType = /** @type {string} */ (cb.dataset['itemType']);
        const masterItem = stateManager
          .getState()
          .accountingMaster.find(
            m =>
              m[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME] === itemName &&
              m['種別'] === itemType,
          );
        if (!masterItem) return;

        const price = Number(
          masterItem[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE],
        );
        const itemDetail = { name: itemName, price: price };
        allItems.push(itemDetail);

        if (itemType === CONSTANTS.ITEM_TYPES.TUITION) {
          tuitionSubtotal += price;
          tuitionItems.push(itemDetail);
        } else {
          salesSubtotal += price;
          salesItems.push(itemDetail);
        }
      }
    },
  );

  /** @type {{tuitionSubtotal: number, salesSubtotal: number, tuitionItems: AccountingItem[], salesItems: AccountingItem[], allItems: AccountingItem[]}} */
  return {
    tuitionSubtotal,
    salesSubtotal,
    tuitionItems,
    salesItems,
    allItems,
  };
}

/**
 * 初回者同時割引を計算する
 * 固定の¥500引きを適用
 * @returns {DiscountCalculation | null} 割引計算結果または null
 */
/** @type {() => DiscountCalculation | null} */
function calculateDiscount() {
  const discountCheckbox = document.getElementById('discount-checkbox');
  if (discountCheckbox && discountCheckbox.checked) {
    const discountAmount = 500; // 固定の¥500引き
    return {
      amount: discountAmount,
      item: {
        name: `${CONSTANTS.ITEMS.DISCOUNT}`,
        price: -discountAmount,
      },
    };
  }
  return null;
}

/**
 * 材料費を計算する
 * 立体材料の場合はサイズ(長さ×幅×高さ)から体積を計算し、単価を掛けて算出
 * その他の材料は固定単価で計算
 * @returns {{subtotal: number, items: AccountingItem[]}} 計算結果
 */
function calculateMaterials() {
  let subtotal = 0;
  /** @type {AccountingItem[]} */
  const items = [];

  const materialContainer = document.getElementById('materials-container');
  if (materialContainer) {
    const materialRows = materialContainer.querySelectorAll(
      'div[data-material-row-index]',
    );
    materialRows.forEach((_, index) => {
      const type = document.getElementById(`material-type-${index}`)?.value;
      const masterItem = stateManager
        .getState()
        .accountingMaster.find(
          m => m[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME] === type,
        );
      const priceEl = document.getElementById(`material-price-${index}`);

      if (!masterItem) {
        if (priceEl) priceEl.textContent = '0円';
        return;
      }

      const unitPrice = Number(
        masterItem[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE],
      );
      let finalName = type;
      let price = 0;

      if (masterItem['単位'] === CONSTANTS.UNITS.CM3) {
        const lInput =
          document.getElementById(`material-l-${index}`)?.value || '0';
        const wInput =
          document.getElementById(`material-w-${index}`)?.value || '0';
        const hInput =
          document.getElementById(`material-h-${index}`)?.value || '0';
        const l = parseFloat(lInput);
        const w = parseFloat(wInput);
        const h = parseFloat(hInput);
        if (l > 0 && w > 0 && h > 0) {
          const volumeCm = (l / 10) * (w / 10) * (h / 10);
          let calculatedPrice = Math.round((volumeCm * unitPrice) / 100) * 100;
          price = Math.max(100, calculatedPrice);
          finalName = `${type} (${l}x${w}x${h}mm)`;
        }
      } else {
        if (type) price = unitPrice;
      }

      if (priceEl) priceEl.textContent = `${price.toLocaleString()}円`;
      if (price > 0) {
        const itemDetail = { name: finalName, price: price };
        subtotal += price;
        items.push(itemDetail);
      }
    });
  }

  return { subtotal, items };
}

/**
 * その他販売品を計算する
 * 動的に追加された販売品項目の名前と価格から小計を算出
 * @returns {{subtotal: number, items: AccountingItem[]}} 計算結果
 */
function calculateOtherSales() {
  let subtotal = 0;
  /** @type {AccountingItem[]} */
  const items = [];

  const otherSalesContainer = document.getElementById('other-sales-container');
  if (otherSalesContainer) {
    const otherSalesRows = otherSalesContainer.querySelectorAll(
      'div[data-other-sales-row]',
    );
    otherSalesRows.forEach((_, index) => {
      const name = document
        .getElementById(`other-sales-name-${index}`)
        ?.value.trim();
      const priceInput = document.getElementById(`other-sales-price-${index}`);
      let priceValue = priceInput.value
        .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
        .replace(/[^0-9.-]/g, '');
      priceInput.value = priceValue;
      const price = Number(priceValue || 0);

      if (name && price !== 0) {
        const itemDetail = { name: name, price: price };
        subtotal += price;
        items.push(itemDetail);
      }
    });
  }

  return { subtotal, items };
}

/**
 * 会計フォームのUI要素を計算結果に基づいて更新する
 * 授業料・物販の小計、合計金額、内訳表示などを動的に更新
 * @param {AccountingCalculation} details - calculateAccountingDetailsFromForm()の計算結果
 */
function updateAccountingUI(details) {
  const tuitionBreakdownEl = document.getElementById('tuition-breakdown');
  const calculatedHoursEl = document.getElementById('calculated-hours');
  const tuitionSubtotalEl = document.getElementById('tuition-subtotal');
  const salesSubtotalEl = document.getElementById('sales-subtotal');
  const grandTotalEl = document.getElementById('grand-total-amount');

  // 時間制授業料の表示更新
  if (tuitionBreakdownEl) {
    const tuitionBreakdownHtml = details.tuition.items
      .map(
        item =>
          `<div class="flex justify-between${item.price < 0 ? ' text-red-600' : ''}"><span>${item.name}</span><span>${item.price.toLocaleString()}円</span></div>`,
      )
      .join('');
    tuitionBreakdownEl.innerHTML = tuitionBreakdownHtml;
  }

  // 受講時間表示の更新
  if (calculatedHoursEl && details) {
    const timeBasedItems = details.tuition.items.filter(item =>
      item.name.includes('授業料 ('),
    );
    if (timeBasedItems.length > 0) {
      const r = stateManager.getState().accountingReservation;
      const tuitionItemRule = getTuitionItemRule(
        stateManager.getState().accountingMaster,
        r.classroom,
        CONSTANTS.ITEMS.MAIN_LECTURE,
      );
      if (tuitionItemRule) {
        const unitPrice = Number(
          tuitionItemRule[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE],
        );
        const billableUnits = Math.ceil(timeBasedItems[0].price / unitPrice);
        calculatedHoursEl.textContent = `受講時間: ${billableUnits * 0.5}時間 × ${2.0 * unitPrice}円`;
      }
    } else {
      calculatedHoursEl.textContent = '';
    }
  }

  // 小計・合計の表示更新
  if (tuitionSubtotalEl)
    tuitionSubtotalEl.textContent = `小計: ${details.tuition.subtotal.toLocaleString()}円`;
  if (salesSubtotalEl)
    salesSubtotalEl.textContent = `小計: ${details.sales.subtotal.toLocaleString()}円`;
  if (grandTotalEl)
    grandTotalEl.textContent = `合計: ${details.grandTotal.toLocaleString()}円`;
}