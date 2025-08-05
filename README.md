# 予約管理システム「きぼりの よやく・きろく」

Google Apps Script (GAS) で構築された予約管理・受付システム

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

1. HTMLファイルを右クリック
2. "Open with Live Server" を選択

### GAS環境テスト（バックエンド）

## 🔧 **開発コマンド**

```bash
# コードフォーマット
npm run format              # 全ファイル一括
npm run format:src          # srcフォルダのみ
npm run format:check        # フォーマット確認

```

## ⚙️ **設定ファイル**

- `.prettierrc.json` - コードフォーマット設定
- `jsconfig.json` - JavaScript/TypeScript設定
- `.vscode/settings.json` - VS Code設定
- `.clasp.json` - GAS同期設定（`skipSubdirectories: true`）
- `.copilotignore` / `.aiexclude` - AI支援除外設定

## 📚 **詳細ドキュメント**

- **[システムアーキテクチャ仕様書](docs/ARCHITECTURE.md)** - 詳細な仕様とアーキテクチャ
- **[ロードマップ](docs/roadmap.md)** - 将来計画と機能拡張予定
