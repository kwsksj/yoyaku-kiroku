// @ts-check
/// <reference path="../../types/dev-environment.d.ts" />
/// <reference path="../../types/html-environment.d.ts" />
/// <reference path="../../types/api-types.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 14_WebApp_Handlers_Auth.js
 * 【バージョン】: 1.0
 * 【役割】: WebAppのフロントエンドにおける、認証・ユーザー管理関連の
 * アクションハンドラーを集約します。
 * 【構成】: 14ファイル構成から分割された認証管理ファイル
 * 【機能範囲】:
 * - ログイン・ログアウト処理
 * - 新規ユーザー登録（4ステップ）
 * - プロフィール管理（表示・編集・保存）
 * - ユーザー検索（電話番号未登録ユーザー対応）
 * =================================================================
 */

// =================================================================
// --- Authentication Action Handlers ---
// -----------------------------------------------------------------
// 認証・ユーザー管理関連のアクションハンドラー群
// =================================================================

/** 認証関連のアクションハンドラー群 */
const authActionHandlers = {
  /** ログインまたは新規登録を開始します（キャッシュ活用版） */
  login: () => {
    const phoneInput = getInputElementSafely('phone');
    const p = phoneInput?.value || '';
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

    showLoading('booking');
    // 正規化に成功した場合は直接ログイン処理を実行（1回のAPI呼び出し）
    authActionHandlers.processLoginWithValidatedPhone(normalizeResult.normalized);
  },

  /** 検証済み電話番号でのログイン処理
   * @param {string} normalizedPhone */
  processLoginWithValidatedPhone: normalizedPhone => {
    // 環境分岐: テスト環境の場合はモックデータを使用

    // 本番環境: 統合エンドポイントで初期データと空席情報を一括取得
    google.script.run['withSuccessHandler'](
      (/** @type {LoginDataResponse} */ response) => {
        // ← この response には、サーバーサイドの getLoginData 関数の戻り値が格納されます。

        // デバッグ情報を画面に表示（本番環境では無効化）
        if (!window.isProduction) {
          debugLog('初期データ取得完了');
          debugLog('response.success: ' + response.success);
          debugLog('response.userFound: ' + response.userFound);
          debugLog(
            'response.data.lessons: ' +
              (response.data?.lessons
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
            response.data?.lessons || [],
            response.data?.myReservations || [],
          );
          debugLog(
            'processInitialData完了 - lessons: ' +
              (newAppState?.lessons
                ? newAppState.lessons.length + '件'
                : 'null'),
          );
          debugLog(
            'processInitialData完了 - classrooms: ' +
              JSON.stringify(newAppState?.classrooms),
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
      },
    )
      .withFailureHandler((/** @type {Error} */ err) => {
        hideLoading();
        if (!window.isProduction) {
          debugLog('初期データ取得エラー: ' + err.message);
        }
        if (window.FrontendErrorHandler) {
          window.FrontendErrorHandler.handle(
            err,
            'processLoginWithValidatedPhone',
            { phone: normalizedPhone },
          );
        }
        handleServerError(err);
      })
      .getLoginData(normalizedPhone);
  },

  /** 新規ユーザー登録：Step1からStep2へ */
  goToStep2: () => {
    const realNameInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById('reg-realname')
    );
    const nicknameInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById('reg-nickname')
    );
    const phoneInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById('reg-phone')
    );

    const realName = realNameInput?.value;
    const nickname = nicknameInput?.value.trim();
    const phone = phoneInput?.value;

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
      .../** @type {any} */ (stateManager.getState())?.['registrationData'],
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
    const realNameInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById('reg-realname')
    );
    const nicknameInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById('reg-nickname')
    );
    const phoneInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById('reg-phone')
    );

    const realName = realNameInput?.value;
    const nickname = nicknameInput?.value;
    const phone = phoneInput?.value;
    if (realName || nickname || phone) {
      const currentState = stateManager.getState();
      const updatedRegistrationData = {
        .../** @type {any} */ (currentState['registrationData'] || {}),
        realName:
          realName ||
          /** @type {any} */ (currentState['registrationData'])?.realName ||
          '',
        nickname:
          nickname ||
          /** @type {any} */ (currentState['registrationData'])?.nickname ||
          '',
        phone:
          phone ||
          /** @type {any} */ (currentState['registrationData'])?.phone ||
          '',
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
    const emailInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById('q-email')
    );
    const email = emailInput?.value;
    if (!email || !email.includes('@')) {
      return showInfo('有効なメールアドレスを入力してください。');
    }

    const wantsEmailInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById('q-wants-email')
    );
    const ageGroupInput = /** @type {HTMLSelectElement | null} */ (
      document.getElementById('q-age-group')
    );
    const genderInput = /** @type {HTMLInputElement | null} */ (
      document.querySelector('input[name="gender"]:checked')
    );
    const dominantHandInput = /** @type {HTMLInputElement | null} */ (
      document.querySelector('input[name="dominantHand"]:checked')
    );
    const addressInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById('q-address')
    );

    const step2Data = {
      email: email,
      wantsEmail: wantsEmailInput?.checked || false,
      ageGroup: ageGroupInput?.value || '',
      gender: genderInput?.value || '',
      dominantHand: dominantHandInput?.value || '',
      address: addressInput?.value || '',
    };

    window.stateManager.dispatch({
      type: 'SET_STATE',
      payload: {
        registrationData: {
          .../** @type {any} */ (stateManager.getState())?.['registrationData'],
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
    /** @type {HTMLInputElement | null} */
    const experienceInput = document.querySelector(
      'input[name="experience"]:checked',
    );
    const pastWorkInput = /** @type {HTMLTextAreaElement | null} */ (
      document.getElementById('q-past-work')
    );
    const futureGoalInput = /** @type {HTMLTextAreaElement | null} */ (
      document.getElementById('q-future-goal')
    );

    const step3Data = {
      experience: experienceInput?.value || '',
      pastWork: pastWorkInput?.value || '',
      futureGoal: futureGoalInput?.value || '',
    };
    window.stateManager.dispatch({
      type: 'SET_STATE',
      payload: {
        registrationData: {
          .../** @type {any} */ (
            stateManager.getState()['registrationData'] || {}
          ),
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
    /** @type {HTMLInputElement | null} */
    const futureParticipationInput = document.querySelector(
      'input[name="futureParticipation"]:checked',
    );
    const triggerInput = /** @type {HTMLSelectElement | null} */ (
      document.getElementById('q-trigger')
    );
    const firstMessageInput = /** @type {HTMLTextAreaElement | null} */ (
      document.getElementById('q-first-message')
    );

    const step4Data = {
      futureParticipation: futureParticipationInput?.value || '',
      trigger: triggerInput?.value || '',
      firstMessage: firstMessageInput?.value || '',
    };

    const finalUserData = {
      .../** @type {any} */ (stateManager.getState()['registrationData'] || {}),
      ...step4Data,
    };

    showLoading('booking');
    google.script.run['withSuccessHandler'](
      (
        /** @type {ServerResponse<{ user: UserData; message: string }>} */ res,
      ) => {
        if (res.success && res.data) {
          // 登録後、バッチ処理で初期データと空席情報を一括取得
          google.script.run['withSuccessHandler'](
            (/** @type {BatchDataResponse} */ batchResult) => {
              if (batchResult.success && batchResult.data) {
                const newAppState = processInitialData(
                  batchResult.data.initial,
                  res.data.user.phone,
                  batchResult.data.lessons || [],
                );

                window.stateManager.dispatch({
                  type: 'SET_STATE',
                  payload: {
                    ...newAppState,
                    currentUser: res.data.user,
                    view: 'dashboard',
                  },
                });
                hideLoading();
              } else {
                hideLoading();
                showInfo(batchResult.message || 'データの取得に失敗しました');
              }
            },
          )
            ['withFailureHandler']((/** @type {Error} */ error) => {
              hideLoading();
              if (window.FrontendErrorHandler) {
                window.FrontendErrorHandler.handle(
                  error,
                  'submitRegistration:getBatchData',
                  { finalUserData },
                );
              }
              handleServerError(error);
            })
            .getBatchData(['initial', 'lessons']);
        } else {
          hideLoading();
          showInfo(res.message || '登録に失敗しました');
        }
      },
    )
      ['withFailureHandler']((/** @type {Error} */ error) => {
        hideLoading();
        if (window.FrontendErrorHandler) {
          window.FrontendErrorHandler.handle(
            error,
            'submitRegistration:registerNewUser',
            { finalUserData },
          );
        }
        handleServerError(error);
      })
      .registerNewUser(finalUserData);
  },

  /** プロフィール情報を保存します（キャッシュ活用版） */
  saveProfile: () => {
    /** @type {HTMLInputElement | null} */
    const realNameInput = document.getElementById('edit-realname');
    /** @type {HTMLInputElement | null} */
    const nicknameInput = document.getElementById('edit-nickname');

    const r = realNameInput?.value;
    let n = nicknameInput?.value.trim();
    if (!r) return showInfo('お名前（本名）は必須です。');
    if (!n) n = r;

    // NF-01: 電話番号入力欄があればその値も取得
    /** @type {HTMLInputElement | null} */
    const phoneInput = document.getElementById('edit-phone');
    const phone =
      phoneInput?.value || stateManager.getState().currentUser.phone; // 電話番号入力欄がなければ既存の電話番号を使用

    // メール情報の取得
    /** @type {HTMLInputElement | null} */
    const emailInput = document.getElementById('edit-email');
    /** @type {HTMLInputElement | null} */
    const wantsEmailInput = document.getElementById('edit-wants-email');
    const email =
      emailInput?.value || stateManager.getState().currentUser.email;
    const wantsEmail =
      wantsEmailInput?.checked ||
      stateManager.getState().currentUser.wantsEmail;

    const u = {
      ...stateManager.getState().currentUser,
      realName: r,
      displayName: n,
      phone: phone,
      email: email || '',
      wantsEmail: wantsEmail || false,
    };
    showLoading('booking');
    google.script.run['withSuccessHandler']((/** @type {any} */ res) => {
      hideLoading();
      if (res.success) {
        // プロフィール更新後、キャッシュも更新されているのでそのまま状態更新
        showInfo('プロフィールを更新しました');
        window.stateManager.dispatch({
          type: 'SET_STATE',
          payload: { currentUser: res.updatedUser, view: 'dashboard' },
        });
      } else {
        showInfo(res.message || '更新に失敗しました');
      }
    })
      ['withFailureHandler'](handleServerError)
      .updateUserProfile(u);
  },

  /**
   * NF-01: 電話番号未登録ユーザーの検索を実行します（キャッシュ活用版）。
   */
  searchUserByName: () => {
    /** @type {HTMLInputElement | null} */
    const searchInput = document.getElementById('nickname-search-input');
    const searchTerm = searchInput ? searchInput.value.trim() : ''; // 検索語をsearchTermに変更

    if (!searchTerm) {
      return showInfo('お名前（本名）またはニックネームを入力してください。');
    }

    showLoading('booking');

    // 検索語からスペースを除去して小文字化して比較に使う
    const normalizedSearchTerm = searchTerm.replace(/\s+/g, '').toLowerCase();

    google.script.run['withSuccessHandler']((/** @type {any} */ response) => {
      hideLoading();
      if (response.success) {
        // 【統一レスポンス形式】データ構造の修正
        // searchName (スペース除去済み・小文字化された結合名) を使ってフィルタリング
        const filteredUsers = response.data.filter(
          /** @param {any} user */ user =>
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
      ['withFailureHandler'](handleServerError)
      .searchUsersWithoutPhone(searchTerm);
  },

  /**
   * NF-01: 検索結果から電話番号未登録ユーザーを選択します（バッチ処理版）。
   * @param {ActionHandlerData} d
   */
  selectSearchedUser: d => {
    // ボタンに埋め込まれたデータから、まず仮のユーザー情報を作成
    const tempUser = {
      studentId: d.studentId,
      realName: d.realName, // ボタンのdata属性から取得
      displayName: d.nickname, // ボタンのdata属性から取得
      phone: '', // 電話番号はまだないので空
    };

    showLoading('booking');

    // バッチ処理で初期データ、空席情報、ユーザーデータを一括取得
    google.script.run['withSuccessHandler']((/** @type {any} */ response) => {
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
      ['withFailureHandler'](handleServerError)
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
          payload: { view: /** @type {ViewType} */ ('editProfile') },
        });
      } else {
        window.stateManager.dispatch({
          type: 'SET_STATE',
          payload: { view: /** @type {ViewType} */ ('editProfile') },
        });
      }
    }
  },

  /** ログイン画面に戻ります（電話番号入力値を保存） */
  goBackToLogin: () => {
    const phoneInput = document.getElementById('phone');
    const loginPhone = phoneInput
      ? phoneInput.value
      : stateManager.getState()['loginPhone'];
    window.stateManager.dispatch({
      type: 'NAVIGATE',
      payload: { to: 'login', context: { loginPhone: loginPhone } },
    });
  },
};