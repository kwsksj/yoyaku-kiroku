# AI_INSTRUCTIONS.md (AIへの指示書)

> このファイルは、AIがこのリポジトリで作業する際のルールを定義する。

## 絶対ルール

1. **`build-output/` は編集禁止** - すべての編集は `src/` ディレクトリで行うこと
2. **コード変更後は `npm run dev` を実行** - テスト環境への反映に必須

---

## コマンド

| コマンド           | 用途                                    |
| ------------------ | --------------------------------------- |
| `npm run validate` | チェックのみ（push しない）             |
| `npm run dev`      | **★メイン** 修正 + ビルド + テスト push |
| `npm run release`  | 修正 + ビルド + 本番 push + デプロイ    |

<details>
<summary>その他のコマンド</summary>

| コマンド                | 用途                                    |
| ----------------------- | --------------------------------------- |
| `npm run types:refresh` | 型定義の再生成（`validate` に含まれる） |
| `npm run build:force`   | 品質チェックスキップ（緊急時のみ）      |
| `npm run watch`         | UI微調整時の自動ビルド（ユーザー用）    |

</details>

## 開発フロー

### 作業開始時の規模判断

| 規模   | 条件                            | アクション    |
| ------ | ------------------------------- | ------------- |
| 小     | 1-2ファイル、単純な修正、typo   | main 直接作業 |
| 中〜大 | 3ファイル以上、新機能、設計変更 | ブランチ作成  |

**判断に迷う場合**: ブランチを作成すること

### ブランチ作成時

```bash
git checkout -b feature/機能名  # または fix/バグ内容, refactor/対象
```

### コミット

- 適切な節目で**自動コミット**（ユーザー確認不要）
- コミットメッセージは日本語
- 署名行（`🤖 Generated with ...`）を含める

### 途中で規模が拡大した場合

1. 現在の変更をコミット
2. ブランチに移動: `git stash && git checkout -b feature/... && git stash pop`
3. ユーザーに「規模拡大のためブランチ作成」と報告

### PR作成（ブランチ作業時）

```bash
git push origin feature/機能名
gh pr create --base main
```

**マージはユーザーが行う**（AIはマージしない）

---

## 言語

- ユーザーへの応答は**日本語**で行うこと
- コードコメントも日本語で書くこと

---

## UI開発

UI要素を追加・変更する際は、既存コンポーネントを使用すること:

- `src/frontend/13_WebApp_Components.js` - UI部品（button, modal, card など）
- `src/frontend/11_WebApp_Config.js` - デザイン定義（色、余白、フォント）

**ゼロからHTMLを作成しないこと。**

---

## import 文

`src/` 内では ESM の `import` 文を記述できるが、ビルド時に自動削除される。

**禁止事項:**

- デフォルトインポート
- 別名（`import { foo as bar }`）
- `import * as foo`
- 動的 `import()`

---

## プロジェクト情報

GAS製の木彫り教室予約管理システム「きぼりの よやく・きろく」。

- Googleスプレッドシートをデータベースとして使用
- 開発は `src/` で行い、ビルド後に `build-output/` へ出力

### 関連ドキュメント

| ドキュメント                                          | 内容                 |
| ----------------------------------------------------- | -------------------- |
| [DATA_MODEL.md](docs/DATA_MODEL.md)                   | データモデル設計     |
| [TYPES_GUIDE.md](docs/TYPES_GUIDE.md)                 | 型定義・定数の使い方 |
| [SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md) | アーキテクチャ詳細   |
