# 会計画面の生成仕組み・構造資料

## 概要

木彫り教室予約管理システム「きぼりの よやく・きろく」の会計画面について、その生成仕組み、コンポーネント構造、データフローを詳細にまとめた資料です。

## システム全体の構成

### ファイル構成と役割

| ファイル                  | 役割             | 会計画面との関係                           |
| ------------------------- | ---------------- | ------------------------------------------ |
| `13_WebApp_Views.js`      | ビュー生成       | `getAccountingView()` で会計画面全体を構築 |
| `13_WebApp_Components.js` | UIコンポーネント | 会計専用コンポーネント群を提供             |
| `14_WebApp_Handlers.js`   | イベント処理     | 会計関連のユーザーアクション処理           |
| `12_WebApp_Core.js`       | 計算ロジック     | 料金計算、UI更新の核となる処理             |

## 会計画面の生成フロー

### 1. 画面遷移の起点

```javascript
// 14_WebApp_Handlers.js:952
goToAccounting: d => {
  showLoading('accounting');
  const reservationId = d.reservationId;

  // 統一検索関数で予約データを取得
  const reservationData = findReservationById(reservationId);

  if (reservationData) {
    // キャッシュからデータを読み込み
    const cachedData = loadAccountingCache(reservationId);

    // スケジュール情報を取得後にビューを表示
    getScheduleInfoFromCache(reservationData.date, reservationData.classroom).then(scheduleInfo => {
      window.stateManager.dispatch({
        type: 'SET_STATE',
        payload: {
          view: 'accounting',
          accountingReservation: d,
          accountingReservationDetails: reservationDetails,
          accountingScheduleInfo: scheduleInfo,
        },
      });
    });
  }
};
```

### 2. ビュー生成処理

```javascript
// 13_WebApp_Views.js:2032
const getAccountingView = () => {
  const state = stateManager.getState();

  // 基本データの確認
  if (!state.accountingMaster || !state.accountingReservation) {
    return '<div>会計データを読み込んでいます...</div>';
  }

  // 会計済みかどうかの判定
  if (bookingOrRecord.status === CONSTANTS.STATUS.COMPLETED && bookingOrRecord.accountingDetails && !state.isEditingAccountingRecord) {
    // 会計完了済み表示
    return Components.accountingCompleted({ details, reservation });
  }

  // 新規会計フォーム表示
  const tuitionItemRule = getTuitionItemRule(master, reservation.classroom, CONSTANTS.ITEMS.MAIN_LECTURE);
  const isTimeBased = tuitionItemRule && tuitionItemRule['単位'] === CONSTANTS.UNITS.THIRTY_MIN;
  const formType = isTimeBased ? 'timeBased' : 'fixed';

  return Components.accountingForm({
    type: formType,
    master,
    reservation,
    reservationDetails,
    scheduleInfo,
  });
};
```

## コンポーネント構造

### 階層構造

```
会計画面 (getAccountingView)
├── ナビゲーションヘッダー (Components.navigationHeader)
├── 会計フォーム (Components.accountingForm)
│   ├── 授業料セクション
│   │   ├── 時間制授業料 (Components.timeBasedTuition) - 時間制教室
│   │   └── 固定制授業料 (Components.fixedTuitionSection) - 固定制教室
│   └── 販売セクション (Components.salesSection)
│       ├── 材料費入力 (Components.materialRow)
│       └── その他販売品 (Components.otherSalesRow)
└── アクションボタン (Components.button)
```

### 主要コンポーネントの詳細

#### 1. 会計フォーム (`Components.accountingForm`)

```javascript
// 13_WebApp_Components.js:546
accountingForm: ({ type, master, reservation, reservationDetails, scheduleInfo }) => {
  // 授業料セクション生成
  let tuitionHtml;
  if (type === 'timeBased') {
    tuitionHtml = Components.timeBasedTuition({ tuitionItemRule, reservationDetails, scheduleInfo });
  } else {
    tuitionHtml = Components.fixedTuitionSection({ master, reservation, reservationDetails });
  }

  // 販売セクション生成
  const salesHtml = Components.salesSection({ master, reservationDetails });

  // フォーム全体の構築
  return `
    <form id="accounting-form" class="space-y-6">
      ${tuitionHtml}
      ${salesHtml}
      <div class="text-right text-2xl font-bold">
        <span id="grand-total-amount">合計: 0円</span>
      </div>
    </form>
  `;
};
```

