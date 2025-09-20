# 会計システム統合リファクタリング計画

## 📊 現状分析

### 問題点

1. **過度なファイル分割**: 3ファイル（1,400行）に機能が分散
   - `12_WebApp_Core_Accounting.js` (655行)
   - `13_WebApp_Views_Accounting.js` (237行)
   - `14_WebApp_Handlers_Accounting.js` (511行)

2. **重複する計算ロジック**: フロントエンドとバックエンドで同じ計算を実行
3. **複雑な条件分岐**: 時間制・回数制の画面切り替えロジック
4. **責務の曖昧さ**: 計算・表示・制御が混在

### 会計マスタの実際の構造

```
種別    項目名                      単価    単位    対象教室      備考
授業料  授業料（回数制）            6600    回      東京教室
授業料  授業料（時間制）            600     30分    つくば教室
授業料  授業料（時間制）            600     30分    沼津教室
授業料  初回参加費                  800     回      東京教室
授業料  初回者同時割引              -500    回      全教室       初回参加者と同時刻参加で割引
授業料  彫刻刀レンタル              500     回      共通
物販    ハイス鋼 彫刻刀 5本set      17000   個      共通
物販    テキスト                    1650    個      共通
物販    作業台（最新版）            3500    個      共通
材料    材料代 ¥100（固定）         100     個      共通         計算不要の材料
材料    材料代 ¥200（固定）         200     個      共通         計算不要の材料
材料    バスウッド・シナ            2       cm³     共通
材料    ジェルトン                  2       cm³     共通
```

## 🎯 改善目標

### 統一コンセプト

**「2大項目小計システム with 適切な関数分割」**

1. **授業料小計**（授業料・初回参加費・彫刻刀レンタル・授業料割引）
2. **販売小計**（材料代・物販）
3. **総合計**（授業料小計 + 販売小計）

### 技術的目標

- **ファイル統合**: 3ファイル → 1ファイル（約600行、60%削減）
- **関数の適切な分割**: 5つの細分化 → 3つの主要関数
- **責務の明確化**: 計算・表示・制御の分離

## 🏗️ 設計案

### データ構造

```javascript
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

// 会計マスタ項目の分類
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
```

### 新ファイル構成

```
src/frontend/
└── 12_WebApp_Accounting.js  (統合ファイル)
    ├── 【計算ロジック層】
    │   ├── classifyAccountingItems()       // マスタデータ分類
    │   ├── calculateTuitionSubtotal()      // 授業料小計
    │   ├── calculateSalesSubtotal()        // 販売小計
    │   ├── calculateAccountingTotal()      // 総合計算
    │   └── calculateTimeUnits()            // 時間計算ヘルパー
    │
    ├── 【UI生成層】（Components.js活用）
    │   ├── generateAccountingView()        // メイン画面生成（Components.input, checkbox等活用）
    │   ├── generateTuitionSection()        // 授業料セクション（Components.checkbox, select活用）
    │   ├── generateSalesSection()          // 販売セクション（Components.select, button活用）
    │   ├── generateMaterialRow()           // 材料行生成（Components.input, select活用）
    │   ├── generateTimeOptions()           // 時刻選択肢生成（Components.select活用）
    │   ├── generateCustomSalesRow()        // 自由入力物販行生成（Components.input, button活用）
    │   ├── getPaymentOptionsHtml()         // 支払い方法選択UI（既存関数移設）
    │   └── getPaymentInfoHtml()            // 支払い情報表示UI（既存関数移設）
    │
    ├── 【イベント処理層】
    │   ├── setupAccountingEventListeners() // イベント登録
    │   ├── handleAccountingInputChange()   // 入力変更処理
    │   ├── handleMaterialTypeChange()      // 材料選択変更
    │   ├── handlePaymentMethodChange()     // 支払い方法変更処理
    │   ├── initializePaymentMethodUI()     // 支払い方法UI初期化
    │   ├── updateAccountingCalculation()   // 計算更新
    │   └── updateUI()                      // UI更新
    │
    └── 【ユーティリティ層】
        ├── collectFormData()               // フォームデータ収集
        ├── saveAccountingCache()           // キャッシュ保存
        ├── loadAccountingCache()           // キャッシュ読込
        └── addMaterialRow()                // 材料行追加
```

### 核心計算ロジック

