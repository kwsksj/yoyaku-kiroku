// @ts-check
/// <reference path="../types.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 14_WebApp_Handlers.js
 * 【バージョン】: 1.6
 * 【役割】: WebAppのフロントエンドにおける、ユーザーの操作に応じた
 * アクションと、アプリケーション全体の制御フローを集約します。
 * 【構成】: 14ファイル構成のうちの14番目
 * 【v1.6での変更点】:
 * - FE-14: 会計入力のキャッシュ機能を追加。
 *   - localStorageへの保存、読み込み、削除処理を実装。
 *   - 画面遷移、保存、キャンセル時にキャッシュを適切に操作するよう修正。
 * =================================================================
 */

// =================================================================
// --- Time Data Helper Functions ---
// -----------------------------------------------------------------
// 時刻データの取得・処理を行うヘルパー関数群
// =================================================================

/**
 * 時刻データを適切に取得するヘルパー関数
 * @param {string} elementId - 時刻入力要素のID
 * @param {object} reservationData - 予約データ（フォールバック用）
 * @param {string} timeField - 時刻フィールド名（'startTime' or 'endTime'）
 * @returns {string} 時刻文字列（HH:mm形式）
 */
function getTimeValue(elementId, reservationData, timeField) {
  // 1. HTML要素から取得を試行
  const elementValue = document.getElementById(elementId)?.value;
  if (elementValue && elementValue !== '') {
    return elementValue;
  }

  // 2. 予約データから取得を試行（編集時）
  if (reservationData) {
    const headerField =
      CONSTANTS.HEADERS.RESERVATIONS?.[timeField.toUpperCase()] || timeField;
    const timeValue =
      reservationData[headerField] || reservationData[timeField];
    if (timeValue && timeValue !== '') {
      return timeValue;
    }
  }

  // 3. selectedLessonから取得を試行（新規作成時）
  const selectedLesson = stateManager.getState().selectedLesson;
  if (selectedLesson) {
    const headerField =
      CONSTANTS.HEADERS.RESERVATIONS?.[timeField.toUpperCase()] || timeField;

    // セッション制教室の場合、スケジュール情報から取得
    if (
      selectedLesson.classroomType === CONSTANTS.CLASSROOM_TYPES.SESSION_BASED
    ) {
      if (timeField === 'startTime') {
        return selectedLesson.firstStart || selectedLesson.secondStart || '';
      } else if (timeField === 'endTime') {
        return selectedLesson.firstEnd || selectedLesson.secondEnd || '';
      }
    }

    // 時間制教室の場合、selectedLessonから取得
    const lessonValue =
      selectedLesson[headerField] || selectedLesson[timeField];
    if (lessonValue && lessonValue !== '') {
      return lessonValue;
    }
  }

  return '';
}

// =================================================================
// --- Accounting Cache Helper Functions (FE-14) ---
// -----------------------------------------------------------------
// 会計フォームのデータを操作するためのヘルパー関数群
// =================================================================

/**
 * 会計フォームから現在の入力内容をオブジェクトとして取得します。
 * @returns {object} フォームデータ
 */
function getAccountingFormData() {
  const form = document.getElementById('accounting-form');
  if (!form) return {};

  const data = {};
  const elements = form.elements;

  for (let i = 0; i < elements.length; i++) {
    const item = elements[i];
    if (item.name) {
      if (item.type === 'checkbox') {
        data[item.name] = item.checked;
      } else if (item.type === 'radio') {
        if (item.checked) {
          data[item.name] = item.value;
        }
      } else {
        data[item.name] = item.value;
      }
    }
  }
  return data;
}

