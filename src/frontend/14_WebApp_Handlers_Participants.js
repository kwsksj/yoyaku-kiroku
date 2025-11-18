/**
 * =================================================================
 * ファイル概要
 * -----------------------------------------------------------------
 * 名称: 14_WebApp_Handlers_Participants.js
 * 目的: 参加者リスト画面のアクションハンドラ
 * 主な責務:
 *   - レッスン選択処理
 *   - 生徒選択処理
 *   - サブビュー遷移処理
 * =================================================================
 */

import { render } from './14_WebApp_Handlers.js';

/** @type {SimpleStateManager} */
const participantsHandlersStateManager = appWindow.stateManager;

// =================================================================
// --- 生徒詳細キャッシュ ---
// -----------------------------------------------------------------
// 生徒詳細データは初回一括取得していないため、個別キャッシュが必要
// =================================================================

/**
 * @typedef {Object} CacheEntry
 * @property {any} data - キャッシュされたデータ
 * @property {number} timestamp - キャッシュ保存時刻
 * @property {number} maxAge - キャッシュ有効期限（ミリ秒）
 */

/** @type {Record<string, CacheEntry>} */
const studentsCache = {};

/** @type {Record<string, boolean>} */
const fetchingStudents = {};

/** @type {string[]} */
const studentsCacheKeys = [];

const MAX_CACHE_SIZE = 10;
const CACHE_MAX_AGE = 5 * 60 * 1000; // 5分

/**
 * キャッシュが有効かチェック
 * @param {Record<string, CacheEntry>} cache - キャッシュオブジェクト
 * @param {string} key - キャッシュキー
 * @returns {boolean}
 */
function isCacheValid(cache, key) {
  const entry = cache[key];
  if (!entry) return false;
  const age = Date.now() - entry.timestamp;
  return age < entry.maxAge;
}

/**
 * キャッシュにデータを保存（LRU方式）
 * @param {Record<string, CacheEntry>} cache - キャッシュオブジェクト
 * @param {string[]} cacheKeys - キャッシュキーの配列
 * @param {string} key - キャッシュキー
 * @param {any} data - 保存するデータ
 */
function saveToCache(cache, cacheKeys, key, data) {
  // 既存のキーを削除
  const existingIndex = cacheKeys.indexOf(key);
  if (existingIndex !== -1) {
    cacheKeys.splice(existingIndex, 1);
  }

  // サイズ制限チェック
  if (cacheKeys.length >= MAX_CACHE_SIZE) {
    const oldest = cacheKeys.shift();
    if (oldest) {
      delete cache[oldest];
      console.log(`🗑️ 最古のキャッシュを削除: ${oldest}`);
    }
  }

  // 新しいデータを保存
  cache[key] = {
    data,
    timestamp: Date.now(),
    maxAge: CACHE_MAX_AGE,
  };
  cacheKeys.push(key);
  console.log(`💾 キャッシュ保存: ${key}`);
}

/**
 * 生徒詳細を取得（キャッシュ + Optimistic UI）
 * @param {string} targetStudentId - 表示対象の生徒ID
 * @param {string} requestingStudentId - リクエスト元の生徒ID
 * @param {Object} options - オプション
 * @param {boolean} [options.forceRefresh=false] - 強制再取得
 * @param {boolean} [options.shouldShowLoading=true] - ローディング表示
 * @returns {Promise<any>}
 */
