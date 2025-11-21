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

import { render } from './14_WebApp_Handlers.js';

/** @type {SimpleStateManager} */
const participantHandlersStateManager = appWindow.stateManager;

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
 * 参加者リストビュー初期化
 * ログイン成功後、管理者の場合に呼ばれる
 *
 * @param {boolean} forceReload - 強制的に再取得する場合はtrue
 */
function loadParticipantView(
  forceReload = false,
  shouldShowLoading = true,
  baseAppState = /** @type {Partial<UIState> | null} */ (null),
) {
  console.log('📋 参加者リストビュー初期化開始');

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

  // 既にデータがある場合はAPIコールをスキップ（レート制限対策）
  // 重要: 予約データ（reservationsMap）も必要なのでチェック
  if (
    !forceReload &&
    state.participantLessons &&
    state.participantLessons.length > 0 &&
    state.participantReservationsMap &&
    Object.keys(state.participantReservationsMap).length > 0
  ) {
    console.log('✅ キャッシュ済みデータを使用 - APIコールをスキップ');
    /** @type {Partial<UIState>} */
    const cachePayload = baseAppState
      ? {
          .../** @type {Partial<UIState>} */ (baseAppState),
          view: 'participants',
          participantSubView: 'list',
          selectedParticipantClassroom:
            state.selectedParticipantClassroom || 'all',
          showPastLessons: state.showPastLessons || false,
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
            : state.participantIsAdmin;

        // stateManagerに保存（レッスン一覧と予約データ）
        // ログイン時の場合はbaseAppStateをマージ
        /** @type {Partial<UIState>} */
        const payload = baseAppState
          ? {
              .../** @type {Partial<UIState>} */ (baseAppState),
              view: 'participants',
              participantLessons: response.data.lessons,
              participantReservationsMap: response.data.reservationsMap || {},
              participantIsAdmin: nextIsAdmin,
              participantSubView: 'list',
              selectedParticipantClassroom: 'all',
              showPastLessons: false,
              recordsToShow: CONSTANTS.UI.HISTORY_INITIAL_RECORDS,
              isDataFresh: true,
            }
          : {
              view: 'participants',
              participantLessons: response.data.lessons,
              participantReservationsMap: response.data.reservationsMap || {},
              participantIsAdmin: nextIsAdmin,
              participantSubView: 'list',
              selectedParticipantClassroom: 'all',
              showPastLessons: false,
            };

        participantHandlersStateManager.dispatch({
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

  console.log('🎯 アコーディオン切り替え:', lessonId);

  // ローカル配列で開閉状態を管理（dispatch()を呼ばない）
  const isCurrentlyExpanded = localExpandedLessonIds.includes(lessonId);

  if (isCurrentlyExpanded) {
    localExpandedLessonIds = localExpandedLessonIds.filter(
      id => id !== lessonId,
    );
  } else {
    localExpandedLessonIds.push(lessonId);
  }

  // DOM直接操作のみでコンテンツを切り替え（自動レンダリング発生せず）
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
function selectParticipantLesson(lessonId) {
  if (!lessonId) return;

  console.log('📅 レッスン選択:', lessonId);

  const state = participantHandlersStateManager.getState();
  const selectedLesson = state.participantLessons?.find(
    /** @param {import('../../types/core/lesson').LessonCore} l */
    l => l.lessonId === lessonId,
  );

  if (!selectedLesson) {
    showInfo('レッスン情報が見つかりません', 'エラー');
    return;
  }

  // stateManagerから予約データを取得（初回ロード時に全データ取得済み）
  const reservations = state.participantReservationsMap?.[lessonId] || [];

  console.log(`✅ stateManagerから予約データ取得: ${reservations.length}件`);

  // 状態を更新して表示
  participantHandlersStateManager.dispatch({
    type: 'UPDATE_STATE',
    payload: {
      participantSelectedLesson: selectedLesson,
      participantReservations: reservations,
      participantSubView: 'reservations',
    },
  });

  render();
}

/**
 * 生徒選択ハンドラ（モーダル表示）
 * @param {string} targetStudentId - 表示対象の生徒ID
 */
function selectParticipantStudent(targetStudentId) {
  if (!targetStudentId) return;

  console.log('👤 生徒選択:', targetStudentId);

  const state = participantHandlersStateManager.getState();
  const requestingStudentId = state.currentUser?.studentId;

  if (!requestingStudentId) {
    showInfo('ユーザー情報が見つかりません', 'エラー');
    return;
  }

  // ローディング表示
  showLoading('participants');

  // キャッシュチェック
  if (isCacheValid(studentsCache, targetStudentId)) {
    console.log(`✅ キャッシュ使用: ${targetStudentId}`);
    const cachedData = studentsCache[targetStudentId].data;
    hideLoading();
    showStudentModal(cachedData, state.participantIsAdmin || false);
    return;
  }

  // フェッチ中チェック
  if (fetchingStudents[targetStudentId]) {
    console.log(`⏳ 既に取得中: ${targetStudentId} - スキップ`);
    hideLoading();
    return;
  }

  fetchingStudents[targetStudentId] = true;

  // API呼び出し
  google.script.run
    .withSuccessHandler(function (response) {
      console.log(`✅ 生徒詳細取得成功: ${targetStudentId}`, response);

      fetchingStudents[targetStudentId] = false;
      hideLoading();

      if (response.success) {
        // キャッシュに保存
        saveToCache(
          studentsCache,
          studentsCacheKeys,
          targetStudentId,
          response.data.student,
        );

        // モーダル表示
        showStudentModal(
          response.data.student,
          state.participantIsAdmin || false,
        );
      } else {
        showInfo(response.message || '生徒詳細の取得に失敗しました', 'エラー');
      }
    })
    .withFailureHandler(
      /**
       * @param {any} error
       */
      function (error) {
        console.error(`❌ 生徒詳細取得エラー: ${targetStudentId}`, error);
        fetchingStudents[targetStudentId] = false;
        hideLoading();
        showInfo('生徒詳細の取得中にエラーが発生しました', 'エラー');
      },
    )
    .getStudentDetailsForParticipantsView(targetStudentId, requestingStudentId);
}

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

  // モーダル表示
  if (typeof appWindow.showModal === 'function') {
    appWindow.showModal({
      title: escapeHTML(displayName),
      message: content,
      confirmText: '閉じる',
    });
  } else {
    console.error('showModal関数が見つかりません');
  }
}

/**
 * レッスン一覧に戻る
 */
function backToParticipantList() {
  console.log('⬅️ レッスン一覧に戻る');

  participantHandlersStateManager.dispatch({
    type: 'UPDATE_STATE',
    payload: {
      participantSubView: 'list',
      participantSelectedLesson: null,
      participantReservations: [],
    },
  });

  render();
}

/**
 * 教室フィルタハンドラ
 * @param {string} classroom - 選択された教室（'all'または教室名）
 */
function filterParticipantByClassroom(classroom) {
  console.log('🔍 教室フィルタ:', classroom);

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
  console.log('📅 レッスン表示切り替え:', showPast ? '過去' : '未来');

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
 * 参加者リスト用アクションハンドラー
 */
export const participantActionHandlers = {
  loadParticipantView,
  toggleParticipantLessonAccordion,
  selectParticipantLesson,
  selectParticipantStudent,
  backToParticipantList,
  filterParticipantByClassroom,
  togglePastLessons,
};
