/**
 * =================================================================
 * ファイル概要
 * -----------------------------------------------------------------
 * 名称: 14_WebApp_Handlers_Participant.js
 * 目的: 参加者リスト画面のアクションハンドラ
 * 主な責務:
 *   - レッスン選択処理
 *   - 生徒選択処理
 *   - サブビュー遷移処理
 * =================================================================
 */

import { Components } from './13_WebApp_Components.js';
import { render } from './14_WebApp_Handlers.js';
import { restoreScrollPositionIfViewUnchanged } from './14_WebApp_Handlers_Utils.js';

/** @type {SimpleStateManager} */
const participantHandlersStateManager = appWindow.stateManager;

// 生徒詳細は participantAllStudents でプリロードされるため、個別キャッシュは不要になりました

/** @type {boolean} 過去データ追加入力中フラグ */
let isLoadingMorePastLessons = false;
/** @type {ReturnType<typeof setTimeout> | null} 達成演出タイマー */
let salesCelebrationTimer = null;
/** @type {number} 参加者データのバックグラウンド再検証間隔（ms） */
const PARTICIPANT_BACKGROUND_REFRESH_INTERVAL_MS = 2 * 60 * 1000;
/** @type {number} 操作ログのバックグラウンド再検証間隔（ms） */
const ADMIN_LOG_BACKGROUND_REFRESH_INTERVAL_MS = 60 * 1000;
/** @type {number} 操作ログの初期取得日数（2週間） */
const ADMIN_LOG_INITIAL_DAYS = CONSTANTS.UI.ADMIN_LOG_INITIAL_DAYS;
/** @type {number} 操作ログ追加取得時の遡り日数（1週間） */
const ADMIN_LOG_LOAD_MORE_DAYS = CONSTANTS.UI.ADMIN_LOG_LOAD_MORE_DAYS;
/** @type {number} 参加者ビューで初期表示する過去遡り月数 */
const PARTICIPANT_INITIAL_PAST_MONTHS =
  CONSTANTS.UI.PARTICIPANT_INITIAL_PAST_MONTHS;
/** @type {number} タブ復帰時の自動再取得を間引く最小間隔（ms） */
const ADMIN_AUTO_REFRESH_THROTTLE_MS = 10 * 1000;
/** @type {number} タブ復帰時の前回自動再取得時刻（ms） */
let lastAdminAutoRefreshAt = 0;

/**
 * オブジェクトのキー順を揃えてJSON文字列化します。
 * @param {any} value
 * @returns {string}
 */
function stableStringify(value) {
  return JSON.stringify(value, (_key, currentValue) => {
    if (
      currentValue &&
      typeof currentValue === 'object' &&
      !Array.isArray(currentValue)
    ) {
      return Object.keys(currentValue)
        .sort()
        .reduce((sorted, key) => {
          sorted[key] = currentValue[key];
          return sorted;
        }, /** @type {Record<string, any>} */ ({}));
    }
    return currentValue;
  });
}

/**
 * レッスン同一性判定キーを返します。
 * @param {import('../../types/core/lesson').LessonCore} lesson
 * @returns {string}
 */
function buildLessonIdentityKey(lesson) {
  const lessonId = lesson?.lessonId ? String(lesson.lessonId) : '';
  if (lessonId) return `id:${lessonId}`;
  return `legacy:${String(lesson?.date || '')}:${String(lesson?.classroom || '')}:${String(lesson?.venue || '')}:${String(lesson?.firstStart || '')}:${String(lesson?.secondStart || '')}`;
}

/**
 * レッスン配列をマージし、日付降順で返します。
 * @param {import('../../types/core/lesson').LessonCore[] | null | undefined} baseLessons
 * @param {import('../../types/core/lesson').LessonCore[] | null | undefined} incomingLessons
 * @returns {import('../../types/core/lesson').LessonCore[]}
 */
function mergeLessonsByIdentity(baseLessons, incomingLessons) {
  /** @type {Record<string, import('../../types/core/lesson').LessonCore>} */
  const mergedLessonMap = {};
  [...(baseLessons || []), ...(incomingLessons || [])].forEach(lesson => {
    mergedLessonMap[buildLessonIdentityKey(lesson)] = lesson;
  });

  return Object.values(mergedLessonMap).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

/**
 * 最終取得日時をもとにデータが古いか判定します。
 * @param {string | null | undefined} dataFetchedAt
 * @param {number} thresholdMs
 * @returns {boolean}
 */
function isDataStale(dataFetchedAt, thresholdMs) {
  if (!dataFetchedAt) return true;
  const fetchedAtTime = new Date(dataFetchedAt).getTime();
  if (!Number.isFinite(fetchedAtTime)) return true;
  return Date.now() - fetchedAtTime >= thresholdMs;
}

/**
 * 参加者データの最終取得日時を返します。
 * @param {UIState} state
 * @returns {string | null | undefined}
 */
function getParticipantDataFetchedAt(state) {
  return state['participantDataFetchedAt'] || state['dataFetchedAt'];
}

/**
 * 操作ログデータの最終取得日時を返します。
 * @param {UIState} state
 * @returns {string | null | undefined}
 */
function getAdminLogsFetchedAt(state) {
  return state['adminLogsFetchedAt'] || state['dataFetchedAt'];
}

/**
 * 操作ログ取得日数を正規化します。
 * 初期表示日数未満は初期表示日数まで切り上げます。
 * @param {unknown} rawDaysBack
 * @returns {number}
 */
function normalizeAdminLogDaysBack(rawDaysBack) {
  const parsed = Number(rawDaysBack);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return ADMIN_LOG_INITIAL_DAYS;
  }
  return Math.max(ADMIN_LOG_INITIAL_DAYS, Math.floor(parsed));
}

/**
 * stateから操作ログ取得日数を取得します。
 * @param {UIState} state
 * @returns {number}
 */
function getAdminLogDaysBackFromState(state) {
  return normalizeAdminLogDaysBack(state['adminLogsDaysBack']);
}

/**
 * 過去タブでさらに遡れるかをstateから判定します。
 * 過去履歴を未取得の間は true 扱いとし、初回取得経路を維持します。
 * @param {UIState} [state]
 * @returns {boolean}
 */
function hasMorePastLessonsFromState(state) {
  const targetState = state || participantHandlersStateManager.getState();
  if (targetState.participantHasPastLessonsLoaded !== true) {
    return true;
  }
  return targetState['participantHasMorePastLessons'] === true;
}

/**
 * 更新結果を閉じやすい情報モーダルで表示します。
 * @param {string} message
 * @param {string} title
 */
function showRefreshResultInfo(message, title) {
  if (
    appWindow.ModalManager &&
    typeof appWindow.ModalManager.showInfoDismissable === 'function'
  ) {
    appWindow.ModalManager.showInfoDismissable(message, title, 3000);
    return;
  }
  showInfo(message, title);
}

/**
 * 参加者データの再検証が必要か判定します。
 * @param {UIState} state
 * @param {boolean} forceReload
 * @returns {boolean}
 */
function shouldRevalidateParticipantData(state, forceReload) {
  if (forceReload) return true;
  return isDataStale(
    getParticipantDataFetchedAt(state),
    PARTICIPANT_BACKGROUND_REFRESH_INTERVAL_MS,
  );
}

/**
 * includeHistory=true のときの参加者データをマージします。
 * @param {UIState} state
 * @param {import('../../types/core/lesson').LessonCore[]} incomingLessons
 * @param {Record<string, any[]>} incomingReservationsMap
 * @returns {{
 *   lessons: import('../../types/core/lesson').LessonCore[],
 *   reservationsMap: Record<string, any[]>,
 *   hasPastLessonsLoaded: boolean
 * }}
 */
