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
export function findReservationById(reservationId, state = null) {
  const currentState = state || appWindow.stateManager?.getState();
  if (!currentState) return null;

  // myReservationsから直接検索
  const reservation = currentState.myReservations?.find(
    (/** @type {ReservationCore} */ item) =>
      item.reservationId === reservationId,
  );
  if (reservation) {
    // ステータスに基づいてtype分類を追加
    if (reservation.status === CONSTANTS.STATUS.COMPLETED) {
      return { ...reservation, type: 'record' };
    } else {
      return { ...reservation, type: 'booking' };
    }
  }

  // 管理者操作時: adminContext.reservations をフォールバック検索
  const adminContext = /** @type {any} */ (appWindow).adminContext;
  if (adminContext?.reservations) {
    const adminReservation = adminContext.reservations.find(
      (/** @type {ReservationCore} */ item) =>
        item.reservationId === reservationId,
    );
    if (adminReservation) {
      if (adminReservation.status === CONSTANTS.STATUS.COMPLETED) {
        return { ...adminReservation, type: 'record' };
      } else {
        return { ...adminReservation, type: 'booking' };
      }
    }
  }

  // 管理者操作時: participantReservationsMap をフォールバック検索
  const participantMap = currentState.participantReservationsMap;
  if (participantMap) {
    for (const lessonId of Object.keys(participantMap)) {
      const found = participantMap[lessonId]?.find(
        (/** @type {ReservationCore} */ item) =>
          item.reservationId === reservationId,
      );
      if (found) {
        if (found.status === CONSTANTS.STATUS.COMPLETED) {
          return { ...found, type: 'record' };
        } else {
          return { ...found, type: 'booking' };
        }
      }
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
export function findReservationByDateAndClassroom(
  date,
  classroom,
  state = null,
) {
  const currentState = state || appWindow.stateManager?.getState();
  if (!currentState) return null;

  // myReservationsから直接検索（キャンセル済みは既にバックエンドで除外済み）
  const reservation = currentState.myReservations?.find(
    (/** @type {ReservationCore} */ item) =>
      item.date === date && item.classroom === classroom,
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
export function findReservationsByStatus(status, state = null) {
  const currentState = state || appWindow.stateManager?.getState();
  if (!currentState) return [];

  // myReservationsから直接検索
  const reservations =
    currentState.myReservations?.filter(
      (/** @type {ReservationCore} */ item) => item.status === status,
    ) || [];

  // ステータスに基づいてtype分類を追加
  return reservations.map((/** @type {ReservationCore} */ item) => {
    if (item.status === CONSTANTS.STATUS.COMPLETED) {
      return { ...item, type: 'record' };
    } else {
      return { ...item, type: 'booking' };
    }
  });
}
