# データモデル拡張計画: lessonId / reservationIds の実装

## 1. 目的

本計画は、レッスン (`LessonCore`) と予約 (`ReservationCore`) のデータモデルを拡張し、`lessonId` 及び `reservationIds` プロパティを導入するための作業計画を定義する。

これにより、レッスンと予約間の双方向参照を確立し、データアクセス効率、一貫性、および将来のメンテナンス性を向上させる。

## 2. 作業ブランチ

- `feature/add-lesson-reservation-ids`

## 3. 作業タスク一覧

AI（Gemini）が以下のタスクを順番に実行する。

- [ ] **ステップ1: 型定義の更新**
  - [ ] `types/core/lesson.d.ts` の `LessonCore` 型に `lessonId: string;` と `reservationIds: string[];` を追加する。
  - [ ] `types/core/reservation.d.ts` の `ReservationCore` 型に `lessonId: string;` を追加する。

- [ ] **ステップ2: 定数と設定の更新**
  - [ ] `src/shared/00_Constants.js` を調査し、スプレッドシートの列インデックスを管理する定数に、以下のシート用の `lessonId` 列を追加する。
    - 日程マスタ (`SCHEDULE_MASTER_SHEET`)
    - 統合予約シート (`RESERVATION_SHEET`)

- [ ] **ステップ3: マイグレーションスクリプトの作成と実行**
  - [ ] `tools/migration/` ディレクトリ（なければ作成）に、既存データにIDを付与する一時的なスクリプト `add_lesson_reservation_ids.js` を作成する。
  - [ ] スクリプトに以下の処理を実装する。1. **日程マスタへのID付与:** - 日程マスタシートを走査し、`lessonId` が空の行に対して `Utilities.getUuid()` でIDを生成し、書き込む（冪等性の確保）。2. **統合予約シートへのlessonId付与:** - 統合予約シートを走査し、各予約に対応するレッスンを日程マスタから特定し、その `lessonId` を統合予約シートの `lessonId` 列に書き込む。3. **日程マスタへのreservationIds設定:** - 日程マスタを再度走査し、各レッスンに紐づく予約を統合予約シートからすべて検索し、その予約IDの配列を `reservationIds` として書き込む。
  - [ ] 作成したスクリプトをGAS環境で一度だけ実行する。

- [ ] **ステップ4: データ読み込み処理の更新**
  - [ ] スプレッドシートからデータを読み込み、`LessonCore` や `ReservationCore` オブジェクトに変換するロジックを更新し、新しい `lessonId`, `reservationIds` プロパティを正しくマッピングするように修正する。
  - 影響範囲の例: `02-4_BusinessLogic_ScheduleMaster.js`, `04_Backend_User.js` など。

- [ ] **ステップ5: データ書き込み処理の更新**
  - [ ] **新規レッスン作成時:** `lessonId` を生成し、`reservationIds` を空配列 `[]` で初期化する処理を追加する。
  - [ ] **新規予約作成時:** 関連するレッスンの `lessonId` を予約情報に記録し、該当レッスンの `reservationIds` に新しい予約IDを追加して更新する処理を実装する。
  - [ ] **予約キャンセル/変更時:** 関連するレッスンの `reservationIds` から該当の予約IDを削除/追加する更新処理を実装する。
  - 影響範囲の例: `05-2_Backend_Write.js` など。

- [ ] **ステップ6: キャッシュ管理の更新**
  - [ ] `07_CacheManager.js` を修正し、`lessonId` をキーとしてレッスン情報を効率的に取得・更新できるようにする。
  - [ ] `getLessonById(lessonId)` のような、IDベースでデータを取得するヘルパー関数を実装する。

- [ ] **ステップ7: テストと検証**
  - [ ] 以下の観点を確認するためのテスト関数を一時的に作成し、実行・検証する。
    - マイグレーション後のデータに `lessonId` と `reservationIds` が正しく設定されていること。
    - 新規レッスン・予約作成時に、IDの関連付けが正しく行われること。
    - 予約をキャンセルした際に、`reservationIds` から正しく削除されること。

- [ ] **ステップ8: ドキュメントの更新**
  - [ ] `docs/DATA_MODEL.md` を更新し、`LessonCore` と `ReservationCore` の新しいデータ構造と、`lessonId` によるリレーションについて明記する。

- [ ] **ステップ9: クリーンアップ**
  - [ ] `tools/migration/add_lesson_reservation_ids.js` を `archive` ディレクトリに移動、または削除する。

## 4. 完了条件

- 上記のすべてのタスクが完了し、チェックボックスが埋まっていること。
- 手動テストまたは自動テストによって、変更箇所の動作が正常であることが確認されていること。
- 本計画で定義されたすべてのコード変更が、`feature/add-lesson-reservation-ids` ブランチにコミットされていること。
- コードレビューで承認され、`main` ブランチにマージされていること。
