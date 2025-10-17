# 予約管理システム「きぼりの よやく・きろく」

木彫り教室「きぼり」のための Google Apps Script (GAS) 予約管理・受付システム

- **統合予約管理**: 教室別分散データから統合予約シートへの移行完了
- **JavaScript分離開発**: HTML內JavaScript問題を根本解決する革新的アーキテクチャ
- **高パフォーマンス**: マルチレイヤーキャッシュとSpreadsheetManager最適化
- **開発者**: 木彫り教室の唯一の講師であり、経営者であり、このシステムの管理者

## 🚀 **開発環境セットアップ**

```bash
# 依存関係のインストール
npm install
```

## 📁 **プロジェクト構造**

`src/` ディレクトリで開発を行い、ビルドコマンドで `build-output/` に成果物が生成されるアーキテクチャです。

```bash
src/                           # 開発用ソースディレクトリ
├── backend/                   # バックエンド用コード (GASサーバーサイド)
├── frontend/                  # フロントエンド用コード (ブラウザ)
├── shared/                    # フロントエンド・バックエンド共有コード
└── templates/                 # HTMLテンプレート

build-output/                 # GAS同期ファイル（ビルド時に自動生成）

# ... その他の設定ファイル
```

## 🌟 **アーキテクチャの重要な概念**

このプロジェクトは、GASの制約下でモダンな開発体験を実現するため、独自のビルドプロセスと型定義システムを採用しています。

### 1. 開発環境: JSDoc + checkJs + 型定義自動生成

本プロジェクトは、JavaScriptのコードにJSDocで型情報を付与し、TypeScriptの型チェック機能(`checkJs`)でコードの安全性を高める**「JSDoc + `checkJs` + TS型定義ファイル」**というハイブリッドな開発スタイルを採用しています。

- **JSDoc:** ソースコード内に`@param`や`@type`などで型を記述します。
- **`checkJs`:** `tsconfig.json`の設定により、TypeScriptがリアルタイムでコードとJSDocの矛盾をチェックします。
- **型定義自動生成:** `npm run types:generate` を実行すると、JSDocを元にTypeScriptの型定義ファイル (`.d.ts`) が `types/` ディレクトリ以下に自動生成されます。これにより、ファイル間でのコード補完や型参照が可能になります。

#### 型定義生成の仕組み

**生成フロー:**

1. **TypeScriptコンパイラによる型定義抽出** (`tsc --declaration`)
   - `src/backend/`、`src/frontend/`、`src/shared/` の全JSファイルからJSDocを解析
   - TypeScriptの宣言ファイル生成機能を使用して `.d.ts` ファイルを作成
   - `types/generated-*-globals/` ディレクトリに環境別の型定義を生成

2. **環境別インデックス統合** (`tools/create-dts-index.js`)
   - 各 `generated-*-globals/` 内の型定義を統合
   - 各ディレクトリに `index.d.ts` を生成し、すべての型をまとめてexport

3. **グローバル型ブリッジ生成** (`tools/create-global-bridge.js`)
   - export宣言をグローバル宣言（`declare global`）に変換
   - 各ディレクトリに `_globals.d.ts` を生成
   - namespace内のfunction定義も正しく処理（例: `PerformanceLog.start()`）
   - GAS環境ではモジュールシステム（import/export）が使えないため、すべての型をグローバルスコープで利用可能にする

**ディレクトリ構造:**

```
types/
├── generated-backend-globals/    # 自動生成（編集禁止）
│   ├── *.d.ts                    # JSDocから生成された型定義
│   ├── index.d.ts                # 統合インデックス（自動生成）
│   └── _globals.d.ts             # グローバル型ブリッジ（自動生成）
├── generated-frontend-globals/   # 自動生成（編集禁止）
├── generated-shared-globals/     # 自動生成（編集禁止）
├── global-aliases.d.ts           # 手動管理型エイリアス（編集可能）
├── backend-index.d.ts            # 手動管理エントリーポイント（編集可能）
├── frontend-index.d.ts           # 手動管理エントリーポイント（編集可能）
├── core/                         # 手動管理型定義（編集可能）
├── view/                         # 手動管理型定義（編集可能）
└── gas-custom.d.ts               # 手動管理型定義（編集可能）
```

**重要な注意事項:**

- JSDocを編集した後は **必ず `npm run types:refresh`** を実行してください
- `npm run types:check` だけでは型定義が更新されないため、古い型定義のままエラーになります
- `types/generated-*-globals/` 内のファイルは自動生成されるため、直接編集しないでください
- その他の型定義ファイル（`global-aliases.d.ts`, `*-index.d.ts`, `core/`, `view/`, `gas-custom.d.ts`）は手動管理のため、必要に応じて編集できます

### 2. ビルドプロセスによるコード変換

開発のしやすさとGAS環境の互換性を両立させるため、ビルドプロセス (`npm run build` など) 実行時に以下のコード自動変換が行われます。

- **`export`文の除去**: 開発時に使用する `export` キーワードは、GAS環境ではサポートされていません。ビルド時にすべての `export` 文は自動的に除去され、GASのグローバルスコープで関数や変数が定義される形式に変換されます。
- **ファイル結合**: `src`配下の各JavaScriptファイルは、ビルド時に結合され、`build-output`に配置されます。

