/**
 * =================================================================
 * ファイル概要
 * -----------------------------------------------------------------
 * 名称: 14_WebApp_Handlers_Reservation.js
 * 目的: よやく作成・編集・キャンセルなどよやく領域の操作を管理する
 * 主な責務:
 *   - よやくフォーム操作やモーダル表示の制御
 *   - サーバーAPI呼び出しとstateManager更新の調整
 *   - 事前取得データのキャッシュ活用とUIへの反映
 * AI向けメモ:
 *   - 新しいよやくフローを追加する際はフォームコンテキストとState更新を一貫させ、このファイル内で副作用を完結させる
 * =================================================================
 */

// ================================================================
// UI系モジュール
// ================================================================
import { Components } from './13_WebApp_Components.js';
import { getClassroomSelectionModal } from './13_WebApp_Views_Booking.js';

// ================================================================
// ユーティリティ系モジュール
// ================================================================
import { getScheduleInfoFromCache } from './12_WebApp_Core_Data.js';
import { handleServerError } from './12_WebApp_Core_ErrorHandler.js';
import {
  getParticipantPayloadForAdminView,
  getTimeValue,
  isCurrentUserAdmin,
  refreshParticipantsViewForAdmin,
  updateAppStateFromCache,
  updateParticipantViewCacheFromReservation,
} from './14_WebApp_Handlers_Utils.js';

const reservationStateManager = appWindow.stateManager;

/**
 * 管理者トークンを取得（なりすまし中も考慮）
 * @returns {string}
 */
const getAdminToken = () => {
  const state = reservationStateManager.getState();
  return (
    state.adminImpersonationOriginalUser?.['adminToken'] ||
    state.currentUser?.['adminToken'] ||
    ''
  );
};

