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

`src/` ディレクトリで開発を行い、`npm run dev:build` などのコマンドで `build-output/` に成果物が生成されるアーキテクチャです。

```bash
src/                           # JavaScript分離開発環境
├── backend/                   # バックエンドファイル（.gs）
├── frontend/                  # フロントエンドファイル（.js）
└── templates/                 # HTMLテンプレート

build-output/                 # GAS同期ファイル（自動生成）

# ... その他の設定ファイル
```

詳細は `GEMINI.md` のアーキテクチャ概要を参照してください。

## 🧪 **開発ワークフローと主要コマンド**

開発からデプロイまでの基本的な流れは以下の通りです。原則として、ここに記載されたコマンドを使用してください。

**1. 開発**

- `src/` ディレクトリ内のファイルを編集します。

**2. 品質チェック（コミット前）**

- `npm run check`
  - Prettier, ESLint, Markdownlint, 型チェックをまとめて実行します。

**3. テスト環境への反映と確認**

- `npm run dev:test`
  - 変更をビルドし、テスト環境へプッシュします。
  - ブラウザで動作確認が必要な場合は `npm run dev:open:test` を使用します。

**4. 本番環境へのデプロイ**

- `npm run dev:prod`
  - テスト環境で問題がないことを確認した後、このコマンドでビルドと本番環境へのプッシュを行います。
  - ブラウザでの確認も同時に行う場合は `npm run dev:open:prod` を使用します。

**環境判定機能:**

- ビルド時に `PRODUCTION_MODE` が自動で設定されます（本番環境: `true`, テスト環境: `false`）。
- テスト環境では、管理者への通知メールの件名に `[テスト]` というプレフィックスが自動で追加されます。

---

## コマンドリファレンス

**補助コマンド**

- `npm run format`: Prettierによるコードフォーマット。
- `npm run lint:fix`: ESLintによる自動修正。
- `npm run dev:build`: ビルドのみを実行します（通常は`dev:test`や`dev:prod`に含まれます）。
- `npm run dev:watch`: ファイル変更を監視し、自動でビルドを実行します。
- `npm run switch:env -- prod|test`: `.clasp.json`を切り替えて、作業環境を変更します。

## 📚 **詳細ドキュメント**

- **[GEMINI.md](GEMINI.md)** - AI (Gemini) 向け開発ガイド。プロジェクトの最も詳細かつ正確なルールブックです。
- **[docs/JS_TO_HTML_ARCHITECTURE.md](docs/JS_TO_HTML_ARCHITECTURE.md)** - JavaScript分離開発アーキテクチャの詳細設計
- **[docs/DATA_MODEL.md](docs/DATA_MODEL.md)** - 統合データモデルの設計仕様

## 🌟 **主要機能・特徴**

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

**最終更新:** 2025年10月7日 (ドキュメント整理)
