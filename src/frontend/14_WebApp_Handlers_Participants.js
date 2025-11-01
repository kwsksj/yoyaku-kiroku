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
// --- キャッシュ管理システム ---
// -----------------------------------------------------------------
// 予約データと生徒データのキャッシュを一元管理
// =================================================================

/**
 * @typedef {Object} CacheEntry
 * @property {any} data - キャッシュされたデータ
 * @property {number} timestamp - キャッシュ保存時刻
 * @property {number} maxAge - キャッシュ有効期限（ミリ秒）
 */

/** @type {Record<string, CacheEntry>} */
const reservationsCache = {};

/** @type {Record<string, CacheEntry>} */
const studentsCache = {};

/** @type {Record<string, boolean>} */
const fetchingReservations = {};

/** @type {Record<string, boolean>} */
const fetchingStudents = {};

/** @type {string[]} */
const reservationsCacheKeys = [];

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

// =================================================================
// --- 統一データ取得関数 ---
// -----------------------------------------------------------------
// キャッシュ、フェッチ状態管理、Optimistic UIを統合
// =================================================================

/**
 * 予約データを取得（キャッシュ + Optimistic UI）
 * @param {string} lessonId - レッスンID
 * @param {string} studentId - 生徒ID
 * @param {Object} options - オプション
 * @param {boolean} [options.forceRefresh=false] - 強制再取得
 * @param {boolean} [options.shouldShowLoading=true] - ローディング表示
 * @param {boolean} [options.prefetch=false] - プリフェッチモード
 * @returns {Promise<any>}
 */
