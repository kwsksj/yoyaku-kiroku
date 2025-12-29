# AI_INSTRUCTIONS.md (AIへの指示書)

> このファイルは、このリポジトリでAIと開発作業を行う際の、ルールとガイドラインを定義します。

## 最重要ルール (Top Priority Rules)

このセクションは、このプロジェクトで作業する上での最も重要なルールです。何をするにも、まずこれらのルールを最優先してください。

1. **編集対象は `src/` のみ:**
   - **絶対に `build-output/` ディレクトリ内のファイルは編集しないでください。** すべての開発作業は `src/` ディレクトリで行います。

2. **ビルド結果の確認:**
   - `src/` を編集した後は、**必要に応じてビルドや型チェックを実行し、問題がないことを確認**してください。
   - テスト環境への反映には `npm run dev:test` を使用します。

3. **定義済みのワークフローに従う:**
   - 開発、テスト、本番反映の一連の作業は、後述の `開発ワークフローと主要コマンド` に記載された手順とコマンドに厳密に従ってください。

4. **UIコンポーネントの再利用:**
   - フロントエンドのUI要素を追加・変更する際は、必ず `src/frontend/13_WebApp_Components.js` に定義された既存のコンポーネントと `src/frontend/11_WebApp_Config.js` のデザイン定義を再利用してください。ゼロからHTMLを作成しないでください。

5. **開発時の`import`文は依存関係の明示用途に限定:**
   - `src/` 内ではESMの`import`文を記述できますが、ビルド時に自動削除されるため、**同名のグローバル識別子を参照する目的にのみ使用してください**。
   - **禁止事項:** デフォルトインポート、別名（`import { foo as bar }`）、`import * as foo`、動的`import()`は使用しないでください。削除後にローカル識別子が残らず、実行時エラーを引き起こします。
   - すべての`import`はファイル先頭のトップレベルで記述し、末尾にセミコロンを付けてください。

---

## 開発ワークフローと主要コマンド

開発からデプロイまでの基本的な流れは以下の通りです。原則として、ここに記載されたコマンドを使用してください。

**1. 開発**

- `src/` ディレクトリ内のファイルを編集します。
- JSDocの追加・修正を行った場合は、`npm run types:refresh` を実行して型定義を更新・チェックします。

**2. 品質チェックとビルド**

- `npm run validate`
  - フォーマット、Lint、型定義生成・チェックをすべて実行します（チェックのみ）。
- `npm run validate:fix`
  - フォーマット自動修正、Lint自動修正、型定義生成・チェックを実行します。
- `npm run build`
  - `validate` を実行後、`build-output`に成果物を生成します。
  - エラーがある場合はビルドが停止します。

**3. テスト環境への反映と確認**

- `npm run fix-push:test`
  - **【ユーザー推奨】** 改修後の標準コマンド。
  - 自動修正(`validate:fix`)を行い、テスト環境へプッシュします（デプロイなし）。
  - ユーザーが即座にテスト・確認を行うために使用します。

---

## コマンドリファレンス

**主要コマンド**

- `npm run validate`: フォーマット、Lint、型定義の生成・チェックをすべて実行します（チェックのみ）。
- `npm run validate:fix`: フォーマットの修正、Lintの自動修正、型定義の生成・チェックを順次実行します。
- `npm run build`: `validate` を実行後、問題がなければビルドを実行します。
- `npm run build:force`: 品質チェックをスキップして強制的にビルドを実行します。
- `npm run watch`: ファイル変更を監視し、自動でビルド（`build:force`）を実行します。

**型定義関連（推奨順）**

- `npm run types:refresh`: **【最推奨】** 型定義を再生成 → 型チェックを実行。**JSDoc編集後の必須コマンド**
- `npm run types:generate`: 型定義ファイル（`.d.ts`）のみを再生成（型チェックなし）
- `npm run types:check`: 型チェックのみを実行（型定義が最新の場合のみ）

**使い分け:**

- JSDocコメントを編集した → `types:refresh` を実行
- 型定義は最新で、コードだけ変更した → `types:check` を実行
- ビルド前の最終確認 → `npm run build` (内部で `validate` が実行される)

**フォーマット・Lint**

- `npm run format`: Prettierによるフォーマットチェック（修正なし）。
- `npm run format:fix`: Prettierによるフォーマット自動修正。
- `npm run lint`: ESLintによるLintチェック（修正なし）。
- `npm run lint:fix`: ESLintによる自動修正。
- `npm run lint:md`: Markdownファイルのチェック。
- `npm run lint:md:fix`: Markdownファイルの自動修正。

**デプロイ関連**

