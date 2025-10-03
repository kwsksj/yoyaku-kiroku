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

  console.log('📊 ダッシュボード表示開始');
  console.log('   myReservations:', myReservations);
  console.log('   予約数:', myReservations.length);

  // 予約セクション用のカード配列を構築：確定・待機ステータスのみ表示
  const activeReservations = myReservations
    .filter(
      res =>
        res.status === CONSTANTS.STATUS.CONFIRMED ||
        res.status === CONSTANTS.STATUS.WAITLISTED,
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // 新しい順ソート

  console.log('   アクティブな予約:', activeReservations.length, '件');

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
        <div class="flex flex-col sm:flex-row justify-between sm:items-center my-2">
            <h1 class="text-base sm:text-xl font-bold ${DesignConfig.colors.text} mr-4 mb-1 sm:mb-0">ようこそ <span class="text-xl whitespace-nowrap">${stateManager.getState().currentUser.displayName} <span class="text-base">さん</span></span></h1>
            <button data-action="showEditProfile" class="${DesignConfig.colors.info} self-end sm:self-auto text-sm text-action-secondary-text px-3 py-0.5 rounded-md active:bg-action-secondary-hover">Profile 編集</button>
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

  if (booking.status === CONSTANTS.STATUS.CONFIRMED) {
    // 確定済み予約：確認/編集ボタンのみ
    buttons.push({
      action: 'goToEditReservation',
      text: '確認<br>編集',
    });
  } else if (booking.status === CONSTANTS.STATUS.WAITLISTED) {
    // 空席連絡希望：現在の空席状況に応じてボタンを変更
    const isCurrentlyAvailable = _checkIfLessonAvailable(booking);

    if (isCurrentlyAvailable) {
      // 現在空席：予約するボタンを追加
      buttons.push({
        action: 'confirmWaitlistedReservation',
        text: '予約する',
        style: 'primary',
      });
    }

    // 空席連絡希望は常に確認/編集ボタンも表示
    buttons.push({
      action: 'goToEditReservation',
      text: '確認<br>編集',
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
      style: 'accounting',
    });
  }

  return buttons;
};

/**
 * 履歴カードの編集ボタン配列を生成します。
 * @param {boolean} isInEditMode - 編集モードフラグ
 * @param {string} reservationId - 予約ID
 * @returns {Array<any>} 編集ボタン設定配列
 */
const _buildHistoryEditButtons = (isInEditMode = false, reservationId = '') => {
  const buttons = [];
  const state = stateManager.getState();

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
        size: 'xs',
        dataAttributes: {
          reservationId: reservationId,
        },
      });
    } else {
      // 入力変更なし：とじるボタンを表示
      buttons.push({
        action: 'closeEditMode',
        text: 'とじる',
        size: 'xs',
        dataAttributes: {
          reservationId: reservationId,
        },
      });
    }
  } else {
    // 通常時：編集モードに入る
    buttons.push({
      action: 'expandHistoryCard',
      text: '確認<br>編集',
      size: 'xs',
    });
  }

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
        text: '会計を<br>修正',
        style: 'accounting',
      });
    }
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
    // 空席連絡希望の場合、現在の空席状況に応じてバッジを変更
    const isCurrentlyAvailable = _checkIfLessonAvailable(booking);
    if (isCurrentlyAvailable) {
      badges.push({ type: 'success', text: '予約可能！' });
    } else {
      badges.push({ type: 'warning', text: '空き連絡希望' });
    }
  }

  return badges;
};

/**
 * 指定した予約に対応する講座が現在予約可能かチェック
 * @param {ReservationData} booking - 予約データ
 * @returns {boolean} 予約可能な場合true
 */
