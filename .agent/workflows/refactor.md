---
description: リファクタリングの開始フロー
---

# /refactor ワークフロー

既存コードのリファクタリングを行う際のフロー。振る舞いを変えずにコードを改善する。

## 1. 対象コードの分析

- 何が問題か明確にする（重複、複雑さ、命名、構造など）
- 影響を受けるファイルを特定する

## 2. 関連コードの検索

```bash
# 関数名、変数名で検索
grep -r "関数名" src/

# 呼び出し箇所を把握
grep -rn "関数名(" src/
```

## 3. ブランチ作成（必須）

```bash
git checkout main
git pull origin main
git checkout -b refactor/対象
```

## 4. 段階的にリファクタリング

- **小さな変更ごとにコミット**
- 各段階で `npm run dev` で動作確認
- **振る舞いを変えない**（機能追加は /feature で行う）

### リファクタリングの原則

1. **DRY（Don't Repeat Yourself）**
   - 重複コードをヘルパー関数に抽出

2. **単一責任の原則**
   - 1つの関数は1つのことだけを行う

3. **命名の改善**
   - 意図が明確な名前に変更

4. **影響範囲の最小化**
   - 変更は必要最小限に

## 5. 動作確認

```bash
npm run dev
```

- リファクタリング前と同じ動作をすることを確認

## 6. PR作成

```bash
git push origin refactor/対象
gh pr create --base main --title "refactor: 対象" --body "説明"
```

**マージはユーザーが行う**
