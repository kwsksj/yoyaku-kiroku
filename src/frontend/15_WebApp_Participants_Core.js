/**
 * =================================================================
 * ファイル概要
 * -----------------------------------------------------------------
 * 名称: 15_WebApp_Participants_Core.js
 * 目的: 参加者リストWebAppの初期化とページ遷移制御
 * 主な責務:
 *   - アプリケーションの初期化
 *   - ページ状態管理（レッスンリスト / 生徒詳細）
 *   - バックエンドAPI呼び出し
 *   - エラーハンドリング
 * =================================================================
 */

// =================================================================
// グローバル状態管理とアプリケーションロジック
// =================================================================

(function () {
  /**
   * アプリケーション状態（内部用）
   * @type {{
   *   currentView: 'list' | 'detail',
   *   studentId: string | null,
   *   isAdmin: boolean,
   *   lessons: any[],
   *   selectedLesson: any | null,
   *   reservations: any[],
   *   studentDetails: any | null,
   *   loading: boolean
   * }}
   */
  const appState = {
    currentView: 'list',
    studentId: null,
    isAdmin: false,
    lessons: [],
    selectedLesson: null,
    reservations: [],
    studentDetails: null,
    loading: false,
  };

  // =================================================================
  // 初期化
  // =================================================================

  /**
   * アプリケーションの初期化
   */
  function initParticipantsApp() {
    console.log('参加者リストWebApp初期化開始');

    // URLパラメータから生徒IDを取得
    const urlParams = new URLSearchParams(window.location.search);
    appState.studentId = urlParams.get('studentId');

    if (!appState.studentId) {
      showError('生徒IDが指定されていません');
      return;
    }

    // レッスン一覧を取得
    loadLessons();
  }

  // =================================================================
  // データ取得
  // =================================================================

  /**
   * レッスン一覧を取得
   */
  function loadLessons() {
    setLoading(true, 'レッスン一覧を読み込み中...');

    google.script.run
      .withSuccessHandler(handleLessonsLoaded)
      .withFailureHandler(handleApiError)
      .getLessonsForParticipantsView(appState.studentId, true);
  }

  /**
   * レッスン一覧取得成功時のハンドラ
   * @param {any} response - APIレスポンス
   */
  function handleLessonsLoaded(response) {
    setLoading(false);

    if (!response || !response.success) {
      showError(response?.message || 'レッスン一覧の取得に失敗しました');
      return;
    }

    appState.lessons = response.data?.lessons || [];

    // レッスンリスト画面を表示
    showLessonListView();
  }

  /**
   * 特定レッスンの予約情報を取得
   * @param {string} lessonId - レッスンID
   */
  function loadReservationsForLesson(lessonId) {
    setLoading(true, '参加者情報を読み込み中...');

    google.script.run
      .withSuccessHandler(handleReservationsLoaded)
      .withFailureHandler(handleApiError)
      .getReservationsForLesson(lessonId, appState.studentId);
  }

  /**
   * 予約情報取得成功時のハンドラ
   * @param {any} response - APIレスポンス
   */
  function handleReservationsLoaded(response) {
    setLoading(false);

    if (!response || !response.success) {
      showError(response?.message || '参加者情報の取得に失敗しました');
      return;
    }

    appState.selectedLesson = response.data?.lesson || null;
    appState.reservations = response.data?.reservations || [];

    // 参加者リストを表示
    showReservationsView();
  }

  /**
   * 生徒詳細情報を取得
   * @param {string} targetStudentId - 表示対象の生徒ID
   */
  function loadStudentDetails(targetStudentId) {
    setLoading(true, '生徒情報を読み込み中...');

    google.script.run
      .withSuccessHandler(handleStudentDetailsLoaded)
      .withFailureHandler(handleApiError)
      .getStudentDetailsForParticipantsView(
        targetStudentId,
        appState.studentId,
      );
  }

  /**
   * 生徒詳細情報取得成功時のハンドラ
   * @param {any} response - APIレスポンス
   */
  function handleStudentDetailsLoaded(response) {
    setLoading(false);

    if (!response || !response.success) {
      showError(response?.message || '生徒情報の取得に失敗しました');
      return;
    }

    appState.studentDetails = response.data?.student || null;
    appState.isAdmin = response.data?.isAdmin || false;

    // 生徒詳細画面を表示
    showStudentDetailView();
  }

  // =================================================================
  // ビュー表示
  // =================================================================

  /**
   * レッスン一覧ビューを表示
   */
  function showLessonListView() {
    appState.currentView = 'list';
    appState.selectedLesson = null;
    appState.reservations = [];

    const container = document.getElementById('view-container');
    if (!container) return;

    container.innerHTML = ParticipantsViews.renderLessonList(appState.lessons);
  }

  /**
   * 予約一覧ビューを表示
   */
  function showReservationsView() {
    const container = document.getElementById('view-container');
    if (!container) return;

    container.innerHTML = ParticipantsViews.renderReservationsList(
      appState.selectedLesson,
      appState.reservations,
    );
  }

  /**
   * 生徒詳細ビューを表示
   */
  function showStudentDetailView() {
    appState.currentView = 'detail';

    const container = document.getElementById('view-container');
    if (!container) return;

    container.innerHTML = ParticipantsViews.renderStudentDetail(
      appState.studentDetails,
      appState.isAdmin,
    );
  }

  // =================================================================
  // ユーティリティ
  // =================================================================

  /**
   * ローディング状態を設定
   * @param {boolean} loading - ローディング中かどうか
   * @param {string} message - 表示メッセージ
   */
  function setLoading(loading, message = '読み込み中...') {
    appState.loading = loading;

    const loadingEl = document.getElementById('loading');
    const loadingMessageEl = document.getElementById('loading-message');

    if (loadingEl) {
      if (loading) {
        loadingEl.classList.remove('hidden');
        loadingEl.classList.add('active');
      } else {
        loadingEl.classList.remove('active');
        setTimeout(() => {
          loadingEl.classList.add('hidden');
        }, 300);
      }
    }

    if (loadingMessageEl) {
      loadingMessageEl.textContent = message;
    }
  }

  /**
   * エラーメッセージを表示
   * @param {string} message - エラーメッセージ
   */
  function showError(message) {
    setLoading(false);

    const container = document.getElementById('view-container');
    if (!container) return;

    container.innerHTML = `
    <div class="${DesignConfig.layout.container}">
      <div class="bg-ui-error-bg text-ui-error-text border-2 border-ui-error-border rounded-lg p-4 text-center">
        <p class="font-bold mb-2">エラーが発生しました</p>
        <p>${escapeHTML(message)}</p>
      </div>
    </div>
  `;
  }

  /**
   * API エラーハンドラ
   * @param {Error} error - エラーオブジェクト
   */
  function handleApiError(error) {
    console.error('API Error:', error);
    showError(error?.message || '通信エラーが発生しました');
  }

  // =================================================================
  // グローバルエクスポート
  // =================================================================

  window.ParticipantsApp = {
    init: initParticipantsApp,
    loadLessons,
    loadReservationsForLesson,
    loadStudentDetails,
    showLessonListView,
    showReservationsView,
    showStudentDetailView,
    getState: () => appState,
  };

  // =================================================================
  // 自動初期化
  // =================================================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initParticipantsApp);
  } else {
    initParticipantsApp();
  }
})();
