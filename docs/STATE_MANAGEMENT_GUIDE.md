# State管理ガイド（v3.2対応）

**最終更新**: 2025年10月2日 | **対象バージョン**: v3.2.0

## 概要

フロントエンドのstate管理について、プロパティの利用状況、設定箇所、重複・未使用の有無を調査し、不整合がないか確認しました。

このドキュメントは、現在のStateManager実装の完全な仕様と、開発時のベストプラクティスを提供します。

## StateManagerのstate定義

### 主要プロパティ一覧

#### User & Session Data

| プロパティ           | 型           | 初期値 | 用途                         | 利用状況      |
| -------------------- | ------------ | ------ | ---------------------------- | ------------- |
| `currentUser`        | Object\|null | null   | ログイン中ユーザー情報       | ✅ 頻繁に使用 |
| `loginPhone`         | string       | ''     | ログイン画面の電話番号入力値 | ✅ 使用中     |
| `isFirstTimeBooking` | boolean      | false  | 初回予約判定フラグ           | ✅ 使用中     |
| `registrationData`   | Object       | {}     | 新規登録フォームデータ       | ✅ 使用中     |
| `registrationPhone`  | string\|null | null   | 登録時電話番号               | ✅ 使用中     |

#### Core Application Data

| プロパティ         | 型           | 初期値 | 用途                                       | 利用状況      |
| ------------------ | ------------ | ------ | ------------------------------------------ | ------------- |
| `slots`            | Array        | []     | 利用可能スロット一覧                       | ✅ 頻繁に使用 |
| `myReservations`   | Array        | []     | **統合予約データ**（旧myBookings+history） | ✅ 頻繁に使用 |
| `accountingMaster` | Array        | []     | 会計マスタデータ                           | ✅ 使用中     |
| `classrooms`       | Array        | []     | 教室一覧                                   | ✅ 使用中     |
| `constants`        | Object\|null | null   | バックエンド定数                           | ✅ 使用中     |

#### UI State

| プロパティ                     | 型           | 初期値  | 用途                 | 利用状況            |
| ------------------------------ | ------------ | ------- | -------------------- | ------------------- |
| `view`                         | string       | 'login' | 現在のビュー         | ✅ 頻繁に使用       |
| `selectedClassroom`            | string\|null | null    | 選択中教室           | ✅ 使用中           |
| `selectedSlot`                 | Object\|null | null    | 選択中スロット       | ✅ 使用中           |
| `editingReservationDetails`    | Object\|null | null    | 編集中予約詳細       | ✅ 使用中           |
| `accountingReservation`        | Object\|null | null    | 会計画面基本情報     | ✅ 使用中           |
| `accountingReservationDetails` | Object       | {}      | 会計予約詳細         | ⚠️ 参照少なめ       |
| `accountingScheduleInfo`       | Object\|null | null    | 会計講座情報         | ⚠️ 参照少なめ       |
| `completionMessage`            | string       | ''      | 完了メッセージ       | ✅ 完了画面で使用中 |
| `recordsToShow`                | number       | 10      | 履歴表示件数         | ✅ 使用中           |
| `registrationStep`             | number       | 1       | 新規登録ステップ番号 | ✅ 使用中           |
| `searchedUsers`                | Array        | []      | ユーザー検索結果     | ✅ 使用中           |
| `searchAttempted`              | boolean      | false   | 検索実行済みフラグ   | ✅ 使用中           |

#### Navigation History

| プロパティ          | 型    | 初期値 | 用途         | 利用状況  |
| ------------------- | ----- | ------ | ------------ | --------- |
| `navigationHistory` | Array | []     | 画面遷移履歴 | ✅ 使用中 |

#### System State

| プロパティ              | 型           | 初期値 | 用途               | 利用状況  |
| ----------------------- | ------------ | ------ | ------------------ | --------- |
| `isDataFresh`           | boolean      | false  | データ新鮮度フラグ | ✅ 使用中 |
| `_dataUpdateInProgress` | boolean      | false  | データ更新中フラグ | ✅ 使用中 |
| `_slotsVersion`         | string\|null | null   | スロットバージョン | ✅ 使用中 |

#### Computed Data

| プロパティ | 型     | 初期値 | 用途                                             | 利用状況 |
| ---------- | ------ | ------ | ------------------------------------------------ | -------- |
| `computed` | Object | {}     | **空オブジェクト**（前回リファクタリングで削除） | ✅ 正常  |

## データフロー整合性

### 正常なデータフロー

1. **ログインフロー**: `loginPhone` → `currentUser` → `view: 'dashboard'`
2. **予約データフロー**: `slots` → `selectedSlot` → `myReservations`
3. **会計フロー**: `accountingReservation` → `accountingMaster` → 計算処理

### 登録フロー

1. **登録フロー**:
   - `registrationData` ← 複数ステップで段階的蓄積
   - `registrationStep` ← State定義に正式追加済み
   - 型安全性が向上、完全に正常化

## State設定パターンの分析

### パターン1: 単一プロパティ更新

```javascript
window.stateManager.dispatch({
  type: 'UPDATE_STATE',
  payload: { loginPhone: p },
});
```

**使用頻度**: 多数（35箇所以上）

### パターン2: 複数プロパティ更新

```javascript
window.stateManager.dispatch({
  type: 'SET_STATE',
  payload: {
    view: 'dashboard',
    myReservations: data.myReservations,
    isDataFresh: true,
  },
});
```

**使用頻度**: 中程度（15箇所程度）

### パターン3: ステップ管理

```javascript
payload: {
  registrationStep: 2,
  view: 'registrationStep2'
}
```

**ステータス**: `registrationStep`をState定義に追加完了

## 現在のベストプラクティス

