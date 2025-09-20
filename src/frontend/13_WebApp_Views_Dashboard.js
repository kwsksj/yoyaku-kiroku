// @ts-check
/// <reference path="../../types/dev-environment.d.ts" />
/// <reference path="../../types/html-environment.d.ts" />
/// <reference path="../../types/api-types.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 13_WebApp_Views_Dashboard.js
 * 【バージョン】: 1.0
 * 【役割】: ダッシュボード関連のビュー（予約一覧、履歴表示、ボタン管理）
 * 【構成】: Views.jsから分割されたダッシュボード機能
 * =================================================================
 */

/**
 * メインのホーム画面のUIを生成します。
 * 【改善】ビジネスロジックをヘルパー関数に分離して可読性向上
 * @returns {string} HTML文字列
 */
const getDashboardView = () => {
  // myReservationsから直接フィルタリングして表示（シンプル化）
  const state = stateManager.getState();
  const myReservations = state.myReservations || [];

  // 予約セクション用のカード配列を構築：確定・待機ステータスのみ表示
  const activeReservations = myReservations
    .filter(
      res =>
        res.status === CONSTANTS.STATUS.CONFIRMED ||
        res.status === CONSTANTS.STATUS.WAITLISTED,
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // 新しい順ソート

  const bookingCards = activeReservations.map(b => {
    const badges = _buildBookingBadges(b);
    const editButtons = _buildEditButtons(b);
    const accountingButtons = _buildAccountingButtons(b);

    return Components.listCard({
      type: 'booking',
      item: b,
      badges: badges,
      editButtons: editButtons,
      accountingButtons: accountingButtons,
    });
  });

  // 予約セクションを生成（Componentsに構造生成を委任）
  const yourBookingsHtml = Components.dashboardSection({
    title: 'よやく',
    items: bookingCards,
    showNewButton: true,
    newAction: 'showClassroomModal',
  });

  // 履歴セクション用のカード配列を構築：完了ステータスのみ表示
  let historyHtml = '';
  const completedReservations = myReservations
    .filter(res => res.status === CONSTANTS.STATUS.COMPLETED)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // 新しい順ソート

  const recordsToShow = state.recordsToShow;
  const completedRecords = completedReservations.slice(0, recordsToShow);

  if (completedRecords.length > 0) {
    // 「きろく」は COMPLETED ステータスのみ表示
    const historyCards = completedRecords.map(h => {
      // 編集モード状態を取得
      const isInEditMode = stateManager.isInEditMode(h.reservationId);

      const editButtons = _buildHistoryEditButtons(h, isInEditMode);
      const accountingButtons = _buildHistoryAccountingButtons(h);

      return _buildHistoryCardWithEditMode(
        h,
        editButtons,
        accountingButtons,
        isInEditMode,
      );
    });

    const showMore = recordsToShow < completedReservations.length;

    // Componentsに構造生成を委任
    historyHtml = Components.dashboardSection({
      title: 'きろく',
      items: historyCards,
      showMoreButton: showMore,
      moreAction: 'loadMoreHistory',
    });
  }

  return `
        <div class="flex flex-col sm:flex-row justify-between sm:items-center mb-2">
            <h1 class="text-base sm:text-xl font-bold ${DesignConfig.colors.text} mr-4 mb-1 sm:mb-0">ようこそ <span class="text-xl whitespace-nowrap">${stateManager.getState().currentUser.displayName} <span class="text-base">さん</span></span></h1>
            <button data-action="goToEditProfile" class="${DesignConfig.colors.info} self-end sm:self-auto text-sm text-action-secondary-text px-3 py-0.5 rounded-md active:bg-action-secondary-hover">Profile 編集</button>
        </div>
        ${yourBookingsHtml}
        ${historyHtml}
    `;
};

/**
 * 予約カードの編集ボタン配列を生成します。
 * @param {ReservationData} booking - 予約データ
 * @returns {Array<any>} 編集ボタン設定配列
 */
const _buildEditButtons = booking => {
  const buttons = [];

  // 確認/編集ボタン
  if (
    booking.status === CONSTANTS.STATUS.CONFIRMED ||
    booking.status === CONSTANTS.STATUS.WAITLISTED
  ) {
    buttons.push({
      action: 'goToEditReservation',
      text: '確認/編集',
      style: 'secondary',
    });
  }

  return buttons;
};

/**
 * 予約カードの会計ボタン配列を生成します。
 * @param {ReservationData} booking - 予約データ
 * @returns {Array<any>} 会計ボタン設定配列
 */
const _buildAccountingButtons = booking => {
  const buttons = [];

  // 会計ボタン（予約日以降のみ）
  const isBookingPastOrToday = _isPastOrToday(booking.date);
  if (booking.status === CONSTANTS.STATUS.CONFIRMED && isBookingPastOrToday) {
    buttons.push({
      action: 'goToAccounting',
      text: '会計',
      style: 'primary',
    });
  }

  return buttons;
};

/**
 * 履歴カードの編集ボタン配列を生成します。
 * @param {ReservationData} historyItem - 履歴データ
 * @returns {Array<any>} 編集ボタン設定配列
 */
const _buildHistoryEditButtons = (historyItem, isInEditMode = false) => {
  const buttons = [];

  // 編集モード状態に応じてボタンテキストを変更
  const buttonText = isInEditMode ? 'とじる' : '確認/編集';
  buttons.push({
    action: 'expandHistoryCard',
    text: buttonText,
    style: 'secondary',
    size: 'xs',
  });

  return buttons;
};

/**
 * 履歴カードの会計ボタン配列を生成します。
 * @param {ReservationData} historyItem - 履歴データ
 * @returns {Array<any>} 会計ボタン設定配列
 */
const _buildHistoryAccountingButtons = historyItem => {
  const buttons = [];

  if (historyItem.status === CONSTANTS.STATUS.COMPLETED) {
    const isHistoryToday = _isToday(historyItem.date);

    if (isHistoryToday) {
      // きろく かつ 教室の当日 → 「会計を修正」ボタンは維持
      buttons.push({
        action: 'editAccountingRecord',
        text: '会計を修正',
        style: 'primary',
      });
    }
    // 「会計詳細」ボタンは展開部に移植するため、カードからは除去
  }

  return buttons;
};

/**
 * 予約カードのバッジ配列を生成します。
 * @param {ReservationData} booking - 予約データ
 * @returns {Array<{type: string, text: string}>} バッジ設定配列
 */
const _buildBookingBadges = booking => {
  /** @type {Array<{type: string, text: string}>} */
  const badges = [];

  if (booking.firstLecture) {
    badges.push({ type: 'info', text: '初回' });
  }

  if (
    booking.status === CONSTANTS.STATUS.WAITLISTED ||
    /** @type {any} */ (booking).isWaiting
  ) {
    badges.push({ type: 'warning', text: 'キャンセル待ち' });
  }

  return badges;
};
