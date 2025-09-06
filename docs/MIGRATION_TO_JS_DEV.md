# JavaScript分離開発への移行手順書

## 前提条件

- 現在の`src/`フォルダの全ファイルがGASで正常動作していること
- 全ての変更がコミット済みであること
- テスト環境が利用可能であること

## フェーズ1: 基盤準備

### 1. 依存関係インストール

```bash
npm install --save-dev chokidar@^4.0.0
```

### 2. 開発ディレクトリ構造作成

```bash
# 開発用ディレクトリを作成
mkdir -p dev/{backend,frontend,templates}

# 既存srcの安全なバックアップ
cp -r src src_backup_$(date +%Y%m%d_%H%M%S)
```

### 3. ビルドツールの動作確認

```bash
# ビルドツールのテスト実行
npm run dev:build

# 監視モードのテスト（Ctrl+Cで終了）
npm run dev:watch
```

## フェーズ2: ファイル移行（段階的実行）

### 2-1. バックエンドファイル移行

**優先度: 低（単純コピーのため）**

```bash
# バックエンドJSファイルを開発ディレクトリに移動
mv src/00_Constants.js dev/backend/
mv src/01_Code.js dev/backend/
mv src/02-1_BusinessLogic_Batch.js dev/backend/
mv src/02-4_BusinessLogic_ScheduleMaster.js dev/backend/
mv src/04_Backend_User.js dev/backend/
mv src/05-2_Backend_Write.js dev/backend/
mv src/05-3_Backend_AvailableSlots.js dev/backend/
mv src/06_ExternalServices.js dev/backend/
mv src/07_CacheManager.js dev/backend/
mv src/08_ErrorHandler.js dev/backend/
mv src/08_Utilities.js dev/backend/
mv src/09_Backend_Endpoints.js dev/backend/
```

### 2-2. HTMLテンプレート移行

```bash
# WebAppメインテンプレート移行
mv src/10_WebApp.html dev/templates/
```

### 2-3. フロントエンドファイル移行（重要）

**🚨 最も慎重に実行する必要があるステップ**

#### フェーズ2-3a: StateManager移行（最優先）

```bash
# StateManagerファイルを移行準備
cp src/12_WebApp_StateManager.html dev/frontend/12_WebApp_StateManager.js

# HTMLタグとコメントを削除してJavaScript部分のみ抽出
# 以下は手動編集が必要:
# 1. <script>と</script>タグを削除
# 2. HTML特有のコメント（@ts-nocheck等）を調整
# 3. 型チェック問題を解決
```

**手動編集例:**
```javascript
// dev/frontend/12_WebApp_StateManager.js
/**
 * =================================================================
 * 【ファイル名】: 12_WebApp_StateManager.js
 * 【バージョン】: 2.1 (JavaScript分離開発版)
 * 【役割】: シンプルで確実な状態管理システム
 * =================================================================
 */

// TypeScript型定義
/// <reference path="../../html-globals.d.ts" />

// ESLint設定（開発時は完全チェック有効）
/* global CONSTANTS:readonly, STATUS:readonly, ... */

/**
 * シンプルな状態管理システム
 */
class SimpleStateManager {
  // クラス実装はそのまま
}

// グローバルインスタンスを作成
window.stateManager = new SimpleStateManager();
```

#### フェーズ2-3b: その他フロントエンドファイル順次移行

```bash
# 1つずつ慎重に移行
cp src/11_WebApp_Config.html dev/frontend/11_WebApp_Config.js
# 手動編集...

cp src/12_WebApp_Core.html dev/frontend/12_WebApp_Core.js  
# 手動編集...

cp src/13_WebApp_Components.html dev/frontend/13_WebApp_Components.js
# 手動編集...

cp src/13_WebApp_Views.html dev/frontend/13_WebApp_Views.js
# 手動編集...

cp src/14_WebApp_Handlers.html dev/frontend/14_WebApp_Handlers.js
# 手動編集...
```

### 2-4. 各移行後のテスト実行

**各ファイル移行後に必ず実行:**

```bash
# 1. ビルド実行
npm run dev:build

# 2. 型チェック・Lint確認
npm run check

# 3. テスト環境プッシュ
npm run dev:test

# 4. 動作確認（WebApp）
npm run open:dev:test
```

## フェーズ3: 動作検証・最適化

### 3-1. 完全動作テスト