- `npm run fix-push:test`: **【ユーザー推奨】** `validate:fix` + テスト環境へのプッシュ（デプロイなし）。
- `npm run ai:test`: `validate:fix` + テスト環境へのデプロイ（バージョン発行）。

**URL取得（MCP DevTools用）**

- `npm run url:exec:test`: テスト環境の公開WebApp URL取得。

**注意**: スクリプトエディタのURLはGoogleログインが必要なため、MCP DevToolsでは開けません。

## AIへの指示

### 基本原則

- **最重要ルールの遵守**: ファイル冒頭の「最重要ルール」を常に最優先してください。
- **ワークフローの遵守**: `開発ワークフローと主要コマンド` に記載された手順に厳密に従ってください。
- **既存コードの尊重**: 既存のコードスタイル、命名規則、アーキテクチャを尊重し、一貫性を保ってください。

### コードの再利用と重複防止（DRY原則）

新しい関数やロジックを実装する前に、以下の手順で既存コードを確認してください：

1. **既存ユーティリティの検索**: 実装しようとしている機能が既に存在しないか確認
   - `14_WebApp_Handlers_Utils.js`: 共通ハンドラーユーティリティ
   - `12_WebApp_Core_*.js`: コアロジック関連ユーティリティ
   - `08_Utilities.js`: バックエンド共通ユーティリティ

2. **パターンの抽象化**: 同じようなロジックを2回以上書く場合は、ヘルパー関数に抽出することを検討
   - 例: 状態判定、データ変換、UI生成パターン

3. **共通関数の配置先**:
   - フロントエンドの共通ロジック → `14_WebApp_Handlers_Utils.js`
   - 検索・フィルタリング → `12_WebApp_Core_Search.js`
   - バックエンドの共通ロジック → `08_Utilities.js`

4. **重複を発見した場合**: 既存コードに重複パターンを見つけた場合は、リファクタリングを提案してください

### コミュニケーションと言語

- **主要言語**: **恒久的に日本語を使用してください。** ユーザーへの応答、作成するドキュメント、コミットメッセージなど、すべての出力は日本語で行ってください。
- **コードコメント**: 新しいコメントを追加する際は、日本語で記述してください。
- **ユーザーの好み**: 開発者は、より深い理解のために日本語でのコミュニケーションを強く希望しています。英語での出力は避けてください。

### Git/GitHubワークフロー

このプロジェクトでは、GitHubを使用してコード管理とコラボレーションを行います。以下のワークフローに従ってください。

#### ブランチ戦略

- **mainブランチ**: 本番環境にデプロイ済みの安定版コード
- **フィーチャーブランチ**: 新機能開発やバグ修正用の一時的なブランチ
  - 命名規則: `feature/機能名`, `fix/バグ内容`, `refactor/対象`
  - 例: `feature/new-ui`, `fix/cache-bug`, `refactor/accounting-module`

#### 開発フロー