const _checkIfLessonAvailable = booking => {
  const state = stateManager.getState();
  const lessons = state.lessons || [];

  if (!window.isProduction) {
    console.log('🔍 空席判定開始:', {
      bookingDate: booking.date,
      bookingClassroom: booking.classroom,
      lessonsCount: lessons.length,
      lessonsAvailable: lessons.length > 0,
    });
  }

  // 該当する講座を検索
  const targetLesson = lessons.find(
    lesson =>
      lesson.schedule.date === String(booking.date) &&
      lesson.schedule.classroom === booking.classroom,
  );

  if (!targetLesson) {
    if (!window.isProduction) {
      console.log('❌ 該当講座が見つかりません:', {
        searchDate: String(booking.date),
        searchClassroom: booking.classroom,
        availableLessons: lessons.map(l => ({
          date: l.schedule.date,
          classroom: l.schedule.classroom,
        })),
      });
    }
    return false;
  }

  // 2部制の場合はセッション別に判定
  if (
    targetLesson.schedule.classroomType === CONSTANTS.CLASSROOM_TYPES.TIME_DUAL
  ) {
    const status = targetLesson.status;
    const schedule = targetLesson.schedule;
    const bookingStartTime = booking.startTime;
    const bookingEndTime = booking.endTime;

    // --- 必須データの存在チェック ---
    if (!status || !schedule || !bookingStartTime || !bookingEndTime) {
      if (!window.isProduction) {
        console.error(
          '❌ 2部制判定エラー: 必須データ(status, schedule, booking times)が不足しています。',
          { booking, targetLesson },
        );
      }
      return false;
    }

    const morningEndTime = schedule.firstEnd;
    const afternoonStartTime = schedule.secondStart;

    // --- セッション境界時刻の存在チェック ---
    if (!morningEndTime || !afternoonStartTime) {
      if (!window.isProduction) {
        console.error(
          '❌ 2部制判定エラー: セッション境界時刻(firstEnd, secondStart)がscheduleに定義されていません。',
          { schedule },
        );
      }
      return false;
    }

    // --- 予約時間に基づいて、チェックが必要なセッションを判断 ---
    const morningCheckRequired = bookingStartTime < morningEndTime;
    const afternoonCheckRequired = bookingEndTime > afternoonStartTime;

    // 予約がどちらのセッションにもかからない場合、不正な予約時間とみなしfalseを返す
    if (!morningCheckRequired && !afternoonCheckRequired) {
      if (!window.isProduction) {
        console.warn('⚠️ 2部制判定警告: 予約時間がセッションの範囲外です。', {
          booking,
          schedule,
        });
      }
      return false;
    }

    // --- 各セッションの空き状況をチェック ---
    let morningHasSlots = true; // チェック不要な場合はtrueとして扱う
    if (morningCheckRequired) {
      morningHasSlots = (status.morningSlots || 0) > 0;
    }

    let afternoonHasSlots = true; // チェック不要な場合はtrueとして扱う
    if (afternoonCheckRequired) {
      afternoonHasSlots = (status.afternoonSlots || 0) > 0;
    }

    // 必要なセッション全てに空きがあるか最終判定
    const isAvailable = morningHasSlots && afternoonHasSlots;

    if (!window.isProduction) {
      console.log('📊 2部制判定結果 (詳細ロジック):', {
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
          morning: status.morningSlots,
          afternoon: status.afternoonSlots,
        },
        result: { morningHasSlots, afternoonHasSlots },
        isAvailable,
      });
    }

    return isAvailable;
  } else {
    // 通常の講座（セッション制・全日時間制）
    const isAvailable =
      !targetLesson.status.isFull &&
      (targetLesson.status.availableSlots || 0) > 0;

    if (!window.isProduction) {
      console.log('📊 通常講座判定結果:', {
        isFull: targetLesson.status.isFull,
        availableSlots: targetLesson.status.availableSlots,
        isAvailable,
        status: targetLesson.status,
      });
    }

    return isAvailable;
  }
};

/**
 * 特定の履歴カードのメモセクションとボタンのみを部分更新（ちらつき防止・スムーズ切替）
 * @param {string} reservationId - 更新対象の予約ID
 */
function updateSingleHistoryCard(reservationId) {
  // 該当するカードのDOM要素を取得
  const cardElement = document.querySelector(
    `[data-reservation-id="${reservationId}"]`,
  );
  if (!cardElement) {
    console.warn('カードが見つかりません:', reservationId);
    return;
  }

  // 現在の状態から該当する履歴アイテムを取得
  const state = stateManager.getState();
  const historyItem = state.myReservations.find(
    h => h.reservationId === reservationId,
  );
  if (!historyItem || historyItem.status !== CONSTANTS.STATUS.COMPLETED) return;

  // 編集モード状態を取得
  const isInEditMode = stateManager.isInEditMode(reservationId);

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
 * @param {ReservationData} historyItem - 履歴データ
 * @param {boolean} isInEditMode - 編集モード状態
 */
function _updateMemoSection(reservationId, historyItem, isInEditMode) {
  const cardElement = document.querySelector(
    `[data-reservation-id="${reservationId}"]`,
  );
  if (!cardElement) return;

  // より確実なセレクターを使ってメモセクションを探す
  let existingMemoSection;

  if (isInEditMode) {
    // 通常モード→編集モード：読み取り専用メモセクションを探す
    // 「制作メモ」という見出しを含む要素を探す
    const memoHeaders = Array.from(cardElement.querySelectorAll('h4'));
    for (const header of memoHeaders) {
      if (header.textContent && header.textContent.includes('制作メモ')) {
        existingMemoSection = header.closest('div');
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
      const memoHeaders = Array.from(cardElement.querySelectorAll('h4'));
      for (const header of memoHeaders) {
        if (header.textContent && header.textContent.includes('制作メモ')) {
          existingMemoSection = header.closest('div');
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
    workInProgress: historyItem.workInProgress || '',
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
function _getMemoTextareaId(reservationId) {
  return `memo-edit-textarea-${reservationId}`;
}

/**
 * メモテキストエリアにイベントリスナーを設定
 * @param {string} reservationId - 予約ID
 */
function _attachMemoEventListeners(reservationId) {
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
      const currentValue = event.target.value;
      const hasChanged = stateManager.updateMemoInputChanged(
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
function _updateHistoryCardButton(reservationId) {
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

  const state = stateManager.getState();
  const historyItem = state.myReservations.find(
    h => h.reservationId === reservationId,
  );
  if (!historyItem) return;

  const isInEditMode = stateManager.isInEditMode(reservationId);
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
            text: '会計<br>記録',
            style: 'accounting',
            size: 'xs',
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
        size: 'xs',
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
        size: btn.size || 'xs',
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