#### 2. 材料費入力 (`Components.materialRow`)

```javascript
// 13_WebApp_Components.js:441
materialRow: ({ index, values = {} }) => {
  // マスターデータから材料オプションを動的生成
  const master = window.stateManager?.getState?.()?.accountingMaster;
  const materialOptions = master
    .filter(m => m['種別'] === CONSTANTS.ITEM_TYPES.MATERIAL)
    .map(m => `<option value="${m[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME]}">${m[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME]}</option>`)
    .join('');

  return `
    <div data-material-row-index="${index}">
      <select id="material-type-${index}" class="accounting-item">
        ${materialOptions}
      </select>
      <div class="grid grid-cols-4 gap-2">
        <input type="number" id="material-l-${index}" placeholder="縦(mm)">
        <input type="number" id="material-w-${index}" placeholder="横(mm)">
        <input type="number" id="material-h-${index}" placeholder="厚(mm)">
        <div id="material-price-${index}">0円</div>
      </div>
    </div>
  `;
};
```

## 料金計算システム

### 計算処理の流れ

```javascript
// 12_WebApp_Core.js:1018
function calculateAccountingDetails() {
  const details = calculateAccountingDetailsFromForm();
  updateAccountingUI(details);
  return details;
}
```

### 計算ロジックの詳細

#### 1. 時間制授業料計算

```javascript
// 12_WebApp_Core.js:1107
function calculateTimeBasedTuition(tuitionItemRule) {
  const startTime = getTimeValue('start-time', accountingReservation, 'startTime');
  const endTime = getTimeValue('end-time', accountingReservation, 'endTime');
  const breakMinutes = parseInt(document.getElementById('break-time')?.value || 0, 10);

  // 実授業時間を30分単位で計算
  const actualMinutes = calculateActualLectureMinutes(startTime, endTime, breakMinutes);
  const units = Math.ceil(actualMinutes / 30);
  const unitPrice = tuitionItemRule[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE];

  return {
    price: units * unitPrice,
    item: { name: `${CONSTANTS.ITEMS.MAIN_LECTURE} (${units}コマ)`, price: units * unitPrice },
  };
}
```

#### 2. 材料費計算

```javascript
// 材料費は寸法（縦×横×厚）から体積を算出し、材料単価と掛け合わせて計算
function calculateMaterials() {
  const materialContainer = document.getElementById('materials-container');
  const items = [];
  let subtotal = 0;

  materialContainer.querySelectorAll('div[data-material-row-index]').forEach((row, index) => {
    const type = document.getElementById(`material-type-${index}`)?.value;
    const l = parseFloat(document.getElementById(`material-l-${index}`)?.value || 0);
    const w = parseFloat(document.getElementById(`material-w-${index}`)?.value || 0);
    const h = parseFloat(document.getElementById(`material-h-${index}`)?.value || 0);

    if (type && l > 0 && w > 0 && h > 0) {
      const volume = (l * w * h) / 1000; // cm³に変換
      const unitPrice = getMaterialUnitPrice(type);
      const price = Math.ceil((volume * unitPrice) / 10) * 10; // 10円単位で切り上げ

      items.push({ name: `${type} ${l}×${w}×${h}mm`, price });
      subtotal += price;
    }
  });

  return { items, subtotal };
}
```

## イベント処理システム

### イベントリスナーの設定

```javascript
// 14_WebApp_Handlers.js:1956 (render関数内)
if (appState.view === 'accounting') {
  requestAnimationFrame(() => {
    setupAccountingEventListeners();
    updateAccountingCalculation();
  });
}
```

```javascript
// 12_WebApp_Core.js:1170
function setupAccountingEventListeners() {
  // 時刻選択要素にchangeイベントを追加
  ['start-time', 'end-time', 'break-time'].forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('change', updateAccountingCalculation);
    }
  });

  // チェックボックス項目にchangeイベントを追加
  document.querySelectorAll('input[type="checkbox"].accounting-item').forEach(checkbox => {
    checkbox.addEventListener('change', updateAccountingCalculation);
  });
}
```