### State更新の基本原則

1. **必ずdispatchを使用**: 直接stateオブジェクトを変更しない

```javascript
// ❌ BAD: 直接変更
state.view = 'dashboard';

// ✅ GOOD: dispatchを使用
stateManager.dispatch({
  type: 'UPDATE_STATE',
  payload: { view: 'dashboard' },
});
```

1. **最小限の更新**: 必要なプロパティのみ更新する

```javascript
// ❌ BAD: 不要なプロパティまで更新
stateManager.dispatch({
  type: 'SET_STATE',
  payload: {
    view: 'booking',
    selectedSlot: slot,
    loginPhone: '', // 不要
    registrationData: {}, // 不要
  },
});

// ✅ GOOD: 必要なプロパティのみ
stateManager.dispatch({
  type: 'UPDATE_STATE',
  payload: {
    view: 'booking',
    selectedSlot: slot,
  },
});
```

2. **型の一貫性**: State定義で宣言された型を守る

```javascript
// ❌ BAD: 型が異なる
stateManager.dispatch({
  type: 'UPDATE_STATE',
  payload: { recordsToShow: '10' }, // string型
});

// ✅ GOOD: 正しい型
stateManager.dispatch({
  type: 'UPDATE_STATE',
  payload: { recordsToShow: 10 }, // number型
});
```

### ファイル構成（v3.2対応）

**開発ディレクトリ構造**:

```text
src/
├── frontend/
│   ├── 11_WebApp_Config.js         # フロントエンド設定・デザイン定数
│   ├── 12_WebApp_Core.js           # コアユーティリティ
│   ├── 12_WebApp_StateManager.js   # State管理（このドキュメントの主題）
│   ├── 13_WebApp_Components.js     # UIコンポーネント
│   ├── 13_WebApp_Views_*.js        # ビュー生成モジュール
│   └── 14_WebApp_Handlers*.js      # イベントハンドラー・ビジネスロジック
└── templates/
    └── 10_WebApp.html              # メインHTMLテンプレート
```

**デプロイディレクトリ**:

```text
build-output/                       # ビルド後の統合ファイル（自動生成）
└── [上記ファイルがコンパイルされたもの]
```

**重要**: 開発作業は必ず `src/frontend/` で行い、`build-output/` は直接編集しないこと。

### StateManager統合開発のワークフロー

1. **State構造の確認**: `src/frontend/12_WebApp_StateManager.js` で定義を確認
2. **コード編集**: `src/frontend/` ディレクトリでJavaScriptファイルを編集
3. **ビルド**: `npm run dev:build` でbuild-outputに反映
4. **テスト**: `npm run dev:test` でテスト環境にプッシュ
5. **デプロイ**: `npm run dev:prod` で本番環境にプッシュ

### 新規プロパティ追加時の注意事項

新しいstateプロパティを追加する際は、以下の手順を守る：

1. **State定義に追加**: `12_WebApp_StateManager.js`の`initialState`に追加
2. **JSDocコメント**: 型と用途を明記
3. **初期値設定**: 適切な初期値を設定
4. **利用箇所の実装**: Views/Handlersで使用
5. **テスト**: 動作確認とデータフローの検証

## アーキテクチャの特徴

### 単方向データフロー

```text
ユーザー操作
    ↓
イベントハンドラー (14_WebApp_Handlers*.js)
    ↓
dispatch() → StateManager (12_WebApp_StateManager.js)
    ↓
State更新 → render()呼び出し
    ↓
Views (13_WebApp_Views_*.js) → Components (13_WebApp_Components.js)
    ↓
DOM更新 → 画面表示
```

### 責任分離

- **StateManager**: 状態管理の唯一の責任
- **Views**: 純粋な表示ロジック（状態を読むのみ）
- **Handlers**: ビジネスロジックとstate更新の調整
- **Components**: 再利用可能なUI部品

## 完了した修正事項

### State定義の完全化

```javascript
// 12_WebApp_StateManager.js に追加完了
/** @type {number} */
registrationStep: 1,
```

### レガシープロパティの統合

以下のレガシープロパティへの参照を修正済み：

- `state.history` → `state.myReservations`に統合
- `state.myBookings` → `state.myReservations`に統合

### completionMessageの用途確認

- 予約完了・会計完了時のメッセージ表示に正常に使用されている
- 削除不要、継続利用

## 総合評価

### 良好な点

1. **データ統合完了**: `myReservations`への統合が正常に完了
2. **一貫したパターン**: `dispatch()`による状態更新が統一
3. **適切な分離**: UI State / Application Data / System Stateの明確な分離
4. **型安全性向上**: 動的プロパティ問題を解消

### 修正完了済み

1. **State定義の完全化**: `registrationStep`を正式にState定義に追加
2. **プロパティ用途確認**: `completionMessage`が正常に使用されていることを確認
3. **型安全性向上**: 動的プロパティ問題を解消

**総合評価**: State管理が完全に正常化。すべての不整合が解消され、型安全性も向上。

## 参考ドキュメント

- [データモデル設計仕様書](DATA_MODEL.md) - バックエンドデータ構造とキャッシュシステム
- [システムアーキテクチャ図](SYSTEM_ARCHITECTURE.md) - システム全体の構成とデータフロー
- [JavaScript分離開発アーキテクチャ](JS_TO_HTML_ARCHITECTURE.md) - ビルドシステムと開発ワークフロー
- [CLAUDE.md](../CLAUDE.md) - プロジェクト全体のガイドライン

---

**調査日時**: 2025-09-08（初回） **最終更新**: 2025-10-02 **調査範囲**: src/frontend/ 全ファイル **調査方法**: grep pattern matching + 手動コード解析
