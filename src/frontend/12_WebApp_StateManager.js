/**
 * =================================================================
 * ファイル概要
 * -----------------------------------------------------------------
 * 名称: 12_WebApp_StateManager.js
 * 目的: フロントエンドの状態を一元管理し、UI更新とデータ整合性を担保する
 * 主な責務:
 *   - `dispatch`/`subscribe`を備えたシンプルな状態管理クラスを提供
 *   - localStorageによる状態復元と保存を管理
 *   - 計算済みデータや履歴管理などUI層の共通機能を保持
 * AI向けメモ:
 *   - 状態構造を拡張する際は`initialState`と永続化ロジック（restore/save）双方を更新する
 * =================================================================
 */

/**
 * @typedef {SimpleStateManager} StateManagerContract
 * @typedef {UIState} UIStateAlias
 * @typedef {(newState: UIState, oldState: UIState) => void} StateSubscriber
 * @typedef {StateAction} StateActionAlias
 * @typedef {StateActionPayload} StateActionPayloadAlias
 * @typedef {ComputedStateData} ComputedStateDataAlias
 */

/**
 * フロントエンド用PerformanceLogフォールバック
 * バックエンドで定義されたPerformanceLogがフロントエンドで未定義の場合の安全策
 */

/**
 * 空の会計詳細データを生成
 * @returns {AccountingDetailsCore}
 */
const createEmptyAccountingDetails = () => ({
  tuition: { items: [], subtotal: 0 },
  sales: { items: [], subtotal: 0 },
  grandTotal: 0,
  paymentMethod: CONSTANTS.PAYMENT_DISPLAY.CASH,
});

if (!appWindow.PerformanceLog) {
  appWindow.PerformanceLog = {
    debug(/** @type {string} */ message, /** @type {...any} */ ...args) {
      if (typeof debugLog === 'function') {
        debugLog(`[DEBUG] ${message}`);
      } else if (typeof console !== 'undefined') {
        console.log(`[DEBUG] ${message}`, ...args);
      }
    },
    info(/** @type {string} */ message, /** @type {...any} */ ...args) {
      if (typeof debugLog === 'function') {
        debugLog(`[INFO] ${message}`);
      } else if (typeof console !== 'undefined') {
        console.info(`[INFO] ${message}`, ...args);
      }
    },
    error(/** @type {string} */ message, /** @type {...any} */ ...args) {
      if (typeof console !== 'undefined') {
        console.error(`[ERROR] ${message}`, ...args);
      }
    },
  };
}

/**
 * シンプルな状態管理システム（リロード時状態保持対応）
 */
export class SimpleStateManager {
  constructor() {
    /** @type {string} */
    this.STORAGE_KEY = 'yoyaku_kiroku_state';

    /** @type {UIState} */
    this.state = {
      // --- User & Session Data ---
      ...this._getInitialState(),
    };

    /** @type {boolean} 無限ループ防止フラグ */
    this.isUpdating = false;
    /** @type {StateSubscriber[]} 状態変更の購読者リスト */
    this.subscribers = [];
    /** @type {number | null} 自動保存タイマーID */
    this._saveTimeout = null;
    /** @type {boolean} リロード時に状態が復元されたかどうか */
    this._restoredFromStorage = false;

    // 【リロード対応】ページロード時に保存状態を復元
    this._restoredFromStorage = this.restoreStateFromStorage();
  }

