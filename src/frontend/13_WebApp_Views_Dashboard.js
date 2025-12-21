/**
 * =================================================================
 * ファイル概要
 * -----------------------------------------------------------------
 * 名称: 13_WebApp_Views_Dashboard.js
 * 目的: ダッシュボード画面の各セクションを構築する
 * 主な責務:
 *   - 予約/履歴カードの生成と表示制御
 *   - stateManager を用いた表示件数や編集状態の管理
 *   - 既存ビュー/コンポーネントとの橋渡し
 * AI向けメモ:
 *   - 新しいダッシュボードセクションは`Components.dashboardSection`を活用し、必要なカードビルダー関数をここで管理する
 * =================================================================
 */

// ================================================================
// UI系モジュール
// ================================================================
import { Components } from './13_WebApp_Components.js';
import { _buildHistoryCardWithEditMode } from './13_WebApp_Views_Booking.js';
import { _isToday } from './13_WebApp_Views_Utils.js';

const dashboardStateManager = appWindow.stateManager;
/**
 * メインのホーム画面のUIを生成します。
 * 【改善】ビジネスロジックをヘルパー関数に分離して可読性向上
 * @returns {string} HTML文字列
 */
export const getDashboardView = () => {
  // myReservationsから直接フィルタリングして表示（シンプル化）
  const state = dashboardStateManager.getState();
  const myReservations = state.myReservations || [];

  console.log('📊 ダッシュボード表示開始');
  console.log('   myReservations:', myReservations);
  console.log('   予約数:', myReservations.length);

  // 予約セクション用のカード配列を構築：確定・待機ステータスのみ表示
  const activeReservations = myReservations
    .filter(
      (/** @type {ReservationCore} */ res) =>
        res.status === CONSTANTS.STATUS.CONFIRMED ||
        res.status === CONSTANTS.STATUS.WAITLISTED,
    )
    .sort(
      (/** @type {ReservationCore} */ a, /** @type {ReservationCore} */ b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime(),
    ); // 新しい順ソート

  console.log('   アクティブな予約:', activeReservations.length, '件');

  const bookingCards = activeReservations.map(
    (/** @type {ReservationCore} */ b) => {
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
    },
  );

  // 予約セクションを生成（Componentsに構造生成を委任）
  const yourBookingsHtml = Components.dashboardSection({
    title: 'よやく',
    items: bookingCards,
  });

  // 履歴セクション用のカード配列を構築：完了ステータスのみ表示
  let historyHtml = '';
  const completedReservations = myReservations
    .filter(
      (/** @type {ReservationCore} */ res) =>
        res.status === CONSTANTS.STATUS.COMPLETED,
    )
    .sort(
      (/** @type {ReservationCore} */ a, /** @type {ReservationCore} */ b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime(),
    ); // 新しい順ソート

  const recordsToShow = state.recordsToShow;
  const completedRecords = completedReservations.slice(0, recordsToShow);

  if (completedRecords.length > 0) {
    // 「きろく」は COMPLETED ステータスのみ表示
    const historyCards = completedRecords.map(
      (/** @type {ReservationCore} */ h) => {
        // 編集モード状態を取得
        const isInEditMode = dashboardStateManager.isInEditMode(
          h.reservationId,
        );

        const editButtons = _buildHistoryEditButtons(
          isInEditMode,
          h.reservationId,
        );
        const accountingButtons = _buildHistoryAccountingButtons(h);

        return _buildHistoryCardWithEditMode(
          h,
          editButtons,
          accountingButtons,
          isInEditMode,
        );
      },
    );

    const showMore = recordsToShow < completedReservations.length;

    // Componentsに構造生成を委任
    historyHtml = Components.dashboardSection({
      title: 'きろく',
      items: historyCards,
      showMoreButton: showMore,
      moreAction: 'loadMoreHistory',
    });
  }

  const currentUser = dashboardStateManager.getState().currentUser;
  const nickname = currentUser ? currentUser.nickname : '';

  // 今日の予約を検索（会計フォールバックボタン用）
  const todayReservation = activeReservations.find(
    (/** @type {ReservationCore} */ r) => _isToday(r.date),
  );

  // --- メニューセクション ---
  const menuButton = Components.button({
    text: 'よやく・きろく　いちらん',
    action: 'goToParticipantsView',
    style: 'primary',
    size: 'full',
  });

  // 新規予約ボタン
  const newBookingButton = Components.button({
    text: 'あたらしく　よやく　する',
    action: 'showClassroomModal',
    style: 'secondary',
    size: 'full',
  });

  // 写真ギャラリーリンク
  const photoButton = `<a href="https://photos.app.goo.gl/CWw2WzgcG1iV1Crm7" target="_blank" rel="noopener noreferrer" class="text-base font-bold py-3 px-4 rounded-lg border-2 border-ui-border bg-ui-surface text-action-secondary-text hover:bg-action-secondary-hover inline-flex items-center justify-center"><span>📷</span> しゃしん</a>`;

  // 今日の予約がある場合のみ表示するボタン
  const summaryMenuButton = todayReservation
    ? Components.button({
        text: 'きょう の まとめ',
        action: 'goToSessionConclusion',
        style: 'accounting',
        size: 'full',
      })
    : '';

  const accountingFallbackButton = todayReservation
    ? Components.button({
        text: 'かいけい のみ（まとめがうまく使えないとき用）',
        action: 'goToAccounting',
        style: 'secondary',
        size: 'small',
        dataAttributes: { reservationId: todayReservation.reservationId },
      })
    : '';

  // メニューアイテムを構築
  const primaryMenuButtons = [menuButton, newBookingButton, photoButton]
    .filter(Boolean)
    .join('');
  const todayButtons = [summaryMenuButton]
    .filter(Boolean)
    .join('');

  const menuSectionHtml = Components.dashboardSection({
    title: 'メニュー',
    items: [
      `<div class="grid gap-2 sm:grid-cols-3">${primaryMenuButtons}</div>`,
      todayButtons
        ? `<div class="grid gap-2 sm:grid-cols-2 mt-2">${todayButtons}</div>`
        : '',
    ].filter(Boolean),
  });

  // けいかく・もくひょうセクション（生徒名簿から取得、編集可能）
  const nextLessonGoal = currentUser?.['nextLessonGoal'] || '';
  const goalCardContent = `
    <div class="w-full max-w-md mx-auto">
      <div class="bg-brand-light border-2 border-brand-subtle/30 p-2 rounded-lg">
        <!-- 表示モード -->
        <div id="goal-display-mode" class="${nextLessonGoal ? '' : 'hidden'}">
          <div class="bg-white/75 rounded p-2 relative">
            <p id="goal-display-text" class="text-base text-brand-text whitespace-pre-wrap pr-16 min-h-8">${escapeHTML(nextLessonGoal) || 'まだ設定されていません'}</p>
            <button data-action="editGoal" class="absolute bottom-2 right-2 text-xs text-brand-subtle px-2 py-0.5 rounded border border-brand-subtle/30 hover:bg-brand-light active:bg-brand-light">へんしゅう</button>
          </div>
        </div>
        <!-- 編集モード -->
        <div id="goal-edit-mode" class="${nextLessonGoal ? 'hidden' : ''}">
          <div class="bg-white/75 rounded p-2">
            <textarea
              id="goal-edit-textarea"
              class="${DesignConfig.inputs.textarea} min-h-14 w-full px-1"
              rows="3"
              placeholder="つくりたいもの、けいかく、もくひょう など"
            >${escapeHTML(nextLessonGoal)}</textarea>
            <div class="flex justify-end mt-2 gap-2">
              ${nextLessonGoal ? `<button data-action="cancelEditGoal" class="text-sm text-action-secondary-text px-3 py-1 rounded-md border border-ui-border">キャンセル</button>` : ''}
              ${Components.button({
                action: 'saveGoal',
                text: 'ほぞん',
                style: 'primary',
                size: 'small',
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  const goalSectionHtml = Components.dashboardSection({
    title: 'けいかく・もくひょう',
    items: [goalCardContent],
  });

  return `
        <div class="flex flex-col sm:flex-row justify-between sm:items-center my-2">
            <h1 class="text-base sm:text-xl font-bold ${DesignConfig.colors.text} mr-4 mb-1 sm:mb-0">ようこそ <span class="text-xl whitespace-nowrap">${nickname} <span class="text-base">さん</span></span></h1>
            <button data-action="showEditProfile" class="${DesignConfig.colors.info} self-end sm:self-auto text-sm text-action-secondary-text px-3 py-0.5 rounded-md active:bg-action-secondary-hover">プロフィール編集</button>
        </div>
        ${menuSectionHtml}
        ${goalSectionHtml}
        ${yourBookingsHtml}
        ${historyHtml}
        ${accountingFallbackButton ? `<div class="mt-8 text-center">${accountingFallbackButton}</div>` : ''}
    `;
};

/**
 * 予約カードの編集ボタン配列を生成します。
 * @param {ReservationCore} booking - 予約データ
 * @returns {Array<any>} 編集ボタン設定配列
 */
export const _buildEditButtons = booking => {
  const buttons = [];

  if (booking.status === CONSTANTS.STATUS.CONFIRMED) {
    // 確定済み予約：確認/編集ボタンのみ
    buttons.push({
      action: 'goToEditReservation',
      text: 'かくにん<br>へんしゅう',
    });
  } else if (booking.status === CONSTANTS.STATUS.WAITLISTED) {
    // 空き通知希望：現在の空席状況に応じてボタンを変更
    const isCurrentlyAvailable = _checkIfLessonAvailable(booking);

    if (isCurrentlyAvailable) {
      // 現在空席：予約するボタンを追加
      buttons.push({
        action: 'confirmWaitlistedReservation',
        text: '予約する',
        style: 'primary',
      });
    }

    // 空き通知希望は常に確認/編集ボタンも表示
    buttons.push({
      action: 'goToEditReservation',
      text: 'かくにん<br>へんしゅう',
    });
  }

  return buttons;
};

/**
 * 予約カードの会計ボタン配列を生成します。
 * @param {ReservationCore} _booking - 予約データ（未使用）
 * @returns {Array<any>} 会計ボタン設定配列
 */
export const _buildAccountingButtons = _booking => {
  // 会計ボタンは削除（きろくカードの会計修正ボタンのみ残す）
  return [];
};

/**
 * 履歴カードの編集ボタン配列を生成します。
 * @param {boolean} isInEditMode - 編集モードフラグ
 * @param {string} reservationId - 予約ID
 * @returns {Array<any>} 編集ボタン設定配列
 */
export const _buildHistoryEditButtons = (
  isInEditMode = false,
  reservationId = '',
) => {
  const buttons = [];
  const state = dashboardStateManager.getState();

  // 編集モード状態に応じてボタンテキストとアクションを変更
  if (isInEditMode) {
    // 編集モード時：入力変更があるかチェック
    const hasInputChanged =
      state.memoInputChanged &&
      state.editingMemo &&
      state.editingMemo.reservationId === reservationId;

    if (hasInputChanged) {
      // 入力変更あり：保存ボタンを表示
      buttons.push({
        action: 'saveAndCloseMemo',
        text: 'メモを<br>保存',
        dataAttributes: {
          reservationId: reservationId,
        },
      });
    } else {
      // 入力変更なし：とじるボタンを表示
      buttons.push({
        action: 'closeEditMode',
        text: 'とじる',
        dataAttributes: {
          reservationId: reservationId,
        },
      });
    }
  } else {
    // 通常時：編集モードに入る
    buttons.push({
      action: 'expandHistoryCard',
      text: 'かくにん<br>へんしゅう',
    });
  }

  return buttons;
};

/**
 * 履歴カードの会計ボタン配列を生成します。
 * @param {ReservationCore} historyItem - 履歴データ
 * @returns {Array<any>} 会計ボタン設定配列
 */
export const _buildHistoryAccountingButtons = historyItem => {
  const buttons = [];

  if (historyItem.status === CONSTANTS.STATUS.COMPLETED) {
    const isHistoryToday = _isToday(historyItem.date);

    if (isHistoryToday) {
      // きろく かつ 教室の当日 → 「会計を修正」ボタンは維持
      buttons.push({
        action: 'editAccountingRecord',
        text: '会計<br>修正',
        style: 'accounting',
      });
    }
  }

  return buttons;
};

/**
 * 予約カードのバッジ配列を生成します。
 * @param {ReservationCore} booking - 予約データ
 * @returns {Array<{type: BadgeType, text: string}>} バッジ設定配列
 */
export const _buildBookingBadges = booking => {
  /** @type {Array<{type: BadgeType, text: string}>} */
  const badges = [];

  if (booking.firstLecture) {
    badges.push({ type: 'attention', text: '初回' });
  }

  if (
    booking.status === CONSTANTS.STATUS.WAITLISTED ||
    /** @type {any} */ (booking).isWaiting
  ) {
    // 空き通知希望の場合、現在の空席状況に応じてバッジを変更
    const isCurrentlyAvailable = _checkIfLessonAvailable(booking);
    if (isCurrentlyAvailable) {
      badges.push({ type: 'success', text: '予約可能！' });
    } else {
      badges.push({ type: 'warning', text: '空き通知希望' });
    }
  }

  return badges;
};

/**
 * 指定した予約に対応する講座が現在予約可能かチェック
 * @param {ReservationCore} booking - 予約データ
 * @returns {boolean} 予約可能な場合true
 */
export const _checkIfLessonAvailable = booking => {
  const state = dashboardStateManager.getState();
  const lessons = state.lessons || [];

  if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
    console.log('🔍 空席判定開始:', {
      bookingDate: booking.date,
      bookingClassroom: booking.classroom,
      lessonsCount: lessons.length,
      lessonsAvailable: lessons.length > 0,
    });
  }

  // 該当する講座を検索
  const targetLesson = lessons.find(
    (/** @type {LessonCore} */ lesson) =>
      lesson.date === String(booking.date) &&
      lesson.classroom === booking.classroom,
  );

  if (!targetLesson) {
    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      console.log('❌ 該当講座が見つかりません:', {
        searchDate: String(booking.date),
        searchClassroom: booking.classroom,
        availableLessons: lessons.map((/** @type {LessonCore} */ l) => ({
          date: l.date,
          classroom: l.classroom,
        })),
      });
    }
    return false;
  }

  // 初回参加者かどうかをチェック
  const isFirstTimer = booking.firstLecture === true;

  // 2部制の場合はセッション別に判定
  if (targetLesson.classroomType === CONSTANTS.CLASSROOM_TYPES.TIME_DUAL) {
    const bookingStartTime = booking.startTime;
    const bookingEndTime = booking.endTime;

    // --- 必須データの存在チェック ---
    if (!bookingStartTime || !bookingEndTime) {
      if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
        console.error(
          '❌ 2部制判定エラー: 必須データ(booking times)が不足しています。',
          { booking, targetLesson },
        );
      }
      return false;
    }

    const morningEndTime = targetLesson.firstEnd;
    const afternoonStartTime = targetLesson.secondStart;

    // --- セッション境界時刻の存在チェック ---
    if (!morningEndTime || !afternoonStartTime) {
      if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
        console.error(
          '❌ 2部制判定エラー: セッション境界時刻(firstEnd, secondStart)が定義されていません。',
          { targetLesson },
        );
      }
      return false;
    }

    // --- 予約時間に基づいて、チェックが必要なセッションを判断 ---
    const morningCheckRequired = bookingStartTime < morningEndTime;
    const afternoonCheckRequired = bookingEndTime > afternoonStartTime;

    // 予約がどちらのセッションにもかからない場合、不正な予約時間とみなしfalseを返す
    if (!morningCheckRequired && !afternoonCheckRequired) {
      if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
        console.warn('⚠️ 2部制判定警告: 予約時間がセッションの範囲外です。', {
          booking,
          targetLesson,
        });
      }
      return false;
    }

    // --- 各セッションの空き状況をチェック ---
    let morningHasSlots = true; // チェック不要な場合はtrueとして扱う
    if (morningCheckRequired) {
      // 初回参加者の場合は初回枠をチェック、経験者の場合は経験者枠をチェック
      if (isFirstTimer) {
        morningHasSlots = (targetLesson.beginnerSlots || 0) > 0;
      } else {
        morningHasSlots = (targetLesson.firstSlots || 0) > 0;
      }
    }

    let afternoonHasSlots = true; // チェック不要な場合はtrueとして扱う
    if (afternoonCheckRequired) {
      // 初回参加者の場合は初回枠をチェック、経験者の場合は経験者枠をチェック
      if (isFirstTimer) {
        afternoonHasSlots = (targetLesson.beginnerSlots || 0) > 0;
      } else {
        afternoonHasSlots = (targetLesson.secondSlots || 0) > 0;
      }
    }

    // 必要なセッション全てに空きがあるか最終判定
    const isAvailable = morningHasSlots && afternoonHasSlots;

    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      console.log('📊 2部制判定結果 (詳細ロジック):', {
        isFirstTimer,
        bookingTime: `${bookingStartTime}-${bookingEndTime}`,
        sessionBoundaries: {
          morningEnd: morningEndTime,
          afternoonStart: afternoonStartTime,
        },
        checks: {
          morning: morningCheckRequired,
          afternoon: afternoonCheckRequired,
        },
        slots: {
          morning: isFirstTimer
            ? targetLesson.beginnerSlots
            : targetLesson.firstSlots,
          afternoon: isFirstTimer
            ? targetLesson.beginnerSlots
            : targetLesson.secondSlots,
        },
        result: { morningHasSlots, afternoonHasSlots },
        isAvailable,
      });
    }

    return isAvailable;
  } else {
    // 通常の講座（セッション制・全日時間制）
    // 初回参加者の場合は初回枠をチェック、経験者の場合は経験者枠をチェック
    const isAvailable = isFirstTimer
      ? (targetLesson.beginnerSlots || 0) > 0
      : (targetLesson.firstSlots || 0) > 0;

    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      console.log('📊 通常講座判定結果:', {
        isFirstTimer,
        beginnerSlots: targetLesson.beginnerSlots,
        firstSlots: targetLesson.firstSlots,
        isAvailable,
      });
    }

    return isAvailable;
  }
};

/**
 * 特定の履歴カードのメモセクションとボタンのみを部分更新（ちらつき防止・スムーズ切替）
 * @param {string} reservationId - 更新対象の予約ID
 */
export function updateSingleHistoryCard(reservationId) {
  // 該当するカードのDOM要素を取得
  const cardElement = document.querySelector(
    `[data-reservation-id="${reservationId}"]`,
  );
  if (!cardElement) {
    console.warn('カードが見つかりません:', reservationId);
    return;
  }

  // 現在の状態から該当する履歴アイテムを取得
  const state = dashboardStateManager.getState();
  const historyItem = state.myReservations.find(
    (/** @type {ReservationCore} */ h) => h.reservationId === reservationId,
  );
  if (!historyItem || historyItem.status !== CONSTANTS.STATUS.COMPLETED) return;

  // 編集モード状態を取得
  const isInEditMode = dashboardStateManager.isInEditMode(reservationId);

  // スムーズ切替のため更新をバッチ実行
  requestAnimationFrame(() => {
    // 1. メモセクションの更新
    _updateMemoSection(reservationId, historyItem, isInEditMode);

    // 2. ボタンエリアの更新
    _updateHistoryCardButton(reservationId);
  });
}

/**
 * メモセクションのみを更新（DOM直接操作）
 * @param {string} reservationId - 予約ID
 * @param {ReservationCore} historyItem - 履歴データ
 * @param {boolean} isInEditMode - 編集モード状態
 */
export function _updateMemoSection(reservationId, historyItem, isInEditMode) {
  const cardElement = document.querySelector(
    `[data-reservation-id="${reservationId}"]`,
  );
  if (!cardElement) return;

  // より確実なセレクターを使ってメモセクションを探す
  let existingMemoSection;

  if (isInEditMode) {
    // 通常モード→編集モード：読み取り専用メモセクションを探す
    // メモセクションは bg-white/75 を持つ div 内に p 要素がある
    const memoContainers = Array.from(
      cardElement.querySelectorAll('div.p-0\\.5.bg-white\\/75'),
    );
    for (const container of memoContainers) {
      // p 要素を持つコンテナ（読み取り専用モード）
      if (container.querySelector('p.whitespace-pre-wrap')) {
        existingMemoSection = container;
        break;
      }
    }
  } else {
    // 編集モード→通常モード：テキストエリアを含むメモセクションを探す
    const textarea = cardElement.querySelector('.memo-edit-textarea');
    if (textarea) {
      // テキストエリアの適切な親コンテナを探す
      existingMemoSection =
        textarea.closest('div.p-0\\.5.bg-white\\/75') ||
        textarea.closest('div.p-0\\.5') ||
        textarea.closest('.memo-section') ||
        textarea.closest('div[style*="padding"]') ||
        textarea.closest('div');
    }

    // フォールバック：メモセクション全体を再検索
    if (!existingMemoSection) {
      const memoContainers = Array.from(
        cardElement.querySelectorAll('div.p-0\\.5.bg-white\\/75'),
      );
      for (const container of memoContainers) {
        if (container.querySelector('p.whitespace-pre-wrap')) {
          existingMemoSection = container;
          break;
        }
      }
    }
  }

  if (!existingMemoSection) {
    return; // メモセクションが見つからない場合は処理を中断
  }

  // 新しいメモセクションHTMLを生成
  const newMemoSection = Components.memoSection({
    reservationId: historyItem.reservationId,
    sessionNote: historyItem.sessionNote || '',
    isEditMode: isInEditMode,
    showSaveButton: true,
  });

  // メモセクションを置換
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = newMemoSection;
  const newMemoElement = tempDiv.firstElementChild;

  if (newMemoElement && existingMemoSection.parentNode) {
    // 置換を実行
    existingMemoSection.parentNode.replaceChild(
      newMemoElement,
      existingMemoSection,
    );

    // 編集モードの場合、置換直後にイベントリスナーを設定
    if (isInEditMode) {
      setTimeout(() => {
        _attachMemoEventListeners(reservationId);
      }, 50);
    }
  }
}

/**
 * 統一されたテキストエリアID生成
 * @param {string} reservationId - 予約ID
 * @returns {string} テキストエリアID
 */
export function _getMemoTextareaId(reservationId) {
  return `memo-edit-textarea-${reservationId}`;
}

/**
 * メモテキストエリアにイベントリスナーを設定
 * @param {string} reservationId - 予約ID
 */
export function _attachMemoEventListeners(reservationId) {
  const textareaId = _getMemoTextareaId(reservationId);

  // テキストエリアを検索（複数の方法で確実に取得）
  let textarea = /** @type {HTMLTextAreaElement | null} */ (
    document.getElementById(textareaId)
  );

  if (!textarea) {
    const cardElement = document.querySelector(
      `[data-reservation-id="${reservationId}"]`,
    );
    if (cardElement) {
      textarea = /** @type {HTMLTextAreaElement | null} */ (
        cardElement.querySelector('.memo-edit-textarea')
      );
      if (!textarea) {
        textarea = /** @type {HTMLTextAreaElement | null} */ (
          cardElement.querySelector(`[data-reservation-id="${reservationId}"]`)
        );
      }
    }
  }

  if (!textarea) {
    const allTextAreas = Array.from(document.querySelectorAll('textarea'));
    textarea = /** @type {HTMLTextAreaElement | null} */ (
      allTextAreas.find(
        ta =>
          ta.id === textareaId || ta.dataset['reservationId'] === reservationId,
      )
    );
  }

  if (textarea) {
    const anyTextarea = /** @type {any} */ (textarea);

    // 既存のリスナーをクリーンアップ
    if (anyTextarea._memoInputHandler) {
      textarea.removeEventListener('input', anyTextarea._memoInputHandler);
    }
    if (anyTextarea._memoFocusHandler) {
      textarea.removeEventListener('focus', anyTextarea._memoFocusHandler);
    }

    let savedScrollY = window.scrollY;

    anyTextarea._memoFocusHandler = () => {
      requestAnimationFrame(() => {
        window.scrollTo(0, savedScrollY);
      });
    };

    anyTextarea._memoInputHandler = (/** @type {Event} */ event) => {
      const currentValue = /** @type {HTMLTextAreaElement} */ (event.target)
        .value;
      const hasChanged = dashboardStateManager.updateMemoInputChanged(
        reservationId,
        currentValue,
      );

      // 状態が実際に変更された場合のみボタンを即座更新
      if (hasChanged !== undefined) {
        _updateHistoryCardButton(reservationId);
      }
    };

    // イベントリスナーを設定
    textarea.addEventListener('focus', anyTextarea._memoFocusHandler);
    textarea.addEventListener('input', anyTextarea._memoInputHandler);

    // マウスダウン時にもスクロール位置を保存（クリック時対応）
    textarea.addEventListener('mousedown', () => {
      savedScrollY = window.scrollY;
    });
  }
}

/**
 * 履歴カードのボタンのみを部分更新（無限ループ防止）
 * @param {string} reservationId - 予約ID
 */
export function _updateHistoryCardButton(reservationId) {
  const cardElement = document.querySelector(
    `[data-reservation-id="${reservationId}"]`,
  );
  if (!cardElement) return;

  // ボタンエリアを探す（実際のHTML構造に合わせる）
  let buttonArea = cardElement.querySelector('.flex.gap-1');

  // フォールバック：別のセレクターでも探す
  if (!buttonArea) {
    buttonArea = cardElement.querySelector(
      '.flex-shrink-0.self-start.flex.gap-1',
    );
  }

  if (!buttonArea) {
    console.warn(
      'ボタンエリアが見つかりません:',
      reservationId,
      'カード内要素:',
      cardElement.innerHTML,
    );
    return;
  }

  const state = dashboardStateManager.getState();
  const historyItem = state.myReservations.find(
    (/** @type {ReservationCore} */ h) => h.reservationId === reservationId,
  );
  if (!historyItem) return;

  const isInEditMode = dashboardStateManager.isInEditMode(reservationId);
  const editButtons = _buildHistoryEditButtons(isInEditMode, reservationId);
  let accountingButtons = _buildHistoryAccountingButtons(historyItem);

  // 編集モード時に会計記録ボタンを追加（_buildHistoryCardWithEditModeと同じロジック）
  if (isInEditMode) {
    const isToday = _isToday(String(historyItem.date));
    if (historyItem.status === CONSTANTS.STATUS.COMPLETED && !isToday) {
      // 重複チェック：既に「会計記録」ボタンが存在しない場合のみ追加
      const hasAccountingDetailsButton = accountingButtons.some(
        btn => btn.action === 'showHistoryAccounting',
      );

      if (!hasAccountingDetailsButton) {
        accountingButtons = [
          ...accountingButtons,
          {
            action: 'showHistoryAccounting',
            text: '¥会計<br>記録',
            style: 'accounting',
            details: historyItem.accountingDetails,
          },
        ];
      }
    }
  }

  // 会計ボタンHTML生成
  const accountingButtonsHtml = accountingButtons
    .map(btn =>
      Components.button({
        action: btn.action,
        text: btn.text,
        style: btn.style || 'accounting',
        customClass: btn.customClass || '',
        dataAttributes: {
          classroom: historyItem.classroom,
          reservationId: historyItem.reservationId,
          date: historyItem.date,
          ...(btn.details && { details: JSON.stringify(btn.details) }),
          ...(btn.dataAttributes || {}),
        },
      }),
    )
    .join('');

  // 編集ボタンHTML生成
  const editButtonsHtml = editButtons
    .map(btn =>
      Components.button({
        action: btn.action,
        text: btn.text,
        style: btn.style || 'recordCard',
        customClass: btn.customClass || '',
        dataAttributes: {
          classroom: historyItem.classroom,
          reservationId: historyItem.reservationId,
          date: historyItem.date,
          ...(btn.dataAttributes || {}),
        },
      }),
    )
    .join('');

  // ボタンエリアを更新
  buttonArea.innerHTML = accountingButtonsHtml + editButtonsHtml;
}