```javascript
// 1. マスタデータの分類
function classifyAccountingItems(masterData, classroom) {
  const result = {
    tuition: { baseItems: [], additionalItems: [], discountItems: [] },
    sales: { materialItems: [], productItems: [] },
  };

  masterData.forEach(item => {
    const type = item[CONSTANTS.HEADERS.ACCOUNTING.TYPE];
    const price = Number(item[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE]);
    const targetClassroom = item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM];

    // 教室対象チェック
    if (targetClassroom !== '共通' && !targetClassroom.includes(classroom)) return;

    if (type === '授業料') {
      if (price < 0) {
        result.tuition.discountItems.push(item);
      } else if (item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME].includes('授業料')) {
        result.tuition.baseItems.push(item);
      } else {
        result.tuition.additionalItems.push(item);
      }
    } else if (type === '材料') {
      result.sales.materialItems.push(item);
    } else if (type === '物販') {
      result.sales.productItems.push(item);
    }
  });

  return result;
}

// 2. 授業料小計計算
function calculateTuitionSubtotal(formData, classifiedItems, classroom) {
  let subtotal = 0;
  const items = [];

  // 基本授業料計算（時間制 vs 回数制）
  const baseItem = classifiedItems.tuition.baseItems.find(item => {
    const targetClassroom = item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM];
    return targetClassroom === classroom || targetClassroom.includes(classroom);
  });

  if (baseItem) {
    const unit = baseItem[CONSTANTS.HEADERS.ACCOUNTING.UNIT];
    const unitPrice = Number(baseItem[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE]);

    if (unit === '30分') {
      // 時間制計算
      const timeUnits = calculateTimeUnits(formData.startTime, formData.endTime, formData.breakTime);
      const price = timeUnits * unitPrice;
      items.push({
        name: `授業料 (${formData.startTime} - ${formData.endTime})`,
        price: price,
      });
      subtotal += price;
    } else if (unit === '回') {
      // 回数制計算
      items.push({
        name: baseItem[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME],
        price: unitPrice,
      });
      subtotal += unitPrice;
    }
  }

  // 追加項目（チェックボックス選択）
  classifiedItems.tuition.additionalItems.forEach(item => {
    const itemName = item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME];
    if (formData.checkedItems?.[itemName]) {
      const price = Number(item[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE]);
      items.push({ name: itemName, price: price });
      subtotal += price;
    }
  });

  // 割引項目（チェックボックス選択）
  classifiedItems.tuition.discountItems.forEach(item => {
    const itemName = item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME];
    if (formData.checkedItems?.[itemName]) {
      const price = Number(item[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE]); // 負の値
      items.push({ name: itemName, price: price });
      subtotal += price; // 負の値なので実質的に減算
    }
  });

  return { items, subtotal };
}

// 3. 販売小計計算
function calculateSalesSubtotal(formData, classifiedItems) {
  let subtotal = 0;
  const items = [];

  // 材料費計算
  if (formData.materials) {
    formData.materials.forEach(material => {
      const masterItem = classifiedItems.sales.materialItems.find(item => item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME] === material.type);

      if (masterItem) {
        const unit = masterItem[CONSTANTS.HEADERS.ACCOUNTING.UNIT];
        const unitPrice = Number(masterItem[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE]);

        let price = 0;
        let itemName = material.type;

        if (unit === 'cm³') {
          // 体積計算（mm → cm変換）
          const volume = (material.l / 10) * (material.w / 10) * (material.h / 10);
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

  // 物販（チェックボックス選択）
  classifiedItems.sales.productItems.forEach(item => {
    const itemName = item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME];
    if (formData.checkedItems?.[itemName]) {
      const price = Number(item[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE]);
      items.push({ name: itemName, price: price });
      subtotal += price;
    }
  });

  return { items, subtotal };
}

// 4. 統合計算
function calculateAccountingTotal(formData, masterData, classroom) {
  const classifiedItems = classifyAccountingItems(masterData, classroom);
  const tuition = calculateTuitionSubtotal(formData, classifiedItems, classroom);
  const sales = calculateSalesSubtotal(formData, classifiedItems);

  return {
    tuition,
    sales,
    grandTotal: tuition.subtotal + sales.subtotal,
    paymentMethod: formData.paymentMethod || '現金',
  };
}
```

