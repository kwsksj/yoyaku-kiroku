// @ts-check
/// <reference path="../../types/dev-environment.d.ts" />
/// <reference path="../../types/html-environment.d.ts" />
/// <reference path="../../types/api-types.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 14_WebApp_Handlers_Reservation.js
 * 【バージョン】: 1.0
 * 【役割】: WebAppのフロントエンドにおける、予約管理関連の
 * アクションハンドラーを集約します。
 * 【構成】: 14ファイル構成から分割された予約管理ファイル
 * 【機能範囲】:
 * - 予約確定・キャンセル
 * - 予約編集・更新
 * - 教室選択・予約枠表示
 * - 予約関連ナビゲーション
 * =================================================================
 */

// =================================================================
// --- Reservation Management Action Handlers ---
// -----------------------------------------------------------------
// 予約管理関連のアクションハンドラー群
// =================================================================

/** 予約管理関連のアクションハンドラー群 */
const reservationActionHandlers = {
  /** 予約をキャンセルします
   * @param {ActionHandlerData} d */
  cancel: d => {
    const message = `
        <div class="text-left space-y-4">
          <p class="text-center"><b>${formatDate(d.date)}</b><br>${d.classroom}<br>この予約を取り消しますか？</p>
          <div class="pt-4 border-t">
            <label class="block text-sm font-bold mb-2">先生へのメッセージ（任意）</label>
            <textarea id="cancel-message" class="w-full p-2 border border-ui-border rounded" rows="3" placeholder=""></textarea>
          </div>
        </div>
      `;
    showConfirm({
      title: '予約の取り消し',
      message: message,
      onConfirm: () => {
        showLoading('cancel');
        /** @type {HTMLTextAreaElement | null} */
        const cancelMessageInput = document.getElementById('cancel-message');
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
                  isDataFresh: true, // 最新データ受信済み
                },
              });
            } else {
              window.stateManager.dispatch({
                type: 'SET_STATE',
                payload: {
                  view: 'dashboard',
                  isDataFresh: false, // 再読み込み必要
                },
              });
            }
            showInfo(r.message || '予約を取り消しました。');
          } else {
            showInfo(r.message || 'キャンセル処理に失敗しました。');
          }
        })
          ['withFailureHandler']((/** @type {any} */ err) => {
            // エラー時は画面を更新せず、元の状態を維持
            handleServerError(err);
          })
          .cancelReservationAndGetLatestData(p);
      },
    });
  },

  /** 予約を確定します */
  confirmBooking: () => {
    // 初回の自動判定
    // isFirstTimeBooking を stateManager から取得
    const isFirstTimeBooking = stateManager.getState()['isFirstTimeBooking'];

    // 現在見ている予約枠の時間情報を取得
    const selectedLesson = stateManager.getState().selectedLesson;

    // 教室形式に応じて時間を設定（ヘルパー関数使用）
    const startTime = getTimeValue('res-start-time', null, 'startTime');
    const endTime = getTimeValue('res-end-time', null, 'endTime');

    // デバッグ用ログ
    const actualClassroomType =
      /** @type {any} */ (selectedLesson)?.schedule?.classroomType ||
      /** @type {any} */ (selectedLesson)?.classroomType;
    console.log(`実際のclassroomType: "${actualClassroomType}"`);
    console.log(
      `classroom: "${/** @type {any} */ (selectedLesson)?.schedule?.classroom || /** @type {any} */ (selectedLesson)?.classroom}"`,
    );
    console.log(
      `date: "${/** @type {any} */ (selectedLesson)?.schedule?.date || /** @type {any} */ (selectedLesson)?.date}"`,
    );
    console.log(
      `比較結果: ${actualClassroomType === CONSTANTS.CLASSROOM_TYPES.SESSION_BASED}`,
    );

    if (actualClassroomType === CONSTANTS.CLASSROOM_TYPES.SESSION_BASED) {
      console.log(`[セッション制] 時間設定: ${startTime} - ${endTime}`);
    } else {
      console.log(`[時間制] 時間設定: ${startTime} - ${endTime}`);
    }

    const bookingOptions = {
      chiselRental: document.getElementById('option-rental')?.checked || false,
      firstLecture:
        document.getElementById('option-first-lecture')?.checked ||
        isFirstTimeBooking, // 自動設定
      workInProgress: document.getElementById('wip-input')?.value || '',
      order: document.getElementById('order-input')?.value || '',
      messageToTeacher: document.getElementById('message-input')?.value || '',
      materialInfo: document.getElementById('material-input')?.value || '',
    };

    showLoading('booking');

    // バックエンドに送信する予約データを明示的に構築
    const p = {
      // 基本情報（selectedLessonから明示的に取得）
      classroom:
        /** @type {any} */ (selectedLesson)?.schedule?.classroom ||
        /** @type {any} */ (selectedLesson)?.classroom,
      date:
        /** @type {any} */ (selectedLesson)?.schedule?.date ||
        /** @type {any} */ (selectedLesson)?.date,
      venue:
        /** @type {any} */ (selectedLesson)?.schedule?.venue ||
        /** @type {any} */ (selectedLesson)?.venue,

      // 時間情報（教室形式に応じて調整済み）
      startTime: startTime,
      endTime: endTime,

      // バックエンドとの互換性のため、ヘッダー形式も併記
      [CONSTANTS.HEADERS.RESERVATIONS?.START_TIME || 'startTime']: startTime,
      [CONSTANTS.HEADERS.RESERVATIONS?.END_TIME || 'endTime']: endTime,

      // ユーザー情報
      user: stateManager.getState().currentUser,
      studentId: stateManager.getState().currentUser.studentId,

      // 予約オプション
      options: bookingOptions,

      // スケジュール詳細（バックエンドでの処理に必要）
      schedule: selectedLesson?.schedule,

      // ステータス情報（必要に応じて）
      status: /** @type {any} */ (selectedLesson)?.status,
      isFull: /** @type {any} */ (selectedLesson)?.isFull,
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
              isDataFresh: true, // 最新データ受信済み
            },
          });
        } else {
          window.stateManager.dispatch({
            type: 'SET_STATE',
            payload: {
              view: 'complete',
              completionMessage: r.message,
              isDataFresh: false, // 再読み込み必要
            },
          });
        }
      } else {
        showInfo(r.message || '予約に失敗しました。');
      }
    })
      ['withFailureHandler'](handleServerError)
      .makeReservationAndGetLatestData(p);
  },

  /** 予約編集画面に遷移します（予約データはキャッシュから取得済み）
   * @param {ActionHandlerData} d */
  goToEditReservation: d => {
    showLoading('booking');
    // 予約データは既にキャッシュから取得済みなので、直接編集画面に遷移
    const reservation = stateManager
      .getState()
      .myReservations.find(
        booking =>
          booking.reservationId === d.reservationId &&
          booking.classroom === d.classroom,
      );

    if (reservation) {
      const editingDetails = {
        reservationId: reservation.reservationId,
        classroom: reservation.classroom,
        date: reservation.date,
        venue: reservation.venue,
        chiselRental: reservation.chiselRental || false,
        firstLecture: reservation.firstLecture || false,
        [CONSTANTS.HEADERS.RESERVATIONS?.START_TIME || 'startTime']:
          reservation[CONSTANTS.HEADERS.RESERVATIONS?.START_TIME] ||
          reservation.startTime ||
          '',
        [CONSTANTS.HEADERS.RESERVATIONS?.END_TIME || 'endTime']:
          reservation[CONSTANTS.HEADERS.RESERVATIONS?.END_TIME] ||
          reservation.endTime ||
          '',
        workInProgress: reservation.workInProgress || '',
        order: reservation.order || '',
        messageToTeacher: reservation.message || '',
        materialInfo: reservation.materialInfo || '',
      };

      // scheduleInfo取得完了後にビューを表示
      getScheduleInfoFromCache(
        typeof editingDetails.date === 'object' &&
          editingDetails.date instanceof Date
          ? editingDetails.date.toISOString().split('T')[0]
          : String(editingDetails.date),
        editingDetails.classroom,
      ).then(scheduleInfo => {
        // editingReservationDetailsにscheduleInfo情報をマージ
        const enrichedDetails = {
          ...editingDetails,
          firstStart: scheduleInfo?.firstStart,
          firstEnd: scheduleInfo?.firstEnd,
          secondStart: scheduleInfo?.secondStart,
          secondEnd: scheduleInfo?.secondEnd,
          classroomType: scheduleInfo?.classroomType,
        };

        // スケジュール情報取得完了後にビューを表示
        window.stateManager.dispatch({
          type: 'SET_STATE',
          payload: {
            view: 'editReservation',
            editingReservationDetails: enrichedDetails,
          },
        });

        hideLoading();
      });
    } else {
      showInfo('予約情報が見つかりませんでした。');
    }
  },

  /** 予約情報を更新します */
  updateReservation: () => {
    const d = stateManager.getState().editingReservationDetails;
    const safeD = d ? convertToReservationData(d) : null;
    const startTime = getTimeValue('res-start-time', safeD, 'startTime');
    const endTime = getTimeValue('res-end-time', safeD, 'endTime');

    const p = {
      reservationId: d.reservationId,
      classroom: d.classroom,
      studentId: stateManager.getState().currentUser.studentId,
      chiselRental: document.getElementById('option-rental')?.checked || false,
      firstLecture:
        document.getElementById('option-first-lecture')?.checked || false,
      startTime: startTime,
      endTime: endTime,
      // バックエンドとの互換性のため、ヘッダー形式も併記
      [CONSTANTS.HEADERS.RESERVATIONS?.START_TIME || 'startTime']: startTime,
      [CONSTANTS.HEADERS.RESERVATIONS?.END_TIME || 'endTime']: endTime,
      workInProgress: document.getElementById('wip-input').value,
      order: document.getElementById('order-input').value,
      messageToTeacher: document.getElementById('message-input').value,
      materialInfo: document.getElementById('material-input')?.value || '',
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
                isDataFresh: true, // 最新データ受信済み
              },
            });
          } else {
            window.stateManager.dispatch({
              type: 'SET_STATE',
              payload: {
                view: 'dashboard',
                isDataFresh: false, // 再読み込み必要
              },
            });
          }
          showInfo(r.message || '予約内容を更新しました。', '更新完了');
        } else {
          showInfo(r.message || '更新に失敗しました。');
        }
      },
    )
      ['withFailureHandler']((/** @type {Error} */ error) => {
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
    console.log('🔘 showClassroomModal 開始');
    console.log('🔘 CONSTANTS.CLASSROOMS:', CONSTANTS.CLASSROOMS);
    console.log('🔘 教室数:', Object.keys(CONSTANTS.CLASSROOMS || {}).length);

    if (CONSTANTS.CLASSROOMS && Object.keys(CONSTANTS.CLASSROOMS).length > 0) {
      // 既存のモーダルがあれば削除（重複防止）
      const existingModal = document.getElementById(
        'classroom-selection-modal',
      );
      if (existingModal) {
        console.log('🔘 既存モーダル削除');
        existingModal.remove();
      }

      // 新しいモーダルを生成・追加
      console.log('🔘 モーダルHTML生成開始');
      const modalHtml = getClassroomSelectionModal();
      console.log(
        '🔘 モーダルHTML生成完了:',
        modalHtml.substring(0, 200) + '...',
      );

      document.body.insertAdjacentHTML('beforeend', modalHtml);
      console.log('🔘 モーダルHTML追加完了');

      // モーダル要素が存在するか確認
      const modalElement = document.getElementById('classroom-selection-modal');
      console.log('🔘 モーダル要素:', modalElement);
      console.log('🔘 モーダル要素のクラス:', modalElement?.className);

      // モーダルを表示
      console.log('🔘 Components.showModal 実行開始');
      Components.showModal('classroom-selection-modal');

      // 表示後の状態確認
      setTimeout(() => {
        const modalAfter = document.getElementById('classroom-selection-modal');
        console.log('🔘 表示後のモーダル:', modalAfter);
        console.log('🔘 表示後のクラス:', modalAfter?.className);
        console.log(
          '🔘 hidden含む?:',
          modalAfter?.classList.contains('hidden'),
        );
        console.log(
          '🔘 active含む?:',
          modalAfter?.classList.contains('active'),
        );
      }, 50);

      // デバッグ用: モーダル内のボタンを確認
      setTimeout(() => {
        const modalButtons = document.querySelectorAll(
          '#classroom-selection-modal [data-action="selectClassroom"]',
        );
        console.log('🔘 モーダル内ボタン数:', modalButtons.length);
        modalButtons.forEach((btn, index) => {
          console.log(`🔘 ボタン${index + 1}:`, {
            action: btn.dataset['action'],
            classroomName: btn.dataset['classroomName'],
            classroom: btn.dataset['classroom'],
            text: btn.textContent,
          });
        });

        // モーダルの詳細状態を1秒後に再確認
        setTimeout(() => {
          const modalFinal = document.getElementById(
            'classroom-selection-modal',
          );
          console.log('🔘 1秒後のモーダル状態:', {
            element: modalFinal,
            hidden: modalFinal?.classList.contains('hidden'),
            active: modalFinal?.classList.contains('active'),
            display: modalFinal?.style.display,
            opacity: window.getComputedStyle(modalFinal)?.opacity,
          });
        }, 1000);
      }, 100);
    } else {
      // 教室情報がない場合はデータを更新
      console.log('🔘 教室情報なし');
      showInfo('教室情報の取得に失敗しました。ホームに戻ります。');
      reservationActionHandlers.goBackToDashboard({});
    }
  },

  /** 教室選択モーダルを閉じます */
  closeClassroomModal: () => {
    Components.closeModal('classroom-selection-modal');
  },

  /** 教室を選択し、予約枠一覧画面に遷移します */
  selectClassroom: d => {
    if (!window.isProduction) {
      debugLog(`=== selectClassroom呼び出し: d=${JSON.stringify(d)} ===`);
    }

    // データ取得の複数の方法を試行
    let classroomName = null;

    if (d && d.classroomName) {
      classroomName = d.classroomName;
    } else if (d && d.classroom) {
      classroomName = d.classroom;
    } else if (d && d['classroom-name']) {
      classroomName = d['classroom-name'];
    }

    if (!window.isProduction) {
      debugLog(`=== 教室名: ${classroomName} ===`);
      debugLog(`=== データキー: ${Object.keys(d || {})} ===`);
    }

    if (classroomName) {
      if (!window.isProduction) {
        debugLog(`=== 教室名取得成功: ${classroomName} ===`);
      }
      // 教室選択モーダルを閉じる
      reservationActionHandlers.closeClassroomModal({});
      // 常にupdateLessonsAndGoToBookingを呼び出し（内部で鮮度チェックを実行）
      reservationActionHandlers.updateLessonsAndGoToBooking(classroomName);
    } else {
      if (!window.isProduction) {
        debugLog(`=== 教室名取得失敗: d=${JSON.stringify(d)} ===`);
      }
      showInfo('予約枠の取得に失敗しました。時間をおいて再度お試しください。');
    }
  },

  /** スロット情報を更新してから予約枠画面に遷移します（設計書準拠） */
  updateLessonsAndGoToBooking: classroomName => {
    // 更新中の場合は処理をスキップ
    if (stateManager.getState()._dataUpdateInProgress) {
      return;
    }

    // 一度だけローディングを表示
    showLoading('booking');

    google.script.run['withSuccessHandler'](
      (
        /** @type {ServerResponse<Record<string, string>>} */ versionResponse,
      ) => {
        if (versionResponse.success && versionResponse.data) {
          const currentLessonsVersion = stateManager.getState()._lessonsVersion;
          const serverLessonsVersion = versionResponse.data['lessonsComposite'];

          // バージョンが同じ（データに変更なし）で、既に講座データがある場合は即座に遷移
          if (
            currentLessonsVersion === serverLessonsVersion &&
            stateManager.getState().lessons &&
            stateManager.getState().lessons.length > 0
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

          // バージョンが異なる場合、または初回の場合は最新データを取得（ローディングは継続）
          reservationActionHandlers.fetchLatestLessonsData(
            classroomName,
            serverLessonsVersion,
          );
        } else {
          // バージョンチェック失敗時はフォールバック（全データ取得、ローディングは継続）
          reservationActionHandlers.fetchLatestLessonsData(classroomName, null);
        }
      },
    )
      ['withFailureHandler']((/** @type {Error} */ error) => {
        // エラー時もフォールバック（全データ取得、ローディングは継続）
        reservationActionHandlers.fetchLatestLessonsData(classroomName, null);
      })
      .getCacheVersions();
  },

  /** 最新の講座データを取得する（内部処理） */
  fetchLatestLessonsData: (classroomName, newLessonsVersion) => {
    // ローディングは既に親関数で表示済み

    google.script.run['withSuccessHandler']((/** @type {any} */ response) => {
      hideLoading();

      // デバッグログ追加（本番環境では無効化）
      if (!window.isProduction) {
        debugLog('fetchLatestLessonsData レスポンス受信');
        debugLog('response.success: ' + response.success);
        debugLog('response.data: ' + (response.data ? 'あり' : 'なし'));
      }
      if (response.data) {
        debugLog(
          'response.data.lessons: ' +
            (response.data.lessons
              ? `${response.data.lessons.length}件`
              : 'なし'),
        );
      }

      debugLog(`=== getBatchData レスポンス: ${JSON.stringify(response)} ===`);
      debugLog(
        `=== レスポンス詳細: success=${response?.success}, hasData=${!!response?.data}, hasLessons=${!!response?.data?.lessons} ===`,
      );

      if (response.success && response.data && response.data.lessons) {
        debugLog(`講座データ更新: ${response.data.lessons.length}件`);
        // 講座データとバージョン情報を更新
        window.stateManager.dispatch({
          type: 'SET_STATE',
          payload: {
            lessons: response.data.lessons,
            selectedClassroom: classroomName,
            view: 'bookingLessons',
            isDataFresh: true,
            _lessonsVersion: newLessonsVersion, // バージョン情報を保存
          },
        });
      } else {
        debugLog('空き枠データ取得失敗');
        debugLog(`=== 失敗の詳細: response=${JSON.stringify(response)} ===`);
        if (response.message) {
          debugLog('エラーメッセージ: ' + response.message);
        }
        showInfo(
          '予約枠の取得に失敗しました。時間をおいて再度お試しください。',
        );
      }
    })
      ['withFailureHandler']((/** @type {Error} */ error) => {
        hideLoading();
        showInfo(
          '予約枠の取得に失敗しました。時間をおいて再度お試しください。',
        );
        Logger.log(`fetchLatestLessonsDataエラー: ${error}`);
      })
      .getBatchData(['lessons'], stateManager.getState().currentUser.phone);
  },

  /** 予約枠を選択し、予約確認画面に遷移します */
  bookLesson: d => {
    const foundLesson = stateManager
      .getState()
      .lessons.find(
        lesson =>
          lesson.schedule.classroom === d.classroom &&
          lesson.schedule.date === d.date,
      );
    if (foundLesson) {
      // 空席数に基づいてisFull状態を確実に設定
      const isFullLesson =
        foundLesson.status.isFull ||
        foundLesson.status.availableSlots === 0 ||
        (typeof foundLesson.status.morningSlots !== 'undefined' &&
          foundLesson.status.morningSlots === 0 &&
          foundLesson.status.afternoonSlots === 0);
      window.stateManager.dispatch({
        type: 'SET_STATE',
        payload: {
          selectedLesson: {
            ...foundLesson,
            isFull: isFullLesson,
          },
          view: 'newReservation',
        },
      });
    } else {
      showInfo('エラーが発生しました。選択した予約枠が見つかりません。');
    }
  },

  /** ホーム（メイン画面）に遷移（別名） */
  goBackToDashboard: () => reservationActionHandlers.goToDashboard({}),

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
      stateManager.getState().selectedLesson?.schedule?.classroom ||
      stateManager.getState().accountingReservation?.classroom ||
      stateManager.getState().editingReservationDetails?.classroom;

    // スロット情報の鮮度をチェックして必要に応じて更新
    if (
      !stateManager.getState().isDataFresh &&
      !stateManager.getState()._dataUpdateInProgress
    ) {
      reservationActionHandlers.updateLessonsAndGoToBooking(targetClassroom);
    } else {
      window.stateManager.dispatch({
        type: 'SET_STATE',
        payload: {
          view: 'bookingLessons',
          selectedClassroom: targetClassroom,
        },
      });
    }
  },
};