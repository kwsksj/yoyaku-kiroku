/**
 * =================================================================
 * ファイル概要
 * -----------------------------------------------------------------
 * 名称: 15_WebApp_Participants_Handlers.js
 * 目的: 参加者リストWebAppのイベントハンドラ
 * 主な責務:
 *   - ユーザーインタラクションの処理
 *   - ボタンクリックイベントの処理
 *   - ページ遷移のトリガー
 * =================================================================
 */

/**
 * イベントハンドラオブジェクト
 */
window.ParticipantsHandlers = {
  /**
   * レッスンクリック時の処理
   * @param {string} lessonId - レッスンID
   */
  onLessonClick(lessonId) {
    if (!lessonId) return;

    console.log('レッスンクリック:', lessonId);

    // 予約情報を読み込む
    ParticipantsApp.loadReservationsForLesson(lessonId);
  },

  /**
   * 生徒クリック時の処理
   * @param {string} studentId - 生徒ID
   */
  onStudentClick(studentId) {
    if (!studentId) return;

    console.log('生徒クリック:', studentId);

    // 生徒詳細を読み込む
    ParticipantsApp.loadStudentDetails(studentId);
  },

  /**
   * レッスン一覧に戻るボタンクリック時の処理
   */
  onBackToListClick() {
    console.log('レッスン一覧に戻る');

    // レッスン一覧画面を表示
    ParticipantsApp.showLessonListView();
  },

  /**
   * 参加者リストに戻るボタンクリック時の処理
   */
  onBackToReservationsClick() {
    console.log('参加者リストに戻る');

    // 参加者リスト画面を表示
    ParticipantsApp.showReservationsView();
  },
};