### UI設計

**重要**: 以下のHTMLサンプルの具体的な値段・商品名・時刻は例示用です。実際の実装では、すべて**会計マスタデータから動的に生成**されます。

```html
<!-- 統一された会計画面レイアウト（会計マスタデータから動的生成） -->
<div class="accounting-container">
  <!-- 授業料セクション -->
  <section class="tuition-section">
    <h3>■ 授業料</h3>

    <!-- 基本授業料（会計マスタの基本授業料項目から生成） -->
    <div class="base-tuition">
      <input type="checkbox" checked disabled /> 授業料

      <!-- 時間制教室のみ表示（教室判定により表示制御） -->
      <div class="time-controls" data-show-if="time-based">
        開始時刻
        <select id="start-time">
          <!-- generateTimeOptions()で動的生成 -->
          <!-- 例: 09:00-17:00 (30分刻み) -->
        </select>
        終了時刻
        <select id="end-time">
          <!-- generateTimeOptions()で動的生成 -->
          <!-- 例: 09:00-17:00 (30分刻み) -->
        </select>
        休憩時間
        <select id="break-time">
          <!-- 例: 0分/30分/60分 -->
        </select>
        <span class="calculated-amount">
          <!-- calculateTimeUnits()の結果を表示 -->
          <!-- 例: 計算結果: 2.5時間 × ¥{会計マスタの単価} = ¥{計算結果} -->
        </span>
      </div>
    </div>

    <!-- 追加項目（会計マスタの授業料・追加項目から動的生成） -->
    <div class="additional-tuition">
      <!-- classifiedItems.tuition.additionalItemsから生成 -->
      <!-- 例: <input type="checkbox" /> 初回参加費 (+¥{マスタ価格}) -->
      <!-- 例: <input type="checkbox" /> 彫刻刀レンタル (+¥{マスタ価格}) -->
    </div>

    <!-- 割引項目（会計マスタの授業料・割引項目から動的生成） -->
    <div class="tuition-discounts">
      <!-- classifiedItems.tuition.discountItemsから生成 -->
      <!-- 例: <input type="checkbox" /> 初回者同時割引 (¥{マスタ価格}) -->
    </div>

    <div class="subtotal">授業料小計: <span id="tuition-subtotal">¥{計算結果}</span></div>
  </section>

  <!-- 販売セクション -->
  <section class="sales-section">
    <h3>■ 販売</h3>

    <!-- 材料代（会計マスタの材料項目から動的生成） -->
    <div class="materials">
      <h4>材料代</h4>
      <div class="material-row">
        材料:
        <select>
          <!-- classifiedItems.sales.materialItemsから選択肢生成 -->
          <!-- 例: 固定価格材料 / 体積計算材料 -->
        </select>
        <!-- 体積計算材料選択時のみ表示 -->
        <div class="size-inputs">サイズ: <input />×<input />×<input />mm</div>
        価格: <span>¥{計算結果}</span>
      </div>
      <button>+ 材料追加</button>
    </div>

    <!-- 物販（会計マスタの物販項目から動的生成） -->
    <div class="products">
      <h4>物販</h4>
      <!-- classifiedItems.sales.productItemsから生成 -->
      <!-- 例: <input type="checkbox" /> {商品名} (+¥{マスタ価格}) -->
    </div>

    <!-- 自由入力物販（新機能） -->
    <div class="custom-products">
      <h4>その他物販</h4>
      <div class="custom-product-row">項目名: <input type="text" placeholder="商品名を入力" /> 金額: ¥<input type="number" placeholder="金額を入力" /></div>
      <button>+ 項目追加</button>
    </div>

    <div class="subtotal">販売小計: <span id="sales-subtotal">¥{計算結果}</span></div>
  </section>

  <!-- 合計 -->
  <section class="total-section">
    <div class="grand-total">総合計: <span id="grand-total">¥{計算結果}</span></div>
    <div class="payment-method">
      <h4>支払方法</h4>
      <div id="payment-options-container">
        <!-- getPaymentOptionsHtml()で生成される支払い方法選択UI -->
      </div>

      <!-- 振込先情報表示エリア（getPaymentInfoHtml()で生成） -->
      <div id="payment-info-container" class="mt-3">
        <!-- 選択された支払い方法に応じてgetPaymentInfoHtml()で動的に表示 -->
      </div>
    </div>
  </section>
</div>
```

