# GAS環境でのテストファイル

このフォルダには、Google Apps Script環境でのみ実行可能なテストファイルが含まれています。

## 🚫 **重要な注意事項**

- **`skipSubdirectories: true`** の設定により、このフォルダ内のファイルは**GASエディタに同期されません**
- 本番環境への意図しない混入を防ぐ安全な開発環境です

## 📁 **ファイル構造**

```text
gas-tests/
├── 📋 README.md                    # このファイル
├── 🔧 gas-test.sh                  # テスト実行スクリプト
├──
├── core/                           # 基本機能テスト
│   ├── test-spreadsheet-manager.js    # SpreadsheetManager テスト
│   ├── test-performance.js            # パフォーマンステスト
│   ├── test-integration.js            # 統合テスト
│   ├── test-runner.js                 # テストランナー
│   └── test-functions-legacy.js       # レガシーテスト関数
├──
├── features/                       # 機能別テスト
│   ├── test-name-population.js        # 名前自動入力テスト
│   ├── test-error-handling.js         # エラーハンドリングテスト
│   └── test-error-handling-legacy.js  # レガシーエラーテスト
├──
├── regression/                     # 回帰テスト
│   └── test-regression.js             # 包括的回帰テスト
├──
└── webapp/                         # WebApp関連テスト
    └── performance-test.html          # WebAppパフォーマンステスト
```

## 🎯 **各ディレクトリの役割**

### **core/** - コア機能テスト

- **test-spreadsheet-manager.js**: SpreadsheetManager最適化テスト
- **test-performance.js**: 負荷テスト・パフォーマンス比較
- **test-integration.js**: システム統合テスト
- **test-runner.js**: テスト実行・結果集約
- **test-functions-legacy.js**: 旧テスト関数（統合予定）

### **features/** - 機能別テスト

- **test-name-population.js**: 名前自動入力機能テスト
- **test-error-handling.js**: エラーハンドリングテスト
- **test-error-handling-legacy.js**: 旧エラーテスト（統合予定）

### **regression/** - 回帰テスト

- **test-regression.js**: 包括的回帰テスト・最適化検証

### **webapp/** - WebApp関連テスト

- **performance-test.html**: フロントエンドパフォーマンステスト

### 🧪 **テスト関数**

- `test_functions.js` - 主要機能のユニットテスト
  - `testSpreadsheetManagerFunction()` - スプレッドシート管理機能
  - `testAvailableSlotsFunction()` - 予約枠取得機能
  - `testLoginFlowFunction()` - ログイン処理
  - `runAllTests()` - 全テスト実行

### ⚡ **パフォーマンステスト**

- `load_test_functions.js` - 負荷テスト関数
  - `loadTestSpreadsheetManager()` - スプレッドシート管理の負荷テスト
  - `compareLoadTest()` - パフォーマンス比較

### 👤 **名前自動補完テスト**

- `test_name_auto_population.js` - 名前自動補完機能のテスト
  - `testNameAutoPopulation()` - 名前自動補完のテスト
  - `testNameLookup()` - 名前検索のテスト

### 🌐 **WebAppパフォーマンステスト**

- `test_performance_webapp.html` - WebApp全体のパフォーマンステスト

## 🚀 **テストファイルをGAS環境で実行する方法**

### 方法1: 手動でメインプロジェクトにコピー

```bash
# 必要なテストファイルをsrc/直下にコピー
cp src/gas-tests/test_functions.js src/
clasp push
```

### 方法2: 開発専用ブランチで実行

```bash
# 開発ブランチを作成
git checkout -b test-environment

# テストファイルをsrc/に移動
mv src/gas-tests/*.js src/
mv src/gas-tests/*.html src/

# GASに同期
clasp push

# テスト終了後、元に戻す
git checkout main
```

## 💡 **ベストプラクティス**

1. **テスト開発時**: このフォルダで安全に開発
2. **テスト実行時**: 必要なファイルのみ一時的にコピー
3. **テスト完了後**: ファイルをこのフォルダに戻す
4. **本番デプロイ時**: テストファイルが混入しないことを確認

## 🛡️ **セキュリティ**

- 本番環境にテストコードが混入するリスクを排除
- 開発とテストの分離による安全性の確保
- 意図しないデータ操作の防止