function mergeParticipantDataWithHistory(
  state,
  incomingLessons,
  incomingReservationsMap,
) {
  const hasLoadedPastLessons = state.participantHasPastLessonsLoaded === true;
  // 初回取得やレスポンス空の場合は、そのまま受信データを採用する
  if (!hasLoadedPastLessons || incomingLessons.length === 0) {
    return {
      lessons: incomingLessons,
      reservationsMap: incomingReservationsMap,
      hasPastLessonsLoaded: true,
    };
  }

  const existingLessons = Array.isArray(state.participantLessons)
    ? state.participantLessons
    : [];
  // 既存データがない場合は、受信データだけで成立する
  if (existingLessons.length === 0) {
    return {
      lessons: incomingLessons,
      reservationsMap: incomingReservationsMap,
      hasPastLessonsLoaded: true,
    };
  }

  const oldestIncomingTs = incomingLessons.reduce((minTs, lesson) => {
    const ts = new Date(String(lesson?.date || '')).getTime();
    if (!Number.isFinite(ts)) return minTs;
    return Math.min(minTs, ts);
  }, Number.POSITIVE_INFINITY);
  // 日付境界を作れない場合は安全側で受信データのみを採用
  if (!Number.isFinite(oldestIncomingTs)) {
    return {
      lessons: incomingLessons,
      reservationsMap: incomingReservationsMap,
      hasPastLessonsLoaded: true,
    };
  }

  const todayYmd = getLocalTodayYmd();
  const existingOldPastLessons = existingLessons.filter(lesson => {
    const dateStr = String(lesson?.date || '');
    if (!dateStr || dateStr >= todayYmd) return false;
    const lessonTs = new Date(dateStr).getTime();
    return Number.isFinite(lessonTs) && lessonTs < oldestIncomingTs;
  });
  // 保持対象の「より古い過去」がなければ、受信データをそのまま使う
  if (existingOldPastLessons.length === 0) {
    return {
      lessons: incomingLessons,
      reservationsMap: incomingReservationsMap,
      hasPastLessonsLoaded: true,
    };
  }

  /** @type {Record<string, any[]>} */
  const preservedOldPastReservationsMap = {};
  const existingReservationsMap = state.participantReservationsMap || {};
  existingOldPastLessons.forEach(lesson => {
    const lessonId = String(lesson?.lessonId || '');
    if (!lessonId) return;
    if (Array.isArray(existingReservationsMap[lessonId])) {
      preservedOldPastReservationsMap[lessonId] =
        existingReservationsMap[lessonId];
    }
  });

  return {
    lessons: mergeLessonsByIdentity(incomingLessons, existingOldPastLessons),
    reservationsMap: {
      ...preservedOldPastReservationsMap,
      ...incomingReservationsMap,
    },
    hasPastLessonsLoaded: true,
  };
}

/**
 * includeHistory=false のときの参加者データをマージします。
 * @param {UIState} state
 * @param {import('../../types/core/lesson').LessonCore[]} incomingLessons
 * @param {Record<string, any[]>} incomingReservationsMap
 * @returns {{
 *   lessons: import('../../types/core/lesson').LessonCore[],
 *   reservationsMap: Record<string, any[]>,
 *   hasPastLessonsLoaded: boolean
 * }}
 */
function mergeParticipantDataWithoutHistory(
  state,
  incomingLessons,
  incomingReservationsMap,
) {
  const hasLoadedPastLessons = state.participantHasPastLessonsLoaded === true;
  // 過去タブを未取得なら、未来側だけ更新して終了
  if (!hasLoadedPastLessons) {
    return {
      lessons: incomingLessons,
      reservationsMap: incomingReservationsMap,
      hasPastLessonsLoaded: false,
    };
  }

  const existingLessons = Array.isArray(state.participantLessons)
    ? state.participantLessons
    : [];
  const todayYmd = getLocalTodayYmd();
  const existingPastOnlyLessons = existingLessons.filter(lesson => {
    const lessonDate = String(lesson?.date || '');
    return lessonDate !== '' && lessonDate < todayYmd;
  });
  // 保持対象の過去データがなければ、受信データをそのまま採用
  if (existingPastOnlyLessons.length === 0) {
    return {
      lessons: incomingLessons,
      reservationsMap: incomingReservationsMap,
      hasPastLessonsLoaded: false,
    };
  }

  /** @type {Record<string, any[]>} */
  const preservedPastReservationsMap = {};
  const existingReservationsMap = state.participantReservationsMap || {};
  existingPastOnlyLessons.forEach(lesson => {
    const lessonId = String(lesson?.lessonId || '');
    if (!lessonId) return;
    if (Array.isArray(existingReservationsMap[lessonId])) {
      preservedPastReservationsMap[lessonId] =
        existingReservationsMap[lessonId];
    }
  });

  return {
    lessons: mergeLessonsByIdentity(incomingLessons, existingPastOnlyLessons),
    reservationsMap: {
      ...preservedPastReservationsMap,
      ...incomingReservationsMap,
    },
    hasPastLessonsLoaded: true,
  };
}

/**
 * 参加者データを最新レスポンスで統合し、必要に応じて既存の過去データを保持します。
 * @param {UIState} state
 * @param {{lessons?: import('../../types/core/lesson').LessonCore[], reservationsMap?: Record<string, any[]>}} incomingData
 * @param {boolean} includeHistory
 * @returns {{
 *   lessons: import('../../types/core/lesson').LessonCore[],
 *   reservationsMap: Record<string, any[]>,
 *   hasPastLessonsLoaded: boolean
 * }}
 */
function buildMergedParticipantData(state, incomingData, includeHistory) {
  const incomingLessons = Array.isArray(incomingData?.lessons)
    ? incomingData.lessons
    : [];
  const incomingReservationsMap = incomingData?.reservationsMap || {};

  if (includeHistory) {
    return mergeParticipantDataWithHistory(
      state,
      incomingLessons,
      incomingReservationsMap,
    );
  }

  return mergeParticipantDataWithoutHistory(
    state,
    incomingLessons,
    incomingReservationsMap,
  );
}

/**
 * 過去データのページング状態を更新します。
 * @param {{isLoading?: boolean}} nextState
 */
function setPastLessonsPaginationState(nextState) {
  if (Object.prototype.hasOwnProperty.call(nextState, 'isLoading')) {
    isLoadingMorePastLessons = !!nextState.isLoading;
  }
}

/**
 * 再描画後にスクロール位置を復元します。
 * @param {number} scrollY
 */
function renderWithScrollRestore(scrollY) {
  const previousView = participantHandlersStateManager.getState().view;
  render();
  restoreScrollPositionIfViewUnchanged(
    scrollY,
    previousView,
    participantHandlersStateManager,
  );
}

/**
 * 現在表示している過去レッスン群のうち、最古日を返します。
 * @param {import('../../types/core/lesson').LessonCore[] | undefined | null} lessons
 * @returns {string}
 */
function getOldestPastLessonDate(lessons) {
  if (!Array.isArray(lessons) || lessons.length === 0) return '';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTs = today.getTime();

  let oldest = '';
  let oldestTs = Number.POSITIVE_INFINITY;

  lessons.forEach(lesson => {
    const dateStr = String(lesson?.date || '');
    if (!dateStr) return;

    const dateObj = new Date(dateStr);
    const dateTs = dateObj.getTime();
    if (isNaN(dateTs)) return;
    if (dateTs > todayTs) return;

    if (dateTs < oldestTs) {
      oldestTs = dateTs;
      oldest = dateStr;
    }
  });

  return oldest;
}

/**
 * 参加者ビュー初期取得で利用する過去境界日（YYYY-MM-DD）を返します。
 * @param {number} monthsBack
 * @returns {string}
 */
