# フロントエンド設計ガイド

## 1. 基本方針

このアプリケーションのフロントエンドは、コードの可読性、保守性、拡張性を高めるために、以下の設計方針に基づいています。

- **役割ベースの命名規則**: ファイル名は、そのファイルが持つ「役割」を明確に示します。これにより、ファイル名からその内容を容易に推測できます。
- **番号プレフィックスの廃止**: `01_` や `12_` のような、無意味で混乱を招きやすい番号付けは行いません。
- **関心の分離 (SoC)**: 各ファイルは単一の責任を持ちます。「状態管理」「画面表示」「ユーザー操作の処理」など、異なる関心事を明確に異なるファイルに分離します。

## 2. ファイル構成案

上記の基本方針に基づき、フロントエンドのファイル構成を以下のように定義します。

| 新ファイル名                    | 役割                 | 説明                                                                               |
| :------------------------------ | :------------------- | :--------------------------------------------------------------------------------- |
| `WebApp.html`                   | **土台 (親ページ)**  | ユーザーが最初にアクセスするHTMLの骨格。他の全てのJS部品ファイルを読み込む。       |
| `Frontend_App.js.html`          | **アプリの心臓部**   | アプリケーションの起動処理、`render()`関数など、全体を制御する中核ロジック。       |
| `Frontend_StateManager.js.html` | **状態管理**         | `stateManager`を定義し、アプリケーション全体のデータ（状態）を一元管理する。       |
| `Frontend_Handlers.js.html`     | **ユーザー操作処理** | `actionHandlers`を定義し、ボタンクリックなどユーザーの操作に応じた処理を記述する。 |
| `Frontend_Views.js.html`        | **画面生成**         | `getLoginView()`など、各画面の完全なHTMLを構築する関数群。                         |
| `Frontend_Components.js.html`   | **UI部品**           | `Components.button()`など、画面を構成する再利用可能な小さなUI部品。                |
| `Frontend_Utils.js.html`        | **汎用ヘルパー**     | モーダル表示や日付フォーマットなど、特定の機能に依存しない便利ツール。             |
| `Frontend_Config.js.html`       | **UI設定**           | `DesignConfig`を定義し、アプリケーション全体の配色やスタイルを一元管理する。       |
| `Frontend_Accounting.js.html`   | **会計ロジック**     | 複雑な会計計算に関連する専門的なロジックを分離・集約する。                         |

## 3. コードの分割ルール

- **`Frontend_App.js.html` に書くべきこと:**
  - `render()` 関数
  - アプリケーション起動時のイベントリスナー設定 (`window.onload`)
  - サーバーからデータを取得し、`stateManager` に反映させる統括的な関数

- **`Frontend_Handlers.js.html` に書くべきこと:**
  - `actionHandlers` オブジェクトの定義
  - `data-action` 属性に対応する、具体的な処理内容
  - バックエンドAPI (`google.script.run`) の呼び出し
  - `stateManager.dispatch()` を通じた状態変更の依頼

- **`Frontend_Views.js.html` に書くべきこと:**
  - `get...View()` という名前の、各画面のHTMLを返す関数のみ
  - `Components` オブジェクトを呼び出して、UI部品を組み合わせて画面を構築する

- **`Frontend_StateManager.js.html` に書くべきこと:**
  - `SimpleStateManager` クラスの定義
  - `window.stateManager` のインスタンス生成

## 4. 読み込み関係

親である `WebApp.html` が、`<?!= include(...) ?>` を使って、上記で定義された全ての `Frontend_*.js.html` ファイルを読み込み、一つのアプリケーションとして機能させます。

```html
<!-- WebApp.html の想定される読み込み部分 -->

<!-- 設定 -->
<?!= include('Frontend_Config.js'); ?>

<!-- 状態管理 -->
<?!= include('Frontend_StateManager.js'); ?>

<!-- アプリケーションコア -->
<?!= include('Frontend_App.js'); ?>

<!-- UI部品 -->
<?!= include('Frontend_Components.js'); ?>
<?!= include('Frontend_Views.js'); ?>

<!-- 機能別ロジック -->
<?!= include('Frontend_Handlers.js'); ?>
<?!= include('Frontend_Accounting.js'); ?>
<?!= include('Frontend_Utils.js'); ?>
```