function fetchStudentDetails(
  targetStudentId,
  requestingStudentId,
  options = {},
) {
  const { forceRefresh = false, shouldShowLoading = true } = options;

  // 1. フェッチ中チェック
  if (fetchingStudents[targetStudentId] && !forceRefresh) {
    console.log(`⏳ 既に取得中: ${targetStudentId} - スキップ`);
    return Promise.resolve(null);
  }

  // 2. キャッシュチェック
  if (!forceRefresh && isCacheValid(studentsCache, targetStudentId)) {
    console.log(`✅ キャッシュ使用: ${targetStudentId}`);
    const cachedData = studentsCache[targetStudentId].data;

    // Optimistic UI: 即座に表示
    participantsHandlersStateManager.dispatch({
      type: 'UPDATE_STATE',
      payload: {
        participantsSelectedStudent: cachedData,
        participantsSubView: 'studentDetail',
      },
    });
    render();

    // バックグラウンドで最新データ取得
    console.log('🔄 バックグラウンドで最新データ取得中...');
    fetchStudentDetails(targetStudentId, requestingStudentId, {
      shouldShowLoading: false,
      forceRefresh: true,
    });

    return Promise.resolve(cachedData);
  }

  // 3. API呼び出し
  if (shouldShowLoading) {
    showLoading('participants');
  }

  fetchingStudents[targetStudentId] = true;

  return new Promise((resolve, reject) => {
    google.script.run
      .withSuccessHandler(function (response) {
        console.log(`✅ 生徒詳細取得成功: ${targetStudentId}`, response);

        fetchingStudents[targetStudentId] = false;

        if (response.success) {
          // キャッシュに保存
          saveToCache(
            studentsCache,
            studentsCacheKeys,
            targetStudentId,
            response.data.student,
          );

          // stateManagerに保存して表示
          participantsHandlersStateManager.dispatch({
            type: 'UPDATE_STATE',
            payload: {
              participantsSelectedStudent: response.data.student,
              participantsSubView: 'studentDetail',
            },
          });

          if (shouldShowLoading) hideLoading();
          render();

          resolve(response.data.student);
        } else {
          if (shouldShowLoading) hideLoading();
          showInfo(
            response.message || '生徒情報の取得に失敗しました',
            'エラー',
          );
          reject(new Error(response.message));
        }
      })
      .withFailureHandler(
        /** @param {Error} error */
        function (error) {
          console.error(`❌ 生徒詳細取得失敗: ${targetStudentId}`, error);
          fetchingStudents[targetStudentId] = false;

          if (shouldShowLoading) hideLoading();
          showInfo('通信エラーが発生しました', 'エラー');
          reject(error);
        },
      )
      .getStudentDetailsForParticipantsView(
        targetStudentId,
        requestingStudentId,
      );
  });
}

/**
 * 参加者リストビュー初期化
 * ログイン成功後、管理者の場合に呼ばれる
 *
 * @param {boolean} forceReload - 強制的に再取得する場合はtrue
 */
