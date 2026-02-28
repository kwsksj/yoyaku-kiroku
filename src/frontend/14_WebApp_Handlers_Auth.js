/**
 * =================================================================
 * ファイル概要
 * -----------------------------------------------------------------
 * 名称: 14_WebApp_Handlers_Auth.js
 * 目的: 認証・プロフィール領域のアクションハンドラーを提供する
 * 主な責務:
 *   - ログイン/ログアウト/新規登録フローの制御
 *   - プロフィール編集とプライバシーポリシー表示のハンドリング
 *   - エラー処理やフォーム操作ユーティリティとの連携
 * AI向けメモ:
 *   - 新しい認証アクションを追加する際はstate更新とUI切り替えの副作用を明確にし、このファイル内の`authActionHandlers`へ登録する
 * =================================================================
 */

// ================================================================
// UI系モジュール
// ================================================================
import { Components } from './13_WebApp_Components.js';
import { getPrivacyPolicyModal } from './13_WebApp_Views_Utils.js';
import { participantActionHandlers } from './14_WebApp_Handlers_Participant.js';

// ================================================================
// ユーティリティ系モジュール
// ================================================================
import {
  FrontendErrorHandler,
  handleServerError,
} from './12_WebApp_Core_ErrorHandler.js';
import { getInputElementSafely } from './14_WebApp_Handlers_Utils.js';

// =================================================================
// --- Authentication Action Handlers ---
// -----------------------------------------------------------------
// 認証・ユーザー管理関連のアクションハンドラー群
// =================================================================

const authHandlersStateManager = appWindow.stateManager;
const MARKED_SCRIPT_SRC = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
/** @type {Promise<void> | null} */
let markedLoadPromise = null;
/** @type {Promise<void> | null} */
let privacyPolicyOpenPromise = null;

/**
 * marked.js を必要時に読み込みます
 * @returns {Promise<void>}
 */
function ensureMarkedLoaded() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('windowが利用できません'));
  }

  const markedLib = /** @type {any} */ (window).marked;
  if (typeof markedLib !== 'undefined') {
    return Promise.resolve(undefined);
  }

  if (markedLoadPromise) {
    return markedLoadPromise;
  }

  markedLoadPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(
      `script[data-lib="marked"][src="${MARKED_SCRIPT_SRC}"]`,
    );

    if (existingScript) {
      if (
        existingScript instanceof HTMLScriptElement &&
        existingScript.dataset['status'] === 'loaded'
      ) {
        resolve(undefined);
        return;
      }
      existingScript.addEventListener('load', () => resolve(undefined), {
        once: true,
      });
      existingScript.addEventListener(
        'error',
        () => {
          existingScript.remove();
          reject(new Error('marked.jsの読み込みに失敗しました'));
        },
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.src = MARKED_SCRIPT_SRC;
    script.async = true;
    script.dataset['lib'] = 'marked';
    script.onload = () => {
      script.dataset['status'] = 'loaded';
      resolve(undefined);
    };
    script.onerror = () => {
      script.remove();
      reject(new Error('marked.jsの読み込みに失敗しました'));
    };
    document.head.appendChild(script);
  }).catch(error => {
    markedLoadPromise = null;
    throw error;
  });

  return markedLoadPromise;
}

