/// <reference path="../../types/frontend-index.d.ts" />
/**
 * 会計システム - 計算ロジック層
 *
 * 責務:
 * - 会計マスタデータの分類
 * - 時間単位の計算
 * - 授業料・販売の小計計算
 * - 統合計算処理
 */

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

            // 0時間の場合でも動的項目を作成（元の基本授業料のチェックを削除するため）
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
        } else if (unit === '回') {
          // 回数制の場合：マスターデータに既に項目があるのでdynamicItemは作成不要
          // checkedItemsの状態を維持するのみ
          if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
            console.log('🔍 回数制基本授業料: dynamicItem作成スキップ（マスターデータに既存）');
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