1. **ブランチ作成**

   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/your-feature-name
   ```

2. **開発とコミット**
   - 適切な節目（機能完成、バグ修正、重要な変更点）でコミット
   - コミット前にユーザーに確認: 「コミットしますか？」
   - コミットメッセージは日本語で明確に記述

   ```bash
   git add -A
   git commit  # コミットメッセージはエディタで編集
   ```

3. **プルリクエスト作成**
   - 作業完了後、リモートにプッシュしてPRを作成
   - PRタイトルと説明は日本語で明確に

   ```bash
   git push origin feature/your-feature-name
   gh pr create --base main --title "PRタイトル" --body "詳細説明"
   ```

4. **レビューと修正**
   - AIレビューコメント（Gemini Code Assist, ChatGPT Codex）を確認
   - 必要に応じて修正を追加コミット

5. **マージ**
   - レビュー承認後、PRをマージ
   - マージ後はローカルのmainブランチを更新

   ```bash
   gh pr merge --squash  # または --merge
   git checkout main
   git pull origin main
   ```

#### コミット管理のベストプラクティス

- **積極的なコミット**: 機能の完成、バグ修正、アーキテクチャの変更など、適切な節目でコミット
- **ユーザーへの確認**: コミット前に必ず確認を取る
- **コミットの品質**: 変更内容と影響を明確に説明する日本語のコミットメッセージ
- **コミットメッセージの形式例**:

  ```
  fix: 売上ログを別シートに記録するよう修正

  会計処理後に売上ログが別スプレッドシートへ書き込まれない問題を修正。
  SpreadsheetManagerに外部シート用キャッシュを追加し、売上ログ書き込み処理で利用。

  🤖 Generated with [Codex CLI](https://github.com/openai/codex-cli)
  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  ```

  - 先頭の `<type>:` は任意ですが、`fix` / `feat` / `refactor` などを付けると履歴管理がしやすくなります。
  - 変更内容に応じて説明の詳細度を調整してください（小さな修正は簡潔に、複雑な変更は背景も含めて記述）。
  - コミットに関与したAIごとに署名行（`🤖 Generated with ...` など）を必ず含めてください。

#### GitHub操作コマンド

- `gh pr create`: プルリクエスト作成
- `gh pr view [番号]`: PR詳細確認
- `gh pr merge [番号]`: PRマージ
- `gh pr list`: PR一覧表示
- `gh issue create`: Issue作成
- `gh repo view --web`: リポジトリをブラウザで開く

### Markdown品質ガイドライン

- **見出しの使用**: セクションタイトルには、強調（**太字**）ではなく、適切なレベルの見出し（`##`など）を使用してください。
- **見出しの重複**: 同じ内容の見出しを複数作成しないでください（例: `## まとめ` が複数あるなど）。
- **コードブロックの言語指定**: コードブロックには常に言語（javascript, text, json, bash, htmlなど）を指定してください。

### タスク管理とTODO

- **`docs/TODO.md`**: プロジェクトのタスク、バグ、アイデアを管理するファイルです。
- **Inbox（未整理メモ）**: ユーザーが思いついたことを自由に記述する場所です。AIは定期的にこのセクションを確認し、適切なカテゴリー（Bugs, UI Improvements, Features）に整理・分類してください。
- **運用ルール**: ユーザーがInboxにメモを追加したら、AIはそれを構造化データに変換する役割を担います。

---

## プロジェクト概要

このプロジェクトは、木彫り教室の予約管理システム「きぼりの よやく・きろく」です。Google Apps Script（GAS）で構築されており、Googleスプレッドシートをデータベースとして使用し、Webアプリケーションのインターフェースを提供します。

開発者は、木彫り教室の唯一の講師であり、経営者であり、このシステムの管理者です。

### ✅ データモデル再設計 完了

教室ごとに分散していたデータ構造から、統合・正規化されたデータモデルへの移行に成功し、大幅なパフォーマンス改善を実現しました。詳細設計: **[DATA_MODEL.md](docs/DATA_MODEL.md)**

### 🚀 JavaScript分離開発アーキテクチャ (2025年9月6日導入)

**HTML内JavaScript問題の根本解決**: 開発時は純粋なJavaScriptファイルで作業し、デプロイ時に自動的にHTML形式に変換するハイブリッドアーキテクチャを導入しました。 **詳細設計**: [JS_TO_HTML_ARCHITECTURE.md](docs/JS_TO_HTML_ARCHITECTURE.md)

---

## アーキテクチャ概要

### 開発環境: JSDoc + checkJs + 型定義自動生成

このプロジェクトは、GASの制約下でモダンな開発体験を実現するため、以下の3つの技術を組み合わせた特殊な開発環境を採用しています。

1. **JSDocによる型付け:** ソースコード（`.js`）内にJSDoc形式で`@param`や`@type`などを記述し、型情報を定義します。
2. **`checkJs`によるリアルタイム検証:** `tsconfig.json`の`checkJs`設定により、TypeScriptコンパイラがJSDocとコードの間に矛盾がないかを常に監視します。
3. **型定義ファイルの自動生成システム:** `npm run types:generate`コマンドにより、JSDocからTypeScriptの型定義ファイル（`.d.ts`）を自動生成し、ファイル間でのコード補完や型参照を実現します。

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

#### 型エラーの対処法：インデックスシグネチャではなく型定義を修正する

型チェックでエラーが発生した場合、**安易にインデックスシグネチャ（`state['propertyName']`）を使った回避策を取らず**、根本的な型定義を修正してください。

**❌ 避けるべき対処法:**

```javascript
// ブラケット記法での回避（推奨しない）
const value = state['expandedLessonId'];
```

**✅ 推奨される対処法:**

1. **手動管理の型定義ファイルを修正する**（`types/core/`, `types/view/` など）

   ```typescript
   // types/view/state.d.ts
   export interface UIState {
     expandedLessonId?: string | null; // 不足していたプロパティを追加
     selectedParticipantsClassroom?: string;
     showPastLessons?: boolean;
     // ...
   }
   ```

2. **ソースコードではドット記法を使用する**

   ```javascript
   // 型定義修正後はドット記法でアクセス可能
   const value = state.expandedLessonId;
   ```

**このアプローチの利点:**

- **型安全性の向上**: TypeScript が正確な型推論を提供
- **コードの可読性**: ドット記法の方が自然で読みやすい
- **IDEサポート**: オートコンプリートとエラー検出が機能する
- **保守性**: プロパティ名のタイポを型チェックで検出できる

**型定義の修正対象:**

- `UIState` インターフェース: `types/view/state.d.ts`
- Core型定義: `types/core/` 配下のファイル
- グローバルエイリアス: `types/global-aliases.d.ts`

### ビルドプロセスによるコード変換

開発のしやすさとGAS環境の互換性を両立させるため、ビルドプロセス (`npm run build` など) 実行時に以下のコード自動変換が行われます。

1. **`import` / `export` 文の除去:**
   - 開発中は依存関係を明示するために `import` / `export` を記述できますが、GAS環境ではサポートされていません。
   - ビルド時に静的`import`文と`export`文は自動的に取り除かれ、GASのグローバルスコープで関数や変数が定義される形式に変換されます。
   - これにより、開発者はエディタ補完と依存関係の明示を享受しつつ、実行時互換性を保てます。

2. **定数ファイルの注入:**
   - `src/shared/00_Constants.js` は、フロントエンドとバックエンドの両方に自動的に組み込まれます。（詳細は「フロントエンドとバックエンドの境界」を参照）

3. **環境変数の設定:**
   - `CONSTANTS.ENVIRONMENT.PRODUCTION_MODE` の値が、ビルドターゲット（本番 or テスト）に応じて `true` または `false` に自動的に設定されます。

### 開発時の `import` 文ガイドライン

- 依存関係を明示する目的で `src/` の各ファイル冒頭に `import` を追加できます。
- 変換後はグローバル参照に戻るため、**インポート名は元の識別子と同じものを使用し、別名・デフォルト・ワイルドカードインポートは禁止**です。
- `import()` を含む動的インポートや条件付きインポートはサポート対象外です。必要な場合は従来どおりグローバルを直接参照してください。

### ファイル構成

開発はすべて `src/` ディレクトリ内で行います。ビルド後、この構造が `build-output/` に反映されます。

- **`src/backend/`**
  - サーバーサイド（Googleのサーバー上）で実行されるロジックです。APIエンドポイント、データベース（スプレッドシート）操作、GASのコア機能が含まれます。
  - 例: `01_Code.js`, `05-2_Backend_Write.js`, `07_CacheManager.js`

- **`src/frontend/`**
  - フロントエンド（ユーザーのブラウザ上）で実行されるロジックです。UIのビュー、コンポーネント、イベントハンドラなどが含まれます。
  - 例: `11_WebApp_Config.js`, `13_WebApp_Components.js`, `14_WebApp_Handlers.js`

- **`src/shared/`**
  - **（最重要）** フロントエンドとバックエンドの両方で共有されるコードを配置します。
  - `00_Constants.js`: プロジェクト全体の定数ファイル。ビルド時に両方の環境に組み込まれる**唯一の共有ファイル**です。

- **`src/templates/`**
  - フロントエンドのベースとなるHTMLテンプレートです。ビルドプロセスで、`frontend/` と `shared/` のJavaScriptファイルがこのHTMLに統合されます。
  - `10_WebApp.html`

### フロントエンドとバックエンドの境界

- **原則:** フロントエンドとバックエンドは物理的に異なる環境で動作するため、互いの関数や変数を直接参照することはできません。
- **通信:** フロントエンドからバックエンドへの通信は、必ず `google.script.run` を介して非同期で行います。
- **唯一の例外:** `src/shared/00_Constants.js` のみ、ビルドプロセスによって両環境でグローバルな `CONSTANTS` オブジェクトとして利用可能になります。**他のファイルや変数はこの仕組みの対象外です。**

### データモデルとキャッシュ

Googleスプレッドシートをベースにした統合データモデル。詳細は [DATA_MODEL.md](docs/DATA_MODEL.md) を参照。

**多層キャッシュ**:

- **CacheService**: GASの組み込みキャッシュ。予約、生徒名簿などを6-24時間保持。
  - **差分更新システム (v5.0)**: 予約変更時に全件リロードせず、差分のみを更新することで95%以上の高速化を実現。
  - **分割キャッシュシステム (v5.5)**: 90KBを超えるデータを自動で分割し、100KBの制限を回避。
- **SpreadsheetManager**: スプレッドシートオブジェクトのセッション内キャッシュ。

### フロントエンドアーキテクチャ

**UIコンポーネントシステム (アトミックデザイン)**

- **場所**: `src/frontend/13_WebApp_Components.js`
- **設計原則**: 小さな部品（Atomic）から大きなUI（Organisms）を構築。再利用性を重視。
- **主要コンポーネント**: `Components.button`, `Components.modal`, `Components.cardContainer` など、定義済みのUI部品を常に使用してください。

**デザインシステム (DesignConfig)**

- **場所**: `src/frontend/11_WebApp_Config.js`
- **設計原則**: 色、余白、タイポグラフィなどのデザイン要素を定数として一元管理。ハードコードは禁止。
