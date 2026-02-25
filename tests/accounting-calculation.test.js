import { beforeAll, describe, expect, it } from 'vitest';
import { CONSTANTS as sharedConstants } from '../src/shared/00_Constants.js';

const accountingHeaders = sharedConstants.HEADERS.ACCOUNTING;

/**
 * @param {unknown} value
 * @returns {any}
 */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * @param {{
 *   type: string;
 *   itemName: string;
 *   unitPrice: number;
 *   unit?: string;
 *   targetClassroom?: string;
 * }} params
 */
function createMasterItem(params) {
  return {
    [accountingHeaders.TYPE]: params.type,
    [accountingHeaders.ITEM_NAME]: params.itemName,
    [accountingHeaders.UNIT_PRICE]: params.unitPrice,
    [accountingHeaders.UNIT]: params.unit ?? '回',
    [accountingHeaders.TARGET_CLASSROOM]: params.targetClassroom ?? '共通',
  };
}

/**
 * @type {{
 *   classifyAccountingItems: Function;
 *   calculateTimeUnits: Function;
 *   calculateSalesSubtotal: Function;
 *   calculateAccountingTotal: Function;
 * }}
 */
let accountingModule;

beforeAll(async () => {
  const testConstants = clone(sharedConstants);
  testConstants.ENVIRONMENT.PRODUCTION_MODE = true;

  globalThis.CONSTANTS = testConstants;
  globalThis.debugLog = () => {};

  accountingModule =
    await import('../src/frontend/12-1_Accounting_Calculation.js');
});

describe('12-1_Accounting_Calculation.js', () => {
  it('calculateTimeUnits: 30分単位を正しく計算する', () => {
    expect(accountingModule.calculateTimeUnits('10:00', '12:00', 30)).toBe(3);
    expect(accountingModule.calculateTimeUnits('10:00', '10:10', 30)).toBe(0);
    expect(accountingModule.calculateTimeUnits('', '12:00', 0)).toBe(0);
  });

  it('classifyAccountingItems: 項目を教室と種別で分類する', () => {
    const masterData = [
      createMasterItem({
        type: '授業料',
        itemName: sharedConstants.ITEMS.MAIN_LECTURE_TIME,
        unitPrice: 1000,
        unit: '30分',
        targetClassroom: sharedConstants.CLASSROOMS.TOKYO,
      }),
      createMasterItem({
        type: '割引',
        itemName: sharedConstants.ITEMS.DISCOUNT,
        unitPrice: -500,
        targetClassroom: '共通',
      }),
      createMasterItem({
        type: '材料',
        itemName: 'ヒノキ',
        unitPrice: 200,
        unit: 'cm³',
        targetClassroom: '共通',
      }),
      createMasterItem({
        type: '物販',
        itemName: '彫刻刀セット',
        unitPrice: 3000,
        unit: '個',
        targetClassroom: sharedConstants.CLASSROOMS.NUMAZU,
      }),
    ];

    const classified = accountingModule.classifyAccountingItems(
      masterData,
      sharedConstants.CLASSROOMS.TOKYO,
    );

    expect(classified.tuition.baseItems).toHaveLength(1);
    expect(classified.tuition.additionalItems).toHaveLength(1);
    expect(classified.sales.materialItems).toHaveLength(1);
    expect(classified.sales.productItems).toHaveLength(0);
  });

  it('calculateSalesSubtotal: 材料・物販・自由入力物販の合計を計算する', () => {
    const classifiedItems = accountingModule.classifyAccountingItems(
      [
        createMasterItem({
          type: '材料',
          itemName: 'ヒノキ',
          unitPrice: 200,
          unit: 'cm³',
        }),
        createMasterItem({
          type: '材料',
          itemName: '杉',
          unitPrice: 10,
          unit: 'cm³',
        }),
      ],
      sharedConstants.CLASSROOMS.TOKYO,
    );

    const { items, subtotal } = accountingModule.calculateSalesSubtotal(
      {
        materials: [
          { type: 'ヒノキ', l: 20, w: 10, h: 10 },
          { type: '杉', l: 10, w: 10, h: 10 },
        ],
        selectedProducts: [{ name: '木工用ボンド', price: 500 }],
        customSales: [{ name: '追加販売', price: 300 }],
      },
      classifiedItems,
    );

    expect(subtotal).toBe(1300);
    expect(items).toHaveLength(4);
    expect(items[0].price).toBe(400);
    expect(items[1].price).toBe(100);
  });

  it('calculateAccountingTotal: 時間制授業料を動的項目へ変換して合計する', () => {
    const formData = {
      startTime: '10:00',
      endTime: '11:30',
      breakTime: 0,
      checkedItems: {
        [sharedConstants.ITEMS.MAIN_LECTURE_TIME]: true,
      },
    };

    const result = accountingModule.calculateAccountingTotal(
      formData,
      [
        createMasterItem({
          type: '授業料',
          itemName: sharedConstants.ITEMS.MAIN_LECTURE_TIME,
          unitPrice: 1000,
          unit: '30分',
          targetClassroom: sharedConstants.CLASSROOMS.TOKYO,
        }),
      ],
      sharedConstants.CLASSROOMS.TOKYO,
    );

    expect(result.tuition.subtotal).toBe(3000);
    expect(result.sales.subtotal).toBe(0);
    expect(result.grandTotal).toBe(3000);
    expect(result.paymentMethod).toBe(sharedConstants.PAYMENT_DISPLAY.CASH);
    expect(result.tuition.items).toContainEqual({
      name: sharedConstants.ITEMS.MAIN_LECTURE_TIME,
      price: 3000,
      unitPrice: 2000,
      quantity: 1.5,
      unit: '時間',
    });
    expect(formData.checkedItems[sharedConstants.ITEMS.MAIN_LECTURE_TIME]).toBe(
      undefined,
    );
  });
});