/** よやく管理関連のアクションハンドラー群 */
export const reservationActionHandlers = {
  /**
   * よやくをキャンセルします。
   * @param {ActionHandlerData} d - キャンセル対象のよやく情報を含むデータ
   */
  cancel: d => {
    const reservationDate = d.date ? String(d.date) : '';
    const formattedDate = reservationDate ? formatDate(reservationDate) : '';
    const classroomName = d.classroom || '';
    const message = `
        <div class="text-left space-y-4">
          <p class="text-center"><b>${formattedDate}</b><br>${classroomName}<br>このよやくを取り消しますか？</p>
          <div class="pt-4 border-t">
            <label class="block text-sm font-bold mb-2">先生へのメッセージ（任意）</label>
            <textarea id="cancel-message" class="w-full p-2 border-2 border-ui-border rounded" rows="3" placeholder=""></textarea>
          </div>
        </div>
      `;
    showConfirm({
      title: 'よやくの取り消し',
      message: message,
      confirmText: '取り消す',
      cancelText: 'やめる',
      onConfirm: () => {
        // 重複キャンセル防止
        if (
          reservationStateManager.isDataFetchInProgress('reservation-cancel')
        ) {
          debugLog('よやく取り消し処理中のためキャンセルをスキップ');
          return;
        }

        showLoading('cancel');
        // よやく取り消し処理中フラグを設定
        reservationStateManager.setDataFetchProgress(
          'reservation-cancel',
          true,
        );

        const cancelMessageInput = /** @type {HTMLTextAreaElement | null} */ (
          document.getElementById('cancel-message')
        );
        const cancelMessage = cancelMessageInput?.value || '';
        const state = reservationStateManager.getState();
        const currentUser = state.currentUser;
        const currentFormContext = state.currentReservationFormContext;
        if (!currentUser) {
          hideLoading();
          reservationStateManager.setDataFetchProgress(
            'reservation-cancel',
            false,
          );
          return showInfo('ユーザー情報が見つかりません', 'エラー');
        }
        const targetStudentId =
          (isCurrentUserAdmin() &&
            (currentFormContext?.reservationInfo?.studentId || d.studentId)) ||
          d.studentId ||
          currentUser.studentId ||
          '';
        const targetLessonId =
          currentFormContext?.lessonInfo?.lessonId || d.lessonId || '';

        // 管理者トークンを取得
        const adminToken = getAdminToken();

        const p = {
          ...d,
          studentId: targetStudentId,
          cancelMessage: cancelMessage,
          _isByAdmin: isCurrentUserAdmin(),
          _adminToken: adminToken,
        };
        google.script.run['withSuccessHandler']((/** @type {any} */ r) => {
          hideLoading();
          // よやく取り消し処理中フラグをクリア
          reservationStateManager.setDataFetchProgress(
            'reservation-cancel',
            false,
          );

          if (r.success) {
            // 管理者がなりすまし中かどうかを正しく判定
            const state = reservationStateManager.getState();
            const isAdminImpersonating = !!state.adminImpersonationOriginalUser;

            if (isAdminImpersonating) {
              let participantCacheUpdate = null;
              if (currentFormContext && targetLessonId) {
                participantCacheUpdate =
                  updateParticipantViewCacheFromReservation(
                    /** @type {ReservationCore} */ ({
                      ...currentFormContext.reservationInfo,
                      reservationId:
                        currentFormContext.reservationInfo?.reservationId ||
                        d.reservationId ||
                        '',
                      lessonId: targetLessonId,
                      status: CONSTANTS.STATUS.CANCELED,
                    }),
                    'remove',
                  );
              }
              const fallbackPayload = getParticipantPayloadForAdminView(
                r.data ? r.data.lessons : null,
              );

              // なりすましを終了
              reservationStateManager.endImpersonation();

              reservationStateManager.dispatch({
                type: 'SET_STATE',
                payload: {
                  view: 'participants',
                  navigationHistory: [],
                  ...(participantCacheUpdate || fallbackPayload),
                },
              });
              refreshParticipantsViewForAdmin();
              showInfo(r.message || 'よやくをキャンセルしました。');
              return;
            }

            if (r.data) {
              // よやく取り消し後は個人よやくデータのみ更新（講座データは既存のキャッシュを利用）
              const currentState = reservationStateManager.getState();
              const updatedPayload = {
                myReservations: r.data.myReservations || [],
                view: 'dashboard',
                isDataFresh: true,
                // 参加者リストのキャッシュをクリア
                participantLessons: null,
                participantReservationsMap: null,
              };

              // 講座データが提供された場合のみ更新
              if (r.data.lessons && r.data.lessons.length > 0) {
                /** @type {any} */ (updatedPayload).lessons = r.data.lessons;
                reservationStateManager.setDataFetchProgress('lessons', false);
              } else {
                // 講座データが不要な場合は既存データを保持
                /** @type {any} */ (updatedPayload).lessons =
                  currentState.lessons;
              }

              reservationStateManager.dispatch({
                type: 'SET_STATE',
                payload: updatedPayload,
              });
            } else {
              reservationStateManager.dispatch({
                type: 'SET_STATE',
                payload: {
                  view: 'dashboard',
                  isDataFresh: false,
                  // 参加者リストのキャッシュをクリア
                  participantLessons: null,
                  participantReservationsMap: null,
                },
              });
            }
            // キャンセル完了画面を表示（よやく完了や会計完了と同様のUX）
            reservationStateManager.dispatch({
              type: 'SET_STATE',
              payload: {
                view: 'complete',
                completionMessage: r.message || 'よやくをキャンセルしました。',
              },
            });
          } else {
            showInfo(r.message || 'キャンセル処理に失敗しました。', 'エラー');
          }
        })
          .withFailureHandler((/** @type {Error} */ err) => {
            hideLoading();
            // エラー時もよやく取り消し処理中フラグをクリア
            reservationStateManager.setDataFetchProgress(
              'reservation-cancel',
              false,
            );
            handleServerError(err);
          })
          .cancelReservationAndGetLatestData(p);
      },
    });
  },

  /**
   * よやくフォームの内容を元によやくを確定します。
   * state.currentReservationFormContext を使用します。
   */
  confirmBooking: () => {
    // 重複よやく防止
    if (reservationStateManager.isDataFetchInProgress('reservation-booking')) {
      debugLog('よやく処理中のためよやく確定をスキップ');
      return;
    }

    const { currentUser, currentReservationFormContext } =
      reservationStateManager.getState();
    if (!currentReservationFormContext) {
      showInfo('よやくコンテキストが見つかりません。', 'エラー');
      return;
    }
    if (!currentUser) {
      showInfo('ユーザー情報が見つかりません。', 'エラー');
      return;
    }

    const { lessonInfo } = currentReservationFormContext;
    const isFirstTimeBooking =
      reservationStateManager.getState().isFirstTimeBooking;

    const startTime = getTimeValue('res-start-time', null, 'startTime');
    const endTime = getTimeValue('res-end-time', null, 'endTime');

    // けいかく・もくひょうと材料情報を取得
    const wipValue =
      /** @type {HTMLInputElement} */ (document.getElementById('wip-input'))
        ?.value || '';
    const materialInfoValue =
      /** @type {HTMLInputElement} */ (
        document.getElementById('material-input')
      )?.value || '';
    const orderValue =
      /** @type {HTMLInputElement} */ (document.getElementById('order-input'))
        ?.value || '';
    // 材料情報はOrderに追記する（可読性のためif文を使用）
    let combinedOrder = orderValue;
    if (materialInfoValue) {
      const materialPrefix = '【希望材料】';
      if (combinedOrder) {
        // 既存の注文があれば、改行と接頭辞を追加して追記
        combinedOrder += `\n${materialPrefix}${materialInfoValue}`;
      } else {
        // 既存の注文がなければ、接頭辞のみ追加
        combinedOrder = `${materialPrefix}${materialInfoValue}`;
      }
    }

    // 確認モーダルを表示（メッセージ入力付き）
    const formattedDate = formatDate(String(lessonInfo.date));
    const timeDisplay = startTime ? `${startTime}〜${endTime}` : '';
    const confirmMessage = `
      <div class="text-left space-y-4">
        <p class="text-center"><b>${formattedDate}</b><br>${lessonInfo.classroom}<br>${timeDisplay}</p>
        <div class="pt-4 border-t">
          <label class="block text-sm font-bold mb-2">先生へのメッセージ（任意）</label>
          <textarea id="booking-message" class="w-full p-2 border-2 border-ui-border rounded" rows="3" placeholder=""></textarea>
        </div>
      </div>
    `;

    showConfirm({
      title: 'よやくの確認',
      message: confirmMessage,
      confirmText: 'よやくする',
      cancelText: 'やめる',
      onConfirm: () => {
        // メッセージを取得
        const messageInput = /** @type {HTMLTextAreaElement | null} */ (
          document.getElementById('booking-message')
        );
        const messageToTeacher = messageInput?.value || '';

        showLoading('booking');
        // よやく処理中フラグを設定
        reservationStateManager.setDataFetchProgress(
          'reservation-booking',
          true,
        );

        // nextLessonGoal は wip-input から取得（生徒名簿に保存される）
        const nextLessonGoalValue = wipValue;

        // 新形式: 直接プロパティとして送信（ReservationCreateDto形式）
        const p = {
          lessonId: lessonInfo.lessonId, // ★ lessonId を追加
          classroom: lessonInfo.classroom,
          date: lessonInfo.date,
          venue: lessonInfo.venue,
          startTime: startTime,
          endTime: endTime,
          user: currentUser,
          studentId: currentUser.studentId,
          chiselRental:
            /** @type {HTMLInputElement} */ (
              document.getElementById('option-rental')
            )?.checked || false,
          firstLecture:
            /** @type {HTMLInputElement} */ (
              document.getElementById('hidden-first-lecture')
            )?.value === 'true' || isFirstTimeBooking,
          sessionNote: wipValue, // よやくログ用（けいかく・もくひょうのみ）
          nextLessonGoal: nextLessonGoalValue, // 生徒名簿に保存するけいかく・もくひょう
          order: combinedOrder, // 材料情報を含む購入希望
          messageToTeacher: messageToTeacher,
          // 満席判定（LessonCoreから計算）
          isFull:
            typeof lessonInfo.secondSlots !== 'undefined'
              ? (lessonInfo.firstSlots || 0) === 0 &&
                (lessonInfo.secondSlots || 0) === 0
              : (lessonInfo.firstSlots || 0) === 0,
        };

        google.script.run['withSuccessHandler']((/** @type {any} */ r) => {
          hideLoading();
          // よやく処理中フラグをクリア
          reservationStateManager.setDataFetchProgress(
            'reservation-booking',
            false,
          );

          if (r.success) {
            if (r.data) {
              // 新規よやく後は個人よやくデータと必要に応じて講座データを更新
              const currentState = reservationStateManager.getState();

              // currentUserのnextLessonGoalを更新（ダッシュボードで最新表示）
              const updatedCurrentUser = currentState.currentUser
                ? {
                    ...currentState.currentUser,
                    nextLessonGoal: nextLessonGoalValue,
                  }
                : null;

              const updatedPayload = {
                myReservations: r.data.myReservations || [],
                view: 'complete',
                completionMessage: r.message,
                selectedClassroom: lessonInfo.classroom,
                isDataFresh: true,
                currentUser: updatedCurrentUser,
                // 参加者リストのキャッシュをクリア
                participantLessons: null,
                participantReservationsMap: null,
              };

              // 講座データの選択的更新
              if (r.data.lessons && r.data.lessons.length > 0) {
                /** @type {any} */ (updatedPayload).lessons = r.data.lessons;
                reservationStateManager.setDataFetchProgress('lessons', false);
              } else if (
                currentState.lessons &&
                currentState.lessons.length > 0
              ) {
                // サーバーが講座データを返さない場合は既存データを保持
                /** @type {any} */ (updatedPayload).lessons =
                  currentState.lessons;
              }

              reservationStateManager.dispatch({
                type: 'SET_STATE',
                payload: updatedPayload,
              });
            } else {
              reservationStateManager.dispatch({
                type: 'SET_STATE',
                payload: {
                  view: 'complete',
                  completionMessage: r.message,
                  selectedClassroom: lessonInfo.classroom,
                  isDataFresh: false,
                  // 参加者リストのキャッシュをクリア
                  participantLessons: null,
                  participantReservationsMap: null,
                },
              });
            }
          } else {
            showInfo(r.message || 'よやくに失敗しました。', 'エラー');
          }
        })
          .withFailureHandler((/** @type {Error} */ error) => {
            hideLoading();
            // エラー時もよやく処理中フラグをクリア
            reservationStateManager.setDataFetchProgress(
              'reservation-booking',
              false,
            );
            handleServerError(error);
          })
          .makeReservationAndGetLatestData(p);
      },
    });
  },

  /**
   * よやく編集画面に遷移します。
   * @param {ActionHandlerData} d - 編集対象のよやく情報を含むデータ
   */
  goToEditReservation: d => {
    const state = reservationStateManager.getState();

    // 1. よやくデータを取得（キャッシュ済み）
    const reservation = state.myReservations.find(
      (/** @type {ReservationCore} */ booking) =>
        booking.reservationId === d.reservationId &&
        booking.classroom === d.classroom,
    );

    if (!reservation) {
      showInfo('よやく情報が見つかりませんでした。', 'エラー');
      return;
    }

    // 2. 講座データを取得（キャッシュ済み）
    const lesson =
      state.lessons && Array.isArray(state.lessons)
        ? state.lessons.find(
            (/** @type {LessonCore} */ l) =>
              l.date === String(reservation.date) &&
              l.classroom === reservation.classroom,
          )
        : null;

    if (lesson) {
      // 3. lessonsデータがある場合：即座に画面遷移（ロード不要）
      const formContext = {
        lessonInfo: lesson,
        reservationInfo: reservation,
      };

      reservationStateManager.dispatch({
        type: 'NAVIGATE',
        payload: {
          to: 'reservationForm',
          context: {
            currentReservationFormContext: formContext,
          },
        },
      });
    } else {
      // 4. フォールバック：lessonsデータがない場合のみ従来処理
      showLoading('booking');
      getScheduleInfoFromCache(
        String(reservation.date),
        reservation.classroom,
      ).then((/** @type {ScheduleInfo | null} */ scheduleInfo) => {
        const lessonInfo = {
          schedule: scheduleInfo || {},
          status: {},
        };

        const formContext = {
          lessonInfo: lessonInfo,
          reservationInfo: reservation,
        };

        reservationStateManager.dispatch({
          type: 'NAVIGATE',
          payload: {
            to: 'reservationForm',
            context: {
              currentReservationFormContext: formContext,
            },
          },
        });

        hideLoading();
      });
    }

    // 管理者操作のなりすましロジック（編集画面遷移時）
    if (isCurrentUserAdmin()) {
      const targetStudentId = reservation.studentId;
      const currentAdminId = state.currentUser?.studentId;

      if (
        targetStudentId &&
        targetStudentId !== currentAdminId &&
        state.currentUser
      ) {
        // 生徒情報を検索（検索済みユーザーリストから）
        const targetUser =
          state.searchedUsers?.find(u => u.studentId === targetStudentId) ||
          /** @type {UserCore} */ ({
            studentId: targetStudentId,
            realName: /** @type {any} */ (reservation)['studentName'] || '生徒', // reservationDataに名前が含まれていると仮定
            nickname: /** @type {any} */ (reservation)['studentName'] || '生徒',
            isAdmin: false,
            email: '',
          });

        if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
          debugLog(
            '🎭 よやく編集のためなりすましを開始します:',
            targetUser.realName,
          );
        }
        reservationStateManager.startImpersonation(targetUser);
      }
    }
  },

  /**
   * よやく情報を更新します。
   * state.currentReservationFormContext を使用します。
   */
  updateReservation: () => {
    // 重複更新防止
    if (reservationStateManager.isDataFetchInProgress('reservation-update')) {
      debugLog('よやく更新処理中のため更新をスキップ');
      return;
    }

    const { currentReservationFormContext, currentUser } =
      reservationStateManager.getState();
    if (!currentReservationFormContext) {
      showInfo('よやくコンテキストが見つかりません。', 'エラー');
      return;
    }
    if (!currentUser) {
      showInfo('ユーザー情報が見つかりません。', 'エラー');
      return;
    }

    const { reservationInfo, lessonInfo } = currentReservationFormContext;
    // よやく編集ではreservationIdは必須
    if (!reservationInfo.reservationId) {
      showInfo('予約IDが見つかりません。', 'エラー');
      return;
    }
    const validReservationInfo = /** @type {ReservationCore} */ (
      reservationInfo
    );
    const startTime = getTimeValue(
      'res-start-time',
      validReservationInfo,
      'startTime',
    );
    const endTime = getTimeValue(
      'res-end-time',
      validReservationInfo,
      'endTime',
    );

    // 管理者の場合は対象の生徒IDを使用、それ以外は自身のID
    const targetStudentId =
      currentUser.isAdmin && validReservationInfo.studentId
        ? validReservationInfo.studentId
        : currentUser.studentId || '';

    // wip-inputの値を取得（nextLessonGoal用）
    const wipInputValue =
      /** @type {HTMLInputElement} */ (document.getElementById('wip-input'))
        ?.value || '';
    const materialInfoValue =
      /** @type {HTMLInputElement} */ (
        document.getElementById('material-input')
      )?.value || '';
    const orderValue =
      /** @type {HTMLInputElement} */ (document.getElementById('order-input'))
        ?.value || '';
    // 材料情報はOrderに追記する（可読性のためif文を使用）
    let combinedOrder = orderValue;
    if (materialInfoValue) {
      const materialPrefix = '【希望材料】';
      if (combinedOrder) {
        // 既存の注文があれば、改行と接頭辞を追加して追記
        combinedOrder += `\n${materialPrefix}${materialInfoValue}`;
      } else {
        // 既存の注文がなければ、接頭辞のみ追加
        combinedOrder = `${materialPrefix}${materialInfoValue}`;
      }
    }

    // チェックボックスの値を事前取得（モーダル内からは取得できない）
    const chiselRentalValue =
      /** @type {HTMLInputElement} */ (document.getElementById('option-rental'))
        ?.checked || false;
    const firstLectureValue =
      /** @type {HTMLInputElement} */ (
        document.getElementById('hidden-first-lecture')
      )?.value === 'true';

    // 確認モーダルを表示（メッセージ入力付き）
    const formattedDate = formatDate(
      String(lessonInfo?.date || reservationInfo.date),
    );
    const classroom = lessonInfo?.classroom || reservationInfo.classroom || '';
    const timeDisplay = startTime ? `${startTime}〜${endTime}` : '';
    const confirmMessage = `
      <div class="text-left space-y-4">
        <p class="text-center"><b>${formattedDate}</b><br>${classroom}<br>${timeDisplay}</p>
        <div class="pt-4 border-t">
          <label class="block text-sm font-bold mb-2">先生へのメッセージ（任意）</label>
          <textarea id="update-message" class="w-full p-2 border-2 border-ui-border rounded" rows="3" placeholder=""></textarea>
        </div>
      </div>
    `;

    showConfirm({
      title: 'よやくの更新',
      message: confirmMessage,
      confirmText: '更新する',
      cancelText: 'やめる',
      onConfirm: () => {
        // メッセージを取得
        const messageInput = /** @type {HTMLTextAreaElement | null} */ (
          document.getElementById('update-message')
        );
        const messageToTeacher = messageInput?.value || '';

        const p = {
          reservationId: validReservationInfo.reservationId,
          classroom: validReservationInfo.classroom,
          studentId: targetStudentId,
          chiselRental: chiselRentalValue,
          firstLecture: firstLectureValue,
          startTime: startTime,
          endTime: endTime,
          sessionNote: wipInputValue, // よやくログ用（けいかく・もくひょうのみ）
          nextLessonGoal: wipInputValue, // 生徒名簿に保存するけいかく・もくひょう
          order: combinedOrder, // 材料情報を含む購入希望
          messageToTeacher: messageToTeacher,
          materialInfo: materialInfoValue,
          _isByAdmin: isCurrentUserAdmin(),
          _adminToken: getAdminToken(),
        };
        showLoading('booking');
        // よやく更新処理中フラグを設定
        reservationStateManager.setDataFetchProgress(
          'reservation-update',
          true,
        );

        google.script.run['withSuccessHandler'](
          (/** @type {BatchDataResponse} */ r) => {
            hideLoading();
            // よやく更新処理中フラグをクリア
            reservationStateManager.setDataFetchProgress(
              'reservation-update',
              false,
            );

            if (r.success) {
              // 管理者がなりすまし中かどうかを正しく判定
              const state = reservationStateManager.getState();
              const isAdminImpersonating =
                !!state.adminImpersonationOriginalUser;

              if (isAdminImpersonating) {
                // 余計な通信を避けるため、サーバーからの戻り値で更新して画面遷移
                let participantCacheUpdate = null;
                if (currentReservationFormContext?.lessonInfo?.lessonId) {
                  participantCacheUpdate =
                    updateParticipantViewCacheFromReservation(
                      /** @type {ReservationCore} */ ({
                        ...currentReservationFormContext.reservationInfo,
                        ...p,
                        lessonId:
                          currentReservationFormContext.lessonInfo?.lessonId,
                      }),
                      'upsert',
                    );
                }
                const fallbackPayload = getParticipantPayloadForAdminView(
                  r.data ? r.data.lessons : null,
                );

                // なりすまし終了
                reservationStateManager.endImpersonation();

                reservationStateManager.dispatch({
                  type: 'SET_STATE',

                  payload: {
                    view: 'participants',

                    navigationHistory: [],

                    ...(participantCacheUpdate || fallbackPayload),
                  },
                });

                refreshParticipantsViewForAdmin();

                showInfo(
                  `<h3 class="font-bold mb-3">更新完了</h3>${r.message || 'よやく内容を更新しました。'} `,
                );

                return;
              }

              if (r.data) {
                // よやく更新後は個人よやくデータを優先的に更新
                const currentState = reservationStateManager.getState();

                // currentUserのnextLessonGoalを更新（ダッシュボードで最新表示）
                const updatedCurrentUser = currentState.currentUser
                  ? {
                      ...currentState.currentUser,
                      nextLessonGoal: wipInputValue,
                    }
                  : null;

                const updatedPayload = {
                  myReservations: r.data.myReservations || [],
                  view: 'dashboard',
                  isDataFresh: true,
                  currentUser: updatedCurrentUser,
                  // 参加者リストのキャッシュをクリア
                  participantLessons: null,
                  participantReservationsMap: null,
                };

                // initialデータがある場合は追加
                if (r.data['initial']) {
                  Object.assign(updatedPayload, r.data['initial']);
                }

                // 講座データの選択的更新
                if (r.data.lessons && r.data.lessons.length > 0) {
                  /** @type {any} */ (updatedPayload).lessons = r.data.lessons;
                  reservationStateManager.setDataFetchProgress(
                    'lessons',
                    false,
                  );
                } else if (
                  currentState.lessons &&
                  currentState.lessons.length > 0
                ) {
                  // 既存の講座データを保持
                  /** @type {any} */ (updatedPayload).lessons =
                    currentState.lessons;
                }

                reservationStateManager.dispatch({
                  type: 'SET_STATE',
                  payload: updatedPayload,
                });
              } else {
                reservationStateManager.dispatch({
                  type: 'SET_STATE',
                  payload: {
                    view: 'dashboard',
                    isDataFresh: false,
                    // 参加者リストのキャッシュをクリア
                    participantLessons: null,
                    participantReservationsMap: null,
                  },
                });
              }
              showInfo(
                `<h3 class="font-bold mb-3">更新完了</h3>${r.message || 'よやく内容を更新しました。'} `,
              );
            } else {
              showInfo(r.message || '更新に失敗しました。', 'エラー');
            }
          },
        )
          .withFailureHandler((/** @type {Error} */ error) => {
            hideLoading();
            // エラー時もよやく更新処理中フラグをクリア
            reservationStateManager.setDataFetchProgress(
              'reservation-update',
              false,
            );

            const handler =
              appWindow.FrontendErrorHandler || FrontendErrorHandler;
            handler.handle(error, 'updateReservation', {
              reservationId: p.reservationId,
              classroom: p.classroom,
            });
            handleServerError(error);
          })
          .updateReservationDetailsAndGetLatestData(/** @type {any} */ (p));
      },
    });
  },

  /** 新規よやくのための教室選択モーダルを表示します */
  showClassroomModal: () => {
    if (CONSTANTS.CLASSROOMS && Object.keys(CONSTANTS.CLASSROOMS).length > 0) {
      const existingModal = document.getElementById(
        'classroom-selection-modal',
      );
      if (existingModal) existingModal.remove();
      const modalHtml = getClassroomSelectionModal();
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      Components.showModal('classroom-selection-modal');
    } else {
      showInfo('教室情報の取得に失敗しました。ホームに戻ります。', 'エラー');
      reservationActionHandlers.goBackToDashboard();
    }
  },

  /** 教室選択モーダルを閉じます */
  closeClassroomModal: () => {
    Components.closeModal('classroom-selection-modal');
  },

  /**
   * 直接よやく画面（にってい いちらん）に遷移します。
   * 教室未選択の状態で表示します。
   */
  goToBookingView: () => {
    debugLog('🏫 goToBookingView: 直接よやく画面に遷移');
    reservationActionHandlers.updateLessonsAndGoToBooking('');
  },

  /**
   * 教室を選択し、よやく枠一覧画面に遷移します。
   * @param {ActionHandlerData} d - 選択した教室情報を含むデータ
   */
  selectClassroom: d => {
    // 教室選択は初回データ取得のため、重複チェックを一時的に無効化
    // if (reservationStateManager.isDataFetchInProgress('lessons')) {
    //   console.log('講座データ取得中のため教室選択をスキップ');
    //   return;
    // }

    const classroomName =
      d?.classroomName || d?.classroom || d?.['classroom-name'];
    if (classroomName) {
      reservationActionHandlers.closeClassroomModal();
      reservationActionHandlers.updateLessonsAndGoToBooking(classroomName);
    } else {
      showInfo(
        'よやく枠の取得に失敗しました。時間をおいて再度お試しください。',
        'エラー',
      );
    }
  },

  /**
   * よやく画面で教室フィルターを切り替えます（ピル型トグル用）。
   * @param {ActionHandlerData} d - 選択した教室情報を含むデータ
   */
  filterBookingClassroom: d => {
    const classroom = d?.classroom || 'all';
    debugLog('🏫 filterBookingClassroom:', classroom);

    // 教室フィルターを変更して再描画
    reservationStateManager.dispatch({
      type: 'SET_STATE',
      payload: {
        selectedClassroom: classroom,
        view: 'bookingLessons',
      },
    });
  },

  /**
   * スロット情報を更新してからよやく枠画面に遷移します。
   * @param {string} classroomName - 対象の教室名
   */
  updateLessonsAndGoToBooking: classroomName => {
    if (reservationStateManager.getState()._dataUpdateInProgress) return;

    // 講座データの初期状態チェック - 初回アクセス時は必ず取得
    const currentState = reservationStateManager.getState();
    const hasValidLessonsData =
      currentState.lessons &&
      Array.isArray(currentState.lessons) &&
      currentState.lessons.length > 0;

    // 講座データが存在し、キャッシュが有効な場合のみ即座に画面遷移
    // 初回アクセス時はhasValidLessonsDataがfalseになるため、この分岐は通らない
    if (hasValidLessonsData) {
      try {
        const needsUpdate = reservationStateManager.needsLessonsUpdate();
        if (!needsUpdate) {
          reservationStateManager.dispatch({
            type: 'SET_STATE',
            payload: {
              selectedClassroom: classroomName,
              view: 'bookingLessons',
              isDataFresh: true,
            },
          });
          return;
        }
      } catch (error) {
        console.warn('needsLessonsUpdate()でエラー発生:', error);
        // エラー発生時は通常の取得処理を続行
      }
    }

    // 初回アクセスまたはデータ更新が必要な場合のみローディング表示とサーバー取得
    showLoading('booking');
    reservationActionHandlers.fetchLatestLessonsData(classroomName);
  },

  /**
   * 最新の講座データを取得します（内部処理）。
   * @param {string} classroomName - 対象の教室名
   */
  fetchLatestLessonsData: classroomName => {
    // 取得中フラグを設定してダブルクリック防止
    reservationStateManager.setDataFetchProgress('lessons', true);

    google.script.run['withSuccessHandler']((/** @type {any} */ response) => {
      hideLoading();
      // 取得完了をマーク
      reservationStateManager.setDataFetchProgress('lessons', false);

      const responseData = response?.data || {};
      const hasLessonsData = Array.isArray(responseData.lessons);
      const latestLessons = hasLessonsData ? responseData.lessons : [];
      const cacheVersions =
        responseData && typeof responseData === 'object'
          ? responseData['cache-versions']
          : null;
      const serverLessonsVersion =
        cacheVersions &&
        typeof cacheVersions === 'object' &&
        typeof cacheVersions.lessonsComposite === 'string'
          ? cacheVersions.lessonsComposite
          : null;

      const currentLessonsVersion =
        reservationStateManager.getState()._lessonsVersion;
      const currentLessonsState = reservationStateManager.getState().lessons;
      if (
        response?.success &&
        serverLessonsVersion &&
        currentLessonsVersion === serverLessonsVersion &&
        currentLessonsState &&
        Array.isArray(currentLessonsState) &&
        currentLessonsState.length > 0
      ) {
        reservationStateManager.dispatch({
          type: 'SET_STATE',
          payload: {
            selectedClassroom: classroomName,
            view: 'bookingLessons',
            isDataFresh: true,
            _lessonsVersion: serverLessonsVersion,
          },
        });
        return;
      }

      if (response?.success && hasLessonsData) {
        // バージョンを更新
        if (serverLessonsVersion) {
          reservationStateManager.updateLessonsVersion(serverLessonsVersion);
        }

        reservationStateManager.dispatch({
          type: 'SET_STATE',
          payload: {
            lessons: latestLessons,
            selectedClassroom: classroomName,
            view: 'bookingLessons',
            isDataFresh: true,
            _lessonsVersion:
              serverLessonsVersion || currentLessonsVersion || null,
          },
        });
      } else {
        showInfo(
          'よやく枠の取得に失敗しました。時間をおいて再度お試しください。',
        );
      }
    })
      .withFailureHandler((/** @type {Error} */ error) => {
        hideLoading();
        // エラー時も取得中フラグをクリア
        reservationStateManager.setDataFetchProgress('lessons', false);
        showInfo(
          'よやく枠の取得に失敗しました。時間をおいて再度お試しください。',
        );
        Logger.log(`fetchLatestLessonsDataエラー: ${error}`);
      })
      .getBatchData(
        ['lessons', 'cache-versions'],
        reservationStateManager.getState().currentUser?.phone || '',
      );
  },

  /**
   * よやく枠を選択し、よやくフォーム画面に遷移します。
   * @param {ActionHandlerData} d - 選択したよやく枠の情報を含むデータ
   */
  bookLesson: d => {
    const currentState = reservationStateManager.getState();
    const lessonId = d.lessonId; // ★ lessonId を使用

    const foundLesson =
      currentState.lessons && Array.isArray(currentState.lessons)
        ? currentState.lessons.find(
            (/** @type {LessonCore} */ lesson) => lesson.lessonId === lessonId,
          )
        : null;
    if (foundLesson) {
      const isFirstTime = reservationStateManager.getState().isFirstTimeBooking;
      const formContext = {
        lessonInfo: foundLesson,
        reservationInfo: {
          firstLecture: isFirstTime,
          chiselRental: false,
        },
      };

      reservationStateManager.dispatch({
        type: 'NAVIGATE',
        payload: {
          to: 'reservationForm',
          context: {
            currentReservationFormContext: formContext,
          },
        },
      });
    } else {
      showInfo('選択したよやく枠が見つかりません。', 'エラー');
    }
  },

  /**
   * 指定された日程のよやくフォーム画面に遷移します。
   * @param {ActionHandlerData} d - 選択した日程の情報 (lessonId) を含むデータ
   */
  goToReservationFormForLesson: d => {
    const currentState = reservationStateManager.getState();
    const lessonId = d.lessonId;

    // 日程変更モードの場合はlessonsから、通常モードはparticipantLessonsから検索
    const lessonsList = currentState['isChangingReservationDate']
      ? currentState.lessons
      : currentState.participantLessons;

    const foundLesson =
      lessonsList && Array.isArray(lessonsList)
        ? lessonsList.find(
            (/** @type {LessonCore} */ lesson) => lesson.lessonId === lessonId,
          )
        : null;

    if (foundLesson) {
      let reservationInfo;

      // 日程変更モードの場合
      if (currentState['isChangingReservationDate']) {
        try {
          const originalReservationJson = sessionStorage.getItem(
            'changingReservation',
          );
          if (originalReservationJson) {
            const originalReservation = JSON.parse(originalReservationJson);
            // 元のよやく情報を使用（日付とlessonIdは新しいものに更新）
            reservationInfo = {
              ...originalReservation,
              date: foundLesson.date,
              lessonId: foundLesson.lessonId,
              classroom: foundLesson.classroom,
              // 予約IDは含めない（新規よやくとして扱う）
              reservationId: undefined,
            };
          }
        } catch (e) {
          console.error('元のよやく情報の読み込みエラー:', e);
        }
      }

      // 通常モード、または日程変更モードで元情報が取得できなかった場合
      if (!reservationInfo) {
        // ユーザーの既存よやくを検索
        const existingReservation = (currentState.myReservations || []).find(
          (/** @type {ReservationCore} */ res) => res.lessonId === lessonId,
        );
        reservationInfo = existingReservation || {
          firstLecture: false,
          chiselRental: false,
        };
      }

      const formContext = {
        lessonInfo: foundLesson,
        reservationInfo: reservationInfo,
        source: currentState['isChangingReservationDate']
          ? 'dateChange'
          : 'participants',
        isChangingReservationDate: currentState['isChangingReservationDate'],
      };

      reservationStateManager.dispatch({
        type: 'NAVIGATE',
        payload: {
          to: 'reservationForm',
          context: {
            currentReservationFormContext: formContext,
            // isChangingReservationDateはformContext.sourceで判定できるのでリセットしない
          },
        },
      });
    } else {
      showInfo('選択した日程が見つかりません。', 'エラー');
    }
  },

  /** ホーム（メイン画面）に遷移（別名） */
  goBackToDashboard: () => reservationActionHandlers.goToDashboard(),

  /** ホーム（メイン画面）に遷移 */
  goToDashboard: () => {
    const state = reservationStateManager.getState();

    // なりすまし中の場合は、なりすましを終了して参加者ビューへ
    if (state.adminImpersonationOriginalUser) {
      reservationStateManager.endImpersonation();
      reservationStateManager.dispatch({
        type: 'SET_STATE',
        payload: { view: 'participants' },
      });
      return;
    }

    // 通常フロー
    if (!state.isDataFresh && !state._dataUpdateInProgress) {
      updateAppStateFromCache('dashboard');
    } else {
      reservationStateManager.dispatch({
        type: 'SET_STATE',
        payload: { view: 'dashboard' },
      });
    }
  },

  /** よやく枠一覧画面に戻ります */
  goBackToBooking: () => {
    const targetClassroom =
      reservationStateManager.getState().currentReservationFormContext
        ?.lessonInfo.classroom ||
      reservationStateManager.getState().selectedClassroom;

    if (!targetClassroom) {
      showInfo('教室情報が見つかりません', 'エラー');
      return;
    }

    // StateManagerのキャッシュ判定を優先
    const currentState = reservationStateManager.getState();
    if (
      !reservationStateManager.needsLessonsUpdate() &&
      currentState.lessons &&
      Array.isArray(currentState.lessons) &&
      currentState.lessons.length > 0
    ) {
      // キャッシュが有効で講座データが存在する場合は即座に画面遷移
      reservationStateManager.dispatch({
        type: 'SET_STATE',
        payload: { view: 'bookingLessons', selectedClassroom: targetClassroom },
      });
    } else if (
      !reservationStateManager.getState().isDataFresh &&
      !reservationStateManager.getState()._dataUpdateInProgress
    ) {
      // データが古い場合のみ更新
      reservationActionHandlers.updateLessonsAndGoToBooking(targetClassroom);
    } else {
      // データが新鮮な場合は画面遷移のみ
      reservationStateManager.dispatch({
        type: 'SET_STATE',
        payload: { view: 'bookingLessons', selectedClassroom: targetClassroom },
      });
    }
  },

  /**
   * 空き通知希望のよやくを確定よやくに変更します。
   * @param {ActionHandlerData} d - 確定対象のよやく情報を含むデータ
   */
  confirmWaitlistedReservation: d => {
    const targetDate = d.date ? String(d.date) : '';
    const formattedDate = targetDate ? formatDate(targetDate) : '';
    const classroomName = d.classroom || '';
    const message = `
        <div class="text-left space-y-4">
          <p class="text-center"><b>${formattedDate}</b><br>${classroomName}<br>空き通知希望を確定よやくに変更しますか？</p>
          <div class="pt-4 border-t">
            <label class="block text-sm font-bold mb-2">先生へのメッセージ（任意）</label>
            <textarea id="confirm-message" class="w-full p-2 border-2 border-ui-border rounded" rows="3" placeholder=""></textarea>
          </div>
        </div>
      `;
    showConfirm({
      title: 'よやく確定',
      message: message,
      confirmText: '確定する',
      cancelText: 'キャンセル',
      onConfirm: () => {
        // 重複確定防止
        if (
          reservationStateManager.isDataFetchInProgress('reservation-confirm')
        ) {
          debugLog('よやく確定処理中のため確定をスキップ');
          return;
        }

        showLoading('booking');
        // よやく確定処理中フラグを設定
        reservationStateManager.setDataFetchProgress(
          'reservation-confirm',
          true,
        );

        const confirmMessageInput = /** @type {HTMLTextAreaElement | null} */ (
          document.getElementById('confirm-message')
        );
        const confirmMessage = confirmMessageInput?.value || '';
        const state = reservationStateManager.getState();
        const currentUser = state.currentUser;
        const adminToken = /** @type {any} */ (currentUser)?.adminToken || '';
        if (!currentUser) {
          hideLoading();
          reservationStateManager.setDataFetchProgress(
            'reservation-confirm',
            false,
          );
          return showInfo('ユーザー情報が見つかりません', 'エラー');
        }
        const currentFormContext = state.currentReservationFormContext;
        const adminContextReservations =
          /** @type {any} */ (appWindow).adminContext?.reservations || [];
        const targetReservation =
          currentFormContext?.reservationInfo ||
          (state.myReservations || []).find(
            (/** @type {ReservationCore} */ r) =>
              r.reservationId === d.reservationId,
          ) ||
          adminContextReservations.find(
            (/** @type {ReservationCore} */ r) =>
              r.reservationId === d.reservationId,
          );
        const targetLessonId =
          currentFormContext?.lessonInfo?.lessonId ||
          targetReservation?.lessonId ||
          d.lessonId ||
          '';
        const targetStudentId =
          (currentUser.isAdmin && targetReservation?.studentId) ||
          currentUser.studentId ||
          '';
        const p = {
          ...d,
          lessonId: targetLessonId || d.lessonId,
          studentId: targetStudentId,
          messageToTeacher: confirmMessage,
          _isByAdmin: currentUser.isAdmin || false,
          _adminToken: adminToken,
        };

        google.script.run['withSuccessHandler']((/** @type {any} */ r) => {
          hideLoading();
          // よやく確定処理中フラグをクリア
          reservationStateManager.setDataFetchProgress(
            'reservation-confirm',
            false,
          );
          if (r.success) {
            // 管理者の場合は参加者リストをリロードして戻る
            if (currentUser.isAdmin) {
              // 余計な通信を避けるため、サーバーからの戻り値で更新して画面遷移
              const updatedFromResponse =
                (r.data?.myReservations || []).find(
                  (/** @type {ReservationCore} */ res) =>
                    res.reservationId === d.reservationId,
                ) ||
                (targetReservation && targetLessonId
                  ? {
                      ...targetReservation,
                      lessonId: targetLessonId,
                      status: CONSTANTS.STATUS.CONFIRMED,
                      messageToTeacher: confirmMessage,
                    }
                  : null);
              const participantCacheUpdate =
                updateParticipantViewCacheFromReservation(
                  updatedFromResponse,
                  'upsert',
                );
              const fallbackPayload = getParticipantPayloadForAdminView(
                r.data ? r.data.lessons : null,
              );
              reservationStateManager.dispatch({
                type: 'SET_STATE',
                payload: {
                  view: 'participants',
                  navigationHistory: [],
                  ...(participantCacheUpdate || fallbackPayload),
                },
              });
              showInfo(
                '空き通知希望からよやくへの変更が完了しました。',
                'よやく確定',
              );
              refreshParticipantsViewForAdmin();
              return;
            }

            // よやく確定成功のモーダル表示
            showInfo(
              '空き通知希望からよやくへの変更が完了しました。',
              'よやく確定',
            );

            if (r.data) {
              // よやく確定後は個人よやくデータと講座データを更新
              const currentState = reservationStateManager.getState();
              const updatedPayload = {
                myReservations: r.data.myReservations || [],
                view: 'dashboard',
                isDataFresh: true,
                // 参加者リストのキャッシュをクリア
                participantLessons: null,
                participantReservationsMap: null,
              };
              // 講座データが提供された場合のみ更新
              if (r.data.lessons && r.data.lessons.length > 0) {
                /** @type {any} */ (updatedPayload).lessons = r.data.lessons;
                // TODO: setDataFreshness機能の実装が必要
                // reservationStateManager.setDataFreshness('lessons', true);
              } else {
                // サーバーが講座データを返さない場合は既存データを保持
                /** @type {any} */ (updatedPayload).lessons =
                  currentState.lessons;
              }

              reservationStateManager.dispatch({
                type: 'SET_STATE',
                payload: updatedPayload,
              });
            } else {
              reservationStateManager.dispatch({
                type: 'SET_STATE',
                payload: {
                  view: 'complete',
                  completionMessage: r.message,
                  isDataFresh: false,
                  // 参加者リストのキャッシュをクリア
                  participantLessons: null,
                  participantReservationsMap: null,
                },
              });
            }
          } else {
            showInfo(r.message || 'よやく確定に失敗しました。', 'エラー');
          }
        })
          .withFailureHandler((/** @type {Error} */ error) => {
            hideLoading();
            // エラー時もよやく確定処理中フラグをクリア
            reservationStateManager.setDataFetchProgress(
              'reservation-confirm',
              false,
            );
            handleServerError(error);
          })
          .confirmWaitlistedReservationAndGetLatestData(p);
      },
    });
  },

  /**
   * よやく日の変更を開始します。
   * 元のよやく情報をsessionStorageに保存し、よやく画面に遷移します。
   * @param {ActionHandlerData} d - 変更対象のよやく情報を含むデータ
   */
  changeReservationDate: d => {
    const state = reservationStateManager.getState();
    const currentContext = state.currentReservationFormContext;

    if (!currentContext) {
      showInfo('よやく情報が見つかりません。', 'エラー');
      return;
    }

    // 元のよやく情報を取得
    const originalReservation = {
      reservationId: d.reservationId || '',
      ...currentContext.reservationInfo,
      ...currentContext.lessonInfo,
    };

    // sessionStorageに保存（エラーハンドリング付き）
    try {
      sessionStorage.setItem(
        'changingReservation',
        JSON.stringify(originalReservation),
      );
    } catch (e) {
      console.error('セッションストレージへの保存エラー:', e);
      showInfo('よやく情報の保存に失敗しました。', 'エラー');
      return;
    }

    const targetStudentId =
      currentContext.reservationInfo?.studentId ||
      state.currentUser?.studentId ||
      '';
    if (!targetStudentId) {
      showInfo('生徒IDが取得できません。', 'エラー');
      return;
    }

    const targetClassroom =
      d.classroom || currentContext.lessonInfo?.classroom || '';

    // 対象生徒の最新レッスン・よやくを取得してから遷移（一般ユーザーと同じルートに揃える）
    showLoading('booking');
    google.script.run
      .withSuccessHandler((/** @type {BatchDataResponse} */ response) => {
        hideLoading();
        if (response.success && response.data) {
          reservationStateManager.dispatch({
            type: 'SET_STATE',
            payload: {
              view: 'bookingLessons',
              selectedClassroom: targetClassroom,
              isChangingReservationDate: true,
              lessons: response.data.lessons || state.lessons,
              myReservations:
                response.data.myReservations || state.myReservations,
              isDataFresh: true,
            },
          });
        } else {
          showInfo(
            response.message || '最新データの取得に失敗しました。',
            'エラー',
          );
          reservationStateManager.dispatch({
            type: 'SET_STATE',
            payload: {
              view: 'bookingLessons',
              selectedClassroom: targetClassroom,
              isChangingReservationDate: true,
            },
          });
        }
      })
      .withFailureHandler(() => {
        hideLoading();
        showInfo('最新データの取得に失敗しました。', 'エラー');
        reservationStateManager.dispatch({
          type: 'SET_STATE',
          payload: {
            view: 'bookingLessons',
            selectedClassroom: targetClassroom,
            isChangingReservationDate: true,
          },
        });
      })
      .getBatchData(['lessons', 'reservations'], null, targetStudentId);
  },

  /**
   * 日程変更を確定します（新規よやく作成 + 旧よやくキャンセル）。
   */
  confirmDateChange: () => {
    const ctx =
      reservationStateManager.getState().currentReservationFormContext;
    if (!ctx) {
      showInfo('よやくフォーム情報が見つかりません。', 'エラー');
      return;
    }

    // 元のよやく情報を一度だけ取得・パース
    let originalReservation;
    try {
      const originalReservationJson = sessionStorage.getItem(
        'changingReservation',
      );
      if (originalReservationJson) {
        originalReservation = JSON.parse(originalReservationJson);
      }
    } catch (e) {
      console.error('元のよやく情報の読み込みエラー:', e);
    }

    if (!originalReservation || !originalReservation.reservationId) {
      showInfo('元のよやく情報が見つかりません。', 'エラー');
      return;
    }

    const originalReservationId = originalReservation.reservationId;

    // 確認モーダルを表示
    const oldDate = formatDate(originalReservation.date || '');
    const newDate = formatDate(String(ctx.lessonInfo.date));
    const classroom = ctx.lessonInfo.classroom;

    showConfirm({
      title: '参加日の変更',
      message: `
        <div class="text-left space-y-4">
          <p class="text-center font-bold">参加日を変更しますか？</p>
          <p class="text-sm text-brand-subtle">変更前: ${oldDate} ${classroom}</p>
          <p class="text-sm text-brand-text">変更後: ${newDate} ${classroom}</p>
          <p class="text-xs text-brand-subtle mt-2">※ 元のよやくはキャンセルされ、新しい日程でよやくが作成されます</p>
          <div class="pt-4 border-t">
            <label class="block text-sm font-bold mb-2">先生へのメッセージ（任意）</label>
            <textarea id="date-change-message" class="w-full p-2 border-2 border-ui-border rounded" rows="3" placeholder=""></textarea>
          </div>
        </div>
      `,
      confirmText: '変更する',
      cancelText: 'やめる',
      onConfirm: () => {
        showLoading('dateChange');

        // メッセージを取得
        const messageInput = /** @type {HTMLTextAreaElement | null} */ (
          document.getElementById('date-change-message')
        );
        const messageToTeacher = messageInput?.value || '';

        // 新規よやくデータを構築
        const currentUser = reservationStateManager.getState().currentUser;
        const adminToken = /** @type {any} */ (currentUser)?.adminToken || '';
        if (!currentUser) {
          hideLoading();
          showInfo('ユーザー情報が見つかりません。', 'エラー');
          return;
        }

        /** @type {ReservationCore} */
        const newReservationData = {
          reservationId: '', // 新規よやくのため空文字列
          status: '', // バックエンドで設定される
          lessonId: String(ctx.lessonInfo.lessonId || ''),
          studentId:
            (currentUser.isAdmin && originalReservation?.studentId) ||
            currentUser.studentId ||
            '',
          classroom: ctx.lessonInfo.classroom,
          date: String(ctx.lessonInfo.date),
          startTime:
            getTimeValue('res-start-time', null, 'startTime') ||
            ctx.lessonInfo.firstStart ||
            '',
          endTime:
            getTimeValue('res-end-time', null, 'endTime') ||
            ctx.lessonInfo.firstEnd ||
            '',
          firstLecture:
            /** @type {HTMLInputElement | null} */ (
              document.getElementById('hidden-first-lecture')
            )?.value === 'true' ||
            originalReservation?.firstLecture ||
            false,
          chiselRental:
            /** @type {HTMLInputElement | null} */ (
              document.getElementById('option-rental')
            )?.checked || false,
          sessionNote:
            /** @type {HTMLTextAreaElement | null} */ (
              document.getElementById('wip-input')
            )?.value || '',
          materialInfo:
            /** @type {HTMLTextAreaElement | null} */ (
              document.getElementById('material-input')
            )?.value || '',
          order:
            /** @type {HTMLTextAreaElement | null} */ (
              document.getElementById('order-input')
            )?.value || '',
          messageToTeacher: messageToTeacher,
          _isByAdmin: currentUser.isAdmin || false,
          _adminToken: adminToken,
        };

        // バックエンドAPIを呼び出し（新規よやく + 旧よやくキャンセル）
        google.script.run
          .withSuccessHandler((/** @type {ApiResponseGeneric} */ response) => {
            hideLoading();
            sessionStorage.removeItem('changingReservation'); // クリーンアップ

            if (response.success) {
              // 管理者がなりすまし中かどうかを正しく判定
              const state = reservationStateManager.getState();
              const isAdminImpersonating =
                !!state.adminImpersonationOriginalUser;

              if (isAdminImpersonating) {
                const newLessonId = String(ctx.lessonInfo.lessonId || '');
                const oldLessonId = String(
                  originalReservation.lessonId || newLessonId,
                );
                const newReservationFromResponse = (
                  response.data?.myReservations || []
                ).find(
                  (/** @type {ReservationCore} */ r) =>
                    String(r.lessonId) === newLessonId,
                );

                const basePersonInfo = /** @type {any} */ (
                  originalReservation
                    ? {
                        realName: originalReservation.realName,
                        nickname: originalReservation.nickname,
                        displayName: originalReservation.displayName,
                        phone: originalReservation.phone,
                        email: originalReservation.email,
                        ageGroup: originalReservation.ageGroup,
                        gender: originalReservation.gender,
                        address: originalReservation.address,
                        messageToTeacher: originalReservation.messageToTeacher,
                        notes: originalReservation.notes,
                      }
                    : {}
                );

                let participantCacheUpdate = null;
                if (oldLessonId) {
                  participantCacheUpdate =
                    updateParticipantViewCacheFromReservation(
                      /** @type {ReservationCore} */ ({
                        ...originalReservation,
                        reservationId: originalReservationId,
                        lessonId: oldLessonId,
                        status:
                          originalReservation.status ||
                          CONSTANTS.STATUS.CANCELED,
                      }),
                      'remove',
                    );
                }
                if (newReservationFromResponse) {
                  const reservationForCache = /** @type {ReservationCore} */ ({
                    ...basePersonInfo,
                    ...newReservationFromResponse,
                    lessonId: newLessonId,
                  });
                  participantCacheUpdate =
                    updateParticipantViewCacheFromReservation(
                      reservationForCache,
                      'upsert',
                      participantCacheUpdate
                        ? participantCacheUpdate.participantReservationsMap
                        : undefined,
                      participantCacheUpdate
                        ? participantCacheUpdate.participantLessons
                        : undefined,
                    );
                }
                const fallbackPayload = getParticipantPayloadForAdminView(
                  response.data ? response.data.lessons : null,
                );

                // なりすましを終了
                reservationStateManager.endImpersonation();

                reservationStateManager.dispatch({
                  type: 'SET_STATE',
                  payload: {
                    view: 'participants',
                    navigationHistory: [],
                    isChangingReservationDate: false,
                    ...(participantCacheUpdate || fallbackPayload),
                  },
                });
                refreshParticipantsViewForAdmin();
                showInfo(response.message || '参加日を変更しました。');
                return;
              }

              // 成功時は最新データで状態を更新（一般ユーザー）
              const latestMyReservations = Array.isArray(
                response.data?.myReservations,
              )
                ? response.data.myReservations
                : null;
              const latestLessons = Array.isArray(response.data?.lessons)
                ? response.data.lessons
                : null;

              if (response.data) {
                const currentState = reservationStateManager.getState();
                const updatedPayload = {
                  myReservations:
                    latestMyReservations || currentState.myReservations || [],
                  lessons: latestLessons || currentState.lessons,
                  isDataFresh: latestMyReservations !== null,
                };
                // 参加者リストのキャッシュをクリア（一般ユーザーも次回再取得させる）
                /** @type {any} */ (updatedPayload).participantLessons = null;
                /** @type {any} */ (updatedPayload).participantReservationsMap =
                  null;
                /** @type {any} */ (updatedPayload).participantData = null;

                reservationStateManager.dispatch({
                  type: 'SET_STATE',
                  payload: updatedPayload,
                });
              }

              // 完了画面に遷移（日程変更モードフラグをリセット）
              reservationStateManager.dispatch({
                type: 'SET_STATE',
                payload: {
                  view: 'complete',
                  completionMessage:
                    response.message || '参加日を変更しました。',
                  isChangingReservationDate: false, // 日程変更モードをリセット
                  // 参加者リストのキャッシュをクリア（一般ユーザーも次回再取得させる）
                  participantLessons: null,
                  participantReservationsMap: null,
                  participantData: null,
                },
              });
            } else {
              showInfo(
                response.message || '参加日の変更に失敗しました。',
                'エラー',
              );
              // エラー時もフラグをリセット
              reservationStateManager.dispatch({
                type: 'SET_STATE',
                payload: {
                  isChangingReservationDate: false,
                },
              });
            }
          })
          .withFailureHandler((/** @type {Error} */ error) => {
            hideLoading();
            sessionStorage.removeItem('changingReservation'); // エラー時もクリーンアップ
            // エラー時もフラグをリセット
            reservationStateManager.dispatch({
              type: 'SET_STATE',
              payload: {
                isChangingReservationDate: false,
              },
            });
            handleServerError(error);
          })
          .changeReservationDateAndGetLatestData(
            newReservationData,
            originalReservationId,
          );
      },
    });
  },

  /**
   * 管理者用：レッスンの参加者一覧を表示します。
   * @param {ActionHandlerData} d - レッスン情報を含むデータ
   */
  showLessonParticipants: d => {
    const lessonId = d.lessonId;
    const state = reservationStateManager.getState();
    const currentUser = state.currentUser;

    if (!currentUser || !currentUser.isAdmin) {
      showInfo('管理者権限が必要です。', 'エラー');
      return;
    }

    // レッスン情報を特定
    const lessonsCandidates = [
      ...(state.participantLessons || []),
      ...(state.lessons || []),
      ...(state['participantData']?.lessons || []),
    ];
    let lesson = lessonsCandidates.find(l => l.lessonId === lessonId) || null;

    // よやくデータから最低限のレッスン情報を復元（過去データなどでlessonsに存在しない場合）
    if (!lesson) {
      const fallbackReservation =
        state['participantReservationsMap']?.[String(lessonId)]?.[0];
      if (fallbackReservation) {
        lesson = {
          lessonId: lessonId,
          classroom: fallbackReservation.classroom || '',
          date: String(fallbackReservation.date || ''),
          venue: fallbackReservation.venue || '',
        };
      }
    }

    if (!lesson) {
      showInfo('レッスン情報が見つかりません。', 'エラー');
      return;
    }

    // 1. プリロードされたデータを確認 (高速表示)

    // Dashboardビュー（participantData）またはParticipantビュー（participantReservationsMap）から取得

    const preloadedReservations =
      state['participantData']?.reservationsMap?.[String(lessonId)] ||
      state['participantReservationsMap']?.[String(lessonId)];

    if (preloadedReservations) {
      debugLog('⚡ Using preloaded participant data for lesson:', lessonId);

      // 再描画を防ぐため、Stateではなくグローバルコンテキストに一時保存

      /** @type {any} */ (appWindow).adminContext = {
        reservations: preloadedReservations,

        lesson: lesson,
      };

      _showParticipantListModal(preloadedReservations, lesson);

      return;
    }

    // 2. プリロードがない場合はサーバーから取得

    showLoading('participants');

    google.script.run

      .withSuccessHandler((/** @type {ApiResponseGeneric} */ response) => {
        hideLoading();

        if (response.success && response.data) {
          const reservations = response.data.reservations || [];

          const fetchedLesson = response.data.lesson || lesson;

          // 再描画を防ぐため、Stateではなくグローバルコンテキストに一時保存

          /** @type {any} */ (appWindow).adminContext = {
            reservations: reservations,

            lesson: fetchedLesson,
          };

          _showParticipantListModal(reservations, fetchedLesson);
        } else {
          showInfo('参加者情報の取得に失敗しました。', 'エラー');
        }
      })

      .withFailureHandler((/** @type {Error} */ error) => {
        hideLoading();

        handleServerError(error);
      })

      .getReservationsForLesson(lessonId, 'ADMIN');
  },

  /**

           * 管理者用：よやく編集画面へ遷移

           * @param {ActionHandlerData} d

           */

  goToAdminReservationForm: d => {
    const reservationId = d.reservationId;

    // グローバルコンテキストからデータを取得
    const context = /** @type {any} */ (appWindow).adminContext || {};
    const reservations = context.reservations || [];
    const reservation = reservations.find(
      (/** @type {ReservationCore} */ r) => r.reservationId === reservationId,
    );
    const lesson = context.lesson;

    if (reservation && lesson) {
      // モーダルを閉じる
      Components.closeModal('participant-list-modal');

      // 管理者操作のなりすましロジック
      const state = reservationStateManager.getState();
      const targetStudentId = reservation.studentId;
      const currentAdminId = state.currentUser?.studentId;

      if (
        state.currentUser?.isAdmin &&
        targetStudentId &&
        targetStudentId !== currentAdminId
      ) {
        // 生徒情報を構築（reservationから利用可能な情報を使用）
        const adminR = /** @type {any} */ (reservation);
        const targetUser = /** @type {UserCore} */ ({
          studentId: targetStudentId,
          realName: adminR.realName || '',
          nickname: adminR.nickname || '',
          displayName:
            adminR.displayName || adminR.nickname || adminR.realName || '生徒',
          isAdmin: false,
          email: adminR.email || '',
        });
        reservationStateManager.startImpersonation(targetUser);
      }

      const formContext = {
        lessonInfo: lesson,
        reservationInfo: reservation,
      };

      reservationStateManager.dispatch({
        type: 'NAVIGATE',
        payload: {
          to: 'reservationForm',
          context: {
            currentReservationFormContext: formContext,
          },
        },
      });
    } else {
      showInfo('よやく情報が見つかりません', 'エラー');
    }
  },

  /**

           * 管理者用：会計画面へ遷移

           * @param {ActionHandlerData} d

           */

  showAdminAccounting: d => {
    const reservationId = d.reservationId;
    if (!reservationId) {
      showInfo('よやく情報が見つかりません', 'エラー');
      return;
    }

    // モーダルを閉じる
    Components.closeModal('participant-list-modal');

    // goToAccountingに委譲（なりすましロジックを含む）
    // actionHandlersはグローバルに公開されている
    if (appWindow.actionHandlers?.goToAccounting) {
      appWindow.actionHandlers.goToAccounting({ reservationId });
    } else {
      showInfo('会計機能の初期化に失敗しました', 'エラー');
    }
  },
};

