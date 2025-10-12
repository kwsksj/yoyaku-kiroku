/**
 * =================================================================
 * 【ファイル名】: types/core/accounting-core.d.ts
 * 【役割】: 会計データの統一Core型定義
 * 【バージョン】: 1.0
 * =================================================================
 */

/**
 * 会計詳細（計算結果）の統一コア型
 *
 * 授業料・物販の計算結果を格納
 * ReservationCore.accountingDetailsで使用
 *
 * @example
 * ```typescript
 * const details: AccountingDetailsCore = {
 *   tuition: {
 *     items: [{ name: '3時間コース', price: 6000 }],
 *     subtotal: 6000,
 *   },
 *   sales: {
 *     items: [{ name: 'ひのき材', price: 500 }],
 *     subtotal: 500,
 *   },
 *   grandTotal: 6500,
 *   paymentMethod: 'cash',
 * };
 * ```
 */
interface AccountingDetailsCore {
  /** 授業料 */
  tuition: {
    /** 授業料項目のリスト */
    items: Array<{
      /** 項目名 */
      name: string;
      /** 金額 */
      price: number;
    }>;
    /** 授業料小計 */
    subtotal: number;
  };

  /** 物販・材料費 */
  sales: {
    /** 物販項目のリスト */
    items: Array<{
      /** 項目名 */
      name: string;
      /** 金額 */
      price: number;
    }>;
    /** 物販小計 */
    subtotal: number;
  };

  /** 合計金額 */
  grandTotal: number;

  /** 支払い方法（CONSTANTS.PAYMENT_METHODSの値: cash/card/transfer） */
  paymentMethod: string;
}

/**
 * 会計マスターアイテムの統一コア型
 *
 * 会計マスタシートの1行を表現
 * 実際のシート構造に対応（日本語プロパティ）
 *
 * @example
 * ```typescript
 * const item: AccountingMasterItemCore = {
 *   種別: '授業料',
 *   項目名: '3時間コース',
 *   対象教室: '東京教室',
 *   単価: 6000,
 *   単位: '回',
 *   備考: '基本料金',
 * };
 * ```
 */
interface AccountingMasterItemCore {
  /** 種別（授業料/材料代/物販） */
  種別: string;

  /** 項目名 */
  項目名: string;

  /** 対象教室 */
  対象教室: string;

  /** 単価 */
  単価: number;

  /** 単位（回/個/cm³等） */
  単位: string;

  /** 備考 */
  備考?: string | undefined;
}

/**
 * 会計マスター分類構造
 *
 * 会計マスターを用途別に分類したデータ構造
 */
interface ClassifiedAccountingItemsCore {
  /** 授業料 */
  tuition: {
    /** 基本授業料項目 */
    baseItems: AccountingMasterItemCore[];
    /** 追加料金項目（割引を含む） */
    additionalItems: AccountingMasterItemCore[];
  };

  /** 物販・材料費 */
  sales: {
    /** 材料代項目 */
    materialItems: AccountingMasterItemCore[];
    /** 物販項目 */
    productItems: AccountingMasterItemCore[];
  };
}
