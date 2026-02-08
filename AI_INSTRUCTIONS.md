# AI_INSTRUCTIONS.md

GAS製の木彫り教室予約管理システム「きぼりの よやく・きろく」の開発ルール。

## 絶対ルール

1. **`build-output/` は編集禁止** — 自動生成ディレクトリ。すべての編集は `src/` で行う
2. **`types/generated-*/` は編集禁止** — 型定義の自動生成ディレクトリ
3. **コード変更後は `npm run dev` を実行** — ビルド + テスト環境デプロイまで一括で行う
4. **JSDoc（型注釈）を変更したら `npm run types:refresh`** — 型定義の再生成 + 型チェック
5. **応答・コミットメッセージ・コードコメントはすべて日本語**

## コマンド

| コマンド                | 用途                                                                   |
| ----------------------- | ---------------------------------------------------------------------- |
| `npm run dev`           | **メイン**: format修正 + lint修正 + 型再生成 + ビルド + テスト環境push |
| `npm run validate`      | チェックのみ（ビルド・pushしない）                                     |
| `npm run validate:fix`  | 自動修正付きチェック（ビルド・pushしない）                             |
| `npm run types:refresh` | 型定義の再生成 + 型チェック（JSDoc変更後に必須）                       |
| `npm run release`       | 本番デプロイ（テスト確認後のみ使用）                                   |
| `npm run build:force`   | 品質チェックをスキップしてビルド（緊急時のみ）                         |

## プロジェクト構造

```
src/
├── backend/         # GASサーバーサイド (.js → .gs)
├── frontend/        # ブラウザサイド (.js → <script>タグとしてHTMLに統合)
├── shared/          # backend/frontend両方に注入されるコード
│   └── 00_Constants.js  # 定数定義（唯一の共有ファイル）
└── templates/       # HTMLテンプレート
    └── 10_WebApp.html

types/
├── core/            # ドメイン型定義（手動管理・編集可）
├── view/            # フロントエンド型定義（手動管理・編集可）
├── global-aliases.d.ts   # 型エイリアス（手動管理・編集可）
├── gas-custom.d.ts       # GASカスタム型（手動管理・編集可）
└── generated-*-globals/  # 自動生成（編集禁止）

build-output/        # デプロイ対象（自動生成・編集禁止）
tools/               # ビルドツール群
docs/                # 詳細ドキュメント
```

### ファイル命名規則

ファイル名の数字プレフィックスがGASでの実行順序を決定する。

- `00_` — 定数・基盤（Constants, SpreadsheetManager）
- `01_` — エントリーポイント（doGet, doPost, トリガー）
- `02_`〜`03_` — ビジネスロジック（バッチ処理, 通知, Notion同期）
- `04_` — ユーザー認証・管理
- `05_` — API処理（書き込み, 空き枠計算）
- `07_` — キャッシュ管理
- `08_` — エラーハンドリング・ユーティリティ
- `09_` — 統一APIエンドポイント（フロントエンドからの全リクエスト受付）
- `11_` — フロントエンド設定（デザイントークン）
- `12_` — コアロジック（状態管理, データ処理, 検索, モーダル）
- `13_` — UI（コンポーネント, ビュー）
- `14_` — イベントハンドラー

## ビルドシステム

`src/` のコードはビルド時に以下の変換を受ける:

- **backend/\*.js** → `build-output/*.gs` にコピー（`import`/`export` 文は自動削除）
- **frontend/\*.js** → `<script>` タグで包まれ HTML に統合
- **shared/00_Constants.js** → backend・frontend 両方に注入
- **templates/\*.html** → そのままコピー

### import 制約

`src/` 内では ESM の `import`/`export` を記述できるが、ビルド時に自動削除される。以下は**禁止**（ビルドツールが正しく処理できない）:

- デフォルトインポート (`import foo from '...'`)
- 別名 (`import { foo as bar }`)
- ワイルドカード (`import * as foo`)
- 動的インポート (`import()`)

許可される形式:

```javascript
import { ReservationCore } from '../types/core/reservation.d.ts';
export { someFunction };
export const SOME_VALUE = ...;
```

## 型システム

JSDoc + TypeScript `checkJs` によるハイブリッド型チェック。

### 型定義の書き方

```javascript
/**
 * @param {ReservationCore} reservation - 予約データ
 * @param {string} newStatus - 新しいステータス
 * @returns {boolean}
 */
function updateStatus(reservation, newStatus) { ... }
```

### Core型（ドメインモデル）

| 型名                    | 用途             | 定義                          |
| ----------------------- | ---------------- | ----------------------------- |
| `ReservationCore`       | 予約             | `types/core/reservation.d.ts` |
| `UserCore`              | ユーザー         | `types/core/user.d.ts`        |
| `LessonCore`            | レッスン（日程） | `types/core/lesson.d.ts`      |
| `AccountingDetailsCore` | 会計             | `types/core/accounting.d.ts`  |