function fetchReservationsForLesson(lessonId, studentId, options = {}) {
  const {
    forceRefresh = false,
    shouldShowLoading = true,
    prefetch = false,
  } = options;

  // 1. フェッチ中チェック
  if (fetchingReservations[lessonId] && !forceRefresh) {
    console.log(`⏳ 既に取得中: ${lessonId} - スキップ`);
    return Promise.resolve(null);
  }

  // 2. キャッシュチェック
  if (!forceRefresh && isCacheValid(reservationsCache, lessonId)) {
    console.log(`✅ キャッシュ使用: ${lessonId}`);
    const cachedData = reservationsCache[lessonId].data;

    if (!prefetch) {
      // Optimistic UI: 即座に表示
      const state = participantsHandlersStateManager.getState();
      const selectedLesson = state.participantsLessons?.find(
        /** @param {import('../../types/core/lesson').LessonCore} l */
        l => l.lessonId === lessonId,
      );

      participantsHandlersStateManager.dispatch({
        type: 'UPDATE_STATE',
        payload: {
          participantsSelectedLesson: selectedLesson,
          participantsReservations: cachedData,
          participantsSubView: 'reservations',
        },
      });
      render();

      // バックグラウンドで最新データ取得（控えめ）
      console.log('🔄 バックグラウンドで最新データ取得中...');
      fetchReservationsForLesson(lessonId, studentId, {
        shouldShowLoading: false,
        forceRefresh: true,
      });
    }

    return Promise.resolve(cachedData);
  }

  // 3. API呼び出し
  if (shouldShowLoading && !prefetch) {
    showLoading('participants');
  }

  fetchingReservations[lessonId] = true;

  return new Promise((resolve, reject) => {
    google.script.run
      .withSuccessHandler(function (response) {
        console.log(`✅ 予約情報取得成功: ${lessonId}`, response);

        fetchingReservations[lessonId] = false;

        if (response.success) {
          // キャッシュに保存
          saveToCache(
            reservationsCache,
            reservationsCacheKeys,
            lessonId,
            response.data.reservations,
          );

          if (!prefetch) {
            // 通常モード: stateManagerに保存して表示
            const state = participantsHandlersStateManager.getState();
            const selectedLesson = state.participantsLessons?.find(
              /** @param {import('../../types/core/lesson').LessonCore} l */
              l => l.lessonId === lessonId,
            );

            participantsHandlersStateManager.dispatch({
              type: 'UPDATE_STATE',
              payload: {
                participantsSelectedLesson: selectedLesson,
                participantsReservations: response.data.reservations,
                participantsSubView: 'reservations',
              },
            });

            if (shouldShowLoading) hideLoading();
            render();
          }

          resolve(response.data.reservations);
        } else {
          if (shouldShowLoading && !prefetch) hideLoading();
          if (!prefetch) {
            showInfo(
              response.message || '予約情報の取得に失敗しました',
              'エラー',
            );
          }
          reject(new Error(response.message));
        }
      })
      .withFailureHandler(
        /** @param {Error} error */
        function (error) {
          console.error(`❌ 予約情報取得失敗: ${lessonId}`, error);
          fetchingReservations[lessonId] = false;

          if (shouldShowLoading && !prefetch) hideLoading();
          if (!prefetch) {
            showInfo('通信エラーが発生しました', 'エラー');
          }
          reject(error);
        },
      )
      .getReservationsForLesson(lessonId, studentId);
  });
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
function loadParticipantsView(forceReload = false) {
  console.log('📋 参加者リストビュー初期化開始');

  const state = participantsHandlersStateManager.getState();
  const studentId = state.currentUser?.studentId;

  if (!studentId) {
    console.error('❌ studentIdが見つかりません');
    return;
  }

  // 既にデータがある場合はAPIコールをスキップ（レート制限対策）
  if (
    !forceReload &&
    state.participantsLessons &&
    state.participantsLessons.length > 0
  ) {
    console.log('✅ キャッシュ済みデータを使用 - APIコールをスキップ');
    participantsHandlersStateManager.dispatch({
      type: 'UPDATE_STATE',
      payload: {
        participantsSubView: 'list',
      },
    });
    render();
    return;
  }

  showLoading('participants');

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

        // stateManagerに保存
        participantsHandlersStateManager.dispatch({
          type: 'UPDATE_STATE',
          payload: {
            participantsLessons: response.data.lessons,
            participantsIsAdmin: nextIsAdmin,
            participantsSubView: 'list',
          },
        });

        hideLoading();
        render();

        // 🚀 予約データを一括キャッシュに保存
        if (response.data.reservationsMap) {
          const reservationsMap = response.data.reservationsMap;
          const lessonIds = Object.keys(reservationsMap);

          console.log(
            `💾 予約データを一括キャッシュ保存: ${lessonIds.length}レッスン分`,
          );

          lessonIds.forEach(lessonId => {
            saveToCache(
              reservationsCache,
              reservationsCacheKeys,
              lessonId,
              reservationsMap[lessonId],
            );
          });

          console.log('✅ 全予約データのキャッシュ保存完了');
        }
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
 * レッスン選択ハンドラ
 * @param {string} lessonId - レッスンID
 */
function selectParticipantsLesson(lessonId) {
  if (!lessonId) return;

  console.log('📅 レッスン選択:', lessonId);

  const state = participantsHandlersStateManager.getState();
  const studentId = state.currentUser?.studentId;
  const selectedLesson = state.participantsLessons?.find(
    /** @param {import('../../types/core/lesson').LessonCore} l */
    l => l.lessonId === lessonId,
  );

  if (!selectedLesson) {
    showInfo('レッスン情報が見つかりません', 'エラー');
    return;
  }

  if (!studentId) {
    showInfo('ユーザー情報が見つかりません', 'エラー');
    return;
  }

  // 統一データ取得関数を使用（キャッシュ + Optimistic UI）
  fetchReservationsForLesson(lessonId, studentId);
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
 * 参加者リスト用アクションハンドラー
 */
export const participantsActionHandlers = {
  loadParticipantsView,
  selectParticipantsLesson,
  selectParticipantsStudent,
  backToParticipantsList,
  backToParticipantsReservations,
};