/** 認証関連のアクションハンドラー群 */
export const authActionHandlers = {
  /** ログインまたは新規登録を開始します（キャッシュ活用版） */
  login: () => {
    const phoneInput = getInputElementSafely('phone');
    const p = phoneInput?.value || '';
    // 入力値をsetState経由で保存
    authHandlersStateManager.dispatch({
      type: 'UPDATE_STATE',
      payload: { loginPhone: p },
    });
    if (!p) return showInfo('電話番号を入力してください。', '入力エラー');

    // 【最適化済み】 フロントエンドでリアルタイム検証（UX向上）
    // バックエンドでは軽量チェックのみ実行（重複処理削減）
    const normalizer = appWindow.normalizePhoneNumberFrontend;
    if (!normalizer) {
      showInfo('電話番号の正規化機能が利用できません。', 'エラー');
      return;
    }
    const normalizeResult = normalizer(p);

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
      debugLog('🔍 ログインレスポンス受信:', response);
      if (response.success && response.userFound) {
        debugLog('✅ 統合ログイン成功 - ユーザー: ' + response.user.nickname);
        debugLog(
          `📦 データ一括取得完了: よやく${response.data.myReservations?.length || 0}件, レッスン${response.data.lessons?.length || 0}件`,
        );
        debugLog('📦 myReservations詳細:', response.data.myReservations);

        // 管理者判定: isAdminフラグまたは電話番号がADMIN_PASSWORDと一致するか
        const isAdmin = response.user?.isAdmin || response.isAdmin || false;
        const userWithAdmin = {
          ...response.user,
          isAdmin: isAdmin,
          adminToken: isAdmin ? response.data?.adminToken || '' : '',
        };

        // 完全なアプリ状態を一度に構築
        // 管理者の場合はviewを設定せず、loadParticipantsView内で設定
        const newAppState = {
          currentUser: userWithAdmin,
          myReservations: response.data.myReservations || [],
          lessons: response.data.lessons || [],
          classrooms: CONSTANTS.CLASSROOMS
            ? Object.values(CONSTANTS.CLASSROOMS)
            : [],
          accountingMaster: response.data.accountingMaster || [],
          today: new Date().toISOString().split('T')[0],
        };

        debugLog('🎯 新しいアプリ状態を構築:', {
          myReservationsCount: newAppState.myReservations.length,
          lessonsCount: newAppState.lessons.length,
        });

        // データ取得完了を記録（キャッシュ管理用）
        authHandlersStateManager.setDataFetchProgress('lessons', false);
        authHandlersStateManager.setDataFetchProgress('reservations', false);

        // 管理者の場合は参加者リストビューのデータ取得で一括設定
        // loadParticipantsView内でrender()とhideLoading()が呼ばれる
        if (isAdmin) {
          debugLog('📋 管理者ログイン - ログビューへ遷移開始');
          const participantData = response.data?.participantData;

          // 管理者として必要な基本データをstateに保存
          /** @type {Partial<UIState>} */
          const adminState = {
            ...newAppState,
            participantIsAdmin: true,
            participantHasPastLessonsLoaded: true,
            participantLessons: participantData?.lessons || [],
            participantReservationsMap: participantData?.reservationsMap || {},
            participantAllStudents: participantData?.allStudents || {},
            participantHasMorePastLessons:
              participantData?.hasMorePastLessons === true,
          };

          // ログデータを反映（即時表示用）
          const adminLogs = response.data?.adminLogs || [];
          adminState['adminLogs'] = adminLogs;
          adminState['adminLogsLoading'] = false;
          adminState['adminLogsDaysBack'] = CONSTANTS.UI.ADMIN_LOG_INITIAL_DAYS;

          // データ取得日時を設定
          const now = new Date().toISOString();
          adminState['participantDataFetchedAt'] = now;
          adminState['adminLogsFetchedAt'] = now;
          adminState['dataFetchedAt'] = now;

          authHandlersStateManager.dispatch({
            type: 'SET_STATE',
            payload: adminState,
          });

          // ログビュー側のステートマネージャにも同期（同じインスタンスを参照しているはずだが念のため）
          // 注: 14_WebApp_Handlers_Participant.js の participantHandlersStateManager は
          // appWindow.stateManager を使用しているので、dispatchで同期されるはず。

          hideLoading();

          // ログビューへ遷移
          if (typeof participantActionHandlers.goToLogView === 'function') {
            participantActionHandlers.goToLogView();
          } else {
            // フォールバック: 参加者ビュー
            console.warn('⚠️ goToLogViewが見つかりません');
            participantActionHandlers.loadParticipantView(
              false,
              false,
              adminState,
              true,
            );
          }
        } else {
          // 一般ユーザーはここでstateを設定
          /** @type {Partial<UIState>} */
          const statePayload = {
            ...newAppState,
            view: 'dashboard',
            recordsToShow: CONSTANTS.UI.HISTORY_INITIAL_RECORDS,
            isDataFresh: true,
            // データ取得日時を設定
            dataFetchedAt: new Date().toISOString(),
          };

          authHandlersStateManager.dispatch({
            type: 'SET_STATE',
            payload: statePayload,
          });

          debugLog(
            '✅ dispatch完了 - 現在のstate:',
            authHandlersStateManager.getState().myReservations?.length,
            '件のよやく',
          );

          hideLoading();
          debugLog('✅ 統合ログイン完了 - 完全なダッシュボード表示');
        }

        // 通知設定チェック：日程連絡希望ONで通知設定が未設定の場合に喚起
        if (
          response.user.wantsScheduleNotification &&
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
        authHandlersStateManager.dispatch({
          type: 'SET_STATE',
          payload: {
            view: 'register',
            registrationPhone: normalizedPhone,
          },
        });

        // 新規登録時のウェルカムメッセージを表示
        // ビューの描画完了を待つために遅延させる
        setTimeout(() => {
          Components.showModal('welcome-modal');
        }, 500);
      }
    })
      ['withFailureHandler']((/** @type {Error} */ err) => {
        debugLog('❌ 統合ログインエラー: ' + err.message);
        hideLoading();
        const handler = appWindow.FrontendErrorHandler || FrontendErrorHandler;
        handler.handle(err, 'processLoginWithValidatedPhone_integrated');
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
    const emailInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById('reg-email')
    );
    const wantsEmailInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById('reg-wants-email')
    );
    const wantsScheduleNotificationInput =
      /** @type {HTMLInputElement | null} */ (
        document.getElementById('reg-wants-schedule-notification')
      );
    const notificationDayInput = /** @type {HTMLSelectElement | null} */ (
      document.getElementById('reg-notification-day')
    );
    const notificationHourInput = /** @type {HTMLSelectElement | null} */ (
      document.getElementById('reg-notification-hour')
    );

    const realName = realNameInput?.value;
    const nickname = nicknameInput?.value.trim();
    const email = emailInput?.value;
    const wantsEmail = wantsEmailInput?.checked || false;
    const wantsScheduleNotification =
      wantsScheduleNotificationInput?.checked || false;
    const notificationDay =
      wantsScheduleNotification && notificationDayInput?.value
        ? parseInt(notificationDayInput.value)
        : null;
    const notificationHour =
      wantsScheduleNotification && notificationHourInput?.value
        ? parseInt(notificationHourInput.value)
        : null;

    // バリデーション
    if (!realName)
      return showInfo('おなまえ（本名）は必須です。', '入力エラー');
    if (!email || !email.includes('@'))
      return showInfo('有効なメールアドレスを入力してください。', '入力エラー');

    // 入力値をsetState経由で保存
    const updatedRegistrationData = {
      .../** @type {any} */ (authHandlersStateManager.getState())?.[
        'registrationData'
      ],
      realName,
      nickname: nickname || realName,
      email,
      wantsEmail,
      wantsScheduleNotification,
      notificationDay,
      notificationHour,
    };
    authHandlersStateManager.dispatch({
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
      ageGroup: ageGroupInput?.value || '',
      gender: genderInput?.value || '',
      dominantHand: dominantHandInput?.value || '',
      address: addressInput?.value || '',
    };

    authHandlersStateManager.dispatch({
      type: 'SET_STATE',
      payload: {
        registrationData: {
          .../** @type {any} */ (authHandlersStateManager.getState())?.[
            'registrationData'
          ],
          ...step2Data,
        },
        registrationStep: 1,
        view: 'register',
      },
    });
  },

  /** 新規ユーザー登録：Step2からStep3へ進む */
  goToStep3: () => {
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
      ageGroup: ageGroupInput?.value || '',
      gender: genderInput?.value || '',
      dominantHand: dominantHandInput?.value || '',
      address: addressInput?.value || '',
    };

    authHandlersStateManager.dispatch({
      type: 'SET_STATE',
      payload: {
        registrationData: {
          .../** @type {any} */ (authHandlersStateManager.getState())?.[
            'registrationData'
          ],
          ...step2Data,
        },
        registrationStep: 3,
        view: 'registrationStep3',
      },
    });
  },

  /** 新規ユーザー登録：Step3からStep2へもどる */
  backToStep2: () =>
    authHandlersStateManager.dispatch({
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
    const futureCreationsInput = /** @type {HTMLTextAreaElement | null} */ (
      document.getElementById('q-future-goal')
    );

    const step3Data = {
      experience: experienceInput?.value || '',
      pastWork: pastWorkInput?.value || '',
      futureCreations: futureCreationsInput?.value || '',
    };
    authHandlersStateManager.dispatch({
      type: 'SET_STATE',
      payload: {
        registrationData: {
          .../** @type {any} */ (
            authHandlersStateManager.getState()['registrationData'] || {}
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
    authHandlersStateManager.dispatch({
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

    const finalUserData = /** @type {Partial<UserCore>} */ ({
      .../** @type {any} */ (
        authHandlersStateManager.getState()['registrationData'] || {}
      ),
      ...step4Data,
      phone: authHandlersStateManager.getState().registrationPhone || '',
    });

    showLoading('login');
    google.script.run['withSuccessHandler']((/** @type {any} */ response) => {
      if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
        debugLog('🔍 getRegistrationData レスポンス:', response);
      }
      hideLoading();
      if (response.success && response.userFound) {
        // 登録成功時は直接ダッシュボードに遷移
        showInfo('新規ユーザー登録が完了しました', '登録完了');

        // 完全なアプリ状態を一度に構築（既存ログインと同じ形式）
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
          // 履歴をクリアして、ログイン画面に戻らないようにする
          navigationHistory: [],
        };

        authHandlersStateManager.dispatch({
          type: 'SET_STATE',
          payload: {
            ...newAppState,
            recordsToShow: CONSTANTS.UI.HISTORY_INITIAL_RECORDS,
            isDataFresh: true,
          },
        });

        // データ取得完了を記録（キャッシュ管理用）
        authHandlersStateManager.setDataFetchProgress('lessons', false);
        authHandlersStateManager.setDataFetchProgress('reservations', false);
      } else {
        showInfo(response.message || '登録に失敗しました', 'エラー');
      }
    })
      ['withFailureHandler']((/** @type {Error} */ error) => {
        hideLoading();
        const handler = appWindow.FrontendErrorHandler || FrontendErrorHandler;
        handler.handle(error, 'submitRegistration:getRegistrationData', {
          finalUserData,
        });
        handleServerError(error);
      })
      .getRegistrationData(finalUserData);
  },

  /** プロフィール編集画面を表示します（シートからデータ取得） */
  showEditProfile: () => {
    const state = authHandlersStateManager.getState();
    const studentId = state.currentUser?.studentId;

    if (!studentId) {
      showInfo('ユーザー情報が見つかりません。', 'エラー');
      return;
    }

    showLoading();

    // バックエンドからユーザーの詳細情報を取得
    google.script.run['withSuccessHandler']((/** @type {any} */ response) => {
      hideLoading();
      if (response.success && response.data) {
        // 取得した詳細情報で currentUser を更新してプロフィール編集画面に遷移
        authHandlersStateManager.dispatch({
          type: 'NAVIGATE',
          payload: {
            to: 'editProfile',
            context: {
              currentUser: {
                ...state.currentUser,
                ...response.data,
              },
            },
          },
        });
      } else {
        showInfo(
          response.message || 'プロフィール情報の取得に失敗しました。',
          'エラー',
        );
      }
    })
      ['withFailureHandler']((/** @type {any} */ error) => {
        hideLoading();
        showInfo('プロフィール情報の取得中にエラーが発生しました。', 'エラー');
        console.error('showEditProfile error:', error);
      })
      .getUserDetailForEdit(studentId);
  },

  /** プロフィール情報を保存します（キャッシュ活用版） */
  saveProfile: () => {
    const futureCreationsInput = /** @type {HTMLTextAreaElement | null} */ (
      document.getElementById('edit-future-goal')
    );
    const realNameInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById('edit-realname')
    );
    const nicknameInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById('edit-nickname')
    );
    const addressInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById('edit-address')
    );

    const futureCreations = futureCreationsInput?.value?.trim() || '';
    const r = realNameInput?.value;
    let n = nicknameInput?.value.trim();
    const address = addressInput?.value?.trim() || '';

    if (!r) return showInfo('おなまえ（本名）は必須です。');
    if (!n) n = r;

    // 電話番号は表示のみなので、現在の値を使用
    const currentUser = authHandlersStateManager.getState().currentUser;
    if (!currentUser) {
      return showInfo('ユーザー情報が見つかりません。', 'エラー');
    }
    const phone = currentUser.phone;

    // メール情報の取得とバリデーション
    const emailInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById('edit-email')
    );
    const wantsEmailInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById('edit-wants-email')
    );
    const email = emailInput?.value?.trim() || '';
    const wantsEmail = wantsEmailInput?.checked || false;

    // メールアドレスの必須バリデーション
    if (!email || !email.includes('@')) {
      return showInfo('有効なメールアドレスを入力してください。', '入力エラー');
    }

    // 通知設定の取得
    const wantsScheduleNotificationInput =
      /** @type {HTMLInputElement | null} */ (
        document.getElementById('edit-wants-schedule-notification')
      );
    const notificationDayInput = /** @type {HTMLSelectElement | null} */ (
      document.getElementById('edit-notification-day')
    );
    const notificationHourInput = /** @type {HTMLSelectElement | null} */ (
      document.getElementById('edit-notification-hour')
    );
    const wantsScheduleNotification =
      wantsScheduleNotificationInput?.checked || false;
    const notificationDay =
      wantsScheduleNotification && notificationDayInput?.value
        ? parseInt(notificationDayInput.value)
        : null;
    const notificationHour =
      wantsScheduleNotification && notificationHourInput?.value
        ? parseInt(notificationHourInput.value)
        : null;

    const u = {
      ...authHandlersStateManager.getState().currentUser,
      futureCreations: futureCreations,
      realName: r,
      nickname: n,
      phone: phone,
      email: email || '',
      wantsEmail: wantsEmail || false,
      wantsScheduleNotification: wantsScheduleNotification,
      notificationDay: notificationDay,
      notificationHour: notificationHour,
      address: address,
    };
    showLoading('booking');
    google.script.run['withSuccessHandler']((/** @type {any} */ res) => {
      hideLoading();
      if (res.success) {
        // プロフィール更新後、キャッシュも更新されているのでそのまま状態更新
        showInfo('プロフィールを更新しました', '更新完了');
        const updatedUser = res.data?.updatedUser;
        authHandlersStateManager.dispatch({
          type: 'SET_STATE',
          payload: {
            currentUser: updatedUser || null,
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

  /** ログイン画面に戻ります（電話番号入力値を保存） */
  goBackToLogin: () => {
    const phoneInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById('phone')
    );
    const loginPhone = phoneInput
      ? phoneInput.value
      : authHandlersStateManager.getState()['loginPhone'];
    authHandlersStateManager.dispatch({
      type: 'NAVIGATE',
      payload: { to: 'login', context: { loginPhone: loginPhone } },
    });
  },

  /** ログアウト処理を実行します */
  logout: () => {
    showConfirm({
      title: 'ログアウト',
      message: 'ログアウトしますか？',
      confirmText: 'ログアウト',
      cancelText: 'キャンセル',
      onConfirm: () => {
        // ログアウト処理（stateをクリア）
        authHandlersStateManager.dispatch({ type: 'LOGOUT' });
        // ログイン画面に遷移
        authHandlersStateManager.dispatch({
          type: 'NAVIGATE',
          payload: { to: 'login' },
        });
        showInfo('ログアウトしました', '成功');
      },
    });
  },

  /** アカウント退会処理を実行します（タスク2実装） */
  requestAccountDeletion: () => {
    const state = authHandlersStateManager.getState();
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
      onConfirm: () => {
        // 確認された場合のみ実行
        showLoading();

        // バックエンドに退会リクエストを送信
        google.script.run['withSuccessHandler'](
          (/** @type {any} */ response) => {
            hideLoading();
            if (response.success) {
              // 成功メッセージを表示
              showInfo(
                '退会処理が完了しました。ご利用ありがとうございました。',
                '退会完了',
              );

              // ログアウト処理（stateをクリア）
              setTimeout(() => {
                authHandlersStateManager.dispatch({ type: 'LOGOUT' });
                // ログイン画面に遷移
                authHandlersStateManager.dispatch({
                  type: 'NAVIGATE',
                  payload: { to: 'login' },
                });
              }, 2000);
            } else {
              showInfo(
                response.message || '退会処理に失敗しました。',
                'エラー',
              );
            }
          },
        )
          ['withFailureHandler']((/** @type {any} */ error) => {
            hideLoading();
            showInfo('退会処理中にエラーが発生しました。', 'エラー');
            console.error('requestAccountDeletion error:', error);
          })
          .requestAccountDeletion(studentId);
      },
    });
  },

  /** プライバシーポリシーを表示します（タスク1実装） */
  showPrivacyPolicy: async () => {
    if (privacyPolicyOpenPromise) {
      await privacyPolicyOpenPromise;
      return;
    }

    privacyPolicyOpenPromise = (async () => {
      try {
        await ensureMarkedLoaded();
      } catch (error) {
        console.error('marked.jsの遅延読み込みに失敗しました:', error);
        showInfo(
          'プライバシーポリシーの読み込みに失敗しました。時間をおいて再度お試しください。',
          '読み込みエラー',
        );
        return;
      }

      // 既存モーダルがあれば再利用して表示する
      const existingModal = document.getElementById('privacy-policy-modal');
      if (existingModal) {
        Components.showModal('privacy-policy-modal');
        return;
      }

      // モーダルHTMLを生成してDOMに追加
      const modalHtml = getPrivacyPolicyModal();
      const appContainer = document.getElementById('app');
      if (appContainer) {
        appContainer.insertAdjacentHTML('beforeend', modalHtml);
        Components.showModal('privacy-policy-modal');
      }
    })();

    try {
      await privacyPolicyOpenPromise;
    } finally {
      privacyPolicyOpenPromise = null;
    }
  },

  /** プライバシーポリシーモーダルを閉じます（タスク1実装） */
  closePrivacyPolicy: () => {
    Components.closeModal('privacy-policy-modal');
  },

  /** 新規ユーザー登録：ウェルカムメッセージを閉じる */
  closeWelcomeModal: () => {
    Components.closeModal('welcome-modal');
  },
};
