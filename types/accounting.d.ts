/**
 * 会計システム統合リファクタリング用の型定義
 * 会計マスタデータの分類と計算結果の統一形式を定義
 */

// 会計マスタ項目の基本型
interface AccountingMasterItem {
  [key: string]: string | number;
}

// 会計マスタ項目の分類構造
interface ClassifiedAccountingItems {
  tuition: {
    baseItems: AccountingMasterItem[];      // 基本授業料
    additionalItems: AccountingMasterItem[]; // 追加料金
    discountItems: AccountingMasterItem[];   // 割引項目
  };
  sales: {
    materialItems: AccountingMasterItem[];   // 材料代
    productItems: AccountingMasterItem[];    // 物販
  };
}

// 自由入力物販用の型定義
interface CustomSalesItem {
  name: string;
  price: number;
}

// 会計フォームデータの型定義
interface AccountingFormData {
  startTime?: string;
  endTime?: string;
  breakTime?: number;
  checkedItems?: Record<string, boolean>;
  materials?: Array<{
    type: string;
    l?: number;
    w?: number;
    h?: number;
  }>;
  customSales?: CustomSalesItem[];
  paymentMethod?: typeof CONSTANTS.PAYMENT_DISPLAY.CASH | typeof CONSTANTS.PAYMENT_DISPLAY.BANK_TRANSFER | typeof CONSTANTS.PAYMENT_DISPLAY.COTRA;
}

// 計算結果の統一形式
interface AccountingCalculationResult {
  tuition: {
    items: Array<{name: string, price: number}>;
    subtotal: number;
  };
  sales: {
    items: Array<{name: string, price: number}>;
    subtotal: number;
  };
  grandTotal: number;
  paymentMethod: string;
}

// 統合予約シート更新用のペイロード
interface AccountingPayload {
  reservationId: string;
  classroom: string;
  studentId: string;
  userInput: any;
  updateStatus?: boolean;
}