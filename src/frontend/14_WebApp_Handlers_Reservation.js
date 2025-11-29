/**
 * =================================================================
 * ファイル概要
 * -----------------------------------------------------------------
 * 名称: 14_WebApp_Handlers_Reservation.js
 * 目的: 予約作成・編集・キャンセルなど予約領域の操作を管理する
 * 主な責務:
 *   - 予約フォーム操作やモーダル表示の制御
 *   - サーバーAPI呼び出しとstateManager更新の調整
 *   - 事前取得データのキャッシュ活用とUIへの反映
 * AI向けメモ:
 *   - 新しい予約フローを追加する際はフォームコンテキストとState更新を一貫させ、このファイル内で副作用を完結させる
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
import { handleServerError } from './12_WebApp_Core_ErrorHandler.js';
import { getScheduleInfoFromCache } from './12_WebApp_Core_Data.js';
import {
  getTimeValue,
  updateAppStateFromCache,
} from './14_WebApp_Handlers_Utils.js';

const reservationStateManager = appWindow.stateManager;

/** 予約管理関連のアクションハンドラー群 */
export const reservationActionHandlers = {
  /**
   * 予約をキャンセルします。
   * @param {ActionHandlerData} d - キャンセル対象の予約情報を含むデータ
   */
  cancel: d => {
    const reservationDate = d.date ? String(d.date) : '';
    const formattedDate = reservationDate ? formatDate(reservationDate) : '';
    const classroomName = d.classroom || '';
    const message = `
        <div class="text-left space-y-4">
          <p class="text-center"><b>${formattedDate}</b><br>${classroomName}<br>この予約を取り消しますか？</p>
          <div class="pt-4 border-t">
            <label class="block text-sm font-bold mb-2">先生へのメッセージ（任意）</label>
            <textarea id="cancel-message" class="w-full p-2 border-2 border-ui-border rounded" rows="3" placeholder=""></textarea>
          </div>
        </div>
      `;
    showConfirm({
      title: '予約の取り消し',
      message: message,
      confirmText: '取り消す',
      cancelText: 'やめる',
      onConfirm: () => {
        // 重複キャンセル防止
        if (
          reservationStateManager.isDataFetchInProgress('reservation-cancel')
        ) {
          console.log('予約取り消し処理中のためキャンセルをスキップ');
          return;
        }

        showLoading('cancel');
        // 予約取り消し処理中フラグを設定
        reservationStateManager.setDataFetchProgress(
          'reservation-cancel',
          true,
        );

        const cancelMessageInput = /** @type {HTMLTextAreaElement | null} */ (
          document.getElementById('cancel-message')
        );
        const cancelMessage = cancelMessageInput?.value || '';
        const currentUser = reservationStateManager.getState().currentUser;
        if (!currentUser) {
          hideLoading();
          reservationStateManager.setDataFetchProgress(
            'reservation-cancel',
            false,
          );
          return showInfo('ユーザー情報が見つかりません', 'エラー');
        }
        const p = {
          ...d,
          studentId: currentUser.studentId,
          cancelMessage: cancelMessage,
        };
        google.script.run['withSuccessHandler']((/** @type {any} */ r) => {
          hideLoading();
          // 予約取り消し処理中フラグをクリア
          reservationStateManager.setDataFetchProgress(
            'reservation-cancel',
            false,
          );

          if (r.success) {
            if (r.data) {
              // 予約取り消し後は個人予約データのみ更新（講座データは既存のキャッシュを利用）
              const currentState = reservationStateManager.getState();
              const updatedPayload = {
                myReservations: r.data.myReservations || [],
                view: 'dashboard',
                isDataFresh: true,
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
                },
              });
            }
            showInfo(r.message || '予約を取り消しました。', 'キャンセル完了');
          } else {
            showInfo(r.message || 'キャンセル処理に失敗しました。', 'エラー');
          }
        })
          .withFailureHandler((/** @type {Error} */ err) => {
            hideLoading();
            // エラー時も予約取り消し処理中フラグをクリア
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
   * 予約フォームの内容を元に予約を確定します。
   * state.currentReservationFormContext を使用します。
   */
  confirmBooking: () => {
    // 重複予約防止
    if (reservationStateManager.isDataFetchInProgress('reservation-booking')) {
      console.log('予約処理中のため予約確定をスキップ');
      return;
    }

    const { currentUser, currentReservationFormContext } =
      reservationStateManager.getState();
    if (!currentReservationFormContext) {
      showInfo('予約コンテキストが見つかりません。', 'エラー');
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

    // 制作メモと材料情報を統合
    const wipValue =
      /** @type {HTMLInputElement} */ (document.getElementById('wip-input'))
        ?.value || '';
    const materialInfoValue =
      /** @type {HTMLInputElement} */ (
        document.getElementById('material-input')
      )?.value || '';
    const combinedWip = materialInfoValue
      ? wipValue + CONSTANTS.SYSTEM.MATERIAL_INFO_PREFIX + materialInfoValue
      : wipValue;

    showLoading('booking');
    // 予約処理中フラグを設定
    reservationStateManager.setDataFetchProgress('reservation-booking', true);

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
          document.getElementById('option-first-lecture')
        )?.checked || isFirstTimeBooking,
      workInProgress: combinedWip,
      order:
        /** @type {HTMLInputElement} */ (document.getElementById('order-input'))
          ?.value || '',
      messageToTeacher:
        /** @type {HTMLInputElement} */ (
          document.getElementById('message-input')
        )?.value || '',
      // 満席判定（LessonCoreから計算）
      isFull:
        typeof lessonInfo.secondSlots !== 'undefined'
          ? (lessonInfo.firstSlots || 0) === 0 &&
            (lessonInfo.secondSlots || 0) === 0
          : (lessonInfo.firstSlots || 0) === 0,
    };

    google.script.run['withSuccessHandler']((/** @type {any} */ r) => {
      hideLoading();
      // 予約処理中フラグをクリア
      reservationStateManager.setDataFetchProgress(
        'reservation-booking',
        false,
      );

      if (r.success) {
        if (r.data) {
          // 新規予約後は個人予約データと必要に応じて講座データを更新
          const currentState = reservationStateManager.getState();
          const updatedPayload = {
            myReservations: r.data.myReservations || [],
            view: 'complete',
            completionMessage: r.message,
            selectedClassroom: lessonInfo.classroom,
            isDataFresh: true,
          };

          // 講座データの選択的更新
          if (r.data.lessons && r.data.lessons.length > 0) {
            /** @type {any} */ (updatedPayload).lessons = r.data.lessons;
            reservationStateManager.setDataFetchProgress('lessons', false);
          } else if (currentState.lessons && currentState.lessons.length > 0) {
            // サーバーが講座データを返さない場合は既存データを保持
            /** @type {any} */ (updatedPayload).lessons = currentState.lessons;
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
            },
          });
        }
      } else {
        showInfo(r.message || '予約に失敗しました。', 'エラー');
      }
    })
      .withFailureHandler((/** @type {Error} */ error) => {
        hideLoading();
        // エラー時も予約処理中フラグをクリア
        reservationStateManager.setDataFetchProgress(
          'reservation-booking',
          false,
        );
        handleServerError(error);
      })
      .makeReservationAndGetLatestData(p);
  },

  /**
   * 予約編集画面に遷移します。
   * @param {ActionHandlerData} d - 編集対象の予約情報を含むデータ
   */
  goToEditReservation: d => {
    const state = reservationStateManager.getState();

    // 1. 予約データを取得（キャッシュ済み）
    const reservation = state.myReservations.find(
      (/** @type {ReservationCore} */ booking) =>
        booking.reservationId === d.reservationId &&
        booking.classroom === d.classroom,
    );

    if (!reservation) {
      showInfo('予約情報が見つかりませんでした。', 'エラー');
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
        type: 'SET_STATE',
        payload: {
          view: 'reservationForm',
          currentReservationFormContext: formContext,
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
          type: 'SET_STATE',
          payload: {
            view: 'reservationForm',
            currentReservationFormContext: formContext,
          },
        });

        hideLoading();
      });
    }
  },

  /**
   * 予約情報を更新します。
   * state.currentReservationFormContext を使用します。
   */
  updateReservation: () => {
    // 重複更新防止
    if (reservationStateManager.isDataFetchInProgress('reservation-update')) {
      console.log('予約更新処理中のため更新をスキップ');
      return;
    }

    const { currentReservationFormContext, currentUser } =
      reservationStateManager.getState();
    if (!currentReservationFormContext) {
      showInfo('予約コンテキストが見つかりません。', 'エラー');
      return;
    }
    if (!currentUser) {
      showInfo('ユーザー情報が見つかりません。', 'エラー');
      return;
    }

    const { reservationInfo } = currentReservationFormContext;
    // 予約編集ではreservationIdは必須
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
    // 予約更新処理中フラグを設定
    reservationStateManager.setDataFetchProgress('reservation-update', true);

    google.script.run['withSuccessHandler'](
      (/** @type {BatchDataResponse} */ r) => {
        hideLoading();
        // 予約更新処理中フラグをクリア
        reservationStateManager.setDataFetchProgress(
          'reservation-update',
          false,
        );

        if (r.success) {
          if (r.data) {
            // 予約更新後は個人予約データを優先的に更新
            const currentState = reservationStateManager.getState();
            const updatedPayload = {
              myReservations: r.data.myReservations || [],
              view: 'dashboard',
              isDataFresh: true,
            };

            // initialデータがある場合は追加
            if (r.data['initial']) {
              Object.assign(updatedPayload, r.data['initial']);
            }

            // 講座データの選択的更新
            if (r.data.lessons && r.data.lessons.length > 0) {
              /** @type {any} */ (updatedPayload).lessons = r.data.lessons;
              reservationStateManager.setDataFetchProgress('lessons', false);
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
              },
            });
          }
          showInfo(
            `<h3 class="font-bold mb-3">更新完了</h3>${r.message || '予約内容を更新しました。'}`,
          );
        } else {
          showInfo(r.message || '更新に失敗しました。', 'エラー');
        }
      },
    )
      .withFailureHandler((/** @type {Error} */ error) => {
        hideLoading();
        // エラー時も予約更新処理中フラグをクリア
        reservationStateManager.setDataFetchProgress(
          'reservation-update',
          false,
        );

        const handler = appWindow.FrontendErrorHandler || FrontendErrorHandler;
        handler.handle(error, 'updateReservation', {
          reservationId: p.reservationId,
          classroom: p.classroom,
        });
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
      showInfo('教室情報の取得に失敗しました。ホームに戻ります。', 'エラー');
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
        '予約枠の取得に失敗しました。時間をおいて再度お試しください。',
        'エラー',
      );
    }
  },

  /**
   * スロット情報を更新してから予約枠画面に遷移します。
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

    // 初回アクセスまたはデータ更新が必要な場合のみローディング表示とサーバー確認
    showLoading('booking');
    google.script.run['withSuccessHandler'](
      (
        /** @type {ServerResponse<Record<string, string>>} */ versionResponse,
      ) => {
        if (versionResponse.success && versionResponse.data) {
          const currentLessonsVersion =
            reservationStateManager.getState()._lessonsVersion;
          const serverLessonsVersion = versionResponse.data['lessonsComposite'];
          const currentLessonsState =
            reservationStateManager.getState().lessons;
          if (
            currentLessonsVersion === serverLessonsVersion &&
            currentLessonsState &&
            Array.isArray(currentLessonsState) &&
            currentLessonsState.length > 0
          ) {
            hideLoading();
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
    // 取得中フラグを設定してダブルクリック防止
    reservationStateManager.setDataFetchProgress('lessons', true);

    google.script.run['withSuccessHandler']((/** @type {any} */ response) => {
      hideLoading();
      // 取得完了をマーク
      reservationStateManager.setDataFetchProgress('lessons', false);

      if (response.success && response.data && response.data.lessons) {
        // バージョンを更新
        if (newLessonsVersion) {
          reservationStateManager.updateLessonsVersion(newLessonsVersion);
        }

        reservationStateManager.dispatch({
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
        // エラー時も取得中フラグをクリア
        reservationStateManager.setDataFetchProgress('lessons', false);
        showInfo(
          '予約枠の取得に失敗しました。時間をおいて再度お試しください。',
        );
        Logger.log(`fetchLatestLessonsDataエラー: ${error}`);
      })
      .getBatchData(
        ['lessons'],
        reservationStateManager.getState().currentUser?.phone || '',
      );
  },

  /**
   * 予約枠を選択し、予約フォーム画面に遷移します。
   * @param {ActionHandlerData} d - 選択した予約枠の情報を含むデータ
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
        type: 'SET_STATE',
        payload: {
          currentReservationFormContext: formContext,
          view: 'reservationForm',
        },
      });
    } else {
      showInfo('選択した予約枠が見つかりません。', 'エラー');
    }
  },

  /**
   * 指定された日程の予約フォーム画面に遷移します。
   * @param {ActionHandlerData} d - 選択した日程の情報 (lessonId) を含むデータ
   */
  goToReservationFormForLesson: d => {
    const currentState = reservationStateManager.getState();
    const lessonId = d.lessonId;

    const foundLesson =
      currentState.participantLessons &&
      Array.isArray(currentState.participantLessons)
        ? currentState.participantLessons.find(
            (/** @type {LessonCore} */ lesson) => lesson.lessonId === lessonId,
          )
        : null;

    if (foundLesson) {
      // ユーザーの既存予約を検索
      const existingReservation = (currentState.myReservations || []).find(
        (/** @type {ReservationCore} */ res) => res.lessonId === lessonId,
      );

      const formContext = {
        lessonInfo: foundLesson,
        // 既存予約があればそれを、なければ空のオブジェクトをセット
        reservationInfo: existingReservation || {
          firstLecture: false,
          chiselRental: false,
        },
        source: 'participants', // 遷移元を記録
      };

      reservationStateManager.dispatch({
        type: 'SET_STATE',
        payload: {
          currentReservationFormContext: formContext,
          view: 'reservationForm',
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
    if (
      !reservationStateManager.getState().isDataFresh &&
      !reservationStateManager.getState()._dataUpdateInProgress
    ) {
      updateAppStateFromCache('dashboard');
    } else {
      reservationStateManager.dispatch({
        type: 'SET_STATE',
        payload: { view: 'dashboard' },
      });
    }
  },

  /** 予約枠一覧画面に戻ります */
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
   * 空き通知希望の予約を確定予約に変更します。
   * @param {ActionHandlerData} d - 確定対象の予約情報を含むデータ
   */
  confirmWaitlistedReservation: d => {
    const targetDate = d.date ? String(d.date) : '';
    const formattedDate = targetDate ? formatDate(targetDate) : '';
    const classroomName = d.classroom || '';
    const message = `
        <div class="text-left space-y-4">
          <p class="text-center"><b>${formattedDate}</b><br>${classroomName}<br>空き通知希望を確定予約に変更しますか？</p>
          <div class="pt-4 border-t">
            <label class="block text-sm font-bold mb-2">先生へのメッセージ（任意）</label>
            <textarea id="confirm-message" class="w-full p-2 border-2 border-ui-border rounded" rows="3" placeholder=""></textarea>
          </div>
        </div>
      `;
    showConfirm({
      title: '予約確定',
      message: message,
      confirmText: '確定する',
      cancelText: 'キャンセル',
      onConfirm: () => {
        // 重複確定防止
        if (
          reservationStateManager.isDataFetchInProgress('reservation-confirm')
        ) {
          console.log('予約確定処理中のため確定をスキップ');
          return;
        }

        showLoading('booking');
        // 予約確定処理中フラグを設定
        reservationStateManager.setDataFetchProgress(
          'reservation-confirm',
          true,
        );

        const confirmMessageInput = /** @type {HTMLTextAreaElement | null} */ (
          document.getElementById('confirm-message')
        );
        const confirmMessage = confirmMessageInput?.value || '';
        const currentUser = reservationStateManager.getState().currentUser;
        if (!currentUser) {
          hideLoading();
          reservationStateManager.setDataFetchProgress(
            'reservation-confirm',
            false,
          );
          return showInfo('ユーザー情報が見つかりません', 'エラー');
        }
        const p = {
          ...d,
          studentId: currentUser.studentId,
          messageToTeacher: confirmMessage,
        };

        google.script.run['withSuccessHandler']((/** @type {any} */ r) => {
          hideLoading();
          // 予約確定処理中フラグをクリア
          reservationStateManager.setDataFetchProgress(
            'reservation-confirm',
            false,
          );
          if (r.success) {
            // 予約確定成功のモーダル表示
            showInfo(
              '空き通知希望から予約への変更が完了しました。',
              '予約確定',
            );

            if (r.data) {
              // 予約確定後は個人予約データと講座データを更新
              const currentState = reservationStateManager.getState();
              const updatedPayload = {
                myReservations: r.data.myReservations || [],
                view: 'dashboard',
                isDataFresh: true,
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
                },
              });
            }
          } else {
            showInfo(r.message || '予約確定に失敗しました。', 'エラー');
          }
        })
          .withFailureHandler((/** @type {Error} */ error) => {
            hideLoading();
            // エラー時も予約確定処理中フラグをクリア
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
   * 予約日の変更を開始します。
   * 元の予約情報をsessionStorageに保存し、予約画面に遷移します。
   * @param {ActionHandlerData} d - 変更対象の予約情報を含むデータ
   */
  changeReservationDate: d => {
    const state = reservationStateManager.getState();
    const currentContext = state.currentReservationFormContext;

    if (!currentContext) {
      showInfo('予約情報が見つかりません。', 'エラー');
      return;
    }

    // 元の予約情報を取得
    const originalReservation = {
      reservationId: d.reservationId || '',
      ...currentContext.reservationInfo,
      ...currentContext.lessonInfo,
    };

    // sessionStorageに保存
    sessionStorage.setItem(
      'changingReservation',
      JSON.stringify(originalReservation),
    );

    // 予約画面に遷移
    reservationStateManager.dispatch({
      type: 'SET_STATE',
      payload: {
        view: 'bookingLessons',
        selectedClassroom: d.classroom || '',
        isChangingReservationDate: true,
      },
    });
  },

  /**
   * 予約日の変更を確定します。
   * 新しい予約を作成し、古い予約をキャンセルします。
   */
  confirmDateChange: () => {
    const state = reservationStateManager.getState();
    const currentContext = state.currentReservationFormContext;

    if (!currentContext) {
      showInfo('予約情報が見つかりません。', 'エラー');
      return;
    }

    // 元の予約情報を取得
    const originalReservationJson = sessionStorage.getItem(
      'changingReservation',
    );
    if (!originalReservationJson) {
      showInfo('元の予約情報が見つかりません。', 'エラー');
      return;
    }

    const originalReservation = JSON.parse(originalReservationJson);
    const newReservationInfo = currentContext.reservationInfo;
    const newLessonInfo = currentContext.lessonInfo;

    // 確認メッセージを表示
    const oldDate = formatDate(String(originalReservation.date));
    const newDate = formatDate(String(newReservationInfo.date));
    const classroom = newReservationInfo.classroom;

    const message = `
      <div class="text-left space-y-4">
        <p class="text-center font-bold">予約日を変更します</p>
        <div class="space-y-2">
          <p><span class="font-bold">教室:</span> ${classroom}</p>
          <p><span class="font-bold">変更前:</span> ${oldDate}</p>
          <p><span class="font-bold">変更後:</span> ${newDate}</p>
        </div>
        <p class="text-sm text-ui-text-subtle">※元の予約は自動的にキャンセルされます</p>
      </div>
    `;

    showConfirm({
      title: '予約日の変更',
      message: message,
      confirmText: '変更する',
      onConfirm: () => {
        showLoading('予約日を変更しています...');

        // 新しい予約のデータを構築
        const newReservationData = /** @type {any} */ ({
          lessonId: newLessonInfo.lessonId,
          classroom: newReservationInfo.classroom,
          date: newReservationInfo.date,
          studentId: state.currentUser?.studentId,
          nickname: state.currentUser?.nickname,
          startTime: getTimeValue(
            'res-start-time',
            /** @type {any} */ (newReservationInfo),
            'startTime',
          ),
          endTime: getTimeValue(
            'res-end-time',
            /** @type {any} */ (newReservationInfo),
            'endTime',
          ),
          workInProgress: /** @type {HTMLTextAreaElement} */ (
            document.getElementById('wip-input')
          )?.value,
          materialInfo: /** @type {HTMLTextAreaElement} */ (
            document.getElementById('material-input')
          )?.value,
          messageToTeacher: /** @type {HTMLTextAreaElement} */ (
            document.getElementById('message-input')
          )?.value,
          order: /** @type {HTMLTextAreaElement} */ (
            document.getElementById('order-input')
          )?.value,
          firstLecture: /** @type {HTMLInputElement} */ (
            document.getElementById('option-first-lecture')
          )?.checked,
          chiselRental: /** @type {HTMLInputElement} */ (
            document.getElementById('option-rental')
          )?.checked,
        });

        const originalReservationId = originalReservation.reservationId;

        google.script.run
          .withSuccessHandler(
            /** @param {ServerResponse<BatchDataResult>} r */ r => {
              hideLoading();
              sessionStorage.removeItem('changingReservation');

              if (r.success && r.data) {
                showInfo(r.message || '予約日を変更しました。', '完了');

                const myReservations =
                  /** @type {any} */ (r.data).myReservations || [];
                const lessons = /** @type {any} */ (r.data).lessons || [];

                // 状態を更新
                reservationStateManager.dispatch({
                  type: 'SET_STATE',
                  payload: {
                    myReservations: myReservations,
                    lessons: lessons,
                    view: 'dashboard',
                    isChangingReservationDate: false,
                    isDataFresh: true,
                  },
                });
              } else {
                showInfo(r.message || '予約日の変更に失敗しました。', 'エラー');
              }
            },
          )
          .withFailureHandler((/** @type {Error} */ error) => {
            hideLoading();
            sessionStorage.removeItem('changingReservation');
            handleServerError(error);
          })
          .changeReservationDateAndGetLatestData(
            newReservationData,
            originalReservationId,
          );
      },
    });
  },
};
