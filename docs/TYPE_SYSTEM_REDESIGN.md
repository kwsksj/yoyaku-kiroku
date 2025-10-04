# 型システム大局的再設計計画

**バージョン**: 2.0 **作成日**: 2025-10-04 **ステータス**: 計画中 **前バージョン**: [TYPE_SYSTEM_UNIFICATION.md](./TYPE_SYSTEM_UNIFICATION.md) (Phase 3-6完了)

---

## 📋 目次

1. [背景と問題分析](#背景と問題分析)
2. [現状の型システム構成](#現状の型システム構成)
3. [設計原則と目標](#設計原則と目標)
4. [新しい型システム構造](#新しい型システム構造)
5. [移行計画](#移行計画)
6. [影響範囲分析](#影響範囲分析)
7. [リスクと対策](#リスクと対策)

---

## 背景と問題分析

### Phase 3-6での成果

✅ **達成事項**:

- Core型（ReservationCore, UserCore, AccountingCore）の導入
- DTO型（ReservationCreateDto等）の導入
- バックエンド・フロントエンドの型統一
- 後方互換性コードの削除

### 残存する根本的問題

#### 1. 型定義の肥大化と責務不明確

```
types/html-environment.d.ts: 2,024行
└─ 含まれる内容（混在）:
   - UIState定義（状態管理）
   - LessonData, ReservationData（Core型と重複）
   - Window拡張（グローバル変数）
   - Component Props（UI層）
   - DOM型拡張
   - 会計システム型（重複）
```

**問題**: 単一ファイルに複数の責務が混在し、保守が困難

#### 2. 型名の重複と不整合

| 概念         | html-environment.d.ts  | core/                      | 状況                       |
| ------------ | ---------------------- | -------------------------- | -------------------------- |
| 予約データ   | `ReservationData`      | `ReservationCore`          | 構造が微妙に異なる         |
| レッスン     | `LessonData`           | なし                       | Core型が存在しない         |
| ユーザー     | `UserData`             | `UserCore`                 | ほぼ同一だがフィールド差異 |
| 会計マスター | `AccountingMasterData` | `AccountingMasterItemCore` | 構造が異なる               |

**問題**: 同じ概念に複数の型名が存在し、どれを使うべきか不明確

#### 3. エイリアスの乱用

```typescript
// gas-environment.d.ts（追加された後付けエイリアス）
declare type Lesson = LessonData;
declare type Reservation = ReservationCore;
declare type AccountingMasterItem = AccountingMasterItemCore;
```

**問題**:

- 型エイリアスで無理やり接続
- 真の型定義がどこにあるか不明
- 型システムの一貫性が失われる

#### 4. View層型の散在

```
UIState → html-environment.d.ts
Component Props → html-environment.d.ts
Window拡張 → index.d.ts, html-environment.d.ts（重複）
StateManager → html-environment.d.ts
```

**問題**: フロントエンド固有型が統一的に管理されていない

---

## 現状の型システム構成

### 現在のファイル構成（合計4,107行）

```
types/
├── index.d.ts (84行)                # エントリポイント
├── constants.d.ts (230行)            # 定数型定義
├── gas-environment.d.ts (673行)      # GAS環境型 + 後付けエイリアス
├── html-environment.d.ts (2,024行)   # フロントエンド型（肥大化）
├── dev-environment.d.ts (238行)      # 開発環境型
│
├── core/ (347行)
│   ├── index.d.ts (27行)
│   ├── reservation-core.d.ts (122行)
│   ├── user-core.d.ts (96行)
│   └── accounting-core.d.ts (124行)
│
└── dto/ (339行)
    ├── index.d.ts (41行)
    ├── reservation-dto.d.ts (150行)
    ├── user-dto.d.ts (149行)
    └── accounting-dto.d.ts (149行)
```

### 問題の定量分析

| ファイル              | 行数  | 問題点                      | 優先度  |
| --------------------- | ----- | --------------------------- | ------- |
| html-environment.d.ts | 2,024 | 肥大化・責務混在            | 🔴 最高 |
| gas-environment.d.ts  | 673   | エイリアス乱用              | 🟡 中   |
| dev-environment.d.ts  | 238   | View層と分離すべき          | 🟢 低   |
| core/                 | 347   | Lesson/Schedule型不足       | 🟡 中   |
| dto/                  | 339   | 共通型（ApiResponse等）不足 | 🟢 低   |

---

## 設計原則と目標

### 設計原則

#### 1. 単一責任の原則（SRP）

- 1ファイル = 1つの明確な責務
- 例: `state.d.ts`は状態管理型のみ、`components.d.ts`はComponent Props のみ

#### 2. 型名の一意性

- 同じ概念 = 1つの型名のみ
- エイリアスは最小限（非推奨）

#### 3. 階層の明確化（3層アーキテクチャ）

```
┌─────────────────────────────────────┐
│         View層 (types/view/)        │  ← UIState, Component Props
│  フロントエンド表示・状態管理に特化   │
├─────────────────────────────────────┤
│         DTO層 (types/dto/)          │  ← API Request/Response
│    バックエンド⇔フロントエンド通信    │
├─────────────────────────────────────┤
│        Core層 (types/core/)         │  ← 正規化ビジネスデータ
│   アプリケーション全体の真のデータ型   │
└─────────────────────────────────────┘
```

#### 4. 型の進化可能性

- 新機能追加時に既存型を壊さない
- 拡張ポイントを明確化

### 目標

✅ **定量目標**:

- `html-environment.d.ts`を500行以下に削減（-75%）
- 型エイリアス数を10個以下に削減
- 型名の重複を0にする

✅ **定性目標**:

- どのファイルに何があるか即座に分かる構造
- 新規開発者が型システムを1時間で理解できる
- AI補完が正確に動作する型ヒント

---

## 新しい型システム構造

### ディレクトリ構成（提案）

```
types/
├── index.d.ts                    # 統合エントリポイント（最小限）
├── constants.d.ts                # 定数型定義（変更なし）
├── gas.d.ts                      # GAS固有型のみ（リネーム）
│
├── core/                         # ビジネスロジック層（正規化データ）
│   ├── index.d.ts               # Core型統合エクスポート
│   ├── reservation.d.ts          # ReservationCore
│   ├── user.d.ts                 # UserCore
│   ├── accounting.d.ts           # AccountingCore
│   ├── session.d.ts             # SessionCore（新規）
│   └── common.d.ts               # RawSheetRow, HeaderMapType等
│
├── dto/                          # API通信層
│   ├── index.d.ts               # DTO型統合エクスポート
│   ├── reservation.d.ts          # 予約API Request/Response
│   ├── user.d.ts                 # ユーザーAPI Request/Response
│   ├── accounting.d.ts           # 会計API Request/Response
│   └── common.d.ts               # ApiResponse, ApiError等（新規）
│
└── view/                         # View層（新規）
    ├── index.d.ts               # View型統合エクスポート
    ├── state.d.ts                # UIState, StateManager
    ├── components.d.ts           # Component Props, Config
    ├── window.d.ts               # Window拡張、グローバル変数
    ├── dom.d.ts                  # DOM型拡張
    └── handlers.d.ts             # EventHandler, ActionHandler
```

### 各ファイルの責務定義

#### core/session.d.ts（新規）

```typescript
/**
 * スケジュールマスターの正規化型
 */
interface SessionCore {
  classroom: string;
  date: string; // YYYY-MM-DD
  venue?: string;
  classroomType?: string;

  // 時間制
  startTime?: string;
  endTime?: string;

  // 2部制
  firstStart?: string;
  firstEnd?: string;
  secondStart?: string;
  secondEnd?: string;
  beginnerStart?: string;

  // 定員情報
  maxCapacity?: number;
  currentReservations?: number;
}
```

#### dto/common.d.ts（新規）

```typescript
/**
 * API汎用レスポンス型
 */
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

/**
 * APIエラー型
 */
interface ApiError {
  success: false;
  message: string;
  code?: string;
  details?: any;
}

/**
 * アプリ初期化データ
 */
interface AppInitialData {
  allStudents: Record<string, UserCore>;
  schedules?: SessionCore[];
  myReservations?: ReservationCore[];
  accountingMaster?: AccountingMasterItemCore[];
  cacheVersions?: Record<string, string>;
  today?: string;
}
```

#### view/state.d.ts

```typescript
/**
 * UI状態管理の中核型
 */
interface UIState {
  // ユーザー・セッションデータ
  currentUser: UserCore | null;
  loginPhone: string;

  // アプリケーションデータ
  schedules: SessionCore[];
  myReservations: ReservationCore[];
  accountingMaster: AccountingMasterItemCore[];

  // UI状態
  view: ViewType;
  selectedClassroom: string | null;

  // システム状態
  isDataFresh: boolean;
  cacheVersions?: Record<string, string>;
}

/**
 * StateManager
 */
interface StateManager {
  state: UIState;
  dispatch(action: StateAction): void;
  getState(): UIState;
  subscribe(callback: StateSubscriber): () => void;
}
```

#### view/components.d.ts

```typescript
/**
 * ボタンコンポーネント設定
 */
interface ButtonConfig {
  text: string;
  onClick?: string;
  type?: 'primary' | 'secondary' | 'danger';
  size?: 'normal' | 'small' | 'large' | 'full';
  disabled?: boolean;
}

/**
 * モーダルコンポーネント設定
 */
interface ModalConfig {
  id: string;
  title: string;
  content: string;
  maxWidth?: string;
  showCloseButton?: boolean;
}

// ... その他のComponent Config
```

#### view/window.d.ts

```typescript
/**
 * Window拡張（フロントエンド固有）
 */
declare global {
  interface Window {
    // 定数
    CONSTANTS: Constants;

    // 状態管理
    stateManager: StateManager;

    // グローバル関数
    render?: () => void;
    showLoading?: (category?: string) => void;
    hideLoading?: () => void;

    // 環境フラグ
    isProduction: boolean;

    // 一時データ
    tempPaymentData?: TempPaymentData;
  }
}
```

### 型名の統一規則

#### Before（現状）→ After（統一後）

| 現状の型名（複数存在）                                                     | 統一後の型名                    | 配置                  |
| -------------------------------------------------------------------------- | ------------------------------- | --------------------- |
| `LessonData`, `Lesson`                                                     | `SessionCore`                   | core/session.d.ts     |
| `ReservationData`, `Reservation`, `ReservationCore`                        | `ReservationCore`               | core/reservation.d.ts |
| `UserData`, `UserCore`                                                     | `UserCore`                      | core/user.d.ts        |
| `AccountingMasterData`, `AccountingMasterItem`, `AccountingMasterItemCore` | `AccountingMasterItemCore`      | core/accounting.d.ts  |
| `ClassifiedAccountingItems`, `ClassifiedAccountingItemsCore`               | `ClassifiedAccountingItemsCore` | core/accounting.d.ts  |

**原則**: Core層の型名をプロジェクト全体の正式名称とする

---

## 移行計画

### Phase 1: View層の分離（優先度：最高）

**目的**: `html-environment.d.ts`（2,024行）を分解

**手順**:

1. **types/view/ディレクトリ作成**

   ```bash
   mkdir -p types/view
   ```

2. **state.d.ts作成** - UIState, StateManager関連を移動
   - 対象行数: 約400行
   - 依存: UserCore, ReservationCore, SessionCore

3. **components.d.ts作成** - Component Props, Config を移動
   - 対象行数: 約600行
   - 既存のButtonConfig, ModalConfig等を集約

4. **window.d.ts作成** - Window拡張を移動
   - 対象行数: 約200行
   - index.d.tsとの重複を解消

5. **dom.d.ts作成** - DOM型拡張を移動
   - 対象行数: 約150行
   - HTMLElementWithId等

6. **handlers.d.ts作成** - EventHandler, ActionHandler を移動
   - 対象行数: 約300行

7. **残存部分の整理**
   - 削除可能な重複型の特定
   - 最終的に300行以下に削減

**検証**:

```bash
npm run check-types  # エラー0件
npm run dev:build    # ビルド成功
```

### Phase 2: Core層の完全化（優先度：高）

**目的**: Core型の不足を補完

**手順**:

1. **core/session.d.ts作成**
   - `SessionCore`型の定義
   - `LessonData`から移行

2. **core/common.d.ts作成**
   - `RawSheetRow`, `HeaderMapType`を集約

3. **既存Core型の見直し**
   - `ReservationCore`のフィールド検証
   - `UserCore`のフィールド検証
   - `AccountingCore`のフィールド検証

**検証**:

```bash
grep -r "LessonData" src/  # 0件（すべてSessionCoreに置換）
```

### Phase 3: DTO層の拡充（優先度：中）

**目的**: DTO層に共通型を追加

**手順**:

1. **dto/common.d.ts作成**
   - `ApiResponse<T>`
   - `ApiError`
   - `AppInitialData`

2. **既存DTO型の見直し**
   - Request/Response の分離明確化

**検証**:

```bash
npm run check-types
```

### Phase 4: エイリアスの削除（優先度：中）

**目的**: 型エイリアスを最小化

**手順**:

1. **gas-environment.d.tsからエイリアス削除**

   ```typescript
   // 削除対象
   type Lesson = LessonData; // → SessionCore使用に統一
   type Reservation = ReservationCore; // → 直接ReservationCore使用
   ```

2. **実装ファイルの型参照を直接置換**

   ```bash
   # 一括置換
   sed -i '' 's/LessonData/SessionCore/g' src/**/*.js
   sed -i '' 's/: Lesson/: SessionCore/g' src/**/*.js
   ```

**検証**:

```bash
grep -r "type .* = .*Core" types/  # 10件以下
```

### Phase 5: クリーンアップと検証（優先度：低）

**手順**:

1. **不要ファイル削除**
   - `html-environment.d.ts` → view/に統合後削除
   - `dev-environment.d.ts` → view/に統合後削除

2. **types/index.d.tsの簡素化**

   ```typescript
   /// <reference types="google-apps-script" />
   /// <reference path="./constants.d.ts" />
   /// <reference path="./gas.d.ts" />
   /// <reference path="./core/index.d.ts" />
   /// <reference path="./dto/index.d.ts" />
   /// <reference path="./view/index.d.ts" />
   ```

3. **最終検証**

   ```bash
   npm run check        # 全チェックパス
   npm run dev:build    # ビルド成功
   npm run dev:test     # テスト環境動作確認
   ```

---

## 影響範囲分析

### 変更が必要なファイル

#### バックエンド（14ファイル）

| ファイル                           | 変更内容                                            | リスク |
| ---------------------------------- | --------------------------------------------------- | ------ |
| 全バックエンドファイル             | `types/index.d.ts`のみ参照（変更なし）              | 🟢 低  |
| 05-2_Backend_Write.js              | `AccountingMasterItem` → `AccountingMasterItemCore` | 🟡 中  |
| 02-5_BusinessLogic_Notification.js | `Lesson` → `SessionCore`                            | 🟡 中  |

#### フロントエンド（16ファイル）

| ファイル                  | 変更内容                                     | リスク |
| ------------------------- | -------------------------------------------- | ------ |
| 全フロントエンドファイル  | `types/index.d.ts`のみ参照（変更なし）       | 🟢 低  |
| 12_WebApp_StateManager.js | `UIState`の参照先変更（view/state.d.ts）     | 🟢 低  |
| 13_WebApp_Components.js   | Config型の参照先変更（view/components.d.ts） | 🟢 低  |

#### 型定義ファイル（13ファイル）

| ファイル                    | 変更                  | リスク |
| --------------------------- | --------------------- | ------ |
| types/index.d.ts            | 参照パス追加（view/） | 🟢 低  |
| types/html-environment.d.ts | 削除（view/に分割）   | 🔴 高  |
| types/gas-environment.d.ts  | エイリアス削除        | 🟡 中  |
| types/core/\*.d.ts          | session.d.ts追加      | 🟢 低  |
| types/dto/\*.d.ts           | common.d.ts追加       | 🟢 低  |
| types/view/\*.d.ts          | 新規作成（6ファイル） | 🟡 中  |

### 影響を受けない部分

✅ **変更不要**:

- ビルドシステム（`tools/unified-build.js`）
- デプロイスクリプト
- 実装ロジック（型参照のみ変更）
- Google Sheetsデータ構造

---

## リスクと対策

### リスク1: 型チェックエラーの大量発生（リスクレベル: 🔴 高）

**懸念**:

- `html-environment.d.ts`削除により、既存コードが型を見失う

**対策**:

- Phase 1で`view/index.d.ts`に全型を再エクスポート
- `types/index.d.ts`で`view/index.d.ts`を参照
- 段階的移行（ファイル削除前に新ファイルで型提供）

**検証ポイント**:

```bash
npm run check-types  # 各Phase後に実行
```

### リスク2: UIStateの破壊的変更（リスクレベル: 🟡 中）

**懸念**:

- `LessonData` → `SessionCore`への移行で、UIStateのフィールド変更が必要

**対策**:

- 移行期は両型をサポート（型エイリアス一時利用）
- StateManagerの実装を先に確認
- テスト環境で動作確認後に型削除

### リスク3: ビルド時間の増加（リスクレベル: 🟢 低）

**懸念**:

- ファイル数増加による型チェック時間増

**対策**:

- 型定義ファイルの総行数は削減方向（4,107行 → 約3,500行目標）
- TypeScript Project Referencesの活用（将来）

### リスク4: AI補完の精度低下（リスクレベル: 🟢 低）

**懸念**:

- 型定義分散によりAI補完が混乱

**対策**:

- 各ファイルに明確なJSDocコメント
- `types/index.d.ts`で全型を集約
- 型名の一意性確保

---

## 成功基準

### 定量基準

| 指標                      | 現状    | 目標        | 測定方法                                          |
| ------------------------- | ------- | ----------- | ------------------------------------------------- | -------- |
| html-environment.d.ts行数 | 2,024行 | 削除（0行） | `wc -l`                                           |
| view/ディレクトリ合計     | 0行     | 1,500行     | `find types/view -name "\*.d.ts" -exec wc -l {} + | tail -1` |
| 型エイリアス数            | 20+     | 10以下      | `grep -r "^type .\* =" types/                     | wc -l`   |
| 型名重複                  | 多数    | 0件         | 手動レビュー                                      |
| 型チェックエラー          | 0件     | 0件         | `npm run check-types`                             |

### 定性基準

✅ **必須達成項目**:

- [ ] どのファイルに何の型があるか、ファイル名から即座に判断可能
- [ ] 新規開発者が型システムを1時間で理解できる
- [ ] AI（Claude/Copilot）の型補完精度が向上
- [ ] ビルド・型チェックが問題なく動作

✅ **望ましい項目**:

- [ ] 型定義ファイル総行数が10%削減
- [ ] `types/index.d.ts`が100行以下
- [ ] 各view/ファイルが300行以下

---

## 次のステップ

### 承認後の作業

1. **Phase 1実行** - View層分離（所要時間: 2-3時間）
2. **Phase 2実行** - Core層完全化（所要時間: 1時間）
3. **Phase 3実行** - DTO層拡充（所要時間: 30分）
4. **Phase 4実行** - エイリアス削除（所要時間: 1時間）
5. **Phase 5実行** - クリーンアップ（所要時間: 30分）

**合計所要時間**: 約5-6時間

### レビューポイント

この計画書のレビュー観点：

- [ ] 設計原則に同意できるか
- [ ] 新しいディレクトリ構成は適切か
- [ ] 型名統一規則は妥当か
- [ ] 移行手順にリスクはないか
- [ ] Phase分割は適切か

---

## 付録

### 参考: 他プロジェクトの型システム事例

**Next.js (大規模)**:

```
types/
├── components/
├── api/
└── utils/
```

**Vue.js (中規模)**:

```
types/
├── components.d.ts
├── router.d.ts
└── store.d.ts
```

**本プロジェクト（提案）**:

```
types/
├── core/      # ビジネスロジック
├── dto/       # API通信
└── view/      # フロントエンド
```

### 用語集

- **Core型**: ビジネスロジック層の正規化データ型
- **DTO型**: Data Transfer Object、API通信用の型
- **View型**: フロントエンド表示・状態管理用の型
- **型エイリアス**: `type A = B`形式の型参照
- **型の一意性**: 同じ概念に複数の型名が存在しない状態

---

**この計画書の承認をお願いします。承認後、Phase 1から実装を開始します。**
