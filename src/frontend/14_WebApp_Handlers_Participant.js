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
 * @param {string|boolean} loadingCategory - ローディングバリエーション（'participants' | 'dataFetch' 等）。falseの場合は非表示。
 * @param {Partial<UIState> | null} baseAppState - 初期状態
 * @param {boolean} includeHistory - 過去の履歴も含めるか
 */
function loadParticipantView(
  forceReload = false,
  loadingCategory = 'participants',
  baseAppState = /** @type {Partial<UIState> | null} */ (null),
  includeHistory = false,
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
    baseAppState.participantLessons.length > 0
  ) {
    const nextIsAdmin =
      baseAppState.participantIsAdmin ||
      baseAppState.currentUser?.isAdmin ||
      false;
    /** @type {Partial<UIState>} */
    const payload = {
      ...baseAppState,
      view: 'participants',
      participantSubView: 'list',
      selectedParticipantClassroom: 'all',
      showPastLessons: false,
      participantHasPastLessonsLoaded: true,
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
    return;
  }

  if (category) {
    showLoading(category);
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
              participantIsAdmin:
                nextIsAdmin || state.currentUser?.isAdmin || false,
              participantSubView: 'list',
              selectedParticipantClassroom: 'all',
              showPastLessons: false,
              participantHasPastLessonsLoaded: includeHistory,
              recordsToShow: CONSTANTS.UI.HISTORY_INITIAL_RECORDS,
              isDataFresh: true,
            }
          : {
              view: 'participants',
              participantLessons: response.data.lessons,
              participantReservationsMap: response.data.reservationsMap || {},
              participantIsAdmin:
                nextIsAdmin || state.currentUser?.isAdmin || false,
              participantSubView: 'list',
              selectedParticipantClassroom: 'all',
              showPastLessons: false,
              participantHasPastLessonsLoaded: includeHistory,
            };

        // 初期表示時は未来のレッスンのみ取得するため、すべて展開状態にする
        // 過去のレッスンはデフォルトで閉じる（showPastLessonsフラグで制御）
        if (!payload.showPastLessons) {
          // すべてのレッスンIDを展開済みリストに追加
          const allLessonIds = response.data.lessons.map(
            (/** @type {import('../../types/core/lesson').LessonCore} */ l) =>
              l.lessonId,
          );
          localExpandedLessonIds = allLessonIds; // 直接更新
        } else {
          // 過去のレッスンを表示する場合は全て閉じる
          localExpandedLessonIds = []; // 直接更新
        }

        participantHandlersStateManager.dispatch({
          type: baseAppState ? 'SET_STATE' : 'UPDATE_STATE',
          payload,
        });

        if (response.data.reservationsMap) {
          console.log(
            `💾 予約データをstateManagerに保存: ${Object.keys(response.data.reservationsMap).length}レッスン分`,
          );
        }

        if (category) hideLoading();
        render();
      } else {
        if (category) hideLoading();
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
        if (category) hideLoading();
        showInfo('通信エラーが発生しました', 'エラー');
      },
    )
    .getLessonsForParticipantsView(
      studentId,
      false,
      true,
      state.currentUser?.phone || '',
    ); // 未来のみ先読み。過去はタブ切替で遅延取得
}

// ... (existing code) ...

/**
 * 参加者リストビューのデータ更新（手動リフレッシュ）
 */
