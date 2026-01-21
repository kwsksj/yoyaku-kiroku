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

/** @type {SimpleStateManager} */
const participantHandlersStateManager = appWindow.stateManager;

// 生徒詳細は participantAllStudents でプリロードされるため、個別キャッシュは不要になりました

/**
 * 参加者リストビュー初期化
 * ログイン成功後、管理者の場合に呼ばれる
 *
 * @param {boolean} forceReload - 強制的に再取得する場合はtrue
 * @param {string|boolean} loadingCategory - ローディングバリエーション（'participants' | 'dataFetch' 等）。falseの場合は非表示。
 * @param {Partial<UIState> | null} baseAppState - 初期状態
 * @param {boolean} _includeHistory - 過去の履歴も含めるか（現在は常にtrueで取得するため未使用）
 */
function loadParticipantView(
  forceReload = false,
  loadingCategory = 'participants',
  baseAppState = /** @type {Partial<UIState> | null} */ (null),
  _includeHistory = false,
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
  // 重要: よやくデータ（reservationsMap）も必要なのでチェック
  if (
    !forceReload &&
    state.participantLessons &&
    state.participantLessons.length > 0 &&
    state.participantReservationsMap &&
    Object.keys(state.participantReservationsMap).length > 0
  ) {
    debugLog('✅ キャッシュ済みデータを使用 - APIコールをスキップ');
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
    // キャッシュ使用時もバックグラウンドで更新確認（Stale-while-revalidate）
    fetchParticipantDataBackground(studentId, 'background', baseAppState);
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
 */
function fetchParticipantDataBackground(
  studentId,
  loadingCategory,
  baseAppState,
  isManualRefresh = false,
) {
  const state = participantHandlersStateManager.getState();

  google.script.run
    .withSuccessHandler(function (response) {
      debugLog('✅ レッスン一覧+よやくデータ取得成功:', response);

      if (response.success) {
        const nextIsAdmin =
          Object.prototype.hasOwnProperty.call(response.data, 'isAdmin') &&
          response.data.isAdmin !== undefined
            ? response.data.isAdmin
            : state.participantIsAdmin;

        // データの変化を確認
        const currentLessonsJson = JSON.stringify(
          state.participantLessons || [],
        );
        const newLessonsJson = JSON.stringify(response.data.lessons || []);
        // よやくデータの比較
        const currentReservationsJson = JSON.stringify(
          state.participantReservationsMap || {},
        );
        const newReservationsJson = JSON.stringify(
          response.data.reservationsMap || {},
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
              participantLessons: response.data.lessons,
              participantReservationsMap: response.data.reservationsMap || {},
              participantIsAdmin:
                nextIsAdmin || state.currentUser?.isAdmin || false,
              participantSubView: 'list',
              selectedParticipantClassroom: 'all',
              showPastLessons: false,
              participantHasPastLessonsLoaded: true,
              recordsToShow: CONSTANTS.UI.HISTORY_INITIAL_RECORDS,
              isDataFresh: true,
              participantAllStudents: response.data.allStudents || {},
              dataFetchedAt: now,
            }
          : {
              view: 'participants',
              participantLessons: response.data.lessons,
              participantReservationsMap: response.data.reservationsMap || {},
              participantIsAdmin:
                nextIsAdmin || state.currentUser?.isAdmin || false,
              participantSubView: 'list', // Duplicate removed below
              // 既存の状態を維持したい場合はここを調整するが、
              // 基本的にサーバー同期時は最新データで上書きが安全
              // ただし participantSubView などUI状態はリセットしたくない場合もある
              // 今回は view: 'participants' を指定しているのでリセット挙動に近い
              // participantSubView: state.participantSubView || 'list', // Duplicate removed
              selectedParticipantClassroom:
                state.selectedParticipantClassroom || 'all',
              showPastLessons: state.showPastLessons || false,
              participantHasPastLessonsLoaded: true,
              participantAllStudents: response.data.allStudents || {},
              dataFetchedAt: now,
            };

        // ローカルアコーディオン状態の更新
        const allLessonIds = response.data.lessons.map(
          (/** @type {import('../../types/core/lesson').LessonCore} */ l) =>
            l.lessonId,
        );
        localExpandedLessonIds = allLessonIds;

        participantHandlersStateManager.dispatch({
          type: baseAppState ? 'SET_STATE' : 'UPDATE_STATE',
          payload,
        });

        if (response.data.reservationsMap) {
          debugLog(
            `💾 よやくデータをstateManagerに保存: ${Object.keys(response.data.reservationsMap).length}レッスン分`,
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
      true,
      true,
      state.currentUser?.phone || '',
    );
}

/**
 * 参加者ビューとログビューのデータを同時に更新（バックグラウンド）
 * ローディング画面は表示せず、ヘッダーのアイコンをスピンさせる
 * 変更がない場合は枠外クリックで閉じる軽量モーダルを表示
 */
function refreshAllAdminData() {
  const state = participantHandlersStateManager.getState();
  const studentId = state.currentUser?.studentId;

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

    // 参加者データの差分チェック
    // ※ JSON.stringifyはオブジェクトのプロパティ順序に依存するため、
    //    replacer関数を使ってキーをソートしてから比較する
    /**
     * オブジェクトのキーをソートしてJSON文字列化
     * @param {any} obj
     * @returns {string}
     */
    const stableStringify = obj => {
      return JSON.stringify(obj, (_key, value) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          return Object.keys(value)
            .sort()
            .reduce((sorted, k) => {
              sorted[k] = value[k];
              return sorted;
            }, /** @type {Record<string, any>} */ ({}));
        }
        return value;
      });
    };

    if (participantResult?.success) {
      const currentLessonsJson = stableStringify(
        currentState.participantLessons || [],
      );
      const newLessonsJson = stableStringify(
        participantResult.data.lessons || [],
      );
      const currentReservationsJson = stableStringify(
        currentState.participantReservationsMap || {},
      );
      const newReservationsJson = stableStringify(
        participantResult.data.reservationsMap || {},
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

    // 現在時刻を取得日時として保存
    const now = new Date().toISOString();

    // stateを更新
    /** @type {Partial<UIState>} */
    const updatePayload = {
      adminLogsRefreshing: false,
      participantDataRefreshing: false,
      dataFetchedAt: now,
    };

    if (hasParticipantChanges && participantResult?.success) {
      updatePayload.participantLessons = participantResult.data.lessons;
      updatePayload.participantReservationsMap =
        participantResult.data.reservationsMap || {};
      updatePayload['participantAllStudents'] =
        participantResult.data.allStudents || {};
      updatePayload.participantHasPastLessonsLoaded = true;

      // アコーディオン状態も更新
      const allLessonIds = participantResult.data.lessons.map(
        (/** @type {import('../../types/core/lesson').LessonCore} */ l) =>
          l.lessonId,
      );
      localExpandedLessonIds = allLessonIds;
    }

    if (hasLogChanges && logResult?.success) {
      updatePayload['adminLogs'] = logResult.data || [];
    }

    participantHandlersStateManager.dispatch({
      type: 'UPDATE_STATE',
      payload: updatePayload,
    });

    // 変更有無に応じてメッセージ表示
    if (hasParticipantChanges || hasLogChanges) {
      // 変更あり: サイレントに再描画
      render();
    } else {
      // 変更なし: 軽量な通知（枠外クリックで閉じる）
      render();
      // renderはrequestAnimationFrameを使用しているため、DOM更新後にモーダルを表示
      setTimeout(() => {
        if (
          appWindow.ModalManager &&
          typeof appWindow.ModalManager.showInfoDismissable === 'function'
        ) {
          appWindow.ModalManager.showInfoDismissable(
            '新しいデータはありません。\n最新の状態です。',
            '更新完了',
            3000,
          );
        } else {
          showInfo('新しいデータはありません。最新の状態です。', '更新完了');
        }
      }, 100);
    }
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
      true,
      true,
      state.currentUser?.phone || '',
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
    .getRecentLogs(30);
}

/**
 * 参加者リストビューのデータ更新（統合リフレッシュ関数に委譲）
 */
function refreshParticipantView() {
  refreshAllAdminData();
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

        // 過去のレッスンを表示する場合も全て開く
        const allLessonIds = response.data.lessons.map(
          (/** @type {import('../../types/core/lesson').LessonCore} */ l) =>
            l.lessonId,
        );
        localExpandedLessonIds = allLessonIds; // 直接更新

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
            participantAllStudents: response.data.allStudents || {},
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
  goToParticipantsView: () => loadParticipantView(),
  refreshParticipantView,
  markAllLogsAsViewed: () => {
    const lastViewedKey = 'YOYAKU_KIROKU_ADMIN_LOG_LAST_VIEWED';
    localStorage.setItem(lastViewedKey, new Date().toISOString());
    render();
    showInfo('すべてのログを既読にしました', '完了');
  },
  refreshLogView: () => {
    // ログ更新ボタンハンドラ - 統合リフレッシュ関数に委譲
    refreshAllAdminData();
  },
  goToLogView: () => {
    // ログビューに遷移
    const state = participantHandlersStateManager.getState();
    const cachedLogs = state['adminLogs'];
    const hasCache = cachedLogs && cachedLogs.length > 0;

    // キャッシュがあれば即表示、なければロード画面
    participantHandlersStateManager.dispatch({
      type: 'SET_STATE',
      payload: {
        view: 'adminLog',
        adminLogsLoading: !hasCache,
        adminLogsRefreshing: hasCache, // キャッシュがある場合は更新モード
      },
    });
    render();

    // バックグラウンドで最新を取得（キャッシュがあっても更新確認）
    google.script.run
      .withSuccessHandler(
        /** @param {ApiResponseGeneric<any[]>} response */ response => {
          if (response.success) {
            participantHandlersStateManager.dispatch({
              type: 'UPDATE_STATE',
              payload: {
                adminLogs: response.data || [],
                adminLogsLoading: false,
                adminLogsRefreshing: false,
                dataFetchedAt: new Date().toISOString(),
              },
            });
            // キャッシュがあった場合、サイレントに更新される
          } else {
            // エラー時
            participantHandlersStateManager.dispatch({
              type: 'UPDATE_STATE',
              payload: {
                adminLogsLoading: false,
                adminLogsRefreshing: false,
              },
            });
            // キャッシュがない場合のみエラー通知
            if (!hasCache) {
              showInfo(response.message || 'ログ取得に失敗しました', 'エラー');
            }
          }
          render();
        },
      )
      .withFailureHandler(
        /** @param {Error} error */ error => {
          console.error('❌ ログ取得失敗:', error);
          participantHandlersStateManager.dispatch({
            type: 'UPDATE_STATE',
            payload: {
              adminLogsLoading: false,
              adminLogsRefreshing: false,
            },
          });
          if (!hasCache) {
            showInfo('通信エラーが発生しました', 'エラー');
          }
          render();
        },
      )
      .getRecentLogs(30);
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
};