#### データ駆動UI生成の原則

**すべてのUI要素は会計マスタから動的生成＋Components.js活用**:

1. **授業料項目**: `classifiedItems.tuition.*` から `Components.checkbox` で生成
2. **材料項目**: `classifiedItems.sales.materialItems` から `Components.select` で選択肢生成
3. **物販項目**: `classifiedItems.sales.productItems` から `Components.checkbox` で生成
4. **入力フィールド**: `Components.input` でサイズ入力・自由入力物販に活用
5. **ボタン要素**: `Components.button` で追加・削除ボタンに活用
6. **価格表示**: リアルタイム計算結果を表示（TailwindCSSクラス活用）
7. **教室別表示**: 教室判定により表示制御
8. **時刻選択**: `Components.select` と `generateTimeOptions()` で動的生成

#### 必要な追加Componentsの検討

既存のComponents.jsに以下が不足している場合は追加実装：

1. **`Components.priceDisplay`**: 価格表示用コンポーネント（¥記号付き）
2. **`Components.subtotalSection`**: 小計表示セクション
3. **`Components.radioGroup`**: ラジオボタングループ（支払い方法用）
4. **`Components.sectionHeader`**: セクションヘッダー（■ 授業料、■ 販売等）

### 追加仕様の実装詳細

#### **1. 自由入力物販の実装**

```javascript
// 自由入力物販の計算処理
function calculateCustomSalesItems(formData) {
  const items = [];
  let subtotal = 0;

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

// UI生成関数（Components.js活用版）
function generateCustomSalesSection() {
  return `
    <div class="custom-products mt-4">
      ${Components.sectionHeader ? Components.sectionHeader({ title: 'その他物販' }) : '<h4 class="font-medium mb-2">その他物販</h4>'}
      <div id="custom-sales-container">
        ${generateCustomSalesRow(0)}
      </div>
      ${Components.button({
        action: 'addCustomSalesRow',
        text: '+ 項目追加',
        style: 'secondary',
        size: 'small',
        customClass: 'mt-2',
      })}
    </div>
  `;
}

function generateCustomSalesRow(index) {
  const nameInput = Components.input({
    id: `custom-sales-name-${index}`,
    label: '',
    placeholder: '商品名を入力',
    type: 'text',
  });

  const priceInput = Components.input({
    id: `custom-sales-price-${index}`,
    label: '',
    placeholder: '金額',
    type: 'number',
  });

  const deleteButton =
    index > 0
      ? Components.button({
          action: 'removeCustomSalesRow',
          text: '削除',
          style: 'danger',
          size: 'small',
          dataAttributes: { index: index },
        })
      : '';

  return `
    <div class="custom-sales-row flex items-center space-x-2 ${index > 0 ? 'mt-2' : ''}" data-custom-sales-row="${index}">
      <label>項目名:</label>
      <div class="flex-1">${nameInput}</div>
      <label>金額: ¥</label>
      <div class="w-24">${priceInput}</div>
      ${deleteButton}
    </div>
  `;
}
```

#### **2. 支払い方法の実装**

```javascript
// 支払い方法UI生成（既存関数をそのまま移設・活用）
function initializePaymentMethodUI(selectedPaymentMethod = '現金') {
  const paymentOptionsContainer = document.getElementById('payment-options-container');
  const paymentInfoContainer = document.getElementById('payment-info-container');

  // 既存のgetPaymentOptionsHtml()を利用
  paymentOptionsContainer.innerHTML = getPaymentOptionsHtml(selectedPaymentMethod);

  // 既存のgetPaymentInfoHtml()を利用
  paymentInfoContainer.innerHTML = getPaymentInfoHtml(selectedPaymentMethod);
}

// 支払い方法変更時の処理（既存関数を活用）
function handlePaymentMethodChange(selectedMethod) {
  const paymentInfoContainer = document.getElementById('payment-info-container');

  // 既存のgetPaymentInfoHtml()を直接利用
  paymentInfoContainer.innerHTML = getPaymentInfoHtml(selectedMethod);
}

// 既存関数の移設（13_WebApp_Views_Utils.jsから）
const getPaymentOptionsHtml = selectedValue => {
  // 13_WebApp_Views_Utils.js:141の実装をそのまま移設
  // ※実装済みの既存コードをそのまま利用
};

const getPaymentInfoHtml = (selectedPaymentMethod = '') => {
  // 13_WebApp_Views_Utils.js:102の実装をそのまま移設
  // ※実装済みの既存コードをそのまま利用
};
```