/**
 * 参加者リストモーダルを表示するヘルパー関数
 * @param {ReservationCore[]} reservations
 * @param {LessonCore} lesson
 */
function _showParticipantListModal(reservations, lesson) {
  // formatDateを使うとHTMLタグが含まれるため、テキストのみの日付を作成
  const dateObj = new Date(String(lesson.date));
  const dateFormatted = isNaN(dateObj.getTime())
    ? ''
    : `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;

  const rows = reservations
    .map(r => {
      // 管理者用プロパティへのアクセス用にキャスト
      const adminR = /** @type {any} */ (r);
      const name = adminR.realName
        ? `${adminR.realName} (${adminR.nickname})`
        : adminR.nickname || '不明';
      const status = r.status;
      const time = r.startTime ? `${r.startTime}~${r.endTime}` : '';

      return `
      <div class="flex items-center justify-between p-3 border-b border-ui-border">
        <div>
          <div class="font-bold text-brand-text">${name}</div>
          <div class="text-sm text-brand-subtle">${status} ${time}</div>
        </div>
        <div class="flex space-x-2">
          ${Components.button({
            text: '編集',
            action: 'goToAdminReservationForm',
            style: 'secondary',
            size: 'small',
            dataAttributes: { reservationId: r.reservationId },
          })}
          ${Components.button({
            text: '会計',
            action: 'showAdminAccounting',
            style: 'primary',
            size: 'small',
            dataAttributes: { reservationId: r.reservationId },
          })}
        </div>
      </div>
    `;
    })
    .join('');

  const content = `
    <div class="max-h-[60vh] overflow-y-auto">
      ${rows.length > 0 ? rows : '<p class="p-4 text-center text-brand-subtle">よやくはありません</p>'}
    </div>
    <div class="p-4 border-t border-ui-border">
      ${Components.button({
        text: 'もどる',
        action: 'closeModal',
        style: 'secondary',
        size: 'full',
        dataAttributes: { modalId: 'participant-list-modal' },
      })}
    </div>
  `;

  const modalHtml = Components.modal({
    id: 'participant-list-modal',
    title: `${dateFormatted} ${lesson.classroom} 参加者`,
    content: content,
  });

  // Remove existing if any
  const existing = document.getElementById('participant-list-modal');
  if (existing) existing.remove();

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  Components.showModal('participant-list-modal');
}