function loadParticipantsView(
  forceReload = false,
  shouldShowLoading = true,
  baseAppState = /** @type {Partial<UIState> | null} */ (null),
) {
  console.log('📋 参加者リストビュー初期化開始');

  const state = participantsHandlersStateManager.getState();
  const studentId =
    state.currentUser?.studentId ||
    (baseAppState && baseAppState.currentUser
      ? baseAppState.currentUser.studentId
      : undefined);

  if (!studentId) {
    console.error('❌ studentIdが見つかりません');
    return;
  }

  // 既にデータがある場合はAPIコールをスキップ（レート制限対策）
  // 重要: 予約データ（reservationsMap）も必要なのでチェック
  if (
    !forceReload &&
    state.participantsLessons &&
    state.participantsLessons.length > 0 &&
    state.participantsReservationsMap &&
    Object.keys(state.participantsReservationsMap).length > 0
  ) {
    console.log('✅ キャッシュ済みデータを使用 - APIコールをスキップ');
    /** @type {Partial<UIState>} */
    const cachePayload = baseAppState
      ? {
          .../** @type {Partial<UIState>} */ (baseAppState),
          view: 'participants',
          participantsSubView: 'list',
          selectedParticipantsClassroom:
            state.selectedParticipantsClassroom || 'all',
          showPastLessons: state.showPastLessons || false,
          recordsToShow: CONSTANTS.UI.HISTORY_INITIAL_RECORDS,
          isDataFresh: true,
        }
      : {
          view: 'participants',
          participantsSubView: 'list',
          selectedParticipantsClassroom:
            state.selectedParticipantsClassroom || 'all',
          showPastLessons: state.showPastLessons || false,
        };

    participantsHandlersStateManager.dispatch({
      type: baseAppState ? 'SET_STATE' : 'UPDATE_STATE',
      payload: cachePayload,
    });
    hideLoading(); // キャッシュ使用時もローディングを非表示
    render();
    return;
  }

  if (shouldShowLoading) {
    showLoading('participants');
  }

  // バックエンドからレッスン一覧と予約データを一括取得
  google.script.run
    .withSuccessHandler(function (response) {
      console.log('✅ レッスン一覧+予約データ取得成功:', response);

      if (response.success) {
        const nextIsAdmin =
          Object.prototype.hasOwnProperty.call(response.data, 'isAdmin') &&
          response.data.isAdmin !== undefined
            ? response.data.isAdmin
            : state.participantsIsAdmin;

        // stateManagerに保存（レッスン一覧と予約データ）
        // ログイン時の場合はbaseAppStateをマージ
        /** @type {Partial<UIState>} */
        const payload = baseAppState
          ? {
              .../** @type {Partial<UIState>} */ (baseAppState),
              view: 'participants',
              participantsLessons: response.data.lessons,
              participantsReservationsMap: response.data.reservationsMap || {},
              participantsIsAdmin: nextIsAdmin,
              participantsSubView: 'list',
              selectedParticipantsClassroom: 'all',
              showPastLessons: false,
              recordsToShow: CONSTANTS.UI.HISTORY_INITIAL_RECORDS,
              isDataFresh: true,
            }
          : {
              view: 'participants',
              participantsLessons: response.data.lessons,
              participantsReservationsMap: response.data.reservationsMap || {},
              participantsIsAdmin: nextIsAdmin,
              participantsSubView: 'list',
              selectedParticipantsClassroom: 'all',
              showPastLessons: false,
            };

        participantsHandlersStateManager.dispatch({
          type: baseAppState ? 'SET_STATE' : 'UPDATE_STATE',
          payload,
        });

        if (response.data.reservationsMap) {
          console.log(
            `💾 予約データをstateManagerに保存: ${Object.keys(response.data.reservationsMap).length}レッスン分`,
          );
        }

        hideLoading();
        render();
      } else {
        hideLoading();
        showInfo(
          response.message || 'レッスン一覧の取得に失敗しました',
          'エラー',
        );
      }
    })
    .withFailureHandler(
      /** @param {Error} error */
      function (error) {
        console.error('❌ レッスン一覧取得失敗:', error);
        hideLoading();
        showInfo('通信エラーが発生しました', 'エラー');
      },
    )
    .getLessonsForParticipantsView(studentId, true, true); // 第3引数: includeReservations=true
}

/**
 * アコーディオンの開閉を切り替えるハンドラ（複数展開対応・DOM直接操作版）
 * @param {string} lessonId - レッスンID
 */
function toggleParticipantsLessonAccordion(lessonId) {
  if (!lessonId) return;

  console.log('🎯 アコーディオン切り替え:', lessonId);

  const state = participantsHandlersStateManager.getState();
  const currentExpandedIds = state.expandedLessonIds || [];

  // 配列に含まれている場合は削除、含まれていない場合は追加
  const isCurrentlyExpanded = currentExpandedIds.includes(lessonId);
  const newExpandedIds = isCurrentlyExpanded
    ? currentExpandedIds.filter(id => id !== lessonId)
    : [...currentExpandedIds, lessonId];

  // State更新
  participantsHandlersStateManager.dispatch({
    type: 'UPDATE_STATE',
    payload: {
      expandedLessonIds: newExpandedIds,
    },
  });

  // DOM直接操作でコンテンツを切り替え（再レンダリング不要）
  const container = document.querySelector(
    `[data-lesson-container="${lessonId}"]`,
  );
  if (!container) return;

  const contentElement = container.querySelector('.accordion-content');
  const arrowElement = container.querySelector('svg');

  if (isCurrentlyExpanded) {
    // 閉じる
    if (contentElement) {
      contentElement.classList.add('hidden');
    }
    if (arrowElement) {
      arrowElement.classList.remove('rotate-180');
    }
  } else {
    // 開く
    if (contentElement) {
      contentElement.classList.remove('hidden');
    }
    if (arrowElement) {
      arrowElement.classList.add('rotate-180');
    }
  }
}

