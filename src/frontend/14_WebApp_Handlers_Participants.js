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

  // バックエンドからレッスン一覧を取得
  google.script.run
    .withSuccessHandler(function (response) {
      console.log('✅ レッスン一覧取得成功:', response);

      if (response.success) {
        // stateManagerに保存
        participantsHandlersStateManager.dispatch({
          type: 'UPDATE_STATE',
          payload: {
            participantsLessons: response.data.lessons,
            participantsIsAdmin: response.data.isAdmin,
            participantsSubView: 'list',
          },
        });

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
    .getLessonsForParticipantsView(studentId, true);
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

  showLoading('participants');

  // バックエンドから予約情報を取得
  google.script.run
    .withSuccessHandler(function (response) {
      console.log('✅ 予約情報取得成功:', response);

      if (response.success) {
        // stateManagerに保存
        participantsHandlersStateManager.dispatch({
          type: 'UPDATE_STATE',
          payload: {
            participantsSelectedLesson: selectedLesson,
            participantsReservations: response.data.reservations,
            participantsSubView: 'reservations',
          },
        });

        hideLoading();
        render();
      } else {
        hideLoading();
        showInfo(response.message || '予約情報の取得に失敗しました', 'エラー');
      }
    })
    .withFailureHandler(
      /** @param {Error} error */
      function (error) {
        console.error('❌ 予約情報取得失敗:', error);
        hideLoading();
        showInfo('通信エラーが発生しました', 'エラー');
      },
    )
    .getReservationsForLesson(lessonId, studentId);
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

  showLoading('participants');

  // バックエンドから生徒詳細を取得
  google.script.run
    .withSuccessHandler(function (response) {
      console.log('✅ 生徒詳細取得成功:', response);

      if (response.success) {
        // stateManagerに保存
        participantsHandlersStateManager.dispatch({
          type: 'UPDATE_STATE',
          payload: {
            participantsSelectedStudent: response.data.student,
            participantsSubView: 'studentDetail',
          },
        });

        hideLoading();
        render();
      } else {
        hideLoading();
        showInfo(response.message || '生徒情報の取得に失敗しました', 'エラー');
      }
    })
    .withFailureHandler(
      /** @param {Error} error */
      function (error) {
        console.error('❌ 生徒詳細取得失敗:', error);
        hideLoading();
        showInfo('通信エラーが発生しました', 'エラー');
      },
    )
    .getStudentDetailsForParticipantsView(targetStudentId, requestingStudentId);
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
