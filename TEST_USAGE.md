# テストファイルの使い方

このプロジェクトには、**2つの異なるテスト環境**があります。

## 🎯 **テスト環境の分類**

### 🖥️ **ローカルテスト**（`local-tests/`）

- **対象**: フロントエンド機能・UI・レイアウト
- **実行環境**: ブラウザ（Live Server）
- **データ**: モックデータ使用
- **特徴**: GAS接続不要、デザイン確認に最適

### ☁️ **GAS環境テスト**（`src/gas-tests/`）

- **対象**: バックエンド機能・スプレッドシート連携・パフォーマンス
- **実行環境**: Google Apps Scriptエディタ
- **データ**: 実際のスプレッドシートデータ
- **特徴**: 本番環境と同じ条件でのテスト

## 🚀 簡単な実行方法

### ローカルテスト（Live Server使用・推奨）

1. `local-tests/`内のテストファイル（例：`integration_test.html`）を右クリック
2. `Open with Live Server` を選択
3. ブラウザで自動的に開かれます

### メリット

- **ホットリロード**: ファイル編集時に自動でブラウザがリロード
- **ワンクリック起動**: 右クリックですぐにテスト開始
- **リアルタイム確認**: デザインやレイアウトの変更を即座に確認
- **GAS接続不要**: ネットワーク環境に依存しない

### GAS環境テスト（バックエンド機能）

```bash
npm run gas:setup      # テスト環境準備
# GASエディタでテスト実行
npm run gas:cleanup    # 環境クリーンアップ
```

#### 実行可能なテスト関数例

- `runDirectTest()` - 基本機能テスト
- `runRegressionTest()` - 回帰テスト
- `loadTestSpreadsheetManager()` - パフォーマンステスト

## 📁 テストファイル一覧

### ローカルテスト（`local-tests/`）

- `integration_test.html` - WebApp全体の統合テスト
- `test_webapp_functions.html` - WebApp関数のユニットテスト
- `test_loading_messages.html` - ローディングメッセージのUIテスト
- `test_memo_edit.html` - メモ編集機能のテスト
- `test_venue_display.html` - 会場表示機能のテスト

### GAS環境テスト（`src/gas-tests/`）

#### core/ - 基本機能

- `test-spreadsheet-manager.js` - SpreadsheetManager最適化テスト
- `test-performance.js` - 負荷テスト・パフォーマンス比較
- `test-integration.js` - システム統合テスト

#### features/ - 機能別

- `test-name-population.js` - 名前自動入力機能テスト
- `test-error-handling.js` - エラーハンドリングテスト

#### regression/ - 回帰テスト

- `test-regression.js` - 包括的回帰テスト

## ⚠️ **重要な区別**

### ローカルテストでできること

- ✅ UI/UXの確認
- ✅ レスポンシブデザインの検証
- ✅ JavaScript関数のロジック確認
- ✅ 静的データでの動作確認

### ローカルテストでできないこと

- ❌ 実際のスプレッドシートとの連携
- ❌ Google Apps Script固有の機能
- ❌ 認証・権限関連の処理
- ❌ サーバーサイドのパフォーマンス測定

### GAS環境テストでしかできないこと

- ✅ SpreadsheetApp等のGAS APIテスト
- ✅ 実データでのパフォーマンス測定
- ✅ 権限・認証の動作確認
- ✅ trigger関数の動作確認
- ✅ キャッシュ機能の検証

## 💡 Tips

### 開発フロー推奨

1. **フロントエンド作業**: ローカルテストで UI/UX を確認
2. **バックエンド作業**: GAS環境テストで実機能を検証
3. **統合確認**: 両方のテストで最終確認

### 注意事項

- **ローカルテスト**: Live Serverが起動していない場合は、任意のHTMLファイルを右クリックして `Open with Live Server` を選択
- **GAS環境テスト**: 実際のスプレッドシートを操作するため、テスト用環境での実行を推奨
- **データ保護**: 本番データでのテスト実行時は必ずバックアップを作成

### パフォーマンス確認

- **ローカル**: UIレスポンス速度、レイアウト崩れの確認
- **GAS環境**: サーバー処理時間、API呼び出し回数の測定