function getParticipantHistoryBoundaryDate(monthsBack) {
  const normalizedMonthsBack = Math.max(0, Number(monthsBack) || 0);
  const boundaryDate = new Date();
  boundaryDate.setHours(0, 0, 0, 0);
  boundaryDate.setMonth(boundaryDate.getMonth() - normalizedMonthsBack);

  const y = boundaryDate.getFullYear();
  const m = String(boundaryDate.getMonth() + 1).padStart(2, '0');
  const d = String(boundaryDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 現在のレッスン一覧に存在しないアコーディオン状態を除去します。
 * @param {import('../../types/core/lesson').LessonCore[]} lessons
 */
function pruneExpandedLessonIdsByLessons(lessons) {
  if (!Array.isArray(lessons)) return;
  const lessonIdSet = new Set(
    lessons.map(lesson => String(lesson?.lessonId || '')).filter(Boolean),
  );
  localExpandedLessonIds = localExpandedLessonIds.filter(id =>
    lessonIdSet.has(id),
  );
}

// 参加者ビュー（過去タブ）の「もっと表示する」UIが参照する状態を公開
appWindow.getParticipantPastPaginationState = () => ({
  hasMorePastLessons: hasMorePastLessonsFromState(),
  isLoadingMorePastLessons,
});

/**
 * 参加者リストビュー初期化
 * ログイン成功後、管理者の場合に呼ばれる
 *
 * @param {boolean} forceReload - 強制的に再取得する場合はtrue
 * @param {string|boolean} loadingCategory - ローディングバリエーション（'participants' | 'dataFetch' 等）。falseの場合は非表示。
 * @param {Partial<UIState> | null} baseAppState - 初期状態
 * @param {boolean} includeHistory - 過去の履歴も含めるか
 */
function loadParticipantView(
  forceReload = false,
  loadingCategory = 'participants',
  baseAppState = /** @type {Partial<UIState> | null} */ (null),
  includeHistory = true,
) {
  debugLog('📋 参加者リストビュー初期化開始');

  const state = participantHandlersStateManager.getState();
  const studentId =
    state.currentUser?.studentId ||
    (baseAppState && baseAppState.currentUser
      ? baseAppState.currentUser.studentId
      : undefined);

  if (!studentId) {
    console.error('❌ studentIdが見つかりません');
    return;
  }

  // categoryの正規化（trueの場合はデフォルト、falseの場合はnull）
  const category =
    loadingCategory === true
      ? 'participants'
      : loadingCategory === false
        ? null
        : loadingCategory;

  // 事前取得済みデータがある場合はAPIコールをスキップ
  if (
    baseAppState &&
    Array.isArray(baseAppState.participantLessons) &&
    baseAppState.participantReservationsMap &&
    typeof baseAppState.participantReservationsMap === 'object'
  ) {
    const nextIsAdmin =
      baseAppState.participantIsAdmin ||
      baseAppState.currentUser?.isAdmin ||
      false;
    setPastLessonsPaginationState({ isLoading: false });
    const hasPastLessonsLoaded =
      baseAppState.participantHasPastLessonsLoaded === true ||
      includeHistory === true;
    /** @type {Partial<UIState>} */
    const payload = {
      ...baseAppState,
      view: 'participants',
      participantSubView: 'list',
      selectedParticipantClassroom: 'all',
      showPastLessons: baseAppState.showPastLessons || false,
      participantHasPastLessonsLoaded: hasPastLessonsLoaded,
      participantIsAdmin: nextIsAdmin,
      recordsToShow: CONSTANTS.UI.HISTORY_INITIAL_RECORDS,
      isDataFresh: true,
    };
    participantHandlersStateManager.dispatch({
      type: 'SET_STATE',
      payload,
    });
    if (category) hideLoading();
    render();
    return;
  }

  // 既にデータがある場合はAPIコールをスキップ（レート制限対策）
  // 重要: よやくデータ（reservationsMap）も必要なのでチェック
  if (
    !forceReload &&
    Array.isArray(state.participantLessons) &&
    state.participantReservationsMap &&
    typeof state.participantReservationsMap === 'object'
  ) {
    debugLog('✅ キャッシュ済みデータを使用 - APIコールをスキップ');
    setPastLessonsPaginationState({ isLoading: false });
    /** @type {Partial<UIState>} */
    const cachePayload = baseAppState
      ? {
          .../** @type {Partial<UIState>} */ (baseAppState),
          view: 'participants',
          participantSubView: 'list',
          selectedParticipantClassroom:
            state.selectedParticipantClassroom || 'all',
          showPastLessons: state.showPastLessons || false,
          participantIsAdmin:
            state.participantIsAdmin || state.currentUser?.isAdmin || false,
          recordsToShow: CONSTANTS.UI.HISTORY_INITIAL_RECORDS,
          isDataFresh: true,
        }
      : {
          view: 'participants',
          participantSubView: 'list',
          selectedParticipantClassroom:
            state.selectedParticipantClassroom || 'all',
          showPastLessons: state.showPastLessons || false,
        };

    participantHandlersStateManager.dispatch({
      type: baseAppState ? 'SET_STATE' : 'UPDATE_STATE',
      payload: cachePayload,
    });
    // キャッシュ使用時もローディングを非表示（表示していた場合）
    if (category) hideLoading();
    render();
    // キャッシュ使用時は、一定時間経過時のみバックグラウンド更新（Stale-while-revalidate）
    if (shouldRevalidateParticipantData(state, forceReload)) {
      fetchParticipantDataBackground(
        studentId,
        'background',
        baseAppState,
        false,
        false,
        0,
      );
    } else {
      debugLog('ℹ️ 参加者ビュー再検証をスキップ（取得直後のため）');
    }
    return;
  }

  if (category) {
    showLoading(category);
  }

  // 初回ロード（キャッシュなし）の場合
  fetchParticipantDataBackground(
    studentId,
    category || 'participants',
    baseAppState,
    false,
    includeHistory === true,
    PARTICIPANT_INITIAL_PAST_MONTHS,
  );
}

// ... (existing code) ...

/**
 * 参加者リストビューのデータ更新（手動リフレッシュ）
 */
/**
 * 参加者データのバックグラウンド取得と更新
 * @param {string} studentId
 * @param {string} loadingCategory
 * @param {Partial<UIState> | null} baseAppState
 * @param {boolean} [isManualRefresh=false] - 手動更新かどうか
 * @param {boolean} [includeHistory=false] - 過去データも含めて取得するか
 * @param {number} [pastMonthsLimit=0] - 過去データを含める場合の遡り月数
 */
function fetchParticipantDataBackground(
  studentId,
  loadingCategory,
  baseAppState,
  isManualRefresh = false,
  includeHistory = false,
  pastMonthsLimit = 0,
) {
  const state = participantHandlersStateManager.getState();

  google.script.run
    .withSuccessHandler(function (response) {
      debugLog('✅ レッスン一覧+よやくデータ取得成功:', response);

      if (response.success) {
        const latestState = participantHandlersStateManager.getState();
        const nextIsAdmin =
          Object.prototype.hasOwnProperty.call(response.data, 'isAdmin') &&
          response.data.isAdmin !== undefined
            ? response.data.isAdmin
            : latestState.participantIsAdmin;

        const mergedParticipantData = buildMergedParticipantData(
          latestState,
          response.data || {},
          includeHistory === true,
        );
        const responseHasMorePastLessons =
          response.data?.hasMorePastLessons === true;
        const nextHasMorePastLessons =
          includeHistory === true
            ? responseHasMorePastLessons
            : hasMorePastLessonsFromState(latestState);

        // データの変化を確認
        const currentLessonsJson = stableStringify(
          latestState.participantLessons || [],
        );
        const newLessonsJson = stableStringify(mergedParticipantData.lessons);
        // よやくデータの比較
        const currentReservationsJson = stableStringify(
          latestState.participantReservationsMap || {},
        );
        const newReservationsJson = stableStringify(
          mergedParticipantData.reservationsMap || {},
        );

        const hasChanges =
          currentLessonsJson !== newLessonsJson ||
          currentReservationsJson !== newReservationsJson;

        if (!hasChanges && isManualRefresh) {
          debugLog('ℹ️ データに変更はありません');
          if (loadingCategory !== 'background') hideLoading();
          showInfo(
            '新しいデータはありませんでした。最新の状態です。',
            '更新完了',
          );
          return;
        }

        if (!hasChanges && loadingCategory === 'background') {
          debugLog('ℹ️ バックグラウンド更新: 変更なし');
          return;
        }

        // 変更がある場合、または初回ロードの場合は更新
        debugLog('🔄 データ更新あり: 再描画します');

        // データ取得日時を記録
        const now = new Date().toISOString();

        /** @type {Partial<UIState>} */
        const payload = baseAppState
          ? {
              .../** @type {Partial<UIState>} */ (baseAppState),
              view: 'participants',
              participantLessons: mergedParticipantData.lessons,
              participantReservationsMap:
                mergedParticipantData.reservationsMap || {},
              participantIsAdmin:
                nextIsAdmin || latestState.currentUser?.isAdmin || false,
              participantSubView: 'list',
              selectedParticipantClassroom: 'all',
              showPastLessons: baseAppState.showPastLessons || false,
              participantHasPastLessonsLoaded:
                mergedParticipantData.hasPastLessonsLoaded === true,
              recordsToShow: CONSTANTS.UI.HISTORY_INITIAL_RECORDS,
              isDataFresh: true,
              participantAllStudents:
                response.data.allStudents ||
                latestState['participantAllStudents'] ||
                {},
              participantHasMorePastLessons: nextHasMorePastLessons,
              participantDataFetchedAt: now,
              dataFetchedAt: now,
            }
          : {
              view: 'participants',
              participantLessons: mergedParticipantData.lessons,
              participantReservationsMap:
                mergedParticipantData.reservationsMap || {},
              participantIsAdmin:
                nextIsAdmin || latestState.currentUser?.isAdmin || false,
              participantSubView: 'list', // Duplicate removed below
              // 既存の状態を維持したい場合はここを調整するが、
              // 基本的にサーバー同期時は最新データで上書きが安全
              // ただし participantSubView などUI状態はリセットしたくない場合もある
              // 今回は view: 'participants' を指定しているのでリセット挙動に近い
              // participantSubView: state.participantSubView || 'list', // Duplicate removed
              selectedParticipantClassroom:
                latestState.selectedParticipantClassroom || 'all',
              showPastLessons: latestState.showPastLessons || false,
              participantHasPastLessonsLoaded:
                mergedParticipantData.hasPastLessonsLoaded === true,
              participantAllStudents:
                response.data.allStudents ||
                latestState['participantAllStudents'] ||
                {},
              participantHasMorePastLessons: nextHasMorePastLessons,
              participantDataFetchedAt: now,
              dataFetchedAt: now,
            };

        // ローカルアコーディオン状態は既存を維持し、存在しないIDのみ除去する
        pruneExpandedLessonIdsByLessons(mergedParticipantData.lessons);
        setPastLessonsPaginationState({ isLoading: false });

        participantHandlersStateManager.dispatch({
          type: baseAppState ? 'SET_STATE' : 'UPDATE_STATE',
          payload,
        });

        if (mergedParticipantData.reservationsMap) {
          debugLog(
            `💾 よやくデータをstateManagerに保存: ${Object.keys(mergedParticipantData.reservationsMap).length}レッスン分`,
          );
        }

        if (loadingCategory !== 'background') hideLoading();
        render(); // 再描画
      } else {
        // エラーハンドリング
        if (loadingCategory !== 'background') hideLoading();
        // 手動更新または初回ロード時のみエラー表示
        if (loadingCategory !== 'background') {
          showInfo(
            response.message || 'レッスン一覧の取得に失敗しました',
            'エラー',
          );
        }
      }
    })
    .withFailureHandler(
      /** @param {Error} error */
      function (error) {
        console.error('❌ レッスン一覧取得失敗:', error);
        if (loadingCategory !== 'background') {
          hideLoading();
          showInfo('通信エラーが発生しました', 'エラー');
        }
      },
    )
    .getLessonsForParticipantsView(
      studentId,
      includeHistory === true,
      true,
      state.currentUser?.phone || '',
      includeHistory === true ? pastMonthsLimit : 0,
    );
}

/**
 * 参加者ビューとログビューのデータを同時に更新（バックグラウンド）
 * ローディング画面は表示せず、ヘッダーのアイコンをスピンさせる
 * 変更有無に応じたモーダル表示はオプションで切り替える
 * @param {{
 *   showNoChangeInfo?: boolean,
 *   showChangeInfo?: boolean,
 *   useLogLoading?: boolean,
 *   logDaysBack?: number,
 * }} [options]
 */
function refreshAllAdminData(options = {}) {
  const state = participantHandlersStateManager.getState();
  const studentId = state.currentUser?.studentId;
  const includeHistoryInRefresh = false;
  const refreshPastMonthsLimit = 0;
  const showNoChangeInfo = options.showNoChangeInfo !== false;
  const showChangeInfo = options.showChangeInfo === true;
  const useLogLoading = options.useLogLoading === true;
  const logDaysBack = normalizeAdminLogDaysBack(
    Object.prototype.hasOwnProperty.call(options, 'logDaysBack')
      ? options.logDaysBack
      : state['adminLogsDaysBack'],
  );

  if (!studentId) {
    console.error('No student ID for refresh');
    return;
  }

  // ローディング状態をセット（アイコンスピン用）
  participantHandlersStateManager.dispatch({
    type: 'UPDATE_STATE',
    payload: {
      adminLogsRefreshing: true,
      participantDataRefreshing: true,
      adminLogsDaysBack: logDaysBack,
      ...(useLogLoading ? { adminLogsLoading: true } : {}),
    },
  });
  render(); // アイコンスピン表示更新

  // 参加者データとログデータを並列で取得
  let participantResult = /** @type {any} */ (null);
  let logResult = /** @type {any} */ (null);
  let completedCount = 0;

  /**
   * 両方のデータ取得が完了した時の処理
   */
  const onBothComplete = () => {
    completedCount++;
    if (completedCount < 2) return;

    // 両方完了した
    const currentState = participantHandlersStateManager.getState();
    let hasParticipantChanges = false;
    let hasLogChanges = false;
    let mergedParticipantData =
      /** @type {ReturnType<typeof buildMergedParticipantData> | null} */ (
        null
      );

    // 参加者データの差分チェック
    if (participantResult?.success) {
      mergedParticipantData = buildMergedParticipantData(
        currentState,
        participantResult.data || {},
        includeHistoryInRefresh,
      );

      const currentLessonsJson = stableStringify(
        currentState.participantLessons || [],
      );
      const newLessonsJson = stableStringify(mergedParticipantData.lessons);
      const currentReservationsJson = stableStringify(
        currentState.participantReservationsMap || {},
      );
      const newReservationsJson = stableStringify(
        mergedParticipantData.reservationsMap || {},
      );

      hasParticipantChanges =
        currentLessonsJson !== newLessonsJson ||
        currentReservationsJson !== newReservationsJson;
    }

    // ログデータの差分チェック
    if (logResult?.success) {
      const currentLogs = currentState['adminLogs'] || [];
      const newLogs = logResult.data || [];

      const latestCurrent =
        currentLogs.length > 0 ? currentLogs[0].timestamp : '';
      const latestNew = newLogs.length > 0 ? newLogs[0].timestamp : '';

      hasLogChanges =
        latestCurrent !== latestNew || currentLogs.length !== newLogs.length;
    }

    const participantFetchFailed = participantResult?.success !== true;
    const logFetchFailed = logResult?.success !== true;
    const hasFetchFailure = participantFetchFailed || logFetchFailed;

    // 現在時刻を取得日時として保存
    const now = new Date().toISOString();

    // stateを更新
    /** @type {Partial<UIState>} */
    const updatePayload = {
      adminLogsRefreshing: false,
      participantDataRefreshing: false,
      adminLogsLoading: false,
    };

    if (participantResult?.success || logResult?.success) {
      updatePayload['dataFetchedAt'] = now;
    }

    if (participantResult?.success) {
      const responseHasMorePastLessons =
        participantResult.data?.hasMorePastLessons === true;
      const nextHasMorePastLessons = includeHistoryInRefresh
        ? responseHasMorePastLessons
        : hasMorePastLessonsFromState(currentState);
      updatePayload['participantHasMorePastLessons'] = nextHasMorePastLessons;
      updatePayload['participantDataFetchedAt'] = now;
      setPastLessonsPaginationState({ isLoading: false });
    }

    if (
      hasParticipantChanges &&
      participantResult?.success &&
      mergedParticipantData
    ) {
      updatePayload.participantLessons = mergedParticipantData.lessons;
      updatePayload.participantReservationsMap =
        mergedParticipantData.reservationsMap || {};
      updatePayload['participantAllStudents'] =
        participantResult.data.allStudents || {};
      updatePayload.participantHasPastLessonsLoaded =
        mergedParticipantData.hasPastLessonsLoaded === true;
      setPastLessonsPaginationState({ isLoading: false });

      // アコーディオン状態は既存を維持し、存在しないIDのみ除去する
      pruneExpandedLessonIdsByLessons(mergedParticipantData.lessons);
    }

    if (logResult?.success) {
      updatePayload['adminLogs'] = logResult.data || [];
      updatePayload['adminLogsDaysBack'] = logDaysBack;
      updatePayload['adminLogsFetchedAt'] = now;
    }

    participantHandlersStateManager.dispatch({
      type: 'UPDATE_STATE',
      payload: updatePayload,
    });

    // 変更有無に応じてメッセージ表示
    render();
    if (hasFetchFailure) {
      setTimeout(() => {
        const failedTargets = [
          participantFetchFailed ? '参加者データ' : '',
          logFetchFailed ? '操作ログ' : '',
        ].filter(Boolean);
        showRefreshResultInfo(
          `更新中に${failedTargets.join('・')}の取得に失敗しました。時間をおいて再度お試しください。`,
          '更新エラー',
        );
      }, 100);
      return;
    }

    const hasChanges = hasParticipantChanges || hasLogChanges;
    if (!showChangeInfo && !showNoChangeInfo) return;

    // renderはrequestAnimationFrameを使用しているため、DOM更新後にモーダルを表示
    setTimeout(() => {
      if (hasChanges) {
        if (showChangeInfo) {
          showRefreshResultInfo(
            '差分を検知したため、最新データに更新しました。',
            '更新完了',
          );
        }
        return;
      }

      if (showNoChangeInfo) {
        showRefreshResultInfo(
          '差分はありませんでした。最新の状態です。',
          '更新完了',
        );
      }
    }, 100);
  };

  // 参加者データ取得
  google.script.run
    .withSuccessHandler(
      /** @param {any} response */
      response => {
        participantResult = response;
        onBothComplete();
      },
    )
    .withFailureHandler(
      /** @param {Error} error */
      error => {
        console.error('❌ 参加者データ取得失敗:', error);
        participantResult = { success: false };
        onBothComplete();
      },
    )
    .getLessonsForParticipantsView(
      studentId,
      includeHistoryInRefresh,
      true,
      state.currentUser?.phone || '',
      refreshPastMonthsLimit,
    );

  // ログデータ取得
  google.script.run
    .withSuccessHandler(
      /** @param {any} response */
      response => {
        logResult = response;
        onBothComplete();
      },
    )
    .withFailureHandler(
      /** @param {Error} error */
      error => {
        console.error('❌ ログデータ取得失敗:', error);
        logResult = { success: false };
        onBothComplete();
      },
    )
    .getRecentLogs(logDaysBack);
}

/**
 * 参加者リストビューのデータ更新（統合リフレッシュ関数に委譲）
 */
function refreshParticipantView() {
  refreshAllAdminData();
}

/**
 * 管理者が参加者ビュー/ログビューを表示中にタブ復帰した際の自動更新。
 * ローディング画面は表示せず、更新結果（差分あり/なし）をモーダルで通知します。
 * @returns {boolean} 自動更新を開始した場合true
 */
function autoRefreshAdminViewsOnTabResume() {
  const state = participantHandlersStateManager.getState();
  const currentView = state.view;
  const isTargetView =
    currentView === 'participants' || currentView === 'adminLog';
  const isAdmin =
    state.currentUser?.isAdmin === true || state.participantIsAdmin === true;
  if (!isTargetView || !isAdmin) return false;

  const isRefreshing =
    state['adminLogsRefreshing'] || state['participantDataRefreshing'] || false;
  if (isRefreshing || state['adminLogsLoading'] === true) return false;

  const now = Date.now();
  if (now - lastAdminAutoRefreshAt < ADMIN_AUTO_REFRESH_THROTTLE_MS) {
    return false;
  }

  const staleThresholdMs =
    currentView === 'adminLog'
      ? ADMIN_LOG_BACKGROUND_REFRESH_INTERVAL_MS
      : PARTICIPANT_BACKGROUND_REFRESH_INTERVAL_MS;
  const targetFetchedAt =
    currentView === 'adminLog'
      ? getAdminLogsFetchedAt(state)
      : getParticipantDataFetchedAt(state);
  const shouldRefresh = isDataStale(targetFetchedAt, staleThresholdMs);
  if (!shouldRefresh) return false;

  lastAdminAutoRefreshAt = now;
  refreshAllAdminData({
    showNoChangeInfo: true,
    showChangeInfo: true,
    useLogLoading: false,
    logDaysBack: getAdminLogDaysBackFromState(state),
  });
  return true;
}

/**
 * ログ配列の最古タイムスタンプ（ms）を返します。
 * @param {any[] | undefined | null} logs
 * @returns {number}
 */
function getOldestLogTimestampMs(logs) {
  if (!Array.isArray(logs) || logs.length === 0) {
    return Number.NaN;
  }
  return logs.reduce((oldestTs, entry) => {
    const timestamp = new Date(String(entry?.timestamp || '')).getTime();
    if (!Number.isFinite(timestamp)) return oldestTs;
    if (!Number.isFinite(oldestTs)) return timestamp;
    return Math.min(oldestTs, timestamp);
  }, Number.NaN);
}

/**
 * 操作ログをさらに1週間分さかのぼって取得します。
 */
function loadMoreAdminLogs() {
  const state = participantHandlersStateManager.getState();
  const isRefreshing =
    state['adminLogsRefreshing'] || state['participantDataRefreshing'] || false;
  const isLoading = state['adminLogsLoading'] === true;
  if (isRefreshing || isLoading) return;

  const currentLogDaysBack = getAdminLogDaysBackFromState(state);
  const nextLogDaysBack = currentLogDaysBack + ADMIN_LOG_LOAD_MORE_DAYS;
  const currentLogs = Array.isArray(state['adminLogs'])
    ? state['adminLogs']
    : [];
  const currentOldestLogTs = getOldestLogTimestampMs(currentLogs);

  participantHandlersStateManager.dispatch({
    type: 'UPDATE_STATE',
    payload: {
      adminLogsRefreshing: true,
      adminLogsDaysBack: nextLogDaysBack,
    },
  });
  render();

  google.script.run
    .withSuccessHandler(
      /** @param {ApiResponseGeneric<any>} response */
      response => {
        if (!response.success) {
          participantHandlersStateManager.dispatch({
            type: 'UPDATE_STATE',
            payload: {
              adminLogsRefreshing: false,
              adminLogsLoading: false,
              adminLogsDaysBack: currentLogDaysBack,
            },
          });
          render();
          showInfo(
            response.message || 'ログの追加取得に失敗しました',
            'エラー',
          );
          return;
        }

        const nextLogs = Array.isArray(response.data) ? response.data : [];
        const nextOldestLogTs = getOldestLogTimestampMs(nextLogs);
        const hasLoadedOlderLogs =
          Number.isFinite(nextOldestLogTs) &&
          (!Number.isFinite(currentOldestLogTs) ||
            nextOldestLogTs < currentOldestLogTs);
        const now = new Date().toISOString();
        participantHandlersStateManager.dispatch({
          type: 'UPDATE_STATE',
          payload: {
            adminLogs: nextLogs,
            adminLogsRefreshing: false,
            adminLogsLoading: false,
            adminLogsDaysBack: nextLogDaysBack,
            adminLogsFetchedAt: now,
            dataFetchedAt: now,
          },
        });
        render();

        if (!hasLoadedOlderLogs) {
          showInfo(
            'この1週間の範囲では追加ログがありませんでした。',
            '更新完了',
          );
        }
      },
    )
    .withFailureHandler(
      /** @param {Error} error */
      error => {
        console.error('❌ 操作ログ追加取得失敗:', error);
        participantHandlersStateManager.dispatch({
          type: 'UPDATE_STATE',
          payload: {
            adminLogsRefreshing: false,
            adminLogsLoading: false,
            adminLogsDaysBack: currentLogDaysBack,
          },
        });
        render();
        showInfo('通信エラーが発生しました', 'エラー');
      },
    )
    .getRecentLogs(nextLogDaysBack);
}

// アコーディオン開閉状態をローカル変数で管理（StateManager外）
// これにより自動レンダリングを回避し、ちらつき・位置ズレを防止
/** @type {string[]} */
let localExpandedLessonIds = [];

/**
 * アコーディオンの開閉を切り替えるハンドラ（DOM操作のみ、再描画なし）
 * @param {string} lessonId - レッスンID
 */
function toggleParticipantLessonAccordion(lessonId) {
  if (!lessonId) return;

  // DOM直接操作でコンテンツを切り替え
  const container = document.querySelector(
    `[data-lesson-container="${lessonId}"]`,
  );
  if (!container) return;

  const contentElement = container.querySelector('.accordion-content');
  const arrowElement = container.querySelector('svg');

  if (!contentElement) return;

  // DOMの状態から現在の開閉状態を判定（hiddenがあれば閉じている）
  const isClosed = contentElement.classList.contains('hidden');

  if (isClosed) {
    // 開く
    contentElement.classList.remove('hidden');
    if (arrowElement) {
      arrowElement.classList.add('rotate-180');
    }
    // 状態を保存
    if (!localExpandedLessonIds.includes(lessonId)) {
      localExpandedLessonIds.push(lessonId);
    }
  } else {
    // 閉じる
    contentElement.classList.add('hidden');
    if (arrowElement) {
      arrowElement.classList.remove('rotate-180');
    }
    // 状態を保存
    localExpandedLessonIds = localExpandedLessonIds.filter(
      id => id !== lessonId,
    );
  }
}

/**
 * すべてのアコーディオンを開くハンドラ（DOM操作のみ、再描画なし）
 */
function expandAllAccordions() {
  const containers = document.querySelectorAll('[data-lesson-container]');
  containers.forEach(container => {
    const contentElement = container.querySelector('.accordion-content');
    const arrowElement = container.querySelector('svg');
    const lessonId = container.getAttribute('data-lesson-container');

    if (contentElement && contentElement.classList.contains('hidden')) {
      contentElement.classList.remove('hidden');
      if (arrowElement) {
        arrowElement.classList.add('rotate-180');
      }
      if (lessonId && !localExpandedLessonIds.includes(lessonId)) {
        localExpandedLessonIds.push(lessonId);
      }
    }
  });
  updateToggleIcon(true);
}

/**
 * すべてのアコーディオンを閉じるハンドラ（DOM操作のみ、再描画なし）
 */
function collapseAllAccordions() {
  const containers = document.querySelectorAll('[data-lesson-container]');
  containers.forEach(container => {
    const contentElement = container.querySelector('.accordion-content');
    const arrowElement = container.querySelector('svg');
    const lessonId = container.getAttribute('data-lesson-container');

    if (contentElement && !contentElement.classList.contains('hidden')) {
      contentElement.classList.add('hidden');
      if (arrowElement) {
        arrowElement.classList.remove('rotate-180');
      }
      if (lessonId) {
        localExpandedLessonIds = localExpandedLessonIds.filter(
          id => id !== lessonId,
        );
      }
    }
  });
  updateToggleIcon(false);
}

/**
 * すべてのアコーディオンの開閉をトグル（DOM操作のみ、再描画なし）
 * 1つでも閉じているものがあれば全て開く、すべて開いていれば全て閉じる
 */
function toggleAllAccordions() {
  const containers = document.querySelectorAll('[data-lesson-container]');
  if (containers.length === 0) return;

  // 閉じているアコーディオンがあるかチェック
  let hasClosedAccordion = false;
  containers.forEach(container => {
    const contentElement = container.querySelector('.accordion-content');
    if (contentElement && contentElement.classList.contains('hidden')) {
      hasClosedAccordion = true;
    }
  });

  if (hasClosedAccordion) {
    // 1つでも閉じていれば全て開く
    expandAllAccordions();
  } else {
    // 全て開いていれば全て閉じる
    collapseAllAccordions();
  }
}

/**
 * トグルボタンのアイコンを更新
 * @param {boolean} isExpanded - true: 展開状態（折りたたみアイコン表示）、false: 折りたたみ状態（展開アイコン表示）
 */
function updateToggleIcon(isExpanded) {
  const icon = document.getElementById('accordion-toggle-icon');
  if (!icon) return;

  if (isExpanded) {
    // 折りたたみアイコン（矢印が内側を向く）
    icon.innerHTML =
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"></path>';
  } else {
    // 展開アイコン（矢印が外側を向く）
    icon.innerHTML =
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>';
  }
}

/**
 * 生徒選択ハンドラ（モーダル表示）
 * プリロードされた生徒データから即座に詳細を表示
 * @param {string} targetStudentId - 表示対象の生徒ID
 * @param {string} [_lessonId] - レッスンID（未使用、後方互換性のため残す）
 */
function selectParticipantStudent(targetStudentId, _lessonId) {
  if (!targetStudentId) return;

  debugLog('👤 生徒選択:', targetStudentId);

  const state = participantHandlersStateManager.getState();

  // 1. プリロードデータから生徒情報を取得
  const allStudents = state['participantAllStudents'] || {};
  const studentData = allStudents[targetStudentId];

  if (!studentData) {
    // プリロードデータがない場合（ログビューからのアクセスなど）、APIで取得
    showLoading('dataFetch');

    google.script.run
      .withSuccessHandler(
        /** @param {ApiResponseGeneric<any>} response */ response => {
          hideLoading();
          if (response.success && response.data) {
            showStudentModal(
              response.data,
              state.participantIsAdmin || state.currentUser?.isAdmin || false,
            );
          } else {
            showInfo(
              response.message || '生徒情報の取得に失敗しました',
              'エラー',
            );
          }
        },
      )
      .withFailureHandler(
        /** @param {Error} error */ error => {
          hideLoading();
          console.error('❌ 生徒情報取得失敗:', error);
          showInfo('通信エラーが発生しました', 'エラー');
        },
      )
      .getUserDetailForEdit(targetStudentId);
    return;
  }

  debugLog(`✅ プリロードデータから生徒情報を取得: ${targetStudentId}`);

  // 2. プリロードデータからよやく履歴を生成
  /** @type {any[]} */
  let reservationHistory = [];
  if (state.participantReservationsMap && state.participantLessons) {
    /** @type {Record<string, import('../../types/core/lesson').LessonCore>} */
    const lessonsMap = {};

    // レッスン情報をマップ化
    state.participantLessons.forEach(lesson => {
      lessonsMap[lesson.lessonId] = lesson;
    });

    // 全レッスンのよやくデータから該当生徒のよやくを検索
    const reservationsMap = state.participantReservationsMap;
    Object.keys(reservationsMap).forEach(lessonId => {
      const lessonReservations = reservationsMap[lessonId];
      const studentReservation = lessonReservations.find(
        (
          /** @type {import('../../types/core/reservation').ReservationCore} */ r,
        ) => r.studentId === targetStudentId,
      );

      if (studentReservation) {
        const lesson = lessonsMap[lessonId];
        const reservationDate = studentReservation.date;
        const lessonDate = lesson?.date;
        const dateStr =
          typeof reservationDate === 'string'
            ? reservationDate
            : typeof lessonDate === 'string'
              ? lessonDate
              : '';
        reservationHistory.push({
          date: dateStr,
          classroom: lesson?.classroom || '',
          venue: lesson?.venue || '',
          startTime: studentReservation.startTime || '',
          endTime: studentReservation.endTime || '',
          status: studentReservation.status,
          sessionNote: studentReservation.sessionNote || '',
          _dateObj: new Date(dateStr),
        });
      }
    });

    // 日付順にソート（新しい順）
    reservationHistory.sort(
      (a, b) => b._dateObj.getTime() - a._dateObj.getTime(),
    );

    // 内部フィールドを削除
    reservationHistory = reservationHistory.map(item => {
      const { _dateObj, ...rest } = item;
      return rest;
    });
  }

  // 3. 生徒データによやく履歴をマージ
  const studentDataWithHistory = {
    ...studentData,
    reservationHistory: reservationHistory,
  };

  // 4. モーダル表示
  showStudentModal(studentDataWithHistory, state.participantIsAdmin || false);
}

/**
 * 生徒詳細をモーダルで表示
 * @param {any} student - 生徒情報
 * @param {boolean} isAdmin - 管理者権限
 */
/**
 * 生徒詳細をモーダルで表示
 * @param {any} student - 生徒情報
 * @param {boolean} isAdmin - 管理者権限
 */
function showStudentModal(student, isAdmin) {
  if (!student) {
    showInfo('生徒情報が見つかりません', 'エラー');
    return;
  }

  const displayName = student.nickname || student.displayName || '名前なし';

  // モーダルコンテンツを生成（グローバル関数を使用）
  const content =
    typeof appWindow.renderStudentDetailModalContent === 'function'
      ? appWindow.renderStudentDetailModalContent(student, isAdmin)
      : '<p class="text-center text-red-600">モーダルコンテンツの生成に失敗しました</p>';

  const modalId = 'student-detail-modal';

  // Components.modalを使用してモーダルHTMLを生成
  // レスポンシブな最大幅クラスを指定 (max-w-4xl = 56rem = 896px)
  const modalHtml = Components.modal({
    id: modalId,
    title: displayName,
    content: content,
    maxWidth: 'max-w-4xl',
    showCloseButton: true,
  });

  // 既存のモーダルがあれば削除
  const existingModal = document.getElementById(modalId);
  if (existingModal) {
    existingModal.remove();
  }

  // モーダルをDOMに追加
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // モーダルを表示
  Components.showModal(modalId);
}

/**
 * レッスン一覧に戻る
 */
function backToParticipantList() {
  debugLog('⬅️ レッスン一覧に戻る');

  participantHandlersStateManager.dispatch({
    type: 'UPDATE_STATE',
    payload: {
      participantSubView: 'list',
    },
  });

  render();
}

/**
 * 教室フィルタハンドラ
 * @param {string|{classroom?: string}} data - 選択された教室またはdataオブジェクト
 */
function filterParticipantByClassroom(data) {
  // data-action経由（オブジェクト）と直接呼び出し（文字列）の両方をサポート
  const classroom = typeof data === 'string' ? data : data?.classroom || 'all';
  debugLog('🔍 教室フィルタ:', classroom);

  participantHandlersStateManager.dispatch({
    type: 'UPDATE_STATE',
    payload: {
      selectedParticipantClassroom: classroom,
      expandedLessonId: null, // フィルタ変更時はアコーディオンを閉じる
    },
  });

  render();
}

/**
 * 過去/未来のレッスン切り替えハンドラ
 * @param {boolean} showPast - 過去のレッスンを表示するか
 */
function togglePastLessons(showPast) {
  debugLog('📅 レッスン表示切り替え:', showPast ? '過去' : '未来');

  const state = participantHandlersStateManager.getState();
  const alreadyLoaded = state.participantHasPastLessonsLoaded || false;

  if (showPast && !alreadyLoaded) {
    const studentId = state.currentUser?.studentId;
    if (!studentId) {
      console.error('❌ studentIdが見つかりません');
      return;
    }

    setPastLessonsPaginationState({ isLoading: true });
    showLoading('dataFetch');
    google.script.run
      .withSuccessHandler(function (response) {
        hideLoading();
        setPastLessonsPaginationState({ isLoading: false });
        if (!response.success) {
          showInfo(
            response.message || '過去のレッスン取得に失敗しました',
            'エラー',
          );
          return;
        }

        const latestState = participantHandlersStateManager.getState();
        const nextIsAdmin =
          Object.prototype.hasOwnProperty.call(response.data, 'isAdmin') &&
          response.data.isAdmin !== undefined
            ? response.data.isAdmin
            : latestState.participantIsAdmin;
        const fetchedLessons = Array.isArray(response.data?.lessons)
          ? response.data.lessons
          : [];
        const fetchedReservationsMap = response.data?.reservationsMap || {};
        const hasMorePastLessons = response.data?.hasMorePastLessons === true;
        const now = new Date().toISOString();

        // 過去のレッスンを表示する場合も全て開く
        const allLessonIds = fetchedLessons.map(
          (/** @type {import('../../types/core/lesson').LessonCore} */ l) =>
            l.lessonId,
        );
        localExpandedLessonIds = allLessonIds; // 直接更新

        participantHandlersStateManager.dispatch({
          type: 'UPDATE_STATE',
          payload: {
            view: 'participants',
            participantLessons: fetchedLessons,
            participantReservationsMap: fetchedReservationsMap,
            participantIsAdmin:
              nextIsAdmin || latestState.currentUser?.isAdmin || false,
            participantSubView: 'list',
            selectedParticipantClassroom:
              latestState.selectedParticipantClassroom || 'all',
            showPastLessons: true,
            participantHasPastLessonsLoaded: true,
            participantAllStudents:
              response.data?.allStudents ||
              latestState['participantAllStudents'] ||
              {},
            participantHasMorePastLessons: hasMorePastLessons,
            participantDataFetchedAt: now,
            dataFetchedAt: now,
          },
        });
        render();
      })
      .withFailureHandler(
        /** @param {Error} error */
        function (error) {
          hideLoading();
          setPastLessonsPaginationState({ isLoading: false });
          console.error('❌ 過去レッスン取得失敗:', error);
          showInfo('通信エラーが発生しました', 'エラー');
        },
      )
      .getLessonsForParticipantsView(
        studentId,
        true,
        true,
        state.currentUser?.phone || '',
        PARTICIPANT_INITIAL_PAST_MONTHS,
      );
    return;
  }

  // タブ切り替え時はアコーディオンを閉じる
  localExpandedLessonIds = []; // 直接更新
  setPastLessonsPaginationState({ isLoading: false });

  participantHandlersStateManager.dispatch({
    type: 'UPDATE_STATE',
    payload: {
      showPastLessons: showPast,
      expandedLessonId: null, // タブ切り替え時はアコーディオンを閉じる
    },
  });

  render();
}

/**
 * 参加者ビュー（過去タブ）で、さらに古いレッスンを追加読み込みします。
 */
function loadMorePastParticipantLessons() {
  const preservedScrollY = window.scrollY;
  const state = participantHandlersStateManager.getState();
  const canLoadMorePastLessons = hasMorePastLessonsFromState(state);
  const shouldApplyLoadResult = () => {
    const latestState = participantHandlersStateManager.getState();
    return latestState.view === 'participants' && latestState.showPastLessons;
  };
  if (!state.showPastLessons) return;
  if (isLoadingMorePastLessons) return;

  if (!canLoadMorePastLessons) {
    showInfo('最過去まで表示しました。', '完了');
    return;
  }

  const studentId = state.currentUser?.studentId;
  if (!studentId) {
    console.error('❌ studentIdが見つかりません');
    return;
  }

  const oldestPastDate = getOldestPastLessonDate(state.participantLessons);
  const beforeDate =
    oldestPastDate ||
    (canLoadMorePastLessons
      ? getParticipantHistoryBoundaryDate(PARTICIPANT_INITIAL_PAST_MONTHS)
      : '');
  if (!beforeDate) {
    participantHandlersStateManager.dispatch({
      type: 'UPDATE_STATE',
      payload: {
        participantHasMorePastLessons: false,
      },
    });
    renderWithScrollRestore(preservedScrollY);
    return;
  }

  setPastLessonsPaginationState({ isLoading: true });
  renderWithScrollRestore(preservedScrollY);
  showLoading('dataFetch');

  google.script.run
    .withSuccessHandler(
      /** @param {ApiResponseGeneric<any>} response */
      response => {
        hideLoading();
        setPastLessonsPaginationState({ isLoading: false });

        if (!shouldApplyLoadResult()) {
          debugLog(
            'ℹ️ 過去レッスン追加結果を破棄: 表示状態が切り替わっていたため',
          );
          return;
        }

        if (!response.success) {
          showInfo(
            response.message || '過去レッスンの追加取得に失敗しました',
            'エラー',
          );
          renderWithScrollRestore(preservedScrollY);
          return;
        }

        const fetchedLessons = Array.isArray(response.data?.lessons)
          ? response.data.lessons
          : [];
        const fetchedReservationsMap = response.data?.reservationsMap || {};

        if (fetchedLessons.length === 0) {
          const now = new Date().toISOString();
          participantHandlersStateManager.dispatch({
            type: 'UPDATE_STATE',
            payload: {
              participantHasMorePastLessons: false,
              participantDataFetchedAt: now,
              dataFetchedAt: now,
            },
          });
          renderWithScrollRestore(preservedScrollY);
          showInfo('最過去まで表示しました。', '完了');
          return;
        }

        const latestState = participantHandlersStateManager.getState();
        const existingLessons = Array.isArray(latestState.participantLessons)
          ? latestState.participantLessons
          : [];
        const mergedLessons = mergeLessonsByIdentity(
          existingLessons,
          fetchedLessons,
        );

        const mergedReservationsMap = {
          ...(latestState.participantReservationsMap || {}),
          ...fetchedReservationsMap,
        };
        const nextHasMorePastLessons = response.data?.hasMore === true;

        const now = new Date().toISOString();

        participantHandlersStateManager.dispatch({
          type: 'UPDATE_STATE',
          payload: {
            participantLessons: mergedLessons,
            participantReservationsMap: mergedReservationsMap,
            participantHasPastLessonsLoaded: true,
            showPastLessons: true,
            participantHasMorePastLessons: nextHasMorePastLessons,
            participantDataFetchedAt: now,
            dataFetchedAt: now,
          },
        });

        renderWithScrollRestore(preservedScrollY);

        if (!nextHasMorePastLessons) {
          showInfo('最過去まで表示しました。', '完了');
        }
      },
    )
    .withFailureHandler(
      /** @param {Error} error */
      error => {
        hideLoading();
        setPastLessonsPaginationState({ isLoading: false });
        if (!shouldApplyLoadResult()) {
          return;
        }
        console.error('❌ 過去レッスン追加取得失敗:', error);
        showInfo('通信エラーが発生しました', 'エラー');
        renderWithScrollRestore(preservedScrollY);
      },
    )
    .getPastLessonsForParticipantsView(
      studentId,
      beforeDate,
      state.currentUser?.phone || '',
      CONSTANTS.UI.HISTORY_LOAD_MORE_RECORDS || 10,
    );
}

/**
 * ローカル日付（YYYY-MM-DD）を返します。
 * @returns {string}
 */
function getLocalTodayYmd() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 売上転載対象日の文字列を正規化します。
 * @param {string | undefined | null} rawDate
 * @returns {string}
 */
function normalizeSalesTransferTargetDate(rawDate) {
  const value = String(rawDate || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : getLocalTodayYmd();
}

/**
 * 売上転載対象日が未来日かどうかを判定します。
 * @param {string} targetDate
 * @returns {boolean}
 */
function isFutureSalesTransferTargetDate(targetDate) {
  return normalizeSalesTransferTargetDate(targetDate) > getLocalTodayYmd();
}

/**
 * 管理画面の売上転記対象日を取得します。
 * @returns {string}
 */
function getAdminSalesTransferDate() {
  const state = participantHandlersStateManager.getState();
  const savedDate = String(state['adminSalesTransferTargetDate'] || '').trim();
  return normalizeSalesTransferTargetDate(savedDate);
}

/**
 * 管理者トークンを取得します（なりすまし時を含む）。
 * @returns {string}
 */
function getAdminSalesTransferToken() {
  const state = participantHandlersStateManager.getState();
  return (
    state.adminImpersonationOriginalUser?.['adminToken'] ||
    state.currentUser?.['adminToken'] ||
    ''
  );
}

/**
 * 売上転記対象日を更新します。
 * @param {{ date?: string } | string} data
 */
function updateSalesTransferTargetDate(data) {
  const state = participantHandlersStateManager.getState();
  const nextDate =
    typeof data === 'string' ? data : String(data?.date || '').trim();
  const normalizedDate = /^\d{4}-\d{2}-\d{2}$/.test(nextDate)
    ? nextDate
    : getLocalTodayYmd();
  const currentTargetDate = normalizeSalesTransferTargetDate(
    state['adminSalesTransferTargetDate'],
  );
  const shouldResetReport = currentTargetDate !== normalizedDate;

  participantHandlersStateManager.dispatch({
    type: 'UPDATE_STATE',
    payload: {
      adminSalesTransferTargetDate: normalizedDate,
      ...(shouldResetReport
        ? {
            adminSalesTransferReport: null,
            adminSalesTransferLastTransferResult: null,
            adminSalesTransferUpdatedStatusCount: 0,
          }
        : {}),
    },
  });
  render();
}

/**
 * 売上達成演出を短時間表示します。
 * @param {string} message
 */
function triggerSalesCelebration(message) {
  if (salesCelebrationTimer !== null) {
    clearTimeout(salesCelebrationTimer);
    salesCelebrationTimer = null;
  }

  participantHandlersStateManager.dispatch({
    type: 'UPDATE_STATE',
    payload: {
      adminSalesTransferCelebrationActive: true,
      adminSalesTransferCelebrationMessage: message,
    },
  });
  render();

  salesCelebrationTimer = setTimeout(() => {
    participantHandlersStateManager.dispatch({
      type: 'UPDATE_STATE',
      payload: {
        adminSalesTransferCelebrationActive: false,
      },
    });
    render();
    salesCelebrationTimer = null;
  }, 2800);
}

/**
 * 売上達成専用ビューを開きます。
 * @param {{ date?: string } | string} [data]
 */
function openSalesCelebrationView(data) {
  const state = participantHandlersStateManager.getState();
  const isAdmin =
    state.participantIsAdmin || state.currentUser?.isAdmin || false;
  if (!isAdmin) {
    showInfo('管理者のみ利用できます。', 'エラー');
    return;
  }
  const requestedDate =
    typeof data === 'string' ? data : String(data?.date || '').trim();
  const targetDate = normalizeSalesTransferTargetDate(
    requestedDate || getAdminSalesTransferDate(),
  );
  const reportTargetDate = String(
    state['adminSalesTransferReport']?.['targetDate'] || '',
  ).trim();
  const shouldResetReport = reportTargetDate && reportTargetDate !== targetDate;

  participantHandlersStateManager.dispatch({
    type: 'UPDATE_STATE',
    payload: {
      participantSubView: 'salesCelebration',
      adminSalesTransferTargetDate: targetDate,
      ...(shouldResetReport
        ? {
            adminSalesTransferReport: null,
            adminSalesTransferLastTransferResult: null,
            adminSalesTransferUpdatedStatusCount: 0,
          }
        : {}),
    },
  });
  render();
}

/**
 * 売上達成専用ビューを閉じて、参加者一覧に戻ります。
 */
function closeSalesCelebrationView() {
  if (salesCelebrationTimer !== null) {
    clearTimeout(salesCelebrationTimer);
    salesCelebrationTimer = null;
  }
  participantHandlersStateManager.dispatch({
    type: 'UPDATE_STATE',
    payload: {
      participantSubView: 'list',
      adminSalesTransferCelebrationActive: false,
    },
  });
  render();
}

/**
 * 売上集計プレビュー/転記実行を管理画面から呼び出します。
 * @param {{
 *   previewOnly?: boolean;
 *   skipConfirm?: boolean;
 *   showCelebration?: boolean;
 *   refreshAfterSuccess?: boolean;
 *   targetDate?: string;
 * }} [options]
 */
function runAdminSalesTransfer(options = {}) {
  const previewOnly = options.previewOnly === true;
  const skipConfirm = options.skipConfirm === true;
  const showCelebration = options.showCelebration === true;
  const refreshAfterSuccess = options.refreshAfterSuccess !== false;
  const targetDate = normalizeSalesTransferTargetDate(
    options.targetDate || getAdminSalesTransferDate(),
  );
  const adminToken = getAdminSalesTransferToken();

  if (!adminToken) {
    showInfo(
      '管理者トークンが取得できません。再ログインしてからお試しください。',
      'エラー',
    );
    return;
  }

  if (!previewOnly && isFutureSalesTransferTargetDate(targetDate)) {
    showInfo(
      '未来の日程は教室完了できません。対象日を確認してください。',
      'エラー',
    );
    return;
  }

  if (!previewOnly && !skipConfirm) {
    const ok = window.confirm(
      `${targetDate} の売上を売上表へ転記します。実行してよいですか？`,
    );
    if (!ok) return;
  }

  participantHandlersStateManager.dispatch({
    type: 'UPDATE_STATE',
    payload: {
      adminSalesTransferLoading: true,
      adminSalesTransferTargetDate: targetDate,
      adminSalesTransferUpdatedStatusCount: 0,
    },
  });
  render();

  google.script.run
    .withSuccessHandler(
      /** @param {ApiResponseGeneric<any>} response */
      response => {
        const report = response.data?.report || null;
        const transferResult = response.data?.transferResult || null;
        const updatedStatusCount = Number(
          response.data?.updatedStatusCount || 0,
        );

        participantHandlersStateManager.dispatch({
          type: 'UPDATE_STATE',
          payload: {
            adminSalesTransferLoading: false,
            adminSalesTransferReport: report,
            adminSalesTransferLastTransferResult: previewOnly
              ? null
              : transferResult,
            adminSalesTransferUpdatedStatusCount: previewOnly
              ? 0
              : updatedStatusCount,
            adminSalesTransferTargetDate: report?.targetDate || targetDate,
          },
        });
        render();

        if (!response.success) {
          showInfo(response.message || '売上処理に失敗しました。', 'エラー');
          return;
        }

        if (previewOnly) {
          showInfo('売上集計を更新しました。', '完了');
          return;
        }

        const totalCount = Number(transferResult?.totalCount || 0);
        const successCount = Number(transferResult?.successCount || 0);
        const hasSalesTargets = totalCount > 0;
        const hasStatusUpdates = updatedStatusCount > 0;
        const summaryMessage = hasSalesTargets
          ? `教室完了 ⇢ 売上集計 が完了しました（成功 ${successCount} / 対象 ${totalCount}）。日程更新 ${updatedStatusCount}件。`
          : hasStatusUpdates
            ? `売上対象はありませんでしたが、日程更新 ${updatedStatusCount}件を完了しました。`
            : '対象日の会計済みよやくはありませんでした。';

        if (showCelebration) {
          triggerSalesCelebration(
            totalCount > 0
              ? `${targetDate} の教室完了！ 売上 ${successCount}/${totalCount}`
              : `${targetDate} の教室完了！`,
          );
        }

        if (refreshAfterSuccess && (hasSalesTargets || hasStatusUpdates)) {
          refreshAllAdminData();
        }

        showInfo(summaryMessage, '完了');
      },
    )
    .withFailureHandler(
      /** @param {Error} error */
      error => {
        participantHandlersStateManager.dispatch({
          type: 'UPDATE_STATE',
          payload: {
            adminSalesTransferLoading: false,
          },
        });
        render();

        console.error('❌ 売上転載処理失敗:', error);
        showInfo('売上転載処理で通信エラーが発生しました。', 'エラー');
      },
    )
    .runSalesTransferFromAdmin({
      targetDate,
      previewOnly,
      adminToken,
    });
}

/**
 * アコーディオン下部の「教室完了」ボタンから売上転載を実行します。
 * （売上転載と教室完了を同義として扱う）
 * @param {{ date?: string } | string} [data]
 */
function completeLessonSalesTransfer(data) {
  const targetDate = normalizeSalesTransferTargetDate(
    typeof data === 'string' ? data : String(data?.date || '').trim(),
  );
  openSalesCelebrationView({ date: targetDate });
  runAdminSalesTransfer({
    previewOnly: false,
    skipConfirm: true,
    showCelebration: true,
    refreshAfterSuccess: true,
    targetDate,
  });
}

/**
 * 参加者リスト用アクションハンドラー
 */
export const participantActionHandlers = {
  loadParticipantView,
  goToParticipantsView: () => loadParticipantView(),
  refreshParticipantView,
  openSalesCelebrationView,
  closeSalesCelebrationView,
  completeLessonSalesTransfer,
  completeTodayClassroom: () =>
    runAdminSalesTransfer({
      previewOnly: false,
      skipConfirm: true,
      showCelebration: true,
      refreshAfterSuccess: true,
      targetDate: getAdminSalesTransferDate(),
    }),
  updateSalesTransferTargetDate,
  previewSalesTransfer: () =>
    runAdminSalesTransfer({
      previewOnly: true,
      skipConfirm: true,
      showCelebration: false,
      refreshAfterSuccess: false,
    }),
  executeSalesTransfer: () =>
    runAdminSalesTransfer({
      previewOnly: false,
      skipConfirm: false,
      showCelebration: false,
      refreshAfterSuccess: true,
    }),
  markAllLogsAsViewed: () => {
    const lastViewedKey = 'YOYAKU_KIROKU_ADMIN_LOG_LAST_VIEWED';
    localStorage.setItem(lastViewedKey, new Date().toISOString());
    render();
    showInfo('すべてのログを既読にしました', '完了');
  },
  autoRefreshAdminViewsOnTabResume,
  refreshLogView: () => {
    // ログ更新ボタンハンドラ - 統合リフレッシュ関数に委譲
    refreshAllAdminData();
  },
  loadMoreAdminLogs,
  goToLogView: () => {
    // ログビューに遷移
    const state = participantHandlersStateManager.getState();
    const hasLogCache = Array.isArray(state['adminLogs']);
    const logDaysBack = getAdminLogDaysBackFromState(state);
    const hasParticipantCache =
      Array.isArray(state.participantLessons) &&
      state.participantReservationsMap &&
      typeof state.participantReservationsMap === 'object';
    const needsInitialPairFetch = !hasLogCache || !hasParticipantCache;
    const shouldRefreshLogs =
      needsInitialPairFetch ||
      isDataStale(
        getAdminLogsFetchedAt(state),
        ADMIN_LOG_BACKGROUND_REFRESH_INTERVAL_MS,
      );

    // キャッシュがあれば即表示、なければロード表示
    participantHandlersStateManager.dispatch({
      type: 'SET_STATE',
      payload: {
        view: 'adminLog',
        adminLogsLoading: !hasLogCache,
        adminLogsRefreshing: hasLogCache && shouldRefreshLogs,
        adminLogsDaysBack: logDaysBack,
      },
    });
    render();

    if (!shouldRefreshLogs) {
      debugLog('ℹ️ 管理者データ再取得をスキップ（取得直後のため）');
      return;
    }

    // 初回表示と更新は、操作ログ + よやくきろくデータを同時取得
    refreshAllAdminData({
      showNoChangeInfo: !needsInitialPairFetch,
      useLogLoading: !hasLogCache,
      logDaysBack,
    });
  },
  toggleParticipantLessonAccordion,
  expandAllAccordions,
  collapseAllAccordions,
  toggleAllAccordions,
  selectParticipantStudent,
  backToParticipantList,
  backToParticipantsView: () => {
    participantHandlersStateManager.dispatch({
      type: 'UPDATE_STATE',
      payload: {
        view: 'participants',
      },
    });
    render();
  },
  filterParticipantByClassroom,
  togglePastLessons,
  loadMorePastParticipantLessons,
};
