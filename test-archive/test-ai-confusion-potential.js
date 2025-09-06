// @ts-check

/**
 * AIが混乱しやすいケースのテスト
 * CONSTANTSありvsなしでの可読性比較
 */

// =================================================================
// パターンA: CONSTANTSあり（明示的）
// =================================================================

const CONSTANTS = {
  STATUS: {
    CONFIRMED: '確定',
    CANCELED: '取消',
  },
  CLASSROOMS: {
    TOKYO: '東京教室',
    NUMAZU: '沼津教室',
  },
};

// =================================================================
// パターンB: CONSTANTSなし（暗黙的）
// =================================================================

const STATUS = {
  CONFIRMED: '確定',
  CANCELED: '取消',
};

const CLASSROOMS = {
  TOKYO: '東京教室',
  NUMAZU: '沼津教室',
};

// =================================================================
// AIが混乱しやすいシナリオ
// =================================================================

function processReservation(reservationData) {
  // このコードを読むAIは何を理解する？

  // ケース1: 変数名が似ている場合
  const status = reservationData.status; // ← 小文字の変数
  const classroom = reservationData.classroom; // ← 小文字の変数

  // パターンA使用（明示的）
  if (status === CONSTANTS.STATUS.CONFIRMED) {
    // ← AIには「CONSTANTS.STATUS は定数の集合」と明確
    console.log('予約確定');
  }

  // パターンB使用（暗黙的）
  if (status === STATUS.CONFIRMED) {
    // ← AIは「STATUS とは何？定数？変数？」と推測が必要
    console.log('予約確定');
  }

  // ケース2: 動的な値との比較
  const userSelectedStatus = getUserInput(); // 動的な値

  // どちらが「定数との比較」だと明確？
  if (userSelectedStatus === CONSTANTS.STATUS.CONFIRMED) {
    // 明示的
    // ...
  }

  if (userSelectedStatus === STATUS.CONFIRMED) {
    // 暗黙的
    // ...
  }
}

// =================================================================
// 新機能追加時のAI支援例
// =================================================================

// AIに「予約ステータスチェック関数を作って」と頼んだ場合：

// パターンA: AIが書きそうなコード
function checkReservationStatusA(status) {
  // CONSTANTSがあることで「ここは定数を使う場所」と理解しやすい
  if (status === CONSTANTS.STATUS.CONFIRMED) {
    return 'confirmed';
  } else if (status === CONSTANTS.STATUS.CANCELED) {
    return 'canceled';
  }
  return 'unknown';
}

// パターンB: AIが書きそうなコード
function checkReservationStatusB(status) {
  // STATUSが定数だと気づかず、こんなコードを書く可能性も
  if (status === 'confirmed' || status === STATUS.CONFIRMED) {
    // ← 混在してしまう
    return 'confirmed';
  }
  return 'unknown';
}

// =================================================================
// 結論：どちらがAIフレンドリー？
// =================================================================

/*
【CONSTANTSあり】
+ 文脈が明確
+ 新しいAIでも理解しやすい
+ コード生成時の一貫性が高い
- 少し冗長

【CONSTANTSなし】  
+ 簡潔
+ 人間には分かりやすい
- AIが文脈推測する必要
- 混同の可能性
*/

console.log('AI confusion potential test completed');
