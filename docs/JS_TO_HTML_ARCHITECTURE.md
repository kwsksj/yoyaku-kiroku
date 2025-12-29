# JavaScript分離開発アーキテクチャ設計書

## 概要

現在のHTML内JavaScript開発の型チェック・IntelliSense問題を根本解決するため、開発時はJavaScriptファイルとして作業し、デプロイ時にHTML形式に自動変換するハイブリッドアーキテクチャを導入。

## GAS特有制約の対応

### 1. エントリーポイント制約

- `doGet()`, `doPost()` → バックエンドJSファイルで管理
- トリガー関数 → グローバルスコープ維持
- 実行順序 → ファイル名による番号付け維持

### 2. 実行環境制約

- V8ランタイム → ESモジュール使用不可、CommonJS形式で開発
- HTMLファイル內JavaScript → `<script>`タグ自動生成で対応
- `google.script.run` → フロントエンド側で通常通り使用可能

### 3. ファイル構造制約

- `.gs`+`.html`のみ → ビルド時に自動変換
- ファイル名順実行 → 番号付けファイル名維持

## ディレクトリ構造

### 開発時構造 (`dev/`)

```
dev/
├── backend/           # バックエンドJavaScript (.js → .js)
│   ├── 00_Constants.js
│   ├── 01_Code.js
│   ├── 02-1_BusinessLogic_Batch.js
│   ├── 02-4_BusinessLogic_ScheduleMaster.js
│   ├── 04_Backend_User.js
│   ├── 05-2_Backend_Write.js
│   ├── 05-3_Backend_AvailableSlots.js
│   ├── 06_ExternalServices.js
│   ├── 07_CacheManager.js
│   ├── 08_ErrorHandler.js
│   ├── 08_Utilities.js
│   └── 09_Backend_Endpoints.js
├── frontend/          # フロントエンドJavaScript (.js → .html)
│   ├── 11_WebApp_Config.js
│   ├── 12_WebApp_Core.js
│   ├── 12_WebApp_StateManager.js
│   ├── 13_WebApp_Components.js
│   ├── 13_WebApp_Views.js
│   └── 14_WebApp_Handlers.js
└── templates/         # HTMLテンプレート
    └── 10_WebApp.html
```

### デプロイ時構造 (`src/`) - 自動生成

```
src/
├── 00_Constants.js                    # backend/ からコピー
├── 01_Code.js                         # backend/ からコピー
├── 02-1_BusinessLogic_Batch.js       # backend/ からコピー
├── [その他バックエンド.js]           # backend/ からコピー
├── 10_WebApp.html                     # templates/ からコピー
├── 11_WebApp_Config.html             # frontend/ から変換
├── 12_WebApp_Core.html               # frontend/ から変換
├── 12_WebApp_StateManager.html       # frontend/ から変換
├── 13_WebApp_Components.html         # frontend/ から変換
├── 13_WebApp_Views.html              # frontend/ から変換
└── 14_WebApp_Handlers.html           # frontend/ から変換
```

## ビルドプロセス

### 自動変換の流れ

1. **バックエンドファイル処理**

   ```bash
   dev/backend/*.js → src/*.js (コピー)
   ```

2. **フロントエンドファイル処理**

   ```bash
   dev/frontend/*.js → src/*.html (スクリプトタグ包装)
   ```

3. **テンプレートファイル処理**

   ```bash
   dev/templates/*.html → src/*.html (コピー)
   ```

### HTML自動生成テンプレート

```html
<script>
  // @ts-check
  /// <reference path="../html-globals.d.ts" />

  // グローバル変数宣言（完全なGAS環境対応）
  /* global CONSTANTS:readonly, STATUS:readonly, ... */

  // ESLint設定
  /* eslint-disable no-undef */

  // TypeScript設定
  // @ts-nocheck (必要に応じて @ts-check に変更可能)

  /**
   * 自動変換ファイル情報
   * 元ファイル: dev/frontend/11_WebApp_Config.js
   * 変換日時: 2025-09-06
   */

  // 元のJavaScriptコンテンツをここに挿入
  [JAVASCRIPT_CONTENT];
</script>
```

## 開発ワークフロー

### 1. 開発モード

```bash
# ファイル監視モード開始
npm run dev:watch

# 手動ビルド
npm run dev:build
```

### 2. テストフロー

```bash
# 1. 開発 → ビルド → テスト環境プッシュ
npm run dev:build && npm run push:test

# 2. テスト環境で動作確認
npm run open:dev:test
```

### 3. 本番デプロイ

```bash
# 1. 最終ビルド
npm run dev:build

# 2. 本番環境プッシュ
npm run push:prod

# 3. 本番デプロイ
npm run deploy:prod
```

## 型チェック・IntelliSense向上

### 開発時の利点

1. **完全なTypeScript型チェック**

   ```javascript
   // dev/frontend/12_WebApp_StateManager.js
   /**
    * @typedef {Object} StateManager
    * @property {Object} state
    * @property {function} dispatch
    */

   /** @type {StateManager} */
   const stateManager = new SimpleStateManager();
   ```

2. **ESLintフル機能**

   ```javascript
   // dev/backend/01_Code.js
   function doGet(e) {
     // ESLintがparameter未使用を正しく検出
   }
   ```

3. **VSCode完全対応**
   - Import文認識
   - 関数定義ジャンプ
   - リファクタリング支援
   - デバッグ機能

### HTML変換後も型チェック維持

- `/// <reference path="../html-globals.d.ts" />`
- `/* global */` 宣言による型情報保持
- 必要に応じて `// @ts-check` 有効化可能

## マイグレーション戦略

### フェーズ1: 基盤構築

1. ビルドツール実装 ✅
2. ディレクトリ構造作成
3. package.json統合

### フェーズ2: ファイル移行

1. 優先度高ファイルから順次移行
   - `12_WebApp_StateManager.html` (最も複雑)
   - `13_WebApp_Components.html` (大容量)
   - その他フロントエンドファイル

### フェーズ3: 完全移行

1. 全ファイル移行完了
2. 従来ワークフローの廃止
3. 新ワークフローの標準化

## 利点とリスク評価

### 利点

✅ **完全な型チェック・IntelliSense**  
✅ **開発効率の大幅改善**  
✅ **コードレビュー品質向上**  
✅ **VSCode統合開発環境**  
✅ **既存GAS互換性100%維持**

### リスク軽減

⚠️ **ビルド工程追加** → npm scripts統合で透過化  
⚠️ **学習コスト** → 段階的移行で緩和  
⚠️ **デバッグ複雑化** → ソースマップ対応検討

## 結論

このアーキテクチャにより、GAS開発の型安全性と開発効率を根本的に改善しながら、既存システムとの完全な互換性を維持できます。特にフロントエンドのHTML內JavaScript問題を完全解決し、現代的なJavaScript開発環境を実現します。