#### **3. 支払い確認時の統合予約シート更新**

```javascript
// 支払い確認時の処理拡張
function confirmAndPay() {
  // 既存のユーザー入力データ収集...

  const payload = {
    reservationId: stateManager.getState().accountingReservation.reservationId,
    classroom: stateManager.getState().accountingReservation.classroom,
    studentId: stateManager.getState().currentUser.studentId,
    userInput: userInput,
    updateStatus: true, // ステータス更新フラグ
  };

  // バックエンドで以下を実行:
  // 1. 会計詳細をJSONで統合予約シートに記録
  // 2. ステータスを「完了」に更新
  // 3. 最新データを返却
}
```

#### **4. データ型定義の拡張**

```typescript
// 自由入力物販用の型定義追加
interface CustomSalesItem {
  name: string;
  price: number;
}

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
  customSales?: CustomSalesItem[]; // 追加
  paymentMethod?: typeof CONSTANTS.PAYMENT_DISPLAY.CASH | typeof CONSTANTS.PAYMENT_DISPLAY.BANK_TRANSFER | typeof CONSTANTS.PAYMENT_DISPLAY.COTRA; // 既存定数を利用
}

// 統合予約シート更新用のペイロード
interface AccountingPayload {
  reservationId: string;
  classroom: string;
  studentId: string;
  userInput: any;
  updateStatus?: boolean; // ステータス更新フラグ
}
```

## 🚀 実装計画

### Phase 1: 基盤整備（2-3日）

#### **Day 1: データ型定義と新ファイル準備**

**Step 1.1: 型定義の拡張** (1-2時間)

```typescript
// types/accounting.d.ts に以下を追加
interface AccountingMasterItem {
  /* 上記参照 */
}
interface ClassifiedAccountingItems {
  /* 上記参照 */
}
interface AccountingFormData {
  /* 上記参照 */
}
interface AccountingCalculationResult {
  /* 上記参照 */
}
```

**Step 1.2: 新統合ファイル作成** (2-3時間)

```bash
# ファイル作成
touch src/frontend/12_WebApp_Accounting_New.js

# 基本構造設定（関数の骨格実装）
# 既存のgetPaymentOptionsHtml, getPaymentInfoHtmlを移設
# Components.js活用のためのUI生成関数準備
```

**Step 1.3: 基本計算関数の実装** (2-3時間)

- `classifyAccountingItems()` 実装
- `calculateTimeUnits()` 実装
- `calculateTuitionSubtotal()` の骨格実装
- `calculateSalesSubtotal()` の骨格実装

#### **Day 2: 核心計算ロジック実装**

**Step 2.1: 授業料計算ロジック完成** (3-4時間)

1. 時間制授業料計算（つくば・沼津教室）
2. 回数制授業料計算（東京教室）
3. 追加項目計算（初回参加費、レンタル）
4. 割引計算（初回者同時割引）

**Step 2.2: 販売計算ロジック完成** (2-3時間)

1. 固定価格材料（¥100、¥200）
2. 体積計算材料（バスウッド、ジェルトン）
3. 物販項目（彫刻刀、テキスト、作業台）
4. **自由入力物販項目** (新機能)

**Step 2.3: 統合計算とテスト** (1-2時間)

- `calculateAccountingTotal()` 完成
- 基本的な動作テスト実行

#### **Day 3: UI生成とイベント処理**

**Step 3.1: 基本UI生成実装** (3-4時間)

1. `generateTuitionSection()` - 基本形（**Components.checkbox, select活用**）
2. `generateSalesSection()` - 基本形（**Components.select, button活用**）
3. `generateCustomSalesSection()` - **自由入力物販**（**Components.input, button活用**）
4. `generateAccountingView()` - 統合（**各Componentsを組み合わせ**）
5. 教室別表示制御

**Step 3.2: イベント処理実装** (2-3時間)

1. `setupAccountingEventListeners()`
2. `handleAccountingInputChange()`
3. `handlePaymentMethodChange()` - **支払い方法変更処理**（既存関数活用）
4. `initializePaymentMethodUI()` - **支払い方法UI初期化**（既存関数活用）
5. `updateAccountingCalculation()`
6. UI更新ロジック

