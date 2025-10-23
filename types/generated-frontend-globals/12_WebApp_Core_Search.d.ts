/**
 * =================================================================
 * ファイル概要
 * -----------------------------------------------------------------
 * 名称: 12_WebApp_Core_Search.js
 * 目的: 予約・記録データを統一的に探索する検索ユーティリティを提供する
 * 主な責務:
 *   - 予約IDや日付などの条件で`myReservations`を検索
 *   - 検索結果に`type`属性を付与してビュー層で扱いやすい形に整形
 *   - stateManagerと直接連携し、呼び出し元が状態管理を意識せずに利用できるようにする
 * AI向けメモ:
 *   - 新しい検索条件を追加する際は副作用を持たず、純粋関数として実装する
 * =================================================================
 */
/**
 * @typedef {ReservationCore & { type: 'booking' | 'record' }} ReservationSearchResult
 */
/**
 * =================================================================
 * --- 統一検索関数システム (2025-08-30) ---
 * 「よやく」(myBookings) と「きろく」(history) を統一的に検索する関数群
 * =================================================================
 */
/**
 * 予約IDで「よやく」と「きろく」を統一的に検索します
 * @param {string} reservationId - 検索対象の予約ID
 * @param {UIState | null} [state=null] - stateManager.getState()の戻り値
 * @returns {ReservationSearchResult | null} 見つかった予約/記録データ、見つからない場合はnull
 */
export function findReservationById(reservationId: string, state?: UIState | null): ReservationSearchResult | null;
/**
 * 日付と教室で「よやく」と「きろく」を統一的に検索します
 * @param {string} date - 検索対象の日付 (YYYY-MM-DD)
 * @param {string} classroom - 検索対象の教室名
 * @param {UIState | null} [state=null] - stateManager.getState()の戻り値
 * @returns {ReservationSearchResult | null} 見つかった予約/記録データ、見つからない場合はnull
 */
export function findReservationByDateAndClassroom(date: string, classroom: string, state?: UIState | null): ReservationSearchResult | null;
/**
 * 指定されたステータスの予約/記録を検索します
 * @param {string} status - 検索対象のステータス
 * @param {UIState | null} [state=null] - stateManager.getState()の戻り値
 * @returns {ReservationSearchResult[]} 条件に合致する予約/記録の配列
 */
export function findReservationsByStatus(status: string, state?: UIState | null): ReservationSearchResult[];
export type ReservationSearchResult = ReservationCore & {
    type: "booking" | "record";
};
