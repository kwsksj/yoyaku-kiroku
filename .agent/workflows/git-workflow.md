---
description: Git/GitHubを使った開発フロー
---

# Git/GitHub ワークフロー

## ブランチ戦略

- **main**: 本番環境にデプロイ済みの安定版コード
- **フィーチャーブランチ**: 新機能開発やバグ修正用
  - 命名規則: `feature/機能名`, `fix/バグ内容`, `refactor/対象`

## 開発フロー

1. **ブランチ作成**

   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/your-feature-name
   ```

2. **開発とコミット**
   - 適切な節目でコミット
   - コミット前にユーザーに確認

3. **プルリクエスト作成**

   ```bash
   git push origin feature/your-feature-name
   gh pr create --base main --title "PRタイトル" --body "詳細説明"
   ```

4. **マージ**

   ```bash
   gh pr merge --squash
   git checkout main
   git pull origin main
   ```

## コミットメッセージの形式

```text
fix: 売上ログを別シートに記録するよう修正

会計処理後に売上ログが別スプレッドシートへ書き込まれない問題を修正。

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

- 先頭の `<type>:` は任意（`fix` / `feat` / `refactor` など）
- 署名行（`🤖 Generated with ...`）を必ず含める
