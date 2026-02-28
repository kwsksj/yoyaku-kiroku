/**
 * =================================================================
 * ファイル概要
 * -----------------------------------------------------------------
 * 名称: 13_WebApp_Views_Dashboard.js
 * 目的: ダッシュボード画面の各セクションを構築する
 * 主な責務:
 *   - よやく/履歴カードの生成と表示制御
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
import { _isToday } from './13_WebApp_Views_Utils.js';

const dashboardStateManager = appWindow.stateManager;

/**
 * 時刻文字列（HH:mm）を分に変換します。
 * @param {string | undefined} timeStr
 * @returns {number | null}
 */
const parseTimeToMinutesForDashboard = timeStr => {
  if (!timeStr) return null;
  const [hourStr, minuteStr] = timeStr.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr || '0');
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
};

/**
 * よやくが夜教室か判定します。
 * @param {ReservationCore} booking
 * @returns {boolean}
 */
const _isNightBooking = booking => {
  const state = dashboardStateManager.getState();
  const lessons = state.lessons || [];
  const targetLesson = lessons.find(
    (/** @type {LessonCore} */ lesson) =>
      lesson.date === String(booking.date) &&
      lesson.classroom === booking.classroom,
  );
  const startTime =
    targetLesson?.firstStart ||
    targetLesson?.startTime ||
    targetLesson?.secondStart ||
    booking.startTime ||
    '';
  const startMinutes = parseTimeToMinutesForDashboard(startTime);
  return startMinutes !== null && startMinutes >= 17 * 60;
};
/**
 * メインのホーム画面のUIを生成します。
 * 【改善】ビジネスロジックをヘルパー関数に分離して可読性向上
 * @returns {string} HTML文字列
 */
