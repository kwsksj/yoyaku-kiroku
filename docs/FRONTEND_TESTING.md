# フロントエンドスタンドアロンテスト環境

このドキュメントでは、Google Apps Script バックエンドなしでフロントエンドを単体でテストする方法を説明します。

## 目次

- [概要](#概要)
- [セットアップ](#セットアップ)
- [開発サーバーの起動](#開発サーバーの起動)
- [テストの実行](#テストの実行)
- [モックシステム](#モックシステム)
- [テストの書き方](#テストの書き方)
- [トラブルシューティング](#トラブルシューティング)

## 概要

このプロジェクトでは、フロントエンドをスタンドアロンでテストするために以下のツールを使用しています：

- **Vite**: 高速な開発サーバー
- **Vitest**: ユニットテスト フレームワーク
- **Playwright**: E2E（エンドツーエンド）テスト フレームワーク
- **Mock System**: `google.script.run` API をエミュレート

### アーキテクチャ

```
┌─────────────────────────────────────────────────────┐
│  フロントエンド (HTML/JavaScript)                   │
├─────────────────────────────────────────────────────┤
│  環境検出レイヤー (00_Environment.js)               │
├─────────────────┬───────────────────────────────────┤
│  開発モード      │  本番モード                       │
│  ↓              │  ↓                                │
│  モック          │  実際のGoogle Apps Script         │
│  google.script  │  google.script.run                │
└─────────────────┴───────────────────────────────────┘
```

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Playwright ブラウザのインストール

E2Eテストを実行する場合、Playwright のブラウザをインストールします：

```bash
npm run playwright:install
```

## 開発サーバーの起動

### 基本的な起動

```bash
npm run dev
```

ブラウザが自動で開きます（デフォルト: http://localhost:3000）

### ブラウザを自動で開く

```bash
npm run dev:open
```

### 開発モードの特徴

開発サーバーを起動すると、以下の機能が有効になります：

1. **モックバックエンド**: `google.script.run` の呼び出しがモックに転送されます
2. **ホットリロード**: ファイルを変更すると自動的にブラウザがリロードされます
3. **デバッグツール**: ブラウザのコンソールでモックデータを確認できます

### デバッグツールの使用

開発モードでは、以下のユーティリティがブラウザコンソールで利用可能です：

```javascript
// モックストレージをリセット
__mockUtils__.resetStorage();

// 現在のストレージ状態を表示
__mockUtils__.getStorage();

// モックフィクスチャデータを表示
__mockUtils__.getMockData();
```

## テストの実行

### ユニットテスト

```bash
# ウォッチモード（変更を監視して自動実行）
npm test

# 1回だけ実行
npm run test:run

# UIモードで実行（ブラウザでテスト結果を表示）
npm run test:ui

# カバレッジレポート付きで実行
npm run test:coverage
```

### E2Eテスト

```bash
# ヘッドレスモードで実行
npm run test:e2e

# UIモードで実行
npm run test:e2e:ui

# ブラウザを表示して実行
npm run test:e2e:headed

# デバッグモードで実行
npm run test:e2e:debug
```

### すべてのテストを実行

```bash
npm run test:all
```

## モックシステム

### モックの仕組み

開発環境では、`google.script.run` への呼び出しが自動的にモックバックエンドに転送されます。

#### 自動検出

環境検出レイヤー (`src/frontend/00_Environment.js`) が以下の条件で自動的にモックモードを有効化します：

- Vite 開発サーバーで実行中
- `localhost` または `127.0.0.1` からアクセス
- `google.script.run` が未定義（GAS環境外）

#### モックデータ

テスト用のモックデータは `test/fixtures/mock-data.js` で定義されています：

```javascript
// ユーザーデータ
export const mockUser = {
  phone: '09012345678',
  studentId: 'STU001',
  name: 'テスト太郎',
  // ...
};

// レッスンデータ
export const mockLessons = [
  {
    lessonId: 'LESSON001',
    date: '2025-12-01',
    startTime: '14:00',
    // ...
  },
];
```

#### サポートされるAPI

以下のバックエンドエンドポイントがモックされています：

- `getLoginData(phone)` - ログイン
- `getRegistrationData(userData)` - 新規登録
- `makeReservationAndGetLatestData(reservationInfo)` - 予約作成
- `cancelReservationAndGetLatestData(cancelInfo)` - 予約キャンセル
- `getBatchData(dataTypes, phone, studentId)` - データ一括取得
- `getCacheVersions()` - キャッシュバージョン取得
- `updateProfile(profileData)` - プロフィール更新

### モックデータのカスタマイズ

モックデータを変更する場合：

1. `test/fixtures/mock-data.js` を編集
2. 必要に応じて `test/mocks/backend-handlers.js` のロジックを調整

## テストの書き方

### ユニットテストの例

```javascript
// test/unit/my-component.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { mockBackendHandlers } from '../mocks/backend-handlers.js';

describe('My Component', () => {
  beforeEach(() => {
    // 各テスト前にモックストレージをリセット
    resetMockStorage();
  });

  it('should login successfully', async () => {
    const response = await mockBackendHandlers.getLoginData('09012345678');

    expect(response.success).toBe(true);
    expect(response.user.name).toBe('テスト太郎');
  });
});
```

### E2Eテストの例

```javascript
// test/e2e/my-flow.spec.js
import { test, expect } from '@playwright/test';

test('complete user flow', async ({ page }) => {
  await page.goto('/');

  // ログイン
  await page.locator('input[type="tel"]').fill('090-1234-5678');
  await page.locator('button:has-text("ログイン")').click();

  // アサーション
  await expect(page.locator('text=テスト太郎')).toBeVisible();
});
```

## ディレクトリ構造

```
test/
├── mocks/
│   ├── google-script-mock.js      # google.script.run のモック実装
│   ├── backend-handlers.js        # バックエンドエンドポイントのモック
│   └── setup-dev.js               # 開発環境セットアップ
├── fixtures/
│   └── mock-data.js               # テスト用モックデータ
├── unit/
│   ├── backend-handlers.test.js   # ユニットテスト: バックエンドハンドラ
│   └── google-script-mock.test.js # ユニットテスト: モックAPI
├── e2e/
│   ├── login.spec.js              # E2Eテスト: ログイン
│   └── reservation.spec.js        # E2Eテスト: 予約
└── setup.js                       # Vitest グローバルセットアップ
```

## 設定ファイル

### vite.config.js

Vite開発サーバーとVitestの設定

```javascript
export default defineConfig({
  server: {
    port: 3000,
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./test/setup.js'],
  },
});
```

### playwright.config.js

Playwright E2Eテストの設定

```javascript
export default defineConfig({
  testDir: './test/e2e',
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
  },
});
```

## トラブルシューティング

### 開発サーバーが起動しない

```bash
# ポート3000が既に使用されている場合
lsof -ti:3000 | xargs kill -9

# または、vite.config.js でポートを変更
```

### テストが失敗する

```bash
# モックストレージをリセット
# ブラウザコンソールで：
__mockUtils__.resetStorage();

# または、テストコードで：
import { resetMockStorage } from '../mocks/backend-handlers.js';
resetMockStorage();
```

### Playwrightのブラウザが見つからない

```bash
# ブラウザを再インストール
npm run playwright:install
```

### 型エラーが出る

```bash
# 型定義を再生成
npm run types:refresh
```

## 本番環境との切り替え

### 環境の自動検出

コードは自動的に環境を検出します：

- **開発環境**: localhost、Vite開発サーバー → モック使用
- **本番環境**: Google Apps Script WebApp → 実際のバックエンド使用

### 手動で環境を確認

```javascript
import { getEnvironment, isDevMode } from '@frontend/00_Environment.js';

console.log(getEnvironment()); // 'development' or 'production'
console.log(isDevMode()); // true or false
```

## 継続的インテグレーション (CI)

GitHub Actionsなどで自動テストを実行する場合：

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:run
      - run: npm run playwright:install
      - run: npm run test:e2e
```

## まとめ

このテスト環境により、以下が可能になります：

✅ Google Apps Script バックエンドなしでフロントエンドを開発
✅ 高速な開発サイクル（ホットリロード）
✅ 自動テストによる品質保証
✅ 本番環境との自動切り替え

質問や問題がある場合は、プロジェクトの Issues セクションで報告してください。
