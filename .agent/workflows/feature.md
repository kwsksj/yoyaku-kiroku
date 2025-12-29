---
description: 新機能開発の開始フロー
---

# /feature ワークフロー

新機能開発を開始する際のフロー。このワークフローを使用すると、ブランチ作成が強制される。

## 1. 要件確認

- 何を実装するか明確にする
- 影響範囲を把握する

## 2. 関連コード・ドキュメントの確認

```bash
# 関連する既存コードを検索
grep -r "キーワード" src/
```

必要に応じて以下を参照:

- @DATA_MODEL.md - データ構造
- @TYPES_GUIDE.md - 型定義
- @SYSTEM_ARCHITECTURE.md - アーキテクチャ

## 3. ブランチ作成

```bash
git checkout main
git pull origin main
git checkout -b feature/機能名
```

## 4. 実装

- 適切な節目で自動コミット

### UI追加・変更時（重要）

1. **既存コンポーネントを確認**
   - `src/frontend/13_WebApp_Components.js` を確認し、再利用できるものを探す
   - `Components.button`, `Components.modal`, `Components.card` など

2. **デザイン定義を確認**
   - `src/frontend/11_WebApp_Config.js` で色、余白、フォントを確認
   - ハードコードせず、定義済みの値を使用

3. **ゼロからHTMLを作成しない**
   - 既存コンポーネントを組み合わせて構築

## 5. 完了後

```bash
git push origin feature/機能名
gh pr create --base main --title "feat: 機能名" --body "説明"
```

**マージはユーザーが行う**
