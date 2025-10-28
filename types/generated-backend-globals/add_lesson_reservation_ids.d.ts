/**
 * @file add_lesson_reservation_ids.js
 * @description 1回限りのマイグレーションスクリプト。
 * 既存の「日程マスタ」と「予約記録」シートに `lessonId` と `reservationIds` を付与する。
 * GASエディタにコピー＆ペーストして実行することを想定。
 */
/**
 * =================================================================
 * マイグレーション実行関数
 * =================================================================
 * 1. 日程マスタに `lessonId` を追加
 * 2. 予約記録に `lessonId` を追加
 * 3. 日程マスタに `reservationIds` を追加
 */
declare function runMigrationAddLessonReservationIds(): void;