### 型に関する注意

- `Object` や `any` は使わない — 必ず具体的なCore型を指定
- オプショナルフィールドは `??` や `?.` で安全にアクセスする
- シートデータとCore型の変換は `08_Utilities.js` の `convertRaw*` 関数を使う
- 定数を追加・変更したら `npm run types:refresh` を実行

## 定数

`src/shared/00_Constants.js` に定義。backend/frontend の両方で使える。

```javascript
// 推奨: CONSTANTS 経由でアクセス
if (status === CONSTANTS.STATUS.CONFIRMED) { ... }

// 許容: 直接参照
if (status === STATUS.CONFIRMED) { ... }
```

定数を追加・変更した場合は `npm run types:refresh` で型定義を再生成すること。

## データアクセス

### 読み取り: 常にキャッシュ経由

```javascript
// 正しい
const reservations = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);

// 禁止: シート直接アクセス
const sheet = SS_MANAGER.getSpreadsheet().getSheetByName('統合予約');
```

### 書き込み: シート + インクリメンタル更新

```javascript
writeToSheet(newReservation); // 1. シートに書き込み
addReservationToCache(newReservation); // 2. キャッシュに差分追加
```

- 更新・キャンセル（ステータス変更）は `updateReservationInCache()`（必要に応じて `updateReservationStatusInCache()`）で差分反映する。
- 全体再構築 (`rebuild*Cache()`) は通常は直接呼ばず、インクリメンタル更新が失敗した場合のフォールバックとしてのみ使用する。

## フロントエンド設計

### 単方向データフロー

```
ユーザー操作 → Handlers(14_) → dispatch() → State更新 → render() → Views(13_) → Components(13_) → DOM更新
```

### UI開発

UI要素の追加・変更時は既存の仕組みを使うこと:

| 対象                                       | ファイル                               |
| ------------------------------------------ | -------------------------------------- |
| デザイン定義（色, 余白, フォント）         | `src/frontend/11_WebApp_Config.js`     |
| UIコンポーネント（button, modal, card 等） | `src/frontend/13_WebApp_Components.js` |
| ビュー（画面構築）                         | `src/frontend/13_WebApp_Views_*.js`    |
| イベント処理                               | `src/frontend/14_WebApp_Handlers_*.js` |

**ゼロからHTMLを組み立てない。** 既存コンポーネントを組み合わせて画面を構築する。

### 状態管理

`SimpleStateManager`（`12_WebApp_StateManager.js`）がアプリの唯一の状態管理責任を持つ。

- 状態変更は `dispatch()` 経由
- ビュー関数は状態を読むだけ（書き込まない）
- ハンドラーが状態変更とバックエンド通信を調整

## バックエンド設計

### APIエンドポイント

フロントエンドからの全リクエストは `09_Backend_Endpoints.js` を経由する。フロントエンドからは `google.script.run.エンドポイント名()` で呼び出す。

### キャッシュシステム（07_CacheManager.js）

- CacheServiceベースの多層キャッシュ
- 90KB超のデータは自動チャンク分割（最大20チャンク = 1.8MB）
- 6時間ごとの自動再構築トリガー
- インクリメンタル更新によるリアルタイム反映
- バージョン管理によるフロントエンド差分検出

## 開発時のチェックリスト

### コード追加・変更

- [ ] `src/` 内で編集した（`build-output/` は触っていない）
- [ ] JSDoc型アノテーションを書いた
- [ ] 既存のコンポーネント・ユーティリティを再利用した
- [ ] 定数はハードコードせず `CONSTANTS` を使った
- [ ] データ読み取りは `getCachedData()` 経由にした

### 完了時

- [ ] `npm run dev` が成功した（format + lint + 型チェック + ビルド + push）
- [ ] JSDocを変更した場合は `npm run types:refresh` を実行済み

## 詳細ドキュメント

| ドキュメント                                                          | 内容                               |
| --------------------------------------------------------------------- | ---------------------------------- |
| [SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md)                 | アーキテクチャ全体図・データフロー |
| [DATA_MODEL.md](docs/DATA_MODEL.md)                                   | データモデル・シート構造           |
| [TYPES_GUIDE.md](docs/TYPES_GUIDE.md)                                 | 型定義・定数の使い方               |
| [DATA_ACCESS_PRINCIPLES.md](docs/DATA_ACCESS_PRINCIPLES.md)           | データアクセスパターン             |
| [FRONTEND_ARCHITECTURE_GUIDE.md](docs/FRONTEND_ARCHITECTURE_GUIDE.md) | フロントエンド設計                 |
| [STATE_MANAGEMENT_GUIDE.md](docs/STATE_MANAGEMENT_GUIDE.md)           | 状態管理の仕様                     |
| [JS_TO_HTML_ARCHITECTURE.md](docs/JS_TO_HTML_ARCHITECTURE.md)         | ビルドシステム詳細                 |