  /**
   * 初期状態を返します
   * @returns {UIState} 初期状態
   * @private
   */
  _getInitialState() {
    return {
      // --- User & Session Data ---
      /** @type {UserCore | null} */
      currentUser: null,
      /** @type {UserCore | null} なりすまし操作時の元の管理者ユーザー */
      adminImpersonationOriginalUser: null,
      /** @type {string} */
      loginPhone: '',
      /** @type {boolean} */
      isFirstTimeBooking: false,
      /** @type {RegistrationFormData} */
      registrationData: {},
      /** @type {string | null} */
      registrationPhone: null,

      // --- Core Application Data ---
      /** @type {LessonCore[]} */
      lessons: [],
      /** @type {ReservationCore[]} */
      myReservations: [],
      /** @type {AccountingMasterItemCore[]} */
      accountingMaster: [],

      // --- UI State ---
      /** @type {ViewType} */
      view: 'login',
      /** @type {string | null} */
      selectedClassroom: null,
      /** @type {Set<string>} 編集モード中の予約ID一覧 */
      editingReservationIds: new Set(),
      editingMemo: null, // { reservationId: string, originalValue: string } | null
      memoInputChanged: false,
      /** @type {LessonCore | null} */
      selectedLesson: null,
      /** @type {ReservationCore | null} */
      editingReservationDetails: null,
      /** @type {ReservationCore | null} - 会計画面の基本予約情報 (ID, 教室, 日付など) */
      accountingReservation: null,
      /** @type {AccountingDetailsCore} - 予約固有の詳細情報 (開始時刻, レンタル, 割引など) */
      accountingReservationDetails: createEmptyAccountingDetails(),
      /** @type {ScheduleInfo | null} - 講座固有情報 (教室形式, 開講時間など) */
      accountingScheduleInfo: null,
      /** @type {AccountingDetailsCore | null} - 会計計算結果 */
      accountingDetails: null,
      /** @type {string} */ completionMessage: '',
      /** @type {number} */ recordsToShow: 10,
      /** @type {number} */ registrationStep: 1,
      /** @type {UserCore[]} */
      searchedUsers: [],
      /** @type {boolean} */
      searchAttempted: false,

      // --- New Context for Forms ---
      /** @type {ReservationFormContext | null} - 予約フォーム専用コンテキスト */
      currentReservationFormContext: null,

      // --- Navigation History ---
      /** @type {StateNavigationHistoryEntry[]} */
      navigationHistory: [],

      // --- System State ---
      /** @type {boolean} */
      isDataFresh: false,
      /** @type {boolean} */
      _dataUpdateInProgress: false,
      /** @type {string | null} */
      _lessonsVersion: null,
      /** @type {Record<string, boolean>} データタイプ別取得中フラグ */
      _dataFetchInProgress: /** @type {Record<string, boolean>} */ ({}),
      /** @type {Record<string, number>} データタイプ別最終更新時刻 */
      _dataLastUpdated: /** @type {Record<string, number>} */ ({}),

      // --- Computed Data ---
      /** @type {ComputedStateData} */
      computed: {},

      // --- Form Input Cache (リロード時保持用) ---
      /** @type {Record<string, any>} */
      formInputCache: {},
    };
  }

  /**
   * アクションをディスパッチして状態を更新し、UIを自動再描画
   * @param {StateAction} action - アクションオブジェクト { type: ActionType, payload?: StateActionPayload }
   */
  dispatch(action) {
    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      console.log(
        '🎯 Action dispatched:',
        action.type,
        action.payload ? Object.keys(action.payload) : 'no payload',
      );
    }

    // 現在のビューを記録（ページ遷移判定用）
    const previousView = this.state.view;

    // アクションに基づいて状態更新
    /** @type {Partial<UIState>} */
    let newState = {};
    const payload = action.payload || {};

    switch (action.type) {
      case 'SET_STATE':
        newState = payload;
        break;
      case 'UPDATE_STATE':
        newState = payload;
        break;
      case 'CHANGE_VIEW':
        newState = { view: payload['view'] };
        break;
      case 'NAVIGATE':
        newState = this._handleNavigate(payload);
        break;
      case 'LOGOUT':
        this.clearStoredState();
        newState = this._getInitialState();
        break;
      default:
        console.warn('未知のアクションタイプ:', action.type);
        return;
    }

    // 内部の状態更新メソッドを呼び出し
    this._updateState(newState);

    // ページ遷移が発生した場合のスクロール管理
    if (
      'view' in newState &&
      newState.view &&
      newState.view !== previousView &&
      appWindow.pageTransitionManager &&
      appWindow.pageTransitionManager.onPageTransition
    ) {
      const viewValue = /** @type {ViewType} */ (newState.view);
      appWindow.pageTransitionManager.onPageTransition(viewValue);
    }

    // 最終的な状態更新（画面遷移を伴う）でのみローディング非表示を実行
    const isViewChange =
      'view' in newState && newState.view && newState.view !== previousView;
    const hasSubstantialData =
      ('lessons' in newState && newState.lessons) ||
      ('myReservations' in newState && newState.myReservations) ||
      ('currentUser' in newState && newState.currentUser);
    const isFinalUpdate =
      action.type === 'SET_STATE' && (isViewChange || hasSubstantialData);