### 3. フロントエンドとバックエンドの連携

- **原則: 環境の分離**
  - フロントエンド（`frontend/`）はユーザーのブラウザ、バックエンド（`backend/`）はGoogleのサーバーで動作します。両者は物理的に隔離されており、互いの関数や変数を直接参照することはできません。

- **通信方法: `google.script.run`**
  - フロントエンドからバックエンドの関数を呼び出す際は、必ず `google.script.run` を介して非同期で通信します。

- **唯一の例外: 共有定数**
  - `src/shared/00_Constants.js` ファイルのみ、ビルドプロセスによってフロントエンドとバックエンドの両方に組み込まれます。これにより、`CONSTANTS` オブジェクトは両環境から安全に参照できますが、**これが唯一の例外**です。他のファイルや変数は直接共有できません。

## 🧪 **開発ワークフローと主要コマンド**

**1. 開発**

- `src/` ディレクトリ内のファイルを編集します。
- JSDoc（コード内のコメント）を修正した場合は、`npm run types:refresh` を実行して、型定義の更新とチェックを行ってください。

**2. 品質チェックとビルド（コミット前に推奨）**

- `npm run build`
  - コードのフォーマット、Lint、型チェックをすべて実行し、問題がなければビルドを行います。
  - **安全なビルドを保証するための基本コマンドです。**

**3. テスト環境への反映**

- `npm run dev:test`
  - `build` コマンドを実行し、生成されたファイルをテスト環境へプッシュします。
  - `npm run dev:open:test` で、プッシュ後にブラウザで動作確認もできます。

**4. 本番環境へのデプロイ**

- `npm run dev:prod`
  - テスト環境で問題がないことを確認した後、このコマンドでビルドと本番環境へのプッシュを行います。

---

## コマンドリファレンス

**主要コマンド**

- `npm run check`: フォーマット、Lint、型定義の生成・チェックをすべて実行します。
- `npm run build`: `check` を実行後、問題がなければビルドを実行します。
- `npm run build:force`: 品質チェックをスキップして強制的にビルドを実行します。
- `npm run watch`: ファイル変更を監視し、自動でビルド（`build:force`）を実行します。

**型定義関連（推奨順）**

- `npm run types:refresh`: **【最推奨】** 型定義を再生成 → 型チェックを実行。**JSDoc編集後の必須コマンド**
- `npm run types:generate`: 型定義ファイル（`.d.ts`）のみを再生成（型チェックなし）
- `npm run types:check`: 型チェックのみを実行（型定義が最新の場合のみ）

**使い分け:**

- JSDocコメントを編集した → `types:refresh` を実行
- 型定義は最新で、コードだけ変更した → `types:check` を実行
- ビルド前の最終確認 → `npm run build` (内部で `check` が実行される)

**補助コマンド**

- `npm run format`: Prettierによるコードフォーマット。
- `npm run lint:fix`: ESLintによる自動修正。
- `npm run switch:env -- prod|test`: `.clasp.json`を切り替えて、作業環境を変更します。

## 📚 **詳細ドキュメント**

- **[GEMINI.md](GEMINI.md)** - AI (Gemini) 向け開発ガイド。プロジェクトの最も詳細かつ正確なルールブックです。
- **[docs/JS_TO_HTML_ARCHITECTURE.md](docs/JS_TO_HTML_ARCHITECTURE.md)** - JavaScript分離開発アーキテクチャの詳細設計
- **[docs/DATA_MODEL.md](docs/DATA_MODEL.md)** - 統合データモデルの設計仕様

## ✨ **主要機能・特徴**

### JavaScript分離開発アーキテクチャ（2025年9月導入）

- **問題解決**: HTML內JavaScript開発の制約を根本解決
- **開発体験**: VSCodeでのTypeScript支援・ESLint完全対応
- **自動変換**: 開発時JavaScript → デプロイ時HTML統合
- **環境判定**: ビルド時に自動的に環境を判定し`PRODUCTION_MODE`を設定
- **コンポーネントシステム**: Atomic Designによる再利用可能UI部品（Components + DesignConfig）

### 高性能キャッシュシステム

- **マルチレイヤー**: CacheService + SpreadsheetManager二重キャッシュ
- **インクリメンタル更新（v5.0）**: 予約データの差分更新により95%以上高速化
- **分割キャッシュシステム（v5.5）**: 大容量データの自動分割保存

### 企業レベル品質保証

- **エラーハンドリング**: 多重フォールバック機構
- **状態管理**: StateManagerによる統一状態管理
- **API整合性**: フロントエンド・バックエンド完全統合
- **UI一貫性**: Atomic Designによるコンポーネントシステムと統一デザインシステム（DesignConfig）

## ⚠️ **注意**

- **本番影響:** `npm run dev:prod` でユーザーが利用するWebアプリが更新されます
- **設定ファイル:** `.clasp.config.json` には機密情報が含まれGit管理対象外です

**最終更新:** 2025年10月10日 (アーキテクチャ更新とドキュメント整備)
