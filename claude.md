# claude.md (Claudeへの指示書)

> このファイルは、Claude固有の設定と補足情報を記載します。

## 📖 開発ルールとアーキテクチャ

このプロジェクトの開発ルール、ワークフロー、アーキテクチャは **[AI_INSTRUCTIONS.md](AI_INSTRUCTIONS.md)** にまとめられています。

**作業前に必ず確認してください。**

---

## Claude固有の補足

### ツールの並列実行

Claudeは複数の独立したツール呼び出しを並列実行できます。以下の場合は積極的に並列実行してください:

- 複数ファイルの読み込み (`Read`)
- 複数パターンの検索 (`Grep`, `Glob`)
- 独立した複数のBashコマンド

**例:**

```text
同時に以下を実行:
- Read tool: src/backend/01_Code.js
- Read tool: src/frontend/11_WebApp_Config.js
- Grep tool: pattern="doGet"
```

### タスク管理 (TodoWrite)

複雑なタスクや複数ステップが必要な作業では、必ず `TodoWrite` ツールで計画を立ててください:

- ✅ タスク開始前に全体像を把握
- ✅ 各タスクを `in_progress` → `completed` と更新
- ✅ **1つのタスクのみ `in_progress` にする**
- ✅ タスク完了後は**即座に**ステータスを更新

### コミュニケーションスタイル

- 簡潔で技術的に正確な応答を心がけてください
- Github-flavored Markdownでフォーマット

### エラーハンドリング

- エラーが発生した場合は、根本原因を調査してから対処してください
- 推測で進めず、必要に応じてユーザーに確認を取ってください
