/**
 * =================================================================
 * 【ファイル名】: 12_WebApp_Core_Search.js
 * 【バージョン】: 1.0
 * 【役割】: WebAppのフロントエンドにおける、統一検索システムを
 * 集約します。「よやく」と「きろく」を統一的に検索する機能。
 * 【構成】: 12_WebApp_Core.jsから分割された検索機能ファイル
 * 【新規作成理由】:
 * - メインコアファイルの肥大化対策
 * - 検索機能の独立性向上
 * - AIの作業効率向上のためのファイル分割
 * =================================================================
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
