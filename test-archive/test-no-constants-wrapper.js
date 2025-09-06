// @ts-check

/**
 * CONSTANTSラッパーなしアプローチのテスト
 * 直接的な定数オブジェクトのみを使用
 */

// =================================================================
// アプローチ: 直接的な定数オブジェクト（CONSTANTSラッパーなし）
// =================================================================

/** @type {{ TOKYO: string, NUMAZU: string, TSUKUBA: string }} */
const CLASSROOMS = {
  TOKYO: '東京教室',
  NUMAZU: '沼津教室',
  TSUKUBA: 'つくば教室',
};

/** @type {{ CONFIRMED: string, CANCELED: string, WAITLISTED: string, COMPLETED: string }} */
const STATUS = {
  CONFIRMED: '確定',
  CANCELED: '取消',
  WAITLISTED: '待機',
  COMPLETED: '完了',
};

/** @type {{ HISTORY_INITIAL_RECORDS: number, LOADING_MESSAGE_INTERVAL: number }} */
const UI = {
  HISTORY_INITIAL_RECORDS: 10,
  LOADING_MESSAGE_INTERVAL: 500,
};

/** @type {{ MAIN_LECTURE: string, FIRST_LECTURE: string, CHISEL_RENTAL: string }} */
const ITEMS = {
  MAIN_LECTURE: '基本授業料',
  FIRST_LECTURE: '初回授業料',
  CHISEL_RENTAL: '彫刻刀レンタル',
};

/** @type {{ CASH: string, CARD: string, TRANSFER: string }} */
const PAYMENT_METHODS = {
  CASH: 'cash',
  CARD: 'card',
  TRANSFER: 'transfer',
};

// CONSTANTSラッパーは存在しない！

// =================================================================
// 実際の使用例（シンプルで直感的）
// =================================================================

function makeReservation(classroom, status, paymentMethod) {
  // 非常にシンプル！
  if (classroom === CLASSROOMS.TOKYO && status === STATUS.CONFIRMED) {
    console.log(`東京教室の予約が${paymentMethod}で確定しました`);
  }

  // 異なる支払い方法の処理
  switch (paymentMethod) {
    case PAYMENT_METHODS.CASH:
      // 現金処理
      break;
    case PAYMENT_METHODS.CARD:
      // カード処理
      break;
    case PAYMENT_METHODS.TRANSFER:
      // 振込処理
      break;
  }
}

// =================================================================
// 型チェックテスト（エラーが検出されるべき）
// =================================================================

const error1 = CLASSROOMS.OSAKA; // ← 存在しない教室
const error2 = STATUS.INVALID_STATUS; // ← 存在しないステータス
const error3 = STATUS.CONFIMED; // ← CONFIRMEDのタイポ
const error4 = PAYMENT_METHODS.BITCOIN; // ← 存在しない支払い方法
const error5 = UI.NON_EXISTENT_SETTING; // ← 存在しない設定

// =================================================================
// 利点の評価
// =================================================================

// ✅ 簡潔性
const currentStatus = STATUS.CONFIRMED; // vs CONSTANTS.STATUS.CONFIRMED

// ✅ 可読性
if (status === STATUS.WAITLISTED) {
  // vs if (status === CONSTANTS.STATUS.WAITLISTED)
  // 処理
}

// ✅ 型安全性（変わらず）
const validPayment = PAYMENT_METHODS.CASH; // ← 型チェック有効
const invalidPayment = PAYMENT_METHODS.PAYPAL; // ← エラー検出

console.log('No CONSTANTS wrapper test completed');
