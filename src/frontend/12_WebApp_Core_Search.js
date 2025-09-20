// @ts-check
/// <reference path="../../types/dev-environment.d.ts" />
/// <reference path="../../types/html-environment.d.ts" />
/// <reference path="../../types/api-types.d.ts" />

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
function findReservationById(reservationId, state = null) {
  const currentState = state || window.stateManager?.getState();
  if (!currentState) return null;

  // myReservationsから直接検索
  const reservation = currentState.myReservations?.find(
    item => item.reservationId === reservationId,
  );
  if (reservation) {
    // ステータスに基づいてtype分類を追加
    if (reservation.status === CONSTANTS.STATUS.COMPLETED) {
      return { ...reservation, type: 'record' };
    } else {
      return { ...reservation, type: 'booking' };
    }
  }

  return null;
}

/**
 * 日付と教室で「よやく」と「きろく」を統一的に検索します
 * @param {string} date - 検索対象の日付 (YYYY-MM-DD)
 * @param {string} classroom - 検索対象の教室名
 * @param {UIState | null} [state=null] - stateManager.getState()の戻り値
 * @returns {ReservationSearchResult | null} 見つかった予約/記録データ、見つからない場合はnull
 */
function findReservationByDateAndClassroom(date, classroom, state = null) {
  const currentState = state || window.stateManager?.getState();
  if (!currentState) return null;

  // myReservationsから直接検索（キャンセル済みは既にバックエンドで除外済み）
  const reservation = currentState.myReservations?.find(
    item => item.date === date && item.classroom === classroom,
  );

  if (reservation) {
    // ステータスに基づいてtype分類を追加
    if (reservation.status === CONSTANTS.STATUS.COMPLETED) {
      return { ...reservation, type: 'record' };
    } else {
      return { ...reservation, type: 'booking' };
    }
  }

  return null;
}

/**
 * 指定されたステータスの予約/記録を検索します
 * @param {string} status - 検索対象のステータス
 * @param {UIState | null} [state=null] - stateManager.getState()の戻り値
 * @returns {ReservationSearchResult[]} 条件に合致する予約/記録の配列
 */
function findReservationsByStatus(status, state = null) {
  const currentState = state || window.stateManager?.getState();
  if (!currentState) return [];

  // myReservationsから直接検索
  const reservations =
    currentState.myReservations?.filter(item => item.status === status) || [];

  // ステータスに基づいてtype分類を追加
  return reservations.map(item => {
    if (item.status === CONSTANTS.STATUS.COMPLETED) {
      return { ...item, type: 'record' };
    } else {
      return { ...item, type: 'booking' };
    }
  });
}
