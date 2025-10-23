# Issue: バックエンド構成の段階的リファクタリング計画

## 背景

バックエンドの主要ファイル（特に `05-2_Backend_Write.js` や `07_CacheManager.js`）が多責務・巨大化しており、以下の課題が顕在化している。

- 予約／通知／キャッシュ／会計処理など異なる関心事が単一ファイルに混在している。
- 型厳格化に伴い補助関数やヘルパーが増加し、可読性・テスト容易性が低下している。
- フロントエンド側と同様に import で依存関係を表現できるようになったが、ファイル構成が従来のままのため恩恵を最大化できていない。

既存の `docs/BACKEND_REORGANIZATION_PLAN.md` では CacheManager を中心とした再編方針を定義しているが、本 Issue ではそれを踏まえて **予約・通知・キャッシュ層全体を段階的にモジュール分割する実装タスク** をまとめる。

## スコープ

- `src/backend/05-2_Backend_Write.js` を予約作成／更新／会計処理などの機能単位で分割する。
- 通知関連 (`02-5`, `02-6`, `02-7`) を再編し、共通テンプレートや送信ロジックを共有化する。
- CacheManager の責務整理（ドメインごとのマネージャー化）を進め、`BACKEND_REORGANIZATION_PLAN.md` の Phase 1-3 を実際のコードへ落とし込む。
- API エンドポイント (`09_Backend_Endpoints.js`) が新構成のマネージャー層を利用するように調整する。

## 進め方（提案）

### Phase A: 予約ロジックの分割

1. `reservations/` ディレクトリを作成し、以下のサブモジュールへ分割
   - `reservation-create.js` / `reservation-update.js` / `reservation-cancel.js` / `reservation-accounting.js`
2. 各モジュールに `withTransaction` やログ処理など共通ヘルパーが必要な場合は `reservations/common.js` を新設。
3. 既存の `05-2_Backend_Write.js` はこれらを re-export するシェルに置き換え、段階的にロジックを移行。

### Phase B: 通知ロジックの統合

1. `notifications/` ディレクトリを作り、共通テンプレート生成・送信ユーティリティを `notifications/common.js` に集約。
2. 管理者通知・生徒通知・月次通知をそれぞれ薄いモジュール (`notifications/admin.js` など) へ再配置。
3. 既存ファイルは新ディレクトリへの移行後に削除し、API からの利用箇所を更新。

### Phase C: CacheManager 再編（`BACKEND_REORGANIZATION_PLAN.md` Phase 1-3 の実装）

1. `06-1_Core_GenericCacheProvider.js` を新規作成し、低レベルなキャッシュ操作関数を移植。
2. ドメインごとのマネージャーファイル（`06-2_Manager_Schedule.js` など）を作成し、予約・生徒・会計のキャッシュ操作を移譲。
3. 既存モジュール（予約更新、available slots など）から新マネージャーを呼び出すように調整。

### Phase D: API エンドポイントとテスト

1. `09_Backend_Endpoints.js` をリソース単位（`auth`, `reservations`, `accounting` 等）へ整理し、新マネージャーを利用。
2. `AI_INSTRUCTIONS.md` や関連ドキュメントをアップデートし、新しい責務分担を明文化。
3. `npm run types:check:*` / `npm run validate` を段階ごとに実行し、Strict モードで問題がないことを確認。

## 成果物

- 分割後の新しいディレクトリ／ファイル群
- 更新済みのドキュメント（`AI_INSTRUCTIONS.md`、関連ガイド）
- 機能回帰が確認できるテスト記録（型チェック・手動確認の範囲）

## 注意事項

- 作業は大規模なため、**別ブランチで段階ごとに PR を作成**し、レビューしながら進める。
- 既存の `BACKEND_REORGANIZATION_PLAN.md` に進捗を追記し、Issue から参照できるようにする。
- 各フェーズでユーザー向け挙動の変化がないかをチェックし、必要であればテスト環境で `npm run ai:test` を用いて UI 動作確認を行う。

---

この Issue を起点に、段階的なリファクタリング計画・実施状況を追跡する。質問や追加アイデアがあればコメントで共有してください。@gemini-code-assist @chatgpt-codex-connector @Claude