// =================================================================
// --- Action Handlers ---
// -----------------------------------------------------------------
// ユーザーの操作（ボタンクリックなど）を起点として実行される
// 全ての処理を定義するオブジェクトです。
// 各キーが data-action 属性に対応します。
// =================================================================
const actionHandlers = {
  /** スマートナビゲーション: 前の画面に戻る */
  smartGoBack: () => {
    const backState = stateManager.goBack();
    stateManager.dispatch({
      type: 'SET_STATE',
      payload: backState,
    });
  },

  /** ログインまたは新規登録を開始します（キャッシュ活用版） */
  login: () => {
    const p = document.getElementById('phone').value;
    // 入力値をsetState経由で保存
    window.stateManager.dispatch({
      type: 'UPDATE_STATE',
      payload: { loginPhone: p },
    });
    if (!p) return showInfo('電話番号を入力してください。');

    // フロントエンドで電話番号を正規化（即時エラー表示）
    const normalizeResult = window.normalizePhoneNumberFrontend(p);

    if (!normalizeResult.isValid) {
      showInfo(normalizeResult.error || '電話番号の形式が正しくありません。');
      return;
    }

    showLoading('login');
    // 正規化に成功した場合は直接ログイン処理を実行（1回のAPI呼び出し）
    actionHandlers.processLoginWithValidatedPhone(normalizeResult.normalized);
  },

  /** 検証済み電話番号でのログイン処理 */
  processLoginWithValidatedPhone: normalizedPhone => {
    // 環境分岐: テスト環境の場合はモックデータを使用

    // 本番環境: 統合エンドポイントで初期データと空席情報を一括取得
    google.script.run
      .withSuccessHandler(response => {
        // ← この response には、サーバーサイドの getLoginData 関数の戻り値が格納されます。

        // デバッグ情報を画面に表示（本番環境では無効化）
        if (!window.isProduction) {
          debugLog('初期データ取得完了');
          debugLog('response.success: ' + response.success);
          debugLog('response.userFound: ' + response.userFound);
          debugLog(
            'response.data.lessons: ' +
              (response.data.lessons
                ? response.data.lessons.length + '件'
                : 'null/undefined'),
          );
          debugLog(
            'response.data: ' + (response.data ? 'あり' : 'null/undefined'),
          );
        }

        if (response.success && response.userFound) {
          // ユーザーが見つかった場合：クライアントサイド処理で状態構築
          const newAppState = processInitialData(
            response.data,
            normalizedPhone,
            response.data.lessons,
            response.data.myReservations,
          );
          debugLog(
            'processInitialData完了 - lessons: ' +
              (newAppState.lessons
                ? newAppState.lessons.length + '件'
                : 'null'),
          );
          debugLog(
            'processInitialData完了 - classrooms: ' +
              JSON.stringify(newAppState.classrooms),
          );

          window.stateManager.dispatch({
            type: 'SET_STATE',
            payload: {
              ...newAppState,
              // サーバーから取得した定数を使って、表示する履歴の初期件数を設定
              recordsToShow: CONSTANTS.UI.HISTORY_INITIAL_RECORDS || 10,
              isDataFresh: true,
            },
          });
        } else {
          // ユーザーが見つからない場合または特別コマンド認識時の分岐処理
          if (response.commandRecognized) {
            // 特殊コマンドが認識された場合はuserSearch画面に遷移
            window.stateManager.dispatch({
              type: 'SET_STATE',
              payload: {
                view: 'userSearch',
                searchedUsers: [],
                selectedSearchedUser: null,
                searchAttempted: false,
              },
            });
          } else {
            // 通常のユーザー未登録の場合は新規登録画面に遷移
            window.stateManager.dispatch({
              type: 'SET_STATE',
              payload: {
                view: 'register',
                registrationPhone: normalizedPhone,
              },
            });
          }
        }
      })
      .withFailureHandler(err => {
        hideLoading();
        if (!window.isProduction) {
          debugLog('初期データ取得エラー: ' + err.message);
        }
        handleServerError(err);
      })
      .getLoginData(normalizedPhone);
  },

  /** 新しいログインフロー（メインのloginに統合済み） */

  /** 新規ユーザー登録：Step1からStep2へ */
  goToStep2: () => {
    const realName = document.getElementById('reg-realname').value;
    const nickname = document.getElementById('reg-nickname').value.trim();
    const phone = document.getElementById('reg-phone').value;

    if (!realName) return showInfo('お名前（本名）は必須です。');

    // フロントエンドで電話番号を正規化・バリデーション
    if (phone) {
      const normalizeResult = window.normalizePhoneNumberFrontend(phone);
      if (!normalizeResult.isValid) {
        showInfo(normalizeResult.error || '電話番号の形式が正しくありません。');
        return;
      }
    }

    // 入力値をsetState経由で保存
    const updatedRegistrationData = {
      ...stateManager.getState().registrationData,
      phone,
      realName,
      nickname: nickname || realName,
    };
    window.stateManager.dispatch({
      type: 'SET_STATE',
      payload: {
        registrationData: updatedRegistrationData,
        registrationStep: 2,
        view: 'registrationStep2',
      },
    });
  },

  /** 新規ユーザー登録：Step2からStep1へ戻る */
  backToStep1: () => {
    const realName = document.getElementById('reg-realname')?.value;
    const nickname = document.getElementById('reg-nickname')?.value;
    const phone = document.getElementById('reg-phone')?.value;
    if (realName || nickname || phone) {
      const updatedRegistrationData = {
        ...stateManager.getState().registrationData,
        realName:
          realName || stateManager.getState().registrationData?.realName || '',
        nickname:
          nickname || stateManager.getState().registrationData?.nickname || '',
        phone: phone || stateManager.getState().registrationData?.phone || '',
      };
      window.stateManager.dispatch({
        type: 'SET_STATE',
        payload: { registrationData: updatedRegistrationData },
      });
    }
    window.stateManager.dispatch({
      type: 'SET_STATE',
      payload: { view: 'register', registrationStep: 1 },
    });
  },

  /** 新規ユーザー登録：Step2からStep3へ進む */
  goToStep3: () => {
    const email = document.getElementById('q-email').value;
    if (!email || !email.includes('@')) {
      return showInfo('有効なメールアドレスを入力してください。');
    }

    const step2Data = {
      email: email,
      wantsEmail: document.getElementById('q-wants-email').checked,
      ageGroup: document.getElementById('q-age-group').value,
      gender:
        document.querySelector('input[name="gender"]:checked')?.value || '',
      dominantHand:
        document.querySelector('input[name="dominantHand"]:checked')?.value ||
        '',
      address: document.getElementById('q-address').value,
    };

    window.stateManager.dispatch({
      type: 'SET_STATE',
      payload: {
        registrationData: {
          ...stateManager.getState().registrationData,
          ...step2Data,
        },
        registrationStep: 3,
        view: 'registrationStep3',
      },
    });
  },

  /** 新規ユーザー登録：Step3からStep2へ戻る */
  backToStep2: () =>
    window.stateManager.dispatch({
      type: 'SET_STATE',
      payload: { view: 'registrationStep2', registrationStep: 2 },
    }),

  /** 新規ユーザー登録：Step3からStep4へ進む */
  proceedToStep4: () => {
    const step3Data = {
      experience:
        document.querySelector('input[name="experience"]:checked')?.value || '',
      pastWork: document.getElementById('q-past-work').value,
      futureGoal: document.getElementById('q-future-goal').value,
    };
    window.stateManager.dispatch({
      type: 'SET_STATE',
      payload: {
        registrationData: {
          ...stateManager.getState().registrationData,
          ...step3Data,
        },
        registrationStep: 4,
        view: 'registrationStep4',
      },
    });
  },

  /** 新規ユーザー登録：Step4からStep3へ戻る */
  backToStep3: () =>
    window.stateManager.dispatch({
      type: 'SET_STATE',
      payload: { view: 'registrationStep3', registrationStep: 3 },
    }),

  /** 新規ユーザー登録：最終データをサーバーに送信（バッチ処理版） */
  submitRegistration: () => {
    const step4Data = {
      futureParticipation:
        document.querySelector('input[name="futureParticipation"]:checked')
          ?.value || '',
      trigger: document.getElementById('q-trigger').value,
      firstMessage: document.getElementById('q-first-message').value,
    };

    const finalUserData = {
      ...stateManager.getState().registrationData,
      ...step4Data,
    };

    showLoading('login');
    google.script.run
      .withSuccessHandler(res => {
        if (res.success) {
          // 登録後、バッチ処理で初期データと空席情報を一括取得
          google.script.run
            .withSuccessHandler(batchResult => {
              if (batchResult.success) {
                const newAppState = processInitialData(
                  batchResult.data.initial,
                  res.user.phone,
                  batchResult.data.lessons,
                );

                window.stateManager.dispatch({
                  type: 'SET_STATE',
                  payload: {
                    ...newAppState,
                    currentUser: res.user,
                    view: 'dashboard',
                  },
                });
                hideLoading();
              } else {
                hideLoading();
                showInfo(
                  batchResult.message || 'データの取得に失敗しました',
                  'エラー',
                );
              }
            })
            .withFailureHandler(handleServerError)
            .getBatchData(['initial', 'lessons'], res.user.phone);
        } else {
          hideLoading();
          showInfo(res.message || '登録に失敗しました');
        }
      })
      .withFailureHandler(handleServerError)
      .registerNewUser(finalUserData);
  },

  /** きろくカードの確認/編集ボタン */
  expandHistoryCard: d => {
    // 履歴データを取得
    const item = stateManager
      .getState()
      .myReservations.find(h => h.reservationId === d.reservationId);
    if (!item) return;

    // 編集モード状態をトグル
    const isCurrentlyEditing = stateManager.isInEditMode(d.reservationId);

    if (isCurrentlyEditing) {
      // 編集モード解除
      stateManager.endEditMode(d.reservationId);
    } else {
      // 編集モード開始
      stateManager.startEditMode(d.reservationId);
    }

    // 該当カードのみを部分更新（ちらつき防止）
    updateSingleHistoryCard(d.reservationId);
  },

  /** インライン編集のメモを保存 */
  saveInlineMemo: d => {
    // textarea要素から直接値を取得
    const textarea = document.querySelector(
      `[data-reservation-id="${d.reservationId}"] .memo-edit-textarea`,
    );
    if (!textarea) return;

    const newMemo = textarea.value;

    // 楽観的UI: まずフロントの表示を更新
    const state = window.stateManager.getState();
    const newReservations = state.myReservations.map(h => {
      if (h.reservationId === d.reservationId) {
        return { ...h, workInProgress: newMemo };
      }
      return h;
    });
    window.stateManager.dispatch({
      type: 'UPDATE_STATE',
      payload: { myReservations: newReservations },
    });

    // 編集モードを解除
    stateManager.endEditMode(d.reservationId);

    showInfo('メモを保存しました');

    // 該当カードのみを部分更新（ちらつき防止）
    updateSingleHistoryCard(d.reservationId);

    // サーバーに送信
    showLoading();
    google.script.run
      .withSuccessHandler(r => {
        hideLoading();
        if (!r.success) {
          showInfo(r.message || 'メモの保存に失敗しました');
          // フロント表示を元に戻す
          updateSingleHistoryCard(d.reservationId);
        }
      })
      .withFailureHandler(handleServerError)
      .updateReservationMemoAndGetLatestData(
        d.reservationId,
        stateManager.getState().currentUser.studentId,
        newMemo,
      );
  },

  /** プロフィール情報を保存します（キャッシュ活用版） */
  saveProfile: () => {
    const r = document.getElementById('edit-realname').value;
    let n = document.getElementById('edit-nickname').value.trim();
    if (!r) return showInfo('お名前（本名）は必須です。');
    if (!n) n = r;

    // NF-01: 電話番号入力欄があればその値も取得
    const phoneInput = document.getElementById('edit-phone');
    const phone = phoneInput
      ? phoneInput.value
      : stateManager.getState().currentUser.phone; // 電話番号入力欄がなければ既存の電話番号を使用

    // メール情報の取得
    const emailInput = document.getElementById('edit-email');
    const wantsEmailInput = document.getElementById('edit-wants-email');
    const email = emailInput
      ? emailInput.value
      : stateManager.getState().currentUser.email;
    const wantsEmail = wantsEmailInput
      ? wantsEmailInput.checked
      : stateManager.getState().currentUser.wantsEmail;

    const u = {
      ...stateManager.getState().currentUser,
      realName: r,
      displayName: n,
      phone: phone,
      email: email || '',
      wantsEmail: wantsEmail || false,
    };
    showLoading();
    google.script.run
      .withSuccessHandler(res => {
        hideLoading();
        if (res.success) {
          // プロフィール更新後、キャッシュも更新されているのでそのまま状態更新
          showInfo('プロフィールを更新しました', '更新完了');
          window.stateManager.dispatch({
            type: 'SET_STATE',
            payload: { currentUser: res.updatedUser, view: 'dashboard' },
          });
        } else {
          showInfo(res.message || '更新に失敗しました');
        }
      })
      .withFailureHandler(handleServerError)
      .updateUserProfile(u);
  },

  /**
   * NF-01: 電話番号未登録ユーザーの検索を実行します（キャッシュ活用版）。
   */
  searchUserByName: () => {
    const searchInput = document.getElementById('nickname-search-input');
    const searchTerm = searchInput ? searchInput.value.trim() : ''; // 検索語をsearchTermに変更

    if (!searchTerm) {
      return showInfo('お名前（本名）またはニックネームを入力してください。');
    }

    showLoading('login');

    // 検索語からスペースを除去して小文字化して比較に使う
    const normalizedSearchTerm = searchTerm.replace(/\s+/g, '').toLowerCase();

    google.script.run
      .withSuccessHandler(response => {
        hideLoading();
        if (response.success) {
          // 【統一レスポンス形式】データ構造の修正
          // searchName (スペース除去済み・小文字化された結合名) を使ってフィルタリング
          const filteredUsers = response.data.filter(
            user =>
              user.searchName && user.searchName.includes(normalizedSearchTerm),
          );

          // NF-01: 検索が試行されたことを示すフラグをセット
          window.stateManager.dispatch({
            type: 'SET_STATE',
            payload: { searchedUsers: filteredUsers, searchAttempted: true },
          });

          if (filteredUsers.length === 0) {
            // アカウントが見つからなかった場合のメッセージはビュー側で表示
          }
        } else {
          showInfo(response.message || 'ユーザー検索に失敗しました。');
        }
      })
      .withFailureHandler(handleServerError)
      .searchUsersWithoutPhone(searchTerm);
  },

  /**
   * NF-01: 検索結果から電話番号未登録ユーザーを選択します（バッチ処理版）。
   */
  selectSearchedUser: d => {
    // ボタンに埋め込まれたデータから、まず仮のユーザー情報を作成
    const tempUser = {
      studentId: d.studentId,
      realName: d.realName, // ボタンのdata属性から取得
      displayName: d.nickname, // ボタンのdata属性から取得
      phone: '', // 電話番号はまだないので空
    };

    showLoading('login');

    // バッチ処理で初期データ、空席情報、ユーザーデータを一括取得
    google.script.run
      .withSuccessHandler(response => {
        if (response.success) {
          // tempUserの情報でcurrentUserを上書きしつつ、キャッシュデータを活用
          const userFromCache =
            response.data.initial.allStudents[tempUser.studentId];
          const finalUser = userFromCache
            ? {
                ...userFromCache,
                displayName: tempUser.displayName,
                phone: tempUser.phone,
              }
            : tempUser;

          // 個人予約データを直接取得（フィルタリングは表示時に実行）
          const myReservations = response.data.myReservations || [];
          const today = response.data.initial.today;

          window.stateManager.dispatch({
            type: 'SET_STATE',
            payload: {
              currentUser: finalUser,
              lessons: response.data.lessons,
              myReservations: myReservations,
              accountingMaster: response.data.initial.accountingMaster,
              recordsToShow: 10, // UI.HISTORY_INITIAL_RECORDSで後で更新
              view: 'editProfile', // 電話番号登録を促すためプロフィール編集画面へ
              today: today,
              _allStudents: response.data.initial.allStudents,
              _cacheVersions: response.data.initial.cacheVersions,
            },
          });
        } else {
          hideLoading();
          showInfo(response.message || 'データの読み込みに失敗しました。');
        }
      })
      .withFailureHandler(handleServerError)
      .getBatchData(
        ['initial', 'lessons', 'reservations'],
        null,
        tempUser.studentId,
      );
  },

  /**
   * NF-01: 自分のアカウントが見つからなかった場合に新規登録画面へ遷移します。
   */
  goToRegisterFromUserSearch: () => {
    // 新規登録画面へ遷移。電話番号は未入力のまま。
    window.stateManager.dispatch({
      type: 'SET_STATE',
      payload: { view: 'register', registrationPhone: '' },
    });
  },

  /** 予約をキャンセルします */
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
      confirmText: 'はい　取り消します',
      cancelText: 'いいえ',
      confirmColorClass: DesignConfig.colors.danger,
      onConfirm: () => {
        showLoading('cancel');
        const cancelMessage =
          document.getElementById('cancel-message')?.value || '';
        const p = {
          ...d,
          studentId: stateManager.getState().currentUser.studentId,
          cancelMessage: cancelMessage,
        };
        google.script.run
          .withSuccessHandler(r => {
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
              showInfo(r.message || '予約を取り消しました。', 'キャンセル完了');
            } else {
              showInfo(r.message || 'キャンセル処理に失敗しました。');
            }
          })
          .withFailureHandler(err => {
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
    const isFirstTimeBooking = stateManager.getState().isFirstTimeBooking;

    // 現在見ている予約枠の時間情報を取得
    const selectedLesson = stateManager.getState().selectedLesson;

    // 教室形式に応じて時間を設定（ヘルパー関数使用）
    const startTime = getTimeValue('res-start-time', null, 'startTime');
    const endTime = getTimeValue('res-end-time', null, 'endTime');

    // デバッグ用ログ
    console.log(`selectedLesson.classroomType: "${selectedLesson?.classroomType}"`);
    console.log(`CONSTANTS.CLASSROOM_TYPES.SESSION_BASED: "${CONSTANTS.CLASSROOM_TYPES.SESSION_BASED}"`);
    console.log(`比較結果: ${selectedLesson?.classroomType === CONSTANTS.CLASSROOM_TYPES.SESSION_BASED}`);
    
    if (
      selectedLesson?.classroomType === CONSTANTS.CLASSROOM_TYPES.SESSION_BASED
    ) {
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

    const p = {
      ...selectedLesson,
      // 時間情報を上書き（教室形式に応じて調整済み）
      startTime: startTime,
      endTime: endTime,
      // バックエンドとの互換性のため、ヘッダー形式も併記
      [CONSTANTS.HEADERS.RESERVATIONS?.START_TIME || 'startTime']: startTime,
      [CONSTANTS.HEADERS.RESERVATIONS?.END_TIME || 'endTime']: endTime,
      user: stateManager.getState().currentUser,
      studentId: stateManager.getState().currentUser.studentId,
      options: bookingOptions,
    };

    google.script.run
      .withSuccessHandler(r => {
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
      .withFailureHandler(handleServerError)
      .makeReservationAndGetLatestData(p);
  },

  /** 予約編集画面に遷移します（予約データはキャッシュから取得済み） */
  goToEditReservation: d => {
    showLoading('dataFetch');
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
        editingDetails.date,
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
    const startTime = getTimeValue('res-start-time', d, 'startTime');
    const endTime = getTimeValue('res-end-time', d, 'endTime');

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
    google.script.run
      .withSuccessHandler(r => {
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
          showInfo(r.message || '予約内容を更新しました。', '更新完了');
        } else {
          showInfo(r.message || '更新に失敗しました。');
        }
      })
      .withFailureHandler(handleServerError)
      .updateReservationDetailsAndGetLatestData(p);
  },

  /** 会計画面に遷移します（予約データはキャッシュから取得済み） */
  goToAccounting: d => {
    showLoading('accounting');
    const reservationId = d.reservationId;

    // 【修正】統一検索関数を使用してよやく・きろく両方から検索
    const reservationData = findReservationById(reservationId);

    if (reservationData) {
      // 予約が有効な場合のみキャッシュを読み込み
      const cachedData = loadAccountingCache(reservationId);
      const baseDetails = {
        firstLecture: reservationData.firstLecture || false,
        chiselRental: reservationData.chiselRental || false,
        [CONSTANTS.HEADERS.RESERVATIONS?.START_TIME || 'startTime']:
          reservationData[CONSTANTS.HEADERS.RESERVATIONS?.START_TIME] ||
          reservationData.startTime ||
          null,
        [CONSTANTS.HEADERS.RESERVATIONS?.END_TIME || 'endTime']:
          reservationData[CONSTANTS.HEADERS.RESERVATIONS?.END_TIME] ||
          reservationData.endTime ||
          null,
      };

      // 予約固有情報（個人の予約詳細）
      const reservationDetails = { ...baseDetails, ...cachedData };

      // 講座固有情報を取得完了後に画面を表示
      getScheduleInfoFromCache(
        reservationData.date,
        reservationData.classroom,
      ).then(scheduleInfo => {
        // スケジュール情報取得完了後にビューを表示
        window.stateManager.dispatch({
          type: 'SET_STATE',
          payload: {
            view: 'accounting',
            accountingReservation: d,
            accountingReservationDetails: reservationDetails,
            accountingScheduleInfo: scheduleInfo,
          },
        });

        // ビュー遷移後に初期計算を実行（DOM構築完了を確実に待つ）
        setTimeout(() => {
          // 会計フォームのDOM構築完了を確認してから計算実行
          const form = document.getElementById('accounting-form');
          if (form) {
            calculateAccountingDetails(); // UI更新も含む統一関数を使用
          } else {
            // DOMがまだ構築されていない場合はもう少し待つ
            setTimeout(() => {
              calculateAccountingDetails(); // UI更新も含む統一関数を使用
            }, 100);
          }
        }, 300);
        hideLoading();
      });
    } else {
      hideLoading();
      showInfo('予約・記録情報が見つかりませんでした。');
    }
  },

  /** 履歴から会計詳細をモーダルで表示します（データはキャッシュから取得済み） */
  showHistoryAccounting: d => {
    const reservationId = d.reservationId;

    if (!reservationId) {
      showInfo('予約IDが見つかりません');
      return;
    }

    showLoading();

    // バックエンドから会計詳細を取得
    google.script.run
      .withSuccessHandler(response => {
        hideLoading();

        if (!response.success) {
          showInfo(response.message || '会計データの取得に失敗しました');
          return;
        }

        const details = response.data;

        // 授業料項目のHTML生成
        const tuitionItemsHtml = (details.tuition?.items || [])
          .map(i => `<li>${i.name}: ${i.price.toLocaleString()}円</li>`)
          .join('');

        // 販売項目のHTML生成
        const salesItemsHtml = (details.sales?.items || [])
          .map(i => `<li>${i.name}: ${i.price.toLocaleString()}円</li>`)
          .join('');

        const message = `
          <div class="p-4 bg-brand-light rounded-lg text-left space-y-4 text-base">
            ${tuitionItemsHtml ? `<b>授業料</b><ul class="list-disc list-inside">${tuitionItemsHtml}</ul>` : ''}
            ${salesItemsHtml ? `<b class="mt-1 inline-block">販売</b><ul class="list-disc list-inside">${salesItemsHtml}</ul>` : ''}
            <div class="font-bold mt-1 pt-1 border-t">合計: ${details.grandTotal.toLocaleString()}円</div>
            <div class="text-right text-sm pt-1">支払方法: ${details.paymentMethod}</div>
          </div>`;

        showInfo(message, '会計記録');
      })
      .withFailureHandler(error => {
        hideLoading();
        console.error('会計詳細取得エラー:', error);
        showInfo('会計データの取得中にエラーが発生しました');
      })
      .getAccountingDetailsFromSheet(reservationId);
  },

  /** きろくカードから会計済み内容を修正します */
  editAccountingRecord: d => {
    const reservationId = d.reservationId;

    // きろくから対象の予約データを取得
    const reservationData = findReservationById(reservationId);

    if (!reservationData) {
      showInfo('予約・記録情報が見つかりませんでした。');
      return;
    }

    // 既存の会計データを初期値として設定
    const existingAccountingDetails = reservationData.accountingDetails || {};

    // 予約固有情報（個人の予約詳細）
    const reservationDetails = {
      firstLecture: reservationData.firstLecture || false,
      chiselRental: reservationData.chiselRental || false,
      [CONSTANTS.HEADERS.RESERVATIONS?.START_TIME || 'startTime']:
        reservationData[CONSTANTS.HEADERS.RESERVATIONS?.START_TIME] ||
        reservationData.startTime ||
        null,
      [CONSTANTS.HEADERS.RESERVATIONS?.END_TIME || 'endTime']:
        reservationData[CONSTANTS.HEADERS.RESERVATIONS?.END_TIME] ||
        reservationData.endTime ||
        null,
      // 既存の会計データをすべて反映
      ...existingAccountingDetails,
    };

    showConfirm({
      title: '会計内容の修正',
      message:
        'この操作により、現在の会計記録は削除され、新しい内容で再登録されます。よろしいですか？',
      confirmText: '修正する',
      cancelText: CONSTANTS.MESSAGES.CANCEL || 'キャンセル',
      onConfirm: () => {
        // 講座固有情報を取得完了後に画面を表示
        getScheduleInfoFromCache(
          reservationData.date,
          reservationData.classroom,
        ).then(scheduleInfo => {
          // スケジュール情報取得完了後にビューを表示
          window.stateManager.dispatch({
            type: 'SET_STATE',
            payload: {
              view: 'accounting',
              accountingReservation: d,
              accountingReservationDetails: reservationDetails,
              accountingScheduleInfo: scheduleInfo,
              isEditingAccountingRecord: true,
            },
          });

          // ビュー遷移後に初期計算を実行（DOM構築完了を確実に待つ）
          setTimeout(() => {
            // 会計フォームのDOM構築完了を確認してから計算実行
            const form = document.getElementById('accounting-form');
            if (form) {
              calculateAccountingDetails(); // UI更新も含む統一関数を使用
            } else {
              // DOMがまだ構築されていない場合はもう少し待つ
              setTimeout(() => {
                calculateAccountingDetails(); // UI更新も含む統一関数を使用
              }, 100);
            }
          }, 300);
        });
      },
    });
  },

  /** 会計画面で材料入力行を追加します */
  addMaterialRow: () => {
    const container = document.getElementById('materials-container');
    const newIndex = container.querySelectorAll(
      'div[data-material-row-index]',
    ).length;
    const newRow = document.createElement('div');
    newRow.className = 'mt-4 pt-4 border-t border-ui-border-light';
    newRow.dataset.materialRowIndex = newIndex;
    newRow.innerHTML = Components.materialRow({ index: newIndex });
    container.appendChild(newRow);
  },

  /** 会計画面でその他販売品入力行を追加します */
  addOtherSalesRow: () => {
    const container = document.getElementById('other-sales-container');
    const newIndex = container.querySelectorAll(
      'div[data-other-sales-row]',
    ).length;
    // Components.otherSalesRowが返すHTML文字列を、ラッパーを介さず直接コンテナの末尾に追加する
    container.insertAdjacentHTML(
      'beforeend',
      Components.otherSalesRow({ index: newIndex }),
    );
  },

  /** 会計画面で合計金額をクリップボードにコピーします */
  copyGrandTotal: button => {
    const totalText =
      document.getElementById('grand-total-amount')?.textContent || '';
    const numericTotal = totalText.replace(/[^0-9-]/g, '');
    actionHandlers.copyToClipboard(button, numericTotal);
  },

  /** 指定されたテキストをクリップボードにコピーします */
  copyToClipboard: (button, text) => {
    const textToCopy = text || button.dataset.copyText;
    const textArea = document.createElement('textarea');
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    textArea.value = textToCopy.replace(/,/g, '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        const originalText = button.textContent;
        button.textContent = 'コピーしました!';
        setTimeout(() => {
          button.textContent = originalText;
        }, 2000);
      } else {
        showInfo('コピーに失敗しました。');
      }
    } catch (err) {
      showInfo('コピーに失敗しました。');
      // エラーログは開発環境でのみ出力
      if (typeof console !== 'undefined' && console.error) {
        console.error('Clipboard copy failed:', err);
      }
    }
    document.body.removeChild(textArea);
  },

  /** 参加記録を追加で読み込みます（統合ホーム用） */
  loadMoreHistory: () => {
    const newCount =
      stateManager.getState().recordsToShow +
      (CONSTANTS.UI.HISTORY_LOAD_MORE_RECORDS || 10);

    window.stateManager.dispatch({
      type: 'SET_STATE',
      payload: { recordsToShow: newCount },
    });
  },

  /** 新規予約のための教室選択モーダルを表示します */
  showClassroomModal: () => {
    if (CONSTANTS.CLASSROOMS && Object.keys(CONSTANTS.CLASSROOMS).length > 0) {
      // 既存のモーダルがあれば削除（重複防止）
      const existingModal = document.getElementById(
        'classroom-selection-modal',
      );
      if (existingModal) {
        existingModal.remove();
      }

      // 新しいモーダルを生成・追加
      const modalHtml = getClassroomSelectionModal();
      document.body.insertAdjacentHTML('beforeend', modalHtml);

      // モーダルを表示
      Components.showModal('classroom-selection-modal');

      // デバッグ用: モーダル内のボタンを確認
      if (!window.isProduction) {
        setTimeout(() => {
          const modalButtons = document.querySelectorAll(
            '#classroom-selection-modal [data-action="selectClassroom"]',
          );
          console.log('🔘 モーダル内ボタン数:', modalButtons.length);
          modalButtons.forEach((btn, index) => {
            console.log(`🔘 ボタン${index + 1}:`, {
              action: btn.dataset.action,
              classroomName: btn.dataset.classroomName,
              classroom: btn.dataset.classroom,
              text: btn.textContent,
            });
          });
        }, 100);
      }
    } else {
      // 教室情報がない場合はデータを更新
      showInfo('教室情報の取得に失敗しました。ホームに戻ります。');
      actionHandlers.goBackToDashboard();
    }
  },

  /** 教室選択モーダルを閉じます */
  closeClassroomModal: () => {
    Components.closeModal('classroom-selection-modal');
  },

  /** プロフィール編集画面に遷移します */
  goToEditProfile: () => {
    // データが古く、かつ更新中でなければデータを更新
    if (
      !stateManager.getState().isDataFresh &&
      !stateManager.getState()._dataUpdateInProgress
    ) {
      updateAppStateFromCache('editProfile');
    } else {
      // 新しいdispatchパターンを使用
      if (window.stateManager) {
        window.stateManager.dispatch({
          type: 'CHANGE_VIEW',
          payload: { view: 'editProfile' },
        });
      } else {
        window.stateManager.dispatch({
          type: 'SET_STATE',
          payload: { view: 'editProfile' },
        });
      }
    }
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
      actionHandlers.closeClassroomModal();
      // 常にupdateLessonsAndGoToBookingを呼び出し（内部で鮮度チェックを実行）
      actionHandlers.updateLessonsAndGoToBooking(classroomName);
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
    showLoading('dataFetch');

    google.script.run
      .withSuccessHandler(versionResponse => {
        if (versionResponse.success && versionResponse.data) {
          const currentLessonsVersion = stateManager.getState()._lessonsVersion;
          const serverLessonsVersion = versionResponse.data.lessonsComposite;

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
          actionHandlers.fetchLatestLessonsData(
            classroomName,
            serverLessonsVersion,
          );
        } else {
          // バージョンチェック失敗時はフォールバック（全データ取得、ローディングは継続）
          actionHandlers.fetchLatestLessonsData(classroomName, null);
        }
      })
      .withFailureHandler(error => {
        // エラー時もフォールバック（全データ取得、ローディングは継続）
        actionHandlers.fetchLatestLessonsData(classroomName, null);
      })
      .getCacheVersions();
  },

  /** 最新の講座データを取得する（内部処理） */
  fetchLatestLessonsData: (classroomName, newLessonsVersion) => {
    // ローディングは既に親関数で表示済み

    google.script.run
      .withSuccessHandler(response => {
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

        debugLog(
          `=== getBatchData レスポンス: ${JSON.stringify(response)} ===`,
        );
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
      .withFailureHandler(error => {
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

  /** ログイン画面に戻ります（電話番号入力値を保存） */
  goBackToLogin: () => {
    const phoneInput = document.getElementById('phone');
    const loginPhone = phoneInput
      ? phoneInput.value
      : stateManager.getState().loginPhone;
    window.stateManager.dispatch({
      type: 'NAVIGATE',
      payload: { to: 'login', context: { loginPhone: loginPhone } },
    });
  },

  /** ホーム（メイン画面）に遷移（別名） */
  goBackToDashboard: () => actionHandlers.goToDashboard(),

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
      actionHandlers.updateLessonsAndGoToBooking(targetClassroom);
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

  /** モーダルの確認ボタンを押したときの処理です */
  modalConfirm: () => {
    ModalManager.executeCallback();
    hideModal();
  },

  /** モーダルのキャンセルボタンを押したときの処理です */
  modalCancel: () => hideModal(),
};

/**
 * 会計の確認モーダルを表示
 */
actionHandlers.showAccountingConfirmation = () => {
  const accountingDetails = calculateAccountingDetails();
  if (!accountingDetails || accountingDetails.grandTotal <= 0) {
    showInfo('合計金額が0円です。項目を選択してください。');
    return;
  }

  const message = `
        <div class="p-4 bg-brand-light rounded-lg text-left space-y-4 text-base" id="modal-accounting-form">
            <div>
                <span class="font-bold">合計金額:</span> ${accountingDetails.grandTotal.toLocaleString()}円
                <button data-action="copyGrandTotal" class="ml-2 text-sm bg-action-secondary-bg active:bg-action-secondary-hover text-action-secondary-text font-bold px-2 py-1 rounded">コピー</button>
            </div>
            <div>
                <span class="font-bold">支払い方法:</span>
                <div class="mt-2 space-y-3">
                    ${getPaymentOptionsHtml()}
                </div>
            </div>
            <div class="mt-4">
                <button id="confirm-payment-button" data-action="confirmAndPay" class="w-full bg-action-primary-bg text-action-primary-text font-bold py-2 rounded disabled:bg-brand-muted" disabled>この内容で支払いました</button>
            </div>
            <p class="text-red-700 font-bold mt-2 text-center">必ずボタンを押してね</p>
        </div>
    `;
  showModal({
    title: 'お会計',
    message: message,
    showCancel: true,
    cancelText: CONSTANTS.MESSAGES.CANCEL || 'キャンセル',
    onConfirm: null,
  });
};

/**
 * 「この内容で支払いました」ボタン押下時の処理
 */
actionHandlers.confirmAndPay = () => {
  const reservationId =
    stateManager.getState().accountingReservation.reservationId;
  // モーダル内の支払い方法を取得
  const modalForm = document.getElementById('modal-accounting-form');
  let paymentMethod = CONSTANTS.PAYMENT_DISPLAY.CASH;
  if (modalForm) {
    const selected = modalForm.querySelector(
      'input[name="payment-method"]:checked',
    );
    if (selected) paymentMethod = selected.value;
  }

  // --- バックエンドに送信する「ユーザー入力」オブジェクトを構築 ---
  const form = document.getElementById('accounting-form');
  const userInput = {
    paymentMethod: paymentMethod,
    tuitionItems: [],
    salesItems: [],
    timeBased: null,
  };

  // 授業料項目（チェックボックス）
  form
    .querySelectorAll(
      `input[type="checkbox"][data-item-type="${CONSTANTS.ITEM_TYPES.TUITION}"]:checked`,
    )
    .forEach(cb => {
      userInput.tuitionItems.push(cb.dataset.itemName);
    });

  // 時間制授業料
  if (document.getElementById('start-time')) {
    const accountingReservation = stateManager.getState().accountingReservation;
    const startTime = getTimeValue(
      'start-time',
      accountingReservation,
      'startTime',
    );
    const endTime = getTimeValue('end-time', accountingReservation, 'endTime');

    userInput.timeBased = {
      startTime: startTime,
      endTime: endTime,
      // バックエンドとの互換性のため、ヘッダー形式も併記
      [CONSTANTS.HEADERS.RESERVATIONS?.START_TIME || 'startTime']: startTime,
      [CONSTANTS.HEADERS.RESERVATIONS?.END_TIME || 'endTime']: endTime,
      breakMinutes: parseInt(
        document.getElementById('break-time')?.value || 0,
        10,
      ),
      discountApplied:
        document.getElementById('discount-checkbox')?.checked || false,
    };
  }

  // 物販・材料費項目
  const materialContainer = document.getElementById('materials-container');
  if (materialContainer) {
    materialContainer
      .querySelectorAll('div[data-material-row-index]')
      .forEach((row, index) => {
        const name = document.getElementById(`material-type-${index}`)?.value;
        const priceText =
          document.getElementById(`material-price-${index}`)?.textContent ||
          '0';
        const price = parseInt(priceText.replace(/[^0-9]/g, ''), 10);
        if (name && price > 0)
          userInput.salesItems.push({ name: name, price: price });
      });
  }

  // 物販項目（チェックボックス）
  form
    .querySelectorAll(
      `input[type="checkbox"][data-item-type="${CONSTANTS.ITEM_TYPES.SALES}"]:checked`,
    )
    .forEach(cb => {
      userInput.salesItems.push({ name: cb.dataset.itemName });
    });

  form.querySelectorAll('div[data-other-sales-row]').forEach((row, index) => {
    const name = document
      .getElementById(`other-sales-name-${index}`)
      ?.value.trim();
    const price = document.getElementById(`other-sales-price-${index}`)?.value;
    if (name && price)
      userInput.salesItems.push({ name: name, price: Number(price) });
  });
  // --- ここまで ---

  const payload = {
    reservationId: stateManager.getState().accountingReservation.reservationId,
    classroom: stateManager.getState().accountingReservation.classroom,
    studentId: stateManager.getState().currentUser.studentId,
    userInput: userInput,
  };

  showLoading('accounting');
  google.script.run
    .withSuccessHandler(r => {
      if (r.success) {
        clearAccountingCache(reservationId); // <-- キャッシュ削除
        hideModal(); // モーダルを閉じる
        hideLoading();

        // 会計完了後は完了画面に遷移
        if (r.data) {
          // バックエンドから最新データが返された場合
          window.stateManager.dispatch({
            type: 'SET_STATE',
            payload: {
              ...r.data.initialData,
              myReservations: r.data.myReservations || [],
              lessons: r.data.lessons || [],
              view: 'complete',
              completionMessage: '会計情報を記録しました。',
              isDataFresh: true, // 最新データ受信済み
            },
          });
        } else {
          // 最新データが返されなかった場合でも完了画面に遷移
          const currentState = window.stateManager.getState();
          window.stateManager.dispatch({
            type: 'SET_STATE',
            payload: {
              view: 'complete',
              completionMessage: '会計情報を記録しました。',
              myReservations: currentState.myReservations || [],
              isDataFresh: false, // データ再読み込み必要
            },
          });
        }
      } else {
        hideLoading();
        showInfo(r.message || '会計情報の記録に失敗しました。');
      }
    })
    .withFailureHandler(handleServerError)
    .saveAccountingDetailsAndGetLatestData(payload);
};

// =================================================================
// --- Phone Number Formatting Helper Functions ---
// -----------------------------------------------------------------
// 電話番号入力のリアルタイム整形処理
// =================================================================

/**
 * 電話番号入力フィールドのリアルタイム整形処理
 * @param {HTMLInputElement} inputElement - 電話番号入力フィールド
 */
function handlePhoneInputFormatting(inputElement) {
  if (!inputElement) return;

  const originalValue = inputElement.value;
  const cursorPosition = inputElement.selectionStart;

  // 全角数字を半角に変換
  let formattedValue = originalValue.replace(/[０-９]/g, s =>
    String.fromCharCode(s.charCodeAt(0) - 65248),
  );

  // 数字以外を削除（ハイフンは一時的に残す）
  const digitsOnly = formattedValue.replace(/[^\d]/g, '');

  // フォーマット適用
  let formatted = '';
  if (digitsOnly.length > 0) {
    if (digitsOnly.length <= 3) {
      formatted = digitsOnly;
    } else if (digitsOnly.length <= 7) {
      formatted = `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3)}`;
    } else if (digitsOnly.length <= 11) {
      if (digitsOnly.length === 10) {
        // 10桁の場合: 03-1234-5678
        formatted = `${digitsOnly.slice(0, 2)}-${digitsOnly.slice(2, 6)}-${digitsOnly.slice(6)}`;
      } else {
        // 11桁の場合: 090-1234-5678
        formatted = `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 7)}-${digitsOnly.slice(7)}`;
      }
    } else {
      // 11桁を超える場合は11桁までに制限
      const truncated = digitsOnly.slice(0, 11);
      formatted = `${truncated.slice(0, 3)}-${truncated.slice(3, 7)}-${truncated.slice(7)}`;
    }
  }

  // 値が変更された場合のみ更新
  if (formatted !== originalValue) {
    inputElement.value = formatted;

    // カーソル位置を調整（ハイフンの追加を考慮）
    const newCursorPosition = Math.min(
      cursorPosition + (formatted.length - originalValue.length),
      formatted.length,
    );
    inputElement.setSelectionRange(newCursorPosition, newCursorPosition);
  }
}

// =================================================================
// --- Main Application Logic ---
// -----------------------------------------------------------------
// アプリケーションの起動、サーバーとの通信、状態管理、画面描画など、
// 全体を制御するコアとなる関数群です。
// =================================================================

/**
 * 注意: setState関数はStateManagerシステムに統合されました
 * 新しいコードでは stateManager.dispatch() を使用してください
 *
 * 下位互換性のためのsetState関数は12_WebApp_StateManager.htmlで定義され、
 * 自動的にStateManagerのdispatch()にマッピングされます
 */

/**
 * バッチ処理でキャッシュから最新データを取得してappStateを更新
 * ユーザーの予約・履歴・スロット情報を一括取得し、指定されたビューに遷移
 * @param {string} targetView - データ取得後に遷移したいビュー名
 */
function updateAppStateFromCache(targetView) {
  if (
    !stateManager.getState().currentUser ||
    !stateManager.getState().currentUser.phone
  ) {
    if (targetView) {
      window.stateManager.dispatch({
        type: 'SET_STATE',
        payload: { view: targetView },
      });
    }
    return;
  }

  // 更新中フラグを設定
  window.stateManager.dispatch({
    type: 'SET_STATE',
    payload: { _dataUpdateInProgress: true },
  });

  showLoading('最新データを取得中...');
  google.script.run
    .withSuccessHandler(response => {
      hideLoading();
      window.stateManager.dispatch({
        type: 'SET_STATE',
        payload: { _dataUpdateInProgress: false },
      }); // フラグをクリア

      if (response.success && response.userFound) {
        // バッチ処理結果からappStateを更新
        const newAppState = processInitialData(
          response.data.initial,
          stateManager.getState().currentUser.phone,
          response.data.lessons,
          response.data.myReservations,
        );
        // 現在のビューと重要な状態は保持、ただしtargetViewが指定されていればそちらを優先
        const preservedState = {
          view: targetView || stateManager.getState().view,
          selectedClassroom: stateManager.getState().selectedClassroom,
          selectedLesson: stateManager.getState().selectedLesson,
          editingReservationDetails:
            stateManager.getState().editingReservationDetails,
          accountingReservation: stateManager.getState().accountingReservation,
          isDataFresh: true, // 新鮮なデータが読み込まれたことを記録
        };
        window.stateManager.dispatch({
          type: 'SET_STATE',
          payload: { ...newAppState, ...preservedState },
        }); // setStateに統合し、状態更新と再描画を一元化
      } else {
        // 失敗時もsetStateを介して状態を更新し、再描画をトリガーする
        window.stateManager.dispatch({
          type: 'SET_STATE',
          payload: {
            _dataUpdateInProgress: false,
            view: targetView || stateManager.getState().view,
          },
        });
        showInfo(response.message || 'データの取得に失敗しました。');
      }
    })
    .withFailureHandler(err => {
      hideLoading();
      window.stateManager.dispatch({
        type: 'SET_STATE',
        payload: {
          _dataUpdateInProgress: false,
          view: targetView || stateManager.getState().view,
        },
      }); // フラグをクリア
      handleServerError(err);
      // setStateがrenderを呼び出すので、ここでのrender()は不要
    })
    .getBatchData(
      ['initial', 'lessons'],
      stateManager.getState().currentUser.phone,
    );
}

/**
 * 現在のアプリケーションの状態に基づいて、適切なビューを描画する
 * データ更新の必要性を判定し、必要に応じて最新データ取得後に再描画
 * stateManager.getState().viewの値に応じて対応するビュー関数を呼び出してUIを更新
 */
function render() {
  // appStateの安全な参照確認
  const appState = window.stateManager?.getState();
  if (!appState) {
    console.warn('render(): stateManagerが未初期化のため処理をスキップします');
    return;
  }

  console.log('🎨 render実行:', appState.view);

  // 無限ループを避けるため、データ更新処理は削除
  // 単純にビューを描画するだけ

  let v = '';
  switch (appState.view) {
    case 'login':
      v = getLoginView();
      break;
    case 'register':
      v = getRegisterView(appState.registrationPhone);
      break;
    case 'registrationStep2':
      v = getRegistrationStep2View();
      break;
    case 'registrationStep3':
      v = getRegistrationStep3View();
      break;
    case 'registrationStep4':
      v = getRegistrationStep4View();
      break;
    case 'dashboard':
      v = getDashboardView();
      break;
    case 'editProfile':
      v = getEditProfileView();
      break;
    case 'bookingLessons':
      v = getBookingView(appState.selectedClassroom);
      break;
    case 'newReservation':
      v = getReservationFormView('new');
      break;
    case 'editReservation':
      v = getReservationFormView('edit');
      break;
    case 'accounting':
      v = getAccountingView();
      break;
    case 'complete':
      v = getCompleteView(appState.completionMessage);
      break;
    case 'userSearch':
      v = getUserSearchView();
      break;
  }
  document.getElementById('view-container').innerHTML =
    `<div class="fade-in">${v}</div>`;

  // 戻るボタンを動的に更新
  const backButtonContainer = document.getElementById('back-button-container');
  if (backButtonContainer) {
    backButtonContainer.innerHTML = Components.createSmartBackButton(
      appState.view,
      appState,
    );
  }

  // 会計画面の場合、イベントリスナーを設定
  if (appState.view === 'accounting') {
    // DOM更新後にイベントリスナーを設定するため、次のフレームで実行
    requestAnimationFrame(() => {
      setupAccountingEventListeners();
      // 初期計算も実行
      updateAccountingCalculation();
    });
  }

  window.scrollTo(0, 0);
}

/**
 * 会計画面での入力変更を処理します。
 * 合計金額の再計算と、入力内容のキャッシュ保存を行います。
 */
function handleAccountingFormChange() {
  // リアルタイムで合計金額を再計算
  calculateAccountingDetails();

  // フォーム内容が変更されたら、キャッシュに保存する
  const reservationId =
    stateManager.getState().accountingReservation?.reservationId;
  if (reservationId) {
    const accountingData = getAccountingFormData();
    saveAccountingCache(reservationId, accountingData);
  }
}

/**
 * アプリケーションの起動点です。
 * ページ読み込み完了時に実行され、イベントリスナーを設定します。
 */
window.onload = function () {
  // アプリケーションの初期化が完了するまでローディング画面を表示
  showLoading('dataFetch');

  const app = document.getElementById('app');

  // イベントハンドラー関数を定義
  const handleClick = e => {
    // 【修正】buttonまたはdata-action属性を持つ要素を対象にする
    const targetElement = e.target.closest('button, [data-action]');
    if (targetElement?.dataset.action) {
      const { action, ...data } = targetElement.dataset;

      // デバッグ情報を追加
      if (!window.isProduction) {
        console.log('🔘 クリックイベント:', {
          action,
          data,
          element: targetElement,
          tagName: targetElement.tagName,
          modalContext: e.target.closest('[data-modal-content]')
            ? 'モーダル内'
            : '通常',
          timestamp: new Date().getTime(),
          eventPhase: e.eventPhase,
        });
      }

      // モーダル内の場合は、イベント伝播を継続する
      if (
        e.target.closest('[data-modal-content]') &&
        targetElement.dataset.action
      ) {
        // イベント伝播を停止しない（モーダル内のボタンを有効にする）
      }

      if (action === 'copyToClipboard' || action === 'copyGrandTotal') {
        actionHandlers[action](targetElement);
      } else if (actionHandlers[action]) {
        actionHandlers[action](data);
      } else {
        // ハンドラーが見つからない場合のデバッグ
        if (!window.isProduction) {
          console.warn('⚠️ アクションハンドラーが見つかりません:', action);
        }
      }
    }
  };

  // アプリ要素とdocument両方でクリックイベントを捕捉（モーダル対応）
  // 重複を避けるため、documentレベルのみでイベントを処理
  document.addEventListener('click', handleClick);

  // アプリ全体の入力・変更イベントを捕捉
  app.addEventListener('change', e => {
    // 会計モーダルでの支払い方法選択
    if (
      e.target.matches('#modal-accounting-form input[name="payment-method"]')
    ) {
      document
        .getElementById('confirm-payment-button')
        ?.removeAttribute('disabled');

      // 選択された支払方法に応じて情報を動的に更新
      const selectedPaymentMethod = e.target.value;
      const paymentInfoContainer = document.getElementById(
        'payment-info-container',
      );
      if (paymentInfoContainer) {
        paymentInfoContainer.innerHTML = getPaymentInfoHtml(
          selectedPaymentMethod,
        );
      }
    }

    // 会計画面での変更（主に select や checkbox）
    const accountingForm = e.target.closest('#accounting-form');
    if (stateManager.getState().view === 'accounting' && accountingForm) {
      handleAccountingFormChange();

      // デバッグログ
      if (!window.isProduction) {
        console.log('🔄 会計フォーム変更イベント:', {
          element: e.target.name || e.target.id,
          value: e.target.value,
          checked: e.target.checked,
        });
      }
    }

    // 新規登録Step3での経験有無による表示切り替え
    if (e.target.name === 'experience') {
      const pastWorkContainer = document.getElementById('past-work-container');
      if (pastWorkContainer) {
        pastWorkContainer.classList.toggle(
          'hidden',
          e.target.value === 'はじめて！',
        );
      }
    }
  });

  // アプリ全体の入力イベントを捕捉（主に text や textarea）
  app.addEventListener('input', e => {
    // 会計画面での変更
    const accountingForm = e.target.closest('#accounting-form');
    if (stateManager.getState().view === 'accounting' && accountingForm) {
      handleAccountingFormChange();
    }

    // 電話番号入力のリアルタイム整形
    if (e.target.id === 'phone' || e.target.id === 'edit-phone') {
      handlePhoneInputFormatting(e.target);
    }
  });

  // 初期画面を描画
  render();

  // 初期画面の描画が完了したらローディング画面を非表示にする
  hideLoading();
};

// =================================================================
// --- 今日かどうか判定するヘルパー関数（グローバル） ---
// -----------------------------------------------------------------

/**
 * 今日かどうかを判定するヘルパー関数
 * @param {string} dateString - 日付文字列（YYYY-MM-DD形式）
 * @returns {boolean}
 */
function isDateToday(dateString) {
  const today = new Date();
  const targetDate = new Date(dateString);

  return (
    today.getFullYear() === targetDate.getFullYear() &&
    today.getMonth() === targetDate.getMonth() &&
    today.getDate() === targetDate.getDate()
  );
}