/**
 * レッスン選択ハンドラ（旧実装 - 互換性のため残す）
 * @param {string} lessonId - レッスンID
 */
function selectParticipantsLesson(lessonId) {
  if (!lessonId) return;

  console.log('📅 レッスン選択:', lessonId);

  const state = participantsHandlersStateManager.getState();
  const selectedLesson = state.participantsLessons?.find(
    /** @param {import('../../types/core/lesson').LessonCore} l */
    l => l.lessonId === lessonId,
  );

  if (!selectedLesson) {
    showInfo('レッスン情報が見つかりません', 'エラー');
    return;
  }

  // stateManagerから予約データを取得（初回ロード時に全データ取得済み）
  const reservations = state.participantsReservationsMap?.[lessonId] || [];

  console.log(`✅ stateManagerから予約データ取得: ${reservations.length}件`);

  // 状態を更新して表示
  participantsHandlersStateManager.dispatch({
    type: 'UPDATE_STATE',
    payload: {
      participantsSelectedLesson: selectedLesson,
      participantsReservations: reservations,
      participantsSubView: 'reservations',
    },
  });

  render();
}

/**
 * 生徒選択ハンドラ
 * @param {string} targetStudentId - 表示対象の生徒ID
 */
function selectParticipantsStudent(targetStudentId) {
  if (!targetStudentId) return;

  console.log('👤 生徒選択:', targetStudentId);

  const state = participantsHandlersStateManager.getState();
  const requestingStudentId = state.currentUser?.studentId;

  if (!requestingStudentId) {
    showInfo('ユーザー情報が見つかりません', 'エラー');
    return;
  }

  // 統一データ取得関数を使用（キャッシュ + Optimistic UI）
  fetchStudentDetails(targetStudentId, requestingStudentId);
}

/**
 * レッスン一覧に戻る
 */
function backToParticipantsList() {
  console.log('⬅️ レッスン一覧に戻る');

  participantsHandlersStateManager.dispatch({
    type: 'UPDATE_STATE',
    payload: {
      participantsSubView: 'list',
      participantsSelectedLesson: null,
      participantsReservations: [],
    },
  });

  render();
}

/**
 * 参加者リストに戻る
 */
function backToParticipantsReservations() {
  console.log('⬅️ 参加者リストに戻る');

  participantsHandlersStateManager.dispatch({
    type: 'UPDATE_STATE',
    payload: {
      participantsSubView: 'reservations',
      participantsSelectedStudent: null,
    },
  });

  render();
}

/**
 * 教室フィルタハンドラ
 * @param {string} classroom - 選択された教室（'all'または教室名）
 */
function filterParticipantsByClassroom(classroom) {
  console.log('🔍 教室フィルタ:', classroom);

  participantsHandlersStateManager.dispatch({
    type: 'UPDATE_STATE',
    payload: {
      selectedParticipantsClassroom: classroom,
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
  console.log('📅 レッスン表示切り替え:', showPast ? '過去' : '未来');

  participantsHandlersStateManager.dispatch({
    type: 'UPDATE_STATE',
    payload: {
      showPastLessons: showPast,
      expandedLessonId: null, // タブ切り替え時はアコーディオンを閉じる
    },
  });

  render();
}

/**
 * 参加者リスト用アクションハンドラー
 */
export const participantsActionHandlers = {
  loadParticipantsView,
  toggleParticipantsLessonAccordion,
  selectParticipantsLesson,
  selectParticipantsStudent,
  backToParticipantsList,
  backToParticipantsReservations,
  filterParticipantsByClassroom,
  togglePastLessons,
};
