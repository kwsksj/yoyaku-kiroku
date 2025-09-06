// @ts-check

/**
 * ユーザー提案の2段階定数構造テスト
 * バック・フロント両方で同じ構造を静的に設定
 */

// =================================================================
// 【バックエンド想定】2段階定数構造
// =================================================================

// 1段階目: 個別定数オブジェクト
/** @type {{ CONFIRMED: string, CANCELED: string, WAITLISTED: string, COMPLETED: string }} */
const STATUS = {
  CONFIRMED: '確定',
  CANCELED: '取消',
  WAITLISTED: '待機',
  COMPLETED: '完了'
};

/** @type {{ TOKYO: string, NUMAZU: string, TSUKUBA: string }} */
const CLASSROOMS = {
  TOKYO: '東京教室',
  NUMAZU: '沼津教室',
  TSUKUBA: 'つくば教室'
};

/** @type {{ HISTORY_INITIAL_RECORDS: number, LOADING_MESSAGE_INTERVAL: number }} */
const UI = {
  HISTORY_INITIAL_RECORDS: 10,
  LOADING_MESSAGE_INTERVAL: 500
};

// 2段階目: CONSTANTS統合オブジェクト
const CONSTANTS = {
  STATUS: STATUS,
  CLASSROOMS: CLASSROOMS,
  UI: UI
};

// =================================================================
// エラーチェックテスト: 両方の参照方法で型チェックが機能するか？
// =================================================================

// ✅ 1段階参照（短縮形）
const valid1 = STATUS.CONFIRMED;        // 正常
const valid2 = CLASSROOMS.TOKYO;        // 正常
const valid3 = UI.HISTORY_INITIAL_RECORDS; // 正常

// ❌ 1段階参照エラー
const error1 = STATUS.INVALID;          // ← エラー検出されるべき
const error2 = STATUS.CONFIMED;         // ← CONFIRMED の typo、エラー検出されるべき
const error3 = CLASSROOMS.OSAKA;        // ← 存在しない、エラー検出されるべき

// ✅ 2段階参照（完全形）  
const valid4 = CONSTANTS.STATUS.CONFIRMED;     // 正常
const valid5 = CONSTANTS.CLASSROOMS.TOKYO;     // 正常
const valid6 = CONSTANTS.UI.LOADING_MESSAGE_INTERVAL; // 正常

// ❌ 2段階参照エラー
const error4 = CONSTANTS.STATUS.INVALID;       // ← エラー検出されるべき
const error5 = CONSTANTS.STATUS.CONFIMED;      // ← CONFIRMED の typo、エラー検出されるべき
const error6 = CONSTANTS.CLASSROOMS.OSAKA;     // ← 存在しない、エラー検出されるべき
const error7 = CONSTANTS.NON_EXISTENT_CATEGORY; // ← カテゴリ自体が存在しない、エラー検出されるべき

// =================================================================
// 実際の使用例
// =================================================================

function checkReservationStatus(status, classroom) {
  // 1段階参照での使用
  if (status === STATUS.CONFIRMED && classroom === CLASSROOMS.TOKYO) {
    console.log('東京教室の予約が確定しました');
  }
  
  // 2段階参照での使用
  if (status === CONSTANTS.STATUS.WAITLISTED) {
    console.log('キャンセル待ちです');
  }
  
  // AIがミスしがちなパターン
  if (status === STATUS.CONFIMED) { // ← このタイポをAIが書いたらエラー検出される
    console.log('これはエラーになるはず');
  }
}

// =================================================================
// パフォーマンス評価: WebApp負荷は？
// =================================================================

// 静的定義なので実行時のオーバーヘッドは minimal
// メモリ使用量: 同じデータを2回参照するだけなので許容範囲
// 保守性: 定数変更時は2箇所（バック・フロント）で同じ変更が必要

console.log('User proposed 2-level constant structure test completed');