**Step 3.3: 既存システムとの連携テスト** (1-2時間)

- 会計マスタデータの正常取得
- 既存の画面遷移との互換性
- 基本的な計算結果の正確性

### Phase 2: 機能完成（2-3日）

#### **UI機能の完全実装**

- 材料行の動的追加・削除
- **自由入力物販行の動的追加・削除** (新機能)
- 時刻選択プルダウンの実装
- リアルタイム価格更新
- エラーハンドリング

#### **既存機能との統合**

- キャッシュ機能の移植
- 支払い確認モーダルの統合（**3つの支払い方法対応**）
- **振込先情報表示機能** (既存機能活用)
- **ことら送金説明機能** (既存機能活用)
- 完了画面との連携

#### **包括的テスト**

- 全教室タイプでの動作確認
- エッジケースの検証
- パフォーマンステスト

### Phase 3: 切り替えとクリーンアップ（1日）

#### **ファイル切り替え**

1. 既存3ファイルをリネーム（`_backup`）
2. 新ファイルを正式名に変更
3. import/export の調整

#### **最終検証**

- 本番環境での動作確認
- データ互換性の最終チェック
- ドキュメント更新

## ✅ 完了時の期待効果

- **コード量**: 1,400行 → 約600行（60%削減）
- **ファイル数**: 3ファイル → 1ファイル
- **保守性**: 統一されたロジックで修正容易
- **機能性**: 授業料・販売小計の明確な分離表示
- **拡張性**: 新項目追加は会計マスタ登録のみ

## 🎯 実装時の注意点

### 1. 既存機能の保護

- 段階的移行により既存機能を壊さない
- 新機能は並行実装→テスト→切り替え

### 2. データ互換性

- 既存の localStorage キャッシュ形式
- 既存の API レスポンス形式
- 既存の会計マスタデータ形式

### 3. 段階的検証

- 各 Phase で動作確認
- 問題があれば前の Phase に戻れる設計

## 📋 Phase 1 完了判定基準

### 実装完了する機能

✅ **教室別の項目分類表示** ✅ **時間制・回数制の統一UI** ✅ **基本的な授業料・販売計算** ✅ **2大項目小計表示** ✅ **リアルタイム計算更新**

### テストケース

1. 東京教室（回数制）での正常動作
2. つくば・沼津教室（時間制）での正常動作
3. 材料費の体積計算が正確
4. 割引計算が正確
5. **自由入力物販の追加・削除・計算が正確** (新機能)
6. **3つの支払い方法選択と振込先情報表示** (新機能)
7. **支払い確認時のステータス更新が正常** (新機能)
8. UI更新がリアルタイムで動作

---

## 📋 追加仕様まとめ

### ✅ 新機能

1. **自由入力物販**: 項目名と金額を自由に入力できる物販項目
2. **3つの支払い方法**: 現金・銀行振込・ことら送金
3. **振込先情報表示**: 銀行振込・ことら送金選択時の情報表示
4. **ことら送金説明**: ことら送金の説明機能
5. **ステータス更新**: 支払い確認時に統合予約シートのステータスを「完了」に更新

### 🔄 既存機能の活用

- **支払い方法UI生成**: `getPaymentOptionsHtml`（13_WebApp_Views_Utils.js:141）- ラジオボタンとことら送金説明を含む完全なUI
- **支払い情報表示**: `getPaymentInfoHtml`（13_WebApp_Views_Utils.js:102）- 銀行振込・ことら送金の情報とコピー機能
- **既存定数システム**: `CONSTANTS.PAYMENT_DISPLAY.*`、`CONSTANTS.BANK_INFO.*` をそのまま利用
- **会計確認モーダル**: `showAccountingConfirmation`（既存機能活用）
- **統合予約シート更新**: `saveAccountingDetailsAndGetLatestData`（既存機能活用）

---

**最終更新**: 2025年9月20日（Components.js活用版） **ステータス**: 既存`getPaymentOptionsHtml`・`getPaymentInfoHtml`活用＋Components.js活用による設計最適化完了 **次のアクション**: Phase 1 Day 1 完了済み、Components.js活用でPhase 1 Day 2の実装継続