### フォーム変更時の処理

```javascript
// 14_WebApp_Handlers.js:1969
function handleAccountingFormChange() {
  // リアルタイムで合計金額を再計算
  calculateAccountingDetails();

  // フォーム内容をキャッシュに保存
  const reservationId = stateManager.getState().accountingReservation?.reservationId;
  if (reservationId) {
    const accountingData = getAccountingFormData();
    saveAccountingCache(reservationId, accountingData);
  }
}
```

## データフロー

### 1. 初期データの流れ

```
ユーザーアクション (会計ボタンクリック)
↓
goToAccounting (14_WebApp_Handlers.js)
↓
findReservationById (予約データ検索)
↓
loadAccountingCache (キャッシュからフォームデータ読み込み)
↓
getScheduleInfoFromCache (スケジュール情報取得)
↓
stateManager.dispatch (状態更新)
↓
render() → getAccountingView() (画面描画)
```

### 2. 計算処理の流れ

```
フォーム入力変更
↓
handleAccountingFormChange (14_WebApp_Handlers.js)
↓
calculateAccountingDetails (12_WebApp_Core.js)
├── calculateTimeBasedTuition (時間制授業料)
├── calculateCheckboxItems (チェックボックス項目)
├── calculateMaterials (材料費)
├── calculateOtherSales (その他販売品)
└── calculateDiscount (割引)
↓
updateAccountingUI (UI要素の更新)
↓
saveAccountingCache (キャッシュ保存)
```

### 3. 支払い確定の流れ

```
「先生の確認が完了しました」ボタン
↓
showAccountingConfirmation (14_WebApp_Handlers.js)
↓
支払い方法選択モーダル表示
↓
「この内容で支払いました」ボタン
↓
confirmAndPay (14_WebApp_Handlers.js)
↓
saveAccountingDetailsAndGetLatestData (バックエンド送信)
↓
clearAccountingCache (キャッシュクリア)
↓
完了画面遷移
```

## 状態管理

### StateManager での管理項目

```javascript
// 会計画面で使用される状態
const accountingState = {
  view: 'accounting',
  accountingMaster: [], // 会計マスタデータ
  accountingReservation: {}, // 対象予約情報
  accountingReservationDetails: {}, // 予約固有詳細（キャッシュ含む）
  accountingScheduleInfo: {}, // 講座固有情報
  isEditingAccountingRecord: false, // 会計記録編集モードかどうか
};
```

### キャッシュシステム

```javascript
// キャッシュの保存・読み込み・削除
function saveAccountingCache(reservationId, data) {
  localStorage.setItem(`accounting_${reservationId}`, JSON.stringify(data));
}

function loadAccountingCache(reservationId) {
  const cached = localStorage.getItem(`accounting_${reservationId}`);
  return cached ? JSON.parse(cached) : {};
}

function clearAccountingCache(reservationId) {
  localStorage.removeItem(`accounting_${reservationId}`);
}
```

## 特徴的な設計パターン

### 1. 教室タイプによる動的フォーム生成

- **時間制教室**: 開始時間・終了時間・休憩時間から料金を動的計算
- **固定制教室**: 固定料金項目をチェックボックスで選択

### 2. リアルタイム計算システム

- フォーム項目の変更時に即座に合計金額を再計算
- 材料の寸法入力に応じて価格をリアルタイム表示

### 3. キャッシュによる入力内容保持

- ページ遷移しても入力内容を保持
- 支払い完了時にキャッシュをクリア

### 4. コンポーネントベース設計

- 再利用可能なUIコンポーネント
- 状態と表示の分離
- 単一責任の原則に基づく関数設計

## まとめ

会計画面は以下の特徴を持つ複雑なシステムです：

1. **多層アーキテクチャ**: ビュー層・コンポーネント層・計算層・データ層の明確な分離
2. **動的UI生成**: 教室タイプや予約内容に応じた適応的なフォーム構築
3. **リアルタイム処理**: ユーザー入力に即応する計算・表示更新システム
4. **堅牢なデータ管理**: キャッシュとStateManagerによる状態の永続化
5. **拡張性**: 新しい料金体系や項目の追加に対応可能な設計

これらの仕組みにより、複雑な料金計算を直感的かつ正確に行える会計システムを実現しています。
