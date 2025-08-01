# テストファイルの使い方

このプロジェクトには、フロントエンド機能をテストするためのHTMLファイルが含まれています。

## 🚀 簡単な実行方法

### Live Server を使用（推奨）

1. テストファイル（例：`integration_test.html`）を右クリック
2. `Open with Live Server` を選択
3. ブラウザで自動的に開かれます

### メリット

- **ホットリロード**: ファイル編集時に自動でブラウザがリロード
- **ワンクリック起動**: 右クリックですぐにテスト開始
- **リアルタイム確認**: デザインやレイアウトの変更を即座に確認

## 📁 テストファイル一覧

- `integration_test.html` - WebApp全体の統合テスト
- `test_webapp_functions.html` - WebApp関数のユニットテスト
- `test_loading_messages.html` - ローディングメッセージのUIテスト
- `test_memo_edit.html` - メモ編集機能のテスト
- `test_venue_display.html` - 会場表示機能のテスト

## 💡 Tips

- Live Serverが起動していない場合は、任意のHTMLファイルを右クリックして `Open with Live Server` を選択してください
- テストファイルはモックデータを使用しているため、GASに接続せずに動作確認ができます
- デザインやレイアウトの調整時に便利です