```bash
# フル機能テスト
npm run dev:build
npm run check
npm run dev:test

# WebApp全機能確認
# - ログイン機能
# - 予約作成・編集・削除
# - 会計機能
# - 履歴表示
# - 各種データ取得
```

### 3-2. パフォーマンス確認

- ビルド時間測定
- ファイルサイズ比較（src_backup vs 新src）
- 実行時パフォーマンス確認

### 3-3. 開発効率確認

```javascript
// VSCode内で型チェック・IntelliSense動作確認

// 1. 関数定義ジャンプ（F12）
stateManager.dispatch();

// 2. 型エラー検出
const invalidState = stateManager.getState().nonExistentProperty; // エラー表示されるか？

// 3. オートコンプリート
CONSTANTS.  // <- ドロップダウン表示されるか？
```

## フェーズ4: ワークフロー移行

### 4-1. 新ワークフローへの完全移行

**従来:**
```bash
# 編集: src/ 直接
# テスト: npm run push:test
```

**新ワークフロー:**
```bash
# 編集: dev/ ディレクトリ
# テスト: npm run dev:test
# 監視: npm run dev:watch（開発中）
```

### 4-2. CLAUDE.mdの更新

```markdown
## 新開発ワークフロー (JavaScript分離開発)

### 開発時
- **編集対象**: `dev/backend/`, `dev/frontend/`, `dev/templates/`
- **型チェック**: VSCode + TypeScript Language Server（フル機能）
- **リアルタイム監視**: `npm run dev:watch`

### テスト時  
- **ビルド→テスト**: `npm run dev:test`
- **テスト環境確認**: テスト用WebAppで動作確認

### デプロイ時
- **本番プッシュ**: `npm run dev:prod`
- **本番デプロイ**: `npm run deploy:prod`

### 型安全性
- 開発時: 完全なTypeScript型チェック + ESLint
- デプロイ後: GAS環境でも型情報維持
```

## トラブルシューティング

### 1. ビルドエラー

```bash
# ファイル権限問題
chmod +x tools/js-to-html-builder.js

# 依存関係問題  
npm install
```

### 2. 型チェックエラー

```javascript
// html-globals.d.ts の更新が必要な場合
/// <reference path="../../html-globals.d.ts" />

// 特定の型エラー回避
/** @type {any} */
const problematicVariable = window.someGASSpecificProperty;
```

### 3. 緊急ロールバック

```bash
# 問題発生時の緊急復旧
rm -rf src/
cp -r src_backup_YYYYMMDD_HHMMSS src/
npm run push:test
```

### 4. パフォーマンス問題

```bash
# ファイル監視の除外設定
# .gitignoreに追加:
dev/node_modules/
dev/.cache/
src_backup_*/
```

## 成功指標

### ✅ 移行成功の判断基準

1. **機能面**
   - [ ] 全WebApp機能が新ワークフローで正常動作
   - [ ] ビルド→テスト→デプロイフローが安定動作
   - [ ] 既存GAS環境との100%互換性維持

2. **開発効率面**
   - [ ] VSCodeで完全な型チェック・IntelliSense動作
   - [ ] ESLint/Prettierがfdev/ディレクトリで正常動作  
   - [ ] リファクタリング・コードナビゲーション改善

3. **コード品質面**
   - [ ] HTML內JavaScript型チェック問題の完全解決
   - [ ] 大量ESLintエラーの解消
   - [ ] 保守性・可読性の大幅改善

### 📊 数値目標

- **型チェックエラー**: 200+ → 0
- **開発効率**: HTML内編集 → JavaScript環境（体感3-5倍改善）
- **ビルド時間**: <5秒（ファイル監視モード時）

## 最終確認事項

### 移行完了前チェックリスト

- [ ] src_backupフォルダが安全に保存されている
- [ ] 新ワークフローでの全機能テスト完了
- [ ] package.jsonスクリプトの動作確認完了  
- [ ] CLAUDE.md更新完了
- [ ] チーム内（または自分）への新ワークフロー説明完了

### 移行後の推奨事項

1. **定期的バックアップ**: devディレクトリのGitコミット頻度を上げる
2. **ビルド自動化**: pre-commitフック導入検討
3. **継続的改善**: 型定義ファイルの段階的充実
4. **監視継続**: 新ワークフローでの開発効率とエラー発生率をモニタリング

---

この移行により、GAS開発における現代的なJavaScript開発環境が実現され、型安全性と開発効率が大幅に改善されます。