function refreshParticipantView() {
  // キャッシュをクリアして再ロード
  // 'dataFetch'のローディングメッセージを表示させる
  loadParticipantView(true, 'dataFetch');
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
 * 生徒選択ハンドラ（モーダル表示）
 * @param {string} targetStudentId - 表示対象の生徒ID
 * @param {string} [lessonId] - レッスンID（プリロードデータ検索用）
 */
function selectParticipantStudent(targetStudentId, lessonId) {
  if (!targetStudentId) return;

  console.log('👤 生徒選択:', targetStudentId, lessonId);

  const state = participantHandlersStateManager.getState();
  const requestingStudentId = state.currentUser?.studentId;

  if (!requestingStudentId) {
    showInfo('ユーザー情報が見つかりません', 'エラー');
    return;
  }

  // 1. プリロードデータから予約履歴を生成
  if (state.participantReservationsMap && state.participantLessons) {
    console.log(`✅ プリロードデータから予約履歴を生成: ${targetStudentId}`);

    /**
     * @typedef {object} ReservationHistoryItem
     * @property {string} date
     * @property {string} classroom
     * @property {string} venue
     * @property {string} startTime
     * @property {string} endTime
     * @property {string} status
     * @property {string} workInProgress
     * @property {Date} _dateObj
     */
    /** @type {ReservationHistoryItem[]} */
    const reservationHistory = [];
    /** @type {Record<string, import('../../types/core/lesson').LessonCore>} */
    const lessonsMap = {};

    // レッスン情報をマップ化
    state.participantLessons.forEach(lesson => {
      lessonsMap[lesson.lessonId] = lesson;
    });

    // 全レッスンの予約データから該当生徒の予約を検索し、基本情報を取得
    const reservationsMap = state.participantReservationsMap;
    /** @type {import('../../types/core/reservation').ReservationCore | null} */
    let firstFoundReservation = null;
    Object.keys(reservationsMap).forEach(lessonId => {
      const lessonReservations = reservationsMap[lessonId];
      const studentReservation = lessonReservations.find(
        (
          /** @type {import('../../types/core/reservation').ReservationCore} */ r,
        ) => r.studentId === targetStudentId,
      );

      if (studentReservation) {
        if (!firstFoundReservation) {
          firstFoundReservation = studentReservation;
        }
        const lesson = lessonsMap[lessonId];
        // dateが文字列でない場合は空文字列にフォールバック
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
          workInProgress: studentReservation.workInProgress || '',
          _dateObj: new Date(dateStr),
        });
      }
    });

    // 日付順にソート（新しい順）
    reservationHistory.sort(
      (a, b) => b._dateObj.getTime() - a._dateObj.getTime(),
    );

    // 内部フィールドを削除
    const cleanedHistory = reservationHistory.map(item => {
      const { _dateObj, ...rest } = item;
      return rest;
    });

    // 基本情報を取得（指定されたlessonIdを優先し、なければ最初に見つかった予約データから）
    let targetReservation = null;
    if (lessonId && state.participantReservationsMap[lessonId]) {
      targetReservation = state.participantReservationsMap[lessonId].find(
        (
          /** @type {import('../../types/core/reservation').ReservationCore} */ r,
        ) => r.studentId === targetStudentId,
      );
    }
    if (!targetReservation) {
      targetReservation = firstFoundReservation;
    }

    if (targetReservation) {
      // 予約履歴を追加
      const studentData = {
        ...targetReservation,
        reservationHistory: cleanedHistory,
      };
      showStudentModal(studentData, state.participantIsAdmin || false);
      return;
    }
  }

  // プリロードデータがない場合はAPIコール
  // ローディング表示
  showLoading('dataFetch');

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
      // @ts-ignore custom property
      maxWidth: '800px',
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

  const state = participantHandlersStateManager.getState();
  const alreadyLoaded = state.participantHasPastLessonsLoaded || false;

  if (showPast && !alreadyLoaded) {
    const studentId = state.currentUser?.studentId;
    if (!studentId) {
      console.error('❌ studentIdが見つかりません');
      return;
    }

    showLoading('dataFetch');
    google.script.run
      .withSuccessHandler(function (response) {
        hideLoading();
        if (!response.success) {
          showInfo(
            response.message || '過去のレッスン取得に失敗しました',
            'エラー',
          );
          return;
        }

        const nextIsAdmin =
          Object.prototype.hasOwnProperty.call(response.data, 'isAdmin') &&
          response.data.isAdmin !== undefined
            ? response.data.isAdmin
            : state.participantIsAdmin;

        // 過去のレッスンを表示する場合は全て閉じる
        localExpandedLessonIds = []; // 直接更新

        participantHandlersStateManager.dispatch({
          type: 'UPDATE_STATE',
          payload: {
            view: 'participants',
            participantLessons: response.data.lessons,
            participantReservationsMap: response.data.reservationsMap || {},
            participantIsAdmin:
              nextIsAdmin || state.currentUser?.isAdmin || false,
            participantSubView: 'list',
            selectedParticipantClassroom:
              state.selectedParticipantClassroom || 'all',
            showPastLessons: true,
            participantHasPastLessonsLoaded: true,
          },
        });
        render();
      })
      .withFailureHandler(
        /** @param {Error} error */
        function (error) {
          hideLoading();
          console.error('❌ 過去レッスン取得失敗:', error);
          showInfo('通信エラーが発生しました', 'エラー');
        },
      )
      .getLessonsForParticipantsView(
        studentId,
        true,
        true,
        state.currentUser?.phone || '',
      );
    return;
  }

  // タブ切り替え時はアコーディオンを閉じる
  localExpandedLessonIds = []; // 直接更新

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
  refreshParticipantView,
  goToParticipantsView: () => {
    // データはloadParticipantViewで取得されるので、ここではビューの初期化を呼び出すだけ
    loadParticipantView(false); // 強制再読み込みはしない（未来分のみ先読み）
  },
  toggleParticipantLessonAccordion,
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
};
