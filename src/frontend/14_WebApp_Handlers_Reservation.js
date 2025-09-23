// @ts-check
/// <reference path="../../types/dev-environment.d.ts" />
/// <reference path="../../types/html-environment.d.ts" />
/// <reference path="../../types/api-types.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 14_WebApp_Handlers_Reservation.js
 * 【バージョン】: 1.1
 * 【役割】: WebAppのフロントエンドにおける、予約管理関連の
 * アクションハンドラーを集約します。
 * 【構成】: 14ファイル構成から分割された予約管理ファイル
 * 【v1.1での変更点】: JSDocの型定義を更新。予約フォームのコンテキスト生成ロジックを導入。
 * =================================================================
 */

/** 予約管理関連のアクションハンドラー群 */
const reservationActionHandlers = {
  /**
   * 予約をキャンセルします。
   * @param {ActionHandlerData} d - キャンセル対象の予約情報を含むデータ
   */
  cancel: d => {
    const message = `
        <div class="text-left space-y-4">
          <p class="text-center"><b>${formatDate(d.date)}</b><br>${d.classroom}<br>この予約を取り消しますか？</p>
          <div class="pt-4 border-t">
            <label class="block text-sm font-bold mb-2">先生へのメッセージ（任意）</label>
            <textarea id="cancel-message" class="w-full p-2 border-2 border-ui-border rounded" rows="3" placeholder=""></textarea>
          </div>
        </div>
      `;
    showConfirm({
      title: '予約の取り消し',
      message: message,
      onConfirm: () => {
        showLoading('cancel');
        const cancelMessageInput = /** @type {HTMLTextAreaElement | null} */ (
          document.getElementById('cancel-message')
        );
        const cancelMessage = cancelMessageInput?.value || '';
        const p = {
          ...d,
          studentId: stateManager.getState().currentUser.studentId,
          cancelMessage: cancelMessage,
        };
        google.script.run['withSuccessHandler']((/** @type {any} */ r) => {
          hideLoading();
          if (r.success) {
            if (r.data) {
              window.stateManager.dispatch({
                type: 'SET_STATE',
                payload: {
                  ...r.data.initialData,
                  myReservations: r.data.myReservations || [],
                  lessons: r.data.lessons || [],
                  view: 'dashboard',
                  isDataFresh: true,
                },
              });
            } else {
              window.stateManager.dispatch({
                type: 'SET_STATE',
                payload: { view: 'dashboard', isDataFresh: false },
              });
            }
            showInfo(r.message || '予約を取り消しました。');
          } else {
            showInfo(r.message || 'キャンセル処理に失敗しました。');
          }
        })
          .withFailureHandler((/** @type {Error} */ err) => {
            handleServerError(err);
          })
          .cancelReservationAndGetLatestData(p);
      },
    });
  },

  /**
   * 予約フォームの内容を元に予約を確定します。
   * state.currentReservationFormContext を使用します。
   */
  confirmBooking: () => {
    const { currentUser, currentReservationFormContext } =
      stateManager.getState();
    if (!currentReservationFormContext) {
      showInfo('エラー: 予約コンテキストが見つかりません。');
      return;
    }

    const { lessonInfo } = currentReservationFormContext;
    const isFirstTimeBooking = stateManager.getState().isFirstTimeBooking;

    const startTime = getTimeValue('res-start-time', null, 'startTime');
    const endTime = getTimeValue('res-end-time', null, 'endTime');

    const bookingOptions = {
      chiselRental:
        /** @type {HTMLInputElement} */ (
          document.getElementById('option-rental')
        )?.checked || false,
      firstLecture:
        /** @type {HTMLInputElement} */ (
          document.getElementById('option-first-lecture')
        )?.checked || isFirstTimeBooking,
      workInProgress:
        /** @type {HTMLInputElement} */ (document.getElementById('wip-input'))
          ?.value || '',
      order:
        /** @type {HTMLInputElement} */ (document.getElementById('order-input'))
          ?.value || '',
      messageToTeacher:
        /** @type {HTMLInputElement} */ (
          document.getElementById('message-input')
        )?.value || '',
      materialInfo:
        /** @type {HTMLInputElement} */ (
          document.getElementById('material-input')
        )?.value || '',
    };

    showLoading('booking');

    const p = {
      classroom: lessonInfo.schedule.classroom,
      date: lessonInfo.schedule.date,
      venue: lessonInfo.schedule.venue,
      startTime: startTime,
      endTime: endTime,
      user: currentUser,
      studentId: currentUser.studentId,
      options: bookingOptions,
      schedule: lessonInfo.schedule,
      status: lessonInfo.status,
      isFull: lessonInfo.status.isFull,
    };

    google.script.run['withSuccessHandler']((/** @type {any} */ r) => {
      hideLoading();
      if (r.success) {
        if (r.data) {
          window.stateManager.dispatch({
            type: 'SET_STATE',
            payload: {
              ...r.data.initialData,
              myReservations: r.data.myReservations || [],
              lessons: r.data.lessons || [],
              view: 'complete',
              completionMessage: r.message,
              selectedClassroom: lessonInfo.schedule.classroom,
              isDataFresh: true,
            },
          });
        } else {
          window.stateManager.dispatch({
            type: 'SET_STATE',
            payload: {
              view: 'complete',
              completionMessage: r.message,
              selectedClassroom: lessonInfo.schedule.classroom,
              isDataFresh: false,
            },
          });
        }
      } else {
        showInfo(r.message || '予約に失敗しました。');
      }
    })
      .withFailureHandler(handleServerError)
      .makeReservationAndGetLatestData(p);
  },

  /**
   * 予約編集画面に遷移します。
   * @param {ActionHandlerData} d - 編集対象の予約情報を含むデータ
   */
  goToEditReservation: d => {
    showLoading('booking');
    const reservation = stateManager
      .getState()
      .myReservations.find(
        booking =>
          booking.reservationId === d.reservationId &&
          booking.classroom === d.classroom,
      );

    if (reservation) {
      getScheduleInfoFromCache(
        String(reservation.date),
        reservation.classroom,
      ).then(scheduleInfo => {
        const lesson = stateManager
          .getState()
          .lessons.find(
            l =>
              l.schedule.date === String(reservation.date) &&
              l.schedule.classroom === reservation.classroom,
          );

        const lessonInfo = lesson || {
          schedule: scheduleInfo || {},
          status: {},
        };

        const formContext = {
          lessonInfo: lessonInfo,
          reservationInfo: reservation,
        };

        window.stateManager.dispatch({
          type: 'SET_STATE',
          payload: {
            view: 'reservationForm',
            currentReservationFormContext: formContext,
          },
        });

        hideLoading();
      });
    } else {
      showInfo('予約情報が見つかりませんでした。');
      hideLoading();
    }
  },

  /**
   * 予約情報を更新します。
   * state.currentReservationFormContext を使用します。
   */
  updateReservation: () => {
    const { currentReservationFormContext, currentUser } =
      stateManager.getState();
    if (!currentReservationFormContext) {
      showInfo('エラー: 予約コンテキストが見つかりません。');
      return;
    }

    const { reservationInfo } = currentReservationFormContext;
    // 予約編集ではreservationIdは必須
    if (!reservationInfo.reservationId) {
      showInfo('エラー: 予約IDが見つかりません。');
      return;
    }
    const validReservationInfo = /** @type {ReservationData} */ (
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

    const p = {
      reservationId: validReservationInfo.reservationId,
      classroom: validReservationInfo.classroom,
      studentId: currentUser.studentId,
      chiselRental:
        /** @type {HTMLInputElement} */ (
          document.getElementById('option-rental')
        )?.checked || false,
      firstLecture:
        /** @type {HTMLInputElement} */ (
          document.getElementById('option-first-lecture')
        )?.checked || false,
      startTime: startTime,
      endTime: endTime,
      workInProgress: /** @type {HTMLInputElement} */ (
        document.getElementById('wip-input')
      ).value,
      order: /** @type {HTMLInputElement} */ (
        document.getElementById('order-input')
      ).value,
      messageToTeacher: /** @type {HTMLInputElement} */ (
        document.getElementById('message-input')
      ).value,
      materialInfo:
        /** @type {HTMLInputElement} */ (
          document.getElementById('material-input')
        )?.value || '',
    };
    showLoading('booking');
    google.script.run['withSuccessHandler'](
      (/** @type {BatchDataResponse} */ r) => {
        hideLoading();
        if (r.success) {
          if (r.data) {
            window.stateManager.dispatch({
              type: 'SET_STATE',
              payload: {
                ...r.data.initial,
                myReservations: r.data.myReservations || [],
                lessons: r.data.lessons || [],
                view: 'dashboard',
                isDataFresh: true,
              },
            });
          } else {
            window.stateManager.dispatch({
              type: 'SET_STATE',
              payload: { view: 'dashboard', isDataFresh: false },
            });
          }
          showInfo(
            `<h3 class="font-bold mb-3">更新完了</h3>${r.message || '予約内容を更新しました。'}`,
          );
        } else {
          showInfo(r.message || '更新に失敗しました。');
        }
      },
    )
      .withFailureHandler((/** @type {Error} */ error) => {
        hideLoading();
        if (window.FrontendErrorHandler) {
          window.FrontendErrorHandler.handle(error, 'updateReservation', {
            reservationId: p.reservationId,
            classroom: p.classroom,
          });
        }
        handleServerError(error);
      })
      .updateReservationDetailsAndGetLatestData(p);
  },

  /** 新規予約のための教室選択モーダルを表示します */
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
      showInfo('教室情報の取得に失敗しました。ホームに戻ります。');
      reservationActionHandlers.goBackToDashboard();
    }
  },

  /** 教室選択モーダルを閉じます */
  closeClassroomModal: () => {
    Components.closeModal('classroom-selection-modal');
  },

  /**
   * 教室を選択し、予約枠一覧画面に遷移します。
   * @param {ActionHandlerData} d - 選択した教室情報を含むデータ
   */
  selectClassroom: d => {
    let classroomName =
      d?.classroomName || d?.classroom || d?.['classroom-name'];
    if (classroomName) {
      reservationActionHandlers.closeClassroomModal();
      reservationActionHandlers.updateLessonsAndGoToBooking(classroomName);
    } else {
      showInfo('予約枠の取得に失敗しました。時間をおいて再度お試しください。');
    }
  },

  /**
   * スロット情報を更新してから予約枠画面に遷移します。
   * @param {string} classroomName - 対象の教室名
   */
  updateLessonsAndGoToBooking: classroomName => {
    if (stateManager.getState()._dataUpdateInProgress) return;
    showLoading('booking');
    google.script.run['withSuccessHandler'](
      (
        /** @type {ServerResponse<Record<string, string>>} */ versionResponse,
      ) => {
        if (versionResponse.success && versionResponse.data) {
          const currentLessonsVersion = stateManager.getState()._lessonsVersion;
          const serverLessonsVersion = versionResponse.data['lessonsComposite'];
          if (
            currentLessonsVersion === serverLessonsVersion &&
            stateManager.getState().lessons?.length > 0
          ) {
            hideLoading();
            window.stateManager.dispatch({
              type: 'SET_STATE',
              payload: {
                selectedClassroom: classroomName,
                view: 'bookingLessons',
                isDataFresh: true,
              },
            });
            return;
          }
          reservationActionHandlers.fetchLatestLessonsData(
            classroomName,
            serverLessonsVersion,
          );
        } else {
          reservationActionHandlers.fetchLatestLessonsData(classroomName, null);
        }
      },
    )
      .withFailureHandler(() => {
        reservationActionHandlers.fetchLatestLessonsData(classroomName, null);
      })
      .getCacheVersions();
  },

  /**
   * 最新の講座データを取得します（内部処理）。
   * @param {string} classroomName - 対象の教室名
   * @param {string | null} newLessonsVersion - 新しいバージョン情報
   */
  fetchLatestLessonsData: (classroomName, newLessonsVersion) => {
    google.script.run['withSuccessHandler']((/** @type {any} */ response) => {
      hideLoading();
      if (response.success && response.data && response.data.lessons) {
        window.stateManager.dispatch({
          type: 'SET_STATE',
          payload: {
            lessons: response.data.lessons,
            selectedClassroom: classroomName,
            view: 'bookingLessons',
            isDataFresh: true,
            _lessonsVersion: newLessonsVersion,
          },
        });
      } else {
        showInfo(
          '予約枠の取得に失敗しました。時間をおいて再度お試しください。',
        );
      }
    })
      .withFailureHandler((/** @type {Error} */ error) => {
        hideLoading();
        showInfo(
          '予約枠の取得に失敗しました。時間をおいて再度お試しください。',
        );
        Logger.log(`fetchLatestLessonsDataエラー: ${error}`);
      })
      .getBatchData(['lessons'], stateManager.getState().currentUser.phone);
  },

  /**
   * 予約枠を選択し、予約フォーム画面に遷移します。
   * @param {ActionHandlerData} d - 選択した予約枠の情報を含むデータ
   */
  bookLesson: d => {
    const foundLesson = stateManager
      .getState()
      .lessons.find(
        lesson =>
          lesson.schedule.classroom === d.classroom &&
          lesson.schedule.date === d.date,
      );
    if (foundLesson) {
      const isFirstTime = stateManager.getState().isFirstTimeBooking;
      const formContext = {
        lessonInfo: foundLesson,
        reservationInfo: {
          firstLecture: isFirstTime,
          chiselRental: false,
        },
      };

      window.stateManager.dispatch({
        type: 'SET_STATE',
        payload: {
          currentReservationFormContext: formContext,
          view: 'reservationForm',
        },
      });
    } else {
      showInfo('エラーが発生しました。選択した予約枠が見つかりません。');
    }
  },

  /** ホーム（メイン画面）に遷移（別名） */
  goBackToDashboard: () => reservationActionHandlers.goToDashboard(),

  /** ホーム（メイン画面）に遷移 */
  goToDashboard: () => {
    if (
      !stateManager.getState().isDataFresh &&
      !stateManager.getState()._dataUpdateInProgress
    ) {
      updateAppStateFromCache('dashboard');
    } else {
      window.stateManager.dispatch({
        type: 'SET_STATE',
        payload: { view: 'dashboard' },
      });
    }
  },

  /** 予約枠一覧画面に戻ります */
  goBackToBooking: () => {
    const targetClassroom =
      stateManager.getState().currentReservationFormContext?.lessonInfo.schedule
        .classroom || stateManager.getState().selectedClassroom;

    if (
      !stateManager.getState().isDataFresh &&
      !stateManager.getState()._dataUpdateInProgress
    ) {
      reservationActionHandlers.updateLessonsAndGoToBooking(targetClassroom);
    } else {
      window.stateManager.dispatch({
        type: 'SET_STATE',
        payload: { view: 'bookingLessons', selectedClassroom: targetClassroom },
      });
    }
  },
};
