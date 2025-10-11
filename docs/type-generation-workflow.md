# 型定義自動生成ワークフロー

## 概要

このプロジェクトでは、TypeScript型定義を自動生成し、GAS互換のコードにビルドする仕組みを採用しています。

## 基本方針

### 開発環境（src/）

- **標準JavaScript記法**: `export const`, `export class` などを使用
- **JSDocコメント**: 型情報をJSDocで記述
- **型チェック**: TypeScriptの型チェックが有効

### ビルド出力（build-output/）

- **GAS互換コード**: `export` キーワードが自動削除
- **グローバルスコープ**: すべての変数・関数がグローバルに配置
- **型定義除外**: `.d.ts` ファイルはビルド出力に含まれない

## ワークフロー

### 1. ソースコードの記述

```javascript
// src/backend/00_Constants.js
export const CONSTANTS = {
  TIMEZONE: 'Asia/Tokyo',
  // ...
};
```

### 2. 型定義の自動生成

```bash
npm run generate-types
```

このコマンドは以下を実行します:

1. **clean:types**: 既存の型定義を削除
2. **generate-types:backend**: バックエンドの型定義を生成 (`tsconfig.backend.dts.json`)
3. **generate-types:frontend**: フロントエンドの型定義を生成 (`tsconfig.frontend.dts.json`)
4. **generate-types:index**: 各ディレクトリの `index.d.ts` を生成 (`tools/create-dts-index.js`)
5. **generate-types:bridge**: グローバルスコープ用ブリッジファイルを生成 (`tools/create-global-bridge.js`) ✨ **自動化**

#### 生成される型定義

```
types/
├── generated-backend-globals/
│   ├── 00_Constants.d.ts          # export namespace CONSTANTS { ... }
│   ├── 00_SpreadsheetManager.d.ts # export class SpreadsheetManager { ... }
│   ├── 07_CacheManager.d.ts       # export const CACHE_KEYS = { ... }
│   ├── 08_ErrorHandler.d.ts       # export class BackendErrorHandler { ... }
│   ├── 08_Utilities.d.ts          # export const DEBUG = false; ...
│   └── index.d.ts                 # すべての参照を集約
├── generated-frontend-globals/
│   └── ...
└── constants.d.ts                 # ✨ 自動生成されるブリッジファイル
```

#### ブリッジファイル（types/constants.d.ts）

このファイルは **完全自動生成** されます。手動で編集しないでください。

```typescript
// 自動生成された型定義から再エクスポート
import { CONSTANTS, ENVIRONMENT_CONFIG } from './generated-backend-globals/00_Constants';
import { SALES_SPREADSHEET_ID, SpreadsheetManager, SS_MANAGER } from './generated-backend-globals/00_SpreadsheetManager';
// ... 他のimport

// グローバルスコープで利用可能にする
declare global {
  const CONSTANTS: typeof CONSTANTS;
  const SALES_SPREADSHEET_ID: typeof SALES_SPREADSHEET_ID;
  // ... 他の宣言
}

export {};
```

**仕組み:**

- `tools/create-global-bridge.js` が `types/generated-backend-globals/*.d.ts` をスキャン
- すべての `export const`, `export class`, `export namespace` を検出
- 自動的に `import` 文と `declare global` ブロックを生成

### 3. ビルド

```bash
npm run build
```

ビルドプロセス（`tools/unified-build.js`）:

```javascript
// 変換前: src/backend/00_Constants.js
export const CONSTANTS = { ... };

// 変換後: build-output/00_Constants.js
const CONSTANTS = { ... };  // export が削除される
```

## 新しい定数やクラスを追加する方法

### ステップ1: ソースファイルに export を追加

```javascript
// src/backend/新しいファイル.js
export const MY_NEW_CONSTANT = { ... };
export class MyNewClass { ... }
```

### ステップ2: 型定義を再生成

```bash
npm run generate-types
```

これだけで以下が自動的に行われます:

1. `types/generated-backend-globals/新しいファイル.d.ts` が生成される
2. `types/generated-backend-globals/index.d.ts` に参照が追加される
3. `types/constants.d.ts` に `import` と `declare global` が追加される ✨

### ステップ3: ビルド

```bash
npm run build
```

`export` キーワードが自動削除され、GAS互換のコードが生成されます。

## 重要な注意点

### ✅ DO（推奨）

- 定数は `export const` で定義
- クラスは `export class` で定義
- JSDocコメントで型情報を記述
- `npm run generate-types` で型定義を更新

### ❌ DON'T（非推奨）

- ~~`types/constants.d.ts` を手動編集~~ → 自動生成されます
- ~~`tsconfig.backend.dts.json` の `exclude` リストに追加~~ → すべて自動生成対象
- ~~グローバル関数に `export` を付ける~~ → 関数は `export` 不要（GASグローバルスコープ）

## ベストプラクティス

### 定数の集約

可能な限り、すべての定数は `00_Constants.js` に集約することを推奨します:

```javascript
// 推奨
export const CONSTANTS = {
  TIMEZONE: 'Asia/Tokyo',
  CACHE_KEYS: {
    ALL_RESERVATIONS: 'all_reservations',
    // ...
  },
  // ...
};

// 非推奨（散在すると管理が困難）
export const CACHE_KEYS = { ... };  // 別ファイル
export const DEBUG = false;         // 別ファイル
```

### 型情報の記述

JSDocを活用して型情報を明示的に記述します:

```javascript
/**
 * ユーザー情報を取得
 * @param {string} userId - ユーザーID
 * @returns {UserCore|null} ユーザーオブジェクト
 */
function getUserById(userId) {
  // ...
}
```

## トラブルシューティング

### 型定義が更新されない

```bash
# クリーンビルド
npm run clean:types
npm run generate-types
```

### ブリッジファイルが古い

```bash
# 手動でブリッジファイルのみ再生成
npm run generate-types:bridge
```

### ビルドエラー: "export is not defined"

GASは `export` をサポートしていません。ビルドプロセスで自動削除されるため、ソースコードでは `export` を使用できます。エラーが出る場合は、ビルド出力（`build-output/`）を確認してください。

```bash
# ビルド出力に export が残っていないか確認
grep "^export" build-output/*.js
```

## 関連スクリプト

| スクリプト                        | 説明                         |
| --------------------------------- | ---------------------------- |
| `npm run generate-types`          | 型定義の完全再生成（推奨）   |
| `npm run generate-types:backend`  | バックエンド型定義のみ生成   |
| `npm run generate-types:frontend` | フロントエンド型定義のみ生成 |
| `npm run generate-types:index`    | index.d.ts のみ生成          |
| `npm run generate-types:bridge`   | ブリッジファイルのみ生成 ✨  |
| `npm run build`                   | GAS互換コードをビルド        |
| `npm run check-types`             | 型チェックのみ実行           |

## 参考

- ビルドスクリプト: `tools/unified-build.js`
- 型定義生成設定: `tsconfig.backend.dts.json`, `tsconfig.frontend.dts.json`
- ブリッジ生成スクリプト: `tools/create-global-bridge.js` ✨
- インデックス生成スクリプト: `tools/create-dts-index.js`