    if (isFinalUpdate) {
      this._shouldHideLoadingAfterRender = true;
    }

    // UI を自動で再描画
    this._scheduleRender();
  }

  /**
   * 状態を更新（内部メソッド）
   * @param {Partial<UIState>} newState - 新しい状態
   */
  _updateState(newState) {
    if (this.isUpdating) {
      console.warn('状態更新中のため処理をスキップ');
      return;
    }

    this.isUpdating = true;

    try {
      // 変更前の状態を保存（subscriber用）
      const oldState = { ...this.state };

      // 状態を直接更新
      Object.assign(this.state, newState);

      // 基本的な計算済みデータ更新
      this.updateComputed();

      // subscriberに変更を通知
      this._notifySubscribers(this.state, oldState);

      // 【リロード対応】重要な状態変更時は自動保存
      this._autoSaveIfNeeded(oldState, newState);

      if (CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
        console.log('✅ 状態更新完了:', Object.keys(newState));
      }
    } catch (error) {
      console.error('❌ 状態更新エラー:', error);
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * 計算済みデータの基本更新
   */
  updateComputed() {
    if (!this.state.myReservations) return;

    // シンプルに完了済み予約の有無で判定
    // 空き通知希望だけでは経験者扱いにしない
    const hasCompletedReservation = this.state.myReservations.some(
      (/** @type {ReservationCore} */ reservation) => {
        const normalizedStatus = String(reservation.status || '').trim();
        return normalizedStatus === CONSTANTS.STATUS.COMPLETED;
      },
    );

    this.state.isFirstTimeBooking = !hasCompletedReservation;

    if (!this.state.isFirstTimeBooking && typeof localStorage !== 'undefined') {
      // 初心者モードが自動的に解除されたら「初回」固定の手動設定をクリア
      if (localStorage.getItem('beginnerModeOverride') === 'true') {
        localStorage.removeItem('beginnerModeOverride');
      }
    }
  }

  /**
   * 実際に使用する初心者モードの値を取得
   * ユーザーの手動設定を優先、なければ自動判定
   * @returns {boolean} true: 初心者モード, false: 経験者モード
   */
  getEffectiveBeginnerMode() {
    const override =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem('beginnerModeOverride')
        : null;

    if (!this.state.isFirstTimeBooking) {
      // 初心者扱いでない場合は常に経験者モード
      return false;
    }

    if (override !== null) {
      return override === 'true';
    }

    return true;
  }

  /**
   * 初心者モードを手動設定
   * @param {boolean|null} value - true: 初心者, false: 経験者, null: 自動
   */
  setBeginnerModeOverride(value) {
    if (typeof localStorage !== 'undefined') {
      if (value === null) {
        localStorage.removeItem('beginnerModeOverride');
      } else {
        localStorage.setItem('beginnerModeOverride', String(value));
      }
    }
    // 状態変更を購読者に通知（画面再描画をトリガー）
    this.dispatch({ type: 'UPDATE_STATE', payload: {} });
  }

  /**
   * requestAnimationFrameを使ったレンダリングスケジューリング
   */
  _scheduleRender() {
    if (this._renderScheduled) {
      return; // 既にスケジュール済み
    }

    this._renderScheduled = true;
    requestAnimationFrame(() => {
      this._renderScheduled = false;
      if (typeof appWindow.render === 'function') {
        console.log('🎨 Auto-rendering UI...');
        appWindow.render();
        // 特定のaction.typeでのみローディングを非表示（最終的な状態更新のみ）
        if (this._shouldHideLoadingAfterRender) {
          if (typeof hideLoading === 'function') hideLoading();
          this._shouldHideLoadingAfterRender = false;
        }
      } else {
        console.warn('render関数が見つかりません');
      }
    });
  }

  /**
   * 現在の状態を取得
   * @returns {UIState} 現在の状態
   */
  getState() {
    return this.state;
  }

  /**
   * 状態変更を購読する
   * @param {StateSubscriber} callback - 状態変更時に呼び出される関数 (newState, oldState) => void
   * @returns {() => void} unsubscribe関数
   */
  subscribe(callback) {
    this.subscribers.push(callback);

    // unsubscribe関数を返す
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * subscriberに状態変更を通知する
   * @param {UIState} newState - 新しい状態
   * @param {UIState} oldState - 古い状態
   */
  _notifySubscribers(newState, oldState) {
    this.subscribers.forEach(callback => {
      try {
        callback(newState, oldState);
      } catch (error) {
        console.error('subscriber callback error:', error);
      }
    });
  }

  /**
   * ナビゲーションアクションを処理し、履歴を管理する
   * @param {StateActionPayload} payload - { to: ViewType, context?: NavigationContext, saveHistory?: boolean }
   * @returns {Partial<UIState>} 新しい状態
   */
  _handleNavigate(payload) {
    const to = /** @type {ViewType} */ (payload.to);
    const context = /** @type {NavigationContext} */ (payload.context || {});
    const saveHistory = payload.saveHistory !== false;
    const currentView = this.state.view;

    // 現在のビューを履歴に保存（もどる履歴として）
    // ビューが異なる場合、または同じビューでもコンテキスト（ステップなど）が大きく異なる場合
    const isSameView = currentView === to;
    const isDifferentStep =
      currentView === 'sessionConclusion' &&
      isSameView &&
      this._extractCurrentContext()['step'] !== context['step'];

    if (saveHistory && (!isSameView || isDifferentStep)) {
      const currentContext = this._extractCurrentContext();
      const historyEntry = { view: currentView, context: currentContext };

      // 同じビューかつ同じコンテキストの連続エントリを避ける
      const lastEntry =
        this.state.navigationHistory[this.state.navigationHistory.length - 1];
      const isDuplicateEntry =
        lastEntry &&
        lastEntry.view === currentView &&
        JSON.stringify(lastEntry.context) === JSON.stringify(currentContext);

      if (!isDuplicateEntry) {
        const newHistory = [...this.state.navigationHistory, historyEntry];
        // 履歴を最大10件に制限
        if (newHistory.length > 10) {
          newHistory.shift();
        }
        return {
          view: to,
          ...context,
          navigationHistory: newHistory,
        };
      }
    }

    return {
      view: to,
      ...context,
    };
  }

  /**
   * 現在のビューのコンテキストを抽出する
   * @returns {NavigationContext} コンテキストオブジェクト
   */
  _extractCurrentContext() {
    const context = {};

    // ビューに応じて重要な状態を保存
    switch (this.state.view) {
      case 'bookingLessons':
        if (this.state.selectedClassroom) {
          context.selectedClassroom = this.state.selectedClassroom;
        }
        break;
      case 'newReservation':
      case 'editReservation':
        if (this.state.selectedLesson) {
          context.selectedLesson = this.state.selectedLesson;
          context.selectedClassroom = this.state.selectedClassroom;
        }
        if (this.state.editingReservationDetails) {
          context.editingReservationDetails =
            this.state.editingReservationDetails;
        }
        break;
      case 'accounting':
        if (this.state.accountingReservation) {
          context.accountingReservation = this.state.accountingReservation;
        }
        break;
      case 'accounting':
        if (this.state.accountingReservation) {
          context.accountingReservation = this.state.accountingReservation;
        }
        break;
      case 'sessionConclusion':
        // ウィザードの現在のステップを保存
        // Note: handlers側で管理されているwizardStateを直接参照できないため
        // startSessionConclusion時にcontextにstepを含める運用とする
        // ここでは、もしstateにstepが含まれていればそれを保存
        if (/** @type {any} */ (this.state).step) {
          context.step = /** @type {any} */ (this.state).step;
        }
        break;
      default:
        break;
    }

    return context;
  }

  /**
   * 前のビューにもどる
   * @returns {Partial<UIState>} 新しい状態、または戻れない場合はnull
   */
  goBack() {
    const history = this.state.navigationHistory;
    if (history.length === 0) {
      console.log('ナビゲーション履歴が空です - ホームに戻ります');
      return { view: 'dashboard' };
    }

    const previousEntry = history[history.length - 1];
    const newHistory = history.slice(0, -1); // 最後のエントリを削除

    return {
      view: previousEntry.view,
      ...previousEntry.context,
      navigationHistory: newHistory,
    };
  }

  /**
   * 編集モードを開始する
   * @param {string} reservationId - 予約ID
   * @param {string} [originalMemo=''] - 編集前のメモ内容
   */
  startEditMode(reservationId, originalMemo = '') {
    this.state.editingReservationIds.add(reservationId);
    // 同期的状態更新のみ実行（dispatch不要でチラツキ防止）
    this.state.editingMemo = { reservationId, originalValue: originalMemo };
    this.state.memoInputChanged = false;
  }

  /**
   * メモの変更状態を更新する（同期的に実行）
   * @param {string} reservationId - 予約ID
   * @param {string} currentValue - 現在のメモ内容
   */
  updateMemoInputChanged(reservationId, currentValue) {
    const editingMemo = this.state.editingMemo;
    if (editingMemo && editingMemo.reservationId === reservationId) {
      const hasChanged = currentValue !== editingMemo.originalValue;
      if (this.state.memoInputChanged !== hasChanged) {
        // 同期的に状態を更新（UI全体再描画を避けるため、dispatchを使わない）
        this.state.memoInputChanged = hasChanged;

        return hasChanged; // 変更状態を返す
      }
    }
    return this.state.memoInputChanged; // 現在の状態を返す
  }

  /**
   * 編集モードを終了する
   * @param {string} reservationId - 予約ID
   */
  endEditMode(reservationId) {
    this.state.editingReservationIds.delete(reservationId);
    if (
      this.state.editingMemo &&
      this.state.editingMemo.reservationId === reservationId
    ) {
      // 同期的状態更新のみ実行（dispatch不要でチラツキ防止）
      this.state.editingMemo = null;
      this.state.memoInputChanged = false;
    }
  }

  /**
   * 指定された予約が編集モードかチェック
   * @param {string} reservationId - 予約ID
   * @returns {boolean}
   */
  isInEditMode(reservationId) {
    return this.state.editingReservationIds.has(reservationId);
  }

  /**
   * すべての編集モードをクリア
   */
  clearAllEditModes() {
    this.state.editingReservationIds.clear();
    this.dispatch({
      type: 'UPDATE_STATE',
      payload: {
        editingMemo: null,
        memoInputChanged: false,
      },
    });
  }
  /**
   * 自動保存判定 - 重要な状態が変更された時のみ保存
   * @param {UIState} oldState - 変更前の状態
   * @param {Partial<UIState>} newState - 変更された部分
   * @private
   */
  _autoSaveIfNeeded(oldState, newState) {
    // ログイン画面に戻る場合は保存状態をクリア(ログアウト扱い)
    if (
      'view' in newState &&
      newState.view === 'login' &&
      oldState.view !== 'login'
    ) {
      appWindow.PerformanceLog?.info('ログイン画面に戻るため保存状態をクリア');
      this.clearStoredState();
      return;
    }

    // 保存対象となる重要な状態変更
    const importantChanges = /** @type {(keyof UIState)[]} */ ([
      'currentUser',
      'loginPhone',
      'view',
      'selectedClassroom',
      'isFirstTimeBooking',
      'registrationData',
      'registrationPhone',
    ]);

    const hasImportantChange = importantChanges.some(
      key => key in newState && oldState[key] !== newState[key],
    );

    if (hasImportantChange) {
      // 500ms後に保存（連続変更をまとめるため）
      if (this._saveTimeout !== null) {
        clearTimeout(this._saveTimeout);
      }
      this._saveTimeout = window.setTimeout(() => {
        this.saveStateToStorage();
      }, 500);
    }
  }

  /**
   * リロード時状態保持機能 - 状態をSessionStorageに保存
   * ブラウザタブが開いている間のみ保持（タブ閉じで自動クリア）
   */
  saveStateToStorage() {
    try {
      // Setオブジェクトは直接JSON化できないため、Arrayに変換
      const stateToSave = {
        ...this.state,
        editingReservationIds: Array.from(this.state.editingReservationIds),
      };

      // 保存対象の状態のみを選択（大量データは除外）
      // 【安全策】なりすまし中は元の管理者ユーザーを保存する
      const currentUserToSave =
        stateToSave.adminImpersonationOriginalUser || stateToSave.currentUser;

      const essentialState = {
        currentUser: currentUserToSave,
        loginPhone: stateToSave.loginPhone,
        view: stateToSave.view,
        selectedClassroom: stateToSave.selectedClassroom,
        isFirstTimeBooking: stateToSave.isFirstTimeBooking,
        registrationData: stateToSave.registrationData,
        registrationPhone: stateToSave.registrationPhone,
        editingReservationIds: stateToSave.editingReservationIds,
        // フォーム入力キャッシュ（編集中の入力値を保持）
        formInputCache:
          /** @type {any} */ (stateToSave)['formInputCache'] || {},
        // タイムスタンプを追加（有効期限チェック用）
        savedAt: Date.now(),
        // アプリバージョン（更新検知用）
        appVersion: CONSTANTS.ENVIRONMENT.APP_VERSION,
      };

      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(essentialState));
      appWindow.PerformanceLog?.debug('状態をSessionStorageに保存しました');
    } catch (error) {
      appWindow.PerformanceLog?.error(`状態保存エラー: ${error.message}`);
    }
  }

  /**
   * リロード時状態保持機能 - SessionStorageから状態を復元
   * @returns {boolean} 復元が成功したかどうか
   */
  restoreStateFromStorage() {
    try {
      const savedState = sessionStorage.getItem(this.STORAGE_KEY);
      if (!savedState) {
        appWindow.PerformanceLog?.debug('保存された状態がありません');
        return false;
      }

      const parsedState = JSON.parse(savedState);

      // 有効期限チェック（6時間以内）
      const sixHoursInMs = 6 * 60 * 60 * 1000;
      if (Date.now() - parsedState.savedAt > sixHoursInMs) {
        appWindow.PerformanceLog?.debug('保存された状態が期限切れです');
        sessionStorage.removeItem(this.STORAGE_KEY);
        return false;
      }

      // バージョンチェック（アプリ更新検知）
      const currentVersion = CONSTANTS.ENVIRONMENT.APP_VERSION;
      if (parsedState.appVersion && parsedState.appVersion !== currentVersion) {
        appWindow.PerformanceLog?.info(
          `アプリ更新を検知: ${parsedState.appVersion} → ${currentVersion}（自動ログアウト）`,
        );
        sessionStorage.removeItem(this.STORAGE_KEY);
        return false;
      }

      // 状態を復元（マージ）
      this.state = {
        ...this.state,
        ...parsedState,
        editingReservationIds: new Set(parsedState.editingReservationIds || []),
      };

      // savedAtは内部データなので削除
      delete this.state.savedAt;

      // ウィザード状態キャッシュがある場合、ビューをsessionConclusionに設定
      // （実際の復元はtryRestoreWizardFromCacheで行う）
      if (this.state['formInputCache']?.['wizardState']?.currentReservationId) {
        this.state.view = 'sessionConclusion';
        appWindow.PerformanceLog?.info(
          'ウィザード状態キャッシュを検出、sessionConclusionビューに設定',
        );
      }

      appWindow.PerformanceLog?.info('状態をSessionStorageから復元しました');
      return true;
    } catch (error) {
      appWindow.PerformanceLog?.error(`状態復元エラー: ${error.message}`);
      sessionStorage.removeItem(this.STORAGE_KEY);
      return false;
    }
  }

  /**
   * 状態保存を無効にする（ログアウト時など）
   */
  clearStoredState() {
    try {
      sessionStorage.removeItem(this.STORAGE_KEY);
      appWindow.PerformanceLog?.debug('保存された状態をクリアしました');
    } catch (error) {
      appWindow.PerformanceLog?.error(`状態クリアエラー: ${error.message}`);
    }
  }

  /**
   * なりすまし操作を開始
   * @param {UserCore} targetUser - なりすまし対象のユーザー
   */
  startImpersonation(targetUser) {
    const currentState = this.state;
    // 既に元の管理者が保存されていない場合のみ保存（二重なりすまし防止）
    const originalUser =
      currentState.adminImpersonationOriginalUser || currentState.currentUser;

    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      console.log('🎭 startImpersonation:', {
        target: targetUser?.studentId,
        original: originalUser?.studentId,
      });
    }

    this.dispatch({
      type: 'UPDATE_STATE',
      payload: {
        currentUser: targetUser,
        adminImpersonationOriginalUser: originalUser,
      },
    });
    this.saveStateToStorage(); // 状態を即時保存
  }

  /**
   * なりすまし操作を終了し、元の管理者に戻る
   */
  endImpersonation() {
    const currentState = this.state;
    const originalUser = currentState.adminImpersonationOriginalUser;

    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      console.log('🎭 endImpersonation:', {
        hadOriginal: !!originalUser,
        originalId: originalUser?.studentId,
      });
    }

    if (originalUser) {
      this.dispatch({
        type: 'UPDATE_STATE',
        payload: {
          currentUser: originalUser,
          adminImpersonationOriginalUser: null,
        },
      });
      this.saveStateToStorage(); // 状態を即時保存
    }
  }

  /**
   * 講座データの更新が必要かチェック
   * @param {number} [cacheExpirationMinutes=10] - キャッシュ有効期限（分）
   * @returns {boolean} 更新が必要な場合true
   */
  needsLessonsUpdate(cacheExpirationMinutes = 10) {
    // 安全な初期化
    if (!this._dataFetchInProgress) {
      this._dataFetchInProgress = {};
    }
    if (!this._dataLastUpdated) {
      this._dataLastUpdated = {};
    }

    // 現在講座データ取得中の場合はfalse
    if (
      /** @type {Record<string, boolean>} */ (this._dataFetchInProgress)[
        'lessons'
      ]
    ) {
      appWindow.PerformanceLog?.debug('講座データ取得中のため更新スキップ');
      return false;
    }

    // 講座データが存在しない場合は更新必要
    if (
      !this.state.lessons ||
      !Array.isArray(this.state.lessons) ||
      this.state.lessons.length === 0
    ) {
      appWindow.PerformanceLog?.debug('講座データが存在しないため更新必要');
      return true;
    }

    // 最終更新時刻チェック
    const lastUpdated = /** @type {Record<string, number>} */ (
      this._dataLastUpdated
    )['lessons'];
    if (!lastUpdated) {
      appWindow.PerformanceLog?.debug(
        '講座データの更新時刻が未設定のため更新必要',
      );
      return true;
    }

    const expirationTime = cacheExpirationMinutes * 60 * 1000; // ミリ秒に変換
    const isExpired = Date.now() - lastUpdated > expirationTime;

    if (isExpired) {
      appWindow.PerformanceLog?.debug(
        `講座データキャッシュが期限切れ（${cacheExpirationMinutes}分経過）`,
      );
      return true;
    }

    appWindow.PerformanceLog?.debug('講座データキャッシュは有効');
    return false;
  }

  /**
   * データタイプの取得状態を管理
   * @param {string} dataType - データタイプ（'lessons', 'reservations'など）
   * @param {boolean} isInProgress - 取得中かどうか
   */
  setDataFetchProgress(dataType, isInProgress) {
    // 安全な初期化
    if (!this._dataFetchInProgress) {
      this._dataFetchInProgress = {};
    }
    if (!this._dataLastUpdated) {
      this._dataLastUpdated = {};
    }

    /** @type {Record<string, boolean>} */ (this._dataFetchInProgress)[
      dataType
    ] = isInProgress;

    if (!isInProgress) {
      // 取得完了時に更新時刻を記録
      /** @type {Record<string, number>} */ (this._dataLastUpdated)[dataType] =
        Date.now();
      appWindow.PerformanceLog?.debug(
        `${dataType}データ取得完了：${new Date().toLocaleTimeString()}`,
      );
    } else {
      appWindow.PerformanceLog?.debug(`${dataType}データ取得開始`);
    }
  }

  /**
   * 特定のデータタイプが取得中かチェック
   * @param {string} dataType - データタイプ
   * @returns {boolean} 取得中の場合true
   */
  isDataFetchInProgress(dataType) {
    // 安全な初期化
    if (!this._dataFetchInProgress) {
      this._dataFetchInProgress = {};
    }
    return !!(
      /** @type {Record<string, boolean>} */ (this._dataFetchInProgress)[
        dataType
      ]
    );
  }

  /**
   * 講座データのキャッシュバージョンを更新
   * @param {string} newVersion - 新しいバージョン
   */
  updateLessonsVersion(newVersion) {
    if (this.state._lessonsVersion !== newVersion) {
      this.state._lessonsVersion = newVersion;
      this.setDataFetchProgress('lessons', false);
      appWindow.PerformanceLog?.debug(
        `講座データバージョンを更新: ${newVersion}`,
      );
    }
  }

  /**
   * リロード復元後にデータ再取得が必要かどうかを判定
   * ユーザー情報はあるがデータがない場合にtrueを返す
   * @returns {boolean} データ再取得が必要な場合true
   */
  needsDataRefresh() {
    // 復元されていなければ不要
    if (!this._restoredFromStorage) {
      return false;
    }

    // ユーザー情報がなければ不要（ログイン画面へ）
    if (!this.state.currentUser) {
      return false;
    }

    // ログイン画面の場合は不要
    if (this.state.view === 'login' || this.state.view === 'register') {
      return false;
    }

    // 基本データ（lessons）がなければ全ユーザーで再取得必要
    const hasLessons =
      this.state.lessons &&
      Array.isArray(this.state.lessons) &&
      this.state.lessons.length > 0;

    if (!hasLessons) {
      appWindow.PerformanceLog?.info(
        'リロード復元: lessonsデータがないため再取得必要',
      );
      return true;
    }

    // 管理者の場合はadminLogsもチェック（大きいデータなのでsessionStorageに保存していない）
    const isAdmin = this.state.currentUser?.isAdmin === true;
    if (isAdmin) {
      const hasAdminLogs =
        this.state['adminLogs'] &&
        Array.isArray(this.state['adminLogs']) &&
        this.state['adminLogs'].length > 0;

      if (!hasAdminLogs) {
        appWindow.PerformanceLog?.info(
          'リロード復元: adminLogsデータがないため再取得必要',
        );
        return true;
      }
    }

    return false;
  }

  /**
   * 復元された電話番号を取得（データ再取得用）
   * @returns {string | null} 電話番号、またはnull
   */
  getRestoredPhone() {
    // 復元されていなければnull
    if (!this._restoredFromStorage) {
      return null;
    }

    // loginPhoneを優先、なければcurrentUserのphone
    if (this.state.loginPhone) {
      return this.state.loginPhone;
    }

    if (this.state.currentUser?.phone) {
      return this.state.currentUser.phone;
    }

    return null;
  }

  /**
   * データ再取得完了後にフラグをリセット
   */
  markDataRefreshComplete() {
    this._restoredFromStorage = false;
    appWindow.PerformanceLog?.info('リロード復元: データ再取得完了');
  }

  // =================================================================
  // --- Form Input Cache Methods (リロード時入力保持用) ---
  // =================================================================

  /**
   * フォーム入力をキャッシュに保存
   * 注意: 再描画を避けるため dispatch を使わず直接 state を更新
   * @param {string} key - キャッシュキー（例: 'goalEdit', 'memoEdit:reservationId'）
   * @param {any} value - 保存する値
   */
  cacheFormInput(key, value) {
    const currentCache = this.state['formInputCache'] || {};
    // 直接stateを更新（dispatchすると再描画が走り保存処理が妨げられる）
    this.state['formInputCache'] = {
      ...currentCache,
      [key]: value,
    };
    // sessionStorageに保存
    this.saveStateToStorage();
  }

  /**
   * フォーム入力キャッシュから値を取得
   * @param {string} key - キャッシュキー
   * @returns {any} キャッシュされた値（存在しない場合はundefined）
   */
  getFormInputCache(key) {
    return (this.state['formInputCache'] || {})[key];
  }

  /**
   * フォーム入力キャッシュをクリア
   * 注意: 再描画を避けるため dispatch を使わず直接 state を更新
   * @param {string} key - クリアするキャッシュキー
   */
  clearFormInputCache(key) {
    const currentCache = { ...(this.state['formInputCache'] || {}) };
    delete currentCache[key];
    // 直接stateを更新
    this.state['formInputCache'] = currentCache;
    // sessionStorageに保存
    this.saveStateToStorage();
  }

  /**
   * すべてのフォーム入力キャッシュをクリア
   */
  clearAllFormInputCache() {
    this.state['formInputCache'] = {};
    this.saveStateToStorage();
  }
}

// グローバルインスタンスを作成
console.log('🔧 SimpleStateManager class defined:', typeof SimpleStateManager);
appWindow.stateManager = new SimpleStateManager();
console.log('✅ appWindow.stateManager initialized:', !!appWindow.stateManager);
console.log('   stateManager type:', typeof appWindow.stateManager);