export const getDashboardView = () => {
  // myReservationsから直接フィルタリングして表示（シンプル化）
  const state = dashboardStateManager.getState();
  const myReservations = state.myReservations || [];

  debugLog('📊 ダッシュボード表示開始');
  debugLog('   myReservations:', myReservations);
  debugLog('   よやく数:', myReservations.length);

  // よやくセクション用のカード配列を構築：確定・待機ステータスかつ当日以降のみ表示
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeReservations = myReservations
    .filter((/** @type {ReservationCore} */ res) => {
      // ステータスが確定または待機中
      const isActiveStatus =
        res.status === CONSTANTS.STATUS.CONFIRMED ||
        res.status === CONSTANTS.STATUS.WAITLISTED;
      if (!isActiveStatus) return false;

      // 当日以降のよやくのみ表示
      const resDate = new Date(res.date);
      resDate.setHours(0, 0, 0, 0);
      return resDate >= today;
    })
    .sort(
      (/** @type {ReservationCore} */ a, /** @type {ReservationCore} */ b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime(),
    ); // 日付順（古い順）

  debugLog('   アクティブなよやく:', activeReservations.length, '件');

  // よやくカードを生成（今日のよやくには「本日」バッジを追加）
  const bookingCards = activeReservations.map(
    (/** @type {ReservationCore} */ b) => {
      const badges = _buildBookingBadges(b);

      // 今日のよやくに「本日」バッジを追加（UX改善）
      if (_isToday(b.date)) {
        badges.unshift({ type: 'attention', text: '本日' });
      }

      const editButtons = _buildEditButtons(b);

      return Components.listCard({
        item: b,
        badges: badges,
        editButtons: editButtons,
      });
    },
  );

  // よやくがない場合の空状態デザイン
  const emptyBookingHtml =
    activeReservations.length === 0
      ? `<div class="text-center py-6 text-brand-muted">
          <p class="text-base">よやくは ありません</p>
          <p class="text-sm mt-1">メニュー から よやく できます</p>
        </div>`
      : '';

  // よやくセクションを生成（Componentsに構造生成を委任）
  const yourBookingsHtml = Components.dashboardSection({
    title: 'よやく',
    items: activeReservations.length > 0 ? bookingCards : [emptyBookingHtml],
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

  // すべての記録を表示（データは既に全件取得済み）
  const completedRecords = completedReservations;

  if (completedRecords.length > 0) {
    // リストビュー形式できろくを表示
    /** @type {number | null} */
    let lastYear = null; // 年が変わったらセパレーターを表示するため
    const historyListItems = completedRecords.map(
      (/** @type {ReservationCore} */ h, index) => {
        // 編集モード状態を取得（formInputCacheからの復元も考慮）
        const memoCache = dashboardStateManager.getFormInputCache(
          `memoEdit:${h.reservationId}`,
        );
        let isInEditMode = dashboardStateManager.isInEditMode(h.reservationId);

        // formInputCacheに編集状態があれば復元
        if (memoCache?.isEditing) {
          isInEditMode = true;
          // stateManagerにも編集状態を反映
          dashboardStateManager.startEditMode(
            h.reservationId,
            h.sessionNote || '',
          );
        }

        // 編集中のテキストを取得（formInputCacheから復元されたもの優先）
        const editingMemoText = memoCache?.text ?? (h.sessionNote || '');

        // 日付の年を取得
        const dateObj = new Date(h.date);
        const year = dateObj.getFullYear();
        const currentYear = new Date().getFullYear();

        // 年が切り替わるタイミングで年表示
        let yearSeparator = '';
        if (lastYear !== null && lastYear !== year) {
          yearSeparator = `<div class="text-xs text-brand-subtle text-center py-1 border-t border-brand-subtle/30 mt-2">── ${year}年 ──</div>`;
        } else if (index === 0 && year !== currentYear) {
          // 最初の記録が今年でない場合も年を表示
          yearSeparator = `<div class="text-xs text-brand-subtle text-center py-1">── ${year}年 ──</div>`;
        }
        lastYear = year;

        // 日付・時間・教室・会場を小さく表示
        const dateStr = formatDate(String(h.date));
        const timeStr = h.startTime ? `${h.startTime}~${h.endTime}` : '';
        const classroomStr = h.classroom || '';
        const venueStr = h.venue || '';

        // ヘッダー行（日付・教室などを小さく表示、時間はより小さく）
        const headerLine = `
          <div class="flex items-center gap-1.5 text-sm text-brand-subtle mb-1 flex-wrap">
            <span class="font-bold">${dateStr}</span>
            ${timeStr ? `<span class="text-xs">${escapeHTML(timeStr)}</span>` : ''}
            ${classroomStr ? `<span>${escapeHTML(classroomStr)}</span>` : ''}
            ${venueStr ? `<span class="text-xs">${escapeHTML(venueStr)}</span>` : ''}
          </div>
        `;

        // メモセクション（改良版を維持）- 復元されたテキストを使用
        const memoHtml = Components.memoSection({
          reservationId: h.reservationId,
          sessionNote: isInEditMode ? editingMemoText : h.sessionNote || '',
          isEditMode: isInEditMode,
          showSaveButton: true,
        });

        return `
          ${yearSeparator}
          <div class="border-b border-ui-border last:border-b-0 py-2" data-reservation-id="${h.reservationId}">
            ${headerLine}
            ${memoHtml}
          </div>
        `;
      },
    );

    // リストビュー形式のきろくセクション
    const historyListHtml = `
      <div class="w-full max-w-md mx-auto">
        <div class="bg-brand-light border-2 border-brand-subtle/30 p-2 ${DesignConfig.borderRadius.container}">
          ${historyListItems.join('')}
        </div>
      </div>
    `;

    historyHtml = Components.dashboardSection({
      title: 'きろく',
      items: [historyListHtml],
    });
  } else {
    // 履歴がない場合は空状態を表示
    const emptyHistoryHtml = `<div class="text-center py-6 text-brand-muted">
          <p class="text-base">きろく は まだ ありません</p>
          <p class="text-sm mt-1">さんかすると ここに きろく されます</p>
        </div>`;

    historyHtml = Components.dashboardSection({
      title: 'きろく',
      items: [emptyHistoryHtml],
    });
  }

  const currentUser = dashboardStateManager.getState().currentUser;
  const nickname = currentUser
    ? currentUser.displayName ||
      currentUser.nickname ||
      currentUser.realName ||
      ''
    : '';

  // 今日のよやくを検索（会計フォールバックボタン用）
  const todayReservation = activeReservations.find(
    (/** @type {ReservationCore} */ r) => _isToday(r.date),
  );

  // --- メニューセクション ---
  const menuButton = Components.button({
    text: 'みんな の<br>よやく・きろく',
    action: 'goToParticipantsView',
    style: 'primary',
    customClass:
      'w-full h-[3.5rem] flex items-center justify-center leading-snug !px-0',
  });

  // 新規よやくボタン（直接よやく画面に遷移）
  const newBookingButton = Components.button({
    text: 'よやく<br>する',
    action: 'goToBookingView',
    style: 'primary',
    customClass:
      'w-full h-[3.5rem] flex items-center justify-center leading-snug !px-0',
  });

  // 今日のよやくがある場合のみ表示するボタン（2カラム幅で目立たせる）
  const summaryMenuButton = todayReservation
    ? Components.button({
        text: 'きょう の まとめ<br>（かいけい）',
        action: 'goToSessionConclusion',
        style: 'primary',
        customClass:
          'w-full h-[3.5rem] flex items-center justify-center leading-snug px-0 col-span-2',
      })
    : '';

  // 作品集リンク
  const photoButton = Components.button({
    text: 'さくひん<br>ギャラリー',
    action: 'openPhotoGallery',
    style: 'secondary',
    customClass:
      'w-full h-[3.5rem] flex items-center justify-center leading-snug !px-0',
  });

  // メニュー内の補助ボタン（控えめ表示・枠線なし）
  const subtleMenuButtonClass = `w-full h-[2.75rem] flex items-center justify-center leading-tight text-xs font-normal !px-1 bg-brand-light text-brand-subtle active:bg-ui-input shadow-none ${DesignConfig.borderRadius.button}`;

  // 会計履歴ボタン
  const accountingHistoryButton = Components.button({
    text: 'かいけい<br>履歴',
    action: 'showAccountingHistory',
    style: 'none',
    customClass: subtleMenuButtonClass,
  });

  // プロフィール編集ボタン
  const profileEditButton = Components.button({
    text: 'プロフィール<br>編集',
    action: 'showEditProfile',
    style: 'none',
    customClass: subtleMenuButtonClass,
  });

  // ログアウトボタン（メニュー内の控えめ表示）
  const logoutButton = Components.button({
    text: 'ログアウト',
    action: 'logout',
    style: 'none',
    customClass: subtleMenuButtonClass,
  });

  // 先生へ連絡ボタン
  const messageToTeacherButton = Components.button({
    text: 'せんせい へ<br>れんらく',
    action: 'showMessageToTeacherModal',
    style: 'secondary',
    customClass:
      'w-full h-[3.5rem] flex items-center justify-center leading-snug !px-0',
  });

  // メニューアイテムを構築（通常ボタンと控えめボタンを分離）
  const mainMenuButtons = [
    summaryMenuButton,
    menuButton,
    newBookingButton,
    photoButton,
    messageToTeacherButton,
  ]
    .filter(Boolean)
    .join('');

  // 目立たない補助ボタンは3列で表示
  const subtleMenuButtons = [
    accountingHistoryButton,
    profileEditButton,
    logoutButton,
  ]
    .filter(Boolean)
    .join('');

  const menuSectionHtml = `
    <div class="mb-2 w-full">
      <div class="bg-ui-surface border-2 border-ui-border p-3 ${DesignConfig.borderRadius.container} shadow-sm space-y-3">
        <div class="w-full max-w-md mx-auto">
          <div class="grid grid-cols-2 gap-3 items-start">${mainMenuButtons}</div>
          <div class="grid grid-cols-3 gap-2 items-start mt-2">${subtleMenuButtons}</div>
        </div>
      </div>
    </div>
  `;

  // けいかく・もくひょうセクション（生徒名簿から取得、編集可能）
  const nextLessonGoal = currentUser?.['nextLessonGoal'] || '';
  // 編集アイコンSVG（共通関数を使用）
  const editIconSvg = Components.editIcon();

  // formInputCacheから編集状態を復元（リロード対応）
  const goalEditCache = dashboardStateManager.getFormInputCache('goalEdit');
  const isGoalEditMode = goalEditCache?.isEditing || false;
  const goalEditText = goalEditCache?.text ?? nextLessonGoal;

  // 編集モードで復元するか、目標が空の場合は編集モード
  const shouldShowGoalEditMode = isGoalEditMode || !nextLessonGoal;

  const goalCardContent = `
    <div class="w-full max-w-md mx-auto">
      <div class="bg-brand-light border-2 border-brand-subtle/30 p-2 ${DesignConfig.borderRadius.container}">
        <!-- 表示モード -->
        <div id="goal-display-mode" class="${shouldShowGoalEditMode ? 'hidden' : ''}">
          <div class="bg-white/75 rounded p-2 relative">
            <p id="goal-display-text" class="text-base text-brand-text whitespace-pre-wrap pr-8 min-h-8">${escapeHTML(nextLessonGoal) || 'まだ設定されていません'}</p>
            <button data-action="editGoal" class="absolute bottom-1 right-1 p-1 text-brand-subtle hover:text-brand-text active:bg-brand-light rounded transition-colors" aria-label="けいかく・もくひょうを編集">${editIconSvg}</button>
          </div>
        </div>
        <!-- 編集モード -->
        <div id="goal-edit-mode" class="${shouldShowGoalEditMode ? '' : 'hidden'}">
          ${Components.textarea({
            id: 'goal-edit-textarea',
            label: '',
            value: goalEditText,
            placeholder:
              'つくりたいもの、さぎょうよてい、けいかく、もくひょう など メモしましょう',
            rows: 5,
            caption: '「みんな の よやく・きろく」にも のります。',
          })}
          <div class="flex justify-end mt-2 gap-2">
            ${nextLessonGoal ? `<button data-action="cancelEditGoal" class="text-sm text-action-secondary-text px-3 py-1 ${DesignConfig.borderRadius.button} border border-ui-border">キャンセル</button>` : ''}
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
  `;
  const goalSectionHtml = Components.dashboardSection({
    title: 'けいかく・もくひょう',
    items: [goalCardContent],
  });

  // --- 4. Render Whole Dashboard ---
  const headerHtml = `
        <div class="mt-16 mb-2">
            <h1 class="text-base sm:text-xl font-bold ${DesignConfig.colors.text}">ようこそ <span class="text-xl whitespace-nowrap">${nickname} <span class="text-base">さん</span></span></h1>
        </div>
        <!-- セクション順序: メニュー→けいかく→よやく→きろく -->
        ${menuSectionHtml}
        ${goalSectionHtml}
        ${yourBookingsHtml}
        ${historyHtml}
    `;

  return Components.pageContainer({
    maxWidth: 'md',
    content: headerHtml,
  });
};

/**
 * よやくカードの編集ボタン配列を生成します。
 * @param {ReservationCore} booking - よやくデータ
 * @returns {Array<any>} 編集ボタン設定配列
 */
export const _buildEditButtons = booking => {
  const buttons = [];

  if (booking.status === CONSTANTS.STATUS.CONFIRMED) {
    // 確定済みよやく：確認/編集ボタンのみ
    buttons.push({
      action: 'goToEditReservation',
      text: 'かくにん<br>へんしゅう',
    });
  } else if (booking.status === CONSTANTS.STATUS.WAITLISTED) {
    // 空き通知希望：現在の空席状況に応じてボタンを変更
    const isCurrentlyAvailable = _checkIfLessonAvailable(booking);

    if (isCurrentlyAvailable) {
      // 現在空席：「よやくする」ボタンを表示（モーダルで確認）
      buttons.push({
        action: 'confirmWaitlistedReservation',
        text: 'よやくする',
        style: 'primary',
        // アイコンモード無効化のため、useEditIcon: falseをlistCardに渡す必要あり
        useTextButton: true,
      });
    } else {
      // 空席なし：通常の確認/編集ボタン
      buttons.push({
        action: 'goToEditReservation',
        text: 'かくにん<br>へんしゅう',
      });
    }
  }

  return buttons;
};

/**
 * よやくカードのバッジ配列を生成します。
 * @param {ReservationCore} booking - よやくデータ
 * @returns {Array<{type: BadgeType, text: string}>} バッジ設定配列
 */
export const _buildBookingBadges = booking => {
  /** @type {Array<{type: BadgeType, text: string}>} */
  const badges = [];

  if (booking.firstLecture) {
    badges.push({ type: 'beginner', text: '初回講習' });
  }

  if (_isNightBooking(booking)) {
    badges.push({ type: 'night', text: '夜' });
  }

  if (
    booking.status === CONSTANTS.STATUS.WAITLISTED ||
    /** @type {any} */ (booking).isWaiting
  ) {
    // 空き通知希望の場合、現在の空席状況に応じてバッジを変更
    const isCurrentlyAvailable = _checkIfLessonAvailable(booking);
    if (isCurrentlyAvailable) {
      badges.push({ type: 'success', text: 'よやく可能！' });
    } else {
      badges.push({ type: 'warning', text: '空き通知希望' });
    }
  }

  return badges;
};

/**
 * 指定したよやくに対応する講座が現在よやく可能かチェック
 * @param {ReservationCore} booking - よやくデータ
 * @returns {boolean} よやく可能な場合true
 */
export const _checkIfLessonAvailable = booking => {
  const state = dashboardStateManager.getState();
  const lessons = state.lessons || [];

  if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
    debugLog('🔍 空席判定開始:', {
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
      debugLog('❌ 該当講座が見つかりません:', {
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

    // --- よやく時間に基づいて、チェックが必要なセッションを判断 ---
    const morningCheckRequired = bookingStartTime < morningEndTime;
    const afternoonCheckRequired = bookingEndTime > afternoonStartTime;

    // よやくがどちらのセッションにもかからない場合、不正なよやく時間とみなしfalseを返す
    if (!morningCheckRequired && !afternoonCheckRequired) {
      if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
        console.warn('⚠️ 2部制判定警告: よやく時間がセッションの範囲外です。', {
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
      debugLog('📊 2部制判定結果 (詳細ロジック):', {
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
      debugLog('📊 通常講座判定結果:', {
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
  // data-memo-container属性を使用（CSSクラスの変更に影響されない）
  let existingMemoSection = cardElement.querySelector('[data-memo-container]');

  // フォールバック：属性がない古いコンテンツの場合
  if (!existingMemoSection) {
    if (isInEditMode) {
      // 通常モード→編集モード：読み取り専用メモセクションを探す
      const memoContainers = Array.from(
        cardElement.querySelectorAll('div.p-0\\.5.bg-white\\/75'),
      );
      for (const container of memoContainers) {
        if (container.querySelector('p.whitespace-pre-wrap')) {
          existingMemoSection = container;
          break;
        }
      }
    } else {
      // 編集モード→通常モード：テキストエリアを含むメモセクションを探す
      const textarea = cardElement.querySelector('.memo-edit-textarea');
      if (textarea) {
        existingMemoSection = textarea.closest('div');
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
 * 履歴カードのボタンのみを部分更新
 * 【廃止】ボタンはmemoSection内に移動したため、この関数は空実装になりました。
 * 将来削除予定ですが、呼び出し元との互換性のため空関数として残しています。
 * @param {string} _reservationId - 予約ID（未使用）
 */
export function _updateHistoryCardButton(_reservationId) {
  // ボタンはmemoSection内に移動したため、この関数では何もしない
}
