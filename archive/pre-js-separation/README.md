# フロントエンドHTMLファイル アーカイブ

**作成日**: 2025年9月6日  
**理由**: JavaScript分離開発アーキテクチャ導入前の安全バックアップ

## 格納ファイル

| ファイル名 | 役割 | 移行先 |
|------------|------|--------|
| `11_WebApp_Config.html` | 設定・定数定義 | `dev/frontend/11_WebApp_Config.js` |
| `12_WebApp_Core.html` | 中核機能・ユーティリティ | `dev/frontend/12_WebApp_Core.js` |
| `12_WebApp_StateManager.html` | 状態管理システム | `dev/frontend/12_WebApp_StateManager.js` |
| `13_WebApp_Components.html` | UIコンポーネント | `dev/frontend/13_WebApp_Components.js` |
| `13_WebApp_Views.html` | 画面生成関数 | `dev/frontend/13_WebApp_Views.js` |
| `14_WebApp_Handlers.html` | イベント処理・アクション | `dev/frontend/14_WebApp_Handlers.js` |

## 新システムとの違い

### 従来システム (このアーカイブ)
- 各ファイルが`<script>`タグで包まれたHTML形式
- GASの`<?!= include() ?>`で個別読み込み
- HTML內JavaScript型チェック問題あり

### 新システム (JavaScript分離開発)
- 開発時は純粋なJavaScriptファイル (`dev/frontend/*.js`)
- ビルド時に`src/10_WebApp.html`に自動統合
- 完全な型チェック・IntelliSense対応

## 復元方法

緊急時の復元が必要な場合：

```bash
# アーカイブから元のファイルを復元
cp archive/pre-js-separation/*.html src/

# 従来のGAS環境にプッシュ
npm run push:test
```

## 削除予定

新システムでの安定稼働確認後（約1ヶ月後）、このアーカイブディレクトリは削除予定。