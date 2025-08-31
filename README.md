# 予約管理システム「きぼりの よやく・きろく」

木彫り教室「きぼり」のための Google Apps Script (GAS) 予約管理・受付システム

- **統合予約管理**: 教室別分散データから統合予約シートへの移行完了
- **モダンアーキテクチャ**: データアクセス層抽象化とサービス層設計
- **開発者**: 木彫り教室の唯一の講師であり、経営者であり、このシステムの管理者

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
src/                    # GAS同期ファイル
├── 00_Constants.js    # 統一定数管理
├── 01_Code.js         # エントリーポイント
├── 02-*_BusinessLogic_*.js  # ビジネスロジック層
├── 02-5_BusinessLogic_ReservationService.js  # NEW: サービス層
├── 03_DataAccess.js   # NEW: データアクセス抽象化層
├── 05-*_Backend_*.js  # バックエンドAPI
├── 07_CacheManager.js # キャッシュ管理
├── 09_Backend_Endpoints.js  # 統合エンドポイント
└── 1*_WebApp.html     # Webアプリケーション

~~test/~~              # ローカルテスト（現在非稼働）
tools/                 # ビルド・環境管理ツール
docs/                  # 詳細ドキュメント
examples/              # リファクタリング例
```

## 🧪 **テスト実行**

### GAS環境テスト（推奨）

テスト環境は **head deployment ID** 設定により即座にWebAppに反映されます：

```bash
# 1. テスト環境にコードをプッシュ
npm run push:test

# 2. テスト環境のWebAppを開く（変更が即座に反映）
npm run open:dev:test

# 3. 手動テストを実行
# 4. 問題がなければ本番デプロイ
npm run push:prod
```

### ~~ローカルテスト~~

~~ローカルHTML生成機能は現在非稼働です。直接GAS環境でテストしてください。~~

## 🔧 開発コマンド

プロジェクトのビルド、テスト、デプロイ、コード品質管理に使用するスクリプトです。

### ~~ローカル開発~~

- ~~`npm run build` - ローカルHTML生成（現在非稼働）~~
- ~~`npm run watch` - ファイル監視・自動ビルド（現在非稼働）~~

**現在の推奨開発フロー**: 直接 `src/` ファイルを編集 → `npm run push:test` → GAS環境でテスト

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

### 現在の開発フロー

- **コード編集:** `src/` ファイルを直接編集
- **テスト:** `npm run push:test` → GAS環境で即座にテスト
- **品質管理:** コミット前に `npm run check` を実行
- **本番反映:** `npm run push:prod` で本番環境更新

### 新アーキテクチャ活用

- **データアクセス:** `repositories.*` オブジェクト使用推奨
- **ビジネスロジック:** `reservationService.*` 等のサービス層活用
- **統合予約シート:** 本番環境移行準備完了

### AI支援

- **Claude Code指示:** `CLAUDE.md` に開発ガイド記載
- **環境切り替え:** `npm run switch:env -- prod|test`

## ⚠️ **注意**

- **本番影響:** `npm run push:prod` でユーザーが利用するWebアプリが更新されます
- **設定ファイル:** `.clasp.config.json` には機密情報が含まれGit管理対象外です
- **環境切り替え:** `npm run switch:env` は `.clasp.json` を上書きします
- **新機能開発:** データアクセス抽象化層(`03_DataAccess.js`)とサービス層(`02-5_*Service.js`)の活用を推奨

### 段階的移行状況

- ✅ **フェーズ1**: データアクセス抽象化基盤完成
- ⏳ **フェーズ2**: 既存コードの段階的移行
- 📋 **フェーズ3**: 統合予約シート完全移行

---

**最終更新:** 2025年8月31日 **バージョン:** 2.0.0 (Data Access Layer Abstraction)
