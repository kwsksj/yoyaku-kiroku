# VS Code 開発環境ガイド

このプロジェクトのVS Code開発環境について

## 🔧 **自動設定されている機能**

### フォーマット関連

- **保存時自動フォーマット**: ファイル保存時に自動でPrettierフォーマット
- **右クリックフォーマット**: 従来通り "Format Document" が利用可能
- **一括フォーマット**: `Cmd+Shift+P` → "Tasks: Run Task" → "format"

### Live Server

- **HTMLファイル右クリック** → "Open with Live Server" でローカルサーバー起動
- **ポート5500** で自動起動
- **ホットリロード**: ファイル変更時に自動ブラウザ更新

### GAS開発支援

- **TypeScript型定義**: `@types/google-apps-script` でGAS関数の補完
- **自動保存設定**: ファイル末尾改行、行末空白削除

## 📋 **利用可能なタスク**

`Cmd+Shift+P` → "Tasks: Run Task" で以下が実行可能：

- **format** - 全ファイル一括フォーマット
- **format:src** - srcフォルダのみフォーマット
- **gas:setup** - GASテスト環境セットアップ
- **gas:cleanup** - GASテスト環境クリーンアップ
- **gas:status** - テスト環境状況確認

## 🤖 **AI支援設定**

### GitHub Copilot

- `.copilotignore` で不要ファイルを除外
- `completed-tasks/`, `node_modules/` 等は提案から除外
- `src/gas-tests/` は提案に含む（開発支援）

### Gemini Code Assist

- `.aiexclude` でCopilotと同じ除外設定
- AI切り替え時も一貫した体験

## 🗂️ **ファイル除外設定**

### Git管理対象外

- `node_modules/`, `.DS_Store`, `.clasp.json`
- 個人的なVS Code設定（`launch.json`, `tasks.json`）

### AI提案対象外

- 完了済みタスク、ログファイル、バックアップファイル
- 設定ファイル、アーカイブファイル

## 💡 **開発時のベストプラクティス**

1. **コード編集**: 保存時に自動フォーマット適用
2. **フロントエンドテスト**: Live Serverで即座確認
3. **GASテスト**: 専用コマンドで安全な環境管理
4. **AI活用**: 除外設定により関連性の高い提案を受信
