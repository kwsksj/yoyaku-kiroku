# 予約管理システム「きぼりの よやく・きろく」

- Google Apps Script(GAS) で構築された木彫り教室の予約管理・受付システム
- 開発者は、木彫り教室の唯一の講師であり、経営者であり、このシステムの管理者

## 🚀 **開発環境セットアップ**

```bash
# 依存関係のインストール
npm install

# コードフォーマット
npm run format

# 設定確認
npm run gas:status
```

## 📁 **プロジェクト構造**

```bash
src/                    # GAS同期ファイル（本番環境）
├── 01_Code.js         # エントリーポイント
├── 02-*_BusinessLogic_*.js  # ビジネスロジック
├── 05-*_Backend_*.js  # バックエンドAPI
└── 1*_WebApp.html     # Webアプリケーション

test/           # ローカル環境テスト（Live Server使用）
tools/
docs/                  # 詳細ドキュメント
```

## 🧪 **テスト実行**

### ローカルテスト（フロントエンド）

#### 手動テスト

1. `test/10_WebApp_Unified_Test.html` を右クリック
2. "Open with Live Server" を選択
3. ブラウザで画面遷移・主要機能を手動で確認

### GAS環境テスト

実際の機能テストはGASのテスト環境で行います：

1. `npm run push:test` - テスト環境にコードをプッシュ
2. `npm run open:dev:test` - テスト環境の開発用URLを開く
3. Webアプリで手動テストを実行
4. 問題がなければ `npm run deploy:prod` で本番デプロイ

## 🔧 開発コマンド

プロジェクトのビルド、テスト、デプロイ、コード品質管理に使用するスクリプトです。

### ローカル開発

- `npm run build`
  - `src`内のWebアプリ関連ファイルを`test/10_WebApp_Unified_Test.html`に統合し、ローカルでのテスト環境を構築します。

- `npm run watch`
  - `src`内のファイルの変更を監視し、変更があるたびに自動で`npm run build`を実行します。ローカルでの開発時に便利です。

### デプロイ (本番/テスト環境)

**セットアップ:** 最初に `clasp.config.json` ファイルに、本番用(`prod`)とテスト用(`test`)の `deploymentId` を設定してください。

- `npm run push:prod` / `npm run push:test`
  - 指定した環境（本番/テスト）にソースコードをプッシュ（アップロード）します。

- `npm run deploy:prod` / `npm run deploy:test`
  - 指定した環境にソースコードをプッシュし、Webアプリとしてデプロイを更新します。ユーザーに影響があるのはこのコマンドです。

- `npm run open:dev:prod` / `npm run open:dev:test`
  - 指定した環境に最新コードを**プッシュ**し、開発用URL（`clasp open-web-app`で開かれるURL）をブラウザで開きます。`deploy`コマンドを実行せずに最新コードを素早く確認したい場合に使用します。GASエディタの「デプロイをテスト」に相当します。

### コード品質

- `npm run check`
  - `prettier`によるフォーマットチェックと`eslint`による静的解析をまとめて実行します。

- `npm run format`
  - `prettier`を使い、プロジェクト全体のコードを自動でフォーマットします。

- `npm run lint` / `npm run lint:fix`
  - `eslint`を使い、コードの静的解析と自動修正を実行します。

## ⚙️ **設定ファイル**

- `.prettierrc.json` - コードフォーマット設定
- `jsconfig.json` - JavaScript/TypeScript設定
- `.vscode/settings.json` - VS Code設定
- `.clasp.json` - GAS同期設定
- `.clasp.config.json` - テスト環境・本番環境のプッシュ・デプロイ設定
- `.copilotignore` / `.aiexclude` - AI支援除外設定

## 📚 **詳細ドキュメント**

- **[CLAUDE.md](CLAUDE.md)** - Claude Code向け開発ガイド（開発コマンド、アーキテクチャ概要）

## 📝 **開発メモ**

- **環境切り替え:** `npm run switch:env -- prod|test` で本番/テスト環境を切り替え
- **ローカル開発:** `npm run watch` で自動ビルド
- **テスト:** `npm run push:test` でテスト環境でテスト
- **デプロイ:** `npm run deploy:prod` で本番反映
- **コード品質:** コミット前に `npm run check` を実行
- **AI支援:** `CLAUDE.md` にAI向け指示を記載

## ⚠️ **注意**

- `test/10_WebApp_Unified_Test.html` は自動生成されるため、直接編集しないでください。
- `npm run deploy:prod` を実行すると、ユーザーが利用するWebアプリが更新されます。
- `.clasp.config.json` には機密情報（`scriptId`など）が含まれるため、Git管理から除外されています。
- `npm run switch:env` は `.clasp.json` を上書きします。

---

**最終更新:** 2025年8月20日 **バージョン:** 1.2.0
