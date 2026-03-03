# Cloudflare D1移行における `media-platform` 連携検討メモ

**作成日**: 2026年3月3日  
**ステータス**: Draft（検討段階）  
**位置づけ**: 実装前の論点整理・意思決定補助資料

## 1. 目的

- `CLOUDFLARE_D1_MIGRATION_PLAN.md` のうち、`media-platform` 連携に関する詳細論点を分離し、検討しやすくする。
- 実装に入る前に、互換性・性能・運用負荷の観点で選択肢を比較する。

## 2. 前提（現時点）

- `media-platform` は `/participants-index` / `/students-index` / `/tags-index` と `schedule_index.json` を利用する運用がある。
- 予約系の正本を D1 に移すと、少なくとも `participants/schedule` の index は生成起点を D1 側へ移す必要がある。
- `students/tags` の index は、移行初期は既存経路を維持する前提で互換性を優先する。
- ただし、移行初期から `media-platform` を全面改修する前提にはしない。

## 3. 論点

1. `media-platform` は D1 を直接読むべきか、index JSON を継続すべきか。  
2. どの画面・処理を「最新性優先（D1直読）」にし、どこを「低遅延優先（JSON）」にするか。  
3. 互換性維持期間をどの程度設けるか。  
4. 生成遅延や不整合が発生した際の運用手順をどこまで自動化するか。

## 4. 選択肢比較

| 案 | 概要 | 利点 | 懸念 |
| --- | --- | --- | --- |
| A | index JSON 継続（D1は内部のみ） | 既存互換が高い、UI影響が小さい | 鮮度は非同期生成に依存 |
| B | `media-platform` も全面D1直読 | 鮮度が高く同期不要 | 影響範囲が大きい、初期移行リスク高 |
| C | ハイブリッド（用途別） | リスク分散しながら段階移行できる | 設計・運用ルールの明文化が必要 |

## 5. 推奨（現時点）

推奨は **C: ハイブリッド**。

- 予約可否に影響する処理は D1 直読（Worker API経由）。
- `media-platform` の初期ロードや候補表示は、当面 index JSON 維持。
- `participants/schedule` の index は D1 から再生成する二次データとして扱う。
- `students/tags` は既存配信経路を維持しつつ、契約固定後に再設計する。
- 破壊的変更は v2 互換を並行提供してから切替判定する。

## 6. 実装前に決めるべき事項（未確定）

| 項目 | 決定内容 | 期限 | ステータス |
| --- | --- | --- | --- |
| 正本境界 | D1/Notion/R2の更新責務 | Phase 0終了まで | 未決 |
| 互換契約 | endpoint名・JSONキー・必須項目 | Phase 0終了まで | 未決 |
| 鮮度目標 | 更新反映目標時間と上限 | Phase 2開始前 | 未決 |
| 切替条件 | GAS停止条件、ロールバック条件 | Phase 3終了まで | 未決 |

## 7. 検証計画（実装前PoC）

1. D1起点で `participants_index.json` / `schedule_index.json` を再生成するPoCを作る。  
2. 既存JSONとD1生成JSON（`participants/schedule`）の差分比較テストを用意する。  
3. `media-platform` 互換確認（起動時fetch、候補表示、`students/tags` の既存経路を含む運用フロー）を実施する。  
4. 運用異常系（再生成失敗、遅延、古いJSON配信）を想定した復旧手順を確認する。

## 8. 本書の扱い

- この文書は「検討メモ」であり、ここに書かれた方針は確定ではない。
- 確定事項のみ `CLOUDFLARE_D1_MIGRATION_PLAN.md` 側へ反映する。
