// @ts-check
/// <reference path="../../types/dev-environment.d.ts" />
/// <reference path="../../types/html-environment.d.ts" />
/// <reference path="../../types/api-types.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 14_WebApp_Handlers_Auth.js
 * 【バージョン】: 1.1
 * 【役割】: WebAppのフロントエンドにおける、認証・ユーザー管理関連の
 * アクションハンドラーを集約します。
 * 【構成】: 14ファイル構成から分割された認証管理ファイル
 * 【機能範囲】:
 * - ログイン・ログアウト処理
 * - 新規ユーザー登録（4ステップ）
 * - プロフィール管理（表示・編集・保存）
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
    if (!p) return showInfo('電話番号を入力してください。', '入力エラー');

    // 【最適化済み】 フロントエンドでリアルタイム検証（UX向上）
    // バックエンドでは軽量チェックのみ実行（重複処理削減）
    const normalizeResult = window.normalizePhoneNumberFrontend(p);

    if (!normalizeResult.isValid) {
      showInfo(
        normalizeResult.error || '電話番号の形式が正しくありません。',
        '入力エラー',
      );
      return;
    }

    showLoading('login');
    // 正規化に成功した場合は直接ログイン処理を実行（1回のAPI呼び出し）
    authActionHandlers.processLoginWithValidatedPhone(
      normalizeResult.normalized,
    );
  },

  /** 統合ログイン処理：1回のAPI呼び出しで認証とデータ取得を完了
   * @param {string} normalizedPhone */
  processLoginWithValidatedPhone: normalizedPhone => {
    debugLog('🚀 統合ログイン開始 - 認証+データ一括取得');

    // 統合エンドポイントで認証とすべてのデータを一括取得
    google.script.run['withSuccessHandler']((/** @type {any} */ response) => {
      if (response.success && response.userFound) {
        debugLog(
          '✅ 統合ログイン成功 - ユーザー: ' + response.user.displayName,
        );
        debugLog(
          `📦 データ一括取得完了: 予約${response.data.myReservations?.length || 0}件, レッスン${response.data.lessons?.length || 0}件`,
        );

        // 完全なアプリ状態を一度に構築
        const newAppState = {
          view: 'dashboard',
          currentUser: response.user,
          myReservations: response.data.myReservations || [],
          lessons: response.data.lessons || [],
          classrooms: CONSTANTS.CLASSROOMS
            ? Object.values(CONSTANTS.CLASSROOMS)
            : [],
          accountingMaster: response.data.accountingMaster || [],
          today: new Date().toISOString().split('T')[0],
        };

        hideLoading();
        debugLog('✅ 統合ログイン完了 - 完全なダッシュボード表示');

        window.stateManager.dispatch({
          type: 'SET_STATE',
          payload: {
            ...newAppState,
            recordsToShow: CONSTANTS.UI.HISTORY_INITIAL_RECORDS,
            isDataFresh: true,
          },
        });

        // 通知設定チェック：メール連絡希望ONで通知設定が未設定の場合に喚起
        if (
          response.user.wantsEmail &&
          (response.user.notificationDay == null ||
            response.user.notificationDay === '')
        ) {
          setTimeout(() => {
            showInfo(
              '日程連絡のメール送信の日時が設定できるようになりました！\n\nプロフィール編集から「通知を受け取る日」と「通知時刻」を設定してください。',
              '通知設定のお願い',
            );
          }, 500);
        }
      } else {
        // 認証失敗 - 新規登録に誘導
        hideLoading();
        debugLog('❌ ユーザー未登録 - 新規登録画面へ');
        window.stateManager.dispatch({
          type: 'SET_STATE',
          payload: {
            view: 'register',
            registrationPhone: normalizedPhone,
          },
        });
      }
    })
      .withFailureHandler((/** @type {Error} */ err) => {
        debugLog('❌ 統合ログインエラー: ' + err.message);
        hideLoading();
        if (window.FrontendErrorHandler) {
          window.FrontendErrorHandler.handle(
            err,
            'processLoginWithValidatedPhone_integrated',
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

    if (!realName) return showInfo('お名前（本名）は必須です。', '入力エラー');

    // フロントエンドで電話番号を正規化・バリデーション
    if (phone) {
      const normalizeResult = window.normalizePhoneNumberFrontend(phone);
      if (!normalizeResult.isValid) {
        showInfo(
          normalizeResult.error || '電話番号の形式が正しくありません。',
          '入力エラー',
        );
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

  /** 新規ユーザー登録：Step2からStep1へもどる */
  backToStep1: () => {
    const emailInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById('q-email')
    );
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
      email: emailInput?.value || '',
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
        registrationStep: 1,
        view: 'register',
      },
    });
  },

  /** 新規ユーザー登録：Step2からStep3へ進む */
  goToStep3: () => {
    const emailInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById('q-email')
    );
    const email = emailInput?.value;
    if (!email || !email.includes('@')) {
      return showInfo('有効なメールアドレスを入力してください。', '入力エラー');
    }

    const wantsEmailInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById('q-wants-email')
    );
    const notificationDayInput = /** @type {HTMLSelectElement | null} */ (
      document.getElementById('q-notification-day')
    );
    const notificationHourInput = /** @type {HTMLSelectElement | null} */ (
      document.getElementById('q-notification-hour')
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
      notificationDay: notificationDayInput?.value
        ? parseInt(notificationDayInput.value)
        : null,
      notificationHour: notificationHourInput?.value
        ? parseInt(notificationHourInput.value)
        : null,
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

  /** 新規ユーザー登録：Step3からStep2へもどる */
  backToStep2: () =>
    window.stateManager.dispatch({
      type: 'SET_STATE',
      payload: {
        view: 'registrationStep2',
        registrationStep: 2,
      },
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

  /** 新規ユーザー登録：Step4からStep3へもどる */
  backToStep3: () =>
    window.stateManager.dispatch({
      type: 'SET_STATE',
      payload: {
        view: 'registrationStep3',
        registrationStep: 3,
      },
    }),

  /** 新規ユーザー登録：最終データをサーバーに送信（簡素化版） */
  submitRegistration: () => {
    // タスク1: プライバシーポリシー同意チェック
    const privacyAgreeCheckbox = /** @type {HTMLInputElement | null} */ (
      document.getElementById('privacy-policy-agree')
    );

    if (!privacyAgreeCheckbox?.checked) {
      showInfo(
        'プライバシーポリシーに同意していただく必要があります。',
        '確認',
      );
      return;
    }

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
        if (!window.isProduction) {
          console.log('🔍 registerNewUser レスポンス:', res);
        }
        hideLoading();
        if (res.success && res.data) {
          // 登録成功時は直接ダッシュボードに遷移（データは後からロード）
          showInfo('新規ユーザー登録が完了しました', '登録完了');

          window.stateManager.dispatch({
            type: 'SET_STATE',
            payload: {
              currentUser: res.data.user,
              view: 'dashboard',
              myReservations: [], // 新規ユーザーは予約がない
              lessons: [], // データは必要に応じて後からロード
              isDataFresh: false, // データを後でリフレッシュする必要があることを示す
            },
          });
        } else {
          showInfo(res.message || '登録に失敗しました', 'エラー');
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
    const realNameInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById('edit-realname')
    );
    const nicknameInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById('edit-nickname')
    );

    const r = realNameInput?.value;
    let n = nicknameInput?.value.trim();
    if (!r) return showInfo('お名前（本名）は必須です。');
    if (!n) n = r;

    // NF-01: 電話番号入力欄があればその値も取得
    const phoneInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById('edit-phone')
    );
    const phone =
      phoneInput?.value || stateManager.getState().currentUser.phone; // 電話番号入力欄がなければ既存の電話番号を使用

    // 電話番号が入力されている場合のみバリデーション
    if (phoneInput?.value) {
      const normalizeResult = window.normalizePhoneNumberFrontend(
        phoneInput.value,
      );
      if (!normalizeResult.isValid) {
        showInfo(
          normalizeResult.error || '電話番号の形式が正しくありません。',
          '入力エラー',
        );
        return;
      }
    }

    // メール情報の取得とバリデーション
    const emailInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById('edit-email')
    );
    const wantsEmailInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById('edit-wants-email')
    );
    const email = emailInput?.value?.trim() || '';
    const wantsEmail =
      wantsEmailInput?.checked ||
      stateManager.getState().currentUser.wantsEmail;

    // メールアドレスの必須バリデーション
    if (!email || !email.includes('@')) {
      return showInfo('有効なメールアドレスを入力してください。', '入力エラー');
    }

    // 通知設定の取得
    const notificationDayInput = /** @type {HTMLSelectElement | null} */ (
      document.getElementById('edit-notification-day')
    );
    const notificationHourInput = /** @type {HTMLSelectElement | null} */ (
      document.getElementById('edit-notification-hour')
    );
    const notificationDay = notificationDayInput?.value
      ? parseInt(notificationDayInput.value)
      : null;
    const notificationHour = notificationHourInput?.value
      ? parseInt(notificationHourInput.value)
      : null;

    const u = {
      ...stateManager.getState().currentUser,
      realName: r,
      displayName: n,
      phone: phone,
      email: email || '',
      wantsEmail: wantsEmail || false,
      notificationDay: notificationDay,
      notificationHour: notificationHour,
    };
    showLoading('booking');
    google.script.run['withSuccessHandler']((/** @type {any} */ res) => {
      hideLoading();
      if (res.success) {
        // プロフィール更新後、キャッシュも更新されているのでそのまま状態更新
        showInfo('プロフィールを更新しました', '更新完了');
        window.stateManager.dispatch({
          type: 'SET_STATE',
          payload: {
            currentUser: res.updatedUser,
            view: 'dashboard',
          },
        });
      } else {
        showInfo(res.message || '更新に失敗しました', 'エラー');
      }
    })
      ['withFailureHandler'](handleServerError)
      .updateUserProfile(u);
  },

  // /** プロフィール編集画面に遷移します */
  // goToEditProfile: () => {
  //   // データが古く、かつ更新中でなければデータを更新
  //   if (
  //     !stateManager.getState().isDataFresh &&
  //     !stateManager.getState()._dataUpdateInProgress
  //   ) {
  //     updateAppStateFromCache('editProfile');
  //   } else {
  //     // 新しいdispatchパターンを使用
  //     if (window.stateManager) {
  //       window.stateManager.dispatch({
  //         type: 'CHANGE_VIEW',
  //         payload: { view: 'editProfile' },
  //       });
  //     } else {
  //       window.stateManager.dispatch({
  //         type: 'SET_STATE',
  //         payload: { view: 'editProfile' },
  //       });
  //     }
  //   }
  // },

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

  /** プロフィール編集画面に遷移します（タスク3実装） */
  goToEditProfile: () => {
    const state = stateManager.getState();
    const studentId = state.currentUser?.studentId;

    if (!studentId) {
      showInfo('ユーザー情報が見つかりません。', 'エラー');
      return;
    }

    showLoading();

    // バックエンドから最新のユーザー詳細情報を取得
    google.script.run
      .withSuccessHandler(response => {
        hideLoading();
        if (response.success) {
          // ユーザー詳細情報をstateに保存
          stateManager.dispatch({
            type: 'UPDATE_STATE',
            payload: { userDetailForEdit: response.data },
          });
          // プロフィール編集画面に遷移
          stateManager.dispatch({
            type: 'NAVIGATE',
            payload: { to: 'editProfile' },
          });
        } else {
          showInfo(
            response.message || 'ユーザー情報の取得に失敗しました。',
            'エラー',
          );
        }
      })
      .withFailureHandler(error => {
        hideLoading();
        showInfo('ユーザー情報の取得中にエラーが発生しました。', 'エラー');
        console.error('getUserDetailForEdit error:', error);
      })
      .getUserDetailForEdit(studentId);
  },

  /** プロフィール情報を更新します（タスク3実装） */
  updateProfile: () => {
    const state = stateManager.getState();
    const studentId = state.currentUser?.studentId;

    if (!studentId) {
      showInfo('ユーザー情報が見つかりません。', 'エラー');
      return;
    }

    // フォームから値を取得
    const realName = getInputElementSafely('profile-realName')?.value?.trim();
    const nickname = getInputElementSafely('profile-nickname')?.value?.trim();
    const phone = getInputElementSafely('profile-phone')?.value?.trim();
    const email = getInputElementSafely('profile-email')?.value?.trim();
    const wantsEmail = document.getElementById('profile-wantsEmail')?.checked;
    const address = getInputElementSafely('profile-address')?.value?.trim();
    const ageGroup = document.getElementById('profile-ageGroup')?.value;
    const gender = document.getElementById('profile-gender')?.value;
    const dominantHand = document.getElementById('profile-dominantHand')?.value;
    const futureCreations = document
      .getElementById('profile-futureCreations')
      ?.value?.trim();
    const notificationDay = document.getElementById(
      'profile-notificationDay',
    )?.value;
    const notificationHour = document.getElementById(
      'profile-notificationHour',
    )?.value;

    // 必須項目のバリデーション
    if (!realName || !nickname || !phone) {
      showInfo('本名、ニックネーム、電話番号は必須項目です。', '入力エラー');
      return;
    }

    // 電話番号のフロントエンド検証
    const normalizeResult = window.normalizePhoneNumberFrontend(phone);
    if (!normalizeResult.isValid) {
      showInfo(
        normalizeResult.error || '電話番号の形式が正しくありません。',
        '入力エラー',
      );
      return;
    }

    // 更新データを構築
    const updateData = {
      studentId: studentId,
      realName: realName,
      displayName: nickname, // nicknameをdisplayNameとして送信
      phone: normalizeResult.normalized,
      email: email || '',
      wantsEmail: wantsEmail || false,
      address: address || '',
      ageGroup: ageGroup || '',
      gender: gender || '',
      dominantHand: dominantHand || '',
      futureCreations: futureCreations || '',
      notificationDay: notificationDay || '',
      notificationHour: notificationHour || '',
    };

    showLoading();

    // バックエンドに更新リクエストを送信
    google.script.run
      .withSuccessHandler(response => {
        hideLoading();
        if (response.success) {
          // currentUserを更新
          stateManager.dispatch({
            type: 'UPDATE_STATE',
            payload: {
              currentUser: {
                ...state.currentUser,
                displayName: nickname,
                realName: realName,
                phone: normalizeResult.normalized,
                email: email || '',
                wantsEmail: wantsEmail || false,
              },
            },
          });

          showInfo('プロフィールを更新しました。', '成功');

          // ダッシュボードに戻る
          setTimeout(() => {
            stateManager.dispatch({
              type: 'NAVIGATE',
              payload: { to: 'dashboard' },
            });
          }, 1500);
        } else {
          showInfo(
            response.message || 'プロフィールの更新に失敗しました。',
            'エラー',
          );
        }
      })
      .withFailureHandler(error => {
        hideLoading();
        showInfo('プロフィール更新中にエラーが発生しました。', 'エラー');
        console.error('updateUserProfile error:', error);
      })
      .updateUserProfile(updateData);
  },

  /** アカウント退会処理を実行します（タスク2実装） */
  requestAccountDeletion: () => {
    const state = stateManager.getState();
    const studentId = state.currentUser?.studentId;

    if (!studentId) {
      showInfo('ユーザー情報が見つかりません。', 'エラー');
      return;
    }

    // 確認ダイアログを表示
    showConfirm({
      title: '退会確認',
      message:
        '本当に退会しますか？\n\nこの操作は取り消せません。アカウント情報が無効化され、再度ログインできなくなります。',
      confirmText: '退会する',
      cancelText: 'キャンセル',
      confirmColorClass: DesignConfig.colors['danger'],
      onConfirm: () => {
        // 確認された場合のみ実行
        showLoading();

        // バックエンドに退会リクエストを送信
        google.script.run
          .withSuccessHandler(response => {
            hideLoading();
            if (response.success) {
              // 成功メッセージを表示
              showInfo(
                '退会処理が完了しました。ご利用ありがとうございました。',
                '退会完了',
              );

              // ログアウト処理（stateをクリア）
              setTimeout(() => {
                stateManager.dispatch({ type: 'LOGOUT' });
                // ログイン画面に遷移
                stateManager.dispatch({
                  type: 'NAVIGATE',
                  payload: { to: 'login' },
                });
              }, 2000);
            } else {
              showInfo(response.message || '退会処理に失敗しました。', 'エラー');
            }
          })
          .withFailureHandler(error => {
            hideLoading();
            showInfo('退会処理中にエラーが発生しました。', 'エラー');
            console.error('requestAccountDeletion error:', error);
          })
          .requestAccountDeletion(studentId);
      },
    });
  },

  /** プライバシーポリシーを表示します（タスク1実装） */
  showPrivacyPolicy: () => {
    // 既存のモーダルを削除
    const existingModal = document.getElementById('privacy-policy-modal');
    if (existingModal) {
      existingModal.remove();
    }

    // モーダルHTMLを生成してDOMに追加
    const modalHtml = getPrivacyPolicyModal();
    const appContainer = document.getElementById('app');
    if (appContainer) {
      appContainer.insertAdjacentHTML('beforeend', modalHtml);
      // モーダルを表示
      Components.showModal('privacy-policy-modal');
    }
  },

  /** プライバシーポリシーモーダルを閉じます（タスク1実装） */
  closePrivacyPolicy: () => {
    Components.closeModal('privacy-policy-modal');
  },
};
