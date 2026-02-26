# VS Code 開発環境ガイド

このプロジェクトでの VS Code 設定と、推奨の実行コマンドをまとめたメモです。

## エディタ方針

- 保存時の自動フォーマットは **オフ**（`editor.formatOnSave: false`）
  - AI作業や複数ファイル編集時の競合を避けるため
- `Format Document`（Prettier）は常時利用可能
- ESLint の自動修正は `codeActionsOnSave` を `explicit` に設定
  - 明示実行時のみ適用されるため、予期しない差分を抑制

## パフォーマンス最適化

- VS Code の監視対象から以下を除外
  - `build-output/**`
  - `types/generated-*/**`
- 検索対象からも同ディレクトリを除外
  - コード検索とシンボル移動を高速化
- ワークスペースの TypeScript を使用
  - `typescript.tsdk = node_modules/typescript/lib`

## 主要コマンド（CLI）

- 差分に応じたチェック提案
  - `npm run check:plan`
  - `npm run check:plan:final`
- 提案されたチェックを自動実行
  - `npm run check:smart`（必須のみ）
  - `npm run check:smart:all`（任意を含む）
  - `npm run check:smart:final`（最終確認向け）
- GAS疎通確認
  - `npm run smoke:gas`
  - `npm run smoke:gas:deep`
  - `npm run smoke:gas:deploy`

## 補足

- 末尾改行・行末空白・改行コードは `.editorconfig` で統一
- 既存ルールの最終基準は `AI_INSTRUCTIONS.md`
